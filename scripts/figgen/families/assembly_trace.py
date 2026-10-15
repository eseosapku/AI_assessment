"""Assembly trace (AL): a short program in the 9618 instruction set (eight to ten lines, numbered by address, a loop
marked with a label), the memory it works on with its starting values, and its trace table filled in for the first
time round the loop only, a blank cell meaning no change, as Cambridge prints them. A key gives the instructions used.

Six programs: multiplying by repeated addition, adding the whole numbers down from n, dividing by repeated
subtraction, doubling until a target is reached, and adding a list up to its 0 with indexed (LDX) or indirect (LDI)
addressing. Asks the value in ACC just after a given line runs for a later time, the value left at an address when
END is reached, how many times a line runs, and which statement says what the program does.

Every key is the program executed (`execute`). What is asked is never in the partial trace table: a later pass, the
end, or a count past the first pass. The four statements are two operations times two result addresses, each wrong
one false for the figure's own numbers.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "assembly_trace"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("AL",)
CONCEPTS = tuple(f"computing.{c}" for c in ("assembly-language", "machine-code-instructions", "indirect-addressing"))
# A topic whose sections the book lists is reached only if one names assembly or low-level programming.
NEEDS = r"assembly|low.level|machine code|addressing|instruction set"
AVOID = r"spreadsheet|database|network|security|graphic|\bpresentation|email|python|html|system software|operating system"
HEAD = "#d9dee3"
SHADE = "#f2f3f4"
TEMPLATES = ["multiply", "triangle", "divide", "double", "list_ix", "list_ind"]


def build(t: str, start: int, data: int, rng: random.Random) -> dict | None:
    """The program, the memory it starts with, the trace table's columns and the facts the questions use."""
    a, b, c = data, data + 1, data + 2
    if t == "multiply":
        x, y = rng.randint(3, 9), rng.randint(3, 5)
        prog = [["LOOP", "LDD", c], ["", "ADD", a], ["", "STO", c], ["", "LDD", b], ["", "DEC", "ACC"], ["", "STO", b],
                ["", "CMP", "#0"], ["", "JPN", "LOOP"], ["", "END", ""]]
        mem = [[a, x], [b, y], [c, 0]]
        cols = ["ACC", str(b), str(c)]
        acc_lines, result, spare = [0, 1, 3, 4], c, b
        ops = (f"multiplies the value at {a} by the value at {b}", f"adds the value at {a} to the value at {b}")
    elif t == "triangle":
        n = rng.randint(3, 6)
        b, c = data, data + 1
        prog = [["LOOP", "LDD", c], ["", "ADD", b], ["", "STO", c], ["", "LDD", b], ["", "DEC", "ACC"], ["", "STO", b],
                ["", "CMP", "#0"], ["", "JPN", "LOOP"], ["", "END", ""]]
        mem = [[b, n], [c, 0]]
        cols = ["ACC", str(b), str(c)]
        acc_lines, result, spare = [0, 1, 3, 4], c, b
        ops = (f"adds the whole numbers from 1 to the value at {b}", f"multiplies the value at {b} by itself")
    elif t == "divide":
        d, q = rng.randint(2, 9), rng.randint(3, 5)
        prog = [["LOOP", "LDD", a], ["", "SUB", b], ["", "STO", a], ["", "LDD", c], ["", "INC", "ACC"], ["", "STO", c],
                ["", "LDD", a], ["", "CMP", "#0"], ["", "JPN", "LOOP"], ["", "END", ""]]
        mem = [[a, d * q], [b, d], [c, 0]]
        cols = ["ACC", str(a), str(c)]
        acc_lines, result, spare = [0, 1, 3, 4], c, a
        ops = (f"divides the value at {a} by the value at {b}", f"subtracts the value at {b} from the value at {a}")
    elif t == "double":
        v, k = rng.randint(2, 7), rng.randint(3, 4)
        prog = [["LOOP", "LDD", a], ["", "ADD", a], ["", "STO", a], ["", "LDD", c], ["", "INC", "ACC"], ["", "STO", c],
                ["", "LDD", a], ["", "CMP", b], ["", "JPN", "LOOP"], ["", "END", ""]]
        mem = [[a, v], [b, v * 2 ** k], [c, 0]]
        cols = ["ACC", str(a), str(c)]
        acc_lines, result, spare = [1, 3, 4, 6], c, a
        ops = (f"counts how many times the value at {a} is doubled to reach the value at {b}",
               f"counts how many times 2 is added to the value at {a} to reach the value at {b}")
    else:
        n = rng.randint(3, 5)
        items = [rng.randint(2, 20) for _ in range(n)]
        if items[0] in (n, sum(items)):  # "stores the result at" the first item must stay false
            return None
        lst, total = data, data + 10
        mem = [[lst + i, v] for i, v in enumerate(items)] + [[lst + n, 0]]
        if t == "list_ix":
            prog = [["", "LDR", "#0"], ["LOOP", "LDX", lst], ["", "CMP", "#0"], ["", "JPE", "DONE"], ["", "ADD", total],
                    ["", "STO", total], ["", "INC", "IX"], ["", "JMP", "LOOP"], ["DONE", "END", ""]]
            mem.append([total, 0])
            cols = ["ACC", "IX", str(total)]
            acc_lines, result, spare = [1, 4], total, lst
        else:
            ptr, total = data + 10, data + 11
            prog = [["LOOP", "LDI", ptr], ["", "CMP", "#0"], ["", "JPE", "DONE"], ["", "ADD", total], ["", "STO", total],
                    ["", "LDD", ptr], ["", "INC", "ACC"], ["", "STO", ptr], ["", "JMP", "LOOP"], ["DONE", "END", ""]]
            mem += [[ptr, lst], [total, 0]]
            cols = ["ACC", str(ptr), str(total)]
            acc_lines, result, spare = [0, 3, 5, 6], total, ptr
        ops = (f"adds up the values from address {lst} to the first 0", f"counts the values from address {lst} to the first 0")
    prog = [[lab, op, str(x)] for lab, op, x in prog]
    return {"program": prog, "memory": mem, "columns": cols, "acc_lines": acc_lines, "result": result, "spare": spare,
            "ops": list(ops)}


