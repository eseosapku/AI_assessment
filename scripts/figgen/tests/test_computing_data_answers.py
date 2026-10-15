"""Answers of the Computing data and networks families (P3v data), recomputed from each figure's params over 1,000 seeds.

Every key is worked out here again by its own code: a parity block checked row by row and column by column, an IPv4
subnet by the `ipaddress` module, a linked list traversed and changed node by node, a hash table filled by linear
probing, and a table's normal form and its 3NF decomposition from the functional dependencies the figure lists
(Bernstein's synthesis). Every value a question needs is checked as shown in the figure, for the first figures drawn.
"""
import ipaddress
import json
import random
import re
import sqlite3
from fractions import Fraction
from pathlib import Path

import matplotlib.pyplot as plt
import pytest

from figgen.core import NAMES
from figgen.families import FAMILIES

SEEDS = range(1, 1001)
DRAWN = 120  # the figure itself is built and read for the first 120 seeds
DATA = ["parity_check", "ip_address", "linked_list_array", "hash_table", "er_normalisation"]
STORE = Path("C:/Users/Stephen/figure-library/figures.db")


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


def by_gid(fig) -> dict:
    return {t.get_gid(): t.get_text() for ax in fig.axes for t in ax.texts if t.get_gid()}


def line_gids(fig) -> set:
    return {ln.get_gid() for ax in fig.axes for ln in ax.lines if ln.get_gid()}


def drawn(m, p):
    fig = m.draw(p)
    g, lines = by_gid(fig), line_gids(fig)
    plt.close(fig)
    return g, lines


def own_wordings(m) -> int:
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    return sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))


@pytest.mark.parametrize("fid", DATA)
def test_data_family_is_worded_and_linked(fid):
    m = fam(fid)
    assert m.SUBJECT == "computing" and m.KIND == "cs.structure"
    assert m.CONCEPTS and all(c.startswith("computing.") for c in m.CONCEPTS)
    assert m.NEEDS
    assert own_wordings(m) >= 27, fid
    for seed in range(1, 80):
        p, qs = run(m, seed)
        assert p["band"] in m.BANDS
        assert json.loads(json.dumps(p)) == p, (fid, seed)
        first = next((n for n in NAMES if qs[0].stem.startswith(n)), None)
        assert first, (fid, seed, qs[0].stem)
        for q in qs:
            for owner in re.findall(r"\b(" + "|".join(NAMES) + r")'s\b", q.stem):
                assert owner == first, (fid, seed, q.stem)
            if q.kind == "short":
                assert q.answer in q.accepted and len(q.answer) <= 40
            else:
                assert len(q.options) >= 3 and len(set(q.options)) == len(q.options), (fid, seed, q.options)


