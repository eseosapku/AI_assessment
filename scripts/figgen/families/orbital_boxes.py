"""Electrons in boxes (UP, AL): the electrons of an atom or ion from lithium to zinc drawn as arrows in orbital boxes,
the sub-shells set out as a staircase in order of energy (1s, 2s, 2p, 3s, 3p, 4s, 3d) with an "Energy" arrow, each
sub-shell named under its boxes. Three kinds:

- atom: an atom of an unnamed element (X, Y, Z or Q); asks the number of unpaired electrons, the atomic number and the
  electronic configuration in sub-shell notation;
- main ion: an ion of an unnamed element with its charge printed (Q²⁻, X³⁺); asks the atomic number (electrons plus
  the charge's sign worked back), the outer-shell electrons of the element's atom and the configuration;
- transition ion: an ion of a named transition metal with its atomic number printed (iron, 26); asks the charge on the
  ion, the unpaired electrons and the configuration.

Boxes fill by the Aufbau order, singly with parallel spins before any pairing (Hund's rule); chromium is 3d⁵ 4s¹ and
copper 3d¹⁰ 4s¹; a transition-metal ion loses its 4s electrons before any 3d, and its emptied 4s box is drawn.
"""
from __future__ import annotations

import random

from matplotlib.patches import Rectangle

from ..core import INK, NAMES, Question, count, new_figure, short

ID = "orbital_boxes"
KIND = "chem.particle"
SUBJECT = "chemistry"
BANDS = ("UP", "AL")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("electronic-configuration", "orbitals-and-quantum-numbers", "transition-metals"))
# Where the book lists sections, one must name orbitals, sub-shells, electronic configurations or the transition
# elements' configurations.
NEEDS = (r"orbital|sub-?shell|electronic configuration|electronic structure|configurations?\b|quantum|"
         r"transition (metal|element)")
AVOID = (r"organic|alkane|alcohol|benzene|polymer|electrolysis|equilibri|rate|enthalpy|titration|redox|alloy|"
         r"periodic table$|bonding|bond\b|covalent|ionic|isotop|radioactiv|mass spectr|glossary|complex|ligand|introduction")

ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d"]
BOXES = {"s": 1, "p": 3, "d": 5}
SYMBOL = ["", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K",
          "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn"]
METAL = {21: "scandium", 22: "titanium", 23: "vanadium", 24: "chromium", 25: "manganese", 26: "iron", 27: "cobalt",
         28: "nickel", 29: "copper", 30: "zinc"}
# (atomic number, charge) of the ions drawn
MAIN_IONS = [(3, 1), (7, -3), (8, -2), (9, -1), (11, 1), (12, 2), (13, 3), (15, -3), (16, -2), (17, -1), (19, 1), (20, 2)]
TM_IONS = [(21, 3), (22, 2), (23, 3), (24, 3), (25, 2), (26, 2), (26, 3), (27, 2), (28, 2), (29, 1), (29, 2), (30, 2)]
LETTERS = ["X", "Y", "Z", "Q"]


def configuration(z: int, charge: int = 0) -> dict[str, int]:
    """Electrons in each sub-shell, in the order of ORDER."""
    left = z
    out = {s: 0 for s in ORDER}
    for s in ORDER:
        n = min(left, 2 * BOXES[s[1]])
        out[s] = n
        left -= n
    if z == 24:
        out["4s"], out["3d"] = 1, 5
    if z == 29:
        out["4s"], out["3d"] = 1, 10
    if charge > 0:
        lose = charge
        for s in ("4s", "3d", "3p", "3s", "2p", "2s", "1s"):  # 4s goes first; then the highest sub-shell
            take = min(lose, out[s])
            out[s] -= take
            lose -= take
    elif charge < 0:
        add = -charge
        for s in ORDER:
            room = 2 * BOXES[s[1]] - out[s]
            put = min(room, add)
            out[s] += put
            add -= put
    return out


def shown_subshells(p: dict) -> list[str]:
    """The sub-shells drawn: up to the last one holding electrons, and the emptied 4s of a transition-metal ion."""
    conf = configuration(p["z"], p["charge"])
    last = max(i for i, s in enumerate(ORDER) if conf[s])
    if p["z"] >= 21:
        last = max(last, ORDER.index("3d"))
    return ORDER[:last + 1]


