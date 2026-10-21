"""How a pre-colonial kingdom was ruled, as an organisation chart (P Stages 1 to 6, LS): pre-colonial Rwanda, the
Buganda kingdom, the Oyo Empire and the Kongo kingdom, each from the fixed table below, as the Rwanda S1 and S2 History
and Citizenship books and the NERDC history books draw them. The ruler's box is at the top, the councils and the queen
mother beside the ruler on the same row (joined by a dashed line), and each rank of chiefs on a row below, joined to
the office above it. Every box is lettered at its top-left corner, and a table beside the chart prints what each office
did.

Which letter is the council that advised (or chose and advised) the ruler, by the table; which letter is directly
below (or above) a named office; how many levels (rows of boxes) the chart shows; which letter is the office that did
a duty printed in the table.

For Primary 1 to 3 (NERDC "Traditional institutions") a simpler chart of the Oyo Empire: the Alaafin, the Oyo Mesi
beside him joined by a dashed line marked "advises", the provincial kings below him and the Baales below them, with
no letters and no table. Who is just below the Alaafin, who is at the bottom, who advises the Alaafin, how many rows.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, Question, mcq, new_figure, short

ID = "kingdom_structure"
KIND = "diagram.template"
SUBJECT = "history"
BANDS = ("P", "LS")
CONCEPTS = ("history.nigerian-civilizations", "history.pre-colonial-societies", "history.state-government-definition")
# Rwanda's Primary 4 Social Studies teaches how leadership was organised in pre-colonial Rwanda.
ALSO = ("social-studies.leadership-pre-colonial", "social-studies.pre-colonial-rwanda")
# A topic whose sections the book lists is reached only if its name or a section names a kingdom, pre-colonial times,
# organisation, tradition, a civilisation or leadership.
NEEDS = r"kingdom|pre-colonial|organi[sz]|traditional|civili[sz]ation|leadership"
AVOID = r"genocide|human rights|religio|colonial rule|expansion"

NG_NAMES = ["Chinedu", "Amina", "Tunde", "Ngozi", "Emeka", "Aisha", "Bola", "Ifeoma", "Musa", "Funke", "Chioma",
            "Ibrahim", "Kemi", "Obinna", "Zainab", "Femi"]

# Each kingdom: its title, its ruler, and its offices in the order drawn: (office, second line or None, row, the
# office above it, or "beside" for a council beside the ruler, or a pair for an office under two, x of the box's
# centre, what the office did). The ruler's row is 1.
KINGDOMS = {
    # Source: Rwanda S1 History and Citizenship "Organization of Pre-Colonial Rwanda" (political and military
    # organisation); P4 Social Studies "Traditional Rwanda".
    "rwanda": {"title": "How pre-colonial Rwanda was ruled", "ruler": "Mwami", "people": "rw", "offices": [
        ("Mwami", "(the king)", 1, None, 3.55, "was the king, the head of the kingdom"),
        ("Umugabekazi", "(the queen mother)", 1, "beside", 1.2, "was the queen mother, who ruled beside the Mwami"),
        ("Abiru", None, 1, "beside", 5.9, "was the council that kept the royal traditions and advised the Mwami"),
        ("Chief of land", "(Umutware w'ubutaka)", 2, "Mwami", 1.2, "collected taxes in crops and settled land matters"),
        ("Chief of pastures", "(Umutware w'umukenke)", 2, "Mwami", 3.55,
         "looked after the pastures and collected taxes in cattle"),
        ("Chief of the army", "(Umutware w'ingabo)", 2, "Mwami", 5.9, "commanded the army"),
        ("Hill chiefs", "(Abatware b'imisozi)", 3, ("Chief of land", "Chief of pastures"), 2.375,
         "ran the hills and reported to the chiefs above them")],
        "council": "advised the Mwami"},
    # Source: Rwanda S2 History and Citizenship "Kingdoms of East and Central Africa: Buganda and Kongo Kingdoms".
    "buganda": {"title": "How the Buganda kingdom was ruled", "ruler": "Kabaka", "people": "rw", "offices": [
        ("Kabaka", "(the king)", 1, None, 3.55, "was the king, the head of the kingdom"),
        ("Lukiiko", "(the council)", 1, "beside", 5.9, "was the council of chiefs that advised the Kabaka and made laws"),
        ("Katikkiro", "(chief minister)", 2, "Kabaka", 3.55, "was the chief minister, who ran the government for the Kabaka"),
        ("Saza chiefs", "(counties)", 3, "Katikkiro", 3.55, "ran the counties"),
        ("Gombolola chiefs", "(sub-counties)", 4, "Saza chiefs", 3.55, "ran the sub-counties"),
        ("Muluka chiefs", "(parishes)", 5, "Gombolola chiefs", 3.55, "ran the parishes")],
        "council": "advised the Kabaka"},
    # Source: NERDC Junior Secondary History "Nigerian civilizations"; Primary 4-6 "Pre-colonial societies" (the Oyo
    # Empire: the Alaafin, the Oyo Mesi of seven chiefs, the Ogboni, the Are-Ona-Kakanfo, the provincial Obas and Baales).
    "oyo": {"title": "How the Oyo Empire was ruled", "ruler": "Alaafin", "people": "ng", "offices": [
        ("Alaafin", "(the king)", 1, None, 3.55, "was the king, the head of the empire"),
        ("Oyo Mesi", "(council of seven)", 1, "beside", 1.2, "was the council of seven chiefs that chose and advised the Alaafin"),
        ("Ogboni", "(council of elders)", 1, "beside", 5.9, "was the council of elders that checked the power of the Oyo Mesi"),
        ("Are-Ona-Kakanfo", "(army commander)", 2, "Alaafin", 2.375, "commanded the army"),
        ("Provincial kings", "(Obas)", 2, "Alaafin", 4.725, "ruled the towns of the provinces and paid tribute to the Alaafin"),
        ("Baales", "(town and village heads)", 3, "Provincial kings", 4.725, "ran the smaller towns and villages")],
        "council": "chose and advised the Alaafin"},
    # Source: Rwanda S2 History and Citizenship "Kingdoms of East and Central Africa: Buganda and Kongo Kingdoms"
    # (provinces under governors, districts under chiefs, villages under their heads).
    "kongo": {"title": "How the Kongo kingdom was ruled", "ruler": "Manikongo", "people": "rw", "offices": [
        ("Manikongo", "(the king)", 1, None, 3.55, "was the king, the head of the kingdom"),
        ("Royal council", "(nobles)", 1, "beside", 5.9, "was the council of nobles that chose and advised the Manikongo"),
        ("Provincial governors", None, 2, "Manikongo", 3.55, "ruled the provinces for the Manikongo"),
        ("District chiefs", None, 3, "Provincial governors", 3.55, "ran the districts of each province"),
        ("Village heads", None, 4, "District chiefs", 3.55, "ran the villages and collected tribute")],
        "council": "chose and advised the Manikongo"},
    # For Primary 1 to 3: the Oyo Empire's main ranks, without letters or table.
    "oyo_simple": {"title": "How the Oyo Empire was ruled", "ruler": "Alaafin", "people": "ng", "offices": [
        ("Alaafin", "(the king)", 1, None, 4.6, None),
        ("Oyo Mesi", "(council of chiefs)", 1, "beside", 1.3, None),
        ("Provincial kings", "(Obas)", 2, "Alaafin", 4.6, None),
        ("Baales", "(village heads)", 3, "Provincial kings", 4.6, None)],
        "council": None},
}
# Which kingdoms each band draws, the school years they suit, and the topic names each may reach.
KINDS = [("LS", "rwanda"), ("LS", "buganda"), ("LS", "oyo"), ("LS", "kongo"), ("P", "rwanda"), ("P", "oyo"),
         ("P", "oyo_simple")]
TOPICS = {("LS", "rwanda"): r"organi[sz]ation of pre-colonial rwanda", ("P", "rwanda"): r"traditional rwanda",
          ("LS", "buganda"): r"buganda|kongo", ("LS", "kongo"): r"buganda|kongo",
          ("LS", "oyo"): r"nigerian civili[sz]ations", ("P", "oyo"): r"pre-colonial societies",
          ("P", "oyo_simple"): r"traditional institutions"}
# Offices named in a stem with a small letter ("the chief of land"); the rest are names ("the Katikkiro").
COMMON = {"Chief of land", "Chief of pastures", "Chief of the army", "Hill chiefs", "Provincial kings",
          "Provincial governors", "District chiefs", "Village heads", "Royal council"}


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["kingdom"] in ("oyo", "oyo_simple"):
        return ("history.pre-colonial-societies", "history.nigerian-civilizations")
    return ("history.pre-colonial-societies", "history.state-government-definition")


def avoid_for(p: dict) -> str:
    return f"{AVOID}|^(?!.*(?:{TOPICS[(p['band'], p['kingdom'])]}))"


def stages(p: dict):
    if p["band"] != "P":
        return None
    return (1, 3) if p["kingdom"] == "oyo_simple" else (4, 6)


def called(office: str) -> str:
    return office[0].lower() + office[1:] if office in COMMON else office


def children(k: str, office: str) -> list:
    return [o[0] for o in KINGDOMS[k]["offices"] if o[3] == office or (isinstance(o[3], tuple) and office in o[3])]


def rows_of(k: str) -> int:
    return max(o[2] for o in KINGDOMS[k]["offices"])


def sample(rng: random.Random) -> dict:
    band, k = rng.choice(KINDS)
    if k == "oyo_simple":
        return {"band": band, "kingdom": k, "letters": None, "link": None, "duty": None,
                "ask": rng.sample(["below", "bottom", "advises", "rows"], 3)}
    offices = KINGDOMS[k]["offices"]
    letters = list("ABCDEFG"[:len(offices)])
    rng.shuffle(letters)
    lettered = {o[0]: letter for o, letter in zip(offices, letters)}
    below = [o[0] for o in offices if len(children(k, o[0])) == 1]
    above = [o[0] for o in offices if isinstance(o[3], str) and o[3] != "beside"]
    link = rng.choice([["below", o] for o in below] + [["above", o] for o in above])
    duty = rng.choice([o[0] for o in offices if o[2] >= 2])
    return {"band": band, "kingdom": k, "letters": lettered, "link": link, "duty": duty,
            "ask": rng.sample(["council", "link", "levels", "duty"], 3)}


# --- drawing ----------------------------------------------------------------------------------------------

BW, BH, STEP = 2.05, 0.9, 1.4
R = 0.19  # a letter's circle


def draw(p: dict):
    k = p["kingdom"]
    spec = KINGDOMS[k]
    offices = spec["offices"]
    big = p["band"] == "P"
    fs_name, fs_sub, fs_table = (12, 10.5, 10.5) if big else (11, 10, 10)
    simple = p["letters"] is None
    rows = rows_of(k)
    chart_h = 0.5 + (rows - 1) * STEP + BH + 0.3
    # the table's rows: office and what it did
    table = [] if simple else [(o[0], textwrap.fill(o[5], 40)) for o in offices]
    heights = [0.24 + 0.2 * (d.count("\n") + 1) for _, d in table]
    table_h = 0.5 + 0.42 + sum(heights)
    W = 6.3 if simple else 13.3
    H = 0.75 + max(chart_h, table_h)
    fig, ax = new_figure(W, H)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(3.55 if not simple else W / 2, H - 0.35, spec["title"], ha="center", va="center", fontsize=13.5 if big else 13,
            fontweight="bold")
    y1 = H - 0.75 - 0.5 - BH / 2
    place = {o[0]: (o[4], y1 - (o[2] - 1) * STEP) for o in offices}
    # links: each office to the one above it, a council to the ruler by a dashed line
    for name, sub, row, up, x, duty in offices:
        if up is None:
            continue
        _, y = place[name]
        if up == "beside":
            rx, ry = place[spec["ruler"]]
            a, b = sorted([x, rx])
            ax.plot([a + BW / 2, b - BW / 2], [y, y], color=INK, linewidth=1.3, linestyle=(0, (4, 3)), gid=f"link:{name}")
            if simple:
                ax.text((a + b) / 2, y + 0.17, "advises", ha="center", va="bottom", fontsize=11, style="italic")
            continue
        ups = up if isinstance(up, tuple) else (up,)
        mid = y + BH / 2 + (STEP - BH) / 2
        xs = [place[u][0] for u in ups] + [x]
        for u in ups:
            ux, uy = place[u]
            ax.plot([ux, ux], [uy - BH / 2, mid], color=INK, linewidth=1.3, gid=f"link:{u}>{name}")
        ax.plot([min(xs), max(xs)], [mid, mid], color=INK, linewidth=1.3)
        ax.plot([x, x], [mid, y + BH / 2], color=INK, linewidth=1.3, gid=f"link:>{name}")
    for name, sub, row, up, x, duty in offices:
        _, y = place[name]
        ax.add_patch(FancyBboxPatch((x - BW / 2, y - BH / 2), BW, BH, boxstyle="round,pad=0,rounding_size=0.08",
                                    facecolor=FILL_2 if up == "beside" else "white", edgecolor=INK, linewidth=1.4, zorder=2))
        if sub:
            ax.text(x, y + 0.08, name, ha="center", va="center", fontsize=fs_name, fontweight="bold", zorder=3,
                    gid=f"name:{name}")
            ax.text(x, y - 0.22, sub, ha="center", va="center", fontsize=fs_sub, zorder=3)
        else:
            ax.text(x, y - 0.06, name, ha="center", va="center", fontsize=fs_name, fontweight="bold", zorder=3,
                    gid=f"name:{name}")
        if not simple:
            cx, cy = x - BW / 2 + 0.22, y + BH / 2
            ax.add_patch(Circle((cx, cy), R, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=4))
            ax.text(cx, cy, p["letters"][name], ha="center", va="center", fontsize=12, fontweight="bold", zorder=5,
                    gid=f"letter:{name}")
    if table:
        tx, tw1, tw2 = 7.45, 2.15, 3.6
        ty = H - 0.75 - 0.15
        ax.text(tx, ty, "What each office did", ha="left", va="center", fontsize=fs_table + 1, fontweight="bold")
        top = ty - 0.3
        head = 0.42
        ax.add_patch(Rectangle((tx, top - head), tw1 + tw2, head, facecolor="#e3e6e9", edgecolor="none"))
        ax.text(tx + 0.1, top - head / 2, "Office", ha="left", va="center", fontsize=fs_table, fontweight="bold")
        ax.text(tx + tw1 + 0.1, top - head / 2, "What it did", ha="left", va="center", fontsize=fs_table, fontweight="bold")
        edges = [top, top - head]
        yy = top - head
        for (name, duty), h in zip(table, heights):
            ax.text(tx + 0.1, yy - h / 2, name, ha="left", va="center", fontsize=fs_table, fontweight="bold")
            ax.text(tx + tw1 + 0.1, yy - h / 2, duty, ha="left", va="center", fontsize=fs_table, linespacing=1.2,
                    gid=f"duty:{name}")
            yy -= h
            edges.append(yy)
        for e in edges:
            ax.plot([tx, tx + tw1 + tw2], [e, e], color=INK, linewidth=0.8)
        for x in (tx, tx + tw1, tx + tw1 + tw2):
            ax.plot([x, x], [edges[0], edges[-1]], color=INK, linewidth=0.8)
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------------

SETTINGS = ["in a history lesson", "for homework", "on a revision card", "before a class test", "at the history club",
            "for a group presentation", "in the school library"]
VERBS = ["studies", "copies", "looks at", "explains"]


def _letters(stem: str, key: str, others: list) -> Question:
    options = sorted([key, *others])
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    k = p["kingdom"]
    spec = KINGDOMS[k]
    who = rng.choice(NG_NAMES if spec["people"] == "ng" else NAMES)
    opening = f"{who} {rng.choice(VERBS)} this chart of the Oyo Empire {rng.choice(SETTINGS)}."
    if p["letters"] is None:
        kings, baales, mesi, alaafin = ("The provincial kings (Obas)", "The Baales (village heads)", "The Oyo Mesi",
                                        "The Alaafin")
        asked = {"below": ("Who is just below the Alaafin on the chart?", kings, [baales, mesi]),
                 "bottom": ("Who is at the bottom of the chart?", baales, [kings, mesi, alaafin]),
                 "advises": ("Who advises the Alaafin on this chart?", mesi, [kings, baales])}
        qs = []
        for i, a in enumerate(p["ask"]):
            lead = opening + " " if i == 0 else ""
            if a == "rows":
                qs.append(short(lead + "How many rows of boxes are on the chart?", 3, ["3 rows", "three"]))
            else:
                stem, key, wrong = asked[a]
                qs.append(mcq(lead + stem, key, wrong, rng))
        return qs
    letters = p["letters"]
    offices = spec["offices"]
    name = spec["title"].replace("How ", "").replace(" was ruled", "")
    council = next(o[0] for o in offices if o[5] and "council" in o[5] and spec["council"] in o[5])
    qs = []
    for i, a in enumerate(p["ask"]):
        lead = f"{who} {rng.choice(VERBS)} this chart of {name} {rng.choice(SETTINGS)}. " if i == 0 else ""
        if a == "council":
            beside = [letters[o[0]] for o in offices if o[3] == "beside" and o[0] != council]
            rest = [letters[o[0]] for o in offices if o[0] != council and letters[o[0]] not in beside]
            others = (beside + rng.sample(rest, 3))[:3]
            qs.append(_letters(lead + f"Using the table, which letter shows the council that {spec['council']}?",
                               letters[council], others))
        elif a == "link":
            way, office = p["link"]
            key = children(k, office)[0] if way == "below" else next(o[3] for o in offices if o[0] == office)
            pool = [letters[o[0]] for o in offices if o[0] not in (key, office)]
            qs.append(_letters(lead + f"Which letter shows the office directly {way} the {called(office)}?",
                               letters[key], rng.sample(pool, 3)))
        elif a == "levels":
            n = rows_of(k)
            qs.append(short(lead + f"How many levels (rows of boxes) does the chart of {name} show?", n,
                            [f"{n} levels", f"{n} rows"]))
        else:
            office = p["duty"]
            duty = next(o[5] for o in offices if o[0] == office)
            pool = [letters[o[0]] for o in offices if o[0] != office]
            qs.append(_letters(lead + f"Using the table, which letter shows the office that {duty}?", letters[office],
                               rng.sample(pool, 3)))
    return qs
