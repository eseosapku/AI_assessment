"""Composition of air (LS, UP): what a sample of air holds, drawn as a textbook draws it. Two kinds:

- pie: the gases in a sample that is not fresh air (air breathed out at rest or after running, the gas left in a jar
  after a candle went out, air from garden soil), each sector's percentage printed but one, shown "?"; the missing
  percentage, the angle of a sector at the centre, how much less oxygen than fresh air (21%, printed in the stem);
- bars: oxygen, carbon dioxide and water vapour in air breathed in and air breathed out, the values printed on the
  bars; a percentage in the exhaled air, the fall in oxygen and the rise in water vapour.

The samples vary as real ones do (more carbon dioxide after running, less oxygen when a candle has gone out), so the
figure, not the textbook's 78% and 21%, decides every answer. A sector asked for its angle is a whole multiple of 5%,
so the angle is a whole number of degrees.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Rectangle, Wedge

from ..core import FILL, FILL_2, INK, NAMES, grid_y, new_figure, short

ID = "air_composition"
KIND = "graph.pie"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = ("chemistry.air-composition-pollution",)
# Integrated Science teaches the composition of air too.
ALSO = ("science.air-composition",)
# A topic whose sections the book lists is reached only if one names air, the atmosphere or breathing.
NEEDS = r"\bair\b|atmospher|breath|exhal|inhal"
AVOID = r"water pollution|waste|\borganic|petro|polymer|electroly|\brates?\b|equilibri|bonding|atomic|periodic|wind|weather|climate"

PIE = {  # (oxygen, carbon dioxide, other gases): the ranges such a sample really holds, in %
    "rest": ((15, 17), (3, 5), (4, 6)), "run": ((13, 15), (5, 7), (4, 6)),
    "candle": ((14, 17), (2, 4), (1, 3)), "soil": ((16, 20), (1, 4), (1, 3)),
}
ORDER = ["nitrogen", "carbon dioxide", "oxygen", "other gases"]  # clockwise from the top: the two thin sectors apart
TITLES = {"rest": "Gases in air breathed out at rest", "run": "Gases in air breathed out after running",
          "candle": "Gases left in a jar after a candle went out", "soil": "Gases in air taken from garden soil"}
BARS = {"rest": ((16, 17), (3, 4)), "run": ((14, 15), (5, 6))}  # exhaled oxygen, carbon dioxide
GASES = ["oxygen", "carbon dioxide", "water vapour"]


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.55:
        context = rng.choice(sorted(PIE))
        (o0, o1), (c0, c1), (r0, r1) = PIE[context]
        while True:
            o, c, r = rng.randint(o0, o1), rng.randint(c0, c1), rng.randint(r0, r1)
            n = 100 - o - c - r
            values = {"nitrogen": n, "carbon dioxide": c, "oxygen": o, "other gases": r}
            if 74 <= n <= 80 and any(v % 5 == 0 for v in values.values()):
                break
        return {"band": band, "kind": "pie", "context": context, "gases": [[g, values[g]] for g in ORDER],
                "hidden": rng.choice(ORDER)}
    context = rng.choice(sorted(BARS))
    (o0, o1), (c0, c1) = BARS[context]
    inhaled = {"oxygen": 21, "carbon dioxide": 0.04, "water vapour": rng.randint(1, 3)}
    exhaled = {"oxygen": rng.randint(o0, o1), "carbon dioxide": rng.randint(c0, c1), "water vapour": rng.randint(5, 7)}
    return {"band": band, "kind": "bars", "context": context, "inhaled": inhaled, "exhaled": exhaled}


# --- drawing ------------------------------------------------------------------------------------------

SHADE = {"nitrogen": FILL_2, "oxygen": FILL, "carbon dioxide": "#ffffff", "other gases": "#5f6b75"}


def _pie(p: dict):
    fig, ax = new_figure(6.4, 5.0)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.02)
    top = 90.0
    for gas, v in p["gases"]:
        span = v * 3.6
        ax.add_patch(Wedge((0, 0), 1.0, top - span, top, facecolor=SHADE[gas], edgecolor=INK, linewidth=1.2, gid=f"wedge:{gas}"))
        mid = math.radians(top - span / 2)
        c, s = math.cos(mid), math.sin(mid)
        ax.plot([1.0 * c, 1.12 * c], [1.0 * s, 1.12 * s], color=INK, linewidth=0.9, gid=f"pieleader:{gas}")
        ha = "left" if c > 0.2 else "right" if c < -0.2 else "center"
        va = "bottom" if s > 0.5 else "top" if s < -0.5 else "center"
        text = f"{gas}\n{'?' if gas == p['hidden'] else f'{v}%'}"
        ax.text(1.18 * c, 1.18 * s, text, ha=ha, va=va, fontsize=11, linespacing=1.3, gid=f"label:{gas}")
        top -= span
    ax.text(0, 1.82, TITLES[p["context"]], ha="center", va="center", fontsize=12, fontweight="bold")
    ax.set_xlim(-2.4, 2.4)
    ax.set_ylim(-1.75, 2.0)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _bars(p: dict):
    fig, ax = new_figure(6.4, 4.6)
    w = 0.36
    for k, gas in enumerate(GASES):
        for series, dx, face in (("inhaled", -0.19, "#ffffff"), ("exhaled", 0.19, FILL)):
            v = p[series][gas]
            ax.add_patch(Rectangle((k + dx - w / 2, 0), w, v, facecolor=face, edgecolor=INK, linewidth=1.1,
                                   gid=f"bar:{series}:{gas}"))
            ax.text(k + dx, v + 0.35, f"{v}", ha="center", va="bottom", fontsize=9.5,
                    bbox=dict(facecolor="white", edgecolor="none", pad=1.0))
    ax.add_patch(Rectangle((1.45, 19.3), 1.1, 4.1, facecolor="white", edgecolor=INK, linewidth=0.8, zorder=3, gid="legend"))
    for row, (series, face) in enumerate((("inhaled", "#ffffff"), ("exhaled", FILL))):
        y = 22.3 - row * 1.9
        ax.add_patch(Rectangle((1.55, y - 0.45), 0.16, 0.9, facecolor=face, edgecolor=INK, linewidth=1.0, zorder=4,
                               gid=f"key:{series}"))
        ax.text(1.78, y, f"air breathed {'in' if series == 'inhaled' else 'out'}", ha="left", va="center", fontsize=10, zorder=4)
    ax.set_xticks(range(3))
    ax.set_xticklabels(GASES, fontsize=10.5)
    ax.tick_params(axis="x", length=0)
    grid_y(ax, 24, 2)
    ax.set_xlim(-0.6, 2.6)
    ax.set_ylabel("Percentage of the air (%)", fontsize=10.5)
    word = "at rest" if p["context"] == "rest" else "after running"
    ax.set_title(f"Air breathed in and out {word}", fontsize=12, fontweight="bold")
    return fig


def draw(p: dict):
    return _pie(p) if p["kind"] == "pie" else _bars(p)


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "for a science project", "at the science club in Musanze",
            "in a chemistry lesson in Kigali", "for a class investigation in Rubavu", "in the laboratory at a school in Nyanza"]
INTROS = {
    "rest": "{who} breathed out into a plastic bag while sitting still, and the air was analysed {setting}.",
    "run": "{who} ran for ten minutes, then breathed out into a plastic bag, and the air was analysed {setting}.",
    "candle": "{who} burned a candle in a sealed jar of air until it went out, and the gas left was analysed {setting}.",
    "soil": "{who} collected air from the soil of a garden in Huye, and it was analysed {setting}.",
}
WHO = {"rest": "a classmate sitting still", "run": "a classmate who had just run for ten minutes"}


def _pct(n) -> tuple[str, list[str]]:
    x = f"{n}"
    return x, [x, f"{x}%", f"{x} %", f"{x} percent"]


def _points(n: int) -> tuple[str, list[str]]:
    x = str(n)
    return x, [x, f"{x}%", f"{x} %", f"{x} percentage point{'' if n == 1 else 's'}", f"{x} percent"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "pie":
        gases = dict(p["gases"])
        hidden = p["hidden"]
        intro = INTROS[p["context"]].format(who=who, setting=setting)
        x, forms = _pct(gases[hidden])
        qs = [short(f"{intro} The pie chart shows the gases in the sample. What percentage of the sample is {hidden}?", x, forms)]
        gas = rng.choice([g for g in ORDER if gases[g] % 5 == 0])
        angle = gases[gas] * 36 // 10
        qs.append(short(f"What angle does the {gas} sector make at the centre of the pie chart?", angle,
                        [f"{angle}°", f"{angle} °", f"{angle} degrees"]))
        x, forms = _points(21 - gases["oxygen"])
        qs.append(short("Fresh air is 21% oxygen. How many percentage points less oxygen is there in the sample?", x, forms))
        return qs
    inh, exh = p["inhaled"], p["exhaled"]
    gas = rng.choice(GASES)
    x, forms = _pct(exh[gas])
    qs = [short(f"{who} measured the air breathed in and the air breathed out by {WHO[p['context']]} {setting}. "
                f"What percentage of the exhaled air is {gas}?", x, forms)]
    x, forms = _points(inh["oxygen"] - exh["oxygen"])
    qs.append(short("By how many percentage points is the oxygen lower in exhaled air than in inhaled air?", x, forms))
    x, forms = _points(exh["water vapour"] - inh["water vapour"])
    qs.append(short("By how many percentage points is the water vapour higher in exhaled air than in inhaled air?", x, forms))
    return qs
