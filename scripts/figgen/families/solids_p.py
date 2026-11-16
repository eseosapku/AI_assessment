"""3D shapes (P, Stage 1 to 3), as Cambridge Primary Stage 3 "3D shapes" (and the 3D shapes of Stage 1–2 "Geometry")
teaches them: naming cubes, cuboids, cylinders, cones, spheres, pyramids and prisms, counting faces, edges and
vertices, and spotting curved surfaces.

Three kinds of figure, big drawings with hidden edges dashed:
- which: four shapes lettered P to S. Which letter shows a cylinder (cone, sphere, cube, pyramid ...)?
- count: one flat-faced shape (cube, cuboid, square-based pyramid, triangular prism) drawn alone, its name printed. How
  many faces (edges, vertices) does it have? Keys from the fixed table below, which every hidden edge drawn dashed
  agrees with.
- curved: four or five shapes lettered P to T. How many of them have a curved surface?
"""
from __future__ import annotations

import random

from matplotlib.patches import Arc, Ellipse, Polygon

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure

ID = "solids_p"
KIND = "maths.solid"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.3d-shapes", "mathematics.solids-properties")
# A topic whose sections the book lists is reached only if its name or a section names 3D shapes.
NEEDS = r"3d|solid|three-dimensional"
AVOID = r"fraction|symmetr|position|time|measur|volume|capacity|nets|surface area|circumference|area bounded"

SHAPES = ["cube", "cuboid", "cylinder", "cone", "sphere", "pyramid", "prism"]
FULL = {"cube": "cube", "cuboid": "cuboid", "cylinder": "cylinder", "cone": "cone", "sphere": "sphere",
        "pyramid": "square-based pyramid", "prism": "triangular prism"}
# (faces, edges, vertices) of the flat-faced shapes; curved surfaces by shape.
PROPS = {"cube": (6, 12, 8), "cuboid": (6, 12, 8), "pyramid": (5, 8, 5), "prism": (5, 9, 6)}
CURVED = {"cylinder", "cone", "sphere"}
LETTERS = "PQRST"
COLOURS = ["#9cc9ec", "#f6c26b", "#b5d99c", "#f4a6a6", "#c9b3e6"]
WHICH_LEADS = ["{n} sorts some 3D shapes.", "{n} finds some solid shapes in the classroom.", "{n} draws some 3D shapes.",
               "{n} builds with some solid shapes."]
COUNT_LEADS = ["{n} holds a {s}.", "{n} looks closely at a {s}.", "{n} makes a {s} from card.", "{n} draws a {s}."]
CURVED_LEADS = ["{n} rolls some shapes across the table.", "{n} looks for shapes with a curved surface.",
                "{n} feels the surfaces of some 3D shapes.", "{n} sorts shapes into curved and flat."]


def stages(p: dict) -> tuple[int, int]:
    return (1, 3)


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["which", "count", "curved"])
    p = {"band": "P", "sub": sub, "name": rng.choice(NAMES)}
    if sub == "which":
        shapes = rng.sample(SHAPES, 4)
        p.update(shapes=shapes, ask=rng.choice(shapes), colours=rng.sample(COLOURS, 4))
    elif sub == "count":
        p.update(shape=rng.choice(sorted(PROPS)), ask=rng.choice(["faces", "edges", "vertices"]),
                 colour=rng.choice(COLOURS))
    else:
        k = rng.choice([4, 5])
        shapes = rng.sample(SHAPES, k)
        p.update(shapes=shapes, colours=rng.sample(COLOURS, k))
    return p


# --- drawing ------------------------------------------------------------------------------------------------

DX, DY = 0.45, 0.35


