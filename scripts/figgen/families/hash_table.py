"""Hash tables (AL, UP): a hash table of 7 to 11 slots (8 or 10 at upper secondary) holding records by their key, with
the hash function printed (Key MOD n), the rule for collisions (linear probing, wrapping from the last slot to slot 0),
the keys already stored, and four to six keys to insert in a given order.

Which slot a key that hashes cleanly goes in, how many of the keys find their hashed slot already full, where a key
that collided ends up after probing (the hashed slot, the next slot and an unwrapped slot number are the slips
offered), and the load factor (filled slots ÷ slots; asked only where it terminates) or the number of empty slots.

Every key is the keys inserted one by one: each collision is a key whose hashed slot is full, and one to four of
them collide. The table never fills.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, exact, mcq, new_figure, short

ID = "hash_table"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("hash-tables", "records-data-structure", "file-management", "data-management"))
# A topic whose sections the book lists is reached only if one names hashing, file organisation, records or ADTs.
NEEDS = r"hash|file organi[sz]ation|file access|file processing|\brecords?\b|data structure|abstract data|\badt"
# Topics listed without sections that share the data-management concept but teach no hashing.
AVOID = (r"network|internet|security|spreadsheet|graphic|\bpresentation|e-?mail|html|logic gate|boolean|python|java|c\+\+|word|"
         r"folder|navigation|google|excel|data management|project management|mail merge|expert system|modelling|life cycle|"
         r"data processing|data, information|sql|query|queries")
CONTEXTS = ["student records at a Huye school", "member records of a Musanze cooperative", "patient records at a Rubavu clinic",
            "savings accounts at a Kigali SACCO", "book records in a Nyagatare school library", "farm records at a Kayonza dairy"]
LIGHT = "#d9dee3"


def insert_all(n: int, table: list, keys: list) -> tuple[list, dict, list]:
    """The table after inserting the keys in order, each key's slot, and the keys whose hashed slot was full."""
    t, slot, collided = list(table), {}, []
    for k in keys:
        h = k % n
        if t[h] is not None:
            collided.append(k)
        while t[h] is not None:
            h = (h + 1) % n
        t[h], slot[k] = k, h
    return t, slot, collided


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    n = rng.choice([8, 10]) if band == "UP" else rng.choice([7, 8, 9, 10, 11])
    top = 99 if band == "UP" else 199
    while True:
        table = [None] * n
        stored = rng.randint(1, min(3, n - 5))  # room for four keys and an empty slot
        for s in rng.sample(range(n), stored):
            table[s] = rng.choice([v for v in range(10, top + 1) if v % n == s])
        before = [v for v in table if v is not None]
        # at least one slot stays empty, so probing always ends
        keys = rng.sample([v for v in range(10, top + 1) if v not in before], rng.randint(4, min(6, n - 1 - stored)))
        t, slot, collided = insert_all(n, table, keys)
        clean = [k for k in keys if k not in collided]
        if not 1 <= len(collided) <= 4 or None not in t or not clean:
            continue
        wrapped = [k for k in collided if slot[k] < k % n]
        probe = rng.choice(wrapped if wrapped and rng.random() < 0.5 else collided)
        return {"band": band, "n": n, "table": table, "keys": keys, "ask": rng.choice(clean), "probe": probe,
                "context": rng.choice(CONTEXTS)}


def draw(p: dict):
    n, table = p["n"], p["table"]
    widths, rh = [1.2, 1.9], 0.48
    x0 = 6.6
    top = rh * (n + 1)
    width = x0 + sum(widths)
    height = max(top, 5.4)
    k = 0.66
    fig, ax = new_figure((width + 0.4) * k, (height + 1.5) * k)
    ax.set_position([0, 0, 1, 1])
    ax.text(width / 2, height + 0.9, f"A hash table of {p['context']}", ha="center", va="center", fontsize=11.5,
            fontweight="bold")
    y = height - 0.3
    ax.text(0, y, "Hash function", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.2, y - 0.55, f"Hash(Key) = Key MOD {n}", ha="left", va="center", fontsize=11, family="monospace", gid="hash")
    ax.text(0, y - 1.35, "Collisions", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.2, y - 2.05, f"Linear probing: try the next slot down;\nafter slot {n - 1}, go back to slot 0.", ha="left",
            va="center", fontsize=10, linespacing=1.4, gid="probe")
    ax.text(0, y - 2.95, "Keys to insert, in this order", ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.2, y - 3.5, ", ".join(map(str, p["keys"])), ha="left", va="center", fontsize=11, family="monospace", gid="keys")
    ax.text(0, y - 4.3, "The keys in the table are already stored.", ha="left", va="center", fontsize=9.5, fontstyle="italic")
    x = x0
    for c, (h, w) in enumerate(zip(["Slot", "Key"], widths)):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor=LIGHT, edgecolor=INK, linewidth=1.0))
        ax.text(x + w / 2, top - rh / 2, h, ha="center", va="center", fontsize=10.5, fontweight="bold")
        for i in range(n):
            yy = top - rh * (i + 2)
            ax.add_patch(Rectangle((x, yy), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            v = str(i) if c == 0 else ("" if table[i] is None else str(table[i]))
            ax.text(x + w / 2, yy + rh / 2, v, ha="center", va="center", fontsize=10.5, family="monospace",
                    color="#555555" if c == 0 else INK, gid=None if c == 0 else f"slot:{i}")
        x += w
    ax.set_xlim(-0.2, width + 0.2)
    ax.set_ylim(-0.1, height + 1.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["fills in", "works through", "completes", "is building", "updates", "traces"]
SETTINGS = ["in a computer science lesson", "for homework", "on a revision card", "at the coding club", "for a class test",
            "during revision", "in a data structures lesson"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    n, keys = p["n"], p["keys"]
    t, slot, collided = insert_all(n, p["table"], keys)
    filled = sum(v is not None for v in t)
    x, y = p["ask"], p["probe"]
    home, at = y % n, slot[y]
    # the hashed slot (no probing), the next slot only, the slot number without wrapping to 0, one slot too far
    slips = [f"Slot {home}", f"Slot {(home + 1) % n}", f"Slot {home + (at - home) % n}", f"Slot {(at + 1) % n}",
             f"Slot {(at - 1) % n}", f"Slot {(home + 2) % n}"]
    qs = [short(f"{who} {rng.choice(VERBS)} the hash table {rng.choice(SETTINGS)}, inserting the keys in the order shown. "
                f"In which slot is key {x} stored?", slot[x], [f"slot {slot[x]}", f"Slot {slot[x]}"]),
          short("How many of the keys to insert find their hashed slot already full?", len(collided),
                [f"{len(collided)} keys", f"{len(collided)} collisions"]),
          mcq(f"{friend} carries on to the end of the list. Where does key {y} end up?", f"Slot {at}", slips, rng)]
    if n in (8, 10):
        load = Fraction(filled, n)
        qs.append(short("The load factor is the number of slots in use ÷ the number of slots. What is the load factor once "
                        "every key is inserted?", exact(float(load)),
                        [f"{load.numerator}/{load.denominator}", f"{filled}/{n}", f"{exact(float(load * 100))}%"]))
    else:
        qs.append(short("How many slots are still empty once every key is inserted?", n - filled,
                        [f"{n - filled} slots"]))
    return qs
