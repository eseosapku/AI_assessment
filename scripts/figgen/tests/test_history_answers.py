"""Answers of the History and civics wave (P3x), recomputed from each figure's params over 1,000 seeds.

The facts the keys rest on are checked against a second, independent copy here: the dates of well-known events,
the 2012 and 2022 census counts by province (NISR), and the three arms of government in Rwanda's Constitution.
"""
import random
import re

import matplotlib.pyplot as plt
import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)  # figures drawn to check what they show


def run(m, seed):
    rng = random.Random(seed)
    p = m.sample(rng)
    return p, m.questions(p, rng)


def picked(q):
    return q.options[int(q.answer)]


def fam(fid):
    if fid not in FAMILIES:
        pytest.fail(f"{fid} is not registered")
    return FAMILIES[fid]


def shown(m, p) -> str:
    """Every piece of text the figure prints, as one string."""
    fig = m.draw(p)
    try:
        return " | ".join(t.get_text() for t in fig.findobj(match=lambda a: hasattr(a, "get_text") and a.get_text()))
    finally:
        plt.close(fig)


def own_wording(m) -> int:
    """How many of 30 figures carry a stem no other of the 30 has (test_families_common's rule, run here because
    history and social studies are not yet in its worded subjects)."""
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


# --- Task 1: the timeline, reworked -------------------------------------------------------------------

# Dates checked again, apart from the family's table (each a settled, standard date).
DATES = {
    "Berlin Conference ends": 1885, "German rule in Rwanda begins": 1897, "First Catholic mission opens at Save": 1900,
    "Richard Kandt founds Kigali": 1907, "Belgian troops take over Rwanda": 1916, "Ruanda-Urundi becomes a UN Trust Territory": 1946,
    "Mwami Mutara III Rudahigwa dies": 1959, "Referendum ends the monarchy": 1961, "Rwanda becomes independent": 1962,
    "The Second Republic begins": 1973, "The Liberation War begins": 1990, "Arusha Peace Agreement is signed": 1993,
    "Genocide against the Tutsi": 1994, "New Constitution is adopted": 2003, "Rwanda joins the East African Community": 2007,
    "Rwanda joins the Commonwealth": 2009, "Revised Constitution is adopted": 2015,
    "Ghana becomes independent": 1957, "Nigeria becomes independent": 1960, "Kenya becomes independent": 1963,
    "Namibia becomes independent": 1990, "South Sudan becomes independent": 2011,
    "Truman Doctrine is announced": 1947, "NATO is formed": 1949, "Berlin Wall is built": 1961, "Cuban Missile Crisis": 1962,
    "Berlin Wall falls": 1989, "Soviet Union breaks up": 1991,
    "First World War begins": 1914, "Armistice ends the fighting": 1918, "Treaty of Versailles is signed": 1919,
    "League of Nations is set up": 1920, "Wall Street Crash": 1929, "Hitler becomes Chancellor of Germany": 1933,
    "Munich Agreement is signed": 1938, "Germany invades Poland": 1939, "Japan attacks Pearl Harbor": 1941,
    "D-Day landings in Normandy": 1944, "Second World War ends": 1945,
    "Britain bans the slave trade": 1807, "Britain abolishes slavery in its empire": 1833, "USA abolishes slavery": 1865,
    "Brazil abolishes slavery": 1888, "Mansa Musa makes his pilgrimage to Mecca": 1324, "Portuguese build Elmina Castle": 1482,
    "Moroccan army defeats Songhai at Tondibi": 1591,
}
QUIET = re.compile(r"genocide", re.I)  # on the timeline as a date, never the subject of a question (brief: sensitive history)


def ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def ticks(first: int, last: int) -> int:
    """The gap between small ticks: every year up to an 80-year span, then every 5 or 10 years."""
    span = last - first
    return 1 if span <= 80 else 5 if span <= 150 else 10


