"""Bar models (P): a whole split into parts, two bars compared, or a whole shared into equal parts,
with one number missing; the missing number and the number sentence that finds it.

The bars are drawn to scale. Numbers fit the school year: to 20 in Stages 1–2, 100 in Stages 2–3,
1,000 in Stages 3–4 and 10,000 in Stages 5–6; equal sharing starts in Stage 2.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import FILL, FILL_2, INK, NAMES, mcq, new_figure, short

ID = "bar_model"
KIND = "maths.number"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = tuple(f"mathematics.{c}" for c in ("missing-numbers-operations", "partitioning-add-subtract", "complements-to-ten", "subtraction-take-away"))
# Bar models of whole numbers: not fractions, nor sequences.
AVOID = r"fraction|sequence"
YEARS = {(1, 2): 20, (2, 3): 100, (3, 4): 1000, (5, 6): 10000}
THINGS = ["mangoes", "beans", "books", "chairs", "eggs", "pencils", "bananas", "cows", "trees", "bottles"]


def stages(p: dict) -> tuple[int, int]:
    return tuple(p["years"])


def sample(rng: random.Random) -> dict:
    years = rng.choice(list(YEARS))
    top = YEARS[years]
    kind = rng.choice(["part_whole", "compare"] + (["equal"] if years[0] >= 2 else []))
    lo = max(1, top // 20)
    if kind == "part_whole":
        n = rng.choice([2, 2, 3])
        while True:
            parts = [rng.randint(lo, top // n) for _ in range(n)]
            if sum(parts) <= top and len(set(parts)) == n:
                break
        nums = [sum(parts), *parts]
    elif kind == "compare":
        small = rng.randint(lo, top // 2)
        big = rng.randint(small + lo, top)
        nums = [big, small, big - small]
    else:
        n = rng.randint(2, 6 if top <= 100 else 9)
        each = rng.randint(2, top // n)
        nums = [n * each, n, each]
    # The number hidden: never the count of equal parts (it is drawn as that many parts).
    hole = rng.choice([i for i in range(len(nums)) if not (kind == "equal" and i == 1)])
    return {"band": "P", "years": list(years), "kind": kind, "numbers": nums, "hole": hole, "thing": rng.choice(THINGS),
            "name": rng.choice(NAMES)}


def _bar(ax, x, y, w, h, text, shade):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=shade, edgecolor=INK, linewidth=1.4))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=13, fontweight="bold")


def draw(p: dict):
    kind, nums, hole = p["kind"], p["numbers"], p["hole"]
    shown = ["?" if i == hole else f"{v:,}" for i, v in enumerate(nums)]
    W = 10.0
    fig, ax = new_figure(6.4, 2.6)
    if kind == "part_whole":
        _bar(ax, 0, 1.4, W, 1.0, shown[0], FILL_2)
        x = 0.0
        for v, t in zip(nums[1:], shown[1:]):
            w = W * v / nums[0]
            _bar(ax, x, 0.2, w, 1.0, t, "white")
            x += w
    elif kind == "compare":
        big, small, _ = nums
        _bar(ax, 0, 1.4, W, 1.0, shown[0], FILL_2)
        ws = W * small / big
        _bar(ax, 0, 0.2, ws, 1.0, shown[1], "white")
        # The difference: the part of the long bar the short one lacks, dashed, with its number.
        ax.add_patch(Rectangle((ws, 0.2), W - ws, 1.0, facecolor="none", edgecolor=INK, linewidth=1.2, linestyle=(0, (4, 3))))
        ax.text(ws + (W - ws) / 2, 0.7, shown[2], ha="center", va="center", fontsize=13, fontweight="bold")
    else:
        whole, n, each = nums
        _bar(ax, 0, 1.4, W, 1.0, shown[0], FILL_2)
        for j in range(n):
            _bar(ax, j * W / n, 0.2, W / n, 1.0, shown[2] if j == 0 else "", "white")
    ax.set_xlim(-0.1, W + 0.1)
    ax.set_ylim(0, 2.6)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    kind, nums, hole, thing, name = p["kind"], p["numbers"], p["hole"], p["thing"], p["name"]
    shown = {"part_whole": f"{name}'s {thing} in {len(nums) - 1} groups", "compare": f"how {name}'s two piles of {thing} compare",
             "equal": f"{name}'s {thing} shared equally"}[kind]
    missing = short(f"The bar model shows {shown}. What is the missing number?", nums[hole], [f"{nums[hole]} {thing}"])
    v = [f"{x:,}" for x in nums]
    if kind == "part_whole":
        if hole == 0:
            right, wrong = " + ".join(v[1:]) + " = ?", [f"{v[1]} − {v[2]} = ?" if nums[1] > nums[2] else f"{v[2]} − {v[1]} = ?",
                                                        " × ".join(v[1:]) + " = ?"]
        else:
            rest = [x for i, x in enumerate(v[1:], 1) if i != hole]
            right = f"{v[0]} − " + " − ".join(rest) + " = ?"
            wrong = [f"{v[0]} + " + " + ".join(rest) + " = ?", " − ".join(rest) + f" − {v[0]} = ?" if len(rest) == 1 else f"{v[0]} − {rest[0]} = ?",
                     f"{v[0]} × " + " × ".join(rest) + " = ?"]
    elif kind == "compare":
        big, small, diff = v
        right = {0: f"{small} + {diff} = ?", 1: f"{big} − {diff} = ?", 2: f"{big} − {small} = ?"}[hole]
        wrong = [f"{big} + {small} = ?", f"{small} − {diff} = ?", f"{big} + {diff} = ?", f"{small} + {big} + {diff} = ?"]
    else:
        whole, n, each = v
        right = f"{n} × {each} = ?" if hole == 0 else f"{whole} ÷ {n} = ?"
        wrong = [f"{whole} × {n} = ?", f"{whole} − {n} = ?", f"{whole} + {n} = ?", f"{n} + {each} = ?"]
    clean = lambda o: o.replace("×", "*").replace("÷", "/").replace("−", "-").replace(",", "").split("=")[0]  # noqa: E731
    wrong = [w for w in wrong if eval(clean(w)) != nums[hole]]  # noqa: S307 -- our own arithmetic, never another answer
    sentence = mcq("Which number sentence finds the missing number?", right, wrong, rng)
    return [missing, sentence]
