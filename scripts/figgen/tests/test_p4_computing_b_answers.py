"""Answers of the P4 computing-b families (programming, operating-system internals, safety), recomputed independently
from each figure's params over 1,000 seeds:

- code_output: every program re-evaluated from its spec by this file's own code, AND the listing as printed turned into
  Python by this file's own translator (C++, Java and Visual Basic semantics: integer division, Mod, arrays in
  brackets or parentheses, ArrayList by index) and run, so the printed program itself gives the key;
- class_diagram: parents, private attributes and callable methods counted from the classes drawn;
- cpu_scheduling: FCFS, SJF and Round Robin simulated here;
- memory_allocation: first, best and worst fit placed here; paging addresses worked here;
- gis_layers: points tested inside polygons by ray casting; road lengths summed on the grid;
- phishing_check: warning signs judged by this file's own table;
- caesar_cipher (Primary): shifted here;
- branching_db_p: the tree walked here.

Nothing here calls a family's own helpers to work out a key.
"""
import contextlib
import io
import random
import re
from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 31)
WAVE = ("code_output", "class_diagram", "cpu_scheduling", "memory_allocation", "gis_layers", "phishing_check",
        "branching_db_p")


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


def texts(m, p) -> list[str]:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def crosses(line, box, margin=1.0, steps=80) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def num(s):
    return float(s.replace(" ", "").replace(",", ""))


# --- code_output: the spec evaluated here ---------------------------------------------------------------------------

def evaluate(p):
    t, v = p["template"], p["values"]
    if t == "sequence":
        g, s = divmod(v["a"], v["b"])
        return {"output": g * v["k"] + s if v["form"] == "mul" else (g + s) * v["k"], "groups": g, "spare": s}
    if t == "loop_if":
        total = hits = 0
        i = v["start"]
        while i <= v["end"]:
            ok = i % v["m"] == 0 if v["cond"] == "mod" else i > v["t"]
            total, hits = (total + i * v["k"], hits + 1) if ok else (total + v["c"], hits)
            i += v["step"]
        return {"output": total, "hits": hits}
    if t == "while":
        n, k = v["n"], 0
        while (n > v["limit"]) if v["cond"] == ">" else (n >= v["limit"]):
            n = n - v["d"] if v["op"] == "sub" else n // 2
            k += 1
        return {"output": k, "final": n}
    if t == "array":
        xs = v["nums"]
        if v["kind"] == "above":
            big = [x for x in xs if x > v["t"]]
            return {"output": sum(big), "hits": len(big)}
        best, moves = 0, 0
        for i, x in enumerate(xs):
            if x > xs[best]:
                best, moves = i, moves + 1
        return {"output": best, "hits": moves}
    if t == "function":
        if v["kind"] == "if":
            f = lambda x: x - v["d"] if x > v["t"] else x * v["k"]  # noqa: E731
            return {"output": f(v["p"]) + f(v["q"]), "a": f(v["p"])}
        r = v["k"] * v["n"] * (v["n"] + 1) // 2
        return {"output": r - v["m"], "returned": r}
    if t == "struct":
        f1, f2 = v["f1"], v["f2"]
        f1, f2 = (f1, f2 + v["r"]) if v["change"] == "f2" else (f1 - v["r"], f2)
        prod = v["s"] != 3  # the fourth struct (a test's two marks) adds; the others multiply
        return {"output": f1 * f2 if prod else f1 + f2, "f1": f1, "f2": f2}
    if t == "class":
        if v["kind"] == "box":
            h = v["w"] + v["h"] if v["sign"] == "+" else v["w"] - v["h"]
            return {"output": v["w"] * h + v["e"], "field": h}
        return {"output": (v["x"] + v["y"]) * v["k"], "field": v["x"] + v["y"]}
    xs = [v["k"] * i for i in range(1, v["n"] + 1)]
    del xs[v["r"]]
    if v["op"] == "add":
        xs[v["j"]:v["j"]] = [v["val"]]
    else:
        xs[v["j"]] = v["val"]
    return {"output": xs[v["g"]], "size": len(xs)}


# --- code_output: the printed listing translated to Python and run ----------------------------------------------------

class JList:
    """java.util.ArrayList<Integer> as these programs use it: add(x), add(index, x), remove(index), set, get, size,
    each index checked as Java checks it."""

    def __init__(self):
        self.a = []

    def _check(self, i, top):
        if not 0 <= i < top:
            raise IndexError(i)

    def add(self, *args):
        if len(args) == 1:
            self.a.append(args[0])
        else:
            self._check(args[0], len(self.a) + 1)
            self.a.insert(args[0], args[1])
        return True

    def remove(self, i):
        self._check(i, len(self.a))
        return self.a.pop(i)

    def set(self, i, x):
        self._check(i, len(self.a))
        self.a[i], old = x, self.a[i]
        return old

    def get(self, i):
        self._check(i, len(self.a))
        return self.a[i]

    def size(self):
        return len(self.a)


def _c_expr(e, fields=(), arrays=()):
    for a in arrays:
        e = re.sub(rf"\b{a}\.length\b", f"len({a})", e)
    e = e.replace("/", "//")
    for f in fields:
        e = re.sub(rf"(?<![.\w]){f}\b", f"self.{f}", e)
    return e


