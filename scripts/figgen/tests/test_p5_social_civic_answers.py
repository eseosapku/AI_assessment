"""Answers of the P5 social-civic families (citizenship and government), recomputed independently over 1,000 seeds, and
the topics the P5 re-links reach by name.

- election_results: the winner, the margin, the turnout (votes cast, valid and rejected, over the registered voters),
  the votes a candidate needed to win and the registered voters who did not vote, all worked from the printed counts
  (a tally's strokes counted from the drawing);
- government_chart: which lettered box is which arm or organ, decided from the box's own drawn words by this file's
  own table of the 1999 Constitution of Nigeria and of the UN Charter, and the sizes checked against this file's
  own copy of those numbers;
- phishing_check's mobile-money text message: each lettered part judged a warning sign or safe by this file's own
  table, the link checked against the printed real website;
- personal_budget, labour_force, phishing_check: their new links, read against the topics' names and sections.

Nothing here calls a family's own helpers to work out a key.
"""
import math
import random
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.patches import Circle
from matplotlib.text import Text

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)
NEW = ("election_results", "government_chart")
EDITED = ("personal_budget", "labour_force", "phishing_check")
STORE = Path("C:/Users/Stephen/figure-library/figures.db")
# Nigerian first names the Nigerian figures use, besides the Rwandan NAMES.
NIGERIAN = ["Chinedu", "Ngozi", "Emeka", "Amaka", "Tunde", "Bisi", "Musa", "Aisha", "Ifeoma", "Yusuf", "Funmi", "Segun",
            "Halima", "Obinna", "Zainab", "Kelechi", "Bola", "Nkechi", "Sani", "Adaeze"]
PEOPLE = NAMES + NIGERIAN


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


def gids(fig) -> dict:
    return {t.get_gid(): t.get_text() for ax in fig.axes for t in ax.texts if t.get_gid()}


def words_of(fig) -> str:
    return re.sub(r"\s+", " ", " ".join(t.get_text() for ax in fig.axes for t in ax.texts))


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def whole(text: str) -> int:
    return int(text.replace(" ", "").replace(",", ""))


def pct(x: Fraction) -> str:
    return f"{float(x):.1f}".rstrip("0").rstrip(".")


# --- election_results ----------------------------------------------------------------------------------------------

def counts_of(p):
    """Each candidate's votes, the valid total, the votes cast and the registered voters, from the params."""
    votes = {c[0]: c[-1] for c in p["candidates"]}
    valid = sum(votes.values())
    cast = valid + p.get("rejected", 0)
    return votes, valid, cast, p["registered"]


