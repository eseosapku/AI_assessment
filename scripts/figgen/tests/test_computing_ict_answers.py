"""Answers of the ICT applications families (P3v ict), recomputed independently from each figure's params over 1,000
seeds: the merge run on the data source, the Gantt chart rescheduled from its dependencies, the file sizes worked from
the spec cards, the rules forward-chained, and the HTML parsed with Python's html.parser."""
import random
import re
from fractions import Fraction
from html.parser import HTMLParser
from urllib.parse import urlsplit

import matplotlib.pyplot as plt
import pytest

from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 41)  # figures drawn to check that every value asked is shown


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


def texts(m, p):
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def flat(s: str) -> str:
    """Text with its spaces and thousands separators taken out, to find a number however it is printed."""
    return re.sub(r"[\s, ]", "", s)


# --- mail merge -----------------------------------------------------------------------------------

def keep(v, op, x):
    return {">": lambda: v > x, "<": lambda: v < x, "=": lambda: v == x}[op]()


def merge(records, flt, srt):
    rows = [r for r in records if flt is None or keep(r[flt[0]], flt[1], flt[2])]
    if srt:
        rows = sorted(rows, key=lambda r: r[srt[0]], reverse=srt[1] == "descending")
    return rows


def test_mail_merge():
    m = fam("mail_merge")
    for s in SEEDS:
        p, qs = run(m, s)
        recs, fields = p["records"], p["fields"]
        assert 4 <= len(recs) <= 6 and all(list(r) == fields for r in recs)
        letters = merge(recs, p["filter"], p["sort"])
        assert letters, s
        if p["sort"]:
            assert len({r[p["sort"][0]] for r in recs}) == len(recs), s  # no ties: the order is fixed
        if p["filter"]:
            assert 2 <= len(letters) < len(recs), s  # the filter drops some records, and keeps more than one
        asked = set()
        for q in qs:
            if "How many letters" in q.stem:
                asked.add("count")
                got = re.search(r"records where (\w+) ([<>=]) (.+?) are merged", q.stem)
                if got:
                    assert p["filter"] is None, s  # a filter in the stem only where the figure shows none
                    f, op, v = got.groups()
                    v = int(v) if isinstance(recs[0][f], int) else v
                    n = len([r for r in recs if keep(r[f], op, v)])
                    assert 1 <= n < len(recs), s
                else:
                    assert p["filter"], s
                    n = len(letters)
                assert int(q.answer) == n, (s, q.stem)
            got = re.search(r"In letter (\d+) of the merge.* what replaces «(\w+)»", q.stem)
            if got:
                asked.add("letter")
                k, f = int(got.group(1)), got.group(2)
                assert f in fields and k <= len(letters)
                assert q.answer == str(letters[k - 1][f]), (s, q.stem, q.answer)
                if p["filter"] or p["sort"]:  # the settings matter: the table's own row k says something else
                    assert str(recs[k - 1][f]) != q.answer, (s, q.stem)
            got = re.search(r"holds the value (.+?)\?", q.stem)
            if got:
                asked.add("field")
                v = got.group(1)
                cols = [f for f in fields if any(str(r[f]) == v for r in recs)]
                assert cols == [q.answer], (s, v, cols)
                assert f"«{q.answer}»" in q.accepted
            if "first" in q.stem and q.kind == "mcq":
                asked.add("first")
                assert p["sort"], s
                first = letters[0]
                assert picked(q) == f"{first['FirstName']} {first['LastName']}", (s, q.options)
                assert all(o != picked(q) for i, o in enumerate(q.options) if i != int(q.answer))
        assert {"count", "letter", "field"} <= asked, (s, asked)
        assert ("first" in asked) == bool(p["sort"]), s


def test_mail_merge_shows_what_it_asks():
    m = fam("mail_merge")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = texts(m, p)
        joined = flat(" ".join(shown))
        for r in p["records"]:
            for v in r.values():
                assert flat(str(v)) in joined, (s, v)
        for f in p["fields"]:
            assert f in shown, (s, f)  # each column heading
        for q in qs:
            got = re.search(r"what replaces «(\w+)»", q.stem)
            if got:
                assert f"«{got.group(1)}»" in " ".join(shown), (s, got.group(1))  # the field is in the template
        if p["filter"]:
            assert any(p["filter"][0] in t and str(p["filter"][2]) in t for t in shown), s
        if p["sort"]:
            assert any(p["sort"][0] in t and p["sort"][1] in t for t in shown), s


