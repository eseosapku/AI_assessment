"""Database queries (UP, AL): a table of six to eight records (students, or a farm cooperative's harvests) under its
name, and an SQL query, SELECT ... FROM ... WHERE ... ORDER BY .... How many records the query returns, and the
first selected field of its first and of its last record.

Every key is the query run on the drawn records; the field it sorts on never ties among the records returned.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "database_query"
KIND = "table.data"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("database-queries", "sql-data-manipulation-language", "database-tables"))
AVOID = r"spreadsheet|network|internet|security|graphic|presentation|email|python|html|logic gate|boolean"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"database|sql|query|queries|record|field|table|dbms|select"
DISTRICTS = ["Musanze", "Huye", "Rubavu", "Nyagatare", "Kayonza", "Rusizi"]
CROPS = ["Maize", "Beans", "Potatoes", "Coffee"]
TABLES = {
    "STUDENTS": ["StudentID", "Name", "Class", "Age", "Mark"],
    "HARVEST": ["FarmID", "Farmer", "District", "Crop", "Yield"],
}


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


def sample(rng: random.Random) -> dict:
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
        p = {"band": rng.choice(BANDS), "table": name, "fields": fields, "records": records,
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


def draw(p: dict):
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


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    rows = run_query(p)
    first = p["query"]["select"][0]
    a, z = str(rows[0][first]), str(rows[-1][first])
    return [short(f"{who} runs this query on the {p['table']} table {rng.choice(SETTINGS)}. How many records does it return?",
                  len(rows), [str(len(rows)), f"{len(rows)} records"]),
            short(f"What is the {first} in the first record the query returns, in the order it sorts them?", a, [a]),
            short(f"{friend} reads the results. What is the {first} in the last record returned?", z, [z])]
