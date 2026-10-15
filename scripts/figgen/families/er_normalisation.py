"""Database design (AL, UP): what the 9618 and 9626 database chapters draw. Two sub-types.

"er": an entity-relationship diagram of two or three entities joined by one-to-many relationships in crow's-foot
notation (the foot at the many end), with each table written out beneath, its primary key underlined: a Kigali
school, a Musanze cooperative, a Kigali shop or a Huye health centre. Which statement describes the relationship
between two entities (the reversed one, one-to-one and many-to-many are the slips), and which attribute is the
foreign key.

"fd": one table with sample rows, the primary key the dependencies imply underlined, and its functional dependencies
listed. The table is unnormalised (a repeating group: several values in one cell, a record to a row), in 1NF (every
value repeated, a partial dependency on part of a composite key), in 2NF (a non-key dependency) or in 3NF. The highest
normal form it is in, and how many tables the data needs in 3NF (not asked when it is one: the table is normalised).

Every key is worked out from what is drawn: the many side of a relationship is the table holding the other's primary
key; the 3NF tables are one per determinant, plus a table of the composite key when no determinant covers it.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "er_normalisation"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("database-normalization", "database-design", "entity-identification",
                                            "relationships-database", "data-management"))
# A topic whose sections the book lists is reached only if one names normalisation, entities, relationships or design.
NEEDS = r"normali|entit|relationship|relational|database design|design steps|\bkeys?\b"
# Topics listed without sections that share a data concept but teach no database design.
AVOID = (r"spreadsheet|network|internet|security|graphic|\bpresentation|e-?mail|html|logic gate|boolean|python|java|"
         r"c\+\+|programming|web|single-table|structure|project management|life cycle|mail merge|expert system|"
         r"modelling|data processing|data, information|data model")
LIGHT = "#d9dee3"

# The ER diagrams each setting draws: (entity, attributes, primary key), left to right; every foreign key in a diagram
# refers to an entity drawn in it.
DIAGRAMS = {
    "school": ("a Kigali secondary school", [
        [("CLASS", ["ClassID", "Room", "Teacher"], ["ClassID"]), ("STUDENT", ["StudentID", "StudentName", "ClassID"], ["StudentID"])],
        [("STUDENT", ["StudentID", "StudentName", "DateOfBirth"], ["StudentID"]),
         ("PAYMENT", ["PaymentID", "PaymentDate", "Amount", "StudentID"], ["PaymentID"])],
        [("CLASS", ["ClassID", "Teacher"], ["ClassID"]), ("STUDENT", ["StudentID", "StudentName", "ClassID"], ["StudentID"]),
         ("PAYMENT", ["PaymentID", "Amount", "StudentID"], ["PaymentID"])],
        [("STUDENT", ["StudentID", "StudentName"], ["StudentID"]), ("RESULT", ["StudentID", "SubjectID", "Mark"], ["StudentID", "SubjectID"]),
         ("SUBJECT", ["SubjectID", "SubjectName"], ["SubjectID"])]]),
    "coop": ("a Musanze potato cooperative", [
        [("SECTOR", ["SectorID", "SectorName"], ["SectorID"]), ("MEMBER", ["MemberID", "MemberName", "SectorID"], ["MemberID"])],
        [("MEMBER", ["MemberID", "MemberName", "Phone"], ["MemberID"]),
         ("DELIVERY", ["DeliveryID", "DeliveryDate", "MassKg", "MemberID"], ["DeliveryID"])],
        [("SECTOR", ["SectorID", "SectorName"], ["SectorID"]), ("MEMBER", ["MemberID", "MemberName", "SectorID"], ["MemberID"]),
         ("DELIVERY", ["DeliveryID", "DeliveryDate", "MemberID"], ["DeliveryID"])],
        [("DELIVERY", ["DeliveryID", "DeliveryDate"], ["DeliveryID"]), ("LINE", ["DeliveryID", "CropID", "MassKg"], ["DeliveryID", "CropID"]),
         ("CROP", ["CropID", "CropName"], ["CropID"])]]),
    "shop": ("a Kigali shop", [
        [("CUSTOMER", ["CustomerID", "CustomerName", "Phone"], ["CustomerID"]), ("SALE", ["SaleID", "SaleDate", "CustomerID"], ["SaleID"])],
        [("SUPPLIER", ["SupplierID", "SupplierName"], ["SupplierID"]),
         ("PRODUCT", ["ProductID", "ProductName", "Price", "SupplierID"], ["ProductID"])],
        [("CUSTOMER", ["CustomerID", "CustomerName"], ["CustomerID"]), ("SALE", ["SaleID", "SaleDate", "CustomerID"], ["SaleID"]),
         ("PAYMENT", ["PaymentID", "Amount", "SaleID"], ["PaymentID"])],
        [("SALE", ["SaleID", "SaleDate"], ["SaleID"]), ("SALELINE", ["SaleID", "ProductID", "Quantity"], ["SaleID", "ProductID"]),
         ("PRODUCT", ["ProductID", "ProductName"], ["ProductID"])]]),
    "clinic": ("a Huye health centre", [
        [("PATIENT", ["PatientID", "PatientName", "Village"], ["PatientID"]), ("VISIT", ["VisitID", "VisitDate", "PatientID"], ["VisitID"])],
        [("DOCTOR", ["DoctorID", "DoctorName"], ["DoctorID"]), ("VISIT", ["VisitID", "VisitDate", "PatientID", "DoctorID"], ["VisitID"]),
         ("PATIENT", ["PatientID", "PatientName"], ["PatientID"])],
        [("VISIT", ["VisitID", "VisitDate"], ["VisitID"]), ("PRESCRIPTION", ["VisitID", "MedicineID", "Doses"], ["VisitID", "MedicineID"]),
         ("MEDICINE", ["MedicineID", "MedicineName"], ["MedicineID"])],
        [("WARD", ["WardID", "WardName"], ["WardID"]), ("NURSE", ["NurseID", "NurseName", "WardID"], ["NurseID"])]]),
}

# The data normalisation starts from: a record (key K1, its attributes A1 and a foreign key FK, which decides FA) with a
# repeating group of lines (key K3, deciding A3) and what each line holds (L, decided by K1 and K3 together).
FLAT = {
    "school": {"setting": "a Kigali secondary school", "doc": "RESULTS", "main": "STUDENT", "line": "RESULT",
               "K1": "StudentID", "A1": "StudentName", "FK": "ClassID", "FA": "Teacher", "K3": "SubjectID", "A3": "SubjectName",
               "L": "Mark"},
    "coop": {"setting": "a Musanze potato cooperative", "doc": "DELIVERIES", "main": "DELIVERY", "line": "LINE",
             "K1": "DeliveryID", "A1": "DeliveryDate", "FK": "MemberID", "FA": "MemberName", "K3": "CropID", "A3": "CropName",
             "L": "MassKg"},
    "shop": {"setting": "a Kigali shop", "doc": "SALES", "main": "SALE", "line": "SALELINE",
             "K1": "SaleID", "A1": "SaleDate", "FK": "CustomerID", "FA": "CustomerName", "K3": "ProductID", "A3": "ProductName",
             "L": "Quantity"},
    "clinic": {"setting": "a Huye health centre", "doc": "VISITS", "main": "VISIT", "line": "PRESCRIPTION",
               "K1": "VisitID", "A1": "VisitDate", "FK": "PatientID", "FA": "PatientName", "K3": "MedicineID", "A3": "MedicineName",
               "L": "Doses"},
    "clubs": {"setting": "a Kigali school's clubs", "doc": "CLUBS", "main": "STUDENT", "line": "MEMBERSHIP",
              "K1": "StudentID", "A1": "StudentName", "FK": "ClassID", "FA": "Teacher", "K3": "ClubID", "A3": "ClubName", "L": None},
}
DATES = ["3 Mar", "5 Mar", "8 Mar", "11 Mar", "14 Mar", "18 Mar", "21 Mar", "25 Mar"]
TEACHERS = ["Mr Habimana", "Ms Uwase", "Mr Kalisa", "Ms Mutoni", "Mr Gasana", "Ms Ingabire"]
LINES = {"school": [("MAT", "Maths"), ("PHY", "Physics"), ("CSC", "Computing"), ("ENG", "English"), ("BIO", "Biology")],
         "coop": [("C1", "Potatoes"), ("C2", "Beans"), ("C3", "Maize"), ("C4", "Wheat"), ("C5", "Peas")],
         "shop": [("P1", "Sugar"), ("P2", "Rice"), ("P3", "Soap"), ("P4", "Milk"), ("P5", "Tea")],
         "clinic": [("M1", "ORS"), ("M2", "Zinc"), ("M3", "Iron"), ("M4", "Quinine"), ("M5", "Aspirin")],
         "clubs": [("CL1", "Chess"), ("CL2", "Debate"), ("CL3", "Coding"), ("CL4", "Football"), ("CL5", "Drama")]}


def relationships(entities: list) -> list[tuple[str, str]]:
    """(one, many) for each relationship: the many side holds the one side's primary key."""
    return [(a[0], b[0]) for a in entities for b in entities
            if a is not b and len(a[2]) == 1 and a[2][0] in b[1] and b[2] != a[2]]


