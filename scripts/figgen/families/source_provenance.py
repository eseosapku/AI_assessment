"""Four sources about one real event, in a table (UP; AS Level "Preparing for assessment" by name): each source lettered
A to D, with what it is, who made it, when it was made and how its maker knew. The definitions of a primary source, a
secondary source and an eyewitness are printed above the table, and the event's date and place under the title.

The authors are invented ("a teacher who was at the independence ceremony in Lagos", "a historian at a university in
Ibadan"); the events and their dates are real and fixed in the table below. A primary source here is always made
within a week of the event, a secondary source at least fifteen years later, so the printed definitions class every
source one way only; exactly one maker was there and saw the event.

How many of the four are primary sources; which source was made closest in time to the event; which source an
eyewitness made; how many years after the event a secondary source was made; and, when one source stands alone,
which is the only primary (or secondary) source.
"""
from __future__ import annotations

import random
import textwrap
from datetime import date, timedelta

from matplotlib.patches import Rectangle

from ..core import FILL_2, INK, NAMES, Question, new_figure, short

ID = "source_provenance"
KIND = "table.data"
SUBJECT = "history"
BANDS = ("UP",)
# The AS Level coursebooks' "Preparing for assessment" chapters teach exactly this reading of sources.
ALSO_BANDS = {"UP": ("AL",)}
SOURCES = "history.historical-sources-and-methods"
ASSESSMENT = "history.assessment-introduction"
CONCEPTS = (SOURCES, ASSESSMENT)
# A topic whose sections the book lists (and an AS Level topic, by its name) is reached only if it names sources,
# historiography or preparing for assessment.
NEEDS = r"source|historiograph|preparing for assessment"
AVOID = r"genocide|human rights|islam|slave"
TOPICS = r"source analysis|historiograph|preparing for assessment"

NG_NAMES = ["Chinedu", "Amina", "Tunde", "Ngozi", "Emeka", "Aisha", "Bola", "Ifeoma", "Musa", "Funke", "Chioma",
            "Ibrahim", "Kemi", "Obinna", "Zainab", "Femi"]

# Each event: its name, its date, where it happened, what an eyewitness was at, the towns others heard of it in,
# whose names the questions use, and whether an AS Level coursebook's period holds it.
EVENTS = [
    ("Nigeria becomes independent", [1960, 10, 1], "Lagos", "independence ceremony", ["Kano", "Enugu", "Ibadan", "Kaduna"], "ng", False),
    ("Ghana becomes independent", [1957, 3, 6], "Accra", "independence ceremony", ["Kumasi", "Tamale", "Cape Coast"], "ng", False),
    ("The Organisation of African Unity is founded", [1963, 5, 25], "Addis Ababa", "founding meeting",
     ["Nairobi", "Accra", "Kampala", "Lagos"], "ng", False),
    ("ECOWAS is founded", [1975, 5, 28], "Lagos", "signing of the treaty", ["Kano", "Accra", "Ibadan", "Enugu"], "ng", False),
    ("Rwanda becomes independent", [1962, 7, 1], "Kigali", "independence ceremony", ["Huye", "Musanze", "Rubavu"], "rw", False),
    ("Kenya becomes independent", [1963, 12, 12], "Nairobi", "independence ceremony", ["Mombasa", "Kisumu", "Nakuru"], "rw", False),
    ("Tanganyika becomes independent", [1961, 12, 9], "Dar es Salaam", "independence ceremony", ["Arusha", "Mwanza", "Tanga"],
     "rw", False),
    ("The Liverpool and Manchester Railway opens", [1830, 9, 15], "Liverpool", "opening", ["Manchester", "Leeds", "Bristol"],
     "rw", True),
    ("The Great Exhibition opens", [1851, 5, 1], "London", "opening", ["Manchester", "Leeds", "Bristol"], "rw", True),
    ("The Frankfurt Parliament first meets", [1848, 5, 18], "Frankfurt", "first meeting", ["Berlin", "Munich", "Hamburg"],
     "rw", True),
    ("The German Empire is proclaimed", [1871, 1, 18], "Versailles", "proclamation", ["Berlin", "Munich", "Hamburg"], "rw", True),
    ("The Suez Canal opens", [1869, 11, 17], "Port Said", "opening", ["Cairo", "Alexandria", "Paris"], "rw", False),
    ("Abraham Lincoln is sworn in as President", [1861, 3, 4], "Washington", "swearing-in", ["Boston", "Chicago", "New York"],
     "rw", True),
    ("The Treaty of Versailles is signed", [1919, 6, 28], "Versailles", "signing", ["Paris", "London", "Berlin"], "rw", True),
    ("The League of Nations Assembly first meets", [1920, 11, 15], "Geneva", "first meeting", ["Paris", "London", "Rome"],
     "rw", True),
]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
ROLES = ["teacher", "nurse", "student", "trader", "clerk", "farmer"]
# Who could stand at a meeting, a signing or a proclamation: no crowd watched those.
STAFF = ["secretary", "interpreter", "clerk", "messenger"]
CROWDS = ("independence ceremony", "opening", "swearing-in")
DEFINITIONS = [("Primary source", "made at the time of the event (within days of it), by someone who lived through it."),
               ("Secondary source", "made later (years afterwards), by someone who studied the event from other sources."),
               ("Eyewitness", "a person who saw the event happen with their own eyes.")]


