"""Pedigrees (UP, AL): a family tree of three generations with an inherited condition caused by a recessive
allele (albinism, cystic fibrosis, a form of deafness). Squares are males and circles females; affected people
are shaded; everyone is numbered. Whether the allele is dominant or recessive, the genotype of a numbered
person, and the chance that a couple's next child is affected.

The family is drawn from real inheritance (alleles passed at random), kept only when the chart proves the
allele recessive (two unaffected parents with an affected child). A genotype is asked only where the chart
decides it, and a chance only for a couple whose genotypes it decides.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "pedigree"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("monohybrid-inheritance", "inheritance-concepts", "genes-mutations"))
AVOID = r"plant|photosynth|ecolog|population|enzyme|immun|digest|respiration|transport|cell structure|technology|nucleic|mitotic|division|chromosomes|dna|evolution and speciation|reproductive|mutation|selection|protein synthesis"
CONDITIONS = [("albinism", "A"), ("cystic fibrosis", "F"), ("a form of deafness", "D")]
SIZE = 0.5
WHY = [f"{a}: {b}" for a in ("recessive", "dominant")
       for b in ("two unaffected parents have an affected child", "every affected person has an affected parent")]


def possible(people: dict) -> dict:
    """Each person's genotypes (0, 1 or 2 recessive alleles) consistent with the chart and with Mendel."""
    order = sorted(people, key=lambda n: (people[n]["generation"], int(n)))
    out = {n: set() for n in people}

    def gametes(g):
        return {0} if g == 0 else {1} if g == 2 else {0, 1}

    def walk(i, g):
        if i == len(order):
            for n, x in g.items():
                out[n].add(x)
            return
        n = order[i]
        q = people[n]
        mine = [2] if q["affected"] else [0, 1]
        if q["parents"]:
            a, b = (g[str(x)] for x in q["parents"])
            mine = [x for x in mine if x in {u + v for u in gametes(a) for v in gametes(b)}]
        for x in mine:
            g[n] = x
            walk(i + 1, g)
            del g[n]

    walk(0, {})
    return out


def _family(rng: random.Random):
    kids = rng.choice([3, 4])
    # The child who marries stands at one end of the row, the spouse outside it: a spouse inside the row sits under the
    # siblings' line and reads as one of the first couple's children.
    c = rng.choice([0, kids - 1])
    grandkids = rng.choice([2, 3])
    sexes = {"1": "M", "2": "F"}
    gen2 = [rng.choice("MF") for _ in range(kids)]
    spouse_sex = "F" if gen2[c] == "M" else "M"
    order2 = []  # the second row, left to right: siblings, the spouse beside the one who marries
    for i in range(kids):
        if i == c == 0:
            order2.append(("spouse", None))
        order2.append(("child", i))
        if i == c == kids - 1 and c != 0:
            order2.append(("spouse", None))
    people, number = {}, 3
    people["1"] = {"sex": "M", "parents": [], "generation": 1}
    people["2"] = {"sex": "F", "parents": [], "generation": 1}
    child_no, spouse_no = {}, None
    for kind, i in order2:
        n = str(number)
        if kind == "child":
            people[n] = {"sex": gen2[i], "parents": [1, 2], "generation": 2}
            child_no[i] = number
        else:
            people[n] = {"sex": spouse_sex, "parents": [], "generation": 2}
            spouse_no = number
        number += 1
    for _ in range(grandkids):
        people[str(number)] = {"sex": rng.choice("MF"), "parents": sorted([child_no[c], spouse_no]), "generation": 3}
        number += 1
    del sexes
    return people, child_no[c], spouse_no


def sample(rng: random.Random) -> dict:
    condition, allele = rng.choice(CONDITIONS)
    band = rng.choice(BANDS)
    while True:
        people, c, s = _family(rng)
        g = {"1": rng.choice([1, 1, 1, 2]), "2": rng.choice([1, 1, 2]), str(s): rng.choice([0, 1, 1, 2])}
        for n in sorted(people, key=int):
            q = people[n]
            if q["parents"]:
                a, b = (g[str(x)] for x in q["parents"])
                g[n] = (1 if a == 2 else 0 if a == 0 else rng.randint(0, 1)) + (1 if b == 2 else 0 if b == 0 else rng.randint(0, 1))
        for n, q in people.items():
            q["affected"] = g[n] == 2
        couples = [(1, 2), tuple(sorted((c, s)))]
        proof = any(not people[str(a)]["affected"] and not people[str(b)]["affected"] and
                    any(sorted(q["parents"]) == [a, b] and q["affected"] for q in people.values()) for a, b in couples)
        if not proof:
            continue
        pos = possible(people)
        forced = [int(n) for n in people if len(pos[n]) == 1]
        decided = [cp for cp in couples if all(len(pos[str(x)]) == 1 for x in cp)]
        carriers = [n for n in forced if not people[str(n)]["affected"]]
        if not decided or not forced:
            continue
        target = rng.choice(carriers) if carriers and rng.random() < 0.75 else rng.choice(forced)
        return {"band": band, "condition": condition, "allele": allele, "people": people, "target": target,
                "couple": list(rng.choice(decided))}


