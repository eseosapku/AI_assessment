"""Teeth (P): one jaw drawn from above as a band of gum with simple shapes for teeth, a child's (ten milk teeth:
four incisors, two canines, four molars) or an adult's (sixteen: four incisors, two canines, four premolars, six
molars). Incisors are thin flat blades, canines pointed, premolars small squares with one groove, molars big
squares with a cross. A key beside the jaw draws each shape with its name and its job, and every tooth in the jaw is
drawn exactly as its key shape, not turned (turned canines read as skewed parallelograms, p3s-blind). The jaw's two
halves mirror each other, and every tooth is there: a "fallen out" premise left reviewers unsure what to count. Three
teeth are lettered, one of each kind (an incisor, a canine, and a premolar or a molar, never both, so one letter
grinds), each by a leader line that ends on its tooth.

Which letter shows a tooth for biting, tearing or grinding; what kind of tooth a letter shows; and how many teeth in
the jaw are the same kind as a lettered one (its kind is read off the drawing, then counted).
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
    return {"band": "P", "age": age, "jaw": rng.choice(["upper", "lower"]), "teeth": teeth,
            "letters": dict(sorted(letters.items()))}


# --- drawing ----------------------------------------------------------------------------------------

def _arch(p: dict):
    """Each tooth's centre and the way out of the mouth there, on half an ellipse: the left half spaced by arc length,
    the right half its mirror image, so the jaw is symmetrical."""
    a, b = (2.0, 2.4) if p["age"] == "child" else (2.7, 3.4)
    s = 1 if p["jaw"] == "upper" else -1  # an upper jaw opens downward on the page, a lower jaw upward
    ts = [math.pi * (1 - k / 2000) for k in range(2001)]
    pts = [(a * math.cos(t), s * b * math.sin(t)) for t in ts]
    cum = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.hypot(x1 - x0, y1 - y0))
    widths = [WIDTH[t] for t in p["teeth"]]
    spare = (cum[-1] - sum(widths)) / len(widths)
    half, at = [], spare / 2
    for w in widths[:len(widths) // 2]:
        target = at + w / 2
        k = next(k for k in range(1, len(cum)) if cum[k] >= target)
        f = (target - cum[k - 1]) / (cum[k] - cum[k - 1])
        t = ts[k - 1] + f * (ts[k] - ts[k - 1])
        norm = (math.cos(t) / a, s * math.sin(t) / b)
        ln = math.hypot(*norm)
        half.append(((a * math.cos(t), s * b * math.sin(t)), (norm[0] / ln, norm[1] / ln)))
        at += w + spare
    mirror = [((-x, y), (-nx, ny)) for (x, y), (nx, ny) in reversed(half)]
    return half + mirror, a, b, s


def _shape(kind: str) -> list[tuple[float, float]]:
    """A tooth's outline about its centre, upright on the page, the same in the jaw as in the key."""
    if kind == "incisor":
        return [(-0.19, -0.08), (0.19, -0.08), (0.19, 0.08), (-0.19, 0.08)]
    if kind == "canine":
        return [(0, 0.27), (0.15, 0), (0, -0.27), (-0.15, 0)]  # a diamond
    h = 0.2 if kind == "premolar" else 0.27
    c = 0.06
    return [(-h + c, -h), (h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c)]


def _grooves(kind: str) -> list[list[tuple[float, float]]]:
    if kind == "premolar":
        return [[(-0.13, 0), (0.13, 0)]]
    if kind == "molar":
        return [[(-0.18, 0), (0.18, 0)], [(0, -0.18), (0, 0.18)]]
    return []


def _tooth(ax, kind: str, centre, gid: str) -> None:
    cx, cy = centre
    ax.add_patch(Polygon([(cx + u, cy + v) for u, v in _shape(kind)], closed=True, facecolor="white", edgecolor=INK,
                         linewidth=1.4, zorder=3, gid=gid))
    for g in _grooves(kind):
        ax.plot([cx + u for u, _ in g], [cy + v for _, v in g], color=INK, linewidth=1.0, zorder=4)


def draw(p: dict):
    spots, a, b, s = _arch(p)
    fig, ax = new_figure(8.4, 4.4)
    # the gum: a band round the arch
    ts = [math.pi * (1 - k / 120) for k in range(121)]
    outer = [((a + 0.5) * math.cos(t), s * (b + 0.5) * math.sin(t)) for t in ts]
    inner = [((a - 0.5) * math.cos(t), s * (b - 0.5) * math.sin(t)) for t in ts][::-1]
    ax.add_patch(Polygon(outer + inner, closed=True, facecolor=FILL_2, edgecolor=INK, linewidth=1.0, zorder=1))
    for i, (kind, (centre, _)) in enumerate(zip(p["teeth"], spots)):
        _tooth(ax, kind, centre, f"tooth:{i}:{kind}")
    for letter, i in p["letters"].items():
        (cx, cy), (nx, ny) = spots[i]
        # the leader runs from the letter to the tooth's middle, under the tooth, so it stops at the tooth's edge
        ax.plot([cx + nx * 0.8, cx], [cy + ny * 0.8, cy], color=INK, linewidth=1.0, zorder=2.5, gid=f"leader:{letter}")
        ax.text(cx + nx * 1.02, cy + ny * 1.02, letter, ha="center", va="center", fontsize=14, fontweight="bold",
                gid=f"letter:{letter}")
    # the key: each kind in this jaw, its shape, its name and its job
    kinds = [k for k in KINDS if k in p["teeth"]]
    low, high = (-0.9, b + 1.6) if s > 0 else (-b - 1.6, 0.9)
    x0 = a + 2.1
    top = (low + high) / 2 + 0.6 * (len(kinds) - 1) + 0.45
    ax.text(x0 - 0.35, top + 0.25, "Key", ha="left", va="center", fontsize=12, fontweight="bold")
    for j, kind in enumerate(kinds):
        y = top - 0.6 - 1.2 * j
        _tooth(ax, kind, (x0, y), f"key:{kind}")
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
PICTURES = ["picture", "sketch", "diagram"]


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
    third = next(k for k in order if k not in (key, other))
    n = teeth.count(kind_of[third])
    qs.append(count(f"How many teeth in this jaw are the same kind as tooth {third}?", n, "teeth"))
    return qs
