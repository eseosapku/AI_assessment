"""The shift a policy causes, on an AD/AS diagram (AL): an economy's AD1 and AD2 and SRAS1 and SRAS2 on a grid, real
GDP in billions of francs across and the price level up the side, their four crossings lettered A to D from left to
right, as Cambridge AS Level multiple-choice papers draw them. The economy starts where AD1 meets SRAS1; the stem
states a policy or a cause, and the student decides which curve it moves, and which way, so which point is the new
equilibrium.

Four sub-types, one for each AS Level chapter that teaches the shift:
- fiscal (chapter 22): income tax cut or raised, government spending raised or cut, so AD moves right or left;
- monetary (chapter 23): the policy interest rate cut or raised, the money supply increased or reduced: AD again;
- supply-side (chapter 24): a policy that lowers firms' costs of production, so SRAS moves right;
- growth (chapter 18): confident consumers or rising exports (AD right), or new technology or more skilled workers
  (SRAS right); the rate of economic growth is asked, with its formula stated.

The other pair of curves is a decoy that the policy leaves alone. Asks the new equilibrium among the four points, the
new price level or real GDP there, and the change in real GDP (a fall as a negative number) or the growth rate.

This is ad_as's diagram with a policy's question: ad_as itself keeps its two sub-types, whose figures are stored.
The lines are P = a - bQ and P = c + dQ in grid steps, and each pair a whole number of (b + d) steps apart, so all four
crossings fall on gridline crossings (the supply_demand pilot's rule).
"""
from __future__ import annotations

import random
from fractions import Fraction

from ..core import INK, NAMES, mcq, new_figure, short
from . import _micro as g
from .econ_tables import frw

ID = "ad_as_policy"
KIND = "econ.curve"
SUBJECT = "economics"
BANDS = ("AL",)
SUB = {
    "fiscal": ("aggregate-demand", "fiscal-policy", "expansionary-contractionary-policy", "macroeconomic-equilibrium"),
    "monetary": ("aggregate-demand", "monetary-policy", "monetary-expansionary-contractionary", "monetary-policy-impact",
                 "macroeconomic-equilibrium"),
    "supply": ("aggregate-supply", "supply-side-policy", "supply-side-impact", "macroeconomic-equilibrium"),
    "growth": ("economic-growth", "aggregate-demand", "aggregate-supply", "macroeconomic-equilibrium"),
}
CONCEPTS = tuple(sorted({f"economics.{c}" for cs in SUB.values() for c in cs}))
# A topic whose sections the book lists is reached only if its name or a section names the policy or the AD/AS model.
NEEDS = r"fiscal|monetary|supply-side|economic growth|aggregate (demand|supply)"
# The current account's chapter names every policy, for its effect on the current account, which this figure does not
# show; chapter 1 lists a stray table of growth rates among its sections; and each sub-type keeps to its own chapter.
AVOID = (r"current account|balance of pay|exchange rate|unemployment|price stability|national income|circular flow|"
         r"fundamental economic problem")
AVOID_MORE = {"fiscal": r"|monetary|supply-side|growth", "monetary": r"|fiscal|supply-side|growth",
              "supply": r"|fiscal|monetary|growth", "growth": r"|fiscal|monetary|supply-side"}

# (kind, curve moved, way): what is said. Way +1 is more at each price level (to the right).
STORIES = {
    ("fiscal", "AD", 1): ["The government cuts income tax, so households have more to spend.",
                          "The government raises its spending on new roads and schools.",
                          "The government increases its budget deficit by spending more on health care."],
    ("fiscal", "AD", -1): ["The government raises income tax to reduce its budget deficit.",
                           "The government cuts its spending on public projects to reduce its budget deficit."],
    ("monetary", "AD", 1): ["The central bank cuts its policy interest rate, so borrowing becomes cheaper.",
                            "The central bank increases the money supply, so banks lend more."],
    ("monetary", "AD", -1): ["The central bank raises its policy interest rate to slow inflation.",
                             "The central bank reduces the money supply to slow inflation."],
    ("supply", "AS", 1): ["A supply-side policy removes rules that raised firms' costs, lowering firms' costs of production.",
                          "A supply-side policy pays for training that makes workers more productive, lowering firms' costs "
                          "of production.",
                          "A supply-side policy cuts the tax on fuel used by firms, lowering firms' costs of production."],
    ("growth", "AD", 1): ["Consumers grow more confident and spend more.",
                          "Exports rise as trading partners grow richer."],
    ("growth", "AS", 1): ["New technology spreads through industry, lowering firms' costs.",
                          "More skilled workers join the labour force, lowering firms' costs."],
}
XU, YU = 1000, 10  # billion Frw and price index points in one grid step
QX, PY = 14, 18  # the market diagram's grid, whose letters always find room


