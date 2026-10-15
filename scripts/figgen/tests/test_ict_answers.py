"""Answers of the ICT and primary computing families (P3z ict), recomputed independently from each figure's params over
1,000 seeds: the block program run by a walker of this file's own, the network's links followed, the devices classed
from a table of this file's own, the folder tree walked, the email's boxes read, the document's blocks read, and the
systems life cycle followed in the Cambridge IGCSE ICT (0417) order.

Nothing here calls a family's own helpers to work out a key.
"""
import random
import re
from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import pytest
from matplotlib.text import Text
from matplotlib.transforms import Bbox

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = range(1, 31)  # figures drawn to check that every value asked is shown
WAVE = ("block_code_p", "simple_network_p", "computer_parts", "folder_tree", "email_screen", "document_format",
        "system_life_cycle")


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


def texts(m, p) -> list[str]:
    fig = m.draw(p)
    try:
        return [t.get_text() for ax in fig.axes for t in ax.texts]
    finally:
        plt.close(fig)


def drawn_texts(fig):
    """Every piece of text the renderer drew, with its box in pixels."""
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


# --- block_code_p ---------------------------------------------------------------------------------

STEP = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}
CLOCKWISE = "NESW"


def expand(program):
    out = []
    for b in program:
        if b[0] == "repeat":
            out += expand(b[2]) * b[1]
        else:
            out.append(tuple(b))
    return out


def walk(start, facing, program):
    """Every square the sprite stands on, in order. A turn is on the spot, to the sprite's own right or left."""
    x, y = start
    path = [(x, y)]
    for b in expand(program):
        if b[0] == "move":
            for _ in range(b[1]):
                x, y = x + STEP[facing][0], y + STEP[facing][1]
                path.append((x, y))
        else:
            facing = CLOCKWISE[(CLOCKWISE.index(facing) + (1 if b[1] == "right" else -1)) % 4]
    return path


def as_block(text):
    got = re.fullmatch(r"move (\d) steps?", text)
    if got:
        return ["move", int(got.group(1))]
    got = re.fullmatch(r"turn (left|right)", text)
    assert got, text
    return ["turn", got.group(1)]


def fill(program, block=None, count=None):
    """The program with its missing block, or its missing repeat count, put in."""
    out = []
    for b in program:
        if b == ["?"]:
            out.append(block)
        elif b[0] == "repeat":
            out.append(["repeat", count if b[1] is None else b[1], fill(b[2], block, count)])
        else:
            out.append(b)
    return out


def block_text(b):
    if b[0] == "move":
        return f"move {b[1]} step" + ("s" if b[1] != 1 else "")
    return f"turn {b[1]}"


def test_block_code_p():
    m = fam("block_code_p")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        n = p["size"]
        grid = {(x, y) for x in range(n) for y in range(n)}
        prog = p["program"]
        has_repeat = any(b[0] == "repeat" for b in prog)
        assert has_repeat or p["level"] == "lower", s  # the upper level always repeats
        seen[(p["level"], p["mode"], p.get("missing"))] += 1
        if p["mode"] == "trace":
            full = prog
            path = walk(p["start"], p["facing"], full)
            spots = {k: tuple(v) for k, v in p["letters"].items()}
            assert len(set(spots.values())) == len(spots) >= 3 and tuple(p["start"]) not in spots.values(), s
            assert set(spots.values()) <= grid, s
            q = qs[0]
            assert q.kind == "mcq" and "Which letter does the sprite stop on?" in q.stem, s
            assert sorted(q.options) == sorted(spots), s
            assert spots[picked(q)] == path[-1], (s, prog)
        else:
            goal = tuple(p["goal_at"])
            q = qs[0]
            if p["missing"] == "count":
                assert q.kind == "short" and "What number should go in the repeat block" in q.stem, s
                k = int(q.answer)
                full = fill(prog, count=k)
                for other in range(1, 7):  # only the key reaches the goal
                    if other != k:
                        alt = walk(p["start"], p["facing"], fill(prog, count=other))
                        assert alt[-1] != goal, (s, other)
            else:
                assert q.kind == "mcq" and "Which block should go where the ? is?" in q.stem, s
                full = fill(prog, block=as_block(picked(q)))
                for i, o in enumerate(q.options):
                    if i != int(q.answer):
                        alt = walk(p["start"], p["facing"], fill(prog, block=as_block(o)))
                        assert alt[-1] != goal, (s, o)
            path = walk(p["start"], p["facing"], full)
            assert path[-1] == goal, (s, prog)
            for name, at in p["objects"].items():
                assert (name == p["goal"]) == (tuple(at) == goal), (s, name)
        assert set(path) <= grid and len(set(path)) == len(path), (s, path)  # on the grid, never crossing itself
        moves = sum(b[1] for b in expand(full) if b[0] == "move")
        turns = sum(1 for b in expand(full) if b[0] == "turn")
        asked = set()
        for q in qs:
            if "How many steps does the sprite move" in q.stem:
                asked.add("steps")
                assert int(q.answer) == moves == len(path) - 1, s
            if "How many times does the sprite turn" in q.stem:
                asked.add("turns")
                assert int(q.answer) == turns and has_repeat, s
        assert "steps" in asked, s
    assert min(seen.values()) >= 50, seen


