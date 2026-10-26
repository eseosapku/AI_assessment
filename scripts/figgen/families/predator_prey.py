"""Interactions between populations (LS, UP), two sub-types:

- cycle: the numbers of a prey and its predator counted each year (or week) for twelve, plotted as two lines with
  points on 5-unit gridlines; the predators' peaks follow the prey's. The year the prey were most numerous, the
  predators in a year, the one pair of years when the prey fell while the predators rose, and how far the prey fell;
- competition: two species of one kind grown alone (each levelling off) and grown together (one dies out), in two
  panels on the same scale; the largest number of a species alone, the day the loser died out, which species
  survived, and how many fewer of the winner there were together than alone on a day.

Every value asked lies on a gridline at a marked point; the prey's highest count is never tied; the four year-pairs
offered share no year, so the key is never the option in the middle of the others.
"""
from __future__ import annotations

import math
import random

from ..core import GRID, INK, NAMES, mcq, new_figure, short

ID = "predator_prey"
KIND = "graph.line"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("interspecific-intraspecific-relationships", "interdependence-organisms-environment",
                                           "population-size-limiting-factors", "population-characteristics"))
# A topic whose sections the book lists is reached only if one names what these graphs teach.
NEEDS = r"interdependen|interrelation|interspecific|intraspecific|predat|competition"
AVOID = (r"classification|cell|enzyme|genetic|inherit|immun|disease|reproduc|digest|photosynth|respiration|selection|"
         r"human activit|glossary|science in context|thinking and working scientifically|scientific method|science skills|"
         r"sexual|\bSTIs?\b|HIV|pregnancy|social factors")

# prey, predator, where, time unit
PAIRS = [("hares", "lynx", "a northern forest", "years"), ("mice", "owls", "a farm woodland", "years"),
         ("aphids", "ladybirds", "a greenhouse", "weeks"), ("rabbits", "foxes", "a grassland", "years"),
         ("impala", "leopards", "a game reserve", "years"), ("caterpillars", "birds", "a tea plantation", "weeks")]
# organism, its unit of count
COMPETITORS = [("Paramecium", "Paramecium per cm³"), ("duckweed", "duckweed plants"), ("flour beetles", "flour beetles")]


def _sample_cycle(rng: random.Random) -> dict:
    k = rng.randrange(len(PAIRS))
    n = 12
    while True:
        period, lag, t0 = rng.choice([5, 6]), rng.choice([1, 2]), rng.randint(0, 4)
        bp, ap = rng.randint(50, 70), rng.randint(25, 35)
        bq, aq = rng.randint(20, 30), rng.randint(10, 15)
        prey = [5 * round((bp + ap * math.cos(2 * math.pi * (t - t0) / period) + rng.uniform(-4, 4)) / 5) for t in range(n + 1)]
        pred = [5 * round((bq + aq * math.cos(2 * math.pi * (t - t0 - lag) / period) + rng.uniform(-3, 3)) / 5)
                for t in range(n + 1)]
        if min(pred) < 5 or prey.count(max(prey)) != 1:
            continue
        good = [a for a in range(n) if prey[a + 1] < prey[a] and pred[a + 1] > pred[a]]
        bad = [a for a in range(n) if not (prey[a + 1] < prey[a] and pred[a + 1] > pred[a])]
        if not good:
            continue
        key = rng.choice(good)
        # three wrong year-pairs sharing no year with the key or with each other
        pool = [a for a in bad if abs(a - key) >= 2]
        rng.shuffle(pool)
        chosen: list = []
        for a in pool:
            if all(abs(a - b) >= 2 for b in chosen):
                chosen.append(a)
            if len(chosen) == 3:
                break
        falls = [(a, b) for a in range(n) for b in (a + 1, a + 2) if b <= n and prey[b] < prey[a]]
        if len(chosen) == 3 and falls:
            break
    a, b = rng.choice(falls)
    return {"band": rng.choice(BANDS), "kind": "cycle", "pair": k, "years": list(range(n + 1)), "prey_n": prey,
            "pred_n": pred, "ystep": 5, "key": key, "wrong": sorted(chosen), "ask": rng.randint(1, n), "fall": [a, b]}