def _values(s: str, rng: random.Random) -> dict:
    """Value makers for one setting's records, consistent with its dependencies."""
    first = {"school": "S", "coop": "D", "shop": "T", "clinic": "V", "clubs": "S"}[s]
    fk = {"school": ["S4A", "S4B", "S5A", "S5B"], "clubs": ["S4A", "S4B", "S5A", "S5B"], "coop": ["M04", "M07", "M12", "M15"],
          "shop": ["C03", "C08", "C11", "C14"], "clinic": ["P21", "P34", "P40", "P52"]}[s]
    fa = (TEACHERS if s in ("school", "clubs") else NAMES)
    fa = dict(zip(fk, rng.sample(fa, len(fk))))
    return {"k1": [f"{first}{v}" for v in sorted(rng.sample(range(101, 199), 6))], "fk": fk, "fa": fa,
            "a1": (rng.sample(NAMES, 6) if s in ("school", "clubs") else sorted(rng.sample(DATES, 6), key=DATES.index)),
            "lines": LINES[s],
            "l": {"school": (35, 98), "coop": (20, 240), "shop": (1, 12), "clinic": (2, 21), "clubs": None}[s]}


def _flat(s: str, nf: str, rng: random.Random) -> dict:
    f = FLAT[s]
    K1, A1, FK, FA, K3, A3, L = (f[x] for x in ("K1", "A1", "FK", "FA", "K3", "A3", "L"))
    v = _values(s, rng)
    show_fa, show_a3 = rng.random() < 0.6, rng.random() < 0.6
    if nf == "1NF" and rng.random() < 0.35:  # 1NF as the lines table alone, the line's name kept with it
        nf = "1NF-line"
    records = []  # (k1, a1, fk, [(k3, a3, l)])
    for i in range(rng.randint(2, 3)):
        lines = rng.sample(v["lines"], rng.randint(1, 3))
        records.append((v["k1"][i], v["a1"][i], rng.choice(v["fk"]),
                        [(k, a, rng.randint(*v["l"]) if L else None) for k, a in lines]))
    if sum(len(r[3]) for r in records) == len(records):  # a group must repeat somewhere
        k, a = next(x for x in v["lines"] if x[0] not in {ln[0] for ln in records[0][3]})
        records[0][3].append((k, a, rng.randint(*v["l"]) if L else None))
    if nf in ("UNF", "1NF"):
        group = [K3] + ([A3] if show_a3 else []) + ([L] if L else [])
        attrs = [K1, A1, FK] + ([FA] if show_fa else []) + group
        fds = [[[K1], [A1, FK]]] + ([[[FK], [FA]]] if show_fa else []) + ([[[K3], [A3]]] if show_a3 else []) + \
              ([[[K1, K3], [L]]] if L else [])
        rows = []
        for k1, a1, fk, lines in records:
            head = [k1, a1, fk] + ([v["fa"][fk]] if show_fa else [])
            cells = [[k3] + ([a3] if show_a3 else []) + ([str(lv)] if L else []) for k3, a3, lv in lines]
            if nf == "UNF":  # a record to a row, its group's values side by side in one cell (blind review)
                rows.append(head + [", ".join(c[i] for c in cells) for i in range(len(group))])
            else:  # 1NF: every value repeated on every line
                rows += [head + c for c in cells]
        # The key the dependencies imply, unnormalised or not: the record's key and the group's together (blind review).
        return {"table": f["doc"], "attrs": attrs, "key": [K1, K3], "group": group if nf == "UNF" else [], "fds": fds,
                "rows": rows}
    if nf == "1NF-line":
        attrs = [K1, K3, A3] + ([L] if L else [])
        fds = [[[K3], [A3]]] + ([[[K1, K3], [L]]] if L else [])
        rows = [[k1, k3, a3] + ([str(lv)] if L else []) for k1, _, _, lines in records for k3, a3, lv in lines]
        return {"table": f["line"], "attrs": attrs, "key": [K1, K3], "group": [], "fds": fds, "rows": rows}
    n = rng.randint(4, 5)
    fks = rng.sample(v["fk"], 3)
    owners = [fks[0], fks[0]] + [rng.choice(fks) for _ in range(n - 2)]  # two records share one, so the repeat shows
    rng.shuffle(owners)
    if nf == "2NF":
        rows = [[v["k1"][i], v["a1"][i], owners[i], v["fa"][owners[i]]] for i in range(n)]
        return {"table": f["main"], "attrs": [K1, A1, FK, FA], "key": [K1], "group": [],
                "fds": [[[K1], [A1, FK]], [[FK], [FA]]], "rows": rows}
    if L and rng.random() < 0.4:  # 3NF: the lines table on its own
        rows = [[k1, k3, str(lv)] for k1, _, _, lines in records for k3, _, lv in lines]
        return {"table": f["line"], "attrs": [K1, K3, L], "key": [K1, K3], "group": [], "fds": [[[K1, K3], [L]]], "rows": rows}
    rows = [[v["k1"][i], v["a1"][i], owners[i]] for i in range(n)]
    return {"table": f["main"], "attrs": [K1, A1, FK], "key": [K1], "group": [], "fds": [[[K1], [A1, FK]]], "rows": rows}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.45:
        s = rng.choice(sorted(DIAGRAMS))
        diagram = rng.choice(DIAGRAMS[s][1])
        entities = [{"name": n, "attrs": list(a), "key": list(k)} for n, a, k in diagram]
        rels = relationships(diagram)
        ask = rng.choice(rels)
        pair = list(ask) if rng.random() < 0.5 else [ask[1], ask[0]]
        rest = [r for r in rels if r != ask]
        fk = list(rest[0]) if rest else list(ask)
        return {"band": band, "view": "er", "scenario": s, "entities": entities,
                "links": [{"one": a, "many": b} for a, b in rels], "pair": pair, "fk": fk}
    s = rng.choice(sorted(FLAT))
    nf = rng.choice(["UNF", "UNF", "1NF", "2NF", "3NF"])
    return {"band": band, "view": "fd", "scenario": s, **_flat(s, nf, rng)}


