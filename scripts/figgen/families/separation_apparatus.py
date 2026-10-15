"""Separation apparatus (LS, UP): the set-ups for separating mixtures, drawn as textbook line diagrams. Two layouts:

- single: one set-up (filtration, simple distillation or evaporation) with four to six parts lettered on leader lines
  and no part named; which letter shows a named part, what the part at a letter is called, where the cooling water
  enters the condenser (its lower end, so the jacket fills), and which method the set-up shows;
- panel: three small set-ups lettered P, Q and R, each a different method (filtration, simple distillation, and
  evaporation or crystallisation, never both: an evaporating basin on a flame is also crystallisation's first
  step); which method a set-up shows, and which set-up to use for a stated job.

The parts and the job each method does come from fixed tables a chemistry teacher would agree with. Glass vessels
(flasks, funnel, basin) and the filter paper are drawn as walls, bands along their outlines, and a leader to one ends
on its wall with a dot; every leader ends inside its own part and no other (P3z review). The gauze is a hatched mesh
laid on the tripod's ring. Every part a
letter may point at is a filled shape with the gid "part:<name>"; a letter is the text "letter:<L>" and its leader
the line "leader:<L>", ending on its part, as in the biology diagrams. In a panel the shapes that show the method
carry "mark:<letter>:<what>" (a funnel; a condenser and a flame; a basin and a flame; a basin and crystals).
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import INK, NAMES, Question, new_figure
from ._bio_parts import ellipse, letter, letter_choice, letters_for, tube

ID = "separation_apparatus"
KIND = "diagram.template"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("separation-techniques", "laboratory-techniques", "water-purification"))
# Integrated Science teaches separating mixtures too.
ALSO = ("science.separation-techniques",)
# A topic whose sections the book lists is reached only if one names separating, purifying, a method drawn, preparing
# salts, or laboratory apparatus.
NEEDS = (r"separat|purif|filtrat|distil|crystalli|evaporat|mixtures|preparing normal salts|preparation of salts|"
         r"salt preparation|laboratory apparatus")
AVOID = (r"chromatog|\borganic|solvent extraction|colligative|petro|polymer|crude oil|fractional|electroly|\brates?\b|"
         r"equilibri|bonding|atomic|periodic|nature of matter|glossary")

PARTS = {
    "filtration": ["filter funnel", "filter paper", "residue", "filtrate", "conical flask"],
    "simple distillation": ["thermometer", "distillation flask", "condenser", "water inlet", "water outlet", "distillate",
                            "Bunsen burner"],
    "evaporation": ["evaporating basin", "solution", "gauze", "tripod", "Bunsen burner"],
}
PORTS = ["water inlet", "water outlet"]
# Parts where one lines or holds the other: a figure letters one of them at most, and asks only about what it letters
# (P3z review: "A and D both label the funnel walls"; a basin and its solution). The filter paper lines the funnel and
# holds the residue, so it is drawn but never lettered: a figure with it lettered could letter only two parts.
NESTED = [("filter funnel", "filter paper"), ("filter paper", "residue"), ("conical flask", "filtrate"),
          ("evaporating basin", "solution")]
UNLETTERED = {"filter paper"}
# The parts a student mixes up with each one, offered first as wrong answers.
CONFUSE = {"filter funnel": ["filter paper", "conical flask"], "filter paper": ["filter funnel", "residue"],
           "residue": ["filtrate", "filter paper"], "filtrate": ["residue", "conical flask"], "conical flask": ["filtrate", "filter funnel"],
           "thermometer": ["condenser", "distillation flask"], "distillation flask": ["distillate", "condenser"],
           "condenser": ["thermometer", "distillation flask"], "distillate": ["distillation flask", "condenser"],
           "Bunsen burner": ["thermometer", "tripod"], "evaporating basin": ["solution", "gauze"],
           "solution": ["evaporating basin", "gauze"], "gauze": ["tripod", "evaporating basin"], "tripod": ["gauze", "Bunsen burner"]}
MIXTURES = {
    "filtration": ["muddy water", "a mixture of chalk and water", "a mixture of sand and salt solution"],
    "simple distillation": ["sea water", "salty water", "ink"],
    "evaporation": ["salt solution", "sea water", "potassium chloride solution"],
}
PURPOSES = {
    "filtration": ["separate sand from a mixture of sand and water", "remove insoluble chalk from water",
                   "collect the sand from muddy water"],
    "simple distillation": ["get pure water from sea water", "collect pure water from ink", "get drinking water from salty water"],
    "evaporation": ["get solid salt from salt solution, letting the water escape into the air",
                    "obtain dry salt from sea water without collecting the water"],
    "crystallisation": ["obtain crystals of copper(II) sulfate from its solution", "grow crystals of alum from a hot saturated solution"],
}
SINGLE_METHODS = ["filtration", "simple distillation", "evaporation"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.6:
        method = rng.choice(SINGLE_METHODS)
        parts = [x for x in PARTS[method] if x not in PORTS and x not in UNLETTERED]
        rng.shuffle(parts)
        free = []  # the parts in a random order, each dropped if it nests with one already kept
        for x in parts:
            if not any({x, y} == set(pair) for y in free for pair in NESTED):
                free.append(x)
        if method == "simple distillation" and rng.random() < 0.6:
            chosen = PORTS + free[:3]
        else:
            chosen = free[:rng.choice([4, 5])]
        labels = letters_for(chosen, rng)
        return {"band": band, "layout": "single", "method": method, "mixture": rng.randrange(3),
                "labels": dict(sorted(labels.items()))}
    third = rng.choice(["evaporation", "crystallisation"])
    methods = ["filtration", "simple distillation", third]
    rng.shuffle(methods)
    return {"band": band, "layout": "panel", "setups": dict(zip("PQR", methods))}


# --- drawing ------------------------------------------------------------------------------------------

GLASS = "#f4f8fb"
WATER = "#cfe2ef"
SALTY = "#dde9e4"
SAND = "#a08860"
MUD = "#d9cfb6"
FLAME = "#f6c26b"
WALL = "#c3d0d9"
PAPER = "#efe4c4"
METAL = "#8a8a8a"


class Pen:
    """Draws in a set-up's own units, placed and scaled on the axes; names the shapes it draws through `name`."""

    def __init__(self, ax, ox: float, oy: float, k: float, name):
        self.ax, self.ox, self.oy, self.k, self.name = ax, ox, oy, k, name

    def at(self, pts):
        return [(self.ox + self.k * x, self.oy + self.k * y) for x, y in pts]

    def poly(self, pts, face, what=None, z=2.0, lw=1.3, edge=INK, hatch=None):
        gid = self.name(what) if what else None
        patch = Polygon(self.at(pts), closed=True, facecolor=face, edgecolor=edge, linewidth=lw * (0.75 if self.k < 1 else 1),
                        zorder=z, gid=gid, hatch=hatch)
        self.ax.add_patch(patch)
        return patch

    def line(self, pts, lw=1.3, z=5.0, what=None):
        xs, ys = zip(*self.at(pts))
        self.ax.plot(xs, ys, color=INK, linewidth=lw * (0.75 if self.k < 1 else 1), zorder=z, gid=self.name(what) if what else None)

    def wall(self, path, what=None, z=2.2, width=0.14, face=None):
        """A glass wall: a band along the vessel's outline. It, not the vessel's inside, is the part a leader ends on."""
        return self.poly(tube(path, width), face or WALL, what, z=z, lw=0.8)

    def inside(self, pts, face, what=None, z=1.8):
        """What fills a vessel, under its walls: the glass's inside, a liquid, a solid."""
        return self.poly(pts, face, what, z=z, lw=0.0, edge="none")


