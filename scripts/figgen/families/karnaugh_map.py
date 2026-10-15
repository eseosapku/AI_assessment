"""Karnaugh maps (AL): a K-map for X over three variables (rows A, columns BC) or four (rows AB, columns CD), its row
and column headings in Gray-code order (00, 01, 11, 10), as 9618 prints them. Either a truth table beside an empty
map with two or three cells lettered, or a Boolean expression (a sum of products that is not the simplest) above a
map filled in but for three or four lettered cells.

Asks the value in a lettered cell, how many cells of the completed map hold 1, and which of four expressions is the
simplest sum of products (fewest terms, then fewest literals; NOT written as a bar over the letter).

Every key is computed: the function's prime implicants and its covers searched for the smallest, which must be the
only one. The three wrong options are two slips crossed (a literal of the wrong sense, or a group taken too big), each
a different function from X's, so no option stands out from its words alone.
"""
from __future__ import annotations

import itertools
import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "karnaugh_map"
KIND = "cs.logic"
SUBJECT = "computing"
BANDS = ("AL",)
CONCEPTS = tuple(f"computing.{c}" for c in ("karnaugh-maps", "boolean-algebra", "truth-tables", "logic-expressions"))
# A topic whose sections the book lists is reached only if one names K-maps or Boolean algebra.
NEEDS = r"karnaugh|k-maps?\b|boolean algebra"
AVOID = r"expert system|declarative|spreadsheet|database|components of a computer system|programming and data"
BAR = "̅"  # a combining overline: "B̅" is NOT B, as the paper prints it
GRAY = {1: ["0", "1"], 2: ["00", "01", "11", "10"]}
HEAD = "#d9dee3"


def covers(cube: str, m: int) -> bool:
    bits = format(m, f"0{len(cube)}b")
    return all(c in ("-", b) for c, b in zip(cube, bits))


def minterms(cubes, n: int) -> set[int]:
    return {m for m in range(2 ** n) if any(covers(c, m) for c in cubes)}


def simplest(ones: set[int], n: int) -> list[list[str]]:
    """Every sum of products for the function with the fewest terms, then the fewest literals."""
    imps = ["".join(c) for c in itertools.product("01-", repeat=n)]
    imps = [c for c in imps if all(m in ones for m in range(2 ** n) if covers(c, m))]
    primes = [c for c in imps if not any(d != c and all(x in ("-", y) for y, x in zip(c, d)) for d in imps)]
    for k in range(1, len(primes) + 1):
        found = [list(cb) for cb in itertools.combinations(primes, k) if minterms(cb, n) == ones]
        if found:
            size = min(sum(ch != "-" for c in cb for ch in c) for cb in found)
            return [sorted(cb) for cb in found if sum(ch != "-" for c in cb for ch in c) == size]
    return []


def order(cubes: list[str]) -> list[str]:
    """Terms as they are written: the shortest first, then by their letters."""
    return sorted(cubes, key=lambda c: (sum(ch != "-" for ch in c), [i for i, ch in enumerate(c) if ch != "-"],
                                        [ch for ch in c if ch != "-"]))


def sop(cubes: list[str], names: list[str]) -> str:
    terms = [".".join(v + ("" if b == "1" else BAR) for v, b in zip(names, c) if b != "-") for c in cubes]
    return "X = " + " + ".join(terms)


def tex(cubes: list[str], names: list[str], per_line: int) -> list[str]:
    """The expression as printed, NOT as a bar, in lines of a few terms each, a line ending "+" when more follow."""
    terms = [".".join(rf"\mathrm{{{v}}}" if b == "1" else rf"\overline{{\mathrm{{{v}}}}}" for v, b in zip(names, c) if b != "-")
             for c in cubes]
    chunks = [terms[i:i + per_line] for i in range(0, len(terms), per_line)]
    lines = []
    for i, chunk in enumerate(chunks):
        body = " + ".join(chunk) + (r" \;+" if i < len(chunks) - 1 else "")
        lines.append("$" + (r"\mathrm{X} = " if i == 0 else r"\quad\quad ") + body + "$")
    return lines


def _edit(cubes: list[str], at: tuple[int, int], how: str) -> list[str]:
    out = list(cubes)
    t, v = at
    ch = out[t][v]
    new = "-" if how == "drop" else ("0" if ch == "1" else "1")
    out[t] = out[t][:v] + new + out[t][v + 1:]
    return out


