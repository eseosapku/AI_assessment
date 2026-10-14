"""Answers of the Computing wave (P3k), recomputed by executing what each figure shows, over 1,000 seeds."""
import itertools
import random
import re

import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


# An independent evaluator of the circuits and expressions: {"op": name, "in": [...]} trees with "A", "B", "C" leaves.
OPS = {"AND": lambda a, b: a & b, "OR": lambda a, b: a | b, "XOR": lambda a, b: a ^ b,
       "NAND": lambda a, b: 1 - (a & b), "NOR": lambda a, b: 1 - (a | b)}


def ev(node, env):
    if isinstance(node, str):
        return env[node]
    if node["op"] == "NOT":
        return 1 - ev(node["in"][0], env)
    a, b = (ev(x, env) for x in node["in"])
    return OPS[node["op"]](a, b)


def text(node, top=True):
    """The expression written out: NOT binds tightest; every two-input gate below the top is bracketed."""
    if isinstance(node, str):
        return node
    if node["op"] == "NOT":  # bracketed inside another gate: "(NOT (A AND B)) NOR C", never read as NOT of the rest
        inner = f"NOT {text(node['in'][0], False)}"
        return inner if top else f"({inner})"
    s = f"{text(node['in'][0], False)} {node['op']} {text(node['in'][1], False)}"
    return s if top else f"({s})"


def rows(p):
    names = p["inputs"]
    return [dict(zip(names, bits)) for bits in itertools.product((0, 1), repeat=len(names))]


# --- Task 1: logic --------------------------------------------------------------------------------

def test_logic_gates():
    m = fam("logic_gates")
    for s in SEEDS:
        p, qs = run(m, s)
        tree = p["circuit"]
        for q in qs:
            got = re.search(r"when (A = [01](?:, B = [01])?(?:, C = [01])?)", q.stem)
            if got:
                env = {k: int(v) for k, v in re.findall(r"([ABC]) = ([01])", got.group(1))}
                assert int(q.answer) == ev(tree, env)
            if "combinations" in q.stem:
                assert int(q.answer) == sum(ev(tree, r) for r in rows(p))
            if q.kind == "mcq" and "expression" in q.stem:
                assert picked(q) == f"X = {text(tree)}"
                assert sorted(q.options) == sorted(f"X = {text(t)}" for t in p["alts"])
                for alt in p["alts"]:  # each wrong expression gives a different output for some inputs
                    if text(alt) != text(tree):
                        assert any(ev(alt, r) != ev(tree, r) for r in rows(p)), (s, text(alt))


def test_truth_table():
    m = fam("truth_table")
    for s in SEEDS:
        p, qs = run(m, s)
        tree = p["expr"]
        table = rows(p)
        blanks = set(p["blanks"])
        # a blank can be worked out only from the expression, so blanks come only with it printed (P3k review)
        assert (p["shows"] == "expression") == bool(blanks) and len(blanks) < len(table)
        for q in qs:
            if q.kind == "mcq":
                assert p["shows"] == "table", s  # the expression is not printed beside the question that asks for it
            got = re.search(r"value of X in row (\d+)", q.stem)
            if got:
                k = int(got.group(1)) - 1
                assert k in blanks and int(q.answer) == ev(tree, table[k])
            if "rows give" in q.stem:
                assert int(q.answer) == sum(ev(tree, r) for r in table)
            if q.kind == "mcq" and "expression" in q.stem:
                assert picked(q) == f"X = {text(tree)}"
                shown = [i for i in range(len(table)) if i not in blanks]
                assert sorted(q.options) == sorted(f"X = {text(t)}" for t in p["alts"])
                for alt in p["alts"]:
                    if text(alt) != text(tree):  # a wrong option disagrees with a row the table shows
                        assert any(ev(alt, table[i]) != ev(tree, table[i]) for i in shown), (s, text(alt))
        assert any("rows give" in q.stem for q in qs), s  # the count is always asked, and checked


# --- Task 2: algorithms ---------------------------------------------------------------------------

def nums(text):
    return [int(x) for x in re.findall(r"-?\d+", text)]


def bubble_pass(xs):
    xs, swaps = list(xs), 0
    for i in range(len(xs) - 1):
        if xs[i] > xs[i + 1]:
            xs[i], xs[i + 1] = xs[i + 1], xs[i]
            swaps += 1
    return xs, swaps