def _logistic(top: int, steep: float, mid: float, days: list) -> list:
    return [10 * round(top / (1 + math.exp(-steep * (d - mid))) / 10) for d in days]


def _sample_competition(rng: random.Random) -> dict:
    days = list(range(0, 17, 2))
    while True:
        kx, ky = rng.choice([[120, 80], [100, 70], [140, 90], [110, 60]])
        if rng.random() < 0.5:
            kx, ky = ky, kx
        alone = {"X": _logistic(kx, 0.6, 5 + rng.uniform(-0.5, 0.5), days),
                 "Y": _logistic(ky, 0.6, 5 + rng.uniform(-0.5, 0.5), days)}
        alone["X"][0] = alone["Y"][0] = 10
        win = rng.choice("XY")
        lose = "Y" if win == "X" else "X"
        top_w = alone[win][-1] - 10 * rng.randint(1, 3)
        together = {win: _logistic(top_w, 0.55, 5.5, days)}
        together[win][0] = 10
        die = rng.choice([10, 12, 14])
        peak_day = rng.choice([4, 6])
        peak = 10 * rng.randint(3, 5)
        lose_vals = []
        for d in days:
            if d == 0:
                v = 10
            elif d <= peak_day:
                v = 10 + (peak - 10) * d // peak_day
                v = 10 * round(v / 10)
            elif d < die:
                v = 10 * max(1, round(peak * (die - d) / (die - peak_day) / 10))
            else:
                v = 0
            lose_vals.append(v)
        together[lose] = lose_vals
        diffs = [d for d, a, t in zip(days, alone[win], together[win]) if d >= 6 and a > t]
        if min(alone["X"][1:] + alone["Y"][1:]) > 0 and diffs and min(together[win][1:]) > 0:
            break
    return {"band": rng.choice(BANDS), "kind": "competition", "organism": rng.randrange(len(COMPETITORS)), "days": days,
            "alone": alone, "together": together, "winner": win, "ystep": 10, "top": rng.choice("XY"),
            "on_day": rng.choice(diffs)}


def sample(rng: random.Random) -> dict:
    return _sample_cycle(rng) if rng.random() < 0.5 else _sample_competition(rng)


# --- drawing -----------------------------------------------------------------------------------------------------

def draw(p: dict):
    return _draw_cycle(p) if p["kind"] == "cycle" else _draw_competition(p)


