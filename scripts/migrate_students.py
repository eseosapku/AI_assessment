import csv
import os
import sys
from typing import Dict, List, Set, Tuple

DEFAULT_PASSWORD = "kcs12345"
DEFAULT_ROLE = "student"
DEFAULT_SUBJECTS = [
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
]


def load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except Exception:
        # Optional dependency; environment variables can be set by the shell.
        pass


def get_class_from_filename(filename: str) -> str:
    base = os.path.splitext(os.path.basename(filename))[0]
    if " - " in base:
        return base.rsplit(" - ", 1)[-1].strip()
    return base.strip()


def find_header_row(rows: List[List[str]]) -> Tuple[int, List[str]]:
    for idx, row in enumerate(rows):
        normalized = [cell.strip().lower() for cell in row]
        if "student_id" in normalized and "lastname" in normalized and "firstname" in normalized:
            return idx, normalized
    raise ValueError("Header row with student_id/lastname/firstname not found")


def parse_csv(path: str, class_name: str) -> List[Dict[str, str]]:
    with open(path, "r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        rows = list(reader)

    header_idx, header = find_header_row(rows)
    student_id_idx = header.index("student_id")
    lastname_idx = header.index("lastname")
    firstname_idx = header.index("firstname")

    records: List[Dict[str, str]] = []
    for row in rows[header_idx + 1 :]:
        if not any(cell.strip() for cell in row):
            continue

        student_id = row[student_id_idx].strip() if student_id_idx < len(row) else ""
        lastname = row[lastname_idx].strip() if lastname_idx < len(row) else ""
        firstname = row[firstname_idx].strip() if firstname_idx < len(row) else ""

        if not student_id or not lastname or not firstname:
            continue

        if student_id.strip().lower() in {"male", "female", "total"}:
            continue

        name = f"{lastname} {firstname}".strip()
        records.append(
            {
                "student_id": student_id.upper(),
                "name": name,
                "class": class_name,
            }
        )

    return records


def dedupe_students(students: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], Set[str]]:
    seen: Set[str] = set()
    duplicates: Set[str] = set()
    unique_students: List[Dict[str, str]] = []

    for student in students:
        student_id = student["student_id"]
        if student_id in seen:
            duplicates.add(student_id)
            continue
        seen.add(student_id)
        unique_students.append(student)

    return unique_students, duplicates


def chunk_list(values: List[str], size: int) -> List[List[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def get_result_error(result) -> str:
    if isinstance(result, dict):
        return result.get("error")
    return getattr(result, "error", None)


def get_result_data(result):
    if isinstance(result, dict):
        return result.get("data")
    return getattr(result, "data", None)


def fetch_existing_student_ids(supabase, student_ids: List[str]) -> Set[str]:
    existing: Set[str] = set()
    if not student_ids:
        return existing

    for chunk in chunk_list(student_ids, 200):
        response = supabase.table("users").select("student_id").in_("student_id", chunk).execute()
        error = get_result_error(response)
        if error:
            raise RuntimeError(f"Failed to check existing student IDs: {error}")
        data = get_result_data(response) or []
        for row in data:
            student_id = (row.get("student_id") or "").strip().upper()
            if student_id:
                existing.add(student_id)

    return existing


def build_payload(student: Dict[str, str], password_hash: str) -> Dict[str, object]:
    return {
        "email": None,
        "password_hash": password_hash,
        "name": student["name"],
        "student_id": student["student_id"],
        "class": student["class"],
        "role": DEFAULT_ROLE,
        "subjects": DEFAULT_SUBJECTS,
    }


def main() -> int:
    load_env()

    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        print("Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
        return 1

    try:
        from supabase import create_client
    except Exception:
        print("Missing dependency: supabase. Install with: pip install supabase")
        return 1

    try:
        import bcrypt
    except Exception:
        print("Missing dependency: bcrypt. Install with: pip install bcrypt")
        return 1

    csv_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "csv_migrate"))
    if not os.path.isdir(csv_dir):
        print(f"CSV directory not found: {csv_dir}")
        return 1

    dry_run = "--dry-run" in sys.argv

    students: List[Dict[str, str]] = []
    for filename in sorted(os.listdir(csv_dir)):
        if not filename.lower().endswith(".csv"):
            continue
        class_name = get_class_from_filename(filename)
        path = os.path.join(csv_dir, filename)
        file_students = parse_csv(path, class_name)
        students.extend(file_students)

    if not students:
        print("No students found in CSV files.")
        return 1

    students, duplicates = dedupe_students(students)
    if duplicates:
        print(f"Skipped {len(duplicates)} duplicate student IDs found in CSV files.")

    supabase = create_client(supabase_url, supabase_key)
    existing_ids = fetch_existing_student_ids(supabase, [s["student_id"] for s in students])
    if existing_ids:
        print(f"Found {len(existing_ids)} existing student IDs in the database. They will be skipped.")

    inserted = 0
    skipped_existing = 0
    failed = 0

    for student in students:
        if student["student_id"] in existing_ids:
            skipped_existing += 1
            continue

        password_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")
        payload = build_payload(student, password_hash)

        if dry_run:
            inserted += 1
            continue

        response = supabase.table("users").insert(payload).execute()
        error = get_result_error(response)
        if error:
            failed += 1
            print(f"Failed to insert {student['student_id']}: {error}")
            continue

        inserted += 1

    print("Migration complete.")
    print(f"Inserted: {inserted}")
    print(f"Skipped existing: {skipped_existing}")
    print(f"Failed: {failed}")
    if dry_run:
        print("Dry run enabled. No rows were inserted.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
