"""Program listings and what they output (UP, AL): a short program of 6 to 14 numbered lines in C++, Java, Visual Basic
(a VB.NET console program) or Python, printed as the language writes it -- declarations, semicolons and braces,
`cout`, `System.out.println`, `Console.WriteLine`, `print` -- so it compiles and runs as shown. Integers only.

Programs (one spec each, rendered in the figure's language):
- sequence: integer division and remainder (`/` on ints, `\\` and `Mod`, `//` and `%`) and one formula;
- loop_if: a counted loop (step 1 or 2) with an if/else adding to a total;
- while: a condition-controlled loop that subtracts or halves until a limit, counting the passes;
- array: a one-dimensional array of six integers, adding those above a threshold or finding the index of the largest;
- function: a function with an if and two calls, or a function with a loop that returns a sum;
- struct (C++ only): a struct with two int fields, one changed;
- class (Java only): a class with fields and one method (area or add);
- arraylist (Java only): an ArrayList<Integer> filled in a loop, then remove(index), add(index, value) or set, get.
AL (AS & A Level) figures use Python, Java or Visual Basic, the languages Cambridge 9618 allows.

Asks what the program outputs, and one more: the final value of a named variable, how many times a numbered line runs,
the value a function call returns, or how many items the ArrayList holds after a numbered line.

Every key is the spec evaluated in Python (`execute`), never read from the rendered text; array indexes start at 0,
printed under the listing.
"""
from __future__ import annotations

import random
import re

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, count, new_figure, short

ID = "code_output"
KIND = "cs.code"
SUBJECT = "computing"
BANDS = ("UP", "AL")
LANG_NAME = {"cpp": "C++", "java": "Java", "vb": "Visual Basic", "python": "Python"}
TEMPLATES = {"cpp": ("sequence", "loop_if", "while", "array", "function", "struct"),
             "java": ("sequence", "loop_if", "while", "array", "function", "class", "arraylist"),
             "vb": ("sequence", "loop_if", "while", "array", "function"),
             "python": ("sequence", "loop_if", "while", "array", "function")}
AL_LANGS = ("python", "java", "vb")
AL_TEMPLATES = ("sequence", "loop_if", "while", "array", "function", "class")

BASE = ("coding-implementation", "variable-assignment", "input-output-programming")
EXTRA = {"sequence": ("arithmetic-operators", "sequence-control-structure"),
         "loop_if": ("iteration-control", "conditional-logic", "sequence-control-structure"),
         "while": ("iteration-control", "conditional-logic"),
         "array": ("one-dimensional-arrays", "array-elements-access", "iteration-control"),
         "function": ("functions-procedures", "variable-scope-parameters"),
         "struct": ("data-structures-introduction", "cpp-classes-objects"),
         "class": ("object-oriented-code-writing",),
         "arraylist": ("java-collections", "collection-framework-introduction", "data-structures-introduction")}
CONCEPTS = tuple(dict.fromkeys(f"computing.{c}" for c in BASE + sum(EXTRA.values(), ()) + ("cpp-functions",)))
# A topic whose sections the book lists is reached only if its name or a section names a language or what the program
# uses.
NEEDS = (r"c\+\+|java|visual basic|python|program|array|function|procedure|control|structure|collection|loop|selection|"
         r"iteration|variable|operator|output|\bcode\b|coding")
# Programming topics of another kind: projects, the web, files, games and blocks, low-level and declarative languages,
# algorithms on paper, and the history and theory of programming.
AVOID = (r"spreadsheet|database|network|internet|security|graphic|document|\bpresentation|email|html|\bweb\b|logic gate|"
         r"boolean|scratch|sprite|game|robot|micro:?bit|assembly|low-level|declarative|prolog|project|tomcat|enterprise|"
         r"file handling|recursion|algorithm|pseudocode|flowchart|paradigm|life cycle|development|scenario|testing|"
         r"evolution|history|translator|^data representation|abstract data|searching|sorting|animation|expert system|"
         r"input devices|input and output devices|types of software|excel|fundamentals|file processing|"
         r"introduction to computer programming")
LANG_AVOID = {"cpp": r"java|visual basic|python|\bvb\b", "java": r"c\+\+|visual basic|python|\bvb\b",
              "vb": r"java|c\+\+|python", "python": r"java|c\+\+|visual basic|\bvb\b"}