def test_block_code_p_draws_every_block_and_letter():
    m = fam("block_code_p")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = texts(m, p)
        simple = [c for b in p["program"] for c in (b[2] if b[0] == "repeat" else [b])]
        for b in simple:
            assert (b == ["?"] and "?" in shown) or block_text(b) in shown, (s, b)
        for b in p["program"]:
            if b[0] == "repeat":
                assert f"repeat {b[1] if b[1] is not None else '?'}" in shown, s
            if b == ["?"]:
                assert "?" in shown, s
        if p["mode"] == "trace":
            assert set(p["letters"]) <= set(shown), s
        else:
            assert all(name in shown for name in p["objects"]), s
        assert "1 step = 1 square" in " ".join(shown), s


def test_block_code_p_only_the_key_block_stops_the_sprite_on_the_object():
    """P3z review: a loop carried the sprite over the apple and on, and no option read as stopping on it. With the key
    the sprite ends exactly on the object, on the grid, never crossing itself or another object; with every other
    option it ends elsewhere and never even passes over the object."""
    m = fam("block_code_p")
    seen = 0
    for s in range(1, 3001):
        p, qs = run(m, s)
        if p["mode"] != "fix" or p["missing"] != "block":
            continue
        seen += 1
        n, goal = p["size"], tuple(p["goal_at"])
        others = {tuple(v) for k, v in p["objects"].items() if k != p["goal"]}
        q = qs[0]
        for i, o in enumerate(q.options):
            path = walk(p["start"], p["facing"], fill(p["program"], block=as_block(o)))
            if i == int(q.answer):
                assert path[-1] == goal, (s, o)
                assert all(0 <= x < n and 0 <= y < n for x, y in path) and len(set(path)) == len(path), (s, o)
                assert not others & set(path), (s, o)
            else:
                assert goal not in path, (s, o, path)
    assert seen >= 500, seen


def test_block_code_p_only_the_key_repeat_count_ends_on_the_object():
    """P3z review: a loop of four turns comes back round, so "repeat 7" also ended on the flower (3 + 4). The key is
    the only count from 1 to 9 that ends there, on the grid or off it."""
    m = fam("block_code_p")
    seen = 0
    for s in range(1, 3001):
        p, qs = run(m, s)
        if p["mode"] != "fix" or p["missing"] != "count":
            continue
        seen += 1
        goal = tuple(p["goal_at"])
        hits = [k for k in range(1, 10) if walk(p["start"], p["facing"], fill(p["program"], count=k))[-1] == goal]
        assert hits == [int(qs[0].answer)], (s, hits)
    assert seen >= 300, seen


# --- simple_network_p -----------------------------------------------------------------------------

def test_simple_network_p():
    m = fam("simple_network_p")
    levels = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        levels[p["level"]] += 1
        asked = set()
        if p["level"] == "lower":
            joined = [d for d, j in p["devices"] if j]
            apart = [d for d, j in p["devices"] if not j]
            assert len(apart) == 1 and 3 <= len(joined) <= 5, s
            for q in qs:
                if "How many devices are joined to the router?" in q.stem:
                    asked.add("count")
                    assert int(q.answer) == len(joined), s
                if "Which device is not joined to the router?" in q.stem:
                    asked.add("apart")
                    assert picked(q) == apart[0], s
                    assert all(o in joined for i, o in enumerate(q.options) if i != int(q.answer)), s
            assert asked == {"count", "apart"}, s
            continue
        links = {(min(a, b), max(a, b)): k for a, b, k in p["links"]}
        assert len(set(links.values())) == len(links) == len(p["links"]), s
        nbr = defaultdict(set)
        for a, b, _ in p["links"]:
            nbr[a].add(b)
            nbr[b].add(a)
        assert nbr["internet"] == {"router"}, s
        assert len(nbr["printer"]) == 1, s
        host = next(iter(nbr["printer"]))
        for c in p["computers"]:
            assert nbr[c] == {"router"} | ({"printer"} if host == c else set()), (s, c)
        for q in qs:
            if "How many devices are joined straight to the router?" in q.stem:
                asked.add("count")
                assert "internet" in q.stem  # it says the internet is not counted
                assert int(q.answer) == len(nbr["router"] - {"internet"}), s
            if "shares the printer" in q.stem:
                asked.add("printer")
                assert picked(q) == ("the router" if host == "router" else f"computer {host}"), s
            got = re.search(r"Data from computer ([A-E]) goes to the internet\. Which links does it travel along\?", q.stem)
            if got:
                asked.add("path")
                c = got.group(1)
                want = {links[(min(c, "router"), max(c, "router"))], links[("internet", "router")]}
                nums = lambda o: {int(x) for x in re.findall(r"\d+", o)}  # noqa: E731
                assert nums(picked(q)) == want, (s, q.options)
                assert all(nums(o) != want for i, o in enumerate(q.options) if i != int(q.answer)), s
        assert asked == {"count", "printer", "path"}, (s, asked)
    assert min(levels.values()) >= 300, levels


