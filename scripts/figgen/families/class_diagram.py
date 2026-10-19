"""UML class diagrams (UP, AL): a parent class with two subclasses (and, at AS & A Level, a subclass of a subclass), each
a box of three compartments -- the class name, its attributes with visibility and type ("- name : String"), its
methods ("+ getName()") -- inheritance drawn as hollow-headed arrows pointing to the parent, and one association
between the parent and another class, with a multiplicity at each end and a verb. A key prints what "-", "+", the
arrow and the four multiplicities (1, 0..1, 0..*, 1..*) mean. Six systems: a school, a Kigali shop, a Musanze bus
company, a Huye library, a Nyagatare farm and a Rubavu savings bank.

Asks which class a named class inherits from (at AL, the subclass of a subclass, its grandparent a distractor), how
many private attributes a class lists, how many methods an object of a subclass can call (its own and those it
inherits; every method is public) or which listed method it cannot call (a sibling's, a child's or the other class's),
and how many objects one class's object can be linked to, by the multiplicity at the other end.

Every key is counted from the classes in the params; method names are unique within a diagram, so nothing is
overridden.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure

ID = "class_diagram"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("inheritance-programming", "object-oriented-code-writing", "programming-paradigms",
                                            "cpp-classes-objects", "data-encapsulation-abstraction", "object-composition"))
# A topic whose sections the book lists is reached only if its name or a section names classes, objects, inheritance or
# the object-oriented paradigm.
NEEDS = r"class|object|inherit|\boop\b|paradigm|encapsulat|polymorph"
AVOID = (r"database|network|security|spreadsheet|html|\bweb\b|prolog|declarative|low-level|assembly|recursion|"
         r"file processing|collection|pointer|introduction to java|io and java|enterprise|tomcat|classification|"
         r"object insertion|objects in spreadsheets|advanced objects|smartart|presentation|operating system")

MULT = {"1": "exactly one", "0..1": "zero or one", "0..*": "zero or more", "1..*": "one or more"}
# Each system: the parent class, two subclasses, a subclass of the first subclass (AL), and the associated class with
# the verb and the multiplicities each end may fairly carry. Attributes are (name, type); methods are all public.
SCENES = {
    "school": {
        "where": "a school's records system in Kigali",
        "parent": ("Person", [("name", "String"), ("age", "Integer"), ("phone", "String"), ("address", "String")],
                   ["getName()", "setPhone()", "getAge()"]),
        "subs": [("Student", [("studentID", "String"), ("grade", "Integer"), ("house", "String")],
                  ["getGrade()", "payFees()", "joinClub()"]),
                 ("Teacher", [("staffID", "String"), ("subject", "String"), ("salary", "Integer")],
                  ["getSubject()", "markWork()", "setSalary()"])],
        "third": ("Prefect", [("duty", "String"), ("termStart", "Date")], ["leadAssembly()", "reportIssue()"]),
        "other": ("School", [("schoolName", "String"), ("district", "String")], ["addPerson()"]),
        "verb": "has", "mult_other": ["1"], "mult_parent": ["1..*", "0..*"]},
    "shop": {
        "where": "a Kigali shop's stock system",
        "parent": ("Product", [("code", "String"), ("label", "String"), ("price", "Integer"), ("stock", "Integer")],
                   ["getPrice()", "setPrice()", "restock()"]),
        "subs": [("Food", [("expiryDate", "Date"), ("weight", "Integer"), ("organic", "Boolean")],
                  ["isExpired()", "getWeight()", "printLabel()"]),
                 ("Drink", [("volume", "Integer"), ("fizzy", "Boolean"), ("flavour", "String")],
                  ["getVolume()", "chill()", "pour()"])],
        "third": ("Fruit", [("origin", "String"), ("ripeness", "Integer")], ["isRipe()", "peel()"]),
        "other": ("Supplier", [("supplierName", "String"), ("phone", "String")], ["sendOrder()"]),
        "verb": "supplies", "mult_other": ["1", "1..*"], "mult_parent": ["1..*", "0..*"]},
    "transport": {
        "where": "a Musanze bus company's system",
        "parent": ("Vehicle", [("plate", "String"), ("seats", "Integer"), ("speed", "Integer"), ("colour", "String")],
                   ["move()", "getPlate()", "stop()"]),
        "subs": [("Bus", [("route", "String"), ("standing", "Integer"), ("company", "String")],
                  ["getRoute()", "openDoors()", "announce()"]),
                 ("Motorbike", [("helmets", "Integer"), ("engineCC", "Integer"), ("rider", "String")],
                  ["addPassenger()", "getHelmets()", "park()"])],
        "third": ("SchoolBus", [("school", "String"), ("seatBelts", "Integer")], ["collectPupils()", "countPupils()"]),
        "other": ("Driver", [("licenceNo", "String"), ("driverName", "String")], ["drive()"]),
        "verb": "drives", "mult_other": ["0..1", "1"], "mult_parent": ["0..1", "1"]},
    "library": {
        "where": "a Huye library's system",
        "parent": ("Item", [("title", "String"), ("year", "Integer"), ("available", "Boolean"), ("shelf", "String")],
                   ["borrow()", "giveBack()", "isAvailable()"]),
        "subs": [("Book", [("author", "String"), ("pages", "Integer"), ("isbn", "String")],
                  ["getAuthor()", "getPages()", "reserve()"]),
                 ("Magazine", [("issue", "Integer"), ("month", "String"), ("publisher", "String")],
                  ["getIssue()", "getMonth()", "archive()"])],
        "third": ("Textbook", [("subject", "String"), ("level", "String")], ["getLevel()", "addNotes()"]),
        "other": ("Member", [("memberID", "String"), ("memberName", "String")], ["join()"]),
        "verb": "borrows", "mult_other": ["0..1"], "mult_parent": ["0..*", "1..*"]},
    "farm": {
        "where": "a Nyagatare farm's records",
        "parent": ("Animal", [("tagNumber", "String"), ("weight", "Integer"), ("age", "Integer"), ("breed", "String")],
                   ["feed()", "getWeight()", "vaccinate()"]),
        "subs": [("Cow", [("milkPerDay", "Integer"), ("calves", "Integer"), ("hornLength", "Integer")],
                  ["milk()", "getCalves()", "graze()"]),
                 ("Goat", [("kids", "Integer"), ("hairType", "String"), ("pen", "String")],
                  ["getKids()", "browse()", "trimHooves()"])],
        "third": ("DairyCow", [("lactation", "Integer"), ("milkingTime", "String")], ["recordMilk()", "dryOff()"]),
        "other": ("Farmer", [("farmerName", "String"), ("village", "String")], ["buyAnimal()"]),
        "verb": "owns", "mult_other": ["1"], "mult_parent": ["0..*", "1..*"]},
    "bank": {
        "where": "a Rubavu savings bank's system",
        "parent": ("Account", [("accountNo", "String"), ("balance", "Integer"), ("owner", "String"), ("opened", "Date")],
                   ["deposit()", "withdraw()", "getBalance()"]),
        "subs": [("Savings", [("interestRate", "Integer"), ("target", "Integer"), ("lockedUntil", "Date")],
                  ["addInterest()", "getRate()", "setTarget()"]),
                 ("Current", [("overdraft", "Integer"), ("chequeBook", "Boolean"), ("fee", "Integer")],
                  ["payCheque()", "getOverdraft()", "chargeFee()"])],
        "third": ("StudentSaver", [("school", "String"), ("guardian", "String")], ["addPocketMoney()", "getSchool()"]),
        "other": ("Customer", [("customerID", "String"), ("customerName", "String")], ["openAccount()"]),
        "verb": "holds", "mult_other": ["1", "1..*"], "mult_parent": ["1..*", "0..*"]},
}


def _cls(rng: random.Random, spec, parent, n_attrs: tuple[int, int], n_methods: tuple[int, int]) -> dict:
    name, attrs, methods = spec
    a = rng.sample(attrs, rng.randint(*n_attrs))
    a.sort(key=attrs.index)
    m = methods[:rng.randint(*n_methods)]
    vis = ["-" if rng.random() < 0.7 else "+" for _ in a]
    return {"name": name, "parent": parent, "attrs": [[v, n, t] for v, (n, t) in zip(vis, a)], "methods": m}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    key = rng.choice(sorted(SCENES))
    sc = SCENES[key]
    while True:
        top = _cls(rng, sc["parent"], None, (3, 4), (2, 3))
        subs = [_cls(rng, s, top["name"], (1, 3), (1, 3)) for s in sc["subs"]]
        classes = [top] + subs
        if band == "AL":
            classes.append(_cls(rng, sc["third"], subs[0]["name"], (1, 2), (1, 2)))
        other = _cls(rng, sc["other"], None, (2, 2), (1, 1))
        classes.append(other)
        # the private counts differ from class to class, so the count read is the asked class's own
        if len({sum(a[0] == "-" for a in c["attrs"]) for c in classes}) < 2:
            continue
        break
    named = [c["name"] for c in classes]
    young = classes[3]["name"] if band == "AL" else rng.choice([s["name"] for s in subs])
    ask = {"inherit": young if band == "AL" and rng.random() < 0.75 else rng.choice([s["name"] for s in subs]),
           "private": rng.choice(named),
           "callable": young,
           "callable_form": rng.choice(["count", "not"]),
           "mult_of": rng.choice(["parent", "other"])}
    return {"band": band, "scene": key, "classes": classes,
            "assoc": {"other": other["name"], "parent": top["name"], "verb": sc["verb"],
                      "mult_other": rng.choice(sc["mult_other"]), "mult_parent": rng.choice(sc["mult_parent"])},
            "ask": ask}


# --- the diagram's facts ----------------------------------------------------------------------------------

def by_name(p: dict) -> dict:
    return {c["name"]: c for c in p["classes"]}


def ancestors(p: dict, name: str) -> list[str]:
    out, cls = [], by_name(p)
    while cls[name]["parent"]:
        name = cls[name]["parent"]
        out.append(name)
    return out


def callable_methods(p: dict, name: str) -> list[str]:
    cls = by_name(p)
    return cls[name]["methods"] + [m for a in ancestors(p, name) for m in cls[a]["methods"]]


# --- drawing -----------------------------------------------------------------------------------------------

CHW = 0.082  # a 9.5 pt monospace character, in inches
LINE = 0.24
NAME_H = 0.38
PAD = 0.14
GAP_ROW = 1.0


def _lines(c: dict) -> tuple[list[str], list[str]]:
    return [f"{v} {n} : {t}" for v, n, t in c["attrs"]], [f"+ {m}" for m in c["methods"]]


def _size(c: dict) -> tuple[float, float]:
    attrs, methods = _lines(c)
    w = max(len(c["name"]) * 0.105, max(len(s) for s in attrs + methods) * CHW) + 2 * PAD
    h = NAME_H + len(attrs) * LINE + 0.14 + len(methods) * LINE + 0.14
    return w, h


def _box(ax, c: dict, x: float, top: float) -> None:
    w, h = _size(c)
    attrs, methods = _lines(c)
    ha = len(attrs) * LINE + 0.14
    hm = len(methods) * LINE + 0.14
    ax.add_patch(Rectangle((x, top - NAME_H), w, NAME_H, facecolor="#d9dee3", edgecolor=INK, linewidth=1.3))
    ax.add_patch(Rectangle((x, top - NAME_H - ha), w, ha, facecolor="white", edgecolor=INK, linewidth=1.3))
    ax.add_patch(Rectangle((x, top - h), w, hm, facecolor="white", edgecolor=INK, linewidth=1.3))
    ax.text(x + w / 2, top - NAME_H / 2, c["name"], ha="center", va="center", fontsize=10.5, fontweight="bold",
            gid=f"class:{c['name']}")
    for i, s in enumerate(attrs):
        ax.text(x + PAD, top - NAME_H - 0.07 - (i + 0.5) * LINE, s, ha="left", va="center", fontsize=9.5,
                family="monospace", gid=f"attr:{c['name']}")
    for i, s in enumerate(methods):
        ax.text(x + PAD, top - NAME_H - ha - 0.07 - (i + 0.5) * LINE, s, ha="left", va="center", fontsize=9.5,
                family="monospace", gid=f"method:{c['name']}")


def layout(p: dict) -> dict[str, tuple[float, float, float, float]]:
    """Each class's box: left x, top y, width, height (inches)."""
    cls = by_name(p)
    top = p["classes"][0]
    subs = [c for c in p["classes"] if c["parent"] == top["name"]]
    third = [c for c in p["classes"] if c["parent"] and c["parent"] != top["name"]]
    other = cls[p["assoc"]["other"]]
    size = {c["name"]: _size(c) for c in p["classes"]}
    boxes = {}
    y1 = 0.0
    y2 = y1 - max(size[top["name"]][1], size[other["name"]][1]) - GAP_ROW
    wl, wr = size[subs[0]["name"]][0], size[subs[1]["name"]][0]
    boxes[subs[0]["name"]] = (0.0, y2, *size[subs[0]["name"]])
    boxes[subs[1]["name"]] = (wl + 1.0, y2, *size[subs[1]["name"]])
    mid = ((wl / 2) + (wl + 1.0 + wr / 2)) / 2
    wt = size[top["name"]][0]
    boxes[top["name"]] = (mid - wt / 2, y1, *size[top["name"]])
    wo = size[other["name"]][0]
    boxes[other["name"]] = (mid - wt / 2 - 2.0 - wo, y1, *size[other["name"]])
    if third:
        y3 = y2 - max(size[subs[0]["name"]][1], size[subs[1]["name"]][1]) - GAP_ROW
        w3 = size[third[0]["name"]][0]
        boxes[third[0]["name"]] = (wl / 2 - w3 / 2, y3, *size[third[0]["name"]])
    shift = -min(b[0] for b in boxes.values())
    return {k: (x + shift, y, w, h) for k, (x, y, w, h) in boxes.items()}