# The programs each topic's name says it teaches: a struct only for C++ structures, an ArrayList only for collections.
TEMPLATE_AVOID = {
    "sequence": r"array|function|procedure|collection|oop|object|class|pointer|loop|control statements|data types and structures",
    "loop_if": r"^(?!.*control).*array|function|procedure|collection|oop|object|class|pointer|introduction to c\+\+|"
               r"operators and expressions|io and|data types and structures",
    "while": r"^(?!.*control).*array|function|procedure|collection|oop|object|class|pointer|introduction to c\+\+|"
             r"operators and expressions|io and|data types and structures",
    "array": r"introduction to|operators|control statements|functions in|io and|pointer|collection|oop|object|class",
    "function": r"introduction to|operators|control|array(?!s, functions)|io and|pointer|collection|oop|object|class|data types and structures",
    "struct": r"^(?!.*(pointer|structure in c)).*",
    "class": r"^(?!.*(oop|object|class)).*",
    "arraylist": r"^(?!.*collection).*",
}


def concepts_for(p: dict) -> tuple[str, ...]:
    extra = EXTRA[p["template"]] + (("cpp-functions",) if p["template"] == "function" and p["lang"] == "cpp" else ())
    return tuple(f"computing.{c}" for c in BASE + extra)


def avoid_for(p: dict) -> str:
    return "|".join((AVOID, LANG_AVOID[p["lang"]], TEMPLATE_AVOID[p["template"]]))


# --- names -------------------------------------------------------------------------------------------

SEQ_NAMES = [("mangoes", "perBox", "boxes", "spare"), ("pupils", "perTeam", "teams", "extra"),
             ("eggs", "perTray", "trays", "loose"), ("pages", "perDay", "days", "rest"),
             ("chairs", "perRow", "rows", "over")]
WHILE_NAMES = {"sub": [("money", "days"), ("water", "cups"), ("fuel", "trips"), ("stock", "weeks")],
               "half": [("size", "steps"), ("number", "halvings"), ("files", "rounds")]}
ARRAY_NAMES = ["marks", "prices", "scores", "sales", "heights"]
STRUCTS = [("Item", "price", "qty", "*"), ("Box", "length", "width", "*"), ("Field", "rows", "perRow", "*"),
           ("Test", "mark1", "mark2", "+")]
CLASSES = {"box": [("Box", "b", "width", "height", "area"), ("Room", "r", "length", "breadth", "floorArea"),
                   ("Plot", "p", "rows", "cols", "plants")],
           "counter": [("Counter", "c", "total", "add"), ("Wallet", "w", "money", "deposit"), ("Tank", "t", "litres", "fill")]}
LIST_NAMES = ["list", "nums", "marks", "queue"]


def snake(name: str) -> str:
    """perBox as Python names it: per_box."""
    return re.sub(r"([A-Z])", lambda m: "_" + m.group(1).lower(), name)


# --- the programs, evaluated ---------------------------------------------------------------------------

def execute(p: dict) -> dict:
    """The program's output and the values the questions ask about, worked out from the spec in Python."""
    t, v = p["template"], p["values"]
    if t == "sequence":
        groups, spare = v["a"] // v["b"], v["a"] % v["b"]
        out = groups * v["k"] + spare if v["form"] == "mul" else (groups + spare) * v["k"]
        return {"output": out, "groups": groups, "spare": spare}
    if t == "loop_if":
        total, hits = 0, 0
        for i in range(v["start"], v["end"] + 1, v["step"]):
            if (i % v["m"] == 0) if v["cond"] == "mod" else (i > v["t"]):
                total += i * v["k"]
                hits += 1
            else:
                total += v["c"]
        return {"output": total, "hits": hits}
    if t == "while":
        n, passes = v["n"], 0
        while n > v["limit"] or (v["cond"] == ">=" and n == v["limit"]):
            n = n - v["d"] if v["op"] == "sub" else n // 2
            passes += 1
        return {"output": passes, "final": n}
    if t == "array":
        nums = v["nums"]
        if v["kind"] == "above":
            picked = [x for x in nums if x > v["t"]]
            return {"output": sum(picked), "hits": len(picked)}
        pos, moves = 0, 0
        for i in range(1, len(nums)):
            if nums[i] > nums[pos]:
                pos, moves = i, moves + 1
        return {"output": pos, "hits": moves}
    if t == "function":
        if v["kind"] == "if":
            calc = lambda x: x - v["d"] if x > v["t"] else x * v["k"]  # noqa: E731
            a, b = calc(v["p"]), calc(v["q"])
            return {"output": a + b, "a": a, "b": b}
        ret = sum(i * v["k"] for i in range(1, v["n"] + 1))
        return {"output": ret - v["m"], "returned": ret}
    if t == "struct":
        f1, f2 = v["f1"], v["f2"]
        if v["change"] == "f2":
            f2 += v["r"]
        else:
            f1 -= v["r"]
        op = STRUCTS[v["s"]][3]
        return {"output": f1 * f2 if op == "*" else f1 + f2, "f1": f1, "f2": f2}
    if t == "class":
        if v["kind"] == "box":
            w = v["w"]
            h = w + v["h"] if v["sign"] == "+" else w - v["h"]
            return {"output": w * h + v["e"], "field": h}
        total = v["x"] + v["y"]
        return {"output": total * v["k"], "field": total}
    items = [i * v["k"] for i in range(1, v["n"] + 1)]
    items.pop(v["r"])
    if v["op"] == "add":
        items.insert(v["j"], v["val"])
    else:
        items[v["j"]] = v["val"]
    return {"output": items[v["g"]], "size": len(items), "items": items}