def test_election_results():
    m = fam("election_results")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["style"])] += 1
        votes, valid, cast, reg = counts_of(p)
        ranked = sorted(votes, key=votes.get, reverse=True)
        win, second = ranked[0], ranked[1]
        assert len(set(votes.values())) == len(votes), (s, votes)  # no ties anywhere: every name has its own count
        assert 3 <= len(votes) <= 5 and cast < reg, (s, votes, reg)
        assert votes[win] - votes[second] >= (2 if p["band"] == "P" else 5), s
        turnout = Fraction(100 * cast, reg)
        if p["band"] == "UP":
            assert (turnout * 10).denominator == 1 and p["rejected"] > 0, (s, turnout)
        else:
            assert p.get("rejected", 0) == 0, s
            if p["band"] == "LS" or p["level"] == "upper":  # where the turnout is asked, it is a whole per cent
                assert turnout.denominator == 1, (s, turnout)
        if p["band"] == "P":
            assert max(votes.values()) <= 15 and reg <= 120, s
        assert qs[0].stem.startswith(tuple(PEOPLE)) and not qs[0].stem.startswith(tuple(votes)), (s, qs[0].stem)
        asked = set()
        for q in qs:
            if "Who won" in q.stem:
                assert q.kind == "mcq" and picked(q) == win and set(q.options) <= set(votes), (s, q.options)
                assert sum(o == win for o in q.options) == 1
                asked.add("winner")
            elif got := re.search(r"How many votes did (.+?) get\?", q.stem):
                assert q.answer == str(votes[got.group(1)]), (s, q.stem)
                asked.add("votes")
            elif got := re.search(r"By how many votes did (.+?) beat (.+?)[,?]", q.stem):
                a, b = got.groups()
                assert (a, b) == (win, second) and q.answer == str(votes[a] - votes[b]), (s, q.stem)
                asked.add("margin")
            elif got := re.search(r"How many more votes did (.+?) need to get one vote more than (.+?)\?", q.stem):
                a, b = got.groups()
                assert b == win and a != win and q.answer == str(votes[b] - votes[a] + 1), (s, q.stem)
                asked.add("needed")
            elif "turnout" in q.stem:
                assert "registered voters × 100" in q.stem, q.stem
                assert q.answer == pct(turnout), (s, q.answer, turnout)
                assert f"{q.answer}%" in q.accepted
                asked.add("turnout")
            elif "did not vote" in q.stem:
                assert q.answer == str(reg - cast), (s, q.stem)
                asked.add("absent")
            else:
                pytest.fail(q.stem)
        assert {"winner", "margin", "needed"} <= asked, (s, asked)
        assert ("turnout" in asked) == (p["band"] != "P" or p["level"] == "upper"), (s, asked)
    for k in (("P", "tally"), ("P", "bar"), ("LS", "bar"), ("LS", "table"), ("UP", "bar"), ("UP", "table")):
        assert seen[k] > 50, seen


def test_election_results_prints_every_count_and_the_formula():
    m = fam("election_results")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        votes, valid, cast, reg = counts_of(p)
        fig = m.draw(p)
        g = gids(fig)
        strokes = Counter((ln.get_gid() or "").split(":")[1] for ax in fig.axes for ln in ax.lines
                          if (ln.get_gid() or "").startswith("tally:"))
        words = words_of(fig)
        plt.close(fig)
        for i, c in enumerate(p["candidates"]):
            assert g[f"name:{i}"].replace("\n", " ").startswith(c[0]), (s, g[f"name:{i}"])
            if p["style"] == "tally":
                assert strokes[str(i)] == c[-1], (s, c, strokes)  # the tally's strokes are the votes
            else:
                assert whole(g[f"votes:{i}"]) == c[-1], (s, g[f"votes:{i}"])
        assert whole(re.search(r"([\d ]+)$", g["registered"]).group(1)) == reg, (s, g["registered"])
        if p["band"] == "UP":
            assert whole(re.search(r"([\d ]+)$", g["rejected"]).group(1)) == p["rejected"]
        if p["band"] != "P" or p["level"] == "upper":
            assert "Turnout = votes cast ÷ registered voters × 100" in words, s
        assert "invented" in words.lower() or p["band"] == "P", s


def test_election_results_tally_is_drawn_in_fives():
    """A tally is grouped in fives: four upright strokes and a fifth across them."""
    m = fam("election_results")
    n = 0
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["style"] != "tally":
            continue
        n += 1
        fig = m.draw(p)
        for i, c in enumerate(p["candidates"]):
            lines = [ln for ln in fig.axes[0].lines if ln.get_gid() == f"tally:{i}"]
            across = [ln for ln in lines if abs(ln.get_xdata()[0] - ln.get_xdata()[1]) > 0.2]
            assert len(across) == c[-1] // 5, (s, c)
        plt.close(fig)
    assert n > 20


# --- government_chart ----------------------------------------------------------------------------------------------

# This file's own copy of the 1999 Constitution of Nigeria (sections 4, 5, 6, 48, 49) as the books teach it.
ARM_OF = [("National Assembly", "Legislature"), ("President", "Executive"), ("Supreme Court", "Judiciary"),
          ("Judges", "Judiciary")]
