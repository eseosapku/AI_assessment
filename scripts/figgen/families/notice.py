"""A school notice to read: the kind used in English as a second language reading papers."""
from __future__ import annotations

import random

from matplotlib.patches import FancyBboxPatch

from ..core import new_figure, short

ID = "notice"
KIND = "text.notice"
SUBJECT = "english"
BANDS = ("P", "LS")

EVENTS = ["Science Fair", "Football Tournament", "Book Swap Day", "Health and Fitness Day", "Art Exhibition",
          "Music Concert", "Tree Planting Day"]
PLACES = ["the school hall", "the main field", "the library", "Room 12", "the sports ground", "the art room"]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
MONTHS = ["March", "April", "May", "June", "July", "September", "October"]
CONTACTS = ["Mrs Uwase", "Mr Okafor", "Ms Mensah", "Mr Habimana", "Mrs Adeyemi", "Ms Nyiramana"]
WHO = ["All students", "Students in Years 7 to 9", "Parents and students", "Everyone in the community"]


def sample(rng: random.Random) -> dict:
    start = rng.choice([8, 9, 10, 13, 14, 15])
    return {
        "event": rng.choice(EVENTS), "place": rng.choice(PLACES), "day": rng.choice(DAYS),
        "date": rng.randint(2, 28), "month": rng.choice(MONTHS),
        "start": start, "end": start + rng.choice([2, 3, 4]),
        "cost": rng.choice([0, 200, 500, 1000]), "contact": rng.choice(CONTACTS),
        "room": rng.randint(1, 30), "who": rng.choice(WHO),
    }


def _time(h: int) -> str:
    if h == 12:
        return "12 noon"  # "12:00 p.m." is read both ways
    return f"{h % 12 or 12}:00 {'a.m.' if h < 12 else 'p.m.'}"


def _forms(h: int) -> list[str]:
    """Every fair way to write the hour: 9:00 a.m., 9 am, 9am, 09:00 and the rest."""
    h12 = h % 12 or 12
    out = []
    for suffix in (("a.m.", "am") if h < 12 else ("p.m.", "pm")):
        out += [f"{h12}:00 {suffix}", f"{h12}:00{suffix}", f"{h12} {suffix}", f"{h12}{suffix}"]
    return out + [f"{h:02d}:00", f"{h}:00"]


def draw(p: dict):
    fig, ax = new_figure(5.6, 4.4)
    ax.add_patch(FancyBboxPatch((0.03, 0.03), 0.94, 0.94, boxstyle="round,pad=0.01", fill=False, edgecolor="#111111", linewidth=2))
    ax.text(0.5, 0.86, p["event"].upper(), ha="center", fontsize=18, fontweight="bold")
    cost = "Free entry" if p["cost"] == 0 else f"Tickets: {p['cost']} francs"
    lines = [
        f"When: {p['day']} {p['date']} {p['month']}",
        f"Time: {_time(p['start'])} to {_time(p['end'])}",
        f"Where: {p['place'][0].upper()}{p['place'][1:]}",
        f"Who can come: {p['who']}",
        cost,
        f"Questions? See {p['contact']} in Room {p['room']}.",
    ]
    for i, line in enumerate(lines):
        ax.text(0.1, 0.70 - i * 0.11, line, fontsize=12)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    return fig


def questions(p: dict, rng: random.Random) -> list:
    start = _time(p["start"])
    hours = p["end"] - p["start"]
    place = p["place"]
    return [
        short("What time does the event start?", start, _forms(p["start"])),
        short("How many hours does the event last?", hours, [f"{hours} hours"]),
        short("Which room should you go to if you have a question?", f"Room {p['room']}", [str(p["room"]), f"room {p['room']}"]),
        short(f"Where is the {p['event'].lower()} held?", place, [place.replace("the ", ""), place[0].upper() + place[1:]]),
    ]
