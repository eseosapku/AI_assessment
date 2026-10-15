"""A small home or school network (P, Primary Computing): devices drawn as simple pictures, a router in the middle, and
the internet as a cloud above it, with lines showing which devices are joined.

- lower (Stages 1 and 2): four to six devices with their names (computer, laptop, tablet, phone, printer, TV), all but
  one joined to the router. How many devices are joined to the router, and which device is not?
- upper (Stages 3 to 6): three or four computers lettered A to D and a printer, every line numbered. The printer is
  joined to the router or to one computer, which shares it with the others. How many devices are joined straight to
  the router, which device shares the printer, and which numbered links data from a computer travels along to reach
  the internet. The wrong links are another computer's and the printer's (a balanced two-by-two, so the key is never
  the option in the middle).

Every number sits beside its line, and every name below its picture, clear of every line.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, count, mcq, new_figure

ID = "simple_network_p"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("P",)
CONCEPTS = tuple(f"computing.{c}" for c in ("computer-hardware", "computer-system-types", "communication-networking",
                                            "computer-network-characteristics", "lan-hardware", "network-peripherals",
                                            "internet-world-wide-web"))
# Stage 1's "We can network" and "We are connected" list no sections and carry only broad concepts (computer hardware,
# computer types), so the topics that share them but teach no network are turned away by name.
NEEDS = r"network|connect|router|internet|shar"
AVOID = (r"computer parts|control things|problem solver|robot|safety|citizenship|keyboard|computers are everywhere|"
         r"be a designer|artist|musician|animator|storyteller|\bdata\b|game|secret|code|innovator|computer scientist|"
         r"storage|evolution|classification|know your computer")

DEVICES = ["computer", "laptop", "tablet", "phone", "printer", "TV"]
SLOTS = {"L1": (1.3, 5.0), "L2": (1.3, 2.6), "R1": (8.7, 5.0), "R2": (8.7, 2.6), "B1": (3.4, 0.9), "B2": (6.6, 0.9),
         "BL": (1.0, 0.9), "BR": (9.0, 0.9)}
ROUTER = (5.0, 4.1)
CLOUD = (5.0, 6.55)


def stages(p: dict) -> tuple[int, int]:
    return (1, 2) if p["level"] == "lower" else (3, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["level"] == "lower":
        return tuple(f"computing.{c}" for c in ("computer-hardware", "computer-system-types", "communication-networking"))
    return CONCEPTS


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    if level == "lower":
        n = rng.randint(4, 6)
        names = rng.sample(DEVICES, n)
        apart = rng.randrange(n)
        slots = rng.sample(["L1", "L2", "R1", "R2", "B1", "B2"], n)
        return {"band": "P", "level": level, "devices": [[d, i != apart] for i, d in enumerate(names)],
                "slots": slots}
    n = rng.randint(3, 4)
    computers = list("ABCD"[:n])
    host = rng.choice(["router"] + computers)
    place = {}
    if host == "router":
        free = rng.sample(["L1", "L2", "R1", "R2", "B1", "B2"], n + 1)
        place["printer"] = free[0]
        for c, sl in zip(computers, free[1:]):
            place[c] = sl
        printer_slot = place["printer"]
    else:
        bottom = rng.choice(["B1", "B2"])
        place[host] = bottom
        printer_slot = "BL" if bottom == "B1" else "BR"
        place["printer"] = printer_slot
        others = [c for c in computers if c != host]
        for c, sl in zip(others, rng.sample(["L1", "L2", "R1", "R2"], len(others))):
            place[c] = sl
    ends = [("internet", "router")] + [(c, "router") for c in computers] + [("printer", host)]
    numbers = rng.sample(range(1, len(ends) + 1), len(ends))
    links = [[a, b, k] for (a, b), k in zip(ends, numbers)]
    return {"band": "P", "level": level, "computers": computers, "printer_on": host,
            "place": dict(sorted(place.items())), "links": links, "ask": rng.choice(computers)}


# --- drawing ----------------------------------------------------------------------------------------

W, H = 1.3, 0.95  # one device picture's box


def _picture(ax, kind: str, cx: float, cy: float) -> None:
    """A simple drawing of a device, inside a W by H box centred on (cx, cy)."""
    lw = 1.3
    if kind == "computer":
        ax.add_patch(Rectangle((cx - 0.45, cy - 0.05), 0.9, 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Rectangle((cx - 0.06, cy - 0.2), 0.12, 0.15, facecolor=INK, edgecolor=INK))
        ax.add_patch(Rectangle((cx - 0.5, cy - 0.45), 1.0, 0.2, facecolor="white", edgecolor=INK, linewidth=lw))
    elif kind == "laptop":
        ax.add_patch(Rectangle((cx - 0.4, cy - 0.15), 0.8, 0.55, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        ax.add_patch(Polygon([(cx - 0.4, cy - 0.15), (cx + 0.4, cy - 0.15), (cx + 0.55, cy - 0.42), (cx - 0.55, cy - 0.42)],
                             closed=True, facecolor="white", edgecolor=INK, linewidth=lw))
    elif kind == "tablet":
        ax.add_patch(FancyBboxPatch((cx - 0.4, cy - 0.38), 0.8, 0.76, boxstyle="round,pad=0.03", facecolor="white",
                                    edgecolor=INK, linewidth=lw))
        ax.add_patch(Rectangle((cx - 0.32, cy - 0.25), 0.64, 0.56, facecolor=FILL_2, edgecolor=INK, linewidth=0.8))
        ax.add_patch(Circle((cx, cy - 0.32), 0.035, facecolor=INK, edgecolor=INK))
    elif kind == "phone":
        ax.add_patch(FancyBboxPatch((cx - 0.2, cy - 0.42), 0.4, 0.84, boxstyle="round,pad=0.03", facecolor="white",
                                    edgecolor=INK, linewidth=lw))
        ax.add_patch(Rectangle((cx - 0.15, cy - 0.28), 0.3, 0.6, facecolor=FILL_2, edgecolor=INK, linewidth=0.8))
        ax.add_patch(Circle((cx, cy - 0.35), 0.03, facecolor=INK, edgecolor=INK))
    elif kind == "printer":
        ax.add_patch(Rectangle((cx - 0.25, cy + 0.1), 0.5, 0.32, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((cx - 0.5, cy - 0.3), 1.0, 0.42, facecolor=FILL, edgecolor=INK, linewidth=lw))
        ax.add_patch(Rectangle((cx - 0.3, cy - 0.45), 0.6, 0.15, facecolor="white", edgecolor=INK, linewidth=1.0))
    else:  # a TV on two small legs
        ax.add_patch(Rectangle((cx - 0.55, cy - 0.28), 1.1, 0.66, facecolor=FILL_2, edgecolor=INK, linewidth=lw))
        for dx in (-0.35, 0.35):
            ax.add_patch(Polygon([(cx + dx - 0.05, cy - 0.28), (cx + dx + 0.05, cy - 0.28), (cx + dx, cy - 0.42)],
                                 closed=True, facecolor=INK, edgecolor=INK))


def _router(ax) -> None:
    x, y = ROUTER
    ax.add_patch(FancyBboxPatch((x - 0.75, y - 0.3), 1.5, 0.6, boxstyle="round,pad=0.04", facecolor=FILL, edgecolor=INK,
                                linewidth=1.5, zorder=3))
    for dx in (-0.55, 0.55):  # two aerials
        ax.add_patch(Rectangle((x + dx - 0.03, y + 0.3), 0.06, 0.38, facecolor=INK, edgecolor=INK, zorder=3))
    ax.text(x, y, "router", ha="center", va="center", fontsize=12, fontweight="bold", zorder=4)


CIRCLES = ((-0.75, -0.05, 0.4), (-0.3, 0.2, 0.5), (0.3, 0.22, 0.48), (0.78, -0.03, 0.38), (0.0, -0.12, 0.45))


def _cloud(ax) -> None:
    """A cloud: five overlapping white circles, each outlined only along the arcs no other circle covers."""
    x, y = CLOUD
    for dx, dy, r in CIRCLES:
        ax.add_patch(Circle((x + dx, y + dy), r, facecolor="white", edgecolor="none", zorder=2))
    for i, (dx, dy, r) in enumerate(CIRCLES):
        free = [all((dx + r * math.cos(math.radians(d)) - ex) ** 2 + (dy + r * math.sin(math.radians(d)) - ey) ** 2 > er ** 2
                    for j, (ex, ey, er) in enumerate(CIRCLES) if j != i) for d in range(360)]
        if all(free):
            ax.add_patch(Arc((x + dx, y + dy), 2 * r, 2 * r, theta1=0, theta2=360, edgecolor=INK, linewidth=1.3, zorder=2.1))
            continue
        first = free.index(False)  # walk round from a covered degree, so no run is split at 0
        run = None
        for k in range(1, 361):
            d = (first + k) % 360
            if free[d] and run is None:
                run = first + k
            if (not free[d] or k == 360) and run is not None:
                ax.add_patch(Arc((x + dx, y + dy), 2 * r, 2 * r, theta1=run, theta2=first + k, edgecolor=INK,
                                 linewidth=1.3, zorder=2.1))
                run = None
    ax.text(x, y + 0.05, "internet", ha="center", va="center", fontsize=12, fontweight="bold", zorder=4)


# Where a line meets each picture: half its width and the height of its side's middle, and the height of its top.
SIDE = {"computer": (0.45, 0.2), "laptop": (0.4, 0.12), "tablet": (0.43, 0.0), "phone": (0.23, 0.0),
        "printer": (0.5, -0.09), "TV": (0.55, 0.05)}
TOP = {"computer": 0.45, "laptop": 0.4, "tablet": 0.41, "phone": 0.45, "printer": 0.42, "TV": 0.38}


def _edge(slot: str, kind: str) -> tuple[float, float]:
    """Where a line from the router meets a device's picture: its side facing the router, or its top."""
    cx, cy = SLOTS[slot]
    if slot.startswith("L"):
        return cx + SIDE[kind][0], cy + SIDE[kind][1]
    if slot.startswith("R"):
        return cx - SIDE[kind][0], cy + SIDE[kind][1]
    return cx, cy + TOP[kind]