def _piece(ax, x, y, text, size=10.5, bold=False, gid=None, family=None):
    """Prints text at (x, y) and returns its box in data units, so the next piece can follow it."""
    style = {"family": family} if family else {}
    t = ax.text(x, y, text, ha="left", va="center", fontsize=size, fontweight="bold" if bold else "normal", gid=gid, **style)
    return t.get_window_extent(ax.figure.canvas.get_renderer()).transformed(ax.transData.inverted())


def _underline(ax, box, gid):
    ax.plot([box.x0, box.x1], [box.y0 - 0.02] * 2, color=INK, linewidth=1.1, gid=gid)


def _relation(ax, x, y, name, attrs, key):
    """NAME(Attr1, Attr2, ...) as papers write a table, its primary key underlined."""
    box = _piece(ax, x, y, name, bold=True)
    box = _piece(ax, box.x1, y, "(")
    for i, a in enumerate(attrs):
        b = _piece(ax, box.x1 + (0.12 if i else 0.0), y, a, gid=f"attr:{name}:{a}")
        if a in key:
            _underline(ax, b, f"key:{name}:{a}")
        box = _piece(ax, b.x1, y, "," if i < len(attrs) - 1 else ")")


def _frame(w: float, h: float, k: float):
    fig, ax = new_figure(w * k, h * k)
    fig.set_dpi(150)  # measured at the dpi it is saved at, so pieces of text set side by side meet as printed
    ax.set_position([0, 0, 1, 1])
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.apply_aspect()
    return fig, ax