def test_simple_network_p_shows_every_device_and_link_number():
    m = fam("simple_network_p")
    for s in DRAWN:
        p, _ = run(m, s)
        shown = texts(m, p)
        assert "router" in shown and "internet" in shown, s
        if p["level"] == "lower":
            assert all(d in shown for d, _ in p["devices"]), s
        else:
            assert all(f"computer {c}" in shown for c in p["computers"]) and "printer" in shown, s
            assert all(str(k) in shown for _, _, k in p["links"]), s


# --- computer_parts -------------------------------------------------------------------------------

CLASS = {"keyboard": "input", "mouse": "input", "scanner": "input", "webcam": "input", "microphone": "input",
         "monitor": "output", "printer": "output", "speakers": "output", "headphones": "output", "projector": "output",
         "flash drive": "storage", "external hard disk": "storage"}
# What a primary question says a part does, by words only that part's job has.
JOB = {"keyboard": r"\btype\b", "mouse": r"\bpointer\b", "monitor": r"\bscreen\b", "printer": r"\bpaper\b",
       "speakers": r"\bsounds?\b", "headphones": r"\bsounds?\b", "webcam": r"\bvideo\b", "microphone": r"\bvoice\b",
       "scanner": r"\bpage\b"}


def installs(prog, pc):
    name, ram, space, ghz, bits = prog
    return ram <= pc["ram"] and space <= pc["free"] and ghz <= pc["ghz"] and (bits == 32 or pc["bits"] == 64)


def test_computer_parts():
    m = fam("computer_parts")
    seen = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        seen[(p["band"], p["sub"], p.get("level"))] += 1
        asked = set()
        if p["sub"] == "system":
            letters = {k: d for k, d in p["devices"]}
            assert len(letters) == len(p["devices"]) and set(letters.values()) <= set(CLASS), s
            assert not {"speakers", "headphones"} <= set(letters.values()), s  # two parts that do one job
            assert len([d for d in letters.values() if CLASS[d] == "storage"]) <= 1, s
            for q in qs:
                got = re.search(r"Which letter shows an? (input|output|storage) device\?", q.stem)
                if got:
                    asked.add("which")
                    cls = got.group(1)
                    assert [o for o in q.options if CLASS[letters[o]] == cls] == [picked(q)], (s, q.options)
                got = re.search(r"How many (input|output|storage) devices are shown\?", q.stem)
                if got:
                    asked.add("count")
                    assert int(q.answer) == sum(CLASS[d] == got.group(1) for d in letters.values()), s
                if "Which letter shows the part that" in q.stem:
                    asked.add("job")
                    assert p["level"] == "lower", s
                    doers = [k for k, d in letters.items() if d in JOB and re.search(JOB[d], q.stem)]
                    assert doers == [picked(q)], (s, q.stem, letters)
                if "How many parts are joined to the computer?" in q.stem:
                    asked.add("joined")
                    assert int(q.answer) == len(letters), s
            want = {"job", "joined"} if p.get("level") == "lower" else {"which", "count"}
            assert asked == want, (s, asked)
            continue
        pc = p["computer"]
        progs = p["programs"]
        fails = [x for x in progs if not installs(x, pc)]
        assert len(fails) == 1, (s, fails)
        bad = fails[0]
        # it fails on exactly one requirement, so the reason is plain
        misses = [bad[1] > pc["ram"], bad[2] > pc["free"], bad[3] > pc["ghz"], bad[4] == 64 and pc["bits"] == 32]
        assert sum(misses) == 1, (s, bad)
        for q in qs:
            if "Which program cannot be installed on this computer?" in q.stem:
                asked.add("which")
                assert picked(q) == bad[0] and sorted(q.options) == sorted(x[0] for x in progs), s
            got = re.search(r"installs (.+) and (.+)\. How much free disk space is left", q.stem)
            if got:
                asked.add("left")
                a, b = (next(x for x in progs if x[0] == g) for g in got.groups())
                assert installs(a, pc) and installs(b, pc), s
                assert int(q.answer) == pc["free"] - a[2] - b[2] >= 0, s
            if "How many gigabytes of the disk are already used?" in q.stem:
                asked.add("used")
                assert int(q.answer) == pc["disk"] - pc["free"], s
            if "How much more RAM" in q.stem:
                asked.add("more")
                assert misses[0] and int(q.answer) == bad[1] - pc["ram"], s
            if "How much more free disk space" in q.stem:
                asked.add("more")
                assert misses[1] and int(q.answer) == bad[2] - pc["free"], s
        assert {"which", "left", "used"} <= asked, (s, asked)
    assert min(seen.values()) >= 60, seen