def insertion_pass(xs, k):
    """Pass k (from 1) puts item k+1 (1-based) into the sorted part on its left."""
    xs = list(xs)
    v, j = xs[k], k - 1
    while j >= 0 and xs[j] > v:
        xs[j + 1] = xs[j]
        j -= 1
    xs[j + 1] = v
    return xs


def test_sort_trace():
    m = fam("sort_trace")
    for s in SEEDS:
        p, qs = run(m, s)
        xs = p["list"]
        assert len(set(xs)) == len(xs)
        if p["algorithm"] == "bubble":
            states, first_swaps = [xs], bubble_pass(xs)[1]
            while states[-1] != sorted(xs):
                states.append(bubble_pass(states[-1])[0])
        else:
            states = [xs]
            for k in range(1, len(xs)):
                states.append(insertion_pass(states[-1], k))
        for q in qs:
            # the list is the figure's: a stem that prints it needs no figure (P3k review)
            assert ", ".join(map(str, xs)) not in q.stem and " a insertion" not in q.stem, (s, q.stem)
            got = re.search(r"after pass (\d+)", q.stem)
            if got:
                k = int(got.group(1))
                assert nums(q.answer) == states[k]
                assert states[k] != states[k - 1], (s, k)  # the pass asked moves something, so copying the figure fails
            if "swaps" in q.stem:
                assert int(q.answer) == first_swaps
            if "first in order" in q.stem:
                assert int(q.answer) == next(k for k, st in enumerate(states) if st == sorted(xs))


def test_binary_search():
    m = fam("binary_search")
    for s in SEEDS:
        p, qs = run(m, s)
        xs, target = p["list"], p["target"]
        assert xs == sorted(xs) and len(set(xs)) == len(xs)
        low, high, checked = 0, len(xs) - 1, []
        while low <= high:
            mid = (low + high) // 2  # the stated rule: (low + high) DIV 2
            checked.append(mid)
            if xs[mid] == target:
                break
            if xs[mid] < target:
                low = mid + 1
            else:
                high = mid - 1
        for q in qs:
            if "checked first" in q.stem:
                assert int(q.answer) == checked[0]
            if "How many items" in q.stem:
                assert int(q.answer) == len(checked)
            if "in the order" in q.stem:
                assert nums(q.answer) == [xs[i] for i in checked]


def test_trace_table():
    m = fam("trace_table")
    for s in SEEDS:
        p, qs = run(m, s)
        rows, out = m.execute(p)  # the family's own run, checked against an independent one below
        t, v = p["template"], p["values"]
        if t == "sum":
            total, mine = 0, []
            for count in range(1, v["n"] + 1):
                total += count * v["k"]
                mine.append({"Count": count, "Total": total})
            assert out == total
        elif t == "while":
            x, y, mine = v["a"], 0, []
            while x > v["b"]:
                x -= v["c"]
                y += 1
                mine.append({"X": x, "Y": y})
            assert out == y
        else:
            best, mine = v["list"][0], []
            for i in range(2, len(v["list"]) + 1):
                if v["list"][i - 1] > best:
                    best = v["list"][i - 1]
                mine.append({"i": i, "Max": best})
            assert out == best
        assert [{k: r[k] for k in mine[0]} for r in rows] == mine
        for q in qs:
            got = re.search(r"value of (\w+) in row (\d+)", q.stem)
            if got:
                assert int(q.answer) == rows[int(got.group(2)) - 1][got.group(1)]
                assert (int(got.group(2)) - 1, got.group(1)) in {tuple(b) for b in p["blanks"]}  # asked only where blank
            if "What is output" in q.stem:
                assert int(q.answer) == out
            if "How many times" in q.stem:
                assert int(q.answer) == len(rows)


