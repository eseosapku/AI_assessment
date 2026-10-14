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
        # P3h review: a solid box among element, compound and mixture boxes read as no solid at all, and a packed
        # lattice cannot show molecules. Every box is spread out, and no question asks about a state.
        assert all(b["state"] == "gas" for b in p["boxes"]) and not any("solid" in q.stem for q in qs)
        for q in qs:
            if q.kind != "mcq":
                continue
            for word, kind in (("a pure compound", "compound"), ("a mixture", "mixture"),
                               ("a pure element made of single atoms", "atoms"), ("a pure element made of molecules", "molecules")):
                if f"shows {word}" in q.stem:
                    assert kinds[picked(q)] == kind, (s, q.stem)
        count = next(q for q in qs if q.stem.startswith("How many separate"))
        letter = re.search(r"box ([A-D])", count.stem).group(1)
        box = next(b for b in p["boxes"] if b["letter"] == letter)
        assert int(count.answer) == len(box["particles"])  # particles: atoms or molecules, as drawn
        assert ("each molecule as one" in count.stem) == any(len(x) > 1 for x in box["particles"])
        sorts = next((q for q in qs if "kinds of atom" in q.stem), None)
        if sorts:
            letter = re.search(r"box ([A-D])", sorts.stem).group(1)
            box = next(b for b in p["boxes"] if b["letter"] == letter)
            assert int(sorts.answer) == len({a for x in box["particles"] for a in x})  # the shades drawn there


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
        g = next((q for q in qs if "which group" in q.stem.lower()), None)
        assert (g is None) == (z == 1)  # hydrogen's group is disputed (P3g final review)
        if g:
            assert int(g.answer) == group and (group < 3 or f"group {group + 10}" in g.accepted)
            assert ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][group - 1] in g.accepted
        per = next(q for q in qs if "In which period" in q.stem)
        assert int(per.answer) == len(shells)
        ion = next((q for q in qs if "charge on the ion" in q.stem), None)
        if ion:
            assert z not in (1, 5)  # boron forms no simple ion
            charge = {1: 1, 2: 2, 3: 3, 5: -3, 6: -2, 7: -1}[group]  # metals lose, non-metals gain, to a full shell
            assert ion.answer == f"{abs(charge)}{'+' if charge > 0 else '-'}"


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
        assert not any("Which describes the bond" in q.stem for q in qs)  # single was the key 74% of the time
        for q in qs:
            got = re.search(r"in the bond between the (\w+) atom and (?:one of )?the (\w+) atoms?", q.stem)
            if got:  # one named bond, in a molecule with a multiple bond: never a total, never a repeat of the first question
                names = {"hydrogen": "H", "chlorine": "Cl", "fluorine": "F", "oxygen": "O", "nitrogen": "N", "carbon": "C"}
                orders = {o for i, j, o in bonds if {atoms[i], atoms[j]} == {names[got.group(1)], names[got.group(2)]}}
                assert orders == {int(q.answer)} and len(bonds) > 1 and max(o for *_, o in bonds) > 1
            assert "shared between the" not in q.stem  # P3h review: "between the carbon and hydrogen atoms" read as a total


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


# --- Task 7: graphs -------------------------------------------------------------------------------