def outer_shell(z: int) -> int:
    """Electrons in a neutral atom's outermost shell (the highest principal quantum number holding any)."""
    conf = configuration(z)
    n = max(int(s[0]) for s, k in conf.items() if k)
    return sum(k for s, k in conf.items() if int(s[0]) == n)


def unpaired(conf: dict[str, int]) -> int:
    return sum(min(n, 2 * BOXES[s[1]] - n) for s, n in conf.items())


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    kind = rng.choice(["atom", "atom", "main ion", "transition ion", "transition ion"])
    if kind == "atom":
        z, charge = rng.randint(3, 30), 0
    elif kind == "main ion":
        z, charge = rng.choice(MAIN_IONS)
    else:
        z, charge = rng.choice(TM_IONS)
    return {"band": band, "kind": kind, "z": z, "charge": charge, "letter": rng.choice(LETTERS)}


def concepts_for(p: dict) -> tuple[str, ...]:
    return CONCEPTS if p["z"] >= 21 else CONCEPTS[:2]


def avoid_for(p: dict) -> str:
    """Only a transition metal's boxes serve a chapter on the transition elements."""
    return AVOID if p["z"] >= 21 else AVOID + r"|transition"


# --- writing a configuration ----------------------------------------------------------------------------------------

SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def charge_text(charge: int) -> str:
    n = abs(charge)
    return (str(n) if n > 1 else "") + ("+" if charge > 0 else "−")


def ion_label(letter: str, charge: int) -> str:
    """X²⁻, Q⁺: the charge as a superscript."""
    return letter + charge_text(charge).translate(str.maketrans("0123456789+−", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻"))


def written(conf: dict[str, int], order=ORDER, style: str = "sup", sep: str = " ") -> str:
    parts = []
    for s in order:
        n = conf[s]
        if not n:
            continue
        parts.append(s + (str(n).translate(SUP) if style == "sup" else ("^" + str(n)) if style == "caret" else str(n)))
    return sep.join(parts)


def config_forms(conf: dict[str, int]) -> list[str]:
    """Every fair way to type it: superscripts or plain or ^ digits, spaced or not, 3d before or after 4s, and the
    [Ne] or [Ar] shorthand."""
    orders = [ORDER, ["1s", "2s", "2p", "3s", "3p", "3d", "4s"]]
    forms: list[str] = []
    for order in orders:
        for style in ("sup", "plain", "caret"):
            for sep in (" ", "", ", ", ","):
                f = written(conf, order, style, sep)
                if f not in forms:
                    forms.append(f)
    for core, gas in ((["1s", "2s", "2p", "3s", "3p"], "Ar"), (["1s", "2s", "2p"], "Ne")):
        full = {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6}
        if all(conf[s] == full[s] for s in core) and any(conf[s] for s in ORDER if s not in core):
            rest = {s: (0 if s in core else n) for s, n in conf.items()}
            for order in orders:
                for style in ("sup", "plain", "caret"):
                    for sep in (" ", ""):
                        f = f"[{gas}]{sep}{written(rest, order, style, sep)}"
                        if f not in forms:
                            forms.append(f)
            break
    return forms


# --- drawing --------------------------------------------------------------------------------------------------------

W = 0.62  # a box's side
GAP = 0.45  # between sub-shells
STEP = 0.72  # the rise from one energy level to the next


def layout(p: dict) -> list[tuple[str, float, float]]:
    """Each drawn sub-shell with the left x and the bottom y of its boxes."""
    out, x = [], 0.0
    for i, s in enumerate(shown_subshells(p)):
        out.append((s, x, i * STEP))
        x += BOXES[s[1]] * W + GAP
    return out


def title(p: dict) -> str:
    if p["kind"] == "atom":
        return f"Electrons in boxes for an atom of element {p['letter']}"
    if p["kind"] == "main ion":
        return f"Electrons in boxes for the ion {ion_label(p['letter'], p['charge'])}"
    return f"Electrons in boxes for an ion of {METAL[p['z']]} ({SYMBOL[p['z']]}, atomic number {p['z']})"


def draw(p: dict):
    conf = configuration(p["z"], p["charge"])
    boxes = layout(p)
    right = boxes[-1][1] + BOXES[boxes[-1][0][1]] * W
    top = boxes[-1][2] + W
    fig, ax = new_figure(max(5.6, 0.62 * (right + 1.6)), max(3.6, 0.62 * (top + 2.2)))
    for s, x0, y0 in boxes:
        k = BOXES[s[1]]
        n = conf[s]
        for b in range(k):
            ax.add_patch(Rectangle((x0 + b * W, y0), W, W, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=2,
                                   gid=f"box:{s}:{b}"))
        # Hund's rule: one in each box first, all pointing up; then the second (down) in each box in turn.
        spins = [(b, "up") for b in range(min(n, k))] + [(b, "down") for b in range(max(0, n - k))]
        for b, spin in spins:
            cx = x0 + (b + 0.5) * W + (-0.12 if spin == "up" else 0.12) * (1 if n > b + k or spin == "down" else 0)
            lo, hi = y0 + 0.12 * W, y0 + 0.88 * W
            start, end = ((cx, lo), (cx, hi)) if spin == "up" else ((cx, hi), (cx, lo))
            ax.annotate("", xy=end, xytext=start, arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4,
                                                                  mutation_scale=9, shrinkA=0, shrinkB=0),
                        zorder=3, gid=f"e:{spin}:{s}:{b}")
        ax.text(x0 + k * W / 2, y0 - 0.2, s, ha="center", va="top", fontsize=11, gid=f"name:{s}")
    # The energy arrow up the left side
    ax.annotate("", xy=(-0.55, top + 0.1), xytext=(-0.55, -0.45), arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.2))
    ax.text(-0.8, (top - 0.45) / 2, "Energy", rotation=90, ha="center", va="center", fontsize=10)
    head = title(p)
    edge = max(right + 0.3, 0.17 * len(head) - 1.1)  # room for the title over a short staircase
    ax.text((edge - 1.1) / 2, top + 0.55, head, ha="center", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(-1.1, edge)
    ax.set_ylim(-0.75, top + 0.9)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a chemistry lesson", "for homework", "on a revision card", "for a class test", "at the science club",
            "while revising for an examination", "on the board", "for a group discussion"]
