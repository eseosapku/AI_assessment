"""Nephron (LS, UP, AL): a nephron drawn as textbooks draw it, beside a table of results. The glomerulus (a knot of
capillaries, fed by a wide afferent arteriole and drained by a narrower efferent one) sits in the cup of Bowman's
capsule; the proximal convoluted tubule winds away from it, the loop of Henle dips into the medulla (a dashed line
marks the cortex above and the medulla below), the distal convoluted tubule winds back and joins the collecting
duct, which carries urine on to the ureter. The table gives the concentration of protein, glucose, urea and mineral
salts in the blood plasma, the filtrate and the urine, in g per dm³, with values true to life: protein stays in the
blood, glucose is filtered and all reabsorbed, urea is concentrated 50 to 80 times.

Five or six parts are lettered, always the glomerulus: which letter is where blood is filtered; which substance is in
the filtrate but not the urine; why protein is not in the filtrate; and how many times urea is concentrated, from the
table (urine ÷ filtrate, a whole number).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from ..core import INK, NAMES, Question, new_figure, short
from ._bio_parts import ellipse, flow, letter, letter_choice, letters_for, offset, part, spline

ID = "nephron_diagram"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("UP", "AL", "LS")
CONCEPTS = tuple(f"biology.{c}" for c in ("kidney-structure", "excretion-osmoregulation", "excretory-organs-mammals"))
# A topic whose sections the book lists is reached only if one names excretion, the kidney or urine.
NEEDS = r"excret|kidney|nephron|urin"

PARTS = ["Bowman's capsule", "proximal convoluted tubule", "loop of Henle", "distal convoluted tubule", "collecting duct"]
SUBSTANCES = ["protein", "glucose", "urea", "mineral salts"]
WHY = "Protein molecules are too large to pass out of the glomerulus into the capsule"
WHY_WRONG = ["All the protein is reabsorbed into the blood in the proximal tubule",
             "Protein is broken down into urea in the kidney",
             "Protein is pumped back into the blood by the collecting duct"]


def _num(v: Fraction):
    """A table value as stored: a whole number as an int, else a float written exactly (0.25, 18.5)."""
    return int(v) if v.denominator == 1 else float(v)


def sample(rng: random.Random) -> dict:
    chosen = ["glomerulus"] + rng.sample(PARTS, rng.choice([4, 5]))
    labels = letters_for(chosen, rng)
    while True:
        urea = Fraction(rng.choice(["0.2", "0.25", "0.3", "0.4", "0.5"]))
        times = rng.randint(50, 80)
        urine = urea * times
        if 12 <= urine <= 30 and (urine * 10).denominator == 1:  # one decimal place at most
            break
    protein = rng.choice([70, 72, 75, 78, 80])
    glucose = rng.choice([0.9, 1.0, 1.1])
    salts = rng.choice([7.2, 7.5, 8.0, 9.0])
    table = {"protein": [protein, 0, 0], "glucose": [glucose, glucose, 0], "urea": [_num(urea), _num(urea), _num(urine)],
             "mineral salts": [salts, salts, rng.choice([10, 12, 14, 15, 18])]}
    order = SUBSTANCES[:]
    rng.shuffle(order)
    return {"band": rng.choice(BANDS), "labels": dict(sorted(labels.items())), "table": table, "rows": order}


# --- drawing ----------------------------------------------------------------------------------------

C, R_OUT, R_IN = (1.6, 8.3), 0.95, 0.66
EPITHELIUM, BLOOD = "#dfe7ef", "#e7a1a1"
W = 0.26  # the tubule's width
CD_X, CD_W = 6.95, 0.5


def _polar(r: float, deg: float) -> tuple[float, float]:
    return C[0] + r * math.cos(math.radians(deg)), C[1] + r * math.sin(math.radians(deg))


def _tubule():
    """The tubule's centreline from the capsule to the collecting duct (one smooth curve, its bends gentle enough for
    the tube's width), and where each part of it starts and ends along it."""
    per = 6
    pct = [_polar(0.8, -40), (2.55, 7.45), (2.95, 7.55), (3.05, 8.0), (3.35, 8.4), (3.75, 8.3), (3.8, 7.85), (4.05, 7.5),
           (4.3, 7.15)]
    loop = [(4.36, 6.7), (4.36, 5.5), (4.36, 4.0), (4.36, 2.5), (4.36, 1.65)]
    loop += [(4.76 - 0.4 * math.cos(math.radians(a)), 1.65 - 0.4 * math.sin(math.radians(a))) for a in range(30, 180, 30)]
    loop += [(5.16, 1.65), (5.16, 2.5), (5.16, 4.0), (5.16, 5.5)]
    dct = [(5.16, 6.05), (5.25, 6.45), (5.55, 6.8), (5.95, 6.72), (6.12, 6.38), (6.42, 6.3), (6.6, 6.4), (CD_X - CD_W / 2 + 0.06, 6.4)]
    path = spline(pct + loop + dct, closed=False, per=per)
    a, b = per * (len(pct) - 1), per * (len(pct) + len(loop))
    return path, {"proximal convoluted tubule": (0, a + 1), "loop of Henle": (a, b + 1), "distal convoluted tubule": (b, len(path))}


