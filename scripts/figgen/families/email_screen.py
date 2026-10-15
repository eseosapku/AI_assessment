"""An email window (LS, UP; Cambridge IGCSE ICT "Communication with other ICT users using email"), of two views.

- inbox: a received email as the reader's inbox shows it: subject, From, To (the reader and one or two others), Cc
  (one or two people), the date and time sent, one or three attachments with their sizes, and the message. Who else
  was sent a copy (Cc); the attachment's name, or the largest of three; the date it was sent; and how many people
  receive the reader's Reply all (the rule printed in the stem: the sender and everyone else in To and Cc).
- compose: a new message about to be sent: From, To, Cc, Bcc, Subject, one or two attachments and a Send button. Whose
  address the other people will not see (Bcc), how many people will receive it, who is sent a copy (Cc; a Bcc
  person, who also gets a copy, is never offered), and the attachment's name or the two attachments' total size.

People have different first names and different surnames, so no option shares a word with another. The wrong options
are other people in the email: the sender, the To people, the Cc people.
"""
from __future__ import annotations

import datetime
import random

from matplotlib.patches import FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, count, mcq, new_figure, short

ID = "email_screen"
KIND = "business.document"
SUBJECT = "computing"
BANDS = ("LS", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("communication-email", "definition-email", "internet-email-services",
                                            "email-attachment-upload"))
# A topic whose sections the book lists is reached only if its name or a section names email or communication.
NEEDS = r"e-?mail|gmail|communication"
# Topics sharing an email concept that teach something else: GIS, online documents, e-commerce, web programming.
AVOID = r"\bgis\b|arcgis|google docs|e-commerce|programming|networking technolog|applications|web\b"

SURNAMES = ["Mugabo", "Uwimana", "Niyonzima", "Mukamana", "Nkurunziza", "Hakizimana", "Ndayisaba", "Nsengiyumva",
            "Mutesi", "Bizimana", "Kayitesi", "Munyaneza", "Twagirayezu", "Uwera", "Gatete", "Rukundo"]
CONTEXTS = {
    "school": {"domain": ["gmail.com", "remera-ss.ac.rw"],
               "subjects": ["Science project photos", "Notes for the maths test", "Debate club team list"],
               "files": [("photos.zip", 2400, 9800), ("project.pptx", 900, 4200), ("notes.pdf", 150, 900),
                         ("team_list.docx", 40, 220), ("timetable.pdf", 120, 600)],
               "body": ["Hello everyone,", "Please find the files attached. Read them", "before our meeting on Monday.",
                        "Thank you."]},
    "coop": {"domain": ["gmail.com", "musanzecoop.rw"],
             "subjects": ["Harvest meeting on Friday", "Potato prices this season", "New members list"],
             "files": [("agenda.docx", 30, 180), ("prices.xlsx", 40, 260), ("members.xlsx", 60, 300),
                       ("field_photos.zip", 3100, 8800), ("minutes.pdf", 120, 700)],
             "body": ["Dear members,", "The documents for Friday's meeting are", "attached. Please bring your member card.",
                      "Thank you."]},
    "shop": {"domain": ["gmail.com", "kigalishop.rw"],
             "subjects": ["Order for 20 bags of rice", "Invoice and delivery note", "New price list"],
             "files": [("invoice_118.pdf", 90, 400), ("price_list.xlsx", 45, 300), ("delivery_note.pdf", 70, 350),
                       ("products.zip", 2200, 7600), ("order_form.docx", 35, 160)],
             "body": ["Good morning,", "The documents you asked for are attached.", "Delivery will be on Wednesday.",
                      "Kind regards."]},
    "club": {"domain": ["gmail.com", "yahoo.com"],
             "subjects": ["Football match on Saturday", "Trip to Nyungwe: forms", "Choir practice times"],
             "files": [("fixtures.pdf", 80, 450), ("consent_form.pdf", 110, 520), ("map.png", 600, 2500),
                       ("practice_times.docx", 25, 140), ("team_photo.jpg", 1500, 4800)],
             "body": ["Hi all,", "Here are the details for this week.", "Please reply by Thursday.", "See you there."]},
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]


def _people(rng: random.Random, n: int, domains: list[str]) -> list[list[str]]:
    firsts = rng.sample(NAMES, n)
    lasts = rng.sample(SURNAMES, n)
    return [[f"{f} {s}", f"{f.lower()}.{s.lower()}@{rng.choice(domains)}"] for f, s in zip(firsts, lasts)]


