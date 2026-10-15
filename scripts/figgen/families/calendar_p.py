"""A month page of a calendar (P, Stage 1 to 2), as Cambridge Stage 1 and 2 "Time" (the days of the week, the
calendar) and Rwanda P1 "Days of the week" and P2 "Months of the year and days of each month" teach it.

A real month of a real year, 2025 to 2030: the year is printed with the month, and the weekday of the 1st is the
right one for it. The days of the week run across the top, Monday first, as Rwandan calendars print them. One day is
circled and named in a key: a Rwandan public holiday on its real date (Heroes' Day on 1 February, Independence Day on
1 July, Liberation Day on 4 July, Umuganura Day on the first Friday of August ...) or a school day (a sports day, a
class trip) on a school day of the week.

- What day of the week is 5 July? The wrong options are the days either side (reading the next column).
- How many Sundays are there in July 2026? How many of any weekday: 4 or 5.
- What is the date of the second Friday in July 2026?
- Which day of the week is the circled day? Or: Umuganda is on the last Saturday of the month; what is its date?
"""
from __future__ import annotations

import calendar
import random

from matplotlib.patches import Circle, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "calendar_p"
KIND = "table.data"
SUBJECT = "mathematics"
BANDS = ("P",)
CONCEPTS = ("mathematics.time-hour-months-days", "mathematics.time-general")
# A topic whose sections the book lists is reached only if its name or a section names time, the calendar or days.
NEEDS = r"\btime\b|calendar|\bdays?\b|month|week"
# Reading a clock is the clock's (clock_early_p); money shares "everyday life" concepts.
AVOID = r"telling the time|clock|money|currenc|francs?\b|timetable"

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
HOLIDAYS = {(1, 1): "New Year's Day", (2, 1): "Heroes' Day", (5, 1): "Labour Day", (7, 1): "Independence Day",
            (7, 4): "Liberation Day", (8, 15): "Assumption Day", (12, 25): "Christmas Day", (12, 26): "Boxing Day"}
SCHOOL = ["Sports day", "Parents' day", "Class trip", "Music day", "Tree planting day", "Book day", "Science fair",
          "Art day"]
ORDINAL = ["first", "second", "third", "fourth"]
LEADS = ["{n} looks at the calendar for {m} {y}.", "{n} has this calendar at home.",
         "{n}'s class has this calendar on the wall.", "{n} uses this calendar to plan {m}.",
         "{n} reads the calendar for {m} {y}."]


def stages(p: dict) -> tuple[int, int] | None:
    return (1, 2)


def _first(year: int, month: int) -> int:
    return calendar.weekday(year, month, 1)  # 0 is Monday


def _days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _weekday(p: dict, d: int) -> int:
    return (_first(p["year"], p["month"]) + d - 1) % 7


def sample(rng: random.Random) -> dict:
    year, month = rng.randint(2025, 2030), rng.randint(1, 12)
    p = {"band": "P", "name": rng.choice(NAMES), "year": year, "month": month}
    n, first = _days(year, month), _first(year, month)
    holidays = [[d, label] for (m, d), label in sorted(HOLIDAYS.items()) if m == month]
    if month == 8:
        holidays.append([next(d for d in range(1, 8) if (first + d - 1) % 7 == 4), "Umuganura Day"])
    if holidays and rng.random() < 0.6:
        p["event"] = rng.choice(holidays)
    else:
        taken = {d for d, _ in holidays}
        school = [d for d in range(1, n + 1) if (first + d - 1) % 7 < 5 and d not in taken]
        p["event"] = [rng.choice(school), rng.choice(SCHOOL)]
    p["ask"] = rng.choice(["event", "umuganda"])
    return p


# --- drawing ----------------------------------------------------------------------------------------

