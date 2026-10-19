"""Answers of the P4 business-a families (organisation, operations, offices), recomputed independently from each
figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: a business's form is decided from its printed facts by
this file's own rules, a chain stage's sector from its words, a stakeholder's strategy from where it sits on the grid,
a canvas note's block from the canvas's own bank and the totals from the printed amounts, a control chart's samples
against the printed limits, a defect rate from the printed formula, a ruler reading from the item's ends, the filing
orders by sorting, a visit's length from the times, and the action plan's weeks from each step's start and length.
"""
import random
import re
from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 31)
WAVE = ("forms_of_business", "sectors_chain", "stakeholder_grid", "business_model_canvas", "quality_control",
        "office_records", "action_plan")


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


def words_of(m, p) -> str:
    fig = m.draw(p)
    fig.canvas.draw()
    words = " ".join(t.get_text() for ax in fig.axes for t in ax.texts)
    words += " " + " ".join(ax.get_title() + " " + ax.get_xlabel() + " " + ax.get_ylabel() for ax in fig.axes)
    words += " " + " ".join(t.get_text() for ax in fig.axes for t in ax.get_xticklabels() + ax.get_yticklabels())
    for ax in fig.axes:
        leg = ax.get_legend()
        if leg:
            words += " " + " ".join(t.get_text() for t in leg.get_texts())
    plt.close(fig)
    return re.sub(r"\s+", " ", words)  # a wrapped line reads as the words it wraps


