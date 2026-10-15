"""Sensor control (UP, AL): a microprocessor controlling a greenhouse in Huye, with its sensor readings over a morning
in a table and the state of the actuators before the first reading. Two forms:

- a flowchart (Start, INPUT from the sensor, two decisions with their set points, three boxes setting the two
  actuators, a wait, and the loop back), for temperature (heater and window motor) or light (lamps and blind motor);
- a block diagram of the control loop (sensor, ADC, microprocessor and actuator, each lettered with its name beneath,
  in a feedback loop with the greenhouse, drawn left to right or right to left), with the program's one rule, for a
  heater, a cooling fan, a sprinkler (soil moisture) or lamps.

Asks what the actuators are doing just after a given reading, how many times one changes from OFF to ON (OFF before
the first reading, said in the stem: "switched on" read as every ON box run in the blind review), what the program
does when a reading equals a set point (each decision's test is printed: < or <=, > or >=), and either how many
readings leave the window open (or blind closed) or which letter is the actuator.

Every key is the rule applied to each reading in turn. The four statements are both actuators' states crossed.
"""
from __future__ import annotations

import random

from matplotlib.patches import Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "sensor_control"
KIND = "process.flow"
SUBJECT = "computing"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"computing.{c}" for c in ("monitoring-control-systems", "microprocessor-controlled-devices",
                                             "automated-system-design"))
# A topic whose sections the book lists is reached only if one names monitoring, control, sensors or actuators.
NEEDS = r"monitoring|control (?:system|application)|controlled|automated system|sensor|actuator|feedback|measurement application"
AVOID = r"proofing|effects of using|role and impact|spreadsheet|database|network|security|\bpresentation|email|html|python|operating system"
FILL = "#eef1f3"
HEAD = "#d9dee3"
OPS = {"<": lambda a, b: a < b, "≤": lambda a, b: a <= b, ">": lambda a, b: a > b, "≥": lambda a, b: a >= b}
# What each actuator being on or off looks like, as an option says it.
SAYS = {"heater": ("the heater is on", "the heater is off"), "window motor": ("the window is open", "the window is closed"),
        "lamps": ("the lamps are on", "the lamps are off"), "blind motor": ("the blind is closed", "the blind is open"),
        "cooling fan": ("the cooling fan is on", "the cooling fan is off"), "sprinkler": ("the sprinkler is on", "the sprinkler is off")}
SENSOR = {"temperature": ("T", "°C", "temperature sensor"), "light": ("L", "lux", "light sensor"),
          "moisture": ("M", "%", "moisture sensor")}
QUANTITY = {"temperature": "Temperature (°C)", "light": "Light level (lux)", "moisture": "Soil moisture (%)"}
PARTS = ["sensor", "ADC", "microprocessor", "actuator"]


def states(p: dict, reading: int) -> dict:
    """Whether each actuator is on just after a reading: the low one below its set point, the high one above."""
    return {side: OPS[p[side]["op"]](reading, p[side]["set"]) for side in ("low", "high") if p[side]}


def _walk(rng, lo, hi, start, steps, grain):
    vals = [start]
    for _ in range(7):
        v = vals[-1] + rng.choice(steps) * grain
        vals.append(min(hi, max(lo, v)))
    return vals