def _files(rng: random.Random, pool: list, n: int) -> list[list]:
    while True:
        picks = rng.sample(pool, n)
        files = [[name, rng.randrange(lo, hi + 1)] for name, lo, hi in picks]
        sizes = sorted(kb for _, kb in files)
        if n < 3 or sizes[-1] >= 1.25 * sizes[-2]:  # the largest of three is clearly the largest
            return files


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    view = rng.choice(["inbox", "compose"])
    context = rng.choice(sorted(CONTEXTS))
    c = CONTEXTS[context]
    if view == "inbox":
        n_to, n_cc, n_bcc = rng.randint(2, 3), rng.randint(1, 2), 0
        files = _files(rng, c["files"], rng.choice([1, 3]))
    else:
        n_to, n_cc, n_bcc = rng.randint(2, 3), rng.randint(1, 2), 1
        files = _files(rng, c["files"], rng.choice([1, 2]))
    people = _people(rng, 1 + n_to + n_cc + n_bcc, c["domain"])
    sender, to = people[0], people[1:1 + n_to]
    cc, bcc = people[1 + n_to:1 + n_to + n_cc], people[1 + n_to + n_cc:]
    date = None
    viewer = None
    if view == "inbox":
        d = datetime.date(2025, 1, 1) + datetime.timedelta(days=rng.randrange(365))
        date = [d.year, d.month, d.day, rng.randint(7, 18), rng.choice(range(0, 60, 1))]
        viewer = rng.choice(to)[0]
    return {"band": band, "view": view, "context": context, "sender": sender, "to": to, "cc": cc, "bcc": bcc,
            "viewer": viewer, "subject": rng.choice(c["subjects"]), "date": date, "attachments": files}


# --- drawing ----------------------------------------------------------------------------------------

def _clip(ax, x: float, y: float) -> None:
    """A small paperclip mark before an attachment."""
    ax.add_patch(Polygon([(x, y - 0.12), (x, y + 0.1), (x + 0.1, y + 0.16), (x + 0.2, y + 0.1), (x + 0.2, y - 0.08),
                          (x + 0.12, y - 0.12), (x + 0.08, y - 0.08), (x + 0.08, y + 0.06)], closed=False, fill=False,
                         edgecolor=INK, linewidth=1.1))


def _size(kb: int) -> str:
    return f"{kb} kB"


def _who(person) -> str:
    return f"{person[0]} <{person[1]}>"


def draw(p: dict):
    inbox = p["view"] == "inbox"
    rows = []  # (label, text, bold)
    if inbox:
        rows.append(("From:", _who(p["sender"])))
        rows += [("To:" if i == 0 else "", _who(x)) for i, x in enumerate(p["to"])]
        rows += [("Cc:" if i == 0 else "", _who(x)) for i, x in enumerate(p["cc"])]
        y, mo, d, hh, mm = p["date"]
        day = datetime.date(y, mo, d).strftime("%a")
        rows.append(("Date:", f"{day} {d} {MONTHS[mo - 1][:3]} {y}, {hh:02d}:{mm:02d}"))
        rows.append(("Subject:", p["subject"]))
    else:
        rows.append(("From:", _who(p["sender"])))
        rows += [("To:" if i == 0 else "", _who(x)) for i, x in enumerate(p["to"])]
        rows += [("Cc:" if i == 0 else "", _who(x)) for i, x in enumerate(p["cc"])]
        rows += [("Bcc:" if i == 0 else "", _who(x)) for i, x in enumerate(p["bcc"])]
        rows.append(("Subject:", p["subject"]))
    body = CONTEXTS[p["context"]]["body"]
    rh, width, col = 0.42, 9.4, 1.55
    fig, ax = new_figure(8.8, 6.0)
    # the title bar, then the boxes, the attachments and the message, from the top down
    ax.add_patch(Rectangle((0, -0.6), width, 0.6, facecolor=FILL_2, edgecolor=INK, linewidth=1.3))
    title = f"Inbox: {next(a for n, a in p['to'] if n == p['viewer'])}" if inbox else "New message"
    ax.text(0.2, -0.3, title, ha="left", va="center", fontsize=11, fontweight="bold")
    y = -0.7
    for label, text in rows:
        y -= rh
        if label:
            ax.text(0.25, y, label, ha="left", va="center", fontsize=10.5, fontweight="bold", color="#333333")
        ax.text(col, y, text, ha="left", va="center", fontsize=10.5, fontweight="bold" if label == "Subject:" else "normal")
        if not inbox and label:
            ax.plot([0.15, width - 0.15], [y + rh / 2, y + rh / 2], color="#bbbbbb", linewidth=0.7)
    y -= 0.3
    ax.plot([0.15, width - 0.15], [y + 0.05, y + 0.05], color="#888888", linewidth=0.8)
    first = y - rh
    for name, kb in p["attachments"]:
        y -= rh
        ax.add_patch(FancyBboxPatch((col, y - 0.16), 4.4, 0.32, boxstyle="round,pad=0.02", facecolor="#f4f6f8",
                                    edgecolor=INK, linewidth=0.8))
        _clip(ax, col + 0.12, y)
        ax.text(col + 0.45, y, f"{name} ({_size(kb)})", ha="left", va="center", fontsize=10.5)
    ax.text(0.25, (first + y) / 2, "Attached:", ha="left", va="center", fontsize=10.5, fontweight="bold", color="#333333")
    y -= 0.35
    for line in body:
        y -= 0.4
        ax.text(0.25, y, line, ha="left", va="center", fontsize=10.5)
    y -= 0.35
    if not inbox:
        ax.add_patch(FancyBboxPatch((0.25, y - 0.45), 1.3, 0.45, boxstyle="round,pad=0.04", facecolor=FILL, edgecolor=INK,
                                    linewidth=1.2))
        ax.text(0.9, y - 0.225, "Send", ha="center", va="center", fontsize=11, fontweight="bold")
        y -= 0.7
    ax.add_patch(Rectangle((0, y), width, -0.6 - y, facecolor="white", edgecolor=INK, linewidth=1.3, zorder=0))
    fig.set_size_inches(8.8, 8.8 * (-y + 0.1) / (width + 0.1))
    ax.set_xlim(-0.05, width + 0.05)
    ax.set_ylim(y - 0.05, 0.05)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "at the computer club", "at home", "for homework", "in the school library"]


