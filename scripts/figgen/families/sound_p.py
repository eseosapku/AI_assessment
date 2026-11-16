"""Sound (P), of three kinds.

- distance (stages 1-2): a child beats a drum or rings a bell at one end of the playground; three or four children
  stand along the ground, each with their name and how many steps they are from it printed. Who hears it loudest (the
  nearest), who hears it most quietly (the farthest), how many steps a child is from it.
- muffle (stages 3-5): a class wraps a ringing alarm clock in different materials and reads a sound meter each time; a
  bar chart of the readings in decibels, every bar ending on a gridline with its value printed, and "no cover" for the
  clock left bare. Two soft materials (a towel, cotton wool, foam, a woollen jumper) always beat the thin ones (kitchen
  foil, newspaper, a plastic bag, a sheet of paper); which soft one wins is the class's result, read off the chart.
  Which material muffled the sound best; a reading; how much quieter one soft material made it than no cover.
- pitch (stages 3-5): three or four metal bars from a xylophone set, lettered, each with its length printed; the
  shorter the bar, the higher its note. Which bar makes the highest note, and which the lowest.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, GRID, INK, NAMES, Question, count, mcq, new_figure, short

ID = "sound_p"
KIND = "diagram.template"
SUBJECT = "science"
BANDS = ("P",)
CONCEPTS = tuple(f"science.{c}" for c in ("sound-propagation", "sound-properties", "sound-reflection-and-absorption",
                                          "hearing-and-ear"))
# A topic whose sections the book lists is reached only if its name or a section names sound, noise or hearing.
NEEDS = r"sound|noise|hearing|pitch|\bloud"
AVOID = (r"\bcells?\b|programming|scratch|computer|science in context|glossary|reproduct|sexual|\bHIV\b|STIs|"
         r"social factors")

SOFT = ["a towel", "cotton wool", "foam", "a woollen jumper"]
THIN = ["kitchen foil", "newspaper", "a plastic bag", "a sheet of paper"]
SKIN = "#8d5524"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"distance": ("science.sound-propagation", "science.sound-properties", "science.hearing-and-ear"),
            "muffle": ("science.sound-reflection-and-absorption", "science.sound-properties", "science.sound-propagation"),
            "pitch": ("science.sound-properties",)}[p["kind"]]


def avoid_for(p: dict) -> str:
    # Cambridge Stage 1's "Hearing sounds" names no year: only the playground picture is for it.
    return AVOID if p["kind"] == "distance" else AVOID + r"|hearing sounds"


def stages(p: dict) -> tuple[int, int]:
    return (1, 2) if p["kind"] == "distance" else (3, 5)


def _distance(rng: random.Random) -> dict:
    n = rng.choice([3, 4])
    while True:
        steps = sorted(rng.sample(range(2, 16), n))
        if all(b - a >= 3 for a, b in zip(steps, steps[1:])):
            break
    return {"band": "P", "kind": "distance", "source": rng.choice(["drum", "bell"]), "children": rng.sample(NAMES, n),
            "steps": steps}


def _muffle(rng: random.Random) -> dict:
    step = rng.choice([5, 10])
    mats = rng.sample(SOFT, 2) + rng.sample(THIN, rng.choice([1, 2]))
    while True:
        bare = rng.randrange(70, 91, step)
        thin = rng.sample(range(bare - 30, bare - step + 1, step), len(mats) - 2)
        room = range(30, min(thin) - 10 + 1, step)
        if len(room) < 2:
            continue
        soft = rng.sample(room, 2)
        levels = soft + thin
        if min(thin) - max(soft) >= 10 and all(abs(a - b) >= step for i, a in enumerate(levels) for b in levels[i + 1:]):
            break
    order = list(range(len(mats) + 1))
    rng.shuffle(order)
    allm, alll = ["no cover"] + mats, [bare] + levels
    return {"band": "P", "kind": "muffle", "step": step, "materials": [allm[i] for i in order],
            "levels": [alll[i] for i in order]}


def _pitch(rng: random.Random) -> dict:
    n = rng.choice([3, 4])
    while True:
        lengths = rng.sample(range(10, 31), n)
        if min(abs(a - b) for i, a in enumerate(lengths) for b in lengths[i + 1:]) >= 2:
            return {"band": "P", "kind": "pitch", "lengths": lengths}


def sample(rng: random.Random) -> dict:
    return {"distance": _distance, "muffle": _muffle, "pitch": _pitch}[rng.choice(["distance", "muffle", "pitch"])](rng)


# --- drawing ------------------------------------------------------------------------------------------------

def _child(ax, x, colour):
    ax.plot([x - 0.18, x, x + 0.18], [0, 0.75, 0], color=INK, linewidth=2.4, zorder=3)
    ax.add_patch(FancyBboxPatch((x - 0.22, 0.7), 0.44, 0.7, boxstyle="round,pad=0,rounding_size=0.08", facecolor=colour,
                                edgecolor=INK, linewidth=1.3, zorder=4))
    ax.plot([x - 0.45, x - 0.22], [0.85, 1.3], color=INK, linewidth=2.2, zorder=3)
    ax.plot([x + 0.45, x + 0.22], [0.85, 1.3], color=INK, linewidth=2.2, zorder=3)
    ax.add_patch(Circle((x, 1.68), 0.26, facecolor=SKIN, edgecolor=INK, linewidth=1.4, zorder=4))


def _drum(ax, x):
    ax.add_patch(Rectangle((x - 0.45, 0), 0.9, 0.9, facecolor="#c0392b", edgecolor=INK, linewidth=1.4, zorder=3))
    ax.add_patch(Ellipse((x, 0.9), 0.9, 0.3, facecolor="#f5e6ca", edgecolor=INK, linewidth=1.4, zorder=4))
    for k in range(4):
        ax.plot([x - 0.45 + 0.3 * k, x - 0.3 + 0.3 * k], [0.05, 0.75], color=INK, linewidth=1.0, zorder=4)


def _bell(ax, x):
    pts = [(x - 0.5, 0.35), (x + 0.5, 0.35), (x + 0.35, 0.6), (x + 0.28, 1.1), (x, 1.3), (x - 0.28, 1.1), (x - 0.35, 0.6)]
    ax.add_patch(Polygon(pts, closed=True, facecolor="#f4d03f", edgecolor=INK, linewidth=1.4, zorder=3))
    ax.add_patch(Circle((x, 0.28), 0.1, facecolor="#7f8c8d", edgecolor=INK, linewidth=1.0, zorder=4))
    ax.add_patch(Rectangle((x - 0.06, 1.28), 0.12, 0.3, facecolor="#7e5109", edgecolor=INK, linewidth=1.0, zorder=3))


COLOURS = ["#5dade2", "#f5b041", "#58d68d", "#af7ac5"]
UNIT = 0.62  # one step on the page


def _draw_distance(p: dict):
    far = max(p["steps"]) * UNIT
    fig, ax = new_figure(max(6.4, 0.75 * (far + 2.6)), 3.4)
    ax.add_patch(Rectangle((-1.0, -0.9), far + 2.2, 0.9, facecolor="#e9ecef", edgecolor="none", zorder=0))
    ax.plot([-1.0, far + 1.2], [0, 0], color=INK, linewidth=1.6, zorder=1)
    (_drum if p["source"] == "drum" else _bell)(ax, 0)
    ax.text(0, -0.45, p["source"].capitalize(), ha="center", va="center", fontsize=12, fontweight="bold")
    for i, (kid, n) in enumerate(zip(p["children"], p["steps"])):
        x = n * UNIT
        _child(ax, x, COLOURS[i])
        ax.text(x, 2.25, kid, ha="center", va="center", fontsize=12, fontweight="bold")
        ax.text(x, -0.45, f"{n} steps", ha="center", va="center", fontsize=11)
    ax.set_xlim(-1.0, far + 1.2)
    ax.set_ylim(-0.9, 2.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_muffle(p: dict):
    mats, levels, step = p["materials"], p["levels"], p["step"]
    fig, ax = new_figure(1.9 * len(mats) + 1.4, 4.6)
    for i, (mat, v) in enumerate(zip(mats, levels)):
        bar = ax.bar(i, v, 0.6, color="#d6dade" if mat == "no cover" else FILL, edgecolor=INK, linewidth=1.0)
        bar[0].set_gid(f"bar:{i}")
        ax.text(i, v + 1.5, str(v), ha="center", va="bottom", fontsize=11, fontweight="bold")
    top = max(levels) + 15
    top += (-top) % 10
    ax.set_xticks(range(len(mats)))
    ax.set_xticklabels([m.replace("a woollen jumper", "a woollen\njumper").replace("a sheet of paper", "a sheet\nof paper")
                        .replace("a plastic bag", "a plastic\nbag").replace("kitchen foil", "kitchen\nfoil")
                        for m in mats], fontsize=11)
    ax.set_yticks(range(0, top + 1, 10))
    ax.set_yticks(range(0, top + 1, step), minor=True)
    ax.tick_params(axis="y", labelsize=10.5)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, len(mats) - 0.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.set_ylabel("Sound level (decibels)", fontsize=11)
    ax.set_xlabel("What was wrapped round the clock", fontsize=11)
    ax.set_title("Sound of a ringing alarm clock\n(a lower reading means a quieter sound)", fontsize=12)
    return fig


def _draw_pitch(p: dict):
    lengths = p["lengths"]
    n = len(lengths)
    s = 0.12  # page units per cm
    fig, ax = new_figure(1.6 * n + 1.0, 4.6)
    for i, L in enumerate(lengths):
        x = i * 1.6
        h = L * s
        ax.add_patch(FancyBboxPatch((x - 0.3, 0), 0.6, h, boxstyle="round,pad=0,rounding_size=0.08", facecolor="#bdc3c7",
                                    edgecolor=INK, linewidth=1.4, zorder=3, gid=f"bar:{i}"))
        for y in (0.18 * h, 0.82 * h):
            ax.add_patch(Circle((x, y), 0.06, facecolor=INK, edgecolor=INK, zorder=4))
        ax.text(x, h + 0.3, f"{L} cm", ha="center", va="center", fontsize=11)
        ax.add_patch(Circle((x, -0.5), 0.26, facecolor="white", edgecolor=INK, linewidth=1.6, zorder=5))
        ax.text(x, -0.5, "ABCD"[i], ha="center", va="center", fontsize=15, fontweight="bold", zorder=6, gid=f"letter:{i}")
    ax.set_xlim(-0.8, 1.6 * (n - 1) + 0.8)
    ax.set_ylim(-0.9, 30 * s + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Bars from a xylophone", fontsize=12)
    return fig


def draw(p: dict):
    return {"distance": _draw_distance, "muffle": _draw_muffle, "pitch": _draw_pitch}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------

PLACES = ["in the playground", "on the football field", "at break time", "in the school garden", "before a race"]
CLASSES = ["P3", "P4", "P5"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice([n for n in NAMES if n not in p.get("children", [])])
    if p["kind"] == "distance":
        kids, steps = p["children"], p["steps"]
        verb = "beats a drum" if p["source"] == "drum" else "rings a bell"
        thing = p["source"]
        near, far = kids[steps.index(min(steps))], kids[steps.index(max(steps))]
        other = rng.choice(kids)
        first, second = rng.sample([("loudest", near), ("most quietly", far)], 2)
        return [mcq(f"{who} {verb} {rng.choice(PLACES)}. Which child hears the {thing} {first[0]}?", first[1],
                    [k for k in kids if k != first[1]], rng),
                mcq(f"Which child hears the {thing} {second[0]}?", second[1], [k for k in kids if k != second[1]], rng),
                count(f"How many steps is {other} from the {thing}?", steps[kids.index(other)], "steps")]
    if p["kind"] == "muffle":
        mats, levels = p["materials"], p["levels"]
        best = mats[levels.index(min(levels))]
        bare = levels[mats.index("no cover")]
        soft = rng.choice([m for m in mats if m in SOFT])
        read = rng.choice([m for m in mats if m != "no cover"])
        db = lambda v: [f"{v} decibels", f"{v} dB", f"{v}dB"]  # noqa: E731
        return [mcq(f"{who}'s class in {rng.choice(CLASSES)} wraps a ringing alarm clock in different things and measures "
                    "how loud it is. Which material muffled the sound best?", best, [m for m in mats if m != best], rng),
                short(f"What was the sound level with {read} round the clock, in decibels?", levels[mats.index(read)],
                      db(levels[mats.index(read)])),
                short(f"How much quieter was the sound with {soft} than with no cover, in decibels?",
                      bare - levels[mats.index(soft)], db(bare - levels[mats.index(soft)]))]
    lengths = p["lengths"]
    letters = list("ABCD"[:len(lengths)])
    hi, lo = letters[lengths.index(min(lengths))], letters[lengths.index(max(lengths))]
    lead = f"{who} taps each metal bar with a beater {rng.choice(['in music class', 'in a science lesson', 'at home', 'with a friend'])}."
    first = rng.choice(["highest", "lowest"])
    qs = [Question("mcq", f"{lead} Which bar makes the {first} note?", str(letters.index(hi if first == 'highest' else lo)),
                   letters)]
    other = "lowest" if first == "highest" else "highest"
    qs.append(Question("mcq", f"Which bar makes the {other} note?", str(letters.index(hi if other == 'highest' else lo)),
                       letters))
    return qs