def sample(rng: random.Random) -> dict:
    form = rng.choice(["flowchart", "block"])
    band = rng.choice(BANDS)
    every = rng.choice([30, 60])
    h0 = rng.randint(6, 8)
    times = [f"{h0 + (i * every) // 60:02d}:{(i * every) % 60:02d}" for i in range(8)]
    while True:
        if form == "flowchart":
            sensor = rng.choice(["temperature", "light"])
            if sensor == "temperature":
                lo = rng.randint(15, 19)
                hi = lo + rng.randint(7, 10)
                low, high = {"device": "heater", "set": lo}, {"device": "window motor", "set": hi}
                vals = _walk(rng, lo - 6, hi + 6, rng.randint(lo - 4, lo + 1), [-3, -2, -1, 1, 2, 3, 4, 5], 1)
            else:
                lo = rng.choice(range(200, 450, 50))
                hi = lo + rng.choice(range(400, 650, 50))
                low, high = {"device": "lamps", "set": lo}, {"device": "blind motor", "set": hi}
                vals = _walk(rng, lo - 150, hi + 200, lo + rng.choice(range(-120, 20, 10)), [-3, 2, 4, 6, 8, 10], 25)  # morning: brighter
            low["op"], high["op"] = rng.choice(["<", "≤"]), rng.choice([">", "≥"])
        else:
            sensor, device, side = rng.choice([("temperature", "heater", "low"), ("temperature", "cooling fan", "high"),
                                               ("moisture", "sprinkler", "low"), ("light", "lamps", "low")])
            if sensor == "temperature":
                point = rng.randint(15, 20) if side == "low" else rng.randint(25, 30)
                vals = _walk(rng, point - 7, point + 7, point + rng.randint(-4, 3), [-3, -2, -1, 1, 2, 3], 1)
            elif sensor == "moisture":
                point = rng.choice(range(30, 55, 5))
                vals = _walk(rng, point - 20, point + 25, point + rng.randint(-8, 8), [-6, -4, -3, 3, 5, 8], 1)
            else:
                point = rng.choice(range(200, 450, 50))
                vals = _walk(rng, point - 150, point + 300, point + rng.choice(range(-120, 20, 10)), [-3, -2, 2, 3, 4, 6], 25)
            rule = {"device": device, "set": point, "op": rng.choice(["<", "≤"] if side == "low" else [">", "≥"])}
            low, high = (rule, None) if side == "low" else (None, rule)
        p = {"band": band, "form": form, "sensor": sensor, "low": low, "high": high, "times": times, "readings": vals,
             "every": every}
        st = [states(p, v) for v in vals]
        sides = [s for s in ("low", "high") if p[s]]
        if any(min(sum(x[s] for x in st), sum(not x[s] for x in st)) < 2 for s in sides):
            continue  # each actuator both on and off at least twice
        if form == "flowchart" and sum(not x["low"] and not x["high"] for x in st) < 2:
            continue  # and some readings between the set points
        if len(set(vals)) < 6:
            continue
        p["ask_time"] = rng.randrange(8)
        p["ask_equal"] = rng.choice(sides)
        if form == "block":
            p["flow"] = rng.choice(["ltr", "rtl"])
            p["letters"] = dict(zip(PARTS, rng.sample("PQRS", 4)))
            p["ask_part"] = "actuator"  # every block is named, so only the actuator takes knowing which it is
        else:
            p["letters"] = {}
        return p


# --- drawing ---------------------------------------------------------------------------------------

def _arrow(ax, a, b):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.3, shrinkA=0, shrinkB=0, mutation_scale=14))


def _text(ax, x, y, s, size=10.5, **kw):
    ax.text(x, y, s, ha="center", va="center", fontsize=size, linespacing=1.25, **kw)


def _box(ax, x, y, w, h, s, size=10.5, fill=FILL, **kw):
    ax.add_patch(Rectangle((x - w / 2, y - h / 2), w, h, facecolor=fill, edgecolor=INK, linewidth=1.3))
    _text(ax, x, y, s, size, **kw)


def _action(p: dict, low_on: bool, high_on: bool) -> str:
    """A flowchart box: what it does to each actuator."""
    if p["sensor"] == "temperature":
        return f"Switch heater {'ON' if low_on else 'OFF'}\n{'Open' if high_on else 'Close'} window"
    return f"Switch lamps {'ON' if low_on else 'OFF'}\n{'Close' if high_on else 'Open'} blind"


