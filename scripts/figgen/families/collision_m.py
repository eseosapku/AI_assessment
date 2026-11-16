"""Momentum (AL, Further Mathematics "Momentum"): smooth spheres colliding directly, and a sphere striking a smooth wall.

Three kinds of figure:
- momentum: spheres A and B on a straight line, before and after a direct collision; masses and speeds printed, one
  speed after the collision unknown (v, its direction drawn). The unknown speed, the impulse on a sphere, the loss of
  kinetic energy, the coefficient of restitution.
- restitution: the same before the collision, with the coefficient of restitution e printed; after it, both velocities
  v_A and v_B are drawn to the right (a negative value is a move to the left). v_B, the speed of A, the direction A
  moves, the loss of kinetic energy.
- wall: a smooth sphere strikes a smooth fixed vertical wall, its speed and tan θ (θ the angle between its path and the
  wall) printed with e. The speed just after the impact, tan β for the angle after it, the impulse from the wall, the
  loss of kinetic energy.

Velocities are whole or half metres per second; every key is exact.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Arc, Circle

from ..core import FILL_2, INK, NAMES, mcq, new_figure
from ._mech import answer, arrow, fmt, hatch

ID = "collision_m"
KIND = "physics.force"
SUBJECT = "mathematics"
BANDS = ("AL",)
CONCEPTS = ("mathematics.impulse-momentum", "mathematics.oblique-collisions", "mathematics.mechanics")
NEEDS = r"momentum|collision|impulse"
AVOID = r"^(?!.*(momentum|collision|impulse))"  # only the chapter named for it (Circular motion carries impulse too)

ES = [Fraction(0), Fraction(1, 4), Fraction(1, 3), Fraction(1, 2), Fraction(2, 3), Fraction(3, 4), Fraction(1)]
WALL_ES = [Fraction(1, 5), Fraction(1, 4), Fraction(2, 5), Fraction(1, 2), Fraction(3, 5), Fraction(3, 4), Fraction(4, 5)]
TRIPLES = [(3, 4, 5), (4, 3, 5), (5, 12, 13), (12, 5, 13), (8, 15, 17), (15, 8, 17)]
MASSES = [Fraction(1, 2), Fraction(1), Fraction(3, 2), Fraction(2), Fraction(5, 2), Fraction(3), Fraction(4), Fraction(5),
          Fraction(6)]
WALL_MASSES = [Fraction(1, 5), Fraction(1, 4), Fraction(2, 5), Fraction(1, 2), Fraction(1), Fraction(3, 2), Fraction(2),
               Fraction(3)]
LEADS = ["{n} watches two smooth spheres A and B collide directly on a smooth horizontal table.",
         "{n} rolls a smooth sphere A into a smooth sphere B; they collide directly on a smooth horizontal surface.",
         "{n} records a direct collision between two smooth spheres A and B moving along a straight line.",
         "{n} studies two smooth spheres A and B, of equal radius, that collide directly on a smooth floor."]
WALL_LEADS = ["{n} rolls a smooth sphere across a smooth horizontal floor into a smooth vertical wall.",
              "{n} watches a smooth sphere on a smooth horizontal surface strike a smooth fixed vertical wall.",
              "{n} sends a smooth sphere sliding on a smooth horizontal table into a smooth vertical wall."]


def _half(x: Fraction) -> bool:
    return (2 * x).denominator == 1


def _after(m1, m2, u1, u2, e):
    """Velocities after a direct collision (to the right positive), by momentum and Newton's experimental law."""
    v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / (m1 + m2)
    return v1, v1 + e * (u1 - u2)


def _wall_cases():
    out = []
    for a, b, c in TRIPLES:
        for k in range(1, 30 // c + 1):  # at most 30 m/s
            par, perp = k * a, k * b  # along the wall, towards the wall
            for e in WALL_ES:
                w2 = par * par + (e * perp) ** 2
                rn, rd = math.isqrt(w2.numerator), math.isqrt(w2.denominator)
                if _half(e * perp) and e * b >= Fraction(3, 10) * a:  # β wide enough to mark (θ is wider)
                    out.append((a, b, c, k, e, rn * rn == w2.numerator and rd * rd == w2.denominator))
    return out


WALL_CASES = _wall_cases()


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["momentum", "restitution", "wall"])
    name = rng.choice(NAMES)
    if sub == "wall":
        a, b, c, k, e, _ = rng.choice(WALL_CASES)
        m = rng.choice(WALL_MASSES)
        return {"band": "AL", "sub": sub, "m": fmt(m), "speed": k * c, "tan": [b, a], "e": str(e), "name": name}
    while True:
        m1, m2 = rng.choice(MASSES), rng.choice(MASSES)
        u1 = Fraction(rng.randint(2, 12))
        u2 = Fraction(rng.randint(-8, int(u1) - 1))
        e = rng.choice(ES if sub == "momentum" else ES[1:])
        v1, v2 = _after(m1, m2, u1, u2, e)
        if not (_half(v1) and _half(v2)) or abs(v1) > 15 or abs(v2) > 15:
            continue
        if sub == "momentum":
            unknown = rng.choice(["A", "B"])
            if (v1 if unknown == "A" else v2) == 0:
                continue
        else:
            unknown = "both"
            if v2 <= 0:
                continue
        return {"band": "AL", "sub": sub, "m": [fmt(m1), fmt(m2)], "u": [fmt(u1), fmt(u2)], "v": [fmt(v1), fmt(v2)],
                "e": str(e), "unknown": unknown, "name": name}


