"""The human digestive system (LS, UP) and mammal teeth (LS).

- Canal (LS, UP): the alimentary canal and its glands from the front, as textbooks draw it: the oesophagus from the
  mouth, the stomach on the body's left (the viewer's right), the liver over it on the other side with the gall bladder
  under it, the pancreas below the stomach, the duodenum running down into the coiled small intestine, the large
  intestine framing it, and the rectum to the anus. Five parts are lettered, each by a leader that ends on its part,
  and a table beside the drawing names the lettered parts and what each does. Asks which letter shows the part with a
  role from the table (twice) and what the part at a letter is.
- Teeth (LS): the teeth in one half of the upper jaw and one half of the lower jaw of an unnamed mammal, drawn from the
  front of the mouth to the back with a key of the four tooth shapes; the whole mouth has twice as many, and the
  figure says so. The jaws are those of a human, dog, cat, sheep, rabbit or pig (textbook dental formulae). Asks the
  number of teeth in the whole mouth, the number of one kind in the whole mouth, and the teeth in one half-jaw.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Ellipse, Polygon, Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure
from ._bio_parts import letter, letter_choice, part, spline, tube

ID = "digestive_system"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("digestive-system", "heterotrophic-nutrition-forms", "teeth-structure-function"))
ALSO = ("science.human-digestive-system",)
# A topic whose sections the book lists is reached only if one names digestion, nutrition in humans or teeth.
NEEDS = r"digest|alimentary|human nutrition|nutrition in (?:humans|mammals)|heterotroph|teeth|dentition|dental"
AVOID = (r"plant|photosynth|autotroph|nutrition and transport|sexual|STIs|HIV|glossary|science in context|"
         r"social factors|reproduction system")

ROLE = {
    "oesophagus": "carries food from the mouth to the stomach",
    "stomach": "digests protein in acid conditions",
    "liver": "makes bile",
    "gall bladder": "stores bile",
    "pancreas": "makes digestive enzymes that pass into the small intestine",
    "small intestine": "absorbs most of the digested food into the blood",
    "large intestine": "absorbs water from undigested food",
    "rectum": "stores faeces until they leave through the anus",
}
CONFUSE = {
    "oesophagus": ["stomach", "rectum", "small intestine"],
    "stomach": ["pancreas", "liver", "small intestine"],
    "liver": ["gall bladder", "pancreas", "stomach"],
    "gall bladder": ["liver", "pancreas", "stomach"],
    "pancreas": ["liver", "gall bladder", "stomach"],
    "small intestine": ["large intestine", "stomach", "rectum"],
    "large intestine": ["small intestine", "rectum", "oesophagus"],
    "rectum": ["large intestine", "small intestine", "oesophagus"],
}
KINDS = ["incisor", "canine", "premolar", "molar"]
# Teeth in one half of the upper and of the lower jaw: incisors, canines, premolars, molars.
FORMULA = {"human": ([2, 1, 2, 3], [2, 1, 2, 3]), "dog": ([3, 1, 4, 2], [3, 1, 4, 3]), "cat": ([3, 1, 3, 1], [3, 1, 2, 1]),
           "sheep": ([0, 0, 3, 3], [3, 1, 3, 3]), "rabbit": ([2, 0, 3, 3], [1, 0, 2, 3]), "pig": ([3, 1, 4, 3], [3, 1, 4, 3])}


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "teeth":
        return ("biology.teeth-structure-function", "biology.heterotrophic-nutrition-forms")
    return ("biology.digestive-system", "biology.heterotrophic-nutrition-forms")


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if band == "LS" and rng.random() < 0.5:
        mammal = rng.choice(sorted(FORMULA))
        up, low = FORMULA[mammal]
        return {"band": band, "kind": "teeth", "mammal": rng.choice(["X", "Y", "Z", "P"]), "upper": list(up),
                "lower": list(low)}
    parts = rng.sample(sorted(ROLE), 5)
    return {"band": band, "kind": "canal", "labels": {chr(65 + i): x for i, x in enumerate(parts)}}


# --- drawing: the canal -----------------------------------------------------------------------------

LX, RX = -1.3, 11.3
STOMACH = [(5.0, 9.7), (5.8, 10.1), (6.9, 10.0), (7.6, 9.4), (7.8, 8.5), (7.4, 7.7), (6.5, 7.3), (5.6, 7.5), (5.2, 8.1),
           (5.5, 8.7), (5.2, 9.2)]
LIVER = [(0.9, 10.0), (2.4, 10.5), (3.9, 10.4), (4.4, 9.9), (4.2, 9.2), (3.4, 8.6), (2.4, 8.15), (1.4, 8.0), (0.9, 8.5)]
PANCREAS = [(4.95, 6.95), (5.6, 7.12), (6.8, 7.05), (7.7, 6.95), (7.62, 6.68), (6.6, 6.6), (5.5, 6.62)]
COLON = [(1.6, 1.9), (1.6, 6.15), (8.4, 6.15), (8.4, 2.6), (7.6, 1.95), (5.5, 1.75)]
SLOT = {
    "oesophagus": ((LX, 11.2), (4.8, 11.2)),
    "liver": ((LX, 9.4), (2.0, 9.4)),
    "gall bladder": ((LX, 6.9), (3.62, 8.25)),
    "large intestine": ((LX, 4.0), (1.6, 4.0)),
    "small intestine": ((3.0, -0.2), (3.0, 3.0)),
    "stomach": ((RX, 9.4), (7.0, 9.0)),
    "pancreas": ((RX, 7.25), (7.0, 6.88)),
    "rectum": ((RX, 1.0), (5.45, 1.05)),
}


def _draw_canal(p: dict):
    fig, ax = new_figure(12.4, 6.8)
    # the small intestine: a coiled mass, the duodenum running down into it from the stomach behind the colon
    part(ax, spline([(2.4, 5.4), (5.0, 5.6), (7.6, 5.35), (7.7, 3.8), (7.4, 2.35), (5.0, 2.2), (2.6, 2.4), (2.3, 3.9)]),
         "small intestine", "#f4c7a1", z=1.4)
    for k in range(5):
        y0 = 2.75 + 0.6 * k
        xs = [2.7 + 0.1 * i for i in range(48)]
        ys = [y0 + 0.16 * math.sin(i * 0.9 + k) for i in range(48)]
        ax.plot(xs, ys, color="#a0623c", linewidth=0.9, zorder=1.45)
    part(ax, tube([(5.4, 7.75), (4.85, 7.1), (4.72, 6.2), (4.72, 5.3)], 0.42), "small intestine", "#f4c7a1", z=1.3)
    # the large intestine and the rectum, to the anus
    part(ax, tube(COLON, 0.62), "large intestine", "#d9a066", z=2.0)
    part(ax, tube([(5.45, 1.8), (5.45, 0.55)], 0.56), "rectum", "#c47f4e", z=2.1)
    ax.text(5.45, 0.38, "anus", ha="center", va="top", fontsize=9, style="italic")
    # the stomach, the pancreas under it, the oesophagus into it
    part(ax, spline(STOMACH), "stomach", "#f0a898", z=2.2)
    part(ax, spline(PANCREAS, per=8), "pancreas", "#e8d48a", z=2.3)
    part(ax, tube([(4.6, 12.0), (4.85, 10.6), (5.25, 9.75)], 0.46), "oesophagus", "#f2b8a8", z=2.25)
    ax.text(4.6, 12.15, "from the mouth", ha="center", va="bottom", fontsize=9, style="italic")
    # the liver over the stomach on the other side, the gall bladder under it, the bile duct to the duodenum
    part(ax, spline(LIVER), "liver", "#b86a58", z=2.4)
    ax.plot([3.95, 4.4, 4.66], [8.15, 7.55, 7.0], color="#4f7f3f", linewidth=1.6, zorder=2.35)
    ax.add_patch(Ellipse((3.62, 8.38), 0.72, 0.46, facecolor="#7fb069", edgecolor=INK, linewidth=1.1, zorder=2.6,
                         gid="part:gall bladder"))
    for L, name in p["labels"].items():
        at, end = SLOT[name]
        letter(ax, L, at, end, gap=0.45, dot=True)
    # the table of the lettered parts
    tx = 12.6
    ax.text(tx, 11.6, "Part", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(tx + 3.4, 11.6, "What it does", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.plot([tx, tx + 10.4], [11.15, 11.15], color=INK, linewidth=0.9)
    for i, name in enumerate(sorted(p["labels"].values())):
        y = 10.45 - 1.55 * i
        ax.text(tx, y, name.capitalize(), ha="left", va="center", fontsize=9.5)
        words = ROLE[name].split()
        cut = (len(words) + 1) // 2 if len(ROLE[name]) > 30 else len(words)
        body = " ".join(words[:cut]) + ("\n" + " ".join(words[cut:]) if cut < len(words) else "")
        ax.text(tx + 3.4, y, body, ha="left", va="center", fontsize=9.5, linespacing=1.15)
    ax.set_xlim(LX - 0.7, tx + 10.6)
    ax.set_ylim(-0.75, 12.75)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("The human digestive system, seen from the front (lettered parts named in the table)", fontsize=11)
    return fig


# --- drawing: the teeth -----------------------------------------------------------------------------

def _shape(kind: str) -> list[tuple[float, float]]:
    """A tooth's outline about its centre: incisor a flat blade, canine a point, premolar and molar squares."""
    if kind == "incisor":
        return [(-0.19, -0.08), (0.19, -0.08), (0.19, 0.08), (-0.19, 0.08)]
    if kind == "canine":
        return [(0, 0.27), (0.15, 0), (0, -0.27), (-0.15, 0)]
    h = 0.2 if kind == "premolar" else 0.27
    c = 0.06
    return [(-h + c, -h), (h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c)]


