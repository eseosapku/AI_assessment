"""Titration (UP, AL): the burette read at the start and end of three runs, each reading a zoomed window of
the scale (2.00 cm³ of it: marks every 0.1 cm³, numbers every 1 cm³) with the bottom of the meniscus on a mark or half-way
between two, so it reads to the nearest 0.05 cm³. Two titres agree to 0.00 or 0.10 cm³; the third is off by
0.30 cm³ or more. A titre, a reading, the mean of the concordant titres, and at AL the moles in it.

Readings are held in hundredths of a cm³. A run may start where the last one ended.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, exact, new_figure, short

ID = "titration"
KIND = "instrument.reading"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("acid-base-titrations", "mole-concept", "laboratory-techniques",
                                             "neutralization"))
AVOID = r"organic|alkane|electrolysis|isotope|periodic|bonding|enthalpy|rate|chromatograph|redox-titration|redox|masses of atoms|states of matter|equilibri|separation|chemical reactions|environment|npk|polymer|solubility|solvent|introduction"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"titrat|\bacids?\b|\bbases?\b|neutrali|\bmoles?\b|concentration|\bsalts?\b|volumetric|stoichiometr"
# in the burette, in the flask
PAIRS = [("hydrochloric acid", "sodium hydroxide solution"), ("sodium hydroxide solution", "ethanoic acid"),
         ("sulfuric acid", "potassium hydroxide solution"), ("nitric acid", "sodium carbonate solution"),
         ("sodium hydroxide solution", "hydrochloric acid")]
HALF = 0.05  # a burette reads to half a 0.1 cm³ division (P3h review: 21.75 for 21.80 is a fair reading)
SCALE = 2.6  # drawing units per cm³: 0.1 cm³ marks far enough apart to see a half-way meniscus
SPAN = 200  # hundredths of a cm³ in a window: two numbered marks always show, so the scale's direction does
ROW = SPAN / 100 * SCALE + 1.3  # one row of windows to the next


def window(v: int) -> tuple[int, int]:
    """The stretch of scale drawn for a reading: 2.00 cm³ from a 0.1 mark, the reading a varying way down."""
    off = 40 + (v // 5 % 4) * 30
    lo = 10 * ((v - off) // 10)
    return lo, lo + SPAN


def sample(rng: random.Random) -> dict:
    t = rng.randrange(1800, 2600, 5)
    titres = [t, t + rng.choice([-10, 0, 10]), t + rng.choice([1, -1]) * rng.randrange(40, 130, 5)]
    rng.shuffle(titres)
    runs, end = [], None
    for tt in titres:
        start = end if end is not None and end + tt <= 4900 and rng.random() < 0.4 else rng.randrange(0, 205, 5)
        end = start + tt
        runs.append([start, end])
    return {"band": rng.choice(BANDS), "runs": runs, "pair": rng.randrange(len(PAIRS)),
            "conc": rng.choice([0.1, 0.05, 0.2, 0.15]), "ask": rng.randint(1, 3), "read": rng.randint(1, 3)}


def _panel(ax, x0, ytop, v):
    lo, hi = window(v)
    y = lambda h: ytop - (h - lo) / 100 * SCALE  # noqa: E731 - downward: a burette reads from the top
    w = 0.9
    bottom = y(hi)
    ax.add_patch(Rectangle((x0, bottom), w, y(v) - bottom, facecolor="#dfe4e8", edgecolor="none"))
    ax.plot([x0, x0], [ytop, bottom], color=INK, linewidth=1.3)
    ax.plot([x0 + w, x0 + w], [ytop, bottom], color=INK, linewidth=1.3)
    for h in range(lo, hi + 1, 10):
        if h < 0 or h > 5000:
            continue
        size = 0.55 if h % 100 == 0 else 0.38 if h % 50 == 0 else 0.22
        ax.plot([x0, x0 + size], [y(h), y(h)], color=INK, linewidth=1.0 if h % 100 else 1.3)
        if h % 100 == 0:
            ax.text(x0 - 0.12, y(h), str(h // 100), ha="right", va="center", fontsize=12)
    xs = [x0 + w * k / 40 for k in range(41)]
    ax.plot(xs, [y(v) + 0.16 * ((x - x0 - w / 2) / (w / 2)) ** 2 for x in xs], color=INK, linewidth=1.6)


def draw(p: dict):
    fig, ax = new_figure(6.4, 8.6)
    for k, (start, end) in enumerate(p["runs"]):
        for row, (v, word) in enumerate(((start, "start"), (end, "end"))):
            x0, ytop = k * 3.2, -row * ROW
            ax.text(x0 + 0.45, ytop + 0.3, f"run {k + 1}: {word}", ha="center", va="bottom", fontsize=12)
            _panel(ax, x0, ytop, v)
    ax.set_xlim(-1.0, 2 * 3.2 + 1.4)
    ax.set_ylim(-ROW - SPAN / 100 * SCALE - 0.2, 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a chemistry practical", "in the school laboratory", "for a class practical", "at the science club"]


def _cm3(h: int) -> list[str]:
    two = f"{h // 100}.{h % 100:02d}"
    forms = [two, f"{two} cm³", f"{two}cm³", f"{two} cm3"]
    short_form = exact(Fraction(h, 100))
    if short_form != two:
        forms += [short_form, f"{short_form} cm³"]
    return forms


def _standard(v: Fraction) -> list[str]:
    """3.5175 × 10⁻³ and 3.52 × 10⁻³, as a student writes moles (P3g final review)."""
    from decimal import ROUND_HALF_UP, Decimal
    d = Decimal(v.numerator) / Decimal(v.denominator)
    e = d.adjusted()
    mant = d.scaleb(-e).normalize()
    sup_e = "⁻" + str(-e).translate(str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"))
    out = []
    for m in (format(mant, "f"), str(mant.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))):
        for f in (f"{m} × 10{sup_e}", f"{m} x 10^{e}", f"{m} × 10^{e}", f"{m}e{e}", f"{m} × 10{sup_e} mol"):
            if f not in out:
                out.append(f)
    return out


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    burette, flask = PAIRS[p["pair"]]
    titres = [b - a for a, b in p["runs"]]
    close = [i for i in range(3) if any(abs(titres[i] - titres[j]) <= 10 for j in range(3) if j != i)]
    mean = Fraction(sum(titres[i] for i in close), 2)  # hundredths: the two differ by 0 or 0.10 cm³, so a whole number
    mean_h = int(mean)
    k = p["ask"]
    qs = [short(f"{who} added {burette} from a burette to {flask} {rng.choice(SETTINGS)}. These are the burette readings at the "
                f"start and end of each run. What was the titre in run {k}?", _cm3(titres[k - 1])[0], _cm3(titres[k - 1]), tolerance=HALF)]
    qs.append(short(f"{friend} says two titres are concordant: within 0.10 cm³ of each other. What is the mean of the concordant titres?",
                    _cm3(mean_h)[0], _cm3(mean_h), tolerance=HALF))
    if p["band"] == "UP":
        j = p["read"]
        qs.append(short(f"What was the burette reading at the end of run {j}?", _cm3(p["runs"][j - 1][1])[0], _cm3(p["runs"][j - 1][1]),
                        tolerance=HALF))
    else:
        moles = Fraction(str(p["conc"])) * mean / 100 / 1000
        mol = exact(moles)
        qs.append(short(f"The {burette} had a concentration of {p['conc']} mol/dm³. How many moles of it were in the mean titre?",
                        mol, [mol, f"{mol} mol"] + _standard(moles)))
    return qs
