"""Patterns of disease (LS, UP), two sub-types, for invented sectors and health centres:

- outbreak: a bar chart of the new cases of a disease each week for twelve weeks, rising to one peak and falling to
  none after an action began (safe water supplied, a vaccination campaign, hand-washing stations), the week it began
  marked by a dashed line; the week with the most new cases, a week's cases, the cases over a span of weeks, and the
  first week with none;
- seasonal: a health centre's malaria cases each month under the month's rainfall (two panels on the same months);
  the month with the most cases, how many months after the wettest month the cases peaked, a month's cases and a
  month's rainfall.

Every bar and point sits on a gridline; the peaks are never tied; malaria peaks one or two months after the rain.
"""
from __future__ import annotations

import random

from ..core import FILL, GRID, INK, NAMES, new_figure, short

ID = "disease_data"
KIND = "graph.bar"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("transmission-infectious-diseases", "infectious-diseases", "public-health-services",
                                           "disease-classification"))
# A topic whose sections the book lists is reached only if one names disease, infection or public health.
NEEDS = r"diseases?\b|infection|pathogen|epidemi|outbreak|public health|transmission|patterns of disease"
AVOID = (r"\bSTIs?\b|HIV|AIDS|sexual|social factors|smoking|immun|antibod|vaccin|cell|enzyme|genetic|inherit|plant|"
         r"glossary|science in context|thinking and working scientifically|scientific method|science skills|pregnancy")

OUTBREAKS = [("cholera", "safe drinking water supplied"), ("measles", "a vaccination campaign"),
             ("typhoid", "safe drinking water supplied"), ("dysentery", "hand-washing stations set up")]