def _grooves(kind: str):
    if kind == "premolar":
        return [[(-0.13, 0), (0.13, 0)]]
    if kind == "molar":
        return [[(-0.18, 0), (0.18, 0)], [(0, -0.18), (0, 0.18)]]
    return []


def _tooth(ax, kind: str, cx: float, cy: float, gid: str) -> None:
    ax.add_patch(Polygon([(cx + u, cy + v) for u, v in _shape(kind)], closed=True, facecolor="white", edgecolor=INK,
                         linewidth=1.4, zorder=3, gid=gid))
    for g in _grooves(kind):
        ax.plot([cx + u for u, _ in g], [cy + v for _, v in g], color=INK, linewidth=1.0, zorder=4)


def _draw_teeth(p: dict):
    fig, ax = new_figure(9.6, 4.4)
    for row, (jaw, n) in enumerate((("upper", p["upper"]), ("lower", p["lower"]))):
        y = 3.0 - 1.6 * row
        ax.add_patch(Rectangle((1.9, y - 0.48), 6.65, 0.96, facecolor=FILL_2, edgecolor=INK, linewidth=1.0, zorder=1))
        ax.text(1.7, y, f"Half of the\n{jaw} jaw", ha="right", va="center", fontsize=10)
        x = 2.35
        for kind, k in zip(KINDS, n):
            for i in range(k):
                _tooth(ax, kind, x, y, f"tooth:{jaw}:{kind}:{i}")
                x += 0.58
    ax.annotate("", xy=(2.1, 4.15), xytext=(4.6, 4.15),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.2, shrinkA=0, shrinkB=0))
    ax.text(4.75, 4.15, "front of the mouth", ha="left", va="center", fontsize=9.5, style="italic")
    kx = 9.3
    ax.text(kx - 0.3, 4.15, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
    for j, kind in enumerate(KINDS):
        y = 3.45 - 0.8 * j
        _tooth(ax, kind, kx, y, f"key:{kind}")
        ax.text(kx + 0.45, y, kind, ha="left", va="center", fontsize=10.5)
    ax.text(0.0, -0.45, "Number of teeth in the whole mouth = 2 × (teeth in half the upper jaw + teeth in half the lower jaw)",
            ha="left", va="center", fontsize=9.5)
    ax.set_xlim(-0.1, 11.8)
    ax.set_ylim(-0.8, 4.5)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"The teeth of mammal {p['mammal']}", fontsize=12)
    return fig