def translate_c(rows):
    """C++ or Java, as these programs write them, in Python."""
    out, stack, fields, arrays = [], [], [], []
    depth = lambda: sum(1 for k in stack if k != "skip")  # noqa: E731

    def emit(s):
        out.append("    " * depth() + s)

    in_method = lambda: "method" in stack  # noqa: E731
    for raw in rows:
        s = raw.strip()
        flds = fields if in_method() else ()
        if s.startswith(("#include", "using namespace", "import java")):
            continue
        if s in ("int main() {", "public class Main {") or s.startswith("public static void main("):
            stack.append("skip")
            continue
        if s == "return 0;":
            continue
        if s in ("}", "};"):
            stack.pop()
            continue
        if s == "} else {":
            stack.pop()
            emit("else:")
            stack.append("block")
            continue
        m = re.fullmatch(r"(struct|class) (\w+) \{", s)
        if m:
            emit(f"class {m.group(2)}:")
            stack.append("class")
            fields = []
            continue
        m = re.fullmatch(r"int (\w+)(?:, (\w+))?(?: = (\d+))?;", s)
        if m and stack and stack[-1] == "class":
            for f in filter(None, m.group(1, 2)):
                fields.append(f)
                emit(f"{f} = {m.group(3) or 0}")
            continue
        m = re.fullmatch(r"(?:static )?(int|void) (\w+)\(((?:int \w+)?)\) \{", s)
        if m:
            par = m.group(3).replace("int ", "")
            if stack and stack[-1] == "class":
                emit(f"def {m.group(2)}(self{', ' + par if par else ''}):")
                stack.append("method")
            else:
                emit(f"def {m.group(2)}({par}):")
                stack.append("def")
            continue
        m = re.fullmatch(r"for \(int (\w+) = (\d+); \1 (<=|<) ([\w.]+); \1(\+\+| \+= (\d+))\) \{", s)
        if m:
            end = _c_expr(m.group(4), (), arrays)
            end = f"{end} + 1" if m.group(3) == "<=" else end
            emit(f"for {m.group(1)} in range({m.group(2)}, {end}, {m.group(6) or 1}):")
            stack.append("block")
            continue
        m = re.fullmatch(r"(while|if) \((.+)\) \{", s)
        if m:
            emit(f"{m.group(1)} {_c_expr(m.group(2), flds)}:")
            stack.append("block")
            continue
        assert s.endswith(";"), s
        s = s[:-1]
        m = re.fullmatch(r"int (\w+)\[\d+\] = \{(.+)\}|int\[\] (\w+) = \{(.+)\}", s)
        if m:
            arrays.append(m.group(1) or m.group(3))
            emit(f"{m.group(1) or m.group(3)} = [{m.group(2) or m.group(4)}]")
            continue
        m = re.fullmatch(r"ArrayList<Integer> (\w+) = new ArrayList<Integer>\(\)", s)
        if m:
            emit(f"{m.group(1)} = JList()")
            continue
        m = re.fullmatch(r"(\w+) (\w+)(?: = new \1\(\))?", s)
        if m and m.group(1)[0].isupper():
            emit(f"{m.group(2)} = {m.group(1)}()")
            continue
        m = re.fullmatch(r"cout << (.+) << endl|System\.out\.println\((.+)\)", s)
        if m:
            emit(f"print({_c_expr(m.group(1) or m.group(2), flds)})")
            continue
        m = re.fullmatch(r"return (.+)", s)
        if m:
            emit(f"return {_c_expr(m.group(1), flds)}")
            continue
        s = re.sub(r"^int ", "", s)
        emit(_c_expr(s, flds))
    assert not stack, stack
    return "\n".join(out)


def _vb_expr(e, arrays=(), fields=(), cond=False):
    e = e.replace("\\", "//")
    e = re.sub(r"\bMod\b", "%", e)
    for a in arrays:
        e = re.sub(rf"\b{a}\((\w+)\)", rf"{a}[\1]", e)
    for f in fields:
        e = re.sub(rf"(?<![.\w]){f}\b", f"self.{f}", e)
    if cond:
        e = re.sub(r"(?<![<>=])=(?!=)", "==", e)
    return e


def translate_vb(rows):
    out, stack, arrays, fields = [], [], [], []
    depth = lambda: sum(1 for k in stack if k != "skip")  # noqa: E731

    def emit(s):
        out.append("    " * depth() + s)

    for raw in rows:
        s = raw.strip()
        flds = fields if "method" in stack else ()
        if s in ("Module Program", "Sub Main()"):
            stack.append("skip")
            continue
        if s in ("End Module", "End Sub", "End Function", "End Class", "End If", "Next", "Loop"):
            stack.pop()
            continue
        if s == "Else":
            stack.pop()
            emit("else:")
            stack.append("block")
            continue
        m = re.fullmatch(r"Class (\w+)", s)
        if m:
            emit(f"class {m.group(1)}:")
            stack.append("class")
            fields = []
            continue
        m = re.fullmatch(r"Public ([\w, ]+) As Integer(?: = (\d+))?", s)
        if m:
            for f in m.group(1).split(", "):
                fields.append(f)
                emit(f"{f} = {m.group(2) or 0}")
            continue
        m = re.fullmatch(r"(Function|Sub) (\w+)\((?:ByVal (\w+) As Integer)?\)(?: As Integer)?", s)
        if m:
            par = m.group(3) or ""
            if stack and stack[-1] == "class":
                emit(f"def {m.group(2)}(self{', ' + par if par else ''}):")
                stack.append("method")
            else:
                emit(f"def {m.group(2)}({par}):")
                stack.append("def")
            continue
        m = re.fullmatch(r"For (\w+) As Integer = (\d+) To (\w+)(?: Step (\d+))?", s)
        if m:
            emit(f"for {m.group(1)} in range({m.group(2)}, {m.group(3)} + 1, {m.group(4) or 1}):")
            stack.append("block")
            continue
        m = re.fullmatch(r"Do While (.+)", s)
        if m:
            emit(f"while {_vb_expr(m.group(1), arrays, flds, True)}:")
            stack.append("block")
            continue
        m = re.fullmatch(r"If (.+) Then", s)
        if m:
            emit(f"if {_vb_expr(m.group(1), arrays, flds, True)}:")
            stack.append("block")
            continue
        assert not s.endswith(";"), s
        m = re.fullmatch(r"Dim (\w+)\(\) As Integer = \{(.+)\}", s)
        if m:
            arrays.append(m.group(1))
            emit(f"{m.group(1)} = [{m.group(2)}]")
            continue
        m = re.fullmatch(r"Dim (\w+) As New (\w+)\(\)", s)
        if m:
            emit(f"{m.group(1)} = {m.group(2)}()")
            continue
        m = re.fullmatch(r"Dim (\w+) As Integer = (.+)", s)
        if m:
            emit(f"{m.group(1)} = {_vb_expr(m.group(2), arrays, flds)}")
            continue
        m = re.fullmatch(r"Console\.WriteLine\((.+)\)", s)
        if m:
            emit(f"print({_vb_expr(m.group(1), arrays, flds)})")
            continue
        m = re.fullmatch(r"Return (.+)", s)
        if m:
            emit(f"return {_vb_expr(m.group(1), arrays, flds)}")
            continue
        m = re.fullmatch(r"(\S+) = (.+)", s)
        if m:
            emit(f"{_vb_expr(m.group(1), arrays, flds)} = {_vb_expr(m.group(2), arrays, flds)}")
            continue
        emit(_vb_expr(s, arrays, flds))
    assert not stack, stack
    return "\n".join(out)


