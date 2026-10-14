"""Shared by the logic families (not a family itself): Boolean expression trees, their values and their wording.

A tree is "A", "B" or "C", or {"op": gate, "in": [children]} with one child for NOT and two for the rest.
"""
from __future__ import annotations

import copy
import itertools
import random

TWO = ["AND", "OR", "XOR", "NAND", "NOR"]
SWAP = {"AND": "OR", "OR": "AND", "NAND": "NOR", "NOR": "NAND", "XOR": "AND"}  # the other choice an option offers


def ev(node, env: dict) -> int:
    if isinstance(node, str):
        return env[node]
    if node["op"] == "NOT":
        return 1 - ev(node["in"][0], env)
    a, b = (ev(x, env) for x in node["in"])
    return {"AND": a & b, "OR": a | b, "XOR": a ^ b, "NAND": 1 - (a & b), "NOR": 1 - (a | b)}[node["op"]]


def text(node, top: bool = True) -> str:
    """Written out: NOT binds tightest; every two-input gate below the top is bracketed."""
    if isinstance(node, str):
        return node
    if node["op"] == "NOT":  # bracketed inside another gate: "(NOT (A AND B)) NOR C", never read as NOT of the rest
        inner = f"NOT {text(node['in'][0], False)}"
        return inner if top else f"({inner})"
    s = f"{text(node['in'][0], False)} {node['op']} {text(node['in'][1], False)}"
    return s if top else f"({s})"


def inputs(node) -> list[str]:
    if isinstance(node, str):
        return [node]
    return sorted(set(x for c in node["in"] for x in inputs(c)))


def table(node, names: list[str]) -> list[int]:
    return [ev(node, dict(zip(names, bits))) for bits in itertools.product((0, 1), repeat=len(names))]


def gates(node) -> list[dict]:
    """The two-input gates, outermost first: the slots an option may change."""
    if isinstance(node, str):
        return []
    here = [node] if node["op"] != "NOT" else []
    return here + [g for c in node["in"] for g in gates(c)]


def G(op, *xs):
    return {"op": op, "in": list(xs)}


TEMPLATES = [
    lambda g: G(g[0], G(g[1], "A", "B"), "C"),
    lambda g: G(g[0], G("NOT", G(g[1], "A", "B")), "C"),
    lambda g: G(g[0], G(g[1], "A", "B"), G(g[2], "B", "C")),
    lambda g: G(g[0], G(g[1], "A", G("NOT", "B")), "C"),
    lambda g: G(g[0], G(g[1], "A", "B"), G("NOT", "A")),
    lambda g: G(g[0], G("NOT", "A"), G(g[1], "A", "B")),
]


def alternatives(tree, rng: random.Random):
    """Four expressions, the tree among them: two of its gates each kept or swapped. Each keeps the others' words, so
    no option stands out; None when two of them compute the same thing."""
    slots = gates(tree)
    if len(slots) < 2:
        return None
    i, j = rng.sample(range(len(slots)), 2)
    out = []
    for si, sj in itertools.product((False, True), repeat=2):
        t = copy.deepcopy(tree)
        gs = gates(t)
        if si:
            gs[i]["op"] = SWAP[gs[i]["op"]]
        if sj:
            gs[j]["op"] = SWAP[gs[j]["op"]]
        out.append(t)
    names = inputs(tree)
    if len({tuple(table(t, names)) for t in out}) < 4:
        return None
    return out


def sample_tree(rng: random.Random):
    while True:
        t = rng.choice(TEMPLATES)([rng.choice(TWO) for _ in range(3)])
        alts = alternatives(t, rng)
        if alts:
            return t, alts