def draw(p: dict):
    return _draw_teeth(p) if p["kind"] == "teeth" else _draw_canal(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "for a revision poster", "from a textbook in the school library in Musanze",
            "before a test on nutrition", "for homework", "at the science club in Rubavu", "for a class display in Nyagatare",
            "in a lesson on digestion"]
VERBS = ["labelled", "copied", "is revising from", "drew"]


def _q_canal(p: dict, rng: random.Random) -> list:
    at = {v: k for k, v in p["labels"].items()}
    a, b, c = rng.sample(sorted(at), 3)
    who = rng.choice(NAMES)
    rest = lambda keep: [k for k in sorted(p["labels"]) if k != keep]  # noqa: E731
    qs = [letter_choice(f"{who} {rng.choice(VERBS)} this diagram of the digestive system {rng.choice(SETTINGS)}. "
                        f"Using the table, which letter shows the part that {ROLE[a]}?", at[a],
                        [at[x] for x in CONFUSE[a] if x in at] + rest(at[a]))]
    qs.append(mcq(rng.choice(["What is the part labelled {L}?", "Which organ is labelled {L}?"]).format(L=at[c]), c,
                  CONFUSE[c], rng))
    qs.append(letter_choice(f"Which letter shows the part that {ROLE[b]}?", at[b],
                            [at[x] for x in CONFUSE[b] if x in at] + rest(at[b])))
    return qs


def _q_teeth(p: dict, rng: random.Random) -> list:
    up, low, m = p["upper"], p["lower"], p["mammal"]
    who = rng.choice(NAMES)
    total = 2 * (sum(up) + sum(low))
    qs = [count(f"{who} {rng.choice(['drew', 'studied', 'copied'])} these teeth of mammal {m} {rng.choice(SETTINGS)}. "
                f"How many teeth does mammal {m} have in its whole mouth?", total, "teeth")]
    kind = rng.choice([k for i, k in enumerate(KINDS) if up[i] + low[i] > 0])
    n = 2 * (up[KINDS.index(kind)] + low[KINDS.index(kind)])
    qs.append(count(f"How many {kind} teeth does mammal {m} have in its whole mouth?", n, f"{kind}s", "teeth"))
    jaw = rng.choice(["upper", "lower"])
    qs.append(count(f"How many teeth are there in one half of the {jaw} jaw of mammal {m}?", sum(up if jaw == "upper" else low),
                    "teeth"))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _q_teeth(p, rng) if p["kind"] == "teeth" else _q_canal(p, rng)