def solid(ax, kind: str, cx: float, cy: float, colour: str, gid: str, s: float = 1.0) -> None:
    """A 3D shape drawn in about a 2-unit box centred at (cx, cy), hidden edges dashed."""
    lw, dash = 2.0, (0, (4, 3))

    def P(x, y):
        return (cx + s * x, cy + s * y)

    def line(a, b, hidden=False):
        ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=1.1 if hidden else lw, linestyle=dash if hidden else "-",
                gid=f"behind-{gid}:{'hidden' if hidden else 'edge'}")

    if kind in ("cube", "cuboid"):
        w, h = (1.3, 1.3) if kind == "cube" else (1.8, 1.0)
        d = 0.65 if kind == "cube" else 0.55
        x0, y0 = -w / 2 - d * DX / 2, -h / 2 - d * DY / 2
        f = [P(x0, y0), P(x0 + w, y0), P(x0 + w, y0 + h), P(x0, y0 + h)]
        b = [(x + s * d * DX, y + s * d * DY) for x, y in f]
        ax.add_patch(Polygon([f[1], b[1], b[2], b[3], f[3], f[2]], closed=True, facecolor=colour, alpha=0.6,
                             edgecolor="none", gid=f"behind-{gid}:fill"))
        ax.add_patch(Polygon(f, closed=True, facecolor=colour, edgecolor="none", gid=f"behind-{gid}:front"))
        for a, c in ((f[0], f[1]), (f[1], f[2]), (f[2], f[3]), (f[3], f[0]), (f[1], b[1]), (f[2], b[2]), (f[3], b[3]),
                     (b[1], b[2]), (b[2], b[3])):
            line(a, c)
        for a, c in ((f[0], b[0]), (b[0], b[1]), (b[0], b[3])):
            line(a, c, hidden=True)
    elif kind == "cylinder":
        R, H, e = 0.75, 1.5, 0.25
        ax.add_patch(Polygon([P(-R, -H / 2), P(R, -H / 2), P(R, H / 2), P(-R, H / 2)], closed=True, facecolor=colour,
                             edgecolor="none", gid=f"behind-{gid}:fill"))
        ax.add_patch(Ellipse(P(0, H / 2), 2 * R * s, 2 * e * s, facecolor=colour, edgecolor=INK, linewidth=lw,
                             gid=f"behind-{gid}:top"))
        line(P(-R, -H / 2), P(-R, H / 2))
        line(P(R, -H / 2), P(R, H / 2))
        ax.add_patch(Arc(P(0, -H / 2), 2 * R * s, 2 * e * s, theta1=180, theta2=360, color=INK, linewidth=lw,
                         gid=f"behind-{gid}:base"))
        ax.add_patch(Arc(P(0, -H / 2), 2 * R * s, 2 * e * s, theta1=0, theta2=180, color=INK, linewidth=1.1,
                         linestyle=dash, gid=f"behind-{gid}:back"))
    elif kind == "cone":
        R, H, e = 0.8, 1.6, 0.25
        ax.add_patch(Polygon([P(-R, -H / 2), P(0, H / 2), P(R, -H / 2)], closed=True, facecolor=colour, edgecolor="none",
                             gid=f"behind-{gid}:fill"))
        line(P(-R, -H / 2), P(0, H / 2))
        line(P(R, -H / 2), P(0, H / 2))
        ax.add_patch(Arc(P(0, -H / 2), 2 * R * s, 2 * e * s, theta1=180, theta2=360, color=INK, linewidth=lw,
                         gid=f"behind-{gid}:base"))
        ax.add_patch(Arc(P(0, -H / 2), 2 * R * s, 2 * e * s, theta1=0, theta2=180, color=INK, linewidth=1.1,
                         linestyle=dash, gid=f"behind-{gid}:back"))
    elif kind == "sphere":
        ax.add_patch(Ellipse(P(0, 0), 1.6 * s, 1.6 * s, facecolor=colour, edgecolor=INK, linewidth=lw, gid=f"behind-{gid}:ball"))
        ax.add_patch(Arc(P(0, 0), 1.6 * s, 0.45 * s, theta1=180, theta2=360, color=INK, linewidth=1.1, gid=f"behind-{gid}:eq"))
        ax.add_patch(Arc(P(0, 0), 1.6 * s, 0.45 * s, theta1=0, theta2=180, color=INK, linewidth=0.9, linestyle=dash,
                         gid=f"behind-{gid}:eqb"))
    elif kind == "pyramid":
        a, d = 1.5, 0.7
        base = [P(-a / 2 - 0.15, -0.75), P(a / 2 - 0.15, -0.75), P(a / 2 - 0.15 + d * DX, -0.75 + d * DY),
                P(-a / 2 - 0.15 + d * DX, -0.75 + d * DY)]
        apex = P(0.0, 0.85)
        ax.add_patch(Polygon([base[0], base[1], base[2], apex], closed=True, facecolor=colour, edgecolor="none",
                             gid=f"behind-{gid}:fill"))
        for v in (base[0], base[1], base[2]):
            line(v, apex)
        line(base[0], base[1])
        line(base[1], base[2])
        line(base[3], apex, hidden=True)
        line(base[2], base[3], hidden=True)
        line(base[3], base[0], hidden=True)
    else:  # a triangular prism lying on a rectangular face
        w, d = 1.7, 0.75
        f = [P(-w / 2 - 0.15, -0.6), P(w / 2 - 0.15, -0.6), P(-0.15, 0.6)]  # the front triangle
        b = [(x + s * d * DX, y + s * d * DY) for x, y in f]
        ax.add_patch(Polygon([f[0], f[1], b[1], b[2], f[2]], closed=True, facecolor=colour, alpha=0.6, edgecolor="none",
                             gid=f"behind-{gid}:fill"))
        ax.add_patch(Polygon(f, closed=True, facecolor=colour, edgecolor="none", gid=f"behind-{gid}:front"))
        for a, c in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0]), (f[1], b[1]), (f[2], b[2]), (b[1], b[2])):
            line(a, c)
        for a, c in ((f[0], b[0]), (b[0], b[1]), (b[0], b[2])):
            line(a, c, hidden=True)


