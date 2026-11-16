"""Energy (P5 to P6, Science and Elementary Technology "Energy management"), of three kinds.

- chain: an energy chain of three boxes joined by arrows (a torch: battery, chemical energy -> wires, electrical
  energy -> bulb, light energy), one box's energy left as "?". Which form of energy goes in the box marked ?; which
  part changes electrical energy into the last box's energy (asked only when that box is not the blank one).
- sources: five sources of energy in a row of boxes, each lettered and named (the sun, the wind, flowing water;
  petrol, cooking gas, coal), with the meaning of renewable printed: renewable sources will not run out,
  non-renewable sources will run out one day. How many of the sources are renewable? Which letter shows a source that
  will (or will not) run out? -- one of the asked kind among the other kind, so exactly one option is right.
- use: a bar chart of the electricity a home's appliances used in one day, in units, every bar on a gridline. Which
  appliance used the most? How many units altogether? How many more units did one use than another?

Every chain and which sources run out come from the fixed tables CHAINS and RENEWABLE below, as a Primary science
book states them.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch, Polygon, Rectangle

from ..core import GRID, INK, NAMES, Question, count, mcq, new_figure, short

ID = "energy_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("energy-transformation", "electricity-production", "energy-sources",
                                          "renewable-energy", "energy-conservation-practical"))
# A topic whose sections the book lists is reached only if its name or a section names energy.
NEEDS = r"\benergy\b"
AVOID = (r"science in context|glossary|programming|simple machines?|light and heat|electricity|sound|shadow|"
         r"light and dark|food chain|pushes and pulls|sexual|reproduction system|hiv")

CHAINS = {
    "torch": [("battery", "chemical"), ("wires", "electrical"), ("bulb", "light")],
    "radio": [("battery", "chemical"), ("wires", "electrical"), ("loudspeaker", "sound")],
    "bicycle lamp": [("turning wheel", "kinetic"), ("dynamo", "electrical"), ("lamp", "light")],
    "solar fan": [("sunlight", "light"), ("solar panel", "electrical"), ("fan", "kinetic")],
    "wind kettle": [("wind", "kinetic"), ("generator", "electrical"), ("kettle", "heat")],
    "water radio": [("falling water", "kinetic"), ("generator", "electrical"), ("loudspeaker", "sound")],
}
TITLES = {"torch": "Energy changes in a torch", "radio": "Energy changes in a battery radio",
          "bicycle lamp": "Energy changes in a bicycle lamp", "solar fan": "Energy changes in a solar fan",
          "wind kettle": "Energy changes from the wind to a kettle",
          "water radio": "Energy changes from falling water to a radio"}
FORMS = ["chemical", "electrical", "light", "sound", "heat", "kinetic"]
RENEWABLE = {"sun": True, "wind": True, "flowing water": True, "petrol": False, "cooking gas": False, "coal": False}
APPLIANCES = ["Fridge", "Television", "Lamps", "Iron", "Radio", "Kettle", "Water pump"]
LETTERS = "ABCDE"


def stages(p: dict) -> tuple[int, int]:
    return (5, 6)


def concepts_for(p: dict) -> tuple:
    return {"chain": ("science.energy-transformation", "science.electricity-production"),
            "sources": ("science.energy-sources", "science.renewable-energy"),
            "use": ("science.energy-conservation-practical",)}[p["sub"]]


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["chain", "sources", "use"])
    if sub == "chain":
        return {"band": "P", "sub": "chain", "device": rng.choice(sorted(CHAINS)), "blank": rng.randrange(3)}
    if sub == "sources":
        k = rng.choice([2, 3])
        things = rng.sample(sorted(t for t in RENEWABLE if RENEWABLE[t]), k) + \
            rng.sample(sorted(t for t in RENEWABLE if not RENEWABLE[t]), 5 - k)
        rng.shuffle(things)
        return {"band": "P", "sub": "sources", "things": things}
    n = rng.choice([4, 5])
    top = rng.choice([8, 10, 12])
    return {"band": "P", "sub": "use", "items": rng.sample(APPLIANCES, n), "units": rng.sample(range(1, top + 1), n),
            "top": top}


# --- drawing ----------------------------------------------------------------------------------------------------

def _draw_chain(p: dict):
    chain = CHAINS[p["device"]]
    fig, ax = new_figure(10.0, 3.0)
    bw, gap, bh = 2.7, 1.0, 1.5
    for k, (part, form) in enumerate(chain):
        x0 = k * (bw + gap)
        blank = k == p["blank"]
        ax.add_patch(FancyBboxPatch((x0, 0), bw, bh, boxstyle="round,pad=0,rounding_size=0.12",
                                    facecolor="#fef9e7" if not blank else "white", edgecolor=INK, linewidth=1.5,
                                    zorder=1, gid=f"box:{k}"))
        ax.text(x0 + bw / 2, bh - 0.42, part.capitalize(), ha="center", va="center", fontsize=13, fontweight="bold")
        ax.text(x0 + bw / 2, 0.48, "?" if blank else f"{form} energy", ha="center", va="center",
                fontsize=16 if blank else 12.5, fontweight="bold" if blank else "normal", gid=f"form:{k}")
        if k < 2:
            ax.add_patch(FancyArrowPatch((x0 + bw + 0.1, bh / 2), (x0 + bw + gap - 0.1, bh / 2), arrowstyle="-|>",
                                         mutation_scale=22, color=INK, linewidth=2.0, zorder=2))
    width = 3 * bw + 2 * gap
    ax.text(width / 2, bh + 0.45, TITLES[p["device"]], ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, bh + 0.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _source(ax, kind: str, cx: float, cy: float, i: int) -> None:
    """A source of energy centred on (cx, cy), inside x +-0.75 and y +-0.6."""
    gid = f"source:{i}:{kind}"

    def P(x, y):
        return (cx + x, cy + y)

    def poly(pts, face, z=3, lw=1.3):
        ax.add_patch(Polygon([P(*q) for q in pts], closed=True, facecolor=face, edgecolor=INK, linewidth=lw, zorder=z,
                             gid=gid))

    def line(*pts, color=INK, lw=2.0, z=3.1):
        ax.plot([P(*q)[0] for q in pts], [P(*q)[1] for q in pts], color=color, linewidth=lw, zorder=z,
                solid_capstyle="round", gid=gid)

    if kind == "sun":
        ax.add_patch(Circle(P(0, 0), 0.3, facecolor="#f4d03f", edgecolor=INK, linewidth=1.3, zorder=3.2, gid=gid))
        for k in range(12):
            t = 2 * math.pi * k / 12
            line((0.4 * math.cos(t), 0.4 * math.sin(t)), (0.58 * math.cos(t), 0.58 * math.sin(t)), color="#d4ac0d",
                 lw=2.5)
    elif kind == "wind":
        line((0.0, -0.6), (0.0, 0.18), lw=3.5, color="#7f8c8d")
        for k in range(3):
            t = math.radians(90 + 120 * k)
            u = math.radians(90 + 120 * k + 90)
            tip = (0.0 + 0.55 * math.cos(t), 0.2 + 0.55 * math.sin(t))
            side = (0.0 + 0.1 * math.cos(u), 0.2 + 0.1 * math.sin(u))
            poly([(0.0, 0.2), side, tip], "#f4f6f7", z=3.2)
        ax.add_patch(Circle(P(0.0, 0.2), 0.06, facecolor="#7f8c8d", edgecolor=INK, linewidth=1.0, zorder=3.3, gid=gid))
    elif kind == "flowing water":
        poly([(-0.6, 0.38), (-0.15, 0.38), (-0.15, -0.1), (-0.6, -0.1)], "#909497")
        poly([(-0.15, 0.3), (0.1, 0.3), (0.2, -0.3), (-0.05, -0.3)], "#5dade2", z=3.1)
        poly([(-0.7, -0.6), (0.72, -0.6), (0.72, -0.3), (-0.7, -0.3)], "#5dade2", z=3.0)
        for y in (-0.38, -0.5):
            line((-0.5, y), (-0.3, y + 0.03), (-0.1, y), color="white", lw=1.4, z=3.2)
    elif kind == "petrol":
        poly([(-0.45, -0.6), (0.2, -0.6), (0.2, 0.5), (-0.45, 0.5)], "#e74c3c")
        poly([(-0.35, 0.1), (0.1, 0.1), (0.1, 0.38), (-0.35, 0.38)], "#fdfefe", z=3.1, lw=1.0)
        line((0.2, 0.1), (0.45, 0.05), (0.55, -0.35), lw=2.4, color="#1c1c1c")
        poly([(0.45, -0.35), (0.65, -0.35), (0.62, -0.5), (0.48, -0.5)], "#1c1c1c", z=3.2)
    elif kind == "cooking gas":
        ax.add_patch(FancyBboxPatch(P(-0.38, -0.6), 0.76, 0.95, boxstyle="round,pad=0,rounding_size=0.25",
                                    facecolor="#2e86c1", edgecolor=INK, linewidth=1.3, zorder=3, gid=gid))
        poly([(-0.12, 0.35), (0.12, 0.35), (0.12, 0.5), (-0.12, 0.5)], "#aab7b8", z=3.1)
        line((-0.25, 0.55), (0.25, 0.55), lw=3.0, color="#566573")
    elif kind == "coal":
        for k, (x, y) in enumerate(((-0.4, -0.45), (0.0, -0.45), (0.4, -0.45), (-0.2, -0.15), (0.2, -0.15),
                                    (0.0, 0.15))):
            poly([(x - 0.2, y - 0.12), (x + 0.15, y - 0.15), (x + 0.22, y + 0.05), (x + 0.02, y + 0.16),
                  (x - 0.2, y + 0.08)], "#17202a", z=3 + 0.01 * k, lw=1.0)
    else:
        raise ValueError(kind)


def _draw_sources(p: dict):
    fig, ax = new_figure(10.5, 4.6)
    bw, gap, bh = 2.05, 0.22, 2.2
    y_box = 1.45
    width = 5 * bw + 4 * gap
    for i, t in enumerate(p["things"]):
        x0 = i * (bw + gap)
        ax.add_patch(FancyBboxPatch((x0, y_box), bw, bh, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#fbfbf6",
                                    edgecolor=INK, linewidth=1.3, zorder=1, gid=f"box:{i}"))
        _source(ax, t, x0 + bw / 2 + 0.08, y_box + 1.18, i)
        ax.text(x0 + bw / 2, y_box + 0.27, t, ha="center", va="center", fontsize=11.5, gid=f"name:{i}")
        ax.add_patch(Circle((x0 + 0.3, y_box + bh - 0.3), 0.22, facecolor="white", edgecolor=INK, linewidth=1.5,
                            zorder=6, gid=f"ring:{i}"))
        ax.text(x0 + 0.3, y_box + bh - 0.3, LETTERS[i], ha="center", va="center", fontsize=14, fontweight="bold",
                zorder=7, gid=f"letter:{LETTERS[i]}")
    ax.add_patch(FancyBboxPatch((0, 0), width, 1.15, boxstyle="round,pad=0,rounding_size=0.1", facecolor="#f4f6f7",
                                edgecolor=INK, linewidth=1.2, zorder=1))
    ax.text(0.3, 0.82, "Renewable sources of energy will not run out.", ha="left", va="center", fontsize=12)
    ax.text(0.3, 0.33, "Non-renewable sources of energy will run out one day.", ha="left", va="center", fontsize=12)
    ax.text(width / 2, y_box + bh + 0.35, "Sources of energy", ha="center", va="center", fontsize=14,
            fontweight="bold")
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(-0.05, y_box + bh + 0.65)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_use(p: dict):
    fig, ax = new_figure(9.0, 5.4)
    n = len(p["items"])
    bars = ax.bar(range(n), p["units"], width=0.6, color="#f5b041", edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_yticks(range(0, p["top"] + 1))
    ax.set_ylim(0, p["top"])
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xticks(range(n))
    ax.set_xticklabels(p["items"], fontsize=12)
    ax.set_xlim(-0.6, n - 0.4)
    ax.tick_params(axis="y", labelsize=11)
    ax.set_ylabel("Electricity used (units)", fontsize=12)
    ax.set_title("Electricity used in a home in one day", fontsize=13, fontweight="bold")
    return fig


def draw(p: dict):
    return {"chain": _draw_chain, "sources": _draw_sources, "use": _draw_use}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "talks about", "reads"]
SETTINGS = ["in a science lesson", "at school", "in class", "with a friend", "at home", "for homework"]


def questions(p: dict, rng: random.Random) -> list:
    who, verb, setting = rng.choice(NAMES), rng.choice(VERBS), rng.choice(SETTINGS)
    if p["sub"] == "chain":
        chain = CHAINS[p["device"]]
        key = chain[p["blank"]][1] + " energy"
        qs = [mcq(f"{who} {verb} the energy chain {setting}. Which form of energy goes in the box marked ?", key,
                  [f + " energy" for f in rng.sample([f for f in FORMS if f + " energy" != key], 3)], rng)]
        if p["blank"] != 2:
            last = chain[2][1]
            qs.append(mcq(f"In this energy chain, which part changes electrical energy into {last} energy?",
                          chain[2][0], [chain[0][0], chain[1][0]], rng))
        return qs
    if p["sub"] == "sources":
        things = p["things"]
        k = sum(RENEWABLE[t] for t in things)
        qs = [count(f"{who} {verb} the pictures {setting}. How many of the lettered sources are renewable?", k,
                    "sources")]
        ask = rng.choice([True, False])
        right = rng.choice([LETTERS[i] for i, t in enumerate(things) if RENEWABLE[t] == ask])
        wrong = [LETTERS[i] for i, t in enumerate(things) if RENEWABLE[t] != ask][:3]
        options = sorted([right, *wrong])
        what = "will not run out" if ask else "will run out one day"
        qs.append(Question("mcq", f"Which letter shows a source of energy that {what}?", str(options.index(right)),
                           options))
        return qs
    items, units = p["items"], p["units"]
    top = items[units.index(max(units))]
    qs = [mcq(f"{who} {verb} the chart {setting}. Which appliance used the most electricity?", top,
              rng.sample([i for i in items if i != top], 3), rng)]
    total = sum(units)
    qs.append(short("How many units of electricity did all the appliances use altogether?", total, [f"{total} units"]))
    a, b = rng.sample(range(len(items)), 2)
    if units[a] < units[b]:
        a, b = b, a
    d = units[a] - units[b]
    qs.append(short(f"How many more units did the {items[a].lower()} use than the {items[b].lower()}?", d,
                    [f"{d} units"]))
    return qs
