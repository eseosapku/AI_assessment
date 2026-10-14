"""Teeth (P): one jaw drawn from above as a band of gum with simple shapes for teeth, a child's (ten milk teeth:
four incisors, two canines, four molars) or an adult's (sixteen: four incisors, two canines, four premolars, six
molars). Incisors are thin flat blades, canines pointed, premolars small squares with one groove, molars big
squares with a cross. A key beside the jaw draws each shape with its name and its job. Three teeth are lettered,
one of each kind (an incisor, a canine, and a premolar or a molar, never both, so one letter grinds), and one or two
teeth are missing (a child's have fallen out; an adult's have been lost), so the counts must be read off the figure.

Which letter shows a tooth for biting, tearing or grinding; what kind of tooth a letter shows; how many molars,
incisors or premolars there are in this jaw; and how many teeth it has altogether.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import FILL_2, INK, NAMES, Question, count, mcq, new_figure

ID = "teeth_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("human-digestive-system", "personal-health-and-hygiene"))
# A topic whose sections the book lists is reached only if one names teeth, digestion or the body.
NEEDS = r"teeth|tooth|digest|human body|parts of the head|looking after ourselves"
AVOID = r"\bcells?\b|science in context|technology"

# One half of a jaw, from the back to the front; the other half mirrors it.
HALF = {"child": ["molar", "molar", "canine", "incisor", "incisor"],
        "adult": ["molar", "molar", "molar", "premolar", "premolar", "canine", "incisor", "incisor"]}
KINDS = ["incisor", "canine", "premolar", "molar"]
JOBS = {"incisor": "biting and cutting", "canine": "tearing", "premolar": "crushing and grinding", "molar": "grinding"}
# What a question asks a tooth to do, and the kinds that do it, by the key.
ASK = {"biting": ["incisor"], "tearing": ["canine"], "grinding": ["premolar", "molar"]}
# How much of the arch each kind takes.
WIDTH = {"incisor": 0.44, "canine": 0.46, "premolar": 0.5, "molar": 0.64}


def sample(rng: random.Random) -> dict:
    age = rng.choice(["child", "adult"])
    teeth = HALF[age] + HALF[age][::-1]
    grind = "molar" if age == "child" else rng.choice(["premolar", "molar"])
    chosen = [rng.choice([i for i, t in enumerate(teeth) if t == kind]) for kind in ("incisor", "canine", grind)]
    letters = dict(zip(rng.sample("ABC", 3), chosen))
    free = [i for i in range(len(teeth)) if i not in chosen]
    missing = sorted(rng.sample(free, rng.randint(1, 2)))
    return {"band": "P", "age": age, "jaw": rng.choice(["upper", "lower"]), "teeth": teeth,
            "letters": dict(sorted(letters.items())), "missing": missing}


# --- drawing ----------------------------------------------------------------------------------------

def _arch(p: dict):
    """Each tooth's centre, the way along the arch there, and the way out of the mouth, on half an ellipse."""
    a, b = (1.9, 2.3) if p["age"] == "child" else (2.6, 3.3)
    s = 1 if p["jaw"] == "upper" else -1  # an upper jaw opens downward on the page, a lower jaw upward
    ts = [math.pi * (1 - k / 600) for k in range(601)]
    pts = [(a * math.cos(t), s * b * math.sin(t)) for t in ts]
    cum = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.hypot(x1 - x0, y1 - y0))
    widths = [WIDTH[t] for t in p["teeth"]]
    spare = (cum[-1] - sum(widths)) / len(widths)
    out, at = [], spare / 2
    for w in widths:
        target = at + w / 2
        k = next(k for k in range(len(cum)) if cum[k] >= target)
        t = ts[k]
        along = (a * math.sin(t), -s * b * math.cos(t))
        norm = (math.cos(t) / a, s * math.sin(t) / b)
        la, ln = math.hypot(*along), math.hypot(*norm)
        out.append((pts[k], (along[0] / la, along[1] / la), (norm[0] / ln, norm[1] / ln)))
        at += w + spare
    return out, a, b, s


def _shape(kind: str) -> list[tuple[float, float]]:
    """A tooth's outline in its own frame: along the arch, then out of the mouth."""
    if kind == "incisor":
        return [(-0.19, -0.08), (0.19, -0.08), (0.19, 0.08), (-0.19, 0.08)]
    if kind == "canine":
        return [(0, 0.28), (0.15, 0), (0, -0.28), (-0.15, 0)]  # a diamond, pointing out of the mouth
    h = 0.2 if kind == "premolar" else 0.27
    c = 0.06
    return [(-h + c, -h), (h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c)]


def _grooves(kind: str) -> list[list[tuple[float, float]]]:
    if kind == "premolar":
        return [[(-0.13, 0), (0.13, 0)]]
    if kind == "molar":
        return [[(-0.18, 0), (0.18, 0)], [(0, -0.18), (0, 0.18)]]
    return []