def test_timeline():
    m = fam("timeline")
    for s in SEEDS:
        p, qs = run(m, s)
        events = p["events"]
        years = {n: y for n, y in events}
        asked = [(n, y) for n, y in events if not QUIET.search(n)]
        assert [y for _, y in events] == sorted({y for _, y in events}), (s, events)  # in order, one event a year
        for n, y in events:
            assert [n, y] in [list(e) for e in m.SETS[p["title"]]["events"]], (s, n, y)
            if n in DATES:
                assert y == DATES[n], (n, y)
        assert p["band"] in m.SETS[p["title"]]["bands"]
        assert len(asked) >= 4 and len(qs) == 4
        for q in qs:
            names = re.findall(r'"([^"]+)"', q.stem)
            assert not QUIET.search(q.stem) and not any(QUIET.search(o) for o in q.options), (s, q.stem)
            if q.kind == "mcq" and re.search(r"happened (first|last)\?$", q.stem):
                assert all(o in years for o in q.options)
                pick = min if q.stem.endswith("first?") else max
                assert picked(q) == pick(q.options, key=years.get)
            elif "How many years" in q.stem or "counts the years" in q.stem:
                a, b = names
                assert a in years and b in years
                assert int(q.answer) == abs(years[b] - years[a]) > 0
                if "after" in q.stem:
                    assert years[b] > years[a]
            elif "which decade" in q.stem:
                y = years[names[0]]
                assert picked(q) == f"the {y // 10 * 10}s"
            elif "which century" in q.stem:
                y = years[names[0]]
                assert y % 100 != 0  # 1900 is the last year of the 19th century: never asked
                assert picked(q) == f"the {ordinal((y - 1) // 100 + 1)} century"
            elif "Between which two events" in q.stem:
                extra, year = names[0], int(re.search(r"happened in (\d{4})", q.stem).group(1))
                assert [extra, year] == p["extra"] and extra not in years
                assert year not in years.values()
                assert [extra, year] in [list(e) for e in m.SETS[p["title"]]["events"]]
                before = [n for n, y in asked if y < year]
                after = [n for n, y in asked if y > year]
                assert before and after
                assert picked(q) == f'Between "{before[-1]}" and "{after[0]}"'
                for o in q.options:  # every option names two neighbours on the timeline
                    a, b = re.findall(r'"([^"]+)"', o)
                    assert a in years and b in years and years[a] < years[b]
            elif "marked X" in q.stem:
                x = p["mark"]
                first, last = events[0][1], events[-1][1]
                step = ticks(first, last)
                assert first < x < last and x % step == 0 and x not in years.values()
                assert all(abs(x - y) >= 2 * step for y in years.values())  # never read as an event's year
                assert all(abs(x - y) >= 5 for n, y in events if QUIET.search(n))  # nor counted from the 1994 event
                assert q.answer == str(x)
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem!r}")


def test_timeline_prints_every_year_it_asks_about():
    m = fam("timeline")
    for s in DRAWN:
        p, _ = run(m, s)
        text = shown(m, p)
        for n, y in p["events"]:
            assert f"{n} ({y})" in text, (s, n)
        assert p["title"] in text


def test_timeline_reaches_rwanda_world_wars_and_trade():
    m = fam("timeline")
    titles = {m.sample(random.Random(s))["title"] for s in range(1, 300)}
    assert len(titles) >= 8, titles
    for t in ("Rwanda under colonial rule", "Rwanda since independence", "Independence in Africa", "The Cold War"):
        assert t in titles
    for needed in ("Historical Sources", "Trans-Saharan Trade", "European Colonisation of Africa", "Independent Rwanda",
                   "Main Historical Events", "Post-Independence Rwanda", "World history", "Part 1 The Inter-War Years"):
        assert re.search(m.NEEDS, needed, re.I), needed
    assert all(c.startswith("history.") for c in m.CONCEPTS)
    assert all(c.startswith("social-studies.") for c in m.ALSO)


# --- Task 2: the arms of government -------------------------------------------------------------------

# Constitution of the Republic of Rwanda of 2003, revised in 2015.
ARMS = {"Legislature": ("makes laws", "Parliament"), "Executive": ("carries out laws", "President"),
        "Judiciary": ("interprets laws", "Supreme Court")}


