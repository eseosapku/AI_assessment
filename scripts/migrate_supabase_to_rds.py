#!/usr/bin/env python3
"""
Migrate all application data from Supabase PostgreSQL to Amazon RDS PostgreSQL.

Standard setup (.env) — uses your existing Supabase + RDS secrets:
  NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  DATABASE_URL=postgresql://user:pass@your-rds-host:5432/postgres

Optional (faster / full access without RLS):
  SUPABASE_SERVICE_ROLE_KEY=...   # preferred over anon for migrations
  SUPABASE_DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
  SUPABASE_DB_PASSWORD=...        # with NEXT_PUBLIC_SUPABASE_URL builds direct Postgres URL

Install:
  pip install -r scripts/requirements-migrate.txt

Examples:
  python scripts/migrate_supabase_to_rds.py
  python scripts/migrate_supabase_to_rds.py --dry-run
  python scripts/migrate_supabase_to_rds.py --verify-only
  python scripts/migrate_supabase_to_rds.py --tables users,textbooks,topics

Resume (default): skips tables already fully copied to RDS (target count >= source).
If Wi‑Fi drops, the script stops safely — re-run the same command to continue.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Iterable, Sequence, TypeVar
from urllib.parse import quote, urlparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import sql
except ImportError:
    psycopg2 = None  # type: ignore

# Migration order respects foreign-key dependencies.
TABLE_SPECS: list[dict[str, Any]] = [
    {"table": "users", "pk": ["id"]},
    {"table": "textbooks", "pk": ["textbook_id"], "serial": "textbook_id"},
    {"table": "topics", "pk": ["topic_id"], "serial": "topic_id"},
    {"table": "subtopics", "pk": ["subtopic_id"], "serial": "subtopic_id"},
    {"table": "classes", "pk": ["id"], "serial": "id"},
    {"table": "class_textbooks", "pk": ["class_id", "textbook_id"]},
    {"table": "classrooms", "pk": ["id"]},
    {"table": "classroom_members", "pk": ["id"]},
    {"table": "user_activity_daily", "pk": ["user_id", "activity_date"]},
    {"table": "assessments", "pk": ["id"]},
    {"table": "results", "pk": ["id"]},
    {"table": "assignments", "pk": ["id"]},
    {"table": "assignment_classrooms", "pk": ["id"]},
    {"table": "assignment_results", "pk": ["id"]},
    {"table": "learnspaces", "pk": ["id"]},
    {"table": "learnspace_messages", "pk": ["id"]},
    {"table": "topic_mastery", "pk": ["id"]},
    {"table": "ai_jobs", "pk": ["id"]},
]

BATCH_SIZE = 500
REST_PAGE_SIZE = 250
NETWORK_RETRIES = 5
NETWORK_RETRY_BASE_SEC = 3
LOG_DIR = os.path.join(os.path.dirname(__file__), "migration_logs")
CHECKPOINT_FILE = os.path.join(LOG_DIR, "checkpoint.json")

T = TypeVar("T")


class MigrationInterrupted(Exception):
    """Raised when the network drops — safe to re-run; completed rows stay in RDS."""

    def __init__(self, table: str, reason: str, rows_done: int = 0):
        self.table = table
        self.reason = reason
        self.rows_done = rows_done
        super().__init__(f"{table}: {reason}")


@dataclass
class TableResult:
    table: str
    source_count: int = 0
    target_count_before: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    skipped_existing: int = 0
    failed: int = 0
    source_missing: bool = False
    already_complete: bool = False
    interrupted: bool = False
    errors: list[str] = field(default_factory=list)


def setup_logging(verbose: bool) -> logging.Logger:
    os.makedirs(LOG_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(LOG_DIR, f"migrate_{stamp}.log")

    logger = logging.getLogger("supabase_to_rds")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG if verbose else logging.INFO)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.info("Log file: %s", log_path)
    return logger


def load_environment() -> None:
    if load_dotenv:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        load_dotenv(os.path.join(root, ".env"), override=False)


def env_get(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip()
    # Tolerate accidental spaces in .env keys (e.g. "DATABASE_URL = ...").
    normalized = {k.strip(): v for k, v in os.environ.items()}
    for name in names:
        value = normalized.get(name)
        if value and value.strip():
            return value.strip()
    return None


def mask_secret(value: str | None, visible: int = 4) -> str:
    if not value:
        return "(missing)"
    if len(value) <= visible * 2:
        return "***"
    return f"{value[:visible]}...{value[-visible:]}"


def log_env_config(logger: logging.Logger) -> None:
    supabase_url = env_get("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")
    anon_key = env_get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")
    service_key = env_get("SUPABASE_SERVICE_ROLE_KEY")
    source_db = env_get("SUPABASE_DATABASE_URL", "SOURCE_DATABASE_URL")
    db_password = env_get("SUPABASE_DB_PASSWORD", "SUPABASE_DATABASE_PASSWORD")
    target_db = env_get("DATABASE_URL", "TARGET_DATABASE_URL", "AWS_DATABASE_URL")

    logger.info("Loaded .env configuration:")
    logger.info("  NEXT_PUBLIC_SUPABASE_URL = %s", supabase_url or "(missing)")
    logger.info("  NEXT_PUBLIC_SUPABASE_ANON_KEY = %s", mask_secret(anon_key))
    logger.info("  SUPABASE_SERVICE_ROLE_KEY = %s", mask_secret(service_key))
    logger.info("  SUPABASE_DATABASE_URL = %s", "set" if source_db else "(not set)")
    logger.info("  SUPABASE_DB_PASSWORD = %s", "set" if db_password else "(not set)")
    logger.info("  DATABASE_URL (AWS RDS) = %s", mask_secret(target_db, 8))


def extract_supabase_ref(supabase_url: str) -> str | None:
    match = re.search(r"https://([a-z0-9]+)\.supabase\.co", supabase_url, re.I)
    return match.group(1) if match else None


def resolve_supabase_database_url(logger: logging.Logger) -> str | None:
    direct = env_get("SUPABASE_DATABASE_URL", "SOURCE_DATABASE_URL")
    if direct:
        return direct

    password = env_get("SUPABASE_DB_PASSWORD", "SUPABASE_DATABASE_PASSWORD")
    project_url = env_get("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")
    if password and project_url:
        ref = extract_supabase_ref(project_url)
        if ref:
            # Direct session mode — best for bulk reads/writes during migration.
            built = (
                f"postgresql://postgres:{quote(password, safe='')}"
                f"@db.{ref}.supabase.co:5432/postgres"
            )
            logger.info("Built Supabase DATABASE URL from NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD")
            return built

    return None


def resolve_target_database_url() -> str | None:
    return env_get("DATABASE_URL", "TARGET_DATABASE_URL", "AWS_DATABASE_URL")


def resolve_rest_credentials(logger: logging.Logger) -> tuple[str, str, str] | None:
    """Return (url, api_key, key_label) from .env Supabase REST credentials."""
    supabase_url = env_get("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")
    service_key = env_get("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = env_get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")

    if service_key and supabase_url:
        logger.info("Supabase source auth: SUPABASE_SERVICE_ROLE_KEY")
        return supabase_url, service_key, "SUPABASE_SERVICE_ROLE_KEY"

    if anon_key and supabase_url:
        logger.info("Supabase source auth: NEXT_PUBLIC_SUPABASE_ANON_KEY (from .env)")
        return supabase_url, anon_key, "NEXT_PUBLIC_SUPABASE_ANON_KEY"

    return None


def connect_postgres(url: str, label: str, logger: logging.Logger):
    if not psycopg2:
        raise RuntimeError("psycopg2 is required. Run: pip install -r scripts/requirements-migrate.txt")

    parsed = urlparse(url)
    logger.info("Connecting to %s (%s:%s/%s)", label, parsed.hostname, parsed.port or 5432, parsed.path.lstrip("/"))

    def _connect():
        conn = psycopg2.connect(url, connect_timeout=30, sslmode="require")
        conn.autocommit = False
        return conn

    return retry_network(f"connect {label}", _connect, logger)


def table_exists(conn, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = %s
            )
            """,
            (table,),
        )
        return bool(cur.fetchone()[0])