def run_listing(rows, lang):
    """Runs the printed program (translated where it is not Python); its output and its top-level names."""
    src = "\n".join(rows) if lang == "python" else (translate_vb(rows) if lang == "vb" else translate_c(rows))
    env = {"JList": JList}
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(compile(src, "<listing>", "exec"), env)  # noqa: S102 - the family's own printed program, translated
    return buf.getvalue().strip(), env


def listing_shape_ok(rows, lang):
    """The program written as its language writes it."""
    if lang in ("cpp", "java"):
        level = 0
        for r in rows:
            s = r.strip()
            assert s.endswith((";", "{", "}")) or s == "#include <iostream>", (lang, s)
            level += s.count("{") - s.count("}")
            assert level >= 0
        assert level == 0
        if lang == "cpp":
            assert rows[0] == "#include <iostream>" and "using namespace std;" in rows and "int main() {" in rows
            assert any("cout << " in r for r in rows)
        else:
            assert any("public static void main(String[] args) {" in r for r in rows)
            assert any("System.out.println(" in r for r in rows)
    elif lang == "vb":
        body = [r.strip() for r in rows]
        assert not any(s.endswith((";", "{")) or (s.endswith("}") and "= {" not in s) for s in body)
        pairs = [("If ", "End If"), ("For ", "Next"), ("Do While", "Loop"), ("Function ", "End Function"),
                 ("Class ", "End Class"), ("Module ", "End Module")]
        for a, b in pairs:
            assert sum(s.startswith(a) for s in body) == sum(s == b for s in body), (a, rows)
        assert any(s.startswith("Console.WriteLine(") for s in body)
    else:
        assert not any(r.rstrip().endswith((";", "{", "}")) for r in rows)
        assert any("print(" in r for r in rows)


def test_code_output():
    m = fam("code_output")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        rows, _ = m.program(p)
        lang = p["lang"]
        seen[(lang, p["template"])] += 1
        assert 6 <= len(rows) <= 14, (s, len(rows))
        assert p["band"] in ("UP", "AL") and (p["band"] == "UP" or lang in ("python", "java", "vb"))
        assert p["template"] not in ("struct",) or lang == "cpp"
        assert p["template"] != "arraylist" or lang == "java"
        listing_shape_ok(rows, lang)
        want = evaluate(p)
        printed, env = run_listing(rows, lang)
        assert printed == str(want["output"]), (s, lang, p["template"], printed, want)
        assert m.execute(p)["output"] == want["output"]
        q1 = qs[0]
        assert "What does it output" in q1.stem and int(q1.answer) == want["output"]
        q2 = qs[1]
        v = p["values"]
        if "How many times does line" in q2.stem:
            assert int(q2.answer) == want["hits"]
        elif "final value of" in q2.stem:
            var = re.search(r"final value of (\w+)", q2.stem).group(1)
            assert int(q2.answer) == want["final"] == env[var]
        elif "store in" in q2.stem:
            var = re.search(r"store in (\w+)\?", q2.stem).group(1)
            assert int(q2.answer) == env[var]
            assert int(q2.answer) == want.get(var, want.get("groups" if var in ("boxes", "teams", "trays", "days", "rows")
                                                            else "spare"))
        elif "return" in q2.stem:
            call = re.search(r"call (\w+\(\d+\))", q2.stem).group(1)
            assert int(q2.answer) == want["returned"] == eval(call, env)  # noqa: S307
        elif "value of" in q2.stem:
            obj, field = re.search(r"value of (\w+)\.(\w+)", q2.stem).groups()
            got = getattr(env[obj], field)
            assert int(q2.answer) == got
            if p["template"] == "class":
                assert got == want["field"]
        else:
            assert "How many items" in q2.stem
            name = re.search(r"items does (\w+) hold", q2.stem).group(1)
            assert int(q2.answer) == want["size"] == env[name].size()
    for lang, ts in {"cpp": ["sequence", "loop_if", "while", "array", "function", "struct"],
                     "java": ["sequence", "loop_if", "while", "array", "function", "class", "arraylist"],
                     "vb": ["sequence", "loop_if", "while", "array", "function", "class"],
                     "python": ["sequence", "loop_if", "while", "array", "function", "class"]}.items():
        for t in ts:
            assert seen[(lang, t)] >= 8, (lang, t, seen[(lang, t)])