# --- drawing -----------------------------------------------------------------------------------------------

def _velocity(ax, x: float, y: float, v: Fraction, label: str, gid: str) -> None:
    """A sphere's velocity drawn above it: an arrow its way with its speed, or "at rest"."""
    if v == 0 and label is None:
        ax.text(x, y + 0.15, "at rest", ha="center", va="bottom", fontsize=11, gid=gid)
        return
    d = 1 if v >= 0 else -1
    arrow(ax, x - 0.55 * d, y, x + 0.55 * d, y, lw=1.6, gid=gid + ":arrow")
    ax.text(x, y + 0.14, label if label is not None else f"{fmt(abs(v))} m s⁻¹", ha="center", va="bottom", fontsize=11,
            gid=gid)


def _row(ax, y: float, p: dict, vels, labels, title: str) -> None:
    ax.text(-0.3, y + 0.45, title, ha="left", va="center", fontsize=12, fontweight="bold", gid=f"title:{title}")
    ax.plot([1.7, 8.8], [y - 0.5, y - 0.5], color=INK, linewidth=1.2, gid=f"floor:{title}")
    for i, (x, letter) in enumerate(((3.6, "A"), (6.6, "B"))):
        ax.add_patch(Circle((x, y), 0.5, facecolor=FILL_2, edgecolor=INK, linewidth=1.5))
        ax.text(x, y, letter, ha="center", va="center", fontsize=13, fontweight="bold", gid=f"sphere:{title}:{letter}")
        if title == "Before":
            ax.text(x, y - 0.62, f"{p['m'][i]} kg", ha="center", va="top", fontsize=11, gid=f"mass:{letter}")
        _velocity(ax, x, y + 0.9, vels[i], labels[i], f"vel:{title}:{letter}")


