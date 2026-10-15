"""A family tree of three generations (P, Primary Social Studies): a grandfather and a grandmother joined as a married
couple, their children below them, and their grandchildren below those, each name in a box joined to its parent by a
line. A box with round ends is a girl or woman and a square box a boy or man, as the key under the tree says. One
grandchild drew the tree: the first question names them.

Lower (P1 to P3): two children and three or four grandchildren. Upper: three children (one may have no children of
their own) and five or six grandchildren, and the words niece, nephew and the number of cousins.

- Who is Keza's grandmother (grandfather)? The wrong names are the other grandparent, a woman (man) one row down, and
  a girl (boy) in Keza's own row.
- How many grandchildren does a grandparent have, how many children does a parent have, or (upper) how many cousins
  does a grandchild have?
- What is one person to another: aunt, uncle, cousin, sister, brother (upper: niece, nephew)? Worked out from who is
  whose child; the wrong words are the slips (the other sex, the other row, a sister for a cousin).
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch

from ..core import INK, mcq, new_figure, short

ID = "family_tree_p"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("P",)
CONCEPTS = tuple(f"social-studies.{c}" for c in ("family-members-relationships", "extended-family-structure"))
# A topic whose sections the book lists is reached only if its name or a section names family members or the tree.
NEEDS = r"family members|extended family|nuclear family|family (?:relationship )?tree"
AVOID = (r"\bgod\b|god's|bible|qur'?an|prayer|faith|\bsin\b|creation|commandment|charity|"
         r"democracy and governance|community helpers|rights and responsibilities|historical events")

# The grandchild who drew the tree: names whose sex is plain, so the stem can say "her" or "his".
GIRLS = ["Aline", "Grace", "Uwase", "Keza", "Teta", "Mutoni", "Ingabire", "Umutoni"]
BOYS = ["Eric", "Mugisha", "Kevin", "Jean", "Gasana", "Kalisa", "Habimana"]
# Everyone else in the tree: Rwandan names, by generation, none of them a questioner's name.
GRANDMOTHERS = ["Mukamana", "Nyiraneza", "Murekatete", "Mukeshimana", "Mukarugwiza", "Nyiramana"]
GRANDFATHERS = ["Bizimana", "Hakizimana", "Nkurunziza", "Sibomana", "Gakwaya", "Kagabo", "Ndayisaba"]
WOMEN = ["Uwera", "Kayitesi", "Uwamahoro", "Mutesi", "Umurerwa", "Umuhoza", "Uwimana", "Murekezi"]
MEN = ["Mugabo", "Kamanzi", "Niyonzima", "Rukundo", "Ntwari", "Mugenzi", "Rwema", "Habineza"]
GIRLS3 = ["Isimbi", "Ineza", "Iriza", "Gaju", "Shimwa", "Kirezi", "Umwali"]
BOYS3 = ["Shema", "Hirwa", "Cyusa", "Ganza", "Manzi", "Mucyo", "Kwizera"]

# The slips a child makes for each word: the other sex, the other row, a brother or sister for a cousin.
SLIPS = {"aunt": ["uncle", "cousin", "sister"], "uncle": ["aunt", "cousin", "brother"],
         "sister": ["cousin", "aunt", "brother"], "brother": ["cousin", "uncle", "sister"],
         "niece": ["cousin", "daughter", "nephew"], "nephew": ["cousin", "son", "niece"]}


def stages(p: dict) -> tuple[int, int] | None:
    return (2, 6) if p["level"] == "upper" else None


def parents(people: list, i: int) -> set:
    if people[i]["gen"] == 2:
        return {j for j, q in enumerate(people) if q["gen"] == 1}
    if people[i]["gen"] == 3:
        return {people[i]["parent"]}
    return set()


def relation(people: list, y: int, z: int) -> str | None:
    """What y is to z."""
    gy, gz, f = people[y]["gen"], people[z]["gen"], people[y]["sex"] == "F"
    if gy == 1 and gz == 3:
        return "grandmother" if f else "grandfather"
    if gy == 1 and gz == 2:
        return "mother" if f else "father"
    if gy == 2 and gz == 3:
        return ("mother" if f else "father") if y in parents(people, z) else ("aunt" if f else "uncle")
    if gy == gz and gy > 1:
        return ("sister" if f else "brother") if parents(people, y) == parents(people, z) else "cousin"
    if gy == 3 and gz == 2:
        return ("daughter" if f else "son") if z in parents(people, y) else ("niece" if f else "nephew")
    return None


def sample(rng: random.Random) -> dict:
    level = rng.choice(["lower", "upper"])
    while True:
        n2 = 2 if level == "lower" else 3
        n3 = rng.randint(3, 4) if level == "lower" else rng.randint(5, 6)
        with_kids = n2 if level == "lower" else rng.choice([2, 3])
        split = [1] * with_kids
        for _ in range(n3 - with_kids):
            split[rng.randrange(with_kids)] += 1
        if max(split) > 3:
            continue
        split += [0] * (n2 - with_kids)
        rng.shuffle(split)
        gp = [{"name": rng.choice(GRANDFATHERS), "sex": "M", "gen": 1, "parent": None},
              {"name": rng.choice(GRANDMOTHERS), "sex": "F", "gen": 1, "parent": None}]
        rng.shuffle(gp)
        women, men, girls, boys = (rng.sample(x, len(x)) for x in (WOMEN, MEN, GIRLS3, BOYS3))
        people = list(gp)
        for k in split:
            sex = rng.choice("FM")
            people.append({"name": (women if sex == "F" else men).pop(), "sex": sex, "gen": 2, "parent": None})
            me_parent = len(people) - 1
            for _ in range(k):
                sex = rng.choice("FM")
                people.append({"name": (girls if sex == "F" else boys).pop(), "sex": sex, "gen": 3, "parent": me_parent})
        grandkids = [i for i, q in enumerate(people) if q["gen"] == 3]
        me = rng.choice(grandkids)
        people[me]["name"] = rng.choice(GIRLS if people[me]["sex"] == "F" else BOYS)
        words = ["aunt", "uncle", "cousin", "sister", "brother"] + (["niece", "nephew"] if level == "upper" else [])
        found = {}
        for y in range(len(people)):
            for z in range(len(people)):
                r = relation(people, y, z) if y != z else None
                if r in words and people[z]["gen"] >= 2:
                    found.setdefault(r, []).append((y, z))
        if not found:
            continue
        word = rng.choice(sorted(found))
        pairs = found[word]
        mine = [pr for pr in pairs if pr[1] == me]
        y, z = rng.choice(mine if mine and rng.random() < 0.6 else pairs)
        counts = [["grandchildren", rng.choice([0, 1])]]
        counts += [["children", i] for i, q in enumerate(people) if q["gen"] == 2 and any(r["parent"] == i for r in people)]
        if level == "upper":
            counts += [["cousins", i] for i in grandkids if any(relation(people, j, i) == "cousin" for j in grandkids)]
        return {"band": "P", "level": level, "people": people, "me": me,
                "ask_gp": rng.choice(["grandmother", "grandfather"]), "ask_count": rng.choice(counts), "ask_rel": [y, z]}


# --- drawing ----------------------------------------------------------------------------------------

SLOT, BOXW, BOXH, GAP = 2.35, 2.0, 0.7, 0.5
BOXW1 = 2.5  # a grandparent's box: the longest names
Y1, Y2, Y3 = 4.4, 2.4, 0.4
FEMALE, MALE = "#fbe3cf", "#dbe9f6"


def layout(p: dict) -> dict:
    """Where each box's centre is."""
    people = p["people"]
    pos, x = {}, 0.0
    for i, q in enumerate(people):
        if q["gen"] != 2:
            continue
        kids = [j for j, r in enumerate(people) if r["gen"] == 3 and r["parent"] == i]
        for n, j in enumerate(kids):
            pos[j] = (x + n * SLOT, Y3)
        width = max(1, len(kids))
        pos[i] = (x + (width - 1) * SLOT / 2, Y2)
        x += width * SLOT + GAP
    xs = [pos[i][0] for i, q in enumerate(people) if q["gen"] == 2]
    mid = (min(xs) + max(xs)) / 2
    gp = [i for i, q in enumerate(people) if q["gen"] == 1]
    pos[gp[0]], pos[gp[1]] = (mid - 1.9, Y1), (mid + 1.9, Y1)
    return pos


