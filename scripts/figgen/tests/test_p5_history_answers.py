"""Answers of the P5 history families, recomputed independently over 1,000 seeds: the timelines' keys from a second,
independent copy of every date below and from where each event is drawn on the line, the sources classed by this
file's own reading of the printed definitions and dates, the kingdom charts read from this file's own copy of each
kingdom's offices, and the family trees and timelines worked out from the people and years drawn.

Nothing here calls a family's own helpers to work out a key.
"""
import math
import random
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
WAVE = ("history_timeline", "source_provenance", "kingdom_structure", "family_history_p")
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
# Nigerian names for the Nigerian books' figures, beside the Rwandan NAMES.
NG = ["Chinedu", "Amina", "Tunde", "Ngozi", "Emeka", "Aisha", "Bola", "Ifeoma", "Musa", "Funke", "Chioma", "Ibrahim",
      "Kemi", "Obinna", "Zainab", "Femi"]
PEOPLE = NAMES + NG


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


def placed(m, p) -> list:
    """Every text drawn, with its place in data coordinates, its size and its gid."""
    fig = m.draw(p)
    try:
        return [(t.get_text(), tuple(t.get_position()), t.get_fontsize(), t.get_gid()) for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def drawn_texts(fig):
    seen = []
    original = Text.draw

    def record(self, renderer):
        original(self, renderer)
        if self.get_visible() and self.get_text().strip():
            seen.append(self)

    Text.draw = record
    try:
        fig.canvas.draw()
    finally:
        Text.draw = original
    renderer = fig.canvas.get_renderer()
    return [(t, t.get_window_extent(renderer)) for t in seen]


def inside(pt, box, margin=1.0) -> bool:
    return box.x0 + margin < pt[0] < box.x1 - margin and box.y0 + margin < pt[1] < box.y1 - margin


def crosses(line, box, margin=1.0, steps=80) -> bool:
    pts = line.get_transform().transform(line.get_xydata())
    for a, b in zip(pts, pts[1:]):
        if any(inside((a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps), box, margin)
               for k in range(steps + 1)):
            return True
    return False


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


# --- history_timeline -------------------------------------------------------------------------------------

# A second copy of every event and its year, typed from the textbooks apart from the module's table, with each
# period's stated range. No battle, massacre, execution or war is among them.
DATES = {
    "france": ((1774, 1815), {
        "Louis XVI becomes King of France": 1774, "The Estates-General meets at Versailles": 1789,
        "France gets its first written constitution": 1791, "France is declared a republic": 1792,
        "The Directory takes over the government": 1795, "Napoleon Bonaparte becomes First Consul": 1799,
        "The Bank of France is founded": 1800, "Napoleon is crowned Emperor of the French": 1804,
        "Napoleon gives up the throne for the first time": 1814, "The Congress of Vienna signs its Final Act": 1815}),
    "american": ((1764, 1789), {
        "Britain passes the Sugar Act": 1764, "Britain passes the Stamp Act": 1765, "The Stamp Act is repealed": 1766,
        "Britain passes the Townshend Acts": 1767, "The Boston Tea Party": 1773,
        "The First Continental Congress meets": 1774, "The Declaration of Independence is adopted": 1776,
        "The Treaty of Paris recognises US independence": 1783, "The US Constitution is signed": 1787,
        "George Washington becomes the first US President": 1789}),
    "industrial": ((1733, 1830), {
        "John Kay invents the flying shuttle": 1733, "The Bridgewater Canal opens": 1761,
        "James Watt patents his steam engine": 1769, "Richard Arkwright opens his mill at Cromford": 1771,
        "Samuel Crompton invents the spinning mule": 1779, "Edmund Cartwright patents the power loom": 1785,
        "Trevithick's steam locomotive runs at Penydarren": 1804, "The Stockton and Darlington Railway opens": 1825,
        "Stephenson's Rocket wins the Rainhill Trials": 1829, "The Liverpool and Manchester Railway opens": 1830}),
    "germany": ((1815, 1871), {
        "The German Confederation is set up": 1815, "The Carlsbad Decrees are issued": 1819,
        "The Zollverein customs union begins": 1834, "The Frankfurt Parliament meets": 1848,
        "Frederick William IV refuses the German crown": 1849, "William I becomes King of Prussia": 1861,
        "Bismarck becomes Minister-President of Prussia": 1862, "The North German Confederation is formed": 1867,
        "The German Empire is proclaimed at Versailles": 1871}),
    "russia": ((1894, 1921), {
        "Nicholas II becomes Tsar": 1894, "The Social Democratic Labour Party is founded": 1898,
        "The party splits into Bolsheviks and Mensheviks": 1903, "The Tsar issues the October Manifesto": 1905,
        "The first State Duma meets": 1906, "The fourth State Duma meets": 1912, "The Bolsheviks take power": 1917,
        "Russia signs the Treaty of Brest-Litovsk": 1918, "Lenin introduces the New Economic Policy": 1921}),
    "usa": ((1820, 1877), {
        "The Missouri Compromise is agreed": 1820, "Texas joins the United States": 1845,
        "The Compromise of 1850 is agreed": 1850, "Uncle Tom's Cabin is published": 1852,
        "The Kansas-Nebraska Act is passed": 1854, "The Supreme Court decides the Dred Scott case": 1857,
        "Abraham Lincoln is elected President": 1860, "The Emancipation Proclamation takes effect": 1863,
        "The 13th Amendment ends slavery": 1865, "The 14th Amendment is ratified": 1868,
        "The 15th Amendment is ratified": 1870, "Reconstruction ends": 1877}),
    "league": ((1919, 1937), {
        "The Treaty of Versailles is signed": 1919, "The League of Nations is set up": 1920,
        "The League settles the Aaland Islands dispute": 1921, "The Dawes Plan is agreed": 1924,
        "The Locarno Treaties are signed": 1925, "Germany joins the League of Nations": 1926,
        "The Kellogg-Briand Pact is signed": 1928, "The Wall Street Crash": 1929, "The Lytton Report is published": 1932,
        "Japan leaves the League of Nations": 1933, "The USSR joins the League of Nations": 1934,
        "The Stresa Front is formed": 1935, "Italy leaves the League of Nations": 1937}),
    "china_japan": ((1912, 1945), {
        "China becomes a republic": 1912, "The May Fourth Movement begins": 1919,
        "The Chinese Communist Party is founded": 1921, "The Washington Naval Treaty is signed": 1922,
        "Sun Yat-sen dies": 1925, "Hirohito becomes Emperor of Japan": 1926, "The London Naval Treaty is signed": 1930,
        "Japan leaves the League of Nations": 1933, "Japan and Germany sign the Anti-Comintern Pact": 1936,
        "Japan signs the Tripartite Pact": 1940}),
    "africa": ((1855, 1885), {
        "Livingstone reaches the Victoria Falls": 1855, "Speke reaches Lake Victoria": 1858,
        "Speke reaches the Nile's source at Ripon Falls": 1862, "Baker reaches Lake Albert": 1864,
        "The Suez Canal opens": 1869, "Stanley meets Livingstone at Ujiji": 1871,
        "Leopold II's Brussels Geographical Conference": 1876, "Stanley reaches the Atlantic at Boma": 1877,
        "France makes Tunisia a protectorate": 1881, "The Berlin Conference opens": 1884,
        "The Berlin Conference ends": 1885}),
}
NIGERIA = {"Northern and Southern Nigeria are amalgamated": 1914, "The Clifford Constitution is introduced": 1922,
           "The NCNC party is formed": 1944, "The Richards Constitution is introduced": 1946,
           "The Macpherson Constitution is introduced": 1951, "Nigeria becomes a federation": 1954,
           "Nigeria becomes independent": 1960, "Nigeria becomes a republic": 1963,
           "Nigeria is divided into 12 states": 1967, "The naira replaces the Nigerian pound": 1973,
           "ECOWAS is founded in Lagos": 1975, "Nigeria is divided into 19 states": 1976,
           "The Second Republic begins": 1979, "Abuja becomes the capital": 1991,
           "Nigeria is divided into 36 states": 1996, "The Fourth Republic begins": 1999}
DATES["nigeria"] = ((1914, 1999), NIGERIA)
DATES["nigeria_colonial"] = ((1914, 1960), {n: y for n, y in NIGERIA.items() if y <= 1960})
DATES["nigeria_independent"] = ((1960, 1999), {n: y for n, y in NIGERIA.items() if y >= 1960})
VIOLENT = r"battle|war begins|massacre|execut|kill|invad|attack|bomb|genocide|murder|riot|coup|storm"


def test_every_period_matches_the_second_copy_and_stays_in_its_range():
    m = fam("history_timeline")
    assert set(m.PERIODS) == set(DATES)
    for key, period in m.PERIODS.items():
        (lo, hi), want = DATES[key]
        assert list(period["range"]) == [lo, hi], key
        assert f"{lo}–{hi}" in period["title"], key
        got = {n: y for n, y in period["events"]}
        assert got == want, (key, set(got.items()) ^ set(want.items()))
        years = [y for _, y in period["events"]]
        assert all(isinstance(y, int) and lo <= y <= hi for y in years), key
        assert len(set(years)) == len(years), f"{key}: two events in one year"
        assert years == sorted(years), key
        for n, _ in period["events"]:
            assert not re.search(VIOLENT, n, re.I), n
            assert len(n) <= 48, n


def tick_scale(items):
    """The line's scale, read from the numbered years under it: x = a + b * year."""
    ticks = [(int(t), pos[0]) for t, pos, fs, gid in items if gid == "tick"]
    (y0, x0), (y1, x1) = ticks[0], ticks[-1]
    b = (x1 - x0) / (y1 - y0)
    for y, x in ticks:
        assert abs(x0 + b * (y - y0) - x) < 1e-6
    return lambda year: x0 + b * (year - y0)


def test_history_timeline():
    m = fam("history_timeline")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        (lo, hi), table = DATES[p["period"]]
        seen[(p["band"], p["period"])] += 1
        events = [tuple(e) for e in p["events"]]
        assert all(table[n] == y for n, y in events), s
        assert [y for _, y in events] == sorted(y for _, y in events), s
        letters = p["letters"]
        assert len(letters) == len(events) and letters.count("?") <= 1, s
        if "?" in letters:
            assert 0 < letters.index("?") < len(events) - 1, f"{s}: the blank is not between two events"
        year_of = {l: y for l, (_, y) in zip(letters, events) if l != "?"}
        name_of = {l: n for l, (n, _) in zip(letters, events) if l != "?"}
        # What the figure prints: each lettered event's year by its letter, its name in the key, nothing for the blank.
        if s <= 200:
            items = placed(m, p)
            X = tick_scale(items)
            years = {gid.split(":")[1]: int(t) for t, pos, fs, gid in items if (gid or "").startswith("year:")}
            assert years == year_of, s
            key = {gid.split(":")[1]: t for t, pos, fs, gid in items if (gid or "").startswith("keyname:")}
            assert key == name_of, s
            fig = m.draw(p)
            leaders = {ln.get_gid().split(":")[1]: ln.get_xydata() for ln in fig.axes[0].lines
                       if (ln.get_gid() or "").startswith("leader:")}
            circles = {t.get_gid().split(":")[1]: t.get_position() for t in fig.axes[0].texts
                       if (t.get_gid() or "").startswith("letter:")}
            plt.close(fig)
            for letter, (n, y) in zip(letters, events):
                start, end = leaders[letter][0], leaders[letter][-1]
                assert abs(start[0] - X(y)) < 1e-6, (s, letter, y)  # the leader leaves the line at the event's year
                assert abs(end[0] - circles[letter][0]) < 1e-6 and end[1] < circles[letter][1], (s, letter)
        for q in qs:
            got = re.search(r"happened (first|last)\?$", q.stem)
            if got:
                ys = [table[o] for o in q.options]
                want = min(ys) if got.group(1) == "first" else max(ys)
                assert ys.count(want) == 1 and table[picked(q)] == want, s
                assert all(o in name_of.values() for o in q.options), s
                continue
            names = re.findall(r'"([^"]+)"', q.stem)
            if len(names) == 2:
                a, b = names
                assert a in name_of.values() and b in name_of.values(), s
                assert q.answer == str(table[b] - table[a]) and table[b] > table[a], (s, q.stem)
                assert f"{q.answer} years" in q.accepted
                continue
            got = re.search(r"happened in the (\d{4})s\?$", q.stem)
            if got:
                d = int(got.group(1))
                inside_decade = [o for o in q.options if d <= year_of[o] < d + 10]
                assert inside_decade == [picked(q)], (s, d, q.options)
                assert sum(1 for y in year_of.values() if d <= y < d + 10) == 1, s
                continue
            if "belongs at the ? mark" in q.stem:
                i = letters.index("?")
                before, after = events[i - 1][1], events[i + 1][1]
                fits = []
                for o in q.options:
                    g = re.fullmatch(r"(.+) \((\d{4})\)", o)
                    assert g and table[g.group(1)] == int(g.group(2)), (s, o)
                    if before < int(g.group(2)) < after:
                        fits.append(o)
                assert fits == [picked(q)] and picked(q).startswith(events[i][0] + " ("), (s, q.options)
                drawn = {n for n, _ in events if n != events[i][0]}
                assert not any(o.rsplit(" (", 1)[0] in drawn for o in q.options), s
                continue
            pytest.fail(f"{s}: unchecked question {q.stem}")
    assert len(seen) >= 14 and min(seen.values()) >= 20, seen
    assert {b for b, _ in seen} == {"P", "LS", "UP"}
    assert {k for b, k in seen if b == "P"} == {"nigeria_colonial", "nigeria_independent"}


def test_history_timeline_letters_and_labels_stand_apart():
    """No two letter circles touch (centre distance more than the two radii) and each leader ends under its own
    letter, so every letter is joined to one dot (P4 review rule)."""
    from matplotlib.patches import Circle
    m = fam("history_timeline")
    for s in range(1, 301):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        rings = [pa for pa in fig.axes[0].patches if isinstance(pa, Circle)]
        plt.close(fig)
        assert len(rings) == 2 * len(p["events"]) - p["letters"].count("?"), s  # on the line, and in the key
        for i, a in enumerate(rings):
            for b in rings[i + 1:]:
                assert math.dist(a.center, b.center) > a.radius + b.radius + 0.05, s


# --- source_provenance -------------------------------------------------------------------------------------

EVENT_DATES = {
    "Nigeria becomes independent": date(1960, 10, 1), "Ghana becomes independent": date(1957, 3, 6),
    "The Organisation of African Unity is founded": date(1963, 5, 25), "ECOWAS is founded": date(1975, 5, 28),
    "Rwanda becomes independent": date(1962, 7, 1), "Kenya becomes independent": date(1963, 12, 12),
    "Tanganyika becomes independent": date(1961, 12, 9),
    "The Liverpool and Manchester Railway opens": date(1830, 9, 15), "The Great Exhibition opens": date(1851, 5, 1),
    "The Frankfurt Parliament first meets": date(1848, 5, 18), "The German Empire is proclaimed": date(1871, 1, 18),
    "The Suez Canal opens": date(1869, 11, 17), "Abraham Lincoln is sworn in as President": date(1861, 3, 4),
    "The Treaty of Versailles is signed": date(1919, 6, 28),
    "The League of Nations Assembly first meets": date(1920, 11, 15),
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def read_when(text):
    """A printed date: (date, None) for a day, (None, year) for a year only."""
    g = re.fullmatch(r"(\d{1,2}) (\w+) (\d{4})", text)
    if g:
        return date(int(g.group(3)), MONTHS.index(g.group(2)) + 1, int(g.group(1))), None
    g = re.fullmatch(r"(\d{4})", text)
    assert g, text
    return None, int(g.group(1))


def source_rows(items):
    """The table as printed: {letter: {column: text}}, read row by row from the gids."""
    rows = defaultdict(dict)
    for t, pos, fs, gid in items:
        g = re.fullmatch(r"cell:([A-D]):(\w+)", gid or "")
        if g:
            rows[g.group(1)][g.group(2)] = t.replace("\n", " ")
    return rows


def test_source_provenance():
    m = fam("source_provenance")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        items = placed(m, p)
        words = " ".join(t for t, *_ in items)
        assert "Primary source" in words and "Secondary source" in words and "Eyewitness" in words, s
        event = p["event"]
        when = EVENT_DATES[event]
        assert f"{when.day} {MONTHS[when.month - 1]} {when.year}" in words and event in words, s
        rows = source_rows(items)
        assert sorted(rows) == list("ABCD"), s
        primary, gap, eye, made = set(), {}, set(), {}
        for letter, row in rows.items():
            day, year = read_when(row["when"])
            if day is not None:  # made within days of the event: primary by the printed definition
                assert 0 <= (day - when).days <= 14, (s, row)
                primary.add(letter)
                gap[letter] = (day - when).days
                made[letter] = day.year
            else:  # made years later: secondary
                assert year - when.year >= 10 and year <= 2025, (s, row)
                gap[letter] = (date(year, 1, 1) - when).days
                made[letter] = year
            if row["how"].startswith("Was there"):
                eye.add(letter)
                assert letter in primary, s
        assert len(eye) == 1, s
        seen[len(primary)] += 1
        for q in qs:
            if "how many of the four are primary sources" in q.stem:
                assert q.answer == str(len(primary)), s
            elif "closest in time to the event" in q.stem:
                best = min(gap.values())
                assert list(gap.values()).count(best) == 1 and gap[picked(q)] == best, s
            elif "made by an eyewitness" in q.stem:
                assert {picked(q)} == eye, s
            elif "How many years after the event was source" in q.stem:
                x = re.search(r"source ([A-D]) made\?", q.stem).group(1)
                assert x not in primary and q.answer == str(made[x] - when.year), s
            elif "the only primary source" in q.stem:
                assert primary == {picked(q)}, s
            elif "the only secondary source" in q.stem:
                assert set("ABCD") - primary == {picked(q)}, s
            else:
                pytest.fail(f"{s}: unchecked question {q.stem}")
            if q.kind == "mcq":
                assert q.options == list("ABCD"), s
    assert set(seen) == {1, 2, 3} and min(seen.values()) >= 150, seen


def test_source_dates_are_the_second_copy_and_kinds_fit_their_time():
    m = fam("source_provenance")
    assert {e[0]: date(*e[1]) for e in m.EVENTS} == EVENT_DATES
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        year = EVENT_DATES[p["event"]].year
        rows = source_rows(placed(m, p)) if s <= 60 else None
        for src in p["sources"]:
            if src["what"] == "A photograph":
                assert year >= 1855, (s, year)  # no press photograph before photography was in use
            if "radio" in src["how"]:
                assert year >= 1925, (s, year)
            if "telegraph" in src["how"]:
                assert year >= 1850, (s, year)
            if src["what"] == "A documentary film":
                assert len(src["when"]) == 1 and src["when"][0] >= 1950 and year >= 1900, s
            if src["what"] == "A museum website":
                assert src["when"][0] >= 2000, s
        if rows:
            assert sorted(r["what"] for r in rows.values()) == sorted(src["what"] for src in p["sources"]), s


# --- kingdom_structure -------------------------------------------------------------------------------------

# This file's own copy of each chart: every office's place (the one above it, or "beside" the ruler for a council),
# and which council chose or advised the ruler.
CHARTS = {
    "rwanda": {"ruler": "Mwami", "council": "Abiru", "levels": 3,
               "above": {"Umugabekazi": "beside", "Abiru": "beside", "Chief of land": "Mwami",
                         "Chief of pastures": "Mwami", "Chief of the army": "Mwami",
                         "Hill chiefs": ("Chief of land", "Chief of pastures")}},
    "buganda": {"ruler": "Kabaka", "council": "Lukiiko", "levels": 5,
                "above": {"Lukiiko": "beside", "Katikkiro": "Kabaka", "Saza chiefs": "Katikkiro",
                          "Gombolola chiefs": "Saza chiefs", "Muluka chiefs": "Gombolola chiefs"}},
    "oyo": {"ruler": "Alaafin", "council": "Oyo Mesi", "levels": 3,
            "above": {"Oyo Mesi": "beside", "Ogboni": "beside", "Are-Ona-Kakanfo": "Alaafin",
                      "Provincial kings": "Alaafin", "Baales": "Provincial kings"}},
    "kongo": {"ruler": "Manikongo", "council": "Royal council", "levels": 4,
              "above": {"Royal council": "beside", "Provincial governors": "Manikongo",
                        "District chiefs": "Provincial governors", "Village heads": "District chiefs"}},
    "oyo_simple": {"ruler": "Alaafin", "council": "Oyo Mesi", "levels": 3,
                   "above": {"Oyo Mesi": "beside", "Provincial kings": "Alaafin", "Baales": "Provincial kings"}},
}


def below_of(chart, office):
    return [o for o, up in chart["above"].items() if up == office or (isinstance(up, tuple) and office in up)]


def test_kingdom_structure():
    m = fam("kingdom_structure")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        k = p["kingdom"]
        chart = CHARTS[k]
        seen[(p["band"], k)] += 1
        letters = p["letters"]
        offices = [chart["ruler"], *chart["above"]]
        if letters:
            assert sorted(letters) == sorted(offices) and sorted(letters.values()) == list("ABCDEFG"[:len(offices)]), s
        items = placed(m, p) if s <= 150 else None
        if items:
            names = {gid.split(":", 1)[1]: pos for t, pos, fs, gid in items if (gid or "").startswith("name:")}
            assert sorted(names) == sorted(offices), s
            if letters:
                # each letter sits nearest its own office's name
                for t, pos, fs, gid in items:
                    if (gid or "").startswith("letter:"):
                        near = min(names, key=lambda o: math.dist(names[o], pos))
                        assert letters[near] == t, (s, t, near)
                duties = {gid.split(":", 1)[1]: t.replace("\n", " ") for t, pos, fs, gid in items
                          if (gid or "").startswith("duty:")}
                assert sorted(duties) == sorted(offices), s
        for q in qs:
            if "council that" in q.stem:
                assert picked(q) == letters[chart["council"]], s
                phrase = re.search(r"council that (.+)\?$", q.stem).group(1)
                if items:
                    assert sum(1 for o, d in duties.items() if "council" in d and phrase in d) == 1, (s, phrase)
            elif "directly below the" in q.stem:
                office = re.search(r"directly below the (.+)\?$", q.stem).group(1)
                office = next(o for o in offices if o.lower() == office.lower())
                under = below_of(chart, office)
                assert len(under) == 1 and picked(q) == letters[under[0]], (s, office)
            elif "directly above the" in q.stem:
                office = re.search(r"directly above the (.+)\?$", q.stem).group(1)
                office = next(o for o in offices if o.lower() == office.lower())
                up = chart["above"][office]
                assert isinstance(up, str) and up != "beside" and picked(q) == letters[up], (s, office)
            elif "How many levels" in q.stem or "How many rows of boxes" in q.stem:
                assert q.answer == str(chart["levels"]), s
            elif "Using the table, which letter shows the office that" in q.stem:
                phrase = re.search(r"office that (.+)\?$", q.stem).group(1)
                hits = [o for o, d in duties.items() if phrase in d] if items else None
                if items:
                    assert len(hits) == 1 and picked(q) == letters[hits[0]], (s, phrase)
            elif "just below the Alaafin" in q.stem:
                assert picked(q).startswith("The provincial kings"), s
            elif "bottom of the chart" in q.stem:
                assert picked(q).startswith("The Baales"), s
            elif "advises the Alaafin" in q.stem:
                assert picked(q).startswith("The Oyo Mesi"), s
            else:
                pytest.fail(f"{s}: unchecked question {q.stem}")
            if q.kind == "mcq" and letters:
                assert all(o in letters.values() for o in q.options), s
    assert ("P", "oyo_simple") in seen and ("P", "rwanda") in seen and ("P", "oyo") in seen
    assert {k for b, k in seen if b == "LS"} == {"rwanda", "buganda", "oyo", "kongo"}
    assert min(seen.values()) >= 40, seen


def test_kingdom_letters_sit_on_their_boxes_and_never_touch():
    """No two letter circles touch, and no circle covers any printed word but its own letter (P4 review rule)."""
    from matplotlib.patches import Circle
    m = fam("kingdom_structure")
    for s in range(1, 201):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        rings = [pa for pa in fig.axes[0].patches if isinstance(pa, Circle)]
        assert len(rings) == (len(p["letters"]) if p["letters"] else 0), s
        for i, a in enumerate(rings):
            for b in rings[i + 1:]:
                assert math.dist(a.center, b.center) > a.radius + b.radius + 0.1, s
        if s <= 60:
            boxes = drawn_texts(fig)
            for c in rings:
                ring = c.get_window_extent(fig.canvas.get_renderer())
                for t, box in boxes:
                    if (t.get_gid() or "").startswith("letter:") and math.dist(t.get_position(), c.center) < 1e-6:
                        continue
                    assert not (min(ring.x1, box.x1) - max(ring.x0, box.x0) > 1
                                and min(ring.y1, box.y1) - max(ring.y0, box.y0) > 1), (s, t.get_text())
        plt.close(fig)


# --- family_history_p --------------------------------------------------------------------------------------

def relation(people, y, z):
    """What person y is to person z, from the generations and parents drawn."""
    a, b = people[y], people[z]
    f = a["sex"] == "F"
    if a["gen"] == 1 and b["gen"] == 3:
        return "grandmother" if f else "grandfather"
    if a["gen"] == 2 and b["gen"] == 3:
        return ("mother" if f else "father") if b["parent"] == y else ("aunt" if f else "uncle")
    return None


def test_family_history_p():
    m = fam("family_history_p")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["sub"], p["nation"])] += 1
        if p["sub"] == "tree":
            people = p["people"]
            me = p["me"]
            name = {q["name"]: i for i, q in enumerate(people)}
            assert len(name) == len(people), s
            assert people[me]["gen"] == 3
            for q in qs:
                got = re.search(r"Who is \w+'s (grandmother|grandfather|aunt|uncle)\?$", q.stem)
                if got:
                    fits = [o for o in q.options if relation(people, name[o], me) == got.group(1)]
                    assert fits == [picked(q)], (s, q.stem, q.options)
                    continue
                got = re.search(r"How many grandchildren do (\w+) and (\w+) have\?", q.stem)
                assert got, q.stem
                assert {people[name[got.group(1)]]["gen"], people[name[got.group(2)]]["gen"]} == {1}
                assert q.answer == str(sum(1 for x in people if x["gen"] == 3)), s
        else:
            events = p["events"]
            years = [e[-1] for e in events]
            assert years == sorted(years) and len(set(years)) == len(years), s
            assert all(b - a >= 2 for a, b in zip(years, years[1:])) and years[-1] - years[0] <= 10, s
            label = {e[1]: e[-1] for e in events}
            if s <= 150:
                items = placed(m, p)
                ticks = sorted((int(t), pos[0]) for t, pos, fs, gid in items if gid == "tick")
                assert [y for y, _ in ticks] == list(range(years[0] - 1, years[-1] + 2)), s
                shown = {t.replace("\n", " "): pos for t, pos, fs, gid in items if (gid or "").startswith("event:")}
                at = dict((y, x) for y, x in ticks)
                for text, year in label.items():
                    assert abs(shown[text][0] - at[year]) < 1e-6, (s, text)  # each label stands over its own year
            phrases = {e[0]: e for e in events}
            for q in qs:
                if q.stem.endswith("Which of these happened first?"):
                    ys = [label[o] for o in q.options]
                    assert ys.count(min(ys)) == 1 and label[picked(q)] == min(ys), s
                    if p["sub"] == "family":  # never both ends of a pair common sense orders
                        keys = {next(e[0] for e in events if e[1] == o) for o in q.options}
                        assert "married" not in keys and not {"born", "school"} <= keys, (s, keys)
                    else:
                        assert not any(e[0] == "opens" and e[1] in q.options for e in events), s
                    continue
                got = re.search(r"^In which year (.+)\?$", q.stem)
                if got:
                    e = next(e for e in events if e[2] == got.group(1))
                    assert q.answer == str(e[-1]), s
                    continue
                pairs = [(a, b) for a in events for b in events if q.stem == f"How many years after {a[3]} {b[2]}?"]
                if pairs:
                    (a, b), = pairs
                    assert q.answer == str(b[-1] - a[-1]) and b[-1] > a[-1], (s, q.stem)
                    assert b[0] not in ("school", "opens", "married"), s  # never a gap common sense knows
                    continue
                got = re.search(r"How old was (\w+) when (.+)\? (Her|His) birthday is on 1 January\.$", q.stem)
                if got:
                    b = next(e for e in events if e[3] == got.group(2))
                    assert got.group(1) == p["me"] and b[0] not in ("school", "married", "born"), s
                    assert q.answer == str(b[-1] - phrases["born"][-1]) and int(q.answer) > 0, s
                    continue
                pytest.fail(f"{s}: unchecked question {q.stem}")
    assert set(seen) == {("tree", "ng"), ("family", "ng"), ("family", "rw"), ("school", "ng"), ("school", "rw")}, seen
    assert min(seen.values()) >= 80, seen


