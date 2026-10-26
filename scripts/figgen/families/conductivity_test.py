"""Testing liquids for conduction (LS, UP): three or four lettered set-ups, each a beaker of a named liquid with two
carbon electrodes, wired to a cell and a bulb (or, at UP, an ammeter whose current is printed). A key printed with
the figure says how to read it:

- bulb: the bulb lights brightly (long rays) for a strong electrolyte, glows dimly (short rays) for a weak one and
  stays dark for a non-electrolyte;
- ammeter (UP): a current above 0.50 A for a strong electrolyte, 0.01 A to 0.50 A for a weak one, 0.00 A for a
  non-electrolyte.

Which lettered liquid is a strong, weak or non-electrolyte, how many conduct, and at UP how much larger one current
is than another. The liquids and their classes come from the S2 and S5 books' own examples (sodium chloride solution
is strong, ethanoic acid and ammonia solution weak, sugar solution and ethanol non-electrolytes), so the drawing never
contradicts the chemistry; the letters, not the names, carry every answer.
"""
from __future__ import annotations

import math
import random
import textwrap
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, Question, count, exact, measure, new_figure, short
from ._bio_parts import letter_choice

ID = "conductivity_test"
KIND = "diagram.template"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("conductivity", "weak-electrolytes", "electrolysis"))
# A topic whose sections the book lists is reached only if one names electrolytes or conduction ("electrolytic cell"
# names a galvanic-cell chapter's comparison, not this test).
NEEDS = r"electrolytes?\b|conductiv|conduction"
AVOID = r"\borganic|carboxylic|polymer|petro|equilibri|\brates?\b|glossary"

STRONG = ["sodium chloride solution", "dilute hydrochloric acid", "dilute sulfuric acid", "sodium hydroxide solution",
          "copper(II) sulfate solution", "potassium nitrate solution"]
WEAK = ["dilute ethanoic acid", "ammonia solution", "lemon juice"]
NON = ["sugar solution", "ethanol", "paraffin", "glucose solution"]
CLASS_OF = {**{x: "strong" for x in STRONG}, **{x: "weak" for x in WEAK}, **{x: "non" for x in NON}}
WORDS = {"strong": "strong electrolyte", "weak": "weak electrolyte", "non": "non-electrolyte"}
STRONG_AMPS = ["0.60", "0.70", "0.75", "0.80", "0.90", "1.00", "1.10", "1.20"]
WEAK_AMPS = ["0.02", "0.04", "0.05", "0.08", "0.10", "0.12", "0.15", "0.20"]
UNIT = 4.0  # the width of one set-up


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = "ammeter" if band == "UP" and rng.random() < 0.5 else "bulb"
    n = rng.choice([3, 4])
    classes = ["strong", "weak", "non"]
    if n == 4:
        classes.append(rng.choice(["strong", "weak", "non"]))
    rng.shuffle(classes)
    pools = {"strong": list(STRONG), "weak": list(WEAK), "non": list(NON)}
    for pool in pools.values():
        rng.shuffle(pool)
    letters = "ABCD"[:n]
    setups = [[L, pools[c].pop()] for L, c in zip(letters, classes)]
    p = {"band": band, "kind": kind, "setups": setups}
    if kind == "ammeter":
        strong, weak = rng.sample(STRONG_AMPS, 2), rng.sample(WEAK_AMPS, 2)
        p["readings"] = {L: (strong.pop() if c == "strong" else weak.pop() if c == "weak" else "0.00")
                         for L, c in zip(letters, classes)}
    return p


# --- drawing ------------------------------------------------------------------------------------------------------

LIQUID = "#dfe7ee"
CARBON = "#5b5b5b"
GLOW = {"strong": "#ffd84d", "weak": "#fff1b8", "non": "#ffffff"}
TOP = 4.4  # the wire across the top of each set-up


def _bulb(ax, x: float, y: float, state: str, L: str, r: float = 0.24) -> None:
    ax.add_patch(Circle((x, y), r, facecolor=GLOW[state], edgecolor=INK, linewidth=1.2, zorder=4, gid=f"bulb:{L}:{state}"))
    d = r * math.cos(math.radians(45))
    ax.plot([x - d, x + d], [y - d, y + d], color=INK, linewidth=1.0, zorder=5)
    ax.plot([x - d, x + d], [y + d, y - d], color=INK, linewidth=1.0, zorder=5)
    if state == "non":
        return
    # rays above the wire only: 8 long ones when it lights brightly, 4 short ones when it glows dimly
    n, r0, r1, a0, a1 = (8, r + 0.09, r + 0.5, 25, 155) if state == "strong" else (4, r + 0.09, r + 0.24, 50, 130)
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * k / (n - 1))
        ax.plot([x + r0 * math.cos(a), x + r1 * math.cos(a)], [y + r0 * math.sin(a), y + r1 * math.sin(a)],
                color="#c98a00", linewidth=1.4, zorder=3, gid=f"ray:{L}")


def _cell(ax, x: float, y: float) -> None:
    """A cell: the long thin plate (+) on the left, the short thick plate (−) on the right."""
    ax.plot([x - 0.07, x - 0.07], [y - 0.3, y + 0.3], color=INK, linewidth=1.3, zorder=4)
    ax.plot([x + 0.07, x + 0.07], [y - 0.15, y + 0.15], color=INK, linewidth=3.4, zorder=4)