def slips(key: list[str], n: int, ones: set[int], rng: random.Random):
    """Two slips and both together: each a literal of the wrong sense or a group too big (a literal dropped)."""
    spots = [(t, v) for t, c in enumerate(key) for v, ch in enumerate(c) if ch != "-"]
    for _ in range(40):
        a, b = rng.sample(spots, 2)
        ha, hb = rng.choice(["flip", "drop"]), rng.choice(["flip", "flip", "drop"])
        e1, e2 = _edit(key, a, ha), _edit(key, b, hb)
        e12 = _edit(e1, b, hb)
        opts = [e1, e2, e12]
        if any(all(ch == "-" for ch in c) for o in opts for c in o):
            continue  # a term with no letters left
        if any(len(set(o)) < len(o) for o in opts):
            continue  # a term written twice
        if any(minterms(o, n) == ones for o in opts):
            continue  # each wrong option is another function
        if len({tuple(o) for o in opts + [key]}) < 4:
            continue
        return opts
    return None


def sample(rng: random.Random) -> dict:
    n = rng.choice([3, 4])
    shows = rng.choice(["table", "expression"])
    names = ["A", "B", "C", "D"][:n]
    while True:
        k = rng.randint(2, 3)
        cubes = []
        for _ in range(k):
            lits = rng.randint(1, 2) if n == 3 else rng.choice([1, 2, 2, 3])
            keep = rng.sample(range(n), lits)
            cubes.append("".join(rng.choice("01") if i in keep else "-" for i in range(n)))
        ones = minterms(cubes, n)
        if not 2 <= len(ones) <= 2 ** n - 2:
            continue
        best = simplest(ones, n)
        if len(best) != 1 or len(best[0]) < 2:
            continue
        key = order(best[0])
        alts = slips(key, n, ones, rng)
        if not alts:
            continue
        expr = []
        if shows == "expression":
            # a sum of products for X that is not the simplest: some terms split on a letter they leave out
            for c in key:
                free = [i for i, ch in enumerate(c) if ch == "-"]
                if free and rng.random() < 0.7:
                    i = rng.choice(free)
                    expr += [c[:i] + "0" + c[i + 1:], c[:i] + "1" + c[i + 1:]]
                else:
                    expr.append(c)
            if sorted(expr) == sorted(key) or len(expr) > 5:
                continue
            rng.shuffle(expr)
        rows = 2 ** (n - 2)
        cells = [(r, c) for r in range(rows) for c in range(4)]
        count = rng.choice([2, 3]) if shows == "table" else rng.choice([3, 4])
        picked = rng.sample(cells, count)
        letters = ["P", "Q", "R", "S"][:count]
        marked = [[r, c, L] for (r, c), L in zip(picked, letters)]
        # the cell asked sits in a Gray-coded column or row where binary order would mislead, mostly
        swapped = [m for m in marked if m[1] >= 2 or (n == 4 and m[0] >= 2)]
        ask = rng.choice(swapped if swapped and rng.random() < 0.75 else marked)[2]
        return {"band": "AL", "vars": names, "ones": sorted(ones), "shows": shows, "expr": expr, "cells": marked, "ask": ask,
                "key": key, "alts": alts}


# --- drawing ---------------------------------------------------------------------------------------

def _value(p: dict, r: int, c: int) -> int:
    n = len(p["vars"])
    return int(int(GRAY[n - 2][r] + GRAY[2][c], 2) in set(p["ones"]))


