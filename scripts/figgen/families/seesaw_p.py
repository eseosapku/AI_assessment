"""A seesaw (Primary): a plank on a pivot, marks 1 to 4 on each side counted from the middle, children or bags of
maize sitting at the marks with their masses printed. The plank is drawn level: the pupil works out what it does.

Two sub-types. Tip: loads on both sides; which end goes down, or does it balance. Place: loads on one side and a
child (or a bag) waiting beside the empty side; at which mark must it sit to balance the seesaw.

Lower level (P1 to P3): one load a side, and only one thing differs: the same mass at different marks (the one
further out goes down), different masses at the same mark (the heavier goes down), or neither (it balances). A
waiting child has the same mass as the one on the seesaw, so sits at the same mark. Upper level (P4 to P6): the
stem gives the rule, turning effect = mass × mark number, never the word moment; one or two loads a side, and often
the heavier-looking side is the one that goes up. Either way the two sides differ by at least 10 (kg × marks), or
balance exactly; masses are whole multiples of 5 kg.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "seesaw_p"
KIND = "physics.force"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.simple-machines", "science.forces-and-motion")
# A topic whose sections the book lists is reached only if one names simple machines, levers or balancing.
NEEDS = r"simple machine|lever|see-?saw|balanc"

END = {1: "The right end goes down", -1: "The left end goes down", 0: "It balances"}
RULE = "Turning effect = mass × mark number."
CHILD = (20, 40)  # kg, in fives
BAG = (10, 30)


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["level"] == "upper" else None


def _turn(loads) -> int:
    return sum(mark * mass for mark, mass, _ in loads)


def _masses(rng, loads, k):
    lo, hi = CHILD if loads == "children" else BAG
    return [5 * rng.randint(lo // 5, hi // 5) for _ in range(k)]


def _marks(rng, k):
    """k marks on one side, two apart at least, so two loads' labels never meet."""
    return sorted(rng.choice([[1], [2], [3], [4]] if k == 1 else [[1, 3], [2, 4], [1, 4]]))


def _labels(rng, loads, k):
    return rng.sample(NAMES, k) if loads == "children" else [f"bag {c}" for c in "PQRST"[:k]]


def _lower_tip(rng, loads):
    case = rng.choice(["mark", "mass", "balance"])
    while True:
        lw, rw = _masses(rng, loads, 2)
        lm, rm = rng.randint(1, 4), rng.randint(1, 4)
        if case == "mark" and lw == rw and lm != rm:
            break
        if case == "mass" and lm == rm and abs(lw - rw) >= 10:
            break
        if case == "balance" and lw == rw and lm == rm and lm < 4:  # room to move further out
            break
    a, b = _labels(rng, loads, 2)
    return [[lm, lw, a]], [[rm, rw, b]]


def _upper_tip(rng, loads):
    balance = rng.random() < 0.3
    tricky = rng.random() < 0.6  # the side with more kilograms on it goes up
    while True:
        nl, nr = rng.choice([(1, 1), (1, 2), (2, 1), (2, 2)])
        labels = _labels(rng, loads, nl + nr)
        left = [[mk, w, nm] for mk, w, nm in zip(_marks(rng, nl), _masses(rng, loads, nl), labels)]
        right = [[mk, w, nm] for mk, w, nm in zip(_marks(rng, nr), _masses(rng, loads, nr), labels[nl:])]
        L, R = _turn(left), _turn(right)
        if balance:
            if L == R:
                return left, right
            continue
        if abs(L - R) < 10:
            continue
        down_kg = sum(w for _, w, _ in (left if L > R else right))
        up_kg = sum(w for _, w, _ in (right if L > R else left))
        if not tricky or down_kg < up_kg:
            return left, right


