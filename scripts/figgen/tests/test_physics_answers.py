"""Answers of the Physics wave (P3e), recomputed from each figure's numbers over 1,000 seeds, with the
physics each figure must obey checked on what is drawn (P3e Review Focus 5)."""
import math
import random
import re
from fractions import Fraction

import matplotlib.pyplot as plt
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
    """The leading number of an answer: "2.5" or "1,200"."""
    return Fraction(re.match(r"-?[\d.,]+", text).group().replace(",", ""))


# --- Task 2: motion and forces ------------------------------------------------------------------

def test_motion_graph():
    m = fam("motion_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        pts = [tuple(c) for c in p["corners"]]
        assert pts[0] == (0, 0) and all(t1 > t0 for (t0, _), (t1, _) in zip(pts, pts[1:]))
        assert all(t % p["tstep"] == 0 and y % p["ystep"] == 0 for t, y in pts), p  # every corner on a gridline
        rate = lambda a, b: Fraction(b[1] - a[1], b[0] - a[0])  # noqa: E731
        if p["kind"] == "dt":
            first, stopped, average, total = qs
            assert num(first.answer) == rate(pts[0], pts[1]) and rate(pts[0], pts[1]) > 0
            assert all(y1 >= y0 for (_, y0), (_, y1) in zip(pts, pts[1:]))  # distance never falls
            assert int(stopped.answer) == sum(b[0] - a[0] for a, b in zip(pts, pts[1:]) if b[1] == a[1]) > 0
            assert num(average.answer) == Fraction(pts[-1][1], pts[-1][0])
            assert int(total.answer) == pts[-1][1]
        else:
            first, distance, force, last = qs
            a1 = rate(pts[0], pts[1])
            assert num(first.answer) == a1 and (2 * a1).denominator == 1
            area = sum(Fraction((a[1] + b[1]) * (b[0] - a[0]), 2) for a, b in zip(pts, pts[1:]))
            assert area.denominator == 1 and int(distance.answer) == area and pts[-1][1] == 0
            mass = int(re.search(r"mass of (\d+) kg", force.stem).group(1))
            assert num(force.answer) == mass * a1 and (mass * a1).denominator == 1  # F = ma
            assert num(last.answer) == -rate(pts[-2], pts[-1]) > 0


TRIPLES = {(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29)}


def test_force_diagram():
    m = fam("force_diagram")
    kinds, balanced = set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        resultant, accel, weight = qs[:3]
        kinds.add(p["kind"])
        if p["kind"] == "line":
            net = sum(f if d == "right" else -f for d, f in p["forces"])
            size, way = abs(net), "right" if net > 0 else "left"
            balanced.add(net == 0)
            if net == 0:
                assert resultant.kind == "short" and num(resultant.answer) == 0
            else:
                total = sum(f for _, f in p["forces"])
                assert picked(resultant) == f"{size} N to the {way}"
                # Size (the resultant, or all the forces added up) by direction: a 2 x 2 set, nothing to pick unseen.
                assert set(resultant.options) == {f"{v} N to the {w}" for v in (size, total) for w in ("right", "left")}
            eq = qs[3]
            assert picked(eq) == ("Yes: the resultant force is zero" if net == 0 else "No: the resultant force is not zero")
        else:
            # Two pulls at right angles, seen from above: the resultant is the hypotenuse of a Pythagorean triple.
            assert p["band"] == "UP"
            (d1, f1), (d2, f2) = p["forces"]
            assert d1 in ("right", "left") and d2 in ("up", "down")
            size = round((f1 ** 2 + f2 ** 2) ** 0.5)
            assert size ** 2 == f1 ** 2 + f2 ** 2
            assert any(Fraction(f1, a) == Fraction(f2, b) == Fraction(size, c) or Fraction(f1, b) == Fraction(f2, a) == Fraction(size, c)
                       for a, b, c in TRIPLES)
            assert num(resultant.answer) == size
        a = Fraction(size, p["mass"])
        assert num(accel.answer) == a and (100 * a).denominator == 1  # a = F/m
        assert "g = 10 N/kg" in weight.stem and num(weight.answer) == 10 * p["mass"]
    assert kinds == {"line", "right"} and balanced == {True, False}


def test_moments():
    m = fam("moments")
    for s in SEEDS:
        p, qs = run(m, s)
        pivot = p["pivot"]
        loads = [(x, f) for x, f in p["loads"]]
        (ux, uf) = p["unknown"]
        weight, moment = qs[:2]
        assert all(x % 5 == 0 and 0 <= x <= 100 for x, _ in loads + [(ux, uf)])
        # Balance: every moment about the pivot, the rule's own weight at its middle included.
        turning = sum(f * (x - pivot) for x, f in loads) + p["rule"] * (50 - pivot)
        assert num(weight.answer) * (ux - pivot) + turning == 0 and num(weight.answer) == uf and uf > 0
        mt = re.search(r"of the (\d+(?:\.\d+)?) N load at (\d+) cm", moment.stem)
        f, x = Fraction(mt.group(1)), int(mt.group(2))
        assert num(moment.answer) == f * abs(x - pivot) / 100  # in N m
        if len(qs) > 2:
            assert num(qs[2].answer) == sum(f for _, f in loads) + uf + p["rule"]  # the pivot holds it all up


def test_spring_graph():
    m = fam("spring_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        e, L = Fraction(p["cm_per_n"]), p["limit"]
        k, ext, limit = qs[:3]
        assert num(k.answer) == 1 / e
        assert re.match(r"What is the extension of the [\w' ]*spring for a load of", ext.stem) and "that spring" not in ext.stem, ext.stem
        F = int(re.search(r"load of (\d+) N", ext.stem).group(1))
        assert F <= L and num(ext.answer) == F * e and (F * e) % Fraction(p["ystep"]) == 0  # on a gridline
        assert int(limit.answer) == L
        x0, x1, y0, y1 = m.view(p)
        assert L * e <= y1
        if p["band"] == "UP":
            F2 = int(re.search(r"load of (\d+) N", qs[3].stem).group(1))
            assert F2 <= L and num(qs[3].answer) == Fraction(1, 2) * F2 * F2 * e / 100  # ½Fx, x in m


# --- Task 3: matter and energy ------------------------------------------------------------------

def test_pressure():
    m = fam("pressure")
    keys, asks = set(), set()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] == "manometer":
            height, pressure, higher = qs
            h = abs(p["left"] - p["right"])
            assert int(height.answer) == h and h > 0
            assert "g = 10 N/kg" in pressure.stem and num(pressure.answer) == Fraction(1000 * 10 * h, 100)  # ρgh, h in m
            # The gas pushes its side down: the lower level is the side at the higher pressure.
            gas_higher = p["left"] < p["right"]
            assert picked(higher) == f"{'the gas' if gas_higher else 'the open air'}: the water level on its side is lower"
            # The story fits the levels: a supply pushes harder than the air; a flask being pumped out, less.
            assert ("pump" in height.stem) != gas_higher and "cylinder" not in height.stem
        else:
            a, b, c = p["dims"]  # cm
            pressure, face = qs
            w, h = p["face"]
            depth = next(d for d in (a, b, c) if d not in (w, h))
            area = Fraction(w * h, 10000)  # m²
            assert int(re.search(r"weighs (\d+) N", pressure.stem).group(1)) == p["weight"]
            assert num(pressure.answer) == p["weight"] / area and (p["weight"] / area).denominator == 1
            # The faces as drawn: P the front (w by depth), Q the top (w by h), R the side (h by depth).
            areas = {"face P": w * depth, "face Q": w * h, "face R": h * depth}
            most = "greatest" in face.stem
            asks.add(most)
            want = (min if most else max)(areas, key=areas.get)
            assert picked(face) == want and set(face.options) == {*areas, "the same on every face"}
            keys.add(want)
    assert keys == {"face P", "face Q", "face R"} and asks == {True, False}


def test_the_manometer_gas_arm_is_closed_to_the_air():
    m = fam("pressure")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        if p["kind"] != "manometer":
            continue
        fig = m.draw(p)
        lines = [(list(map(float, ln.get_xdata())), list(map(float, ln.get_ydata()))) for ln in fig.axes[0].lines]
        plt.close(fig)
        assert ([1.5, 2.5], [22.0, 22.0]) in lines  # the gas arm is capped
        assert any(xs[0] == 2.0 and ys[0] == 22.0 and ys[1] > 22.0 for xs, ys in lines)  # and piped from its top
        # A dashed line runs from each water surface to the scale, so each level is read off a mark (P3f review).
        assert any(ys == [float(p["left"])] * 2 and min(xs) <= 2.5 and max(xs) >= 3.6 for xs, ys in lines), "left level"
        assert any(ys == [float(p["right"])] * 2 and max(xs) >= 5.5 and min(xs) <= 5.0 for xs, ys in lines), "right level"


def test_density_displacement():
    m = fam("density_displacement")
    for s in SEEDS:
        p, (volume, density, mass) = run(m, s)
        v = p["after"] - p["before"]
        assert v > 0 and p["before"] % p["mark"] == 0 and p["after"] % p["mark"] == 0  # on marked divisions
        assert int(volume.answer) == v
        rho = Fraction(p["grams"]).limit_denominator(1000) / v
        assert num(density.answer) == rho and (rho * 100).denominator == 1  # exact to 2 d.p.
        k = int(re.search(r"mass of (\d+) cm³", mass.stem).group(1))
        assert num(mass.answer) == rho * k


DEVICE_POWER = {"filament lamp": (25, 150), "LED lamp": (3, 30), "electric kettle": (1000, 3000), "solar panel": (50, 500),
                "charcoal stove": (500, 5000), "electric motor": (20, 1000), "radio": (2, 50), "moto engine": (2000, 20000)}


def test_energy_sankey():
    m = fam("energy_sankey")
    for s in SEEDS:
        p, qs = run(m, s)
        flows = p["flows"]
        total_in = p["input"]
        assert sum(v for _, v, _ in flows) == total_in  # energy is conserved
        missing, efficiency, form = qs[:3]
        hidden = p["hidden"]
        values = [total_in] + [v for _, v, _ in flows]
        assert int(missing.answer) == values[hidden]
        useful = sum(v for _, v, kind in flows if kind == "useful")
        assert num(efficiency.answer) == Fraction(100 * useful, total_in) and (Fraction(100 * useful, total_in)).denominator == 1
        assert picked(form) == next(name for name, _, kind in flows if kind == "useful")
        # A kettle's useful output is heat, and a stove's pot holds water: no other heat is offered unless the
        # figure labels it as wasted.
        wasted = {name for name, _, kind in flows if kind == "wasted"}
        if picked(form).startswith("heat"):
            assert all(o in wasted for o in form.options if o != picked(form) and o.startswith("heat")), form.options
        if len(qs) > 3:  # a power the device really works at, and the time to take in the energy (P3f review: a 200 W LED)
            P = int(re.search(r"at (\d+) W", qs[3].stem).group(1))
            lo, hi = DEVICE_POWER[p["device"]]
            assert lo <= P <= hi and num(qs[3].answer) == Fraction(total_in, P), (p["device"], P)
        # The options are energy forms, and only the figure's own named forms ("heat in the water") (P3f review).
        generic = {"light", "heat", "sound", "kinetic", "electrical", "chemical"}
        assert set(form.options) <= generic | {name for name, _, _ in flows}, form.options


def test_only_the_motor_sankey_reaches_motor_and_generator_chapters():
    m = fam("energy_sankey")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        for name in ("Chapter 31: Electric motors", "Chapter 28: Generators"):
            assert bool(re.search(m.avoid_for(p), name, re.I)) == (p["device"] != "electric motor"), (p["device"], name)


PHYSICS = sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "physics")


