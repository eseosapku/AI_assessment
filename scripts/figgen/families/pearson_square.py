"""The Pearson square (LS, UP): mixing two feeds, an energy feed low in crude protein (maize bran at 9%) and a protein
feed (soya bean meal at 44%), into a ration with a target crude protein (layer mash at 16%), drawn as textbooks draw
it: the feeds' CP at the left corners, the target in the middle, and each feed's parts at the right corners, found
across the diagonal. Two sub-types: the parts are blank (boxes P and Q), or the target is.

The parts of a feed (or the target, from the parts), the kilograms of each feed in a 100 kg or 50 kg batch, and the
percentage of the mix that is one feed. Every key is exact: CPs are whole numbers and the batch and the percentage
come out whole or to one decimal place, by choice of feeds and target; the ration always balances.
"""
from __future__ import annotations

import random
from fractions import Fraction

from matplotlib.patches import Circle, FancyArrowPatch, Rectangle

from ..core import INK, NAMES, exact, mcq, measure, new_figure, short

ID = "pearson_square"
KIND = "diagram.template"
SUBJECT = "agriculture"
BANDS = ("UP", "LS")
CONCEPTS = tuple(f"agriculture.{c}" for c in ("feed-nutrition", "ruminant-feeding", "poultry-production", "pig-production",
                                              "fish-feeding-nutrition"))
# A topic whose sections the book lists is reached only if one names feeding.
NEEDS = r"feed|ration|nutrition|fish food"
# Topics listed without sections that share feed-nutrition but teach no ration.
AVOID = r"breed|health|disease"

LOW = {"maize bran": [8, 9, 10, 11, 12], "maize grain": [8, 9, 10], "sorghum grain": [9, 10, 11], "rice bran": [12, 13, 14],
       "cassava meal": [2, 3, 4], "wheat bran": [15, 16, 17]}
HIGH = {"soya bean meal": [44, 45, 46, 48], "sunflower cake": [28, 30, 32, 34], "cotton seed cake": [36, 38, 40, 41],
        "fish meal": [55, 60, 62, 65], "groundnut cake": [40, 42, 45]}
# animal: (ration, target CPs, energy feeds, protein feeds, places, concept)
ANIMALS = {
    "layers": ("layer mash", [15, 16, 17, 18], ["maize bran", "maize grain", "sorghum grain", "rice bran", "cassava meal"],
               ["soya bean meal", "sunflower cake", "fish meal", "groundnut cake"],
               ["a layer unit in Rwamagana", "a poultry farm in Nyagatare", "a school poultry unit in Huye", "a poultry cooperative in Bugesera"],
               "poultry-production"),
    "broilers": ("broiler starter", [20, 21, 22, 23], ["maize grain", "maize bran", "sorghum grain"],
                 ["soya bean meal", "fish meal", "groundnut cake"],
                 ["a broiler unit in Kigali", "a poultry farm in Muhanga", "a broiler farm in Kayonza"], "poultry-production"),
    "pigs": ("pig grower ration", [14, 15, 16, 17, 18], ["maize bran", "rice bran", "cassava meal", "sorghum grain"],
             ["soya bean meal", "sunflower cake", "cotton seed cake", "fish meal"],
             ["a piggery in Musanze", "a pig farm in Rubavu", "a pig cooperative in Gicumbi"], "pig-production"),
    "dairy": ("dairy meal", [14, 15, 16, 18, 20], ["maize bran", "wheat bran", "rice bran", "cassava meal"],
              ["cotton seed cake", "sunflower cake", "soya bean meal"],
              ["a dairy farm in Nyagatare", "a zero-grazing unit in Musanze", "a dairy cooperative in Gicumbi"], "ruminant-feeding"),
    "fish": ("tilapia feed", [24, 25, 28, 30, 32], ["rice bran", "maize bran", "wheat bran"], ["fish meal", "soya bean meal"],
             ["a fish pond by Lake Kivu", "tilapia ponds in Rwamagana", "a fish farm in Huye"], "fish-feeding-nutrition"),
}


def concepts_for(p: dict) -> frozenset[str]:
    return frozenset({"agriculture.feed-nutrition", f"agriculture.{ANIMALS[p['animal']][5]}"})


def avoid_for(p: dict) -> str:
    # A dairy ration shares the mapper's ruminant-feeding with the pigs-and-poultry unit, which feeds no cows.
    return AVOID + ("|pigs and poultry" if p["animal"] == "dairy" else "")


def sample(rng: random.Random) -> dict:
    animal = rng.choice(sorted(ANIMALS))
    ration, targets, lows, highs, places, _ = ANIMALS[animal]
    while True:
        low, high = rng.choice(lows), rng.choice(highs)
        lo, hi, t = rng.choice(LOW[low]), rng.choice(HIGH[high]), rng.choice(targets)
        mass = rng.choice([100, 100, 50])
        d = hi - lo
        # a true mix of the two (never half and half), kilograms and percentage to one decimal place at most
        if not (lo + 3 <= t <= hi - 3) or 2 * t == lo + hi or (10 * mass * (t - lo)) % d or (1000 * (t - lo)) % d:
            continue
        feeds = [low, high]
        return {"band": rng.choice(BANDS), "animal": animal, "ration": ration, "place": rng.choice(places),
                "low": [low, lo], "high": [high, hi], "target": t, "mass": mass, "top": rng.choice(feeds),
                "blank": rng.choice(["parts", "parts", "target"]), "ask": [rng.choice(feeds), rng.choice(feeds), rng.choice(feeds)]}


