"""The data processing cycle and the data-information-knowledge ladder (LS, UP; AS Level by name), of two kinds.

- ipos: a computer system from everyday life (a school register on a tablet, a shop till, a library desk, exam marks,
  a mobile money payment) drawn as the input-process-output-storage diagram. Three boxes stand in a row under the
  printed headings INPUT, PROCESSING and OUTPUT, lettered A, B and C in that order and joined by one-way arrows (A to
  B to C); box D, headed STORAGE, stands under the processing box, joined to it by a "save" arrow down and a "read"
  arrow up. A key prints what each stage means. Each box holds what happens at that stage in this system; one box is
  blank ("?"). Under the diagram four cards, P to S, each hold a happening: one is this system's happening for the
  blank stage, the other three its happenings at the three other stages (each plainly of one stage by the key: input
  is typed, scanned or read in; processing calculates, counts, sorts or checks; output is printed, shown or sent;
  storage is saved). Which card belongs in the blank box, and which box another card belongs in. (P4 blind review: the
  first version printed no stage names, letters in no order and a two-way loop, and a box's stage was arguable.)
- ladder: a three-step ladder (data at the bottom, information, knowledge at the top) beside a printed table of what
  each word means, and three items about one situation lettered P, Q and R in a shuffled order. Which item is data
  (information, knowledge) by the printed meanings, and on which step an item belongs.

Every key comes from the fixed tables below, which a teacher would agree with.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL_2, INK, NAMES, Question, new_figure

ID = "data_processing_cycle"
KIND = "process.flow"
SUBJECT = "computing"
BANDS = ("LS", "UP")
# The AS Level IT chapters "Data processing and information" and "Data, information, knowledge and processing" teach
# both figures as drawn.
ALSO_BANDS = {"UP": ("AL",)}
IPOS = tuple(f"computing.{c}" for c in ("information-representation", "definition-ict", "computer-system-overview"))
LADDER = tuple(f"computing.{c}" for c in ("information-representation", "definition-ict"))
CONCEPTS = IPOS
# A topic whose sections the book lists is reached only if its name or a section names data, information, processing,
# ICT's fundamentals, computer applications or computer fundamentals; an AS Level topic only if its name does.
NEEDS = (r"\bdata\b|information|processing|ict fundamental|introduction to ict|computer applications|"
         r"computer fundamentals")
# Topics sharing the broad concepts that teach something else: number systems, word processing, programming, the
# processor, networks, databases, spreadsheets, AI, society and its issues.
AVOID = (r"information representation|data representation|word process|productivity|^introduction$|processor|cpu|"
         r"\bAI\b|artificial|society|software and hardware|security|network|database|spreadsheet|project|graphic|"
         r"data management|^data$|binary|programming|pseudocode|algorithm|python|internet|digital data|"
         r"collection and validation|navigation|presentation|financial|computer systems$|mail merge|life cycle|"
         r"input devices|input and output")

STAGES = ["input", "processing", "output", "storage"]
BOX = dict(zip(STAGES, "ABCD"))  # the boxes are lettered in the order the data flows, storage last
KEY = [("Input", "data is entered, e.g. typed in, scanned or read in"),
       ("Processing", "the computer works on the data, e.g. calculates, counts, sorts or checks"),
       ("Output", "results are given out, e.g. printed, shown on a screen or sent"),
       ("Storage", "data is saved to be used again later")]
# Each system: its name, a line saying what it is, and two happenings at each stage, each worded with its stage's own
# verb from the key (the first is drawn in its box; the second is only ever a card).
SYSTEMS = {
    "register": {"name": "school register system", "intro": "A teacher takes the morning register on a tablet.",
                 "input": ["The teacher taps each pupil's name as present or absent.",
                           "Each pupil's card is scanned at the door."],
                 "processing": ["The computer counts how many pupils are absent.",
                                "The computer calculates each pupil's attendance rate."],
                 "output": ["A list of the absent pupils is printed.",
                            "A text message is sent to each absent pupil's parent."],
                 "storage": ["The day's register is saved on the school server.",
                             "The attendance records are saved for the whole year."]},
    "till": {"name": "shop till system", "intro": "A shop in Huye sells goods at a till.",
             "input": ["The barcode on each item is scanned.", "The number of each item bought is typed in."],
             "processing": ["The computer adds up the prices to find the total.",
                            "The computer calculates the customer's change."],
             "output": ["A receipt is printed for the customer.", "The total to pay is shown on the screen."],
             "storage": ["The sale is saved in the shop's sales file.", "The new stock levels are saved in the stock file."]},
    "library": {"name": "library loans system", "intro": "A school library lends a book to a pupil.",
                "input": ["The barcode on the book is scanned.", "The pupil's library card number is typed in."],
                "processing": ["The computer calculates the return date: 14 days from today.",
                               "The computer checks whether the pupil owes a fine."],
                "output": ["A slip with the return date is printed.", "The return date is shown on the screen."],
                "storage": ["The loan is saved in the library's records.", "The book's record is saved as 'on loan'."]},
    "marks": {"name": "exam marks system", "intro": "A school in Musanze works out its end-of-term results.",
              "input": ["Each student's marks are typed in.", "Answer sheets are read in by an optical mark reader."],
              "processing": ["The computer calculates each student's total and average.",
                             "The computer sorts the students from the highest mark to the lowest."],
              "output": ["A report card is printed for each student.", "A class list of results is shown on the screen."],
              "storage": ["The marks are saved in the school's records.", "The results file is saved for next term."]},
    "momo": {"name": "mobile money system", "intro": "A customer in Rubavu sends money from a phone.",
             "input": ["The customer types in the amount and a PIN.", "The phone number of the person paid is typed in."],
             "processing": ["The system checks that the account holds enough money.",
                            "The system calculates the fee and the new balance."],
             "output": ["A message confirming the payment is sent to both phones.", "The new balance is shown on the screen."],
             "storage": ["The payment is saved in the account's history.", "The new balance is saved in the account."]},
}
# Where each stage's box stands (centre).
PLACE = {"input": (1.9, 5.5), "processing": (5.6, 5.5), "output": (9.3, 5.5), "storage": (5.6, 2.95)}
BW, BH = 3.2, 1.5
MEANING = [("Data", "raw facts and figures, with no context or meaning"),
           ("Information", "data that has been processed and given a context, so it has meaning"),
           ("Knowledge", "information that is understood and used, for example to make a decision")]
STEPS = ["Data", "Information", "Knowledge"]
# Each situation: an item at each step, written about a named person ({who}).
LADDERS = {
    "temperature": ["37.2   38.5   39.1",
                    "{who}'s temperature rose from 37.2 °C to 39.1 °C in three hours.",
                    "A temperature above 38 °C is a fever, so the nurse gives {who} medicine."],
    "marks": ["65   72   48",
              "{who}'s marks this term were Maths 65, English 72 and Science 48.",
              "Science is {who}'s lowest mark, so {who} plans extra Science revision."],
    "prices": ["500   650   800",
               "The price of 1 kg of beans at Kimironko market rose from 500 Frw to 800 Frw in three months.",
               "Prices are rising, so {who} buys a sack of beans now, before they cost more."],
    "buses": ["07:10   07:25   07:40",
              "Buses leave the Nyabugogo stop at 07:10, 07:25 and 07:40.",
              "School starts at 08:00 and the trip takes 30 minutes, so {who} takes the 07:25 bus."],
    "rain": ["12   0   35   48",
             "Rain in Huye on Monday to Thursday this week was 12 mm, 0 mm, 35 mm and 48 mm.",
             "Beans need wet soil to start growing, so {who} plants the beans after Thursday's heavy rain."],
}


def concepts_for(p: dict) -> tuple[str, ...]:
    return IPOS if p["sub"] == "ipos" else LADDER


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.55:
        system = rng.choice(list(SYSTEMS))
        blank = rng.choice(STAGES)
        # the cards: the blank stage's own happening and the other stages' second happenings, shuffled onto P to S
        cards = [[blank, 0]] + [[st, 1] for st in STAGES if st != blank]
        rng.shuffle(cards)
        ask = rng.choice([i for i, c in enumerate(cards) if c[0] != blank])
        return {"band": band, "sub": "ipos", "system": system, "blank": blank, "cards": cards, "ask": "PQRS"[ask]}
    situation = rng.choice(list(LADDERS))
    letters = list("PQR")
    rng.shuffle(letters)
    ask, item = rng.sample(STEPS, 2)  # the two questions never share an answer
    return {"band": band, "sub": "ladder", "situation": situation, "who": rng.choice(NAMES),
            "letters": dict(zip(STEPS, letters)), "ask": ask, "item": item}


def items(p: dict) -> dict:
    """The ladder's three items, by the step each belongs on."""
    return {step: text.format(who=p["who"]) for step, text in zip(STEPS, LADDERS[p["situation"]])}