PLACES = ["Sector A", "Sector B", "Sector C", "Sector D"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def _sample_outbreak(rng: random.Random) -> dict:
    weeks = list(range(1, 13))
    while True:
        step = rng.choice([2, 5])
        pk = rng.randint(4, 6)  # index of the peak week
        top = step * rng.randint(7, 12)
        cases = []
        for i in range(12):
            if i < pk:
                cases.append(step * max(1, round((top / step) * (i + 1) / (pk + 1) + rng.uniform(-0.6, 0.6))))
            elif i == pk:
                cases.append(top)
            else:
                cases.append(max(0, cases[-1] - step * rng.randint(2, 4)))
        zeros = [i for i in range(pk, 12) if cases[i] == 0]
        if cases.count(top) == 1 and zeros and zeros[0] <= 10 and all(c < top for c in cases[:pk]):
            break
    action = pk + rng.choice([0, 1])  # index of the week the action began
    a = rng.randint(0, 9)
    b = a + rng.choice([1, 2])
    return {"band": rng.choice(BANDS), "kind": "outbreak", "disease": rng.randrange(len(OUTBREAKS)),
            "place": rng.choice(PLACES), "weeks": weeks, "cases": cases, "ystep": step, "action": weeks[action],
            "ask": rng.choice(weeks[:zeros[0]]), "span": [weeks[a], weeks[b]]}


def _sample_seasonal(rng: random.Random) -> dict:
    while True:
        wet = rng.choice([2, 3, 4, 9, 10])  # March to May, or October and November
        lag = rng.choice([1, 2])
        rain = []
        for i in range(12):
            d = min(abs(i - wet), 12 - abs(i - wet))
            other = min(abs(i - (wet + 6) % 12), 12 - abs(i - (wet + 6) % 12))
            v = 200 - 45 * d if d <= 3 else 30
            v = max(v, 140 - 45 * other if other <= 2 else 0, 20 + 10 * rng.randint(0, 2))
            rain.append(10 * round(v / 10 + rng.uniform(-0.6, 0.6)))
        peak = (wet + lag) % 12
        cases = []
        for i in range(12):
            d = min(abs(i - peak), 12 - abs(i - peak))
            cases.append(10 * max(2, round(18 - 4 * d + rng.uniform(-0.7, 0.7))))
        if rain.count(max(rain)) == 1 and rain.index(max(rain)) == wet and cases.count(max(cases)) == 1 \
                and cases.index(max(cases)) == peak and peak > wet:
            break
    return {"band": rng.choice(BANDS), "kind": "seasonal", "place": rng.choice(PLACES), "cases": cases, "rain": rain,
            "ask_cases": rng.choice(MONTHS), "ask_rain": rng.choice(MONTHS)}


def sample(rng: random.Random) -> dict:
    return _sample_outbreak(rng) if rng.random() < 0.55 else _sample_seasonal(rng)


# --- drawing -----------------------------------------------------------------------------------------------------

def _draw_outbreak(p: dict):
    disease, action = OUTBREAKS[p["disease"]]
    fig, ax = new_figure(6.8, 4.4)
    step = p["ystep"]
    top = step * (max(p["cases"]) // step + 2)
    ax.bar(p["weeks"], p["cases"], width=0.6, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    ax.axvline(p["action"] - 0.5, color=INK, linewidth=1.4, linestyle=(0, (4, 3)), zorder=4)
    ax.set_xticks(p["weeks"])
    ax.set_yticks(range(0, top + 1, step * (2 if top / step > 12 else 1)))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_ylim(0, top)
    ax.set_xlim(0.4, 12.6)
    ax.tick_params(labelsize=9)
    ax.set_xlabel("Week")
    ax.set_ylabel(f"New cases of {disease}")
    ax.set_title(f"{disease.capitalize()} in {p['place']}: {action} from week {p['action']} (dashed line)", fontsize=10)
    return fig


def _draw_seasonal(p: dict):
    fig, _ = new_figure(7.0, 5.6)
    fig.clf()
    rain_ax, case_ax = fig.subplots(2, 1, sharex=True)
    xs = list(range(12))
    rtop = 20 * (max(p["rain"]) // 20 + 2)
    rain_ax.bar(xs, p["rain"], width=0.6, color=FILL, edgecolor=INK, linewidth=1.0, zorder=3)
    rain_ax.set_yticks(range(0, rtop + 1, 20))
    rain_ax.set_yticks(range(0, rtop + 1, 10), minor=True)
    rain_ax.set_ylim(0, rtop)
    rain_ax.set_ylabel("Rainfall (mm)")
    ctop = 20 * (max(p["cases"]) // 20 + 2)
    case_ax.plot(xs, p["cases"], color=INK, linewidth=1.8, marker="o", markersize=5, zorder=3)
    case_ax.set_yticks(range(0, ctop + 1, 20))
    case_ax.set_yticks(range(0, ctop + 1, 10), minor=True)
    case_ax.set_ylim(0, ctop)
    case_ax.set_ylabel("Malaria cases")
    for ax in (rain_ax, case_ax):
        ax.grid(True, axis="y", which="both", color=GRID, linewidth=0.6)
        ax.grid(True, axis="x", color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        ax.set_xticks(xs)
        ax.set_xticklabels([m[:3] for m in MONTHS])
        ax.set_xlim(-0.5, 11.5)
        ax.tick_params(labelsize=9)
    rain_ax.tick_params(labelbottom=True)
    rain_ax.set_title(f"A health centre in {p['place']}: rainfall and malaria cases each month", fontsize=10)
    case_ax.set_xlabel("Month")
    fig.tight_layout()
    return fig


def draw(p: dict):
    return _draw_outbreak(p) if p["kind"] == "outbreak" else _draw_seasonal(p)


# --- questions ---------------------------------------------------------------------------------------------------

SETTINGS = ["for a health club talk", "in a biology lesson", "for a class report", "for a community health project",
            "for revision"]


def _week(w: int) -> list[str]:
    return [f"week {w}", f"Week {w}", f"in week {w}"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    if p["kind"] == "outbreak":
        disease, _ = OUTBREAKS[p["disease"]]
        weeks, cases = p["weeks"], p["cases"]
        top = weeks[cases.index(max(cases))]
        k = p["ask"]
        a, b = p["span"]
        tot = sum(cases[weeks.index(a):weeks.index(b) + 1])
        pk = cases.index(max(cases))
        first = next(weeks[i] for i in range(pk, len(weeks)) if cases[i] == 0)
        return [short(f"{who} plotted the new cases of {disease} each week in {p['place']} {rng.choice(SETTINGS)}. In "
                      f"which week were there the most new cases?", top, _week(top)),
                short(f"How many new cases of {disease} were there in week {k}?", cases[weeks.index(k)],
                      [f"{cases[weeks.index(k)]} cases", f"{cases[weeks.index(k)]} new cases"]),
                short(f"How many new cases were there altogether from week {a} to week {b}?", tot,
                      [f"{tot} cases", f"{tot} new cases"]),
                short("In which week were there first no new cases?", first, _week(first))]
    cases, rain = p["cases"], p["rain"]
    top = MONTHS[cases.index(max(cases))]
    lag = cases.index(max(cases)) - rain.index(max(rain))
    mc, mr = p["ask_cases"], p["ask_rain"]
    nc, nr = cases[MONTHS.index(mc)], rain[MONTHS.index(mr)]
    return [short(f"{who} graphed the malaria cases at a health centre each month, with the rainfall, "
                  f"{rng.choice(SETTINGS)}. In which month were there the most malaria cases?", top, [top[:3], f"in {top}"]),
            short("How many months after the wettest month did the malaria cases reach their peak?", lag,
                  [f"{lag} month" + ("s" if lag > 1 else ""), f"{lag} months"]),
            short(f"How many malaria cases were there in {mc}?", nc, [f"{nc} cases"]),
            short(f"What was the rainfall in {mr}?", nr, [f"{nr} mm", f"{nr}mm"])]
