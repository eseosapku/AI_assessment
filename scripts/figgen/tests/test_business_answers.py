"""Answers of the Business families (P3p, Task 4), recomputed from each figure's params over 1,000 seeds.

Nothing here calls a family's own helpers to work out a key: the forecast is added up from its lines, the
network's critical path is found by listing every path through it, the stock chart is read off the line it
draws, and the price is worked out from the unit costs.
"""
import random
import re
from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
BUSINESS = ("cash_flow_forecast", "critical_path", "inventory_chart", "pricing")


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


def texts_of(fig):
    return [t for ax in fig.axes for t in ax.texts]


def amount(text: str) -> int:
    """A printed amount as a number: "12 500", "(12 500)" and "−12 500" (a true minus or a hyphen)."""
    t = text.strip()
    neg = t.startswith("(") and t.endswith(")") or t[:1] in "-−"
    digits = re.sub(r"[^\d]", "", t)
    return -int(digits) if neg else int(digits)


def stem_money(stem: str) -> list[int]:
    return [int(x.replace(" ", "")) for x in re.findall(r"(\d{1,3}(?: \d{3})*|\d+) Frw", stem)]


def accepts_money(q, n: int) -> None:
    """The key is the bare number; the forms a student writes are accepted, a negative in brackets too."""
    assert q.answer == str(n), (q.stem, q.answer, n)
    forms = set(q.accepted)
    assert str(n) in forms
    if abs(n) >= 1000:
        spaced = f"{abs(n):,}".replace(",", " ")
        assert (f"-{spaced}" if n < 0 else spaced) in forms, (n, q.accepted)
    if n < 0:
        assert f"({abs(n)})" in forms and f"−{abs(n)}" in forms, (n, q.accepted)


# --- cash flow forecast ---------------------------------------------------------------------------

def forecast(p):
    """Every row of the forecast, worked out from its lines and the first month's opening balance."""
    rec = [sum(line[1][m] for line in p["receipts"]) for m in range(4)]
    pay = [sum(line[1][m] for line in p["payments"]) for m in range(4)]
    net = [r - q for r, q in zip(rec, pay)]
    opening, closing = [], []
    bal = p["opening"]
    for m in range(4):
        opening.append(bal)
        bal += net[m]
        closing.append(bal)
    return {"total_receipts": rec, "total_payments": pay, "net": net, "opening": opening, "closing": closing}


def solvable(p, rows):
    """Whether every blank can be worked out from the cells shown, by the rules a student uses."""
    known = {(r, m) for r in rows for m in range(4)} - {tuple(b) for b in p["blanks"]}
    changed = True
    while changed:
        changed = False
        for m in range(4):
            rules = [  # (cell, cells it comes from)
                (("total_receipts", m), []), (("total_payments", m), []),  # the lines are always printed
                (("net", m), [("total_receipts", m), ("total_payments", m)]),
                (("net", m), [("closing", m), ("opening", m)]),
                (("closing", m), [("opening", m), ("net", m)]),
                (("opening", m), [("closing", m), ("net", m)]),
            ]
            if m < 3:
                rules.append((("closing", m), [("opening", m + 1)]))
            if m > 0:
                rules.append((("opening", m), [("closing", m - 1)]))
            for cell, need in rules:
                if cell not in known and all(n in known for n in need):
                    known.add(cell)
                    changed = True
    return all((r, m) in known for r in rows for m in range(4))


