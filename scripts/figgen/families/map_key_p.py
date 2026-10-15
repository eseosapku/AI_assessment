"""A map with a key of symbols (P, Primary Social Studies): a map of a cell with a river winding across it, a road
crossing the river, and 8 to 14 symbols from a fixed table (a school, a hospital cross, a market stall, a church, a
water tap, and a tree that stands for a forest). The key beside the map gives every symbol, the road and the river.

- How many of one symbol are on the map (upper: how many more of one than of another, or how many of two altogether)?
  Counted from the symbols placed; the key decides what each one is.
- What is at the place marked with a letter? A letter in a circle, with an arrow whose tip lands on the centre of the
  symbol, so the key names what is there (P3x review: an arrow that stopped short pointed at empty ground). The wrong
  options are the symbols that look most like it (a church and a hospital both have a cross; a school and a church are
  both houses).
- Which place is next to the river (or the road)? One symbol touches it, its centre no more than half a symbol and a
  little from the line's middle, and every other symbol stands at least three times as far away (P3x review: no option
  had touched the line, and several had stood at like distances).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, mcq, new_figure
from ._map_icons import ROAD, WATER, symbol

ID = "map_key_p"
KIND = "geo.map"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("map-elements-importance", "sector-location", "social-services"))
# A topic whose sections the book lists is reached only if its name or a section names maps or the places in a sector.
NEEDS = r"\bmaps?\b|our sector|our country|important places"
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights and responsibilities|historical events")

W, H = 10.0, 7.0
KINDS = ["school", "hospital", "market", "church", "water tap", "forest"]
PLURAL = {"school": "schools", "hospital": "hospitals", "market": "markets", "church": "churches",
          "water tap": "water taps", "forest": "forests"}
# The symbols a child mixes up with each one, most alike first.
LOOKALIKE = {"school": ["church", "market", "hospital"], "church": ["hospital", "school", "market"],
             "hospital": ["church", "school", "water tap"], "market": ["school", "church", "water tap"],
             "water tap": ["hospital", "market", "forest"], "forest": ["water tap", "market", "school"]}
AREAS = ["Rugarama", "Kigarama", "Gatare", "Mubuga", "Nyarutovu", "Karama", "Kabuye", "Rubona", "Ruhanga", "Rwaza"]
# How far the symbol beside a line stands from the line's middle (its edge then meets the line's edge), at most ADJOIN,
# and how far every other symbol stays from both lines: three times ADJOIN.
NEAR, ADJOIN = 0.45, 0.5
FAR = 3 * ADJOIN


def stages(p: dict) -> tuple[int, int] | None:
    return (3, 6) if p["level"] == "upper" else None


def _seg_dist(p, a, b) -> float:
    (px, py), (ax, ay), (bx, by) = p, a, b
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - ax - t * vx, py - ay - t * vy)


def dist(p, line) -> float:
    return min(_seg_dist(p, a, b) for a, b in zip(line, line[1:]))


def _lines(rng: random.Random) -> tuple[list, list]:
    """A river winding across the map one way, and a road crossing it the other way with one bend."""
    amp, wave, phase = rng.choice([0.3, 0.4, 0.5]), rng.choice([4.0, 5.0, 6.0]), rng.choice([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])
    if rng.random() < 0.5:  # the river runs across, the road up the map
        y0 = rng.choice([2.6, 3.0, 3.5, 4.0, 4.4])
        river = [[round(W * i / 40, 3), round(y0 + amp * math.sin(2 * math.pi * (W * i / 40) / wave + phase), 3)]
                 for i in range(41)]
        xa = rng.choice([1.5, 2.5, 3.5, 6.5, 7.5, 8.5])
        xb = min(8.5, max(1.5, xa + rng.choice([-2.0, -1.0, 1.0, 2.0])))
        ym = rng.choice([1.5, 2.0, 5.0, 5.5])
        road = [[xa, 0.0], [xa, ym - 0.4], [xb, ym + 0.4], [xb, H]]
    else:  # the river runs down the map, the road across
        x0 = rng.choice([3.0, 3.6, 4.2, 5.8, 6.4, 7.0])
        river = [[round(x0 + amp * math.sin(2 * math.pi * (H * i / 28) / wave + phase), 3), round(H * i / 28, 3)]
                 for i in range(29)]
        ya = rng.choice([1.2, 2.0, 5.0, 5.8])
        yb = min(5.8, max(1.2, ya + rng.choice([-1.5, -0.8, 0.8, 1.5])))
        xm = rng.choice([2.0, 2.5, 7.5, 8.0])
        road = [[0.0, ya], [xm - 0.4, ya], [xm + 0.4, yb], [W, yb]]
    return river, road


def _place_beside(rng, line, other, taken) -> list | None:
    """A point NEAR from `line`, on one side of it, well away from the other line and inside the map."""
    for _ in range(60):
        i = rng.randrange(1, len(line) - 1)
        (ax, ay), (bx, by) = line[i - 1], line[i + 1]
        t = rng.random()
        px, py = line[i - 1][0] + t * (bx - ax), line[i - 1][1] + t * (by - ay)
        n = math.hypot(bx - ax, by - ay)
        side = rng.choice([-1, 1])
        x, y = round(px - side * (by - ay) / n * NEAR, 2), round(py + side * (bx - ax) / n * NEAR, 2)
        if not (0.5 <= x <= W - 0.5 and 0.5 <= y <= H - 0.5):
            continue
        if 0.4 <= dist((x, y), line) <= ADJOIN and dist((x, y), other) >= FAR and \
                all(math.hypot(x - u, y - v) >= 1.15 for u, v in taken):
            return [x, y]
    return None


def _try(rng: random.Random, level: str) -> dict | None:
    river, road = _lines(rng)
    if level == "lower":
        tally = {"forest": rng.randint(2, 3), "school": rng.randint(1, 2), "water tap": rng.randint(2, 3),
                 "church": 1, "hospital": 1, "market": 1}
    else:
        tally = {"forest": rng.randint(2, 4), "school": rng.randint(1, 3), "water tap": rng.randint(2, 4),
                 "church": rng.randint(1, 2), "hospital": rng.randint(1, 2), "market": rng.randint(1, 2)}
    which = rng.choice(["river", "road"])
    line, other = (river, road) if which == "river" else (road, river)
    near_kind = rng.choice([k for k in KINDS if k != "forest"])
    spot = _place_beside(rng, line, other, [])
    if not spot:
        return None
    symbols = [[near_kind, spot[0], spot[1]]]
    bag = [k for k in KINDS for _ in range(tally[k] - (k == near_kind))]
    rng.shuffle(bag)
    for kind in bag:
        for _ in range(200):
            x, y = round(rng.uniform(0.5, W - 0.5), 2), round(rng.uniform(0.5, H - 0.5), 2)
            if dist((x, y), river) >= FAR and dist((x, y), road) >= FAR and \
                    all(math.hypot(x - u, y - v) >= 1.15 for _, u, v in symbols):
                symbols.append([kind, x, y])
                break
        else:
            return None
    rng.shuffle(symbols)
    near = next(i for i, s in enumerate(symbols) if (s[1], s[2]) == (spot[0], spot[1]))
    # the symbol marked with a letter: of another kind than the one by the line, with room for its letter
    marks = []
    for i, (kind, x, y) in enumerate(symbols):
        if kind == near_kind:
            continue
        for ang in range(0, 360, 45):
            lx, ly = x + 0.75 * math.cos(math.radians(ang)), y + 0.75 * math.sin(math.radians(ang))
            if 0.35 <= lx <= W - 0.35 and 0.35 <= ly <= H - 0.35 and dist((lx, ly), river) >= 0.4 and \
                    dist((lx, ly), road) >= 0.4 and \
                    all(math.hypot(lx - u, ly - v) >= 1.15 for j, (_, u, v) in enumerate(symbols) if j != i):
                marks.append((i, [round(lx, 3), round(ly, 3)]))
                break
    if not marks:
        return None
    marked, mark_at = rng.choice(marks)
    if level == "lower":
        ask = ["one", rng.choice([k for k in KINDS if tally[k] >= 2])]
    else:
        pairs = [(a, b) for a in KINDS for b in KINDS if a != b and tally[a] > tally[b]]
        if rng.random() < 0.5 and pairs:
            ask = ["more", *rng.choice(pairs)]
        else:
            ask = ["both", *rng.sample(KINDS, 2)]
    return {"band": "P", "level": level, "area": rng.choice(AREAS), "width": W, "height": H, "river": river,
            "road": road, "symbols": symbols, "marked": marked, "mark_at": mark_at, "letter": rng.choice("ABPQRXYZ"),
            "near": [which, near], "count": ask}


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        p = _try(rng, level)
        if p:
            return p


# --- drawing ----------------------------------------------------------------------------------------

def _road(ax, xs, ys, gid=None) -> None:
    ax.plot(xs, ys, color="#6d6d6d", linewidth=10, solid_capstyle="butt", solid_joinstyle="miter", zorder=1.5)
    ax.plot(xs, ys, color=ROAD, linewidth=7, solid_capstyle="butt", solid_joinstyle="miter", zorder=1.6, gid=gid)


def draw(p: dict):
    w, h = p["width"], p["height"]
    fig, ax = new_figure(10.5, 5.8)
    ax.add_patch(Rectangle((0, 0), w, h, facecolor="#eef5e4", edgecolor="none", zorder=0))
    ax.plot([q[0] for q in p["river"]], [q[1] for q in p["river"]], color=WATER, linewidth=5, solid_capstyle="butt",
            zorder=1, gid="river")
    _road(ax, [q[0] for q in p["road"]], [q[1] for q in p["road"]])
    ax.add_patch(Rectangle((0, 0), w, h, facecolor="none", edgecolor=INK, linewidth=1.4, zorder=5))
    for i, (kind, x, y) in enumerate(p["symbols"]):
        symbol(ax, kind, x, y, s=1.1, gid=f"sym:{i}:{kind}", z=3)
    kind, x, y = p["symbols"][p["marked"]]
    lx, ly = p["mark_at"]
    ax.annotate(p["letter"], xy=(x, y), xytext=(lx, ly), ha="center", va="center",  # the tip on the symbol's centre
                fontsize=12, fontweight="bold", gid="mark", zorder=7,
                bbox=dict(boxstyle="circle,pad=0.15", facecolor="white", edgecolor=INK, linewidth=1.2),
                arrowprops=dict(arrowstyle="-|>", color=INK, linewidth=1.2, shrinkA=0, shrinkB=0))
    ax.text(w / 2, h + 0.4, f"Map of {p['area']} Cell", ha="center", va="center", fontsize=13, fontweight="bold")
    # the key
    kx = w + 0.45
    ax.add_patch(Rectangle((kx, 0), 3.3, h, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=0))
    ax.text(kx + 1.65, h - 0.4, "Key", ha="center", va="center", fontsize=12, fontweight="bold")
    for k, kind in enumerate(KINDS + ["road", "river"]):
        y = h - 1.1 - k * 0.76
        if kind == "road":
            _road(ax, [kx + 0.3, kx + 1.0], [y, y])
        elif kind == "river":
            xs = [kx + 0.3 + 0.7 * i / 20 for i in range(21)]
            ax.plot(xs, [y + 0.08 * math.sin(2 * math.pi * (v - xs[0]) / 0.35) for v in xs], color=WATER, linewidth=4,
                    zorder=1)
        else:
            symbol(ax, kind, kx + 0.65, y, s=0.85, gid=f"keysym:{kind}", z=3)
        ax.text(kx + 1.3, y, kind, ha="left", va="center", fontsize=11, gid=f"key:{kind}")
    ax.set_xlim(-0.1, kx + 3.4)
    ax.set_ylim(-0.1, h + 0.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a Social Studies lesson", "for homework", "before a class walk", "in the school library",
            "at home in Huye", "for a class test", "on a visit to the cell office", "in a lesson in Musanze"]
VERBS = ["looks at", "studies", "reads", "is using"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    syms = p["symbols"]
    tally = {k: sum(1 for s in syms if s[0] == k) for k in KINDS}
    lead = f"{who} {rng.choice(VERBS)} this map of {p['area']} Cell {rng.choice(SETTINGS)}."
    ask = p["count"]
    if ask[0] == "one":
        q1 = count(f"{lead} How many {PLURAL[ask[1]]} are on the map?", tally[ask[1]], PLURAL[ask[1]])
    elif ask[0] == "more":
        a, b = ask[1], ask[2]
        q1 = count(f"{lead} How many more {PLURAL[a]} than {PLURAL[b]} are on the map?", tally[a] - tally[b], PLURAL[a])
    else:
        a, b = ask[1], ask[2]
        q1 = count(f"{lead} How many {PLURAL[a]} and {PLURAL[b]} are on the map altogether?", tally[a] + tally[b])
    kind = syms[p["marked"]][0]
    q2 = mcq(f"What is at the place marked {p['letter']}? Use the key.",
             f"a {kind}", [f"a {k}" for k in LOOKALIKE[kind]], rng)
    which, i = p["near"]
    line = p["river"] if which == "river" else p["road"]
    key = syms[i][0]
    # the other kinds on the map, the nearest to the line first: the near miss
    closest = {k: min(dist((x, y), line) for kk, x, y in syms if kk == k) for k in KINDS if k != key and tally[k]}
    q3 = mcq(f"Which place in {p['area']} Cell is next to the {which}?", f"a {key}",
             [f"a {k}" for k in sorted(closest, key=closest.get)], rng)
    return [q1, q2, q3]

