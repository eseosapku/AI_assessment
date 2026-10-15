"""Drainage patterns (LS, UP): four small river maps, W to Z, each drawn in one pattern (four of dendritic, trellis,
radial, rectangular and centripetal, in a shuffled order), beside a short table that describes all five, and a key
(ridge of hard rock, high point, lake, direction of flow). The rivers are drawn afresh for every figure:

- dendritic: a main river with tributaries joining at acute angles, and smaller ones joining those, like a tree;
- trellis: a main river cutting across parallel ridges, with straight streams in the valleys between them joining it
  at right angles, and short tributaries joining those at right angles;
- radial: five to nine rivers flowing outwards from a high point, each with an arrow showing its flow;
- rectangular: a river and its tributaries all turning through right angles;
- centripetal: five to nine rivers flowing inwards into a central lake, each with an arrow.

Which pattern a lettered map shows; which map shows a described pattern (as "rivers flowing outwards from a central
high point"), never the map the first question named; and how many rivers flow out of the high point or into the
lake.
"""
from __future__ import annotations

import math
import random
import textwrap

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure
from ._bio_parts import letter_choice

ID = "drainage_pattern"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("drainage-systems", "river-system", "river-profile"))
# A topic whose sections the book lists is reached only if its name or a section names drainage or rivers.
NEEDS = r"drainage|hydrograph|\brivers?\b"
# Topics that share a river concept but teach floods, dams or water supply, not the shapes rivers make.
AVOID = r"flood|multipurpose|project|dam\b|water supply|pollution"

PATTERNS = ["dendritic", "trellis", "radial", "rectangular", "centripetal"]
TABLE = [("Dendritic", "Tributaries join the main river at acute angles, like the branches of a tree."),
         ("Trellis", "Short tributaries join longer streams at right angles; the streams run between parallel "
                     "ridges of hard rock."),
         ("Radial", "Rivers flow outwards in all directions from a central high point, such as a volcano."),
         ("Rectangular", "Rivers and their tributaries bend at right angles, following joints in the rock."),
         ("Centripetal", "Rivers flow inwards from all sides into a central lake or basin.")]
# What a question asks a map by (from the table, so the figure decides).
ASK = {"radial": "rivers flowing outwards from a central high point",
       "centripetal": "rivers flowing inwards to a central lake",
       "dendritic": "tributaries joining the main river like the branches of a tree",
       "trellis": "short tributaries joining at right angles between parallel ridges",
       "rectangular": "rivers that bend at right angles along joints in the rock"}
CONFUSE = {"dendritic": ["trellis", "rectangular", "radial"], "trellis": ["rectangular", "dendritic", "centripetal"],
           "radial": ["centripetal", "dendritic", "rectangular"], "rectangular": ["trellis", "dendritic", "radial"],
           "centripetal": ["radial", "dendritic", "trellis"]}
SIDE = 3.0
ORIGIN = {"W": (0.0, 3.6), "X": (3.6, 3.6), "Y": (0.0, 0.0), "Z": (3.6, 0.0)}
RIVER = "#2a6bb8"
RIDGE = "#c9c3b4"


def sample(rng: random.Random) -> dict:
    drawn = rng.sample(PATTERNS, 4)
    maps = dict(zip("WXYZ", drawn))
    counts, hubs = {}, {}
    for L, pat in maps.items():
        if pat in ("radial", "centripetal"):
            counts[L] = rng.randint(5, 9)
            ox, oy = ORIGIN[L]
            hubs[L] = [ox + SIDE / 2, oy + SIDE / 2]
    return {"band": rng.choice(BANDS), "maps": maps, "count": counts, "hub": hubs,
            "shape": {L: rng.randint(1, 10 ** 6) for L in maps}}


# --- the river networks, in a unit square --------------------------------------------------------------

def _orient(p, q, r):
    return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])


def _crossing(paths) -> bool:
    """Whether two different paths cross (a tributary ending on another river only touches it)."""
    segs = [(i, a, b) for i, pts in enumerate(paths) for a, b in zip(pts, pts[1:])]
    for k, (i, a, b) in enumerate(segs):
        for j, c, d in segs[k + 1:]:
            if i != j and _orient(a, b, c) * _orient(a, b, d) < -1e-12 and _orient(c, d, a) * _orient(c, d, b) < -1e-12:
                return True
    return False


