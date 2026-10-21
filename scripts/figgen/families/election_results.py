"""Election results (P Stages 4-6, LS, UP): the votes for three to five candidates in an invented election, with the
number of registered voters printed, as a tally chart, a bar chart or a results table.

- Primary, lower (Stages 4-5): a class election for a class captain or monitor as a tally chart (strokes in fives),
  the number of pupils in the class printed: who won, how many votes a candidate got (counting the tally), the winning
  margin, how many more votes a candidate needed to win, how many pupils did not vote.
- Primary, upper (Stage 6): the same story as a bar chart with every count printed, and turnout = votes cast ÷
  registered voters × 100 printed: the winner, the margin, the turnout (a whole per cent), the votes needed.
- Lower secondary: a school's student council election (bar chart or table), turnout a whole per cent.
- Upper secondary: a council election in an invented ward (Nigeria) or cell (Rwanda), with rejected ballots printed,
  votes cast = valid votes + rejected ballots, the turnout exact to one decimal place.

Every count, place and person is invented, and the figure says so: no real election is implied. Nigerian figures use
Nigerian names and towns for the NERDC books, Rwandan figures Rwandan ones, and each is linked only to its own
country's topics (avoid_for). Counts never tie, and the winner leads by a clear margin.
"""
from __future__ import annotations

import random
import textwrap
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import FILL, GRID, INK, NAMES, count, mcq, new_figure, short

ID = "election_results"
KIND = "graph.bar"
SUBJECT = "social-studies"
BANDS = ("P", "LS", "UP")
P_CONCEPTS = ("social-studies.civics-governance",)
LS_CONCEPTS = ("social-studies.democracy-concept", "social-studies.civics-governance")
UP_CONCEPTS = ("social-studies.democracy-concept", "social-studies.political-parties",
               "social-studies.civic-participation-responsibility")
CONCEPTS = tuple(dict.fromkeys(P_CONCEPTS + LS_CONCEPTS + UP_CONCEPTS))
# A topic whose sections the book lists is reached only if its name or a section names democracy, elections, voting,
# governance, civic participation, political parties or leadership (Rwanda P6 "Civics and Governance" teaches choosing
# leaders in its "Leadership" section).
NEEDS = r"democra|election|electoral|\bvot|governance|nigerian government|civic|political part|leadership"
# Units sharing a civic concept that teach rights, theory, ideologies, other countries' systems, the constitution or
# the arms of government, pluralism, money, religion, conflict, national symbols or identity, law and order, or
# cultism and drugs -- not elections.
AVOID = (r"human rights|theory|political concepts|ideolog|comparative|constitution|arms of government|pluralism|scam|"
         r"financ|money|religio|genocide|conflict|symbol|national identity|law and order|cultism|substance")

NIGERIAN = ["Chinedu", "Ngozi", "Emeka", "Amaka", "Tunde", "Bisi", "Musa", "Aisha", "Ifeoma", "Yusuf", "Funmi", "Segun",
            "Halima", "Obinna", "Zainab", "Kelechi", "Bola", "Nkechi", "Sani", "Adaeze"]
NG_SURNAMES = ["Okafor", "Adeyemi", "Bello", "Eze", "Ibrahim", "Okonkwo", "Balogun", "Usman", "Nwosu", "Adebayo",
               "Danjuma", "Okoro", "Lawal", "Ogunleye"]
RW_SURNAMES = ["Uwimana", "Niyonzima", "Mukamana", "Nsengimana", "Hakizimana", "Uwamahoro", "Bizimana", "Ndayisaba",
               "Mukeshimana", "Twagirimana", "Nkurunziza", "Ingabire"]
NG_TOWNS = ["Ibadan", "Enugu", "Kano", "Jos", "Abeokuta", "Owerri", "Ilorin", "Zaria", "Calabar", "Akure", "Makurdi",
            "Sokoto"]