JOB_OF = {"makes laws": "Legislature", "makes the laws": "Legislature", "carries out laws": "Executive",
          "carries out the laws": "Executive", "interprets laws": "Judiciary", "explains what the laws mean": "Judiciary"}
SENATE, REPS, STATES = 109, 360, 36
# This file's own copy of the UN Charter's organs: words in the box, members, years elected for, permanent members.
ORGANS = {"General Assembly": (193, None, 0), "Security Council": (15, 2, 5), "Economic and Social Council": (54, 3, 0),
          "Secretariat": (None, None, 0), "International Court of Justice": (15, 9, 0), "Trusteeship Council": (None, None, 0)}
UN_JOB = {"keeps international peace and security": "Security Council",
          "settles legal disputes between countries": "International Court of Justice",
          "runs the UN's day-to-day work": "Secretariat",
          "coordinates the UN's economic and social work": "Economic and Social Council",
          "discusses world problems and approves the UN budget": "General Assembly"}


def arm_in(text: str) -> str:
    hits = {arm for words, arm in ARM_OF if words in text}
    assert len(hits) == 1, text
    return hits.pop()


def organ_in(text: str) -> str:
    hits = [o for o in ORGANS if o in text.replace("\n", " ")]
    assert len(hits) == 1, text
    return hits[0]


def lettered(fig, sub: str) -> dict:
    """Each letter drawn, and the arm, house or organ its box names (read from the box's own words)."""
    g = gids(fig)
    out = {}
    for gid, letter in g.items():
        if not gid.startswith("letter:"):
            continue
        box = g["box:" + gid[7:]].replace("\n", " ")
        if sub == "un":
            out[letter] = organ_in(box)
        elif "Senate" in box and "Representatives" not in box:
            out[letter] = "Senate"
        elif "House of" in box:
            out[letter] = "House of Representatives"
        else:
            out[letter] = arm_in(box)
    return out


def test_government_chart_facts_are_the_constitutions():
    m = fam("government_chart")
    assert (m.SENATE, m.REPS, m.STATES) == (SENATE, REPS, STATES) and 3 * STATES + 1 == SENATE
    assert set(m.UN_ORGANS) == set(ORGANS)
    for name, (members, years, permanent) in ORGANS.items():
        box = m.UN_ORGANS[name][1].replace("\n", " ")
        if members:
            assert f"{members} " in box, (name, box)
        if years:
            assert f"for {years} years" in box, (name, box)
        if permanent:
            assert f"{permanent} permanent" in box and f"{members - permanent} elected" in box


def test_government_chart():
    m = fam("government_chart")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["sub"])] += 1
        assert qs[0].stem.startswith(tuple(PEOPLE)), qs[0].stem
        letters = p["letters"]
        by_letter = {v: k for k, v in letters.items()}
        assert len(by_letter) == len(letters)
        for q in qs:
            if q.kind == "mcq":
                assert all(o in by_letter for o in q.options), (s, q.options)
            if p["sub"] in ("ng", "ng_p"):
                job = next((j for j in JOB_OF if f"that {j}" in q.stem), None)
                if job:
                    right = [o for o in q.options if by_letter[o] == JOB_OF[job]]
                    assert right == [picked(q)], (s, q.stem)  # exactly one option is right
                elif got := re.search(r"how many members does the house lettered ([DE]) have", q.stem):
                    house = by_letter[got.group(1)]
                    assert house in ("Senate", "House of Representatives"), s
                    assert q.answer == str(SENATE if house == "Senate" else REPS), s
                elif "two houses of the National Assembly have altogether" in q.stem:
                    assert q.answer == str(SENATE + REPS)
                elif "come from the 36 states" in q.stem:
                    assert q.answer == str(3 * STATES)
                elif got := re.search(r"arm of government that the two houses lettered ([DE]) and ([DE]) belong to", q.stem):
                    assert by_letter[picked(q)] == "Legislature"
                elif got := re.search(r"Which letter shows the arm that (the Senate|the President|the judges)", q.stem):
                    want = {"the Senate": "Legislature", "the President": "Executive", "the judges": "Judiciary"}[got.group(1)]
                    assert by_letter[picked(q)] == want, (s, q.stem)
                    assert sum(by_letter[o] == want for o in q.options) == 1
                else:
                    pytest.fail(q.stem)
            else:
                job = next((j for j in UN_JOB if j in q.stem), None)
                if job:
                    right = [o for o in q.options if by_letter[o] == UN_JOB[job]]
                    assert right == [picked(q)], (s, q.stem)
                elif "5 permanent members" in q.stem:
                    right = [o for o in q.options if ORGANS[by_letter[o]][2] == 5]
                    assert right == [picked(q)], (s, q.options)
                elif got := re.search(r"how many members does the organ lettered ([A-F]) have", q.stem):
                    assert q.answer == str(ORGANS[by_letter[got.group(1)]][0]), (s, q.stem)
                elif got := re.search(r"for how many years is each elected member of the organ lettered ([A-F]) elected",
                                      q.stem):
                    assert q.answer == str(ORGANS[by_letter[got.group(1)]][1]), (s, q.stem)
                else:
                    pytest.fail(q.stem)
        if p["sub"] == "ng_p":
            assert p["band"] == "P" and m.stages(p) == (6, 6)
    assert all(seen[k] > 200 for k in (("UP", "ng"), ("UP", "un"), ("P", "ng_p"))), seen


