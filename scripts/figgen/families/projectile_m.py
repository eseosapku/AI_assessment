"""Projectiles (AL, Further Mathematics "Projectiles"): a particle projected from O, its path drawn to scale.

Three kinds of figure, each with g = 10 m s⁻² printed:
- ground: projected from O on horizontal ground, landing at A. The time of flight, the greatest height, the range OA,
  and b in the path's equation y = ax − bx².
- cliff: projected from O at the top of a vertical cliff of printed height, landing at B on the sea; F is the foot of
  the cliff. The time to reach the sea, the distance FB, the greatest height above the sea, the vertical component of
  the velocity as it reaches the sea.
- post: projected from O on horizontal ground; P is the point of the path above a post a printed distance from O. The
  height of P, the time to reach P, whether the particle is rising or falling at P.

The initial velocity is printed either as a speed with tan α (α above the horizontal, from a Pythagorean triple, so the
components are whole numbers) or as its horizontal and vertical components. Every key is a whole number or a short
terminating decimal (b may be a fraction).
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Rectangle

from ..core import FILL_2, INK, NAMES, mcq, new_figure
from ._mech import G, answer, arrow, fmt, hatch

ID = "projectile_m"
KIND = "physics.force"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.trajectory-cartesian-equation", "mathematics.mechanics")
NEEDS = r"projectile|trajectory|vertical plane"
AVOID = r"^(?!.*projectile)"  # only the Projectiles chapter: no other A Level topic draws a path like this

OBJECTS = ["particle", "ball", "stone", "small ball"]
# (horizontal, vertical, hypotenuse): tan α = vertical / horizontal; angles from 22 to 68 degrees only
TRIPLES = [(3, 4, 5), (4, 3, 5), (12, 5, 13), (5, 12, 13), (8, 15, 17), (15, 8, 17)]
VERBS = {"particle": ["projects"], "ball": ["throws", "projects", "launches"], "stone": ["throws", "projects"],
         "small ball": ["throws", "projects", "launches"]}
GROUND_LEADS = ["{n} {v} a {o} from a point O on horizontal ground.", "{n} {v} a {o} from a point O on level ground.",
                "{n} {v} a {o} from a point O on flat ground."]
CLIFF_LEADS = ["{n} {v} a {o} from a point O at the top of a vertical cliff.",
               "{n} {v} a {o} from a point O on the edge of a vertical cliff.",
               "{n} {v} a {o} from the top O of a vertical cliff above the sea."]
POST_LEADS = ["{n} {v} a {o} from a point O on horizontal ground, past a vertical post.",
              "{n} {v} a {o} from a point O on level ground towards a vertical post.",
              "{n} {v} a {o} from a point O on flat ground; its path passes above a vertical post."]


def _velocity(rng, lo_ratio: float, hi_ratio: float, cap: int) -> tuple[int, int, str, list]:
    """Whole-number components (ux, uy) with lo <= uy/ux <= hi, printed as a speed with tan α or as components."""
    while True:
        if rng.random() < 0.5:
            a, b, c = rng.choice(TRIPLES)
            k = rng.randint(1, max(1, cap // c))
            ux, uy = k * a, k * b
            form, shown = "angle", [k * c, b, a]  # speed, tan α = b/a
        else:
            ux, uy = rng.randint(3, 30), rng.randint(5, 30)
            form, shown = "components", [ux, uy]
        if lo_ratio <= uy / ux <= hi_ratio and 5 <= uy and ux <= 40 and uy <= 40:
            return ux, uy, form, shown


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["ground", "cliff", "post"])
    obj = rng.choice(OBJECTS)
    if sub == "ground":
        while True:
            ux, uy, form, shown = _velocity(rng, 0.5, 3.0, 45)
            if ux * uy / 5 <= 400:
                return {"band": "AL", "sub": sub, "obj": obj, "ux": ux, "uy": uy, "form": form, "shown": shown,
                        "name": rng.choice(NAMES)}
    if sub == "cliff":
        while True:
            horizontal = rng.random() < 0.3
            if horizontal:
                ux = rng.randint(4, 25)
                uy, form, shown = 0, "horizontal", [ux]
            else:
                ux, uy, form, shown = _velocity(rng, 0.75, 2.0, 30)
                if uy > 25:
                    continue
            t = Fraction(rng.choice([4, 5, 6, 7, 8, 9, 10, 12]), 2)
            h = 5 * t * t - uy * t
            if h.denominator != 1 or not 10 <= h <= 150:
                continue
            top = h + Fraction(uy * uy, 20)
            dist = ux * t
            if not 0.25 <= top / dist <= 1.3:
                continue
            if uy and Fraction(uy * uy, 20) < Fraction(3, 25) * dist:  # a rise too flat to mark α inside it
                continue
            return {"band": "AL", "sub": sub, "obj": obj, "ux": ux, "uy": uy, "form": form, "shown": shown, "h": int(h),
                    "name": rng.choice(NAMES)}
    while True:
        ux, uy, form, shown = _velocity(rng, 0.5, 3.0, 45)
        T = Fraction(uy, 5)
        times = [Fraction(k, 2) for k in range(1, 40) if 0 < Fraction(k, 2) < T and Fraction(k, 2) != Fraction(uy, 10)]
        if not times or ux * uy / 5 > 400:
            continue
        t = rng.choice(times)
        if 0.25 * T <= t <= 0.85 * T:
            return {"band": "AL", "sub": sub, "obj": obj, "ux": ux, "uy": uy, "form": form, "shown": shown,
                    "d": fmt(ux * t), "name": rng.choice(NAMES)}


# --- the mechanics -----------------------------------------------------------------------------------------

def _flight(p: dict) -> Fraction:
    """When the particle comes down to its landing level."""
    ux, uy = p["ux"], p["uy"]
    if p["sub"] == "cliff":
        h = p["h"]
        disc = uy * uy + 20 * h  # 5t^2 - uy t - h = 0
        root = math.isqrt(disc)
        return Fraction(uy + root, 10)
    return Fraction(2 * uy, G)


def _post_time(p: dict) -> Fraction:
    return Fraction(p["d"]) / p["ux"]


# --- drawing -----------------------------------------------------------------------------------------------

def _path(p: dict, t1: Fraction, y0: float, n: int = 120):
    ux, uy = p["ux"], p["uy"]
    ts = [float(t1) * k / n for k in range(n + 1)]
    return [ux * t for t in ts], [y0 + uy * t - 5 * t * t for t in ts]


def _speed_label(p: dict) -> str:
    if p["form"] == "angle":
        return f"{p['shown'][0]} m s⁻¹"
    if p["form"] == "horizontal":
        return f"{p['shown'][0]} m s⁻¹"
    return "u"


def draw(p: dict):
    sub, ux, uy = p["sub"], p["ux"], p["uy"]
    T = _flight(p)
    y0 = p.get("h", 0)
    W = float(ux * T)
    top = y0 + uy * uy / 20
    hx = -0.29 * W  # where a cliff's height is measured, just left of the cliff
    xlo, xhi = (hx - 0.13 * W if sub == "cliff" else -0.16 * W), 1.12 * W
    ylo, yhi = -0.2 * W, top + 0.16 * W
    wd, hd = xhi - xlo, yhi - ylo
    width = 6.6
    fig, ax = new_figure(width, max(2.8, min(6.4, width * hd / wd)))
    xs, ys = _path(p, T, y0)
    ax.plot(xs, ys, color=INK, linewidth=1.8, gid="path")
    ax.plot([0], [y0], "o", color=INK, markersize=5)
    ax.text(-0.03 * W, y0 + 0.03 * W, "O", ha="right", va="bottom", fontsize=12, fontweight="bold", gid="O")
    # the initial velocity, along the path's tangent at O, and the angle it makes with the horizontal
    L = 0.24 * W
    sp = math.hypot(ux, uy)
    ex, ey = L * ux / sp, y0 + L * uy / sp
    arrow(ax, 0, y0, ex, ey, lw=1.8, gid="velocity")
    nx, ny = -uy / sp, ux / sp  # the side of the arrow away from the path (the path bends below it)
    ax.text(ex + 0.035 * W * nx, ey + 0.035 * W * ny, _speed_label(p), ha="right", va="bottom", fontsize=11,
            gid="speed")
    if uy > 0 and p["form"] == "angle":
        r = 0.11 * W
        ang = math.degrees(math.atan2(uy, ux))
        if sub == "cliff":
            ax.plot([0, 0.17 * W], [y0, y0], color=INK, linewidth=0.9, linestyle=(0, (4, 3)), gid="level")
        ax.add_patch(Arc((0, y0), 2 * r, 2 * r, theta1=0, theta2=ang, color=INK, linewidth=1.1))
        mid = math.radians(ang / 2)
        rr = r + 0.045 * W
        ax.text(rr * math.cos(mid), y0 + rr * math.sin(mid), "α", ha="left", va="center", fontsize=12, gid="alpha")
    if sub == "cliff":
        ax.add_patch(Rectangle((-0.22 * W, 0), 0.22 * W, y0, facecolor=FILL_2, edgecolor=INK, linewidth=1.4,
                               gid="behind-cliff"))
        ax.plot([0, 1.12 * W], [0, 0], color=INK, linewidth=1.4, gid="sea")
        for k in range(1, 7):  # ripples on the sea
            sx = 0.08 * W + k * 0.15 * W
            if sx < 1.08 * W and abs(sx - W) > 0.06 * W:
                ax.plot([sx - 0.03 * W, sx, sx + 0.03 * W], [-0.03 * W, -0.015 * W, -0.03 * W], color=INK, linewidth=0.8,
                        gid="ripple")
        ax.text(0.03 * W, -0.035 * W, "F", ha="left", va="top", fontsize=12, fontweight="bold", gid="F")
        ax.text(W, -0.045 * W, "B", ha="center", va="top", fontsize=12, fontweight="bold", gid="B")
        ax.plot([W], [0], "o", color=INK, markersize=5)
        # the height of the cliff, measured beside it
        arrow(ax, hx, y0 / 2, hx, y0, lw=1.0, head=8, gid="h-up")
        arrow(ax, hx, y0 / 2, hx, 0, lw=1.0, head=8, gid="h-down")
        ax.text(hx - 0.02 * W, y0 / 2, f"{p['h']} m", ha="right", va="center", fontsize=11, rotation=90, gid="h")
        ax.text(0.85 * W, -0.11 * W, "sea", ha="center", va="center", fontsize=10, style="italic", gid="sealabel")
    else:
        hatch(ax, -0.12 * W, 0, 1.1 * W, 0, size=0.025 * W)
        ax.plot([W], [0], "o", color=INK, markersize=5)
        ax.text(W + 0.02 * W, 0.03 * W, "A", ha="left", va="bottom", fontsize=12, fontweight="bold", gid="A")
    if sub == "post":
        d = float(Fraction(p["d"]))
        t = _post_time(p)
        yp = float(uy * t - 5 * t * t)
        ax.add_patch(Rectangle((d - 0.008 * W, 0), 0.016 * W, 0.45 * yp, facecolor=INK, edgecolor=INK, linewidth=0.5,
                               gid="behind-post"))
        ax.plot([d, d], [0.45 * yp, yp], color=INK, linewidth=0.9, linestyle=(0, (3, 3)), gid="above-post")
        ax.plot([d], [yp], "o", color=INK, markersize=5)
        rising = t < Fraction(uy, G)  # the label goes on the side of P the path does not climb into
        ax.text(d + (-0.025 if rising else 0.025) * W, yp + 0.025 * W, "P", ha="right" if rising else "left", va="bottom",
                fontsize=12, fontweight="bold", gid="P")
        dy = -0.1 * W
        arrow(ax, d / 2, dy, 0, dy, lw=1.0, head=8, gid="d-left")
        arrow(ax, d / 2, dy, d, dy, lw=1.0, head=8, gid="d-right")
        ax.text(d / 2, dy - 0.02 * W, f"{p['d']} m", ha="center", va="top", fontsize=11, gid="d")
    lines = []
    if p["form"] == "angle":
        lines.append(f"tan α = {p['shown'][1]}/{p['shown'][2]}")
    elif p["form"] == "components":
        lines += ["Initial velocity:", f"{ux} m s⁻¹ horizontally,", f"{uy} m s⁻¹ vertically upwards"]
    else:
        lines.append("projected horizontally")
    lines.append(f"g = {G} m s⁻²")
    ax.text(1.03, 0.98, "\n".join(lines), transform=ax.transAxes, ha="left", va="top", fontsize=10.5, linespacing=1.5,
            bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9}, gid="note")
    ax.set_xlim(xlo, xhi)
    ax.set_ylim(ylo, yhi)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ---------------------------------------------------------------------------------------------

def _height_mcq(stem: str, p: dict, H: Fraction, rng):
    ux, uy = p["ux"], p["uy"]
    wrongs = [Fraction(uy * uy, G), Fraction(ux * ux + uy * uy, 2 * G), Fraction(ux * ux, 2 * G), Fraction(uy, 2)]
    opts = []
    for w in wrongs:
        if w != H and w > 0 and fmt(w) not in opts and fmt(w) != fmt(H):
            opts.append(fmt(w))
    return mcq(stem, f"{fmt(H)} m", [f"{o} m" for o in opts[:3]], rng)


def questions(p: dict, rng: random.Random) -> list:
    sub, ux, uy, o = p["sub"], p["ux"], p["uy"], p["obj"]
    name = p["name"]
    T = _flight(p)
    if sub == "ground":
        lead = rng.choice(GROUND_LEADS).format(n=name, o=o, v=rng.choice(VERBS[o]))
        H = Fraction(uy * uy, 2 * G)
        R = ux * T
        b = Fraction(G, 2 * ux * ux)
        qs = [
            lambda: answer(f"The {o} lands at A on the ground. Find the time, in seconds, that it takes to travel from O to A.",
                           T, "s"),
            lambda: (_height_mcq(f"What is the greatest height of the {o} above the ground?", p, H, rng)
                     if rng.random() < 0.5 else
                     answer(f"Find the greatest height, in metres, that the {o} reaches above the ground.", H, "m")),
            lambda: answer(f"The {o} lands at A on the same horizontal ground as O. Find the distance OA in metres.", R, "m"),
            lambda: answer(f"Taking O as the origin, with x m horizontal and y m vertically up, the path of the {o} is "
                           f"y = ax − bx². Find the value of b.", b),
        ]
    elif sub == "cliff":
        lead = rng.choice(CLIFF_LEADS).format(n=name, o=o, v=rng.choice(VERBS[o]))
        vy = G * T - uy
        qs = [
            lambda: answer(f"The {o} reaches the sea at B. Find the time, in seconds, that it takes to travel from O to B.",
                           T, "s"),
            lambda: answer(f"F is the foot of the cliff and the {o} reaches the sea at B. Find the distance FB in metres.",
                           ux * T, "m"),
            lambda: answer(f"Find the vertical component, in m s⁻¹, of the velocity of the {o} as it reaches the sea at B.",
                           vy, "m/s"),
        ]
        if uy > 0:
            qs.append(lambda: answer(f"Find the greatest height, in metres, of the {o} above the sea.",
                                     p["h"] + Fraction(uy * uy, 2 * G), "m"))
    else:
        lead = rng.choice(POST_LEADS).format(n=name, o=o, v=rng.choice(VERBS[o]))
        t = _post_time(p)
        yP = uy * t - 5 * t * t
        state = "rising" if t < Fraction(uy, G) else "falling"
        qs = [
            lambda: answer(f"P is the point of the path of the {o} vertically above the post. Find the height of P above "
                           f"the ground, in metres.", yP, "m"),
            lambda: answer(f"Find the time, in seconds, that the {o} takes to travel from O to the point P above the post.",
                           t, "s"),
            lambda: mcq(f"As the {o} passes through the point P above the post, is it rising or falling?", state,
                        [s for s in ("rising", "falling", "at its highest point") if s != state], rng),
        ]
    order = rng.sample(range(len(qs)), 3)
    out = [qs[i]() for i in order]
    out[0].stem = f"{lead} {out[0].stem}"
    return out
