"""Answers of the P3v computer science families, recomputed independently over 1,000 seeds: a small interpreter of
the 9618 assembly subset the programs use, the fetch stage as the syllabus writes it, a K-map minimiser of the test's
own, the control rules applied to each sensor reading, and floating-point numbers decoded from their bits.

The first figures are drawn and read back (each piece of text carries a gid naming what it shows), so every value a
question asks about is checked to be on the figure.
"""
import itertools
import random
import re
from collections import Counter
from fractions import Fraction

import matplotlib.pyplot as plt
import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
ORDINAL = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7}


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def wrong(q):
    return [o for i, o in enumerate(q.options) if i != int(q.answer)]


def drawn(m, p):
    """Every piece of text on the figure: {gid: (text, x, y)} for those with a gid, and the list of all strings."""
    fig = m.draw(p)
    try:
        by_gid, words = {}, []
        for ax in fig.axes:
            for t in ax.texts:
                s = t.get_text()
                words.append(s)
                if t.get_gid():
                    x, y = t.get_position()
                    by_gid[t.get_gid()] = (s, float(x), float(y))
        return by_gid, words
    finally:
        plt.close(fig)


# --- assembly_trace -------------------------------------------------------------------------------

OPCODES_9618 = {"LDM", "LDD", "LDI", "LDX", "LDR", "MOV", "STO", "ADD", "SUB", "INC", "DEC", "JMP", "CMP", "CMI", "JPE", "JPN",
                "IN", "OUT", "END"}


def interpret(program, start, memory):
    """Runs the program as the 9618 instruction set defines it. Returns the final memory, every address's ACC after
    each time it ran, how many times each address ran, and the rows of a trace: (address, ACC, IX, memory) after each."""
    labels = {lab: start + i for i, (lab, _, _) in enumerate(program) if lab}
    mem = {a: v for a, v in memory}
    acc, ix, flag, pc = None, None, None, start
    after, runs, trace = {}, Counter(), []

    def where(x):
        return labels[x] if x in labels else int(x)

    def operand_value(x):
        return int(x[1:]) if x.startswith("#") else mem[where(x)]

    for _ in range(1000):
        here = pc
        lab, op, x = program[here - start]
        runs[here] += 1
        pc += 1
        if op == "END":
            trace.append((here, acc, ix, dict(mem)))
            after.setdefault(here, []).append(acc)
            return mem, after, runs, trace
        if op == "LDM":
            acc = int(x[1:])
        elif op == "LDD":
            acc = mem[where(x)]
        elif op == "LDI":
            acc = mem[mem[where(x)]]
        elif op == "LDX":
            acc = mem[where(x) + ix]
        elif op == "LDR":
            ix = int(x[1:])
        elif op == "STO":
            mem[where(x)] = acc
        elif op == "ADD":
            acc = acc + operand_value(x)
        elif op == "SUB":
            acc = acc - operand_value(x)
        elif op in ("INC", "DEC"):
            d = 1 if op == "INC" else -1
            if x == "ACC":
                acc += d
            else:
                assert x == "IX"
                ix += d
        elif op == "CMP":
            flag = acc == operand_value(x)
        elif op == "JPE":
            if flag:
                pc = where(x)
        elif op == "JPN":
            if not flag:
                pc = where(x)
        elif op == "JMP":
            pc = where(x)
        else:
            raise AssertionError(op)
        after.setdefault(here, []).append(acc)
        trace.append((here, acc, ix, dict(mem)))
    raise AssertionError("the program never ends")


def first_pass(trace):
    """The trace up to and including the first jump back: the rows the figure shows."""
    rows = []
    for i, row in enumerate(trace):
        rows.append(row)
        if i + 1 < len(trace) and trace[i + 1][0] <= row[0]:
            return rows
    return rows