def test_cash_flow_forecast():
    m = fam("cash_flow_forecast")
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        f = forecast(p)
        assert 2 <= len(p["receipts"]) <= 3 and 2 <= len(p["payments"]) <= 4
        assert p["months"] == [MONTHS[(p["start"] + k) % 12] for k in range(4)]
        assert all(v >= 0 and v % 1000 == 0 for line in p["receipts"] + p["payments"] for v in line[1])
        assert 0 not in f["closing"] and 0 not in f["net"], s
        negative = [k for k in range(4) if f["closing"][k] < 0]
        assert negative, (s, f["closing"])
        first = negative[0]
        assert first >= 1, s  # the opening balance matters: the first month is not already overdrawn
        # a student who reads the net cash flow for the balance picks an earlier month
        assert min(k for k in range(4) if f["net"][k] < 0) < first, s
        assert solvable(p, f.keys()), (s, p["blanks"])
        blanks = {tuple(b) for b in p["blanks"]}
        assert not any(r == "opening" and k == 0 for r, k in blanks), s
        seen = set()
        for q in qs:
            got = re.search(r"net cash flow for (\w+)", q.stem)
            if got:
                k = p["months"].index(got.group(1))
                assert ("net", k) in blanks, s  # worked out, not read off
                accepts_money(q, f["net"][k])
                seen.add("net")
            got = re.search(r"closing balance for (\w+)", q.stem)
            if got:
                k = p["months"].index(got.group(1))
                assert ("closing", k) in blanks and (k == 3 or ("opening", k + 1) in blanks), s
                accepts_money(q, f["closing"][k])
                seen.add("closing")
            if q.kind == "mcq":
                assert "first" in q.stem and ("negative" in q.stem or "below zero" in q.stem)
                assert picked(q) == p["months"][first]
                assert sorted(q.options, key=p["months"].index) == p["months"]
                seen.add("first")
        assert seen == {"net", "closing", "first"}, (s, seen)
        assert re.match(rf"({'|'.join(NAMES)}) ", qs[0].stem), qs[0].stem


def test_cash_flow_forecast_prints_its_cells_and_its_sign_convention():
    m = fam("cash_flow_forecast")
    styles = set()
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        f = forecast(p)
        fig = m.draw(p)
        texts = texts_of(fig)
        plt.close(fig)
        words = " ".join(t.get_text() for t in texts)
        styles.add(p["negative"])
        if p["negative"] == "brackets":
            assert "brackets" in words and "negative" in words, s
        else:
            assert "minus sign" in words and "negative" in words, s
        blanks = {tuple(b) for b in p["blanks"]}
        cells = {t.get_gid(): t.get_text() for t in texts if (t.get_gid() or "").startswith("cell:")}
        for row in f:
            for k in range(4):
                shown = cells[f"cell:{row}:{k}"]
                if (row, k) in blanks:
                    assert shown == "?", (s, row, k, shown)
                else:
                    assert amount(shown) == f[row][k], (s, row, k, shown)
                    if f[row][k] < 0:
                        assert shown.startswith("(" if p["negative"] == "brackets" else "−"), (s, shown)
        for i, line in enumerate(p["receipts"]):
            assert [amount(cells[f"cell:receipt{i}:{k}"]) for k in range(4)] == line[1]
        for i, line in enumerate(p["payments"]):
            assert [amount(cells[f"cell:payment{i}:{k}"]) for k in range(4)] == line[1]
    assert styles == {"brackets", "minus"}


# --- critical path ---------------------------------------------------------------------------------

def every_path(acts, start, end):
    """Every path of activities from the start node to the end node, by brute force."""
    out = defaultdict(list)
    for a in acts:
        out[a[1]].append(a)
    paths = []

    def walk(node, sofar):
        if node == end:
            paths.append(sofar)
            return
        for a in out[node]:
            walk(a[2], sofar + [a])

    walk(start, [])
    return paths