RW_TOWNS = ["Kamonyi", "Huye", "Musanze", "Rubavu", "Nyagatare", "Rusizi", "Muhanga", "Karongi", "Rwamagana", "Nyanza",
            "Gicumbi", "Bugesera"]
PARTIES = ["Party P", "Party Q", "Party R", "Party S", "Party T"]
FORMULA = "Turnout = votes cast ÷ registered voters × 100"


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"P": P_CONCEPTS, "LS": LS_CONCEPTS, "UP": UP_CONCEPTS}[p["band"]]


def stages(p: dict) -> tuple[int, int] | None:
    if p["band"] != "P":
        return None
    return (4, 5) if p["level"] == "lower" else (6, 6)


def avoid_for(p: dict) -> str:
    """Each country's figure goes to its own country's topics: Nigeria's NERDC units have no sections, so only a name
    keeps a Rwandan story out of them, and Rwanda's units out of a Nigerian one."""
    if p["band"] == "P":
        extra = r"civics" if p["ctx"] == "ng" else r"democracy and governance"
    elif p["ctx"] == "ng":
        extra = r"unit \d+:|leadership, governance"
    else:
        extra = r"nigeria"
    return f"{AVOID}|{extra}"


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _split(rng: random.Random, total: int, k: int, least: int, margin: int) -> list[int] | None:
    cuts = sorted(rng.sample(range(1, total), k - 1))
    votes = [b - a for a, b in zip([0, *cuts], [*cuts, total])]
    ranked = sorted(votes, reverse=True)
    if min(votes) < least or len(set(votes)) < k or ranked[0] - ranked[1] < margin:
        return None
    return votes


def _people(rng: random.Random, ctx: str, k: int, full: bool) -> list[list]:
    firsts = rng.sample(NIGERIAN if ctx == "ng" else NAMES, k)
    if not full:
        return [[f, None] for f in firsts]
    lasts = rng.sample(NG_SURNAMES if ctx == "ng" else RW_SURNAMES, k)
    parties = rng.sample(PARTIES, k) if ctx == "ng" else [None] * k
    return [[f"{f} {s}", party] for f, s, party in zip(firsts, lasts, parties)]


def _primary(rng: random.Random) -> dict:
    level = rng.choice(["lower", "lower", "upper"])
    ctx = "ng" if level == "lower" else rng.choice(["ng", "rw"])
    while True:
        k = rng.choice([3, 4])
        votes = rng.sample(range(2, 16), k)
        cast = sum(votes)
        ranked = sorted(votes, reverse=True)
        if ranked[0] - ranked[1] < 2:
            continue
        if level == "lower":
            reg = cast + rng.randint(1, 6)
            if not 20 <= reg <= 45:
                continue
        else:
            fits = [r for r in (20, 25, 40, 50) if cast < r <= cast + 8 and (100 * cast) % r == 0]
            if not fits:
                continue
            reg = rng.choice(fits)
        people = _people(rng, ctx, k, full=False)
        return {"band": "P", "ctx": ctx, "level": level, "style": "tally" if level == "lower" else "bar",
                "grade": rng.choice([4, 5]) if level == "lower" else 6,
                "office": rng.choice(["class captain", "class monitor", "class prefect"]),
                "place": rng.choice(NG_TOWNS if ctx == "ng" else RW_TOWNS),
                "candidates": [[n, p, v] for (n, p), v in zip(people, votes)], "registered": reg, "rejected": 0}