def get_columns(conn, table: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return [row[0] for row in cur.fetchall()]


def count_rows(conn, table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
        return int(cur.fetchone()[0])


def is_network_error(exc: BaseException) -> bool:
    if isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return True
    if psycopg2 and isinstance(exc, psycopg2.OperationalError):
        return True
    name = type(exc).__name__.lower()
    module = type(exc).__module__.lower()
    network_markers = (
        "timeout",
        "connection",
        "network",
        "disconnect",
        "reset",
        "broken pipe",
        "name or service not known",
        "temporary failure",
        "ssl",
        "eof",
    )
    text = f"{exc}".lower()
    if any(m in name for m in ("timeout", "connect", "network")):
        return True
    if "httpx" in module or "httpcore" in module or "requests" in module:
        return True
    return any(m in text for m in network_markers)


def retry_network(
    label: str,
    fn: Callable[[], T],
    logger: logging.Logger,
    *,
    retries: int = NETWORK_RETRIES,
) -> T:
    last_exc: BaseException | None = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if not is_network_error(exc) or attempt >= retries:
                raise
            wait = NETWORK_RETRY_BASE_SEC * attempt
            logger.warning(
                "%s: network error (attempt %s/%s): %s — retrying in %ss",
                label,
                attempt,
                retries,
                exc,
                wait,
            )
            time.sleep(wait)
    raise last_exc  # type: ignore[misc]


def load_checkpoint() -> dict[str, Any]:
    if not os.path.isfile(CHECKPOINT_FILE):
        return {"completed_tables": [], "in_progress": None}
    try:
        with open(CHECKPOINT_FILE, encoding="utf-8") as handle:
            return json.load(handle)
    except (json.JSONDecodeError, OSError):
        return {"completed_tables": [], "in_progress": None}


def save_checkpoint(
    *,
    completed_tables: list[str],
    in_progress: dict[str, Any] | None = None,
    interrupted: bool = False,
    reason: str | None = None,
) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "completed_tables": completed_tables,
        "in_progress": in_progress,
        "interrupted": interrupted,
        "reason": reason,
    }
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def row_pk(row: dict[str, Any], pk: Sequence[str]) -> Any:
    if len(pk) == 1:
        return row.get(pk[0])
    return tuple(row.get(col) for col in pk)


def load_existing_pks(target_conn, table: str, pk: Sequence[str], logger: logging.Logger) -> set[Any]:
    if len(pk) == 1:
        col = sql.Identifier(pk[0])
        query = sql.SQL("SELECT {} FROM {}").format(col, sql.Identifier(table))
    else:
        cols = sql.SQL(", ").join(sql.Identifier(c) for c in pk)
        query = sql.SQL("SELECT {} FROM {}").format(cols, sql.Identifier(table))

    def _fetch() -> set[Any]:
        with target_conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
        if len(pk) == 1:
            return {r[0] for r in rows}
        return {tuple(r) for r in rows}

    existing = retry_network(f"[{table}] load existing PKs", _fetch, logger)
    logger.info("[%s] Found %s rows already in RDS — will skip those PKs", table, len(existing))
    return existing


def table_is_complete(source_count: int, target_count: int) -> bool:
    return source_count >= 0 and target_count >= source_count and source_count > 0


def normalize_value(value: Any) -> Any:
    if isinstance(value, dict):
        return psycopg2.extras.Json(value)
    if isinstance(value, list):
        # JSONB array vs Postgres array — if elements are not simple scalars, treat as JSON.
        if value and any(isinstance(v, (dict, list)) for v in value):
            return psycopg2.extras.Json(value)
    return value


def build_upsert_sql(table: str, columns: Sequence[str], pk: Sequence[str]) -> str:
    non_pk = [c for c in columns if c not in pk]
    cols_sql = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    conflict_cols = ", ".join(f'"{c}"' for c in pk)

    if non_pk:
        set_sql = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk)
        conflict_action = f"DO UPDATE SET {set_sql}"
    else:
        conflict_action = "DO NOTHING"

    return (
        f'INSERT INTO "{table}" ({cols_sql}) VALUES ({placeholders}) '
        f"ON CONFLICT ({conflict_cols}) {conflict_action} "
        f"RETURNING (xmax = 0) AS inserted"
    )