def test_government_chart_letters_name_what_their_boxes_show():
    m = fam("government_chart")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        found = lettered(fig, p["sub"])
        words = words_of(fig)
        plt.close(fig)
        assert set(found) == set(p["letters"].values()), s
        for key, letter in p["letters"].items():
            assert found[letter] == key, (s, key, letter, found)
        if p["sub"] == "ng":
            assert f"{SENATE} members" in words and f"{REPS} members" in words, s
            assert "Constitution of the Federal Republic of Nigeria, 1999" in words
            for job in ("Makes laws", "Carries out laws", "Interprets laws"):
                assert job in words
        if p["sub"] == "un":
            assert "193 member states" in words and "Charter of the United Nations" in words
            for job in UN_JOB:
                assert job[0].upper() + job[1:] in words, job


def test_government_chart_letters_stand_apart_and_lines_miss_the_words():
    """No two letter circles touch, and no connecting line runs through a word (P4 review)."""
    m = fam("government_chart")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        rings = [pa for pa in ax.patches if isinstance(pa, Circle)]
        assert len(rings) == len(p["letters"]), s
        for i, c in enumerate(rings):
            for d in rings[i + 1:]:
                assert math.dist(c.center, d.center) > c.radius + d.radius + 0.05, (s, c.center, d.center)
        boxes = drawn_texts(fig)
        for ln in ax.lines:
            for t, box in boxes:
                assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


# --- phishing_check: the mobile-money text message -------------------------------------------------------------------

PHISH = {"urgent", "pin", "http_fake", "typos"}
SAFE = {"subject_calm", "no_pin", "https_real", "spelled", "footer"}
SMS_WORDS = {"an urgent threat": "urgent", "a request for a PIN or password": "pin",
             "a link to a website that is not the real one": "http_fake", "a sentence with spelling mistakes": "typos"}


