"""Gene technology (LS, UP, AL).

Four sub-types:
- steps (LS, UP): making a human protein (insulin or human growth hormone) in bacteria. Six pictures, lettered A-F in
  a shuffled order, each one step: the gene cut out of a strand of DNA, a plasmid ring cut open, the gene joined into
  the ring, the ring inside a bacterium, bacteria multiplying in a fermenter, the protein collected in a bottle. The
  steps are printed in order, numbered 1-6, with a key of the two enzymes (a restriction enzyme cuts DNA, DNA ligase
  joins it). Which picture shows a step; which step a picture shows; which enzyme the step in a picture uses.
- forensic (UP, AL): a gel with a DNA ladder (sizes printed beside it), the crime-scene sample and three or four
  suspects. Exactly one suspect has every band of the crime-scene sample and no other. Which suspect matches; the size
  of the smallest crime-scene fragment; how many bands another suspect shares with the scene.
- paternity (UP, AL): mother, child and two or three men. The child's bands not in the mother came from the father, and
  exactly one man has them all; no band of the child is in both the mother and that man. Which man could be the father;
  the largest fragment from the father; how many of the child's bands the mother shares.
- restriction (UP, AL): a map of a DNA molecule with an enzyme's cutting sites at printed distances, and four lanes A-D
  beside the ladder; exactly one lane shows the fragments. Which lane; how many fragments; the longest fragment.

Bands sit exactly on the ladder's sizes (the gel spaces them by the logarithm of size, as a real gel does), so every
size is read off the ladder. DNA moves from the wells (-) towards + and the figure says so.
"""
from __future__ import annotations

import math
import random

from matplotlib.patches import Arc, Circle, Ellipse, FancyBboxPatch, Rectangle

from ..core import FILL_2, INK, NAMES, count, mcq, new_figure, short

ID = "gene_technology"
KIND = "bio.genetics"
SUBJECT = "biology"
BANDS = ("LS", "UP", "AL")
CONCEPTS = tuple(f"biology.{c}" for c in ("genetic-engineering", "gel-electrophoresis", "plasmids-gene-manipulation",
                                          "bacteria-biotechnology-genetic-engineering"))
# A topic whose sections the book lists is reached only if one names genetic engineering, a gel or a plasmid.
NEEDS = (r"genetic engineering|gene technology|genetic technolog|electrophoresis|recombinant|plasmid|forensic|"
         r"biotechnology|genetically modified|\bgmos?\b|gene transfer")
AVOID = (r"sexual|contracept|pregnan|\bstis?\b|\bhiv\b|social factors|glossary|science in context|reproduction system|"
         r"inherited change|^genetics$|mutation|variation|culturing|microbiology|replication")

LADDER = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000]
PRODUCTS = {"insulin": "insulin", "human growth hormone": "human growth hormone"}
STEPS = ["Cut the {gene} gene out of human DNA", "Cut open a plasmid taken from a bacterium",
         "Join the gene into the plasmid", "Put the plasmid into a bacterium", "Grow the bacteria in a fermenter",
         "Collect and purify the {product}"]
ENZYME = {1: "restriction enzyme", 2: "restriction enzyme", 3: "DNA ligase"}
ENZYMES = ["restriction enzyme", "DNA ligase", "DNA polymerase", "amylase"]
CUTTERS = ["EcoRI", "BamHI", "HindIII"]


def concepts_for(p: dict) -> list:
    if p["kind"] == "steps":
        return ["biology.genetic-engineering", "biology.plasmids-gene-manipulation",
                "biology.bacteria-biotechnology-genetic-engineering"]
    return ["biology.genetic-engineering", "biology.gel-electrophoresis"]


def avoid_for(p: dict) -> str:
    # A gel is not taught in S4's biotechnology unit (enzymes, fermenters, biogas), only its genetic engineering steps.
    return AVOID if p["kind"] == "steps" else AVOID + r"|biotechnology and its application"