def fetch_source_page_pg(
    conn,
    table: str,
    columns: Sequence[str],
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    col_sql = sql.SQL(", ").join(sql.Identifier(c) for c in columns)
    query = sql.SQL("SELECT {} FROM {} ORDER BY 1 LIMIT %s OFFSET %s").format(
        col_sql,
        sql.Identifier(table),
    )
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, (limit, offset))
        return [dict(row) for row in cur.fetchall()]


def migrate_table_paged(
    target_conn,
    spec: dict[str, Any],
    *,
    dry_run: bool,
    logger: logging.Logger,
    source_count: int,
    columns: Sequence[str],
    fetch_page: Callable[[int, int], list[dict[str, Any]]],
    completed_tables: list[str],
) -> TableResult:
    table = spec["table"]
    pk = spec["pk"]
    result = TableResult(table=table)
    result.source_count = source_count
    result.target_count_before = count_rows(target_conn, table)

    if source_count == 0:
        logger.info("[%s] Source is empty — nothing to copy", table)
        return result

    if table_is_complete(source_count, result.target_count_before):
        logger.info(
            "[%s] Already complete in RDS (%s >= %s) — skipping",
            table,
            result.target_count_before,
            source_count,
        )
        result.already_complete = True
        result.skipped = source_count
        if table not in completed_tables:
            completed_tables.append(table)
            save_checkpoint(completed_tables=completed_tables, in_progress=None)
        return result

    if dry_run:
        return result

    skip_pks: set[Any] = set()
    if result.target_count_before > 0:
        skip_pks = load_existing_pks(target_conn, table, pk, logger)

    offset = 0
    save_checkpoint(
        completed_tables=completed_tables,
        in_progress={"table": table, "source_count": source_count, "offset": offset},
    )

    try:
        while offset < source_count:
            try:
                page = fetch_page(offset, REST_PAGE_SIZE)
            except Exception as exc:
                if is_network_error(exc):
                    save_checkpoint(
                        completed_tables=completed_tables,
                        in_progress={"table": table, "source_count": source_count, "offset": offset},
                        interrupted=True,
                        reason=str(exc),
                    )
                    raise MigrationInterrupted(
                        table,
                        f"network error fetching page offset={offset}: {exc}",
                        result.inserted + result.updated,
                    ) from exc
                raise

            if not page:
                break

            upsert_rows(
                target_conn,
                table,
                columns,
                pk,
                page,
                result,
                logger,
                skip_pks=skip_pks,
            )
            offset += len(page)

            logger.info(
                "[%s] Progress %s/%s rows processed (inserted=%s updated=%s skipped_existing=%s)",
                table,
                min(offset, source_count),
                source_count,
                result.inserted,
                result.updated,
                result.skipped_existing,
            )
            save_checkpoint(
                completed_tables=completed_tables,
                in_progress={"table": table, "source_count": source_count, "offset": offset},
            )

            if len(page) < REST_PAGE_SIZE:
                break
    except MigrationInterrupted as exc:
        result.interrupted = True
        save_checkpoint(
            completed_tables=completed_tables,
            in_progress={"table": table, "source_count": source_count, "offset": offset},
            interrupted=True,
            reason=str(exc),
        )
        raise

    final_target = count_rows(target_conn, table)
    if final_target < source_count:
        logger.warning(
            "[%s] Target count %s still below source %s after migration",
            table,
            final_target,
            source_count,
        )
    else:
        if table not in completed_tables:
            completed_tables.append(table)
        save_checkpoint(completed_tables=completed_tables, in_progress=None)
        serial_col = spec.get("serial")
        if serial_col and result.failed == 0:
            reset_serial_sequence(target_conn, table, serial_col, logger)

    return result