def draw(p: dict):
    year, month = p["year"], p["month"]
    n, first = _days(year, month), _first(year, month)
    weeks = (first + n + 6) // 7
    fig, ax = new_figure(7.6, 1.0 * weeks + 2.6)
    top = 0.0
    ax.text(3.5, top + 1.25, f"{MONTHS[month - 1]} {year}", ha="center", va="center", fontsize=17, fontweight="bold",
            gid="title")
    for k in range(7):
        ax.add_patch(Rectangle((k, top), 1, 0.62, facecolor="#dbe9f6", edgecolor=INK, linewidth=1.2))
        ax.text(k + 0.5, top + 0.31, SHORT[k], ha="center", va="center", fontsize=13, fontweight="bold", gid=f"head:{k}")
    for w in range(weeks):
        for k in range(7):
            face = "#f3f3f3" if k >= 5 else "white"
            ax.add_patch(Rectangle((k, top - (w + 1) * 0.95), 1, 0.95, facecolor=face, edgecolor=INK, linewidth=1.0))
    for d in range(1, n + 1):
        cell = first + d - 1
        x, y = cell % 7 + 0.5, top - (cell // 7) * 0.95 - 0.475
        ax.text(x, y, str(d), ha="center", va="center", fontsize=14, gid=f"date:{d}")
    day, label = p["event"]
    cell = first + day - 1
    ax.add_patch(Circle((cell % 7 + 0.5, top - (cell // 7) * 0.95 - 0.475), 0.36, fill=False, edgecolor="#c62828",
                        linewidth=2.2, gid="ring"))
    bottom = top - weeks * 0.95
    ax.add_patch(Circle((0.35, bottom - 0.5), 0.2, fill=False, edgecolor="#c62828", linewidth=2.2))
    ax.text(0.7, bottom - 0.5, f"= {label}", ha="left", va="center", fontsize=13, gid="key")
    ax.set_xlim(-0.1, 7.1)
    ax.set_ylim(bottom - 0.85, top + 1.6)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

def _suffix(d: int) -> str:
    return f"{d}{'th' if 10 <= d % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')}"


def _date_forms(d: int, month: str) -> list[str]:
    s = _suffix(d)
    return [f"{d} {month}", f"{month} {d}", s, f"the {s}", f"{s} {month}", f"{month} {s}", f"the {s} of {month}"]


def questions(p: dict, rng: random.Random) -> list:
    year, mi = p["year"], p["month"]
    month = MONTHS[mi - 1]
    n = _days(year, mi)
    lead = rng.choice(LEADS).format(n=p["name"], m=month, y=year)
    d = rng.randint(1, n)
    w = _weekday(p, d)
    near = [WEEK[(w - 1) % 7], WEEK[(w + 1) % 7], WEEK[(w + rng.choice([2, -2, 3])) % 7]]
    qs = [mcq(f"{lead} What day of the week is {d} {month}?", WEEK[w], near, rng)]
    k = rng.randrange(7)
    qs.append(count(f"How many {WEEK[k]}s are there in {month} {year}?", sum(1 for x in range(1, n + 1)
                                                                         if _weekday(p, x) == k), f"{WEEK[k]}s"))
    k = rng.randrange(7)
    nth = rng.randrange(3)
    date = [x for x in range(1, n + 1) if _weekday(p, x) == k][nth]
    qs.append(short(f"What is the date of the {ORDINAL[nth]} {WEEK[k]} in {month} {year}?", str(date),
                    _date_forms(date, month)))
    if p["ask"] == "umuganda":
        last = max(x for x in range(1, n + 1) if _weekday(p, x) == 5)
        qs.append(short(f"Umuganda is on the last Saturday of the month. What is its date in {month} {year}?", str(last),
                        _date_forms(last, month)))
    else:
        day, label = p["event"]
        w = _weekday(p, day)
        near = [WEEK[(w - 1) % 7], WEEK[(w + 1) % 7], WEEK[(w + rng.choice([2, -2, 3])) % 7]]
        qs.append(mcq(f"{label} is circled on the calendar. What day of the week is it?", WEEK[w], near, rng))
    return qs