def test_code_output_draws_every_line_with_its_number():
    m = fam("code_output")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        rows, _ = m.program(p)
        shown = texts(m, p)
        for i, r in enumerate(rows):
            assert str(i + 1) in shown
            if r.strip():
                assert r in shown, (s, r)
        if p["template"] in ("array", "arraylist"):
            assert any("start at 0" in t for t in shown)


def test_code_output_lines_stay_inside_their_panel():
    from matplotlib.patches import Rectangle
    m = fam("code_output")
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        fig.canvas.draw()
        r = fig.canvas.get_renderer()
        panel = max((pa for pa in fig.axes[0].patches if isinstance(pa, Rectangle)), key=lambda pa: pa.get_width())
        edge = panel.get_window_extent(r)
        for t, box in boxes:
            if (t.get_gid() or "").startswith("line:"):
                assert box.x1 < edge.x1 - 2, (s, t.get_text())
        plt.close(fig)


# --- class_diagram ---------------------------------------------------------------------------------------------------

MULT_WORDS = {"1": "exactly one", "0..1": "zero or one", "0..*": "zero or more", "1..*": "one or more"}


def test_class_diagram():
    m = fam("class_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        classes = {c["name"]: c for c in p["classes"]}
        parent = {n: c["parent"] for n, c in classes.items()}
        roots = [n for n, par in parent.items() if par is None]
        assert len(roots) == 2  # the hierarchy's top and the associated class
        assert (p["band"] == "AL") == any(parent.get(par) for par in parent.values() if par)  # a third level at AL only
        methods = [x for c in classes.values() for x in c["methods"]]
        assert len(methods) == len(set(methods))  # nothing overridden

        def line_of(n):
            out = []
            while parent[n]:
                n = parent[n]
                out.append(n)
            return out

        for q in qs:
            got = re.search(r"Which class does (\w+) inherit from directly\?", q.stem)
            if got:
                assert picked(q) == parent[got.group(1)]
                assert all(o in classes and o != parent[got.group(1)] for o in q.options if o != picked(q))
                if len(line_of(got.group(1))) > 1:
                    assert line_of(got.group(1))[1] in q.options  # the grandparent tempts
            got = re.search(r"private attributes are listed in the (\w+) class", q.stem)
            if got:
                assert int(q.answer) == sum(a[0] == "-" for a in classes[got.group(1)]["attrs"])
            got = re.search(r"object of class (\w+) is created\. How many methods", q.stem)
            if got:
                n = got.group(1)
                assert int(q.answer) == len(classes[n]["methods"]) + sum(len(classes[a]["methods"]) for a in line_of(n))
            got = re.search(r"can an object of class (\w+) NOT call", q.stem)
            if got:
                n = got.group(1)
                mine = set(classes[n]["methods"]).union(*(classes[a]["methods"] for a in line_of(n)))
                assert picked(q) not in mine and picked(q) in methods
                assert all(o in mine for o in q.options if o != picked(q))
            got = re.search(r"how many (\w+) objects can one (\w+) object be linked to", q.stem)
            if got:
                many, one = got.groups()
                a = p["assoc"]
                assert {many, one} == {a["other"], a["parent"]}
                mult = a["mult_parent"] if many == a["parent"] else a["mult_other"]
                assert picked(q) == MULT_WORDS[mult]
                assert sorted(q.options) == sorted(MULT_WORDS.values())


def test_class_diagram_draws_every_class_line_and_link():
    m = fam("class_diagram")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        shown = [t.get_text() for t in ax.texts]
        gids = {t.get_gid(): t.get_text() for t in ax.texts}
        for c in p["classes"]:
            assert c["name"] in shown
            for v, n, ty in c["attrs"]:
                assert f"{v} {n} : {ty}" in shown
            for x in c["methods"]:
                assert f"+ {x}" in shown
        assert gids["mult:other"] == p["assoc"]["mult_other"] and gids["mult:parent"] == p["assoc"]["mult_parent"]
        parents = {c["parent"] for c in p["classes"] if c["parent"]}
        assert {ln.get_gid()[8:] for ln in ax.lines if (ln.get_gid() or "").startswith("inherit:")} == parents
        # the multiplicity beside each class is the one nearer that class's box
        texts_by = {t.get_gid(): t for t in ax.texts}
        line = next(ln for ln in ax.lines if ln.get_gid() == "assoc")
        (x0, x1) = sorted(line.get_xdata())
        assert abs(texts_by["mult:other"].get_position()[0] - x0) < abs(texts_by["mult:other"].get_position()[0] - x1)
        assert abs(texts_by["mult:parent"].get_position()[0] - x1) < abs(texts_by["mult:parent"].get_position()[0] - x0)
        boxes = drawn_texts(fig)
        for ln in ax.lines:
            if (ln.get_gid() or "").startswith(("inherit:", "assoc")):
                for t, box in boxes:
                    assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


# --- cpu_scheduling --------------------------------------------------------------------------------------------------

def simulate(algo, procs, quantum):
    """The Gantt chart, worked out here: [name, start, end] blocks."""
    procs = sorted(procs, key=lambda x: x[1])
    t, out = 0, []
    if algo == "FCFS":
        for name, arr, burst in procs:
            assert arr <= t or not out  # never idle
            out.append([name, t, t + burst])
            t += burst
        return out
    if algo == "SJF":
        todo = list(procs)
        while todo:
            ready = [x for x in todo if x[1] <= t]
            assert ready
            pick = min(ready, key=lambda x: x[2])
            assert sum(x[2] == pick[2] for x in ready) == 1  # no tie to break
            out.append([pick[0], t, t + pick[2]])
            t += pick[2]
            todo.remove(pick)
        return out
    left = {n: b for n, _, b in procs}
    waiting = [procs[0][0]]
    later = list(procs[1:])
    while waiting:
        n = waiting.pop(0)
        r = min(quantum, left[n])
        out.append([n, t, t + r])
        t += r
        left[n] -= r
        for x in [x for x in later if x[1] < t]:  # arrived during the slice
            waiting.append(x[0])
            later.remove(x)
        assert not any(x[1] == t for x in later)  # nobody arrives exactly as a slice ends
        if left[n]:
            waiting.append(n)
        assert waiting or not later  # never idle
    return out


def test_cpu_scheduling():
    m = fam("cpu_scheduling")
    algos = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        algos[p["algo"]] += 1
        blocks = simulate(p["algo"], p["procs"], p["quantum"])
        assert blocks == m.schedule(p)
        assert all(b - a >= 2 for _, a, b in blocks)
        assert len({x[1] for x in p["procs"]}) == len(p["procs"])
        done = {n: max(b for x, _, b in blocks if x == n) for n, _, _ in p["procs"]}
        info = {n: (a, b) for n, a, b in p["procs"]}
        wait = {n: done[n] - info[n][0] - info[n][1] for n in done}
        for q in qs:
            got = re.search(r"completion time of (P\d)", q.stem)
            if got:
                assert int(q.answer) == done[got.group(1)]
                hidden = p["hidden"]
                assert hidden < 0 or blocks[hidden][0] != got.group(1) or any(
                    i > hidden and x == got.group(1) for i, (x, _, _) in enumerate(blocks))
            got = re.search(r"waiting time of (P\d)", q.stem)
            if got:
                assert int(q.answer) == wait[got.group(1)]
            got = re.search(r"turnaround time of (P\d)", q.stem)
            if got:
                assert int(q.answer) == done[got.group(1)] - info[got.group(1)][0]
            if "average waiting time" in q.stem:
                avg = sum(wait.values()) / len(wait)
                assert abs(num(q.answer) - avg) < 1e-9 and len(q.answer.split(".")[-1]) <= 2
            got = re.search(r"running at time (\d+) ms", q.stem)
            if got:
                t = int(got.group(1))
                assert all(t != a for _, a, _ in blocks)  # strictly inside a block
                assert picked(q) == next(x for x, a, b in blocks if a < t < b)
            if "marked ?" in q.stem:
                h = p["hidden"]
                assert p["algo"] == "RR" and h > 0 and picked(q) == blocks[h][0]
                assert sum(x == blocks[h][0] for x, _, _ in blocks) >= 2  # not found by elimination
    assert min(algos.values()) > 250


def test_cpu_scheduling_draws_its_table_chart_and_formulas():
    m = fam("cpu_scheduling")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        gids = {t.get_gid(): t.get_text() for t in fig.axes[0].texts}
        words = " ".join(t.get_text() for t in fig.axes[0].texts)
        plt.close(fig)
        blocks = simulate(p["algo"], p["procs"], p["quantum"])
        for i, (n, a, b) in enumerate(blocks):
            assert gids[f"block:{i}"] == ("?" if i == p["hidden"] else n)
            assert gids[f"time:{a}"] == str(a) and gids[f"time:{b}"] == str(b)
        for n, a, b in p["procs"]:
            assert gids[f"cell:{n}:Arrival time (ms)"] == str(a) and gids[f"cell:{n}:Burst time (ms)"] == str(b)
        assert "Turnaround time = completion time − arrival time" in words
        assert "Waiting time = turnaround time − burst time" in words
        if p["algo"] == "RR":
            assert f"time quantum = {p['quantum']} ms" in words and "before the process" in words


# --- memory_allocation -----------------------------------------------------------------------------------------------

def fit(parts, jobs, rule):
    """Fixed partitions, one process each, in queue order; None for a process that waits."""
    taken, out = set(), {}
    for name, size in jobs:
        ok = [(i, letter, s) for i, (letter, s) in enumerate(parts) if letter not in taken and s >= size]
        if not ok:
            out[name] = None
            continue
        pick = {"first": min(ok), "best": min(ok, key=lambda x: (x[2], x[0])),
                "worst": max(ok, key=lambda x: (x[2], -x[0]))}[rule]
        out[name] = pick[1]
        taken.add(pick[1])
    return out


def test_memory_allocation():
    m = fam("memory_allocation")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        if p["sub"] == "paging":
            size, table = p["page_size"], p["table"]
            assert len(set(table)) == len(table) and all(0 <= f <= 9 for f in table)
            for q in qs:
                got = re.search(r"logical address (\d+)\. What is its physical address", q.stem)
                if got:
                    a = int(got.group(1))
                    assert int(q.answer) == table[a // size] * size + a % size
                got = re.search(r"Which page number holds logical address (\d+)", q.stem)
                if got:
                    a = int(got.group(1))
                    assert int(q.answer) == a // size < len(table)
                got = re.search(r"offset of logical address (\d+)", q.stem)
                if got:
                    a = int(got.group(1))
                    assert int(q.answer) == a % size and a % size != 0
            continue
        parts, jobs = p["parts"], p["jobs"]
        assert len({x for _, x in parts}) == 5
        placed = {r: fit(parts, jobs, r) for r in ("first", "best", "worst")}
        for q in qs:
            got = re.search(r"using (\w+) fit\. Which partition does (P\d) go into", q.stem)
            if got:
                rule, job = got.groups()
                assert picked(q) == placed[rule][job]
                assert len({placed[r][job] for r in placed} - {None}) >= 2  # the rule decides
            got = re.search(r"Using (\w+) fit, how much space is left unused in the partition that (P\d) takes", q.stem)
            if got:
                rule, job = got.groups()
                assert int(q.answer) == dict(parts)[placed[rule][job]] - dict(jobs)[job] > 0
            got = re.search(r"Using (\w+) fit, which process has to wait", q.stem)
            if got:
                waits = [n for n, x in placed[got.group(1)].items() if x is None]
                assert waits == [picked(q)]
    assert subs["fit"] > 450 and subs["paging"] > 300


def test_memory_allocation_shows_what_it_asks():
    m = fam("memory_allocation")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        gids = {t.get_gid(): t.get_text() for t in fig.axes[0].texts}
        plt.close(fig)
        if p["sub"] == "fit":
            for letter, size in p["parts"]:
                assert gids[f"part:{letter}"] == f"{letter}   {size} KB"
            for name, size in p["jobs"]:
                assert gids[f"job:{name}"] == f"{size} KB"
            assert {"rule:first", "rule:best", "rule:worst"} <= set(gids)
        else:
            assert gids["size"] == f"Page size = {p['page_size']} bytes"
            for i, f in enumerate(p["table"]):
                assert gids[f"table:{i}:0"] == str(i) and gids[f"table:{i}:1"] == str(f)


# --- gis_layers ------------------------------------------------------------------------------------------------------

def shoelace(poly):
    return abs(sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))) / 2