@pytest.mark.parametrize("fid", PHYSICS)
def test_a_physics_stem_takes_the_right_article(fid):
    """'a electric kettle' (P3e): "an" before a vowel sound, "an LED"."""
    m = FAMILIES[fid]
    for s in range(1, 201):
        _, qs = run(m, s)
        for q in qs:
            assert not re.search(r"\ba (?:[aeiouAEIOU]|LED\b)", q.stem), (fid, s, q.stem)


# --- Task 4: electricity ------------------------------------------------------------------------

def solve(p):
    """The circuit's total resistance, main current and each resistor's current, from first principles."""
    R = [Fraction(r) for r in p["resistors"]]
    V = Fraction(p["volts"])
    if p["kind"] == "series":
        total = sum(R)
        I = V / total
        return total, I, [I] * len(R)
    if p["kind"] == "parallel":
        total = 1 / sum(1 / r for r in R)
        return total, V / total, [V / r for r in R]
    par = 1 / (1 / R[1] + 1 / R[2])  # R1 in series with R2 parallel R3
    total = R[0] + par
    I = V / total
    vp = I * par
    return total, I, [I, vp / R[1], vp / R[2]]


def test_circuit():
    from collections import Counter
    m = fam("circuit")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        total, I, currents = solve(p)
        R = [Fraction(r) for r in p["resistors"]]
        resistance, ammeter, voltmeter, power = qs[:4]
        assert num(resistance.answer) == total
        assert num(ammeter.answer) == (currents[p["ammeter"]] if p["ammeter"] is not None else I)
        if p["kind"] == "parallel":
            # Across a parallel pair a voltmeter reads the battery's printed voltage, so none is drawn; a branch current instead.
            assert p["voltmeter"] is None
            j = int(re.search(r"current in resistor R(\d)", voltmeter.stem).group(1)) - 1
            assert j != p["ammeter"] and num(voltmeter.answer) == currents[j]
            across = j
        else:
            across = p["voltmeter"]
            assert num(voltmeter.answer) == currents[across] * R[across]  # V = IR across that resistor
        k = int(re.search(r"resistor R(\d)", power.stem).group(1)) - 1
        assert num(power.answer) == currents[k] ** 2 * R[k]  # P = I²R
        # Every value a student writes is exact to two decimal places.
        assert all((v * 100).denominator == 1 for v in [total, I, *currents, currents[across] * R[across], currents[k] ** 2 * R[k]])
        if p["kind"] != "series":
            assert sum(currents[1:] if p["kind"] == "mixed" else currents) == I  # Kirchhoff: currents at a junction
    for band, allowed in (("LS", ("series", "parallel")), ("UP", ("series", "parallel", "mixed")), ("AL", ("parallel", "mixed"))):
        n = sum(kinds[(band, k)] for k in allowed)
        assert all(kinds[(band, k)] >= 0.2 * n for k in allowed), (band, kinds)  # each kind a fair share