def test_flowchart():
    m = fam("flowchart")
    for s in SEEDS:
        p, qs = run(m, s)
        v = p["values"]
        n, count = p["input"], 0
        if p["template"] == "subtract":
            while n > v["limit"]:
                n, count = n - v["step"], count + 1
            out = count
        elif p["template"] == "double":
            while n <= v["limit"]:
                n, count = n * 2, count + 1
            out = n
        else:  # "add": not an even/odd test, whose output a student knows without the figure
            total = 0
            while n > 0:
                total, n, count = total + n, n - v["step"], count + 1
            out = total
        assert count >= 2, (s, p)
        for q in qs:
            if "What is output" in q.stem:
                assert q.answer == str(out)
            if "How many times" in q.stem:
                assert int(q.answer) == count
            if "value of n when" in q.stem:
                assert int(q.answer) == n



# --- Task 3: data representation ------------------------------------------------------------------

def test_binary_place():
    m = fam("binary_place")
    for s in SEEDS:
        p, qs = run(m, s)
        bits = p["bits"]
        assert len(bits) == 8 and set(bits) <= {0, 1}
        v = int("".join(map(str, bits)), 2)
        for q in qs:
            if "denary value of this byte" in q.stem:
                assert int(q.answer) == v
            if "hexadecimal" in q.stem:
                assert q.answer == format(v, "02X")
                assert format(v, "X") in q.accepted  # "E" for 0E: the leading zero is not needed (P3k review)
            got = re.search(r"left shift of (\d) place", q.stem)
            if got:
                k = int(got.group(1))
                assert v << k < 256, (s, v, k)  # nothing shifted out, so no overflow rule is needed
                assert int(q.answer) == v << k