def _places(p: dict) -> dict:
    rows = {}
    for n in sorted(p["people"], key=int):
        rows.setdefault(p["people"][n]["generation"], []).append(n)
    at = {}
    at["1"], at["2"] = (-0.7, 3.2), (0.7, 3.2)
    row2 = rows[2]
    for i, n in enumerate(row2):
        at[n] = ((i - (len(row2) - 1) / 2) * 1.5, 1.6)
    parents = p["people"][rows[3][0]]["parents"]
    mid = sum(at[str(x)][0] for x in parents) / 2
    for i, n in enumerate(rows[3]):
        at[n] = (mid + (i - (len(rows[3]) - 1) / 2) * 1.4, 0.0)
    return at


def draw(p: dict):
    at = _places(p)
    xs = [x for x, _ in at.values()]
    fig, ax = new_figure(0.75 * (max(xs) - min(xs) + 6.0), 3.9)
    for a, b in [(1, 2), tuple(p["people"][next(n for n in p["people"] if p["people"][n]["generation"] == 3)]["parents"])]:
        (xa, ya), (xb, yb) = at[str(a)], at[str(b)]
        ax.plot([xa + SIZE / 2, xb - SIZE / 2], [ya, yb], color=INK, linewidth=1.3)  # the couple
        kids = [n for n, q in p["people"].items() if sorted(q["parents"]) == sorted([a, b])]
        mid = (xa + xb) / 2
        drop = ya - 0.75
        ax.plot([mid, mid], [ya, drop], color=INK, linewidth=1.3)
        kx = [at[n][0] for n in kids]
        ax.plot([min(kx + [mid]), max(kx + [mid])], [drop, drop], color=INK, linewidth=1.3)
        for x in kx:
            ax.plot([x, x], [drop, at[kids[0]][1] + SIZE / 2], color=INK, linewidth=1.3)
    for n, q in p["people"].items():
        x, y = at[n]
        fill = INK if q["affected"] else "white"
        if q["sex"] == "M":
            ax.add_patch(Rectangle((x - SIZE / 2, y - SIZE / 2), SIZE, SIZE, facecolor=fill, edgecolor=INK, linewidth=1.4, zorder=3))
        else:
            ax.add_patch(Circle((x, y), SIZE / 2, facecolor=fill, edgecolor=INK, linewidth=1.4, zorder=3))
        ax.text(x, y - SIZE / 2 - 0.12, n, ha="center", va="top", fontsize=10)
    left = min(xs) - 1.0
    for g, y in ((1, 3.2), (2, 1.6), (3, 0.0)):
        ax.text(left, y, ["I", "II", "III"][g - 1], ha="center", va="center", fontsize=12, fontweight="bold")
    kx, ky = max(xs) + 1.2, 3.3
    for i, (sex, aff, words) in enumerate([("M", False, "unaffected male"), ("F", False, "unaffected female"),
                                           ("M", True, "affected male"), ("F", True, "affected female")]):
        y = ky - i * 0.6
        fill = INK if aff else "white"
        if sex == "M":
            ax.add_patch(Rectangle((kx - 0.15, y - 0.15), 0.3, 0.3, facecolor=fill, edgecolor=INK, linewidth=1.2))
        else:
            ax.add_patch(Circle((kx, y), 0.15, facecolor=fill, edgecolor=INK, linewidth=1.2))
        ax.text(kx + 0.3, y, words, ha="left", va="center", fontsize=9)
    ax.set_xlim(left - 0.4, kx + 2.6)
    ax.set_ylim(-0.7, 3.7)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a biology lesson", "for a genetics project", "for homework", "at the science club", "from a hospital leaflet"]


def _chance(pct: Fraction) -> list[str]:
    n = str(pct.numerator // pct.denominator) if pct.denominator == 1 else str(float(pct))
    frac = {Fraction(25): ["1/4", "0.25", "1 in 4"], Fraction(50): ["1/2", "0.5", "1 in 2"], Fraction(100): ["1", "100%"],
            Fraction(0): ["0", "0%", "none"]}.get(pct, [])
    return [f"{n}%", n, f"{n} %"] + frac


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    cond, big = p["condition"], p["allele"]
    small = big.lower()
    pos = possible(p["people"])
    names = {0: big + big, 1: big + small, 2: small + small}
    t = p["target"]
    key = names[next(iter(pos[str(t)]))]
    a, b = p["couple"]
    ga, gb = next(iter(pos[str(a)])), next(iter(pos[str(b)]))
    pct = Fraction(ga, 2) * Fraction(gb, 2) * 100
    return [mcq(f"{who} drew this family tree of {cond} {rng.choice(SETTINGS)}. Is {cond} caused by a dominant or a recessive allele?",
                WHY[0], WHY[1:], rng),
            mcq(f"{big} is the dominant allele and {small} the recessive allele. What is the genotype of person {t}?", key,
                [x for x in names.values() if x != key], rng),
            short(f"If persons {a} and {b} have another child, what is the chance that it has {cond}?", _chance(pct)[0], _chance(pct))]