def test_meter_dial():
    m = fam("meter_dial")
    for s in SEEDS:
        p, (reading, division, change) = run(m, s)
        v = Fraction(p["value"])
        assert v % Fraction(p["minor"]) == 0 and 0 < v <= p["full"]  # the needle on a division
        assert num(reading.answer) == v and any(a.endswith(f" {p['unit']}") for a in reading.accepted)
        assert num(division.answer) == Fraction(p["minor"])
        later = Fraction(re.search(r"reads ([\d.]+)", change.stem).group(1))
        assert num(change.answer) == abs(later - v) and later <= p["full"]


def test_iv_graph():
    m = fam("iv_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        kind = p["kind"]
        resistance, which, ohms = qs[:3]
        V, I = Fraction(p["point"][0]), Fraction(p["point"][1]) / 1000  # mA to A
        assert num(resistance.answer) == V / I and (V / I).denominator == 1
        assert picked(which) == {"resistor": "a fixed resistor", "lamp": "a filament lamp", "diode": "a diode"}[kind]
        # An LDR in steady light, or a thermistor at one temperature, gives a resistor's straight line too.
        assert set(which.options) <= {"a fixed resistor", "a filament lamp", "a diode", "a capacitor"}
        assert picked(ohms).startswith("Yes") == (kind == "resistor")
        if kind == "lamp":  # a filament's resistance grows as it heats, from a finite value when cold
            assert p["R0"] > 0 and p["a"] > 0 and m.current(p, 0.5) / 0.5 < 1000 / p["R0"] + 1e-9
        # The marked point lies on the drawn characteristic.
        assert abs(m.current(p, float(V)) - float(p["point"][1])) < 1e-9
        if len(qs) > 3:  # the current at another voltage, from the component's own law
            v = float(re.search(r"to ([\d.]+) V", qs[3].stem).group(1))
            law = {"resistor": lambda: v * 1000 / p["R"], "lamp": lambda: v * 1000 / (p["R0"] + p["a"] * v), "diode": lambda: max(0, p["g"] * (v - 0.6))}
            assert abs(num(qs[3].answer) - law[kind]()) < 1e-9


# --- Task 5: magnetism --------------------------------------------------------------------------

VEC = {"right": (1, 0, 0), "left": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0), "out of the page": (0, 0, 1), "into the page": (0, 0, -1)}


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def named(v):
    return next(k for k, u in VEC.items() if u == v)