def concepts_for(p: dict) -> tuple[str, ...]:
    return tuple(f"economics.{c}" for c in SUB[p["kind"]])


def avoid_for(p: dict) -> str:
    return AVOID + AVOID_MORE[p["kind"]]


def _cross(p: dict, i: int, j: int) -> tuple[int, int]:
    """Where AD(i+1) meets SRAS(j+1), in grid steps."""
    a, c, b, d = p["ad"][i], p["sras"][j], p["b"], p["d"]
    q = Fraction(a - c, b + d)
    return int(q), int(a - b * q)


def _cornered(p: dict) -> bool:
    """Whether a line ends within two steps of a right-hand corner, where its name finds no room."""
    for a in p["ad"]:
        end = (QX, a - p["b"] * QX) if a - p["b"] * QX >= 0 else (Fraction(a, p["b"]), 0)
        if end[0] > QX - 2 and end[1] < 2:
            return True
    for c in p["sras"]:
        end = (QX, c + p["d"] * QX) if c + p["d"] * QX <= PY else (Fraction(PY - c, p["d"]), PY)
        if end[0] > QX - 2 and end[1] > PY - 2:
            return True
    return False


def sample(rng: random.Random) -> dict:
    kind = rng.choice(sorted(SUB))
    if kind in ("fiscal", "monetary"):
        move, way = "AD", rng.choice([1, -1])
    elif kind == "supply":
        move, way = "AS", 1
    else:
        move, way = rng.choice(["AD", "AS"]), 1
    story = rng.randrange(len(STORIES[(kind, move, way)]))
    while True:
        b, d = rng.choice([1, 2]), rng.choice([1, 2])
        q1, p1 = rng.randint(4, 9), rng.randint(5, 12)
        a1, c1 = p1 + b * q1, p1 - d * q1
        shift = rng.choice([1, 2, 2]) * (b + d)  # two steps of output more often than one, so points stand apart
        decoy = rng.choice([1, 2, 2]) * (b + d) * rng.choice([1, -1])
        if move == "AD":
            ad, sras = [a1, a1 + way * shift], [c1, c1 + decoy]
        else:
            ad, sras = [a1, a1 + decoy], [c1, c1 - way * shift]  # SRAS to the right is SRAS lower down
        p = {"band": "AL", "kind": kind, "move": move, "story": story, "b": b, "d": d, "ad": ad, "sras": sras,
             "xunit": XU, "yunit": YU, "ask": rng.choice(["price", "gdp"])}
        pts = [_cross(p, i, j) for i in (0, 1) for j in (0, 1)]
        if not all(1 <= q <= QX - 1 and 1 <= v <= PY - 1 for q, v in pts) or len(set(pts)) < 4:
            continue
        if c1 < 0 or min(sras) < -4 or _cornered(p):
            continue
        new = _cross(p, 1, 0) if move == "AD" else _cross(p, 0, 1)
        if kind == "growth" and (new[0] - q1) * 1000 % q1:
            continue  # the growth rate exact to one decimal place
        letters = {pt: letter for letter, pt in zip("ABCD", sorted(pts))}
        p["points"] = {letter: list(pt) for pt, letter in letters.items()}
        p["start"] = letters[(q1, p1)]
        return p