def gap_to_edges(poly, pt):
    from matplotlib.path import Path
    best = 1e9
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i - 1], poly[i]
        dx, dy = x2 - x1, y2 - y1
        t = max(0, min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, ((pt[0] - x1 - t * dx) ** 2 + (pt[1] - y1 - t * dy) ** 2) ** 0.5)
    return best, Path(poly).contains_point(pt)


def test_gis_layers():
    m = fam("gis_layers")
    for s in SEEDS:
        p, qs = run(m, s)
        polys = p["polygons"]
        assert sorted(pg["fid"] for pg in polys) == list(range(len(polys)))
        assert len({pg["use"] for pg in polys}) == len(polys)
        for sc in p["schools"]:
            for pg in polys:
                assert gap_to_edges(pg["poly"], sc)[0] >= 0.3 - 1e-9
        kinds = Counter(k for k, _ in p["letters"].values())
        assert kinds == {"point": 1, "line": 1, "polygon": 2}
        for q in qs:
            got = re.search(r"holds the feature lettered ([KLMN])", q.stem)
            if got:
                kind = p["letters"][got.group(1)][0]
                assert picked(q) == f"{kind} layer" and sorted(q.options) == ["line layer", "point layer", "polygon layer"]
            got = re.search(r"inside the ([\w -]+) polygon", q.stem)
            if got:
                pg = next(x for x in polys if x["use"].lower() == got.group(1))
                n = sum(gap_to_edges(pg["poly"], sc)[1] for sc in p["schools"])
                assert int(q.answer) == n and 1 <= n <= 3 and len(p["schools"]) - n >= 2
            got = re.search(r"describes the polygon lettered ([KLMN])", q.stem)
            if got:
                kind, i = p["letters"][got.group(1)]
                assert kind == "polygon" and picked(q) == str(polys[i]["fid"])
            got = re.search(r"how long is ([\w ]+ Road) on this map", q.stem)
            if got:
                road = next(r for r in p["roads"] if r["name"] == got.group(1))
                pts = road["path"]
                assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(pts, pts[1:]))  # along the grid
                assert int(q.answer) == sum(abs(a[0] - b[0]) + abs(a[1] - b[1]) for a, b in zip(pts, pts[1:]))