def test_critical_path():
    m = fam("critical_path")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] in ("UP", "AL")
        acts = p["acts"]
        assert 6 <= len(acts) <= 8
        nodes = sorted(n[0] for n in p["nodes"])
        assert nodes == list(range(1, len(nodes) + 1))
        start, end = 1, len(nodes)
        assert all(a[1] < a[2] for a in acts), s  # numbered so every arrow runs to a higher number
        assert len({(a[1], a[2]) for a in acts}) == len(acts), s  # no two activities share both nodes (no dummies)
        assert [a[0] for a in acts] == [chr(65 + i) for i in range(len(acts))]
        paths = every_path(acts, start, end)
        assert {a[0] for path in paths for a in path} == {a[0] for a in acts}, s  # every activity is on a path
        lengths = sorted((sum(a[3] for a in path) for path in paths), reverse=True)
        assert lengths[0] - lengths[1] >= 2, (s, lengths)  # one longest path, no near-tie
        longest = max(paths, key=lambda path: sum(a[3] for a in path))
        total = lengths[0]
        critical = ", ".join(a[0] for a in longest)
        modes[p["mode"]] += 1
        seen = set()
        for q in qs:
            if "shortest time" in q.stem:
                assert q.answer == str(total) and f"{total} days" in q.accepted
                seen.add("time")
            if q.kind == "mcq":
                assert "critical path" in q.stem
                assert picked(q) == critical, (s, picked(q), critical)
                for o in q.options:
                    if o != critical:
                        assert set(o.split(", ")) != set(critical.split(", "))
                seen.add("critical")
            got = re.search(r"total float of activity ([A-H])\b", q.stem)
            if got:
                x = got.group(1)
                through = max(sum(a[3] for a in path) for path in paths if any(a[0] == x for a in path))
                assert int(q.answer) == total - through > 0, s
                assert "LFT" in q.stem and "EST" in q.stem and "duration" in q.stem  # the formula is stated
                seen.add("float")
        assert seen == {"time", "critical", "float"}, (s, seen)
    assert modes["blank"] > 200 and modes["filled"] > 200


def test_critical_path_filled_nodes_print_their_times():
    m = fam("critical_path")
    for s in range(1, 81):
        p = m.sample(random.Random(s))
        acts, n = p["acts"], len(p["nodes"])
        paths = every_path(acts, 1, n)
        total = max(sum(a[3] for a in path) for path in paths)
        fig = m.draw(p)
        texts = {t.get_gid(): t.get_text() for t in texts_of(fig) if t.get_gid()}
        plt.close(fig)
        for node in range(1, n + 1):
            assert texts[f"node-{node}"] == str(node)
            # the earliest start: the longest way in; the latest finish: the project's time less the longest way out
            into = [sum(a[3] for a in path[:i]) for path in paths for i in range(len(path) + 1)
                    if (path[i - 1][2] if i else 1) == node]
            out = [sum(a[3] for a in path[i:]) for path in paths for i in range(len(path) + 1)
                   if (path[i - 1][2] if i else 1) == node]
            if p["mode"] == "filled":
                assert texts[f"est-{node}"] == str(max(into)), (s, node)
                assert texts[f"lft-{node}"] == str(total - max(out)), (s, node)
            else:
                assert f"est-{node}" not in texts and f"lft-{node}" not in texts
        for a in acts:
            assert texts[f"act-{a[0]}"].split() == [a[0], str(a[3])], (s, a)


# --- inventory chart -------------------------------------------------------------------------------

def test_inventory_chart():
    m = fam("inventory_chart")
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        step, use = p["step"], p["use"]
        mx, buf, reorder = p["max"], p["buffer"], p["reorder"]
        assert 0 < buf < reorder < mx, s
        assert mx % step == 0 and buf % step == 0 and reorder % step == 0, s  # every level asked on a gridline
        cycle = (mx - buf) / use
        lead = (reorder - buf) / use
        assert cycle.is_integer() and lead.is_integer() and 1 <= lead < cycle, s
        seen = set()
        for q in qs:
            st = q.stem
            if "maximum stock" in st:
                key, what = mx, "max"
            elif "reorder quantity" in st:
                key, what = mx - buf, "quantity"
            elif "lead time" in st:
                key, what = int(lead), "lead"
                assert "reorder level" in st  # when an order is placed is stated
            elif "buffer stock" in st:
                key, what = buf, "buffer"
            else:
                continue
            assert q.answer == str(key), (s, st, q.answer, key)
            seen.add(what)
        assert seen == {"max", "quantity", "lead", "buffer"}, (s, seen)


