"""Stars and the Universe (UP), for IGCSE "Stars and the Universe" and Rwanda S5 "Stellar Distance and Radiation".
Five kinds, every star and galaxy invented:

- hr: a Hertzsprung–Russell diagram (temperature falling to the right, luminosity in Suns on a power-of-ten scale), its
  four regions shaded and named, four lettered stars on gridline crossings, one in each region. Asks which letter is
  a white dwarf (giant, supergiant, main-sequence star), the hottest or the most luminous letter, a star's temperature
  or luminosity.
- wien: the radiation curves of two or three stars, each peak marked with its printed wavelength; Wien's law
  λmax × T = 2.9 × 10⁻³ m K printed. Asks a star's surface temperature and which is hottest.
- hubble: recession speed against distance for five galaxies on gridline crossings, v = H₀ × d printed. Asks a speed,
  the Hubble constant and the distance of a galaxy moving away at a stated speed.
- redshift: a laboratory spectrum and a galaxy's, three absorption lines each with wavelengths printed; v = c × Δλ ÷ λ
  and c = 3.0 × 10⁵ km/s printed. Asks the shift of a line, the galaxy's speed, and whether it moves away or towards us.
- parallax: a table of four stars' parallax angles, d (parsecs) = 1 ÷ p (arcseconds) printed. Asks a distance, the
  nearest star and how many times further one star is than another.
"""
from __future__ import annotations

import math
import random
from fractions import Fraction

from matplotlib.patches import Polygon

from ..core import GRID, INK, NAMES, exact, mcq, new_figure, short
from ._bio_parts import letter_choice

ID = "stars_universe"
KIND = "graph.line"
SUBJECT = "physics"
BANDS = ("UP",)
CONCEPTS = tuple(f"physics.{c}" for c in ("line-spectra", "solar-system-structure", "photon-and-light-energy"))
# A topic whose sections the book lists is reached only if one names stars, galaxies or the Universe.
NEEDS = r"\bstars?\b|stellar|universe|galax|cosmolog|hubble|red.?shift|astronom|parallax|hertzsprung"
AVOID = (r"glossary|solar system|motion in orbits|photoelectric|quantum|atomic|nuclear|radioactiv|modern physics|"
         r"electromagnetic spectrum|lasers?\b|wave.particle|x-ray|energy levels")

LETTERS = ["ABCD", "PQRS", "KLMN", "WXYZ"]
# HR diagram, in log10 temperature and log10 luminosity: each region's outline, and the gridline crossings inside it.
TEMPS = [40000, 20000, 10000, 5000, 2500]
REGIONS = {
    "main sequence": ([(4.66, 6.0), (4.66, 4.2), (3.35, -3.9), (3.35, -2.1)],
                      [(40000, 5), (20000, 3), (10000, 1), (5000, -1), (2500, -3)]),
    "giants": ([(3.78, 1.3), (3.78, 3.4), (3.35, 3.6), (3.35, 1.3)], [(5000, 2), (2500, 2), (2500, 3)]),
    "supergiants": ([(4.15, 4.3), (4.15, 6.25), (3.35, 6.25), (3.35, 4.3)], [(10000, 5), (5000, 5), (2500, 5)]),
    "white dwarfs": ([(4.55, -1.6), (4.55, -3.6), (3.85, -3.6), (3.85, -1.6)],
                     [(20000, -2), (20000, -3), (10000, -2), (10000, -3)]),
}
KINDS_OF_STAR = {"main sequence": "a main-sequence star", "giants": "a giant", "supergiants": "a supergiant",
                 "white dwarfs": "a white dwarf"}
WIEN = {200: 14500, 250: 11600, 290: 10000, 400: 7250, 500: 5800, 580: 5000, 725: 4000, 1000: 2900}
HUBBLE = {50: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200], 60: [50, 100, 150, 200, 250],
          70: [100, 200, 300], 75: [40, 80, 120, 160, 200, 240], 80: [50, 100, 150, 200, 250]}
PARALLAX = ["0.5", "0.25", "0.2", "0.1", "0.05", "0.04", "0.02", "0.01"]
STAR_NAMES = ["Star P", "Star Q", "Star R", "Star S"]