# --- the programs, written in each language ---------------------------------------------------------------

class _Code:
    def __init__(self) -> None:
        self.rows: list[str] = []
        self.marks: dict[str, int] = {}

    def add(self, depth: int, text: str, mark: str | None = None) -> None:
        self.rows.append("    " * depth + text)
        if mark:
            self.marks[mark] = len(self.rows)


def _decl(lang: str, name: str, expr: str) -> str:
    if lang in ("cpp", "java"):
        return f"int {name} = {expr};"
    if lang == "vb":
        return f"Dim {name} As Integer = {expr}"
    return f"{snake(name)} = {expr}"


def _set(lang: str, name: str, expr: str) -> str:
    if lang == "python":
        return f"{snake(name)} = {expr}"
    return f"{name} = {expr}" + (";" if lang in ("cpp", "java") else "")


def _show(lang: str, expr: str) -> str:
    return {"cpp": f"cout << {expr} << endl;", "java": f"System.out.println({expr});", "vb": f"Console.WriteLine({expr})",
            "python": f"print({expr})"}[lang]


def _if(c: _Code, d: int, lang: str, cond: str) -> None:
    c.add(d, {"cpp": f"if ({cond}) {{", "java": f"if ({cond}) {{", "vb": f"If {cond} Then", "python": f"if {cond}:"}[lang])


def _else(c: _Code, d: int, lang: str) -> None:
    c.add(d, {"cpp": "} else {", "java": "} else {", "vb": "Else", "python": "else:"}[lang])


def _end(c: _Code, d: int, lang: str, vb: str) -> None:
    """Closes a block: a brace in C++ and Java, its End line in Visual Basic, nothing in Python."""
    if lang in ("cpp", "java"):
        c.add(d, "}")
    elif lang == "vb":
        c.add(d, vb)


def _for(c: _Code, d: int, lang: str, start: int, end: int, step: int = 1) -> None:
    if lang in ("cpp", "java"):
        inc = "i++" if step == 1 else f"i += {step}"
        c.add(d, f"for (int i = {start}; i <= {end}; {inc}) {{")
    elif lang == "vb":
        c.add(d, f"For i As Integer = {start} To {end}" + (f" Step {step}" if step != 1 else ""))
    else:
        c.add(d, f"for i in range({start}, {end + 1}" + (f", {step}" if step != 1 else "") + "):")


def _mod(lang: str, a: str, b: int) -> str:
    return f"{a} Mod {b}" if lang == "vb" else f"{a} % {b}"


def _eq(lang: str) -> str:
    return "=" if lang == "vb" else "=="


def _idx(lang: str, arr: str, i: str) -> str:
    return f"{arr}({i})" if lang == "vb" else f"{arr}[{i}]"


def _begin(c: _Code, lang: str, defs=None, outside: bool = False) -> int:
    """Everything before the main program's body, with any function or class; returns the body's depth."""
    if lang == "cpp":
        c.add(0, "#include <iostream>")
        c.add(0, "using namespace std;")
        if defs:
            defs(c, 0)
        c.add(0, "int main() {")
        return 1
    if lang == "java":
        if defs and outside:
            defs(c, 0)
        c.add(0, "public class Main {")
        if defs and not outside:
            defs(c, 1)
        c.add(1, "public static void main(String[] args) {")
        return 2
    if lang == "vb":
        c.add(0, "Module Program")
        if defs:
            defs(c, 1)
        c.add(1, "Sub Main()")
        return 2
    if defs:
        defs(c, 0)
    return 0


def _finish(c: _Code, lang: str) -> None:
    if lang == "cpp":
        c.add(1, "return 0;")
        c.add(0, "}")
    elif lang == "java":
        c.add(1, "}")
        c.add(0, "}")
    elif lang == "vb":
        c.add(1, "End Sub")
        c.add(0, "End Module")