def test_bitmap_image():
    m = fam("bitmap_image")
    for s in SEEDS:
        p, qs = run(m, s)
        grid, depth = p["grid"], p["depth"]
        h, w = len(grid), len(grid[0])
        assert all(0 <= c < 2 ** depth for row in grid for c in row)
        for q in qs:
            got = re.search(r"binary code for row (\d+)", q.stem)
            if got:
                row = grid[int(got.group(1)) - 1]
                assert q.answer.replace(" ", "") == "".join(format(c, f"0{depth}b") for c in row)
                code = q.answer.replace(" ", "")
                if len(code) > 4:  # written in fours, as bytes are, is a fair answer (P3k review)
                    assert " ".join(code[i:i + 4] for i in range(0, len(code), 4)) in q.accepted
            got = re.search(r"file size in (bits|bytes)", q.stem)
            if got:
                bits = w * h * depth
                assert int(q.answer) == (bits if got.group(1) == "bits" else bits // 8)
                assert got.group(1) == "bits" or bits % 8 == 0
            got = re.search(r"How many pixels are (\w+)", q.stem)
            if got:
                i = p["palette"].index(got.group(1))
                assert int(q.answer) == sum(row.count(i) for row in grid)


def test_sound_samples():
    m = fam("sound_samples")
    for s in SEEDS:
        p, qs = run(m, s)
        vals, step = p["samples"], p["interval_ms"]
        for q in qs:
            got = re.search(r"sample value at ([\d.]+) ms", q.stem)
            if got:
                k = round(float(got.group(1)) / step)
                assert abs(k * step - float(got.group(1))) < 1e-9
                assert int(q.answer) == vals[k]
            if "sample rate" in q.stem:
                assert int(q.answer) == round(1000 / step)
            got = re.search(r"sample resolution of (\d+) bits.* (\d+) seconds", q.stem)
            if got:
                b, secs = int(got.group(1)), int(got.group(2))
                assert int(q.answer) == round(1000 / step) * secs * b // 8



# --- Task 4: spreadsheets, databases and networks -------------------------------------------------

def cell(table, ref):
    return table[int(ref[1:]) - 1][ord(ref[0]) - ord("A")]


def span(table, a, b):
    """The values in a range within one column or one row."""
    if a[0] == b[0]:
        return [cell(table, f"{a[0]}{r}") for r in range(int(a[1:]), int(b[1:]) + 1)]
    return [cell(table, f"{chr(c)}{a[1:]}") for c in range(ord(a[0]), ord(b[0]) + 1)]


def formula(table, text):
    m = re.fullmatch(r"=(SUM|AVERAGE|MAX|MIN)\(([A-Z]\d+):([A-Z]\d+)\)", text)
    if m:
        xs = span(table, m.group(2), m.group(3))
        return {"SUM": sum, "MAX": max, "MIN": min, "AVERAGE": lambda v: sum(v) / len(v)}[m.group(1)](xs)
    m = re.fullmatch(r'=COUNTIF\(([A-Z]\d+):([A-Z]\d+),"([<>]=?)(\d+)"\)', text)
    if m:
        ops = {">": lambda x, n: x > n, "<": lambda x, n: x < n, ">=": lambda x, n: x >= n, "<=": lambda x, n: x <= n}
        return sum(ops[m.group(3)](x, int(m.group(4))) for x in span(table, m.group(1), m.group(2)))
    m = re.fullmatch(r'=IF\(([A-Z]\d+)([<>]=?)(\d+),"(\w+)","(\w+)"\)', text)
    assert m, text
    x, n = cell(table, m.group(1)), int(m.group(3))
    yes = {">": x > n, "<": x < n, ">=": x >= n, "<=": x <= n}[m.group(2)]
    return m.group(4) if yes else m.group(5)


def as_key(v):
    return str(int(v)) if isinstance(v, (int, float)) and v == int(v) else str(v)


def test_spreadsheet_formula():
    m = fam("spreadsheet_formula")
    for s in SEEDS:
        p, qs = run(m, s)
        table = p["table"]
        for q in qs:
            if "What does cell" in q.stem:
                assert q.answer == as_key(formula(table, p["formula"])), (s, p["formula"], q.answer)
            got = re.search(r"in [A-D]\d+ to (=\S+?\))", q.stem)
            if got:
                assert q.answer == as_key(formula(table, got.group(1))), (s, got.group(1), q.answer)
            got = re.search(r"Which cell holds (\S+?)\?", q.stem)
            if got:
                assert f"cell {q.answer}" in q.accepted  # "cell B2" is a fair answer (P3k review)
                v = got.group(1)
                assert as_key(cell(table, q.answer)) == v
                assert sum(as_key(x) == v for row in table for x in row) == 1  # the value is in one cell only


def run_query(p):
    q = p["query"]
    field, op, value = q["where"]
    ops = {">": lambda a, b: a > b, "<": lambda a, b: a < b, "=": lambda a, b: a == b}
    rows = [r for r in p["records"] if ops[op](r[field], value)]
    key, way = q["order"]
    return sorted(rows, key=lambda r: r[key], reverse=(way == "DESC"))


def test_database_query():
    m = fam("database_query")
    for s in SEEDS:
        p, qs = run(m, s)
        rows = run_query(p)
        assert rows, s
        key = p["query"]["order"][0]
        assert len({r[key] for r in rows}) == len(rows)  # no ties, so the order is fixed
        first = p["query"]["select"][0]
        for q in qs:
            if "How many records" in q.stem:
                assert int(q.answer) == len(rows)
            if "first record" in q.stem:
                assert q.answer == str(rows[0][first])
            if "last record" in q.stem:
                assert q.answer == str(rows[-1][first])


def test_network_topology():
    m = fam("network_topology")
    for s in SEEDS:
        p, qs = run(m, s)
        letter = {t: "ABCD"[i] for i, t in enumerate(p["order"])}
        assert sorted(p["order"]) == ["bus", "mesh", "ring", "star"]
        for q in qs:
            got = re.search(r"Which network is a (\w+) topology", q.stem)
            if got:
                assert picked(q) == letter[got.group(1)]
            if "How many cables" in q.stem:
                n = p["sizes"]["mesh"]
                assert int(q.answer) == n * (n - 1) // 2
            if "stops every" in q.stem:
                assert q.answer == p["hub"]



# --- Task 5: data structures and encryption -------------------------------------------------------

def bst(values):
    """Insertion into a binary search tree: {value: [left, right]}, and each value's parent."""
    kids, parent = {values[0]: [None, None]}, {}
    for v in values[1:]:
        node = values[0]
        while True:
            side = 0 if v < node else 1
            if kids[node][side] is None:
                kids[node][side], kids[v], parent[v] = v, [None, None], node
                break
            node = kids[node][side]
    return kids, parent


def order(kids, node, how):
    if node is None:
        return []
    left, right = (order(kids, k, how) for k in kids[node])
    return {"in": left + [node] + right, "pre": [node] + left + right, "post": left + right + [node]}[how]


def levels(kids, node):
    return 0 if node is None else 1 + max(levels(kids, k) for k in kids[node])


def test_binary_tree():
    m = fam("binary_tree")
    for s in SEEDS:
        p, qs = run(m, s)
        vals = p["values"]
        kids, _ = bst(vals)
        for q in qs:
            got = re.search(r"(in|pre|post)-order traversal", q.stem)
            if got:
                assert nums(q.answer) == order(kids, vals[0], got.group(1))
            if "How many levels" in q.stem:
                assert int(q.answer) == levels(kids, vals[0])
            got = re.search(r"(\d+) is added", q.stem)
            if got:
                new = int(got.group(1))
                assert new not in vals
                _, parent = bst(vals + [new])
                assert int(q.answer) == parent[new]


def test_stack_queue():
    m = fam("stack_queue")
    for s in SEEDS:
        p, qs = run(m, s)
        items = list(p["start"])  # bottom to top, or front to rear
        removed, peak = [], len(items)
        for op in p["ops"]:
            word, *arg = op.split()
            if word in ("PUSH", "ENQUEUE"):
                items.append(arg[0])
                removed.append(None)
            else:
                assert items, (s, p)
                removed.append(items.pop() if word == "POP" else items.pop(0))
            peak = max(peak, len(items))
        # never past the drawn cells: a fixed array would call it full (P3k review). A drawn queue's rear only moves on.
        if p["kind"] == "stack":
            assert peak <= 5, (s, p)
        else:
            assert len(p["start"]) + sum(op.startswith("ENQUEUE") for op in p["ops"]) <= 6, (s, p)
        for q in qs:
            if "after all" in q.stem:
                assert q.answer == (items[-1] if p["kind"] == "stack" else items[0])
            got = re.search(r"operation (\d+) remove", q.stem)
            if got:
                assert q.answer == removed[int(got.group(1)) - 1] is not None
            if "How many items" in q.stem:
                assert int(q.answer) == len(items)


def caesar(word, shift):
    return "".join(chr((ord(c) - 65 + shift) % 26 + 65) for c in word)


def test_caesar_cipher():
    m = fam("caesar_cipher")
    for s in SEEDS:
        p, qs = run(m, s)
        k = p["shift"]
        assert 1 <= k <= 25
        for q in qs:
            got = re.search(r"Encrypt the word ([A-Z]+)", q.stem)
            if got:
                assert q.answer == caesar(got.group(1), k)
            got = re.search(r"Decrypt the word ([A-Z]+)", q.stem)
            if got:
                assert caesar(q.answer, k) == got.group(1)
                assert q.answer in p["words"]  # a real word comes back


COMPUTING = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "computing")