# --- drawing ----------------------------------------------------------------------------------------

def _arrow(ax, x0, y0, x1, y1, gid=None):
    ax.plot([x0, x1], [y0, y1], color=INK, linewidth=1.6, gid=gid)
    dx, dy = x1 - x0, y1 - y0
    d = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / d, dy / d
    h, w = 0.22, 0.11
    ax.add_patch(Polygon([(x1, y1), (x1 - h * ux + w * uy, y1 - h * uy - w * ux), (x1 - h * ux - w * uy, y1 - h * uy + w * ux)],
                         closed=True, facecolor=INK, edgecolor=INK))


def _draw_ipos(p: dict):
    s = SYSTEMS[p["system"]]
    fig, ax = new_figure(11.0, 7.45)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(0.1, 7.15, s["name"][0].upper() + s["name"][1:] + ": " + s["intro"], ha="left", va="center", fontsize=11.5,
            fontweight="bold")
    for stage in STAGES:
        cx, cy = PLACE[stage]
        ax.add_patch(FancyBboxPatch((cx - BW / 2, cy - BH / 2), BW, BH, boxstyle="round,pad=0.02,rounding_size=0.12",
                                    facecolor=FILL_2 if stage == p["blank"] else "white", edgecolor=INK, linewidth=1.5))
        if stage == p["blank"]:
            ax.text(cx, cy, "?", ha="center", va="center", fontsize=20, fontweight="bold", gid=f"blank:{stage}")
        else:
            ax.text(cx, cy, textwrap.fill(s[stage][0], 27), ha="center", va="center", fontsize=10.5, linespacing=1.3,
                    gid=f"box:{stage}")
        # the stage's name, printed: over the box for the three in a row, beside it for storage
        if stage == "storage":
            ax.text(cx - BW / 2 - 0.2, cy, "STORAGE", ha="right", va="center", fontsize=11.5, fontweight="bold",
                    gid=f"head:{stage}")
        else:
            ax.text(cx, cy + BH / 2 + 0.35, stage.upper(), ha="center", va="center", fontsize=11.5, fontweight="bold",
                    gid=f"head:{stage}")
        lx, ly = cx - BW / 2 + 0.05, cy + BH / 2 - 0.05
        ax.add_patch(Circle((lx, ly), 0.24, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=3))
        ax.text(lx, ly, BOX[stage], ha="center", va="center", fontsize=12, fontweight="bold", zorder=4, gid=f"letter:{stage}")
    (ix, iy), (px, py), (ox, oy), (sx, sy) = (PLACE[k] for k in STAGES)
    # one-way arrows in the order the data flows; storage on its own link, saved down and read back up
    _arrow(ax, ix + BW / 2 + 0.05, iy, px - BW / 2 - 0.08, py, gid="flow:input")
    _arrow(ax, px + BW / 2 + 0.05, py, ox - BW / 2 - 0.08, oy, gid="flow:processing")
    top, bottom = py - BH / 2 - 0.05, sy + BH / 2 + 0.05
    _arrow(ax, px - 0.5, top, sx - 0.5, bottom + 0.03, gid="save")
    _arrow(ax, sx + 0.5, bottom, px + 0.5, top - 0.03, gid="read")
    ax.text(px - 0.62, (top + bottom) / 2, "save", ha="right", va="center", fontsize=10.5, style="italic")
    ax.text(px + 0.62, (top + bottom) / 2, "read", ha="left", va="center", fontsize=10.5, style="italic")
    # the key: what each stage means
    kx, ky = 7.45, 4.3
    ax.text(kx, ky, "Key", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, (word, means) in enumerate(KEY):
        y = ky - 0.5 - i * 0.55
        ax.text(kx, y, textwrap.fill(f"{word}: " + means, 46), ha="left", va="center", fontsize=9.5,
                linespacing=1.15)
    # the cards to place
    ax.text(0.1, 1.95, "Cards to place", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, (stage, k) in enumerate(p["cards"]):
        x0 = 0.1 + i * 2.72
        ax.add_patch(FancyBboxPatch((x0, 0.25), 2.55, 1.3, boxstyle="round,pad=0.02,rounding_size=0.08",
                                    facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.add_patch(Circle((x0 + 0.3, 1.27), 0.22, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
        ax.text(x0 + 0.3, 1.27, "PQRS"[i], ha="center", va="center", fontsize=12, fontweight="bold", gid=f"card:{i}")
        ax.text(x0 + 1.45, 0.75, textwrap.fill(s[stage][k], 22), ha="center", va="center", fontsize=10, linespacing=1.2,
                gid=f"cardtext:{i}")
    ax.set_xlim(0.0, 11.0)
    ax.set_ylim(0.1, 7.45)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _draw_ladder(p: dict):
    its = items(p)
    fig, ax = new_figure(11.0, 6.4)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    # the ladder: three steps rising to the right, each named
    for k, step in enumerate(STEPS):
        x0, y0 = 0.2 + k * 1.25, 0.4 + k * 0.85
        ax.add_patch(Rectangle((x0, y0), 3.75 - k * 1.25, 0.85, facecolor=["#eef0f2", FILL_2, "#b9c1c8"][k], edgecolor=INK,
                               linewidth=1.3))
        ax.text(x0 + 0.15, y0 + 0.42, step, ha="left", va="center", fontsize=11.5, fontweight="bold")
    # the meanings
    tx, ty = 4.4, 3.0
    ax.text(tx, ty + 0.25, "What the words mean", ha="left", va="center", fontsize=11, fontweight="bold")
    for i, (word, means) in enumerate(MEANING):
        y = ty - 0.25 - i * 0.7
        ax.add_patch(Rectangle((tx, y - 0.35), 1.75, 0.7, facecolor=FILL_2, edgecolor=INK, linewidth=0.9))
        ax.add_patch(Rectangle((tx + 1.75, y - 0.35), 4.75, 0.7, facecolor="white", edgecolor=INK, linewidth=0.9))
        ax.text(tx + 0.12, y, word, ha="left", va="center", fontsize=10.5, fontweight="bold")
        ax.text(tx + 1.87, y, textwrap.fill(means, 44), ha="left", va="center", fontsize=10, linespacing=1.2)
    # the three items, in letter order
    ax.text(0.2, 6.0, "Three items about one situation", ha="left", va="center", fontsize=11, fontweight="bold")
    by_letter = sorted((letter, step) for step, letter in p["letters"].items())
    for i, (letter, step) in enumerate(by_letter):
        y = 5.4 - i * 0.62
        ax.add_patch(Circle((0.45, y), 0.22, facecolor="white", edgecolor=INK, linewidth=1.3))
        ax.text(0.45, y, letter, ha="center", va="center", fontsize=11.5, fontweight="bold", gid=f"letter:{step}")
        ax.text(0.85, y, its[step], ha="left", va="center", fontsize=10.5)
    ax.set_xlim(0.0, 11.0)
    ax.set_ylim(0.25, 6.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _draw_ipos(p) if p["sub"] == "ipos" else _draw_ladder(p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for a class test", "on a revision card", "for homework", "at the computer club",
            "in a Data Processing lesson"]


def _letters(stem: str, key: str, letters) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["sub"] == "ipos":
        s = SYSTEMS[p["system"]]
        blank = p["blank"]
        right = "PQRS"[next(i for i, c in enumerate(p["cards"]) if c[0] == blank)]
        ask = p["ask"]
        stage = p["cards"]["PQRS".index(ask)][0]
        return [_letters(f"{who} sorts the cards for this {s['name']} {setting}. Using the key, which card belongs in "
                         f"the blank {blank.upper()} box?", right, "PQRS"),
                _letters(f"Using the key, which box of the {s['name']} diagram does card {ask} belong in?", BOX[stage],
                         "ABCD")]
    its = items(p)
    letters = p["letters"]
    ask, item = p["ask"], p["item"]
    return [_letters(f"{who} sorts these items {setting}. By the meanings printed, which item is "
                     f"{ask.lower()}?", letters[ask], letters.values()),
            Question("mcq", f"On which step of the ladder does item {letters[item]} belong, by the meanings printed?",
                     str(STEPS.index(item)), list(STEPS))]