def _inside(paths, lo=0.05, hi=0.95) -> bool:
    return all(lo <= x <= hi and lo <= y <= hi for pts in paths for x, y in pts)


def _ray(start, angle_deg, length):
    a = math.radians(angle_deg)
    return (start[0] + length * math.cos(a), start[1] + length * math.sin(a))


def _dendritic(rng):
    while True:
        x = rng.uniform(0.42, 0.58)
        main = [(x, 0.93)]
        for k in range(1, 9):
            x = min(0.62, max(0.38, x + rng.uniform(-0.05, 0.05)))
            main.append((x, 0.93 - 0.86 * k / 8))
        tribs = []
        for k, side in zip((2, 3, 5, 6), rng.choice([(-1, 1, -1, 1), (1, -1, 1, -1)])):
            j = main[k]
            ang = 90 + side * rng.uniform(38, 55)  # up and out from the junction
            src = _ray(j, ang, rng.uniform(0.26, 0.36))
            mid = ((src[0] + j[0]) / 2, (src[1] + j[1]) / 2)
            tribs.append([src, mid, j])
            sub_ang = ang + side * rng.uniform(28, 45) * (1 if rng.random() < 0.6 else -1)
            tribs.append([_ray(mid, sub_ang, rng.uniform(0.11, 0.16)), mid])
        if rng.random() < 0.7:  # a tributary at the very top, so the head of the river forks too
            j = main[1]
            tribs.append([_ray(j, 90 + rng.choice([-1, 1]) * rng.uniform(30, 45), rng.uniform(0.14, 0.2)), j])
        paths = [main] + tribs
        if _inside(paths) and not _crossing(paths):
            return main, tribs, None


def _trellis(rng):
    while True:
        x = rng.uniform(0.45, 0.55)
        main = [(x, 0.94), (x, 0.06)]
        valleys = [0.22, 0.5, 0.78]
        streams, tribs = [], []
        for v in valleys:
            for side in (-1, 1):
                if rng.random() < 0.85:
                    length = rng.uniform(0.3, 0.4)
                    s = [(x + side * length, v), (x, v)]
                    streams.append(s)
                    for _ in range(rng.randint(1, 2)):
                        tx = x + side * rng.uniform(0.08, length - 0.05)
                        up = rng.choice([-1, 1])
                        tribs.append([(tx, v + up * rng.uniform(0.06, 0.08)), (tx, v)])
        ridges = [0.08, 0.36, 0.64, 0.92]
        paths = [main] + streams + tribs
        if len(streams) >= 4 and _inside(paths) and not _crossing(paths):
            return main, streams + tribs, {"ridges": ridges, "x": x}


def _rectangular(rng):
    while True:
        pt = (rng.uniform(0.08, 0.16), rng.uniform(0.84, 0.92))
        main, horizontal = [pt], rng.random() < 0.5
        while True:
            step = rng.uniform(0.17, 0.27)
            nxt = (pt[0] + step, pt[1]) if horizontal else (pt[0], pt[1] - step)
            if nxt[0] > 0.92 and nxt[1] < 0.08:
                break
            if nxt[0] > 0.92 or nxt[1] < 0.08:  # one edge reached: keep turning the other way until the other is
                horizontal = not horizontal
                nxt = (pt[0] + step, pt[1]) if horizontal else (pt[0], pt[1] - step)
                if nxt[0] > 0.92 or nxt[1] < 0.08:
                    break
            main.append(nxt)
            pt, horizontal = nxt, not horizontal
        if len(main) < 6:
            continue
        tribs = []
        for a, b in zip(main[:-1], main[1:]):
            if rng.random() < 0.85:
                j = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                d, e = rng.choice([-1, 1]), rng.choice([-1, 1])
                if a[1] == b[1]:  # a stretch flowing east: a tributary from the north or south, turning once
                    p1 = (j[0], j[1] + d * rng.uniform(0.1, 0.16))
                    p0 = (p1[0] + e * rng.uniform(0.08, 0.13), p1[1])
                else:  # a stretch flowing south: a tributary from the east or west
                    p1 = (j[0] + d * rng.uniform(0.1, 0.16), j[1])
                    p0 = (p1[0], p1[1] + e * rng.uniform(0.08, 0.13))
                tribs.append([p0, p1, j])
        paths = [main] + tribs
        if len(tribs) >= 3 and _inside(paths) and not _crossing(paths):
            return main, tribs, None


