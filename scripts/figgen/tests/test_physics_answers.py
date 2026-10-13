"""Answers of the Physics wave (P3e), recomputed from each figure's numbers over 1,000 seeds, with the
physics each figure must obey checked on what is drawn (P3e Review Focus 5)."""
import math
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


def test_force_diagram():
    m = fam("force_diagram")
    for s in SEEDS:
        p, (resultant, accel, weight) = run(m, s)
        net = sum(f if d == "right" else -f for d, f in p["forces"])
        assert net != 0
        size, way = abs(net), "right" if net > 0 else "left"
        assert picked(resultant) == f"{size} N to the {way}"
        assert all(o != picked(resultant) for i, o in enumerate(resultant.options) if i != int(resultant.answer))
        assert num(accel.answer) == Fraction(size, p["mass"]) and (2 * Fraction(size, p["mass"])).denominator == 1  # a = F/m
        assert "g = 10 N/kg" in weight.stem and num(weight.answer) == 10 * p["mass"]
        total = sum(f for _, f in p["forces"])
        # Size (the resultant, or all the forces added up) by direction: a 2 x 2 set, nothing to pick unseen.
        assert set(resultant.options) == {f"{v} N to the {w}" for v in (size, total) for w in ("right", "left")}


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
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] == "manometer":
            height, pressure, higher = qs
            h = abs(p["left"] - p["right"])
            assert int(height.answer) == h and h > 0
            assert "g = 10 N/kg" in pressure.stem and num(pressure.answer) == Fraction(1000 * 10 * h, 100)  # ρgh, h in m
            # The gas pushes its side down: the lower level is the side at the higher pressure.
            assert picked(higher) == ("the gas supply" if p["left"] < p["right"] else "the open air")
        else:
            a, b, c = p["dims"]  # cm
            pressure, most = qs
            w, h = p["face"]
            area = Fraction(w * h, 10000)  # m²
            assert num(pressure.answer) == p["weight"] / area and (p["weight"] / area).denominator == 1
            smallest = sorted([(a, b), (a, c), (b, c)], key=lambda f: f[0] * f[1])[0]
            assert picked(most) == f"the {max(smallest)} cm by {min(smallest)} cm face"


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
        if len(qs) > 3:
            t = int(re.search(r"in (\d+) s", qs[3].stem).group(1))
            assert num(qs[3].answer) == Fraction(total_in, t) and Fraction(total_in, t).denominator == 1


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
    m = fam("circuit")
    for s in SEEDS:
        p, qs = run(m, s)
        total, I, currents = solve(p)
        R = [Fraction(r) for r in p["resistors"]]
        resistance, ammeter, voltmeter, power = qs[:4]
        assert num(resistance.answer) == total
        assert num(ammeter.answer) == (currents[p["ammeter"]] if p["ammeter"] is not None else I)
        across = p["voltmeter"]
        assert num(voltmeter.answer) == currents[across] * R[across]  # V = IR across that resistor
        k = int(re.search(r"resistor R(\d)", power.stem).group(1)) - 1
        assert num(power.answer) == currents[k] ** 2 * R[k]  # P = I²R
        # Every value a student writes is exact to two decimal places.
        assert all((v * 100).denominator == 1 for v in [total, I, *currents, currents[across] * R[across], currents[k] ** 2 * R[k]])
        if p["kind"] != "series":
            assert sum(currents[1:] if p["kind"] == "mixed" else currents) == I  # Kirchhoff: currents at a junction


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
        direction, bigger, rule, amount = qs[:4]
        assert picked(direction) == want
        # Two axes, both ways along each: the key cannot be told from the options alone.
        assert len(direction.options) == 4 and all(o in VEC for o in direction.options)
        assert len({tuple(map(abs, VEC[o])) for o in direction.options}) == 2
        assert {o for o in direction.options if tuple(map(abs, VEC[o])) == tuple(map(abs, VEC[want]))} == {want, named(tuple(-c for c in VEC[want]))}
        assert picked(bigger).startswith(("a larger", "a stronger", "moving the wire faster")) and "same" in picked(bigger)
        assert picked(rule) == ("Fleming's left-hand rule" if p["mode"] == "motor" else "Fleming's right-hand rule")
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
            elif q.kind == "mcq":
                assert picked(q) == ("Energy is taken in as the forces between the particles are overcome" if p["kind"] == "ice"
                                     else "Energy is given out as the forces between the particles form")


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
            assert num(n_q.answer) == Fraction(f"{n:.2f}")
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
        # Typed, not chosen: six regions are on the figure, so any list of regions gives the seventh away.
        assert missing.kind == "short" and missing.answer == EM[p["blank"]]
        long_end = any(w in extreme.stem for w in ("longest wavelength", "lowest frequency", "least energy"))
        assert picked(extreme) == ("radio waves" if long_end else "gamma rays")
        assert picked(use) == next(r for k, r in EM_USES.items() if k in use.stem)
