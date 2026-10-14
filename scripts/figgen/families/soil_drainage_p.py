"""Soil drainage (P): a class experiment. Three funnels hold sandy soil, loam soil and clay soil; the same amount of
water is poured onto each, and a measuring cylinder under each funnel shows the water that came through after
10 minutes, on a scale of marked and numbered divisions.

How much water came through a soil, how much more came through one than another, how much stayed in a soil, and
what was kept the same to make the test fair. The upper level may name the soils only as Soil A, B and C: which
let the most water through, which held on to the most, and which is most likely to be clay or sandy soil.

Sand always lets the most water through and clay the least, each clearly apart (at least 15% of the water
poured), so the figure agrees with what a teacher knows; every amount sits on a division of its cylinder.
"""
from __future__ import annotations

import random

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "soil_drainage_p"
KIND = "instrument.reading"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = ("science.soil", "science.scientific-method")
# A topic whose sections the book lists is reached only if it names soil, or fair testing.
NEEDS = r"\bsoil|fair test"

SOILS = ["sandy soil", "loam soil", "clay soil"]
# The share of the water each soil lets through, in hundredths: sand drains fast, clay slowly.
SHARE = {"sandy soil": (60, 90), "loam soil": (35, 55), "clay soil": (5, 25)}
LOOK = {"sandy soil": ("#ece8dc", "..."), "loam soil": ("#a9a39a", "xx"), "clay soil": ("#7f7a74", "--")}
# (water poured, cylinder top, a number every, a division every)
SCALES = {"lower": [(100, 100, 10, 10), (200, 200, 20, 20)], "upper": [(100, 100, 20, 5), (200, 200, 50, 10), (200, 200, 20, 10)]}
SAME = ["the amount of water poured onto each soil", "the time the water was left to drain"]
CHANGED = ["the type of soil", "the amount of water that came through", "the amount of water that stayed in the soil"]