# --- sampling -----------------------------------------------------------------------------------------------------

def _steps(rng: random.Random) -> dict:
    order = list(range(1, 7))
    rng.shuffle(order)
    return {"band": rng.choice(["LS", "UP"]), "kind": "steps", "product": rng.choice(sorted(PRODUCTS)),
            "letters": dict(zip("ABCDEF", order)), "ask_step": rng.randint(1, 6), "ask_letter": rng.choice("ABCDEF"),
            "ask_enzyme": rng.choice([1, 2, 3, 3])}


def _forensic(rng: random.Random) -> dict:
    scene = sorted(rng.sample(LADDER, rng.choice([3, 4])))
    n = rng.choice([3, 4])
    match = rng.randrange(n)
    lanes = [["Crime scene", scene]]
    others = []
    for i in range(n):
        if i == match:
            bands = list(scene)
        else:
            while True:
                keep = rng.sample(scene, rng.randint(1, len(scene) - 1))
                extra = rng.sample([x for x in LADDER if x not in scene], len(scene) - len(keep) + rng.randint(0, 1))
                bands = sorted(keep + extra)
                if bands not in others and set(bands) != set(scene):
                    break
            others.append(bands)
        lanes.append([f"Suspect {i + 1}", sorted(bands)])
    ask = rng.choice([i for i in range(n) if i != match]) + 1
    return {"band": rng.choice(["UP", "AL"]), "kind": "forensic", "lanes": lanes, "ask": ask}


def _paternity(rng: random.Random) -> dict:
    while True:
        pool = list(LADDER)
        rng.shuffle(pool)
        maternal = pool[:rng.choice([2, 3])]
        paternal = pool[len(maternal):len(maternal) + 2]
        rest = pool[len(maternal) + 2:]
        mother = maternal + rest[:4 - len(maternal)]
        rest = rest[4 - len(maternal):]
        father = paternal + rng.sample([x for x in rest + mother if x not in maternal], 2)
        n = 3  # three men, so the question has three options
        men = []
        dad = rng.randrange(n)
        ok = True
        for i in range(n):
            if i == dad:
                men.append(sorted(father))
                continue
            share = rng.sample(paternal, rng.randint(0, 1))
            fill = rng.sample([x for x in LADDER if x not in paternal], 4 - len(share))
            men.append(sorted(share + fill))
        if len({tuple(x) for x in men}) < n:
            ok = False
        if ok:
            break
    lanes = [["Mother", sorted(mother)], ["Child", sorted(maternal + paternal)]]
    lanes += [[f"Man {i + 1}", men[i]] for i in range(n)]
    return {"band": rng.choice(["UP", "AL"]), "kind": "paternity", "lanes": lanes}


def _restriction(rng: random.Random) -> dict:
    while True:
        frags = [rng.choice(LADDER[1:9]) for _ in range(rng.choice([2, 3]))]
        length = sum(frags)
        if length <= 3000 and min(frags) >= 0.12 * length and len(set(frags)) == len(frags):
            break
    sites = [sum(frags[:i + 1]) for i in range(len(frags) - 1)]
    right = sorted(frags)
    wrong = []
    if length in LADDER:
        wrong.append([length])  # not cut at all
    for i in range(len(frags) - 1):  # one site missed
        merged = sorted(frags[:i] + [frags[i] + frags[i + 1]] + frags[i + 2:])
        if all(x in LADDER for x in merged):
            wrong.append(merged)
    if all(x in LADDER for x in sites) and len(sites) > 1:
        wrong.append(sorted(sites))  # the sites' distances read as sizes
    rng.shuffle(wrong)
    picked = []
    for w in wrong:
        if w != right and w not in picked:
            picked.append(w)
    while len(picked) < 3:
        w = sorted(rng.sample(LADDER[1:11], len(frags)))
        if w != right and w not in picked:
            picked.append(w)
    lanes = [right] + picked[:3]
    rng.shuffle(lanes)
    return {"band": rng.choice(["UP", "AL"]), "kind": "restriction", "length": length, "sites": sites,
            "enzyme": rng.choice(CUTTERS), "gel": dict(zip("ABCD", lanes))}


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["steps", "forensic", "paternity", "restriction"])
    return {"steps": _steps, "forensic": _forensic, "paternity": _paternity, "restriction": _restriction}[kind](rng)