def _sequence(c: _Code, lang: str, v: dict) -> None:
    whole, per, groups, spare = SEQ_NAMES[v["names"]]
    n = (lambda x: snake(x)) if lang == "python" else (lambda x: x)  # noqa: E731
    div = {"cpp": "/", "java": "/", "vb": "\\", "python": "//"}[lang]
    d = _begin(c, lang)
    c.add(d, _decl(lang, whole, str(v["a"])))
    c.add(d, _decl(lang, per, str(v["b"])))
    c.add(d, _decl(lang, groups, f"{n(whole)} {div} {n(per)}"), "groups")
    c.add(d, _decl(lang, spare, _mod(lang, n(whole), n(per))), "spare")
    formula = f"{groups} * {v['k']} + {spare}" if v["form"] == "mul" else f"({groups} + {spare}) * {v['k']}"
    c.add(d, _decl(lang, "result", formula))
    c.add(d, _show(lang, "result"), "show")
    _finish(c, lang)


def _loop_if(c: _Code, lang: str, v: dict) -> None:
    d = _begin(c, lang)
    c.add(d, _decl(lang, "total", "0"))
    _for(c, d, lang, v["start"], v["end"], v["step"])
    cond = f"{_mod(lang, 'i', v['m'])} {_eq(lang)} 0" if v["cond"] == "mod" else f"i > {v['t']}"
    _if(c, d + 1, lang, cond)
    add = "i" if v["k"] == 1 else f"i * {v['k']}"
    c.add(d + 2, _set(lang, "total", f"total + {add}"), "then")
    _else(c, d + 1, lang)
    c.add(d + 2, _set(lang, "total", f"total + {v['c']}"), "else")
    _end(c, d + 1, lang, "End If")
    _end(c, d, lang, "Next")
    c.add(d, _show(lang, "total"), "show")
    _finish(c, lang)


def _while(c: _Code, lang: str, v: dict) -> None:
    var, passes = WHILE_NAMES[v["op"]][v["names"]]
    d = _begin(c, lang)
    c.add(d, _decl(lang, var, str(v["n"])))
    c.add(d, _decl(lang, passes, "0"))
    cond = f"{var} {v['cond']} {v['limit']}"
    c.add(d, {"cpp": f"while ({cond}) {{", "java": f"while ({cond}) {{", "vb": f"Do While {cond}",
              "python": f"while {cond}:"}[lang], "loop")
    if v["op"] == "sub":
        step = f"{var} - {v['d']}"
    else:
        step = {"cpp": f"{var} / 2", "java": f"{var} / 2", "vb": f"{var} \\ 2", "python": f"{var} // 2"}[lang]
    c.add(d + 1, _set(lang, var, step), "step")
    c.add(d + 1, _set(lang, passes, f"{passes} + 1"), "count")
    _end(c, d, lang, "Loop")
    c.add(d, _show(lang, passes), "show")
    _finish(c, lang)


def _array(c: _Code, lang: str, v: dict) -> None:
    arr, nums = ARRAY_NAMES[v["names"]], v["nums"]
    items = ", ".join(map(str, nums))
    d = _begin(c, lang)
    c.add(d, {"cpp": f"int {arr}[{len(nums)}] = {{{items}}};", "java": f"int[] {arr} = {{{items}}};",
              "vb": f"Dim {arr}() As Integer = {{{items}}}", "python": f"{arr} = [{items}]"}[lang])
    first = 0 if v["kind"] == "above" else 1
    if v["kind"] == "above":
        c.add(d, _decl(lang, "total", "0"))
    else:
        c.add(d, _decl(lang, "pos", "0"))
    c.add(d, {"cpp": f"for (int i = {first}; i < {len(nums)}; i++) {{",
              "java": f"for (int i = {first}; i < {arr}.length; i++) {{",
              "vb": f"For i As Integer = {first} To {len(nums) - 1}",
              "python": f"for i in range(len({arr})):" if first == 0 else f"for i in range(1, len({arr})):"}[lang])
    if v["kind"] == "above":
        _if(c, d + 1, lang, f"{_idx(lang, arr, 'i')} > {v['t']}")
        c.add(d + 2, _set(lang, "total", f"total + {_idx(lang, arr, 'i')}"), "then")
    else:
        _if(c, d + 1, lang, f"{_idx(lang, arr, 'i')} > {_idx(lang, arr, 'pos')}")
        c.add(d + 2, _set(lang, "pos", "i"), "then")
    _end(c, d + 1, lang, "End If")
    _end(c, d, lang, "Next")
    c.add(d, _show(lang, "total" if v["kind"] == "above" else "pos"), "show")
    _finish(c, lang)