def test_motor_rule():
    m = fam("motor_rule")
    for s in SEEDS:
        p, qs = run(m, s)
        B = VEC[p["field"]]  # from the N pole to the S pole, across the page
        assert B[2] == 0
        if p["mode"] == "motor":
            L = VEC[p["current"]]
            assert sum(a * b for a, b in zip(L, B)) == 0  # the wire runs across the field
            want = named(cross(L, B))  # F = I L x B
            size = Fraction(p["tesla"]) * p["amps"] * Fraction(p["cm"], 100)  # F = BIL
        else:
            v = VEC[p["motion"]]
            assert p["view"] == "end" and v[2] == 0 and sum(a * b for a, b in zip(v, B)) == 0
            want = named(cross(v, B))  # the push on the wire's free charges, v x B
            size = Fraction(p["tesla"]) * Fraction(p["cm"], 100) * p["speed"]  # emf = BLv
        direction, bigger, after, amount = qs[:4]
        assert picked(direction) == want
        # Two axes, both ways along each: the key cannot be told from the options alone.
        assert len(direction.options) == 4 and all(o in VEC for o in direction.options)
        assert len({tuple(map(abs, VEC[o])) for o in direction.options}) == 2
        assert {o for o in direction.options if tuple(map(abs, VEC[o])) == tuple(map(abs, VEC[want]))} == {want, named(tuple(-c for c in VEC[want]))}
        assert picked(bigger).startswith(("a larger", "a stronger", "moving the wire faster")) and "same" in picked(bigger)
        flips = sum(w in after.stem for w in ("reversed", "swapped", "other way"))
        assert flips in (1, 2), after.stem
        assert picked(after) == (want if flips == 2 else named(tuple(-c for c in VEC[want])))  # each reversal turns it round
        assert len({tuple(map(abs, VEC[o])) for o in after.options}) == 2
        assert num(amount.answer) == size


def test_transformer():
    m = fam("transformer")
    for s in SEEDS:
        p, qs = run(m, s)
        Np, Ns, Vp, Vs = (Fraction(str(p[k])) for k in ("Np", "Ns", "Vp", "Vs"))
        assert Vs / Vp == Ns / Np and Ns != Np  # the turns rule
        missing, kind, turns = qs[:3]
        assert num(missing.answer) == {"Np": Np, "Ns": Ns, "Vp": Vp, "Vs": Vs}[p["missing"]]
        assert picked(kind).lower().startswith("step-up" if Ns > Np else "step-down")
        V2 = Fraction(re.search(r"wants ([\d.]+) V", turns.stem).group(1))
        assert num(turns.answer) == Np * V2 / Vp and (Np * V2 / Vp).denominator == 1 and V2 != Vs
        if p["band"] == "AL":
            Ip = Fraction(re.search(r"([\d.]+) A", qs[3].stem).group(1))
            assert num(qs[3].answer) == Ip * Vp / Vs  # an ideal transformer: power in = power out