def test_arms_of_government():
    m = fam("arms_of_government")
    for s in SEEDS:
        p, qs = run(m, s)
        assert sorted(p["order"]) == sorted(ARMS)
        for q in qs:
            got = re.search(r"Which letter shows the arm of government that (makes laws|carries out laws|interprets laws)\?", q.stem)
            if got:
                assert p["mode"] == "letters"
                arm = next(a for a, (role, _) in ARMS.items() if role == got.group(1))
                assert picked(q) == p["letters"][arm] and q.options == sorted(q.options)
                continue
            got = re.search(r"name of the arm of government lettered ([A-C])\?", q.stem)
            if got:
                arm = next(a for a, L in p["letters"].items() if L == got.group(1))
                assert picked(q) == arm
                continue
            if "two chambers" in q.stem:
                assert picked(q) == "The Chamber of Deputies and the Senate"
                assert p["mode"] == "letters" or p["blank"] != ["Legislature", "body"]
                continue
            if "marked ?" in q.stem:
                arm, row = p["blank"]
                truth = {"name": arm, "body": m.BODY[arm], "role": m.ROLE[arm]}[row]
                assert picked(q) == truth
                assert ARMS[arm][0] in m.ROLE[arm].lower() and ARMS[arm][1] in m.BODY[arm]
                continue
            got = re.search(r"According to the diagram, which arm of government (\w[\w ]*)\?", q.stem)
            if got:
                arm = next(a for a, (role, _) in ARMS.items() if got.group(1).startswith(role))
                assert picked(q) == arm
                assert p["mode"] == "blank" and p["blank"] not in ([arm, "role"], [arm, "name"])
                continue
            got = re.search(r"Which arm of government does the (Supreme Court|Senate|Cabinet) belong to", q.stem)
            if got:
                arm = {"Supreme Court": "Judiciary", "Senate": "Legislature", "Cabinet": "Executive"}[got.group(1)]
                assert picked(q) == arm and p["blank"] not in ([arm, "body"], [arm, "name"])
                continue
            pytest.fail(f"seed {s}: unknown question {q.stem!r}")


def test_arms_show_what_they_ask():
    m = fam("arms_of_government")
    for s in DRAWN:
        p, qs = run(m, s)
        text = shown(m, p)
        assert "Chamber of Deputies" in text or p["blank"] == ["Legislature", "body"]
        assert "2015" in text  # the Constitution the facts come from
        if p["mode"] == "letters":
            for arm, L in p["letters"].items():
                assert arm not in text  # the names are what is asked
        else:
            assert text.count("?") >= 1


# --- Task 3: the census chart -------------------------------------------------------------------------

# Rwanda Population and Housing Census, by province (NISR): 2012 (4th) and 2022 (5th). Each set adds to its total.
CENSUS = {
    2012: {"City of Kigali": 1132686, "Southern": 2589975, "Western": 2471239, "Northern": 1726370, "Eastern": 2595703},
    2022: {"City of Kigali": 1745555, "Southern": 3002699, "Western": 2896484, "Northern": 2038511, "Eastern": 3563145},
}
TOTAL = {2012: 10515973, 2022: 13246394}


def thousands(v: int) -> int:
    """To the nearest 10,000, in thousands."""
    return (v + 5000) // 10000 * 10


def test_census_counts_add_up():
    for year, by in CENSUS.items():
        assert sum(by.values()) == TOTAL[year]


def province(stem: str) -> list[str]:
    return [p for p in sorted(CENSUS[2022], key=lambda x: stem.find(x)) if p in stem]


def test_census_chart():
    m = fam("census_chart")
    for s in SEEDS:
        p, qs = run(m, s)
        years = [2012, 2022] if p["year"] == "both" else [p["year"]]
        for y in years:
            assert p["values"][str(y)] == {k: thousands(v) for k, v in CENSUS[y].items()}, (s, y)
        vals = {y: {k: thousands(v) for k, v in CENSUS[y].items()} for y in years}
        for q in qs:
            year = int(re.findall(r"\b(20[12]2)\b", q.stem)[-1]) if re.search(r"\b20[12]2\b", q.stem) else None
            if q.kind == "mcq" and "grew the most" in q.stem:
                growth = {k: vals[2022][k] - vals[2012][k] for k in vals[2022]}
                ranked = sorted(growth.values())
                assert ranked[-1] - ranked[-2] >= 100
                assert picked(q) == m.LONG[max(growth, key=growth.get)]
            elif q.kind == "mcq" and ("most people" in q.stem or "fewest people" in q.stem):
                v = vals[year]
                ranked = sorted(v.values())
                if "most" in q.stem:
                    assert ranked[-1] - ranked[-2] >= 100  # no near-tie: 2012's East and South are 10 thousand apart
                    assert picked(q) == m.LONG[max(v, key=v.get)]
                else:
                    assert ranked[1] - ranked[0] >= 100
                    assert picked(q) == m.LONG[min(v, key=v.get)]
            elif "How many more people" in q.stem:
                a, b = province(q.stem)
                assert int(q.answer) == vals[year][a] - vals[year][b] >= 100
            elif "grow between 2012 and 2022" in q.stem:
                (a,) = province(q.stem)
                assert int(q.answer) == vals[2022][a] - vals[2012][a]
            elif "total" in q.stem:
                assert int(q.answer) == sum(vals[year].values())
                assert int(q.answer) == thousands(TOTAL[year])  # the shown provinces add to the true total, rounded
            elif "percentage" in q.stem:
                (a,) = province(q.stem)
                share = 100 * vals[year][a] / sum(vals[year].values())
                assert abs(share - int(share) - 0.5) >= 0.1, (s, a, share)  # nowhere near a rounding boundary
                assert int(q.answer) == round(share)
                # and the census's own counts give the same whole percent
                assert round(100 * CENSUS[year][a] / TOTAL[year]) == round(share)
                assert "nearest whole" in q.stem
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem!r}")