def test_family_tree_faces_show_a_key_and_names_each_face():
    m = fam("family_history_p")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["sub"] != "tree":
            continue
        n += 1
        words = [t for t, *_ in placed(m, p)]
        for q in p["people"]:
            assert words.count(q["name"]) == 1, (s, q["name"])
        assert "woman or girl" in words and "man or boy" in words, s
    assert n >= 30


# --- shared checks -----------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", WAVE)
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                key = re.sub(r'"[^"]*"', "_", key)
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", WAVE)
def test_no_line_runs_through_a_label(fid):
    m = fam(fid)
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for ln in fig.axes[0].lines:
            for t, box in boxes:
                assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", WAVE)
def test_no_two_texts_overlap_in_any_sub_type(fid):
    m = fam(fid)
    for s in range(1, 61):
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        plt.close(fig)
        for i, (t, a) in enumerate(boxes):
            for u, b in boxes[i + 1:]:
                assert not (min(a.x1, b.x1) - max(a.x0, b.x0) > 1 and min(a.y1, b.y1) - max(a.y0, b.y0) > 1), \
                    (fid, s, t.get_text(), u.get_text())


@pytest.mark.parametrize("fid", [f for f in WAVE if f in FAMILIES and "P" in FAMILIES[f].BANDS])
def test_a_primary_figure_prints_big(fid):
    m = fam(fid)
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["band"] != "P" or n >= 15:
            continue
        n += 1
        fig = m.draw(p)
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        plt.close(fig)
        assert min(sizes) >= 10, (fid, s, min(sizes))
    assert n >= 10, (fid, n)