# --- Task 6: heat, waves and light --------------------------------------------------------------

MELTS = {"water": 0, "stearic acid": 69, "naphthalene": 80, "lauric acid": 44}
STATES = ["solid only", "solid and liquid", "liquid only", "liquid and gas"]


def test_heating_curve():
    m = fam("heating_curve")
    for s in SEEDS:
        p, qs = run(m, s)
        c = p["corners"]
        assert all(isinstance(t, int) and isinstance(T, int) for t, T in c)  # every corner on a gridline crossing
        flats = [(a[0], b[0], a[1]) for a, b in zip(c, c[1:]) if a[1] == b[1]]
        if p["kind"] == "ice":
            assert p["substance"] == "water" and [f[2] for f in flats] == [0, 100] and c[0][1] < 0
            assert all(b[1] >= a[1] for a, b in zip(c, c[1:]))  # warming, apart from the plateaus
            stages = STATES
        else:
            assert [f[2] for f in flats] == [MELTS[p["substance"]]] and c[0][1] > MELTS[p["substance"]] > c[-1][1]
            assert all(b[1] <= a[1] for a, b in zip(c, c[1:]))  # cooling
            stages = ["liquid only", "solid and liquid", "solid only"]
        span = flats[0][1] - flats[0][0]
        first, second, state = qs[:3]
        if p["kind"] == "ice":
            assert num(first.answer) == span and num(second.answer) == c[0][1]  # how long it took to melt; the start
        else:
            assert num(first.answer) == flats[0][2] and num(second.answer) == span  # the freezing point; how long it took
        a, b = map(int, re.search(r"between (\d+) and (\d+) minutes", state.stem).groups())
        k = next(k for k in range(len(c) - 1) if c[k][0] <= a < b <= c[k + 1][0])
        assert picked(state) == stages[k] and sorted(state.options) == sorted(STATES)
        for q in qs[3:]:
            if "energy" in q.stem and q.kind == "short":
                P = int(re.search(r"(\d+) W", q.stem).group(1))
                assert num(q.answer) == P * span * 60  # E = Pt, t in seconds
            elif "specific heat capacity" in q.stem:
                P, M = int(re.search(r"(\d+) W", q.stem).group(1)), Fraction(re.search(r"([\d.]+) kg", q.stem).group(1))
                assert num(q.answer) == P * (c[3][0] - c[2][0]) * 60 / (M * 100)  # c = Pt / (m ΔT), water from 0 to 100 °C
            assert not q.stem.startswith("Why")


def test_wave_graph():
    m = fam("wave_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["cells"] % 4 == 0  # the peaks and the crossings fall on gridlines
        L = Fraction(p["cell"]) * p["cells"]  # the wavelength or the period, in the axis's unit
        for k in range(9):  # the drawn curve passes through zero or a peak at every quarter
            y = m.displacement(p, float(L * k / 4))
            assert min(abs(y), abs(abs(y) - p["amp"])) < 1e-9
        assert abs(m.displacement(p, float(L / 4)) - m.displacement(p, float(L / 4 + L))) < 1e-9  # it repeats every L
        amp, length, third = qs[:3]
        assert num(amp.answer) == p["amp"] and num(length.answer) == L
        if p["axis"] == "distance":
            f = Fraction(re.search(r"([\d.]+) Hz", third.stem).group(1))
            metres = L / 100 if p["unit"] == "cm" else L
            assert num(third.answer) == f * metres  # v = f λ, in m/s
        else:
            seconds = L / 1000 if p["unit"] == "ms" else L
            assert num(third.answer) == 1 / seconds  # f = 1 / T
            lam = Fraction(re.search(r"([\d.]+) m\b", qs[3].stem).group(1))
            assert num(qs[3].answer) == lam / seconds  # v = f λ
        assert all((num(q.answer) * 100).denominator == 1 for q in qs if q.kind == "short")


def test_ray_optics():
    m = fam("ray_optics")
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] == "reflection":
            refl, mirror = qs[:2]
            assert num(refl.answer) == p["i"] and num(mirror.answer) == 90 - p["i"]  # the law of reflection
            # The drawn rays make equal angles with the normal, on opposite sides of it.
            a, b = m.ray_angles(p)
            assert abs(a + b) < 1e-9 and abs(abs(a) - p["i"]) < 1e-9
        else:
            n_q, bend = qs[:2]
            i, r = p["i"], p["r"]
            n = math.sin(math.radians(i)) / math.sin(math.radians(r))
            n = n if p["into"] else 1 / n
            assert 1.3 <= n <= 1.6 and abs(n * 100 - round(n * 100)) < 0.4  # a real index, not on a rounding edge
            assert num(n_q.answer) == Fraction(f"{n:.2f}") and not n_q.answer.endswith("0")
            assert f"{n:.2f}" in n_q.accepted
            assert (r < i) == p["into"]  # into the denser medium it bends towards the normal
            text = picked(bend)
            assert text.startswith("Towards" if p["into"] else "Away") and ("slows down" in text) == p["into"]


