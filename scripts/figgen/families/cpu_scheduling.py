"""CPU scheduling (UP, AL): a process table (arrival time, burst time, in ms) and the Gantt chart the scheduler makes
from it -- First Come First Served, Shortest Job First (non-preemptive) or Round Robin with its time quantum printed --
with every boundary's time under the chart, and the formulas printed: turnaround time = completion time - arrival
time; waiting time = turnaround time - burst time. The rule each algorithm follows is printed with it; for Round Robin
that a process arriving during a time slice joins the queue before the process whose slice has just ended.

Asks a process's completion time (read off the chart), a waiting time and a turnaround time (by the formulas), the
average waiting time (it terminates: four or five processes), and which process runs at a stated time -- or, in a
Round Robin chart, which process runs in the block marked "?" (worked out from the queue; that process appears
elsewhere too, and the hidden block is never its last, so every completion time is still on the chart).

The CPU is never idle; no two processes arrive together; SJF bursts are all different; in Round Robin no process
arrives at a slice's end (the case textbooks order differently) and no process runs two slices in a row; every block is
at least 2 ms long. Every key is the schedule simulated from the params (`schedule`).
"""
from __future__ import annotations

import random
from collections import Counter

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, num, short

ID = "cpu_scheduling"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = ("computing.process-management",)
# A topic whose sections the book lists is reached only if its name or a section names scheduling, processes or the
# system software chapters that teach them.
NEEDS = r"schedul|process management|\bprocess\b|system software|operating system activities"
AVOID = (r"data process|processing|word process|processor|food|business|manufactur|programming|python|robot|"
         r"spreadsheet|database|network|thread|monitoring|control")
ALGOS = {"FCFS": "First Come, First Served (FCFS)", "SJF": "Shortest Job First (SJF), non-preemptive",
         "RR": "Round Robin (RR)"}
RULES = {"FCFS": "The CPU runs the processes in the order they arrive, each to the end.",
         "SJF": "When the CPU is free, the waiting process with the shortest burst time runs next, to the end.",
         "RR": "Each process runs for one time quantum at most, then goes to the back of the queue. A process that "
               "arrives during a slice joins the queue before the process whose slice has just ended."}


def schedule(p: dict) -> list[list]:
    """The Gantt chart's blocks: [process, start, end] in order."""
    procs = sorted(p["procs"], key=lambda x: x[1])
    left = {name: burst for name, _, burst in procs}
    arrive = {name: arr for name, arr, _ in procs}
    blocks: list[list] = []
    t = 0
    if p["algo"] == "FCFS":
        for name, arr, burst in procs:
            start = max(t, arr)
            blocks.append([name, start, start + burst])
            t = start + burst
        return blocks
    if p["algo"] == "SJF":
        done: set[str] = set()
        while len(done) < len(procs):
            ready = [x for x in procs if x[0] not in done and x[1] <= t]
            if not ready:
                t = min(x[1] for x in procs if x[0] not in done)
                continue
            name, _, burst = min(ready, key=lambda x: (x[2], x[1]))
            blocks.append([name, t, t + burst])
            t += burst
            done.add(name)
        return blocks
    q = p["quantum"]
    queue = [procs[0][0]]
    nxt = 1
    while queue:
        name = queue.pop(0)
        run = min(q, left[name])
        blocks.append([name, t, t + run])
        t += run
        left[name] -= run
        while nxt < len(procs) and procs[nxt][1] <= t:
            queue.append(procs[nxt][0])
            nxt += 1
        if left[name] > 0:
            queue.append(name)
        if not queue and nxt < len(procs):
            t = procs[nxt][1]
            queue.append(procs[nxt][0])
            nxt += 1
    assert all(arrive[b[0]] <= b[1] for b in blocks)
    return blocks


def times(p: dict) -> dict[str, dict[str, int]]:
    blocks = schedule(p)
    out = {}
    for name, arr, burst in p["procs"]:
        done = max(b[2] for b in blocks if b[0] == name)
        out[name] = {"completion": done, "turnaround": done - arr, "waiting": done - arr - burst}
    return out


def _fair(p: dict) -> bool:
    blocks = schedule(p)
    if any(b[2] - b[1] < 2 for b in blocks):
        return False
    if any(a[2] != b[1] for a, b in zip(blocks, blocks[1:])) or blocks[0][1] != 0:  # never idle
        return False
    if blocks[-1][2] > 36:
        return False
    if p["algo"] == "RR":
        ends = {b[2] for b in blocks}
        if any(arr in ends for _, arr, _ in p["procs"]):
            return False
        if any(a[0] == b[0] for a, b in zip(blocks, blocks[1:])):
            return False
        if len(blocks) <= len(p["procs"]):  # some process is cut by the quantum
            return False
    return True


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    algo = rng.choice(["FCFS", "SJF", "RR"])
    while True:
        n = rng.choice([4, 4, 5])
        names = [f"P{i}" for i in range(1, n + 1)]
        bursts = rng.sample(range(2, 10), n)
        arrivals = [0] + sorted(rng.sample(range(1, 9), n - 1))
        p = {"band": band, "algo": algo, "quantum": rng.choice([2, 3, 4]) if algo == "RR" else 0,
             "procs": [[nm, a, b] for nm, a, b in zip(names, arrivals, bursts)]}
        if not _fair(p):
            continue
        blocks = schedule(p)
        tm = times(p)
        hidden = -1
        if algo == "RR":
            last = {b[0]: i for i, b in enumerate(blocks)}
            seen = Counter(b[0] for b in blocks)
            ok = [i for i, b in enumerate(blocks) if i > 0 and last[b[0]] != i and seen[b[0]] >= 2]
            if not ok:
                continue
            hidden = rng.choice(ok)
        open_blocks = [i for i, b in enumerate(blocks) if i != hidden and b[2] - b[1] >= 2]
        at_block = blocks[rng.choice(open_blocks)]
        at = rng.randint(at_block[1] + 1, at_block[2] - 1)
        done, wait, turn = rng.sample(names, 3)
        if len({tm[x]["waiting"] for x in names}) < 2:
            continue
        p.update({"hidden": hidden, "ask": {"done": done, "wait": wait, "turn": turn, "at": at}})
        return p