def _fname(lang: str, kind: str) -> str:
    base = "calc" if kind == "if" else "addUp"
    return {"vb": base[0].upper() + base[1:], "python": snake(base)}.get(lang, base)


def _function(c: _Code, lang: str, v: dict) -> None:
    f = _fname(lang, v["kind"])
    par = "x" if v["kind"] == "if" else "n"

    def defs(c: _Code, d: int) -> None:
        head = {"cpp": f"int {f}(int {par}) {{", "java": f"static int {f}(int {par}) {{",
                "vb": f"Function {f}(ByVal {par} As Integer) As Integer", "python": f"def {f}({par}):"}[lang]
        c.add(d, head, "def")
        ret = (lambda e: f"return {e};") if lang in ("cpp", "java") else \
            ((lambda e: f"Return {e}") if lang == "vb" else (lambda e: f"return {e}"))
        if v["kind"] == "if":
            _if(c, d + 1, lang, f"x > {v['t']}")
            c.add(d + 2, ret(f"x - {v['d']}"))
            _end(c, d + 1, lang, "End If")
            c.add(d + 1, ret(f"x * {v['k']}"))
        else:
            c.add(d + 1, _decl(lang, "s", "0"))
            if lang in ("cpp", "java"):
                c.add(d + 1, "for (int i = 1; i <= n; i++) {")
            elif lang == "vb":
                c.add(d + 1, "For i As Integer = 1 To n")
            else:
                c.add(d + 1, "for i in range(1, n + 1):")
            c.add(d + 2, _set(lang, "s", f"s + i * {v['k']}"))
            _end(c, d + 1, lang, "Next")
            c.add(d + 1, ret("s"))
        _end(c, d, lang, "End Function")

    d = _begin(c, lang, defs)
    if v["kind"] == "if":
        c.add(d, _decl(lang, "a", f"{f}({v['p']})"), "a")
        c.add(d, _decl(lang, "b", f"{f}({v['q']})"), "b")
        c.add(d, _show(lang, "a + b"), "show")
    else:
        c.add(d, _show(lang, f"{f}({v['n']}) - {v['m']}"), "show")
    _finish(c, lang)


def _struct(c: _Code, lang: str, v: dict) -> None:
    name, f1, f2, op = STRUCTS[v["s"]]

    def defs(c: _Code, d: int) -> None:
        c.add(d, f"struct {name} {{")
        c.add(d + 1, f"int {f1};")
        c.add(d + 1, f"int {f2};")
        c.add(d, "};")

    d = _begin(c, lang, defs)
    c.add(d, f"{name} a;")
    c.add(d, f"a.{f1} = {v['f1']};")
    c.add(d, f"a.{f2} = {v['f2']};")
    if v["change"] == "f2":
        c.add(d, f"a.{f2} = a.{f2} + {v['r']};", "change")
    else:
        c.add(d, f"a.{f1} = a.{f1} - {v['r']};", "change")
    c.add(d, _show(lang, f"a.{f1} {op} a.{f2}"), "show")
    _finish(c, lang)