def draw(p: dict):
    if p["sub"] == "count":
        fig, ax = new_figure(4.6, 4.2)
        solid(ax, p["shape"], 0, 0.2, p["colour"], "shape", s=1.25)
        ax.text(0, -1.45, FULL[p["shape"]], ha="center", va="center", fontsize=14, gid="name")
        ax.set_xlim(-1.9, 1.9)
        ax.set_ylim(-1.8, 1.65)
    else:
        k = len(p["shapes"])
        fig, ax = new_figure(2.4 * k, 3.4)
        for i, (kind, colour) in enumerate(zip(p["shapes"], p["colours"])):
            solid(ax, kind, 2.6 * i, 0.15, colour, f"s{i}")
            ax.text(2.6 * i, -1.35, LETTERS[i], ha="center", va="center", fontsize=16, fontweight="bold",
                    gid=f"letter:{LETTERS[i]}")
        ax.set_xlim(-1.3, 2.6 * (k - 1) + 1.3)
        ax.set_ylim(-1.7, 1.25)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ----------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    name, sub = p["name"], p["sub"]
    if sub == "which":
        letters = LETTERS[:len(p["shapes"])]
        key = letters[p["shapes"].index(p["ask"])]
        lead = rng.choice(WHICH_LEADS).format(n=name)
        word = FULL[p["ask"]]
        art = "an" if word[0] in "aeiou" else "a"
        return [mcq(f"{lead} Which letter shows {art} {word}?", key, [L for L in letters if L != key], rng)]
    if sub == "count":
        f, e, v = PROPS[p["shape"]]
        n = {"faces": f, "edges": e, "vertices": v}[p["ask"]]
        lead = rng.choice(COUNT_LEADS).format(n=name, s=FULL[p["shape"]])
        return [count(f"{lead} How many {p['ask']} does it have?", n, p["ask"])]
    lead = rng.choice(CURVED_LEADS).format(n=name)
    n = sum(1 for k in p["shapes"] if k in CURVED)
    return [count(f"{lead} How many of the shapes have a curved surface?", n, "shapes")]
