"""Mail merge (LS, UP, AL): a letter template, its merge fields in chevrons («FirstName», «Amount»), beside the merge
settings (a filter, a sort, both or neither) and above the data source, a table of four to six records. Four letters:
school fees owed at a Kigali school, a Musanze cooperative's potato deliveries, a coding challenge's scores and a Huye
health centre's vaccination bookings.

How many letters the merge produces (with the figure's filter, or one the stem states where the figure has none), what
replaces a field in letter N with the settings shown, which field of the data source holds a value, and, where the
settings sort, whose letter is produced first.

Every key is the merge run on the records: filter first, then sort. A sorted field never ties, a filter keeps at least
two records and drops at least one, and where the settings filter or sort, letter N says something other than row N.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, money, new_figure, short

ID = "mail_merge"
KIND = "business.document"
SUBJECT = "computing"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("mail-merge", "mail-merge-operations", "document-production"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"mail merge|merge"
AVOID = r"spreadsheet|database|network|security|graphic|presentation|python|html|programming"
SURNAMES = ["Mugabo", "Uwimana", "Niyonzima", "Mukamana", "Nkurunziza", "Hakizimana", "Ndayisaba", "Nsengiyumva", "Mutesi",
            "Bizimana", "Kayitesi", "Munyaneza", "Twagirayezu", "Uwera", "Gatete", "Rukundo"]
CONTEXTS = {
    "fees": {
        "source": "fees.xlsx", "fields": ["FirstName", "LastName", "Class", "Amount"], "category": "Class", "number": "Amount",
        "categories": ["S1", "S2", "S3", "S4", "S5", "S6"], "numbers": list(range(5000, 60001, 2500)),
        "letter": ["Remera Secondary School, Kigali", "", "Dear Parent of «FirstName» «LastName»,",
                   "«FirstName» is in class «Class». The school fees", "still to pay this term are «Amount» Frw.",
                   "Please pay before the end of the month.", "", "Yours faithfully,", "The Bursar"],
        "what": "letters to parents about school fees"},
    "coop": {
        "source": "deliveries.xlsx", "fields": ["FirstName", "LastName", "Village", "Kg"], "category": "Village", "number": "Kg",
        "categories": ["Kinigi", "Busogo", "Gataraga", "Nyange", "Cyuve"], "numbers": list(range(150, 901, 50)),
        "letter": ["Musanze Potato Growers' Cooperative", "", "Dear «FirstName» «LastName»,",
                   "Thank you for bringing «Kg» kg of potatoes to", "our store this season. Our truck will collect",
                   "your next harvest from «Village» on Monday.", "", "Yours sincerely,", "The Secretary"],
        "what": "letters to the cooperative's farmers"},
    "results": {
        "source": "scores.xlsx", "fields": ["FirstName", "LastName", "School", "Score"], "category": "School", "number": "Score",
        "categories": ["Huye Secondary", "Nyanza High", "Rubavu Academy", "Kayonza School", "Rusizi College"],
        "numbers": list(range(30, 99)),
        "letter": ["Rwanda Schools Coding Challenge", "", "Dear «FirstName» «LastName»,",
                   "Well done for taking part. Your team from", "«School» scored «Score» points out of 100.",
                   "Certificates will be sent to your school.", "", "Yours sincerely,", "The Organisers"],
        "what": "letters to the challenge's players"},
    "clinic": {
        "source": "bookings.xlsx", "fields": ["FirstName", "LastName", "Day", "Time"], "category": "Day", "number": "Time",
        "categories": ["Monday", "Tuesday", "Wednesday", "Thursday"],
        "numbers": [f"{h:02d}:{m:02d}" for h in range(8, 16) for m in (0, 15, 30, 45)],
        "letter": ["Huye Health Centre", "", "Dear «FirstName» «LastName»,", "Your child's vaccination is booked for",
                   "«Day» at «Time». Please bring the child's", "health card with you.", "", "Yours sincerely,",
                   "The Nurse in Charge"],
        "what": "reminder letters to parents"},
}
WIDTHS = {"FirstName": 1.45, "LastName": 1.6, "Class": 0.9, "Amount": 1.15, "Village": 1.3, "Kg": 0.8, "School": 1.75,
          "Score": 0.9, "Day": 1.4, "Time": 0.9}


def run_merge(records: list, flt, srt) -> list:
    """The letters, in order: the records the filter keeps, then sorted."""
    ops = {">": lambda a, b: a > b, "<": lambda a, b: a < b, "=": lambda a, b: a == b}
    rows = [r for r in records if flt is None or ops[flt[1]](r[flt[0]], flt[2])]
    if srt:
        rows = sorted(rows, key=lambda r: r[srt[0]], reverse=srt[1] == "descending")
    return rows


def _filter(c: dict, records: list, rng: random.Random) -> list | None:
    """A filter that keeps at least two records and drops at least one (a cut no record equals, for a number)."""
    n = len(records)
    if c["number"] != "Time" and rng.random() < 0.5:
        values = sorted(r[c["number"]] for r in records)
        step = 5000 if c["number"] == "Amount" else 100 if c["number"] == "Kg" else 10
        cuts = [x for x in range(step, values[-1], step) if x not in values]
        rng.shuffle(cuts)
        for cut in cuts:
            for op in rng.sample([">", "<"], 2):
                kept = sum(v > cut if op == ">" else v < cut for v in values)
                if 2 <= kept < n:
                    return [c["number"], op, cut]
        return None
    counts = {}
    for r in records:
        counts[r[c["category"]]] = counts.get(r[c["category"]], 0) + 1
    ok = [v for v, k in counts.items() if 2 <= k < n]
    return [c["category"], "=", rng.choice(sorted(ok))] if ok else None


def sample(rng: random.Random) -> dict:
    context = rng.choice(list(CONTEXTS))
    c = CONTEXTS[context]
    while True:
        n = rng.randint(4, 6)
        firsts, lasts = rng.sample(NAMES, n), rng.sample(SURNAMES, n)
        cats = rng.sample(c["categories"], rng.randint(2, 3))
        nums = rng.sample(c["numbers"], n)
        records = [{"FirstName": firsts[i], "LastName": lasts[i], c["category"]: rng.choice(cats), c["number"]: nums[i]}
                   for i in range(n)]
        records = [{f: r[f] for f in c["fields"]} for r in records]
        settings = rng.choice(["none", "filter", "sort", "both", "filter", "sort", "both"])
        flt = _filter(c, records, rng) if settings in ("filter", "both") else None
        if settings in ("filter", "both") and flt is None:
            continue
        srt = None
        if settings in ("sort", "both"):
            key = rng.choice([c["number"], c["number"], "LastName"])
            srt = [key, "ascending" if key == "LastName" else rng.choice(["ascending", "descending"])]
        letters = run_merge(records, flt, srt)
        # Letter N with the settings shown, where they change what row N would say.
        pairs = [(k, f) for k in range(1, len(letters) + 1) for f in c["fields"]
                 if not (flt or srt) or str(records[k - 1][f]) != str(letters[k - 1][f])]
        if not pairs:
            continue
        stem_filter = None
        if flt is None:
            stem_filter = _filter(c, records, rng)
            if stem_filter is None:
                continue
        # A value of one column only, for "which field holds it".
        col = rng.choice([c["category"], c["number"]])
        finds = [r[col] for r in records if all(str(r[col]) != str(o[f]) for o in records for f in c["fields"] if f != col)]
        if not finds:
            continue
        ask = rng.choice(pairs)
        return {"band": rng.choice(BANDS), "context": context, "fields": c["fields"], "records": records, "filter": flt,
                "sort": srt, "stem_filter": stem_filter, "letter": ask[0], "field": ask[1], "find": rng.choice(finds)}


def _shown(v) -> str:
    return str(v)


def settings_lines(p: dict) -> list[str]:
    f, s = p["filter"], p["sort"]
    return [f"Filter: {f[0]} {f[1]} {f[2]}" if f else "Filter: none (all records)",
            f"Sort: {s[0]} ({s[1]})" if s else "Sort: none (table order)"]


def draw(p: dict):
    c = CONTEXTS[p["context"]]
    fields, records = p["fields"], p["records"]
    fig, ax = new_figure(8.6, 6.4)
    lh = 0.31
    # The main document: the letter with its merge fields.
    letter = c["letter"]
    top = 6.1
    lw, lheight = 5.3, len(letter) * lh + 0.3
    ax.text(0, top + 0.08, "Main document (letter template)", ha="left", va="bottom", fontsize=10, fontweight="bold")
    ax.add_patch(Rectangle((0, top - lheight), lw, lheight, facecolor="white", edgecolor=INK, linewidth=1.2))
    for i, line in enumerate(letter):
        if line:
            ax.text(0.2, top - 0.3 - i * lh, line, ha="left", va="center", fontsize=10,
                    fontweight="bold" if i == 0 else "normal")
    # The merge settings.
    sx = lw + 0.35
    ax.text(sx, top + 0.08, "Merge settings", ha="left", va="bottom", fontsize=10, fontweight="bold")
    lines = settings_lines(p)
    ax.add_patch(Rectangle((sx, top - 1.05), 8.5 - sx, 1.05, facecolor="#f4f6f8", edgecolor=INK, linewidth=1.0))
    for i, line in enumerate(lines):
        ax.text(sx + 0.15, top - 0.3 - i * 0.42, line, ha="left", va="center", fontsize=9.5)
    ax.text(sx, top - 1.35, "Letters are produced in the\norder the settings give:\nletter 1 first.", ha="left", va="top",
            fontsize=9, color="#333333")
    # The data source.
    rh = 0.36
    ty = top - lheight - 0.55
    ax.text(0, ty + 0.08, f"Data source: {c['source']}", ha="left", va="bottom", fontsize=10, fontweight="bold")
    x = 0.0
    for f in fields:
        w = WIDTHS[f]
        ax.add_patch(Rectangle((x, ty - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.1, ty - rh / 2, f, ha="left", va="center", fontsize=9.5, fontweight="bold")
        for r, rec in enumerate(records):
            y = ty - (r + 2) * rh
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            v = rec[f]
            if isinstance(v, int):
                ax.text(x + w - 0.1, y + rh / 2, _shown(v), ha="right", va="center", fontsize=9.5)
            else:
                ax.text(x + 0.1, y + rh / 2, _shown(v), ha="left", va="center", fontsize=9.5)
        x += w
    bottom = ty - (len(records) + 1) * rh
    ax.set_xlim(-0.1, 8.6)
    ax.set_ylim(bottom - 0.1, top + 0.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club"]
VERBS = ["merges", "runs the mail merge for", "prints", "produces"]
ORDINAL = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth"}


def _forms(field: str, v) -> list[str]:
    if field == "Amount":
        return money(v)
    if field == "Kg":
        return [str(v), f"{v} kg", f"{v}kg"]
    if field == "Score":
        return [str(v), f"{v} points"]
    return [str(v), str(v).lower()]


def questions(p: dict, rng: random.Random) -> list:
    c = CONTEXTS[p["context"]]
    taken = {r["FirstName"] for r in p["records"]}
    who, friend = rng.sample([n for n in NAMES if n not in taken], 2)
    records, flt, srt = p["records"], p["filter"], p["sort"]
    letters = run_merge(records, flt, srt)
    first = f"{who} {rng.choice(VERBS)} the {c['what']} {rng.choice(SETTINGS)}"
    if flt:
        qs = [short(f"{first}, with the filter shown. How many letters does the merge produce?", len(letters),
                    [f"{len(letters)} letters"])]
    else:
        f, op, v = p["stem_filter"]
        n = len(run_merge(records, p["stem_filter"], None))
        qs = [short(f"{first}, but only the records where {f} {op} {v} are merged. How many letters does the merge produce?",
                    n, [f"{n} letters"] + (["1 letter"] if n == 1 else []))]
    k, f = p["letter"], p["field"]
    v = letters[k - 1][f]
    qs.append(short(f"In letter {k} of the merge, the {ORDINAL[k]} one produced with the settings shown, what replaces «{f}»?",
                    v, _forms(f, v)))
    find = p["find"]
    col = next(fl for fl in p["fields"] if any(str(r[fl]) == str(find) for r in records))
    qs.append(short(f"{friend} checks the data source. Which field of the data source holds the value {find}?", col,
                    [col, f"«{col}»", col.lower(), f"the {col} field"]))
    if srt:
        def name(r):
            return f"{r['FirstName']} {r['LastName']}"
        wrong = [name(letters[-1]),  # the sort read the other way
                 name(run_merge(records, flt, None)[0]),  # the sort forgotten
                 name(run_merge(records, None, srt)[0]),  # the filter forgotten
                 *(name(r) for r in records)]
        qs.append(mcq("Whose name is in the first letter produced?", name(letters[0]), wrong, rng))
    return qs