def _place(rng, loads, level):
    while True:
        n = 1 if level == "lower" else rng.choice([1, 2])
        labels = _labels(rng, loads, n + 1)
        side = [[mk, w, nm] for mk, w, nm in zip(_marks(rng, n), _masses(rng, loads, n), labels)]
        need = _turn(side)
        if level == "lower":
            mass = side[0][1]
        else:
            lo, hi = CHILD if loads == "children" else BAG
            fits = [w for w in range(lo, hi + 1, 5) if need % w == 0 and 1 <= need // w <= 4]
            if not fits:
                continue
            mass = rng.choice(fits)
        newcomer = [labels[n], mass]
        return (side, [], newcomer) if rng.random() < 0.5 else ([], side, newcomer)


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    kind = rng.choice(["tip", "place"])
    loads = rng.choice(["children", "bags"])
    if kind == "tip":
        left, right = (_lower_tip if level == "lower" else _upper_tip)(rng, loads)
        newcomer = None
    else:
        left, right, newcomer = _place(rng, loads, level)
    return {"band": "P", "level": level, "kind": kind, "loads": loads, "left": left, "right": right, "newcomer": newcomer}


# --- drawing ---------------------------------------------------------------------------------------------

PLANK_Y, PLANK_T = 1.3, 0.2


def _label(nm: str) -> str:
    return nm[0].upper() + nm[1:]


def _child_on(ax, x, nm, mass, y0):
    """A child sitting at x on a surface at height y0, the name and mass above the head."""
    ax.add_patch(Rectangle((x - 0.25, y0), 0.5, 0.68, facecolor=FILL_2, edgecolor=INK, linewidth=1.4, zorder=4))
    for sx in (-1, 1):  # arms
        ax.plot([x + sx * 0.25, x + sx * 0.45], [y0 + 0.55, y0 + 0.12], color=INK, linewidth=2.0, zorder=4)
    ax.add_patch(Circle((x, y0 + 0.93), 0.25, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.text(x, y0 + 1.82, _label(nm), ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(x, y0 + 1.45, f"{mass} kg", ha="center", va="center", fontsize=11)


def _child_standing(ax, x, nm, mass):
    ax.plot([x - 0.15, x, x + 0.15], [0, 0.65, 0], color=INK, linewidth=2.0, zorder=3)
    _child_on(ax, x, nm, mass, 0.62)


def _bag_on(ax, x, nm, mass, y0):
    ax.add_patch(Polygon([(x - 0.45, y0), (x + 0.45, y0), (x + 0.4, y0 + 0.72), (x + 0.14, y0 + 0.92), (x - 0.14, y0 + 0.92),
                          (x - 0.4, y0 + 0.72)], closed=True, facecolor="#e4dccb", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.plot([x - 0.17, x + 0.17], [y0 + 0.8, y0 + 0.8], color=INK, linewidth=1.6, zorder=5)
    ax.text(x, y0 + 1.62, _label(nm), ha="center", va="center", fontsize=11, fontweight="bold")
    ax.text(x, y0 + 1.25, f"{mass} kg", ha="center", va="center", fontsize=11)


def draw(p: dict):
    wide = 6.7 if p["newcomer"] else 5.0
    fig, ax = new_figure(0.56 * 2 * wide, 0.56 * 4.05)
    ax.plot([-wide + 0.1, wide - 0.1], [0, 0], color=INK, linewidth=1.4)
    ax.add_patch(Polygon([(0, PLANK_Y), (-0.6, 0), (0.6, 0)], closed=True, facecolor=FILL, edgecolor=INK, linewidth=1.4, zorder=2))
    ax.add_patch(Rectangle((-4.6, PLANK_Y), 9.2, PLANK_T, facecolor="#d9c7a7", edgecolor=INK, linewidth=1.5, zorder=3))
    top = PLANK_Y + PLANK_T
    for sx in (-1, 1):
        for k in range(1, 5):
            ax.plot([sx * k, sx * k], [PLANK_Y - 0.12, PLANK_Y], color=INK, linewidth=1.2, zorder=3)
            ax.text(sx * k, PLANK_Y - 0.36, str(k), ha="center", va="center", fontsize=11)
    for sx, loads in ((-1, p["left"]), (1, p["right"])):
        for mk, mass, nm in loads:
            if p["loads"] == "children":
                _child_on(ax, sx * mk, nm, mass, top)
            else:
                _bag_on(ax, sx * mk, nm, mass, top)
    if p["newcomer"]:
        nm, mass = p["newcomer"]
        sx = 1 if not p["right"] else -1
        if p["loads"] == "children":
            _child_standing(ax, sx * 5.75, nm, mass)
        else:
            _bag_on(ax, sx * 5.75, nm, mass, 0)
    ax.set_xlim(-wide, wide)
    ax.set_ylim(-0.25, 3.8)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------------

PLAYGROUNDS = ["in the playground at a school in Huye", "at a park in Kigali", "in the school playground in Musanze",
               "at a playground in Rubavu", "after lessons at a school in Nyanza"]
MARKETS = ["at the market in Musanze", "at a maize store in Nyagatare", "on a farm in Kayonza", "at the market in Huye",
           "at a cooperative in Rwamagana"]


def _who(loads) -> str:
    names = [nm for _, _, nm in loads]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + f" and {names[-1]}"


def _way(left, right) -> str:
    L, R = _turn(left), _turn(right)
    return END[(R > L) - (R < L)]


def _move(left, right, who, mark):
    return ([[mark if nm == who else a, b, nm] for a, b, nm in left], [[mark if nm == who else a, b, nm] for a, b, nm in right])


def _tip_questions(p, rng):
    left, right, loads = p["left"], p["right"], p["loads"]
    upper = p["level"] == "upper"
    if loads == "children":
        first = f"{_who(left + right)} sit on a seesaw {rng.choice(PLAYGROUNDS)}."
    else:
        first = f"{rng.choice(NAMES)} balances bags of maize on a plank, like a seesaw, {rng.choice(MARKETS)}."
    rule = f" {RULE}" if upper else ""
    qs = [mcq(f"{first}{rule} Which end goes down?", _way(left, right),
              [v for v in END.values() if v != _way(left, right)], rng)]
    if not upper:
        (lm, lw, ln), (rm, rw, rn) = left[0], right[0]
        children = loads == "children"
        if lw == rw and lm != rm:
            near = ln if lm < rm else rn
            far_mark = max(lm, rm)
            ask = "Who sits farther from the middle?" if children else "Which bag is farther from the middle?"
            want = _label(ln if lm > rm else rn)
            qs.append(mcq(ask, want, [_label(ln if want == _label(rn) else rn), "They are the same distance from the middle"], rng))
            go = "sit" if children else "go"
            qs.append(short(f"Where must {near} {go} to make the seesaw balance? Give the mark number.", far_mark,
                            [f"mark {far_mark}", f"Mark {far_mark}"]))
        elif lm == rm and lw != rw:
            ask = "Who is heavier?" if children else "Which bag is heavier?"
            want = _label(ln if lw > rw else rn)
            qs.append(mcq(ask, want, [_label(rn if want == _label(ln) else ln), "They are the same mass"], rng))
        else:
            who, mk = rng.choice([(ln, lm), (rn, rm)])
            qs.append(_if_moves(left, right, who, rng.randint(mk + 1, 4), rng))
        return qs
    side = rng.choice(["left", "right"])
    qs.append(short(f"What is the turning effect on the {side} side?", _turn(left if side == "left" else right)))
    L, R = _turn(left), _turn(right)
    moves = []
    for loads_, other in ((left, right), (right, left)):
        taken = {mk for mk, _, _ in loads_}
        for mk, w, nm in loads_:
            for to in range(1, 5):
                if to in taken:
                    continue
                l2, r2 = _move(left, right, nm, to)
                moves.append((nm, to, _turn(l2) - _turn(r2)))
    fixes = [mv for mv in moves if mv[2] == 0]
    misses = [mv for mv in moves if abs(mv[2]) >= 10]
    if L != R and fixes and len(misses) >= 2:
        nm, to, _ = rng.choice(fixes)
        wrong = rng.sample(misses, min(3, len(misses)))
        qs.append(mcq("Which change would make the seesaw balance?", f"{_label(nm)} moves to mark {to}",
                      [f"{_label(a)} moves to mark {b}" for a, b, _ in wrong], rng))
    else:
        clear = [mv for mv in moves if mv[2] == 0 or abs(mv[2]) >= 10]
        if clear:
            nm, to, _ = rng.choice(clear)
            qs.append(_if_moves(left, right, nm, to, rng))
    return qs


def _if_moves(left, right, who, to, rng):
    l2, r2 = _move(left, right, who, to)
    way = _way(l2, r2)
    return mcq(f"If {who} moves to mark {to}, which end goes down?", way, [v for v in END.values() if v != way], rng)


def _place_questions(p, rng):
    left, right, loads = p["left"], p["right"], p["loads"]
    nm, mass = p["newcomer"]
    on = left or right
    side = "left" if left else "right"
    need = _turn(on)
    mark = need // mass
    upper = p["level"] == "upper"
    rule = f" {RULE}" if upper else ""
    if loads == "children":
        first = f"{nm} wants to join {_who(on)} on a seesaw {rng.choice(PLAYGROUNDS)}.{rule}"
        ask = f"At which mark must {nm} sit to make it balance?"
    else:
        first = f"{rng.choice(NAMES)} balances bags of maize on a plank, like a seesaw, {rng.choice(MARKETS)}.{rule}"
        ask = f"At which mark must {nm} go, on the empty side, to make it balance?"
    qs = [short(f"{first} {ask}", mark, [f"mark {mark}", f"Mark {mark}"])]
    if upper:
        qs.append(short(f"What is the turning effect on the {side} side?", need))
    k = rng.choice([x for x in range(1, 5) if x != mark])
    mine = k * mass
    empty = 1 if side == "left" else -1  # the newcomer's side: right is +1
    way = END[empty * ((mine > need) - (mine < need))]
    verb = "sits" if loads == "children" else "is put"
    qs.append(mcq(f"{_label(nm)} {verb} at mark {k} instead. Which end goes down?", way, [v for v in END.values() if v != way], rng))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return _tip_questions(p, rng) if p["kind"] == "tip" else _place_questions(p, rng)
