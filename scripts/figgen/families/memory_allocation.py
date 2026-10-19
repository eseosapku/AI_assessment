"""Memory management (UP, AL), two kinds.

- fit: main memory drawn as a column -- the operating system at the top, then five fixed partitions lettered A to E
  with their sizes in KB -- beside a queue of four processes with their sizes, and the three placement rules printed
  (first fit: the first big-enough partition from the top; best fit: the smallest big enough; worst fit: the largest
  big enough), with the convention: each partition holds one process at most, processes are placed in queue order,
  and a process that fits no free partition waits. Each question names its rule. Which partition a process takes
  (the other rules' choices are the distractors, and they differ for that process), how much space is left unused in
  the partition a process takes, and which one process has to wait.
- paging: a program's pages, its page table (page number, frame number) and physical memory's frames holding them,
  with the page size and the formulas printed (page number = logical address / page size, whole-number part;
  offset = logical address - page number x page size; physical address = frame number x page size + offset). The
  physical address for a logical address, the page number of another, and an address's offset.

Partition sizes are all different, so best and worst fit never tie. Every key is the rule applied to the params
(`place`) or the arithmetic done on them.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "memory_allocation"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
FIT = ("computing.memory-allocation-partitioning", "computing.memory-fragmentation")
PAGING = ("computing.virtual-memory", "computing.memory-allocation-partitioning")
CONCEPTS = tuple(dict.fromkeys(FIT + PAGING))
# A topic whose sections the book lists is reached only if its name or a section names memory management, partitions,
# allocation, paging, virtual memory or logical and physical addresses.
NEEDS = r"memory management|partition|allocat|paging|\bpages?\b|virtual memory|fragment|logical and physical"
AVOID = r"pointer|garbage|\boop\b|object|cache|storage|data structure|linked list|structure in c|laptop|\bcpu\b"
RULES = {"first": "First fit: the first partition, from the top, that is big enough.",
         "best": "Best fit: the smallest free partition that is big enough.",
         "worst": "Worst fit: the largest free partition that is big enough."}
SIZES = [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700]


def concepts_for(p: dict) -> tuple[str, ...]:
    return FIT if p["sub"] == "fit" else PAGING


def place(parts: list, jobs: list, rule: str) -> dict[str, str | None]:
    """Each process's partition letter (None if it waits), placed in queue order."""
    free = {letter: size for letter, size in parts}
    out: dict[str, str | None] = {}
    for name, size in jobs:
        fits = [(letter, s) for letter, s in parts if letter in free and s >= size]
        if not fits:
            out[name] = None
            continue
        if rule == "first":
            letter = fits[0][0]
        elif rule == "best":
            letter = min(fits, key=lambda x: x[1])[0]
        else:
            letter = max(fits, key=lambda x: x[1])[0]
        out[name] = letter
        del free[letter]
    return out


def _fit(rng: random.Random, band: str) -> dict:
    while True:
        sizes = rng.sample(SIZES, 5)
        parts = [[letter, s] for letter, s in zip("ABCDE", sizes)]
        jobs = [[f"P{i}", rng.randrange(80, 560, 5)] for i in range(1, 5)]
        if any(j[1] in sizes for j in jobs) or len({j[1] for j in jobs}) < 4:
            continue
        got = {r: place(parts, jobs, r) for r in RULES}
        waits = {r: [n for n, x in got[r].items() if x is None] for r in RULES}
        wait_rules = [r for r in RULES if len(waits[r]) == 1]
        if not wait_rules or all(waits[r] for r in RULES):
            continue
        # a process each rule places, in partitions that differ between the rules
        take = [(r, n) for r in RULES for n, _ in jobs
                if got[r][n] and len({got[x][n] for x in RULES} - {None}) >= 2]
        left = [(r, n) for r in RULES for n, _ in jobs if got[r][n]]
        if not take:
            continue
        rt, jt = rng.choice(take)
        rl, jl = rng.choice([x for x in left if x != (rt, jt)])
        return {"band": band, "sub": "fit", "parts": parts, "jobs": jobs,
                "ask": {"take": [rt, jt], "left": [rl, jl], "wait": rng.choice(wait_rules)}}