def migrate_table_pg(
    source_conn,
    target_conn,
    spec: dict[str, Any],
    *,
    dry_run: bool,
    logger: logging.Logger,
    completed_tables: list[str],
) -> TableResult:
    table = spec["table"]
    result = TableResult(table=table)

    if not table_exists(source_conn, table):
        logger.warning("[%s] Source table missing — skipped", table)
        result.source_missing = True
        return result

    if not table_exists(target_conn, table):
        msg = f"Target table public.{table} does not exist. Run migrations/full-platform-schema.sql first."
        logger.error("[%s] %s", table, msg)
        result.errors.append(msg)
        return result

    source_cols = set(get_columns(source_conn, table))
    target_cols = set(get_columns(target_conn, table))
    columns = [c for c in get_columns(target_conn, table) if c in source_cols]

    if not columns:
        msg = "No overlapping columns between source and target"
        logger.error("[%s] %s", table, msg)
        result.errors.append(msg)
        return result

    missing_on_source = sorted(target_cols - source_cols)
    if missing_on_source:
        logger.info("[%s] Target-only columns (will use DB defaults): %s", table, ", ".join(missing_on_source))

    def _count() -> int:
        return count_rows(source_conn, table)

    source_count = retry_network(f"[{table}] source count", _count, logger)
    logger.info("[%s] Supabase Postgres source has %s rows", table, source_count)

    def fetch_page(offset: int, limit: int) -> list[dict[str, Any]]:
        return retry_network(
            f"[{table}] fetch page offset={offset}",
            lambda: fetch_source_page_pg(source_conn, table, columns, offset, limit),
            logger,
        )

    return migrate_table_paged(
        target_conn,
        spec,
        dry_run=dry_run,
        logger=logger,
        source_count=source_count,
        columns=columns,
        fetch_page=fetch_page,
        completed_tables=completed_tables,
    )