CLAIMS = [
    (r"multiplies the value at (\d+) by the value at (\d+)", lambda m, a, b: m[a] * m[b]),
    (r"adds the value at (\d+) to the value at (\d+)", lambda m, a, b: m[a] + m[b]),
    (r"adds the whole numbers from 1 to the value at (\d+)", lambda m, a: m[a] * (m[a] + 1) // 2),
    (r"multiplies the value at (\d+) by itself", lambda m, a: m[a] * m[a]),
    (r"divides the value at (\d+) by the value at (\d+)", lambda m, a, b: Fraction(m[a], m[b])),
    (r"subtracts the value at (\d+) from the value at (\d+)", lambda m, a, b: m[b] - m[a]),
    (r"counts how many times the value at (\d+) is doubled to reach the value at (\d+)",
     lambda m, a, b: next((k for k in range(12) if m[a] * 2 ** k == m[b]), None)),
    (r"counts how many times 2 is added to the value at (\d+) to reach the value at (\d+)", lambda m, a, b: Fraction(m[b] - m[a], 2)),
    (r"adds up the values from address (\d+) to the first 0", lambda m, a: sum(itertools.takewhile(lambda v: v != 0, (m[k] for k in itertools.count(a))))),
    (r"counts the values from address (\d+) to the first 0", lambda m, a: len(list(itertools.takewhile(lambda v: v != 0, (m[k] for k in itertools.count(a)))))),
]


def claim_holds(text, start_mem, end_mem):
    where = re.search(r"stores the (?:result|count|total) at (\d+)", text)
    assert where, text
    for pattern, f in CLAIMS:
        got = re.search(pattern, text)
        if got:
            value = f(start_mem, *map(int, got.groups()))
            return value is not None and end_mem[int(where.group(1))] == value
    raise AssertionError(f"no claim recognised in {text!r}")


def test_assembly_trace():
    m = fam("assembly_trace")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        prog, start = p["program"], p["start"]
        assert 6 <= len(prog) <= 10, (s, len(prog))
        assert {op for _, op, _ in prog} <= OPCODES_9618
        assert any(lab for lab, _, _ in prog)  # a label, as the task asks
        kinds[p["template"]] += 1
        start_mem = {a: v for a, v in p["memory"]}
        end_mem, after, runs, trace = interpret(prog, start, p["memory"])
        shown = first_pass(trace)
        shown_runs = Counter(r[0] for r in shown)
        assert len(qs) == 4
        for q in qs:
            got = re.search(r"ACC just after the instruction at address (\d+) runs for the (\w+) time", q.stem)
            if got:
                a, k = int(got.group(1)), ORDINAL[got.group(2)]
                assert int(q.answer) == after[a][k - 1], (s, q.stem)
                assert shown_runs[a] < k, (s, "the asked value is already in the trace table")
            got = re.search(r"stored at address (\d+) when END is reached", q.stem)
            if got:
                assert int(q.answer) == end_mem[int(got.group(1))], s
            got = re.search(r"How many times (?:does|is) the instruction at address (\d+)", q.stem)
            if got:
                n = runs[int(got.group(1))]
                assert int(q.answer) == n and n >= 2, s
                assert shown_runs[int(got.group(1))] < n, s  # not countable off the partial trace
            if q.kind == "mcq":
                assert claim_holds(picked(q), start_mem, end_mem), (s, picked(q))
                for o in wrong(q):
                    assert not claim_holds(o, start_mem, end_mem), (s, o)
        assert any("ACC just after" in q.stem for q in qs) and any(q.kind == "mcq" for q in qs)
    assert set(kinds) == {"multiply", "triangle", "divide", "double", "list_ix", "list_ind"}


def test_assembly_trace_figure_shows_the_program_memory_and_first_pass():
    m = fam("assembly_trace")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        g, words = drawn(m, p)
        for i, (lab, op, x) in enumerate(p["program"]):
            assert g[f"prog:{i}"][0] == f"{op} {x}".strip(), s
            assert g[f"addr:{i}"][0] == str(p["start"] + i), s
            if lab:
                assert g[f"label:{i}"][0] == f"{lab}:", s
        for a, v in p["memory"]:
            assert g[f"mem:{a}"][0] == str(v), s
        _, _, _, trace = interpret(p["program"], p["start"], p["memory"])
        rows = first_pass(trace)
        cols = p["columns"]
        assert cols[0] == "ACC"
        prev = {"ACC": None, "IX": None, **{c: dict(p["memory"]).get(int(c)) for c in cols if c.isdigit()}}
        for c in cols:  # the first row holds the memory's starting values
            if c.isdigit():
                assert g[f"trace:0:{c}"][0] == str(prev[c]), s
        for r, (a, acc, ix, mem) in enumerate(rows, start=1):
            assert g[f"trace:{r}:addr"][0] == str(a), s
            now = {"ACC": acc, "IX": ix, **{c: mem.get(int(c)) for c in cols if c.isdigit()}}
            for c in cols:
                if now[c] != prev[c]:  # a value is written where it changes; a blank cell means no change
                    assert g[f"trace:{r}:{c}"][0] == str(now[c]), (s, r, c)
                else:
                    assert f"trace:{r}:{c}" not in g, (s, r, c)
            prev = now
        assert f"trace:{len(rows) + 1}:addr" not in g, s


# --- register_transfer ----------------------------------------------------------------------------

RTN = ["MAR ← [PC]", "PC ← [PC] + 1", "MDR ← [[MAR]]", "CIR ← [MDR]"]
WORDED = ["The address in the PC is copied to the MAR", "The PC is incremented by 1",
          "The instruction at the address in the MAR is copied to the MDR", "The instruction in the MDR is copied to the CIR",
          "The control unit decodes the instruction in the CIR", "The instruction is executed"]


def test_register_transfer():
    m = fam("register_transfer")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        steps = RTN if p["band"] == "AL" else WORDED
        letters = {r: l for r, l in p["regs"].items() if l}
        assert len(letters) >= 3 and len(set(letters.values())) == len(letters)
        assert sorted(p["buses"]) == ["address", "control", "data"] and len(set(p["buses"].values())) == 3
        listing = {a: c for a, c in p["listing"]}
        for q in qs:
            got = re.search(r"Which letter is the (PC|MAR|MDR|CIR|ACC)\?", q.stem)
            if got:
                assert picked(q) == letters[got.group(1)], s
                assert set(q.options) <= set(letters.values()) and len(q.options) >= 3
            got = re.search(r"Which bus is the (address|data|control) bus\?", q.stem)
            if got:
                assert picked(q) == p["buses"][got.group(1)]
                assert sorted(q.options) == sorted(p["buses"].values())
            if "blank" in q.stem:
                assert q.kind == "mcq"
                assert picked(q) == steps[p["blank"]], (s, picked(q))
                assert all(o not in steps[p["blank"]:p["blank"] + 1] for o in wrong(q))
            got = re.search(r"after (\d+) complete fetch.execute cycles", q.stem)
            if got:
                pc = p["start"]
                for _ in range(int(got.group(1))):
                    word = listing[pc]  # every instruction fetched is on the figure
                    pc += 1
                    jump = re.fullmatch(r"JMP (\d+)", word)
                    if jump:
                        assert p["band"] == "AL"
                        pc = int(jump.group(1))
                assert int(q.answer) == pc, s
                if p["band"] == "AL":
                    assert "JMP" in q.stem  # the convention is stated
        assert sum(1 for q in qs if q.kind == "mcq") == 3 and len(qs) == 4
    assert set(bands) == {"AL", "UP"}


def test_register_transfer_figure_letters_and_steps():
    m = fam("register_transfer")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        g, words = drawn(m, p)
        for reg, letter in p["regs"].items():
            assert g[f"reg:{reg}"][0] == (letter or reg), s
        for bus, letter in p["buses"].items():
            assert g[f"bus:{bus}"][0] == letter, s
        steps = RTN if p["band"] == "AL" else WORDED
        for i, step in enumerate(steps):
            text = g[f"step:{i}"][0]
            if i == p["blank"]:
                assert not re.search(r"[A-Za-z]", text), (s, text)
            else:
                assert text == step, (s, text)
        assert str(p["start"]) in g["pcstart"][0]
        for a, c in p["listing"]:
            assert g[f"mem:{a}"][0] == c, s


# --- karnaugh_map ---------------------------------------------------------------------------------

def covers(cube, m, n):
    bits = format(m, f"0{n}b")
    return all(c == "-" or c == b for c, b in zip(cube, bits))


def minimal_covers(ones, n):
    """Every sum of products for the function with the fewest terms, then the fewest literals, from its prime
    implicants (a minimal sum of products is made of prime implicants)."""
    ones = set(ones)
    imps = [c for c in ("".join(t) for t in itertools.product("01-", repeat=n))
            if all(m in ones for m in range(2 ** n) if covers(c, m, n))]

    def inside(small, big):
        return small != big and all(b == "-" or b == a for a, b in zip(small, big))

    primes = [c for c in imps if not any(inside(c, d) for d in imps)]
    for k in range(1, len(primes) + 1):
        found = [combo for combo in itertools.combinations(primes, k)
                 if all(any(covers(c, m, n) for c in combo) for m in ones)]
        if found:
            fewest = min(sum(ch != "-" for c in combo for ch in c) for combo in found)
            return [set(combo) for combo in found if sum(ch != "-" for c in combo for ch in c) == fewest]
    return []


BAR = "\u0305"


def parse_sop(text, names):
    """'A.B̅ + C' as cubes over the variables."""
    assert text.startswith("X = ")
    cubes = []
    for term in text[4:].split(" + "):
        cube = ["-"] * len(names)
        for lit in term.split("."):
            neg = lit.endswith(BAR)
            v = lit.rstrip(BAR)
            assert v in names and cube[names.index(v)] == "-", text
            cube[names.index(v)] = "0" if neg else "1"
        cubes.append("".join(cube))
    return cubes


def ones_of(cubes, n):
    return {m for m in range(2 ** n) if any(covers(c, m, n) for c in cubes)}


GRAY = {1: ["0", "1"], 2: ["00", "01", "11", "10"]}


def test_karnaugh_map():
    m = fam("karnaugh_map")
    shows = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        names, ones = p["vars"], set(p["ones"])
        n = len(names)
        assert n in (3, 4) and 0 < len(ones) < 2 ** n
        shows[(n, p["shows"])] += 1
        if p["shows"] == "expression":
            assert ones_of(p["expr"], n) == ones, s  # the printed expression is this function
        best = minimal_covers(ones, n)
        assert len(best) == 1, (s, best)  # one simplest answer only
        for q in qs:
            got = re.search(r"cell marked ([A-Z])\?", q.stem)
            if got:
                r, c = next((r, c) for r, c, L in p["cells"] if L == got.group(1))
                rbits, cbits = GRAY[n - 2][r], GRAY[2][c]
                assert int(q.answer) == (int(rbits + cbits, 2) in ones), s
            if "how many of its cells hold 1" in q.stem:
                assert int(q.answer) == len(ones)
            if q.kind == "mcq":
                key = parse_sop(picked(q), names)
                assert set(key) == best[0], (s, picked(q))
                assert ones_of(key, n) == ones
                for o in wrong(q):
                    assert ones_of(parse_sop(o, names), n) != ones, (s, o)  # each wrong option is another function
        assert len(qs) == 3
    assert set(shows) == {(3, "table"), (3, "expression"), (4, "table"), (4, "expression")}


def test_karnaugh_map_figure_is_gray_coded_and_shows_each_cell():
    m = fam("karnaugh_map")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        g, words = drawn(m, p)
        names, ones = p["vars"], set(p["ones"])
        n = len(names)
        cols = sorted((v[1], v[0]) for k, v in g.items() if k.startswith("col:"))
        rows = sorted(((-v[2], v[0]) for k, v in g.items() if k.startswith("row:")))
        assert [t for _, t in cols] == GRAY[2], s  # Gray-code order, left to right
        assert [t for _, t in rows] == GRAY[n - 2], s  # and top to bottom
        letters = {L for _, _, L in p["cells"]}
        for k, (text, x, y) in g.items():
            if not k.startswith("cell:"):
                continue
            cbits = min(cols, key=lambda c: abs(c[0] - x))[1]
            rbits = min(rows, key=lambda r: abs(-r[0] - y))[1]
            value = int(rbits + cbits, 2) in ones
            if text in letters:
                continue
            assert text == str(int(value)), (s, k, text)
        drawn_letters = {v[0] for k, v in g.items() if k.startswith("cell:") and v[0] in letters}
        assert drawn_letters == letters, s
        if p["shows"] == "table":
            for i in range(2 ** n):
                assert g[f"tt:{i}"][0] == str(int(i in ones)), s
        else:
            assert "expr" in g


# --- sensor_control -------------------------------------------------------------------------------

COMPARE = {"<": lambda a, b: a < b, "≤": lambda a, b: a <= b, ">": lambda a, b: a > b, "≥": lambda a, b: a >= b}
# Each clause an option may state, and what it says about the low device (on below its set point) or the high one.
CLAUSES = {"the heater is on": ("low", True), "the heater is off": ("low", False),
           "the window is open": ("high", True), "the window is closed": ("high", False),
           "the lamps are on": ("low", True), "the lamps are off": ("low", False),
           "the blind is closed": ("high", True), "the blind is open": ("high", False)}


def states(p, reading):
    out = {}
    for side in ("low", "high"):
        rule = p[side]
        if rule:
            out[side] = COMPARE[rule["op"]](reading, rule["set"])
    return out


def statement_true(text, st):
    parts = re.fullmatch(r"(.+) and (.+)", text[0].lower() + text[1:])
    assert parts, text
    return all(st[CLAUSES[c][0]] == CLAUSES[c][1] for c in parts.groups())


def test_sensor_control():
    m = fam("sensor_control")
    forms = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        forms[(p["form"], p["sensor"])] += 1
        times, readings = p["times"], p["readings"]
        if p["form"] == "flowchart":
            assert p["low"] and p["high"] and p["low"]["set"] < p["high"]["set"]
        else:
            assert bool(p["low"]) != bool(p["high"])
        all_states = [states(p, r) for r in readings]
        for q in qs:
            got = re.search(r"Just after the reading at (\d\d:\d\d)", q.stem)
            if got:
                st = all_states[times.index(got.group(1))]
                if q.kind == "mcq":
                    assert statement_true(picked(q), st), (s, picked(q))
                    assert not any(statement_true(o, st) for o in wrong(q)), s
                else:
                    side = "low" if p["low"] else "high"
                    assert q.answer == ("on" if st[side] else "off"), s
            got = re.search(r"How many times (?:is|are) the ([a-z ]+) switched on", q.stem)
            if got:
                side = next(k for k in ("low", "high") if p[k] and p[k]["device"] == got.group(1))
                was, switches = False, 0
                for st in all_states:
                    switches += st[side] and not was
                    was = st[side]
                assert int(q.answer) == switches and switches >= 1, s
            got = re.search(r"reads exactly (\d+)", q.stem)
            if got:
                v = int(got.group(1))
                assert v in [p[k]["set"] for k in ("low", "high") if p[k]], s  # the set point itself
                st = states(p, v)
                if q.kind == "mcq":
                    assert statement_true(picked(q), st), s
                    assert not any(statement_true(o, st) for o in wrong(q)), s
                else:
                    side = "low" if p["low"] else "high"
                    assert q.answer == ("on" if st[side] else "off"), s
            got = re.search(r"After how many of the (\d+) readings is (the [a-z]+) ([a-z]+)\?", q.stem)
            if got:
                assert int(got.group(1)) == len(readings)
                side, want = CLAUSES[f"{got.group(2)} is {got.group(3)}"]
                assert int(q.answer) == sum(st[side] == want for st in all_states), s
            got = re.search(r"Which letter is the (sensor|ADC|microprocessor|actuator)\?", q.stem)
            if got:
                assert picked(q) == p["letters"][got.group(1)], s
                assert sorted(q.options) == sorted(p["letters"].values())
        assert len(qs) == 4
    assert {f for f, _ in forms} == {"flowchart", "block"}
    assert {s for _, s in forms} == {"temperature", "moisture", "light"}


def test_sensor_control_figure_shows_readings_rules_and_letters():
    m = fam("sensor_control")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        g, words = drawn(m, p)
        for i, (t, r) in enumerate(zip(p["times"], p["readings"])):
            assert g[f"time:{i}"][0] == t and g[f"reading:{i}"][0] == str(r), s
        text = " ".join(words)
        for side in ("low", "high"):
            if p[side]:
                assert f"{p[side]['op']} {p[side]['set']}" in text, s  # the set point and its test, as printed
        if p["form"] == "block":
            for part, letter in p["letters"].items():
                assert g[f"block:{part}"][0] == letter, s
        assert "off" in g["start-state"][0].lower()


# --- floating_point -------------------------------------------------------------------------------

def decode(mbits: str, ebits: str) -> Fraction:
    mant = Fraction(-int(mbits[0])) + sum(Fraction(int(b), 2 ** i) for i, b in enumerate(mbits[1:], start=1))
    exp = int(ebits, 2) - (2 ** len(ebits) if ebits[0] == "1" else 0)
    return mant * Fraction(2) ** exp


def test_floating_point():
    m = fam("floating_point")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        mb, eb = "".join(map(str, p["mantissa"])), "".join(map(str, p["exponent"]))
        seen[(len(mb), len(eb))] += 1
        value = decode(mb, eb)
        exp = int(eb, 2) - (2 ** len(eb) if eb[0] == "1" else 0)
        normalised = mb[0] != mb[1]
        seen["normalised" if normalised else "not"] += 1
        assert value != 0 and (value * 16).denominator == 1, (s, value)  # terminates within four places
        for q in qs:
            if "denary value" in q.stem:
                assert Fraction(q.answer) == value, (s, q.answer, value)
            if "exponent in denary" in q.stem:
                assert int(q.answer) == exp
            if "Which statement" in q.stem:
                def true(o):
                    return (("not normalised" not in o) == normalised) and (("positive" in o) == (value > 0))
                assert true(picked(q)), (s, picked(q))
                assert not any(true(o) for o in wrong(q)), s
            got = re.search(r"(largest positive number|smallest positive normalised number)", q.stem)
            if got:
                opts = [re.fullmatch(r"Mantissa ([01]+), exponent ([01]+)", o).groups() for o in q.options]
                assert all(len(a) == len(mb) and len(b) == len(eb) for a, b in opts)  # the figure's format
                vals = [decode(a, b) for a, b in opts]
                key = vals[int(q.answer)]
                if got.group(1).startswith("largest"):
                    top = (1 - Fraction(1, 2 ** (len(mb) - 1))) * Fraction(2) ** (2 ** (len(eb) - 1) - 1)
                    assert key == top and all(v < key for v in vals if v is not key)
                    assert sum(v == top for v in vals) == 1
                else:
                    low = Fraction(1, 2) * Fraction(2) ** -(2 ** (len(eb) - 1))
                    assert key == low
                    a, b = opts[int(q.answer)]
                    assert a[0] != a[1]
                    for (a, b), v in zip(opts, vals):  # every other option is not normalised, not positive, or larger
                        if (a, b) != opts[int(q.answer)]:
                            assert a[0] == a[1] or v <= 0 or v > low
        assert len(qs) == 4
    assert {k for k in seen if isinstance(k, tuple)} == {(8, 4), (10, 6), (12, 4)}
    assert seen["normalised"] > seen["not"] > 150


def test_floating_point_figure_shows_every_bit():
    m = fam("floating_point")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        g, words = drawn(m, p)
        for i, b in enumerate(p["mantissa"]):
            assert g[f"m:{i}"][0] == str(b), s
        for i, b in enumerate(p["exponent"]):
            assert g[f"e:{i}"][0] == str(b), s
        assert f"m:{len(p['mantissa'])}" not in g and f"e:{len(p['exponent'])}" not in g
        assert any("two's complement" in w for w in words)