def _burner(pen: Pen, cx: float) -> None:
    pen.poly([(cx - 0.8, 0.3), (cx + 0.8, 0.3), (cx + 0.8, 0.5), (cx + 0.15, 0.5), (cx + 0.15, 1.95), (cx - 0.15, 1.95),
              (cx - 0.15, 0.5), (cx - 0.8, 0.5)], METAL, "Bunsen burner", z=2)
    flame = [(cx - 0.2, 2.0), (cx - 0.14, 2.35), (cx - 0.05, 2.7), (cx, 2.88), (cx + 0.05, 2.7), (cx + 0.14, 2.35), (cx + 0.2, 2.0)]
    pen.poly(flame, FLAME, "flame", z=2, lw=1.0)


# Where each leader ends: inside its own part, a margin clear of the part's edges, and in no other part (P3z review:
# leaders had ended in a funnel's contents and near a basin's rim). A leader ending on a glass wall has a dot there.
WALLS = {"conical flask", "filter funnel", "filter paper", "distillation flask", "evaporating basin"}


def _filtration(pen: Pen) -> dict:
    flask = [(6.55, 4.4), (6.55, 3.6), (5.4, 0.5), (8.6, 0.5), (7.45, 3.6), (7.45, 4.4)]
    pen.inside(flask, GLASS)
    pen.inside([(5.4, 0.5), (8.6, 0.5), (8.192, 1.6), (5.808, 1.6)], WATER, "filtrate", z=2.0)
    pen.line([(5.808, 1.6), (8.192, 1.6)], lw=0.8, z=2.1)
    pen.wall(flask, "conical flask")
    for side in ([(5.0, 7.8), (6.85, 5.0), (6.85, 3.1)], [(9.0, 7.8), (7.15, 5.0), (7.15, 3.1)]):  # the stem is open below
        pen.wall(side, "filter funnel", z=3.0)
    # the filter paper: a cone lining the funnel, a little way inside its glass; what is being filtered sits in it
    pen.inside([(6.61, 5.9), (7.39, 5.9), (7.884, 6.6), (6.116, 6.6)], MUD, "contents", z=3.1)
    pen.inside([(7.0, 5.33), (7.39, 5.9), (6.61, 5.9)], SAND, "residue", z=3.1)
    pen.line([(6.61, 5.9), (7.39, 5.9)], lw=0.8, z=3.15)
    pen.line([(6.116, 6.6), (7.884, 6.6)], lw=0.8, z=3.15)
    pen.wall([(5.33, 7.62), (7.0, 5.25), (8.67, 7.62)], "filter paper", z=3.2, width=0.11, face=PAPER)
    for y, r in ((2.75, 0.07), (2.4, 0.06)):
        pen.poly(ellipse(7.0, y, r, r * 1.3, n=16), WATER, None, z=3.5, lw=0.7)
    return {"filter funnel": ((10.6, 4.72), (7.15, 4.72)), "filter paper": ((2.9, 7.3), (5.556, 7.3)),
            "residue": ((2.9, 5.72), (7.0, 5.72)), "filtrate": ((10.6, 1.05), (7.0, 1.05)),
            "conical flask": ((10.6, 2.4), (7.895, 2.4))}