def _place(local, centre, along, norm):
    return [(centre[0] + u * along[0] + v * norm[0], centre[1] + u * along[1] + v * norm[1]) for u, v in local]


def _tooth(ax, kind: str, centre, along, norm, gid: str) -> None:
    ax.add_patch(Polygon(_place(_shape(kind), centre, along, norm), closed=True, facecolor="white", edgecolor=INK,
                         linewidth=1.4, zorder=3, gid=gid))
    for g in _grooves(kind):
        xs, ys = zip(*_place(g, centre, along, norm))
        ax.plot(xs, ys, color=INK, linewidth=1.0, zorder=4)


def draw(p: dict):
    spots, a, b, s = _arch(p)
    fig, ax = new_figure(8.4, 4.4)
    # the gum: a band round the arch
    ts = [math.pi * (1 - k / 120) for k in range(121)]
    outer = [((a + 0.5) * math.cos(t), s * (b + 0.5) * math.sin(t)) for t in ts]
    inner = [((a - 0.5) * math.cos(t), s * (b - 0.5) * math.sin(t)) for t in ts][::-1]
    ax.add_patch(Polygon(outer + inner, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.0, zorder=1))
    for i, (kind, (centre, along, norm)) in enumerate(zip(p["teeth"], spots)):
        if i not in p["missing"]:
            _tooth(ax, kind, centre, along, norm, f"tooth:{i}:{kind}")
    for letter, i in p["letters"].items():
        (cx, cy), _, (nx, ny) = spots[i]
        ax.plot([cx + nx * 0.36, cx + nx * 0.78], [cy + ny * 0.36, cy + ny * 0.78], color=INK, linewidth=1.0)
        ax.text(cx + nx * 1.0, cy + ny * 1.0, letter, ha="center", va="center", fontsize=14, fontweight="bold",
                gid=f"letter:{letter}")
    # the key: each kind in this jaw, its shape, its name and its job
    kinds = [k for k in KINDS if k in p["teeth"]]
    low, high = (-0.9, b + 1.6) if s > 0 else (-b - 1.6, 0.9)
    x0 = a + 2.1
    top = (low + high) / 2 + 0.6 * (len(kinds) - 1) + 0.45
    ax.text(x0 - 0.35, top + 0.25, "Key", ha="left", va="center", fontsize=12, fontweight="bold")
    for j, kind in enumerate(kinds):
        y = top - 0.6 - 1.2 * j
        _tooth(ax, kind, (x0, y), (1, 0), (0, 1), f"key:{kind}")
        ax.text(x0 + 0.5, y + 0.2, kind.capitalize(), ha="left", va="center", fontsize=11.5, fontweight="bold")
        ax.text(x0 + 0.5, y - 0.22, f"for {JOBS[kind]}", ha="left", va="center", fontsize=10.5)
    ax.set_xlim(-a - 1.7, x0 + 4.0)
    ax.set_ylim(min(low, top - 0.6 - 1.2 * (len(kinds) - 1) - 0.6), max(high, top + 0.6))
    ax.set_aspect("equal")
    ax.axis("off")
    whose = "A child's" if p["age"] == "child" else "An adult's"
    ax.set_title(f"{whose} {p['jaw']} jaw", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a science lesson", "for a health club poster", "after a visit to the dentist in Kigali", "for homework",
            "for a class display in Huye", "at the school clinic"]
VERBS = ["drew", "made", "copied"]
PICTURES = ["picture", "drawing", "diagram"]


def questions(p: dict, rng: random.Random) -> list:
    teeth, letters = p["teeth"], p["letters"]
    kind_of = {k: teeth[i] for k, i in letters.items()}
    job = rng.choice(sorted(ASK))
    key = next(k for k, kind in kind_of.items() if kind in ASK[job])
    whose = "a child's" if p["age"] == "child" else "an adult's"
    order = sorted(letters)
    qs = [Question("mcq", f"{rng.choice(NAMES)} {rng.choice(VERBS)} this {rng.choice(PICTURES)} of {whose} {p['jaw']} jaw "
                          f"{rng.choice(SETTINGS)}. Which letter shows a tooth for {job} food?",
                   str(order.index(key)), order)]
    other = rng.choice([k for k in order if k != key])
    kinds = [k for k in KINDS if k in teeth]
    qs.append(mcq(f"What kind of tooth is tooth {other}?", kind_of[other], [k for k in kinds if k != kind_of[other]], rng))
    lost = "One tooth has" if len(p["missing"]) == 1 else "Two teeth have"
    gone = f"{lost} fallen out" if p["age"] == "child" else f"{lost} been lost"
    here = [t for i, t in enumerate(teeth) if i not in p["missing"]]
    ask = rng.choice(["molar", "molar", "incisor"] + (["premolar"] if p["age"] == "adult" else []))
    qs.append(count(f"{gone}. How many {ask}s are there in this jaw?", here.count(ask), f"{ask}s"))
    qs.append(count("How many teeth are there in this jaw altogether?", len(here), "teeth"))
    return qs
