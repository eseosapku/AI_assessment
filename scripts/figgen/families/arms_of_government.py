"""The three arms of government in Rwanda (LS, UP), drawn as civics books draw them: a box for the Government of Rwanda
over three columns, each arm's name, what it is made up of, and its main role in short boxes.

Two sub-types. Lettered: the arms' names are replaced by the letters A, B and C and their roles are left off, so the
reader names an arm from what it is made up of: which letter is the arm that makes, carries out or interprets laws;
the name of the arm lettered one of them; and the two chambers of Parliament. Blank: every box is filled but one,
marked ?: what goes in it; which arm the diagram says makes (carries out, interprets) laws; and the two chambers of
Parliament, or which arm the Cabinet, the Senate or the Supreme Court belongs to.
"""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch

from ..core import INK, NAMES, Question, mcq, new_figure, one

ID = "arms_of_government"
KIND = "diagram.template"
SUBJECT = "social-studies"
BANDS = ("LS", "UP")
CONCEPTS = ("social-studies.arms-government", "social-studies.civics-governance")
# History and Citizenship S2 "State and Government" teaches the organs of the state and their roles.
ALSO = ("history.state-government-definition",)
# A topic whose sections the book lists is reached only if its name or a section names government, its arms or powers.
NEEDS = r"arms? of government|three powers|government|governance|constitution|legislat|executive|judic|parliament"
# Nigeria's own constitution and government are taught with Nigeria's arms, not Rwanda's.
AVOID = r"nigeria|contemporary|ideolog|foreign|international|human rights"

ARMS = ["Legislature", "Executive", "Judiciary"]
# Constitution of the Republic of Rwanda of 2003, revised in 2015: legislative power is vested in Parliament, made up
# of two chambers, the Chamber of Deputies and the Senate; executive power in the President of the Republic and the
# Cabinet, which the Prime Minister leads; judicial power in the Supreme Court and the other courts. Parliament makes
# laws and oversees the action of the Government; the Executive carries the laws out; the courts interpret and apply
# them and settle disputes.
BODY = {"Legislature": "Parliament: the Chamber of Deputies and the Senate",
        "Executive": "The President, the Prime Minister and the Cabinet",
        "Judiciary": "The Supreme Court and other courts"}
ROLE = {"Legislature": "Makes laws and checks the Government's work",
        "Executive": "Carries out laws and runs the country",
        "Judiciary": "Interprets laws and settles disputes"}
# The same words as printed, broken where a textbook box would break them.
LINES = {"Legislature": ("Parliament:\nthe Chamber of Deputies\nand the Senate", "Makes laws and checks\nthe Government's work"),
         "Executive": ("The President,\nthe Prime Minister\nand the Cabinet", "Carries out laws\nand runs the country"),
         "Judiciary": ("The Supreme Court\nand other courts", "Interprets laws and\nsettles disputes")}
DOES = {"Legislature": "makes laws", "Executive": "carries out laws", "Judiciary": "interprets laws"}
# Plausible slips: a body or a role taken from another arm, or one no arm has (the people elect the President).
WRONG = {"name": "Local government", "body": "The Senate and the Supreme Court", "role": "Elects the President"}
CHAMBERS = "The Chamber of Deputies and the Senate"
NOT_CHAMBERS = ["The Senate and the Cabinet", "The Chamber of Deputies and the Supreme Court", "The Cabinet and the Chamber of Deputies"]
ROWS = ["name", "body", "role"]


def sample(rng: random.Random) -> dict:
    order = rng.sample(ARMS, 3)
    mode = rng.choice(["letters", "blank"])
    letters, blank = {}, None
    if mode == "letters":
        letters = dict(zip(ARMS, rng.sample("ABC", 3)))
    else:
        blank = [rng.choice(ARMS), rng.choice(ROWS)]
    return {"band": rng.choice(BANDS), "mode": mode, "order": order, "letters": letters, "blank": blank}


# --- drawing ----------------------------------------------------------------------------------------

X = [2.0, 6.0, 10.0]  # the columns' centres
W = 3.7
Y = {"name": (7.0, 0.8), "body": (4.9, 1.5), "role": (2.8, 1.5)}  # (bottom, height)


def _box(ax, x: float, y: float, w: float, h: float, text: str, size: float = 9.2, bold: bool = False, fill: str = "white",
         gid: str = "") -> None:
    ax.add_patch(FancyBboxPatch((x - w / 2, y), w, h, boxstyle="round,pad=0,rounding_size=0.12", facecolor=fill,
                                edgecolor=INK, linewidth=1.2, gid=gid))
    ax.text(x, y + h / 2, text, ha="center", va="center", fontsize=size, fontweight="bold" if bold else "normal",
            linespacing=1.25, gid=gid)