def _class(c: _Code, lang: str, v: dict) -> None:
    kind = v["kind"]
    names = CLASSES[kind][v["names"]]
    if lang == "java":
        if kind == "box":
            cls, obj, f1, f2, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"class {cls} {{")
                c.add(d + 1, f"int {f1}, {f2};")
                c.add(d + 1, f"int {method}() {{")
                c.add(d + 2, f"return {f1} * {f2};")
                c.add(d + 1, "}")
                c.add(d, "}")
        else:
            cls, obj, field, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"class {cls} {{")
                c.add(d + 1, f"int {field} = 0;")
                c.add(d + 1, f"void {method}(int n) {{")
                c.add(d + 2, f"{field} = {field} + n;")
                c.add(d + 1, "}")
                c.add(d, "}")
        d = _begin(c, lang, defs, outside=True)
        c.add(d, f"{cls} {obj} = new {cls}();")
    elif lang == "vb":
        if kind == "box":
            cls, obj, f1, f2, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"Class {cls}")
                c.add(d + 1, f"Public {f1}, {f2} As Integer")
                c.add(d + 1, f"Function {method[0].upper() + method[1:]}() As Integer")
                c.add(d + 2, f"Return {f1} * {f2}")
                c.add(d + 1, "End Function")
                c.add(d, "End Class")
        else:
            cls, obj, field, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"Class {cls}")
                c.add(d + 1, f"Public {field} As Integer = 0")
                c.add(d + 1, f"Sub {method[0].upper() + method[1:]}(ByVal n As Integer)")
                c.add(d + 2, f"{field} = {field} + n")
                c.add(d + 1, "End Sub")
                c.add(d, "End Class")
        d = _begin(c, lang, defs)
        c.add(d, f"Dim {obj} As New {cls}()")
    else:  # Python
        if kind == "box":
            cls, obj, f1, f2, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"class {cls}:")
                c.add(d + 1, f"def {snake(method)}(self):")
                c.add(d + 2, f"return self.{f1} * self.{f2}")
        else:
            cls, obj, field, method = names

            def defs(c: _Code, d: int) -> None:
                c.add(d, f"class {cls}:")
                c.add(d + 1, "def __init__(self):")
                c.add(d + 2, f"self.{field} = 0")
                c.add(d + 1, f"def {method}(self, n):")
                c.add(d + 2, f"self.{field} = self.{field} + n")
        d = _begin(c, lang, defs)
        c.add(d, f"{obj} = {cls}()")
    semi = ";" if lang == "java" else ""
    m = (lambda s: snake(s)) if lang == "python" else ((lambda s: s[0].upper() + s[1:]) if lang == "vb" else (lambda s: s))  # noqa: E731
    if kind == "box":
        cls, obj, f1, f2, method = names
        c.add(d, f"{obj}.{f1} = {v['w']}{semi}")
        c.add(d, f"{obj}.{f2} = {obj}.{f1} {v['sign']} {v['h']}{semi}", "change")
        c.add(d, _show(lang, f"{obj}.{m(method)}() + {v['e']}"), "show")
    else:
        cls, obj, field, method = names
        c.add(d, f"{obj}.{m(method)}({v['x']}){semi}", "call1")
        c.add(d, f"{obj}.{m(method)}({v['y']}){semi}", "call2")
        c.add(d, _show(lang, f"{obj}.{field} * {v['k']}"), "show")
    _finish(c, lang)


def _arraylist(c: _Code, lang: str, v: dict) -> None:
    name = LIST_NAMES[v["names"]]
    c.add(0, "import java.util.ArrayList;")
    d = _begin(c, lang)
    c.add(d, f"ArrayList<Integer> {name} = new ArrayList<Integer>();")
    c.add(d, f"for (int i = 1; i <= {v['n']}; i++) {{")
    c.add(d + 1, f"{name}.add(i * {v['k']});")
    c.add(d, "}")
    c.add(d, f"{name}.remove({v['r']});", "remove")
    if v["op"] == "add":
        c.add(d, f"{name}.add({v['j']}, {v['val']});", "change")
    else:
        c.add(d, f"{name}.set({v['j']}, {v['val']});", "change")
    c.add(d, _show(lang, f"{name}.get({v['g']})"), "show")
    _finish(c, lang)


WRITERS = {"sequence": _sequence, "loop_if": _loop_if, "while": _while, "array": _array, "function": _function,
           "struct": _struct, "class": _class, "arraylist": _arraylist}


def program(p: dict) -> tuple[list[str], dict[str, int]]:
    """The listing as printed, and the line numbers (from 1) of the lines the questions name."""
    c = _Code()
    WRITERS[p["template"]](c, p["lang"], p["values"])
    return c.rows, c.marks


# --- sampling ------------------------------------------------------------------------------------------