def concepts_for(p: dict) -> tuple[str, ...]:
    return (SOURCES, ASSESSMENT) if _event(p)[6] else (SOURCES,)


def avoid_for(p: dict) -> str:
    return f"{AVOID}|^(?!.*(?:{TOPICS}))"


def _event(p: dict) -> tuple:
    return next(e for e in EVENTS if e[0] == p["event"])


def written(d: list) -> str:
    """A date as the table prints it: "1 October 1960", or a year alone."""
    return f"{d[2]} {MONTHS[d[1] - 1]} {d[0]}" if len(d) == 3 else str(d[0])


# --- sampling ---------------------------------------------------------------------------------------------

def _eyewitness(rng, ev) -> dict:
    name, when, place, noun = ev[0], ev[1], ev[2], ev[3]
    roles = ROLES if noun in CROWDS else STAFF
    kinds = [("A diary entry", f"A {rng.choice(roles)} who was at the {noun} in {place}", [0, 1]),
             ("A letter", f"A {rng.choice(roles)} who was at the {noun} in {place}", list(range(2, 8))),
             ("A newspaper report", f"A reporter who was at the {noun} in {place}", [1, 2])]
    if when[0] >= 1855:
        kinds.append(("A photograph", f"A newspaper photographer at the {noun} in {place}", [0]))
    what, who, gaps = rng.choice(kinds)
    how = "Was there and took the photograph" if what == "A photograph" else "Was there and saw it happen"
    return {"what": what, "who": who, "gap": rng.choice(gaps), "how": how}


def _heard(rng, ev) -> dict:
    when, towns = ev[1], ev[4]
    news = (["Heard the news on the radio"] if when[0] >= 1925 else []) + ["Read about it in a newspaper"]
    kinds = [("A letter", f"A {rng.choice(ROLES)} in {rng.choice(towns)}", list(range(2, 8)), news),
             ("A diary entry", f"A {rng.choice(ROLES)} in {rng.choice(towns)}", [0, 1], news),
             ("A newspaper report", f"An editor in {rng.choice(towns)}", [1, 2, 3], _wires(when[0]))]
    what, who, gaps, hows = rng.choice(kinds)
    return {"what": what, "who": who, "gap": rng.choice(gaps), "how": rng.choice(hows)}


def _wires(year: int) -> list:
    """How an editor far away had the news within days: letters before the telegraph, the telegraph after it, news
    agencies once radio and telex carried their reports."""
    if year < 1850:
        return ["Used letters from people who were there"]
    return ["Used news agency reports"] if year >= 1925 else ["Used reports sent by telegraph"]


def _later(rng, ev) -> dict:
    year, towns = ev[1][0], ev[4] + [ev[2]]
    town = rng.choice(towns)
    kinds = [("A school textbook", f"A history teacher in {town}", year + 15, "Read old newspapers and government records"),
             ("A history book", f"A historian at a university in {town}", year + 15,
              "Read letters, diaries and newspapers from the time"),
             ("A magazine article", f"A journalist in {town}", year + 15, "Read history books about the event")]
    if year >= 1900:
        kinds.append(("A documentary film", f"A film-maker in {town}", max(1950, year + 15),
                      "Interviewed people who were there and used old film"))
    kinds.append(("A museum website", f"A museum guide in {town}", max(2000, year + 15), "Read the museum's old papers and letters"))
    what, who, first, how = rng.choice(kinds)
    last = min(2024, year + 60) if what == "A documentary film" else min(2024, year + 140)
    return {"what": what, "who": who, "year": rng.randint(first, max(first, last)), "how": how}


def sample(rng: random.Random) -> dict:
    ev = rng.choice(EVENTS)
    d0 = date(*ev[1])
    while True:
        n = rng.choice([1, 2, 3])
        rows = [_eyewitness(rng, ev)] + [_heard(rng, ev) for _ in range(n - 1)] + [_later(rng, ev) for _ in range(4 - n)]
        if len({r["what"] for r in rows}) < 4 or len({r["who"] for r in rows}) < 4:
            continue
        gaps = [r["gap"] for r in rows if "gap" in r]
        years = [r["year"] for r in rows if "year" in r]
        if len(set(gaps)) < len(gaps) or len(set(years)) < len(years):
            continue
        sources = []
        for r in rows:
            if "gap" in r:
                d = d0 + timedelta(days=r["gap"])
                when = [d.year, d.month, d.day]
            else:
                when = [r["year"]]
            sources.append({"what": r["what"], "who": r["who"], "when": when, "how": r["how"]})
        rng.shuffle(sources)
        later = [i for i, s in enumerate(sources) if len(s["when"]) == 1]
        return {"band": "UP", "event": ev[0], "sources": sources, "ask": "ABCD"[rng.choice(later)]}