def _setup(ax, cx: float, L: str, liquid: str, kind: str, state: str, reading: str | None) -> None:
    ax.add_patch(Rectangle((cx - 1.35, 0), 2.7, 1.75, facecolor=LIQUID, edgecolor="none", zorder=1))
    ax.plot([cx - 1.35, cx - 1.35, cx + 1.35, cx + 1.35], [2.45, 0, 0, 2.45], color=INK, linewidth=1.5, zorder=2)
    for ex in (cx - 0.8, cx + 0.8):
        ax.add_patch(Rectangle((ex - 0.12, 0.35), 0.24, 2.55, facecolor=CARBON, edgecolor=INK, linewidth=0.9, zorder=3))
    # the circuit: up from each electrode, across the top through the cell and the bulb or ammeter
    left, right = cx - 0.8, cx + 0.8
    cell_x, part_x = cx - 0.4, cx + 0.35
    ax.plot([left, left, cell_x - 0.07], [2.9, TOP, TOP], color=INK, linewidth=1.2, zorder=2)
    ax.plot([cell_x + 0.07, part_x - 0.24], [TOP, TOP], color=INK, linewidth=1.2, zorder=2)
    ax.plot([part_x + 0.24, right, right], [TOP, TOP, 2.9], color=INK, linewidth=1.2, zorder=2)
    _cell(ax, cell_x, TOP)
    if kind == "bulb":
        _bulb(ax, part_x, TOP, state, L)
    else:
        ax.add_patch(Circle((part_x, TOP), 0.24, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4, gid=f"ammeter:{L}"))
        ax.text(part_x, TOP, "A", ha="center", va="center", fontsize=10, fontweight="bold", zorder=5)
        ax.text(part_x, TOP + 0.62, f"{reading} A", ha="center", va="center", fontsize=10.5, zorder=5, gid=f"reading:{L}",
                bbox=dict(facecolor="white", edgecolor=INK, linewidth=0.8, pad=2.0))
    ax.text(cx, -0.42, L, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"letter:{L}")
    ax.text(cx, -0.85, "\n".join(textwrap.wrap(liquid, 18)), ha="center", va="top", fontsize=10, linespacing=1.15,
            gid=f"liquid:{L}")


def draw(p: dict):
    n = len(p["setups"])
    width = n * UNIT
    fig, ax = new_figure(2.45 * n + 0.6, 5.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    for k, (L, liquid) in enumerate(p["setups"]):
        state = CLASS_OF[liquid]
        _setup(ax, UNIT * (k + 0.5), L, liquid, p["kind"], state, p.get("readings", {}).get(L))
    # the key, above the set-ups
    y0 = 6.8
    ax.text(0.15, y0 + 0.55, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
    if p["kind"] == "bulb":
        rows = [("strong", "bulb lights brightly: strong electrolyte"), ("weak", "bulb glows dimly: weak electrolyte"),
                ("non", "bulb does not light: non-electrolyte")]
        for k, (state, words) in enumerate(rows):
            y = y0 - 0.55 * k
            ax.add_patch(Circle((0.4, y), 0.14, facecolor=GLOW[state], edgecolor=INK, linewidth=1.0, zorder=4))
            ax.text(0.75, y, words, ha="left", va="center", fontsize=10)
    else:
        rows = ["current above 0.50 A: strong electrolyte", "current from 0.01 A to 0.50 A: weak electrolyte",
                "no current (0.00 A): non-electrolyte"]
        for k, words in enumerate(rows):
            ax.text(0.25, y0 - 0.55 * k, words, ha="left", va="center", fontsize=10)
    ax.set_xlim(0, width)
    ax.set_ylim(-2.1, y0 + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "during a lesson on electrolytes", "at the science club in Huye",
            "in a chemistry practical in Musanze", "for a class investigation in Rubavu", "in the laboratory at a school in Nyagatare",
            "for a project on liquids at home", "in a practical test in Kigali"]
VERBS = ["tested", "checked", "compared", "investigated"]


def _or(letters: list[str]) -> str:
    return ", ".join(letters[:-1]) + " or " + letters[-1]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setups = dict(p["setups"])
    letters = list(setups)
    classes = {L: CLASS_OF[x] for L, x in setups.items()}
    single = [c for c in ("strong", "weak", "non") if list(classes.values()).count(c) == 1]
    ask = rng.choice(single)
    key = next(L for L, c in classes.items() if c == ask)
    how = "the bulb in each circuit" if p["kind"] == "bulb" else "the current in each circuit"
    n_word = {3: "three", 4: "four"}[len(letters)]
    qs = [letter_choice(f"{who} {rng.choice(VERBS)} {n_word} liquids {rng.choice(SETTINGS)}, watching {how}. "
                        f"Which liquid, {_or(letters)}, is a {WORDS[ask]}?", key, letters)]
    if p["kind"] == "ammeter" and rng.random() < 0.5:
        flowing = sorted((L for L in letters if classes[L] != "non"), key=lambda L: Fraction(p["readings"][L]))
        lo, hi = flowing[0], flowing[-1]
        diff = Fraction(p["readings"][hi]) - Fraction(p["readings"][lo])
        qs.append(short(f"How much larger is the current through liquid {hi} than through liquid {lo}?", exact(diff),
                        measure(exact(diff), "A")))
    else:
        conduct = sum(c != "non" for c in classes.values())
        qs.append(count("How many of the liquids conduct electricity?", conduct, "liquids"))
    L = rng.choice([x for x in letters if x != key])
    options = sorted(WORDS.values())
    qs.append(Question("mcq", f"According to {'its bulb' if p['kind'] == 'bulb' else 'its current'} and the key, "
                              f"what is liquid {L}?", str(options.index(WORDS[classes[L]])), options))
    return qs