def reset_serial_sequence(conn, table: str, serial_col: str, logger: logging.Logger) -> None:
    """Align SERIAL/IDENTITY sequence with MAX(pk) after bulk insert."""
    try:
        with conn.cursor() as cur:
            # pg_get_serial_sequence(table_name text, column_name text) — not regclass.
            cur.execute(
                "SELECT pg_get_serial_sequence(%s, %s)",
                (f"public.{table}", serial_col),
            )
            seq_name = cur.fetchone()[0]
            if not seq_name:
                logger.warning("[%s] No serial sequence on %s — skipped", table, serial_col)
                return

            query = sql.SQL(
                """
                SELECT setval(
                  {seq}::regclass,
                  COALESCE((SELECT MAX({serial_id}) FROM {tbl}), 1),
                  (SELECT COUNT(*) > 0 FROM {tbl})
                )
                """
            ).format(
                seq=sql.Literal(seq_name),
                serial_id=sql.Identifier(serial_col),
                tbl=sql.Identifier(table),
            )
            cur.execute(query)
        conn.commit()
        logger.info("[%s] Reset serial sequence for %s", table, serial_col)
    except Exception as exc:  # noqa: BLE001 — non-fatal; data is already committed
        conn.rollback()
        logger.warning("[%s] Could not reset serial sequence for %s: %s", table, serial_col, exc)


def upsert_rows(
    target_conn,
    table: str,
    columns: Sequence[str],
    pk: Sequence[str],
    rows: Sequence[dict[str, Any]],
    result: TableResult,
    logger: logging.Logger,
    *,
    skip_pks: set[Any] | None = None,
) -> None:
    upsert_sql = build_upsert_sql(table, columns, pk)
    skip_pks = skip_pks or set()

    with target_conn.cursor() as cur:
        for batch_index, offset in enumerate(range(0, len(rows), BATCH_SIZE)):
            batch = rows[offset : offset + BATCH_SIZE]
            for row_index, row in enumerate(batch):
                pk_val = row_pk(row, pk)
                if pk_val in skip_pks:
                    result.skipped_existing += 1
                    continue

                sp_name = f"migrate_{table}_{batch_index}_{row_index}"
                values = [normalize_value(row.get(col)) for col in columns]
                try:
                    cur.execute(sql.SQL("SAVEPOINT {}").format(sql.Identifier(sp_name)))
                    cur.execute(upsert_sql, values)
                    returned = cur.fetchone()
                    if returned and returned[0]:
                        result.inserted += 1
                    else:
                        result.updated += 1
                    cur.execute(sql.SQL("RELEASE SAVEPOINT {}").format(sql.Identifier(sp_name)))
                except Exception as exc:  # noqa: BLE001
                    cur.execute(sql.SQL("ROLLBACK TO SAVEPOINT {}").format(sql.Identifier(sp_name)))
                    if is_network_error(exc):
                        try:
                            target_conn.rollback()
                        except Exception:
                            pass
                        raise MigrationInterrupted(
                            table,
                            f"network error while writing row pk={pk_val!r}: {exc}",
                            result.inserted + result.updated,
                        ) from exc
                    result.failed += 1
                    err = f"row pk={{{', '.join(f'{k}={row.get(k)!r}' for k in pk)}}}: {exc}"
                    result.errors.append(err)
                    if len(result.errors) <= 10:
                        logger.error("[%s] %s", table, err)

            def _commit() -> None:
                target_conn.commit()

            try:
                retry_network(f"[{table}] commit batch {batch_index}", _commit, logger)
            except Exception as exc:
                if is_network_error(exc):
                    raise MigrationInterrupted(
                        table,
                        f"network error on commit: {exc}",
                        result.inserted + result.updated,
                    ) from exc
                raise