def test_gis_layers_draws_its_table_letters_and_clear_leaders():
    m = fam("gis_layers")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        gids = {t.get_gid(): t.get_text() for t in ax.texts}
        for pg in p["polygons"]:
            assert gids[f"row:{pg['fid']}:Land use"] == pg["use"]
            assert gids[f"row:{pg['fid']}:Area (ha)"] == str(round(shoelace(pg["poly"]) * 100))
            assert gids[f"legend:{pg['use']}"] == pg["use"]
        for letter in p["letters"]:
            assert gids[f"letter:{letter}"] == letter
        for k, r in enumerate(p["roads"]):
            assert gids[f"roadname:{k}"] == r["name"]
        boxes = drawn_texts(fig)
        for ln in ax.lines:
            gid = ln.get_gid() or ""
            if gid.startswith(("leader:", "road:", "river")):
                for t, box in boxes:
                    if gid.startswith("leader:") and t.get_gid() == f"letter:{gid[7:]}":
                        continue
                    assert not crosses(ln, box), (s, gid, t.get_text())
        plt.close(fig)


# --- phishing_check --------------------------------------------------------------------------------------------------

# This file's own judgement of each part: a warning sign of phishing, or safe.
PHISH = {"from_fake", "urgent", "pin", "link_fake", "typos", "http_fake", "urgent_banner", "card_pin"}
SAFE = {"from_real", "subject_calm", "no_pin", "link_real", "spelled", "footer", "https_real", "calm_banner",
        "search_field"}
PHISH_WORDS = {"sender's address that does not match": {"from_fake"}, "address that is not the real": {"from_fake"},
               "urgent threat": {"urgent", "urgent_banner"}, "something bad will happen": {"urgent"},
               "request for a PIN or password": {"pin", "card_pin"}, "asks for your password": {"pin"},
               "shown text and real address": {"link_fake"}, "spelling mistakes": {"typos"},
               "starts with http:// and shows no padlock": {"http_fake"}}