# --- drawing: the steps -------------------------------------------------------------------------------------------

def _dna(ax, x0, x1, y, gid=None, shade=False):
    """A short stretch of double-stranded DNA: two strands and rungs."""
    for dy in (-0.12, 0.12):
        ax.plot([x0, x1], [y + dy, y + dy], color=INK, linewidth=1.6, gid=gid)
    k = max(2, int((x1 - x0) / 0.16))
    for i in range(k + 1):
        x = x0 + (x1 - x0) * i / k
        ax.plot([x, x], [y - 0.12, y + 0.12], color=INK, linewidth=0.8)
    if shade:
        ax.add_patch(Rectangle((x0, y - 0.12), x1 - x0, 0.24, facecolor="#8a96a0", edgecolor="none", zorder=0.5))


def _ring(ax, cx, cy, r, gap=False, insert=False):
    if gap:
        ax.add_patch(Arc((cx, cy), 2 * r, 2 * r, theta1=25, theta2=335, color=INK, linewidth=3.2))
    else:
        ax.add_patch(Circle((cx, cy), r, fill=False, edgecolor=INK, linewidth=3.2))
    if insert:
        ax.add_patch(Arc((cx, cy), 2 * r, 2 * r, theta1=-28, theta2=28, color="#8a96a0", linewidth=6.5))