def test_rate_graph():
    m = fam("rate_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        main = p["runs"][0]
        T, vmax, xs, ys = main["T"], p["vmax"], p["xstep"], p["ystep"]
        assert T % xs == 0 and (T // 2) % xs == 0 and vmax % ys == 0  # the corner and the half-way point on gridlines

        def v(t, run=main):  # vmax(2.5u - 2.5u^2 + u^3): three-quarters at half-time, still rising at T
            u = Fraction(t, run["T"])
            return vmax * (Fraction(5, 2) * u - Fraction(5, 2) * u ** 2 + u ** 3) if t < run["T"] else Fraction(vmax)

        for q in qs:
            if "total volume" in q.stem:
                assert num(q.answer) == vmax
            got = re.search(r"after (\d+) s", q.stem)
            if got:
                t = int(got.group(1))
                assert v(t) % ys == 0 and num(q.answer) == v(t)  # read off a gridline
            got = re.search(r"mean rate .*first (\d+) s", q.stem)
            if got:
                t = int(got.group(1))
                assert num(q.answer) == v(t) / t
            if "stopped" in q.stem:
                assert num(q.answer) == T
            if q.kind == "mcq" and "faster" in q.stem:
                fast = min(p["runs"], key=lambda r: r["T"])
                assert picked(q) == f"experiment {fast['label']}"


SOLUBILITY = {  # g per 100 g of water at 0, 20, 40, 60, 80 and 100 °C
    "potassium nitrate": (13, 32, 64, 110, 169, 246), "potassium chloride": (28, 34, 40, 45.5, 51, 56),
    "ammonium chloride": (29.4, 37.2, 45.8, 55.2, 65.6, 77.3), "copper(II) sulfate": (14.3, 20.7, 28.5, 40, 55, 75.4),
    "sodium chloride": (35.7, 36.0, 36.6, 37.3, 38.4, 39.8),
}


def test_solubility_curve():
    m = fam("solubility_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        step = p["ystep"]
        for q in qs:
            got = re.search(r"solubility of (.+?) at (\d+) °C", q.stem)
            if got:
                salt, t = got.group(1), int(got.group(2))
                v = num(q.answer)
                assert v % step == 0 and v == Fraction(str(m.reading(salt, t)))  # on a gridline, where the curve is drawn
                assert abs(v - Fraction(str(SOLUBILITY[salt][t // 20]))) <= Fraction(step, 2)  # the real value, rounded
            got = re.search(r"of (.+?) in 100 g of water is cooled from (\d+) °C to (\d+) °C", q.stem)
            if got:
                salt, t1, t2 = got.group(1), int(got.group(2)), int(got.group(3))
                assert num(q.answer) == Fraction(str(m.reading(salt, t1))) - Fraction(str(m.reading(salt, t2))) > 0
            got = re.search(r"most soluble at (\d+) °C", q.stem)
            if got:
                k = int(got.group(1)) // 20
                best = picked(q)
                assert all(SOLUBILITY[best][k] >= SOLUBILITY[o][k] + 3 for o in q.options if o != best)


def test_ph_curve():
    m = fam("ph_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        veq = p["veq"]
        assert veq % 5 == 0 and Fraction(str(p["Ca"])) * p["Va"] == Fraction(str(p["Cb"])) * veq  # moles of acid = moles of alkali
        assert m.ph(p, veq + 0.5) - m.ph(p, veq - 0.5) >= 3  # the jump is at the equivalence volume
        for q in qs:
            if "equivalence" in q.stem and q.kind == "short" and "volume" in q.stem:
                assert num(q.answer) == veq
            if "starting pH" in q.stem or "pH at the start" in q.stem:
                assert abs(float(q.answer) - m.ph(p, 0)) <= 0.1
            if q.kind == "mcq" and "strong or weak" in q.stem:
                assert picked(q).startswith("strong" if p["kind"].startswith("strong") else "weak")
            if q.kind == "mcq" and "indicator" in q.stem:
                lo, hi = (float(x) for x in re.search(r"pH ([\d.]+)–([\d.]+)", picked(q)).groups())
                assert m.ph(p, veq * 0.99) <= lo and hi <= m.ph(p, veq * 1.01)  # changes colour inside the jump
                for o in q.options:
                    if o != picked(q):
                        a, b = (float(x) for x in re.search(r"pH ([\d.]+)–([\d.]+)", o).groups())
                        assert b < m.ph(p, veq * 0.99) or a > m.ph(p, veq * 1.01)  # the others change outside it


REAL_AR = {"chlorine": 35.45, "boron": 10.81, "lithium": 6.94, "copper": 63.55, "bromine": 79.90, "magnesium": 24.31,
           "neon": 20.18, "silicon": 28.09, "gallium": 69.72, "silver": 107.87, "rubidium": 85.47, "potassium": 39.10,
           "zinc": 65.38, "sulfur": 32.06}


def test_mass_spectrum():
    m = fam("mass_spectrum")
    for s in SEEDS:
        p, qs = run(m, s)
        peaks = p["peaks"]  # [(mass number, % abundance)]
        assert sum(a for _, a in peaks) == 100
        ar = Fraction(sum(mz * a for mz, a in peaks), 100)
        assert abs(ar - Fraction(str(REAL_AR[p["element"]]))) <= Fraction(12, 100)  # real abundances, rounded
        for q in qs:
            if "relative atomic mass" in q.stem:
                assert num(q.answer) == ar
            if "How many isotopes" in q.stem:
                assert int(q.answer) == len(peaks)
            if "most abundant" in q.stem:
                assert int(q.answer) == max(peaks, key=lambda x: x[1])[0]
            if q.kind == "mcq" and "Which element" in q.stem:
                assert picked(q) == p["element"]


# --- Task 8: analysis -----------------------------------------------------------------------------

def test_titration():
    m = fam("titration")
    for s in SEEDS:
        p, qs = run(m, s)
        runs = p["runs"]  # [start, end] in hundredths of a cm³
        assert all(r % 5 == 0 for run_ in runs for r in run_)  # read to the nearest 0.05 cm³
        assert all(0 <= a < b <= 5000 for a, b in runs)
        titres = [b - a for a, b in runs]
        close = [i for i in range(3) if any(abs(titres[i] - titres[j]) <= 10 for j in range(3) if j != i)]
        assert len(close) == 2 and all(abs(titres[i] - titres[j]) >= 30 for i in range(3) if i not in close for j in close)
        mean = Fraction(sum(titres[i] for i in close), 2 * 100)
        for v in (x for run_ in runs for x in run_):
            lo, hi = m.window(v)  # each reading drawn in a window of the scale that shows it and a numbered mark
            assert lo <= v <= hi and any(k * 100 in range(lo, hi + 1) for k in range(0, 51))
        for q in qs:
            got = re.search(r"titre in run (\d)", q.stem)
            if got:
                assert num(q.answer) == Fraction(titres[int(got.group(1)) - 1], 100)
            if "mean of the concordant" in q.stem:
                assert num(q.answer) == mean
            got = re.search(r"reading at the end of run (\d)", q.stem)
            if got:
                assert num(q.answer) == Fraction(runs[int(got.group(1)) - 1][1], 100)
            if "How many moles" in q.stem:
                assert Fraction(q.answer) == Fraction(str(p["conc"])) * mean / 1000


def test_chromatogram():
    m = fam("chromatogram")
    for s in SEEDS:
        p, qs = run(m, s)
        front, dyes, mix, unknown = p["front"], p["dyes"], p["mixture"], p["unknown"]
        heights = list(dyes.values()) + ([unknown] if unknown is not None else [])
        assert len(set(heights)) == len(heights) and all(0 < h < front for h in heights)  # each spot its own height
        for q in qs:
            got = re.search(r"Rf value of dye ([A-Z])", q.stem)
            if got:
                assert Fraction(q.answer) == Fraction(dyes[got.group(1)], front)
            if "Which dyes does" in q.stem:
                assert set(re.findall(r"\b[A-Z]\b", q.answer)) == set(mix)
            if "How many different substances" in q.stem:
                assert int(q.answer) == len(mix) + (unknown is not None)
            if q.kind == "mcq" and "travelled furthest" in q.stem:
                assert dyes[picked(q)] == max(dyes.values())


# --- P3g final review ----------------------------------------------------------------------------

def test_particles_drawn_in_a_box_never_overlap():
    m = fam("particle_diagram")
    for s in range(1, 401):
        p = m.sample(random.Random(s))
        atoms = m.atoms_drawn(p)  # [(box, particle, x, y)]
        for i, (b1, k1, x1, y1) in enumerate(atoms):
            for b2, k2, x2, y2 in atoms[i + 1:]:
                if b1 != b2:
                    continue
                d = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5
                packed = p["boxes"][b1]["kind"] == "atoms" and p["boxes"][b1]["state"] == "solid"
                if k1 == k2 or packed:
                    assert d >= 2 * m.R - 1e-9, (s, b1)  # a molecule's atoms, and a solid element's, touch
                else:
                    assert d >= 2 * m.R + 0.02, (s, b1, k1, k2)  # separate particles never overlap


def test_particle_solid_question_asks_about_particles_not_a_substance():
    m = fam("particle_diagram")
    for s in range(1, 200):
        _, qs = run(m, s)
        assert not any("substance in the solid state" in q.stem for q in qs)  # the mixture is no substance


def test_most_soluble_is_clear_on_the_drawn_curves():
    m = fam("solubility_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        for q in qs:
            got = re.search(r"most soluble at (\d+) °C", q.stem)
            if got:
                t = int(got.group(1))
                best = picked(q)
                assert all(m.drawn(p, best, t) >= m.drawn(p, o, t) + p["ystep"] for o in q.options if o != best), (s, t)


def test_no_mass_of_crystals_asked_of_a_hydrated_salt():
    m = fam("solubility_curve")
    for s in SEEDS:
        p, _ = run(m, s)
        assert p["cool"][0] != "copper(II) sulfate"  # its crystals hold water: CuSO4·5H2O


def test_rate_changes_fit_the_reaction():
    m = fam("rate_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        if len(p["runs"]) < 2:
            continue
        what, _ = m.REACTIONS[p["reaction"]]
        change = m.CHANGES[p["reaction"]][p["change"]]
        if "acid" not in what:
            assert "acid" not in change, (what, change)
        if "catalyst" in what:
            assert "catalyst added" not in change, (what, change)
        if "powder" in what:
            assert "powdered" not in change, (what, change)


def test_rate_curve_meets_its_plateau_at_an_angle_you_can_see():
    m = fam("rate_graph")
    for s in SEEDS:
        p = m.sample(random.Random(s))
        for r in p["runs"]:
            T, vmax = r["T"], p["vmax"]
            before = m.volume(p, r, T - p["xstep"])
            assert vmax - before >= 0.2 * p["ystep"], (s, T, before)  # one gridline back it is visibly lower


def test_ph_readings_are_estimates_and_the_kind_mcq_names_no_threshold():
    m = fam("ph_curve")
    for s in range(1, 300):
        p, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq" and "strong or weak" in q.stem:
                assert not any("below 2" in o or "above 2" in o for o in q.options)
            if "pH at the start" in q.stem or "pKa" in q.stem:
                assert "Estimate" in q.stem and q.tolerance >= 0.25
    fig = m.draw(m.sample(random.Random(1)))
    minor = fig.axes[0].get_yticks(minor=True)
    assert any(abs(t - 0.5) < 1e-9 for t in minor)  # half-pH lines to estimate between


def test_typed_forms_of_ions_moles_and_charges_are_accepted():
    e = fam("electrolysis")
    for s in range(1, 200):
        p, qs = run(e, s)
        q = next(q for q in qs if "discharged at the cathode" in q.stem)
        assert any(f.endswith(" ions") for f in q.accepted)
    i = fam("ionic_bonding")
    for s in range(1, 100):
        p, qs = run(i, s)
        q = next(q for q in qs if "charge on the" in q.stem)
        metal = p["ions"][0]
        assert f"{metal['symbol']}{metal['charge']}+" in q.accepted or f"{metal['symbol']}+" in q.accepted
    t = fam("titration")
    for s in range(1, 300):
        p, qs = run(t, s)
        for q in qs:
            if "How many moles" in q.stem:
                assert any("× 10⁻" in f for f in q.accepted)


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


# --- P3h review ----------------------------------------------------------------------------------

def test_burette_readings_carry_the_usual_half_division():
    """A burette reads to ±0.05 cm³: a reviewer reading 21.75 for 21.80 is within it (P3h review)."""
    m = fam("titration")
    for s in range(1, 200):
        _, qs = run(m, s)
        for q in qs:
            if "titre in run" in q.stem or "mean of the concordant" in q.stem or "reading at the end" in q.stem:
                assert q.tolerance == 0.05, q.stem


def test_solubility_accepts_per_100_g_water_both_ways():
    m = fam("solubility_curve")
    for s in range(1, 100):
        _, qs = run(m, s)
        q = next(q for q in qs if "What is the solubility" in q.stem)
        assert f"{q.answer} g per 100 g water" in q.accepted and f"{q.answer} g per 100 g of water" in q.accepted