def _values(rng: random.Random, t: str, lang: str) -> dict | None:
    if t == "sequence":
        a, b = rng.randint(23, 97), rng.randint(3, 9)
        if a % b == 0 or a // b < 2 or a // b == a % b:
            return None
        return {"names": rng.randrange(len(SEQ_NAMES)), "a": a, "b": b, "k": rng.randint(2, 5),
                "form": rng.choice(["mul", "sum"])}
    if t == "loop_if":
        step = rng.choice([1, 1, 2])
        start = rng.randint(1, 4)
        end = start + step * (rng.randint(5, 8) - 1)
        cond = rng.choice(["mod", "gt"])
        v = {"start": start, "end": end, "step": step, "cond": cond, "m": rng.randint(2, 4),
             "t": rng.randint(start + step, end - step), "k": rng.choice([1, 1, 2, 3]), "c": rng.randint(1, 5)}
        return v
    if t == "while":
        op = rng.choice(["sub", "half"])
        if op == "sub":
            v = {"op": op, "n": rng.randint(30, 95), "d": rng.randint(3, 9), "limit": rng.randint(0, 15)}
        else:
            v = {"op": op, "n": rng.randint(40, 200), "d": 2, "limit": rng.randint(1, 9)}
        v.update({"cond": rng.choice([">", ">="]), "names": rng.randrange(len(WHILE_NAMES[op]))})
        return v
    if t == "array":
        kind = rng.choice(["above", "maxpos"])
        nums = rng.sample(range(2, 60), 6)
        return {"kind": kind, "nums": nums, "t": rng.randint(15, 45), "names": rng.randrange(len(ARRAY_NAMES))}
    if t == "function":
        kind = rng.choice(["if", "loop"])
        if kind == "if":
            th = rng.randint(5, 12)
            big, small = rng.randint(th + 1, th + 8), rng.randint(2, th)
            p, q = (big, small) if rng.random() < 0.5 else (small, big)
            return {"kind": kind, "t": th, "d": rng.randint(1, 5), "k": rng.randint(2, 4), "p": p, "q": q}
        return {"kind": kind, "k": rng.randint(2, 5), "n": rng.randint(3, 6), "m": rng.randint(1, 9)}
    if t == "struct":
        s = rng.randrange(len(STRUCTS))
        if STRUCTS[s][0] == "Item":
            f1, f2 = rng.randrange(100, 950, 50), rng.randint(2, 6)
        elif STRUCTS[s][0] == "Test":
            f1, f2 = rng.randint(30, 70), rng.randint(30, 70)
        else:
            f1, f2 = rng.randint(4, 12), rng.randint(3, 9)
        change = rng.choice(["f1", "f2"])
        r = rng.randint(1, 4) if STRUCTS[s][0] != "Item" else (rng.randint(1, 3) if change == "f2" else rng.choice([50, 100]))
        if change == "f1" and f1 - r < 1:
            return None
        return {"s": s, "f1": f1, "f2": f2, "change": change, "r": r}
    if t == "class":
        kind = rng.choice(["box", "counter"])
        if kind == "box":
            return {"kind": kind, "names": rng.randrange(3), "w": rng.randint(4, 9), "h": rng.randint(1, 3),
                    "sign": rng.choice(["+", "-"]), "e": rng.randint(1, 9)}
        return {"kind": kind, "names": rng.randrange(3), "x": rng.randint(2, 20), "y": rng.randint(2, 20),
                "k": rng.randint(2, 3)}
    n = rng.randint(4, 6)
    v = {"names": rng.randrange(len(LIST_NAMES)), "n": n, "k": rng.randint(2, 9), "r": rng.randrange(n),
         "op": rng.choice(["add", "set"]), "val": rng.randint(10, 99)}
    v["j"] = rng.randint(0, n - 1) if v["op"] == "add" else rng.randint(0, n - 2)
    v["g"] = rng.randint(0, n - 1) if v["op"] == "add" else rng.randint(0, n - 2)
    return v


def _fair(t: str, v: dict, run: dict) -> bool:
    """Every part of the program matters and nothing runs too long or goes below zero."""
    if t == "loop_if":
        n = len(range(v["start"], v["end"] + 1, v["step"]))
        return 2 <= run["hits"] <= n - 1 and run["output"] < 1000
    if t == "while":
        return 3 <= run["output"] <= 7 and run["final"] >= 0
    if t == "array":
        if v["kind"] == "above":
            return 2 <= run["hits"] <= 4 and v["t"] not in v["nums"]
        return run["hits"] >= 2 and run["output"] != len(v["nums"]) - 1
    if t == "arraylist":
        naive = v["k"] * (v["g"] + 1)  # what a student gets who skips the remove and the change
        return run["output"] != naive and v["val"] not in run["items"][:v["j"]] + run["items"][v["j"] + 1:]
    return True


def sample(rng: random.Random) -> dict:
    band = rng.choice(["UP", "UP", "AL"])
    lang = rng.choice(AL_LANGS if band == "AL" else tuple(LANG_NAME))
    if band == "AL":
        pool = list(AL_TEMPLATES)  # Cambridge 9618: a class in any of its three languages
    else:
        pool = list(TEMPLATES[lang])
        if lang == "java":
            pool += ["class", "arraylist"]  # Rwanda S5 and S6 Java: classes and collections, twice as often
    t = rng.choice(pool)
    while True:
        v = _values(rng, t, lang)
        if v is None:
            continue
        p = {"band": band, "lang": lang, "template": t, "values": v}
        if _fair(t, v, execute(p)) and 6 <= len(program(p)[0]) <= 14:
            return p