@pytest.mark.parametrize("fid", WAVE)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 120):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in PEOPLE if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(PEOPLE) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


@pytest.mark.parametrize("fid", WAVE)
def test_declares_its_concepts_bands_and_stages(fid):
    m = fam(fid)
    assert m.SUBJECT == "history" and m.CONCEPTS and all(c.startswith("history.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    bands = set()
    for s in range(1, 300):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            lo, hi = m.stages(p)
            assert 1 <= lo <= hi <= 6, (fid, s)
        re.compile(m.avoid_for(p))
    assert bands == set(m.BANDS), (fid, bands)


def test_no_figure_is_about_violence_and_the_quiet_topics_stay_empty():
    """Genocide, human rights, conflict, values and religion units are left to the textbooks' own pictures."""
    quiet = ["Genocide and Its Features", "Comparisons of the Genocides", "Human Rights Codification and Its Impact",
             "Forms, Causes and Consequences of Conflicts and Violence", "Family and Personal Values",
             "Origin of Islam and Its Impact in West Africa", "African Response to Colonial Conquest",
             "Colonialism and resistance", "Contemporary issues", "UNIT 11: PREVENTION AND RESOLUTION OF CONFLICTS"]
    for fid in WAVE:
        m = fam(fid)
        for s in range(1, 200):
            p = m.sample(random.Random(s))
            for name in quiet:
                assert re.search(m.avoid_for(p), name, re.I), (fid, s, name)


# --- reach by name (read-only figure store) ----------------------------------------------------------------

TARGETS = [
    ("history_timeline", "The 1789 French Revolution", 1), ("history_timeline", "Major European Events Between 1789 and 1835", 1),
    ("history_timeline", "France, 1774–1814", 1), ("history_timeline", "Causes and Impact of The American Revolution", 1),
    ("history_timeline", "The Industrial Revolution", 1), ("history_timeline", "The Industrial Revolution in Britain, 1750–1850", 1),
    ("history_timeline", "Liberalism and nationalism in Germany, 1815–71", 1),
    ("history_timeline", "Major European Events from 1836 to 1878", 1),
    ("history_timeline", "The Russian Revolution, 1894–1921", 1), ("history_timeline", "The origins of the Civil War, 1820–61", 1),
    ("history_timeline", "Civil War and Reconstruction, 1861–77", 1),
    ("history_timeline", "The League of Nations and international relations in the 1920s", 1),
    ("history_timeline", "The League of Nations and international relations in the 1930s", 1),
    ("history_timeline", "China and Japan 1912–1945", 1), ("history_timeline", "Exploration of Africa", 1),
    ("history_timeline", "European Colonisation of Africa", 1),
    ("history_timeline", "Role of Colonial Agents in Colonisation of Africa", 1), ("history_timeline", "Nigerian history", 2),
    ("history_timeline", "Independence and nation-building", 3), ("history_timeline", "Colonial period", 3),
    ("source_provenance", "Source analysis", 1), ("source_provenance", "Historiography", 2),
    ("source_provenance", "Preparing for assessment", 3),
    ("kingdom_structure", "Organization of Pre-Colonial Rwanda", 1),
    ("kingdom_structure", "Kingdoms of East and Central Africa: Buganda and Kongo Kingdoms", 1),
    ("kingdom_structure", "Traditional institutions", 3), ("kingdom_structure", "Pre-colonial societies", 3),
    ("kingdom_structure", "Nigerian civilizations", 3), ("kingdom_structure", "Traditional Rwanda", 1),
    ("family_history_p", "Family and community history", 3), ("family_history_p", "Family Historical Events", 1),
    ("family_history_p", "Main Historical Events at Home and at School", 1),
]
# Topics a family must never reach: they teach something else.
MISFITS = {
    "history_timeline": r"genocide|human rights|preparing for assessment|source|historiograph|forms and principles|"
                        r"colonial reforms|german and belgian|trans-saharan|long distance|world history|west african",
    "source_provenance": r"genocide|islam|slave|civilizations|republic|duties",
    "kingdom_structure": r"origin and expansion|^colonial rwanda|post-independence|family|local heroes|national symbols",
    "family_history_p": r"extended family|family members|our sector|traditional|local heroes|national symbols",
}


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return link, link.topic_index(db)


@pytest.mark.parametrize("fid,topic,n", TARGETS)
def test_reaches_the_empty_topic_by_name(fid, topic, n, index):
    link, ix = index
    names = {t["key"]: t["name"].replace(chr(8), "").strip() for t in ix}
    reached = Counter(names[k] for k in link.reach(ix, fam(fid), 300))
    assert reached[topic] >= n, (fid, topic, reached[topic])


@pytest.mark.parametrize("fid", WAVE)
def test_reaches_no_misfit(fid, index):
    link, ix = index
    names = {t["key"]: t["name"] for t in ix}
    for k in link.reach(ix, fam(fid), 300):
        assert not re.search(MISFITS[fid], names[k], re.I), (fid, names[k])
