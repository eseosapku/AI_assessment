"""Network topologies (LS, UP): four networks lettered A to D, a star, a bus, a ring and a full mesh in a random
order. The star's devices are lettered, its central switch among them. Which network is a given topology, how
many cables join the devices of the mesh, and which device of the star stops every other device if it fails.

Every key is the drawing counted: a full mesh of n devices has n(n - 1)/2 cables.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import FancyBboxPatch

from ..core import INK, NAMES, mcq, new_figure, short

ID = "network_topology"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("network-topologies", "computer-network-characteristics", "lan-hardware"))
AVOID = r"spreadsheet|database|graphic|presentation|python|html|logic gate|boolean|algorithm"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"network|topolog|lan\b|wan\b|star|bus|ring|mesh|switch|hub|connect"
TOPOLOGIES = ["star", "bus", "ring", "mesh"]
FILL = "#eef1f3"
LETTERS = "PQRSTUVW"


def sample(rng: random.Random) -> dict:
    order = rng.sample(TOPOLOGIES, 4)
    sizes = {"star": rng.randint(4, 6), "bus": rng.randint(4, 6), "ring": rng.randint(5, 6), "mesh": rng.randint(4, 5)}
    names = rng.sample(LETTERS, sizes["star"] + 1)
    return {"band": rng.choice(BANDS), "order": order, "sizes": sizes, "star_labels": names, "hub": names[0],
            "ask": rng.choice(TOPOLOGIES)}


def _device(ax, x, y, label="", big=False):
    w, h = (0.75, 0.5) if big else (0.5, 0.38)
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.03", facecolor="#d9dee3" if big else FILL,
                                edgecolor=INK, linewidth=1.2, zorder=3))
    if label:
        ax.text(x, y, label, ha="center", va="center", fontsize=10, fontweight="bold", zorder=4)


def _cable(ax, a, b):
    ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=1.3, zorder=2)


def _panel(ax, topo: str, cx: float, cy: float, p: dict):
    n = p["sizes"][topo]
    if topo == "star":
        labels = p["star_labels"]
        pts = [(cx + 1.25 * math.cos(math.pi / 2 + 2 * math.pi * k / n), cy + 1.05 * math.sin(math.pi / 2 + 2 * math.pi * k / n))
               for k in range(n)]
        for (x, y), lab in zip(pts, labels[1:]):
            _cable(ax, (cx, cy), (x, y))
            _device(ax, x, y, lab)
        _device(ax, cx, cy, labels[0], big=True)
    elif topo == "bus":
        y0 = cy
        x0, x1 = cx - 1.6, cx + 1.6
        ax.plot([x0, x1], [y0, y0], color=INK, linewidth=2.2, zorder=2)
        for x in (x0, x1):  # terminators
            ax.plot([x, x], [y0 - 0.15, y0 + 0.15], color=INK, linewidth=3.0, zorder=2)
        for k in range(n):
            x = x0 + 0.35 + (x1 - x0 - 0.7) * k / (n - 1)
            y = y0 + (0.75 if k % 2 == 0 else -0.75)
            _cable(ax, (x, y0), (x, y))
            _device(ax, x, y)
    else:
        pts = [(cx + 1.2 * math.cos(math.pi / 2 + 2 * math.pi * k / n), cy + 1.0 * math.sin(math.pi / 2 + 2 * math.pi * k / n))
               for k in range(n)]
        if topo == "ring":
            for k in range(n):
                _cable(ax, pts[k], pts[(k + 1) % n])
        else:
            for i in range(n):
                for j in range(i + 1, n):
                    _cable(ax, pts[i], pts[j])
        for x, y in pts:
            _device(ax, x, y)


def draw(p: dict):
    fig, ax = new_figure(7.6, 6.4)
    centres = [(2.2, 6.6), (7.0, 6.6), (2.2, 2.4), (7.0, 2.4)]
    for (cx, cy), topo, letter in zip(centres, p["order"], "ABCD"):
        _panel(ax, topo, cx, cy, p)
        ax.text(cx, cy - 1.75, letter, ha="center", va="center", fontsize=14, fontweight="bold")
    ax.plot([4.6, 4.6], [0.4, 8.4], color="#bbbbbb", linewidth=0.8)
    ax.plot([0.2, 9.0], [4.4, 4.4], color="#bbbbbb", linewidth=0.8)
    ax.set_xlim(0.2, 9.0)
    ax.set_ylim(0.4, 8.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    letter = {t: "ABCD"[i] for i, t in enumerate(p["order"])}
    topo = p["ask"]
    n = p["sizes"]["mesh"]
    cables = n * (n - 1) // 2
    hub = p["hub"]
    return [mcq(f"{who} drew four networks {rng.choice(SETTINGS)}. Which network is a {topo} topology?", letter[topo],
                [x for x in "ABCD" if x != letter[topo]], rng),
            short(f"How many cables join the devices in network {letter['mesh']}?", cables, [str(cables), f"{cables} cables"]),
            short(f"In network {letter['star']}, {friend} asks: which device stops every other device communicating if it fails?",
                  hub, [hub, f"device {hub}"])]