def test_inventory_chart_is_read_off_its_line():
    """The keys again, read off the stock line as drawn: its peaks, its jumps, its troughs, and the weeks from the
    reorder level to the next delivery, every one on a gridline."""
    m = fam("inventory_chart")
    for s in range(1, 151):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        ax = fig.axes[0]
        lines = {ln.get_gid(): ln for ln in ax.lines if ln.get_gid()}
        x, y = (list(map(float, v)) for v in (lines["stock"].get_xdata(), lines["stock"].get_ydata()))
        yticks = [float(t) for t in ax.get_yticks()]
        xticks = [float(t) for t in ax.get_xticks()]
        reorder = float(lines["reorder"].get_ydata()[0])
        buffer = float(lines["buffer"].get_ydata()[0])
        words = " ".join(t.get_text() for t in texts_of(fig))
        plt.close(fig)
        assert "Reorder level" in words and "Buffer stock" in words
        jumps = [(x[i], y[i], y[i + 1]) for i in range(len(x) - 1) if x[i] == x[i + 1]]
        assert len(jumps) >= 2, s
        assert all(lo == buffer for _, lo, _ in jumps) and len({hi for _, _, hi in jumps}) == 1, s
        peak = jumps[0][2]
        assert max(y) == peak == p["max"] and buffer == p["buffer"] and reorder == p["reorder"]
        for v in (peak, buffer, reorder):
            assert v in yticks, (s, v)
        for t, _, _ in jumps:
            assert t.is_integer() and t in xticks, s
            # the falling segment that ends at this delivery: where it crosses the reorder level
            i = next(i for i in range(len(x) - 1) if x[i + 1] == t and y[i + 1] == buffer and x[i] < t)
            if y[i] >= reorder:
                at = x[i] + (y[i] - reorder) / (y[i] - y[i + 1]) * (x[i + 1] - x[i])
                assert at.is_integer() and t - at == (p["reorder"] - p["buffer"]) / p["use"], s
        assert all(float(w).is_integer() for w in xticks)


# --- pricing ---------------------------------------------------------------------------------------

def test_pricing():
    m = fam("pricing")
    modes = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        assert p["band"] == "UP"
        cost = sum(c[1] for c in p["costs"])
        assert [c[0] for c in p["costs"]] == ["Materials", "Labour", "Overheads"]
        pct = p["pct"]
        if p["mode"] == "markup":
            price = cost * (100 + pct) / 100
        else:
            price = cost * 100 / (100 - pct)
        assert price.is_integer(), s  # whole francs
        price = int(price)
        modes[p["mode"]] += 1
        seen = set()
        order = []
        for q in qs:
            if "profit per" in q.stem:
                accepts_money(q, price - cost)
                # its own basis named: "that price" after the rival's price was read as the rival's (P3p review)
                assert "that price" not in q.stem and f"{pct}%" in q.stem, (s, q.stem)
                seen.add("profit")
                order.append("profit")
            elif "mark-up %" in q.stem and "÷" in q.stem:
                order.append("markup")
                (rival,) = stem_money(q.stem)
                up = (rival - cost) * 100 / cost
                assert up.is_integer() and up > 0 and up != pct, s
                assert q.answer == str(int(up)) and f"{int(up)}%" in q.accepted, (s, q.answer, up)
                seen.add("markup")
            else:
                assert "price" in q.stem
                if p["mode"] == "margin":
                    assert "÷ selling price" in q.stem  # a margin is on the price, and the stem says so
                accepts_money(q, price)
                seen.add("price")
        assert seen == {"price", "markup", "profit"}, (s, seen)
        assert order == ["profit", "markup"], (s, order)  # the profit is asked before another price comes in
    assert modes["markup"] > 300 and modes["margin"] > 300


def test_pricing_prints_its_costs():
    m = fam("pricing")
    for s in range(1, 61):
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        words = [t.get_text() for t in texts_of(fig)]
        plt.close(fig)
        for name, v in p["costs"]:
            assert name in words and f"{v:,}".replace(",", " ") in words, (s, name, v)
        assert f"{p['pct']}%" in " ".join(words)


# --- all four --------------------------------------------------------------------------------------

def _central(options):
    toks = [Counter(re.findall(r"-?\d+|[a-zA-Z]+|\S", o)) for o in options]
    score = [sum(sum(((t - u) + (u - t)).values()) for u in toks) for t in toks]
    best = min(score)
    return score.index(best) if score.count(best) == 1 else None


@pytest.mark.parametrize("fid", BUSINESS)
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


@pytest.mark.parametrize("fid", BUSINESS)
def test_most_figures_have_a_wording_of_their_own(fid):
    """As the shared test asks of a worded subject: of 30 figures, 27 carry a stem no other has."""
    m = fam(fid)
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", BUSINESS)
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