def _table(ax, p, x, top, vertical: bool):
    times, vals = p["times"], p["readings"]
    if vertical:
        cw, rh = [1.4, 2.6], 0.55
        for j, (head, w) in enumerate(zip(["Time", QUANTITY[p["sensor"]]], cw)):
            ax.add_patch(Rectangle((x + sum(cw[:j]), top - rh), w, rh, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
            _text(ax, x + sum(cw[:j]) + w / 2, top - rh / 2, head, 9, fontweight="bold")
        for i, (t, v) in enumerate(zip(times, vals)):
            y = top - (i + 2) * rh
            ax.add_patch(Rectangle((x, y), cw[0], rh, facecolor="#f2f3f4", edgecolor=INK, linewidth=1.0))
            ax.add_patch(Rectangle((x + cw[0], y), cw[1], rh, facecolor="white", edgecolor=INK, linewidth=1.0))
            _text(ax, x + cw[0] / 2, y + rh / 2, t, 10, gid=f"time:{i}")
            _text(ax, x + cw[0] + cw[1] / 2, y + rh / 2, str(v), 10.5, gid=f"reading:{i}")
        return top - 9 * rh
    lw, cw, rh = 2.5, 1.15, 0.55
    for r, (head, row) in enumerate((("Time", times), (QUANTITY[p["sensor"]], [str(v) for v in vals]))):
        y = top - (r + 1) * rh
        ax.add_patch(Rectangle((x, y), lw, rh, facecolor=HEAD, edgecolor=INK, linewidth=1.0))
        _text(ax, x + lw / 2, y + rh / 2, head, 9, fontweight="bold")
        for i, v in enumerate(row):
            ax.add_patch(Rectangle((x + lw + i * cw, y), cw, rh, facecolor="#f2f3f4" if r == 0 else "white", edgecolor=INK,
                                   linewidth=1.0))
            _text(ax, x + lw + i * cw + cw / 2, y + rh / 2, v, 10 if r == 0 else 10.5, gid=f"{'time' if r == 0 else 'reading'}:{i}")
    return top - 2 * rh


def _start_state(p: dict) -> str:
    bits = [SAYS[p[s]["device"]][1] for s in ("low", "high") if p[s]]
    return "Before the first reading " + " and ".join(bits) + "."


def draw_flowchart(p: dict):
    fig, ax = new_figure(10.4, 8.6)
    letter, unit, name = SENSOR[p["sensor"]]
    lo, hi = p["low"], p["high"]
    cx, rx = 2.9, 7.4
    ax.add_patch(Ellipse((cx, 11.3), 2.2, 0.8, facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 11.3, "START")
    ax.add_patch(Polygon([(cx - 1.75, 9.45), (cx + 2.15, 9.45), (cx + 1.75, 10.35), (cx - 2.15, 10.35)], closed=True,
                         facecolor=FILL, edgecolor=INK, linewidth=1.3))
    _text(ax, cx, 9.9, f"INPUT {letter} from the\n{name} ({unit})", 9.5)
    for y, rule in ((7.9, lo), (5.6, hi)):
        ax.add_patch(Polygon([(cx, y + 0.8), (cx + 1.75, y), (cx, y - 0.8), (cx - 1.75, y)], closed=True, facecolor=FILL,
                             edgecolor=INK, linewidth=1.3))
        _text(ax, cx, y, f"Is {letter} {rule['op']} {rule['set']}?", 10)
    _box(ax, rx, 7.9, 3.0, 1.0, _action(p, True, False), 9.5)
    _box(ax, rx, 5.6, 3.0, 1.0, _action(p, False, True), 9.5)
    _box(ax, cx, 3.75, 3.0, 1.0, _action(p, False, False), 9.5)
    _box(ax, cx, 2.3, 3.0, 0.7, f"Wait {p['every']} minutes", 9.5)
    _arrow(ax, (cx, 10.9), (cx, 10.35))
    _arrow(ax, (cx, 9.45), (cx, 8.7))
    for y in (7.9, 5.6):
        _arrow(ax, (cx + 1.75, y), (rx - 1.5, y))
        ax.text(cx + 1.95, y + 0.22, "Yes", ha="left", va="center", fontsize=9.5, fontweight="bold")
        ax.text(cx + 0.15, y - 1.0, "No", ha="left", va="center", fontsize=9.5, fontweight="bold")
    _arrow(ax, (cx, 7.1), (cx, 6.4))
    _arrow(ax, (cx, 4.8), (cx, 4.25))
    _arrow(ax, (cx, 3.25), (cx, 2.65))
    # both right-hand boxes on to the wait
    ax.plot([rx + 1.5, rx + 1.85, rx + 1.85], [7.9, 7.9, 2.3], color=INK, linewidth=1.3)
    ax.plot([rx + 1.5, rx + 1.85], [5.6, 5.6], color=INK, linewidth=1.3)
    _arrow(ax, (rx + 1.85, 2.3), (cx + 1.5, 2.3))
    # and back round to the input
    ax.plot([cx, cx, 0.35, 0.35], [1.95, 1.45, 1.45, 9.9], color=INK, linewidth=1.3)
    _arrow(ax, (0.35, 9.9), (cx - 1.95, 9.9))
    tx = 10.0
    ax.text(tx, 11.3, "Sensor readings", ha="left", va="center", fontsize=10.5, fontweight="bold")
    end = _table(ax, p, tx, 10.95, vertical=True)
    words = _start_state(p).replace(" and ", " and\n").replace("reading ", "reading\n", 1)
    ax.text(tx, end - 0.25, words, ha="left", va="top", fontsize=9, style="italic", gid="start-state", linespacing=1.25)
    ax.set_xlim(0.1, tx + 4.15)
    ax.set_ylim(1.2, 11.85)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _block_name(p: dict, part: str) -> str:
    """What each lettered block is, printed under its letter (P3v blind review: unnamed blocks left the order to guess)."""
    if part == "sensor":
        return {"temperature": "Temperature", "moisture": "Moisture", "light": "Light"}[p["sensor"]] + "\nsensor"
    if part == "ADC":
        return "ADC"
    if part == "microprocessor":
        return "Micro-\nprocessor"
    device = (p["low"] or p["high"])["device"]
    return device[0].upper() + device[1:].replace(" ", "\n")


def draw_block(p: dict):
    fig, ax = new_figure(10.4, 7.0)
    rule = p["low"] or p["high"]
    letter, unit, name = SENSOR[p["sensor"]]
    gx0, gx1 = 0.4, 12.6
    ax.add_patch(FancyBboxPatch((gx0, 6.3), gx1 - gx0, 0.9, boxstyle="round,pad=0.03", facecolor="#e4ece0", edgecolor=INK,
                                linewidth=1.3))
    _text(ax, (gx0 + gx1) / 2, 6.75, "Greenhouse in Huye", 11, fontweight="bold")
    xs = [1.9, 5.0, 8.1, 11.2]
    order = PARTS if p["flow"] == "ltr" else PARTS[::-1]
    at = {part: x for part, x in zip(order, xs)}
    y, w, h = 4.4, 2.1, 1.4
    for part in PARTS:
        ax.add_patch(FancyBboxPatch((at[part] - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.03", facecolor=FILL,
                                    edgecolor=INK, linewidth=1.3))
        _text(ax, at[part], y + 0.33, p["letters"][part], 15, fontweight="bold", gid=f"block:{part}")
        _text(ax, at[part], y - 0.27, _block_name(p, part), 9.5, gid=f"blockname:{part}")
    for a, b in zip(PARTS, PARTS[1:]):
        step = (w / 2) * (1 if at[b] > at[a] else -1)
        _arrow(ax, (at[a] + step, y), (at[b] - step, y))
    _arrow(ax, (at["sensor"], 6.3 - 0.05), (at["sensor"], y + h / 2 + 0.03))
    _arrow(ax, (at["actuator"], y + h / 2 + 0.03), (at["actuator"], 6.3 - 0.05))
    device = rule["device"]
    on, off = ("on", "off")
    quantity = {"temperature": "temperature", "moisture": "moisture", "light": "light level"}[p["sensor"]]
    ax.text(gx0, 3.25, f"The microprocessor's program (a reading every {p['every']} minutes):", ha="left", va="center",
            fontsize=9.5, fontweight="bold")
    ax.text(gx0 + 0.3, 2.7, f"IF {quantity} {rule['op']} {rule['set']} {unit} THEN switch the {device} {on}", ha="left",
            va="center", fontsize=10, family="monospace")
    ax.text(gx0 + 0.3, 2.25, f"ELSE switch the {device} {off}", ha="left", va="center", fontsize=10, family="monospace")
    end = _table(ax, p, gx0, 1.6, vertical=False)
    ax.text(gx0, end - 0.35, _start_state(p), ha="left", va="center", fontsize=9, style="italic", gid="start-state")
    ax.set_xlim(gx0 - 0.2, gx1 + 0.2)
    ax.set_ylim(end - 0.65, 7.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return draw_flowchart(p) if p["form"] == "flowchart" else draw_block(p)


# --- questions -------------------------------------------------------------------------------------

SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "before a mock exam"]
CHECKS = ["checks", "studies", "tests", "reviews"]


def _say(p: dict, st: dict) -> str:
    out = " and ".join(SAYS[p[s]["device"]][0 if st[s] else 1] for s in ("low", "high"))
    return out[0].upper() + out[1:]


def _grid(p: dict, st: dict, rng: random.Random, stem: str):
    key = _say(p, st)
    wrong = [_say(p, {"low": a, "high": b}) for a in (True, False) for b in (True, False) if (a, b) != (st["low"], st["high"])]
    return mcq(stem, key, wrong, rng)


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    vals, times = p["readings"], p["times"]
    st_all = [states(p, v) for v in vals]
    t = p["ask_time"]
    side_eq = p["ask_equal"]
    eq = p[side_eq]["set"]
    unit = SENSOR[p["sensor"]][1]
    st_eq = states(p, eq)
    head = f"{who} {rng.choice(CHECKS)} the greenhouse controller {rng.choice(SETTINGS)}. Just after the reading at {times[t]}"
    count_side = "low" if p["low"] else "high"
    device = p[count_side]["device"]
    verb = "are" if device == "lamps" else "is"
    switches, was = 0, False
    for st in st_all:
        switches += st[count_side] and not was
        was = st[count_side]
    qs = []
    if p["form"] == "flowchart":
        qs.append(_grid(p, st_all[t], rng, f"{head}, which is true?"))
    else:
        now = "on" if st_all[t][count_side] else "off"
        qs.append(short(f"{head}, {verb} the {device} on or off?", now, [now, now.upper(), f"the {device} is {now}"]))
    do = "do" if device == "lamps" else "does"
    qs.append(short(f"{friend} works through the table. The {device} {verb} OFF before the first reading. How many times "
                    f"{do} the {device} change from OFF to ON?",
                    switches, [str(switches), f"{switches} times"]))
    if p["form"] == "flowchart":
        qs.append(_grid(p, st_eq, rng, f"Suppose the sensor reads exactly {eq} {unit}. Following the flowchart, which is true just "
                                       f"after that reading?"))
        high = p["high"]["device"]
        thing, state = SAYS[high][0].rsplit(" is ", 1)
        n_open = sum(st["high"] for st in st_all)
        qs.append(short(f"After how many of the {len(vals)} readings is {thing} {state}?", n_open, [str(n_open)]))
    else:
        now = "on" if st_eq[count_side] else "off"
        qs.append(short(f"Suppose the sensor reads exactly {eq} {unit}. Following the program, {verb} the {device} on or off just after "
                        f"that reading?", now, [now, now.upper(), f"the {device} is {now}"]))
        part = p["ask_part"]
        letter = p["letters"][part]
        qs.append(mcq(f"Which letter is the {part}?", letter, [v for v in p["letters"].values() if v != letter], rng))
    return qs