def fr(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


def wrong_options_are_wrong(q):
    key = picked(q)
    assert sum(o == key for o in q.options) == 1, q.options


# --- forms of business -----------------------------------------------------------------------------

FORM_WORDS = {"a sole proprietorship (sole trader)": "sole", "a partnership": "partnership",
              "a private limited company": "ltd", "a public limited company": "plc", "a cooperative": "coop"}


def form_of(owners, liability, public, votes):
    """A business's form from its facts, as a Business Studies teacher decides it."""
    if liability == "Unlimited":
        return "sole" if owners == 1 else "partnership"
    assert liability == "Limited"
    if public == "Yes":
        return "plc"
    return "coop" if votes == "One vote per owner" else "ltd"


def test_forms_of_business():
    m = fam("forms_of_business")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        rows = p["rows"]
        assert 4 <= len(rows) <= 6, s
        names = [r[0] for r in rows]
        words = [w for n in names for w in n.split()]
        assert len(set(words)) == len(words), (s, names)  # no word shared, so no option is central by its words
        forms = {r[0]: form_of(r[2], r[3], r[4], r[5]) for r in rows}
        counts = Counter(forms.values())
        assert sorted(counts.values())[-1] == 2 and list(counts.values()).count(2) == 1, (s, counts)
        pair = [n for n in names if counts[forms[n]] == 2]
        for r in rows:  # the facts agree with each other as the law has them
            f = forms[r[0]]
            assert (r[2] == 1) == (f == "sole"), (s, r)
            if f == "plc":
                assert r[2] >= 1000, (s, r)
            if f == "partnership":
                assert 2 <= r[2] <= 20, (s, r)
            if f in ("ltd", "plc"):
                assert r[5] == "One vote per share", (s, r)
        seen = set()
        for q in qs:
            got = re.search(r"Which of the businesses is (.+)\?$", q.stem)
            if got:
                want = FORM_WORDS[got.group(1)]
                assert counts[want] == 1, s
                assert picked(q) == next(n for n in names if forms[n] == want), (s, q.stem)
                assert all(o in names for o in q.options)
                seen.add("which")
            elif "owners does the partnership" in q.stem:
                part = [r for r in rows if forms[r[0]] == "partnership"]
                assert len(part) == 1 and q.answer == str(part[0][2]), s
                seen.add("owners")
            elif "limited companies" in q.stem:
                assert q.answer == str(sum(1 for f in forms.values() if f in ("ltd", "plc"))), s
                seen.add("count")
            elif "same form of business" in q.stem:
                assert picked(q) == f"{pair[0]} and {pair[1]}", (s, picked(q), pair)
                for o in q.options:
                    a, b = o.split(" and ")
                    assert a in names and b in names and names.index(a) < names.index(b)
                seen.add("pair")
            wrong_options_are_wrong(q) if q.kind == "mcq" else None
        assert "which" in seen and "pair" in seen and ({"owners", "count"} & seen), (s, seen)
    assert bands["LS"] > 200 and bands["UP"] > 200, bands


def test_forms_of_business_prints_every_fact():
    m = fam("forms_of_business")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for name, activity, owners, liability, public, votes in p["rows"]:
            for x in (name, activity, fr(owners), liability, votes):
                assert x in words, (s, x)
        assert "Number of owners" in words and "Shares sold to the public?" in words


# --- sectors of production ---------------------------------------------------------------------------

PRIMARY = r"\b(grow|grows|pick|catch|catches|plant|plants|keep cows|harvest)\b"
SECONDARY = r"\b(factory|mill|ginnery|washing station|roasts|spins|weaves|sews|makes|pasteurises|grinds|saws|dairy|sawmill|carpenter|tailor)\b"
TERTIARY = r"\b(lorry|lorries|truck|van|carries|delivers|sells|shop|supermarket|bank|insures|insurance|trader|wholesaler|advertises)\b"
SECTORS = ("primary", "secondary", "tertiary")


def sector_of(text: str) -> str:
    hits = [n for n, pat in zip(SECTORS, (PRIMARY, SECONDARY, TERTIARY)) if re.search(pat, text, re.I)]
    assert len(hits) == 1, (text, hits)
    return hits[0]


def test_sectors_chain():
    m = fam("sectors_chain")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "chain":
            stages = p["stages"]
            assert 4 <= len(stages) <= 6, s
            secs = [sector_of(t) for t, _ in stages]
            assert secs == [x for _, x in stages], (s, stages)
            assert secs[0] == "primary" and secs == sorted(secs, key=SECTORS.index), (s, secs)  # a chain runs in order
            letters = "ABCDEF"[:len(stages)]
            for q in qs:
                got = re.search(r"Which lettered stage is in the (\w+) sector\?", q.stem)
                if got:
                    sec = got.group(1)
                    assert secs.count(sec) == 1 and sec != "primary", (s, secs)
                    assert picked(q) == letters[secs.index(sec)], s
                    assert set(q.options) <= set(letters)
                got = re.search(r"which sector is stage ([A-F]) in\?", q.stem)
                if got:
                    assert picked(q) == secs[letters.index(got.group(1))].capitalize(), s
                    assert sorted(q.options) == ["Primary", "Secondary", "Tertiary"]
                got = re.search(r"How many stages .* are in the (\w+) sector\?", q.stem)
                if got:
                    assert q.answer == str(secs.count(got.group(1))), s
        else:
            (y1, y2), shares = p["years"], p["shares"]
            assert y1 < y2
            for row in shares:
                assert sum(row) == 100 and all(v % 5 == 0 and v >= 5 for v in row), (s, row)
            for q in qs:
                got = re.search(r"What percentage of (?:workers|output) (?:were|came from) (?:in )?the (\w+) sector in (\d{4})\?", q.stem)
                if got:
                    sec, yr = SECTORS.index(got.group(1)), int(got.group(2))
                    assert q.answer == str(shares[(y1, y2).index(yr)][sec]), (s, q.stem)
                got = re.search(r"did the (\w+) sector's share of \w+ in Country \w (rise|fall) from (\d{4}) to (\d{4})\?", q.stem)
                if got:
                    sec = SECTORS.index(got.group(1))
                    d = shares[1][sec] - shares[0][sec]
                    assert d != 0 and (d > 0) == (got.group(2) == "rise"), s
                    assert q.answer == str(abs(d)), s
                got = re.search(r"which sector had the largest share of \w+ in (\d{4})\?", q.stem)
                if got:
                    row = shares[(y1, y2).index(int(got.group(1)))]
                    assert sorted(row)[-1] > sorted(row)[-2], s
                    assert picked(q) == SECTORS[row.index(max(row))].capitalize(), s
                if "rose the most" in q.stem:
                    d = [b - a for a, b in zip(*shares)]
                    assert sorted(d)[-1] > sorted(d)[-2] and max(d) > 0, s
                    assert picked(q) == SECTORS[d.index(max(d))].capitalize(), s
        for q in qs:
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
    assert all(kinds[k] > 100 for k in (("LS", "chain"), ("UP", "chain"), ("LS", "chart"), ("UP", "chart"))), kinds


def test_sectors_chain_prints_its_stages_and_shares():
    m = fam("sectors_chain")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        if p["kind"] == "chain":
            for t, _ in p["stages"]:
                assert t.replace("\n", " ") in words.replace("\n", " "), (s, t)
        else:
            for y in p["years"]:
                assert str(y) in words
            if p["chart"] == "pies":
                for row in p["shares"]:
                    for v in row:
                        assert f"{v}%" in words, (s, v)


def test_sectors_chart_bars_end_on_gridlines():
    m = fam("sectors_chain")
    for s in range(1, 200):
        p = m.sample(random.Random(s))
        if p["kind"] != "chart" or p["chart"] != "bars":
            continue
        fig = m.draw(p)
        ax = fig.axes[0]
        ticks = {round(float(v), 6) for v in list(ax.get_yticks()) + list(ax.get_yticks(minor=True))}
        plt.close(fig)
        for row in p["shares"]:
            for v in row:
                assert round(float(v), 6) in ticks, (s, v)


# --- stakeholder grid -------------------------------------------------------------------------------

def strategy(interest, power):
    if power > 5:
        return "Manage closely" if interest > 5 else "Keep satisfied"
    return "Keep informed" if interest > 5 else "Monitor"


VERB_OF = {"manage closely": "Manage closely", "keep satisfied": "Keep satisfied", "keep informed": "Keep informed",
           "monitor": "Monitor"}
COUNT_OF = {"managed closely": "Manage closely", "kept satisfied": "Keep satisfied", "kept informed": "Keep informed",
            "monitored": "Monitor"}


def test_stakeholder_grid():
    m = fam("stakeholder_grid")
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "AL"
        pts = p["points"]
        spots = [(x, y) for _, _, x, y in pts]
        assert len(set(spots)) == len(spots), s
        for _, _, x, y in pts:
            assert abs(x - 5) >= 2 and abs(y - 5) >= 2 and 0 < x < 10 and 0 < y < 10, (s, x, y)
        strat = {n: strategy(x, y) for _, n, x, y in pts}
        power = sorted((y for *_, y in pts), reverse=True)
        assert power[0] > power[1], s
        seen = set()
        for q in qs:
            got = re.search(r"Which of these stakeholders should .+ (manage closely|keep satisfied|keep informed|monitor)\?", q.stem)
            if got:
                want = VERB_OF[got.group(1)]
                assert strat[picked(q)] == want, s
                assert sum(strat[o] == want for o in q.options) == 1, (s, q.options)
                seen.add("which")
            if "has the most power" in q.stem:
                assert picked(q) == max(pts, key=lambda r: r[3])[1], s
                seen.add("power")
            got = re.search(r"Which strategy does the grid give for .+ \(point ([A-H])\)\?", q.stem)
            if got:
                row = next(r for r in pts if r[0] == got.group(1))
                assert picked(q) == strategy(row[2], row[3]), s
                assert sorted(q.options) == sorted(VERB_OF.values())
                seen.add("strategy")
            got = re.search(r"How many stakeholders .+ should be (managed closely|kept satisfied|kept informed|monitored)\?", q.stem)
            if got:
                assert q.answer == str(sum(v == COUNT_OF[got.group(1)] for v in strat.values())), s
                seen.add("count")
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
        assert {"which", "power"} <= seen and ({"strategy", "count"} & seen), (s, seen)


def test_stakeholder_grid_prints_the_strategies_and_the_key():
    m = fam("stakeholder_grid")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        for v in VERB_OF.values():
            assert v in words, (s, v)
        for letter, name, _, _ in p["points"]:
            assert name in words and letter in words, (s, name)


# --- business model canvas --------------------------------------------------------------------------

BLOCKS = ["Key Partners", "Key Activities", "Key Resources", "Value Propositions", "Customer Relationships", "Channels",
          "Customer Segments", "Cost Structure", "Revenue Streams"]


def test_business_model_canvas():
    m = fam("business_model_canvas")
    bank = m.NOTES
    owner = defaultdict(set)  # a note in two blocks would have two keys
    for biz in bank.values():
        for block, notes in biz["blocks"].items():
            assert block in BLOCKS[:7]
            for n in notes:
                owner[n].add(block)
    assert all(len(v) == 1 for v in owner.values()), [k for k, v in owner.items() if len(v) > 1]
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        placed = defaultdict(list)
        for block, text in p["notes"]:
            placed[block].append(text)
        assert all(placed[b] for b in BLOCKS[:7]), s  # no block left empty: an empty block would give the answer
        outside = {letter: (block, text) for letter, block, text in p["outside"]}
        for letter, (block, text) in outside.items():
            assert owner[text] == {block}, (s, text)
            assert text not in placed[block], s
        rev = {n: a for n, a in p["revenue"]}
        cost = sum(a for _, a in p["costs"])
        assert sorted(rev.values())[-1] > sorted(rev.values())[-2], s
        assert sum(rev.values()) > cost, s
        seen = set()
        for q in qs:
            got = re.search(r"should note ([PQ]) (?:go|be written in)\?", q.stem)
            if got:
                assert picked(q) == outside[got.group(1)][0], s
                assert set(q.options) <= set(BLOCKS[:7])
                seen.add("block")
            if "brings in the most money" in q.stem:
                assert picked(q) == max(rev, key=rev.get), s
                assert set(q.options) <= set(rev)
                seen.add("revenue")
            if "monthly profit" in q.stem.lower():
                assert q.answer == str(sum(rev.values()) - cost), s
                assert "total revenue − total costs" in q.stem
                seen.add("profit")
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
        assert seen == {"block", "revenue", "profit"}, (s, seen)


def test_business_model_canvas_prints_its_blocks_notes_and_amounts():
    m = fam("business_model_canvas")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = words_of(m, p).replace("\n", " ")
        for b in BLOCKS:
            assert b in words, (s, b)
        for _, text in p["notes"]:
            assert text in words, (s, text)
        for letter, _, text in p["outside"]:
            assert f"{letter}" in words and text in words, (s, text)
        for n, a in p["revenue"] + p["costs"]:
            assert n in words and fr(a) in words, (s, n)


# --- quality control --------------------------------------------------------------------------------

def test_quality_control():
    m = fam("quality_control")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        kinds[(p["band"], p["kind"])] += 1
        if p["kind"] == "chart":
            t, lim, step, vals = p["target"], p["limit"], p["step"], p["values"]
            hi, lo = t + lim, t - lim
            assert all(v % step == 0 and v not in (hi, lo) for v in vals), (s, vals)
            out = [i + 1 for i, v in enumerate(vals) if v > hi or v < lo]
            assert 1 <= len(out) <= 3, s
            for q in qs:
                if "outside the control limits?" in q.stem and "How many" in q.stem:
                    assert q.answer == str(len(out)), s
                if "first sample outside" in q.stem:
                    assert q.answer == str(out[0]), s
                got = re.search(r"by how many \w+ was sample (\d+) (above|below) the target\?", q.stem)
                if got:
                    v = vals[int(got.group(1)) - 1]
                    assert (v > t) == (got.group(2) == "above") and v != t, s
                    assert q.answer == str(abs(v - t)), s
        elif p["kind"] == "batch":
            rate = {lab: sum(d) * 100 / n for lab, n, d in p["rows"]}
            assert all(r == int(r) for r in rate.values()), s
            totals = [sum(r[2][i] for r in p["rows"]) for i in range(len(p["types"]))]
            assert sorted(totals)[-1] > sorted(totals)[-2], s
            best = max(rate, key=rate.get)
            assert sorted(rate.values())[-1] > sorted(rate.values())[-2], s
            most = max(p["rows"], key=lambda r: sum(r[2]))[0]
            assert most != best, s  # the batch with the most defects is not the one with the highest rate
            for q in qs:
                got = re.search(r"What was the defect rate of (.+), in %\?", q.stem)
                if got:
                    assert q.answer == str(int(rate[got.group(1)])), s
                if "most common" in q.stem:
                    assert picked(q) == p["types"][totals.index(max(totals))], s
                if "highest defect rate" in q.stem:
                    assert picked(q) == best, s
        else:
            start, std, tol = p["start_mm"], p["standard_mm"], p["tol_mm"]
            lengths = {letter: mm for letter, mm in p["lengths"]}
            assert all(abs(mm - std) != tol for mm in lengths.values()), s  # never on the edge of the allowance
            ok = {letter: abs(mm - std) < tol for letter, mm in lengths.items()}
            for q in qs:
                got = re.search(r"What is the length of item ([A-D]), in cm\?", q.stem)
                if got:
                    mm = lengths[got.group(1)]
                    assert q.answer == (f"{mm // 10}.{mm % 10}" if mm % 10 else str(mm // 10)), s
                    assert f"{mm} mm" in q.accepted
                if "does not meet the standard" in q.stem:
                    bad = [k for k, v in ok.items() if not v]
                    assert len(bad) == 1 and picked(q) == f"Item {bad[0]}", s
                if "only one that meets the standard" in q.stem:
                    good = [k for k, v in ok.items() if v]
                    assert len(good) == 1 and picked(q) == f"Item {good[0]}", s
                got = re.search(r"By how many millimetres is item ([A-D]) (longer|shorter) than the standard", q.stem)
                if got:
                    mm = lengths[got.group(1)]
                    assert (mm > std) == (got.group(2) == "longer") and mm != std, s
                    assert q.answer == str(abs(mm - std)), s
        for q in qs:
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
    for k in ("chart", "batch", "ruler"):
        assert kinds[("LS", k)] > 60 and kinds[("UP", k)] > 60, kinds


def test_quality_control_prints_its_limits_rows_and_standard():
    m = fam("quality_control")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        if p["kind"] == "chart":
            for v in (p["target"], p["target"] + p["limit"], p["target"] - p["limit"]):
                assert f"{v} {p['unit']}" in words, (s, v)
        elif p["kind"] == "batch":
            assert "Defect rate (%) = number of defective items ÷ number of items checked × 100" in words
            for lab, n, d in p["rows"]:
                assert lab in words and str(n) in words
            for t in p["types"]:
                assert t in words
        else:
            assert "Standard length" in words and "Item A" in words


def test_control_chart_labels_stay_off_the_data_line():
    from matplotlib.text import Text

    m = fam("quality_control")
    for s in range(1, 120):
        p = m.sample(random.Random(s))
        if p["kind"] != "chart":
            continue
        fig = m.draw(p)
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        ax = fig.axes[0]
        data = [ln for ln in ax.lines if ln.get_gid() == "samples"]
        assert len(data) == 1
        pts = ax.transData.transform(data[0].get_xydata())
        for t in ax.texts:
            if not isinstance(t, Text) or not t.get_text().strip():
                continue
            box = t.get_window_extent(renderer)
            for a, b in zip(pts, pts[1:]):
                for k in range(41):
                    x, y = a + (b - a) * k / 40
                    assert not (box.x0 < x < box.x1 and box.y0 < y < box.y1), (s, t.get_text())
        plt.close(fig)


# --- office records ---------------------------------------------------------------------------------

NTH = {"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4, "sixth": 5, "last": -1}


def test_office_records():
    m = fam("office_records")
    kinds = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        kinds[p["kind"]] += 1
        if p["kind"] == "letter":
            marks = {part: letter for letter, part in p["marks"]}
            assert len(set(marks.values())) == len(marks), s
            for q in qs:
                got = re.search(r"which label marks the (.+)\?$", q.stem, re.I)
                assert got, q.stem
                assert picked(q) == marks[got.group(1)], (s, q.stem)
                assert set(q.options) <= set(marks.values())
            salute = p["salutation"]
            want = "Yours faithfully" if salute.startswith("Dear Sir") else "Yours sincerely"
            assert p["close"].rstrip(",") == want, s  # the close matches the greeting, as Office Practice teaches it
        elif p["kind"] == "filing":
            cards = p["cards"]
            orders = {
                "alphabetical": [c[0] for c in sorted(cards, key=lambda c: (c[1], c[2]))],
                "numerical": [c[0] for c in sorted(cards, key=lambda c: c[3])],
                "chronological": [c[0] for c in sorted(cards, key=lambda c: tuple(c[4]))],
            }
            assert len({(c[1], c[2]) for c in cards}) == len(cards) and len({c[3] for c in cards}) == len(cards)
            assert len({tuple(c[4]) for c in cards}) == len(cards), s
            # numbers of different lengths, so ordering them as text gives another order
            assert [c[0] for c in sorted(cards, key=lambda c: str(c[3]))] != orders["numerical"], s
            for q in qs:
                got = re.search(r"(alphabetical|numerical|chronological) order.*which card comes (\w+)\?", q.stem, re.I)
                assert got, q.stem
                assert picked(q) == orders[got.group(1).lower()][NTH[got.group(2)]], (s, q.stem)
        else:
            rows = p["rows"]
            stay = {r[0]: r[3] - r[2] for r in rows}
            assert all(r[3] > r[2] for r in rows) and [r[2] for r in rows] == sorted(r[2] for r in rows), s
            assert sorted(stay.values())[-1] > sorted(stay.values())[-2], s
            for q in qs:
                got = re.search(r"For how many minutes was (.+) in the building\?", q.stem)
                if got:
                    assert q.answer == str(stay[got.group(1)]), s
                if "stayed the longest" in q.stem:
                    assert picked(q) == max(stay, key=stay.get), s
                got = re.search(r"in the building at .+ at (\d\d):(\d\d)\?", q.stem)
                if got:
                    t = int(got.group(1)) * 60 + int(got.group(2))
                    assert all(abs(t - r[2]) >= 5 and abs(t - r[3]) >= 5 for r in rows), s
                    assert q.answer == str(sum(1 for r in rows if r[2] < t < r[3])), s
        for q in qs:
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
    assert min(kinds.values()) > 250 and len(kinds) == 3, kinds


def test_office_records_prints_what_is_asked():
    m = fam("office_records")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        if p["kind"] == "letter":
            for x in (p["date"], p["ref"], p["salutation"], p["close"], p["subject"]):
                assert x in words, (s, x)
            for letter, _ in p["marks"]:
                assert letter in words
        elif p["kind"] == "filing":
            for c in p["cards"]:
                assert c[1] in words and c[2] in words and str(c[3]) in words, (s, c)
        else:
            for r in p["rows"]:
                assert r[0] in words and f"{r[2] // 60:02d}:{r[2] % 60:02d}" in words, (s, r)


# --- action plan ------------------------------------------------------------------------------------

def test_action_plan():
    m = fam("action_plan")
    bands = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        bands[p["band"]] += 1
        ends = {lab: st + d - 1 for lab, st, d in p["steps"]}
        span = {lab: (st, st + d - 1) for lab, st, d in p["steps"]}
        last = max(ends.values())
        assert list(ends.values()).count(last) == 1, s
        assert p["deadline"] >= last, s
        for q in qs:
            if "ends last" in q.stem:
                assert picked(q) == max(ends, key=ends.get), s
            got = re.search(r"steps “(.+)” and “(.+)” overlap", q.stem)
            if got:
                (a0, a1), (b0, b1) = span[got.group(1)], span[got.group(2)]
                n = min(a1, b1) - max(a0, b0) + 1
                assert n >= 1 and q.answer == str(n), s
            if "finish the last step" in q.stem:
                assert q.answer == str(last), s
            got = re.search(r"under way in week (\d+)\?", q.stem)
            if got:
                w = int(got.group(1))
                assert q.answer == str(sum(1 for a, b in span.values() if a <= w <= b)), s
            if q.kind == "mcq":
                wrong_options_are_wrong(q)
    assert bands["LS"] > 300 and bands["UP"] > 300, bands


def test_action_plan_prints_its_steps_and_the_rule():
    m = fam("action_plan")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        words = words_of(m, p)
        assert "SMART goal" in words and "runs in weeks" in words
        for lab, st, d in p["steps"]:
            assert lab in words, (s, lab)


# --- all seven --------------------------------------------------------------------------------------

@pytest.mark.parametrize("fid", WAVE)
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


@pytest.mark.parametrize("fid", WAVE)
def test_most_figures_have_a_wording_of_their_own(fid):
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", WAVE)
def test_a_figure_belongs_to_the_person_in_the_first_question(fid):
    m = fam(fid)
    for seed in range(1, 120):
        rng = random.Random(seed)
        qs = m.questions(m.sample(rng), rng)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, qs[0].stem
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)


@pytest.mark.parametrize("fid", WAVE)
def test_declares_its_concepts_and_links(fid):
    m = fam(fid)
    assert m.SUBJECT == "business" and m.CONCEPTS and all(c.startswith("business.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """Each family's NEEDS and AVOID read against the topics' names and sections (P4 reach check)."""
    cases = {  # fid: (names AVOID must turn away, names or sections NEEDS must match and AVOID must not)
        "forms_of_business": (["Bookkeeping basics", "Taxes in Rwanda"],
                              ["Forms of business", "Forms of Enterprises", "Business units", "Business organisation",
                               "Chapter 2: Business structure", "Types of business organisation",
                               "Legal forms of business ownership"]),
        "sectors_chain": (["Forms of business", "Effects of Business Activities on the Environment"],
                          ["Sectors of Production", "Topic area 2: Business activities", "Classification of businesses"]),
        "stakeholder_grid": (["Chapter 15: Business communication", "Chapter 17: Market research",
                              "Chapter 8: External influences on business activity (excluding economic)"],
                             ["Chapter 5: Stakeholders in a business"]),
        "business_model_canvas": (["Business organisation", "E-commerce", "Market research"],
                                  ["Business Plan Using Business Model Canvas", "Business Plan Pitch",
                                   "Developing a Business Plan"]),
        "quality_control": (["Consumer education", "Consumer protection"],
                            ["Concepts of metrology and quality testing", "Quality Management and Certification",
                             "Unit 6: Role Of Standards in Business", "Chapter 26: Lean production and quality management",
                             "Quality Assurance and Quality Compliance in Business"]),
        "office_records": (["Office equipment"],
                           ["Communication and correspondence", "Records management", "Reception duties",
                            "Office organisation", "Office Procedures"]),
        "action_plan": (["Forms of business", "Bookkeeping basics"],
                        ["Setting personal goals", "Unit 4: Setting Personal Goals", "Creating a timeline"]),
    }
    for fid, (misfits, fits) in cases.items():
        m = fam(fid)
        for name in misfits:
            assert re.search(m.AVOID, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not re.search(m.AVOID, name, re.I), (fid, name)
    # The AS chapter on the nature of operations teaches no control chart.
    assert not re.search(fam("quality_control").NEEDS, "Chapter 22: The nature of operations", re.I)


def test_office_records_send_each_record_to_its_own_topics():
    m = fam("office_records")
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        avoid = m.avoid_for(p)
        if p["kind"] == "letter":
            assert re.search(avoid, "Reception duties", re.I) and not re.search(avoid, "Communication and correspondence", re.I)
        if p["kind"] == "filing":
            assert re.search(avoid, "Reception duties", re.I) and not re.search(avoid, "Records management", re.I)
        if p["kind"] == "visitors":
            assert re.search(avoid, "Records management", re.I) and not re.search(avoid, "Reception duties", re.I)
        assert not re.search(avoid, "Office organisation", re.I) and re.search(avoid, "Office equipment", re.I)