def _draw_cycle(p: dict):
    prey, pred, unit = PAIRS[p["pair"]][0], PAIRS[p["pair"]][1], PAIRS[p["pair"]][3]
    fig, ax = new_figure(7.0, 4.6)
    ys, top = p["years"], 10 * (max(p["prey_n"]) // 10 + 2)
    ax.plot(ys, p["prey_n"], color=INK, linewidth=1.8, marker="o", markersize=5, label=f"{prey} (prey)")
    ax.plot(ys, p["pred_n"], color=INK, linewidth=1.8, linestyle=(0, (5, 3)), marker="s", markersize=5,
            markerfacecolor="white", label=f"{pred} (predators)")
    ax.set_xticks(ys)
    ax.set_yticks(range(0, top + 1, 10))
    ax.set_yticks(range(0, top + 1, 5), minor=True)
    ax.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(-0.25, ys[-1] + 0.25)  # the first and last points are drawn whole
    ax.set_ylim(-1, top)
    ax.tick_params(labelsize=9)
    ax.set_xlabel(f"Time ({unit})")
    ax.set_ylabel("Number of animals")
    ax.legend(loc="lower left", bbox_to_anchor=(0.0, 1.01), ncol=2, fontsize=10, frameon=False)
    return fig


def _draw_competition(p: dict):
    name, count = COMPETITORS[p["organism"]]
    fig, axes = new_figure(8.4, 4.2)
    fig.clf()
    axes = fig.subplots(1, 2, sharey=True)
    top = 10 * (max(p["alone"]["X"] + p["alone"]["Y"]) // 10 + 2)
    for ax, (title, data) in zip(axes, (("Grown alone (separate containers)", p["alone"]),
                                        ("Grown together (one container)", p["together"]))):
        ax.plot(p["days"], data["X"], color=INK, linewidth=1.8, marker="o", markersize=5, label="species X")
        ax.plot(p["days"], data["Y"], color=INK, linewidth=1.8, linestyle=(0, (5, 3)), marker="s", markersize=5,
                markerfacecolor="white", label="species Y")
        ax.set_xticks(p["days"])
        ax.set_yticks(range(0, top + 1, 20))
        ax.set_yticks(range(0, top + 1, 10), minor=True)
        ax.grid(True, which="both", color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        ax.set_xlim(-0.4, p["days"][-1] + 0.4)
        ax.set_ylim(-2, top)
        ax.tick_params(labelsize=9)
        ax.set_xlabel("Time (days)")
        ax.set_title(title, fontsize=10.5)
    axes[0].set_ylabel(f"Number of {count}")
    fig.tight_layout()
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.5, 0.99), ncol=2, fontsize=10, frameon=False)
    return fig


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["in an ecology lesson", "for a class project", "from a field study", "at the science club", "for revision"]


def _year(t: int, unit: str) -> list[str]:
    word = unit[:-1]
    return [str(t), f"{word} {t}", f"in {word} {t}", f"{word.capitalize()} {t}"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "cycle":
        prey, pred, place, unit = PAIRS[p["pair"]]
        word = unit[:-1]
        ys, pn, qn = p["years"], p["prey_n"], p["pred_n"]
        top = ys[pn.index(max(pn))]
        t = p["ask"]
        opt = lambda a: f"{word} {a} to {word} {a + 1}"  # noqa: E731
        a, b = p["fall"]
        return [short(f"{who} studied the {prey} and {pred} in {place} {rng.choice(SETTINGS)}. In which {word} was the "
                      f"number of {prey} highest?", top, _year(top, unit)),
                short(f"How many {pred} were there in {word} {t}?", qn[t], [f"{qn[t]} {pred}"]),
                mcq(f"Between which two {unit} did the number of {prey} fall while the number of {pred} rose?",
                    opt(p["key"]), [opt(x) for x in p["wrong"]], rng),
                short(f"By how many did the number of {prey} fall from {word} {a} to {word} {b}?", pn[a] - pn[b],
                      [f"{pn[a] - pn[b]} {prey}"])]
    name, count = COMPETITORS[p["organism"]]
    days, alone, tog, w = p["days"], p["alone"], p["together"], p["winner"]
    lose = "Y" if w == "X" else "X"
    s = p["top"]
    die = next(d for d, v in zip(days, tog[lose]) if v == 0)
    d = p["on_day"]
    i = days.index(d)
    return [short(f"{who} grew two species of {name}, X and Y, alone and together {rng.choice(SETTINGS)}. What was the "
                  f"largest number of species {s} when it was grown alone?", max(alone[s]), [f"{max(alone[s])} {count}"]),
            short(f"On which day did species {lose} die out when the two species were grown together?", die,
                  [f"day {die}", f"Day {die}", f"on day {die}"]),
            mcq("Which species survived when the two species were grown together?", f"species {w}",
                ["species X", "species Y", "both species", "neither species"], rng),
            short(f"On day {d}, how many fewer of species {w} were there when grown together than when grown alone?",
                  alone[w][i] - tog[w][i], [f"{alone[w][i] - tog[w][i]} {count}"])]