def _er(p: dict):
    ents = p["entities"]
    n = len(ents)
    bw, bh, gap = 2.6, 0.8, 2.0
    W = max(10.0, n * bw + (n - 1) * gap + 1.2)
    H = 3.6 + 0.62 * n
    fig, ax = _frame(W, H, 0.72)
    ax.text(W / 2, H - 0.45, f"Entity-relationship diagram for {DIAGRAMS[p['scenario']][0]}", ha="center", va="center",
            fontsize=12, fontweight="bold")
    y = H - 1.65
    x0 = W / 2 - (n * bw + (n - 1) * gap) / 2
    lefts = [x0 + i * (bw + gap) for i in range(n)]
    for e, x in zip(ents, lefts):
        ax.add_patch(Rectangle((x, y - bh / 2), bw, bh, facecolor=LIGHT, edgecolor=INK, linewidth=1.3))
        ax.text(x + bw / 2, y, e["name"], ha="center", va="center", fontsize=11, fontweight="bold", gid=f"entity:{e['name']}")
    many = {(lk["one"], lk["many"]) for lk in p["links"]}
    for i in range(n - 1):
        a, b = ents[i]["name"], ents[i + 1]["name"]
        xa, xb = lefts[i] + bw, lefts[i + 1]
        ax.plot([xa, xb], [y, y], color=INK, linewidth=1.4)
        if (a, b) in many:  # the foot at b, the many end
            foot, root, gid = xb, xb - 0.42, f"crow:{a}>{b}"
        else:
            foot, root, gid = xa, xa + 0.42, f"crow:{b}>{a}"
        for dy in (-0.26, 0.0, 0.26):
            ax.plot([root, foot], [y, y + dy], color=INK, linewidth=1.4, gid=gid)
    for i, e in enumerate(ents):
        _relation(ax, 0.8, H - 3.0 - 0.62 * i, e["name"], e["attrs"], e["key"])
    ax.text(0.8, 0.35, "Primary key attributes are underlined.", ha="left", va="center", fontsize=9.5, fontstyle="italic")
    return fig