def test_lens_diagram():
    m = fam("lens_diagram")
    for s in SEEDS:
        p, qs = run(m, s)
        f, u, h, sc = Fraction(p["f"]), Fraction(p["u"]), Fraction(p["h"]), p["scale"]
        v = 1 / (1 / f - 1 / u)  # 1/f = 1/u + 1/v, real distances positive
        hi = -h * v / u
        assert v.denominator == 1 and hi.denominator == 1  # the image's tip on a lattice point
        dist, height, mag, kind = qs[:4]
        assert num(dist.answer) == abs(v) * sc and num(height.answer) == abs(hi) * sc
        assert num(mag.answer) == abs(v / u) and (abs(v / u) * 100).denominator == 1
        assert picked(kind).lower() == ("real and inverted" if v > 0 else "virtual and upright")
        assert sorted(o.lower() for o in kind.options) == ["real and inverted", "real and upright", "virtual and inverted", "virtual and upright"]


EM = ["radio waves", "microwaves", "infrared", "visible light", "ultraviolet", "X-rays", "gamma rays"]
EM_USES = {"broadcast": "radio waves", "cook": "microwaves", "mobile phone": "microwaves", "remote control": "infrared",
           "thermal camera": "infrared", "optical fibre": "visible light", "bank note": "ultraviolet", "sunburn": "ultraviolet",
           "broken bone": "X-rays", "cancer cells": "gamma rays"}


def test_em_spectrum():
    m = fam("em_spectrum")
    for s in SEEDS:
        p, qs = run(m, s)
        shown = m.regions(p)  # left to right, None for the blank
        canonical = EM if p["order"] == "radio-first" else EM[::-1]
        assert shown.count(None) == 1 and [x or canonical[i] for i, x in enumerate(shown)] == canonical
        assert m.arrow_right(p) == ((p["arrow"] == "frequency") == (p["order"] == "radio-first"))  # frequency rises towards gamma
        missing, extreme, use = qs[:3]
        assert not any(EM[p["blank"]].lower() in o.lower() for q in qs for o in q.options)  # nothing names the blank
        # Typed, not chosen: six regions are on the figure, so any list of regions gives the seventh away.
        assert missing.kind == "short" and missing.answer == EM[p["blank"]]
        long_end = any(w in extreme.stem for w in ("longest wavelength", "lowest frequency", "least energy"))
        assert extreme.kind == "short" and extreme.answer == ("radio waves" if long_end else "gamma rays")
        assert "?" in use.stem and next(r for k, r in EM_USES.items() if k in picked(use)) == EM[p["blank"]]  # the use of the blank


# --- Task 7: atomic physics ---------------------------------------------------------------------

def test_decay_graph():
    m = fam("decay_graph")
    for s in SEEDS:
        p, qs = run(m, s)
        A0, T = p["A0"], p["half"]
        assert T % p["xstep"] == 0  # the half-life on a gridline
        for n in range(4):  # A0 / 2^n at whole half-lives, each on a gridline
            assert Fraction(A0, 2 ** n) % p["ystep"] == 0
            assert abs(m.activity(p, n * T) - A0 / 2 ** n) < 1e-9
        half, after, until = qs[:3]
        assert num(half.answer) == T
        t = Fraction(re.search(r"after ([\d.,]+)", after.stem).group(1).replace(",", ""))
        assert (t / T).denominator == 1 and num(after.answer) == Fraction(A0, 2 ** int(t / T))
        target = Fraction(re.search(r"fall to ([\d.,]+)", until.stem).group(1).replace(",", ""))
        k = (Fraction(A0) / target).numerator.bit_length() - 1
        assert Fraction(A0) / target == 2 ** k and k >= 1 and num(until.answer) == k * T


SYMBOLS = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Sc"]
SUP, SUB = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"), str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def notation(A, Z):
    return f"{str(A).translate(SUP)}{str(Z).translate(SUB)}{SYMBOLS[Z - 1]}"