def draw(p: dict):
    fig, ax = new_figure(6.4, 5.6)
    g.grid(ax, QX, PY, XU, YU, "Real GDP (billion Frw)", "Price level (index)", xevery=2, yevery=2)
    board = g.Board(ax, QX, PY, XU, YU)
    b, d = p["b"], p["d"]
    ends = [("AD1", board.line(p["ad"][0], -b, "AD1"), -b), ("AD2", board.line(p["ad"][1], -b, "AD2", "--"), -b),
            ("SRAS1", board.line(p["sras"][0], d, "SRAS1"), d), ("SRAS2", board.line(p["sras"][1], d, "SRAS2", "--"), d)]
    for letter, (q, v) in p["points"].items():
        ax.plot([q * XU], [v * YU], "o", color=INK, markersize=5.5, zorder=4)
        board.block(q - 0.15, q + 0.15, v - 0.2, v + 0.2)
    for letter, (q, v) in p["points"].items():
        others = [pt for k, pt in p["points"].items() if k != letter]
        if not board.label(letter, q, v, 11.5, gap=0.12, pad=0.05, others=others,
                           where=[(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]):
            raise ValueError("no room for a point's letter")
    for name, end, slope in ends:
        board.end_label(name, end, slope, size=10)
    ax.set_title("Aggregate demand and aggregate supply", fontsize=11.5)
    return fig


VERBS = ["studies", "is given", "draws", "copies", "looks at", "works from"]
SETTINGS = ["in an economics lesson", "for homework", "on a revision card", "for a class test", "at the economics club",
            "before a mock exam", "in a study group in Huye", "while revising in Kigali"]
GROWTH = "The rate of economic growth = (new real GDP − old real GDP) ÷ old real GDP × 100."


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    move = p["move"]
    way = 1 if (p["ad"][1] > p["ad"][0] if move == "AD" else p["sras"][1] < p["sras"][0]) else -1
    story = STORIES[(p["kind"], move, way)][p["story"]]
    start = p["start"]
    old = _cross(p, 0, 0)
    new = _cross(p, 1, 0) if move == "AD" else _cross(p, 0, 1)
    letter = {tuple(v): k for k, v in p["points"].items()}[new]
    at = f"The economy starts at point {start}, where AD1 meets SRAS1. {story}"
    qs = [mcq(f"{who} {rng.choice(VERBS)} this AD/AS diagram of an economy {rng.choice(SETTINGS)}. {at} Which point shows "
              "the new equilibrium?", f"Point {letter}", [f"Point {k}" for k in "ABCD" if k != letter], rng)]
    if p["ask"] == "price":
        v = new[1] * YU
        qs.append(short(f"{at} What is the new price level?", v, [f"{v} index points", f"index {v}"]))
    else:
        v = new[0] * XU
        qs.append(short(f"{at} What is real GDP at the new equilibrium, in billion Frw?", v,
                        [f"{frw(v)} billion", f"{v} billion", f"{frw(v)} billion Frw", f"{v} billion Frw", f"{v:,}"]))
    if p["kind"] == "growth":
        rate = Fraction(new[0] - old[0], old[0]) * 100
        key = f"{float(rate):.1f}".rstrip("0").rstrip(".")
        forms = [key, f"{float(rate):.1f}"]
        qs.append(short(f"{at} {GROWTH} What rate of economic growth does this give, as a percentage?", key,
                        forms + [f"{f}{u}" for f in forms for u in ("%", " %", " per cent", " percent")]))
    else:
        ch = (new[0] - old[0]) * XU
        shown = ("−" if ch < 0 else "") + frw(abs(ch))
        forms = [str(ch), shown, f"{ch:,}", f"{shown} billion", f"{ch} billion", f"{shown} billion Frw"]
        if ch < 0:
            forms += [f"-{frw(-ch)}", f"−{-ch}", f"a fall of {frw(-ch)} billion", f"falls by {frw(-ch)} billion"]
        else:
            forms += [f"+{ch}", f"a rise of {frw(ch)} billion", f"rises by {frw(ch)} billion"]
        qs.append(short(f"{at} What is the change in real GDP, in billion Frw? Give a fall as a negative number.", ch, forms))
    return qs