def _inherit(ax, parent_box, child_boxes, gid: str) -> None:
    px, py, pw, ph = parent_box
    cx = px + pw / 2
    tip = py - ph
    base = tip - 0.2
    ax.add_patch(Polygon([(cx, tip), (cx - 0.12, base), (cx + 0.12, base)], closed=True, facecolor="white", edgecolor=INK,
                         linewidth=1.3, zorder=3))
    kid_top = max(b[1] for b in child_boxes)
    bus = (base + kid_top) / 2
    centres = [b[0] + b[2] / 2 for b in child_boxes]
    if len(child_boxes) == 1 and abs(centres[0] - cx) < 1e-9:
        ax.plot([cx, cx], [base, kid_top], color=INK, linewidth=1.3, gid=gid)
        return
    ax.plot([cx, cx], [base, bus], color=INK, linewidth=1.3, gid=gid)
    ax.plot([min(centres + [cx]), max(centres + [cx])], [bus, bus], color=INK, linewidth=1.3, gid=gid)
    for b, x in zip(child_boxes, centres):
        ax.plot([x, x], [bus, b[1]], color=INK, linewidth=1.3, gid=gid)


def draw(p: dict):
    boxes = layout(p)
    cls = by_name(p)
    top = p["classes"][0]["name"]
    right = max(x + w for x, _, w, _ in boxes.values())
    bottom = min(y - h for _, y, _, h in boxes.values())
    key_top = bottom - 0.35
    width = max(right, 8.6)
    fig, ax = new_figure(width + 0.2, 0.8 - key_top)
    ax.set_position([0, 0, 1, 1])
    for c in p["classes"]:
        x, y, _, _ = boxes[c["name"]]
        _box(ax, c, x, y)
    for parent in [c["name"] for c in p["classes"]]:
        kids = [c["name"] for c in p["classes"] if c["parent"] == parent]
        if kids:
            _inherit(ax, boxes[parent], [boxes[k] for k in kids], f"inherit:{parent}")
    a = p["assoc"]
    ox, oy, ow, _ = boxes[a["other"]]
    tx, ty, _, _ = boxes[top]
    y = oy - NAME_H - 0.3
    ax.plot([ox + ow, tx], [y, y], color=INK, linewidth=1.3, gid="assoc")
    ax.text(ox + ow + 0.08, y + 0.07, a["mult_other"], ha="left", va="bottom", fontsize=10, gid="mult:other")
    ax.text(tx - 0.08, y + 0.07, a["mult_parent"], ha="right", va="bottom", fontsize=10, gid="mult:parent")
    ax.text((ox + ow + tx) / 2, y - 0.08, a["verb"], ha="center", va="top", fontsize=9.5, style="italic", gid="verb")
    # the key
    ax.text(0, key_top, "Key:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.text(0.5, key_top, "-  private      +  public", ha="left", va="center", fontsize=9.5, family="monospace")
    kx = 3.3
    ax.plot([kx, kx + 0.55], [key_top, key_top], color=INK, linewidth=1.2)
    ax.add_patch(Polygon([(kx + 0.75, key_top), (kx + 0.55, key_top + 0.1), (kx + 0.55, key_top - 0.1)], closed=True,
                         facecolor="white", edgecolor=INK, linewidth=1.2))
    ax.text(kx + 0.9, key_top, "inherits from: the arrow points to the parent class", ha="left", va="center",
            fontsize=9.5)
    ax.text(0, key_top - 0.38, "Multiplicity:   1 = exactly one     0..1 = zero or one     0..* = zero or more     "
                               "1..* = one or more", ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(key_top - 0.65, 0.15)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ---------------------------------------------------------------------------------------------

VERBS = ["drew", "designed", "sketched", "planned"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    cls = by_name(p)
    ask, a = p["ask"], p["assoc"]
    names = [c["name"] for c in p["classes"]]
    young = ask["inherit"]
    parent = cls[young]["parent"]
    wrong = [n for n in names if n not in (young, parent)]
    grand = ancestors(p, young)[1:]
    distract = grand + [n for n in wrong if n not in grand]
    qs = [mcq(f"{who} {rng.choice(VERBS)} this class diagram for {SCENES[p['scene']]['where']}. Which class does "
              f"{young} inherit from directly?", parent, distract[:3], rng)]
    priv = sum(x[0] == "-" for x in cls[ask["private"]]["attrs"])
    qs.append(count(f"How many private attributes are listed in the {ask['private']} class?", priv,
                    "private attributes", "attributes"))
    obj = ask["callable"]
    can = callable_methods(p, obj)
    if ask["callable_form"] == "count":
        qs.append(count(f"An object of class {obj} is created. How many methods can it call, counting its own and those "
                        f"it inherits?", len(can), "methods"))
    else:
        cannot = [m for c in p["classes"] if c["name"] != obj for m in c["methods"] if m not in can]
        key = rng.choice(cannot)
        qs.append(mcq(f"Which of these methods can an object of class {obj} NOT call?", key, rng.sample(can, 3), rng))
    if ask["mult_of"] == "parent":
        one, many, mult = a["other"], a["parent"], a["mult_parent"]
    else:
        one, many, mult = a["parent"], a["other"], a["mult_other"]
    qs.append(mcq(f"By the multiplicities on the association line, how many {many} objects can one {one} object be "
                  f"linked to?", MULT[mult], [v for v in MULT.values() if v != MULT[mult]], rng))
    return qs