def test_nucleus():
    m = fam("nucleus")
    for s in SEEDS:
        p, qs = run(m, s)
        Z, A = p["Z"], p["A"]
        drawn = m.layout(p)
        assert sum(1 for *_, k in drawn if k == "proton") == Z and sum(1 for *_, k in drawn if k == "neutron") == A - Z
        shells = m.shells(p)  # 2, 8, 8, 2: each shell filled before the next
        assert sum(shells) == Z and all(n == cap for n, cap in zip(shells[:-1], (2, 8, 8)))
        z_q, a_q, sym = qs[:3]
        assert num(z_q.answer) == Z and num(a_q.answer) == A
        assert picked(sym) == notation(A, Z) and len(set(sym.options)) == 4
        if len(qs) > 3:  # beta-minus decay: a neutron becomes a proton, so A is kept and Z rises by one
            assert p["beta"] and picked(qs[3]) == notation(A, Z + 1) and len(set(qs[3].options)) == 4
            assert SYMBOLS[Z - 1] not in qs[3].stem and str(A) not in qs[3].stem and "-" not in qs[3].stem


# --- Review Focus 2: no MCQ answerable from its options alone ---------------------------------------

def _central(options):
    """The option nearest all the others, token by token; None on a tie."""
    from collections import Counter
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", sorted(f for f, m in FAMILIES.items() if m.SUBJECT == "physics"))
def test_a_physics_mcq_cannot_be_picked_from_its_options_alone(fid):
    """When each wrong option changes one feature of the key, the key is the option nearest all the
    others (P3c): a student needs no figure. Every Physics MCQ, by its question, keeps that under 35%."""
    from collections import defaultdict
    m = FAMILIES[fid]
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])  # the question itself, without its story
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


# --- Final review: labels clear of lines -------------------------------------------------------------

def _crossings(fig):
    """Labels a drawn line passes through: each line's segments, and each annotation arrow's, sampled
    against every label's box (shrunk a little, so a line passing by is not counted)."""
    from matplotlib.text import Annotation
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    ax = fig.axes[0]
    segs = []
    for ln in ax.lines:
        xy = ax.transData.transform(list(zip(ln.get_xdata(), ln.get_ydata())))
        segs += list(zip(xy[:-1], xy[1:]))
    labels = []
    for t in ax.texts:
        if isinstance(t, Annotation) and not t.get_text():
            a, b = ax.transData.transform([t.xyann, t.xy])
            segs.append((a, b))
        elif t.get_text().strip():
            labels.append(t)
    hits = []
    for t in labels:
        box = t.get_window_extent(r).shrunk(0.86, 0.7)
        for (x0, y0), (x1, y1) in segs:
            if any(box.contains(x0 + (x1 - x0) * i / 60, y0 + (y1 - y0) * i / 60) for i in range(61)):
                hits.append(t.get_text())
                break
    return hits


@pytest.mark.parametrize("fid", ["lens_diagram", "pressure"])
def test_no_line_runs_through_a_label(fid):
    m = fam(fid)
    bad = []
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        hits = _crossings(fig)
        plt.close(fig)
        if hits:
            bad.append((s, hits))
    assert not bad, bad


# --- P3f review: each question stands alone; the physics it assumes is stated ---------------------

def test_a_motion_question_names_what_moves():
    """A quiz asks one question per figure, so "For how long was it stopped?" names nothing (P3f review)."""
    m = fam("motion_graph")
    for s in range(1, 301):
        p, qs = run(m, s)
        for q in qs:
            assert not re.search(r"\bits?\b", q.stem), q.stem
            assert p["mover"] in q.stem or "runner" in q.stem, q.stem


def test_a_short_speed_time_graph_numbers_its_time_axis_often():
    m = fam("motion_graph")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["kind"] != "vt":
            continue
        fig = m.draw(p)
        labelled = [t for t in fig.axes[0].get_xticks() if 0 <= t <= p["corners"][-1][0]]
        plt.close(fig)
        assert len(labelled) >= 4, (s, labelled)  # "0" and "4" alone leave 2 s and 6 s to guess


def test_the_acceleration_says_which_forces_act():
    """Friction unstated made the acceleration two answers (P3f review)."""
    m = fam("force_diagram")
    for s in range(1, 301):
        p, qs = run(m, s)
        want = "Ignore friction." if p["kind"] == "right" else "The arrows show every horizontal force on it."
        assert want in qs[1].stem, qs[1].stem


def test_the_pivot_force_counts_the_rule_or_says_to_ignore_it():
    """With the pivot at the middle, the rule's own weight still pushes on the pivot (P3f review)."""
    m = fam("moments")
    for s in range(1, 301):
        p, qs = run(m, s)
        for q in qs:
            if "upward force of the pivot" in q.stem:
                stated = f"weighs {p['rule']} N" in q.stem if p["rule"] else "Ignore the rule's own weight." in q.stem
                assert stated, q.stem


def test_spring_energy_is_exact_to_two_places_and_the_limit_is_a_corner():
    m = fam("spring_graph")
    for s in range(1, 301):
        p, qs = run(m, s)
        for q in qs:
            if "energy" in q.stem:
                assert (num(q.answer) * 100).denominator == 1, q.answer  # "0.3125 J" was rounded by every reviewer
        e, L, step = float(Fraction(p["cm_per_n"])), p["limit"], p["step"]
        below = (m.extension(p, L) - m.extension(p, L - 0.01 * step)) / (0.01 * step)
        above = (m.extension(p, L + 0.01 * step) - m.extension(p, L)) / (0.01 * step)
        assert above >= 1.4 * below, (s, below, above)  # the line bends visibly at the limit, not gradually