def test_computer_parts_shows_every_device_and_requirement():
    m = fam("computer_parts")
    for s in range(1, 61):
        p, _ = run(m, s)
        shown = texts(m, p)
        joined = " ".join(shown)
        if p["sub"] == "system":
            for k, d in p["devices"]:
                assert k in shown and d in shown, (s, d)
            if p.get("level") != "lower":
                assert "Input device" in joined and "Output device" in joined and "Storage device" in joined, s
        else:
            pc = p["computer"]
            assert f"{pc['ram']} GB" in joined and f"{pc['free']} GB free of {pc['disk']} GB" in joined, s
            for name, ram, space, ghz, bits in p["programs"]:
                assert name in shown and f"{ram} GB" in shown and f"{space} GB" in shown and f"{ghz} GHz" in shown, s


def test_computer_parts_cables_cross_no_label():
    m = fam("computer_parts")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        if p["sub"] != "system":
            continue
        fig = m.draw(p)
        boxes = drawn_texts(fig)
        cables = [ln for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("cable")]
        assert len(cables) == len(p["devices"]), s
        for ln in cables:
            for t, box in boxes:
                assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)


# --- folder_tree ----------------------------------------------------------------------------------

def folders_of(node, trail=()):
    """Every folder with its path from the root, the root first."""
    here = trail + (node["name"],)
    yield here, node
    for f in node["folders"]:
        yield from folders_of(f, here)


def all_files(node):
    return list(node["files"]) + [x for f in node["folders"] for x in all_files(f)]


def test_folder_tree():
    m = fam("folder_tree")
    for s in SEEDS:
        p, qs = run(m, s)
        tree = p["tree"]
        where = {}
        names = Counter()
        for path, node in folders_of(tree):
            names[node["name"]] += 1
            for f in node["files"]:
                assert f not in where, (s, f)  # every file name once
                where[f] = path
        assert max(names.values()) == 1, s  # every folder name once
        rows = sum(1 + len(n["files"]) for _, n in folders_of(tree))
        assert rows <= 19, (s, rows)
        asked = set()
        for q in qs:
            got = re.search(r"What is the path to the file (\S+)\?", q.stem)
            if got:
                asked.add("path")
                f = got.group(1)
                assert picked(q) == "\\".join(where[f] + (f,)), (s, q.options)
                assert len(where[f]) >= 3, s  # two folders below the drive at least
            got = re.search(r"How many files are (stored directly in|kept anywhere inside) the (.+?) folder", q.stem)
            if got:
                asked.add("count")
                node = next(n for path, n in folders_of(tree) if n["name"] == got.group(2))
                want = len(node["files"]) if got.group(1).startswith("stored") else len(all_files(node))
                assert int(q.answer) == want, (s, q.stem)
                if got.group(1).startswith("kept"):
                    assert node["folders"] and all_files(node) != node["files"], s  # the subfolders matter
            got = re.search(r"Which folder holds the file (\S+)\?", q.stem)
            if got:
                asked.add("holder")
                assert picked(q) == where[got.group(1)][-1], s
                assert all(o != where[got.group(1)][-1] and o in names for i, o in enumerate(q.options)
                           if i != int(q.answer)), s
        assert asked == {"path", "count", "holder"}, (s, asked)


def test_folder_tree_shows_every_folder_and_file():
    m = fam("folder_tree")
    for s in DRAWN:
        p, _ = run(m, s)
        shown = texts(m, p)
        for _, node in folders_of(p["tree"]):
            assert any(node["name"] in t for t in shown), (s, node["name"])
            assert all(f in shown for f in node["files"]), s