def execute(p: dict) -> tuple[list[list], dict, dict, dict]:
    """The trace (address, ACC, IX, memory after each instruction), the final memory, each address's ACC after each
    time it ran, and how many times each address ran."""
    prog, start = p["program"], p["start"]
    labels = {lab: start + i for i, (lab, _, _) in enumerate(prog) if lab}
    mem = {a: v for a, v in p["memory"]}
    acc = ix = flag = None
    pc = start
    trace, after, runs = [], {}, {}

    def addr(x):
        return labels.get(x, None) if x in labels else int(x)

    def val(x):
        return int(x[1:]) if x.startswith("#") else mem[addr(x)]

    while True:
        here = pc
        _, op, x = prog[here - start]
        pc += 1
        runs[here] = runs.get(here, 0) + 1
        if op == "LDM":
            acc = int(x[1:])
        elif op == "LDD":
            acc = mem[addr(x)]
        elif op == "LDI":
            acc = mem[mem[addr(x)]]
        elif op == "LDX":
            acc = mem[addr(x) + ix]
        elif op == "LDR":
            ix = int(x[1:])
        elif op == "STO":
            mem[addr(x)] = acc
        elif op == "ADD":
            acc += val(x)
        elif op == "SUB":
            acc -= val(x)
        elif op in ("INC", "DEC"):
            step = 1 if op == "INC" else -1
            if x == "ACC":
                acc += step
            else:
                ix += step
        elif op == "CMP":
            flag = acc == val(x)
        elif op == "JPE" and flag:
            pc = addr(x)
        elif op == "JPN" and not flag:
            pc = addr(x)
        elif op == "JMP":
            pc = addr(x)
        after.setdefault(here, []).append(acc)
        trace.append([here, acc, ix, dict(mem)])
        if op == "END":
            return trace, mem, after, runs


def first_pass(trace: list) -> list:
    """The rows up to and including the first jump back to the loop: what the figure's trace table shows."""
    for i, row in enumerate(trace[:-1]):
        if trace[i + 1][0] <= row[0]:
            return trace[:i + 1]
    return trace


ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"]


def sample(rng: random.Random) -> dict:
    t = rng.choice(TEMPLATES)
    while True:
        start = rng.choice(range(100, 400, 10))
        data = start + rng.choice([20, 30, 50, 100])
        built = build(t, start, data, rng)
        if not built:
            continue
        p = {"band": "AL", "template": t, "start": start, **{k: built[k] for k in ("program", "memory", "columns")}}
        trace, mem, after, runs = execute(p)
        shown = {}
        for row in first_pass(trace):
            shown[row[0]] = shown.get(row[0], 0) + 1
        a = start + rng.choice(built["acc_lines"])
        k = rng.randint(shown.get(a, 0) + 1, len(after[a]))
        loop = [start + i for i in range(len(p["program"])) if runs[start + i] > shown.get(start + i, 0) and runs[start + i] >= 2]
        p["ask_acc"] = [a, k]
        p["ask_mem"] = built["result"] if rng.random() < 0.75 else built["spare"]
        p["ask_run"] = rng.choice(loop)
        p["ops"] = built["ops"]
        p["result"] = built["result"]
        p["spare"] = built["spare"]
        return p


