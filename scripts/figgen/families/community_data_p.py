"""Data about invented communities, of four kinds.

- pictogram (P4 to P6): people in four or five villages (one picture of a person stands for 100 people), the jobs of the
  people in a cell (one picture for 10 people) or the tourists who visited a park in four or five months (one picture
  for 20 tourists), with the key printed under it. Lower (P4): whole pictures only; upper (P5 to P6): half a picture
  for half the key's number. How many in one row (from the key), which row has the most, how many altogether, how
  many more in one row than another.
- bar (P4 to P6): the people in each village of a sector as a bar chart, every bar ending on a gridline (hundreds at
  the lower level, fifties at the upper). Which village has the most (or the fewest) people, how many altogether, how
  many more in one village than another.
- workers (Lower Secondary): the workers in each economic activity in an invented town as a bar chart, with the rule
  for a percentage printed (percentage = number ÷ total × 100). How many workers altogether, what percentage work in
  one activity (always a whole number), how many more in one activity than another, which activity has the most.
- tourists (Upper Secondary): the tourists who visited an invented national park in each month of a year as a line
  graph, every point on a gridline, with the rule for a percentage increase printed. Which month had the most visitors,
  how many more came in one month than another, the percentage increase from one month to a later one (always whole),
  how many came in the first three months.

Every number belongs to an invented village, cell, town or park. No two rows of a pictogram or bar chart tie; of a
year's months, the busiest is one month, 200 tourists clear of the next.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import GRID, INK, NAMES, count, mcq, new_figure, short

ID = "community_data_p"
KIND = "graph.bar"
SUBJECT = "social-studies"
BANDS = ("P", "LS", "UP")
POPULATION = ("social-studies.population",)
ACTIVITIES = ("social-studies.economic-activities", "social-studies.comparison-economic-activities")
WORK = ("social-studies.economic-activities", "social-studies.employment-unemployment")
TOURISM = ("social-studies.tourism-culture",)
CONCEPTS = ("social-studies.population", "social-studies.economic-activities",
            "social-studies.comparison-economic-activities", "social-studies.employment-unemployment",
            "social-studies.tourism-culture")
# A topic whose sections the book lists is reached only if its name or a section names the population, a census, the
# economic activities, the basics of economics or tourism.
NEEDS = r"population|census|economic activit|economics basics|touris"
# Never a religious, values or behaviour topic; nor tourism's place in culture and the arts.
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights|historical events|conflict|genocide|values|behaviour|"
         r"peace|harmony|environmental responsibility|national unity|rules and fairness|culture|heritage")

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
VILLAGES = ["Village A", "Village B", "Village C", "Village D", "Village E"]
JOBS = ["farmers", "traders", "teachers", "drivers", "tailors", "builders"]
ACTIVITY = ["farming", "trade", "teaching", "transport", "building", "fishing"]
PLACES = ["Green Hills", "Lakeside", "Sunrise", "Riverside", "Twin Hills", "Valley View", "Hilltop", "Morning Star"]
PARKS = ["Green Valley National Park", "Blue Mountain National Park", "Sunrise Hills National Park",
         "Silver River National Park"]
TOWNS = ["Town P", "Town Q", "Town R", "Town S"]
# Each pictogram: what a row is, what a picture stands for, and the most pictures in a row.
PICTO = {"people": (100, 9), "jobs": (10, 8), "tourists": (20, 8)}
# A year's tourists at a park in hundreds: busiest in the dry seasons (December to February, June to September).
SEASON = [22, 20, 12, 8, 9, 18, 26, 28, 20, 12, 10, 18]
WORDS = {3: "three", 4: "four", 5: "five", 6: "six"}


def stages(p: dict) -> tuple[int, int] | None:
    if p["band"] != "P":
        return None
    return (4, 6) if p["level"] == "lower" else (5, 6)


def concepts_for(p: dict) -> tuple[str, ...]:
    if p["band"] == "LS":
        return WORK
    if p["band"] == "UP":
        return TOURISM
    if p["sub"] == "bar" or p["context"] == "people":
        return POPULATION + ACTIVITIES[:1]
    return ACTIVITIES


def _distinct(rng: random.Random, lo: int, hi: int, step: int, n: int) -> list[int]:
    return [step * v for v in rng.sample(range(lo // step, hi // step + 1), n)]


def _pairs(vals: list[int]) -> list[list[int]]:
    return [[a, b] for a in range(len(vals)) for b in range(len(vals)) if vals[a] > vals[b]]


def _pictogram(rng: random.Random, level: str) -> dict:
    context = rng.choice(sorted(PICTO))
    key, most = PICTO[context]
    unit = key // 2 if level == "upper" else key
    n = rng.randint(4, 5)
    if context == "people":
        cats = VILLAGES[:n]
    elif context == "jobs":
        cats = rng.sample(JOBS, n)
    else:
        start = rng.randrange(0, 12 - n + 1)
        cats = MONTHS[start:start + n]
    while True:
        vals = _distinct(rng, key, key * most, unit, n)  # a whole picture at least in every row
        if level == "lower" or any(v % key for v in vals):  # an upper pictogram shows at least one half picture
            break
    return {"band": "P", "sub": "pictogram", "level": level, "context": context, "place": rng.choice(PLACES),
            "park": rng.choice(PARKS), "cats": cats, "values": vals, "key": key,
            "ask": {"one": rng.randrange(n), "more": rng.choice(_pairs(vals))}}


def _bar(rng: random.Random, level: str) -> dict:
    step = 100 if level == "lower" else 50
    n = rng.randint(4, 5)
    vals = _distinct(rng, 200, 900, step, n)
    return {"band": "P", "sub": "bar", "level": level, "place": rng.choice(PLACES), "cats": VILLAGES[:n],
            "values": vals, "step": step, "ask": {"one": rng.randrange(n), "more": rng.choice(_pairs(vals)),
                                                  "end": rng.choice(["most", "fewest"])}}


def _workers(rng: random.Random) -> dict:
    n = 5
    while True:
        total = rng.choice([200, 250, 500])
        vals = _distinct(rng, 10, total // 2, 10, n - 1)
        last = total - sum(vals)
        if last <= 0 or last % 10 or last in vals or last > total // 2:
            continue
        vals.append(last)
        if sorted(vals)[-1] - sorted(vals)[-2] < 10:
            continue
        cats = rng.sample(ACTIVITY, n)
        return {"band": "LS", "sub": "workers", "town": rng.choice(TOWNS), "cats": cats, "values": vals,
                "ask": {"share": rng.randrange(n), "more": rng.choice(_pairs(vals))}}


def _tourists(rng: random.Random) -> dict:
    while True:
        vals = [200 * max(3, round((h * 100 + 200 * rng.randint(-3, 3)) / 200)) for h in SEASON]
        top = sorted(vals, reverse=True)
        if top[0] - top[1] < 200:
            continue
        rises = [[a, b] for a in range(12) for b in range(a + 1, 12) if vals[b] > vals[a]
                 and (vals[b] - vals[a]) * 100 % vals[a] == 0]
        if not rises:
            continue
        return {"band": "UP", "sub": "tourists", "park": rng.choice(PARKS), "cats": MONTHS, "values": vals,
                "ask": {"more": rng.choice(_pairs(vals)), "rise": rng.choice(rises)}}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["pictogram", "bar", "workers", "tourists"])
    level = rng.choice(["lower", "upper"])
    if kind == "pictogram":
        return _pictogram(rng, level)
    if kind == "bar":
        return _bar(rng, level)
    return _workers(rng) if kind == "workers" else _tourists(rng)


# --- drawing ----------------------------------------------------------------------------------------

def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _person(ax, x: float, y: float, gid: str, half: bool) -> None:
    """A person: a round head over a rounded body; half of one is its left half."""
    clip = Rectangle((x - 0.3, y - 0.4), 0.3, 0.8, transform=ax.transData) if half else None
    body = FancyBboxPatch((x - 0.2, y - 0.32), 0.4, 0.36, boxstyle="round,pad=0,rounding_size=0.12",
                          facecolor="#2e86c1", edgecolor=INK, linewidth=1.0, zorder=3, gid=gid)
    head = Circle((x, y + 0.16), 0.13, facecolor="#8d5524", edgecolor=INK, linewidth=1.0, zorder=3)
    for art in (body, head):
        ax.add_patch(art)
        if clip is not None:
            art.set_clip_path(clip)
    if half:  # the cut edge drawn plainly, so half a person reads as half
        ax.add_patch(Rectangle((x - 0.012, y - 0.32), 0.024, 0.61, facecolor=INK, edgecolor="none", zorder=3.2))


def _title(p: dict) -> str:
    if p["context"] == "people":
        return f"People in the villages of {p['place']} Sector"
    if p["context"] == "jobs":
        return f"Jobs of the people in {p['place']} Cell"
    return f"Tourists who visited {p['park']}"


def _draw_pictogram(p: dict):
    n = len(p["cats"])
    label_w, step = 2.4, 0.62
    fig, ax = new_figure(9.0, 0.85 * n + 2.2)
    for r, (cat, v) in enumerate(zip(p["cats"], p["values"])):
        y = n - r
        ax.text(label_w - 0.25, y, cat, ha="right", va="center", fontsize=13)
        whole, part = divmod(v, p["key"])
        for i in range(whole):
            _person(ax, label_w + 0.4 + step * i, y, f"pict:{r}:full", False)
        if part:
            _person(ax, label_w + 0.4 + step * whole, y, f"pict:{r}:half", True)
        ax.plot([0, label_w + 6.4], [y - 0.5, y - 0.5], color=GRID, linewidth=0.8)
    ax.plot([label_w, label_w], [0.5, n + 0.5], color=INK, linewidth=1.2)
    noun = {"people": "people", "jobs": "people", "tourists": "tourists"}[p["context"]]
    ax.text(label_w - 0.25, -0.35, "Key:", ha="right", va="center", fontsize=13, fontweight="bold")
    _person(ax, label_w + 0.4, -0.35, "keypict", False)
    ax.text(label_w + 0.8, -0.35, f"= {p['key']} {noun}", ha="left", va="center", fontsize=13)
    if p["level"] == "upper":
        _person(ax, label_w + 3.2, -0.35, "keyhalf", True)
        ax.text(label_w + 3.5, -0.35, f"= {p['key'] // 2} {noun}", ha="left", va="center", fontsize=13)
    ax.text((label_w + 6.4) / 2, n + 0.85, _title(p), ha="center", va="center", fontsize=14, fontweight="bold")
    ax.set_xlim(-0.05, label_w + 6.5)
    ax.set_ylim(-0.9, n + 1.2)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _bars(ax, cats, vals, labels, color):
    bars = ax.bar(range(len(cats)), vals, width=0.6, color=color, edgecolor=INK, linewidth=1.0, zorder=3)
    for i, b in enumerate(bars):
        b.set_gid(f"bar-{i}")
    ax.set_xticks(range(len(cats)), labels)
    ax.set_xlim(-0.6, len(cats) - 0.4)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", which="minor", length=0)


def _draw_bar(p: dict):
    fig, ax = new_figure(8.0, 5.2)
    _bars(ax, p["cats"], p["values"], p["cats"], "#58d68d")
    top = max(p["values"]) + 2 * p["step"]
    top -= top % 100
    ax.set_yticks(range(0, top + 1, 100))
    ax.set_yticks(range(0, top + 1, p["step"]), minor=True)
    ax.set_ylim(0, top)
    ax.tick_params(labelsize=12)
    ax.set_ylabel("Number of people", fontsize=13)
    ax.set_title(f"People in the villages of {p['place']} Sector", fontsize=14, fontweight="bold")
    return fig


def _draw_workers(p: dict):
    fig, ax = new_figure(8.6, 5.6)
    _bars(ax, p["cats"], p["values"], [c.capitalize() for c in p["cats"]], "#f5b041")
    top = max(p["values"]) + 20
    top += (-top) % 20
    ax.set_yticks(range(0, top + 1, 20))
    ax.set_yticks(range(0, top + 1, 10), minor=True)
    ax.set_ylim(0, top)
    ax.tick_params(labelsize=10)
    ax.set_ylabel("Number of workers", fontsize=11)
    ax.set_xlabel("Economic activity", fontsize=11)
    ax.set_title(f"Workers in each economic activity in {p['town']}", fontsize=12.5, fontweight="bold")
    ax.text(0.5, -0.16, "Percentage of workers in an activity = number in the activity ÷ total workers × 100",
            transform=ax.transAxes, ha="center", va="top", fontsize=10)
    return fig


def _draw_tourists(p: dict):
    fig, ax = new_figure(9.4, 5.8)
    vals = p["values"]
    ax.plot(range(12), vals, color="#1e8449", linewidth=2.0, marker="o", markersize=6, markerfacecolor="white",
            markeredgecolor="#1e8449", markeredgewidth=1.8, zorder=3, gid="tourists")
    top = max(vals) + 400
    top += (-top) % 1000
    ax.set_yticks(range(0, top + 1, 1000), [fr(v) for v in range(0, top + 1, 1000)])
    ax.set_yticks(range(0, top + 1, 200), minor=True)
    ax.set_ylim(0, top)
    ax.yaxis.grid(True, which="both", color=GRID, linewidth=0.7)
    ax.xaxis.grid(True, color=GRID, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", which="minor", length=0)
    ax.set_xticks(range(12), [m[:3] for m in MONTHS])
    ax.set_xlim(-0.5, 11.5)
    ax.tick_params(labelsize=10)
    ax.set_ylabel("Number of tourists", fontsize=11)
    ax.set_xlabel("Month", fontsize=11)
    ax.set_title(f"Tourists who visited {p['park']} each month", fontsize=12.5, fontweight="bold")
    ax.text(0.5, -0.15, "Percentage increase = increase ÷ number in the first month × 100", transform=ax.transAxes,
            ha="center", va="top", fontsize=10)
    return fig


def draw(p: dict):
    return {"pictogram": _draw_pictogram, "bar": _draw_bar, "workers": _draw_workers,
            "tourists": _draw_tourists}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

VERBS = ["looks at", "studies", "reads", "talks about"]
SETTINGS = ["in a Social Studies lesson", "for homework", "in class", "with a friend", "at home", "for a project"]


def _pct(n: int) -> list[str]:
    return [str(n), f"{n} %", f"{n} percent", f"{n} per cent"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    verb, setting = rng.choice(VERBS), rng.choice(SETTINGS)
    cats, vals = p["cats"], p["values"]
    a, b = p["ask"]["more"]
    order = sorted(range(len(cats)), key=lambda i: -vals[i])
    if p["sub"] == "pictogram":
        lead = f"{who} {verb} this pictogram {setting}."
        i = p["ask"]["one"]
        n = WORDS[len(cats)]
        if p["context"] == "people":
            one = f"How many people live in {cats[i]}?"
            most = "Which village has the most people?"
            total = f"How many people live in the {n} villages altogether?"
            more = f"How many more people live in {cats[a]} than in {cats[b]}?"
            noun = "people"
        elif p["context"] == "jobs":
            one = f"How many {cats[i]} are there in {p['place']} Cell?"
            most = "Which job do the most people do?"
            total = "How many people are shown in the pictogram altogether?"
            more = f"How many more {cats[a]} than {cats[b]} are there?"
            noun = "people"
        else:
            one = f"How many tourists visited the park in {cats[i]}?"
            most = "In which month did the most tourists visit the park?"
            total = f"How many tourists visited the park in these {n} months altogether?"
            more = f"How many more tourists visited in {cats[a]} than in {cats[b]}?"
            noun = "tourists"
        return [count(f"{lead} {one}", vals[i], noun),
                mcq(most, cats[order[0]], [cats[k] for k in order], rng),
                count(total, sum(vals), noun),
                count(more, vals[a] - vals[b], noun)]
    if p["sub"] == "bar":
        lead = f"{who} {verb} this bar chart {setting}."
        i = p["ask"]["one"]
        end = p["ask"]["end"]
        pick = order if end == "most" else order[::-1]
        return [count(f"{lead} How many people live in {cats[i]}?", vals[i], "people"),
                mcq(f"Which village has the {end} people?", cats[pick[0]], [cats[k] for k in pick], rng),
                count(f"How many people live in the {WORDS[len(cats)]} villages altogether?", sum(vals), "people"),
                count(f"How many more people live in {cats[a]} than in {cats[b]}?", vals[a] - vals[b], "people")]
    if p["sub"] == "workers":
        lead = f"{who} {verb} this bar chart of {p['town']}'s workers {setting}."
        c = p["ask"]["share"]
        pct = vals[c] * 100 // sum(vals)
        return [count(f"{lead} How many workers are there in {p['town']} altogether?", sum(vals), "workers"),
                short(f"What percentage of the workers in {p['town']} work in {cats[c]}?", f"{pct}%", _pct(pct)),
                count(f"How many more people work in {cats[a]} than in {cats[b]}?", vals[a] - vals[b], "people", "workers"),
                mcq("In which economic activity do the most people work?", cats[order[0]], [cats[k] for k in order], rng)]
    lead = f"{who} {verb} this graph of the tourists at {p['park']} {setting}."
    x, y = p["ask"]["rise"]
    pct = (vals[y] - vals[x]) * 100 // vals[x]
    return [mcq(f"{lead} In which month did the most tourists visit the park?", cats[order[0]],
                [cats[k] for k in order], rng),
            count(f"How many more tourists visited the park in {cats[a]} than in {cats[b]}?", vals[a] - vals[b], "tourists"),
            short(f"What was the percentage increase in tourists from {cats[x]} to {cats[y]}?", f"{pct}%", _pct(pct)),
            count("How many tourists visited the park in the first three months altogether?", sum(vals[:3]), "tourists")]