def test_phishing_sms():
    m = fam("phishing_check")
    n = 0
    for s in SEEDS:
        p, qs = run(m, s)
        if p["kind"] != "sms":
            continue
        n += 1
        assert p["band"] == "UP"
        parts = dict(p["parts"])
        kinds = list(parts.values())
        assert len(kinds) == 5 and set(kinds) <= PHISH | SAFE and len(set(kinds)) == 5
        assert any(k in PHISH for k in kinds) and any(k in SAFE for k in kinds)
        assert qs[0].stem.startswith(p["name"])
        asked = set()
        for q in qs:
            if got := re.search(r"Which lettered part of the message is (.+)\?$", q.stem):
                want = SMS_WORDS[got.group(1)]
                assert [k for k, x in parts.items() if x == want] == [picked(q)], (s, q.stem)
                asked.add("sign")
            elif "How many of the lettered parts" in q.stem:
                assert q.answer == str(sum(x in PHISH for x in kinds))
                asked.add("count")
            elif "is NOT a warning sign" in q.stem:
                assert parts[picked(q)] in SAFE and all(parts[o] in PHISH for o in q.options if o != picked(q))
                asked.add("safe")
            elif got := re.search(r"Does the link in this text message \(letter ([A-E])\) go to", q.stem):
                kind = parts[got.group(1)]
                assert kind in ("http_fake", "https_real")
                assert q.answer == ("Yes" if kind == "https_real" else "No")
                asked.add("link")
            else:
                pytest.fail(q.stem)
        assert {"sign", "count", "link"} <= asked, asked
    assert n > 120, n


def test_phishing_sms_shows_each_part_as_its_letter_says():
    m = fam("phishing_check")
    n = 0
    for s in range(1, 400):
        p = m.sample(random.Random(s))
        if p["kind"] != "sms":
            continue
        n += 1
        if n > 30:
            break
        fig = m.draw(p)
        g = gids(fig)
        sizes = [t.get_fontsize() for t in fig.axes[0].texts if t.get_text().strip()]
        boxes = drawn_texts(fig)
        rings = [pa for pa in fig.axes[0].patches if isinstance(pa, Circle)]
        for ln in fig.axes[0].lines:
            for t, box in boxes:
                assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)
        assert min(sizes) >= 8.5 and len(rings) == 5
        real = p["domain"]
        assert g["real"] == f"real website: www.{real}"
        assert "Warning signs of a scam" in g.values()
        for letter, kind in p["parts"]:
            shown = g[f"part:{letter}"]
            if kind == "http_fake":
                assert shown.startswith("http://") and shown.split("/")[2] not in (real, "www." + real)
            elif kind == "https_real":
                assert shown.startswith(f"https://www.{real}/")
            elif kind == "typos":
                assert re.search(r"Pleese|detials|acount", shown)
            elif kind == "urgent":
                assert "URGENT" in shown
            elif kind == "pin":
                assert "PIN" in shown and "never" not in shown
            elif kind == "no_pin":
                assert "never ask for your PIN" in shown
    assert n > 20


def test_existing_phishing_parts_are_drawn_as_before():
    """The email and web sub-types keep their drawing: the same lines, in the same words."""
    m = fam("phishing_check")
    p = {"band": "LS", "kind": "email", "org": "Imena Savings Bank", "domain": "imenabank.rw",
         "fake": "imenabank-alerts.xyz", "name": "Keza",
         "parts": [["A", "from_fake"], ["B", "urgent"], ["C", "no_pin"], ["D", "link_real"], ["E", "typos"]],
         "ask": {"sign": "urgent"}}
    fig = m.draw(p)
    g = gids(fig)
    plt.close(fig)
    assert g["part:A"] == "From:  Imena Savings Bank <alerts@imenabank-alerts.xyz>"
    assert g["part:B"] == "Subject:  URGENT! Your account will be closed in 24 hours"
    qs = m.questions(p, random.Random(3))
    assert qs[0].stem == "Keza checks this email for phishing. Which letter shows an urgent threat?"


# --- the three re-linked families ------------------------------------------------------------------------------------

def test_relinked_families_keep_their_subject_and_add_social_studies():
    pb, lf, ph = fam("personal_budget"), fam("labour_force"), fam("phishing_check")
    assert set(pb.ALSO) >= {"social-studies.family-budget", "social-studies.personal-finances"}
    assert pb.ALSO_BANDS == {"LS": ("UP",)}
    assert "social-studies.employment-unemployment" in lf.ALSO
    assert "social-studies.financial-scams-fraud" in ph.ALSO
    for s in range(1, 200):
        assert pb.sample(random.Random(s))["band"] == "LS"