# --- Gantt chart ----------------------------------------------------------------------------------

def schedule(tasks, longer=None):
    """Each task starts the week after the last of the tasks it depends on ends; with none, in week 1."""
    start, end = {}, {}
    for letter, _, _, dur, after in tasks:
        assert all(a in end for a in after)  # listed after what it depends on
        d = dur + (longer or {}).get(letter, 0)
        start[letter] = max((end[a] for a in after), default=0) + 1
        end[letter] = start[letter] + d - 1
    return start, end


def test_gantt_chart():
    m = fam("gantt_chart")
    for s in SEEDS:
        p, qs = run(m, s)
        tasks = p["tasks"]
        start, end = schedule(tasks)
        assert all(t[2] == start[t[0]] for t in tasks), s  # the bars are drawn where the dependencies put them
        length = max(end.values())
        asked = set()
        for q in qs:
            got = re.search(r"In which week does task ([A-H]) (start|end)\?", q.stem)
            if got:
                asked.add("week")
                x = got.group(1)
                assert int(q.answer) == (start[x] if got.group(2) == "start" else end[x]), (s, q.stem)
            got = re.search(r"At the end of which week is the milestone '(.+?)' reached\?", q.stem)
            if got:
                asked.add("week")
                assert got.group(1) == p["milestone"][0]
                assert int(q.answer) == end[p["milestone"][1]], s
            if re.search(r"shortest|at the earliest", q.stem) and "longer" not in q.stem:
                asked.add("length")
                assert int(q.answer) == length, s
            got = re.search(r"In week (\d+), which task runs in parallel with task ([A-H])\?", q.stem)
            if got:
                asked.add("parallel")
                w, x = int(got.group(1)), got.group(2)
                busy = sorted(t for t in start if start[t] <= w <= end[t])
                assert len(busy) == 2 and x in busy, (s, w, busy)
                other = next(t for t in busy if t != x)
                assert q.answer == other and f"task {other}" in q.accepted
            got = re.search(r"If task ([A-H]) takes (\d) weeks longer than planned", q.stem)
            if got:
                asked.add("delay")
                x, extra = got.group(1), int(got.group(2))
                assert "as soon as" in q.stem  # the scheduling rule is stated
                _, later = schedule(tasks, {x: extra})
                assert int(q.answer) == max(later.values()), (s, q.stem)
        assert asked == {"week", "length", "parallel", "delay"}, (s, asked)


def test_gantt_chart_draws_each_task_on_its_weeks():
    from matplotlib.patches import Rectangle
    m = fam("gantt_chart")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        start, end = schedule(p["tasks"])
        fig = m.draw(p)
        bars = {r.get_gid()[4:]: r for r in fig.axes[0].patches if isinstance(r, Rectangle) and (r.get_gid() or "").startswith("bar-")}
        shown = [t.get_text() for t in fig.axes[0].texts]
        plt.close(fig)
        assert sorted(bars) == sorted(t[0] for t in p["tasks"]), s
        for x, r in bars.items():
            assert abs(r.get_x() - (start[x] - 1)) < 1e-9 and abs(r.get_x() + r.get_width() - end[x]) < 1e-9, (s, x)
        for w in range(1, max(end.values()) + 1):
            assert str(w) in shown, (s, w)  # every week is numbered
        assert any(p["milestone"][0] in t for t in shown), s


# --- file sizes and transfer times ----------------------------------------------------------------

FACTOR = {"KiB": 1024, "MiB": 1024 ** 2, "kB": 1000, "MB": 1000 ** 2}


def size_bits(f):
    if f["kind"] == "image":
        return f["width"] * f["height"] * f["depth"]
    if f["kind"] == "sound":
        return f["rate"] * f["bits"] * f["seconds"] * f["channels"]
    return f["chars"] * f["bytes_per_char"] * 8


