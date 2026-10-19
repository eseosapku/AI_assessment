"""A keyboard and a mouse with parts lettered (P, Stages 3 to 6): a computer keyboard drawn key by key (the letter
keys, the number row, Tab, Caps Lock, Shift, Enter, Backspace, Ctrl, Alt, the space bar, Delete and the arrow keys,
each special key named on it as a real keyboard names it) and a mouse seen from above with its cable at the top.

Four keys are lettered A to D (from Enter, Backspace, Delete, Shift, Caps Lock, the space bar, the up arrow and the
left arrow), each by a leader from outside the keyboard that crosses no other key; the mouse's left button, right
button and wheel are lettered E to G in a shuffled order. Which letter shows the key you press to do a job (start a
new line, remove the letter to the left of the cursor, type one capital letter...), and which part of the mouse you
use to do a job (open a shortcut menu, scroll a page, choose an icon). Every key comes from the fixed table of jobs
below, which a Primary teacher would agree with: each job is done by one lettered part only.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon

from ..core import FILL_2, INK, NAMES, Question, new_figure

ID = "keyboard_mouse_p"
KIND = "diagram.template"
SUBJECT = "computing"
BANDS = ("P",)
CONCEPTS = tuple(f"computing.{c}" for c in ("keyboard-mouse-skills", "mouse-pointer"))
# A topic whose sections the book lists is reached only if its name or a section names the keyboard, the mouse or
# typing.
NEEDS = r"keyboard|mouse|typing"
# Units that share the keyboard-skills concept but teach drawing, designing, data, networks, robots or safety.
AVOID = r"citizenship|safety|designer|artist|\bdata\b|network|robot|interface|game|animator|storyteller|operating"

U = 0.52  # one key's width, in inches (one data unit is one inch)
MOUSE = (13.05, 1.85)  # the mouse body's centre
JOBS = {"enter": "start a new line", "backspace": "remove the letter just to the left of the cursor",
        "delete": "remove the letter just to the right of the cursor", "shift": "type just one capital letter",
        "caps": "keep typing capital letters without holding a key down", "space": "put a space between two words",
        "up": "move the cursor up one line", "left": "move the cursor one place to the left without removing anything"}
MOUSE_JOBS = {"left button": "click to choose (select) an icon", "right button": "click to open a shortcut menu",
              "wheel": "roll to scroll up and down a page"}
# Where a lettered key's leader comes from: the side of the keyboard nothing else stands on.
SIDE = {"enter": "right", "backspace": "above", "delete": "above", "shift": "left", "caps": "left", "space": "below",
        "up": "right", "left": "below"}


def stages(p: dict) -> tuple[int, int]:
    return (3, 6)


def keys() -> list:
    """Every key: (label, x, y, width, id), x and y in key units from the keyboard's top left, y growing down."""
    out = []
    rows = [
        [(c, 1, None) for c in "`1234567890-="] + [("Backspace", 2, "backspace")],
        [("Tab", 1.5, "tab")] + [(c, 1, None) for c in "QWERTYUIOP[]"] + [("\\", 1.5, None)],
        [("Caps Lock", 1.8, "caps")] + [(c, 1, None) for c in "ASDFGHJKL;'"] + [("Enter", 2.2, "enter")],
        [("Shift", 2.3, "shift")] + [(c, 1, None) for c in "ZXCVBNM,./"] + [("Shift", 2.7, "rshift")],
        [("Ctrl", 1.5, None), ("Alt", 1.5, None), ("", 9, "space"), ("Alt", 1.5, None), ("Ctrl", 1.5, None)],
    ]
    for r, row in enumerate(rows):
        x = 0.0
        for label, w, kid in row:
            out.append((label, x, r, w, kid))
            x += w
    out += [("Delete", 15.5, 1, 1.5, "delete"), ("↑", 16.5, 3, 1, "up"), ("←", 15.5, 4, 1, "left"),
            ("↓", 16.5, 4, 1, None), ("→", 17.5, 4, 1, None)]
    return out


def sample(rng: random.Random) -> dict:
    lettered = rng.sample(list(JOBS), 4)
    letters = list("ABCD")
    rng.shuffle(letters)
    mouse = list("EFG")
    rng.shuffle(mouse)
    ask = rng.sample(lettered, 2)
    return {"band": "P", "keys": dict(zip(lettered, letters)), "mouse": dict(zip(MOUSE_JOBS, mouse)), "ask": ask,
            "mouse_ask": rng.choice(list(MOUSE_JOBS))}


# --- drawing ----------------------------------------------------------------------------------------