# --- shared checks ---------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", NEW + ("phishing_check",))
def test_an_mcq_cannot_be_picked_from_its_options_alone(fid):
    m = fam(fid)
    seen, hits = defaultdict(int), defaultdict(int)
    for s in range(1, 301):
        _, qs = run(m, s)
        for q in qs:
            if q.kind == "mcq":
                key = re.sub(r"\d+", "#", q.stem.rsplit(". ", 1)[-1])
                seen[key] += 1
                hits[key] += _central(q.options) == int(q.answer)
    bad = {k: (hits[k], seen[k]) for k in seen if seen[k] >= 10 and hits[k] / seen[k] > 0.35}
    assert not bad, (fid, bad)


@pytest.mark.parametrize("fid", NEW)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", NEW)
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


@pytest.mark.parametrize("fid", NEW)
def test_no_two_texts_overlap_and_no_line_runs_through_a_label(fid):
    m = fam(fid)
    for s in range(1, 61):
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for i, (t, a) in enumerate(boxes):
            for u, b in boxes[i + 1:]:
                assert not (min(a.x1, b.x1) - max(a.x0, b.x0) > 1 and min(a.y1, b.y1) - max(a.y0, b.y0) > 1), \
                    (fid, s, t.get_text(), u.get_text())
        for ax in fig.axes:
            for ln in ax.lines:
                if (ln.get_gid() or "").startswith(("tally:", "grid")):
                    continue  # a tally's strokes sit in their own cell; gridlines run behind the bars only
                for t, box in boxes:
                    assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


@pytest.mark.parametrize("fid", NEW)
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


