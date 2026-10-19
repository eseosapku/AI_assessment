"""Database queries (UP, AL): a table of six to eight records (students, or a farm cooperative's harvests) under its
name, and an SQL query, SELECT ... FROM ... WHERE ... ORDER BY .... How many records the query returns, and the
first selected field of its first and of its last record.

Every key is the query run on the drawn records; the field it sorts on never ties among the records returned.

Lower Secondary (P4, sub "grid"): five or six records and the query as a database program's query design grid (Field,
Sort, Show, Criteria) instead of SQL: one criterion and one sort. How many records the results show, and the value at
the top and at the bottom of the results. For Cambridge Lower Secondary Computing 9, "Big Data modelling and analysis:
Databases and spreadsheets".
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, new_figure, short

ID = "database_query"
KIND = "table.data"
SUBJECT = "computing"
BANDS = ("UP", "AL", "LS")
SQL = tuple(f"computing.{c}" for c in ("database-queries", "sql-data-manipulation-language", "database-tables"))
GRID = tuple(f"computing.{c}" for c in ("database-queries", "database-tables"))
CONCEPTS = SQL
AVOID = r"spreadsheet|network|internet|security|graphic|presentation|email|python|html|logic gate|boolean|\bgis\b|arcgis"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"database|sql|query|queries|record|field|table|dbms|select"
DISTRICTS = ["Musanze", "Huye", "Rubavu", "Nyagatare", "Kayonza", "Rusizi"]
CROPS = ["Maize", "Beans", "Potatoes", "Coffee"]
TABLES = {
    "STUDENTS": ["StudentID", "Name", "Class", "Age", "Mark"],
    "HARVEST": ["FarmID", "Farmer", "District", "Crop", "Yield"],
}


def concepts_for(p: dict) -> tuple[str, ...]:
    return GRID if p.get("sub") == "grid" else SQL


def avoid_for(p: dict) -> str:
    # Cambridge Lower Secondary 9 teaches its queries in "Databases and spreadsheets".
    return AVOID.replace("spreadsheet|", "") if p.get("sub") == "grid" else AVOID


def _records(name: str, n: int, rng: random.Random) -> list[dict]:
    people = rng.sample(NAMES, n)
    if name == "STUDENTS":
        marks = rng.sample(range(30, 100), n)
        return [{"StudentID": f"S{i + 1:02d}", "Name": people[i], "Class": rng.choice(["S1", "S2", "S3"]),
                 "Age": rng.randint(12, 17), "Mark": marks[i]} for i in range(n)]
    yields = rng.sample(range(20, 91), n)
    return [{"FarmID": f"F{i + 1:02d}", "Farmer": people[i], "District": rng.choice(DISTRICTS[:4]),
             "Crop": rng.choice(CROPS), "Yield": yields[i] * 10} for i in range(n)]


def run_query(p: dict) -> list[dict]:
    field, op, value = p["query"]["where"]
    keep = {">": lambda a: a > value, "<": lambda a: a < value, "=": lambda a: a == value}[op]
    rows = [r for r in p["records"] if keep(r[field])]
    key, way = p["query"]["order"]
    return sorted(rows, key=lambda r: r[key], reverse=way == "DESC")


def _sample_grid(rng: random.Random) -> dict:
    """A Lower Secondary query: five or six records, one criterion, one sort, two or three fields shown."""
    name = rng.choice(list(TABLES))
    fields = TABLES[name]
    while True:
        records = _records(name, rng.randint(5, 6), rng)
        num, text = fields[4], rng.choice(fields[2:4])
        if rng.random() < 0.5:
            cut = rng.choice(sorted(r[num] for r in records)[1:-1])
            where = [num, rng.choice([">", "<"]), cut]
        else:
            where = [text, "=", rng.choice([r[text] for r in records])]
        order = [rng.choice([num, fields[1]]), rng.choice(["ASC", "DESC"])]
        shown = [fields[1]] + rng.sample([f for f in fields[2:] if f != order[0]], rng.randint(1, 2))
        p = {"band": "LS", "sub": "grid", "table": name, "fields": fields, "records": records,
             "query": {"select": shown, "where": where, "order": order}}
        rows = run_query(p)
        if 2 <= len(rows) <= 4 and len({r[order[0]] for r in rows}) == len(rows):
            return p


def sample(rng: random.Random) -> dict:
    if rng.random() < 0.3:
        return _sample_grid(rng)
    name = rng.choice(list(TABLES))
    fields = TABLES[name]
    while True:
        records = _records(name, rng.randint(6, 8), rng)
        num = fields[4]
        text = rng.choice(fields[2:4])
        if rng.random() < 0.5:
            cut = rng.choice(sorted(r[num] for r in records)[1:-1])
            where = [num, rng.choice([">", "<"]), cut]
        else:
            where = [text, "=", rng.choice([r[text] for r in records])]
        order = [rng.choice([num, fields[1]]), rng.choice(["ASC", "DESC"])]
        select = [fields[1], rng.choice([f for f in fields if f not in (fields[1],)])]
        p = {"band": rng.choice(("UP", "AL")), "table": name, "fields": fields, "records": records,
             "query": {"select": select, "where": where, "order": order}}
        rows = run_query(p)
        if 2 <= len(rows) <= 5 and len({r[order[0]] for r in rows}) == len(rows):
            return p


def sql(p: dict) -> list[str]:
    q = p["query"]
    field, op, value = q["where"]
    shown = f"'{value}'" if isinstance(value, str) else str(value)
    return [f"SELECT {', '.join(q['select'])}", f"FROM {p['table']}", f"WHERE {field} {op} {shown}",
            f"ORDER BY {q['order'][0]} {q['order'][1]};"]


def grid_columns(p: dict) -> list[list[str]]:
    """The query design grid, one column per field: field, table, sort, show, criteria."""
    q = p["query"]
    field, op, value = q["where"]
    order, way = q["order"]
    names = list(dict.fromkeys(q["select"] + [field, order]))
    cols = []
    for f in names:
        crit = ""
        if f == field:
            crit = f'"{value}"' if isinstance(value, str) else f"{op}{value}"
        sort = ("Ascending" if way == "ASC" else "Descending") if f == order else ""
        cols.append([f, p["table"], sort, "yes" if f in q["select"] else "", crit])
    return cols


def _draw_grid(p: dict):
    fields, records = p["fields"], p["records"]
    cols = grid_columns(p)
    fig, ax = new_figure(8.0, 6.4)
    widths = [2.1, 1.9, 1.7, 1.5, 1.4]
    rh = 0.5
    top = 0.0
    ax.text(0, top + 0.12, f"Table: {p['table']}", ha="left", va="bottom", fontsize=11, fontweight="bold")
    x = 0.0
    for f, w in zip(fields, widths):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.1, top - rh / 2, f, ha="left", va="center", fontsize=10, fontweight="bold")
        for r, rec in enumerate(records):
            y = top - (r + 2) * rh
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            ax.text(x + 0.1, y + rh / 2, str(rec[f]), ha="left", va="center", fontsize=10)
        x += w
    right = x
    # the query design grid, as a database program shows it
    gy = top - (len(records) + 1) * rh - 0.5
    ax.text(0, gy, f"Query design: Search{p['table'].title()}", ha="left", va="center", fontsize=11, fontweight="bold")
    heads = ["Field:", "Table:", "Sort:", "Show:", "Criteria:"]
    lw, cw = 1.3, 1.75
    for i, head in enumerate(heads):
        y = gy - 0.35 - (i + 1) * rh
        ax.add_patch(Rectangle((0, y), lw, rh, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
        ax.text(0.1, y + rh / 2, head, ha="left", va="center", fontsize=10, fontweight="bold")
        for c, col in enumerate(cols):
            cx = lw + c * cw
            ax.add_patch(Rectangle((cx, y), cw, rh, facecolor="white", edgecolor=INK, linewidth=0.9))
            v = col[i]
            if head == "Show:":  # a tick box, ticked or not
                ax.add_patch(Rectangle((cx + cw / 2 - 0.12, y + rh / 2 - 0.12), 0.24, 0.24, facecolor="white",
                                       edgecolor=INK, linewidth=1.0))
                if v:
                    ax.plot([cx + cw / 2 - 0.08, cx + cw / 2 - 0.01, cx + cw / 2 + 0.1],
                            [y + rh / 2, y + rh / 2 - 0.08, y + rh / 2 + 0.1], color=INK, linewidth=1.6)
            elif v:
                ax.text(cx + 0.1, y + rh / 2, v, ha="left", va="center", fontsize=10,
                        family="monospace" if head == "Criteria:" else None)
    bottom = gy - 0.35 - len(heads) * rh - rh
    ax.set_xlim(-0.1, max(right, lw + len(cols) * cw) + 0.1)
    ax.set_ylim(bottom - 0.1, top + 0.55)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    if p.get("sub") == "grid":
        return _draw_grid(p)
    fields, records = p["fields"], p["records"]
    fig, ax = new_figure(8.0, 5.6)
    widths = [2.1, 1.9, 1.7, 1.5, 1.4]
    rh = 0.5
    top = (len(records) + 1) * rh + 0.6
    ax.text(0, top + 0.12, f"Table: {p['table']}", ha="left", va="bottom", fontsize=11, fontweight="bold")
    x = 0.0
    for c, (f, w) in enumerate(zip(fields, widths)):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.1, top - rh / 2, f, ha="left", va="center", fontsize=10, fontweight="bold")
        for r, rec in enumerate(records):
            y = top - (r + 2) * rh
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            ax.text(x + 0.1, y + rh / 2, str(rec[f]), ha="left", va="center", fontsize=10)
        x += w
    lines = sql(p)
    qy = top - (len(records) + 1) * rh - 0.35
    ax.add_patch(Rectangle((0, qy - len(lines) * 0.42 - 0.15), 5.2, len(lines) * 0.42 + 0.3, facecolor="#f7f8f9",
                           edgecolor=INK, linewidth=1.0))
    for i, line in enumerate(lines):
        ax.text(0.15, qy - (i + 0.5) * 0.42, line, ha="left", va="center", fontsize=10.5, family="monospace")
    ax.set_xlim(-0.1, x + 0.1)
    ax.set_ylim(qy - len(lines) * 0.42 - 0.25, top + 0.55)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


GRID_SETTINGS = ["in the computer room", "for a class project", "in an ICT lesson", "at the school library",
                 "for the cooperative's report", "for homework"]


def _grid_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    rows = run_query(p)
    first = p["query"]["select"][0]
    a, z = str(rows[0][first]), str(rows[-1][first])
    table = p["table"]
    return [short(f"{who} runs this query on the {table} table in a database program {rng.choice(GRID_SETTINGS)}. "
                  f"How many records will the results show?", len(rows), [str(len(rows)), f"{len(rows)} records"]),
            short(f"When this query is run on the {table} table, which {first} is at the top of the results?", a, [a]),
            short(f"When this query is run on the {table} table, which {first} is at the bottom of the results?", z, [z])]


def questions(p: dict, rng: random.Random) -> list:
    if p.get("sub") == "grid":
        return _grid_questions(p, rng)
    who, friend = rng.sample(NAMES, 2)
    rows = run_query(p)
    first = p["query"]["select"][0]
    a, z = str(rows[0][first]), str(rows[-1][first])
    return [short(f"{who} runs this query on the {p['table']} table {rng.choice(SETTINGS)}. How many records does it return?",
                  len(rows), [str(len(rows)), f"{len(rows)} records"]),
            short(f"What is the {first} in the first record the query returns, in the order it sorts them?", a, [a]),
            short(f"{friend} reads the results. What is the {first} in the last record returned?", z, [z])]
