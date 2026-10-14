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
        assert blanks and len(blanks) < len(table)
        for q in qs:
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