@pytest.mark.parametrize("fid", NEW)
def test_declares_its_concepts_bands_and_stages(fid):
    m = fam(fid)
    assert m.SUBJECT == "social-studies" and m.CONCEPTS and all(c.startswith("social-studies.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    bands = set()
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        bands.add(p["band"])
        assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            assert m.stages(p), (fid, s)
    assert bands == set(m.BANDS), (fid, bands)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """NEEDS and AVOID (or a figure's avoid_for) read against topic names: names turned away, names kept."""
    er, gc = fam("election_results"), fam("government_chart")
    ng_up = next(p for p in (er.sample(random.Random(s)) for s in range(1, 400)) if p["band"] == "UP" and p["ctx"] == "ng")
    rw_up = next(p for p in (er.sample(random.Random(s)) for s in range(1, 400)) if p["band"] == "UP" and p["ctx"] == "rw")
    p_low = next(p for p in (er.sample(random.Random(s)) for s in range(1, 400)) if p["band"] == "P" and p["level"] == "lower")
    for p, misfits, fits in (
            (ng_up, ["Human rights and duties", "Political theory", "Comparative government", "Constitution",
                     "Arms of government", "Unit 4: Pluralism in the world", "Unit 2: Democracy and good governance"],
             ["Nigerian government", "Civic participation", "Political parties"]),
            (rw_up, ["Nigerian government", "Human rights and duties"], ["Unit 2: Democracy and good governance"]),
            (p_low, ["Civics and Governance"], ["Democracy and governance"])):
        avoid = er.avoid_for(p)
        for name in misfits:
            assert re.search(avoid, name, re.I), name
        for name in fits:
            assert re.search(er.NEEDS, name, re.I) and not re.search(avoid, name, re.I), name
    subs = {}
    for s in range(1, 200):
        p = gc.sample(random.Random(s))
        subs.setdefault(p["sub"], p)
    for sub, misfits, fits in (
            ("ng", ["Political concepts", "Comparative government", "Civic participation",
                    "Unit 2: Democracy and good governance"],
             ["Nigerian government", "Nigerian constitution", "Arms of government", "Constitution"]),
            ("un", ["Unit 5: Communication, international relations and cooperation",
                    "Unit 8: International financial institutions, cooperation and development", "Comparative government"],
             ["International relations", "International organizations"]),
            ("ng_p", ["Civics and Governance"], ["Democracy and governance"])):
        avoid = gc.avoid_for(subs[sub])
        for name in misfits:
            assert re.search(avoid, name, re.I), (sub, name)
        for name in fits:
            assert re.search(gc.NEEDS, name, re.I) and not re.search(avoid, name, re.I), (sub, name)
    ph = fam("phishing_check")
    assert re.search(ph.AVOID, "Personal Finances", re.I)
    assert re.search(ph.NEEDS, "Unit 9: Financial scams", re.I) and not re.search(ph.AVOID, "Unit 9: Financial scams", re.I)
    pb = fam("personal_budget")
    for name in ("Personal Finances", "Unit 6: How to manage money", "Personal budgeting"):
        assert re.search(pb.NEEDS, name, re.I) and not re.search(pb.AVOID, name, re.I), name
    assert not re.search(pb.NEEDS, "Money and Finance", re.I)  # its sections teach banks and payments, not budgets
    lf = fam("labour_force")
    assert re.search(lf.NEEDS, "Unit 7: Transport, employment, unemployment and their impact on the economy", re.I)


# --- reach by name (read-only figure store) --------------------------------------------------------------------------

TARGETS = [
    ("election_results", "P", "Democracy and governance", 3), ("election_results", "P", "Civics and Governance", 1),
    ("election_results", "UP", "Nigerian government", 3),
    ("government_chart", "UP", "Nigerian government", 3), ("government_chart", "UP", "Nigerian constitution", 3),
    ("government_chart", "UP", "International relations", 3), ("government_chart", "UP", "International organizations", 1),
    ("government_chart", "P", "Democracy and governance", 1),
    ("personal_budget", "UP", "Personal Finances", 1), ("personal_budget", "UP", "Unit 6: How to manage money", 1),
    ("personal_budget", "LS", "Economics basics", 2),
    ("labour_force", "UP", "Unit 7: Transport, employment, unemployment and their impact on the economy", 1),
    ("phishing_check", "UP", "Unit 9: Financial scams", 1),
]
NOT_REACHED = [
    ("government_chart", "Unit 8: International financial institutions, cooperation and development"),
    ("government_chart", "Civics and Governance"), ("phishing_check", "Personal Finances"),
    ("personal_budget", "Money and Finance"), ("election_results", "Human rights and duties"),
    ("election_results", "Cultism and substance abuse"), ("election_results", "Law and order"),
    ("election_results", "Citizenship and national identity"), ("government_chart", "Foreign policy"),
    ("government_chart", "Global issues"), ("government_chart", "Law and order"),
]


@pytest.fixture(scope="module")
def index():
    if not STORE.exists():
        pytest.skip("no figure store")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from figgen import link
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return link, link.topic_index(db)


@pytest.mark.parametrize("fid,band,topic,n", TARGETS)
def test_reaches_the_empty_topic_by_name(fid, band, topic, n, index):
    link, ix = index
    names = {t["key"]: (t["band"], t["name"].strip()) for t in ix}
    reached = Counter(names[k] for k in link.reach(ix, fam(fid), 300))
    assert reached[(band, topic)] >= n, (fid, topic, reached[(band, topic)])


@pytest.mark.parametrize("fid,topic", NOT_REACHED)
def test_leaves_the_misfits_alone(fid, topic, index):
    link, ix = index
    names = {t["key"]: t["name"].strip() for t in ix}
    reached = {names[k] for k in link.reach(ix, fam(fid), 300)}
    if fid == "government_chart" and topic == "Civics and Governance":
        return  # checked by band below: the P6 chart must not reach Rwanda's own civics units
    assert topic not in reached, (fid, topic)


def test_the_nigerian_p6_chart_leaves_rwandas_civics_alone(index):
    link, ix = index
    names = {t["key"]: (t["band"], t["name"].strip()) for t in ix}
    reached = {names[k] for k in link.reach(ix, fam("government_chart"), 300)}
    assert ("P", "Civics and Governance") not in reached