# --- drawing ---------------------------------------------------------------------------------------

KEY = {"LDM": ("#n", "Load the number n into ACC"),
       "LDD": ("<address>", "Load the contents of <address> into ACC"),
       "LDI": ("<address>", "Load into ACC from the address held at <address>"),
       "LDX": ("<address>", "Load the contents of <address> + IX into ACC"),
       "LDR": ("#n", "Load the number n into IX"),
       "STO": ("<address>", "Store the contents of ACC at <address>"),
       "ADD": ("<address>", "Add the contents of <address> to ACC"),
       "SUB": ("<address>", "Subtract the contents of <address> from ACC"),
       "INC": ("<register>", "Add 1 to the register (ACC or IX)"),
       "DEC": ("<register>", "Subtract 1 from the register (ACC or IX)"),
       "JPE": ("<address>", "Jump to <address> if the compare was True"),
       "JPN": ("<address>", "Jump to <address> if the compare was False"),
       "JMP": ("<address>", "Jump to <address>"),
       "END": ("", "Return control to the operating system")}


def _cell(ax, x, y, w, h, text="", fill="white", bold=False, size=10, mono=True, gid=None):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor=INK, linewidth=1.0))
    if text != "":
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=size, fontweight="bold" if bold else "normal",
                family="monospace" if mono else "DejaVu Sans", gid=gid, linespacing=1.1)


def _key_lines(prog: list) -> list[tuple[str, str]]:
    out, seen = [], set()
    for _, op, x in prog:
        if op == "CMP":
            form = ("CMP #n", "Compare ACC with the number n") if x.startswith("#") else (
                "CMP <address>", "Compare ACC with the contents of <address>")
        else:
            form = (f"{op} {KEY[op][0]}".strip(), KEY[op][1])
        if form not in seen:
            seen.add(form)
            out.append(form)
    return out