# --- email_screen ---------------------------------------------------------------------------------

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def test_email_screen():
    m = fam("email_screen")
    views = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        views[p["view"]] += 1
        to, cc, bcc = ([x[0] for x in p[k]] for k in ("to", "cc", "bcc"))
        everyone = [p["sender"][0]] + to + cc + bcc
        assert len(set(everyone)) == len(everyone), s
        assert (p["view"] == "inbox") == (not bcc) == (p["date"] is not None), s
        asked = set()
        for q in qs:
            if "sent a copy (Cc)" in q.stem:
                asked.add("cc")
                assert picked(q) in cc, s
                assert all(o not in cc and o in everyone for i, o in enumerate(q.options) if i != int(q.answer)), s
            if "Whose email address will the other people not see?" in q.stem:
                asked.add("bcc")
                assert picked(q) in bcc, s
                assert all(o not in bcc and o in everyone for i, o in enumerate(q.options) if i != int(q.answer)), s
            if "How many people will receive this email?" in q.stem:
                asked.add("count")
                assert int(q.answer) == len(to) + len(cc) + len(bcc), s
            if "Reply all" in q.stem:
                asked.add("reply")
                assert "sender" in q.stem and "To and Cc" in q.stem  # the rule is stated
                viewer = p["viewer"]
                assert viewer in to + cc
                assert int(q.answer) == 1 + len(to) + len(cc) - 1, s
            if "What is the name of the file attached" in q.stem:
                asked.add("file")
                assert len(p["attachments"]) == 1 and q.answer == p["attachments"][0][0], s
            if "Which attached file is the largest?" in q.stem:
                asked.add("file")
                sizes = {a: kb for a, kb in p["attachments"]}
                assert sizes[picked(q)] == max(sizes.values()) and sorted(sizes.values())[-2] < max(sizes.values()), s
            if "What is the total size of the attachments in kB?" in q.stem:
                asked.add("total")
                assert len(p["attachments"]) == 2 and int(q.answer) == sum(kb for _, kb in p["attachments"]), s
                assert f"{q.answer} kB" in q.accepted, s
            if "On what date was the email sent?" in q.stem:
                asked.add("date")
                y, mo, d = p["date"][:3]
                assert q.answer == f"{d} {MONTHS[mo - 1]} {y}", s
                assert f"{d}/{mo}/{y}" in q.accepted or f"{d:02d}/{mo:02d}/{y}" in q.accepted, s
        if p["view"] == "inbox":
            assert {"cc", "reply", "file", "date"} <= asked, (s, asked)
        else:
            assert {"bcc", "count"} <= asked and ("file" in asked or "total" in asked), (s, asked)
    assert min(views.values()) >= 400, views


def test_email_screen_shows_every_box():
    m = fam("email_screen")
    for s in DRAWN:
        p, _ = run(m, s)
        joined = " ".join(texts(m, p))
        for name, addr in [p["sender"]] + p["to"] + p["cc"] + p["bcc"]:
            assert addr in joined, (s, addr)
        assert p["subject"] in joined, s
        for a, kb in p["attachments"]:
            assert a in joined and f"{kb} kB" in joined, (s, a)
        for box in ("From", "To", "Cc", "Subject"):
            assert box in joined, (s, box)
        if p["view"] == "compose":
            assert "Bcc" in joined and "Send" in joined, s
        else:
            y, mo, d = p["date"][:3]
            assert f"{d} {MONTHS[mo - 1][:3]} {y}" in joined, s


# --- document_format ------------------------------------------------------------------------------

FEATURE = {"centre-aligned text": lambda b: b.get("align") == "center",
           "right-aligned text": lambda b: b.get("align") == "right",
           "justified text": lambda b: b.get("align") == "justify",
           "text with double line spacing": lambda b: b.get("spacing") == 2,
           "an indented paragraph": lambda b: b.get("indent", False),
           "the header": lambda b: b["kind"] == "header",
           "the footer": lambda b: b["kind"] == "footer"}
PARTS = ("ribbon", "thumbnail pane", "slide pane", "notes pane", "status bar")


def test_document_format():
    m = fam("document_format")
    subs = Counter()
    for s in SEEDS:
        p, qs = run(m, s)
        subs[p["sub"]] += 1
        asked = set()
        if p["sub"] == "page":
            blocks = {b["letter"]: b for b in p["blocks"]}
            assert len(blocks) == len(p["blocks"]), s
            for q in qs:
                got = re.search(r"Which letter shows (.+)\?", q.stem)
                if got:
                    asked.add("which")
                    has = FEATURE[got.group(1)]
                    assert [k for k, b in blocks.items() if has(b)] == [picked(q)], (s, got.group(1))
                    assert set(q.options) <= set(blocks), s
                if "How many bullet points are in the list?" in q.stem:
                    asked.add("list")
                    assert int(q.answer) == len(next(b for b in blocks.values() if b["kind"] == "bullets")["items"]), s
                if "How many items are in the numbered list?" in q.stem:
                    asked.add("list")
                    assert int(q.answer) == len(next(b for b in blocks.values() if b["kind"] == "numbered")["items"]), s
                table = next((b for b in blocks.values() if b["kind"] == "table"), None)
                if "How many columns does the table have?" in q.stem:
                    asked.add("table")
                    assert int(q.answer) == len(table["rows"][0]), s
                if "How many rows does the table have, including its heading row?" in q.stem:
                    asked.add("table")
                    assert int(q.answer) == len(table["rows"]), s
            assert {"which", "list", "table"} <= asked, (s, asked)
            continue
        parts = p["parts"]
        assert sorted(parts) == sorted(PARTS) and len(set(parts.values())) == len(PARTS), s
        for q in qs:
            got = re.search(r"Which letter shows the (ribbon|thumbnail pane|slide pane|notes pane|status bar)\?", q.stem)
            if got:
                asked.add("which")
                assert picked(q) == parts[got.group(1)], s
            if "How many slides are in the presentation?" in q.stem:
                asked.add("slides")
                assert int(q.answer) == len(p["titles"]), s
            if "How many bullet points are on the slide being edited?" in q.stem:
                asked.add("bullets")
                assert int(q.answer) == len(p["bullets"]), s
        assert asked == {"which", "slides", "bullets"}, (s, asked)
    assert min(subs.values()) >= 300, subs