def test_a_dial_has_few_enough_divisions_to_count():
    """Dials of 30 to 50 small divisions were misread by one division (P3f review, 8 of 30 passed)."""
    m = fam("meter_dial")
    for s in range(1, 301):
        p, qs = run(m, s)
        steps = Fraction(p["full"]) / Fraction(p["minor"])
        k = Fraction(p["value"]) / Fraction(p["minor"])
        assert steps.denominator == 1 and steps <= 12, (p["full"], p["minor"])  # 20 still misread (P3f re-review)
        assert 2 <= k <= steps - 2, (k, steps)  # not on the stop at either end
        assert qs[2].stem.startswith("The needle shows the first reading."), qs[2].stem


def test_a_lamp_curve_keeps_rising_like_a_real_filament():
    """A curve flat at the top looked like no component (P3f review): a filament's current still rises by a
    third or more over the top half of the range."""
    m = fam("iv_graph")
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        if p["kind"] == "lamp":
            assert m.current(p, 12) >= 1.33 * m.current(p, 6) - 1e-9, p


def test_the_transformer_says_its_coils_are_not_to_scale():
    m = fam("transformer")
    fig = m.draw(m.sample(random.Random(1)))
    texts = [t.get_text() for t in fig.axes[0].texts]
    plt.close(fig)
    assert "coils not drawn to scale" in texts


def test_the_lens_asks_how_many_times_as_tall_not_a_signed_magnification():
    """"What is the magnification?" drew "2 (or -2 with sign)" from 8 of 9 reviewers (P3f review)."""
    m = fam("lens_diagram")
    for s in range(1, 200):
        p, qs = run(m, s)
        assert qs[2].stem == "How many times as tall as the object is the image?", qs[2].stem
        assert "drawn here as an arrow" in qs[0].stem


def test_the_transformer_is_stated_ideal_and_its_settings_real():
    m = fam("transformer")
    for s in range(1, 200):
        p, qs = run(m, s)
        assert "ideal" in qs[0].stem, qs[0].stem
        assert not any("model railway" in q.stem for q in qs)


def test_the_resistance_at_p_is_v_over_i():
    """"Resistance at P" read as the gradient by some reviewers (P3f review): say V ÷ I."""
    m = fam("iv_graph")
    for s in range(1, 100):
        p, qs = run(m, s)
        assert "(V ÷ I)" in qs[0].stem, qs[0].stem


def test_each_decay_question_is_read_on_the_plotted_grid():
    """"After 30 hours" read 6.25 Bq off every gridline, and "fall to half" repeated the half-life (P3f review)."""
    m = fam("decay_graph")
    for s in range(1, 301):
        p, qs = run(m, s)
        assert qs[0].stem.endswith("What half-life does the graph show?"), qs[0].stem  # not one known by heart
        t = Fraction(re.search(r"after ([\d.,]+)", qs[1].stem).group(1).replace(",", ""))
        n = t / p["half"]
        assert n <= p["end"] and (Fraction(p["A0"], 2 ** int(n)) % p["ystep"]) == 0, (s, n)
        target = Fraction(re.search(r"fall to ([\d.,]+)", qs[2].stem).group(1).replace(",", ""))
        assert Fraction(p["A0"]) / target >= 4  # two half-lives or more: not the first question again


def test_an_atom_has_few_enough_particles_to_count_and_its_key_shows():
    """39 nucleons were miscounted (P3f review); hydrogen's key was cut at the top."""
    m = fam("nucleus")
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        assert p["A"] <= 27, p
    fig = m.draw({"band": "UP", "Z": 1, "A": 1, "beta": False, "electrons": True})
    lo, hi = fig.axes[0].get_ylim()
    plt.close(fig)
    assert hi >= 1.0 + 0.12 + 0.2 and lo <= -0.2


def test_the_lens_axes_are_numbered_in_centimetres_from_the_lens():
    """Reviewers counting 17-pixel squares read 70 cm for 36 (P3f re-review): number the distances."""
    m = fam("lens_diagram")
    for s in range(1, 40):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        fig.canvas.draw()
        ax = fig.axes[0]
        xs = [t.get_text() for t in ax.get_xticklabels() if t.get_text()]  # a distance appears on both sides of the lens
        ys = [t.get_text() for t in ax.get_yticklabels() if t.get_text()]
        plt.close(fig)
        assert "0" in xs and len(xs) >= 4 and all(int(x) % p["scale"] == 0 for x in xs), xs
        assert len(ys) >= 3, ys
        v, _ = m.image(p)
        width = max(v, p["f"]) + 3 - min(-p["u"], v, -p["f"]) + 2
        assert width <= 30, width  # squares across