def parts(p: dict) -> dict:
    (low, lo), (high, hi), t = p["low"], p["high"], p["target"]
    return {low: hi - t, high: t - lo}


def draw(p: dict):
    fig, ax = new_figure(8.2, 4.6)
    (low, lo), (high, hi), t = p["low"], p["high"], p["target"]
    cp = {low: lo, high: hi}
    top = p["top"]
    bottom = high if top == low else low
    side = 4.0
    corner = {top: 0.0 + side, bottom: 0.0}  # y of each feed's row
    n = parts(p)
    ax.add_patch(Rectangle((0, 0), side, side, fill=False, edgecolor="#9aa4ad", linewidth=1.0, linestyle=(0, (4, 3))))
    for f, y in corner.items():
        # across the diagonal, from a feed's CP to the other feed's parts
        ax.add_patch(FancyArrowPatch((0.45, y + (-0.45 if y else 0.45)), (side - 0.55, side - y + (0.45 if y else -0.45)),
                                     arrowstyle="-|>", mutation_scale=14, color=INK, linewidth=1.3))
    for f, y in corner.items():
        ax.text(0, y, f"{cp[f]}%", ha="center", va="center", fontsize=12, fontweight="bold", gid=f"cp:{f}",
                bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(-0.75, y, f[0].upper() + f[1:], ha="right", va="center", fontsize=11)
        box = "P" if f == top else "Q"
        shown = box if p["blank"] == "parts" else str(n[f])
        ax.text(side, y, shown, ha="center", va="center", fontsize=12, fontweight="bold", gid=f"parts:{f}",
                bbox=dict(boxstyle="square,pad=0.4", facecolor="#fff6cc" if p["blank"] == "parts" else "white", edgecolor=INK, linewidth=1.2))
        ax.text(side + 0.6, y, f"parts of {f}", ha="left", va="center", fontsize=10.5)
    ax.add_patch(Circle((side / 2, side / 2), 0.62, facecolor="#fff6cc" if p["blank"] == "target" else "white", edgecolor=INK, linewidth=1.3, zorder=3))
    ax.text(side / 2, side / 2, f"{t}%" if p["blank"] == "parts" else "?", ha="center", va="center", fontsize=12.5,
            fontweight="bold", zorder=4, gid="target")
    if p["blank"] == "target":
        ax.plot([side - 0.5, side + 0.5], [-0.62, -0.62], color=INK, linewidth=1.0)
        ax.text(side, -1.05, f"Total: {n[low] + n[high]} parts", ha="center", va="center", fontsize=10.5, gid="total")
    ax.text(side / 2, side + 0.95, f"Pearson square for {p['mass']} kg of {p['ration']}", ha="center", va="center",
            fontsize=12, fontweight="bold", gid="title")
    ax.text(side / 2, -1.75, "CP = crude protein. Feeds on the left, target in the middle, parts on the right.",
            ha="center", va="center", fontsize=9, color="#333333")
    ax.set_xlim(-4.6, 10.4)
    ax.set_ylim(-2.2, side + 1.4)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


VERBS = ["mixes", "prepares", "makes up", "formulates", "blends"]
SETTINGS = ["this week", "for the coming month", "before market day", "in an agriculture lesson", "on feed-mixing day",
            "for a school project"]
WEIGH = ["{friend} weighs out the feeds.", "{friend} mixes one batch.", "At mixing time, {friend} checks the scale.",
         "{friend} fills the mixer."]
SHARE = ["Look at the finished batch.", "{friend} writes the recipe on the store door.", "The farm records the recipe.", ""]


def _kg(x) -> str:
    return f"{exact(x)} kg"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    (low, lo), (high, hi), t, mass, ration = p["low"], p["high"], p["target"], p["mass"], p["ration"]
    n = parts(p)
    total = hi - lo
    other = {low: high, high: low}
    f_parts, f_kg, f_pct = p["ask"]
    kg = {f: Fraction(mass * n[f], total) for f in n}
    intro = f"{who} {rng.choice(VERBS)} {low} and {high} into {ration} at {p['place']} {rng.choice(SETTINGS)}."
    if p["blank"] == "parts":
        box = "P" if f_parts == p["top"] else "Q"
        first = short(f"{intro} In a Pearson square, each feed's parts are the difference between the target CP and the other "
                      f"feed's CP, across the diagonal. How many parts of {f_parts} go in box {box}?",
                      n[f_parts], [f"{n[f_parts]} parts"])
    else:
        first = short(f"{intro} Each feed's parts in the square are the difference between the target CP and the other feed's "
                      f"CP, across the diagonal. What % crude protein did the mix aim for?", t, [f"{t}%", f"{t} %"])
    key = kg[f_kg]
    wrong = [mass - key, n[f_kg], n[other[f_kg]], key * 2, key / 2]
    wrong = [w for w in wrong if w != key and 0 < w <= mass]
    second = mcq(f"{rng.choice(WEIGH).format(friend=friend)} Each feed's share of the mix is its parts ÷ the total parts. "
                 f"How many kilograms of {f_kg} are in {mass} kg of {ration}?", _kg(key), [_kg(w) for w in wrong], rng)
    third = short(f"How many kilograms of {other[f_kg]} are in {mass} kg of {ration}?", exact(kg[other[f_kg]]),
                  measure(kg[other[f_kg]], "kg"))
    pct = exact(Fraction(100 * n[f_pct], total))
    fourth = short(f"{rng.choice(SHARE).format(friend=friend)} What percentage of the {ration} is {f_pct}?".strip(), pct,
                   [f"{pct}%", f"{pct} %"])
    return [first, second, third, fourth]
