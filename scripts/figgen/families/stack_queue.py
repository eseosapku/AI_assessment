"""Stacks and queues (UP, AL): a stack drawn upright with its top pointer, or a queue drawn left to right with its
front and rear pointers, holding two to four numbers, beside a numbered list of four to six operations (PUSH and
POP, or ENQUEUE and DEQUEUE). The item at the top or front after all of them, the item a given operation removes,
and how many items are left.

Every key is the operations carried out in order: a stack removes from the top, a queue from the front; no
operation removes from an empty structure.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, new_figure, short

ID = "stack_queue"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = ("computing.data-structures-introduction",)
AVOID = r"spreadsheet|database|network|internet|security|graphic|presentation|email|html|logic gate|boolean"
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"stack|queue|data structure|abstract data type|\badt|linked list|lifo|fifo"
FILL = "#eef1f3"


def run_ops(p: dict) -> tuple[list[str], list[str | None]]:
    """The items left (bottom to top, or front to rear) and what each operation removed."""
    items, removed = list(p["start"]), []
    for op in p["ops"]:
        word, *arg = op.split()
        if word in ("PUSH", "ENQUEUE"):
            items.append(arg[0])
            removed.append(None)
        else:
            removed.append(items.pop() if word == "POP" else items.pop(0))
    return items, removed


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["stack", "queue"])
    add, take = ("PUSH", "POP") if kind == "stack" else ("ENQUEUE", "DEQUEUE")
    while True:
        pool = [str(v) for v in rng.sample(range(10, 100), 10)]
        start, fresh = pool[:rng.randint(2, 4)], pool[4:]
        ops, size = [], len(start)
        for _ in range(rng.randint(4, 6)):
            if size and rng.random() < 0.5:
                ops.append(take)
                size -= 1
            else:
                ops.append(f"{add} {fresh.pop()}")
                size += 1
        takes = [i for i, op in enumerate(ops) if op == take]
        if len(takes) >= 2 and size >= 1:
            return {"band": rng.choice(BANDS), "kind": kind, "start": start, "ops": ops, "ask": rng.choice(takes)}


def draw(p: dict):
    fig, ax = new_figure(7.4, 3.8)
    items = p["start"]
    if p["kind"] == "stack":
        w, h, x0 = 1.4, 0.55, 1.0
        for i in range(5):
            ax.add_patch(Rectangle((x0, 0.3 + i * h), w, h, facecolor=FILL if i < len(items) else "white", edgecolor=INK, linewidth=1.2))
            if i < len(items):
                ax.text(x0 + w / 2, 0.3 + i * h + h / 2, items[i], ha="center", va="center", fontsize=13, fontweight="bold")
        ty = 0.3 + (len(items) - 0.5) * h
        ax.annotate("", xy=(x0 + w + 0.05, ty), xytext=(x0 + w + 0.85, ty), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3))
        ax.text(x0 + w + 0.95, ty, "Top", ha="left", va="center", fontsize=11, fontweight="bold")
        ax.text(x0 + w / 2, 0.3 + 5 * h + 0.25, "Stack", ha="center", va="bottom", fontsize=12, fontweight="bold")
        lx = 4.6
    else:
        w, h, x0, y0 = 0.8, 0.6, 0.6, 1.4
        for i in range(6):
            ax.add_patch(Rectangle((x0 + i * w, y0), w, h, facecolor=FILL if i < len(items) else "white", edgecolor=INK, linewidth=1.2))
            if i < len(items):
                ax.text(x0 + i * w + w / 2, y0 + h / 2, items[i], ha="center", va="center", fontsize=13, fontweight="bold")
        for i, name in ((0, "Front"), (len(items) - 1, "Rear")):
            x = x0 + i * w + w / 2
            ax.annotate("", xy=(x, y0 - 0.05), xytext=(x, y0 - 0.65), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3))
            ax.text(x, y0 - 0.75, name, ha="center", va="top", fontsize=11, fontweight="bold")
        ax.text(x0 + 3 * w, y0 + h + 0.35, "Queue", ha="center", va="bottom", fontsize=12, fontweight="bold")
        lx = 6.0
    ax.text(lx, 3.25, "Operations, in order", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, op in enumerate(p["ops"]):
        ax.text(lx, 2.75 - i * 0.45, f"{i + 1}.  {op}", ha="left", va="center", fontsize=11, family="monospace")
    ax.set_xlim(0, lx + 3.4)
    ax.set_ylim(-0.1, 3.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a computing lesson", "for homework", "on a revision card", "at the coding club", "for a class test"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    items, removed = run_ops(p)
    kind = p["kind"]
    end = items[-1] if kind == "stack" else items[0]
    where = "at the top of the stack" if kind == "stack" else "at the front of the queue"
    k = p["ask"]
    return [short(f"{who} carries out the operations {rng.choice(SETTINGS)}, in order. Which item is {where} after all of them?", end, [end]),
            short(f"Which item does operation {k + 1} remove from {friend}'s {kind}?", removed[k], [removed[k]]),
            short(f"How many items are left in the {kind} when the operations are done?", len(items), [str(len(items)), f"{len(items)} items"])]
