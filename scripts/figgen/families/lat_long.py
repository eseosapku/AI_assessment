"""Latitude and longitude (LS, UP): a grid of lines of latitude and longitude 15° apart, from 60°S to 60°N and 75°W
to 75°E, the Equator and the Prime Meridian marked, and points A to D on gridline crossings. A point's latitude, a
point's longitude, the local time at one point when it is noon at another, and the difference in latitude between
two points.

Every key is the grid: 15° of longitude is one hour, and places to the east are ahead. No point lies on the Equator
or the Prime Meridian, so every latitude has its N or S and every longitude its E or W.
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, new_figure, short

ID = "lat_long"
KIND = "geo.map"
SUBJECT = "geography"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"geography.{c}" for c in ("earth-movements", "earth-universe", "cartographic-projections"))
AVOID = r"tectonic|structure of the earth|origin of the earth"  # topics that teach none of it, read by name and section (P3m)
# A topic whose sections the book lists is reached only if one names what this figure teaches.
NEEDS = r"latitude|longitude|earth|universe|time|projection|location|globe"
LATS = [v for v in range(-60, 61, 15) if v]
LONS = [v for v in range(-75, 76, 15) if v]


def lat_text(v: int) -> str:
    return f"{abs(v)}°{'N' if v > 0 else 'S'}"


def lon_text(v: int) -> str:
    return f"{abs(v)}°{'E' if v > 0 else 'W'}"


def sample(rng: random.Random) -> dict:
    while True:
        cells = rng.sample([(la, lo) for la in LATS for lo in LONS], 4)
        pts = {k: [la, lo] for k, (la, lo) in zip("ABCD", cells)}
        t1, t2 = rng.sample("ABCD", 2)
        d1, d2 = rng.sample("ABCD", 2)
        if pts[t1][1] != pts[t2][1] and pts[d1][0] != pts[d2][0]:
            return {"band": rng.choice(BANDS), "points": pts, "lat": rng.choice("ABCD"), "lon": rng.choice("ABCD"),
                    "time": [t1, t2], "diff": [d1, d2]}


def draw(p: dict):
    fig, ax = new_figure(7.6, 5.4)
    for v in range(-60, 61, 15):
        ax.plot([-75, 75], [v, v], color=INK if v == 0 else "#9aa8b4", linewidth=1.6 if v == 0 else 0.8)
        ax.text(-77, v, lat_text(v) if v else "0°", ha="right", va="center", fontsize=8.5)
    for v in range(-75, 76, 15):
        ax.plot([v, v], [-60, 60], color=INK if v == 0 else "#9aa8b4", linewidth=1.6 if v == 0 else 0.8)
        ax.text(v, -63, lon_text(v) if v else "0°", ha="center", va="top", fontsize=8.5)
    ax.text(75, 2, "Equator", ha="right", va="bottom", fontsize=9, fontweight="bold")
    ax.text(1.5, 58, "Prime Meridian", ha="left", va="top", fontsize=9, fontweight="bold", rotation=90)
    for name, (la, lo) in p["points"].items():
        ax.plot([lo], [la], marker="o", markersize=7, color="#c0392b", markeredgecolor=INK, zorder=4)
        ax.text(lo + 2.5, la + 2.5, name, ha="left", va="bottom", fontsize=12, fontweight="bold", zorder=5,
                bbox=dict(boxstyle="square,pad=0.05", facecolor="white", edgecolor="none", alpha=0.85))
    ax.set_xlim(-92, 80)
    ax.set_ylim(-70, 64)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


SETTINGS = ["in a geography lesson", "for homework", "on a revision card", "for a class test", "in an atlas project"]


def _time_forms(h: int) -> list[str]:
    twelve = h % 12 or 12
    half = "a.m." if h < 12 else "p.m."
    bare = half.replace(".", "")
    return [f"{h:02d}:00", f"{h}:00", f"{h:02d}00", f"{h:02d}.00", f"{twelve} {half}", f"{twelve}{bare}", f"{twelve} {bare}",
            f"{twelve}:00 {half}", f"{twelve}:00{bare}", f"{twelve}:00 {bare}", f"{twelve}.00 {half}", f"{twelve}.00{bare}",
            f"{h:02d}00 hours", f"{h:02d}:00 hours"]


def _place_forms(text: str) -> list[str]:
    """"30°N" as students write it: "30° N", "30 N", "30N", "30° north", "30 degrees north", "30 degrees N" (P3m review)."""
    n, side = text[:-2], text[-1]
    word = {"N": "north", "S": "south", "E": "east", "W": "west"}[side]
    return [text, f"{n}° {side}", f"{n} {side}", f"{n}{side}", f"{n}° {word}", f"{n} degrees {word}", f"{n} degrees {side}",
            f"{n}°{word}"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    pts = p["points"]
    la, lo = pts[p["lat"]][0], pts[p["lon"]][1]
    t1, t2 = p["time"]
    hours = 12 + (pts[t2][1] - pts[t1][1]) // 15
    d1, d2 = p["diff"]
    diff = abs(pts[d1][0] - pts[d2][0])
    lat_s, lon_s = lat_text(la), lon_text(lo)
    return [short(f"{who} finds the points on this grid {rng.choice(SETTINGS)}. What is the latitude of point {p['lat']}?", lat_s,
                  _place_forms(lat_s)),
            short(f"What is the longitude of point {p['lon']}?", lon_s, _place_forms(lon_s)),
            short(f"{friend} uses 15° of longitude = 1 hour, with places to the east ahead. When it is 12:00 noon at point {t1}, "
                  f"what is the local time at point {t2}?", f"{hours:02d}:00", _time_forms(hours)),
            short(f"What is the difference in latitude between points {d1} and {d2}?", f"{diff}°", [f"{diff}°", str(diff), f"{diff} degrees"])]
