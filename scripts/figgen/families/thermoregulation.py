"""Temperature control (LS, UP): three figures of how a mammal keeps its body temperature steady.

- Skin: a section through human skin as textbooks draw it (epidermis, dermis, fat layer with fat cells, a hair in its
  follicle with its erector muscle, a coiled sweat gland and its duct to the surface, a blood vessel with a capillary
  loop, a sensory nerve ending). Five parts are lettered, each by a leader that ends on its part, and a table beside it
  prints what each lettered part does. Asks which letter shows a named part, which letter shows the part with a role
  from the table, and what the part at a letter is.
- Endotherm and ectotherm: the body temperatures of two animals, lettered, kept at surroundings from cold to hot, on a
  1 degree grid: one steady, one following its surroundings a few degrees above. Asks which is the endotherm, the
  ectotherm's body temperature at a stated surrounding temperature, and where the two lines meet.
- Core temperature: a person's core temperature every 10 minutes while exercising in a hot room or sitting in cold water
  and afterwards, every point on a 0.2 degree gridline, normal (37.0 degrees) marked. Asks the highest or lowest value,
  when it was back at 37.0, and by how much it rose or fell.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Polygon, Rectangle

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short
from ._bio_parts import letter, letter_choice, part, spline, tube

ID = "thermoregulation"
KIND = "diagram.template"
SUBJECT = "biology"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"biology.{c}" for c in ("homeostasis-general-principles", "skin-structure-functioning",
                                           "cold-hot-response-endothermic-ectothermic",
                                           "brain-hypothalamus-thermoreceptors-temperature",
                                           "control-coordination-mammals-overview", "temperature-animal-behaviour"))
# A topic whose sections the book lists is reached only if one names temperature control, the skin or homeostasis.
NEEDS = r"temperature|thermoreg|homeosta|\bskin\b|endotherm|ectotherm|internal environment"
AVOID = (r"glucose|plant|enzyme|photosynth|sexual|STIs|HIV|glossary|science in context|social factors|"
         r"reproduction system")

ROLE = {
    "hair": "traps a layer of warm air when it stands up",
    "hair erector muscle": "contracts in the cold to make the hair stand up",
    "sweat gland": "makes sweat from water and salts in the blood",
    "sweat duct": "carries sweat up to the surface of the skin",
    "blood vessel": "widens in the heat so more blood flows near the surface",
    "fat layer": "insulates the body and stores energy",
    "epidermis": "the outer layer that protects the skin",
    "sensory nerve ending": "detects heat, cold, touch or pain",
}
CONFUSE = {
    "hair": ["hair erector muscle", "sweat duct", "sensory nerve ending"],
    "hair erector muscle": ["hair", "blood vessel", "sweat gland"],
    "sweat gland": ["sweat duct", "fat layer", "hair erector muscle"],
    "sweat duct": ["sweat gland", "sensory nerve ending", "hair"],
    "blood vessel": ["sensory nerve ending", "sweat duct", "hair erector muscle"],
    "fat layer": ["epidermis", "sweat gland", "blood vessel"],
    "epidermis": ["fat layer", "sweat duct", "hair"],
    "sensory nerve ending": ["blood vessel", "sweat duct", "hair erector muscle"],
}


def concepts_for(p: dict) -> tuple:
    if p["kind"] == "skin":
        keep = ("skin-structure-functioning", "homeostasis-general-principles", "control-coordination-mammals-overview")
    elif p["kind"] == "endo_ecto":
        keep = ("cold-hot-response-endothermic-ectothermic", "homeostasis-general-principles", "temperature-animal-behaviour")
    else:
        keep = ("homeostasis-general-principles", "brain-hypothalamus-thermoreceptors-temperature",
                "control-coordination-mammals-overview")
    return tuple(f"biology.{c}" for c in keep)


def _skin(rng: random.Random) -> dict:
    parts = rng.sample(sorted(ROLE), 5)
    rng.shuffle(parts)
    return {"kind": "skin", "labels": {chr(65 + i): x for i, x in enumerate(parts)}}


def _endo_ecto(rng: random.Random) -> dict:
    body, offset = rng.choice([(36, 1), (36, 2), (36, 3), (37, 2), (37, 3), (38, 3)])  # they meet at 35 °C or below
    letters = rng.choice([["P", "Q"], ["X", "Y"], ["A", "B"]])
    first_endo = rng.random() < 0.5
    animals = [{"letter": letters[0], "endo": first_endo}, {"letter": letters[1], "endo": not first_endo}]
    for a in animals:
        if a["endo"]:
            a["body"] = body
        else:
            a["offset"] = offset
    return {"kind": "endo_ecto", "range": [rng.choice([0, 5]), 35], "animals": animals}


def _core(rng: random.Random) -> dict:
    mode = rng.choice(["hot", "cold"])
    extreme = rng.choice([37.6, 37.8, 38.0, 38.2, 38.4, 38.6]) if mode == "hot" else rng.choice([36.0, 36.2, 36.4, 36.6])
    t_ext = rng.choice([30, 40])
    t_back = rng.choice([t for t in (60, 70, 80) if t > t_ext + 10])
    times = list(range(0, 91, 10))
    knots = []
    for t in times:
        if t <= 10 or t >= t_back:
            v = 37.0
        elif t <= t_ext:
            v = 37.0 + (extreme - 37.0) * (t - 10) / (t_ext - 10)
        else:
            v = extreme + (37.0 - extreme) * (t - t_ext) / (t_back - t_ext)
        v = round(round(v * 5) / 5, 1)
        knots.append([t, v])
    # a point between the extreme and normal must not tie with the extreme or reach 37.0 too early
    for k in knots:
        if k[0] != t_ext and k[1] == extreme:
            k[1] = round(extreme - 0.2 if mode == "hot" else extreme + 0.2, 1)
        if 10 < k[0] < t_back and k[1] == 37.0:
            k[1] = 37.2 if mode == "hot" else 36.8
    return {"kind": "core", "mode": mode, "knots": knots}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["skin", "endo_ecto", "core"])
    return {"band": band, **{"skin": _skin, "endo_ecto": _endo_ecto, "core": _core}[kind](rng)}


# --- drawing: skin ----------------------------------------------------------------------------------

LX, RX = -1.0, 10.1
HAIR = [(2.32, 3.7), (2.45, 5.0), (2.55, 6.4), (2.65, 7.0), (2.95, 7.8), (3.4, 8.6)]
SLOT = {  # where each part's letter sits, and where its leader ends on the part
    "hair": ((LX, 8.25), (2.95, 7.8)),
    "epidermis": ((LX, 6.6), (0.6, 6.6)),
    "hair erector muscle": ((LX, 5.18), (1.575, 5.185)),
    "blood vessel": ((LX, 2.95), (0.7, 2.95)),
    "fat layer": ((LX, 1.3), (0.7, 1.3)),
    "sweat duct": ((RX, 7.75), (6.5, 6.0)),
    "sensory nerve ending": ((RX, 4.6), (8.62, 4.6)),
    "sweat gland": ((RX, 2.3), (7.0, 2.85)),
}


def _draw_skin(p: dict):
    fig, ax = new_figure(11.6, 5.6)
    ax.add_patch(Rectangle((0, 0.3), 9.0, 2.3, facecolor="#fbefc0", edgecolor=INK, linewidth=1.0, zorder=1,
                           gid="part:fat layer"))
    for cx in (1.6, 2.9, 4.2, 5.5, 6.8, 8.1):
        for cy, dx in ((1.0, 0.0), (1.95, 0.6)):
            if cx + dx < 8.7:
                ax.add_patch(Circle((cx + dx, cy), 0.36, fill=False, edgecolor="#8a7a3a", linewidth=0.8, zorder=1.2))
    ax.add_patch(Rectangle((0, 2.6), 9.0, 3.6, facecolor="#f9e6dc", edgecolor=INK, linewidth=1.0, zorder=1, gid="dermis"))
    ax.add_patch(Rectangle((0, 6.2), 9.0, 0.8, facecolor="#e9c3a6", edgecolor=INK, linewidth=1.0, zorder=1.1,
                           gid="part:epidermis"))
    # the hair follicle, the hair in it and its erector muscle
    part(ax, spline([(2.0, 7.0), (2.0, 4.2), (2.15, 3.35), (2.55, 3.3), (2.75, 4.2), (2.85, 7.0)], closed=False, per=6)
         + [[2.85, 7.0]], "follicle", "#f3d2c0", z=2)
    part(ax, tube(spline(HAIR, closed=False, per=6), 0.14), "hair", "#3a2a1a", edge="#3a2a1a", lw=0.6, z=3)
    part(ax, tube([(2.08, 4.25), (1.07, 6.12)], 0.32), "hair erector muscle", "#d98c8c", z=2.5)
    # the sweat gland: a coil at the bottom of the dermis, and its duct to a pore at the surface
    coil = [(6.25, 2.85), (7.0, 2.85), (7.3, 3.15), (7.0, 3.45), (6.3, 3.45), (6.05, 3.15)]
    for cx, cy in coil:
        ax.add_patch(Circle((cx, cy), 0.24, facecolor="#a9d3f0", edgecolor=INK, linewidth=0.9, zorder=2.6,
                            gid="part:sweat gland"))
    part(ax, tube(spline([(6.6, 3.55), (6.45, 4.4), (6.75, 5.2), (6.5, 6.0), (6.62, 7.0)], closed=False, per=6), 0.2),
         "sweat duct", "#cfe8f8", z=2.4)
    ax.text(6.62, 7.25, "pore", ha="center", va="bottom", fontsize=8.5, style="italic")
    # a blood vessel along the dermis with a capillary loop up under the epidermis
    part(ax, tube([(0.0, 2.95), (5.0, 2.95)], 0.36), "blood vessel", "#d65f5f", z=2.2)
    part(ax, tube(spline([(4.0, 3.1), (4.05, 5.2), (4.4, 5.9), (4.75, 5.2), (4.8, 3.1)], closed=False, per=8), 0.18),
         "blood vessel", "#d65f5f", z=2.2)
    # a sensory nerve ending
    part(ax, tube([(9.0, 3.6), (8.62, 3.9), (8.62, 5.6)], 0.12), "sensory nerve ending", "#e8c840", z=2.3)
    ax.add_patch(Circle((8.62, 5.72), 0.18, facecolor="#e8c840", edgecolor=INK, linewidth=0.9, zorder=2.35,
                        gid="part:sensory nerve ending"))
    for L, name in p["labels"].items():
        at, end = SLOT[name]
        letter(ax, L, at, end, gap=0.42, dot=True)
    # the table of roles
    tx = 11.0
    ax.text(tx, 8.3, "Part", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.text(tx + 4.0, 8.3, "What it does", ha="left", va="center", fontsize=10, fontweight="bold")
    ax.plot([tx, tx + 11.2], [7.9, 7.9], color=INK, linewidth=0.9)
    names = sorted(p["labels"].values())
    for i, name in enumerate(names):
        y = 7.3 - 1.25 * i
        ax.text(tx, y, name.capitalize(), ha="left", va="center", fontsize=9.5)
        words = ROLE[name].split()
        half = len(words) // 2 + 1 if len(ROLE[name]) > 34 else len(words)
        ax.text(tx + 4.0, y, " ".join(words[:half]) + ("\n" + " ".join(words[half:]) if half < len(words) else ""),
                ha="left", va="center", fontsize=9.5, linespacing=1.15)
    ax.set_xlim(LX - 0.6, tx + 11.4)
    ax.set_ylim(0.0, 9.0)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Section through human skin (lettered parts named in the table)", fontsize=11)
    return fig


# --- drawing: graphs --------------------------------------------------------------------------------

def _draw_endo_ecto(p: dict):
    fig, ax = new_figure(6.6, 4.8)
    lo, hi = p["range"]
    xs = list(range(lo, hi + 1, 5))
    for a, st, mk in zip(p["animals"], ["-", (0, (6, 3))], ["o", "s"]):
        ys = [a["body"] if a["endo"] else x + a["offset"] for x in xs]
        ax.plot(xs, ys, color=INK, linewidth=1.7, linestyle=st, marker=mk, markersize=5, gid=f"animal:{a['letter']}",
                label=f"animal {a['letter']}")
    ax.set_xticks(range(0, 36, 5))
    ax.set_xticks(range(0, 36), minor=True)
    ax.set_yticks(range(0, 41, 5))
    ax.set_yticks(range(0, 41), minor=True)
    ax.grid(True, which="major", color="#b0b0b0", linewidth=0.7)
    ax.grid(True, which="minor", color=GRID, linewidth=0.35)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 36)
    ax.set_ylim(0, 41)
    ax.set_xlabel("Temperature of the surroundings (°C)")
    ax.set_ylabel("Body temperature (°C)")
    ax.tick_params(labelsize=9)
    ax.legend(loc="lower right", fontsize=9.5, frameon=True, framealpha=1.0, edgecolor=INK)
    ax.set_title("Body temperature of two animals kept at different temperatures", fontsize=11)
    return fig


def _draw_core(p: dict):
    fig, ax = new_figure(7.0, 4.6)
    ts, vs = [k[0] for k in p["knots"]], [k[1] for k in p["knots"]]
    ax.plot(ts, vs, color=INK, linewidth=1.8, marker="o", markersize=4.5, gid="core")
    ax.plot([0, 90], [37.0, 37.0], color=INK, linewidth=1.0, linestyle=(0, (4, 3)), gid="normal")
    ext = _extreme(p)[1]
    lo, hi = (36.6, round(ext + 0.4, 1)) if p["mode"] == "hot" else (round(ext - 0.4, 1), 37.4)
    ticks = [round(lo + 0.2 * i, 1) for i in range(int(round((hi - lo) / 0.2)) + 1)]
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{t:.1f}" for t in ticks])
    ax.set_xticks(range(0, 91, 10))
    ax.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.set_xlim(0, 92)
    ax.set_ylim(lo, hi)
    if p["mode"] == "hot":
        ax.text(89, 36.9, "normal body temperature, 37.0 °C", ha="right", va="top", fontsize=9, style="italic")
    else:
        ax.text(89, 37.1, "normal body temperature, 37.0 °C", ha="right", va="bottom", fontsize=9, style="italic")
    ax.set_xlabel("Time from the start (minutes)")
    ax.set_ylabel("Core body temperature (°C)")
    ax.tick_params(labelsize=8.5)
    t_ext = _extreme(p)[0]
    what = (f"exercised hard in a hot room from 10 to {t_ext} minutes,\nthen rested in the shade" if p["mode"] == "hot"
            else f"sat in cold water from 10 to {t_ext} minutes,\nthen got out and dried")
    ax.set_title(f"Core body temperature of a person who {what}", fontsize=10.5, pad=12)
    return fig


def _extreme(p: dict):
    pick = max if p["mode"] == "hot" else min
    return pick(p["knots"], key=lambda k: k[1])


def draw(p: dict):
    return {"skin": _draw_skin, "endo_ecto": _draw_endo_ecto, "core": _draw_core}[p["kind"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson in Huye", "for a revision poster", "from a textbook in the school library in Musanze",
            "before a test on homeostasis", "for homework", "at the science club in Rubavu", "for a class display in Nyagatare",
            "in a lesson on temperature control"]


GRAPH_SETTINGS = ["in a biology lesson in Huye", "for a revision poster", "before a test on homeostasis", "for homework",
                  "at the science club in Rubavu", "in a lesson on temperature control", "in a textbook in Musanze",
                  "in a revision class in Nyagatare"]


def _deg(v) -> list[str]:
    forms = []
    for n in dict.fromkeys([exact(v), f"{float(v):.1f}"]):
        forms += [n, f"{n} °C", f"{n} degrees", f"{n} degrees Celsius", f"{n} °"]
    return forms[1:]


def _q_skin(p: dict, rng: random.Random) -> list:
    at = {v: k for k, v in p["labels"].items()}
    a, b, c = rng.sample(sorted(at), 3)
    who = rng.choice(NAMES)
    rest = lambda keep: [k for k in sorted(p["labels"]) if k != keep]  # noqa: E731
    qs = [letter_choice(f"{who} labelled this section through the skin {rng.choice(SETTINGS)}. Which letter shows the {a}?",
                        at[a], [at[x] for x in CONFUSE[a] if x in at] + rest(at[a]))]
    qs.append(letter_choice(f"Using the table, which letter shows the part that {ROLE[b]}?", at[b],
                            [at[x] for x in CONFUSE[b] if x in at] + rest(at[b])))
    qs.append(mcq(rng.choice(["What is the part labelled {L}?", "Which part of the skin is labelled {L}?"]).format(L=at[c]),
                  c, CONFUSE[c], rng))
    return qs


def _q_endo_ecto(p: dict, rng: random.Random) -> list:
    endo = next(a for a in p["animals"] if a["endo"])
    ecto = next(a for a in p["animals"] if not a["endo"])
    who = rng.choice(NAMES)
    key = f"animal {endo['letter']}"
    stem = rng.choice(["Which animal is an endotherm, keeping its body temperature steady?",
                       "Which animal keeps the same body temperature however warm or cold its surroundings are?"])
    qs = [mcq(f"{who} is studying this graph of two animals' body temperatures {rng.choice(GRAPH_SETTINGS)}. {stem}", key,
              [f"animal {ecto['letter']}", "both animals", "neither animal"], rng)]
    lo = p["range"][0]
    T = rng.choice([t for t in (5, 10, 15, 20, 25, 30) if t >= lo])
    v = T + ecto["offset"]
    qs.append(short(f"What was the body temperature of animal {ecto['letter']} when its surroundings were at {T} °C?", v,
                    _deg(v)))
    meet = endo["body"] - ecto["offset"]
    qs.append(short("At what temperature of the surroundings did the two animals have the same body temperature?", meet,
                    _deg(meet)))
    return qs


def _q_core(p: dict, rng: random.Random) -> list:
    t_ext, ext = _extreme(p)
    who = rng.choice(NAMES)
    word = "highest" if p["mode"] == "hot" else "lowest"
    qs = [short(f"{who} is studying this record of a person's core body temperature {rng.choice(GRAPH_SETTINGS)}. What "
                f"was the {word} core body temperature?", exact(ext), _deg(ext))]
    i = [k[0] for k in p["knots"]].index(t_ext)
    back = next(t for t, v in p["knots"][i:] if v == 37.0)
    qs.append(short("How many minutes after the start was the core body temperature back at 37.0 °C?", back,
                    [f"{back} minutes", f"{back} min", f"{back} mins"]))
    d = round(abs(ext - 37.0), 1)
    verb = "rise above" if p["mode"] == "hot" else "fall below"
    qs.append(short(f"By how many °C did the core body temperature {verb} 37.0 °C at most?", exact(d), _deg(d)))
    return qs


def questions(p: dict, rng: random.Random) -> list:
    return {"skin": _q_skin, "endo_ecto": _q_endo_ecto, "core": _q_core}[p["kind"]](p, rng)