def test_document_format_aligns_its_lines_as_its_blocks_say():
    """Measured on the drawing: centred lines have equal margins, right-aligned and justified lines share a right edge,
    left-aligned and justified lines a left edge, and a double-spaced block's lines sit twice as far apart."""
    m = fam("document_format")
    for s in range(1, 41):
        p = m.sample(random.Random(s))
        if p["sub"] != "page":
            continue
        fig = m.draw(p)
        boxes = {}  # a line drawn word by word (justified) is the union of its words
        words = defaultdict(list)
        for t, box in drawn_texts(fig):
            got = re.fullmatch(r"([A-Z]:line\d+)(?::w(\d+))?", t.get_gid() or "")
            if got:
                boxes[got.group(1)] = Bbox.union([boxes[got.group(1)], box]) if got.group(1) in boxes else box
                if got.group(2):
                    words[got.group(1)].append((int(got.group(2)), box))
        for line, ws in words.items():  # a justified line's words never run together
            ws.sort(key=lambda w: w[0])
            assert all(b.x0 - a.x1 >= 3 for (_, a), (_, b) in zip(ws, ws[1:])), (s, line)
        left, right = fig.axes[0].transData.transform([(p["margins"][0], 0), (p["margins"][1], 0)])[:, 0]
        plt.close(fig)
        for b in p["blocks"]:
            if b["kind"] not in ("text", "heading"):
                continue
            lines = [boxes[f"{b['letter']}:line{i}"] for i in range(len(b["lines"]))]
            indent = 0
            if b.get("indent"):
                indent = min(x.x0 for x in lines) - left
                assert indent > 15, (s, b["letter"])
            for i, x in enumerate(lines):
                if b["align"] == "center":
                    assert abs((x.x0 - left) - (right - x.x1)) < 3, (s, b["letter"], i)
                if b["align"] in ("right",) or (b["align"] == "justify" and i < len(lines) - 1):
                    assert abs(x.x1 - right) < 3, (s, b["letter"], i)
                if b["align"] in ("left", "justify"):
                    assert abs(x.x0 - left - indent) < 3, (s, b["letter"], i)
            if b["align"] == "left" and len(lines) > 1:
                assert max(x.x1 for x in lines) - min(x.x1 for x in lines) > 10, (s, b["letter"])  # ragged right
            if len(lines) > 1:
                gaps = [a.y0 - c.y0 for a, c in zip(lines, lines[1:])]
                assert len({round(g) for g in gaps}) <= 2, (s, gaps)
                b["gap"] = sum(gaps) / len(gaps)
        single = [b["gap"] for b in p["blocks"] if "gap" in b and b.get("spacing", 1) == 1]
        double = [b["gap"] for b in p["blocks"] if "gap" in b and b.get("spacing") == 2]
        for d in double:
            assert all(1.7 < d / g < 2.3 for g in single), (s, d, single)


def test_document_format_shows_what_it_asks():
    m = fam("document_format")
    for s in DRAWN:
        p, qs = run(m, s)
        shown = texts(m, p)
        if p["sub"] == "page":
            for b in p["blocks"]:
                assert b["letter"] in shown, s
                for row in b.get("rows", []):
                    assert all(c in shown for c in row), s
                assert sum(t == "•" for t in shown) >= (len(b["items"]) if b["kind"] == "bullets" else 0), s
        else:
            assert set(p["parts"].values()) <= set(shown), s
            assert all(b in shown for b in p["bullets"]), s
            assert sum(1 for t in shown if re.fullmatch(r"\d+", t) and int(t) <= len(p["titles"])) >= len(p["titles"]), s


def _line_starts(fig, letter):
    """Where each drawn line of a block begins, in pixels: its text, or its first word, or its list mark."""
    starts = {}
    for t, box in drawn_texts(fig):
        got = re.fullmatch(rf"{letter}:(line|mark)(\d+)(?::w\d+)?", t.get_gid() or "")
        if got:
            key = got.group(1) + got.group(2)
            starts[key] = min(starts.get(key, box.x0), box.x0)
    return starts