def draw(p: dict):
    fig, ax = new_figure(9.0, 5.8)
    letters = p["mode"] == "letters"
    rows = ["name", "body"] if letters else ROWS
    # the Government of Rwanda over its three arms
    _box(ax, 6.0, 9.0, 5.6, 0.8, "The Government of Rwanda", size=11, bold=True, fill="#e3e7eb")
    ax.plot([6.0, 6.0], [9.0, 8.4], color=INK, linewidth=1.2)
    ax.plot([X[0], X[2]], [8.4, 8.4], color=INK, linewidth=1.2)
    for x in X:
        ax.plot([x, x], [8.4, Y["name"][0] + Y["name"][1]], color=INK, linewidth=1.2)
    for row, label in (("name", "Arm"), ("body", "Made up of"), ("role", "Main role")):
        if row in rows:
            b, h = Y[row]
            ax.text(-0.15, b + h / 2, label, ha="right", va="center", fontsize=9, style="italic", color="#444444")
    for x, arm in zip(X, p["order"]):
        for row in rows:
            b, h = Y[row]
            if row != "name":  # a short line down from the box above
                above = Y[rows[rows.index(row) - 1]][0]
                ax.plot([x, x], [above, b + h], color=INK, linewidth=1.0)
            if letters and row == "name":
                _box(ax, x, b, W, h, p["letters"][arm], size=13, bold=True, fill="#f4f1e6", gid=f"letter:{arm}")
            elif p["blank"] == [arm, row]:
                _box(ax, x, b, W, h, "?", size=14, bold=True, fill="#fff6cc", gid="blank")
            elif row == "name":
                _box(ax, x, b, W, h, arm, size=11, bold=True, fill="#f4f1e6")
            else:
                _box(ax, x, b, W, h, LINES[arm][0] if row == "body" else LINES[arm][1])
    bottom = Y[rows[-1]][0]
    ax.text(6.0, bottom - 0.55, "Source: Constitution of the Republic of Rwanda, 2003 (revised in 2015)", ha="center",
            va="center", fontsize=8.5, style="italic", color="#444444")
    ax.set_xlim(-2.0, 12.0)
    ax.set_ylim(bottom - 0.9, 10.0)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("The three arms of government in Rwanda", fontsize=12)
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in a citizenship lesson", "for homework", "on a revision card", "before a class test", "at the debate club",
            "for a class presentation"]
VERBS = ["studies", "copies", "looks at", "explains"]


def _letter_choice(stem: str, correct: str, options) -> Question:
    options = sorted(options)
    return Question("mcq", one(stem), str(options.index(correct)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    intro = f"{who} {rng.choice(VERBS)} this diagram of Rwanda's government {rng.choice(SETTINGS)}."
    chambers = mcq("According to the diagram, which two chambers make up Rwanda's Parliament?", CHAMBERS, NOT_CHAMBERS, rng)
    if p["mode"] == "letters":
        letters = p["letters"]
        arm = rng.choice(ARMS)
        other = rng.choice([a for a in ARMS if a != arm])
        return [_letter_choice(f"{intro} Which letter shows the arm of government that {DOES[arm]}?", letters[arm], letters.values()),
                mcq(f"What is the name of the arm of government lettered {letters[other]}?", other,
                    [a for a in ARMS if a != other] + [WRONG["name"]], rng),
                chambers]
    arm, row = p["blank"]
    truth = {"name": arm, "body": BODY[arm], "role": ROLE[arm]}[row]
    same_row = {"name": ARMS, "body": [BODY[a] for a in ARMS], "role": [ROLE[a] for a in ARMS]}[row]
    qs = [mcq(f"{intro} One box is left blank and marked ?. What should go in it?", truth,
              [t for t in same_row if t != truth] + [WRONG[row]], rng)]
    # Which arm the diagram says does a job: an arm whose name and role are both printed.
    shown = [a for a in ARMS if p["blank"] not in ([a, "role"], [a, "name"])]
    a = rng.choice(shown)
    qs.append(mcq(f"According to the diagram, which arm of government {DOES[a]}?", a, [x for x in ARMS if x != a] + [WRONG["name"]], rng))
    if p["blank"] != ["Legislature", "body"]:
        qs.append(chambers)
    else:
        body, owner = rng.choice([("Cabinet", "Executive"), ("Supreme Court", "Judiciary")])
        qs.append(mcq(f"Which arm of government does the {body} belong to, according to the diagram?", owner,
                      [x for x in ARMS if x != owner] + [WRONG["name"]], rng))
    return qs