# --- drawing ----------------------------------------------------------------------------------------------

COLS = [("Source", 0.3, 1.15, None), ("What it is", 1.15, 3.15, 20), ("Who made it", 3.15, 6.75, 38),
        ("When it was made", 6.75, 8.65, None), ("How the maker knew", 8.65, 11.9, 34)]
KEYS = [None, "what", "who", "when", "how"]


def draw(p: dict):
    ev = _event(p)
    cells = []
    for s in p["sources"]:
        row = [textwrap.fill(s["what"], 20), textwrap.fill(s["who"], 38), written(s["when"]), textwrap.fill(s["how"], 34)]
        cells.append(row)
    heights = [0.22 + 0.2 * max(c.count("\n") + 1 for c in row) for row in cells]
    head_h = 0.42
    W = 12.2
    H = 0.55 + 0.4 + 1.05 + 0.25 + head_h + sum(heights) + 0.25
    fig, ax = new_figure(W, H)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    y = H - 0.35
    ax.text(0.3, y, "Four sources about one event", ha="left", va="center", fontsize=13, fontweight="bold")
    y -= 0.4
    ax.text(0.3, y, f"The event: {ev[0]}, in {ev[2]}, on {written(ev[1])}", ha="left", va="center", fontsize=11.5,
            gid="event")
    # the definitions, in a shaded box
    top = y - 0.25
    ax.add_patch(Rectangle((0.3, top - 1.05), 11.6, 1.05, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
    for i, (word, means) in enumerate(DEFINITIONS):
        yy = top - 0.22 - i * 0.31
        ax.text(0.45, yy, word + ":", ha="left", va="center", fontsize=10.5, fontweight="bold", gid=f"def:{i}")
        ax.text(2.25, yy, means, ha="left", va="center", fontsize=10.5)
    # the table
    y = top - 1.05 - 0.25
    xs = [c[1] for c in COLS] + [COLS[-1][2]]
    ax.add_patch(Rectangle((xs[0], y - head_h), xs[-1] - xs[0], head_h, facecolor="#e3e6e9", edgecolor="none"))
    for name, x0, x1, _ in COLS:
        ax.text(x0 + 0.1, y - head_h / 2, name, ha="left", va="center", fontsize=10.5, fontweight="bold")
    edges = [y, y - head_h]
    yy = y - head_h
    for letter, row, h in zip("ABCD", cells, heights):
        ax.text(xs[0] + 0.42, yy - h / 2, letter, ha="center", va="center", fontsize=13, fontweight="bold",
                gid=f"cell:{letter}:letter")
        for k, text in enumerate(row, start=1):
            ax.text(xs[k] + 0.1, yy - h / 2, text, ha="left", va="center", fontsize=10.5, linespacing=1.25,
                    gid=f"cell:{letter}:{KEYS[k]}")
        yy -= h
        edges.append(yy)
    for e in edges:
        ax.plot([xs[0], xs[-1]], [e, e], color=INK, linewidth=0.9)
    for x in xs:
        ax.plot([x, x], [edges[0], edges[-1]], color=INK, linewidth=0.9)
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------------

SETTINGS = ["in a history lesson", "for a source question", "before a mock exam", "for homework", "at the history club",
            "on a revision card", "for a class debate"]
VERBS = ["sorts", "compares", "studies", "reads"]


def _letters(stem: str, key: str) -> Question:
    return Question("mcq", stem, str("ABCD".index(key)), list("ABCD"))


def questions(p: dict, rng: random.Random) -> list:
    ev = _event(p)
    who = rng.choice(NG_NAMES if ev[5] == "ng" else NAMES)
    d0 = date(*ev[1])
    srcs = dict(zip("ABCD", p["sources"]))
    primary = [k for k, s in srcs.items() if len(s["when"]) == 3]
    gap = {k: ((date(*s["when"]) if len(s["when"]) == 3 else date(s["when"][0], 1, 1)) - d0).days for k, s in srcs.items()}
    eye = next(k for k, s in srcs.items() if s["how"].startswith("Was there"))
    n = len(primary)
    qs = [short(f"{who} {rng.choice(VERBS)} these four sources about one event {rng.choice(SETTINGS)}. By the "
                f"definitions printed, how many of the four are primary sources?", n,
                [f"{n} sources" if n != 1 else "1 source", f"{n} primary sources" if n != 1 else "1 primary source"]),
          _letters("Which source was made closest in time to the event?", min(gap, key=gap.get)),
          _letters("By the definition printed, which source was made by an eyewitness?", eye)]
    x = p["ask"]
    years = srcs[x]["when"][0] - d0.year
    qs.append(short(f"How many years after the event was source {x} made?", years, [f"{years} years"]))
    if n == 1:
        qs.append(_letters("By the definitions printed, which source is the only primary source?", primary[0]))
    elif n == 3:
        qs.append(_letters("By the definitions printed, which source is the only secondary source?",
                           next(k for k in srcs if k not in primary)))
    return qs