def _box(ax, x, y, sex, gid, w=BOXW):
    style = "round,pad=0,rounding_size=0.3" if sex == "F" else "square,pad=0"
    ax.add_patch(FancyBboxPatch((x - w / 2, y - BOXH / 2), w, BOXH, boxstyle=style,
                                facecolor=FEMALE if sex == "F" else MALE, edgecolor=INK, linewidth=1.3, zorder=3, gid=gid))


def draw(p: dict):
    people = p["people"]
    pos = layout(p)
    fig, ax = new_figure(10.0, 4.9)
    fig.subplots_adjust(left=0.01, right=0.99, bottom=0.01, top=0.99)
    gp = [i for i, q in enumerate(people) if q["gen"] == 1]
    (xa, _), (xb, _) = pos[gp[0]], pos[gp[1]]
    mid = (xa + xb) / 2
    for dy in (0.05, -0.05):  # the married couple, joined by a double line
        ax.plot([xa + BOXW1 / 2, xb - BOXW1 / 2], [Y1 + dy, Y1 + dy], color=INK, linewidth=1.4, zorder=2)
    ax.text(mid, Y1 + 0.3, "married", ha="center", va="center", fontsize=10, style="italic")
    bar1 = (Y1 - BOXH / 2 + Y2 + BOXH / 2) / 2
    bar2 = (Y2 - BOXH / 2 + Y3 + BOXH / 2) / 2
    for i, q in enumerate(people):
        x, y = pos[i]
        if q["gen"] == 2:
            ax.plot([mid, mid, x, x], [Y1 - 0.05, bar1, bar1, y + BOXH / 2], color=INK, linewidth=1.3, zorder=1,
                    gid=f"link:couple>{i}")
        elif q["gen"] == 3:
            px = pos[q["parent"]][0]
            ax.plot([px, px, x, x], [Y2 - BOXH / 2, bar2, bar2, y + BOXH / 2], color=INK, linewidth=1.3, zorder=1,
                    gid=f"link:{q['parent']}>{i}")
        _box(ax, x, y, q["sex"], f"box:{i}:{q['sex']}", BOXW1 if q["gen"] == 1 else BOXW)
        ax.text(x, y, q["name"], ha="center", va="center", fontsize=11, zorder=4, gid=f"person:{i}")
    me = people[p["me"]]["name"]
    xs = [v[0] for v in pos.values()]
    left, right = min(xs) - BOXW1 / 2, max(xs) + BOXW1 / 2
    ax.text((left + right) / 2, Y1 + 0.95, f"{me}'s family tree", ha="center", va="center", fontsize=13,
            fontweight="bold")
    # the key, under the tree
    ky = Y3 - 1.0
    kx = (left + right) / 2 - 3.4
    for sex, label, dx in (("F", "girl or woman", 0.0), ("M", "boy or man", 3.6)):
        style = "round,pad=0,rounding_size=0.2" if sex == "F" else "square,pad=0"
        ax.add_patch(FancyBboxPatch((kx + dx, ky - 0.22), 0.9, 0.44, boxstyle=style, facecolor=FEMALE if sex == "F" else MALE,
                                    edgecolor=INK, linewidth=1.2, gid=f"keybox:{sex}"))
        ax.text(kx + dx + 1.1, ky, label, ha="left", va="center", fontsize=10.5)
    ax.set_xlim(min(left, kx) - 0.2, max(right, kx + 6.6) + 0.2)
    ax.set_ylim(ky - 0.45, Y1 + 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["for a Social Studies lesson", "for homework", "to show the class", "for a lesson about the extended family",
            "after a family visit", "for a class display", "during the school holidays", "for a lesson in Huye"]
VERBS = ["drew", "made", "wrote out"]


def questions(p: dict, rng: random.Random) -> list:
    people = p["people"]
    names = [q["name"] for q in people]
    me = p["me"]
    pron = "her" if people[me]["sex"] == "F" else "his"
    qs = []

    # 1. a grandparent of the grandchild who drew the tree
    word = p["ask_gp"]
    sex = "F" if word == "grandmother" else "M"
    key = next(i for i, q in enumerate(people) if q["gen"] == 1 and q["sex"] == sex)
    other = next(i for i, q in enumerate(people) if q["gen"] == 1 and q["sex"] != sex)
    row2 = [i for i, q in enumerate(people) if q["gen"] == 2]
    row3 = [i for i, q in enumerate(people) if q["gen"] == 3 and i != me]
    rng.shuffle(row2)
    rng.shuffle(row3)
    row2.sort(key=lambda i: people[i]["sex"] != sex)  # a woman one row down, for a grandmother
    row3.sort(key=lambda i: people[i]["sex"] != sex)
    qs.append(mcq(f"{names[me]} {rng.choice(VERBS)} {pron} family tree {rng.choice(SETTINGS)}. Who is {names[me]}'s "
                  f"{word}?", names[key], [names[other], names[row2[0]], names[row3[0]]], rng))

    # 2. a count
    what, i = p["ask_count"]
    if what == "grandchildren":
        i = [j for j, q in enumerate(people) if q["gen"] == 1][i]
        n = sum(1 for q in people if q["gen"] == 3)
    elif what == "children":
        n = sum(1 for q in people if q["gen"] == 3 and q["parent"] == i)
    else:
        n = sum(1 for j in range(len(people)) if j != i and relation(people, j, i) == "cousin")
    one = {"grandchildren": "grandchild", "children": "child", "cousins": "cousin"}[what]
    qs.append(short(f"How many {what} does {names[i]} have?", n, [f"{n} {what if n != 1 else one}"]))

    # 3. what one person is to another
    y, z = p["ask_rel"]
    key = relation(people, y, z)
    if key == "cousin":
        slips = ["sister", "aunt", "brother"] if people[y]["sex"] == "F" else ["brother", "uncle", "sister"]
    else:
        slips = SLIPS[key]
    qs.append(mcq(f"What is {names[y]} to {names[z]}?", key, slips, rng))
    return qs