def _anchors() -> dict:
    path, spans = _tubule()
    pct = path[spans["proximal convoluted tubule"][0]:spans["proximal convoluted tubule"][1]]
    crest = max(pct, key=lambda q: q[1])
    dct = path[spans["distal convoluted tubule"][0]:spans["distal convoluted tubule"][1]]
    top = max(dct, key=lambda q: q[1])
    bottom = min(path[spans["loop of Henle"][0]:spans["loop of Henle"][1]], key=lambda q: q[1])
    return {"glomerulus": ((-0.9, 8.2), (1.4, 8.15)), "Bowman's capsule": ((-0.9, 7.1), _polar((R_OUT + R_IN) / 2, 235)),
            "proximal convoluted tubule": ((crest[0], 9.75), crest), "distal convoluted tubule": ((top[0], 9.75), top),
            "loop of Henle": ((-0.9, bottom[1]), bottom), "collecting duct": ((8.2, 3.0), (CD_X, 3.0))}


def _show(v) -> str:
    return str(v)


def draw(p: dict):
    fig, ax = new_figure(9.0, 5.0)
    from matplotlib.patches import Polygon
    # the capsule: a cup open towards its arterioles, the glomerulus inside
    cup = ellipse(*C, R_OUT, R_OUT, n=60, a0=175, a1=455) + ellipse(*C, R_IN, R_IN, n=60, a0=455, a1=175)
    part(ax, cup, "Bowman's capsule", EPITHELIUM, z=2)
    for deg, w, sign, gid in ((150, 0.34, -1, "blood in"), (115, 0.22, 1, "blood out")):
        near, far = _polar(0.3, deg), _polar(2.15, deg)
        side_a, side_b = offset([far, near], w / 2), offset([far, near], -w / 2)
        ax.add_patch(Polygon(side_a + side_b[::-1], closed=True, facecolor="#d97a7a", edgecolor="none", zorder=2.9))
        for s in (side_a, side_b):
            ax.plot([s[0][0], s[1][0]], [s[0][1], s[1][1]], color=INK, linewidth=1.0, zorder=2.91)
        tail, head = (_polar(1.95, deg), _polar(1.25, deg)) if sign < 0 else (_polar(1.25, deg), _polar(1.95, deg))
        side = 0.3 if sign < 0 else -0.3  # beside the arteriole, not on it
        dx, dy = -math.sin(math.radians(deg)) * side, math.cos(math.radians(deg)) * side
        flow(ax, (tail[0] + dx, tail[1] + dy), (head[0] + dx, head[1] + dy), gid, color="#a33", lw=1.3)
    blob = [(C[0] + (0.5 + 0.05 * math.cos(7 * math.radians(a))) * math.cos(math.radians(a)),
             C[1] + (0.5 + 0.05 * math.cos(7 * math.radians(a))) * math.sin(math.radians(a))) for a in range(0, 360, 4)]
    part(ax, blob, "glomerulus", BLOOD, z=3)
    for k in range(3):  # the knot of capillaries inside
        r = 0.16 + 0.1 * k
        arc = ellipse(C[0] + 0.05 * (k - 1), C[1] - 0.04 * k, r, r * 0.8, n=24, a0=40 + 60 * k, a1=320 + 40 * k)
        ax.plot([q[0] for q in arc], [q[1] for q in arc], color="#8a2f2f", linewidth=0.8, zorder=3.1)
    # the tubule, one tube in three parts
    path, spans = _tubule()
    left, right = offset(path, W / 2), offset(path, -W / 2)
    for name, (i0, i1) in spans.items():
        part(ax, left[i0:i1] + right[i0:i1][::-1], name, EPITHELIUM, edge="none", z=2.5)
    for side in (left, right):
        ax.plot([q[0] for q in side], [q[1] for q in side], color=INK, linewidth=1.1, zorder=2.6)
    # the collecting duct, open where the distal tubule joins it
    x0, x1 = CD_X - CD_W / 2, CD_X + CD_W / 2
    part(ax, [(x0, 9.9), (x1, 9.9), (x1, 0.45), (x0, 0.45)], "collecting duct", EPITHELIUM, edge="none", z=2.4)
    join = path[-1][1]
    ax.plot([x1, x1], [0.45, 9.9], color=INK, linewidth=1.1, zorder=2.6)
    ax.plot([x0, x0], [join + W / 2 + 0.02, 9.9], color=INK, linewidth=1.1, zorder=2.6)
    ax.plot([x0, x0], [0.45, join - W / 2 - 0.02], color=INK, linewidth=1.1, zorder=2.6)
    flow(ax, (3.95, 4.6), (3.95, 3.4), "down the loop", lw=1.3)
    flow(ax, (5.55, 3.4), (5.55, 4.6), "up the loop", lw=1.3)
    flow(ax, (7.6, 2.2), (7.6, 0.9), "urine", lw=1.3)
    ax.text(CD_X, 0.1, "to the ureter", ha="center", va="center", fontsize=9.5, style="italic")
    # cortex above, medulla below
    ax.plot([-1.3, 8.2], [5.35, 5.35], color=INK, linewidth=0.9, linestyle=(0, (5, 4)), zorder=1)
    ax.text(-1.3, 5.65, "cortex", ha="left", va="center", fontsize=9.5, style="italic")
    ax.text(-1.3, 5.05, "medulla", ha="left", va="center", fontsize=9.5, style="italic")
    for L, name in p["labels"].items():
        at, end = _anchors()[name]
        letter(ax, L, at, end, gap=0.32)
    _table(ax, p)
    ax.set_xlim(-1.5, 19.4)
    ax.set_ylim(-0.3, 10.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _table(ax, p: dict) -> None:
    cols = [9.0, 12.4, 14.65, 16.9, 19.15]
    top, h1, h2, row = 8.6, 0.8, 1.05, 0.8
    rows = p["rows"]
    bottom = top - h1 - h2 - row * len(rows)
    lines = [top, top - h1, top - h1 - h2] + [top - h1 - h2 - row * (k + 1) for k in range(len(rows))]
    for y in lines:
        x_from = cols[1] if y == top - h1 else cols[0]
        ax.plot([x_from, cols[-1]], [y, y], color=INK, linewidth=1.0)
    for k, x in enumerate(cols):
        y_to = top - h1 if k == 2 or k == 3 else top
        ax.plot([x, x], [bottom, y_to], color=INK, linewidth=1.0)
    ax.text((cols[0] + cols[1]) / 2, top - (h1 + h2) / 2, "Substance", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text((cols[1] + cols[-1]) / 2, top - h1 / 2, "Concentration / g per dm³", ha="center", va="center", fontsize=11)
    for k, head in enumerate(["Blood\nplasma", "Filtrate", "Urine"]):
        ax.text((cols[k + 1] + cols[k + 2]) / 2, top - h1 - h2 / 2, head, ha="center", va="center", fontsize=11, fontweight="bold",
                linespacing=1.0)
    for r, name in enumerate(rows):
        y = top - h1 - h2 - row * (r + 0.5)
        ax.text(cols[0] + 0.2, y, name.capitalize(), ha="left", va="center", fontsize=11)
        for k, v in enumerate(p["table"][name]):
            ax.text((cols[k + 1] + cols[k + 2]) / 2, y, _show(v), ha="center", va="center", fontsize=11)


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} is revising excretion {setting} with this diagram of a nephron and table of results.",
          "{name} copied this diagram of a nephron and its table {setting}.",
          "{name} found this nephron and table of test results {setting}.",
          "{name} is studying how the kidney makes urine {setting}, using this diagram and table."]