VERBS = ["drew", "copied", "filled in", "completed", "sketched"]
EXAMPLE = "(as hydrogen is written 1s¹), in the order the boxes fill"


def questions(p: dict, rng: random.Random) -> list[Question]:
    who = rng.choice(NAMES)
    conf = configuration(p["z"], p["charge"])
    electrons = sum(conf.values())
    config = written(conf)
    lead = f"{who} {rng.choice(VERBS)} this diagram {rng.choice(SETTINGS)}."
    cq = short(f"Write the electronic configuration shown, in sub-shell notation {EXAMPLE}.", config, config_forms(conf))
    if p["kind"] == "atom":
        L = p["letter"]
        return [count(f"{lead} How many unpaired electrons does an atom of {L} have?", unpaired(conf), "unpaired electrons",
                      "electrons"),
                short(f"What is the atomic number of element {L}?", str(electrons), [str(electrons)]),
                cq]
    if p["kind"] == "main ion":
        L = p["letter"]
        z = electrons + p["charge"]
        ion = ion_label(L, p["charge"])
        return [short(f"{lead} What is the atomic number of element {L}, whose ion {ion} is shown?", str(z), [str(z)]),
                count(f"How many electrons are in the outer shell of an atom of {L}?", outer_shell(z), "electrons"),
                cq]
    sym, name = SYMBOL[p["z"]], METAL[p["z"]]
    q = p["charge"]
    forms = [f"{q}+", f"+{q}", str(q), f"{sym}{q}+", f"{sym}{q}+".lower(), f"{sym}{str(q).translate(SUP)}⁺",
             f"{q}⁺", f"+{q} charge", f"{q}+ charge"]
    if q == 1:
        forms += ["+", "1", f"{sym}+", f"{sym}⁺"]
    return [short(f"{lead} What is the charge on this ion of {name}?", f"{q}+", forms),
            count(f"How many unpaired electrons does this ion of {name} have?", unpaired(conf), "unpaired electrons",
                  "electrons"),
            cq]