def draw(p: dict):
    prog, start = p["program"], p["start"]
    trace, _, _, _ = execute(p)
    rows = first_pass(trace)
    cols = p["columns"]
    fig, ax = new_figure(12.6, 8.4)
    top = 10.0
    # the program: address, label, instruction
    rh = 0.5
    ax.text(0, top + 0.3, "Program", ha="left", va="center", fontsize=11, fontweight="bold")
    widths = [1.3, 1.2, 2.5]
    for j, (h, w) in enumerate(zip(["Address", "Label", "Instruction"], widths)):
        _cell(ax, sum(widths[:j]), top - rh, w, rh, h, HEAD, bold=True, size=9.5, mono=False)
    for i, (lab, op, x) in enumerate(prog):
        y = top - (i + 2) * rh
        _cell(ax, 0, y, widths[0], rh, str(start + i), SHADE, size=10, gid=f"addr:{i}")
        _cell(ax, widths[0], y, widths[1], rh, f"{lab}:" if lab else "", size=10, gid=f"label:{i}")
        ax.add_patch(Rectangle((widths[0] + widths[1], y), widths[2], rh, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(widths[0] + widths[1] + 0.25, y + rh / 2, f"{op} {x}".strip(), ha="left", va="center", fontsize=10.5,
                family="monospace", gid=f"prog:{i}")
    prog_bottom = top - (len(prog) + 1) * rh
    ax.text(0, prog_bottom - 0.3, "A label stands for the address of its line.", ha="left", va="center", fontsize=8.5,
            style="italic", color="#444444")
    # the memory with its starting values
    mx = 5.5
    ax.text(mx, top + 0.3, "Memory", ha="left", va="center", fontsize=11, fontweight="bold")
    _cell(ax, mx, top - rh, 1.2, rh, "Address", HEAD, bold=True, size=9.5, mono=False)
    _cell(ax, mx + 1.2, top - rh, 1.3, rh, "Contents", HEAD, bold=True, size=9.5, mono=False)
    for i, (a, v) in enumerate(sorted(p["memory"])):
        y = top - (i + 2) * rh
        _cell(ax, mx, y, 1.2, rh, str(a), SHADE)
        _cell(ax, mx + 1.2, y, 1.3, rh, str(v), gid=f"mem:{a}")
    # the trace table, first time round the loop
    tx, th = 8.6, 0.45
    one_mem = sum(c.isdigit() for c in cols) == 1  # "Memory address" needs the room of more than one column
    cw = [1.5] + [1.6 if (c.isdigit() and one_mem) else 1.1 for c in cols]
    xs = [tx + sum(cw[:j]) for j in range(len(cw))]
    ax.text(tx, top + 0.55, "Trace table: the first time round the loop", ha="left", va="center", fontsize=10.5,
            fontweight="bold")
    ax.text(tx, top + 0.2, "A blank cell means no change.", ha="left", va="center", fontsize=8.5, style="italic",
            color="#444444")
    _cell(ax, xs[0], top - 2 * th, cw[0], 2 * th, "Instruction\naddress", HEAD, bold=True, size=8.5, mono=False)
    memcols = [j for j, c in enumerate(cols, start=1) if c.isdigit()]
    for j, c in enumerate(cols, start=1):
        if c.isdigit():
            _cell(ax, xs[j], top - 2 * th, cw[j], th, c, HEAD, bold=True, size=9.5)
        else:
            _cell(ax, xs[j], top - 2 * th, cw[j], 2 * th, c, HEAD, bold=True, size=9.5)
    m0, m1 = xs[memcols[0]], xs[memcols[-1]] + cw[memcols[-1]]
    _cell(ax, m0, top - th, m1 - m0, th, "Memory address", HEAD, bold=True, size=8.5, mono=False)
    start_mem = {a: v for a, v in p["memory"]}
    prev = {"ACC": None, "IX": None, **{c: start_mem[int(c)] for c in cols if c.isdigit()}}
    y = top - 3 * th
    _cell(ax, xs[0], y, cw[0], th, "", SHADE)
    for j, c in enumerate(cols, start=1):
        _cell(ax, xs[j], y, cw[j], th, str(prev[c]) if c.isdigit() else "", gid=f"trace:0:{c}" if c.isdigit() else None)
    for r, (a, acc, ix, mem) in enumerate(rows, start=1):
        y = top - (r + 3) * th
        _cell(ax, xs[0], y, cw[0], th, str(a), SHADE, gid=f"trace:{r}:addr")
        now = {"ACC": acc, "IX": ix, **{c: mem[int(c)] for c in cols if c.isdigit()}}
        for j, c in enumerate(cols, start=1):
            changed = now[c] != prev[c]
            _cell(ax, xs[j], y, cw[j], th, str(now[c]) if changed else "", gid=f"trace:{r}:{c}" if changed else None)
        prev = now
    trace_bottom = top - (len(rows) + 3) * th
    # the instructions used, as the paper gives them
    ky = min(prog_bottom - 0.8, trace_bottom - 0.45)
    ax.text(0, ky, "Instructions used", ha="left", va="center", fontsize=10, fontweight="bold")
    lines = _key_lines(prog)
    half = (len(lines) + 1) // 2
    for i, (form, words) in enumerate(lines):
        col, row = divmod(i, half)
        x0, yy = col * 6.9, ky - 0.42 * (row + 1)
        ax.text(x0, yy, form, ha="left", va="center", fontsize=8.5, family="monospace", fontweight="bold")
        ax.text(x0 + 2.05, yy, words, ha="left", va="center", fontsize=8.5)
    bottom = ky - 0.42 * (half + 1) + 0.1
    ax.set_xlim(-0.2, max(xs[-1] + cw[-1], 13.0) + 0.2)
    ax.set_ylim(bottom, top + 0.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "before a mock exam"]
TRACES = ["traces", "dry-runs", "works through"]
RUNS = ["runs", "follows", "keeps tracing"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    trace, mem, after, runs = execute(p)
    a, k = p["ask_acc"]
    acc = after[a][k - 1]
    m = p["ask_mem"]
    r = p["ask_run"]
    n = runs[r]
    true_op, false_op = p["ops"]
    noun = "count" if p["template"] == "double" else "result"
    say = lambda op, at: f"It {op} and stores the {noun} at {at}"  # noqa: E731
    key = say(true_op, p["result"])
    wrong = [say(true_op, p["spare"]), say(false_op, p["result"]), say(false_op, p["spare"])]
    how = rng.choice([f"How many times does the instruction at address {r} run before the program ends?",
                      f"How many times is the instruction at address {r} executed in all?"])
    return [short(f"{who} {rng.choice(TRACES)} this program {rng.choice(SETTINGS)}. What is the value in ACC just after the "
                  f"instruction at address {a} runs for the {ORDINALS[k - 1]} time?", acc, [str(acc)]),
            short(f"{friend} {rng.choice(RUNS)} the program to the end. What value is stored at address {m} when END is reached?",
                  mem[m], [str(mem[m])]),
            short(how, n, [str(n), f"{n} times"]),
            mcq(rng.choice(["Which statement describes what this program does?", "What does this program do?"]), key, wrong, rng)]
