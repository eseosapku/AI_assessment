"""Blood glucose graphs (UP, AL): the blood glucose concentration of two people, lettered, for three hours
after the same meal. One has diabetes: they start higher, peak higher and later, and are still high at the
end. Neither is labelled. The highest concentration, when the other person's level is back to where it
started, and which person most likely has diabetes.

The curves run smoothly through knots on gridlines without overshooting them; every value asked is a knot.
"""
from __future__ import annotations

import random

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short

ID = "glucose_graph"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("homeostasis-general-principles", "endocrine-system-structure-function",
                                           "hormonal-imbalance-effects", "internal-environment"))
AVOID = r"plant|photosynth|genetic|inherit|ecolog|population|immun|reproduc|enzyme|cell|behaviour|excretion|nervous|temperature|circulatory|proteins|vitamins"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"glucose|insulin|diabet|homeostasis|hormon"
HORMONES = ["insulin", "glucagon", "adrenaline", "ADH"]


def _pchip(xs, ys, n=400):
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    px, py = [], []
    for k in range(n + 1):
        x = xs[0] + (xs[-1] - xs[0]) * k / n
        i = next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        px.append(x)
        py.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return px, py


def sample(rng: random.Random) -> dict:
    s = rng.choice([4.5, 5.0, 5.5])
    top = rng.choice([7.5, 8.0, 8.5])
    at = rng.choice([30, 45])
    back = rng.choice([90, 120])
    normal = [[0, s], [at, top]] + [[t, round((top - (top - s) * (t - at) / (back - at)) * 2) / 2] for t in range(at + 30, back, 30)]
    normal += [[back, s], [150, s], [180, s]]
    normal = sorted({t: v for t, v in normal}.items())
    d0 = rng.choice([7.0, 8.0, 9.0])
    dpeak = rng.choice([13.0, 14.0, 15.0, 16.0])
    dat = rng.choice([60, 90])
    dend = rng.choice([10.0, 11.0, 12.0])
    diab = [[0, d0], [30, (d0 + dpeak) // 2], [dat, dpeak], [dat + 45, (dpeak + dend) // 2], [180, dend]]
    letters = rng.choice([["A", "B"], ["P", "Q"], ["X", "Y"]])
    first_diabetic = rng.random() < 0.5
    people = [{"letter": letters[0], "diabetic": first_diabetic, "knots": [list(k) for k in (diab if first_diabetic else normal)]},
              {"letter": letters[1], "diabetic": not first_diabetic, "knots": [list(k) for k in (normal if first_diabetic else diab)]}]
    return {"band": rng.choice(BANDS), "people": people, "ask": rng.randrange(2)}


def draw(p: dict):
    fig, ax = new_figure(7.2, 4.4)
    ax.set_xticks(range(0, 181, 30))
    ax.set_xticks(range(0, 181, 15), minor=True)
    ax.set_yticks(range(0, 19, 2))
    ax.set_yticks([v / 2 for v in range(0, 37)], minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 180)
    ax.set_ylim(0, 18)
    for person, style in zip(p["people"], ["-", (0, (6, 3))]):
        px, py = _pchip([k[0] for k in person["knots"]], [k[1] for k in person["knots"]])
        ax.plot(px, py, color=INK, linewidth=1.8, linestyle=style, label=f"person {person['letter']}")
    ax.set_xlabel("Time after the meal (minutes)")
    ax.set_ylabel("Blood glucose (mmol/dm³)")
    ax.tick_params(labelsize=8)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), fontsize=9, frameon=False, handlelength=2.6)
    return fig


SETTINGS = ["in a biology lesson", "at a health club", "in a school project", "at the science club"]


def _mmol(v: float) -> list[str]:
    n = exact(v)
    forms = [n, f"{n} mmol/dm³", f"{n} mmol/L", f"{n} mmol per dm³", f"{n} mmol/l", f"{n} mmol dm⁻³"]
    if n.endswith(".5") is False and "." not in n:
        forms.append(f"{n}.0")
    return forms


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    x = p["people"][p["ask"]]
    peak = max(v for _, v in x["knots"])
    normal = next(q for q in p["people"] if not q["diabetic"])
    start = normal["knots"][0][1]
    back = next(t for t, v in normal["knots"][1:] if v == start)
    diabetic = next(q for q in p["people"] if q["diabetic"])["letter"]
    letters = [q["letter"] for q in p["people"]]
    qs = [short(f"{who} measured the blood glucose of two people after the same meal {rng.choice(SETTINGS)}. What was the "
                f"highest blood glucose of person {x['letter']}?", exact(peak), _mmol(peak)),
          short(f"How many minutes after the meal was person {normal['letter']}'s blood glucose back to its starting level?", back,
                [str(back), f"{back} minutes", f"{back} min", f"{back} mins"]),
          mcq(f"{friend} compares the two curves. Which person most likely has diabetes?", f"person {diabetic}",
              [f"person {q}" for q in letters if q != diabetic] + ["both people", "neither person"], rng)]
    # No "which hormone" question: insulin, whatever the figure (P3i review).
    return qs
