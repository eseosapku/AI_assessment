"""Communication signals (LS, UP, AL): the signals and channels of telecommunication. Five kinds:

- types (LS, UP): four voltage-time graphs, A to D, two analogue and two digital (eight bits each, high = 1, low = 0);
  asks which two are digital, the binary code a digital graph carries, and for how long a graph is at its high voltage.
- sampling (UP, AL): an analogue signal sampled at regular times, the samples dotted on whole-number levels; asks a
  sample's level, the samples taken each second, the bits each sample needs for the levels on the axis, and the binary
  code of a sample or the bit rate (samples per second × bits per sample, printed).
- am (UP, AL): an amplitude-modulated wave on a time grid, one carrier cycle per grid square and its outline dotted;
  asks the carrier frequency, the signal frequency, the bandwidth (2 × the signal frequency, printed) and, at AL, the
  highest frequency transmitted (carrier + signal).
- blocks (UP): the block diagram of a radio transmitter or receiver, the signal on each link lettered, with a printed
  table of what each block does; asks which lettered point carries a described signal.
- attenuation (AL): the signal power at three points A, B and C along a cable or an optical fibre, the lengths printed;
  attenuation in dB = 10 lg(P₁ ÷ P₂) printed, each stretch dividing the power by a whole power of ten. Asks the
  attenuation from A to B, the attenuation per kilometre, and the gain an amplifier at C needs to restore A's power.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from ..core import GRID, INK, NAMES, Question, exact, new_figure, short
from ._bio_parts import letter_choice

ID = "comm_signals"
KIND = "physics.wave"
SUBJECT = "physics"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"physics.{c}" for c in ("analog-and-digital-signals", "communication-systems", "modulation-and-transmission",
                                          "radio-transmission", "antennas", "waves"))
NEEDS = r"signal|communicat|modulat|transmission|telecommunicat|radio|channel|carrier|antenna|microphone|\banalog|\bdigital"
# Not hearing, power lines, electronics or optical-fibre chapters (they share a concept but teach other figures).
AVOID = r"hearing|transmission of electricity|electronic|optical fib|orbit|glossary|thinking and working scientifically"
KINDS = {"LS": ["types"], "UP": ["types", "sampling", "am", "blocks"], "AL": ["sampling", "am", "attenuation"]}
LETTER_SETS = ["PQRST", "ABCDE", "JKLMN", "VWXYZ"]


def concepts_for(p: dict) -> tuple[str, ...]:
    signals = ("physics.analog-and-digital-signals", "physics.communication-systems")
    if p["kind"] == "types":
        return signals + (("physics.waves",) if p["band"] == "LS" else ())
    if p["kind"] == "sampling":
        return signals
    if p["kind"] == "am":
        return signals + ("physics.modulation-and-transmission", "physics.radio-transmission")
    if p["kind"] == "blocks":
        return ("physics.communication-systems", "physics.modulation-and-transmission", "physics.radio-transmission",
                "physics.antennas")
    return ("physics.communication-systems",)


def _bits(rng: random.Random) -> str:
    while True:
        b = "".join(rng.choice("01") for _ in range(8))
        if 2 <= b.count("1") <= 6 and "01" in b and "10" in b:
            return b


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(KINDS[band])
    if kind == "types":
        digital = rng.sample(range(4), 2)
        codes = [_bits(rng)]
        while len(codes) < 2:
            c = _bits(rng)
            if c != codes[0]:
                codes.append(c)
        graphs = []
        for i, L in enumerate("ABCD"):
            if i in digital:
                graphs.append([L, "digital", codes[digital.index(i)]])
            else:
                graphs.append([L, "analogue", [rng.choice([1.2, 1.5, 1.8]), rng.choice([1, 2]), rng.choice([0.3, 0.5]),
                                               rng.choice([3, 4, 5]), rng.randrange(4)]])
        return {"band": band, "kind": "types", "graphs": graphs, "high": 5, "bit_ms": rng.choice([1, 2, 5])}
    if kind == "sampling":
        top = rng.choice([7, 15])
        n = rng.randint(8, 12)
        while True:
            c, a1, a2 = top / 2, rng.uniform(0.25, 0.4) * top, rng.uniform(0.05, 0.12) * top
            per, ph = rng.uniform(6, 10), rng.uniform(0, 2 * math.pi)
            vals = [min(top - 1, max(1, round(c + a1 * math.sin(2 * math.pi * i / per + ph) + a2 * math.sin(4.3 * i + ph))))
                    for i in range(n)]
            if len(set(vals)) >= 4:
                break
        return {"band": band, "kind": "sampling", "top": top, "dt": rng.choice(["0.5", "1", "2", "5"]), "values": vals}
    if kind == "am":
        return {"band": band, "kind": "am", "Tc": rng.choice([5, 10, 20, 25]), "k": rng.choice([8, 10]),
                "A": rng.choice([3, 4]), "m": rng.choice([1, 2])}
    if kind == "blocks":
        letters = list(rng.choice(LETTER_SETS))
        rng.shuffle(letters)
        return {"band": band, "kind": "blocks", "chain": rng.choice(["transmitter", "receiver"]), "letters": letters}
    medium = rng.choice(["cable", "optical fibre"])
    n1 = rng.randint(1, 3)
    n2 = rng.randint(1, 4 - n1)
    return {"band": band, "kind": "attenuation", "medium": medium,
            "rate": rng.choice(["2", "2.5", "4", "5"] if medium == "cable" else ["0.2", "0.25", "0.4", "0.5"]),
            "PA": rng.choice(["10", "20", "40", "50", "80", "100", "200", "500"]), "n": [n1, n2]}


# --- drawing ------------------------------------------------------------------------------------------------------

def _analogue(spec, t: float, T: float) -> float:
    a1, k1, a2, k2, ph = spec
    return 2.5 + a1 * math.sin(2 * math.pi * k1 * t / T + ph * math.pi / 2) + a2 * math.sin(2 * math.pi * k2 * t / T)


def _draw_types(p: dict):
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(2, 2, figsize=(7.8, 5.8))
    fig.subplots_adjust(hspace=0.55, wspace=0.28)
    b = p["bit_ms"]
    T = 8 * b
    for ax, (L, kind, spec) in zip(axes.flat, p["graphs"]):
        if kind == "digital":
            xs, ys = [], []
            for i, bit in enumerate(spec):
                lvl = p["high"] if bit == "1" else 0
                xs += [i * b, (i + 0.5) * b, (i + 1) * b]
                ys += [lvl, lvl, lvl]
        else:
            xs = [T * i / 400 for i in range(401)]
            ys = [_analogue(spec, x, T) for x in xs]
        ax.plot(xs, ys, color=INK, linewidth=1.8, gid=f"signal:{L}")
        ax.set_xlim(0, T)
        ax.set_ylim(-0.3, 6)
        ax.set_xticks([i * b for i in range(9)])
        ax.set_yticks(range(7))
        ax.grid(True, color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        ax.set_title(f"Graph {L}", fontsize=11, fontweight="bold")
        ax.tick_params(labelsize=10)
        ax.set_xlabel("Time (ms)", fontsize=10)
        ax.set_ylabel("Voltage (V)", fontsize=10)
    return fig


def _catmull(points, steps: int = 24):
    pts = [points[0]] + points + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            out.append((x1 + (x2 - x1) * t,
                        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3)))
    out.append(points[-1])
    return out


def _draw_sampling(p: dict):
    fig, ax = new_figure(7.4, 4.6)
    dt, vals, top = Fraction(p["dt"]), p["values"], p["top"]
    ts = [float(i * dt) for i in range(len(vals))]
    curve = _catmull(list(zip(ts, vals)))
    ax.plot([x for x, _ in curve], [y for _, y in curve], color=INK, linewidth=1.5, gid="signal")
    ax.plot(ts, vals, linestyle="none", marker="o", markersize=6.5, color="#c0392b", gid="samples")
    end = float(len(vals) * dt)
    every = 1 if len(vals) <= 10 else 2
    ax.set_xticks([float(i * dt) for i in range(0, len(vals) + 1, every)], [exact(i * dt) for i in range(0, len(vals) + 1, every)])
    ax.set_xticks([float(i * dt) for i in range(len(vals) + 1)], minor=True)
    ax.set_yticks(range(0, top + 1))
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(-float(dt) / 4, end)
    ax.set_ylim(0, top + 0.6)
    ax.set_xlabel("Time (ms)")
    ax.set_ylabel("Level")
    ax.set_title("The red dots are samples of the analogue signal", fontsize=10)
    ax.tick_params(labelsize=9)
    return fig


def _draw_am(p: dict):
    fig, ax = new_figure(7.6, 4.0)
    Tc, k, A, m = p["Tc"], p["k"], p["A"], p["m"]
    end = 2 * k * Tc
    n = 60 * 2 * k
    xs = [end * i / n for i in range(n + 1)]
    env = [A + m * math.sin(2 * math.pi * x / (k * Tc)) for x in xs]
    ax.plot(xs, [e * math.sin(2 * math.pi * x / Tc) for x, e in zip(xs, env)], color=INK, linewidth=1.1, gid="am")
    for sign in (1, -1):
        ax.plot(xs, [sign * e for e in env], color="#555555", linewidth=0.9, linestyle=(0, (2, 2)), gid="outline")
    ax.set_xticks(range(0, end + 1, 2 * Tc))
    ax.set_xticks(range(0, end + 1, Tc), minor=True)
    ax.set_yticks(range(-(A + m + 1), A + m + 2))
    ax.grid(True, which="both", color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, end)
    ax.set_ylim(-(A + m + 1), A + m + 1)
    ax.axhline(0, color=INK, linewidth=0.7)
    ax.set_xlabel("Time (μs)")
    ax.set_ylabel("Voltage (V)")
    ax.set_title("An amplitude-modulated (AM) wave; dotted line = its outline", fontsize=10)
    ax.tick_params(labelsize=8.5)
    return fig


CHAINS = {
    "transmitter": (["microphone", "AF\namplifier", "modulator", "RF power\namplifier", "aerial"], "oscillator"),
    "receiver": (["aerial", "tuning\ncircuit", "RF\namplifier", "demodulator", "AF\namplifier", "loudspeaker"], None),
}
JOBS = {
    "transmitter": [("microphone", "changes sound into an audio-frequency (AF) electrical signal"),
                    ("AF amplifier", "makes the audio signal larger"),
                    ("oscillator", "produces the high-frequency carrier wave"),
                    ("modulator", "combines the audio signal with the carrier wave"),
                    ("RF power amplifier", "makes the modulated wave much stronger"),
                    ("aerial", "sends the signal out as radio waves")],
    "receiver": [("aerial", "picks up the radio waves of many stations"),
                 ("tuning circuit", "selects the frequency of one station"),
                 ("RF amplifier", "makes the selected signal stronger"),
                 ("demodulator", "removes the carrier, leaving the audio signal"),
                 ("AF amplifier", "makes the audio signal larger"),
                 ("loudspeaker", "changes the audio signal into sound")],
}


def _link(ax, a, b):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=12, color=INK, linewidth=1.3, shrinkA=0, shrinkB=0))


def _letter(ax, x, y, L):
    ax.text(x, y, L, ha="center", va="center", fontsize=12, fontweight="bold",
            bbox=dict(boxstyle="circle,pad=0.18", facecolor="white", edgecolor=INK, linewidth=1.1))


def _draw_blocks(p: dict):
    names, extra = CHAINS[p["chain"]]
    fig, ax = new_figure(7.8 if extra else 8.8, 5.6)
    w, gap, h, y = (1.75, 0.65, 0.95, 4.2) if extra else (1.75, 0.5, 0.95, 4.2)  # wide enough for "microphone"
    lefts = [0.2 + i * (w + gap) for i in range(len(names))]
    for x, name in zip(lefts, names):
        ax.add_patch(FancyBboxPatch((x, y - h / 2), w, h, boxstyle="round,pad=0.02", facecolor="#eef1f4", edgecolor=INK,
                                    linewidth=1.1))
        ax.text(x + w / 2, y, name, ha="center", va="center", fontsize=9.5 if extra else 9, linespacing=1.1)
    links = [((lefts[i] + w, y), (lefts[i + 1], y)) for i in range(len(names) - 1)]
    spots = [((a[0] + b[0]) / 2, y + 0.62) for a, b in links]
    if extra:  # the oscillator feeds the modulator from below
        ox = lefts[2]
        ax.add_patch(FancyBboxPatch((ox, 2.15 - h / 2), w, h, boxstyle="round,pad=0.02", facecolor="#eef1f4", edgecolor=INK,
                                    linewidth=1.1))
        ax.text(ox + w / 2, 2.15, extra, ha="center", va="center", fontsize=9.5)
        links.insert(2, ((ox + w / 2, 2.15 + h / 2), (ox + w / 2, y - h / 2)))
        spots.insert(2, (ox + w / 2 + 0.42, (2.15 + y) / 2))
    for (a, b), (sx, sy), L in zip(links, spots, p["letters"]):
        _link(ax, a, b)
        _letter(ax, sx, sy, L)
    top = 1.05 if extra else 2.95
    ax.text(0.2, top, "Block", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(3.1, top, "What it does", ha="left", va="center", fontsize=10, fontweight="bold")
    for i, (name, job) in enumerate(JOBS[p["chain"]]):
        ax.text(0.2, top - 0.42 * (i + 1), name, ha="left", va="center", fontsize=9.5)
        ax.text(3.1, top - 0.42 * (i + 1), job, ha="left", va="center", fontsize=9.5)
    ax.text(lefts[-1] + w, y + 1.15, f"A radio {p['chain']}", ha="right", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(0, lefts[-1] + w + 0.2)
    ax.set_ylim(top - 0.42 * 7 - 0.1, y + 1.45)
    ax.axis("off")
    return fig


def _draw_attenuation(p: dict):
    fig, ax = new_figure(7.8, 3.6)
    n1, n2 = p["n"]
    rate = Fraction(p["rate"])
    L1, L2 = 10 * n1 / rate, 10 * n2 / rate
    PA = Fraction(p["PA"])
    powers = [PA, PA / 10 ** n1, PA / 10 ** (n1 + n2)]
    xb = min(7.2, max(2.8, 0.6 + 8.8 * float(L1 / (L1 + L2))))
    xs = [0.6, xb, 9.4]
    ax.plot([0.6, 9.4], [1.0, 1.0], color="#8a6d3b" if p["medium"] == "cable" else "#2f6fa3", linewidth=4, solid_capstyle="butt",
            gid="medium")
    for x, L, P in zip(xs, "ABC", powers):
        ax.plot([x], [1.0], marker="o", markersize=8, color=INK)
        ax.text(x, 1.75, f"{L}\npower = {exact(P)} mW", ha="center", va="center", fontsize=9.5, linespacing=1.3,
                bbox=dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor=INK, linewidth=0.9))
    for (a, b), L in zip(((xs[0], xs[1]), (xs[1], xs[2])), (L1, L2)):
        ax.add_patch(FancyArrowPatch((a, 0.45), (b, 0.45), arrowstyle="<|-|>", mutation_scale=10, color=INK, linewidth=1.0,
                                     shrinkA=0, shrinkB=0))
        ax.text((a + b) / 2, 0.3, f"{exact(L)} km", ha="center", va="top", fontsize=10)
    ax.text(5.0, 2.75, f"Signal power along {'a cable' if p['medium'] == 'cable' else 'an optical fibre'} (not to scale)\n"
            "attenuation in dB = 10 lg(P₁ ÷ P₂)", ha="center", va="center", fontsize=10.5, linespacing=1.4)
    ax.set_xlim(-0.6, 10.6)
    ax.set_ylim(-0.15, 3.15)
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"types": _draw_types, "sampling": _draw_sampling, "am": _draw_am, "blocks": _draw_blocks,
            "attenuation": _draw_attenuation}[p["kind"]](p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a lesson on telecommunication", "at the science club", "for a project on how phones work", "for homework",
            "in a revision class", "during a physics practical", "for a class presentation", "in a lesson on radio"]
POINTS = {
    "transmitter": ["the small audio-frequency signal straight from the microphone",
                    "the larger audio signal, not yet combined with the carrier",
                    "the carrier wave alone, before it is modulated",
                    "the modulated wave, before it is made stronger",
                    "the strong modulated wave on its way to the aerial"],
    "receiver": ["the signals of many radio stations, as the aerial picks them up",
                 "one station's modulated signal, before it is made stronger",
                 "one station's stronger modulated signal, before the carrier is removed",
                 "the audio signal with the carrier removed, before it is made larger",
                 "the larger audio signal on its way to the loudspeaker"],
}


def _khz(x: Fraction) -> list[str]:
    e = exact(x)
    return [e, f"{e} kHz", f"{e}kHz"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    kind = p["kind"]
    if kind == "types":
        digital = sorted(L for L, k, _ in p["graphs"] if k == "digital")
        others = sorted(set("ABCD") - set(digital))
        key = f"{digital[0]} and {digital[1]}"
        mixed = [f"{a} and {b}" if a < b else f"{b} and {a}" for a in digital for b in others]
        options = [key, f"{others[0]} and {others[1]}"] + rng.sample(mixed, 2)
        rng.shuffle(options)
        L = rng.choice(digital)
        L2 = digital[1] if L == digital[0] else digital[0]
        code = next(s for G, _, s in p["graphs"] if G == L)
        ones = next(s for G, _, s in p["graphs"] if G == L2).count("1")
        b = p["bit_ms"]
        return [Question("mcq", f"{who} drew four signals {setting}. Which two graphs show digital signals?",
                         str(options.index(key)), options),
                short(f"In graph {L}, a high voltage stands for 1 and a low voltage for 0, and each bit lasts {b} ms. "
                      f"What binary code does graph {L} carry, read from left to right?", code,
                      [code, " ".join(code), code[:4] + " " + code[4:]]),
                short(f"For how many milliseconds altogether is the signal in graph {L2} at its high voltage?", ones * b,
                      [str(ones * b), f"{ones * b} ms", f"{ones * b}ms", f"{ones * b} milliseconds"])]
    if kind == "sampling":
        dt, vals, top = Fraction(p["dt"]), p["values"], p["top"]
        bits = {7: 3, 15: 4}[top]
        i, j = rng.sample(range(len(vals)), 2)
        per_s = int(1000 / dt)
        qs = [short(f"{who} studied how an analogue signal is changed into a digital one {setting}. The dots show the samples. "
                    f"What is the level of the sample taken at t = {exact(i * dt)} ms?", vals[i], [str(vals[i]), f"level {vals[i]}"]),
              short("How many samples are taken each second?", per_s, [str(per_s), f"{per_s} samples", f"{per_s:,}",
                                                                     f"{per_s} samples per second", f"{per_s} Hz"]),
              short("Each sample is sent as a binary number with enough bits for every level on the vertical axis. "
                    "How many bits does each sample need?", bits, [str(bits), f"{bits} bits"])]
        if rng.random() < 0.5:
            code = format(vals[j], f"0{bits}b")
            qs.append(short(f"What binary number is sent for the sample taken at t = {exact(j * dt)} ms?", code, [code]))
        else:
            rate = per_s * bits
            qs.append(short("The bit rate = samples per second × bits per sample. What is the bit rate, in bits per second?",
                            rate, [str(rate), f"{rate} bits per second", f"{rate} bit/s", f"{rate} b/s"]))
        return qs
    if kind == "am":
        Tc, k = p["Tc"], p["k"]
        fc, fs = Fraction(1000, Tc), Fraction(1000, Tc * k)
        qs = [short(f"{who} looked at an AM radio signal on an oscilloscope {setting}. Each small square across is one cycle "
                    "of the carrier wave. What is the frequency of the carrier wave, in kHz?", exact(fc), _khz(fc)),
              short("The dotted outline has the shape of the audio signal that modulates the carrier. What is the signal "
                    "frequency, in kHz?", exact(fs), _khz(fs)),
              short("For AM, the bandwidth = 2 × the signal frequency. What bandwidth does this transmission need, in kHz?",
                    exact(2 * fs), _khz(2 * fs))]
        if p["band"] == "AL":
            qs.append(short("The transmitted signal holds frequencies from (carrier − signal) to (carrier + signal). What is the "
                            "highest of these frequencies, in kHz?", exact(fc + fs), _khz(fc + fs)))
        return qs
    if kind == "blocks":
        letters = p["letters"]
        picks = rng.sample(range(5), 3)
        qs = []
        for n, i in enumerate(picks):
            lead = (f"{who} drew the block diagram of a radio {p['chain']} {setting}. Using the table, at which lettered point "
                    if n == 0 else "Using the table, at which lettered point ")
            wrong = rng.sample([L for L in letters if L != letters[i]], 3)
            qs.append(letter_choice(f"{lead}is the signal {POINTS[p['chain']][i]}?", letters[i], wrong))
        return qs
    n1, n2 = p["n"]
    rate = Fraction(p["rate"])
    medium = "the cable" if p["medium"] == "cable" else "the optical fibre"
    return [short(f"{who} measured the signal power at three points along {medium} {setting}. What is the attenuation of the "
                  "signal between A and B, in dB?", 10 * n1, [str(10 * n1), f"{10 * n1} dB", f"{10 * n1}dB"]),
            short(f"What is the attenuation per kilometre of {medium}, in dB/km?", exact(rate),
                  [exact(rate), f"{exact(rate)} dB/km", f"{exact(rate)} dB per km"]),
            short("An amplifier at C restores the signal to the power it had at A. What gain must the amplifier give, in dB?",
                  10 * (n1 + n2), [str(10 * (n1 + n2)), f"{10 * (n1 + n2)} dB", f"{10 * (n1 + n2)}dB"])]
