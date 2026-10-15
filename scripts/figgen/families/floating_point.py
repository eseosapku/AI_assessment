"""Floating point (AL): a binary floating-point number drawn as labelled bit boxes, a mantissa and an exponent, both
in two's complement, the binary point marked after the mantissa's first bit, as 9618 prints them. Three formats: an
8-bit mantissa with a 4-bit exponent, 10 with 6, and 12 with 4. Most numbers are normalised (the mantissa starts 01
or 10); some are not (00 or 11), so the question is worth asking.

Asks the number's denary value, which of four statements (normalised or not, positive or negative) is true, the
exponent in denary, and which of four bit patterns in the same format holds the largest positive number (or the
smallest positive normalised one).

Every key is the bits decoded: mantissa = -b0 + b1/2 + b2/4 + ..., times 2 to the exponent. Values stop within four
decimal places. The four bit patterns are two slips crossed: a two's complement field read as unsigned, either one.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "floating_point"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL",)
CONCEPTS = tuple(f"computing.{c}" for c in ("number-internal-coding", "negative-decimal-binary-conversion"))
# A topic whose sections the book lists is reached only if one names real numbers or data representation.
NEEDS = r"floating.point|real numbers?|data representation|information representation|internal coding of numbers"
AVOID = r"monitoring|control|spreadsheet|database|network|security|graphic|\bpresentation|email|html|python|data processing|data, information"
FORMATS = [(8, 4), (10, 6), (12, 4)]
FILL = "#eef1f3"
HEAD = "#d9dee3"


def value_of(mbits: list[int], ebits: list[int]) -> Fraction:
    m = -mbits[0] + sum(Fraction(b, 2 ** i) for i, b in enumerate(mbits[1:], start=1))
    return m * Fraction(2) ** exponent_of(ebits)


def exponent_of(ebits: list[int]) -> int:
    e = int("".join(map(str, ebits)), 2)
    return e - 2 ** len(ebits) if ebits[0] else e


def sample(rng: random.Random) -> dict:
    mb, eb = rng.choice(FORMATS)
    normal = rng.random() < 0.62
    lead = rng.choice([[0, 1], [1, 0]] if normal else [[0, 0], [1, 1]])
    while True:
        free = rng.randint(1, 4)
        tail = [rng.randint(0, 1) for _ in range(free)]
        mant = lead + tail + [0] * (mb - 2 - free)
        e = rng.choice([-3, -2, -1, -1, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6])  # more values with a fraction part
        exp = [int(b) for b in format(e % 2 ** eb, f"0{eb}b")]
        v = value_of(mant, exp)
        if v == 0 or (v * 16).denominator != 1 or abs(v) > 100:
            continue
        if sum(mant[1:]) < 2 and normal:
            continue  # a mantissa with more than its leading bit set, so the value takes working
        return {"band": "AL", "mantissa": mant, "exponent": exp, "ask_extreme": rng.choice(["largest", "smallest"])}


# --- drawing ---------------------------------------------------------------------------------------

def draw(p: dict):
    mant, exp = p["mantissa"], p["exponent"]
    w, h = 0.62, 0.8
    gap = 1.0
    ex0 = len(mant) * w + gap
    right = ex0 + len(exp) * w
    fig, ax = new_figure(max(6.4, 0.72 * right + 0.6), 2.9)
    y0 = 0.0
    ax.text(len(mant) * w / 2, y0 + h + 0.35, "Mantissa", ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(ex0 + len(exp) * w / 2, y0 + h + 0.35, "Exponent", ha="center", va="center", fontsize=11, fontweight="bold")
    for i, b in enumerate(mant):
        ax.add_patch(Rectangle((i * w, y0), w, h, facecolor="white" if i else FILL, edgecolor=INK, linewidth=1.3))
        ax.text(i * w + w / 2, y0 + h / 2, str(b), ha="center", va="center", fontsize=15, family="monospace", gid=f"m:{i}")
    for i, b in enumerate(exp):
        ax.add_patch(Rectangle((ex0 + i * w, y0), w, h, facecolor="white" if i else FILL, edgecolor=INK, linewidth=1.3))
        ax.text(ex0 + i * w + w / 2, y0 + h / 2, str(b), ha="center", va="center", fontsize=15, family="monospace", gid=f"e:{i}")
    # the binary point, between the mantissa's first and second bits
    ax.add_patch(Circle((w, y0 - 0.17), 0.075, facecolor=INK, edgecolor=INK))
    ax.text(w + 0.2, y0 - 0.2, "binary point", ha="left", va="center", fontsize=8.5, style="italic", color="#444444")
    ax.text(0, y0 - 0.65, "The mantissa and the exponent are both in two's complement.", ha="left", va="center", fontsize=9.5)
    ax.text(0, y0 - 1.0, "The binary point comes after the first bit of the mantissa. Shaded: each field's sign bit.", ha="left",
            va="center", fontsize=9.5)
    ax.set_xlim(-0.15, max(right, 7.2) + 0.15)
    ax.set_ylim(y0 - 1.25, y0 + h + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "before a mock exam"]
VERBS = ["decodes", "converts", "works out", "checks"]


def _number_forms(v: Fraction) -> list[str]:
    forms = [exact(v)]
    if v.denominator != 1:
        forms.append(f"{v.numerator}/{v.denominator}")
        whole = abs(v.numerator) // v.denominator
        if whole:
            part = Fraction(abs(v.numerator) % v.denominator, v.denominator)
            forms.append(f"{'-' if v < 0 else ''}{whole} {part.numerator}/{part.denominator}")
    forms += [f.replace("-", "−", 1) for f in forms if f.startswith("-")]
    return forms


def _pattern(m: str, e: str) -> str:
    return f"Mantissa {m}, exponent {e}"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    mant, exp = p["mantissa"], p["exponent"]
    v = value_of(mant, exp)
    e = exponent_of(exp)
    normal = mant[0] != mant[1]
    say = lambda n, s: f"It is {'' if n else 'not '}normalised and {'positive' if s else 'negative'}"  # noqa: E731
    statements = [say(n, s) for n in (True, False) for s in (True, False)]
    key = say(normal, v > 0)
    mb, eb = len(mant), len(exp)
    if p["ask_extreme"] == "largest":
        # the largest mantissa and exponent, and the same fields read as if unsigned
        ms, es = ["0" + "1" * (mb - 1), "1" * mb], ["0" + "1" * (eb - 1), "1" + "0" * (eb - 1)]
        what = "the largest positive number"
    else:
        ms, es = ["01" + "0" * (mb - 2), "0" * (mb - 1) + "1"], ["1" + "0" * (eb - 1), "0" + "1" * (eb - 1)]
        what = "the smallest positive normalised number"
    grid = [_pattern(m, x) for m in ms for x in es]
    return [short(f"{who} {rng.choice(VERBS)} this floating-point number {rng.choice(SETTINGS)}. What is its denary value?",
                  exact(v), _number_forms(v)),
            mcq("Which statement about this number is true?", key, [s for s in statements if s != key], rng),
            short(f"{friend} looks at the exponent alone. What is the exponent in denary?", e, _number_forms(Fraction(e))),
            mcq(f"With the same numbers of bits as the figure, which bit pattern stores {what}?", grid[0], grid[1:], rng)]