def _spokes(rng, n, inward):
    base = rng.uniform(0, 360)
    rivers = []
    for k in range(n):
        a = math.radians(base + 360 * k / n + rng.uniform(-7, 7))
        bend = rng.uniform(-0.25, 0.25)
        pts = []
        for i in range(9):
            r = 0.13 + 0.31 * i / 8
            t = a + bend * (i / 8) ** 2
            pts.append((0.5 + r * math.cos(t), 0.5 + r * math.sin(t)))
        rivers.append(pts[::-1] if inward else pts)
    return rivers


# --- drawing ----------------------------------------------------------------------------------------

def _to(L, pts):
    ox, oy = ORIGIN[L]
    return [(ox + SIDE * u, oy + SIDE * v) for u, v in pts]


def _flow(ax, gid, tail, head):
    ax.annotate("", xy=head, xytext=tail, gid=gid, zorder=5,
                arrowprops=dict(arrowstyle="-|>,head_length=0.5,head_width=0.25", color=RIVER, lw=1.4,
                                shrinkA=0, shrinkB=0))


def _draw_map(ax, L, pat, p):
    ox, oy = ORIGIN[L]
    ax.add_patch(Rectangle((ox, oy), SIDE, SIDE, facecolor="#f7f9f1", edgecolor=INK, linewidth=1.1, zorder=0.5,
                           gid=f"map:{L}"))
    ax.text(ox + SIDE / 2, oy + SIDE + 0.12, f"Map {L}", ha="center", va="bottom", fontsize=11, fontweight="bold")
    rng = random.Random(p["shape"][L])
    if pat in ("radial", "centripetal"):
        rivers = _spokes(rng, p["count"][L], pat == "centripetal")
        hub = (ox + SIDE / 2, oy + SIDE / 2)
        if pat == "radial":
            s = 0.13
            ax.add_patch(Polygon([(hub[0] - s, hub[1] - s * 0.8), (hub[0] + s, hub[1] - s * 0.8), (hub[0], hub[1] + s)],
                                 closed=True, facecolor=INK, edgecolor=INK, zorder=3, gid="high-point"))
        else:
            ang = [2 * math.pi * k / 40 for k in range(40)]
            ax.add_patch(Polygon([(hub[0] + 0.4 * math.cos(a), hub[1] + 0.38 * math.sin(a)) for a in ang], closed=True,
                                 facecolor="#9cc8ee", edgecolor=RIVER, linewidth=1.0, zorder=2, gid="lake"))
        for k, r in enumerate(rivers):
            pts = _to(L, r)
            ax.plot(*zip(*pts), color=RIVER, linewidth=1.6, zorder=3, gid=f"river:{L}:main{k}", solid_capstyle="round")
            _flow(ax, f"flow:{L}:{k}", pts[-3], pts[-1])  # at the outer end of a radial river, the lake end of a centripetal one
        return
    if pat == "dendritic":
        main, tribs, extra = _dendritic(rng)
    elif pat == "trellis":
        main, tribs, extra = _trellis(rng)
        gap = 0.06
        for v in extra["ridges"]:
            for x0, x1 in ((0.03, extra["x"] - gap), (extra["x"] + gap, 0.97)):
                ax.add_patch(Polygon(_to(L, [(x0, v - 0.045), (x1, v - 0.045), (x1, v + 0.045), (x0, v + 0.045)]),
                                     closed=True, facecolor=RIDGE, edgecolor="none", zorder=1, gid="ridge"))
    else:
        main, tribs, extra = _rectangular(rng)
    for k, t in enumerate(tribs):
        ax.plot(*zip(*_to(L, t)), color=RIVER, linewidth=1.1, zorder=3, gid=f"river:{L}:trib{k}")
    pts = _to(L, main)
    ax.plot(*zip(*pts), color=RIVER, linewidth=2.0, zorder=3, gid=f"river:{L}:trunk")
    a, b = pts[-2], pts[-1]
    tail = (b[0] - (b[0] - a[0]) * min(1.0, 0.35 / max(1e-9, math.dist(a, b))),
            b[1] - (b[1] - a[1]) * min(1.0, 0.35 / max(1e-9, math.dist(a, b))))
    _flow(ax, f"outlet:{L}", tail, b)


