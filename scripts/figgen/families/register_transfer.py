"""Register transfer (AL, UP): a processor drawn as the textbooks draw it, the control unit and the ALU named, the PC,
MAR, MDR, CIR and ACC joined by their data paths (PC to MAR, MDR to CIR, CIR to the control unit, MDR to and from ACC,
ACC to and from the ALU), four of the five registers lettered, and three buses to main memory lettered too: the
address bus with one arrowhead, from the MAR; the data and control buses with two. Main memory lists a few addresses
and their contents, and the PC's starting value is printed below it. Beneath, the fetch stage in register transfer
notation (AL) or the fetch-decode-execute steps in words (UP), one step blank.

Asks which letter is a named register, which register transfer (or step) fills the blank, which bus is a named
bus, and what the PC holds after k complete fetch-execute cycles (AL: the listing has a JMP, its convention stated).

Every key is read from the drawing's own connections; the four options for the blank are two slips crossed (the
registers swapped, a bracket or register wrong), each a transfer the fetch does not make.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "register_transfer"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("register-transfer-notation", "von-neumann-model", "system-bus",
                                             "computer-system-overview"))
# A topic whose sections the book lists is reached only if one names the processor, its registers or the F-E cycle.
NEEDS = r"\bprocessor|\bcpu\b|fetch|register|von neumann|system bus|central processing"
AVOID = r"hardware and software|software and hardware|data, information|computer applications|microprocessor-controlled|spreadsheet|database|network|security|graphic|\bpresentation|email|html|python|virtual memory"
FILL = "#eef1f3"
HEAD = "#d9dee3"
REGISTERS = ["PC", "MAR", "MDR", "CIR", "ACC"]
RTN = ["MAR ← [PC]", "PC ← [PC] + 1", "MDR ← [[MAR]]", "CIR ← [MDR]"]
WORDED = ["The address in the PC is copied to the MAR", "The PC is incremented by 1",
          "The instruction at the address in the MAR is copied to the MDR", "The instruction in the MDR is copied to the CIR",
          "The control unit decodes the instruction in the CIR", "The instruction is executed"]
# Each blank's three slips: two mistakes and both together, so no option stands out from its words alone.
SLIPS = {
    "AL": [["PC ← [MAR]", "MAR ← [[PC]]", "PC ← [[MAR]]"],
           ["MAR ← [MAR] + 1", "PC ← [[PC]] + 1", "MAR ← [[MAR]] + 1"],
           ["MAR ← [[MDR]]", "MDR ← [MAR]", "MAR ← [MDR]"],
           ["MDR ← [CIR]", "CIR ← [[MDR]]", "MDR ← [[CIR]]"]],
    "UP": [["The address in the MAR is copied to the PC", "The address in the PC is copied to the MDR",
            "The address in the MDR is copied to the PC"],
           ["The MAR is incremented by 1", "The PC is decremented by 1", "The MAR is decremented by 1"],
           ["The instruction at the address in the MDR is copied to the MAR",
            "The instruction at the address in the PC is copied to the MDR",
            "The instruction at the address in the MDR is copied to the PC"],
           ["The instruction in the CIR is copied to the MDR", "The instruction in the MAR is copied to the CIR",
            "The instruction in the CIR is copied to the MAR"],
           ["The ALU decodes the instruction in the CIR", "The control unit decodes the instruction in the MDR",
            "The ALU decodes the instruction in the MDR"]],
}
WORK = ["LDD", "ADD", "SUB", "STO"]


def run_pc(p: dict, cycles: int) -> int:
    """The PC after complete fetch-execute cycles: each fetch adds 1; executing JMP n puts n in the PC."""
    listing = {a: c for a, c in p["listing"]}
    pc = p["start"]
    for _ in range(cycles):
        word = listing[pc]
        pc += 1
        if word.startswith("JMP "):
            pc = int(word[4:])
    return pc


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    named = rng.choice(REGISTERS)
    letters = rng.sample("ABCD", 4)
    regs = {r: "" for r in REGISTERS}
    for r, L in zip([r for r in REGISTERS if r != named], letters):
        regs[r] = L
    buses = dict(zip(["address", "data", "control"], rng.sample("PQR", 3)))
    start = rng.choice(range(100, 900, 10))
    if band == "AL":
        data = start + rng.choice([20, 40, 50, 100])
        j = rng.randint(1, 3)  # the JMP's place in the listing
        t = rng.randint(j + 2, 5)  # where it jumps to, forward
        listing = []
        for i in range(6):
            if i == j:
                listing.append([start + i, f"JMP {start + t}"])
            elif rng.random() < 0.15:
                listing.append([start + i, f"LDM #{rng.randint(1, 20)}"])
            else:
                listing.append([start + i, f"{rng.choice(WORK)} {data + rng.randint(0, 4)}"])
        # j + 1 cycles end on the JMP itself; later ones fetch from T on, all within the listing
        cycles = rng.choice([k for k in range(j + 1, 7) if k <= j + 1 or start + t + (k - j - 2) <= start + 5])
        blank = rng.randint(0, 3)
    else:
        listing = [[start + i, f"{rng.randint(0, 15):04b} {rng.randint(0, 15):04b}"] for i in range(6)]
        cycles = rng.randint(2, 5)
        blank = rng.randint(0, 4)
    return {"band": band, "regs": regs, "buses": buses, "blank": blank, "start": start, "listing": listing,
            "cycles": cycles, "ask_reg": rng.choice([r for r in REGISTERS if r != named]), "ask_bus": rng.choice(list(buses))}


# --- drawing ---------------------------------------------------------------------------------------

def _arrow(ax, a, b, both=False, lw=1.4):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="<|-|>" if both else "-|>", color=INK, lw=lw, shrinkA=0,
                                                    shrinkB=0, mutation_scale=13))


def _head(ax, tip, frm, lw=1.4):
    """An arrowhead at `tip`, pointing away from `frm` (the end of a bent line)."""
    ax.annotate("", xy=tip, xytext=frm, arrowprops=dict(arrowstyle="-|>", color=INK, lw=lw, shrinkA=0, shrinkB=0,
                                                         mutation_scale=13))


def _box(ax, x, y, w, h, text, gid=None, size=11, fill=FILL):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.02", facecolor=fill, edgecolor=INK,
                                linewidth=1.3, zorder=3))
    ax.text(x, y, text, ha="center", va="center", fontsize=size, fontweight="bold", zorder=4, gid=gid)


def draw(p: dict):
    fig, ax = new_figure(10.6, 9.0)
    al = p["band"] == "AL"
    steps = RTN if al else WORDED
    # the processor
    ax.add_patch(Rectangle((0.2, 1.3), 8.4, 7.2, facecolor="none", edgecolor=INK, linewidth=1.6))
    ax.text(0.45, 8.15, "Processor (CPU)", ha="left", va="center", fontsize=11, fontweight="bold")
    _box(ax, 1.8, 4.8, 2.2, 1.1, "Control\nunit", size=10.5)
    _box(ax, 1.8, 2.6, 2.2, 1.0, "ALU", size=11)
    where = {"PC": (4.3, 6.9), "MAR": (7.0, 6.9), "CIR": (4.3, 4.8), "MDR": (7.0, 4.8), "ACC": (4.3, 2.6)}
    w, h = 1.5, 0.8
    for r, (x, y) in where.items():
        letter = p["regs"][r]
        _box(ax, x, y, w, h, letter or r, gid=f"reg:{r}", size=15 if letter else 11.5, fill="white")
    # data paths inside the processor
    _arrow(ax, (4.3 + w / 2, 6.9), (7.0 - w / 2, 6.9))  # PC to MAR
    _arrow(ax, (7.0 - w / 2, 4.8), (4.3 + w / 2, 4.8))  # MDR to CIR
    _arrow(ax, (4.3 - w / 2, 4.8), (2.9, 4.8))  # CIR to the control unit
    _arrow(ax, (4.3 - w / 2, 2.6), (2.9, 2.6), both=True)  # ACC and ALU
    ax.plot([7.0, 7.0, 4.3 + w / 2 + 0.4], [4.8 - h / 2 - 0.4, 2.6, 2.6], color=INK, linewidth=1.4)  # MDR and ACC
    _head(ax, (4.3 + w / 2, 2.6), (4.3 + w / 2 + 0.4, 2.6))
    _head(ax, (7.0, 4.8 - h / 2), (7.0, 4.8 - h / 2 - 0.4))
    # main memory and the three buses
    mx0, mx1 = 10.4, 13.2
    ax.add_patch(Rectangle((mx0, 1.3), mx1 - mx0, 7.2, facecolor="none", edgecolor=INK, linewidth=1.6))
    ax.text((mx0 + mx1) / 2, 8.15, "Main memory", ha="center", va="center", fontsize=11, fontweight="bold")
    bw = 2.4
    ax.plot([7.0 + w / 2, mx0 - 0.3], [6.9, 6.9], color=INK, linewidth=2.6)  # address: one way, to memory
    _head(ax, (mx0, 6.9), (mx0 - 0.4, 6.9), lw=2.0)
    ax.plot([7.0 + w / 2 + 0.3, mx0 - 0.3], [4.8, 4.8], color=INK, linewidth=2.6)  # data: both ways
    _head(ax, (mx0, 4.8), (mx0 - 0.4, 4.8), lw=2.0)
    _head(ax, (7.0 + w / 2, 4.8), (7.0 + w / 2 + 0.4, 4.8), lw=2.0)
    ax.plot([1.8, 1.8, mx0 - 0.3], [5.35 + 0.3, 5.95, 5.95], color=INK, linewidth=2.6)  # control: both ways
    _head(ax, (mx0, 5.95), (mx0 - 0.4, 5.95), lw=2.0)
    _head(ax, (1.8, 5.35), (1.8, 5.75), lw=2.0)
    for bus, y in (("address", 6.9), ("data", 4.8), ("control", 5.95)):
        ax.text(9.45, y + 0.4, p["buses"][bus], ha="center", va="center", fontsize=13, fontweight="bold", gid=f"bus:{bus}",
                bbox=dict(boxstyle="circle,pad=0.12", facecolor="white", edgecolor=INK, linewidth=1.0))
    # the listing in memory
    tx, aw, cw, rh = mx0 + 0.12, 1.15, 1.45, 0.52
    ty = 7.5
    for x, wd, head in ((tx, aw, "Address"), (tx + aw, cw, "Contents")):
        ax.add_patch(Rectangle((x, ty), wd, rh, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
        ax.text(x + wd / 2, ty + rh / 2, head, ha="center", va="center", fontsize=8.5, fontweight="bold")
    for i, (a, c) in enumerate(p["listing"]):
        y = ty - (i + 1) * rh
        ax.add_patch(Rectangle((tx, y), aw, rh, facecolor="#f2f3f4", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((tx + aw, y), cw, rh, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(tx + aw / 2, y + rh / 2, str(a), ha="center", va="center", fontsize=9.5, family="monospace")
        ax.text(tx + aw + cw / 2, y + rh / 2, c, ha="center", va="center", fontsize=9 if not al else 9.5, family="monospace",
                gid=f"mem:{a}")
    ax.text((mx0 + mx1) / 2, 1.75, f"At the start the\nPC holds {p['start']}", ha="center", va="center", fontsize=9.5,
            gid="pcstart", linespacing=1.2)
    # the steps, one blank
    title = "The fetch stage in register transfer notation" if al else "The steps of the fetch-decode-execute cycle"
    ax.text(0.2, 0.75, title, ha="left", va="center", fontsize=11, fontweight="bold")
    y0 = 0.2
    for i, s in enumerate(steps):
        y = y0 - 0.48 * i
        ax.text(0.45, y, f"{i + 1}", ha="left", va="center", fontsize=10.5, color="#555555")
        text = "_" * 18 if i == p["blank"] else s
        ax.text(1.0, y, text, ha="left", va="center", fontsize=11 if al else 10.5, family="monospace" if al else "DejaVu Sans",
                gid=f"step:{i}")
    bottom = y0 - 0.48 * (len(steps) - 1) - 0.4
    if al:
        ax.text(5.6, y0 - 0.48, "[R]: the contents of register R\n[[R]]: the contents of the\naddress held in R", ha="left",
                va="center", fontsize=9, style="italic", color="#444444", linespacing=1.25)
    ax.set_xlim(0.0, mx1 + 0.2)
    ax.set_ylim(bottom, 8.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "before a mock exam"]
VERBS = ["studies", "labels", "revises from", "copies out"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    al = p["band"] == "AL"
    steps = RTN if al else WORDED
    b = p["blank"]
    reg = p["ask_reg"]
    letters = [L for L in p["regs"].values() if L]
    k = p["cycles"]
    pc = run_pc(p, k)
    rule = ("Each fetch adds 1 to the PC, and executing a JMP puts its address in the PC." if al
            else "Each fetch adds 1 to the PC.")
    blank = (f"Which register transfer goes in the blank, step {b + 1}?" if al else f"Which step goes in the blank, step {b + 1}?")
    return [mcq(f"{who} {rng.choice(VERBS)} this processor diagram {rng.choice(SETTINGS)}. Which letter is the {reg}?",
                p["regs"][reg], [L for L in letters if L != p["regs"][reg]], rng),
            mcq(blank, steps[b], SLIPS[p["band"]][b], rng),
            mcq(f"{friend} traces the buses to main memory. Which bus is the {p['ask_bus']} bus?", p["buses"][p["ask_bus"]],
                [L for L in p["buses"].values() if L != p["buses"][p["ask_bus"]]], rng),
            short(f"{rule} Starting from the PC value shown, what does the PC hold after {k} complete fetch-execute cycles?",
                  pc, [str(pc)])]