def _draw_line(p: dict):
    fig, ax = new_figure(7.2, 5.0)
    u = [Fraction(x) for x in p["u"]]
    v = [Fraction(x) for x in p["v"]]
    _row(ax, 3.4, p, u, [None, None], "Before")
    if p["sub"] == "momentum":
        labels = ["v m s⁻¹" if p["unknown"] == "A" else None, "v m s⁻¹" if p["unknown"] == "B" else None]
        _row(ax, 0.6, p, v, labels, "After")
        ax.set_ylim(-0.4, 4.9)
    else:
        _row(ax, 0.6, p, [Fraction(1), Fraction(1)], ["$v_A$ m s⁻¹", "$v_B$ m s⁻¹"], "After")
        ax.text(5.1, -0.25, f"coefficient of restitution e = {p['e']}", ha="center", va="center", fontsize=11, gid="e")
        ax.text(5.1, -0.65, "velocities after the collision are drawn to the right", ha="center", va="center",
                fontsize=10, style="italic", gid="sign")
        ax.set_ylim(-1.0, 4.9)
    ax.set_xlim(-0.4, 9.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_wall(p: dict):
    fig, ax = new_figure(6.4, 5.4)
    b, a = p["tan"]  # tan θ = b / a: towards the wall over along it
    e = Fraction(p["e"])
    hatch(ax, 0, -3.4, 0, 3.4, side=-1, size=0.3, gid="wall")
    L = 3.0
    s = math.hypot(a, b)
    # in: from below left up to the impact point I at the origin; out: up and to the left, its slope e times flatter
    ix, iy = -L * b / s, -L * a / s
    ax.plot([ix, 0], [iy, 0], color=INK, linewidth=1.4, gid="path-in")
    arrow(ax, ix * 0.62, iy * 0.62, ix * 0.38, iy * 0.38, lw=1.6, gid="in")
    so = math.hypot(a, float(e) * b)
    ox, oy = -L * float(e) * b / so, L * a / so
    ax.plot([0, ox], [0, oy], color=INK, linewidth=1.4, linestyle=(0, (5, 3)), gid="path-out")
    arrow(ax, ox * 0.38, oy * 0.38, ox * 0.62, oy * 0.62, lw=1.6, gid="out")
    ax.add_patch(Circle((ix, iy), 0.3, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
    ax.plot([0], [0], "o", color=INK, markersize=4)
    ax.text(-0.3, 0.0, "I", ha="right", va="center", fontsize=12, fontweight="bold", gid="I")
    # θ between the path in and the wall (below I), β between the path out and the wall (above I)
    th = math.degrees(math.atan2(b, a))
    r = 1.0
    ax.add_patch(Arc((0, 0), 2 * r, 2 * r, theta1=270 - th, theta2=270, color=INK, linewidth=1.1))
    mid = math.radians(270 - th / 2)
    ax.text(1.35 * r * math.cos(mid), 1.35 * r * math.sin(mid), "θ", ha="center", va="center", fontsize=12, gid="theta")
    bt = math.degrees(math.atan2(float(e) * b, a))
    ax.add_patch(Arc((0, 0), 2 * r, 2 * r, theta1=90, theta2=90 + bt, color=INK, linewidth=1.1))
    mid = math.radians(90 + bt / 2)
    ax.text(1.35 * r * math.cos(mid), 1.35 * r * math.sin(mid), "β", ha="center", va="center", fontsize=12, gid="beta")
    sx, sy = ix * 0.5, iy * 0.5
    ax.text(sx - 0.35, sy + 0.1, f"{p['speed']} m s⁻¹", ha="right", va="bottom", fontsize=11, gid="speed")
    ax.text(0.02, 0.98, "\n".join([f"mass {p['m']} kg", f"tan θ = {b}/{a}", f"e = {p['e']}"]), transform=ax.transAxes,
            ha="left", va="top", fontsize=11, linespacing=1.5, gid="note",
            bbox={"boxstyle": "round,pad=0.4", "facecolor": "white", "edgecolor": INK, "linewidth": 0.9})
    ax.text(0.0, 3.6, "smooth wall", ha="center", va="bottom", fontsize=10, style="italic", gid="walllabel")
    ax.set_xlim(-4.2, 2.9)
    ax.set_ylim(-3.75, 4.1)  # the wall's lowest hatch stroke reaches below -3.6
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_wall(p) if p["sub"] == "wall" else _draw_line(p)


# --- questions ---------------------------------------------------------------------------------------------

def _ke(ms, vs) -> Fraction:
    return sum(Fraction(1, 2) * m * v * v for m, v in zip(ms, vs))


def questions(p: dict, rng: random.Random) -> list:
    name = p["name"]
    if p["sub"] == "wall":
        lead = rng.choice(WALL_LEADS).format(n=name)
        b, a = p["tan"]
        e, m, U = Fraction(p["e"]), Fraction(p["m"]), p["speed"]
        k = Fraction(U, math.isqrt(a * a + b * b))
        par, perp = k * a, k * b
        w2 = par * par + (e * perp) ** 2
        w = Fraction(math.isqrt(w2.numerator), math.isqrt(w2.denominator))
        qs = [
            lambda: answer("After the impact the sphere moves at an angle β to the wall. Find the value of tan β.", e * perp / par),
            lambda: answer("Find the magnitude, in N s, of the impulse that the wall exerts on the sphere at I.",
                           m * perp * (1 + e), "N s"),
            lambda: answer("Find the kinetic energy, in joules, that the sphere loses in its impact with the wall.",
                           Fraction(1, 2) * m * perp * perp * (1 - e * e), "J"),
        ]
        if w * w == w2:  # the speed after the impact only where it is exact
            qs.append(lambda: answer("The sphere strikes the wall at I. Find its speed, in m s⁻¹, just after the impact.",
                                     w, "m/s"))
    else:
        lead = rng.choice(LEADS).format(n=name)
        m1, m2 = (Fraction(x) for x in p["m"])
        u1, u2 = (Fraction(x) for x in p["u"])
        v1, v2 = (Fraction(x) for x in p["v"])
        loss = _ke([m1, m2], [u1, u2]) - _ke([m1, m2], [v1, v2])
        if p["sub"] == "momentum":
            X = p["unknown"]
            other = "B" if X == "A" else "A"
            mo, uo, vo = (m2, u2, v2) if other == "B" else (m1, u1, v1)
            qs = [
                lambda: answer(f"After the collision sphere {X} moves with speed v m s⁻¹ as shown. Find v.",
                               abs(v1 if X == "A" else v2), "m/s"),
                lambda: answer(f"Find the magnitude, in N s, of the impulse that sphere {other} receives in the collision.",
                               mo * abs(vo - uo), "N s"),
                (lambda: answer("Find the loss of kinetic energy, in joules, in the collision between A and B.", loss, "J"))
                if loss else None,
                lambda: answer("Find the coefficient of restitution between spheres A and B.", (v2 - v1) / (u1 - u2)),
            ]
        else:
            way = "right" if v1 > 0 else "left" if v1 < 0 else "rest"
            choices = {"right": "A moves to the right", "left": "A moves to the left", "rest": "A is at rest"}
            qs = [
                lambda: answer("After the collision B moves to the right with velocity v_B m s⁻¹. Find v_B.", v2, "m/s"),
                lambda: answer("Find the speed, in m s⁻¹, of sphere A just after the collision.", abs(v1), "m/s"),
                lambda: mcq("Just after the collision, which of these is true of sphere A?", choices[way],
                            [c for k_, c in choices.items() if k_ != way], rng),
                (lambda: answer("Find the kinetic energy, in joules, lost in the collision between spheres A and B.", loss,
                                "J")) if loss else None,
            ]
    qs = [q for q in qs if q is not None]  # no "loss of kinetic energy" in a perfectly elastic collision
    order = rng.sample(range(len(qs)), 3)
    out = [qs[i]() for i in order]
    out[0].stem = f"{lead} {out[0].stem}"
    return out
