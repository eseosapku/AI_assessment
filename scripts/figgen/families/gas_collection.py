"""Collecting gases (LS, UP), drawn as textbook line diagrams. Two kinds:

- methods: three set-ups lettered A, B and C, each a flask making a gas and a delivery tube into a gas jar: over water
  (the jar upside down in a trough of water), upward delivery (the jar upside down, the tube up to its top, for a gas
  less dense than air) and downward delivery (the jar upright, the tube down to its bottom, for a gas denser than
  air), in a random order; a table of four gases with their densities (air's printed beside them) and solubilities,
  and the rule printed under it (P3z review: hydrogen suits over water and upward delivery alike): use the FIRST
  method that suits the gas, 1 over water, 2 downward delivery, 3 upward delivery. Which set-up suits a gas, which
  gas in the table the rule sends to a set-up (always exactly one), how many go over water;
- syringe: a flask joined to a gas syringe whose scale reads 0 to 100 cm³ in 2 cm³ marks; the volume collected (a
  whole multiple of 6 cm³, on a mark, read where an arrow points at the plunger's thin face) and the moles in it, one mole of gas taking 24 000 cm³ (printed in the stem).

The gases and their properties are real (density = molar mass ÷ 24 g/dm³); carbon dioxide, which textbooks collect
both over water and by downward delivery, is never asked about.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Polygon, Rectangle

from ..core import INK, NAMES, exact, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "gas_collection"
KIND = "diagram.template"
SUBJECT = "chemistry"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"chemistry.{c}" for c in ("laboratory-techniques", "oxygen-compounds", "carbon-compounds", "nitrogen-compounds",
                                             "sulfur-compounds", "chlorine-compounds", "mole-concept"))
# A topic whose sections the book lists is reached only if one names gases, a gas the figure collects, or moles.
NEEDS = r"collect|\bgas|oxygen|\bcarbon\b|nitrogen|ammonia|sulph|sulfur|chlorine|\bmoles?\b|molar"
AVOID = (r"\bair\b|environment|pollution|\borganic|alkane|alkene|petro|carbonyl|carboxylic|polymer|fertili|electroly|\brates?\b|"
         r"kinetic|equilibri|bonding|periodic|atomic|isotope|enthalpy|energ|benzene|halogeno|amine|states of matter|chromatog|"
         r"introduction|glossary|solubility product|concentration")

GASES = {  # density in g/dm³ at room temperature, solubility in water, the concept a gas belongs to
    "oxygen": (1.33, "slightly soluble", "oxygen-compounds"), "hydrogen": (0.08, "insoluble", None),
    "nitrogen": (1.17, "insoluble", "nitrogen-compounds"), "carbon monoxide": (1.17, "insoluble", "carbon-compounds"),
    "methane": (0.67, "insoluble", "carbon-compounds"), "ammonia": (0.71, "very soluble", "nitrogen-compounds"),
    "hydrogen chloride": (1.52, "very soluble", "chlorine-compounds"), "sulfur dioxide": (2.67, "very soluble", "sulfur-compounds"),
    "chlorine": (2.96, "soluble", "chlorine-compounds"), "nitrogen dioxide": (1.92, "soluble", "nitrogen-compounds"),
}
AIR = 1.20
# The rule printed under the table, in the order the keys follow: the first method that suits the gas.
RULE = ["1   over water (jar upside down in water): the gas is insoluble or only slightly soluble",
        "2   downward delivery (jar upright, tube to the bottom): the gas is soluble, denser than air",
        "3   upward delivery (jar upside down, tube to the top): the gas is soluble, less dense than air"]
METHODS = ["over water", "upward delivery", "downward delivery"]
REACTIONS = {  # what fills the syringe, and the concept of the gas it gives
    "marble chips reacted with dilute hydrochloric acid": "carbon-compounds",
    "calcium carbonate powder reacted with dilute nitric acid": "carbon-compounds",
    "magnesium ribbon reacted with dilute sulfuric acid": None,
    "zinc granules reacted with dilute hydrochloric acid": None,
    "hydrogen peroxide solution decomposed over manganese(IV) oxide": "oxygen-compounds",
}
MIXES = [(1, 1, 2), (2, 1, 1), (1, 0, 3), (3, 0, 1)]  # how many gases go over water, upward, downward: one method has one


def method_for(gas: str) -> str:
    d, sol, _ = GASES[gas]
    if sol in ("insoluble", "slightly soluble"):
        return "over water"
    return "upward delivery" if d < AIR else "downward delivery"


def concepts_for(p: dict) -> tuple[str, ...]:
    """The compounds of the gases a figure shows; moles only where the syringe is read."""
    if p["kind"] == "syringe":
        extra = [REACTIONS[p["reaction"]]] if REACTIONS[p["reaction"]] else []
        return tuple(["chemistry.laboratory-techniques", "chemistry.mole-concept"] + [f"chemistry.{c}" for c in extra])
    own = sorted({GASES[g][2] for g in p["gases"] if GASES[g][2]})
    return tuple(["chemistry.laboratory-techniques"] + [f"chemistry.{c}" for c in own])


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    if rng.random() < 0.6:
        n_over, n_up, n_down = rng.choice(MIXES)
        pools = {m: sorted(g for g in GASES if method_for(g) == m) for m in METHODS}
        gases = rng.sample(pools["over water"], n_over) + rng.sample(pools["upward delivery"], n_up) + \
            rng.sample(pools["downward delivery"], n_down)
        rng.shuffle(gases)
        order = METHODS[:]
        rng.shuffle(order)
        return {"band": band, "kind": "methods", "setups": dict(zip("ABC", order)), "gases": gases}
    return {"band": band, "kind": "syringe", "volume": 6 * rng.randint(2, 16), "reaction": rng.choice(sorted(REACTIONS))}


# --- drawing ------------------------------------------------------------------------------------------

GLASS = "#f4f8fb"
WATER = "#cfe2ef"
LIQUID = "#e6e0cf"


def _flask(ax, x0: float, y0: float) -> tuple[float, float]:
    """A conical flask with its liquid and stopper; returns where the delivery tube leaves the stopper."""
    body = [(x0, y0), (x0 + 1.6, y0), (x0 + 1.05, y0 + 1.5), (x0 + 1.05, y0 + 2.1), (x0 + 0.55, y0 + 2.1), (x0 + 0.55, y0 + 1.5)]
    ax.add_patch(Polygon(body, closed=True, facecolor=GLASS, edgecolor=INK, linewidth=1.3, zorder=2))
    level = y0 + 0.55
    t = 0.55 / 1.5
    ax.add_patch(Polygon([(x0, y0), (x0 + 1.6, y0), (x0 + 1.6 - 0.55 * t, level), (x0 + 0.55 * t, level)], closed=True,
                         facecolor=LIQUID, edgecolor="none", zorder=2.1))
    ax.add_patch(Rectangle((x0 + 0.48, y0 + 1.9), 0.64, 0.38, facecolor="#5a5a5a", edgecolor=INK, linewidth=0.9, zorder=3))
    return x0 + 0.8, y0 + 2.28


def _tube(ax, pts, gid: str) -> None:
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=INK, linewidth=3.2, zorder=5, solid_capstyle="butt", solid_joinstyle="miter", gid=gid)
    ax.plot(xs, ys, color="white", linewidth=1.4, zorder=5.1, solid_capstyle="butt", solid_joinstyle="miter")


def _jar(ax, x0: float, lo: float, hi: float, mouth: str, L: str) -> None:
    """A gas jar from lo to hi, open at its mouth (the bottom when upside down)."""
    w = 1.2
    ax.add_patch(Rectangle((x0, lo), w, hi - lo, facecolor=GLASS, edgecolor="none", zorder=1.5, gid=f"jar:{L}:{mouth}"))
    if mouth == "down":
        xs, ys = [x0, x0, x0 + w, x0 + w], [lo, hi, hi, lo]
    else:
        xs, ys = [x0, x0, x0 + w, x0 + w], [hi, lo, lo, hi]
    ax.plot(xs, ys, color=INK, linewidth=1.4, zorder=4)


def _panel(ax, ox: float, method: str, L: str) -> None:
    sx, sy = _flask(ax, ox + 0.3, 4.4)
    jx = ox + 2.9
    if method == "over water":
        ax.add_patch(Rectangle((ox + 2.15, 4.4), 2.7, 1.25, facecolor=WATER, edgecolor="none", zorder=1, gid=f"trough:{L}"))
        ax.plot([ox + 2.15, ox + 2.15, ox + 4.85, ox + 4.85], [6.05, 4.4, 4.4, 6.05], color=INK, linewidth=1.4, zorder=4)
        ax.plot([ox + 2.15, ox + 4.85], [5.65, 5.65], color=INK, linewidth=0.8, zorder=4)  # the water's surface
        _jar(ax, jx, 4.9, 7.7, "down", L)
        ax.add_patch(Rectangle((jx, 4.9), 1.2, 1.25, facecolor=WATER, edgecolor="none", zorder=1.6))  # water left in the jar
        ax.plot([jx, jx + 1.2], [6.15, 6.15], color=INK, linewidth=0.8, zorder=4)
        ax.add_patch(Rectangle((jx + 0.15, 4.4), 0.9, 0.5, facecolor="#bdbdbd", edgecolor=INK, linewidth=1.0, zorder=3))  # shelf
        _tube(ax, [(sx, sy - 0.3), (sx, 7.1), (ox + 2.5, 7.1), (ox + 2.5, 4.65), (jx + 0.6, 4.65), (jx + 0.6, 5.35)], f"tube:{L}")
    elif method == "upward delivery":
        _jar(ax, jx, 5.4, 8.4, "down", L)
        _tube(ax, [(sx, sy - 0.3), (sx, 7.1), (ox + 2.4, 7.1), (ox + 2.4, 4.9), (jx + 0.6, 4.9), (jx + 0.6, 8.0)], f"tube:{L}")
    else:
        _jar(ax, jx, 4.4, 7.4, "up", L)
        _tube(ax, [(sx, sy - 0.3), (sx, 8.2), (jx + 0.6, 8.2), (jx + 0.6, 4.75)], f"tube:{L}")
    ax.text(ox + 2.5, 3.85, L, ha="center", va="center", fontsize=14, fontweight="bold", gid=f"setupletter:{L}")


def _methods(p: dict):
    fig, ax = new_figure(7.6, 6.2)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    for k, (L, method) in enumerate(p["setups"].items()):
        _panel(ax, 5.0 * k, method, L)
    # the table of gases
    xs = [0.6, 4.6, 9.9, 14.4]
    top, head = 3.25, 0.95
    rows = [(g, f"{GASES[g][0]:.2f}", GASES[g][1]) for g in p["gases"]] + [("air (for comparison)", f"{AIR:.2f}", "—")]
    ys = [top, top - head] + [top - head - 0.5 * (k + 1) for k in range(len(rows))]
    for y in ys:
        ax.plot([xs[0], xs[-1]], [y, y], color=INK, linewidth=1.1 if y in (ys[0], ys[1], ys[-1]) else 0.6)
    for x in xs:
        ax.plot([x, x], [ys[0], ys[-1]], color=INK, linewidth=0.8)
    for k, h in enumerate(["Gas", "Density at room\ntemperature (g/dm³)", "Solubility in water"]):
        ax.text((xs[k] + xs[k + 1]) / 2, top - head / 2, h, ha="center", va="center", fontsize=10, fontweight="bold")
    for i, row in enumerate(rows):
        y = top - head - 0.5 * (i + 0.5)
        for k, c in enumerate(row):
            ax.text((xs[k] + xs[k + 1]) / 2, y, c, ha="center", va="center", fontsize=10)
    # the rule the keys follow: hydrogen suits over water and upward delivery alike, so the first that suits is used
    y = ys[-1] - 0.45
    ax.text(xs[0], y, "Use the FIRST method in this list that suits the gas:", ha="left", va="center", fontsize=9.5,
            fontweight="bold")
    for k, line in enumerate(RULE):
        ax.text(xs[0] + 0.15, y - 0.42 * (k + 1), line, ha="left", va="center", fontsize=9.5, gid=f"rule:{k + 1}")
    ax.set_xlim(0, 15)
    ax.set_ylim(y - 0.42 * len(RULE) - 0.35, 8.75)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


X0 = 3.6  # the syringe's zero mark
PER = 0.1  # drawing units per cm³


def _syringe(p: dict):
    fig, ax = new_figure(7.6, 3.6)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    sx, sy = _flask(ax, 0.2, 0.6)
    axis = 3.6
    _tube(ax, [(sx, sy - 0.3), (sx, axis), (X0 - 0.35, axis)], "tube")
    end = X0 + 100 * PER
    lo, hi = axis - 0.45, axis + 0.45
    ax.add_patch(Rectangle((X0 - 0.35, axis - 0.12), 0.35, 0.24, facecolor=GLASS, edgecolor=INK, linewidth=1.0, zorder=3))
    ax.add_patch(Rectangle((X0, lo), end - X0 + 0.25, hi - lo, facecolor=GLASS, edgecolor=INK, linewidth=1.4, zorder=1))
    tip = X0 + p["volume"] * PER
    # the plunger: its face a thin line, a slim piston behind it, the rod out past the barrel to a handle; an arrow
    # points at the face, where the scale is read (P3z review: a thick plunger was read at either edge)
    ax.add_patch(Rectangle((tip, lo + 0.04), 0.12, hi - lo - 0.08, facecolor="#cfcfcf", edgecolor="none", zorder=2,
                           gid="plunger-piston"))
    ax.add_patch(Rectangle((tip + 0.12, axis - 0.09), end + 1.2 - tip - 0.12, 0.18, facecolor="#bdbdbd", edgecolor=INK,
                           linewidth=0.9, zorder=1.8, gid="plunger-rod"))
    ax.add_patch(Rectangle((end + 1.2, axis - 0.5), 0.18, 1.0, facecolor="#7a7a7a", edgecolor=INK, linewidth=0.9, zorder=2,
                           gid="plunger-handle"))
    ax.plot([tip, tip], [lo + 0.02, hi - 0.02], color=INK, linewidth=1.1, zorder=3, gid="plunger-tip")
    ax.annotate("", xy=(tip, lo - 0.04), xytext=(tip, lo - 0.65), gid="read-arrow", zorder=5,
                arrowprops=dict(arrowstyle="-|>,head_length=0.5,head_width=0.25", color=INK, lw=1.3, shrinkA=0, shrinkB=0))
    for v in range(0, 101, 2):
        x = X0 + v * PER
        size = 0.3 if v % 10 == 0 else 0.16
        ax.plot([x, x], [hi, hi - size], color=INK, linewidth=1.0 if v % 10 else 1.3, zorder=4, gid=f"tick:{v}")
        if v % 10 == 0:
            ax.text(x, hi + 0.25, str(v), ha="center", va="center", fontsize=9.5)
    ax.text(end + 0.6, hi + 0.25, "cm³", ha="center", va="center", fontsize=9.5)
    ax.text(end + 0.75, lo - 0.35, "gas syringe", ha="center", va="center", fontsize=10)
    ax.text(X0, lo - 1.0, "Read the scale at the arrow.", ha="left", va="center", fontsize=10)
    ax.set_xlim(0, end + 1.6)
    ax.set_ylim(0.3, hi + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _methods(p) if p["kind"] == "methods" else _syringe(p)


# --- questions ----------------------------------------------------------------------------------------

SETTINGS = ["in the school laboratory", "in a chemistry practical in Huye", "at the science club in Musanze",
            "for a class practical in Kigali", "in a practical test in Rubavu", "in the laboratory at a school in Nyagatare",
            "during a lesson on gases"]


def _standard(v: Fraction) -> list[str]:
    """7.5 × 10⁻⁴ for 0.00075, as a student may write moles."""
    from decimal import Decimal
    d = Decimal(v.numerator) / Decimal(v.denominator)
    e = d.adjusted()
    mant = format(d.scaleb(-e).normalize(), "f")
    sup_e = "⁻" + str(-e).translate(str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"))
    return [f"{mant} × 10{sup_e}", f"{mant} x 10^{e}", f"{mant} × 10^{e}", f"{mant}e{e}", f"{mant} × 10{sup_e} mol"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "syringe":
        v = p["volume"]
        qs = [short(f"{who} collected the gas given off when {p['reaction']} {setting}. What volume of gas is in the syringe?", v,
                    [f"{v} cm³", f"{v}cm³", f"{v} cm3", f"{v}cm3", f"{v} ml", f"{v} mL"])]
        mol = Fraction(v, 24000)
        x = exact(mol)
        qs.append(short("One mole of any gas has a volume of 24 000 cm³ at room temperature and pressure. "
                        "How many moles of gas are in the syringe?", x, [f"{x} mol", f"{x} moles"] + _standard(mol)))
        return qs
    setups, gases = p["setups"], p["gases"]
    at = {m: L for L, m in setups.items()}
    gas = rng.choice(gases)
    qs = [letter_choice(f"{who} is collecting gases {setting}. Using the table and the rule under it, which set-up should be "
                        f"used to collect {gas}?",
                        at[method_for(gas)], list("ABC"))]
    single = [m for m in METHODS if sum(method_for(g) == m for g in gases) == 1]
    m = rng.choice(single)
    key = next(g for g in gases if method_for(g) == m)
    qs.append(mcq(f"Using the rule, which gas in the table should be collected with set-up {at[m]}?", key,
                  [g for g in gases if g != key], rng))
    n = sum(method_for(g) == "over water" for g in gases)
    qs.append(short("How many of the gases in the table should be collected over water?", n,
                    [f"{n} gas" if n == 1 else f"{n} gases"]))
    return qs
