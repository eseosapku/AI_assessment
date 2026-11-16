"""Momentum at AS Level (AL): Cambridge AS & A Level Physics Chapter 6 "Momentum". Three kinds:

- collision: two trolleys on a straight runway, drawn before and after they collide, each with its mass and its
  velocity as an arrow and a speed (or "at rest"). They bounce apart elastically, bounce with some energy lost, or
  stick together; one speed after the collision is a question mark, its arrow drawn the way it moves. Asks that speed
  (by conservation of momentum), the total momentum before, and the kinetic energy lost;
- explosion: two trolleys at rest with a compressed spring between them, pushed apart; one speed after is hidden.
  Asks it, the momentum of trolley A afterwards and the kinetic energy the spring gave them;
- impulse: a force–time graph of a kick or hit with its corners on gridline crossings, the ball's mass and speed
  before printed above it. Asks the impulse (the area), the ball's speed afterwards and the average force.

Collisions follow Newton's rule with a coefficient of restitution of 1, 0.5 or 0: the trolleys close, then separate
(or move together), so the after-picture is always one a real runway could give.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import GRID, INK, NAMES, exact, measure, new_figure, short

ID = "momentum_collision"
KIND = "physics.force"
SUBJECT = "physics"
BANDS = ("AL",)
CONCEPTS = tuple(f"physics.{c}" for c in ("linear-momentum-and-impulse", "momentum-conservation", "collisions",
                                           "kinetic-energy"))
NEEDS = r"momentum|collision|impulse|explosion"
AVOID = r"glossary"
MASSES = ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "4.0"]
BALLS = {"football": ("a football", ["0.40", "0.45"]), "volleyball": ("a volleyball", ["0.25", "0.27"]),
         "basketball": ("a basketball", ["0.60", "0.62"]), "hockey": ("a hockey ball", ["0.16"])}


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"collision": CONCEPTS, "explosion": CONCEPTS[:2] + CONCEPTS[3:],
            "impulse": ("physics.linear-momentum-and-impulse",)}[p["kind"]]


def _tenths(v: Fraction) -> bool:
    return (v * 10).denominator == 1


def _collision(rng: random.Random) -> dict:
    while True:
        mA, mB = (Fraction(rng.choice(MASSES)) for _ in range(2))
        uA = Fraction(rng.randint(1, 8), 2)
        uB = Fraction(rng.randint(-6, 6), 2)
        e = Fraction(rng.choice(["0", "0.5", "1"]))
        if uB >= uA or mA * uA + mB * uB <= 0:
            continue
        p0 = mA * uA + mB * uB
        vA = (p0 - mB * e * (uA - uB)) / (mA + mB)
        vB = (p0 + mA * e * (uA - uB)) / (mA + mB)
        if not (_tenths(vA) and _tenths(vB)) or max(abs(vA), abs(vB)) > 5:
            continue
        lost = (mA * uA ** 2 + mB * uB ** 2 - mA * vA ** 2 - mB * vB ** 2) / 2
        hide = "vB" if e == 0 else rng.choice(["vA", "vB"])
        if (vA if hide == "vA" else vB) == 0 or (lost * 1000).denominator != 1:
            continue
        return {"band": "AL", "kind": "collision", "mA": f"{float(mA):.1f}", "mB": f"{float(mB):.1f}", "uA": exact(uA),
                "uB": exact(uB),
                "vA": exact(vA), "vB": exact(vB), "e": exact(e), "hide": hide}


def _explosion(rng: random.Random) -> dict:
    while True:
        mA, mB = (Fraction(rng.choice(MASSES)) for _ in range(2))
        if mA == mB:
            continue
        vA = Fraction(rng.randint(1, 8), 2)
        vB = mA * vA / mB
        if not _tenths(vB) or vB > 5 or ((mA * vA ** 2 + mB * vB ** 2) / 2 * 1000).denominator != 1:
            continue
        return {"band": "AL", "kind": "explosion", "mA": f"{float(mA):.1f}", "mB": f"{float(mB):.1f}", "vA": exact(vA),
                "vB": exact(vB), "hide": rng.choice(["A", "B"])}


def _impulse(rng: random.Random) -> dict:
    ball = rng.choice(list(BALLS))
    while True:
        ts, fs = rng.choice([1, 2, 5]), rng.choice([50, 100, 200, 250])
        if rng.random() < 0.5:
            tp = rng.randint(2, 6)
            T = tp + rng.randint(2, 6)
            pts = [[0, 0], [tp, rng.randint(4, 8)], [T, 0]]
        else:
            t1 = rng.randint(1, 4)
            t2 = t1 + rng.randint(1, 4)
            T = t2 + rng.randint(1, 4)
            F = rng.randint(4, 8)
            pts = [[0, 0], [t1, F], [t2, F], [T, 0]]
        if T > 12:
            continue
        m = Fraction(rng.choice(BALLS[ball][1]))
        u = Fraction(rng.choice(["0", "0", "1.5", "2.0", "3.0"]))
        J = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:])) * ts * fs / 1000
        v = u + J / m
        avg = J / (Fraction(T * ts, 1000))
        if not (3 <= v <= 40) or (v * 100).denominator != 1 or (avg * 100).denominator != 1 or (J * 1000).denominator != 1:
            continue
        return {"band": "AL", "kind": "impulse", "ball": ball, "m": f"{float(m):.2f}", "u": exact(u), "tstep": ts,
                "fstep": fs, "pts": pts}


def sample(rng: random.Random) -> dict:
    return {"collision": _collision, "explosion": _explosion, "impulse": _impulse}[
        rng.choice(["collision", "collision", "explosion", "impulse"])](rng)


# --- drawing ------------------------------------------------------------------------------------------------------

def _speed(v: Fraction) -> str:
    return f"{exact(abs(v))} m s⁻¹"


def _trolley(ax, x: float, y: float, letter: str, mass: str, w: float = 1.7) -> None:
    ax.add_patch(Rectangle((x, y + 0.22), w, 0.78, facecolor="#d6dade", edgecolor=INK, linewidth=1.3, zorder=3))
    for cx in (x + 0.32, x + w - 0.32):
        ax.add_patch(Circle((cx, y + 0.16), 0.16, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=4))
    ax.text(x + w / 2, y + 0.61, f"{letter}  {mass} kg", ha="center", va="center", fontsize=10.5, fontweight="bold", zorder=5)


def _arrow(ax, cx: float, y: float, v: Fraction | None, text: str, gid: str) -> None:
    """A velocity arrow above a trolley, pointing the way it moves, its speed above; "at rest" when it is still."""
    if v == 0:
        ax.text(cx, y + 0.42, "at rest", ha="center", va="center", fontsize=10.5)
        return
    d = 1 if v > 0 else -1
    ax.annotate("", xy=(cx + d * 0.6, y), xytext=(cx - d * 0.6, y), gid=f"{gid}:{'right' if d > 0 else 'left'}",
                arrowprops={"arrowstyle": "-|>", "color": INK, "linewidth": 1.6, "mutation_scale": 14})
    ax.text(cx, y + 0.42, text, ha="center", va="center", fontsize=10.5)


def _draw_runway(p: dict):
    fig, ax = new_figure(7.4, 5.2)
    ax.set_position([0.01, 0.01, 0.98, 0.98])
    for y0, title in ((4.3, "Before"), (0.4, "After")):
        ax.plot([0.2, 9.8], [y0, y0], color=INK, linewidth=1.4, zorder=2)
        ax.text(0.2, y0 + 2.75, title, ha="left", va="center", fontsize=12, fontweight="bold")
    W = 1.7
    if p["kind"] == "collision":
        uA, uB, vA, vB = (Fraction(p[k]) for k in ("uA", "uB", "vA", "vB"))
        _trolley(ax, 1.4, 4.3, "A", p["mA"])
        _trolley(ax, 6.4, 4.3, "B", p["mB"])
        _arrow(ax, 1.4 + W / 2, 4.3 + 1.45, uA, _speed(uA), "arrow:uA")
        _arrow(ax, 6.4 + W / 2, 4.3 + 1.45, uB, _speed(uB), "arrow:uB")
        if p["e"] == "0":
            _trolley(ax, 3.4, 0.4, "A", p["mA"])
            _trolley(ax, 3.4 + W, 0.4, "B", p["mB"])
            ax.text(3.4 + W, 0.4 + 2.35, "stuck together", ha="center", va="center", fontsize=10)
            _arrow(ax, 3.4 + W, 0.4 + 1.45, vB, "v = ?", "arrow:vB")
        else:
            _trolley(ax, 2.4, 0.4, "A", p["mA"])
            _trolley(ax, 6.4, 0.4, "B", p["mB"])
            _arrow(ax, 2.4 + W / 2, 0.4 + 1.45, vA, "v = ?" if p["hide"] == "vA" else _speed(vA), "arrow:vA")
            _arrow(ax, 6.4 + W / 2, 0.4 + 1.45, vB, "v = ?" if p["hide"] == "vB" else _speed(vB), "arrow:vB")
    else:
        vA, vB = Fraction(p["vA"]), Fraction(p["vB"])
        _trolley(ax, 2.6, 4.3, "A", p["mA"])
        _trolley(ax, 5.7, 4.3, "B", p["mB"])
        xs = [2.6 + W, 2.6 + W + 0.3, 2.6 + W + 0.5, 2.6 + W + 0.7, 2.6 + W + 0.9, 2.6 + W + 1.1, 2.6 + W + 1.4]
        ax.plot(xs, [4.9, 4.9, 4.7, 5.1, 4.7, 5.1, 4.9], color=INK, linewidth=1.2, zorder=2)  # the spring
        ax.text(5.0, 4.3 + 1.6, "both at rest; spring compressed", ha="center", va="center", fontsize=10.5)
        _trolley(ax, 1.2, 0.4, "A", p["mA"])
        _trolley(ax, 7.0, 0.4, "B", p["mB"])
        _arrow(ax, 1.2 + W / 2, 0.4 + 1.45, -vA, "v = ?" if p["hide"] == "A" else _speed(vA), "arrow:vA")
        _arrow(ax, 7.0 + W / 2, 0.4 + 1.45, vB, "v = ?" if p["hide"] == "B" else _speed(vB), "arrow:vB")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7.4)
    ax.axis("off")
    return fig


def _draw_impulse(p: dict):
    name, _ = BALLS[p["ball"]]
    ts, fs, pts = p["tstep"], p["fstep"], p["pts"]
    fig, ax = new_figure(6.4, 4.8)
    T, Fm = pts[-1][0], max(f for _, f in pts)
    xmax, ymax = T + 2, Fm + 2
    ax.set_xticks([i * ts for i in range(0, xmax + 1)])
    ax.set_xticks([i * ts / 2 for i in range(0, 2 * xmax + 1)], minor=True)
    ax.set_yticks([i * fs for i in range(0, ymax + 1)])
    ax.set_yticks([i * fs / 2 for i in range(0, 2 * ymax + 1)], minor=True)
    ax.grid(True, which="major", color="#a8a8a8", linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.4)
    ax.set_axisbelow(True)
    ax.set_xlim(0, xmax * ts)
    ax.set_ylim(0, ymax * fs)
    ax.add_patch(Polygon([(t * ts, f * fs) for t, f in pts], closed=True, facecolor="#dfe5ea", edgecolor="none", zorder=1))
    ax.plot([t * ts for t, _ in pts], [f * fs for _, f in pts], color=INK, linewidth=1.9, zorder=3)
    ax.set_xlabel("time / ms", fontsize=11)
    ax.set_ylabel("force / N", fontsize=11)
    ax.tick_params(labelsize=9)
    u = Fraction(p["u"])
    before = "at rest before it is struck" if u == 0 else f"moving at {exact(u)} m s⁻¹ in the direction of the force before it is struck"
    ax.set_title(f"{name[0].upper() + name[1:]} of mass {p['m']} kg,\n{before}", fontsize=10.5, pad=12)
    return fig


def draw(p: dict):
    return _draw_impulse(p) if p["kind"] == "impulse" else _draw_runway(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a physics lesson", "for an AS Level homework", "in the school laboratory", "for a revision exercise",
            "at the science club", "in a practical in Musanze", "for a class test in Kigali", "while revising momentum"]
SPEEDS = ["m/s", "m s^-1", "ms-1", "metres per second"]
MOMENTUM = ["kg m s⁻¹", "kg m/s", "kg m s^-1", "kgms-1", "N s", "Ns"]


def _with(v: Fraction, unit: str, extra=()) -> list[str]:
    forms = measure(v, unit)
    for u in extra:
        for f in (f"{exact(v)} {u}", f"{exact(v)}{u}"):
            if f not in forms:
                forms.append(f)
    return forms


def _collision_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    mA, mB, uA, uB, vA, vB = (Fraction(p[k]) for k in ("mA", "mB", "uA", "uB", "vA", "vB"))
    total = mA * uA + mB * uB
    lost = (mA * uA ** 2 + mB * uB ** 2 - mA * vA ** 2 - mB * vB ** 2) / 2
    if p["e"] == "0":
        speed, whose = abs(vB), "the two trolleys, stuck together,"
    elif p["hide"] == "vA":
        speed, whose = abs(vA), "trolley A"
    else:
        speed, whose = abs(vB), "trolley B"
    return [
        short(f"{who} watched two trolleys collide on a runway {rng.choice(SETTINGS)}. Using conservation of momentum, "
              f"what is the speed v of {whose} after the collision?", exact(speed), _with(speed, "m s⁻¹", SPEEDS)),
        short("Taking the direction to the right as positive, what is the total momentum of trolleys A and B before "
              "they collide?", exact(total), _with(total, "kg m s⁻¹", MOMENTUM[1:])),
        short("How much kinetic energy is lost when trolleys A and B collide?", exact(lost), _with(lost, "J")),
    ]


def _explosion_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    mA, mB, vA, vB = (Fraction(p[k]) for k in ("mA", "mB", "vA", "vB"))
    hidden = vA if p["hide"] == "A" else vB
    ke = (mA * vA ** 2 + mB * vB ** 2) / 2
    return [
        short(f"{who} released two trolleys pushed apart by a spring {rng.choice(SETTINGS)}. Using conservation of "
              f"momentum, what is the speed v of trolley {p['hide']} after they spring apart?", exact(hidden),
              _with(hidden, "m s⁻¹", SPEEDS)),
        short("What is the size of the momentum of trolley A after the spring pushes the trolleys apart?",
              exact(mA * vA), _with(mA * vA, "kg m s⁻¹", MOMENTUM[1:])),
        short("How much kinetic energy did the spring give trolleys A and B altogether?", exact(ke), _with(ke, "J")),
    ]


def _impulse_questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    name, _ = BALLS[p["ball"]]
    pts, ts, fs = p["pts"], p["tstep"], p["fstep"]
    J = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:])) * ts * fs / 1000
    m, u = Fraction(p["m"]), Fraction(p["u"])
    v = u + J / m
    avg = J / Fraction(pts[-1][0] * ts, 1000)
    the = "the " + name.split(" ", 1)[1]
    return [
        short(f"{who} measured the force on {name} while it was struck {rng.choice(SETTINGS)}. What is the impulse of "
              f"the force on {the}?", exact(J), _with(J, "N s", ["Ns", "kg m s⁻¹", "kg m/s"])),
        short(f"What is the speed of {the} just after it leaves contact, according to the force–time graph?", exact(v),
              _with(v, "m s⁻¹", SPEEDS)),
        short(f"What is the average force on {the} over the whole time of contact shown on the force–time graph?",
              exact(avg), _with(avg, "N")),
    ]


def questions(p: dict, rng: random.Random) -> list:
    return {"collision": _collision_questions, "explosion": _explosion_questions,
            "impulse": _impulse_questions}[p["kind"]](p, rng)
