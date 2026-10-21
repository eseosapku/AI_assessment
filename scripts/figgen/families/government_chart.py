"""Government charts (UP; a Primary 6 sub-type): who makes, carries out and interprets the laws, drawn as an
organisation chart with lettered boxes and a printed table of what each part does. Three sub-types.

- ng (UP): the Federal Government of Nigeria under the Constitution of 1999: the National Assembly (the Senate, 109
  members: three from each of the 36 states and one from the Federal Capital Territory, Abuja; the House of
  Representatives, 360 members), the President, Vice-President and Ministers, and the Supreme Court and other
  courts. The arms are lettered A to C in a shuffled order, the two houses D and E; a table prints each arm, what it
  is made up of and its main function. Which letter is the arm that makes (carries out, interprets) laws by the table;
  how many members a lettered house has; the two houses' total; the senators from the 36 states; which letter is the
  arm the two lettered houses belong to.
- un (UP): the six principal organs of the United Nations under its Charter (Article 7), each lettered A to F in a
  shuffled order with its members printed (the General Assembly, all 193 member states; the Security Council, 15
  members, 5 permanent and 10 elected for two years; the Economic and Social Council, 54 members elected for three
  years; the Secretariat, led by the Secretary-General; the International Court of Justice, 15 judges elected for
  nine years; the Trusteeship Council, which suspended its work in 1994), and a table of their functions. Which
  letter is the organ that does a job by the table; which letter is the organ with 5 permanent members; how many
  members a lettered organ has; for how many years a lettered organ's members are elected.
- ng_p (P, Stage 6): Nigeria's three arms in big boxes for Primary 6 (the National Assembly with its two houses, the
  President and ministers, judges and courts), lettered A to C, with a table of what each does in simple words.

Every fact comes from the fixed tables below (SENATE, REPS, UN_ORGANS), checked against the 1999 Constitution of
Nigeria (sections 4, 5, 6, 48, 49) and the UN Charter (Articles 7, 9, 23, 61) and the Statute of the Court
(Articles 3, 13). Every key is decided by the printed chart: the letters are shuffled, so no question is answered
from knowledge alone.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

from ..core import INK, NAMES, Question, new_figure, short

ID = "government_chart"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("P", "UP")
NG_CONCEPTS = ("social-studies.arms-government", "social-studies.nigerian-government")
UN_CONCEPTS = ("social-studies.international-relations", "social-studies.international-cooperation")
P_CONCEPTS = ("social-studies.civics-governance",)
CONCEPTS = NG_CONCEPTS + UN_CONCEPTS + P_CONCEPTS
# A topic whose sections the book lists is reached only if its name or a section names government, governance, the
# constitution, international relations or organisations, or the United Nations.
NEEDS = r"government|governance|constitution|international (relations|organi[sz]ations?)|united nations"
# Topics sharing these concepts that teach political ideas, other countries' systems, civic participation, Rwanda's
# own governance, speech-making, the IMF and World Bank, pluralism, rights, religion, colonialism, a country's foreign
# policy, global issues (climate, trafficking) or law and order instead.
AVOID = (r"political (concepts|theory)|ideolog|comparative|civic participation|good governance|communication|"
         r"financial institution|pluralism|human rights|religio|colonial|foreign policy|global issues|law and order")

# The Constitution of the Federal Republic of Nigeria, 1999: s.48 three senators from each state and one from the FCT;
# s.49 three hundred and sixty members of the House of Representatives.
STATES = 36
SENATE = 3 * STATES + 1
REPS = 360
ARMS = ["Legislature", "Executive", "Judiciary"]
NG_BODY = {"Legislature": "National Assembly", "Executive": "President, Vice-President\nand Ministers",
           "Judiciary": "Supreme Court\nand other courts"}
NG_JOB = {"Legislature": "makes laws", "Executive": "carries out laws", "Judiciary": "interprets laws"}
HOUSES = {"Senate": f"{SENATE} members:\n3 from each of the {STATES} states\nand 1 from the FCT, Abuja",
          "House of Representatives": f"{REPS} members"}
P_BODY = {"Legislature": "National\nAssembly", "Executive": "President\nand ministers", "Judiciary": "Judges\nand courts"}
P_JOB = {"Legislature": "makes the laws", "Executive": "carries out the laws",
         "Judiciary": "explains what the laws mean"}
P_TABLE = {"Legislature": "Makes the laws", "Executive": "Carries out the laws",
           "Judiciary": "Explains what the laws mean and settles quarrels"}
P_MEMBER = {"Legislature": ("the Senate", "belongs to"), "Executive": ("the President", "belongs to"),
            "Judiciary": ("the judges", "work in")}
# The United Nations' principal organs (Charter, Article 7): the name as boxed, the facts printed under it, and its
# main function as the table prints it.
UN_ORGANS = {
    "General Assembly": ("General\nAssembly", "All 193 member\nstates, one\nvote each",
                         "Discusses world problems and approves the UN budget"),
    "Security Council": ("Security\nCouncil", "15 members:\n5 permanent,\n10 elected for\n2 years",
                         "Keeps international peace and security"),
    "Economic and Social Council": ("Economic and\nSocial Council", "54 members,\nelected for\n3 years",
                                    "Coordinates the UN's economic and social work"),
    "Secretariat": ("Secretariat", "Staff led by\nthe Secretary-General", "Runs the UN's day-to-day work"),
    "International Court of Justice": ("International\nCourt of Justice", "15 judges,\nelected for\n9 years",
                                       "Settles legal disputes between countries"),
    "Trusteeship Council": ("Trusteeship\nCouncil", "Suspended its\nwork in 1994",
                            "Supervised trust territories until 1994"),
}
MEMBERS = {"General Assembly": 193, "Security Council": 15, "Economic and Social Council": 54}
YEARS = {"Security Council": 2, "Economic and Social Council": 3, "International Court of Justice": 9}
NIGERIAN = ["Chinedu", "Ngozi", "Emeka", "Amaka", "Tunde", "Bisi", "Musa", "Aisha", "Ifeoma", "Yusuf", "Funmi", "Segun",
            "Halima", "Obinna", "Zainab", "Kelechi", "Bola", "Nkechi", "Sani", "Adaeze"]


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"ng": NG_CONCEPTS, "un": UN_CONCEPTS, "ng_p": P_CONCEPTS}[p["sub"]]


def stages(p: dict) -> tuple[int, int] | None:
    return (6, 6) if p["band"] == "P" else None


def avoid_for(p: dict) -> str:
    # Nigeria's Primary 6 chart is not Rwanda's own "Civics and Governance" (the existing arms_of_government serves it)
    return AVOID + r"|civics" if p["sub"] == "ng_p" else AVOID


def sample(rng: random.Random) -> dict:
    sub = rng.choice(["ng", "un", "ng_p"])
    if sub == "un":
        organs = list(UN_ORGANS)
        rng.shuffle(organs)  # the order the boxes stand in
        letters = dict(zip(organs, rng.sample("ABCDEF", 6)))
        return {"band": "UP", "sub": sub, "order": organs, "letters": letters}
    order = rng.sample(ARMS, 3)
    letters = dict(zip(ARMS, rng.sample("ABC", 3)))
    if sub == "ng":
        houses = rng.sample(["D", "E"], 2)
        letters.update({"Senate": houses[0], "House of Representatives": houses[1]})
        return {"band": "UP", "sub": sub, "order": order, "letters": letters,
                "house_order": rng.sample(list(HOUSES), 2)}
    return {"band": "P", "sub": sub, "order": order, "letters": letters}


# --- drawing ----------------------------------------------------------------------------------------------------------

def _box(ax, cx, y, w, h, fill="white", lw=1.3):
    ax.add_patch(FancyBboxPatch((cx - w / 2, y), w, h, boxstyle="round,pad=0,rounding_size=0.1", facecolor=fill,
                                edgecolor=INK, linewidth=lw))


def _letter(ax, x, y, letter, key, r=0.25, size=12.5):
    ax.add_patch(Circle((x, y), r, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=4))
    ax.text(x, y, letter, ha="center", va="center", fontsize=size, fontweight="bold", zorder=5, gid=f"letter:{key}")


def _line(ax, xs, ys, gid="link"):
    ax.plot(xs, ys, color=INK, linewidth=1.2, gid=gid, zorder=1)


def _table(ax, x0, top, widths, head, rows, fs, rh):
    for k, (w, h) in enumerate(zip(widths, head)):
        x = x0 + sum(widths[:k])
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor="#d9dee3", edgecolor=INK, linewidth=0.9))
        ax.text(x + 0.12, top - rh / 2, h, ha="left", va="center", fontsize=fs, fontweight="bold")
    for r, row in enumerate(rows):
        y = top - (r + 2) * rh
        for k, (w, v) in enumerate(zip(widths, row)):
            x = x0 + sum(widths[:k])
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            ax.text(x + 0.12, y + rh / 2, v, ha="left", va="center", fontsize=fs, fontweight="bold" if k == 0 else "normal")
    return top - (len(rows) + 1) * rh


def _draw_ng(p: dict):
    fig, ax = new_figure(12.0, 9.0)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    X = [1.9, 6.0, 10.1]
    W, H, Y = 3.7, 1.2, 6.0
    _box(ax, 6.0, 8.15, 5.6, 0.75, fill="#e3e7eb")
    ax.text(6.0, 8.525, "The Federal Government of Nigeria", ha="center", va="center", fontsize=12.5, fontweight="bold")
    _line(ax, [6.0, 6.0], [8.15, 7.65])
    _line(ax, [X[0], X[2]], [7.65, 7.65])
    for x, arm in zip(X, p["order"]):
        _line(ax, [x, x], [7.65, Y + H])
        _box(ax, x, Y, W, H, fill="#f4f1e6")
        ax.text(x + 0.1, Y + H / 2, NG_BODY[arm], ha="center", va="center", fontsize=10.5, linespacing=1.2,
                gid=f"box:{arm}")
        _letter(ax, x - W / 2 + 0.05, Y + H - 0.05, p["letters"][arm], arm)
    # the two houses under the legislature, centred under it but kept on the canvas
    lx = X[p["order"].index("Legislature")]
    hw, hh, hy, hgap = 3.2, 1.6, 3.6, 0.3
    centre = min(max(lx, hw + hgap / 2 - 0.95), 12.95 - hw - hgap / 2)
    hx = [centre - (hw + hgap) / 2, centre + (hw + hgap) / 2]
    _line(ax, [lx, lx], [Y, 5.6])
    _line(ax, [min(hx[0], lx), max(hx[1], lx)], [5.6, 5.6])
    for x, house in zip(hx, p["house_order"]):
        _line(ax, [x, x], [5.6, hy + hh])
        _box(ax, x, hy, hw, hh)
        ax.text(x + 0.15, hy + hh - 0.48, house, ha="center", va="center", fontsize=10.5, fontweight="bold",
                gid=f"box:{house}")
        ax.text(x, hy + (hh - 0.75) / 2, HOUSES[house], ha="center", va="center", fontsize=9.5, linespacing=1.15,
                gid=f"facts:{house}")
        _letter(ax, x - hw / 2 + 0.05, hy + hh - 0.05, p["letters"][house], house)
    rows = [[arm, NG_BODY[arm].replace("\n", " "), NG_JOB[arm][0].upper() + NG_JOB[arm][1:]] for arm in ARMS]
    bottom = _table(ax, 0.2, 3.25, [2.2, 4.6, 3.4], ["Arm", "Made up of", "Main function"], rows, 10, 0.48)
    ax.text(0.2, bottom - 0.35, "Source: Constitution of the Federal Republic of Nigeria, 1999 (sections 4, 5, 6, 48 and 49)",
            ha="left", va="center", fontsize=9, style="italic", color="#444444")
    ax.set_xlim(-1.3, 13.1)  # the left house's letter stands just past its box
    ax.set_ylim(bottom - 0.6, 9.1)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_un(p: dict):
    fig, ax = new_figure(14.5, 8.6)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    W, gap = 2.15, 0.3
    X = [W / 2 + k * (W + gap) for k in range(6)]
    mid = (X[0] + X[-1]) / 2
    top_y, bus, Y, H = 7.4, 6.9, 4.3, 2.2
    _box(ax, mid, top_y, 6.2, 0.75, fill="#e3e7eb")
    ax.text(mid, top_y + 0.375, "The United Nations: 193 member states", ha="center", va="center", fontsize=12.5,
            fontweight="bold")
    _line(ax, [mid, mid], [top_y, bus])
    _line(ax, [X[0], X[-1]], [bus, bus])
    for x, organ in zip(X, p["order"]):
        name, facts, _ = UN_ORGANS[organ]
        _line(ax, [x, x], [bus, Y + H])
        _box(ax, x, Y, W, H, fill="#f4f1e6" if organ != "Trusteeship Council" else "#eeeeee")
        ax.text(x, Y + H - 0.6, name, ha="center", va="center", fontsize=10, fontweight="bold", linespacing=1.15,
                gid=f"box:{organ}")
        ax.text(x, Y + (H - 1.0) / 2, facts, ha="center", va="center", fontsize=9.5, linespacing=1.2,
                gid=f"facts:{organ}")
        _letter(ax, x - W / 2 + 0.05, Y + H - 0.05, p["letters"][organ], organ)
    rows = [[organ, UN_ORGANS[organ][2]] for organ in UN_ORGANS]
    bottom = _table(ax, 1.0, 3.75, [3.6, 6.4], ["Organ", "Main function"], rows, 10, 0.44)
    ax.text(1.0, bottom - 0.35, "Source: Charter of the United Nations (Articles 7, 9, 23 and 61) and the Statute of the "
            "International Court of Justice", ha="left", va="center", fontsize=9, style="italic", color="#444444")
    ax.set_xlim(-0.4, X[-1] + W / 2 + 0.2)
    ax.set_ylim(bottom - 0.6, 8.35)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_p(p: dict):
    fig, ax = new_figure(12.0, 9.5)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    X = [2.0, 6.2, 10.4]
    W, H, Y = 3.6, 1.5, 6.1
    _box(ax, 6.2, 8.3, 5.4, 0.85, fill="#e3e7eb")
    ax.text(6.2, 8.725, "The Government of Nigeria", ha="center", va="center", fontsize=14, fontweight="bold")
    _line(ax, [6.2, 6.2], [8.3, 7.95])
    _line(ax, [X[0], X[2]], [7.95, 7.95])
    for x, arm in zip(X, p["order"]):
        _line(ax, [x, x], [7.95, Y + H])
        _box(ax, x, Y, W, H, fill="#f4f1e6", lw=1.6)
        ax.text(x + 0.15, Y + H / 2, P_BODY[arm], ha="center", va="center", fontsize=13, linespacing=1.2,
                gid=f"box:{arm}")
        _letter(ax, x - W / 2 + 0.05, Y + H - 0.05, p["letters"][arm], arm, r=0.32, size=14)
    lx = X[p["order"].index("Legislature")]
    hw, hh, hy = 2.5, 1.15, 4.0
    centre = min(max(lx, hw + 0.15 - 0.45), 13.05 - hw - 0.15)
    hx = [centre - hw / 2 - 0.15, centre + hw / 2 + 0.15]
    _line(ax, [lx, lx], [Y, 5.6])
    _line(ax, [min(hx[0], lx), max(hx[1], lx)], [5.6, 5.6])
    for x, house in zip(hx, ["Senate", "House of\nRepresentatives"]):
        _line(ax, [x, x], [5.6, hy + hh])
        _box(ax, x, hy, hw, hh)
        ax.text(x, hy + hh / 2, house, ha="center", va="center", fontsize=12, linespacing=1.15)
    ax.text(0.1, 3.35, "What each arm does", ha="left", va="center", fontsize=13, fontweight="bold")
    rows = [[P_BODY[arm].replace("\n", " "), P_TABLE[arm]] for arm in ARMS]
    bottom = _table(ax, 0.1, 3.0, [4.0, 7.6], ["Who", "What they do"], rows, 12, 0.62)
    ax.set_xlim(-0.6, 13.2)
    ax.set_ylim(bottom - 0.25, 9.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"ng": _draw_ng, "un": _draw_un, "ng_p": _draw_p}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------------------------

VERBS = ["studies", "copies", "looks at", "explains", "reads"]
SETTINGS = ["in a government lesson", "for homework", "on a revision card", "before a class test", "at the debate club",
            "for a class presentation", "in a civic education lesson", "for a group project"]
P_SETTINGS = ["in class", "in a social studies lesson", "at home", "with a friend", "for homework"]


def _letters(stem: str, key: str, options) -> Question:
    options = sorted(options)
    return Question("mcq", stem, str(options.index(key)), options)


def _four(rng: random.Random, key: str, letters) -> list[str]:
    return [key] + rng.sample([x for x in letters if x != key], 3)


def questions(p: dict, rng: random.Random) -> list:
    letters = p["letters"]
    if p["sub"] == "ng_p":
        who = rng.choice(NIGERIAN)
        a, b, c = rng.sample(ARMS, 3)
        member, verb = P_MEMBER[c]
        arms = [letters[x] for x in ARMS]
        return [_letters(f"{who} looks at this chart of Nigeria's government {rng.choice(P_SETTINGS)}. Which letter shows "
                         f"the arm that {P_JOB[a]}?", letters[a], arms),
                _letters(f"Look at the table. Which letter shows the arm that {P_JOB[b]}?", letters[b], arms),
                _letters(f"Which letter shows the arm that {member} {verb}?", letters[c], arms)]
    if p["sub"] == "ng":
        who = rng.choice(NIGERIAN)
        arm = rng.choice(ARMS)
        arms = [letters[x] for x in ARMS]
        house = rng.choice(list(HOUSES))
        qs = [_letters(f"{who} {rng.choice(VERBS)} this chart of Nigeria's federal government {rng.choice(SETTINGS)}. By "
                       f"the table, which letter shows the arm of government that {NG_JOB[arm]}?", letters[arm], arms),
              short(f"By the chart, how many members does the house lettered {letters[house]} have?",
                    SENATE if house == "Senate" else REPS)]
        options = ["total", "states"] + (["arm"] if arm != "Legislature" else [])
        pick = rng.choice(options)
        if pick == "total":
            qs.append(short("By the chart, how many members do the two houses of the National Assembly have altogether?",
                            SENATE + REPS, [f"{SENATE + REPS} members"]))
        elif pick == "states":
            qs.append(short(f"By the chart, how many of the Senate's members come from the {STATES} states?", 3 * STATES,
                            [f"{3 * STATES} members", f"{3 * STATES} senators"]))
        else:
            d, e = sorted([letters["Senate"], letters["House of Representatives"]])
            qs.append(_letters(f"Which letter shows the arm of government that the two houses lettered {d} and {e} "
                               f"belong to?", letters["Legislature"], arms))
        return qs
    who = rng.choice(NIGERIAN + NAMES)
    jobs = [o for o in UN_ORGANS if o not in ("Security Council", "Trusteeship Council")]
    organ = rng.choice(jobs)
    job = UN_ORGANS[organ][2]
    every = list(letters.values())
    qs = [_letters(f"{who} {rng.choice(VERBS)} this chart of the United Nations {rng.choice(SETTINGS)}. By the table, "
                   f"which letter shows the organ that {job[0].lower() + job[1:]}?", letters[organ],
                   _four(rng, letters[organ], every))]
    if rng.random() < 0.5:
        o = rng.choice(list(MEMBERS))
        qs.append(short(f"By the chart, how many members does the organ lettered {letters[o]} have?", MEMBERS[o],
                        [f"{MEMBERS[o]} members"]))
    else:
        o = rng.choice(list(YEARS))
        qs.append(short(f"By the chart, for how many years is each elected member of the organ lettered {letters[o]} "
                        f"elected?", YEARS[o], [f"{YEARS[o]} years"]))
    sc = letters["Security Council"]
    qs.append(_letters("By the chart, which letter shows the organ that has 5 permanent members?", sc,
                       _four(rng, sc, every)))
    return qs