def test_file_transfer():
    m = fam("file_transfer")
    for s in SEEDS:
        p, qs = run(m, s)
        files = {f["name"]: f for f in p["files"]}
        assert len(files) == len(p["files"]) == 3
        assert any(f["kind"] == "image" for f in files.values())
        bits = {n: size_bits(f) for n, f in files.items()}
        asked = set()
        for q in qs:
            got = re.search(r"size of (\S+) in (KiB|MiB|kB|MB)\b", q.stem)
            if got:
                asked.add("size")
                name, unit = got.groups()
                assert (unit in ("KiB", "MiB")) == (p["convention"] == "binary"), s
                assert bits[name] % 8 == 0
                v = Fraction(bits[name] // 8, FACTOR[unit])
                assert (v * 10).denominator == 1 and v >= 1, (s, name, v)  # exact, to one decimal place at most
                assert Fraction(q.answer) == v, (s, q.answer, v)
            got = re.search(r"(?:send|upload|download|email) (\S+) over the (\d+) Mbps", q.stem)
            if got:
                asked.add("time")
                name, speed = got.group(1), int(got.group(2))
                assert speed == p["speed"]
                t = Fraction(bits[name], speed * 1_000_000)
                assert (t * 10).denominator == 1 and t > 0, (s, t)
                assert Fraction(q.answer) == t, (s, q.answer, t)
            if q.kind == "mcq" and "largest" in q.stem:
                asked.add("largest")
                big = sorted(bits.values(), reverse=True)
                assert big[0] >= Fraction(5, 4) * big[1], s  # no near-tie
                assert bits[picked(q)] == big[0]
                assert sorted(q.options) == sorted(files)
        assert asked == {"size", "time", "largest"}, (s, asked)


def test_file_transfer_shows_what_it_asks():
    m = fam("file_transfer")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = texts(m, p)
        joined = flat(" ".join(shown))
        for f in p["files"]:
            assert f["name"] in joined
            for k in ("width", "height", "depth", "rate", "bits", "seconds", "chars", "bytes_per_char"):
                if k in f:
                    assert flat(str(f[k])) in joined, (s, k, f[k])
        assert f"{p['speed']}Mbps" in joined, s
        assert ("1KiB=1024bytes" in joined) == (p["convention"] == "binary"), s
        assert ("1kB=1000bytes" in joined) == (p["convention"] == "decimal"), s
        assert "1Mbps=1000000bitspersecond" in joined, s


# --- expert systems -------------------------------------------------------------------------------

def forward(rules, facts):
    """Forward chaining: pass over the rules in order, firing each whose IF part is all known and whose THEN part is
    new, until a pass adds nothing."""
    known, fired = set(facts), []
    again = True
    while again:
        again = False
        for i, (ifs, then) in enumerate(rules):
            if all(c in known for c in ifs) and then not in known:
                known.add(then)
                fired.append(i)
                again = True
    return known, fired


def test_expert_system():
    m = fam("expert_system")
    for s in SEEDS:
        p, qs = run(m, s)
        rules, facts = p["rules"], p["facts"]
        heads = {c for ifs, _ in rules for c in ifs}
        diagnoses = [then for _, then in rules if then not in heads]
        derived = {then for _, then in rules}
        assert not set(facts) & derived, s  # only symptoms are entered
        known, fired = forward(rules, facts)
        reached = [d for d in diagnoses if d in known]
        assert len(reached) == 1, (s, reached)
        asked = set()
        for q in qs:
            if q.kind == "mcq" and "which conclusion" in q.stem:
                asked.add("conclusion")
                assert picked(q) == reached[0]
                assert set(q.options) <= set(diagnoses)
            if re.search(r"which rule .*first\?", q.stem, re.I):
                asked.add("first")
                assert q.answer == f"R{fired[0] + 1}", (s, q.answer, fired)
            got = re.search(r"to reach the conclusion '(.+?)'\?", q.stem)
            if got:
                asked.add("missing")
                x = got.group(1)
                assert x in diagnoses and x not in known
                assert x in forward(rules, facts + [picked(q)])[0], s
                for i, o in enumerate(q.options):
                    if i != int(q.answer):
                        assert x not in forward(rules, facts + [o])[0], (s, o)
            got = re.search(r"Which part of an expert system is box ([XY])\?", q.stem)
            if got:
                asked.add("part")
                shows = p["boxes"][got.group(1)]
                assert picked(q) == {"screen": "user interface", "rules": "rule base"}[shows]
                assert "knowledge base" not in q.options  # where the facts and the rules are kept is told two ways
        assert asked == {"conclusion", "first", "missing", "part"}, (s, asked)


def test_expert_system_shows_its_rules_and_facts():
    m = fam("expert_system")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = " ".join(texts(m, p))
        for f in p["facts"]:
            assert f in shown, (s, f)
        for i, (ifs, then) in enumerate(p["rules"]):
            assert f"R{i + 1}" in shown and then in shown and all(c in shown for c in ifs), (s, i)
        for q in qs:
            if q.kind == "mcq" and "to reach the conclusion" in q.stem:
                for o in q.options:  # a fact offered is one the rules use
                    assert o in shown


# --- web pages ------------------------------------------------------------------------------------

class Page(HTMLParser):
    """What a browser would make of the snippet: table rows and cells, lists, links, images, styles and text."""

    def __init__(self):
        super().__init__()
        self.rows, self.lists, self.links, self.imgs, self.blocks = [], [], [], [], []
        self.style, self.stack, self.cell, self.item, self.link = "", [], None, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.stack.append(tag)
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th"):
            self.cell = [tag, ""]
        elif tag in ("ol", "ul"):
            self.lists.append({"tag": tag, "start": int(a.get("start", 1)), "items": []})
        elif tag == "li":
            self.item = ""
        elif tag == "a":
            self.link = {"href": a["href"], "text": ""}
        elif tag == "img":
            self.imgs.append(a)
            self.stack.pop()  # a void element
        elif tag in ("h1", "h2", "h3", "p"):
            self.blocks.append([tag, ""])

    def handle_endtag(self, tag):
        assert self.stack and self.stack[-1] == tag, (tag, self.stack)
        self.stack.pop()
        if tag in ("td", "th"):
            self.rows[-1].append((self.cell[0], self.cell[1].strip()))
            self.cell = None
        elif tag == "li":
            self.lists[-1]["items"].append(self.item.strip())
            self.item = None
        elif tag == "a":
            self.link["text"] = self.link["text"].strip()
            self.links.append(self.link)
            self.link = None

    def handle_data(self, data):
        if self.stack and self.stack[-1] == "style":
            self.style += data
        if self.cell is not None:
            self.cell[1] += data
        if self.item is not None:
            self.item += data
        if self.link is not None:
            self.link["text"] += data
        if self.blocks and any(t == self.blocks[-1][0] for t in self.stack):
            self.blocks[-1][1] += data


def parse(lines):
    page = Page()
    page.feed("\n".join(lines))
    page.close()
    assert not page.stack, page.stack  # every element closed
    return page


def css(page):
    out = {}
    for sel, body in re.findall(r"(\w+)\s*\{([^}]*)\}", page.style):
        out[sel] = {k.strip(): v.strip() for k, v in (d.split(":") for d in body.split(";") if d.strip())}
    return out


def test_web_page():
    m = fam("web_page")
    for s in SEEDS:
        p, qs = run(m, s)
        page = parse(p["html"])
        url = urlsplit(p["url"])
        assert "".join(p["parts"]) == p["url"] and len(p["parts"]) == 4
        folder, file = url.path.rsplit("/", 1)
        role = {"protocol": f"{url.scheme}://", "domain name": url.netloc, "folder": folder + "/", "file name": file}
        if p["kind"] == "link":
            assert [lk["href"] for lk in page.links] == [p["url"]]  # the address shown is the link's
        asked = set()
        for q in qs:
            got = re.search(r"in row (\d+), column (\d+) of the table", q.stem)
            if got:
                r, c = int(got.group(1)), int(got.group(2))
                assert q.answer == page.rows[r - 1][c - 1][1], (s, q.stem)
                asked.add("html")
            if "How many rows" in q.stem:
                assert int(q.answer) == len(page.rows) and "heading row" in q.stem
                asked.add("html")
            if "bold cells in the first row" in q.stem:
                assert picked(q) == "<th>" and {t for t, _ in page.rows[0]} == {"th"}
                asked.add("tag")
            got = re.search(r"What number does the browser show beside '(.+?)'\?", q.stem)
            if got:
                lst = page.lists[0]
                assert lst["tag"] == "ol"
                assert int(q.answer) == lst["start"] + lst["items"].index(got.group(1)), s
                asked.add("html")
            if "How many bullet points" in q.stem:
                assert page.lists[0]["tag"] == "ul" and int(q.answer) == len(page.lists[0]["items"])
                asked.add("html")
            got = re.search(r"Which tag makes the (numbered|bulleted) list\?", q.stem)
            if got:
                assert picked(q) == {"numbered": "<ol>", "bulleted": "<ul>"}[got.group(1)]
                assert page.lists[0]["tag"] == picked(q)[1:-1]
                asked.add("tag")
            if "show as the link" in q.stem:
                assert q.answer == page.links[0]["text"]
                asked.add("html")
            if "Which file does the link open" in q.stem:
                assert q.answer == page.links[0]["href"].rsplit("/", 1)[1]
                asked.add("html")
            got = re.search(r"Which tag turns '(.+?)' into a link\?", q.stem)
            if got:
                assert picked(q) == "<a>" and got.group(1) == page.links[0]["text"]
                asked.add("tag")
            got = re.search(r"If (\S+) cannot be found, what text", q.stem)
            if got:
                assert got.group(1) == page.imgs[0]["src"].rsplit("/", 1)[-1]
                assert q.answer == page.imgs[0]["alt"]
                asked.add("html")
            if "How wide" in q.stem:
                assert int(q.answer) == int(page.imgs[0]["width"])
                asked.add("html")
            if "Which tag puts the picture" in q.stem:
                assert picked(q) == "<img>" and page.imgs
                asked.add("tag")
            got = re.search(r"What colour does the browser show '(.+?)' in\?", q.stem)
            if got:
                tag = next(t for t, x in page.blocks if x.strip() == got.group(1))
                assert q.answer == css(page)[tag]["color"], s
                asked.add("html")
            got = re.search(r"What font size, in pixels, does the browser use for '(.+?)'\?", q.stem)
            if got:
                tag = next(t for t, x in page.blocks if x.strip() == got.group(1))
                assert q.answer == css(page)[tag]["font-size"].removesuffix("px"), s
                asked.add("html")
            # "path" is told two ways (the folder, or the folder and file together), and so is a domain name with or
            # without its www (P3v blind review): the URL is asked only by its lettered parts, the folder by that name.
            assert "path" not in q.stem.lower(), (s, q.stem)
            if "URL" in q.stem:
                assert q.kind == "mcq" and q.options == list("ABCD"), (s, q.stem)
            got = re.search(r"Which labelled part of the URL is the (protocol|domain name|folder|file name)\b", q.stem)
            if got:
                assert p["parts"][ord(picked(q)) - ord("A")] == role[got.group(1)], (s, q.stem)
                asked.add("url")
        assert "url" in asked and ("html" in asked or "tag" in asked), (s, asked)
        assert ("tag" in asked) == (p["mode"] == "both"), (s, asked)


def test_web_page_shows_its_code_and_address():
    m = fam("web_page")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = texts(m, p)
        for line in p["html"]:
            assert line.strip() in [t.strip() for t in shown], (s, line)
        for part in p["parts"]:
            assert part in shown, (s, part)
        if p["mode"] == "both":  # what the browser shows is drawn beside the code
            page = parse(p["html"])
            for row in page.rows:
                for _, x in row:
                    assert x in shown, (s, x)
            for lst in page.lists:
                for i, x in enumerate(lst["items"]):
                    assert any(t.endswith(x) for t in shown), (s, x)