S, E = (3.28, 6.55), (10.6, 3.25)  # the condenser's inner tube, from the flask's side arm to the receiver
U = ((E[0] - S[0]) / math.dist(S, E), (E[1] - S[1]) / math.dist(S, E))
N = (-U[1], U[0])


def _along(t: float, off: float = 0.0) -> tuple[float, float]:
    d = math.dist(S, E)
    return S[0] + U[0] * d * t + N[0] * off, S[1] + U[1] * d * t + N[1] * off


def _distillation(pen: Pen) -> dict:
    _burner(pen, 3.0)
    cx, cy, r = 3.0, 4.3, 1.25
    a = math.degrees(math.asin(0.28 / r))
    rim = [(cx + r * math.cos(math.radians(t)), cy + r * math.sin(math.radians(t))) for t in
           [90 + a + (360 - 2 * a) * k / 48 for k in range(49)]]
    outline = [(2.72, 7.2)] + rim + [(3.28, 7.2)]
    pen.inside(outline, GLASS)
    low = [(cx + (r - 0.04) * math.cos(math.radians(t)), cy + (r - 0.04) * math.sin(math.radians(t))) for t in range(180, 361, 10)]
    pen.inside(low, SALTY, "contents", z=2.0)
    pen.line([low[0], low[-1]], lw=0.8, z=2.1)
    pen.wall(outline, "distillation flask")
    pen.poly([(2.93, 6.45), (3.07, 6.45), (3.07, 9.4), (2.93, 9.4)], "#ffffff", "thermometer", z=3.5, lw=1.0)
    pen.poly(ellipse(3.0, 6.4, 0.1, 0.15, n=20), "#c0392b", "thermometer", z=3.6, lw=1.0)  # the bulb level with the side arm
    pen.poly([(2.62, 7.05), (3.38, 7.05), (3.38, 7.45), (2.62, 7.45)], "#5a5a5a", None, z=3.4, lw=0.9)
    # the receiver and the distillate in it
    receiver = [(10.95, 2.9), (10.95, 2.2), (10.0, 0.3), (12.6, 0.3), (11.65, 2.2), (11.65, 2.9)]
    pen.inside(receiver, GLASS)
    pen.inside([(10.0, 0.3), (12.6, 0.3), (12.275, 0.95), (10.325, 0.95)], WATER, "distillate", z=2.0)
    pen.line([(10.325, 0.95), (12.275, 0.95)], lw=0.8, z=2.1)
    pen.wall(receiver)
    # the condenser: a water jacket round the inner tube, with a port at each end
    jacket = [_along(0.2, 0.375), _along(0.8, 0.375), _along(0.8, -0.375), _along(0.2, -0.375)]
    out_x, in_x = _along(0.26, 0.375)[0], _along(0.74, -0.375)[0]
    pen.poly([(out_x - 0.1, 5.85), (out_x + 0.1, 5.85), (out_x + 0.1, 6.6), (out_x - 0.1, 6.6)], WATER, "water outlet", z=2.6, lw=1.0)
    pen.poly([(in_x - 0.1, 3.15), (in_x + 0.1, 3.15), (in_x + 0.1, 3.9), (in_x - 0.1, 3.9)], WATER, "water inlet", z=2.6, lw=1.0)
    pen.poly(jacket, WATER, "condenser", z=3)
    pen.poly(tube([S, E, (11.3, 3.05), (11.3, 2.45)], 0.2), "#ffffff", None, z=4, lw=1.0)
    centre = _along(0.5, 0.25)
    wall = (cx + r * math.cos(math.radians(150)), cy + r * math.sin(math.radians(150)))
    return {"thermometer": ((1.2, 8.6), (3.0, 8.6)), "distillation flask": ((0.7, 5.4), wall),
            "condenser": ((7.6, 7.1), centre), "water outlet": ((out_x, 7.35), (out_x, 6.4)),
            "water inlet": ((in_x, 2.3), (in_x, 3.35)), "distillate": ((13.4, 0.65), (11.6, 0.65)),
            "Bunsen burner": ((5.0, 1.0), (3.0, 1.0))}