def _central(options):
    from collections import Counter
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", COMPUTING)
def test_a_computing_mcq_cannot_be_picked_from_its_options_alone(fid):
    from collections import defaultdict
    m = FAMILIES[fid]
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


def test_a_truth_table_with_blanks_prints_its_expression():
    """A "?" cell cannot be worked out from the inputs alone (P3k review)."""
    import matplotlib.pyplot as plt
    m = fam("truth_table")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = [t.get_text() for t in fig.axes[0].texts]
        plt.close(fig)
        assert (f"X = {text(p['expr'])}" in texts) == bool(p["blanks"]), s



def test_a_trace_table_marks_its_blanks():
    """An empty cell in a Cambridge trace table means "unchanged"; a blank to fill in shows "?" (P3k review)."""
    import matplotlib.pyplot as plt
    m = fam("trace_table")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        texts = [t.get_text() for t in fig.axes[0].texts]
        plt.close(fig)
        assert texts.count("?") == len(p["blanks"]), s


def _cross(a, b, c, d):
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return side(a, b, c) * side(a, b, d) < 0 and side(c, d, a) * side(c, d, b) < 0


def test_a_mesh_of_four_is_drawn_without_crossing_cables():
    """Two crossing diagonals with no device read as a four-way junction, 8 cables for 6 (P3k review)."""
    m = fam("network_topology")
    pts = m.mesh_points(4, 0.0, 0.0)
    pairs = [(pts[i], pts[j]) for i in range(4) for j in range(i + 1, 4)]
    for i, (a, b) in enumerate(pairs):
        for c, d in pairs[i + 1:]:
            if len({a, b, c, d}) == 4:
                assert not _cross(a, b, c, d), (a, b, c, d)