def _lower_secondary(rng: random.Random) -> dict:
    ctx = rng.choice(["ng", "ng", "rw"])
    while True:
        reg = rng.randrange(200, 1001, 10)
        t = rng.randint(55, 95)
        if (reg * t) % 100:
            continue
        cast = reg * t // 100
        k = rng.choice([3, 4, 5])
        votes = _split(rng, cast, k, max(15, cast // 12), 5)
        if votes:
            people = _people(rng, ctx, k, full=False)
            return {"band": "LS", "ctx": ctx, "level": None, "style": rng.choice(["bar", "table"]),
                    "office": rng.choice(["head of the student council", "head prefect", "games captain"]),
                    "place": rng.choice(NG_TOWNS if ctx == "ng" else RW_TOWNS),
                    "candidates": [[n, p, v] for (n, p), v in zip(people, votes)], "registered": reg, "rejected": 0}


def _upper_secondary(rng: random.Random) -> dict:
    ctx = rng.choice(["ng", "rw"])
    lo, hi = (5000, 25000) if ctx == "ng" else (500, 2000)
    while True:
        reg = rng.randrange(lo, hi + 1, 10)
        t = rng.randint(400, 850)  # tenths of a per cent
        if (reg * t) % 1000:
            continue
        cast = reg * t // 1000
        rejected = rng.randint(max(5, cast // 200), max(6, cast // 40))
        valid = cast - rejected
        k = rng.choice([3, 4, 5])
        votes = _split(rng, valid, k, max(20, valid // 12), max(5, valid // 100))
        if votes:
            people = _people(rng, ctx, k, full=True)
            return {"band": "UP", "ctx": ctx, "level": None, "style": rng.choice(["bar", "table"]),
                    "office": "councillor" if ctx == "ng" else "village leader",
                    "place": rng.choice("BCDEFGH"),
                    "candidates": [[n, p, v] for (n, p), v in zip(people, votes)], "registered": reg,
                    "rejected": rejected}


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    p = {"P": _primary, "LS": _lower_secondary, "UP": _upper_secondary}[band](rng)
    return p


# --- drawing ----------------------------------------------------------------------------------------------------------

def title(p: dict) -> tuple[str, str]:
    if p["band"] == "P":
        school = "Primary School"
        return (f"Class {p['grade']} election for {p['office']}", f"{p['place']} {school}")
    if p["band"] == "LS":
        school = "Junior Secondary School" if p["ctx"] == "ng" else "Secondary School"
        return (f"Election for {p['office']}", f"{p['place']} {school} (invented results)")
    if p["ctx"] == "ng":
        return (f"Councillor election, Ward {p['place']}", "An invented ward: every count is made up")
    return (f"Village leader election, Village {p['place']}", "An invented village: every count is made up")


def _label(c: list) -> str:
    name, party = c[0], c[1]
    if party:
        return f"{name}\n({party})"
    if " " in name:
        return name.replace(" ", "\n", 1)
    return name


def _info_lines(p: dict) -> list[tuple[str, str, bool]]:
    """(gid, text, bold) for the panel beside the chart or under the table."""
    who = "Pupils in the class" if p["band"] == "P" else "Registered voters"
    lines = [("registered", f"{who}: {fr(p['registered'])}", True)]
    if p["band"] == "UP":
        lines.append(("rejected", f"Rejected ballots: {fr(p['rejected'])}", True))
    if p["band"] == "P" and p["level"] == "lower":
        lines.append(("rule", "Each pupil has one vote.", False))
    else:
        if p["band"] == "P":
            lines.append(("rule", "Each pupil in the class is a registered voter.", False))
        if p["band"] == "UP":
            lines.append(("formula2", "Votes cast = valid votes + rejected ballots", False))
        lines.append(("formula", FORMULA, False))
    return lines


def _tally(ax, x: float, y: float, n: int, i: int) -> None:
    """n strokes from (x, y): four upright and a fifth across them, in each five."""
    h, gap, group = 0.42, 0.14, 0.3
    for g in range(n // 5 + (1 if n % 5 else 0)):
        left = x + g * (4 * gap + group)
        strokes = min(4, n - 5 * g)
        for s in range(strokes):
            sx = left + s * gap
            ax.plot([sx, sx], [y - h / 2, y + h / 2], color=INK, linewidth=1.8, gid=f"tally:{i}", solid_capstyle="round")
        if n - 5 * g >= 5:
            ax.plot([left - 0.08, left + 3 * gap + 0.08], [y - h / 2 + 0.05, y + h / 2 - 0.05], color=INK, linewidth=1.8,
                    gid=f"tally:{i}", solid_capstyle="round")


def _draw_tally(p: dict):
    head, sub = title(p)
    rows = p["candidates"]
    rh, w1, w2 = 0.75, 2.4, 3.4
    n = len(rows)
    fig, ax = new_figure(7.0, 0.75 * (n + 1) + 2.6)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    top = 0.0
    ax.text(0, top + 1.25, head, ha="left", va="center", fontsize=14, fontweight="bold")
    ax.text(0, top + 0.65, sub, ha="left", va="center", fontsize=12)
    for x, w, label in ((0, w1, "Name"), (w1, w2, "Votes (tally)")):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.2))
        ax.text(x + 0.18, top - rh / 2, label, ha="left", va="center", fontsize=12, fontweight="bold")
    for i, c in enumerate(rows):
        y = top - (i + 2) * rh
        for x, w in ((0, w1), (w1, w2)):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(0.18, y + rh / 2, c[0], ha="left", va="center", fontsize=12, gid=f"name:{i}")
        _tally(ax, w1 + 0.35, y + rh / 2, c[-1], i)
    bottom = top - (n + 1) * rh
    for k, (gid, text, bold) in enumerate(_info_lines(p)):
        ax.text(0, bottom - 0.5 - 0.5 * k, text, ha="left", va="center", fontsize=12,
                fontweight="bold" if bold else "normal", gid=gid)
    low = bottom - 0.5 - 0.5 * (len(_info_lines(p)) - 1) - 0.35
    ax.set_xlim(-0.1, w1 + w2 + 0.1)
    ax.set_ylim(low, top + 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _step(top: int) -> int:
    for s in (1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000):
        if -(-top // s) <= 6:
            return s
    return 10000


def _draw_bar(p: dict):
    head, sub = title(p)
    rows = p["candidates"]
    primary = p["band"] == "P"
    fs = 11 if primary else 10
    n = len(rows)
    bw, gap = (1.15, 0.55) if p["band"] == "UP" else (1.0, 0.55)
    x0, y0, ph = 1.1, 1.25, 3.6
    pw = n * bw + (n + 1) * gap
    vmax = max(c[-1] for c in rows)
    step = _step(vmax)
    ticks = -(-vmax // step) + 1
    scale = ph / (ticks * step)
    panel = x0 + pw + 0.45
    info = _info_lines(p)
    wrap = 30
    fig, ax = new_figure(panel + 3.6, 6.4)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0.0, y0 + ph + 1.05, head, ha="left", va="center", fontsize=13, fontweight="bold")
    ax.text(0.0, y0 + ph + 0.55, sub, ha="left", va="center", fontsize=fs)
    for k in range(ticks + 1):
        y = y0 + k * step * scale
        ax.plot([x0, x0 + pw], [y, y], color=GRID if k else INK, linewidth=0.8 if k else 1.2, gid=f"grid:{k}", zorder=1)
        ax.text(x0 - 0.12, y, fr(k * step), ha="right", va="center", fontsize=fs - 1)
    ax.plot([x0, x0], [y0, y0 + ticks * step * scale], color=INK, linewidth=1.2, gid="axis")
    ax.text(x0 - 0.85, y0 + ph / 2, "Number of valid votes" if p["band"] == "UP" else "Number of votes", ha="center",
            va="center", rotation=90, fontsize=fs)
    for i, c in enumerate(rows):
        left = x0 + gap + i * (bw + gap)
        h = c[-1] * scale
        ax.add_patch(Rectangle((left, y0), bw, h, facecolor=FILL, edgecolor=INK, linewidth=1.0, zorder=2))
        ax.text(left + bw / 2, y0 + h + 0.05, fr(c[-1]), ha="center", va="bottom", fontsize=fs, zorder=4, gid=f"votes:{i}",
                bbox={"boxstyle": "square,pad=0.08", "facecolor": "white", "edgecolor": "none"})
        ax.text(left + bw / 2, y0 - 0.15, _label(c), ha="center", va="top", fontsize=fs - (0 if primary else 0.5),
                linespacing=1.15, gid=f"name:{i}")
    yy = y0 + ph - 0.1
    for gid, text, bold in info:
        lines = textwrap.wrap(text, wrap)
        ax.text(panel, yy, "\n".join(lines), ha="left", va="top", fontsize=fs, fontweight="bold" if bold else "normal",
                linespacing=1.25, gid=gid)
        yy -= 0.27 * len(lines) + 0.25
    ax.set_xlim(-1.0, panel + 3.5)
    ax.set_ylim(0.35, y0 + ph + 1.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_table(p: dict):
    head, sub = title(p)
    rows = p["candidates"]
    up = p["band"] == "UP"
    rh = 0.48
    w1, w2, w3 = (2.9, 1.5, 1.5) if up else (3.0, 1.7, 0)
    cols = [("Candidate", w1)] + ([("Party", w2)] if up and p["ctx"] == "ng" else []) + [("Votes", w3 if up else w2)]
    width = sum(w for _, w in cols)
    extra = [("Rejected ballots", p["rejected"], "rejected")] if up else []
    n = len(rows) + len(extra) + 2
    fig, ax = new_figure(8.0, rh * (n + 1) + 2.6)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0, 1.05, head, ha="left", va="center", fontsize=12.5, fontweight="bold")
    ax.text(0, 0.55, sub, ha="left", va="center", fontsize=10)
    x = 0.0
    for label, w in cols:
        ax.add_patch(Rectangle((x, -rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.12, -rh / 2, label, ha="left", va="center", fontsize=10.5, fontweight="bold")
        x += w
    body = [(c[0], c[1], c[-1], f"votes:{i}", f"name:{i}") for i, c in enumerate(rows)]
    body += [(label, None, v, gid, None) for label, v, gid in extra]
    for r, (label, party, v, vgid, ngid) in enumerate(body):
        y = -(r + 2) * rh
        heavy = bool(extra) and label == extra[0][0]
        x = 0.0
        for k, (head_, w) in enumerate(cols):
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="#f4f5f6" if heavy else "white", edgecolor=INK,
                                   linewidth=0.8))
            if k == 0:
                ax.text(x + 0.12, y + rh / 2, label, ha="left", va="center", fontsize=10,
                        fontweight="bold" if heavy else "normal", gid=ngid)
            elif head_ == "Party":
                if party:
                    ax.text(x + 0.12, y + rh / 2, party, ha="left", va="center", fontsize=10)
            else:
                ax.text(x + w - 0.15, y + rh / 2, fr(v), ha="right", va="center", fontsize=10, gid=vgid)
            x += w
    bottom = -(len(body) + 1) * rh
    # the registered voters stand apart from the vote counts, so no one adds them in
    notes = [("registered", f"Registered voters: {fr(p['registered'])}")]
    notes += ([("formula2", "Votes cast = valid votes + rejected ballots")] if up else []) + [("formula", FORMULA)]
    for k, (gid, text) in enumerate(notes):
        ax.text(0, bottom - 0.4 - 0.42 * k, text, ha="left", va="center", fontsize=10.5 if k == 0 else 10,
                fontweight="bold" if k == 0 else "normal", gid=gid)
    low = bottom - 0.4 - 0.42 * (len(notes) - 1) - 0.3
    ax.set_xlim(-0.1, max(width, 5.6) + 0.1)
    ax.set_ylim(low, 1.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"tally": _draw_tally, "bar": _draw_bar, "table": _draw_table}[p["style"]](p)


# --- questions --------------------------------------------------------------------------------------------------------

VERBS = ["counts", "checks", "studies", "reads", "looks at"]


def election_of(p: dict) -> str:
    """The election the figure shows, named as its title names it (P5 blind review: a stem that said "for a class
    debate" beside a head prefect's election read as another election)."""
    if p["band"] == "P":
        return f"the Class {p['grade']} election for {p['office']} at {p['place']} Primary School"
    if p["band"] == "LS":
        school = "Junior Secondary School" if p["ctx"] == "ng" else "Secondary School"
        return f"the election for {p['office']} at {p['place']} {school}"
    if p["ctx"] == "ng":
        return f"the councillor election in Ward {p['place']}"
    return f"the village leader election in Village {p['place']}"


def _pct(x: Fraction, places: int) -> tuple[str, list[str]]:
    """The turnout at the rounding the stem states; the counts are chosen so it is exact there, never rounded."""
    assert (x * 10 ** places).denominator == 1, x
    key = f"{float(x):.{places}f}"
    forms = [key] + ([key[:-2]] if key.endswith(".0") else [])
    return key, forms + [f"{f}{u}" for f in forms for u in ("%", " %", " per cent", " percent")]


def questions(p: dict, rng: random.Random) -> list:
    rows = p["candidates"]
    votes = {c[0]: c[-1] for c in rows}
    names = list(votes)
    ranked = sorted(names, key=votes.get, reverse=True)
    win, second = ranked[0], ranked[1]
    cast = sum(votes.values()) + p["rejected"]
    reg = p["registered"]
    pool = [n for n in (NIGERIAN if p["ctx"] == "ng" else NAMES) if not any(n in c for c in names)]
    who = rng.choice(pool)
    others = rng.sample(ranked[1:], min(3, len(ranked) - 1))
    behind = rng.choice(ranked[1:])
    gap = votes[win] - votes[behind] + 1
    margin = votes[win] - votes[second]
    election = election_of(p)
    out = []
    if p["band"] == "P":
        chart = "tally chart" if p["style"] == "tally" else "bar chart"
        out.append(mcq(f"{who} {rng.choice(VERBS)} the votes in {election}, shown in this {chart}. Who won the election?",
                       win, others, rng))
        if p["style"] == "tally":
            x = rng.choice(names)
            out.append(count(f"How many votes did {x} get?", votes[x], "votes"))
    else:
        what = "results table" if p["style"] == "table" else "bar chart"
        out.append(mcq(f"{who} {rng.choice(VERBS[1:])} this {what} of {election}. Who won the election?", win, others,
                       rng))  # one counts votes, but reads a table
    out.append(count(f"By how many votes did {win} beat {second}, who came second?", margin, "votes"))
    out.append(count(f"How many more votes did {behind} need to get one vote more than {win}? (No other count changes.)",
                     gap, "votes"))
    if p["band"] != "P" or p["level"] == "upper":
        if p["band"] == "UP":
            key, forms = _pct(Fraction(100 * cast, reg), 1)
            stem = ("Votes cast are the valid votes plus the rejected ballots, and turnout = votes cast ÷ registered "
                    "voters × 100. What was the turnout in this election, as a percentage to one decimal place?")
        else:
            key, forms = _pct(Fraction(100 * cast, reg), 0)
            stem = ("The turnout is the votes cast ÷ the registered voters × 100. What was the turnout in this "
                    "election, as a percentage to the nearest whole number?")
        out.append(short(stem, key, forms))
    absent = reg - cast
    if p["band"] == "P":
        out.append(count("How many pupils in the class did not vote?", absent, "pupils"))
    elif p["band"] == "LS":
        out.append(count("How many of the registered voters did not vote in this election?", absent, "students", "voters"))
    else:
        out.append(count("How many registered voters did not vote in this election?", absent, "voters", "people"))
    return out