def _letter(ax, x, y, letter, gid):
    ax.add_patch(Circle((x, y), 0.24, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.text(x, y, letter, ha="center", va="center", fontsize=13, fontweight="bold", zorder=5, gid=gid)


def draw(p: dict):
    W, H = 15.0, 4.6
    fig, ax = new_figure(W, H)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    X0, Y0 = 0.75, 3.75  # the keyboard's top left
    ax.add_patch(FancyBboxPatch((X0 - 0.12, Y0 - 5 * U - 0.12), 18.5 * U + 0.24, 5 * U + 0.24,
                                boxstyle="round,pad=0.02,rounding_size=0.08", facecolor="#c9ced3", edgecolor=INK,
                                linewidth=1.4))
    boxes = {}
    for label, kx, ky, kw, kid in keys():
        x, y = X0 + kx * U + 0.03, Y0 - (ky + 1) * U + 0.03
        w, h = kw * U - 0.06, U - 0.06
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.04",
                                    facecolor="white" if kid in p["keys"] else "#f4f5f6", edgecolor=INK, linewidth=0.9))
        if label:
            ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=10)
        if kid:
            boxes[kid] = (x, y, w, h)
    for kid, letter in p["keys"].items():
        x, y, w, h = boxes[kid]
        side = SIDE[kid]
        if side == "above":
            lx, ly, ex, ey = x + w / 2, Y0 + 0.5, x + w / 2, y + h
        elif side == "below":
            lx, ly, ex, ey = x + w / 2, Y0 - 5 * U - 0.5, x + w / 2, y
        elif side == "left":
            lx, ly, ex, ey = 0.3, y + h / 2, x, y + h / 2
        else:
            lx, ly, ex, ey = X0 + 18.5 * U + 0.5, y + h / 2, x + w, y + h / 2
        sx = lx + (0.24 if side == "left" else -0.24 if side == "right" else 0)
        sy = ly + (-0.24 if side == "above" else 0.24 if side == "below" else 0)
        ax.plot([sx, ex], [sy, ey], color=INK, linewidth=1.3, zorder=3, gid=f"leader:{kid}")
        _letter(ax, lx, ly, letter, f"letter:{kid}")
    # the mouse, seen from above, its cable at the top, far enough right that its letters stand clear of the
    # keyboard's right-hand letters (P4 review: Enter's "A" sat on the left button's letter)
    cx, cy = MOUSE
    ax.plot([cx, cx, cx - 0.3], [cy + 1.25, cy + 1.7, cy + 2.1], color=INK, linewidth=1.6)
    ax.add_patch(Ellipse((cx, cy), 1.7, 2.5, facecolor="#f4f5f6", edgecolor=INK, linewidth=1.6))
    ax.plot([cx, cx], [cy + 0.2, cy + 1.25], color=INK, linewidth=1.3)
    ax.plot([cx - 0.83, cx + 0.83], [cy + 0.2, cy + 0.2], color=INK, linewidth=1.3)
    ax.add_patch(FancyBboxPatch((cx - 0.1, cy + 0.55), 0.2, 0.45, boxstyle="round,pad=0,rounding_size=0.08",
                                facecolor="#9aa4ad", edgecolor=INK, linewidth=1.2))
    # each button's arrow ends in the middle of its own half, well clear of the wheel; the wheel's ends on the wheel
    spots = {"left button": ((cx - 1.5, cy + 0.7), (cx - 0.5, cy + 0.7)),
             "right button": ((cx + 1.5, cy + 0.7), (cx + 0.5, cy + 0.7)),
             "wheel": ((cx + 0.75, cy + 2.05), (cx + 0.03, cy + 0.95))}
    for part, letter in p["mouse"].items():
        (lx, ly), (ex, ey) = spots[part]
        d = ((ex - lx) ** 2 + (ey - ly) ** 2) ** 0.5
        ux, uy = (ex - lx) / d, (ey - ly) / d  # an arrowhead on the part, so the leader's end is plain
        ax.plot([lx + 0.24 * ux, ex], [ly + 0.24 * uy, ey], color=INK, linewidth=1.3, zorder=3, gid=f"leader:{part}")
        ax.add_patch(Polygon([(ex, ey), (ex - 0.14 * ux + 0.06 * uy, ey - 0.14 * uy - 0.06 * ux),
                              (ex - 0.14 * ux - 0.06 * uy, ey - 0.14 * uy + 0.06 * ux)], closed=True, facecolor=INK,
                             edgecolor=INK, zorder=3))
        _letter(ax, lx, ly, letter, f"letter:{part}")
    ax.text(X0, 0.25, "keyboard", ha="left", va="center", fontsize=11, fontweight="bold")
    ax.text(cx, 0.25, "mouse", ha="center", va="center", fontsize=11, fontweight="bold")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["at school", "in the computer room", "at the ICT club", "in class", "at home in Kigali", "in the library"]


def _letters(stem: str, key: str, letters) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    a, b = p["ask"]
    kl, ml = p["keys"], p["mouse"]
    part = p["mouse_ask"]
    return [_letters(f"{who} is typing a story {rng.choice(SETTINGS)}. Which letter shows the key {who} presses to "
                     f"{JOBS[a]}?", kl[a], kl.values()),
            _letters(f"Which letter shows the key you press to {JOBS[b]}?", kl[b], kl.values()),
            _letters(f"Which letter shows the part of the mouse you {MOUSE_JOBS[part]}?", ml[part], ml.values())]
