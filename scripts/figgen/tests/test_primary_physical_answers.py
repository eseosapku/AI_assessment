"""Answers of the Primary physical-science families (P3s, Task 1), recomputed from each figure's params over
1,000 seeds.

Nothing here calls a family's own helpers to work out a key. A circuit lights when the drawing's wires join
both ends of its cell through every bulb, read off the lines the figure draws; a pair of magnets attracts when
the facing poles differ; what a magnet picks up comes from this file's own table; a shadow's length comes from a
straight ray past the top of the object; a seesaw turns by mass x mark number; and the overall force is the
difference of the arrows, read off the arrows drawn.
"""
import math
import random
import re

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 250  # the figure itself is built and read for the first seeds
PHYSICAL = ("simple_circuit_p", "magnets_p", "shadows_p", "seesaw_p", "force_arrows_p")


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


def letters(option: str) -> frozenset:
    """The capital letters an option names: "A, B and D", "C only", "Circuit A", "Object E"."""
    return frozenset(re.findall(r"\b([A-F])\b", option))


def words_of(fig) -> list[str]:
    return [t.get_text() for ax in fig.axes for t in ax.texts if t.get_text().strip()]


def own_wordings(m) -> int:
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


def by(qs, pattern):
    found = [q for q in qs if re.search(pattern, q.stem)]
    return found[0] if found else None


@pytest.mark.parametrize("fid", PHYSICAL)
def test_family_is_primary_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "science" and m.BANDS == ("P",)
    assert m.CONCEPTS and all(c.startswith("science.") for c in m.CONCEPTS)
    assert m.NEEDS
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 200):
        p, qs = run(m, seed)
        assert p["band"] == "P" and p["level"] in ("lower", "upper"), (fid, seed)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            # Short sentences in plain English, for an 8-year-old.
            for sentence in re.split(r"(?<=[.?!])\s+", q.stem):
                assert len(sentence.split()) <= 22, (fid, seed, sentence)
            assert "moment" not in q.stem.lower(), (fid, seed, q.stem)
            if q.kind == "mcq":
                assert 3 <= len(q.options) <= 4, (fid, seed, q.options)


def test_concepts_exist():
    import sqlite3
    from pathlib import Path
    store = Path("C:/Users/Stephen/figure-library/figures.db")
    if not store.exists():
        pytest.skip("no figure library here")
    db = sqlite3.connect(f"file:{store}?mode=ro", uri=True)
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    for fid in PHYSICAL:
        m = fam(fid)
        assert set(m.CONCEPTS) <= known, (fid, sorted(set(m.CONCEPTS) - known))


# --- simple_circuit_p ----------------------------------------------------------------------------------

REASON = {"gap": "There is a gap in the wire.", "open": "The switch is open.",
          "same_end": "Both wires go to the same end of the cell.", "nocell": "There is no cell in the circuit."}
FIX = {"gap": "Join the gap in the wire", "open": "Close the switch", "same_end": "Move one wire to the other end of the cell",
       "nocell": "Add a cell to the circuit"}


def circuit_faults(c) -> list[str]:
    out = []
    if not c["cell"]:
        out.append("nocell")
    elif c["leads"][0] == c["leads"][1]:
        out.append("same_end")
    if c["gap"]:
        out.append("gap")
    if c["switch"] == "open":
        out.append("open")
    return out