class RestSource:
    """Fallback reader using Supabase REST when direct Postgres is unavailable."""

    def __init__(self, url: str, key: str, logger: logging.Logger):
        try:
            from supabase import create_client
        except ImportError as exc:
            raise RuntimeError("supabase package required for REST mode") from exc

        self.client = create_client(url, key)
        self.logger = logger

    def table_exists(self, table: str) -> bool:
        try:
            self.client.table(table).select("*", count="exact").limit(1).execute()
            return True
        except Exception:
            return False

    def count_rows(self, table: str) -> int | None:
        def _count() -> int:
            response = self.client.table(table).select("*", count="exact").limit(0).execute()
            return int(response.count or 0)

        try:
            return retry_network(f"[{table}] REST count", _count, self.logger)
        except Exception:
            return None

    def fetch_page(self, table: str, offset: int, page_size: int) -> list[dict[str, Any]]:
        end = offset + page_size - 1

        def _fetch() -> list[dict[str, Any]]:
            response = self.client.table(table).select("*").range(offset, end).execute()
            return list(response.data or [])

        return retry_network(f"[{table}] REST page offset={offset}", _fetch, self.logger)

    def fetch_all(self, table: str) -> list[dict[str, Any]]:
        offset = 0
        rows: list[dict[str, Any]] = []
        while True:
            page = self.fetch_page(table, offset, REST_PAGE_SIZE)
            if not page:
                break
            rows.extend(page)
            self.logger.debug("[%s] REST page offset=%s rows=%s", table, offset, len(page))
            if len(page) < REST_PAGE_SIZE:
                break
            offset += REST_PAGE_SIZE
        return rows


def migrate_table_rest(
    rest: RestSource,
    target_conn,
    spec: dict[str, Any],
    *,
    dry_run: bool,
    logger: logging.Logger,
    completed_tables: list[str],
) -> TableResult:
    table = spec["table"]
    result = TableResult(table=table)

    if not rest.table_exists(table):
        logger.warning("[%s] Source table missing in Supabase REST — skipped", table)
        result.source_missing = True
        return result

    if not table_exists(target_conn, table):
        msg = f"Target table public.{table} does not exist. Run migrations/full-platform-schema.sql first."
        logger.error("[%s] %s", table, msg)
        result.errors.append(msg)
        return result

    source_count = rest.count_rows(table)
    if source_count is None:
        msg = "Could not count source rows via REST"
        logger.error("[%s] %s", table, msg)
        result.errors.append(msg)
        return result

    logger.info("[%s] Supabase REST source has %s rows", table, source_count)

    target_cols = get_columns(target_conn, table)

    def fetch_page(offset: int, limit: int) -> list[dict[str, Any]]:
        page = rest.fetch_page(table, offset, limit)
        if not page:
            return []
        # Intersect columns on first non-empty page shape.
        return page

    # Probe first page for column list (or empty table).
    sample = rest.fetch_page(table, 0, 1) if source_count > 0 else []
    if sample:
        columns = [c for c in target_cols if c in sample[0]]
    else:
        columns = list(target_cols)

    if not columns and source_count > 0:
        msg = "No overlapping columns between source and target"
        logger.error("[%s] %s", table, msg)
        result.errors.append(msg)
        return result

    return migrate_table_paged(
        target_conn,
        spec,
        dry_run=dry_run,
        logger=logger,
        source_count=source_count,
        columns=columns,
        fetch_page=fetch_page,
        completed_tables=completed_tables,
    )


def truncate_target_tables(target_conn, tables: Iterable[str], logger: logging.Logger) -> None:
    table_list = list(tables)
    # CASCADE clears dependent rows; reverse order is safer but CASCADE handles FK graph.
    with target_conn.cursor() as cur:
        for table in reversed(table_list):
            logger.warning("Truncating target table %s RESTART IDENTITY CASCADE", table)
            cur.execute(
                sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(sql.Identifier(table))
            )
    target_conn.commit()


def verify_counts_pg(
    source_conn,
    target_conn,
    specs: Sequence[dict[str, Any]],
    logger: logging.Logger,
) -> bool:
    ok = True
    logger.info("=== Verification: row counts (Postgres source) ===")
    for spec in specs:
        table = spec["table"]
        if not table_exists(source_conn, table):
            logger.info("[%s] source: (missing) | target: %s", table, count_rows(target_conn, table) if table_exists(target_conn, table) else "(missing)")
            continue
        if not table_exists(target_conn, table):
            logger.error("[%s] target table missing", table)
            ok = False
            continue

        src = count_rows(source_conn, table)
        tgt = count_rows(target_conn, table)
        status = "OK" if src == tgt else "MISMATCH"
        if src != tgt:
            ok = False
        logger.info("[%s] source=%s target=%s %s", table, src, tgt, status)
    return ok