def sample(rng: random.Random) -> dict:
    kind = rng.choice(["hr", "wien", "hubble", "redshift", "parallax"])
    if kind == "hr":
        while True:
            stars = [list(rng.choice(REGIONS[r][1])) for r in REGIONS]
            temps, lums = [t for t, _ in stars], [y for _, y in stars]
            if temps.count(max(temps)) == 1 and lums.count(max(lums)) == 1 and lums.count(min(lums)) == 1:
                break
        letters = list(rng.choice(LETTERS))
        rng.shuffle(letters)
        return {"band": "UP", "kind": kind, "stars": [[L, r, t, y] for L, r, (t, y) in zip(letters, REGIONS, stars)],
                "region": rng.choice(list(REGIONS)), "extreme": rng.choice(["hottest", "most luminous", "least luminous"]),
                "read": [rng.choice(letters), rng.choice(["temperature", "luminosity"])]}
    if kind == "wien":
        n = 3
        peaks = sorted(rng.sample(sorted(WIEN), n))
        names = rng.sample(["P", "Q", "R", "X", "Y", "Z"], n)
        return {"band": "UP", "kind": kind, "stars": [[L, lam] for L, lam in zip(names, peaks)], "ask": rng.choice(names)}
    if kind == "hubble":
        h0 = rng.choice(sorted(HUBBLE))
        ds = sorted(rng.sample(HUBBLE[h0], min(5, len(HUBBLE[h0]))))
        names = rng.sample(["A", "B", "C", "D", "E", "F", "G", "H"], len(ds))
        far = rng.choice([d for d in range(60, 401, 20) if d not in ds and (h0 * d) % 1000 == 0] or [400])
        return {"band": "UP", "kind": kind, "h0": h0, "galaxies": [[L, d] for L, d in zip(names, ds)],
                "read": rng.choice(names), "far": far}
    if kind == "redshift":
        z = rng.choice(["0.02", "0.04", "0.05", "0.01"])
        lab = sorted(rng.sample([400, 450, 500, 550, 600, 650], 3))
        sign = rng.choice([1, 1, -1])
        shifted = [l + sign * Fraction(z) * l for l in lab]
        return {"band": "UP", "kind": kind, "z": z, "sign": sign, "lab": lab,
                "seen": [exact(s) for s in shifted], "ask": rng.randrange(3), "galaxy": rng.choice(["G", "M", "N", "T"])}
    while True:
        ps = rng.sample(PARALLAX, 4)
        ds = [1 / Fraction(p) for p in ps]
        pairs = [(a, b) for a in range(4) for b in range(4) if ds[a] > ds[b] and (ds[a] / ds[b]).denominator == 1]
        if pairs:
            break
    return {"band": "UP", "kind": "parallax", "p": ps, "ask": rng.randrange(4), "pair": list(rng.choice(pairs))}


# --- drawing --------------------------------------------------------------------------------------------------------