def test_document_format_indents_only_the_paragraph_it_asks_about():
    """P3z review: a centred paragraph's lines began right of the margin, each by a different amount, and were read as
    an indent, so "which letter shows an indented paragraph" had two answers. Only the asked block is indented; when
    the indent is asked, every other block begins every line at the left margin, the indented block begins every line
    at one place (no hanging indent), and list marks and tables stand on the margin in every page."""
    from matplotlib.patches import Rectangle
    m = fam("document_format")
    drawn = 0
    for s in range(1, 1001):
        p = m.sample(random.Random(s))
        if p["sub"] != "page":
            continue
        indented = [b["letter"] for b in p["blocks"] if b.get("indent")]
        assert len(indented) == (1 if p["ask"] == "an indented paragraph" else 0), (s, indented, p["ask"])
        if p["ask"] != "an indented paragraph" and drawn >= 30:
            continue
        drawn += 1
        fig = m.draw(p)
        left = fig.axes[0].transData.transform([(p["margins"][0], 0)])[0, 0]
        tables = [r for r in fig.axes[0].patches if isinstance(r, Rectangle) and (r.get_gid() or "").endswith(":col0")]
        for b in p["blocks"]:
            starts = _line_starts(fig, b["letter"])
            if b["kind"] == "table":
                mine = [r for r in tables if r.get_gid().startswith(b["letter"] + ":")]
                assert mine and all(abs(r.get_x() - p["margins"][0]) < 1e-9 for r in mine), (s, b["letter"])
                continue
            assert starts, (s, b["letter"])
            if b.get("indent"):
                xs = list(starts.values())
                assert min(xs) - left > 15 and max(xs) - min(xs) < 2, (s, b["letter"], xs)  # one indent, no hanging
            elif b["kind"] in ("bullets", "numbered") or b.get("align", "left") in ("left", "justify") \
                    or p["ask"] == "an indented paragraph":
                assert all(abs(x - left) < 3 for x in starts.values()), (s, b["letter"], b.get("align"), starts)
        plt.close(fig)
    assert drawn >= 40, drawn


# --- system_life_cycle ----------------------------------------------------------------------------

ORDER = ["Analysis", "Design", "Testing", "Implementation", "Documentation", "Evaluation"]  # Cambridge IGCSE ICT 0417
DOES = {"Analysis": r"current system is studied", "Design": r"file structures, input forms",
        "Testing": r"test data", "Implementation": r"changed over", "Documentation": r"user guide",
        "Evaluation": r"compared with the requirements"}


def test_system_life_cycle():
    m = fam("system_life_cycle")
    for s in SEEDS:
        p, qs = run(m, s)
        boxes = p["boxes"]  # by position, clockwise from the top: [letter, stage]
        assert [b[0] for b in boxes] == list("ABCDEF"), s
        step = 1 if p["dir"] == "cw" else -1
        at = {stage: k for k, (_, stage) in enumerate(boxes)}
        for i, stage in enumerate(ORDER):  # the arrows run in the syllabus order
            assert at[ORDER[(i + 1) % 6]] == (at[stage] + step) % 6, (s, boxes, p["dir"])
        letter = {stage: boxes[k][0] for stage, k in at.items()}
        stage_in = {b[0]: b[1] for b in boxes}
        blank = set(p["blank"])
        assert 1 <= len(blank) <= 2 and blank <= set(ORDER), s
        asked = set()
        for q in qs:
            got = re.search(r"Which letter shows the (\w+) stage\?", q.stem)
            if got:
                asked.add("letter")
                assert got.group(1).capitalize() in blank, s  # asked only where the box is blank
                assert picked(q) == letter[got.group(1).capitalize()], s
            got = re.search(r"Which stage comes straight after the stage in box ([A-F])\?", q.stem)
            if got:
                asked.add("after")
                here = stage_in[got.group(1)]
                assert picked(q) == ORDER[(ORDER.index(here) + 1) % 6], s
                assert picked(q) in blank or here in blank, s  # one of the two is not printed
            if "In which box is the stage" in q.stem:
                asked.add("does")
                which = [st for st, pat in DOES.items() if re.search(pat, q.stem)]
                assert len(which) == 1 and which[0] in blank, (s, q.stem)
                assert picked(q) == letter[which[0]], s
        assert {"letter", "after"} <= asked, (s, asked)