def verify_counts_rest(
    rest: RestSource,
    target_conn,
    specs: Sequence[dict[str, Any]],
    logger: logging.Logger,
) -> bool:
    ok = True
    logger.info("=== Verification: row counts (Supabase REST source) ===")
    for spec in specs:
        table = spec["table"]
        if not rest.table_exists(table):
            logger.info("[%s] source: (missing) | target: %s", table, count_rows(target_conn, table) if table_exists(target_conn, table) else "(missing)")
            continue
        if not table_exists(target_conn, table):
            logger.error("[%s] target table missing", table)
            ok = False
            continue

        src = rest.count_rows(table)
        if src is None:
            logger.error("[%s] could not count source rows via REST", table)
            ok = False
            continue
        tgt = count_rows(target_conn, table)
        status = "OK" if src == tgt else "MISMATCH"
        if src != tgt:
            ok = False
        logger.info("[%s] source=%s target=%s %s", table, src, tgt, status)
    return ok


def print_summary(results: list[TableResult], logger: logging.Logger) -> None:
    logger.info("=== Migration summary ===")
    total_source = 0
    total_inserted = 0
    total_updated = 0
    total_failed = 0

    for r in results:
        total_source += r.source_count
        total_inserted += r.inserted
        total_updated += r.updated
        total_failed += r.failed
        if r.source_missing:
            logger.info("[%s] skipped (not in source)", r.table)
            continue
        if r.already_complete:
            logger.info(
                "[%s] already complete (source=%s, target before=%s)",
                r.table,
                r.source_count,
                r.target_count_before,
            )
            continue
        if r.interrupted:
            logger.info("[%s] INTERRUPTED (source=%s, inserted=%s updated=%s)", r.table, r.source_count, r.inserted, r.updated)
            continue
        logger.info(
            "[%s] source=%s inserted=%s updated=%s skipped_existing=%s failed=%s",
            r.table,
            r.source_count,
            r.inserted,
            r.updated,
            r.skipped_existing,
            r.failed,
        )
        for err in r.errors[:3]:
            logger.info("  error: %s", err)

    logger.info(
        "TOTAL source_rows=%s inserted=%s updated=%s failed=%s",
        total_source,
        total_inserted,
        total_updated,
        total_failed,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate Supabase PostgreSQL data to AWS RDS.")
    parser.add_argument("--dry-run", action="store_true", help="Read and count only; no writes to RDS.")
    parser.add_argument("--verify-only", action="store_true", help="Compare row counts between source and target.")
    parser.add_argument("--tables", type=str, default="", help="Comma-separated subset of tables to migrate.")
    parser.add_argument("--verbose", action="store_true", help="Debug logging.")
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="TRUNCATE selected target tables before migration (destructive).",
    )
    parser.add_argument(
        "--i-understand-data-loss",
        action="store_true",
        help="Required with --truncate-target.",
    )
    parser.add_argument(
        "--use-rest",
        action="store_true",
        help="Force Supabase REST API instead of direct Postgres (slower).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_environment()
    logger = setup_logging(args.verbose)
    log_env_config(logger)

    target_url = resolve_target_database_url()
    if not target_url:
        logger.error("Missing DATABASE_URL in .env (AWS RDS connection string).")
        return 1

    specs = TABLE_SPECS
    if args.tables.strip():
        wanted = {t.strip() for t in args.tables.split(",") if t.strip()}
        specs = [s for s in TABLE_SPECS if s["table"] in wanted]
        unknown = wanted - {s["table"] for s in specs}
        if unknown:
            logger.error("Unknown tables: %s", ", ".join(sorted(unknown)))
            return 1

    if args.truncate_target and not args.i_understand_data_loss:
        logger.error("Refusing to truncate without --i-understand-data-loss")
        return 1

    rest_creds = resolve_rest_credentials(logger)
    source_url = None if args.use_rest else resolve_supabase_database_url(logger)
    rest_source: RestSource | None = None

    if source_url:
        logger.info("Supabase source: direct PostgreSQL")
    elif rest_creds:
        supabase_url, api_key, key_label = rest_creds
        if key_label == "NEXT_PUBLIC_SUPABASE_ANON_KEY":
            logger.warning(
                "Anon key may hide rows due to RLS. "
                "Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DATABASE_URL for full access."
            )
        rest_source = RestSource(supabase_url, api_key, logger)
        logger.info(
            "Supabase source: REST API (%s + %s)",
            "NEXT_PUBLIC_SUPABASE_URL",
            key_label,
        )
    else:
        logger.error(
            "No Supabase credentials found. Set in .env:\n"
            "  NEXT_PUBLIC_SUPABASE_URL\n"
            "  NEXT_PUBLIC_SUPABASE_ANON_KEY\n"
            "  DATABASE_URL\n"
            "Optional: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DATABASE_URL for fuller access."
        )
        return 1

    if psycopg2 is None:
        logger.error("Install dependencies: pip install -r scripts/requirements-migrate.txt")
        return 1

    source_conn = None
    target_conn = None

    try:
        if source_url:
            source_conn = connect_postgres(source_url, "Supabase (source)", logger)
        target_conn = connect_postgres(target_url, "AWS RDS (target)", logger)

        if args.verify_only:
            if source_conn:
                ok = verify_counts_pg(source_conn, target_conn, specs, logger)
            else:
                assert rest_source is not None
                ok = verify_counts_rest(rest_source, target_conn, specs, logger)
            return 0 if ok else 2

        if args.truncate_target and not args.dry_run:
            truncate_target_tables(target_conn, [s["table"] for s in specs], logger)
            save_checkpoint(completed_tables=[], in_progress=None)

        checkpoint = load_checkpoint()
        completed_tables: list[str] = list(checkpoint.get("completed_tables") or [])
        if completed_tables:
            logger.info(
                "Resume: %s table(s) marked complete in checkpoint: %s",
                len(completed_tables),
                ", ".join(completed_tables),
            )
        if checkpoint.get("interrupted"):
            logger.info(
                "Previous run stopped (%s). Will skip finished tables and continue.",
                checkpoint.get("reason") or "network interruption",
            )

        results: list[TableResult] = []
        try:
            for spec in specs:
                logger.info("--- Migrating %s ---", spec["table"])
                if source_conn:
                    result = migrate_table_pg(
                        source_conn,
                        target_conn,
                        spec,
                        dry_run=args.dry_run,
                        logger=logger,
                        completed_tables=completed_tables,
                    )
                else:
                    assert rest_source is not None
                    result = migrate_table_rest(
                        rest_source,
                        target_conn,
                        spec,
                        dry_run=args.dry_run,
                        logger=logger,
                        completed_tables=completed_tables,
                    )
                results.append(result)
        except MigrationInterrupted as exc:
            logger.error(
                "Stopped safely after network issue on '%s': %s",
                exc.table,
                exc.reason,
            )
            logger.error(
                "Data written so far is saved in RDS. Re-run: python scripts/migrate_supabase_to_rds.py"
            )
            print_summary(results, logger)
            return 3

        print_summary(results, logger)

        if args.dry_run:
            logger.info("Dry run complete — no data written to RDS.")
        elif source_conn:
            verify_ok = verify_counts_pg(source_conn, target_conn, specs, logger)
            if not verify_ok:
                logger.warning("Post-migration verification found count mismatches. Review the log.")
                return 2
        elif rest_source:
            verify_ok = verify_counts_rest(rest_source, target_conn, specs, logger)
            if not verify_ok:
                logger.warning("Post-migration verification found count mismatches. Review the log.")
                return 2

        if any(r.failed for r in results):
            return 2

        # Write machine-readable summary next to log
        summary_path = os.path.join(
            LOG_DIR,
            f"summary_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json",
        )
        with open(summary_path, "w", encoding="utf-8") as handle:
            json.dump(
                [
                    {
                        "table": r.table,
                        "source_count": r.source_count,
                        "target_count_before": r.target_count_before,
                        "inserted": r.inserted,
                        "updated": r.updated,
                        "skipped_existing": r.skipped_existing,
                        "failed": r.failed,
                        "already_complete": r.already_complete,
                        "interrupted": r.interrupted,
                        "source_missing": r.source_missing,
                        "error_count": len(r.errors),
                    }
                    for r in results
                ],
                handle,
                indent=2,
            )
        logger.info("Summary JSON: %s", summary_path)
        return 0

    except Exception as exc:
        logger.exception("Migration failed: %s", exc)
        return 1
    finally:
        if source_conn:
            source_conn.close()
        if target_conn:
            target_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