def stages(p: dict) -> tuple[int, int] | None:
    """Unnumbered divisions and unnamed soils are for the older classes."""
    return (4, 6) if p["level"] == "upper" else None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    poured, cap, label, minor = rng.choice(SCALES[level])
    gap = poured * 15 // 100
    while True:
        got = {s: minor * rng.randint(-(-lo * poured // 100 // minor), hi * poured // 100 // minor)
               for s, (lo, hi) in SHARE.items()}
        if got["sandy soil"] - got["loam soil"] >= gap and got["loam soil"] - got["clay soil"] >= gap and got["clay soil"] > 0:
            break
    soils = rng.sample(SOILS, 3)
    named = level == "lower" or rng.random() < 0.4
    i, j = rng.sample(range(3), 2)
    a, b = sorted(rng.sample(range(3), 2), key=lambda k: -got[soils[k]])
    stay = rng.choice([k for k in range(3) if k != i])
    if named:
        ask = {"read": i, "more": [a, b], "stay": stay}
    else:
        which = rng.choice(["most", "held"])
        # the soil to pick out by its drainage: not the one the other question already finds
        found = "sandy soil" if which == "most" else "clay soil"
        ask = {"read": i, "which": which, "likely": rng.choice([s for s in SOILS if s != found])}
    ask["same"] = rng.randrange(len(SAME))
    return {"band": "P", "level": level, "named": named, "soils": soils, "letters": ["A", "B", "C"],
            "poured": poured, "cap": cap, "label_step": label, "minor": minor,
            "collected": [got[s] for s in soils], "ask": ask}


def _names(p: dict) -> list[str]:
    return list(p["soils"]) if p["named"] else [f"Soil {k}" for k in p["letters"]]


def draw(p: dict):
    cap, u = p["cap"], p["cap"] / 100  # the cylinders read in ml; the rest is drawn in hundredths of the cylinder
    fig, ax = new_figure(8.2, 6.6)
    names = _names(p)
    for i, (soil, v) in enumerate(zip(p["soils"], p["collected"])):
        xc = 1.5 + 3.4 * i
        # the funnel: a cone and its spout, with the soil packed in the cone
        cone_top, cone_end, spout_end, half_top, half_end = 165 * u, 130 * u, 119 * u, 0.95, 0.12

        def half(y):
            return half_end + (half_top - half_end) * (y - cone_end) / (cone_top - cone_end)
        lo, hi = 133 * u, 155 * u
        colour, hatch = LOOK[soil]
        ax.add_patch(Polygon([(xc - half(lo) + 0.04, lo), (xc + half(lo) - 0.04, lo), (xc + half(hi) - 0.04, hi),
                              (xc - half(hi) + 0.04, hi)], closed=True, facecolor=colour, edgecolor="#555555",
                             hatch=hatch, linewidth=0.6))
        ax.add_patch(Polygon([(xc - half_top, cone_top), (xc - half_end, cone_end), (xc - 0.07, cone_end), (xc - 0.07, spout_end),
                              (xc + 0.07, spout_end), (xc + 0.07, cone_end), (xc + half_end, cone_end), (xc + half_top, cone_top)],
                             closed=False, fill=False, edgecolor=INK, linewidth=1.6))
        ax.text(xc, 172 * u, names[i], ha="center", va="bottom", fontsize=12, fontweight="bold")
        for k, y in enumerate((114, 109, 104)):  # drops falling into the cylinder
            ax.plot([xc, xc], [y * u, (y - 2.5) * u], color="#5d7280", linewidth=2.2, solid_capstyle="round")
        # the measuring cylinder, its water, and its scale
        ax.add_patch(Rectangle((xc - 0.6, -5 * u), 1.02, 5 * u, facecolor="#333333", edgecolor=INK, linewidth=1.0))
        ax.add_patch(Rectangle((xc - 0.4, 0), 0.8, v, facecolor="#b9cbd6", edgecolor="none", gid=f"water-{i}"))
        ax.plot([xc - 0.4, xc - 0.4, xc + 0.4, xc + 0.4], [cap * 1.04, 0, 0, cap * 1.04], color=INK, linewidth=1.5)
        ax.plot([xc - 0.4, xc + 0.4], [v, v], color="#3d5260", linewidth=1.6)
        for t in range(p["minor"], cap + 1, p["minor"]):
            big = t % p["label_step"] == 0
            ax.plot([xc + 0.4 - (0.3 if big else 0.18), xc + 0.4], [t, t], color=INK, linewidth=1.1 if big else 0.8,
                    gid=f"tick-{i}-{t}")
        for t in range(0, cap + 1, p["label_step"]):
            ax.text(xc + 0.5, t, str(t), ha="left", va="center", fontsize=10, gid=f"num-{i}-{t}")
        ax.text(xc + 0.5, cap * 1.09, "ml", ha="left", va="center", fontsize=10)
    ax.text(5.0, 190 * u, f"{p['poured']} ml of water poured onto each soil", ha="center", va="bottom", fontsize=12)
    ax.text(5.0, -13 * u, "Water collected in each cylinder after 10 minutes", ha="center", va="top", fontsize=11.5)
    ax.set_xlim(0.3, 9.9)
    ax.set_ylim(-24 * u, 200 * u)
    ax.axis("off")
    return fig


VERBS = ["pours", "carefully pours", "measures out and pours", "slowly pours"]
SETTINGS = ["in a science lesson", "in the school garden in Huye", "at the science club", "for a class experiment",
            "with the class", "on a sunny morning"]


def _ml(n: int) -> list[str]:
    return [f"{n} ml", f"{n}ml", f"{n} mL", f"{n}mL", f"{n} millilitres", f"{n} cm³", f"{n} cm3"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    names, got, poured, ask = _names(p), p["collected"], p["poured"], p["ask"]
    lead = f"{who} {rng.choice(VERBS)} {poured} ml of water onto each soil {rng.choice(SETTINGS)}. "
    i = ask["read"]
    the = "the " if p["named"] else ""
    out = [short(lead + f"How much water came through {the}{names[i]}?", got[i], _ml(got[i]))]
    if p["named"]:
        a, b = ask["more"]
        out.append(short(f"How much more water came through the {names[a]} than the {names[b]}?", got[a] - got[b],
                         _ml(got[a] - got[b])))
        k = ask["stay"]
        out.append(short(f"How much of the water stayed in the {names[k]}?", poured - got[k], _ml(poured - got[k])))
    else:
        most, least = names[got.index(max(got))], names[got.index(min(got))]
        if ask["which"] == "most":
            out.append(mcq("Which soil let the most water through?", most, [n for n in names if n != most], rng))
        else:
            out.append(mcq("Which soil held on to the most water?", least, [most] + [n for n in names if n not in (most, least)], rng))
        soil = ask["likely"]
        key = names[p["soils"].index(soil)]
        out.append(mcq(f"Which soil is most likely to be {soil}?", key, [n for n in names if n != key], rng))
    out.append(mcq(f"What did {who} keep the same to make it a fair test?", SAME[ask["same"]], CHANGED, rng))
    return out