def test_census_shows_its_values_and_says_where_they_come_from():
    m = fam("census_chart")
    for s in DRAWN:
        p, _ = run(m, s)
        text = shown(m, p)
        for by in p["values"].values():
            for v in by.values():
                assert f"{v:,}" in text
        assert "Census" in text and "nearest 10,000" in text and "thousands" in text


# --- Task 4: the election chart -----------------------------------------------------------------------

def test_election_chart():
    m = fam("election_chart")
    majorities = set()
    for s in SEEDS:
        p, qs = run(m, s)
        votes = dict(zip(p["candidates"], p["votes"]))
        total = sum(p["votes"])
        ranked = sorted(votes, key=votes.get, reverse=True)
        assert len(set(p["votes"])) == len(p["votes"])  # no ties anywhere
        win, second = ranked[0], ranked[1]
        majorities.add(2 * votes[win] > total)
        assert 2 * votes[win] != total
        for q in qs:
            if "Who won" in q.stem:
                assert picked(q) == win and set(q.options) <= set(votes)
            elif "By how many votes" in q.stem:
                assert win in q.stem and second in q.stem
                assert int(q.answer) == votes[win] - votes[second] > 0
            elif "altogether" in q.stem:
                assert int(q.answer) == total
            elif "percentage" in q.stem:
                (who,) = [c for c in votes if re.search(rf"\b{c}\b", q.stem)]
                assert (100 * votes[who]) % total == 0
                assert int(q.answer.rstrip("%")) == 100 * votes[who] // total
            elif "majority" in q.stem:
                assert "more than half" in q.stem  # the convention is stated
                yes = 2 * votes[win] > total
                assert picked(q).startswith("Yes" if yes else "No")
                assert picked(q) == (f"Yes: {win} won more than half of the {total} votes" if yes else
                                     f"No: {win} won fewer than half of the {total} votes")
            else:
                pytest.fail(f"seed {s}: unknown question {q.stem!r}")
    assert majorities == {True, False}


def test_election_is_plainly_a_school_election_and_shows_every_count():
    m = fam("election_chart")
    for s in DRAWN:
        p, _ = run(m, s)
        text = shown(m, p)
        assert "school prefect election" in text.lower() and "Example" in text
        for c, v in zip(p["candidates"], p["votes"]):
            assert c in text and str(v) in text


# --- All four: the topics they are for -----------------------------------------------------------------

@pytest.mark.parametrize("fid, names", [
    ("arms_of_government", ["Arms of government", "State and Government", "Government structures", "Constitution"]),
    ("census_chart", ["Population", "Environmental Management and Population Dynamics"]),
    ("election_chart", ["Democracy and governance", "Unit 2: Democracy and good governance", "Civic participation", "Political parties"]),
])
def test_needs_names_the_topics_it_is_for(fid, names):
    m = fam(fid)
    for name in names:
        assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)
    assert all(c.startswith("social-studies.") for c in m.CONCEPTS) and all(not c.startswith("social-studies.") for c in m.ALSO)


# --- All four: wording of their own ------------------------------------------------------------------

@pytest.mark.parametrize("fid", ["timeline", "arms_of_government", "census_chart", "election_chart"])
def test_most_figures_have_a_wording_of_their_own(fid):
    assert own_wording(fam(fid)) >= 27


@pytest.mark.parametrize("fid", ["timeline", "arms_of_government", "census_chart", "election_chart"])
def test_first_question_names_a_person(fid):
    from figgen.core import NAMES
    m = fam(fid)
    for s in range(1, 61):
        _, qs = run(m, s)
        assert any(qs[0].stem.startswith(n + " ") for n in NAMES), qs[0].stem