# --- drawing -------------------------------------------------------------------------------------------

TITLE = {"cpp": "C++ program", "java": "Java program", "vb": "Visual Basic (VB.NET) program", "python": "Python program"}
CH = 0.088  # one monospace character at 10 pt, in inches
LH = 0.26  # one line


def draw(p: dict):
    rows, _ = program(p)
    width = max(len(r) for r in rows) * CH + 0.85
    width = max(width, 3.6)
    note = p["template"] in ("array", "arraylist")
    body = len(rows) * LH + 0.15
    top = 0.4 + body + (0.4 if note else 0)
    # The axes fill the figure, so one unit is one inch and a 10 pt character is CH wide.
    fig, ax = new_figure(width + 0.1, top + 0.1)
    ax.set_position([0, 0, 1, 1])
    ax.add_patch(Rectangle((0, top - 0.4), width, 0.4, facecolor="#d9dee3", edgecolor=INK, linewidth=1.1))
    ax.text(0.12, top - 0.2, TITLE[p["lang"]], ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.add_patch(Rectangle((0, top - 0.4 - body), width, body, facecolor="#f7f8f9", edgecolor=INK, linewidth=1.1))
    ax.add_patch(Rectangle((0, top - 0.4 - body), 0.45, body, facecolor="#eceef0", edgecolor=INK, linewidth=0.8))
    for i, line in enumerate(rows):
        y = top - 0.4 - 0.075 - (i + 0.5) * LH
        ax.text(0.36, y, str(i + 1), ha="right", va="center", fontsize=9, family="monospace", color="#555555")
        if line.strip():
            ax.text(0.58, y, line, ha="left", va="center", fontsize=10, family="monospace", gid=f"line:{i + 1}")
    bottom = top - 0.4 - body
    if note:
        ax.text(0, bottom - 0.2, "Array and list indexes start at 0.", ha="left", va="center", fontsize=9, style="italic",
                color="#333333")
        bottom -= 0.4
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(bottom - 0.05, top + 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -----------------------------------------------------------------------------------------

SETTINGS = ["in a computing lesson", "for homework", "at the coding club", "for a class test", "on a revision card",
            "in the computer lab"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lang, t, v = LANG_NAME[p["lang"]], p["template"], p["values"]
    run = execute(p)
    rows, marks = program(p)
    out = run["output"]
    qs = [short(f"{who} runs this {lang} program {rng.choice(SETTINGS)}. What does it output?", out, [str(out)])]
    line = lambda k: f"line {marks[k]}"  # noqa: E731
    py = (lambda s: snake(s)) if p["lang"] == "python" else (lambda s: s)  # noqa: E731
    if t == "sequence":
        _, _, groups, spare = SEQ_NAMES[v["names"]]
        name, val = (groups, run["groups"]) if rng.random() < 0.5 else (spare, run["spare"])
        qs.append(short(f"What value does {line('groups' if name == groups else 'spare')} of this {lang} program store "
                        f"in {py(name)}?", val, [str(val)]))
    elif t in ("loop_if", "array"):
        qs.append(count(f"How many times does {line('then')} of this {lang} program run?", run["hits"], "times"))
    elif t == "while":
        var = WHILE_NAMES[v["op"]][v["names"]][0]
        qs.append(short(f"What is the final value of {py(var)} when this {lang} program ends?", run["final"],
                        [str(run["final"])]))
    elif t == "function":
        if v["kind"] == "if":
            qs.append(short(f"What value does {line('a')} of this {lang} program store in a?", run["a"], [str(run["a"])]))
        else:
            f = _fname(p["lang"], "loop")
            qs.append(short(f"What value does the call {f}({v['n']}) return in this {lang} program?", run["returned"],
                            [str(run["returned"])]))
    elif t == "struct":
        name, f1, f2, _ = STRUCTS[v["s"]]
        field, val = (f2, run["f2"]) if v["change"] == "f2" else (f1, run["f1"])
        qs.append(short(f"What is the value of a.{field} after {line('change')} of this {lang} program runs?", val,
                        [str(val)]))
    elif t == "class":
        names = CLASSES[v["kind"]][v["names"]]
        obj = names[1]
        field = names[3] if v["kind"] == "box" else names[2]
        qs.append(short(f"What is the value of {obj}.{field} when this {lang} program ends?", run["field"],
                        [str(run["field"])]))
    else:
        qs.append(count(f"How many items does {LIST_NAMES[v['names']]} hold after {line('change')} of this {lang} "
                        f"program runs?", run["size"], "items"))
    return qs