def test_phishing_check():
    m = fam("phishing_check")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[(p["band"], p["kind"])] += 1
        parts = dict(p["parts"])
        kinds = list(parts.values())
        assert set(kinds) <= PHISH | SAFE
        assert len(kinds) == (4 if p["band"] == "P" else 5) and len(set(kinds)) == len(kinds)
        assert any(k in PHISH for k in kinds) and any(k in SAFE for k in kinds)
        assert p["band"] != "P" or p["kind"] == "email"
        assert qs[0].stem.startswith(p["name"])
        for q in qs:
            if "Which letter shows" in q.stem:
                hits = [kinds_ for words, kinds_ in PHISH_WORDS.items() if words in q.stem]
                assert len(hits) == 1, q.stem
                matching = [k for k, x in parts.items() if x in hits[0]]
                assert matching == [picked(q)]
            if "How many of the lettered parts" in q.stem:
                assert int(q.answer) == sum(x in PHISH for x in kinds)
            if "is NOT a warning sign" in q.stem:
                assert parts[picked(q)] in SAFE
                assert all(parts[o] in PHISH for o in q.options if o != picked(q))
            got = re.search(r"address of this web page \(letter ([A-F])\) secure", q.stem)
            if got:
                assert parts[got.group(1)] in ("http_fake", "https_real")
                assert q.answer == ("Yes" if parts[got.group(1)] == "https_real" else "No")
    assert all(bands[k] > 60 for k in (("P", "email"), ("LS", "email"), ("UP", "email"), ("LS", "web"), ("UP", "web")))


def test_phishing_check_shows_each_sign_as_its_letter_says():
    m = fam("phishing_check")
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        gids = {t.get_gid(): t.get_text() for t in fig.axes[0].texts}
        sizes = [t.get_fontsize() for t in fig.axes[0].texts]
        plt.close(fig)
        real = p["domain"]
        assert gids["real"] == f"real website: www.{real}"
        if p["band"] == "P":
            assert min(sizes) >= 10
        for letter, kind in p["parts"]:
            assert gids[f"letter:{letter}"] == letter
            shown = gids.get(f"part:{letter}", "")
            if kind == "from_fake":
                assert shown.split("@")[1].rstrip(">") != real
            if kind == "from_real":
                assert shown.endswith(f"@{real}>")
            if kind in ("link_fake", "link_real"):
                tip = gids[f"tip:{letter}"].split()[-1]
                same = tip.split("//")[1] == shown
                assert same == (kind == "link_real") and (tip.startswith("https://") == (kind == "link_real"))
            if kind == "http_fake":
                assert shown.startswith("http://") and shown.split("/")[2] not in (real, "www." + real)
            if kind == "https_real":
                assert shown.startswith(f"https://www.{real}/")
            if kind == "typos":
                assert re.search(r"Pleese|detials|acount|tooday", shown)
            if kind == "urgent":
                assert re.search(r"URGENT|Hurry", shown)


# --- caesar_cipher, Primary ------------------------------------------------------------------------------------------

def shift_word(word, k):
    return "".join(chr((ord(c) - 65 + k) % 26 + 65) for c in word)


def test_caesar_cipher_primary():
    m = fam("caesar_cipher")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["band"] != "P":
            assert "style" not in p  # the older figures are drawn and worded as before
            continue
        seen[p["style"]] += 1
        k = p["shift"]
        assert 1 <= k <= 5 and m.stages(p) == (3, 6)
        assert all(3 <= len(w) <= 4 for w in p["words"])
        for q in qs:
            got = re.search(r"Encrypt the word ([A-Z]+):", q.stem)
            if got:
                assert q.answer == shift_word(got.group(1), k)
            got = re.search(r"Decrypt the word ([A-Z]+):", q.stem)
            if got:
                assert q.answer in p["words"] and shift_word(q.answer, k) == got.group(1)
            got = re.search(r"what secret letter does the letter ([A-Z]) become", q.stem)
            if got:
                assert q.answer == shift_word(got.group(1), k) and got.group(1) not in "".join(p["words"])
    assert min(seen.values()) > 100


def test_caesar_cipher_primary_draws_big_and_true():
    m = fam("caesar_cipher")
    n = 0
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["band"] != "P":
            continue
        n += 1
        fig = m.draw(p)
        texts_ = fig.axes[0].texts
        gids = {t.get_gid(): t.get_text() for t in texts_}
        assert min(t.get_fontsize() for t in texts_) >= 10
        assert any(f"hift {p['shift']}" in t.get_text() for t in texts_)
        for i in range(26):
            c = chr(65 + i)
            assert gids[f"plain:{c}"] == c and gids[f"secret:{c}"] == shift_word(c, p["shift"])
        plt.close(fig)
    assert n > 20


# --- branching_db_p --------------------------------------------------------------------------------------------------

# This file's own facts: what each animal has; each shape's sides (None for a curved shape), equal sides, right angle.
BEASTS = {"zebra": {"fur", "legs4", "stripes"}, "cow": {"fur", "legs4", "horns"}, "dog": {"fur", "legs4"},
          "frog": {"legs4"}, "tortoise": {"legs4", "shell"}, "eagle": {"feathers", "fly"}, "ostrich": {"feathers"},
          "fish": {"fins"}, "snake": set(), "snail": {"shell"}}
FIGS = {"square": (4, True, True), "rectangle": (4, False, True), "triangle": (3, True, False),
        "right-angled triangle": (3, False, True), "pentagon": (5, True, False), "hexagon": (6, True, False),
        "circle": (None, None, None), "semicircle": (None, None, None)}
ASKED = {"Does it have feathers?": "feathers", "Does it have fur or hair?": "fur", "Does it have four legs?": "legs4",
         "Does it have fins?": "fins", "Does it have stripes?": "stripes", "Does it have horns?": "horns",
         "Can it fly?": "fly", "Does it have a shell?": "shell", "Does it have a curved side?": "curved",
         "Does it have 4 sides?": "four", "Does it have 3 sides?": "three", "Are all its sides the same length?": "equal",
         "Does it have a right angle?": "right", "Does it have more than 4 sides?": "more4", "Is it shaded?": "shaded"}