def _date_forms(y: int, mo: int, d: int) -> list[str]:
    day = datetime.date(y, mo, d).strftime("%A")
    month = MONTHS[mo - 1]
    nth = f"{d}{'th' if 11 <= d <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')}"
    return [f"{d} {month} {y}", f"{d}/{mo}/{y}", f"{d:02d}/{mo:02d}/{y}", f"{d} {month[:3]} {y}", f"{month} {d}, {y}",
            f"{month} {d} {y}", f"{d}-{mo}-{y}", f"{d:02d}-{mo:02d}-{y}", f"{d}.{mo}.{y}", f"{day} {d} {month} {y}",
            f"{day[:3]} {d} {month[:3]} {y}", f"{nth} {month} {y}", f"{day}, {d} {month} {y}"]


def questions(p: dict, rng: random.Random) -> list:
    to, cc, bcc = ([x[0] for x in p[k]] for k in ("to", "cc", "bcc"))
    sender = p["sender"][0]
    files = p["attachments"]
    out = []
    if p["view"] == "inbox":
        viewer = p["viewer"]
        first = viewer.split()[0]
        key = rng.choice(cc)
        out.append(mcq(f"{first} opened the email \"{p['subject']}\" {rng.choice(SETTINGS)}. Which person was sent a "
                       f"copy (Cc) of it?", key,
                       rng.sample([sender] + to, 3), rng))
        if len(files) == 1:
            out.append(short("What is the name of the file attached to the email?", files[0][0]))
        else:
            big = max(files, key=lambda f: f[1])[0]
            out.append(mcq("Which attached file is the largest?", big, [f[0] for f in files if f[0] != big], rng))
        y, mo, d = p["date"][:3]
        forms = _date_forms(y, mo, d)
        out.append(short("On what date was the email sent?", forms[0], forms[1:]))
        n = len(to) + len(cc)  # the sender, and everyone else in To and Cc: the reader leaves, the sender joins
        out.append(count(f"{first} clicks Reply all. Reply all sends the reply to the sender and to everyone else in "
                         f"the To and Cc boxes. How many people receive the reply?", n, "people"))
        return out
    first = sender.split()[0]
    out.append(mcq(f"{first} is about to send the email \"{p['subject']}\" {rng.choice(SETTINGS)}. Whose email address "
                   f"will the other people not see?", bcc[0], rng.sample(to + cc, 3), rng))
    out.append(count("How many people will receive this email?", len(to) + len(cc) + len(bcc), "people"))
    out.append(mcq("Who will be sent a copy (Cc) of this email?", rng.choice(cc), rng.sample([sender] + to, 3), rng))
    if len(files) == 1:
        out.append(short("What is the name of the file attached to the email?", files[0][0]))
    else:
        total = sum(kb for _, kb in files)
        out.append(short("What is the total size of the attachments in kB?", total,
                         [f"{total} kB", f"{total}kB", f"{total} KB", f"{total} kilobytes"]))
    return out
