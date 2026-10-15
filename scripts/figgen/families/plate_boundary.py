"""Plate boundaries (LS, UP): a cross-section of one plate boundary, with arrows showing how the plates move and its
features lettered (never named), as geography textbooks draw them. Four sub-types:

- constructive_ocean: two oceanic plates moving apart, magma rising beneath a mid-ocean ridge;
- constructive_rift: a continent being pulled apart: a rift valley dropped between two faults, magma rising beneath
  it, and a volcano beside it (as in the rift valleys of East Africa);
- destructive: an oceanic plate moving towards a continental plate and sinking beneath it into the mantle, an ocean
  trench where it bends down, magma rising from where it melts, and a volcano above;
- conservative: two plates sliding past each other, drawn as a map seen from above (a cross-section cannot show it):
  the fault between them, and a road and a river cut and moved apart where they cross it.

The sub-type is sometimes mirrored. Features are lettered from P on, so no figure letter matches an option's own letter
(P3z review). What type of boundary the diagram shows (from the arrows); which letter shows a named feature (the
trench, the ridge, the rift valley, a fault, the volcano, the magma chamber); which letter shows a described one (the
oceanic plate sinking into the mantle, its letter on the sinking part; magma rising beneath a ridge, its letter on the
rising magma itself). Only one rift fault is lettered, and no other letter ends near either fault.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Polygon

from ..core import INK, NAMES, mcq, new_figure
from ._bio_parts import letter, letter_choice, offset, spline

ID = "plate_boundary"
KIND = "geo.section"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("plate-tectonics", "earth-movements", "volcanoes", "earthquakes",
                                            "faulting"))
# A topic whose sections the book lists is reached only if its name or a section names plates, tectonics or what
# happens at plate boundaries.
NEEDS = r"plate|tectonic|internal landform|earthquake|volcan|vulcan|rift|continental drift|fault"
# Hazard-management sections share the volcano and earthquake concepts but teach responses, not plate boundaries.
AVOID = r"hazard response|disaster management|mining"

TYPE = {"constructive_ocean": "constructive", "constructive_rift": "constructive", "destructive": "destructive",
        "conservative": "conservative"}
FEATURES = {"constructive_ocean": ["mid-ocean ridge", "magma", "oceanic crust", "mantle"],
            "constructive_rift": ["rift valley", "fault", "volcano", "magma chamber", "continental crust"],
            "destructive": ["ocean trench", "volcano", "oceanic crust", "continental crust", "magma chamber"],
            "conservative": ["fault", "river", "road"]}
NAMED = {"constructive_ocean": ["mid-ocean ridge"],
         "constructive_rift": ["rift valley", "fault", "volcano", "magma chamber"],
         "destructive": ["ocean trench", "volcano", "magma chamber"], "conservative": ["fault"]}
# The magma beneath a ridge is drawn as the rising plume itself; beneath a rift or a volcano as a chamber, asked by name
# (P3z review: "magma rising" pointed at a chamber while the red vent above it was unlettered).
DESCRIBED = {"constructive_ocean": {"magma": "magma rising from the mantle"},
             "constructive_rift": {},
             "destructive": {"oceanic crust": "the oceanic plate sinking into the mantle"},
             "conservative": {}}
ARTICLE = {("constructive_rift", "fault"): "a"}
MANTLE, OCEANIC, CONTINENT, MAGMA, SEA = "#eaa564", "#77706a", "#c9a77a", "#d9452b", "#a9d2f2"
BX = 6.0  # where the boundary is, in every drawing


def sample(rng: random.Random) -> dict:
    kind = rng.choice(sorted(TYPE))
    feats = FEATURES[kind]
    if kind == "destructive" or kind == "constructive_rift":
        keep = [f for f in feats if f in NAMED[kind] or f in DESCRIBED[kind]]
        extra = [f for f in feats if f not in keep]
        chosen = keep + [f for f in extra if rng.random() < 0.7]
    else:
        chosen = list(feats)
    letters = list("PQRST"[:len(chosen)])
    rng.shuffle(letters)
    return {"band": rng.choice(BANDS), "kind": kind, "mirror": rng.random() < 0.5, "boundary_x": BX,
            "labels": dict(sorted(zip(letters, chosen)))}


# --- drawing ----------------------------------------------------------------------------------------

def _poly(ax, pts, face, gid, z=1.0, edge="none", lw=0.0):
    ax.add_patch(Polygon(pts, closed=True, facecolor=face, edgecolor=edge, linewidth=lw, zorder=z, gid=gid))


def _move(ax, gid, tail, head):
    ax.annotate("", xy=head, xytext=tail, gid=gid, zorder=6,
                arrowprops=dict(arrowstyle="simple,head_length=0.9,head_width=0.9,tail_width=0.35", color="#222222",
                                lw=0.5, shrinkA=0, shrinkB=0))


def _ocean(ax, flip, fx) -> dict:
    """Two oceanic plates moving apart at a mid-ocean ridge, magma rising beneath it."""
    floor = [(0.0, 3.55), (3.2, 3.6), (4.6, 3.85), (5.4, 4.25), (5.75, 4.3), (5.92, 4.05), (6.08, 4.05), (6.25, 4.3),
             (6.6, 4.25), (7.4, 3.85), (8.8, 3.6), (12.0, 3.55)]
    _poly(ax, flip([(0, 0.2), (12, 0.2)] + floor[::-1]), MANTLE, "part:mantle", z=0.5)
    _poly(ax, flip(floor + [(12, 5.0), (0, 5.0)]), SEA, "ocean", z=0.4)
    left = [q for q in floor if q[0] <= 5.92]
    right = [q for q in floor if q[0] >= 6.08]
    under = lambda pts: [(x, y - 0.55) for x, y in pts]  # noqa: E731
    ridge_l = [q for q in left if q[0] >= 4.6]
    ridge_r = [q for q in right if q[0] <= 7.4]
    for side in (left, right):
        _poly(ax, flip(side + under(side)[::-1]), OCEANIC, "part:oceanic crust", z=1)
    for ridge in (ridge_l, ridge_r):  # the ridge, over the band in the same colour: no seam shows
        ax.add_patch(Polygon(flip(ridge + under(ridge)[::-1]), closed=True, facecolor=OCEANIC, edgecolor="none",
                             antialiased=False, zorder=1.05, gid="part:mid-ocean ridge"))
    ax.plot(*zip(*flip(left)), color=INK, linewidth=1.2, zorder=2)
    ax.plot(*zip(*flip(right)), color=INK, linewidth=1.2, zorder=2)
    plume = spline([(5.92, 4.05), (5.85, 3.2), (5.5, 2.2), (5.2, 1.0), (6.8, 1.0), (6.5, 2.2), (6.15, 3.2), (6.08, 4.05)],
                   closed=False, per=8)
    _poly(ax, flip(plume), MAGMA, "part:magma", z=1.5, edge=INK, lw=0.8)
    ax.plot(*zip(*flip([(0, 5.0), (12, 5.0)])), color="#2a6bb8", linewidth=1.0, zorder=2.2, gid="sea-level")
    ax.text(fx(1.2), 4.55, "Ocean", ha="center", va="center", fontsize=10, style="italic", zorder=3)
    _move(ax, "motion:left", flip([(4.2, 5.35)])[0], flip([(2.6, 5.35)])[0])
    _move(ax, "motion:right", flip([(7.8, 5.35)])[0], flip([(9.4, 5.35)])[0])
    return {"mid-ocean ridge": ((4.3, 2.55), (5.55, 4.0)), "magma": ((7.6, 1.9), (6.35, 1.9)),
            "oceanic crust": ((1.6, 2.5), (1.6, 3.28)), "mantle": ((9.6, 1.9), (9.6, 1.0))}


def _rift(ax, flip, fx) -> dict:
    """A continent pulled apart: a rift valley dropped between two faults, a lake and a volcano on its floor, and the
    magma chamber beneath that feeds the volcano."""
    _poly(ax, flip([(0, 0.2), (12, 0.2), (12, 2.2), (0, 2.2)]), MANTLE, "mantle", z=0.5)
    top, base, floor = 4.6, 2.2, 3.75
    # two normal faults dipping towards each other; the wedge between them has dropped to make the valley floor
    lf, rf = ((4.4, top), (5.3, base)), ((7.6, top), (6.7, base))
    at_y = lambda f, y: f[0][0] + (f[1][0] - f[0][0]) * (f[0][1] - y) / (f[0][1] - f[1][1])  # noqa: E731
    _poly(ax, flip([(0, base), lf[1], lf[0], (0, top)]), CONTINENT, "part:continental crust", z=1)
    _poly(ax, flip([rf[1], (12, base), (12, top), rf[0]]), CONTINENT, "part:continental crust", z=1)
    _poly(ax, flip([lf[1], rf[1], (at_y(rf, floor), floor), (at_y(lf, floor), floor)]), "#bf9a68", "part:rift valley",
          z=1)
    # the chamber lies just beneath the crust, so the faults end at its roof rather than run into it
    blob = spline([(5.0, 1.55), (5.5, 1.05), (6.2, 0.97), (6.95, 1.2), (7.05, 1.7), (6.6, 2.08), (5.8, 2.12),
                   (5.2, 1.95)], per=8)
    _poly(ax, flip(blob), MAGMA, "part:magma chamber", z=1.5, edge=INK, lw=0.8)
    # the faults: only the left one is lettered (P3z review: two faults each answered "which letter shows the fault")
    for (x0, y0), (x1, y1), gid in ((*lf, "part:fault"), (*rf, "fault")):
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln * 0.06, dx / ln * 0.06
        _poly(ax, flip([(x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny), (x0 + nx, y0 + ny)]), "#3a2d1e",
              gid, z=1.6)
    ax.plot(*zip(*flip([(0, top), lf[0], (at_y(lf, floor), floor), (at_y(rf, floor), floor), rf[0], (12, top)])),
            color=INK, linewidth=1.2, zorder=2)
    # a lake on the valley floor, as in the rift valleys of East Africa, and a volcano beside it
    _poly(ax, flip([(4.95, floor), (5.85, floor), (5.77, floor + 0.15), (5.03, floor + 0.15)]), SEA, "lake", z=1.7)
    cone = [(6.0, floor), (6.45, 4.9), (6.6, 4.9), (7.05, floor)]
    _poly(ax, flip(cone), "#8b6d52", "part:volcano", z=1.2, edge=INK, lw=1.2)
    _poly(ax, flip([(6.46, 4.86), (6.58, 4.86), (6.58, 2.0), (6.46, 2.0)]), MAGMA, "conduit", z=1.3)
    _move(ax, "motion:left", flip([(3.4, 5.2)])[0], flip([(1.7, 5.2)])[0])
    _move(ax, "motion:right", flip([(8.6, 5.2)])[0], flip([(10.3, 5.2)])[0])
    return {"rift valley": ((5.35, 5.65), (5.35, 3.35)), "fault": ((3.3, 3.0), (at_y(lf, 3.4), 3.4)),
            "volcano": ((8.2, 5.75), (6.72, 4.3)), "magma chamber": ((3.3, 1.0), (5.75, 1.5)),
            "continental crust": ((10.9, 3.0), (10.9, 3.6))}


def _destructive(ax, flip, fx) -> dict:
    """An oceanic plate sinking beneath a continental plate: trench, magma, volcano."""
    # the oceanic plate: flat, then bending down beneath the continent
    slab_top = [(0, 3.75), (3.8, 3.75), (4.8, 3.55), (5.2, 3.0)] + [(5.2 + 0.9 * k, 3.0 - 0.62 * k) for k in range(1, 5)]
    # the mantle reaches up under the plates (they cover its top); the sea lies on the plate, against the continent
    _poly(ax, flip([(0, 0.2), (12, 0.2), (12, 3.0), (5.6, 3.0), (4.8, 3.3), (0, 3.45)]), MANTLE, "mantle", z=0.5)
    _poly(ax, flip(slab_top[:4] + [(5.62, 3.62), (5.9, 4.6), (6.3, 5.0), (0, 5.0)]), SEA, "ocean", z=0.4)
    slab = slab_top + offset(slab_top, -0.45)[::-1]
    _poly(ax, flip(slab), OCEANIC, "part:oceanic crust", z=1.1, edge=INK, lw=1.1)
    # the trench: the deep V of sea where the plate bends down
    _poly(ax, flip([(4.55, 3.62), (5.2, 3.02), (5.62, 3.62)]), "#7fb6e6", "part:ocean trench", z=0.6)
    # the continental plate, its edge resting on the sinking plate, fold mountains along it and a volcano
    land = [(5.62, 3.62), (5.9, 4.6), (6.3, 5.0), (6.7, 4.75), (7.0, 5.15), (7.4, 4.85), (7.85, 5.0), (8.1, 5.0),
            (8.85, 5.95), (9.15, 5.95), (9.9, 5.0), (12.0, 5.0)]
    meet = 5.2 + 0.9 * (3.0 - 2.2) / 0.62  # where the sinking plate's top reaches the continent's base
    under = [(12.0, 2.2), (meet, 2.2), (5.2, 3.0)]
    _poly(ax, flip(land + under), CONTINENT, "part:continental crust", z=1.0, edge=INK, lw=1.1)
    _poly(ax, flip([(8.1, 5.0), (8.85, 5.95), (9.15, 5.95), (9.9, 5.0)]), "#8b6d52", "part:volcano", z=1.2, edge=INK,
          lw=1.1)
    _poly(ax, flip([(8.94, 5.9), (9.06, 5.9), (9.08, 2.4), (8.92, 2.4)]), MAGMA, "conduit", z=1.3)
    # magma rising from where the sinking plate melts, gathering beneath the volcano
    blob = spline([(8.5, 1.05), (8.8, 0.95), (9.05, 1.5), (9.7, 2.05), (9.9, 2.55), (9.3, 2.85), (8.6, 2.8), (8.4, 2.2),
                   (8.55, 1.6)], per=8)
    _poly(ax, flip(blob), MAGMA, "part:magma chamber", z=1.5, edge=INK, lw=0.8)
    ax.plot(*zip(*flip([(0, 5.0), (6.3, 5.0)])), color="#2a6bb8", linewidth=1.0, zorder=0.45, gid="sea-level")
    ax.text(fx(1.0), 4.45, "Ocean", ha="center", va="center", fontsize=10, style="italic", zorder=3)
    _move(ax, "motion:left", flip([(1.9, 5.3)])[0], flip([(3.6, 5.3)])[0])
    _move(ax, "motion:right", flip([(11.8, 5.45)])[0], flip([(10.3, 5.45)])[0])
    return {"ocean trench": ((4.45, 5.75), (5.15, 3.3)), "volcano": ((7.7, 6.05), (8.62, 5.45)),
            "oceanic crust": ((4.9, 1.0), (6.62, 1.86)), "continental crust": ((11.2, 3.3), (11.2, 4.1)),
            "magma chamber": ((11.0, 1.4), (9.55, 2.25))}


def _conservative(ax, flip, fx) -> dict:
    """Two plates sliding past each other, as a map from above: the fault, and a road and a river moved apart."""
    _poly(ax, flip([(0.2, 0.3), (12, 0.3), (12, 6.2), (0.2, 6.2)]), "#e8eed8", "land", z=0.3)
    fault = [(6.0, 0.3), (5.95, 1.6), (6.05, 3.0), (5.97, 4.4), (6.02, 6.2)]
    _poly(ax, flip([(x - 0.07, y) for x, y in fault] + [(x + 0.07, y) for x, y in fault[::-1]]), "#5a4630",
          "part:fault", z=1.5)
    road_l, road_r = 3.55, 2.65
    for (x0, x1, y) in ((0.2, 5.9, road_l), (6.1, 12.0, road_r)):
        _poly(ax, flip([(x0, y - 0.12), (x1, y - 0.12), (x1, y + 0.12), (x0, y + 0.12)]), "#8f8f8f", "part:road", z=1.2)
    for (x0, x1, y) in ((0.2, 5.9, 5.3), (6.1, 12.0, 4.4)):
        pts = [(x0 + (x1 - x0) * k / 30, y + 0.12 * math.sin(k / 3)) for k in range(31)]
        _poly(ax, flip([(x, v - 0.08) for x, v in pts] + [(x, v + 0.08) for x, v in pts[::-1]]), "#4a8fd4",
              "part:river", z=1.2)
    for x in (2.2, 9.8):
        ax.text(fx(x), 1.15, "PLATE", ha="center", va="center", fontsize=9.5, color="#555555", zorder=3)
    _move(ax, "motion:left", flip([(3.3, 0.9)])[0], flip([(3.3, 2.15)])[0])
    _move(ax, "motion:right", flip([(8.7, 2.15)])[0], flip([(8.7, 0.9)])[0])
    return {"fault": ((7.0, 5.95), (6.04, 5.5)), "road": ((1.6, 4.35), (1.6, road_l)),
            "river": ((10.4, 5.5), (10.4, 4.4 + 0.12 * math.sin((10.4 - 6.1) / (12.0 - 6.1) * 30 / 3)))}


def draw(p: dict):
    fx = (lambda x: 12.0 - x) if p["mirror"] else (lambda x: x)
    flip = lambda pts: [(fx(x), y) for x, y in pts]  # noqa: E731
    fig, ax = new_figure(8.4, 5.0)
    kind = p["kind"]
    slots = {"constructive_ocean": _ocean, "constructive_rift": _rift, "destructive": _destructive,
             "conservative": _conservative}[kind](ax, flip, fx)
    for L, name in p["labels"].items():
        at, end = slots[name]
        letter(ax, L, (fx(at[0]), at[1]), (fx(end[0]), end[1]), gap=0.27, size=14, dot=True)
    ax.set_xlim(-0.1, 12.1)
    ax.set_ylim(0.0, 6.6)
    ax.set_aspect("equal")
    ax.axis("off")
    if kind == "conservative":
        ax.set_title("A plate boundary seen from above (a map)", fontsize=11)
    else:
        ax.set_title("A cross-section through a plate boundary (not to scale)", fontsize=11)
    return fig


# --- questions --------------------------------------------------------------------------------------

INTROS = ["{name} drew this diagram of a plate boundary {setting}.", "{name} copied this plate boundary diagram {setting}.",
          "{name} is revising plate tectonics from this diagram {setting}.",
          "{name} sketched this plate boundary {setting}."]
SETTINGS = ["for a geography lesson", "after a lesson on earthquakes", "for a revision poster",
            "at the geography club in Huye", "for homework", "for a class display in Kigali"]
# Rwanda's volcanoes and the East African Rift are a rift's setting, and only a rift's (P3z review: a ridge or a
# trench "after a visit to Musanze" misled).
RIFT_SETTINGS = SETTINGS + ["after a visit to the volcanoes near Musanze", "after reading about the East African Rift"]


def questions(p: dict, rng: random.Random) -> list:
    kind, labels = p["kind"], p["labels"]
    at = {v: k for k, v in labels.items()}
    settings = RIFT_SETTINGS if kind == "constructive_rift" else SETTINGS
    intro = rng.choice(INTROS).format(name=rng.choice(NAMES), setting=rng.choice(settings))
    what = "map" if kind == "conservative" else "diagram"
    qs = [mcq(f"{intro} What type of plate boundary does the {what} show?", TYPE[kind],
              [t for t in ("constructive", "destructive", "conservative") if t != TYPE[kind]], rng)]
    name = rng.choice(NAMED[kind])
    others = [L for L in sorted(labels) if L != at[name]]
    rng.shuffle(others)
    qs.append(letter_choice(f"Which letter shows {ARTICLE.get((kind, name), 'the')} {name}?", at[name], others))
    described = {f: d for f, d in DESCRIBED[kind].items() if f in at and f != name}
    if described:
        feat = rng.choice(sorted(described))
        others = [L for L in sorted(labels) if L != at[feat]]
        rng.shuffle(others)
        qs.append(letter_choice(f"Which letter shows {described[feat]}?", at[feat], others))
    elif len(NAMED[kind]) > 1:  # a rift: a second named feature
        second = rng.choice([n for n in NAMED[kind] if n != name])
        others = [L for L in sorted(labels) if L != at[second]]
        rng.shuffle(others)
        qs.append(letter_choice(f"Which letter shows {ARTICLE.get((kind, second), 'the')} {second}?", at[second],
                                others))
    return qs