def draw(p: dict):
    names, n = p["vars"], len(p["vars"])
    ones = set(p["ones"])
    rows = 2 ** (n - 2)
    marked = {(r, c): L for r, c, L in p["cells"]}
    table = p["shows"] == "table"
    fig, ax = new_figure(9.4 if table else 7.0, 6.6 if (table and n == 4) else 5.0)
    cw, ch = 1.0, 0.75
    # the K-map: its top-left cell at (kx, ky)
    if table:
        tw, th = 0.62, (0.36 if n == 4 else 0.5)
        heads = names + ["X"]
        ttop = th * (2 ** n + 1)
        for j, h in enumerate(heads):
            ax.add_patch(Rectangle((j * tw, ttop - th), tw, th, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
            ax.text(j * tw + tw / 2, ttop - th / 2, h, ha="center", va="center", fontsize=10, fontweight="bold")
        for i in range(2 ** n):
            y = ttop - (i + 2) * th
            bits = format(i, f"0{n}b")
            for j, v in enumerate(list(bits) + [str(int(i in ones))]):
                last = j == n
                ax.add_patch(Rectangle((j * tw, y), tw, th, facecolor="#f2f3f4" if last else "white", edgecolor=INK, linewidth=1.0))
                ax.text(j * tw + tw / 2, y + th / 2, v, ha="center", va="center", fontsize=9.5 if n == 4 else 10.5,
                        fontweight="bold" if last else "normal", gid=f"tt:{i}" if last else None)
        kx = (n + 1) * tw + 2.3
        ky = ttop - 1.4
        bottom = 0.0
    else:
        kx, ky = 1.6, 0.0 + ch * rows
        lines = tex(p["expr"], names, 2 if n == 4 else 3)
        base = ky + ch + 0.88  # the last line, just above the map's title
        for i, line in enumerate(lines):
            ax.text(kx - cw - 0.1, base + 0.62 * (len(lines) - 1 - i), line, ha="left", va="center", fontsize=12.5,
                    gid="expr" if i == 0 else f"expr{i + 1}")
        top = base + 0.62 * (len(lines) - 1) + 0.32
        bottom = 0.0
    # the corner: column letters above the diagonal, row letters below
    ax.plot([kx - cw, kx], [ky + ch, ky], color=INK, linewidth=1.0)
    ax.text(kx - 0.27, ky + ch - 0.2, "".join(names[n - 2:]), ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(kx - cw + 0.3, ky + 0.2, "".join(names[:n - 2]), ha="center", va="center", fontsize=10, fontweight="bold")
    for c, g in enumerate(GRAY[2]):
        ax.add_patch(Rectangle((kx + c * cw, ky), cw, ch, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
        ax.text(kx + c * cw + cw / 2, ky + ch / 2, g, ha="center", va="center", fontsize=10.5, fontweight="bold", gid=f"col:{c}")
    ax.add_patch(Rectangle((kx - cw, ky), cw, ch, facecolor="none", edgecolor=INK, linewidth=1.0))
    for r, g in enumerate(GRAY[n - 2]):
        y = ky - (r + 1) * ch
        ax.add_patch(Rectangle((kx - cw, y), cw, ch, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
        ax.text(kx - cw / 2, y + ch / 2, g, ha="center", va="center", fontsize=10.5, fontweight="bold", gid=f"row:{r}")
        for c in range(4):
            ax.add_patch(Rectangle((kx + c * cw, y), cw, ch, facecolor="white", edgecolor=INK, linewidth=1.2))
            if (r, c) in marked:
                ax.text(kx + c * cw + cw / 2, y + ch / 2, marked[(r, c)], ha="center", va="center", fontsize=13,
                        fontweight="bold", style="italic", gid=f"cell:{r}:{c}")
            elif not table:
                ax.text(kx + c * cw + cw / 2, y + ch / 2, str(_value(p, r, c)), ha="center", va="center", fontsize=12,
                        gid=f"cell:{r}:{c}")
    ax.text(kx + 2 * cw - 0.5, ky + ch + 0.4, "K-map for X", ha="center", va="center", fontsize=10.5, fontweight="bold")
    kbottom = ky - rows * ch
    ax.set_xlim(-0.1 if table else kx - cw - 0.3, kx + 4 * cw + 0.2)
    ax.set_ylim(min(bottom, kbottom) - 0.15, (ttop + 0.1) if table else top)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions -------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "before a mock exam"]
FILLS = {"table": ["fills in this K-map from the truth table", "copies the truth table into this K-map",
                   "maps the truth table onto this K-map"],
         "expression": ["completes this K-map for the expression", "plots the expression on this K-map",
                        "finishes this K-map from the expression"]}


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    names = p["vars"]
    r, c = next((r, c) for r, c, L in p["cells"] if L == p["ask"])
    v = _value(p, r, c)
    total = len(p["ones"])
    return [short(f"{who} {rng.choice(FILLS[p['shows']])} {rng.choice(SETTINGS)}. What value goes in the cell marked {p['ask']}?",
                  v, [str(v)]),
            short(f"{friend} fills every cell. When the K-map is complete, how many of its cells hold 1?", total,
                  [str(total), f"{total} cells"]),
            mcq("Which expression is the simplest sum of products for X (fewest terms, then fewest literals)?",
                sop(p["key"], names), [sop(a, names) for a in p["alts"]], rng)]
