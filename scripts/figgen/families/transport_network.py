"""Transport (LS, UP; P6 geography): an invented road network and a comparison of transport modes, as the Rwanda S3
"Transport, Communication and Trade in Africa", S4 "Transport, Communication and Trade in Rwanda" and S6 "Transport and
Communication in the World" units teach transport with maps and data.

Two sub-types:
- network: a sketch map (not to scale, as it says) of five towns lettered A to E joined by roads, each road's length
  printed beside it. The shortest road distance between two towns (one route clearly shortest), how many towns a town
  is joined to directly, and, at Upper Secondary, the beta index of connectivity (roads ÷ towns, printed); at Lower
  Secondary, the length of all the roads together.
- modes: a table of four ways of sending goods from Town P to Port Q (road, railway, lake and road, air), each with
  its route length, its cost per tonne for each kilometre and the days it takes, with cost = cost per tonne-km × tonnes
  × km printed. The cost of sending a load by one mode, the cheapest mode for the load, and the cheapest mode that
  arrives within a stated number of days (never the cheapest overall).

The towns, the port and every number are invented.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, count, mcq, money, short
from ._geo_charts import num_forms
from .econ_tables import frw, titled_table

ID = "transport_network"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
MORE = {"network": ("geography.transport-distribution",),
        "modes": ("geography.transport-distribution", "geography.transport-definition")}
CONCEPTS = ("geography.transport-distribution", "geography.transport-definition")
# A topic whose sections the book lists is reached only if its name or a section names transport.
NEEDS = r"transport"
TOWNS = ["A", "B", "C", "D", "E"]
R = 0.32  # a town's circle
# cost per tonne-km (Frw, low and high) and days (fewest and most) for each mode
MODES = {"Road": (50, 80, 2, 3), "Railway": (25, 45, 2, 5), "Lake and road": (25, 45, 4, 8), "Air": (500, 900, 1, 1)}


def concepts_for(p: dict) -> tuple[str, ...]:
    return MORE[p["sub"]]


def _orient(p, q, r):
    return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])


def _cross(a, b, c, d) -> bool:
    if len({tuple(a), tuple(b), tuple(c), tuple(d)}) < 4:
        return False  # roads meeting at a town only touch
    return _orient(a, b, c) * _orient(a, b, d) < 0 and _orient(c, d, a) * _orient(c, d, b) < 0


def _seg_dist(pt, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy)


HALF = (0.4, 0.17)  # half the width and height of a printed road length, in map units


def label_at(pos: dict, edge) -> tuple[float, float]:
    """Where a road's length is printed: beside the middle of the road, to its left as drawn from the first town, far
    enough out that the whole label clears the road by 0.15 whatever way the road runs."""
    a, b = pos[edge[0]], pos[edge[1]]
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    ln = math.dist(a, b)
    nx, ny = -(b[1] - a[1]) / ln, (b[0] - a[0]) / ln
    d = HALF[0] * abs(nx) + HALF[1] * abs(ny) + 0.15
    return mx + nx * d, my + ny * d


def _paths(adj, a, b, seen=()):
    if a == b:
        yield [a]
        return
    for n in adj[a]:
        if n not in seen and n != a:
            for rest in _paths(adj, n, b, seen + (a,)):
                yield [a] + rest


def _network(rng: random.Random, band: str) -> dict | None:
    cells = rng.sample([(c, r) for c in range(3) for r in range(2)], 5)
    pos = {t: [round(1.2 + 3.4 * c + rng.uniform(-0.6, 0.6), 2), round(1.1 + 4.3 * r + rng.uniform(-0.5, 0.5), 2)]
           for t, (c, r) in zip(TOWNS, cells)}
    pairs = sorted(((a, b) for i, a in enumerate(TOWNS) for b in TOWNS[i + 1:]), key=lambda e: math.dist(pos[e[0]], pos[e[1]]))
    # a spanning tree from the shortest roads, then one to three more that cross none
    group = {t: t for t in TOWNS}

    def find(t):
        while group[t] != t:
            t = group[t]
        return t
    edges = []
    for a, b in pairs:
        if find(a) != find(b):
            group[find(a)] = find(b)
            edges.append([a, b])
    extra = [e for e in pairs if list(e) not in edges]
    rng.shuffle(extra)
    for a, b in extra[:rng.randint(1, 3)]:
        if not any(_cross(pos[a], pos[b], pos[c], pos[d]) for c, d in edges):
            edges.append([a, b])
    # no road passes close by a town it does not join, and every printed length stands clear of the other roads
    for c, d in edges:
        for t in TOWNS:
            if t not in (c, d) and _seg_dist(pos[t], pos[c], pos[d]) < 0.8:
                return None
    labels = {f"{a}{b}": label_at(pos, (a, b)) for a, b in edges}
    for k, pt in labels.items():
        if any(_seg_dist(pt, pos[c], pos[d]) < 0.62 for c, d in edges if f"{c}{d}" != k):
            return None
        if any(math.dist(pt, pos[t]) < 0.75 for t in TOWNS):
            return None
        if any(math.dist(pt, q) < 1.0 for j, q in labels.items() if j != k):
            return None
        if not (0.3 < pt[0] < 10.7 and 0.2 < pt[1] < 6.6):
            return None
    km = {f"{a}{b}": 5 * max(4, round(math.dist(pos[a], pos[b]) * 3.2 + rng.uniform(-1.5, 1.5))) for a, b in edges}
    adj = {t: [] for t in TOWNS}
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    length = lambda path: sum(km.get(f"{x}{y}", km.get(f"{y}{x}", 0)) for x, y in zip(path, path[1:]))  # noqa: E731
    pairs_ok = []
    for i, a in enumerate(TOWNS):
        for b in TOWNS[i + 1:]:
            if b in adj[a]:
                continue
            ds = sorted(length(pth) for pth in _paths(adj, a, b))
            if len(ds) >= 2 and ds[1] - ds[0] >= 10:
                pairs_ok.append([a, b])
    if not pairs_ok:
        return None
    return {"band": band, "sub": "network", "pos": pos, "edges": edges, "km": km,
            "ask": {"route": rng.choice(pairs_ok), "links": rng.choice(TOWNS)}}


def _modes(rng: random.Random, band: str) -> dict | None:
    base = 50 * rng.randint(16, 30)
    rows = {}
    for mode, (lo, hi, dlo, dhi) in MODES.items():
        km = base + 50 * {"Road": 0, "Railway": rng.randint(1, 4), "Lake and road": rng.randint(3, 12),
                          "Air": -rng.randint(2, 5)}[mode]
        rows[mode] = {"km": km, "rate": 5 * rng.randint(lo // 5, hi // 5), "days": rng.randint(dlo, dhi)}
    if not rows["Air"]["days"] < rows["Road"]["days"] <= rows["Railway"]["days"] < rows["Lake and road"]["days"]:
        return None
    tonnes = rng.choice([10, 20, 25, 40, 50])
    cost = {m: r["rate"] * r["km"] * tonnes for m, r in rows.items()}
    ranked = sorted(cost.values())
    if ranked[1] - ranked[0] < ranked[0] // 20:
        return None
    cheap = min(cost, key=cost.get)
    days = rows[cheap]["days"] - 1
    fast = {m: c for m, c in cost.items() if rows[m]["days"] <= days}
    if len(fast) < 2:
        return None
    best = sorted(fast.values())
    if best[1] - best[0] < best[0] // 20:
        return None
    return {"band": band, "sub": "modes", "rows": rows, "tonnes": tonnes, "days": days,
            "ask": {"cost": rng.choice(list(MODES))}}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    sub = rng.choice(["network", "modes"])
    while True:
        p = (_network if sub == "network" else _modes)(rng, band)
        if p:
            return p


BETA = "Beta index = number of roads ÷ number of towns"
COST = "Cost = cost per tonne-km × tonnes × km"


def draw(p: dict):
    if p["sub"] == "modes":
        rows = [[m, frw(r["km"]), frw(r["rate"]), str(r["days"])] for m, r in p["rows"].items()]
        return titled_table("Ways of sending goods from Town P to Port Q",
                            ["Mode", "Route length\n(km)", "Cost per tonne-km\n(Frw)", "Time\n(days)"], rows,
                            ["l", "r", "r", "r"], notes=[COST])
    from ..core import new_figure
    fig, ax = new_figure(9.0, 6.4)
    pos = p["pos"]
    for a, b in p["edges"]:
        (x0, y0), (x1, y1) = pos[a], pos[b]
        ln = math.dist(pos[a], pos[b])
        ux, uy = (x1 - x0) / ln, (y1 - y0) / ln
        ax.plot([x0 + ux * R, x1 - ux * R], [y0 + uy * R, y1 - uy * R], color="#7f7f7f", linewidth=3.0, zorder=2,
                solid_capstyle="butt", gid=f"road:{a}{b}")
        lx, ly = label_at(pos, (a, b))
        ax.text(lx, ly, f"{p['km'][f'{a}{b}']} km", ha="center", va="center", fontsize=10, zorder=4, gid=f"km:{a}{b}")
    for t, (x, y) in pos.items():
        ax.add_patch(Circle((x, y), R, facecolor="#fde9a9", edgecolor=INK, linewidth=1.4, zorder=3, gid=f"town:{t}"))
        ax.text(x, y, t, ha="center", va="center", fontsize=13, fontweight="bold", zorder=5, gid=f"name:{t}")
    ax.text(0.1, 7.15, "Roads between five towns (sketch map, not to scale)", ha="left", va="center", fontsize=12,
            fontweight="bold")
    if p["band"] == "UP":
        ax.text(0.1, -0.35, BETA, ha="left", va="center", fontsize=10)
    ax.set_xlim(0, 11)
    ax.set_ylim(-0.7, 7.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["studies", "reads", "looks at", "copies", "is given"]
SETTINGS = ["in a geography lesson", "for homework", "for a project on transport", "for a class test",
            "at the geography club", "while revising in Kigali", "for a lesson on transport networks",
            "on a revision card", "while revising in Rusizi", "before a school trip"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "network":
        lead = f"{who} {rng.choice(VERBS)} this sketch map of roads {rng.choice(SETTINGS)}."
        km, edges = p["km"], p["edges"]
        adj = {t: [] for t in TOWNS}
        for a, b in edges:
            adj[a].append(b)
            adj[b].append(a)
        a, b = p["ask"]["route"]
        best = min(sum(km.get(f"{x}{y}", km.get(f"{y}{x}", 0)) for x, y in zip(path, path[1:]))
                   for path in _paths(adj, a, b))
        t = p["ask"]["links"]
        qs = [short(f"{lead} What is the shortest distance by road from town {a} to town {b}, using the lengths on the "
                    "map?", f"{best} km", num_forms(best, "km", "kilometres")),
              count(f"How many towns on the sketch map are joined directly by a road to town {t}?", len(adj[t]), "towns")]
        if p["band"] == "UP":
            beta = len(edges) / 5
            qs.append(short(f"{BETA}. What is the beta index of the road network on the sketch map?", f"{beta:g}",
                            [f"{beta:g}", f"{beta:.1f}"]))
        else:
            total = sum(km.values())
            qs.append(short("What is the total length of all the roads on the sketch map?", f"{total} km",
                            num_forms(total, "km", "kilometres")))
        return qs
    lead = f"{who} {rng.choice(VERBS)} this table of transport costs {rng.choice(SETTINGS)}."
    rows, t, days = p["rows"], p["tonnes"], p["days"]
    cost = {m: r["rate"] * r["km"] * t for m, r in rows.items()}
    m = p["ask"]["cost"]
    cheap = min(cost, key=cost.get)
    fast = {k: c for k, c in cost.items() if rows[k]["days"] <= days}
    pick = min(fast, key=fast.get)
    mode_word = {"Road": "road", "Railway": "railway", "Lake and road": "lake and road", "Air": "air"}
    return [
        short(f"{lead} {COST}. How much would it cost to send {t} tonnes of goods from Town P to Port Q by "
              f"{mode_word[m]}, in Frw?", cost[m], money(cost[m])),
        mcq(f"{COST}. Which mode is the cheapest way to send {t} tonnes of goods from Town P to Port Q?", cheap,
            [k for k in rows if k != cheap], rng),
        mcq(f"{COST}. The {t} tonnes of goods must reach Port Q in {days} days or fewer. Which mode is the cheapest that "
            "arrives in time?", pick, [k for k in rows if k != pick], rng),
    ]