def drawn_circuit_lights(ax, letter: str, tol: float = 0.13) -> bool:
    """Reads the drawing: the wires (gid wire-X), the bulbs (bulb-X, terminal to terminal), the switch's lever
    (lever-X) and the cell (cell-X, terminal to terminal). The bulbs light when the cell's two terminals are
    joined by a path through wires, levers and bulbs, and every bulb lies on every such path."""
    def lines(prefix):
        return [ln for ln in ax.lines if (ln.get_gid() or "") == prefix or (ln.get_gid() or "").startswith(prefix + "-")]

    # Every point the parts' ends are drawn at; points closer than tol are one join (taken transitively).
    segs = []
    for kind, prefix in (("w", "wire"), ("w", "lever"), ("b", "bulb"), ("c", "cell")):
        for ln in lines(f"{prefix}-{letter}"):
            xy = [(float(x), float(y)) for x, y in ln.get_xydata()]
            pairs = list(zip(xy, xy[1:])) if kind == "w" else [(xy[0], xy[-1])]
            segs += [(a, b, kind) for a, b in pairs]
    pts = sorted({pt for a, b, _ in segs for pt in (a, b)})
    parent = list(range(len(pts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(pts):
        for j in range(i):
            if math.hypot(a[0] - pts[j][0], a[1] - pts[j][1]) <= tol:
                parent[find(i)] = find(j)
    node = {pt: None for pt in pts}
    for i, pt in enumerate(pts):
        node[pt] = find(i)
    edges = [(node[a], node[b], k) for a, b, k in segs if k == "w"]
    bulbs = [(node[a], node[b], k) for a, b, k in segs if k == "b"]
    cells = [(node[a], node[b]) for a, b, k in segs if k == "c"]
    assert bulbs, letter
    if not cells:
        return False
    plus, minus = cells[0]

    def joined(skip=None):
        adj: dict[int, set] = {}
        for e in edges + bulbs:
            if e is skip:
                continue
            adj.setdefault(e[0], set()).add(e[1])
            adj.setdefault(e[1], set()).add(e[0])
        seen, todo = {plus}, [plus]
        while todo:
            for v in adj.get(todo.pop(), ()):
                if v not in seen:
                    seen.add(v)
                    todo.append(v)
        return minus in seen

    if not joined():
        return False
    assert all(not joined(skip=b) for b in bulbs), f"{letter}: a bulb is bypassed"
    return True


def test_simple_circuit_p():
    m = fam("simple_circuit_p")
    for s in SEEDS:
        p, qs = run(m, s)
        cs = p["circuits"]
        n = len(cs)
        assert n in (3, 4) and [c["letter"] for c in cs] == list("ABCD"[:n]), s
        lit = set()
        faults = {}
        for c in cs:
            f = circuit_faults(c)
            assert len(f) <= 1, (s, c)  # one fault at most, so a reason is never in doubt
            if p["level"] == "lower":
                assert c["bulbs"] == 1 and "nocell" not in f, (s, c)
            else:
                assert c["bulbs"] in (1, 2) and "same_end" not in f, (s, c)
            if f:
                faults[c["letter"]] = f[0]
            else:
                lit.add(c["letter"])
        assert lit and len(lit) < n, (s, lit)
        # Which bulbs light
        q1 = qs[0]
        assert q1.kind == "mcq"
        assert letters(picked(q1)) == lit, (s, q1.stem, picked(q1), lit)
        for o in q1.options:
            if o != picked(q1):
                assert letters(o) != lit, (s, o)
        if len(lit) == 1:
            assert all(len(letters(o)) == 1 for o in q1.options), (s, q1.options)
        # How many bulbs
        cq = next(q for q in qs if q.kind == "short")
        on = sum(c["bulbs"] for c in cs if c["letter"] in lit)
        off = sum(c["bulbs"] for c in cs) - on
        want = off if "not light" in cq.stem else on
        assert cq.answer == str(want), (s, cq.stem, cq.answer, want)
        # Why a circuit fails, or what would fix it
        rq = by(qs, r"^(Why|What would make)")
        assert rq is not None and rq.kind == "mcq", s
        x = re.search(r"circuit ([A-D])\b", rq.stem).group(1)
        assert x in faults, (s, x)
        table = REASON if rq.stem.startswith("Why") else FIX
        assert picked(rq) == table[faults[x]], (s, rq.stem, picked(rq))
        for o in rq.options:
            if o != picked(rq):
                assert o not in (table[faults[x]],), (s, o)
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            try:
                words = words_of(fig)
                for c in cs:
                    assert c["letter"] in words, (s, c["letter"])
                    assert drawn_circuit_lights(ax, c["letter"]) == (c["letter"] in lit), (s, c)
                    # A switch drawn open is a lever lifted well clear of its far contact; a closed one lies flat.
                    lever = [ln for ln in ax.lines if ln.get_gid() == f"lever-{c['letter']}"]
                    assert bool(lever) == (c["switch"] is not None), (s, c)
                    if lever:
                        (x0, y0), (x1, y1) = lever[0].get_xydata()[0], lever[0].get_xydata()[-1]
                        angle = abs(math.degrees(math.atan2(y1 - y0, x1 - x0)))
                        if c["switch"] == "open":
                            assert 25 <= angle <= 60, (s, angle)
                        else:
                            assert angle < 1, (s, angle)
            finally:
                plt.close(fig)


# --- magnets_p -------------------------------------------------------------------------------------------

MAGNETIC = {"iron nail", "paper clip", "steel scissors", "steel spoon", "safety pin"}
NOT_MAGNETIC_METAL = {"copper coin", "aluminium can"}
NOT_METAL = {"plastic spoon", "eraser", "wooden ruler", "glass marble", "wooden pencil"}


def test_magnets_p():
    m = fam("magnets_p")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds.add((p["kind"], p["level"]))
        if p["kind"] == "poles":
            pairs = p["pairs"]
            hidden = p.get("hidden")
            assert all(set(pr["left"]) == {"N", "S"} and set(pr["right"]) == {"N", "S"} for pr in pairs)
            pulls = {pr["letter"]: pr["left"][1] != pr["right"][0] for pr in pairs}
            shown = [pr["letter"] for pr in pairs if pr["letter"] != hidden]
            attract = {k for k in shown if pulls[k]}
            repel = {k for k in shown if not pulls[k]}
            assert attract and repel, s
            q1 = qs[0]
            want = attract if "attract" in q1.stem.split("?")[0].split(".")[-1] else repel
            assert letters(picked(q1)) == want, (s, q1.stem, picked(q1))
            assert all(letters(o) != want for o in q1.options if o != picked(q1)), s
            q2 = by(qs, r"pair [A-D] attract or repel")
            k = re.search(r"pair ([A-D])", q2.stem).group(1)
            assert picked(q2).startswith("Attract" if pulls[k] else "Repel"), (s, q2.stem, picked(q2))
            q3 = next(q for q in qs if q.kind == "short")
            n = len(repel) if "repel" in q3.stem else len(attract)
            assert q3.answer == str(n), (s, q3.stem)
            if hidden:
                assert p["level"] == "upper"
                hq = by(qs, r"question mark")
                pr = next(x for x in pairs if x["letter"] == hidden)
                together = "pull together" in hq.stem
                assert together == pulls[hidden], (s, hq.stem)
                assert picked(hq) == pr["right"][0], (s, hq.stem, picked(hq))
            if s <= DRAWN:
                fig = m.draw(p)
                words = words_of(fig)
                plt.close(fig)
                assert words.count("N") + words.count("S") == 4 * len(shown) + (2 if hidden else 0), (s, words)
                assert words.count("?") == (1 if hidden else 0), s
        else:
            objs = p["objects"]
            names = [o["name"] for o in objs]
            assert set(names) <= MAGNETIC | NOT_MAGNETIC_METAL | NOT_METAL and len(set(names)) == len(names), (s, names)
            assert 4 <= len(objs) <= 6
            picks = {o["letter"] for o in objs if o["name"] in MAGNETIC}
            assert picks and len(picks) < len(objs), s
            q1 = qs[0]
            assert letters(picked(q1)) == picks, (s, picked(q1), names)
            assert all(letters(o) != picks for o in q1.options if o != picked(q1)), s
            cq = qs[1]
            assert cq.kind == "short"
            want = len(objs) - len(picks) if "not pick up" in cq.stem else len(picks)
            assert cq.answer == str(want), (s, cq.stem)
            q3 = qs[2]
            if p["level"] == "upper":
                metal_not = sum(1 for o in objs if o["name"] in NOT_MAGNETIC_METAL)
                assert metal_not >= 1 and q3.kind == "short" and q3.answer == str(metal_not), (s, q3.stem)
            else:
                assert q3.kind == "mcq"
                want_pick = "not pick up" not in q3.stem
                chosen = letters(picked(q3))
                assert len(chosen) == 1 and (next(iter(chosen)) in picks) == want_pick, (s, q3.stem)
                for o in q3.options:
                    if o != picked(q3):
                        assert (next(iter(letters(o))) in picks) != want_pick, (s, o)
            if s <= DRAWN:
                fig = m.draw(p)
                words = words_of(fig)
                plt.close(fig)
                for o in objs:
                    assert o["letter"] in words and o["name"] in words, (s, o)
    assert {("poles", "lower"), ("poles", "upper"), ("objects", "lower"), ("objects", "upper")} <= kinds


# --- shadows_p -------------------------------------------------------------------------------------------

def shadow_length(h, dx, H) -> float:
    """A straight ray from the light past the top of the object meets the ground this far beyond it."""
    assert H > h
    return h * dx / (H - h)


def patch_span(ax, gid):
    ps = [pa for pa in ax.patches if pa.get_gid() == gid]
    assert ps, gid
    xs = [x for pa in ps for poly in pa.get_path().to_polygons(pa.get_patch_transform()) for x, _ in poly]
    return min(xs), max(xs)


def test_shadows_p():
    m = fam("shadows_p")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds.add((p["kind"], p["level"]))
        if p["kind"] == "side":
            side = p["s"]  # -1: the light is on the left
            L = shadow_length(p["h"], p["d"], p["H"])

            def where(span):
                """Which way from the object an outline lies, how near it starts and how far it reaches."""
                a, b = span
                assert a * b > 0, (s, span)  # wholly on one side of the object
                return (1 if a > 0 else -1), min(abs(a), abs(b)), max(abs(a), abs(b))

            away = [k for k, sp in p["spots"].items() if where(sp)[0] == -side]
            assert len(away) == 1, (s, p["spots"])  # one outline away from the light: the true one
            _, near, far = where(p["spots"][away[0]])
            assert near <= 0.3 and abs(far - L) < 0.02, (s, near, far, L)
            # the one the light makes from the other side: next to the object, as long
            mirror = [k for k, sp in p["spots"].items() if where(sp)[0] == side and where(sp)[1] <= 0.3]
            assert len(mirror) == 1 and abs(where(p["spots"][mirror[0]])[2] - L) < 0.02, (s, p["spots"])
            beyond = [k for k in p["spots"] if k not in away + mirror]
            assert len(beyond) == 1 and where(p["spots"][beyond[0]])[1] >= p["d"] + 0.3, (s, p["spots"])
            q1 = qs[0]
            assert letters(picked(q1)) == {away[0]}, (s, q1.options, away)
            q2 = by(qs, r"other side")
            assert q2 is not None and letters(picked(q2)) == {mirror[0]}, (s, q2 and q2.stem)
            if s <= DRAWN:
                fig = m.draw(p)
                ax = fig.axes[0]
                for k, (a, b) in p["spots"].items():
                    x0, x1 = patch_span(ax, f"spot-{k}")
                    assert abs(x0 - min(a, b)) < 0.06 and abs(x1 - max(a, b)) < 0.06, (s, k, (x0, x1), (a, b))
                words = words_of(fig)
                plt.close(fig)
                assert all(k in words for k in p["spots"]), s
        elif p["kind"] == "height":
            Ls = [shadow_length(p["h"], p["d"], H) for H in p["heights"]]
            order = sorted(range(len(Ls)), key=lambda i: Ls[i])
            for a, b in zip(order, order[1:]):
                assert Ls[b] >= 1.5 * Ls[a], (s, Ls)  # clearly different
            longest = max(range(len(Ls)), key=lambda i: Ls[i])
            shortest = min(range(len(Ls)), key=lambda i: Ls[i])
            for q in qs:
                if re.search(r"longer\?|longest\?", q.stem):
                    assert picked(q) == f"Drawing {longest + 1}", (s, q.stem, picked(q))
                elif "shortest?" in q.stem:
                    assert picked(q) == f"Drawing {shortest + 1}", (s, q.stem)
                elif "moves the lamp" in q.stem:
                    a, b = (int(x) for x in re.findall(r"drawing (\d)", q.stem))
                    want = "It gets longer" if Ls[b - 1] > Ls[a - 1] else "It gets shorter"
                    assert picked(q) == want, (s, q.stem, picked(q))
            assert any("moves the lamp" in q.stem for q in qs), s
            if s <= DRAWN:
                fig = m.draw(p)
                words = words_of(fig)
                plt.close(fig)
                for H in p["heights"]:
                    assert f"{H} m" in words, (s, H, words)
                assert f"{p['h']} m" in words, s
        else:
            assert p["level"] == "upper"
            h = p["h"]
            Ls, toward = {}, {}
            for k, (x, y) in p["suns"].items():
                Ls[k] = 0.0 if x == 0 else shadow_length(h, abs(x), y)
                toward[k] = x
            noon = min(Ls, key=Ls.get)
            assert toward[noon] == 0 and all(Ls[k] >= 1.0 for k in Ls if k != noon), (s, Ls)
            east = next(k for k in Ls if toward[k] > 0)  # East is on the right: the morning Sun
            west = next(k for k in Ls if toward[k] < 0)
            longest = max(Ls, key=Ls.get)
            others = sorted(Ls.values())
            assert others[2] >= 1.3 * others[1], (s, Ls)
            for q in qs:
                if re.search(r"\bnoon\b", q.stem):
                    assert letters(picked(q)) == {noon}, (s, q.stem)
                elif "morning" in q.stem:
                    assert letters(picked(q)) == {east}, (s, q.stem)
                elif "afternoon" in q.stem:
                    assert letters(picked(q)) == {west}, (s, q.stem)
                elif "longest" in q.stem:
                    assert letters(picked(q)) == {longest}, (s, q.stem)
            if s <= DRAWN:
                fig = m.draw(p)
                for k, (x, y) in p["suns"].items():
                    ax = fig.axes[0]
                    x0, x1 = patch_span(ax, f"shadow-{k}")
                    centre = p["centres"][k]
                    if x == 0:
                        assert x1 - x0 <= 0.8, (s, k)
                    else:
                        # the shadow runs from the foot of the pole away from the Sun, as long as the ray says
                        tip = centre - math.copysign(Ls[k], x)
                        far = x0 if x > 0 else x1
                        assert abs(far - tip) < 0.06, (s, k, far, tip)
                        assert abs((x1 if x > 0 else x0) - centre) < 0.12, (s, k)
                words = words_of(fig)
                plt.close(fig)
                assert "West" in words and "East" in words
    assert {("side", "lower"), ("side", "upper"), ("height", "lower"), ("height", "upper"), ("sun", "upper")} <= kinds


# --- seesaw_p --------------------------------------------------------------------------------------------

END = {1: "The right end goes down", -1: "The left end goes down", 0: "It balances"}


def turning(loads) -> int:
    return sum(mark * mass for mark, mass, _ in loads)


def moved(loads, who, mark):
    return [[mark if nm.lower() == who.lower() else a, b, nm] for a, b, nm in loads]


def test_seesaw_p():
    m = fam("seesaw_p")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds.add((p["kind"], p["level"]))
        left, right = p["left"], p["right"]
        for side in (left, right):
            marks = sorted(mk for mk, _, _ in side)
            assert all(1 <= mk <= 4 for mk in marks), s
            assert all(b - a >= 2 for a, b in zip(marks, marks[1:])), (s, marks)  # two on a side sit apart
            assert all(isinstance(mass, int) and mass > 0 and mass % 5 == 0 for _, mass, _ in side), s
        labels = [nm.lower() for _, _, nm in left + right] + ([p["newcomer"][0].lower()] if p["newcomer"] else [])
        assert len(set(labels)) == len(labels), (s, labels)
        if p["level"] == "upper":
            assert "mass × mark number" in " ".join(q.stem for q in qs), s
        if p["kind"] == "tip":
            L, R = turning(left), turning(right)
            assert L == R or abs(L - R) >= 10, (s, L, R)  # a clear difference, or an exact balance
            if p["level"] == "lower":
                assert len(left) == len(right) == 1
                (lm, lw, ln), (rm, rw, rn) = left[0], right[0]
                assert lm == rm or lw == rw, (s, left, right)  # one thing differs, not both
            q1 = qs[0]
            way = (R > L) - (R < L)
            assert picked(q1) == END[way], (s, q1.stem, picked(q1))
            for q in qs[1:]:
                tq = re.search(r"turning effect on the (left|right) side\?", q.stem)
                if tq:
                    assert q.answer == str(L if tq.group(1) == "left" else R), (s, q.stem)
                mv = re.search(r"^If (.+?) moves to mark (\d), which end goes down\?", q.stem)
                if mv:
                    who, mk = mv.group(1), int(mv.group(2))
                    l2, r2 = moved(left, who, mk), moved(right, who, mk)
                    assert l2 != left or r2 != right, (s, q.stem)
                    w2 = (turning(r2) > turning(l2)) - (turning(r2) < turning(l2))
                    assert turning(l2) == turning(r2) or abs(turning(l2) - turning(r2)) >= 10, (s, q.stem)
                    assert picked(q) == END[w2], (s, q.stem)
                if q.stem.startswith("Which change would make the seesaw balance?"):
                    for o in q.options:
                        mo = re.match(r"(.+?) moves to mark (\d)$", o)
                        who, mk = mo.group(1), int(mo.group(2))
                        l2, r2 = moved(left, who, mk), moved(right, who, mk)
                        assert (turning(l2) == turning(r2)) == (o == picked(q)), (s, o)
                        if o != picked(q):
                            assert abs(turning(l2) - turning(r2)) >= 10, (s, o)
                if q.stem.startswith("Where must") and q.kind == "short":
                    who = re.search(r"^Where must (.+?) (?:sit|go)\b", q.stem).group(1).lower()
                    mine = left if any(nm.lower() == who for _, _, nm in left) else right
                    other = right if mine is left else left
                    mass = next(b for _, b, nm in mine if nm.lower() == who)
                    assert int(q.answer) * mass == turning(other), (s, q.stem, q.answer)
                if re.search(r"farther from the middle\?", q.stem):
                    want = "same" if lm == rm else (ln if lm > rm else rn).lower()
                    assert want in picked(q).lower(), (s, q.stem, picked(q))
                if re.search(r"heavier\?", q.stem):
                    want = "same" if lw == rw else (ln if lw > rw else rn).lower()
                    assert want in picked(q).lower(), (s, q.stem, picked(q))
        else:
            nm, mass = p["newcomer"]
            loads = left or right
            assert not (left and right), s
            need = turning(loads)
            mq = qs[0]
            assert mq.kind == "short" and int(mq.answer) * mass == need and 1 <= int(mq.answer) <= 4, (s, mq.stem)
            if p["level"] == "lower":
                assert len(loads) == 1 and loads[0][1] == mass, s
            for q in qs[1:]:
                mv = re.search(r"at mark (\d) instead", q.stem)
                if mv:
                    mk = int(mv.group(1))
                    mine = mk * mass
                    newcomer_side = 1 if not right else -1  # the empty side
                    way = newcomer_side * ((mine > need) - (mine < need))
                    assert abs(mine - need) >= 10 and picked(q) == END[way], (s, q.stem, picked(q))
                if "turning effect" in q.stem and q.kind == "short":
                    assert q.answer == str(need), (s, q.stem)
        if s <= DRAWN:
            fig = m.draw(p)
            words = [w.lower() for w in words_of(fig)]
            plt.close(fig)
            for side in (left, right):
                for mk, mass, nm in side:
                    assert f"{mass} kg" in words and nm.lower() in words, (s, mass, nm)
            if p["newcomer"]:
                assert p["newcomer"][0].lower() in words and f"{p['newcomer'][1]} kg" in words, s
            assert sorted(w for w in words if w in ("1", "2", "3", "4")) == sorted("11223344"), (s, words)
    assert {("tip", "lower"), ("tip", "upper"), ("place", "lower"), ("place", "upper")} <= kinds


# --- force_arrows_p --------------------------------------------------------------------------------------

def test_force_arrows_p():
    m = fam("force_arrows_p")
    kinds = set()
    for s in SEEDS:
        p, qs = run(m, s)
        fs = p["forces"]
        kinds.add((p["object"], p["level"], any(f["kind"] == "friction" for f in fs)))
        assert len(fs) == 2 and fs[0]["dir"] == -fs[1]["dir"], s  # two forces in a line, opposite ways
        net = sum(f["dir"] * f["size"] for f in fs)
        assert net == 0 or abs(net) >= 2, (s, net)
        fr = [f for f in fs if f["kind"] == "friction"]
        if fr:
            other = next(f for f in fs if f["kind"] != "friction")
            assert other["size"] >= fr[0]["size"] and p["level"] == "upper", s  # friction never wins from rest
        if p["object"] == "ball":
            assert all(f["kind"] == "push" for f in fs), s
        q1 = qs[0]
        want = "It will not move" if net == 0 else ("To the right" if net > 0 else "To the left")
        assert picked(q1) == want, (s, q1.stem, picked(q1))
        bq = by(qs, r"balanced\?")
        if net == 0:
            assert picked(bq).startswith("Yes"), s
        else:
            big = max(fs, key=lambda f: f["size"])
            label = "the friction" if big["kind"] == "friction" else f"force {big['letter']}"
            assert picked(bq) == f"No: {label} is bigger", (s, picked(bq))
        pq = by(qs, r"a push or a pull\?")
        k = re.search(r"force ([A-Z])\b", pq.stem).group(1)
        f = next(f for f in fs if f["letter"] == k)
        assert f["kind"] in ("push", "pull") and picked(pq) == ("A push" if f["kind"] == "push" else "A pull"), (s, pq.stem)
        if p["level"] == "upper":
            rq = by(qs, r"overall force")
            if net:
                assert rq.answer == str(abs(net)), (s, rq.stem)
        else:
            sq = by(qs, r"How many squares long")
            k = re.search(r"arrow ([A-Z])\b", sq.stem).group(1)
            assert sq.answer == str(next(f["size"] for f in fs if f["letter"] == k)), s
        if s <= DRAWN:
            fig = m.draw(p)
            ax = fig.axes[0]
            try:
                ob = [pa for pa in ax.patches if pa.get_gid() == "object"]
                assert ob, s
                xs = [x for poly in ob[0].get_path().to_polygons(ob[0].get_patch_transform()) for x, _ in poly]
                left_edge, right_edge = min(xs), max(xs)
                arrows = {t.get_gid()[6:]: t for t in ax.texts if (t.get_gid() or "").startswith("force-")}
                assert set(arrows) == {f["letter"] for f in fs}, s
                lengths = {}
                for f in fs:
                    a = arrows[f["letter"]]
                    (hx, hy), (tx, ty) = a.xy, a.xyann
                    assert abs(hy - ty) < 1e-9 and (hx - tx) * f["dir"] > 0, (s, f)  # level, and pointing its way
                    lengths[f["letter"]] = abs(hx - tx)
                    if f["kind"] == "push":
                        assert min(abs(hx - left_edge), abs(hx - right_edge)) < 0.05, (s, f)  # its head on the object
                    elif f["kind"] == "pull":
                        assert min(abs(tx - left_edge), abs(tx - right_edge)) < 0.05, (s, f)  # its tail on the object
                    if p["level"] == "lower":
                        # on the squared grid: whole squares, as many as the force
                        assert abs(lengths[f["letter"]] - f["size"]) < 1e-9 and abs(hx - round(hx)) < 1e-9, (s, f)
                if p["level"] == "upper":
                    a, b = fs
                    assert abs(lengths[a["letter"]] * b["size"] - lengths[b["letter"]] * a["size"]) < 1e-6, s  # to scale
                    words = words_of(fig)
                    for f in fs:
                        assert any(re.search(rf"(?<![\d.]){f['size']} N$", w) for w in words), (s, f, words)
            finally:
                plt.close(fig)
    objs = {o for o, _, _ in kinds}
    assert objs == {"box", "cart", "ball"} and any(fr for _, _, fr in kinds)