def _draw_hr(p: dict):
    fig, ax = new_figure(6.8, 5.8)
    shade = {"main sequence": "#dfe6ec", "giants": "#f1e2cf", "supergiants": "#ead9e6", "white dwarfs": "#e2ecdf"}
    spots = {"giants": (3.56, 1.7), "supergiants": (3.75, 5.95), "white dwarfs": (4.2, -3.95)}  # under its box, clear of the stars' letters
    for name, (poly, _) in REGIONS.items():
        ax.add_patch(Polygon(poly, closed=True, facecolor=shade[name], edgecolor="#777777", linewidth=0.8, zorder=1))
    for name, (x, y) in spots.items():
        ax.text(x, y, name, ha="center", va="center", fontsize=9.5, style="italic", zorder=3, gid=f"region:{name}")
    # the main sequence's name sits in the empty corner beside it, an arrow pointing into the band
    ax.annotate("main sequence", xy=(4.42, 3.55), xytext=(4.47, 0.9), ha="center", va="center", fontsize=9.5,
                style="italic", zorder=3, gid="region:main sequence",
                arrowprops=dict(arrowstyle="-|>", color="#555555", linewidth=0.9, shrinkA=4, shrinkB=0))
    for L, region, t, y in p["stars"]:
        x = math.log10(t)
        ax.plot([x], [y], "o", color=INK, markersize=7, zorder=4, gid=f"star:{L}")
        ax.text(x + 0.05, y + 0.32, L, ha="center", va="center", fontsize=12, fontweight="bold", zorder=5, gid=f"letter:{L}",
                bbox=dict(boxstyle="circle,pad=0.12", facecolor="white", edgecolor=INK, linewidth=0.9))
    ax.set_xlim(4.68, 3.33)
    ax.set_ylim(-4.3, 6.4)
    ax.set_xticks([math.log10(t) for t in TEMPS])
    ax.set_xticklabels([f"{t:,}".replace(",", " ") for t in TEMPS])
    ax.set_yticks(range(-4, 7))
    ax.set_yticklabels(["1" if k == 0 else f"10{str(k).translate(str.maketrans('-0123456789', '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'))}"
                        for k in range(-4, 7)])
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlabel("Surface temperature (K)", fontsize=10.5)
    ax.set_ylabel("Luminosity (the Sun = 1)", fontsize=10.5)
    ax.set_title("A Hertzsprung–Russell diagram", fontsize=11)
    ax.tick_params(labelsize=9.5)
    return fig


def _planck(lam_nm: float, T: float) -> float:
    lam = lam_nm * 1e-9
    return 1 / (lam ** 5 * (math.exp(1.4388e-2 / (lam * T)) - 1))