def truth(p, thing, q):
    if p["domain"] == "animals":
        return q in BEASTS[thing]
    sides, equal, right = FIGS[thing]
    if q == "shaded":
        return thing in p["shaded"]
    if q == "curved":
        return sides is None
    assert sides is not None, (thing, q)  # a curved shape is never asked about its sides
    return {"four": sides == 4, "three": sides == 3, "more4": sides > 4, "equal": equal, "right": right}[q]


def ends_of(node, path=()):
    if "item" in node:
        return [(node["item"], path)]
    return ends_of(node["yes"], path + ((node["q"], True),)) + ends_of(node["no"], path + ((node["q"], False),))


def test_branching_db_p():
    m = fam("branching_db_p")
    for s in SEEDS:
        p, qs = run(m, s)
        assert m.stages(p) == (3, 4)
        ends = ends_of(p["tree"])
        assert sorted(t for t, _ in ends) == sorted(p["things"])
        for thing, path in ends:  # every branch tells the truth
            assert all(truth(p, thing, q) == v for q, v in path), (s, thing, path)
            assert len(path) <= 3
        letter = {t: k for (t, _), k in zip(ends, "ABCDEF")}
        q1, q2, q3 = qs
        new = re.search(r": an? (?:shaded )?([\w -]+?)\. ", q1.stem).group(1)
        assert new not in p["things"]
        node = p["tree"]
        while "q" in node:
            node = node["yes"] if truth(p, new, node["q"]) else node["no"]
        assert picked(q1) == letter[node["item"]]
        x, y = re.search(r"separates the ([\w -]+) from the ([\w -]+)\?", q2.stem).groups()
        px, py = dict(ends)[x], dict(ends)[y]
        common = 0
        while px[common] == py[common]:
            common += 1
        assert ASKED[picked(q2)] == px[common][0]
        t = re.search(r"to reach the ([\w -]+) in this", q3.stem).group(1)
        assert int(q3.answer) == len(dict(ends)[t])


def test_branching_db_p_draws_big_with_its_answers_on_the_lines():
    m = fam("branching_db_p")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        assert min(t.get_fontsize() for t in ax.texts) >= 10
        gids = {t.get_gid(): t.get_text() for t in ax.texts}
        ends = ends_of(p["tree"])
        for (thing, path), k in zip(ends, "ABCDEF"):
            assert gids[f"letter:{k}"] == k and gids[f"leaf:{k}"].replace("\n", " ") == thing
            key = "".join("Y" if v else "N" for _, v in path)
            for i in range(len(key)):
                assert gids[f"branch:{key[:i + 1]}"] == ("Yes" if key[i] == "Y" else "No")
        boxes = drawn_texts(fig)
        for ln in ax.lines:
            for t, box in boxes:
                assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


# --- all of them -----------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", WAVE + ("caesar_cipher", "trace_table"))
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
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


@pytest.mark.parametrize("fid", WAVE)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 120):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


@pytest.mark.parametrize("fid", WAVE + ("caesar_cipher",))
def test_declares_its_concepts_and_links(fid):
    m = fam(fid)
    assert m.SUBJECT == "computing" and m.CONCEPTS and all(c.startswith("computing.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    for s in range(1, 80):
        p = m.sample(random.Random(s))
        assert p["band"] in m.BANDS
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            assert m.stages(p), (fid, s)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """NEEDS and AVOID read against topic names (P4 reach check): names AVOID turns away, and names that NEEDS matches
    and AVOID lets through."""
    cases = {
        "class_diagram": (["Chapter 3: The functions of operating systems", "Collections in Java", "Unit 6: Pointers and Structure in C++"],
                          ["Chapter 27: Object-oriented programming (OOP)", "Unit 11: OOP and Java",
                           "Unit 7: Object Oriented Programming in C++", "Chapter 25: Programming paradigms"]),
        "cpu_scheduling": (["Chapter 3: Monitoring and control", "Data processing and information"],
                           ["Process Management and Scheduling Algorithm", "Chapter 20: System software",
                            "Chapter 8: System software"]),
        "memory_allocation": (["Unit 6: Pointers and Structure in C++", "Chapter 3: The role of the CPU", "Memory and storage"],
                              ["Memory Management", "Allocating and Placing Partitions in Memory"]),
        "gis_layers": (["Spreadsheet Basics"], ["GIS and maps", "ArcGIS", "Maps and layers", "Attribute Table"]),
        "phishing_check": (["Keyboard and mouse skills", "Unit 2: Be a data controller", "Chapter 10: Ethics and ownership",
                            "ICT in society", "Searching the Internet", "Table of Contents and Mail Merge"],
                           ["Internet safety", "Digital citizenship", "Digital ethics and safety", "Data Protection",
                            "Network Security", "Safe, Secure and Ethical Use of Computers",
                            "Unit 3: Safe & Ethical Use of Computers", "Chapter 4: E-safety and health and safety"]),
        "branching_db_p": (["Unit 8: Be a data collector", "Unit 3: Be a data detective", "Unit 4: Be a designer"],
                           ["Unit 11: Be a data designer", "Unit 2: Be a data controller", "Unit 7: Be a data boss"]),
        "caesar_cipher": (["Internet safety", "Digital citizenship"], ["Unit 9: Sending secret messages", "Ciphertext and plain text"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert re.search(m.AVOID, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)
    co = fam("code_output")
    lang = {"cpp": "Unit 13: Functions in C++ Programming", "java": "Unit 10: Introduction to Java",
            "vb": "Arrays, Functions and Procedures in Visual Basic"}
    for s in range(1, 200):
        p = co.sample(random.Random(s))
        for other, name in lang.items():
            if other != p["lang"]:
                assert re.search(co.avoid_for(p), name, re.I), (p["lang"], name)
    assert re.search(fam("trace_table").NEEDS, "Unit 8: Control Structures and One Dimension Array", re.I)