def _basin(pen: Pen, cy: float, solution: str, what_basin: str, what_solution: str | None, rx: float = 1.75,
           ry: float = 1.42) -> float:
    """An evaporating basin: its wall a band along a half-ellipse, the solution in it below the surface; returns the
    surface's height."""
    bowl = ellipse(7.0, cy, rx, ry, n=36, a0=180, a1=360)
    pen.inside(bowl, GLASS, z=2.9)
    top = cy - 0.32 * ry
    inner = [(x, y) for x, y in ellipse(7.0, cy, rx - 0.06, ry - 0.06, n=72, a0=180, a1=360) if y <= top]
    pen.inside(inner, solution, what_solution, z=3.0)
    pen.line([inner[0], inner[-1]], lw=0.8, z=3.05)
    pen.wall(bowl, what_basin, z=3.2)
    return top


def _evaporation(pen: Pen) -> dict:
    _burner(pen, 7.0)
    # the tripod: a ring on three legs (two seen); the gauze is a separate wire mesh laid on the ring
    for foot, head in (((4.85, 0.3), (5.35, 3.2)), ((9.15, 0.3), (8.65, 3.2))):
        pen.poly(tube([foot, head], 0.14), "#5a5a5a", "tripod", z=2, lw=0.8)
    pen.poly([(5.0, 3.15), (9.0, 3.15), (9.0, 3.35), (5.0, 3.35)], "#5a5a5a", "tripod", z=2.1, lw=0.8)
    pen.poly([(4.75, 3.35), (9.25, 3.35), (9.25, 3.6), (4.75, 3.6)], "#ffffff", "gauze", z=2.6, lw=1.0, hatch="xxxx")
    rx, ry = 1.75, 1.42
    cy = 3.6 + 0.07 + ry
    _basin(pen, cy, SALTY, "evaporating basin", "solution", rx, ry)
    for x in (6.4, 7.0, 7.6):
        pen.line([(x + 0.12 * math.sin(k * math.pi / 3), cy + 0.3 + 0.18 * k) for k in range(7)], lw=0.9, what="steam")
    t = math.radians(-12)
    wall = (7.0 + rx * math.cos(t), cy + ry * math.sin(t))
    return {"evaporating basin": ((11.2, 5.5), wall), "solution": ((2.6, 4.15), (6.4, 4.15)),
            "gauze": ((11.2, 3.475), (9.1, 3.475)), "tripod": ((11.2, 1.6), (8.926, 1.6)), "Bunsen burner": ((7.0, -0.45), (7.0, 0.4))}


def _crystallisation(pen: Pen) -> None:
    """A basin of solution left to cool on the bench, crystals growing in it: no flame."""
    pen.poly([(3.4, 0.3), (10.6, 0.3), (10.6, 0.75), (3.4, 0.75)], "#d9c7a3", None, z=2, lw=1.0)  # a heat-proof mat
    _basin(pen, 3.25, SALTY, "basin", None, rx=3.0, ry=2.45)
    for x, y in ((5.4, 1.75), (6.3, 1.25), (7.2, 1.2), (8.1, 1.35), (8.8, 1.85), (5.9, 2.2), (6.8, 1.85), (7.7, 1.95),
                 (6.4, 2.5), (7.5, 2.5)):
        pen.poly([(x, y - 0.3), (x + 0.26, y), (x, y + 0.3), (x - 0.26, y)], "#3f6fa0", "crystals", z=3.3, lw=0.8)