def _paging(rng: random.Random, band: str) -> dict:
    size = rng.choice([512, 1024, 2048, 4096])
    n = rng.randint(4, 6)
    frames = rng.sample(range(0, 10), n)
    pages = rng.sample(range(n), 2)
    addr = [pg * size + rng.randint(1, size - 1) for pg in pages]
    return {"band": band, "sub": "paging", "page_size": size, "table": frames, "addresses": addr}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    return _fit(rng, band) if rng.random() < 0.6 else _paging(rng, band)


# --- drawing -----------------------------------------------------------------------------------------------

def _height(size: int) -> float:
    """A partition's height: bigger partitions are taller, and the smallest still holds its label."""
    return 0.4 + 0.0013 * size


def _draw_fit(p: dict):
    fig, ax = new_figure(10.0, 6.4)
    ax.set_position([0, 0, 1, 1])
    x0, w = 0.3, 2.0
    top = 5.9
    ax.text(x0 + w / 2, top + 0.25, "Main memory", ha="center", va="center", fontsize=11, fontweight="bold")
    y = top
    ax.add_patch(Rectangle((x0, y - 0.5), w, 0.5, facecolor="#c9ced3", edgecolor=INK, linewidth=1.2))
    ax.text(x0 + w / 2, y - 0.25, "Operating system", ha="center", va="center", fontsize=9.5)
    y -= 0.5
    for letter, s in p["parts"]:
        h = _height(s)
        ax.add_patch(Rectangle((x0, y - h), w, h, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(x0 + w / 2, y - h / 2, f"{letter}   {s} KB", ha="center", va="center", fontsize=10.5,
                fontweight="bold", gid=f"part:{letter}")
        y -= h
    # the queue
    qx, qy = 3.0, 5.65
    ax.text(qx, qy + 0.25, "Queue of processes (placed in this order, P1 first)", ha="left", va="center", fontsize=10.5,
            fontweight="bold")
    for i, (name, s) in enumerate(p["jobs"]):
        bx = qx + i * 1.65
        ax.add_patch(Rectangle((bx, qy - 0.85), 1.35, 0.7, facecolor="#e3e8ec", edgecolor=INK, linewidth=1.1))
        ax.text(bx + 0.675, qy - 0.36, name, ha="center", va="center", fontsize=10.5, fontweight="bold")
        ax.text(bx + 0.675, qy - 0.66, f"{s} KB", ha="center", va="center", fontsize=10, gid=f"job:{name}")
    # the rules
    ry = 4.25
    ax.text(qx, ry, "Placement rules", ha="left", va="center", fontsize=10.5, fontweight="bold")
    for i, r in enumerate(RULES):
        ax.text(qx, ry - 0.42 - i * 0.36, RULES[r], ha="left", va="center", fontsize=10, gid=f"rule:{r}")
    notes = ["Each partition holds one process at most.", "Processes are placed in queue order; a process that fits",
             "no free partition has to wait."]
    for i, s in enumerate(notes):
        ax.text(qx, ry - 1.65 - i * 0.33, s, ha="left", va="center", fontsize=10, style="italic")
    bottom = min(y, ry - 1.65 - 2 * 0.33) - 0.3
    ax.set_xlim(0, 10.0)
    ax.set_ylim(bottom, top + 0.5)
    fig.set_size_inches(10.0, top + 0.5 - bottom)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_paging(p: dict):
    n, size = len(p["table"]), p["page_size"]
    fig, ax = new_figure(10.0, 5.6)
    ax.set_position([0, 0, 1, 1])
    top = 5.2
    rh = 0.42
    # the program's pages
    ax.text(0.95, top + 0.2, "Program (logical)", ha="center", va="center", fontsize=10.5, fontweight="bold")
    for i in range(n):
        ax.add_patch(Rectangle((0.3, top - (i + 1) * rh), 1.3, rh, facecolor="#e3e8ec", edgecolor=INK, linewidth=1.1))
        ax.text(0.95, top - (i + 0.5) * rh, f"Page {i}", ha="center", va="center", fontsize=10)
    # the page table
    tx = 2.4
    ax.text(tx + 1.0, top + 0.2, "Page table", ha="center", va="center", fontsize=10.5, fontweight="bold")
    for j, head in enumerate(("Page", "Frame")):
        ax.add_patch(Rectangle((tx + j * 1.0, top - rh), 1.0, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(tx + j * 1.0 + 0.5, top - rh / 2, head, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, f in enumerate(p["table"]):
        for j, val in enumerate((i, f)):
            ax.add_patch(Rectangle((tx + j * 1.0, top - (i + 2) * rh), 1.0, rh, facecolor="white", edgecolor=INK,
                                   linewidth=1.0))
            ax.text(tx + j * 1.0 + 0.5, top - (i + 1.5) * rh, str(val), ha="center", va="center", fontsize=10,
                    gid=f"table:{i}:{j}")
    # physical memory
    px = 5.3
    frames = 10
    fh = min(rh, 4.6 / frames)
    ax.text(px + 1.1, top + 0.2, "Physical memory", ha="center", va="center", fontsize=10.5, fontweight="bold")
    owner = {f: i for i, f in enumerate(p["table"])}
    for f in range(frames):
        y = top - (f + 1) * fh
        ax.text(px - 0.1, y + fh / 2, f"Frame {f}", ha="right", va="center", fontsize=9)
        ax.add_patch(Rectangle((px, y), 2.2, fh, facecolor="#e3e8ec" if f in owner else "white", edgecolor=INK,
                               linewidth=1.0))
        if f in owner:
            ax.text(px + 1.1, y + fh / 2, f"Page {owner[f]}", ha="center", va="center", fontsize=9.5)
    # the size and the formulas
    fx = 7.85
    lines = [(f"Page size = {size} bytes", True), ("Page number = logical address ÷ page size", False),
             ("   (the whole-number part)", False), ("Offset = logical address −", False),
             ("   page number × page size", False), ("Physical address = frame number", False),
             ("   × page size + offset", False)]
    for i, (s, bold) in enumerate(lines):
        ax.text(fx, top - 0.1 - i * 0.36, s, ha="left", va="center", fontsize=10, fontweight="bold" if bold else "normal",
                gid="size" if bold else None)
    bottom = min(top - frames * fh, top - (n + 1) * rh, top - 0.1 - len(lines) * 0.36) - 0.2
    ax.set_xlim(0, 11.2)
    ax.set_ylim(bottom, top + 0.45)
    fig.set_size_inches(11.2, top + 0.45 - bottom)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_fit(p) if p["sub"] == "fit" else _draw_paging(p)


# --- questions ---------------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "for a class test",
            "while revising memory management"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["sub"] == "paging":
        size, table = p["page_size"], p["table"]
        a1, a2 = p["addresses"]
        page1, off1 = divmod(a1, size)
        phys = table[page1] * size + off1
        page2 = a2 // size
        return [short(f"{who} uses this page table {rng.choice(SETTINGS)}. A program uses logical address {a1}. What is "
                      f"its physical address?", phys, [str(phys)]),
                short(f"Which page number holds logical address {a2} in this paging diagram?", page2,
                      [str(page2), f"page {page2}", f"Page {page2}"]),
                short(f"What is the offset of logical address {a1} within its page, by the formulas printed?", off1,
                      [str(off1)])]
    parts, jobs = p["parts"], p["jobs"]
    size = dict(parts)
    rt, jt = p["ask"]["take"]
    rl, jl = p["ask"]["left"]
    rw = p["ask"]["wait"]
    got = {r: place(parts, jobs, r) for r in RULES}
    key = got[rt][jt]
    others = [got[r][jt] for r in RULES if got[r][jt] and got[r][jt] != key]
    rest = [x for x, _ in parts if x != key and x not in others]
    rng.shuffle(rest)
    take = mcq(f"{who} places these processes {rng.choice(SETTINGS)} using {rt} fit. Which partition does {jt} go into?",
               key, (list(dict.fromkeys(others)) + rest)[:3], rng)
    job_size = dict(jobs)
    left = size[got[rl][jl]] - job_size[jl]
    kb = [str(left), f"{left} KB", f"{left}KB"]
    waiting = next(n for n, x in got[rw].items() if x is None)
    wait = mcq(f"Using {rw} fit, which process has to wait because no free partition is big enough?", waiting,
               [n for n, _ in jobs if n != waiting], rng)
    return [take, short(f"Using {rl} fit, how much space is left unused in the partition that {jl} takes, in KB?", left,
                        kb), wait]