def _draw_wien(p: dict):
    """One panel per star, each curve scaled to its own peak, so a cool star's curve is not lost under a hot one's."""
    import matplotlib.pyplot as plt
    n = len(p["stars"])
    fig, axes = plt.subplots(n, 1, figsize=(7.0, 1.65 * n + 1.1), sharex=True)
    xs = [50 + i * 4 for i in range(0, 401)]
    for ax, (L, lam) in zip(axes, p["stars"]):
        T = WIEN[lam]
        top = _planck(lam, T)
        ax.plot(xs, [_planck(x, T) / top for x in xs], color=INK, linewidth=1.6, gid=f"curve:{L}")
        ax.plot([lam, lam], [0, 1], color=INK, linewidth=0.8, linestyle=(0, (2, 2)), gid=f"peak:{L}")
        ax.set_title(f"star {L}: the peak is at {lam} nm", loc="left", fontsize=10, gid=f"label:{L}")
        ax.set_ylim(0, 1.15)
        ax.set_yticks([])
        ax.set_xlim(50, 1650)
        ax.set_xticks(range(100, 1601, 100))
        ax.grid(True, axis="x", color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        ax.tick_params(labelsize=8.5)
    axes[-1].set_xlabel("Wavelength (nm)", fontsize=10.5)
    axes[n // 2].set_ylabel("Intensity", fontsize=10.5)
    fig.suptitle("Radiation from the surfaces of some stars\nWien's law: λmax × T = 2.9 × 10⁻³ m K", fontsize=10.5)
    fig.subplots_adjust(hspace=0.6, top=1 - 0.75 / (1.65 * n + 1.1))
    return fig


def _draw_hubble(p: dict):
    fig, ax = new_figure(6.8, 5.0)
    h0 = p["h0"]
    dmax = max(d for _, d in p["galaxies"]) + 40
    dmax = (dmax + 49) // 50 * 50
    vmax = (h0 * dmax + 1999) // 2000 * 2000
    ax.set_xlim(0, dmax)
    ax.set_ylim(0, vmax)
    ax.set_xticks(range(0, dmax + 1, 50))
    ax.set_xticks(range(0, dmax + 1, 10), minor=True)
    ax.set_yticks(range(0, vmax + 1, 2000))
    ax.set_yticks(range(0, vmax + 1, 1000), minor=True)
    ax.grid(True, which="major", color=GRID, linewidth=0.8)
    ax.grid(True, which="minor", color=GRID, linewidth=0.35)
    ax.set_axisbelow(True)
    ax.plot([0, dmax], [0, h0 * dmax], color=INK, linewidth=1.2, gid="fit")
    for L, d in p["galaxies"]:
        ax.plot([d], [h0 * d], "o", color=INK, markersize=6, gid=f"galaxy:{L}")
        ax.text(d + 0.025 * dmax, h0 * d - 0.035 * vmax, f"galaxy {L}", ha="left", va="top", fontsize=9.5, gid=f"label:{L}")
    ax.set_xlabel("Distance from the Earth (Mpc)", fontsize=10.5)
    ax.set_ylabel("Speed moving away (km/s)", fontsize=10.5)
    ax.set_title("Speed and distance of some galaxies\nv = H₀ × d", fontsize=10.5)
    ax.tick_params(labelsize=9)
    return fig


def _draw_redshift(p: dict):
    fig, ax = new_figure(7.4, 3.6)
    for row, (label, lines) in enumerate((("light from a laboratory source", p["lab"]),
                                          (f"light from galaxy {p['galaxy']}", [Fraction(s) for s in p["seen"]]))):
        y = 2.2 - 1.6 * row
        ax.add_patch(Polygon([(380, y), (720, y), (720, y + 0.7), (380, y + 0.7)], closed=True, facecolor="#e9e3f2",
                             edgecolor=INK, linewidth=1.0))
        ax.text(380, y + 0.95, label, ha="left", va="center", fontsize=10)
        for lam in lines:
            ax.plot([float(lam)] * 2, [y, y + 0.7], color=INK, linewidth=2.0, gid=f"line:{row}:{exact(lam)}")
            ax.text(float(lam), y - 0.2, f"{exact(lam)} nm", ha="center", va="center", fontsize=9, gid=f"wl:{row}:{exact(lam)}")
    ax.text(550, 3.55, "v = c × Δλ ÷ λ,  where c = 3.0 × 10⁵ km/s and Δλ is the change in wavelength", ha="center",
            va="center", fontsize=9.5)
    ax.set_xlim(370, 730)
    ax.set_ylim(0.2, 3.8)
    ax.axis("off")
    return fig


def _draw_parallax(p: dict):
    fig, ax = new_figure(6.4, 3.4)
    ax.text(0.5, 3.6, "d = 1 ÷ p, where d is in parsecs and p is the parallax angle in arcseconds", ha="center",
            va="center", fontsize=10)
    ax.text(0.15, 2.85, "Star", ha="center", va="center", fontsize=10.5, fontweight="bold")
    ax.text(0.65, 2.85, "Parallax angle p (arcseconds)", ha="center", va="center", fontsize=10.5, fontweight="bold")
    ax.plot([0.0, 1.0], [2.6, 2.6], color=INK, linewidth=1.0)
    for k, (name, angle) in enumerate(zip(STAR_NAMES, p["p"])):
        y = 2.2 - 0.55 * k
        ax.text(0.15, y, name, ha="center", va="center", fontsize=10.5, gid=f"star:{k}")
        ax.text(0.65, y, angle, ha="center", va="center", fontsize=10.5, gid=f"p:{k}")
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(0.2, 3.9)
    ax.axis("off")
    return fig


def draw(p: dict):
    return {"hr": _draw_hr, "wien": _draw_wien, "hubble": _draw_hubble, "redshift": _draw_redshift,
            "parallax": _draw_parallax}[p["kind"]](p)


# --- questions ------------------------------------------------------------------------------------------------------

SETTINGS = ["in a lesson on space physics", "at the astronomy club in Musanze", "for homework", "for a class test in Kigali",
            "while revising in Huye", "in a physics class in Rubavu", "for a project on the stars"]


def _power(k: int) -> str:
    return "1" if k == 0 else str(10 ** k) if k > 0 else exact(Fraction(1, 10 ** -k))


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["kind"] == "hr":
        stars = {L: (r, t, y) for L, r, t, y in p["stars"]}
        letters = sorted(stars)
        key = next(L for L, (r, _, _) in stars.items() if r == p["region"])
        qs = [letter_choice(f"{who} studied this Hertzsprung–Russell diagram {setting}. Which lettered star is "
                            f"{KINDS_OF_STAR[p['region']]}?", key, letters)]
        pick = {"hottest": max(stars, key=lambda L: stars[L][1]), "most luminous": max(stars, key=lambda L: stars[L][2]),
                "least luminous": min(stars, key=lambda L: stars[L][2])}[p["extreme"]]
        qs.append(letter_choice(f"Which lettered star is the {p['extreme']}?", pick, letters))
        L, what = p["read"]
        _, t, y = stars[L]
        if what == "temperature":
            qs.append(short(f"What is the surface temperature of star {L}, in kelvin?", t,
                            [str(t), f"{t} K", f"{t:,} K", f"{t:,}".replace(",", " "), f"{t:,}".replace(",", " ") + " K"]))
        else:
            v = _power(y)
            qs.append(short(f"How many times as luminous as the Sun is star {L}?", v, [v, f"{v} times"]))
        return qs
    if p["kind"] == "wien":
        L = p["ask"]
        lam = dict(p["stars"])[L]
        T = WIEN[lam]
        hottest = min(p["stars"], key=lambda s: s[1])[0]
        return [short(f"{who} compared the light from some stars {setting}. Using Wien's law, what is the surface "
                      f"temperature of star {L}, in kelvin?", T, [str(T), f"{T} K", f"{T:,}".replace(",", " "), f"{T:,} K"]),
                letter_choice("Which star has the hottest surface?", hottest, sorted(s[0] for s in p["stars"]))]
    if p["kind"] == "hubble":
        h0 = p["h0"]
        d = dict(p["galaxies"])[p["read"]]
        v = h0 * d
        far = p["far"]
        vfar = h0 * far
        return [short(f"{who} plotted the speeds of some galaxies {setting}. How fast is galaxy {p['read']} moving away "
                      f"from the Earth, in km/s?", v, [str(v), f"{v} km/s", f"{v:,} km/s", f"{v:,}".replace(",", " ")]),
                short("Using v = H₀ × d, what is the Hubble constant H₀ shown by the graph, in km/s per Mpc?", h0,
                      [str(h0), f"{h0} km/s per Mpc", f"{h0} km/s/Mpc"]),
                short(f"Another galaxy is moving away at {f'{vfar:,}'.replace(',', ' ')} km/s. How far from the Earth is it, "
                      f"in Mpc?", far, [str(far), f"{far} Mpc"])]
    if p["kind"] == "redshift":
        k = p["ask"]
        lab, seen = p["lab"][k], Fraction(p["seen"][k])
        shift = abs(seen - lab)
        v = Fraction(300000) * shift / lab
        towards = p["sign"] < 0
        return [short(f"{who} compared these two spectra {setting}. By how many nanometres has the line at {lab} nm moved "
                      f"in the light from galaxy {p['galaxy']}?", exact(shift), [exact(shift), f"{exact(shift)} nm"]),
                short(f"Using the formula printed, how fast is galaxy {p['galaxy']} moving, in km/s?", exact(v),
                      [exact(v), f"{exact(v)} km/s", f"{int(v):,} km/s".replace(",", " ")]),
                mcq(f"Is galaxy {p['galaxy']} moving towards the Earth or away from it?",
                    "it is moving closer" if towards else "it is moving away",
                    ["it is moving away", "it is moving closer", "it is not moving"], rng)]
    ps = [Fraction(x) for x in p["p"]]
    k = p["ask"]
    d = 1 / ps[k]
    a, b = p["pair"]
    nearest = max(range(4), key=lambda i: ps[i])
    return [short(f"{who} looked up these stars {setting}. How far away is {STAR_NAMES[k]}, in parsecs?", exact(d),
                  [exact(d), f"{exact(d)} parsecs", f"{exact(d)} pc"]),
            mcq("Which star in the table is nearest to the Earth?", STAR_NAMES[nearest], STAR_NAMES, rng),
            short(f"How many times further from the Earth is {STAR_NAMES[a]} than {STAR_NAMES[b]}?",
                  exact((1 / ps[a]) / (1 / ps[b])), [exact((1 / ps[a]) / (1 / ps[b])), f"{exact((1 / ps[a]) / (1 / ps[b]))} times"])]