# --- drawing -----------------------------------------------------------------------------------------------

def draw(p: dict):
    blocks = schedule(p)
    end = blocks[-1][2]
    unit = min(0.28, 9.4 / end)
    width = max(end * unit + 0.6, 9.8)
    fig, ax = new_figure(width + 0.2, 6.0)
    ax.set_position([0, 0, 1, 1])
    top = 5.75
    title = ALGOS[p["algo"]] + (f", time quantum = {p['quantum']} ms" if p["algo"] == "RR" else "")
    ax.text(0.1, top, title, ha="left", va="center", fontsize=12, fontweight="bold")
    # the process table
    cols = [("Process", 1.0), ("Arrival time (ms)", 1.75), ("Burst time (ms)", 1.65)]
    y = top - 0.35
    x = 0.1
    for head, w in cols:
        ax.add_patch(Rectangle((x, y - 0.42), w, 0.42, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, y - 0.21, head, ha="center", va="center", fontsize=9.5, fontweight="bold")
        x += w
    for r, (name, arr, burst) in enumerate(p["procs"]):
        yy = y - 0.42 - (r + 1) * 0.36
        x = 0.1
        for (head, w), val in zip(cols, (name, arr, burst)):
            ax.add_patch(Rectangle((x, yy), w, 0.36, facecolor="white", edgecolor=INK, linewidth=1.0))
            ax.text(x + w / 2, yy + 0.18, str(val), ha="center", va="center", fontsize=10, gid=f"cell:{name}:{head}")
            x += w
    table_bottom = y - 0.42 - len(p["procs"]) * 0.36
    # the rule and the formulas
    fx = 4.85
    lines = _wrap(RULES[p["algo"]], 62)
    yy = y - 0.12
    for ln in lines:
        ax.text(fx, yy, ln, ha="left", va="center", fontsize=9.5)
        yy -= 0.3
    yy -= 0.12
    for ln in ("Turnaround time = completion time − arrival time", "Waiting time = turnaround time − burst time"):
        ax.text(fx, yy, ln, ha="left", va="center", fontsize=10, style="italic")
        yy -= 0.32
    # the Gantt chart
    gy = min(table_bottom, yy) - 0.75
    ax.text(0.1, gy + 0.3, "Gantt chart (time in ms)", ha="left", va="center", fontsize=10.5, fontweight="bold")
    x0 = 0.3
    for i, (name, a, b) in enumerate(blocks):
        hid = i == p["hidden"]
        ax.add_patch(Rectangle((x0 + a * unit, gy - 0.55), (b - a) * unit, 0.55,
                               facecolor="#f2f2f2" if hid else "#e3e8ec", edgecolor=INK, linewidth=1.2))
        ax.text(x0 + (a + b) / 2 * unit, gy - 0.275, "?" if hid else name, ha="center", va="center", fontsize=10.5,
                fontweight="bold", gid=f"block:{i}")
    for t in sorted({0} | {b[2] for b in blocks}):
        ax.text(x0 + t * unit, gy - 0.72, str(t), ha="center", va="center", fontsize=9.5, gid=f"time:{t}")
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(gy - 1.0, top + 0.25)
    fig.set_size_inches(width + 0.2, top + 0.25 - (gy - 1.0))
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _wrap(text: str, n: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return lines + [cur]


# --- questions ---------------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "for a class test",
            "while revising operating systems"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    tm = times(p)
    blocks = schedule(p)
    ask = p["ask"]
    names = [x[0] for x in p["procs"]]
    algo = p["algo"]
    ms = lambda v: [str(v), f"{v} ms", f"{v}ms"]  # noqa: E731
    done, wait, turn = ask["done"], ask["wait"], ask["turn"]
    avg = sum(tm[x]["waiting"] for x in names) / len(names)
    qs = [short(f"{who} studies this {algo} schedule {rng.choice(SETTINGS)}. What is the completion time of {done}, "
                f"in ms?", tm[done]["completion"], ms(tm[done]["completion"])),
          short(f"Using the formulas printed, what is the waiting time of {wait} in this {algo} schedule, in ms?",
                tm[wait]["waiting"], ms(tm[wait]["waiting"])),
          short(f"What is the turnaround time of {turn} in this {algo} schedule, in ms?", tm[turn]["turnaround"],
                ms(tm[turn]["turnaround"])),
          short(f"What is the average waiting time of the {len(names)} processes in this {algo} schedule, in ms?",
                num(avg), ms(num(avg)) + [f"{avg:.2f}"])]
    if p["hidden"] >= 0:
        key = blocks[p["hidden"]][0]
        a, b = blocks[p["hidden"]][1:]
        qs.append(mcq(f"Which process runs in the block marked ? on this Round Robin Gantt chart, from {a} ms to {b} ms?",
                      key, rng.sample([x for x in names if x != key], 3), rng))
    else:
        t = ask["at"]
        key = next(b[0] for b in blocks if b[1] < t < b[2])
        qs.append(mcq(f"Which process is running at time {t} ms in this {algo} schedule?", key,
                      rng.sample([x for x in names if x != key], 3), rng))
    return qs