@pytest.mark.parametrize("fid", DATA)
def test_concepts_are_known_and_reach_the_topics_they_should(fid):
    if not STORE.exists():
        pytest.skip("no figure library here")
    from figgen.link import reach, topic_index
    db = sqlite3.connect(f"file:{STORE}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    m = fam(fid)
    known = {r[0] for r in db.execute("SELECT id FROM concepts")}
    assert set(m.CONCEPTS) <= known, sorted(set(m.CONCEPTS) - known)
    index = topic_index(db)
    names = {t["key"]: (t["band"], t["name"]) for t in index}
    got = {names[k] for k in reach(index, m, samples=150)}
    want = {
        "parity_check": {("UP", "Chapter 2: The structure of a data packet"),
                         ("LS", "Building networks: Network structure and security")},
        "ip_address": {("AL", "Chapter 13: Networks"), ("AL", "Chapter 2: Communication and networking technologies"),
                       ("AL", "Chapter 17: Communication and Internet technologies"), ("AL", "Communications technology"),
                       ("UP", "Unit 3: Introduction to Computer Network")},
        "linked_list_array": {("AL", "Chapter 13: Data types and structures"), ("AL", "Chapter 23: Algorithms"),
                              ("AL", "Chapter 14: Programming and data representation")},
        "hash_table": {("AL", "Chapter 23: Algorithms"), ("AL", "Chapter 16: Data representation"),
                       ("AL", "Chapter 26: File processing and exception handling"),
                       ("AL", "Chapter 9: Database and file concepts"), ("UP", "File Management")},
        "er_normalisation": {("AL", "Chapter 11: Databases"), ("AL", "Chapter 9: Database and file concepts"),
                             ("AL", "Database and file concepts"), ("UP", "Unit 5: Database Design"),
                             ("UP", "Data management"), ("UP", "Database Design")},
    }[fid]
    assert want <= got, sorted(want - got)
    never = {
        "parity_check": {"Data input: Data collection and validation", "Microsoft Excel", "Chapter 11: Databases",
                         "Block it out: Moving from blocks to text", "Spreadsheets", "Data management"},
        "ip_address": {"Chapter 11: Databases", "Chapter 9: Database and file concepts", "Network Security",
                       "Chapter 9: Security, privacy and data integrity", "Spreadsheets", "Networks",
                       "Chapter 5: The digital divide", "The digital divide", "Communication"},
        "linked_list_array": {"Chapter 11: Databases", "Chapter 13: Networks", "Chapter 15: Software development"},
        "hash_table": {"Chapter 11: Databases", "Chapter 13: Networks", "Chapter 9: Security, privacy and data integrity",
                       "Data management", "Mail merge", "Project management"},
        "er_normalisation": {"Chapter 13: Networks", "Chapter 9: Database structure", "Chapter 18: Create a database structure",
                             "Chapter 23: Algorithms", "Mail merge", "Project management", "Chapter 20: Create a data model",
                             "System life cycle"},
    }[fid]
    assert not {n for _, n in got} & never, sorted({n for _, n in got} & never)


# --- parity_check ----------------------------------------------------------------------------------

def test_parity_check():
    m = fam("parity_check")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        rows, pbyte = p["rows"], p["pbyte"]
        n = len(rows)
        assert 4 <= n <= 6 and all(len(r) == 8 and set(r) <= {0, 1} for r in rows + [pbyte])
        assert p["band"] in ("UP", "LS")
        if p["parity"] == "odd":
            assert n % 2 == 1, s  # with an even number of bytes an odd parity byte could not be odd itself
        if p["mode"] == "error":
            want = 0 if p["parity"] == "even" else 1
            bad_rows = [i for i, r in enumerate(rows) if sum(r) % 2 != want]
            bad_cols = [j for j in range(8) if (sum(r[j] for r in rows) + pbyte[j]) % 2 != want]
            assert sum(pbyte) % 2 == want, s  # the parity byte has the block's parity itself
            assert len(bad_rows) == 1 and len(bad_cols) == 1, (s, bad_rows, bad_cols)
            r, c = bad_rows[0], bad_cols[0]
            fixed = list(rows[r])
            fixed[c] = 1 - fixed[c]
            sent = "".join(map(str, fixed))
            bit = "Parity bit" if c == 0 else f"Bit {c + 1}"
            for q in qs:
                if "Which byte contains the error" in q.stem:
                    seen.add("byte")
                    assert q.answer == f"Byte {r + 1}" and str(r + 1) in q.accepted, (s, q.answer)
                if "Which column holds the changed bit" in q.stem:
                    seen.add("bit")
                    assert q.answer == bit, (s, q.answer, bit)
                    assert (str(c + 1) in q.accepted) and (f"bit {c + 1}" in q.accepted)
                    if c == 0:  # as a reviewer would write it (blind review)
                        assert {"parity bit column", "the parity bit", "parity bit"} <= set(q.accepted), q.accepted
                if "as it was sent" in q.stem:
                    seen.add("fix")
                    assert q.answer == sent and f"{sent[:4]} {sent[4:]}" in q.accepted, (s, q.answer, sent)
                got = re.search(r"What does the block show about byte (\d)\?", q.stem)
                if got:
                    k = int(got.group(1)) - 1
                    seen.add("status-bad" if k == r else "status-ok")
                    key = (f"Byte {k + 1} was received correctly" if k != r else
                           f"Byte {k + 1} has an error in its parity bit" if c == 0 else
                           f"Byte {k + 1} has an error in one of bits 2 to 8")
                    assert picked(q) == key, (s, q.options, key)
                assert f"{p['parity']} parity" in q.stem or q is not qs[0], (s, q.stem)  # the convention is stated
        else:
            k = p["blank"]
            parities = {sum(r) % 2 for i, r in enumerate(rows) if i != k}
            assert len(parities) == 1, s  # the complete bytes all have one parity
            want = parities.pop()
            parity = "even" if want == 0 else "odd"
            assert parity == p["parity"]
            missing = (want - sum(rows[k][1:])) % 2
            assert rows[k][0] == missing
            byte = [(want - sum(r[j] for r in rows)) % 2 for j in range(8)]
            assert byte == pbyte and sum(byte) % 2 == want
            for q in qs:
                if "even or odd parity" in q.stem:
                    seen.add("which")
                    assert q.answer == parity and f"{parity} parity" in q.accepted
                if "missing parity bit of byte" in q.stem:
                    seen.add("missing")
                    assert f"byte {k + 1}?" in q.stem and q.answer == str(missing)
                if "parity byte" in q.stem and "8 bits" in q.stem:
                    seen.add("pbyte")
                    assert q.answer == "".join(map(str, byte))
        if s <= DRAWN:
            g, _ = drawn(m, p)
            for i, r in enumerate(rows):
                for j, b in enumerate(r):
                    shown = g[f"bit:{i}:{j}"]
                    assert shown == ("?" if p["mode"] == "missing" and i == p["blank"] and j == 0 else str(b)), (s, i, j)
            for j, b in enumerate(pbyte):
                assert g[f"bit:P:{j}"] == ("?" if p["mode"] == "missing" else str(b))
            assert ("parity" in g) == (p["mode"] == "error"), s  # stated only where it is not asked
            if p["mode"] == "error":
                assert p["parity"] in g["parity"].lower()
    assert seen == {"byte", "bit", "fix", "status-ok", "status-bad", "which", "missing", "pbyte"}, seen


# --- ip_address ------------------------------------------------------------------------------------

def host_ok(addr: str, net) -> bool:
    """A usable host address of this subnet: parses, lies in it, and is neither its network nor its broadcast address."""
    try:
        a = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return a in net and a not in (net.network_address, net.broadcast_address)


def test_ip_address():
    m = fam("ip_address")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        net = ipaddress.ip_network(f"{p['router']}/{p['prefix']}", strict=False)
        assert host_ok(p["router"], net) and net.is_private
        if p["band"] == "UP":
            assert p["prefix"] in (16, 24), s
        hosts = dict(p["hosts"])
        assert 3 <= len(hosts) <= 5 and len(set(hosts.values())) == len(hosts) and p["router"] not in hosts.values()
        bad = [d for d, a in hosts.items() if not host_ok(a, net)]
        if p["mode"] == "clean":
            assert not bad, s
        else:
            assert bad == [p["odd"]], (s, bad)
            a = hosts[p["odd"]]
            if p["mode"] == "offnet":  # a usable address, but of another subnet
                other = ipaddress.ip_network(f"{a}/{p['prefix']}", strict=False)
                assert other != net and host_ok(a, other) and other.is_private, (s, a)
            else:  # cannot be any host's: an octet past 255, or this subnet's network or broadcast address
                try:
                    v = ipaddress.ip_address(a)
                    assert v in (net.network_address, net.broadcast_address), (s, a)
                except ValueError:
                    assert any(int(o) > 255 for o in a.split(".")), (s, a)
        for q in qs:
            got = re.search(r"network address of the subnet that the device labelled (.+?) is on\?", q.stem)
            if got:
                seen.add("network")
                dev = got.group(1)
                addr = hosts[dev]
                assert host_ok(addr, net), (s, dev)
                assert q.answer == str(ipaddress.ip_network(f"{addr}/{p['prefix']}", strict=False).network_address)
                assert q.answer == str(net.network_address)
            if "usable host addresses" in q.stem:
                seen.add("hosts")
                assert "network address and the broadcast address" in q.stem
                assert int(q.answer) == net.num_addresses - 2
            if "not on the same subnet as the router" in q.stem:
                seen.add("offnet")
                assert p["mode"] == "offnet" and picked(q) == p["odd"]
                assert all(o in hosts for o in q.options)
                assert all(host_ok(hosts[o], net) for o in q.options if o != picked(q))
            if "cannot be used by any host" in q.stem:
                seen.add("invalid")
                assert p["mode"] == "invalid" and picked(q) == p["odd"]
                assert all(o in hosts and host_ok(hosts[o], net) for o in q.options if o != picked(q))
            if "could be given to a new" in q.stem:
                seen.add("new")
                assert p["mode"] == "clean"
                used = set(hosts.values()) | {p["router"]}
                good = [o for o in q.options if host_ok(o, net) and o not in used]
                assert good == [picked(q)], (s, q.options)
        if s <= DRAWN:
            g, _ = drawn(m, p)
            assert g["addr:the router"] == p["router"]
            for d, a in hosts.items():
                assert g[f"addr:{d}"] == a and g[f"name:{d}"] == d, (s, d)
            assert str(net.netmask) in g["mask"] and f"/{p['prefix']}" in g["mask"], (s, g["mask"])
    assert seen == {"network", "hosts", "offnet", "invalid", "new"}, seen


# --- linked_list_array -----------------------------------------------------------------------------

def follow(pointer, start):
    out, i = [], start
    while i != -1:
        assert i not in out, "a loop"
        out.append(i)
        i = pointer[i]
    return out


def test_linked_list_array():
    m = fam("linked_list_array")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        data, ptr = p["data"], p["pointer"]
        n = len(data)
        assert 8 <= n <= 10 and len(ptr) == n and p["band"] == "AL"
        used, free = follow(ptr, p["start"]), follow(ptr, p["free"])
        assert sorted(used + free) == list(range(n)), s  # every node is in the list or in the free list
        assert 5 <= len(used) <= 7 and len(free) >= 1
        assert all(data[i] for i in used) and not any(data[i] for i in free)
        items = [data[i] for i in used]
        assert len(set(items)) == len(items)
        assert items != [d for d in data if d], s  # the table's order is not the list's
        for q in qs:
            if "In what order" in q.stem:
                seen.add("order")
                assert picked(q) == ", ".join(items)
                assert ", ".join(d for d in data if d) in q.options or ", ".join(reversed(items)) in q.options
            got = re.search(r"Which item is (\w+) in the linked list\?", q.stem)
            if got:
                seen.add("position")
                k = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"].index(got.group(1))
                assert k >= 1 and q.answer == items[k] and data[k] != items[k], (s, k)
            got = re.search(r"A new item, (\w+), is added straight after (\w+)", q.stem)
            if got:
                new, after = got.groups()
                assert new not in items and after in items
                prev = data.index(after)
                node = p["free"]  # the new item goes in the first free node
                after_ptr, new_ptr, next_free = node, ptr[prev], ptr[node]
                ask = re.search(r"What is (.+?) now\?", q.stem).group(1)
                key = {f"the Pointer of the node holding {after}": after_ptr,
                       f"the Pointer of the node holding {new}": new_ptr, "FreeListPointer": next_free}[ask]
                seen.add("insert:" + ("after" if ask.endswith(after) else "new" if ask.endswith(new) else "free"))
                assert picked(q) == str(key), (s, ask, q.options, key)
                assert len(set(q.options)) == len(q.options)
            if "deletes the first item" in q.stem:
                seen.add("delete")
                assert int(q.answer) == ptr[p["start"]]
        if s <= DRAWN:
            g, _ = drawn(m, p)
            assert g["start"] == str(p["start"]) and g["free"] == str(p["free"])
            for i in range(n):
                assert g[f"data:{i}"] == data[i] and g[f"ptr:{i}"] == str(ptr[i]) and g[f"index:{i}"] == str(i)
    assert seen == {"order", "position", "insert:after", "insert:new", "insert:free", "delete"}, seen


# --- hash_table ------------------------------------------------------------------------------------

def test_hash_table():
    m = fam("hash_table")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        n, table, keys = p["n"], list(p["table"]), p["keys"]
        assert 7 <= n <= 11 and len(table) == n
        if p["band"] == "UP":
            assert n in (8, 10)
        before = [k for k in table if k is not None]
        assert all(table[i] % n == i for i in range(n) if table[i] is not None)  # earlier keys sit where they hashed
        assert len(set(keys + before)) == len(keys) + len(before)
        slot, collided = {}, []
        for k in keys:
            h = k % n
            if table[h] is not None:
                collided.append(k)
            while table[h] is not None:
                h = (h + 1) % n
            table[h] = k
            slot[k] = h
        filled = sum(v is not None for v in table)
        assert 1 <= len(collided) <= 4 and filled < n, s
        for q in qs:
            got = re.search(r"In which slot is key (\d+) stored\?", q.stem)
            if got:
                seen.add("slot")
                assert int(q.answer) == slot[int(got.group(1))]
            if "How many of the keys" in q.stem:
                seen.add("collisions")
                assert int(q.answer) == len(collided)
            got = re.search(r"Where does key (\d+) end up\?", q.stem)
            if got:
                y = int(got.group(1))
                seen.add("probe-wrap" if slot[y] < y % n else "probe")
                assert y in collided and picked(q) == f"Slot {slot[y]}", (s, y, q.options)
                assert f"Slot {y % n}" in q.options  # the hashed slot, already full, is a plausible mistake
            if "load factor" in q.stem:
                seen.add("load")
                assert n in (8, 10)
                assert Fraction(q.answer) == Fraction(filled, n), (s, q.answer)
                assert "slots in use ÷ the number of slots" in q.stem
            if "still empty" in q.stem:
                seen.add("empty")
                assert int(q.answer) == n - filled
        if s <= DRAWN:
            g, _ = drawn(m, p)
            assert f"MOD {n}" in g["hash"]
            assert re.findall(r"\d+", g["keys"]) == [str(k) for k in keys]
            assert f"slot {n - 1}" in g["probe"] and "slot 0" in g["probe"]
            for i, k in enumerate(p["table"]):
                assert g[f"slot:{i}"] == ("" if k is None else str(k)), (s, i)
    assert seen == {"slot", "collisions", "probe", "probe-wrap", "load", "empty"}, seen


# --- er_normalisation ------------------------------------------------------------------------------

def closure(attrs, fds):
    out = set(attrs)
    changed = True
    while changed:
        changed = False
        for lhs, rhs in fds:
            if set(lhs) <= out and not set(rhs) <= out:
                out |= set(rhs)
                changed = True
    return out


def normal_form(attrs, key, group, fds) -> str:
    if group:
        return "UNF"
    nonkey = set(attrs) - set(key)
    if any(set(lhs) < set(key) and set(rhs) & nonkey for lhs, rhs in fds):
        return "1NF"
    if any(set(lhs) <= nonkey and (set(rhs) - set(lhs)) & nonkey for lhs, rhs in fds):
        return "2NF"
    return "3NF"


def third_nf_tables(attrs, fds) -> int:
    """Bernstein's synthesis: a minimal cover, one table per determinant, a key table if none holds a key."""
    cover = [(frozenset(lhs), a) for lhs, rhs in fds for a in rhs if a not in lhs]
    changed = True
    while changed:  # extraneous attributes on the left
        changed = False
        for i, (lhs, a) in enumerate(cover):
            for x in lhs:
                if len(lhs) > 1 and a in closure(lhs - {x}, [(list(l), [b]) for l, b in cover]):
                    cover[i] = (lhs - {x}, a)
                    changed = True
                    break
    for f in list(cover):  # redundant dependencies
        rest = [g for g in cover if g != f]
        if f[1] in closure(f[0], [(list(l), [b]) for l, b in rest]):
            cover = rest
    groups = {}
    for lhs, a in cover:
        groups.setdefault(lhs, set(lhs)).add(a)
    tables = list(groups.values())
    flat = [(list(l), [b]) for l, b in cover]
    keys = [set(k) for k in candidate_keys(attrs, flat)]
    if not any(k <= t for k in keys for t in tables):
        tables.append(keys[0])
    tables = [t for t in tables if not any(t < u for u in tables)]
    return len(tables)


def candidate_keys(attrs, fds):
    import itertools
    attrs = list(attrs)
    found = []
    for size in range(1, len(attrs) + 1):
        for combo in itertools.combinations(attrs, size):
            if closure(combo, fds) >= set(attrs) and not any(set(k) <= set(combo) for k in found):
                found.append(combo)
        if found:
            break
    return found


NF_OPTIONS = ["UNF (unnormalised)", "1NF", "2NF", "3NF"]


def test_er_normalisation():
    m = fam("er_normalisation")
    seen = set()
    for s in SEEDS:
        p, qs = run(m, s)
        if p["view"] == "er":
            ents = {e["name"]: e for e in p["entities"]}
            assert 2 <= len(ents) <= 3
            # The many side of each relationship is the table holding the other's primary key: worked out from the attributes.
            pairs = [(a["name"], b["name"]) for a in ents.values() for b in ents.values()  # one a to many b
                     if a is not b and len(a["key"]) == 1 and a["key"][0] in b["attrs"] and b["key"] != a["key"]]
            assert len(pairs) == len(ents) - 1, (s, pairs)
            assert not any((b, a) in pairs for a, b in pairs), s  # never both ways round
            for a, b in pairs:
                assert {"one": a, "many": b} in p["links"]
            for q in qs:
                got = re.search(r"relationship between (\w+) and (\w+)\?", q.stem)
                if got:
                    x, y = got.groups()
                    if (x, y) in pairs:
                        key = f"One {x} record is linked to many {y} records"
                        seen.add("rel-forward")
                    else:
                        assert (y, x) in pairs
                        key = f"One {y} record is linked to many {x} records"
                        seen.add("rel-reversed")
                    assert picked(q) == key, (s, q.options)
                    assert f"Many {x} records are linked to many {y} records" in q.options or \
                           f"One {x} record is linked to one {y} record" in q.options
                got = re.search(r"Which attribute in (\w+) is the foreign key that links it to (\w+)\?", q.stem)
                if got:
                    seen.add("fk")
                    t, parent = got.groups()
                    assert (parent, t) in pairs
                    assert q.answer == ents[parent]["key"][0] and q.answer in ents[t]["attrs"]
                if "foreign key that links the two tables" in q.stem:
                    seen.add("fk2")
                    assert len(pairs) == 1
                    assert q.answer == ents[pairs[0][0]]["key"][0]
            if s <= DRAWN:
                g, lines = drawn(m, p)
                for e in ents.values():
                    assert g[f"entity:{e['name']}"] == e["name"]
                    for a in e["attrs"]:
                        assert g[f"attr:{e['name']}:{a}"] == a
                    for a in e["key"]:
                        assert f"key:{e['name']}:{a}" in lines, (s, e["name"], a)  # the primary key is underlined
                for a, b in pairs:
                    assert f"crow:{a}>{b}" in lines, (s, a, b, lines)  # the crow's foot at the many end
                    assert f"crow:{b}>{a}" not in lines
        else:
            attrs, key, group = p["attrs"], p["key"], p["group"]
            fds = [(lhs, rhs) for lhs, rhs in p["fds"]]
            assert all(set(lhs) | set(rhs) <= set(attrs) for lhs, rhs in fds)
            # The underlined key is the candidate key the dependencies imply, unnormalised tables too (blind review): it
            # decides every attribute, and no part of it does.
            assert [set(k) for k in candidate_keys(attrs, fds)] == [set(key)], (s, key, candidate_keys(attrs, fds))
            assert not any(closure(set(key) - {a}, fds) == set(attrs) for a in key), (s, key)
            nf = normal_form(attrs, key, group, fds)
            rows = p["rows"]
            filled = []
            for r in rows:
                assert len(r) == len(attrs) and all(r), (s, r)  # no blank cells: a blank reads as visual grouping
                lists = {a: r[attrs.index(a)].split(", ") for a in attrs}
                if group:  # the repeating group sits in its record's cells, several values to a cell
                    sizes = {len(lists[a]) for a in group}
                    assert len(sizes) == 1 and all(len(lists[a]) == 1 for a in attrs if a not in group), (s, r)
                    for i in range(sizes.pop()):
                        filled.append([lists[a][i] if a in group else lists[a][0] for a in attrs])
                else:
                    assert all(len(v) == 1 for v in lists.values()), (s, r)  # 1NF and beyond: one value to a cell
                    filled.append(r)
            if group:
                assert any(", " in r[attrs.index(group[0])] for r in rows), s  # a group repeats in some record
            assert len({tuple(r[attrs.index(a)] for a in key) for r in filled}) == len(filled), s  # the key is unique
            for lhs, rhs in fds:  # the data agree with every dependency listed
                seen_map = {}
                for r in filled:
                    k = tuple(r[attrs.index(a)] for a in lhs)
                    v = tuple(r[attrs.index(a)] for a in rhs)
                    assert seen_map.setdefault(k, v) == v, (s, lhs, rhs)
            count = third_nf_tables(attrs, fds)
            for q in qs:
                assert "Which normal form" not in q.stem  # a 3NF table is in 1NF and 2NF too: the highest is asked
                if "highest normal form" in q.stem:
                    seen.add("nf:" + nf)
                    assert picked(q) == {"UNF": NF_OPTIONS[0]}.get(nf, nf) and sorted(q.options) == sorted(NF_OPTIONS)
                if "How many tables" in q.stem:
                    seen.add("count")
                    assert int(q.answer) == count, (s, q.answer, p["table"], nf)
            # one table is no question: the table is already normalised (blind review)
            assert any("How many tables" in q.stem for q in qs) == (count > 1), (s, count)
            if s <= DRAWN:
                g, lines = drawn(m, p)
                for j, a in enumerate(attrs):
                    assert g[f"head:{a}"] == a
                    assert (f"key:{p['table']}:{a}" in lines) == (a in key), (s, a)
                for i, r in enumerate(rows):
                    for j, v in enumerate(r):
                        assert g.get(f"cell:{i}:{j}", "") == v, (s, i, j)
                for i, (lhs, rhs) in enumerate(fds):
                    assert g[f"fd:{i}"] == f"{', '.join(lhs)} → {', '.join(rhs)}"
    assert {"rel-forward", "rel-reversed", "fk", "fk2", "count", "nf:UNF", "nf:1NF", "nf:2NF", "nf:3NF"} <= seen, seen