SETTINGS = ["in a biology lesson in Huye", "for a test", "in the library at a school in Rubavu", "for homework",
            "at a study group in Kigali", "before an exam", "in a lesson on the kidney in Muhanga"]


def questions(p: dict, rng: random.Random) -> list:
    labels, table = p["labels"], p["table"]
    at = {v: k for k, v in labels.items()}
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    # the capsule is where the filtrate collects: arguable as "where blood is filtered", so it is never offered
    wrong = [at[c] for c in ("proximal convoluted tubule", "collecting duct", "loop of Henle", "distal convoluted tubule") if c in at]
    stem = rng.choice(["Which letter shows where the blood is filtered under high pressure?",
                       "Which letter shows the part where blood is filtered (ultrafiltration)?"])
    qs = [letter_choice(f"{intro} {stem}", at["glomerulus"], wrong)]
    options = [s.capitalize() for s in SUBSTANCES]
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice(["Use the table. Which substance is in the filtrate but not in the urine?",
                                          "According to the table, which substance is in the filtrate but not in the urine?"]),
                       str(options.index("Glucose")), options))
    options = [WHY] + WHY_WRONG
    rng.shuffle(options)
    qs.append(Question("mcq", rng.choice(["The table shows no protein in the filtrate. Why is protein not filtered out of the blood?",
                                          "There is no protein in the filtrate in the table. What is the reason?"]),
                       str(options.index(WHY)), options))
    f, u = Fraction(str(table["urea"][1])), Fraction(str(table["urea"][2]))
    n = int(u / f)  # a whole number: sample() makes it so
    qs.append(short(rng.choice(["Use the table. How many times more concentrated is urea in the urine than in the filtrate? "
                                "(concentration in urine ÷ concentration in filtrate)",
                                "From the table, how many times does the urea concentration rise from the filtrate to the urine? "
                                "Work out concentration in urine ÷ concentration in filtrate."]),
                    n, [f"{n} times", f"{n}x", f"×{n}", f"x{n}", f"{n} ×"]))
    return qs
