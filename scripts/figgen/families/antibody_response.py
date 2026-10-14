"""Primary and secondary immune responses (LS, UP, AL): the antibody concentration in a person's blood over the weeks
after two exposures to the same antigen, two doses of one vaccine or a vaccination and a later infection, on a grid of
two-day and one-unit squares. The exposures are arrows lettered in either order, so which is which is read off the
days, not the letters.

The highest concentration after an exposure, how many days after it the peak came, how many times higher the second
peak is than the first, and which arrow (and day) is the booster or the infection.

The primary response starts after a lag of some days with no antibody, peaks 10 to 14 days after the exposure and
stays small; the secondary response starts at once, peaks 4 or 6 days after it and is 3 to 8 times higher. The curve
runs through its knots without overshooting them (a monotone cubic), so each peak is exactly a knot on a gridline.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, exact, mcq, short

ID = "antibody_response"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("immune-response", "immunity-active-passive"))
AVOID = r"plant|transport|reproduc|gas exchange|circulat|classification and patterns|genetic|inherit|enzyme"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"immunity|immune (?:system|response)|vaccin|antibod|defen[cs]e against"
DISEASES = {"booster": ["measles", "tetanus", "hepatitis B", "polio", "rubella", "diphtheria"],
            "infection": ["measles", "hepatitis B", "rubella", "polio"]}


def sample(rng: random.Random) -> dict:
    f = rng.choice([2, 4, 6])
    t1 = rng.choice([10, 12, 14])
    lag = rng.choice([4, 6])
    t2 = rng.choice([4, 6])
    d2 = f + t1 + rng.choice([12, 14, 16, 18, 20])
    end = 10 * math.ceil((d2 + t2 + 16) / 10)
    step = rng.choice([1, 2, 5, 10])
    while True:
        a, k = rng.choice([1, 2, 3]), rng.choice([3, 4, 5, 6, 8])
        if a * k <= 18:
            break
    top = (a * k + 2 + (a * k) % 2) * step  # whole labelled steps of two units, and room above the second peak
    scenario = rng.choice(["booster", "infection"])
    letters = rng.choice([["P", "Q"], ["X", "Y"], ["A", "B"], ["J", "K"]])
    if rng.random() < 0.5:
        letters = letters[::-1]  # the first exposure is not always the first letter
    return {"band": rng.choice(BANDS), "scenario": scenario, "disease": rng.choice(DISEASES[scenario]), "first": f, "lag": lag,
            "t1": t1, "second": d2, "t2": t2, "p1": a * step, "k": k, "ystep": step, "top": top, "end": end,
            "letters": letters, "ask_peak": rng.choice(["first", "second"]), "ask_days": rng.choice(["first", "second"])}


def knots(p: dict) -> list[list[float]]:
    f, d2, t2, p1 = p["first"], p["second"], p["t2"], p["p1"]
    p2 = p1 * p["k"]
    return [[0, 0], [f + p["lag"], 0], [f + p["t1"], p1], [d2, round(p1 * 0.3, 3)], [d2 + t2, p2],
            [d2 + t2 + 8, round(p2 * 0.8, 3)], [p["end"], round(p2 * 0.62, 3)]]


def _pchip(xs, ys, grid):
    """A monotone cubic through the knots: it never overshoots them, and passes exactly through each."""
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0]] + [0.0 if d[i - 1] * d[i] <= 0 else 3 * (h[i - 1] + h[i]) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
                  for i in range(1, len(d))] + [d[-1]]
    out = []
    for x in grid:
        i = next((j for j in range(len(h)) if x <= xs[j + 1]), len(h) - 1)
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        out.append(h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1])
    return out


def _caption(p: dict) -> str:
    a, b = sorted(p["letters"])
    if p["scenario"] == "booster":
        return f"{a} and {b}: two injections of the same {p['disease']} vaccine"
    return f"{a} and {b}: a {p['disease']} vaccination and, later, infection by the {p['disease']} virus"


def draw(p: dict):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(7.4, 4.6))
    end, top, step = p["end"], p["top"], p["ystep"]
    ax.set_xlim(0, end)
    ax.set_ylim(0, top)
    ax.set_xticks(range(0, end + 1, 10))
    ax.set_xticks(range(0, end + 1, 2), minor=True)
    ax.set_yticks(range(0, top + 1, 2 * step))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.35)
    ax.set_axisbelow(True)
    ks = knots(p)
    xs = [k / 10 for k in range(0, end * 10 + 1)]
    ax.plot(xs, _pchip([k[0] for k in ks], [k[1] for k in ks], xs), color=INK, linewidth=2.0, gid="antibody")
    early, late = p["letters"]
    for letter, day, base in ((early, p["first"], 0.0), (late, p["second"], p["p1"] * 0.3)):
        ax.annotate(letter, xy=(day, base + 0.05 * top), xytext=(day, base + 0.3 * top), ha="center", va="bottom", fontsize=12,
                    fontweight="bold", gid=f"arrow:{letter}",
                    arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4, mutation_scale=13, shrinkA=1, shrinkB=0))
    ax.set_xlabel("Time (days)")
    ax.set_ylabel("Antibody concentration\n(arbitrary units)")
    ax.tick_params(labelsize=8.5)
    ax.set_title(_caption(p), fontsize=9.5, loc="left")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["at a health centre in Huye", "in a biology lesson", "for a school health club in Musanze",
            "for a vaccination campaign poster in Kigali", "from a textbook at a school in Rubavu", "in a lesson on immunity",
            "for a class talk in Nyagatare"]
VERBS = ["studied", "plotted", "copied", "looked at"]
NOUN = {"booster": "injection", "infection": "exposure to the antigen"}


def _units(v) -> list[str]:
    n = exact(v)
    return [n, f"{n} arbitrary units", f"{n} units", f"{n} au", f"{n} a.u."]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    noun = NOUN[p["scenario"]]
    p1 = p["p1"]
    p2 = p1 * p["k"]
    f, d2, t1, t2 = p["first"], p["second"], p["t1"], p["t2"]
    early, late = p["letters"]
    which = p["ask_peak"]
    qs = [short(f"{who} {rng.choice(VERBS)} this graph of one person's antibodies {rng.choice(SETTINGS)}. What was the highest "
                f"antibody concentration after the {which} {noun}?", exact(p1 if which == "first" else p2),
                _units(p1 if which == "first" else p2))]
    which = p["ask_days"]
    days = t1 if which == "first" else t2
    qs.append(short(f"How many days after the {which} {noun} did the antibody concentration reach its peak?", days,
                    [str(days), f"{days} days", f"{days} day"]))
    k = p["k"]
    qs.append(short(f"How many times higher is the peak after the second {noun} than the peak after the first?", k,
                    [str(k), f"{k} times", f"×{k}", f"x{k}", f"{k}x", f"{k} times higher"]))
    if p["scenario"] == "booster":
        stem = rng.choice(["Which arrow shows the booster injection, and on which day was it given?",
                           "A second dose of a vaccine is called a booster. Which arrow shows the booster, and on which day?"])
    else:
        stem = rng.choice(["Which arrow shows when the person was infected, and on which day?",
                           "Which arrow shows when the virus itself entered the body, and on which day?"])
    qs.append(mcq(stem, f"{late}, day {d2}", [f"{early}, day {f}", f"{late}, day {d2 + t2}", f"{early}, day {f + t1}"], rng))
    return qs
