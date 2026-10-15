"""Expert systems (AL, UP): an expert system's two parts side by side, lettered X and Y: its screen, with the facts the
user has entered, and its six IF-THEN rules, R1 to R6, as Cambridge AS IT sets them out. Three systems: a crop doctor
for a Musanze potato farm, a cow health helper for a Nyagatare dairy farm, and a fault finder for a Kigali school's
computers. Two rules reach a halfway conclusion that two diagnoses then build on, so chaining matters.

Which conclusion the inference engine reaches by forward chaining (the method printed under the rules), which rule it
fires first, which fact must also be entered to reach another conclusion, and which part of an expert system a box is.

Every key is the rules forward-chained on the facts: exactly one diagnosis is reached, the other conclusion asked about
is one entered fact short, and no wrong fact offered would reach it.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "expert_system"
KIND = "cs.logic"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("expert-systems", "artificial-intelligence"))
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"expert system|knowledge base|inference|artificial intelligence"
AVOID = r"python|database|spreadsheet|network|security|html|robot|neural|machine learning|ethic|emerging|society"
# Each system: symptoms s1..s9, the halfway conclusions I1 and I2, and diagnoses D1..D4, joined by six rules:
# I1 <- s1, s2; D1 <- I1, s5; D2 <- I1, s6; I2 <- s3, s4; D3 <- I2, s7; D4 <- s8, s9.
SYSTEMS = {
    "crop": {"title": "Crop Doctor", "then": "disease is ", "what": "a crop doctor expert system for a Musanze potato farm",
             "s": ["leaves have dark spots", "weather has been wet", "plants wilt by day", "cut stems ooze white",
                   "white mould under leaves", "spots have rings", "tubers are rotten", "leaves are pale yellow",
                   "old leaves yellow first"],
             "i": ["a fungus is present", "bacteria are present"],
             "d": ["late blight", "early blight", "bacterial wilt", "nitrogen deficiency"]},
    "cattle": {"title": "Cow Health Helper", "then": "disease is ",
               "what": "a cow health expert system for a Nyagatare dairy farm",
               "s": ["cow has a high fever", "ticks are on the cow", "udder is swollen", "udder feels hot",
                     "lymph nodes are swollen", "urine is red", "milk has clots", "blisters in the mouth", "cow is limping"],
               "i": ["a tick-borne disease is likely", "the udder is infected"],
               "d": ["East Coast fever", "redwater", "mastitis", "foot-and-mouth disease"]},
    "computer": {"title": "PC Fault Finder", "then": "fault is ",
                 "what": "a fault-finding expert system for a Kigali school's computers",
                 "s": ["computer runs slowly", "pop-up adverts appear", "fan is very loud", "case feels hot",
                       "files will not open", "home page has changed", "vents are full of dust", "disk makes clicking noises",
                       "files go missing"],
                 "i": ["malware is present", "the computer is overheating"],
                 "d": ["ransomware", "a browser hijacker", "blocked air vents", "a failing hard disk"]},
}
PARTS = {"screen": "user interface", "rules": "rule base"}


def logic(system: str) -> list[list]:
    """The six rules in their logical order, as [conditions, conclusion]."""
    c = SYSTEMS[system]
    s, i, d = c["s"], c["i"], c["d"]
    return [[[s[0], s[1]], i[0]], [[i[0], s[4]], d[0]], [[i[0], s[5]], d[1]],
            [[s[2], s[3]], i[1]], [[i[1], s[6]], d[2]], [[s[7], s[8]], d[3]]]


def chain(rules: list, facts: list) -> tuple[set, list]:
    """Forward chaining: R1 to R6 in order, firing each whose IF part is all known and whose THEN part is new, over
    and over until a pass adds nothing. The facts then known, and the rules fired in order (0-based)."""
    known, fired = set(facts), []
    again = True
    while again:
        again = False
        for k, (ifs, then) in enumerate(rules):
            if all(x in known for x in ifs) and then not in known:
                known.add(then)
                fired.append(k)
                again = True
    return known, fired


def symptoms_for(system: str, diagnosis: str) -> set:
    """The symptoms a diagnosis needs, through its halfway conclusion."""
    rules = logic(system)
    need, todo = set(), [diagnosis]
    heads = {then: ifs for ifs, then in rules}
    while todo:
        x = todo.pop()
        if x in heads:
            todo += heads[x]
        else:
            need.add(x)
    return need


def sample(rng: random.Random) -> dict:
    system = rng.choice(list(SYSTEMS))
    c = SYSTEMS[system]
    while True:
        rules = logic(system)
        rng.shuffle(rules)
        target, other = rng.sample(c["d"], 2)
        have, want = symptoms_for(system, target), symptoms_for(system, other)
        missing = rng.choice(sorted(want - have))
        facts = sorted(have | (want - {missing}))
        extra = [x for x in c["s"] if x not in facts and x not in want]
        if extra and rng.random() < 0.5:
            facts.append(rng.choice(extra))
        rng.shuffle(facts)
        known, fired = chain(rules, facts)
        if [d for d in c["d"] if d in known] != [target] or not fired:
            continue
        # Wrong facts to offer: one already entered that the conclusion needs, and symptoms it does not need.
        entered = [x for x in facts if x in want]
        unused = [x for x in c["s"] if x not in facts and x not in want]
        wrong = _distractors(missing, rng.sample(entered, min(1, len(entered))), unused, rng)
        if any(other in chain(rules, facts + [w])[0] for w in wrong):
            continue
        boxes = rng.choice([{"X": "screen", "Y": "rules"}, {"X": "rules", "Y": "screen"}])
        return {"band": rng.choice(BANDS), "system": system, "rules": rules, "facts": facts, "target": target,
                "other": other, "missing": missing, "wrong": wrong[:3], "boxes": boxes, "ask_box": rng.choice("XY")}


def _middle(options: list[str]) -> int | None:
    """The option sharing most words with the others, if one does: a key that is always it can be guessed unread."""
    words = [set(o.split()) for o in options]
    score = [sum(len(a ^ b) for b in words) for a in words]
    return score.index(min(score)) if score.count(min(score)) == 1 else None


def _distractors(key: str, entered: list[str], unused: list[str], rng: random.Random) -> list[str]:
    """Up to three wrong facts: one already entered that the conclusion needs, then symptoms it does not need, picked so
    that the key is not the options' most central one where another pick avoids it."""
    pool = list(unused)
    rng.shuffle(pool)
    best = None
    for k in range(len(pool)):
        wrong = (entered + pool[k:] + pool[:k])[:3]
        if _middle([key, *wrong]) != 0:
            return wrong
        best = best or wrong
    return best or entered[:3]