def draw(p: dict):
    if p["layout"] == "single":
        fig, ax = new_figure(7.0, 5.4)
        fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
        pen = Pen(ax, 0.0, 0.0, 1.0, lambda what: f"part:{what}" if what in PARTS[p["method"]] else what)
        slots = {"filtration": _filtration, "simple distillation": _distillation, "evaporation": _evaporation}[p["method"]](pen)
        for L, name in p["labels"].items():
            at, end = slots[name]
            letter(ax, L, at, end, gap=0.32, dot=name in WALLS)
        ax.set_xlim(0.0, 14.0)
        top = {"filtration": 8.3, "simple distillation": 9.7, "evaporation": 7.1}[p["method"]]
        ax.set_ylim(-0.85 if p["method"] == "evaporation" else 0.0, top)
    else:
        fig, ax = new_figure(7.6, 2.9)
        fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
        marks = {"filtration": {"filter funnel": "funnel"}, "simple distillation": {"condenser": "condenser", "flame": "flame"},
                 "evaporation": {"evaporating basin": "basin", "flame": "flame"},
                 "crystallisation": {"basin": "basin", "crystals": "crystals"}}
        k = 0.34
        for i, (L, method) in enumerate(p["setups"].items()):
            ox = 0.3 + 5.05 * i
            own = marks[method]
            pen = Pen(ax, ox, 0.75, k, lambda what, L=L, own=own: f"mark:{L}:{own[what]}" if what in own else None)
            {"filtration": _filtration, "simple distillation": _distillation, "evaporation": _evaporation,
             "crystallisation": _crystallisation}[method](pen)
            ax.text(ox + 7.0 * k, 0.3, L, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"setup:{L}")
        ax.set_xlim(0.0, 15.4)
        ax.set_ylim(-0.1, 4.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "during a chemistry practical in Huye", "at the science club in Musanze",
            "in a lesson on mixtures", "for a class practical in Rubavu", "in the laboratory at a school in Nyagatare",
            "for a practical test in Kigali"]
METHOD_OPTIONS = ["filtration", "evaporation", "simple distillation", "chromatography"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    if p["layout"] == "single":
        method, labels = p["method"], p["labels"]
        at = {v: k for k, v in labels.items()}
        letters = sorted(labels)
        named = [x for x in labels.values() if x not in PORTS]
        first = rng.choice(named)
        wrong = [at[c] for c in CONFUSE[first] if c in at] + rng.sample(letters, len(letters))
        mixture = MIXTURES[method][p["mixture"]]
        qs = [letter_choice(f"{who} set up this apparatus {rng.choice(SETTINGS)} to separate the substances in {mixture}. "
                            f"Which letter shows the {first}?", at[first], [w for w in wrong if w != at[first]])]
        if "water inlet" in at:
            wrong = [at["water outlet"]] + [at[c] for c in ("condenser", "distillate", "thermometer") if c in at] + letters
            qs.append(letter_choice("At which letter does the cooling water enter the condenser?", at["water inlet"],
                                    [w for w in wrong if w != at["water inlet"]]))
        else:
            L = at[rng.choice([x for x in named if x != first])]
            name = labels[L]
            others = [c for c in CONFUSE[name]] + [x for x in PARTS[method] if x not in PORTS]
            options = [name]
            for o in others:
                if o not in options and o in PARTS[method] and len(options) < 4:
                    options.append(o)
            rng.shuffle(options)
            qs.append(Question("mcq", f"What is the part labelled {L} called?", str(options.index(name)), options))
        options = METHOD_OPTIONS[:]
        rng.shuffle(options)
        qs.append(Question("mcq", f"{friend} looks at this apparatus {rng.choice(SETTINGS)}. Which method of separation does it show?",
                           str(options.index(method)), options))
        return qs
    setups = p["setups"]
    by_method = {m: L for L, m in setups.items()}
    order = list(setups)
    rng.shuffle(order)
    L = order[0]
    options = list(setups.values()) + ["chromatography"]
    rng.shuffle(options)
    qs = [Question("mcq", f"{who} drew three set-ups, P, Q and R, for separating mixtures {rng.choice(SETTINGS)}. "
                          f"Which method does set-up {L} show?", str(options.index(setups[L])), options)]
    for k, M in enumerate(order[1:]):
        purpose = rng.choice(PURPOSES[setups[M]])
        stem = f"Which set-up should {friend} use to {purpose}?" if k == 0 else f"Which set-up should be used to {purpose}?"
        qs.append(letter_choice(stem, by_method[setups[M]], ["P", "Q", "R"]))
    return qs