def _picture(ax, step: int, x: float, y: float, w: float, h: float):
    cx, cy = x + w / 2, y + h / 2 - 0.1
    if step == 1:  # the gene, cut out of a strand of DNA and lifted clear of it
        _dna(ax, x + 0.25, cx - 0.55, cy - 0.3)
        _dna(ax, cx + 0.55, x + w - 0.25, cy - 0.3)
        _dna(ax, cx - 0.4, cx + 0.4, cy + 0.35, shade=True)
    elif step == 2:  # a plasmid ring, cut open
        _ring(ax, cx, cy, 0.6, gap=True)
    elif step == 3:  # the gene joined into the ring
        _ring(ax, cx, cy, 0.6, insert=True)
    elif step == 4:  # the ring inside a bacterium
        ax.add_patch(FancyBboxPatch((cx - 0.95, cy - 0.5), 1.9, 1.0, boxstyle="round,pad=0,rounding_size=0.45",
                                    facecolor="white", edgecolor=INK, linewidth=1.6))
        _ring(ax, cx + 0.45, cy, 0.24, insert=True)
        t = [i / 40 for i in range(41)]
        ax.plot([cx - 0.75 + 0.75 * s for s in t], [cy + 0.22 * math.sin(6 * math.pi * s) for s in t], color=INK,
                linewidth=1.0)
    elif step == 5:  # bacteria multiplying in a fermenter
        ax.add_patch(FancyBboxPatch((cx - 0.75, cy - 0.65), 1.5, 1.3, boxstyle="round,pad=0,rounding_size=0.2",
                                    facecolor=FILL_2, edgecolor=INK, linewidth=1.6))
        ax.plot([cx, cx], [cy + 0.65, cy - 0.3], color=INK, linewidth=1.4)
        ax.plot([cx - 0.3, cx + 0.3], [cy - 0.3, cy - 0.3], color=INK, linewidth=2.2)
        for i in range(9):
            bx = cx - 0.55 + 0.27 * (i % 5) + (0.13 if i >= 5 else 0)
            by = cy + 0.25 - 0.5 * (i // 5) + (0.08 if i % 2 else 0)
            if abs(bx - cx) < 0.12:
                continue
            ax.add_patch(Ellipse((bx, by), 0.2, 0.11, facecolor="white", edgecolor=INK, linewidth=0.9))
    else:  # the protein, purified into a bottle
        ax.add_patch(Rectangle((cx - 0.32, cy - 0.6), 0.64, 0.95, facecolor="white", edgecolor=INK, linewidth=1.6))
        ax.add_patch(Rectangle((cx - 0.18, cy + 0.35), 0.36, 0.22, facecolor=FILL_2, edgecolor=INK, linewidth=1.4))
        ax.add_patch(Rectangle((cx - 0.32, cy - 0.45), 0.64, 0.45, facecolor="#c9d1d7", edgecolor="none"))
        ax.add_patch(Rectangle((cx - 0.32, cy - 0.6), 0.64, 0.95, fill=False, edgecolor=INK, linewidth=1.6))


def _draw_steps(p: dict):
    fig, ax = new_figure()
    w, h, gap = 2.9, 2.0, 0.25
    top = 9.4
    for i, letter in enumerate("ABCDEF"):
        col, row = i % 3, i // 3
        x, y = col * (w + gap), top - (row + 1) * h - row * gap
        ax.add_patch(Rectangle((x, y), w, h, fill=False, edgecolor=INK, linewidth=1.2,
                               gid=f"pic:{letter}:{p['letters'][letter]}"))
        ax.text(x + 0.12, y + h - 0.12, letter, ha="left", va="top", fontsize=14, fontweight="bold")
        _picture(ax, p["letters"][letter], x, y, w, h)
    gene = "insulin" if p["product"] == "insulin" else "growth hormone"
    y = top - 2 * h - gap - 0.45
    ax.text(0, y, f"The steps in making {p['product']} by genetic engineering, in order:", ha="left", va="top",
            fontsize=10.5, fontweight="bold")
    for k, step in enumerate(STEPS, start=1):
        ax.text(0.15, y - 0.5 - 0.42 * (k - 1), f"{k}. " + step.format(gene=gene, product=p["product"]),
                ha="left", va="top", fontsize=10)
    ky = y - 0.5 - 0.42 * 6 - 0.2
    ax.text(0, ky, "Enzymes:", ha="left", va="top", fontsize=10, fontweight="bold")
    ax.text(1.35, ky, "restriction enzyme: cuts DNA at a particular base sequence", ha="left", va="top", fontsize=10)
    ax.text(1.35, ky - 0.42, "DNA ligase: joins two pieces of DNA together", ha="left", va="top", fontsize=10)
    width = 3 * w + 2 * gap
    ax.set_xlim(-0.1, width + 0.1)
    ax.set_ylim(ky - 0.75, top + 0.1)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(0.86 * (width + 0.2), 0.86 * (top + 0.85 - ky))
    ax.set_position([0, 0, 1, 1])
    return fig


# --- drawing: the gels --------------------------------------------------------------------------------------------

GEL_TOP, GEL_H = 6.4, 5.4


def _band_y(size: int) -> float:
    lo, hi = math.log10(LADDER[0]), math.log10(LADDER[-1])
    return GEL_TOP - 0.5 - (hi - math.log10(size)) / (hi - lo) * GEL_H


def _gel(ax, lanes: list, x0: float, lane_w: float, label_size: float):
    """The gel, its wells and bands; lanes is [(label, sizes)], the ladder first."""
    n = len(lanes)
    width = n * lane_w
    bottom = _band_y(LADDER[0]) - 0.45
    ax.add_patch(Rectangle((x0, bottom), width, GEL_TOP - bottom, facecolor="#eef1f3", edgecolor=INK, linewidth=1.3))
    for i, (label, sizes) in enumerate(lanes):
        cx = x0 + (i + 0.5) * lane_w
        # a well: a hollow slot, not a band
        ax.add_patch(Rectangle((cx - 0.3, GEL_TOP - 0.24), 0.6, 0.16, facecolor="white", edgecolor=INK, linewidth=1.0))
        ax.text(cx, GEL_TOP + 0.12, label, ha="center", va="bottom", fontsize=label_size, fontweight="bold")
        for s in sizes:
            ax.add_patch(Rectangle((cx - 0.3, _band_y(s) - 0.05), 0.6, 0.1, facecolor=INK, edgecolor=INK,
                                   gid=f"band:{label}:{s}"))
    for s in LADDER:
        ax.text(x0 - 0.12, _band_y(s), str(s), ha="right", va="center", fontsize=8.5)
    ax.text(x0 - 0.12, GEL_TOP + 0.12, "size (bp)", ha="right", va="bottom", fontsize=8.5)
    ax.text(x0 + width + 0.15, GEL_TOP - 0.15, "−", ha="left", va="center", fontsize=16, fontweight="bold")
    ax.text(x0 + width + 0.15, bottom + 0.2, "+", ha="left", va="center", fontsize=16, fontweight="bold")
    ax.text(x0 + width / 2, bottom - 0.15, "Wells at the top (−); DNA moves towards + (smaller pieces move further)",
            ha="center", va="top", fontsize=8.5)
    return bottom, x0 + width


def _draw_gel(p: dict):
    fig, ax = new_figure()
    if p["kind"] == "restriction":
        lanes = [["Ladder", LADDER]] + [[k, v] for k, v in p["gel"].items()]
        lane_w = 1.0
    else:
        lanes = [["Ladder", LADDER]] + [list(x) for x in p["lanes"]]
        lane_w = 1.55
    x0 = 1.1
    bottom, right = _gel(ax, lanes, x0, lane_w, 9)
    top = GEL_TOP + 0.6
    title = {"forensic": "DNA profiles: a sample from a crime scene and four suspects",
             "paternity": "DNA profiles: a mother, her child and the men who could be the father",
             "restriction": "A DNA molecule, and a gel: one lane shows it cut with " + p.get("enzyme", "")}[p["kind"]]
    if p["kind"] == "forensic" and len(p["lanes"]) == 4:
        title = title.replace("four", "three")
    if p["kind"] == "paternity" and len(p["lanes"]) == 4:
        title = title.replace("the men who could", "two men who could")
    if p["kind"] == "paternity" and len(p["lanes"]) == 5:
        title = title.replace("the men who could", "three men who could")
    if p["kind"] == "restriction":
        # the map of the DNA molecule above the gel
        L = p["length"]
        mx0, mx1 = x0, right
        my = top + 1.0
        ax.add_patch(Rectangle((mx0, my - 0.09), mx1 - mx0, 0.18, facecolor="#8a96a0", edgecolor=INK, linewidth=1.0))
        ax.text(mx0, my - 0.28, "0", ha="center", va="top", fontsize=8.5)
        ax.text(mx1, my - 0.28, str(L), ha="center", va="top", fontsize=8.5)
        for s in p["sites"]:
            x = mx0 + (mx1 - mx0) * s / L
            ax.plot([x, x], [my - 0.2, my + 0.38], color=INK, linewidth=1.6)
            ax.text(x, my - 0.28, str(s), ha="center", va="top", fontsize=8.5)
            ax.text(x, my + 0.45, p["enzyme"], ha="center", va="bottom", fontsize=8.5)
        ax.text(mx0, my + 1.0, f"A DNA molecule {L} bp long. Distances in bp from its left end; "
                               f"{p['enzyme']} cuts at each site marked.", ha="left", va="bottom", fontsize=9)
        top = my + 1.45
        ax.text(x0 - 0.9, top + 0.1, title, ha="left", va="bottom", fontsize=10.5, fontweight="bold")
        top += 0.5
    else:
        ax.text(x0 - 0.9, top + 0.1, title, ha="left", va="bottom", fontsize=10.5, fontweight="bold")
        top += 0.55
    xr = max(right + 0.6, x0 - 0.9 + 0.105 * len(title) + 0.3)
    ax.set_xlim(-0.05, xr)
    ax.set_ylim(bottom - 0.65, top)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.set_size_inches(0.62 * (xr + 0.05), 0.62 * (top - bottom + 0.65))
    ax.set_position([0, 0, 1, 1])
    return fig


def draw(p: dict):
    return _draw_steps(p) if p["kind"] == "steps" else _draw_gel(p)


# --- questions ----------------------------------------------------------------------------------------------------

SETTINGS = ["in a biology lesson", "for revision", "for a class test", "at the science club in Musanze",
            "for homework", "on a worksheet in Huye"]
VERBS = ["studies", "looks at", "is given", "examines"]


def _bp(n: int) -> list:
    return [str(n), f"{n} bp", f"{n}bp", f"{n} base pairs"]


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    lead = f"{who} {rng.choice(VERBS)} this figure {rng.choice(SETTINGS)}."
    if p["kind"] == "steps":
        letters = p["letters"]
        by_step = {v: k for k, v in letters.items()}
        k = p["ask_step"]
        x = p["ask_letter"]
        e = by_step[p["ask_enzyme"]]
        return [mcq(f"{lead} Which picture shows step {k}?", by_step[k],
                    rng.sample([L for L in "ABCDEF" if L != by_step[k]], 3), rng),
                short(f"Which step number does picture {x} show?", letters[x], [f"step {letters[x]}"]),
                mcq(f"Which enzyme is used in the step shown in picture {e}?", ENZYME[letters[e]],
                    [z for z in ENZYMES if z != ENZYME[letters[e]]], rng)]
    if p["kind"] == "forensic":
        lanes = dict((a, b) for a, b in p["lanes"])
        scene = lanes["Crime scene"]
        suspects = [a for a in lanes if a.startswith("Suspect")]
        match = next(a for a in suspects if lanes[a] == scene)
        ask = f"Suspect {p['ask']}"
        shared = len(set(lanes[ask]) & set(scene))
        return [mcq(f"{lead} Which suspect's DNA profile matches the DNA from the crime scene?", match,
                    [a for a in suspects if a != match], rng),
                short("What is the size of the smallest DNA fragment in the crime-scene sample, in base pairs?",
                      min(scene), _bp(min(scene))[1:]),
                count(f"How many of {ask}'s bands are also in the crime-scene sample?", shared, "bands")]
    if p["kind"] == "paternity":
        lanes = dict((a, b) for a, b in p["lanes"])
        mother, child = set(lanes["Mother"]), set(lanes["Child"])
        fromdad = child - mother
        men = [a for a in lanes if a.startswith("Man")]
        dad = next(a for a in men if fromdad <= set(lanes[a]))
        return [mcq(f"{lead} Which man could be the child's biological father?", dad, [a for a in men if a != dad], rng),
                short("What is the size of the largest DNA fragment the child inherited from its father, in base pairs?",
                      max(fromdad), _bp(max(fromdad))[1:]),
                count("How many of the child's bands are also in the mother's DNA profile?", len(child & mother),
                      "bands")]
    gel = p["gel"]
    frags = sorted(b - a for a, b in zip([0, *p["sites"]], [*p["sites"], p["length"]]))
    right = next(k for k, v in gel.items() if sorted(v) == frags)
    return [mcq(f"{lead} Which lane shows the fragments made when this DNA is cut with {p['enzyme']}?", f"lane {right}",
                [f"lane {k}" for k in gel if k != right], rng),
            count(f"Into how many fragments does {p['enzyme']} cut this DNA molecule?", len(frags), "fragments"),
            short(f"What is the length of the longest fragment {p['enzyme']} makes from this DNA, in base pairs?",
                  max(frags), _bp(max(frags))[1:])]