def _router_end(to: tuple[float, float]) -> tuple[float, float]:
    """Where a line leaves the router's box towards a point: its left, right or bottom side."""
    x, y = ROUTER
    if to[1] < y - 1.2:
        return x + max(-0.6, min(0.6, (to[0] - x) * 0.25)), y - 0.34
    return (x - 0.79 if to[0] < x else x + 0.79), y


def _line(ax, a, b, gid: str):
    return ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=1.8, zorder=1, gid=gid)[0]


def _number(ax, a, b, k: int) -> None:
    """A link's number beside the middle of its line, on the side away from the router."""
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    if nx * (mx - ROUTER[0]) + ny * (my - ROUTER[1]) < 0 or (abs(dx) > abs(dy) and ny < 0):
        nx, ny = -nx, -ny
    if abs(dx) > 3 * abs(dy):  # a level line: the number above it
        nx, ny = 0, 1
    ax.add_patch(Circle((mx + 0.32 * nx, my + 0.32 * ny), 0.2, facecolor="white", edgecolor=INK, linewidth=1.0, zorder=3))
    ax.text(mx + 0.32 * nx, my + 0.32 * ny, str(k), ha="center", va="center", fontsize=11, fontweight="bold", zorder=4,
            gid=f"link:{k}")


def draw(p: dict):
    fig, ax = new_figure(8.4, 6.6)
    _router(ax)
    _cloud(ax)
    if p["level"] == "lower":
        _line(ax, (CLOUD[0], CLOUD[1] - 0.57), (ROUTER[0], ROUTER[1] + 0.34), "link:internet")
        for (name, joined), slot in zip(p["devices"], p["slots"]):
            cx, cy = SLOTS[slot]
            _picture(ax, name, cx, cy)
            ax.text(cx, cy - H / 2 - 0.25, name, ha="center", va="center", fontsize=12, gid=f"name:{name}")
            if joined:
                end = _edge(slot, name)
                _line(ax, _router_end(end), end, f"link:{name}")
        ax.text(0.2, 7.15, "Lines show which\ndevices are joined.", ha="left", va="center", fontsize=11)
    else:
        place = p["place"]
        for a, b, k in p["links"]:
            if a == "internet":
                start, end = (CLOUD[0], CLOUD[1] - 0.57), (ROUTER[0], ROUTER[1] + 0.34)
                _line(ax, start, end, f"link:{k}")
                ax.add_patch(Circle((ROUTER[0] + 0.4, (start[1] + end[1]) / 2), 0.2, facecolor="white", edgecolor=INK,
                                    linewidth=1.0, zorder=3))
                ax.text(ROUTER[0] + 0.4, (start[1] + end[1]) / 2, str(k), ha="center", va="center", fontsize=11,
                        fontweight="bold", zorder=4, gid=f"link:{k}")
                continue
            if b == "router":
                end = _edge(place[a], "printer" if a == "printer" else "computer")
                start = _router_end(end)
            else:  # the printer, beside the computer it is joined to: a level line into the screen and the printer
                pc, pr = SLOTS[place[b]], SLOTS[place[a]]
                side = 1 if pr[0] > pc[0] else -1
                start, end = (pc[0] + side * 0.45, pc[1] + 0.1), (pr[0] - side * 0.5, pr[1] + 0.1)
            _line(ax, start, end, f"link:{k}")
            _number(ax, start, end, k)
        for name, slot in place.items():
            cx, cy = SLOTS[slot]
            _picture(ax, "printer" if name == "printer" else "computer", cx, cy)
            label = "printer" if name == "printer" else f"computer {name}"
            ax.text(cx, cy - H / 2 - 0.25, label, ha="center", va="center", fontsize=12, gid=f"name:{name}")
        ax.text(0.2, 7.15, "Each line is a link,\nnumbered in a circle.", ha="left", va="center", fontsize=11)
    ax.set_xlim(0.0, 10.0)
    ax.set_ylim(0.0, 7.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

LOWER = ["looks at this picture of a home network", "draws the devices at home", "looks at the devices in the classroom",
         "draws a network in a computing lesson", "looks at this network at school in Huye"]
UPPER = ["drew this network at the coding club in Kigali", "drew the network in the school office",
         "drew the network in the computer room", "drew this network for a class test", "drew the network at the library in Musanze"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["level"] == "lower":
        joined = [d for d, j in p["devices"] if j]
        apart = next(d for d, j in p["devices"] if not j)
        others = rng.sample(joined, 3)
        return [count(f"{who} {rng.choice(LOWER)}. How many devices are joined to the router? The internet is not "
                      f"a device.", len(joined), "devices"),
                mcq("Which device is not joined to the router?", apart, others, rng)]
    links = {frozenset((a, b)): k for a, b, k in p["links"]}
    host = p["printer_on"]
    straight = len(p["computers"]) + (host == "router")
    shares = "the router" if host == "router" else f"computer {host}"
    wrong = [f"computer {c}" for c in p["computers"] if c != host]
    rng.shuffle(wrong)
    c = p["ask"]
    other = rng.choice([x for x in p["computers"] if x != c])
    a, a2 = links[frozenset((c, "router"))], links[frozenset((other, "router"))]
    b, b2 = links[frozenset(("internet", "router"))], links[frozenset(("printer", host))]
    pair = lambda x, y: f"links {min(x, y)} and {max(x, y)}"  # noqa: E731
    return [count(f"{who} {rng.choice(UPPER)}. How many devices are joined straight to the router? Do not count the "
                  f"internet.", straight, "devices"),
            mcq("The printer is shared with the whole network by the device it is joined to. Which device shares the "
                "printer?", shares, (wrong + ["the router"])[:3] if host != "router" else wrong[:3], rng),
            mcq(f"Data from computer {c} goes to the internet. Which links does it travel along?", pair(a, b),
                [pair(a2, b), pair(a, b2), pair(a2, b2)], rng)]