def rule_lines(p: dict) -> list[str]:
    c = SYSTEMS[p["system"]]
    out = []
    for k, (ifs, then) in enumerate(p["rules"]):
        name = f"R{k + 1}"
        out += [f"{name:<4}IF   {ifs[0]}", f"{'':<4}     AND {ifs[1]}",
                f"{'':<4}THEN {c['then'] + then if then in c['d'] else then}"]
    return out


def _letter(ax, x: float, y: float, letter: str):
    ax.text(x, y + 0.1, f"Box {letter}", ha="left", va="bottom", fontsize=11, fontweight="bold")


def draw(p: dict):
    c = SYSTEMS[p["system"]]
    fig, ax = new_figure(9.0, 6.6)
    top = 6.0
    letter_of = {v: k for k, v in p["boxes"].items()}
    # The screen, with the facts entered.
    sw, sh = 3.6, 1.0 + len(p["facts"]) * 0.34 + 0.8
    ax.add_patch(Rectangle((0, top - sh), sw, sh, facecolor="white", edgecolor=INK, linewidth=1.4))
    ax.add_patch(Rectangle((0, top - 0.42), sw, 0.42, facecolor="#9fb3c8", edgecolor=INK, linewidth=1.4))
    ax.text(0.4, top - 0.21, c["title"], ha="left", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.2, top - 0.75, "Facts entered by the user:", ha="left", va="center", fontsize=10)
    for k, fact in enumerate(p["facts"]):
        ax.text(0.3, top - 1.15 - k * 0.34, f"✓  {fact}", ha="left", va="center", fontsize=9.5)
    ax.add_patch(Rectangle((sw - 1.35, top - sh + 0.2), 1.15, 0.4, facecolor="#eef1f3", edgecolor=INK, linewidth=1.0))
    ax.text(sw - 0.775, top - sh + 0.4, "Diagnose", ha="center", va="center", fontsize=9.5)
    _letter(ax, 0.0, top, letter_of["screen"])
    # The rules.
    rx = sw + 0.4
    lines = rule_lines(p)
    rw = 9.0 - rx - 0.05
    rh = len(lines) * 0.26 + 0.25 + 0.12 * (len(p["rules"]) - 1)
    ax.add_patch(Rectangle((rx, top - rh), rw, rh, facecolor="#f7f8f9", edgecolor=INK, linewidth=1.4))
    y = top - 0.25
    for k, line in enumerate(lines):
        ax.text(rx + 0.15, y, line, ha="left", va="center", fontsize=9, family="monospace")
        y -= 0.26 + (0.12 if k % 3 == 2 else 0)
    _letter(ax, rx, top, letter_of["rules"])
    note = ["The inference engine uses forward chaining. It checks R1, R2, R3 ... in order and fires each rule",
            "whose IF part is all true, adding its THEN part to the facts. Then it checks the rules again, until",
            "no rule adds a new fact."]
    ny = top - max(rh, sh) - 0.35
    for k, line in enumerate(note):
        ax.text(0, ny - k * 0.27, line, ha="left", va="center", fontsize=9, color="#333333")
    ax.set_xlim(-0.3, 9.05)
    ax.set_ylim(ny - len(note) * 0.27, top + 0.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in an ICT lesson", "for a class test", "for homework", "during a demonstration", "to test it"]
OPTIONS = ["rule base", "user interface", "inference engine", "explanation system"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    c = SYSTEMS[p["system"]]
    rules, facts = p["rules"], p["facts"]
    _, fired = chain(rules, facts)
    rule = f"R{fired[0] + 1}"
    shown = PARTS[p["boxes"][p["ask_box"]]]
    return [mcq(f"{who} enters the facts shown into {c['what']} {rng.choice(SETTINGS)}. Using forward chaining, which "
                "conclusion does the inference engine reach?", p["target"], c["d"], rng),
            short(rng.choice(["Which rule does the inference engine fire first?", "Which rule fires first?",
                              "Working through the rules as stated, which rule fires first?"]), rule,
                  [rule, rule.lower(), f"Rule {rule[1:]}", f"rule {rule[1:]}", rule[1:], f"Rule {rule}"]),
            mcq(f"Which fact must also be entered for the system to reach the conclusion '{p['other']}'?", p["missing"],
                p["wrong"], rng),
            mcq(f"{friend} looks at the two boxes. Which part of an expert system is box {p['ask_box']}?", shown,
                [o for o in OPTIONS if o != shown], rng)]