def test_system_life_cycle_shows_its_stages_and_its_arrows_run_the_right_way():
    m = fam("system_life_cycle")
    for s in DRAWN:
        p = m.sample(random.Random(s))
        fig = m.draw(p)
        shown = [t.get_text() for t in fig.axes[0].texts]
        heads = {ln.get_gid(): ln for ln in fig.axes[0].lines if (ln.get_gid() or "").startswith("arrow:")}
        centres = {t.get_gid()[4:]: t.get_position() for t in fig.axes[0].texts if (t.get_gid() or "").startswith("box:")}
        boxes_px = drawn_texts(fig)
        lines = list(fig.axes[0].lines)
        for ln in lines:
            for t, box in boxes_px:
                assert not crosses(ln, box), (s, ln.get_gid(), t.get_text())
        plt.close(fig)
        for letter, stage in p["boxes"]:
            assert letter in shown, s
            assert (stage in shown) == (stage not in p["blank"]), (s, stage)
        assert shown.count("?") == len(p["blank"]), s
        assert len(heads) == 6, s
        step = 1 if p["dir"] == "cw" else -1
        for k in range(6):
            ln = heads[f"arrow:{k}"]
            (x0, y0), (x1, y1) = ln.get_xydata()[0], ln.get_xydata()[-1]
            a, b = centres["ABCDEF"[k]], centres["ABCDEF"[(k + step) % 6]]
            d = lambda u, v: (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2  # noqa: E731
            assert d((x0, y0), a) < d((x0, y0), b) and d((x1, y1), b) < d((x1, y1), a), (s, k)


# --- lines and labels -----------------------------------------------------------------------------

@pytest.mark.parametrize("fid", ("simple_network_p", "folder_tree", "block_code_p"))
def test_no_line_runs_through_a_label(fid):
    """Labels sit beside the lines they name (P3z rule): a link's number, a device's name, a folder's name."""
    m = fam(fid)
    for s in DRAWN:
        fig = m.draw(m.sample(random.Random(s)))
        boxes = drawn_texts(fig)
        for ln in fig.axes[0].lines:
            for t, box in boxes:
                assert not crosses(ln, box), (fid, s, ln.get_gid(), t.get_text())
        plt.close(fig)


# --- all seven ------------------------------------------------------------------------------------

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
    assert m.SUBJECT == "computing" and m.CONCEPTS and all(c.startswith("computing.") for c in m.CONCEPTS)
    assert m.NEEDS and re.compile(m.NEEDS)
    for s in range(1, 60):
        p = m.sample(random.Random(s))
        if hasattr(m, "concepts_for"):
            assert set(m.concepts_for(p)) <= set(m.CONCEPTS), (fid, s)
        if p["band"] == "P":
            assert m.stages(p), (fid, s)


@pytest.mark.parametrize("fid", ("block_code_p", "simple_network_p"))
def test_a_primary_figure_prints_big(fid):
    m = fam(fid)
    for s in range(1, 13):
        fig = m.draw(m.sample(random.Random(s)))
        sizes = [t.get_fontsize() for ax in fig.axes for t in ax.texts if t.get_text().strip()]
        plt.close(fig)
        assert min(sizes) >= 10, (fid, s, min(sizes))


def test_links_turn_away_the_misfits_and_keep_the_fits():
    """Each family's NEEDS and AVOID read against topic names and sections (P3z reach check): what it must reach,
    and the sectionless topics sharing a broad concept that it must not."""
    cases = {  # fid: (names AVOID turns away, names or sections NEEDS matches and AVOID does not,
               #       names of sectionless topics, judged by concept alone, that AVOID must let through)
        "computer_parts": (["Unit 4: Be a designer", "Unit 5: We can network", "Unit 7: Computers and robots", "Data",
                            "Data management", "Data representation", "Keyboard and mouse skills", "Digital citizenship",
                            "Unit 8: Be a musician"],
                           ["Computers can be used for different things", "Physical computer parts", "Computer Systems",
                            "Input devices and their uses", "Computer capacity", "Software installation principles",
                            "Hardware", "Elements of the computer system unit and their roles"],
                           ["Unit 3: Be a data detective", "Computer parts and uses", "Computer fundamentals",
                            "Software and hardware"]),
        "simple_network_p": (["Computer parts and uses", "Unit 7: Computers control things", "Unit 12: Be a problem solver",
                              "Internet safety", "Unit 1: Computers are everywhere"],
                             ["Unit 5: Devices and networks", "Unit 9: Connected and sharing"],
                             ["Unit 5: We can network", "Unit 10: We are connected", "Unit 5: Networks are everywhere",
                              "Unit 3: Be a network designer"]),
        "block_code_p": (["Unit 7: Computers and robots", "Unit 11: Be a robot controller", "Unit 9: Be a code cracker"],
                         ["Bugs and errors in code", "Develop programs with repetition", "Unit 4: Be an animator"],
                         ["Unit 6: Be a storyteller", "Unit 10: Be a game developer"]),
        "folder_tree": (["ArcGIS", "Exporting Excel files to PDF or other file types"],
                        ["Computer Navigation", "Manage files effectively", "Google Drive"], []),
        "email_screen": (["ArcGIS", "Google Docs", "ICT applications"],
                         ["Chapter 10: Communication with other ICT users using email ", "Getting started with Gmail Account"],
                         ["Internet and email"]),
        "document_format": (["Spreadsheet Basics", "Microsoft Excel", "Unit 17: Cascading Style Sheet"],
                            ["Formatting a document", "Advanced Word Processing", "Layout", "Paragraph group", "Presentation"],
                            ["Word processing", "Presentation software"]),
        "system_life_cycle": (["Visual Basic Project", "Database Management with Access",
                               "Chapter 7: Program development life cycle"],
                              ["The systems life cycle", "Chapter 7: Analysis ", "Chapter 15: System life cycle",
                               "Systems analysis and design"], ["Digital project work"]),
    }
    for fid, (misfits, fits, bare) in cases.items():
        m = fam(fid)
        avoid = getattr(m, "AVOID", None)
        for name in misfits:
            assert avoid and re.search(avoid, name, re.I), (fid, name)
        for name in fits:
            assert re.search(m.NEEDS, name, re.I) and not (avoid and re.search(avoid, name, re.I)), (fid, name)
        for name in bare:
            assert not (avoid and re.search(avoid, name, re.I)), (fid, name)