def _draw_table(ax):
    x0, x1, xm = 7.3, 14.75, 9.45
    top, row = 6.6, 1.2
    ax.text(x0 + 0.1, top + 0.12, "Drainage patterns", ha="left", va="bottom", fontsize=10.5, fontweight="bold")
    ax.plot([x0, x1, x1, x0, x0], [top, top, top - 5 * row, top - 5 * row, top], color=INK, linewidth=1.0, gid="table")
    ax.plot([xm, xm], [top, top - 5 * row], color=INK, linewidth=0.8, gid="table")
    for k, (name, words) in enumerate(TABLE):
        y = top - (k + 0.5) * row
        if k:
            ax.plot([x0, x1], [top - k * row, top - k * row], color=INK, linewidth=0.8, gid="table")
        ax.text(x0 + 0.15, y, name, ha="left", va="center", fontsize=10, fontweight="bold")
        ax.text(xm + 0.15, y, "\n".join(textwrap.wrap(words, 39)), ha="left", va="center", fontsize=9.2,
                linespacing=1.2)


def _draw_key(ax):
    y = -0.75
    ax.text(-0.05, y, "Key:", ha="left", va="center", fontsize=9.5, fontweight="bold")
    ax.add_patch(Rectangle((0.85, y - 0.1), 0.45, 0.2, facecolor=RIDGE, edgecolor="none", zorder=1))
    ax.text(1.4, y, "ridge of hard rock", ha="left", va="center", fontsize=9)
    s = 0.1
    ax.add_patch(Polygon([(4.25 - s, y - s * 0.8), (4.25 + s, y - s * 0.8), (4.25, y + s)], closed=True, facecolor=INK,
                         edgecolor=INK, zorder=1))
    ax.text(4.5, y, "high point", ha="left", va="center", fontsize=9)
    ax.add_patch(Rectangle((6.35, y - 0.1), 0.4, 0.2, facecolor="#9cc8ee", edgecolor=RIVER, linewidth=1.0, zorder=1))
    ax.text(6.9, y, "lake", ha="left", va="center", fontsize=9)
    _flow(ax, "key-flow", (8.0, y), (8.5, y))
    ax.text(8.65, y, "direction of flow", ha="left", va="center", fontsize=9)


def draw(p: dict):
    fig, ax = new_figure(10.2, 6.6)
    for L, pat in p["maps"].items():
        _draw_map(ax, L, pat, p)
    _draw_table(ax)
    _draw_key(ax)
    ax.set_xlim(-0.2, 14.9)
    ax.set_ylim(-1.15, 7.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} copied these four river maps from an atlas {setting}.", "{name} drew four drainage patterns {setting}.",
          "{name} is comparing these four river maps {setting}.", "{name} sketched the rivers of four regions {setting}."]
SETTINGS = ["for a geography lesson", "for homework", "for a revision poster", "at the geography club in Huye",
            "after a lesson on Rwanda's rivers", "for a class display in Musanze", "while revising in Kigali",
            "after a lesson on the rivers of Africa"]


def questions(p: dict, rng: random.Random) -> list:
    maps = p["maps"]
    at = {v: k for k, v in maps.items()}
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(SETTINGS))
    L = rng.choice(sorted(maps))
    qs = [mcq(f"{intro} Which drainage pattern does map {L} show?", maps[L], CONFUSE[maps[L]], rng)]
    pat = rng.choice(sorted(x for x in maps.values() if x != maps[L]))
    qs.append(letter_choice(f"Which map shows {ASK[pat]}?", at[pat], [k for k in sorted(maps) if k != at[pat]]))
    hubs = sorted(p["count"])
    H = rng.choice(hubs)
    how = "outwards from the high point" if maps[H] == "radial" else "into the lake"
    qs.append(count(f"How many rivers flow {how} in map {H}?", p["count"][H], "rivers"))
    return qs
