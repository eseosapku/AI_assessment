"""Answers of the Chemistry wave (P3g), recomputed from each figure's numbers over 1,000 seeds, with the
chemistry each figure must obey checked on what is drawn (P3g Review Focus 4)."""
import random
import re
from fractions import Fraction

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


def num(text):
    return Fraction(re.match(r"-?[\d.,]+", text).group().replace(",", ""))


# --- Task 5: particles and bonding ---------------------------------------------------------------

def test_particle_diagram():
    m = fam("particle_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        kinds = {b["letter"]: b["kind"] for b in p["boxes"]}
        assert len(set(kinds.values())) == 4  # four different kinds: one right answer to each "which box"
        for q in qs:
            if q.kind != "mcq":
                continue
            for word, kind in (("compound", "compound"), ("mixture", "mixture"), ("element made of single atoms", "atoms"),
                               ("element made of molecules", "molecules")):
                if f"shows {'a ' if word in ('compound', 'mixture') else 'an '}{word}" in q.stem:
                    assert kinds[picked(q)] == kind, (s, q.stem)
            if "solid" in q.stem:
                assert next(b for b in p["boxes"] if b["letter"] == picked(q))["state"] == "solid"
        count = next(q for q in qs if q.stem.startswith("How many"))
        letter = re.search(r"box ([A-D])", count.stem).group(1)
        box = next(b for b in p["boxes"] if b["letter"] == letter)
        assert int(count.answer) == len(box["particles"])  # particles: atoms or molecules, as drawn


SHELLS = (2, 8, 8, 2)


def config(z):
    out, left = [], z
    for cap in SHELLS:
        if left <= 0:
            break
        out.append(min(cap, left))
        left -= out[-1]
    return out


def test_electron_shells():
    m = fam("electron_shells")
    for s in SEEDS:
        p, qs = run(m, s)
        z = p["Z"]
        shells = config(z)
        assert m.shells(p) == shells
        assert qs[0].answer == ",".join(map(str, shells)) and "2.8.1".replace("2.8.1", ".".join(map(str, shells))) in qs[0].accepted
        group = 8 if shells[-1] == 8 or z == 2 else shells[-1]
        assert int(qs[1].answer) == group and int(qs[2].answer) == len(shells)
        if len(qs) > 3:
            charge = {1: 1, 2: 2, 3: 3, 5: -3, 6: -2, 7: -1}[group]  # metals lose, non-metals gain, to a full shell
            assert qs[3].answer == f"{abs(charge)}{'+' if charge > 0 else '-'}"


def test_ionic_bonding():
    m = fam("ionic_bonding")
    for s in SEEDS:
        p, qs = run(m, s)
        ions = p["ions"]  # [{"symbol", "charge", "count", "outer"}]
        assert sum(i["charge"] * i["count"] for i in ions) == 0  # the charges balance
        assert all(i["outer"] in (0, 8) or (i["symbol"] in ("Li",) and i["outer"] == 0) for i in ions)
        assert all((i["outer"] == 8) == (i["charge"] < 0) for i in ions)  # non-metal ions with a full outer shell of 8
        formula = "".join(i["symbol"] + (str(i["count"]) if i["count"] > 1 else "") for i in ions)
        assert qs[0].answer.replace("₂", "2").replace("₃", "3") == formula
        metal = next(i for i in ions if i["charge"] > 0)
        assert qs[1].answer == f"{metal['charge']}+" and int(qs[2].answer) == metal["charge"]


VALENCE = {"H": 1, "C": 4, "N": 5, "O": 6, "F": 7, "Cl": 7}


def test_covalent_bonding():
    m = fam("covalent_bonding")
    for s in SEEDS:
        p, qs = run(m, s)
        atoms, bonds, lone = p["atoms"], p["bonds"], p["lone"]
        for i, a in enumerate(atoms):
            order = sum(o for x, y, o in bonds if i in (x, y))
            assert order + 2 * lone[i] == VALENCE[a]  # every outer electron is drawn, shared or in a lone pair
            assert 2 * order + 2 * lone[i] == (2 if a == "H" else 8)  # and each atom ends with a full outer shell
        assert int(qs[0].answer) == sum(o for _, _, o in bonds)  # shared pairs
        centre = p["centre"]
        assert int(qs[1].answer) == lone[centre]


def test_periodic_table():
    m = fam("periodic_table")
    for s in SEEDS:
        p, qs = run(m, s)
        where = {c["letter"]: (c["period"], c["group"]) for c in p["cells"]}
        for q in qs:
            if q.kind == "mcq" and "noble gas" in q.stem:
                assert where[picked(q)][1] == 8
            if q.kind == "mcq" and "alkali metal" in q.stem:
                assert where[picked(q)][1] == 1 and where[picked(q)][0] >= 2
            g = re.search(r"In which group is element ([A-Z])", q.stem)
            if g:
                assert int(q.answer) == where[g.group(1)][1]
            f = re.search(r"between ([A-Z]) and ([A-Z])", q.stem)
            if f:
                a, b = f.groups()
                ga, gb = where[a][1], where[b][1]
                ca, cb = {1: 1, 2: 2, 3: 3}[ga], {5: 3, 6: 2, 7: 1}[gb]  # metal charge, non-metal charge
                from math import gcd
                k = gcd(ca, cb)
                want = a + (str(cb // k) if cb // k > 1 else "") + b + (str(ca // k) if ca // k > 1 else "")
                assert q.answer.replace("₂", "2").replace("₃", "3") == want, (q.stem, q.answer, want)


# --- Task 6: structures, energy, electrolysis ----------------------------------------------------

def plain(text):
    return text.translate(str.maketrans("₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻−", "01234567890123456789+--"))


STEM = ["meth", "eth", "prop", "but", "pent"]
VALENCY = {"C": 4, "H": 1, "O": 2}


def test_organic_structure():
    m = fam("organic_structure")
    for s in SEEDS:
        p, qs = run(m, s)
        n, series, pos = p["n"], p["series"], p["position"]
        atoms, bonds = m.structure(p)  # what is drawn: [(symbol, x, y)], [(i, j, order)]
        for i, (sym, _, _) in enumerate(atoms):  # every atom drawn with its full number of bonds
            assert sum(o for a, b, o in bonds if i in (a, b)) == VALENCY[sym], (s, p, i, sym)
        counts = {e: sum(1 for a in atoms if a[0] == e) for e in "CHO"}
        h = {"alkane": 2 * n + 2, "alkene": 2 * n, "alcohol": 2 * n + 2, "acid": 2 * n}[series]
        o = {"alkane": 0, "alkene": 0, "alcohol": 1, "acid": 2}[series]
        assert counts == {"C": n, "H": h, "O": o}, (s, p, counts)
        formula = "C" + (str(n) if n > 1 else "") + f"H{h}" + {0: "", 1: "O", 2: "O2"}[o]
        assert plain(next(q for q in qs if "molecular formula" in q.stem).answer) == formula
        assert int(next(q for q in qs if "hydrogen atoms" in q.stem).answer) == h
        series_q = next(q for q in qs if q.kind == "mcq" and "homologous series" in q.stem)
        assert picked(series_q) == {"alkane": "alkanes", "alkene": "alkenes", "alcohol": "alcohols", "acid": "carboxylic acids"}[series]
        name = next(q for q in qs if "name of" in q.stem).answer
        assert name.startswith(STEM[n - 1])
        want = {"alkane": "ane", "alkene": "ene", "alcohol": "ol", "acid": "anoic acid"}[series]
        assert name.endswith(want), (name, series)
        if series in ("alkene", "alcohol") and n >= {"alkene": 4, "alcohol": 3}[series]:
            assert f"-{pos}-" in name or name.endswith(f"-{pos}-ol"), name  # where the group is, when it can be in two places


def test_energy_profile():
    m = fam("energy_profile")
    for s in SEEDS:
        p, qs = run(m, s)
        r, pr, peak, cat, step = p["reactants"], p["products"], p["peak"], p["catalysed"], p["step"]
        assert all(v % step == 0 for v in (r, pr, peak, cat))  # every level on a gridline
        assert max(r, pr) < cat < peak <= p["top"]
        for q in qs:
            v = None if q.kind == "mcq" else Fraction(plain(q.answer))
            if "enthalpy change" in q.stem:
                assert v == pr - r
            elif "reverse" in q.stem:
                assert v == peak - pr
            elif "with the catalyst" in q.stem:  # not "without the catalyst"
                assert v == cat - r
            elif "activation energy" in q.stem:
                assert v == peak - r
            elif q.kind == "mcq":
                assert picked(q).startswith("exothermic" if pr < r else "endothermic")
                assert ("less energy" in picked(q)) == (pr < r)


ELECTROLYSIS = {  # electrolyte: product at the cathode, at the anode, the ion discharged at the cathode
    "molten lead(II) bromide": ("lead", "bromine", "Pb2+"),
    "molten sodium chloride": ("sodium", "chlorine", "Na+"),
    "molten zinc chloride": ("zinc", "chlorine", "Zn2+"),
    "concentrated sodium chloride solution": ("hydrogen", "chlorine", "H+"),
    "copper(II) sulfate solution, carbon electrodes": ("copper", "oxygen", "Cu2+"),
    "copper(II) sulfate solution, copper electrodes": ("copper", None, "Cu2+"),
    "copper(II) chloride solution": ("copper", "chlorine", "Cu2+"),
    "dilute sulfuric acid": ("hydrogen", "oxygen", "H+"),
}


def test_electrolysis():
    m = fam("electrolysis")
    for s in SEEDS:
        p, qs = run(m, s)
        left, right = p["letters"]
        anode = left if p["plus"] == "left" else right  # the electrode joined to the battery's + side
        cathode = right if anode == left else left
        at_cathode, at_anode, ion = ELECTROLYSIS[p["electrolyte"]]
        assert m.wired_to_plus(p) == anode
        for q in qs:
            if "is the cathode" in q.stem:
                assert q.answer == cathode
            got = re.search(r"product at electrode ([A-Z])", q.stem)
            if got:
                assert q.answer == (at_cathode if got.group(1) == cathode else at_anode), (s, q.stem, q.answer)
            if "What happens to electrode" in q.stem:
                assert re.search(r"electrode ([A-Z])", q.stem).group(1) == anode and "dissolves" in picked(q)
            if "discharged at the cathode" in q.stem:
                assert plain(q.answer) == ion


CHEMISTRY = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "chemistry")


def _central(options):
    from collections import Counter
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", CHEMISTRY)
def test_a_chemistry_mcq_cannot_be_picked_from_its_options_alone(fid):
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