K_FD = 0.64  # inches per unit in a table figure


def _units(text: str, size: float, bold: bool = False) -> float:
    """How wide a piece of text is printed, in the table figure's units."""
    from matplotlib.font_manager import FontProperties
    from matplotlib.textpath import TextPath
    path = TextPath((0, 0), text, size=size, prop=FontProperties(family="DejaVu Sans", weight="bold" if bold else "normal"))
    return path.get_extents().width / 72 / K_FD


def _width(head: str, values: list[str]) -> float:
    """A column wide enough for its bold heading and its values, with a margin each side."""
    return max(_units(head, 9.5, True), *(_units(v, 9.5) for v in values if v)) + 0.42


def _fd(p: dict):
    attrs, rows = p["attrs"], p["rows"]
    widths = [_width(a, [r[j] for r in rows]) for j, a in enumerate(attrs)]
    width = sum(widths)
    rh, hh = 0.5, 0.55
    nf_lines = len(p["fds"])
    table_top = hh + rh * len(rows)
    below = 1.5 + 0.45 * nf_lines
    W = max(width + 0.6, 9.0)
    H = table_top + below + 1.7
    fig, ax = _frame(W, H, K_FD)
    x0 = (W - width) / 2
    top = H - 1.35
    ax.text(W / 2, H - 0.45, f"Table {p['table']}: records kept by {FLAT[p['scenario']]['setting']}", ha="center",
            va="center", fontsize=11.5, fontweight="bold")
    x = x0
    for j, (a, w) in enumerate(zip(attrs, widths)):
        ax.add_patch(Rectangle((x, top - hh), w, hh, facecolor=LIGHT, edgecolor=INK, linewidth=1.0))
        box = _piece(ax, x + 0.12, top - hh / 2, a, size=9.5, bold=True, gid=f"head:{a}")
        if a in p["key"]:
            _underline(ax, box, f"key:{p['table']}:{a}")
        for i, r in enumerate(rows):
            yy = top - hh - rh * (i + 1)
            ax.add_patch(Rectangle((x, yy), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            if r[j]:
                ax.text(x + 0.12, yy + rh / 2, r[j], ha="left", va="center", fontsize=9.5, gid=f"cell:{i}:{j}")
        x += w
    y = top - table_top - 0.45
    left = min(x0, 0.4)
    ax.text(left, y, "Primary key attributes are underlined.", ha="left", va="center", fontsize=9.5, fontstyle="italic")
    ax.text(left, y - 0.5, "Functional dependencies:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    for i, (lhs, rhs) in enumerate(p["fds"]):
        ax.text(left + 0.4, y - 1.0 - 0.45 * i, f"{', '.join(lhs)} → {', '.join(rhs)}", ha="left", va="center", fontsize=10,
                family="monospace", gid=f"fd:{i}")
    return fig


def draw(p: dict):
    return _er(p) if p["view"] == "er" else _fd(p)


def normal_form(p: dict) -> str:
    if p["group"]:
        return "UNF"
    key, nonkey = set(p["key"]), set(p["attrs"]) - set(p["key"])
    if any(set(lhs) < key and set(rhs) & nonkey for lhs, rhs in p["fds"]):
        return "1NF"
    if any(set(lhs) <= nonkey for lhs, _ in p["fds"]):
        return "2NF"
    return "3NF"


def tables_3nf(p: dict) -> int:
    """One table per determinant, and one of the composite key when no determinant holds all of it."""
    lhs = {tuple(sorted(l)) for l, _ in p["fds"]}
    whole = tuple(sorted(p["key"]))
    return len(lhs) + (1 if len(whole) > 1 and whole not in lhs else 0)


NF = {"UNF": "UNF (unnormalised)", "1NF": "1NF", "2NF": "2NF", "3NF": "3NF"}
VERBS = ["is designing", "checks", "reviews", "draws up", "sketches", "studies"]
SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "for the school's database club",
            "for a class test", "during revision", "in an ICT lesson"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    verb, setting = rng.choice(VERBS), rng.choice(SETTINGS)
    if p["view"] == "fd":
        nf, count = normal_form(p), tables_3nf(p)
        qs = [mcq(f"{who} {verb} the {p['table']} table {setting}. Its primary key is underlined and its functional "
                  f"dependencies are listed. What is the highest normal form this table is in?", NF[nf], list(NF.values()), rng)]
        if count > 1:  # one table would be no question: the table is already normalised (blind review)
            qs.append(short("How many tables are there once the data is normalised to third normal form (3NF) using these "
                            "dependencies?", count, [f"{count} tables"]))
        return qs
    x, y = p["pair"]
    one, many = next((lk["one"], lk["many"]) for lk in p["links"] if {lk["one"], lk["many"]} == {x, y})
    key = f"One {one} record is linked to many {many} records"
    options = [f"One {many} record is linked to many {one} records", f"One {x} record is linked to one {y} record",
               f"Many {x} records are linked to many {y} records"]
    ents = {e["name"]: e for e in p["entities"]}
    parent, child = p["fk"]
    fk = ents[parent]["key"][0]
    rel = mcq(f"{who} {verb} this entity-relationship diagram {setting}. Which statement describes the relationship between "
              f"{x} and {y}?", key, options, rng)
    if len(p["links"]) == 1:
        return [rel, short("Which attribute is the foreign key that links the two tables?", fk, [fk.lower(), f"{child}.{fk}"])]
    return [rel, short(f"Which attribute in {child} is the foreign key that links it to {parent}?", fk,
                       [fk.lower(), f"{child}.{fk}"])]
