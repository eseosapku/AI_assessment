"""Phishing checks (P Stages 4-6, LS, UP; AS IT "E-safety" by name): an email, or a web page in a browser window, from an
invented organisation (a savings bank, a mobile-money service, an online shop, a post office, a school portal), with
four to six of its parts lettered. Beside it a card gives the organisation's real website, and a list of the warning
signs of phishing: the sender's address does not match the real website; an urgent threat; a link whose shown text and
real address (printed under it, as pointing at it shows) differ; a request for a PIN or password; spelling mistakes;
and, for a web page, an address starting http:// with no padlock. Each lettered part is either one warning sign or
safe (the real address, a calm subject, "we will never ask for your PIN", a link that goes where it says, correct
spelling, the organisation's contact details).

Asks which letter shows a named warning sign (each sign appears once at most), how many lettered parts are warning
signs, which lettered part is safe (when three are warnings), and whether a web page's address is secure. Primary
emails letter four parts in short words, with four signs listed.

Every key is decided by the fixed table WARNING below.
"""
from __future__ import annotations

import random

from matplotlib.patches import Arc, Circle, FancyBboxPatch, Rectangle

from ..core import INK, NAMES, count, mcq, new_figure, short

ID = "phishing_check"
KIND = "diagram.template"
SUBJECT = "computing"
BANDS = ("P", "LS", "UP")
ALSO_BANDS = {"UP": ("AL",)}
CONCEPTS = tuple(f"computing.{c}" for c in ("internet-safety", "security-threats", "computer-security-ethics", "passwords",
                                            "security-precautions", "security-privacy-data-integrity", "web-security",
                                            "digital-citizenship"))
P_CONCEPTS = ("computing.internet-safety", "computing.digital-citizenship")
# A topic whose sections the book lists is reached only if its name or a section names safety, security, phishing,
# passwords, protecting data, threats or the internet.
NEEDS = (r"safe|safety|secur|phishing|password|protect|threat|internet|ethic|citizenship|harmful|privacy|e-safety|"
         r"scam|fraud")
AVOID = (r"spreadsheet|database|programming|keyboard|data controller|network designer|connected|everywhere|robot|"
         r"encrypt|cipher|physical security|firewall|spyware|hacking|monitoring|data packet|cybersecurity|"
         r"security, privacy and data integrity|chapter 21: security|esecurity|computer security$|mail merge|"
         r"table of contents|fundamentals|applications|ownership|network structure|protecting a document|search|"
         r"in society")

# Every part a figure may letter: whether it is a warning sign of phishing, and its sign in the question's words.
WARNING = {"from_fake": True, "from_real": False, "urgent": True, "subject_calm": False, "pin": True, "no_pin": False,
           "link_fake": True, "link_real": False, "typos": True, "spelled": False, "footer": False,
           "http_fake": True, "https_real": False, "urgent_banner": True, "calm_banner": False, "card_pin": True,
           "search_field": False}
SIGN = {"from_fake": "a sender's address that does not match the organisation's real website",
        "urgent": "an urgent threat", "urgent_banner": "an urgent threat",
        "pin": "a request for a PIN or password", "card_pin": "a request for a PIN or password",
        "link_fake": "a link whose shown text and real address are different",
        "typos": "spelling mistakes",
        "http_fake": "an address that starts with http:// and shows no padlock"}
P_SIGN = {"from_fake": "comes from an address that is not the real website's",
          "urgent": "says something bad will happen soon",
          "pin": "asks for your password",
          "typos": "has spelling mistakes"}
SIGNS = ["The sender's address does not match the real website.", "It makes an urgent threat.",
         "A link's shown text and its real address are different.", "It asks for a PIN or password.",
         "It has spelling mistakes."]
WEB_SIGN = "The address starts with http:// and there is no padlock."
P_SIGNS = ["It comes from an address that is not the real website's.", "It says something bad will happen soon.",
           "It asks for your password.", "It has spelling mistakes."]
# The slots of each kind, in the order the email or page shows them, and their warning and safe forms.
SLOTS = {"from": ("from_fake", "from_real"), "subject": ("urgent", "subject_calm"), "request": ("pin", "no_pin"),
         "link": ("link_fake", "link_real"), "spelling": ("typos", "spelled"), "footer": (None, "footer"),
         "address": ("http_fake", "https_real"), "banner": ("urgent_banner", "calm_banner"),
         "form": ("card_pin", "search_field")}
EMAIL_SLOTS = ["from", "subject", "request", "link", "spelling", "footer"]
WEB_SLOTS = ["address", "banner", "form", "spelling", "footer"]
P_SLOTS = ["from", "subject", "request", "spelling"]
ORGS = [("Imena Savings Bank", "imenabank.rw", "Your monthly statement is ready", "account will be closed"),
        ("Isoko Mobile Money", "isokomoney.rw", "Your monthly mobile money summary", "account will be blocked"),
        ("Umucyo Online Shop", "umucyoshop.rw", "Your order is on its way", "order will be cancelled"),
        ("Amahoro Post", "amahoropost.rw", "A parcel is waiting for you", "parcel will be sent back"),
        ("Urumuri School Portal", "urumurischool.ac.rw", "Term reports are ready", "account will be deleted")]
P_ORGS = [("Urumuri School Portal", "urumurischool.ac.rw"), ("Isoko Games Club", "isokogames.rw"),
          ("Amahoro Library", "amahorolibrary.rw")]
FAKE = ["{s}-secure-login.com", "{s}.verify-now.net", "{s}-alerts.xyz", "{s}-help-desk.info"]


def stages(p: dict) -> tuple[int, int] | None:
    return (4, 6) if p["band"] == "P" else None


def concepts_for(p: dict) -> tuple[str, ...]:
    return P_CONCEPTS if p["band"] == "P" else CONCEPTS


def sample(rng: random.Random) -> dict:
    band = rng.choice(["P", "LS", "UP", "UP"])
    kind = "email" if band == "P" or rng.random() < 0.6 else "web"
    if band == "P":
        org, dom = rng.choice(P_ORGS)
        slots = list(P_SLOTS)
    else:
        org, dom, _, _ = rng.choice(ORGS)
        slots = sorted(rng.sample(EMAIL_SLOTS, 5), key=EMAIL_SLOTS.index) if kind == "email" else list(WEB_SLOTS)
    stem = dom.split(".")[0]
    while True:
        parts = []
        for s in slots:
            bad, good = SLOTS[s]
            parts.append(bad if bad and rng.random() < 0.5 else good)
        n_bad = sum(WARNING[x] for x in parts)
        if 1 <= n_bad <= len(parts) - 1:
            break
    letters = "ABCDEF"[:len(parts)]
    warn = [x for x in parts if WARNING[x]]
    return {"band": band, "kind": kind, "org": org, "domain": dom, "fake": rng.choice(FAKE).format(s=stem),
            "name": rng.choice(NAMES), "parts": [[k, x] for k, x in zip(letters, parts)],
            "ask": {"sign": rng.choice(warn)}}


# --- drawing -----------------------------------------------------------------------------------------------

def _org(p: dict):
    return next((o for o in ORGS if o[0] == p["org"]), (p["org"], p["domain"], "News from us", "account will be closed"))


def _lines(p: dict) -> list[tuple[str | None, list]]:
    """The email's or page's lines, top to bottom: (the letter of the part it shows, or None; its pieces)."""
    org, dom, calm, threat = _org(p)
    fake = p["fake"]
    who = p["name"]
    primary = p["band"] == "P"
    part = {x: k for k, x in p["parts"]}
    out: list[tuple[str | None, list]] = []

    def add(x, pieces):
        out.append((part.get(x), pieces))

    if p["kind"] == "web":
        for _, x in p["parts"]:
            if x == "http_fake":
                add(x, [("addr", "Not secure", f"http://{fake}/login")])
            elif x == "https_real":
                add(x, [("addr", "lock", f"https://www.{dom}/login")])
            elif x == "urgent_banner":
                add(x, [("banner", f"Your {threat.split()[0]} will be locked in 10 minutes! Log in now.")])
            elif x == "calm_banner":
                add(x, [("banner", f"Welcome to {org}. Log in to see your {threat.split()[0]}.")])
            elif x == "card_pin":
                add(x, [("field", "Card number"), ("field", "PIN")])
            elif x == "search_field":
                add(x, [("field", "Search our help pages")])
            elif x == "typos":
                add(x, [("text", "Pleese enter you detials below to continu.")])
            elif x == "spelled":
                add(x, [("text", "Our branches are open from 8:00 to 17:00.")])
            elif x == "footer":
                add(x, [("small", f"{org}, Kigali   |   Help line: 3030   |   www.{dom}")])
        return out
    seq = [x for _, x in p["parts"]]
    get = lambda slot: next((x for x in seq if x in SLOTS[slot]), None)  # noqa: E731
    f = get("from")
    if f == "from_fake":
        add(f, [("text", f"From:  {org} <{'prize' if primary else 'alerts'}@{fake}>")])
    else:  # the real address, lettered or not: an email always shows who sent it
        add(f, [("text", f"From:  {org} <news@{dom}>")])
    out.append((None, [("text", f"To:  {who}")]))
    s = get("subject")
    if s == "urgent":
        add(s, [("text", "Subject:  Hurry! Your account will be deleted today!" if primary
                 else f"Subject:  URGENT! Your {threat} in 24 hours")])
    else:
        add(s, [("text", "Subject:  News for this week" if primary else f"Subject:  {calm}")])
    out.append((None, [("rule",)]))
    out.append((None, [("text", f"Dear {who},")]))
    r = get("request")
    if r == "pin":
        add(r, [("text", "Send us your password so we can keep your account safe." if primary
                 else "Reply to this email with your PIN and password to keep it open.")])
    elif r == "no_pin":
        add(r, [("text", "Never tell anyone your password." if primary
                 else "Remember: we will never ask for your PIN or password.")])
    lk = get("link")
    if lk == "link_fake":
        add(lk, [("link", f"www.{dom}/login", f"Real address:  http://{fake}/login")])
    elif lk == "link_real":
        add(lk, [("link", f"www.{dom}/offers", f"Real address:  https://www.{dom}/offers")])
    sp = get("spelling")
    if sp == "typos":
        add(sp, [("text", "Pleese send it tooday." if primary else "Pleese confirm you acount detials imediately.")])
    elif sp == "spelled":
        add(sp, [("text", "See you at the library on Friday." if primary
                  else "You can also visit any of our branches in Kigali.")])
    out.append((None, [("text", f"Thank you,  {org}")]))
    if get("footer"):
        add("footer", [("small", f"{org}, Kigali   |   Help line: 3030   |   www.{dom}")])
    return out


def _lock(ax, x: float, y: float) -> None:
    ax.add_patch(Rectangle((x - 0.07, y - 0.08), 0.14, 0.11, facecolor=INK, edgecolor=INK, linewidth=0.8))
    ax.add_patch(Arc((x, y + 0.03), 0.1, 0.14, theta1=0, theta2=180, edgecolor=INK, linewidth=1.3))


def draw(p: dict):
    primary = p["band"] == "P"
    fs = 11 if primary else 10
    lines = _lines(p)
    lh = 0.46 if primary else (0.46 if p["kind"] == "web" else 0.4)
    wx, ww = 0.7, 7.3
    heights = []
    for _, pieces in lines:
        kind = pieces[0][0]
        heights.append({"rule": 0.16, "link": 2 * lh, "field": lh * len(pieces), "banner": lh * 1.2}.get(kind, lh))
    body = sum(heights) + 0.3
    fig, ax = new_figure(11.6, 6.0)
    ax.set_position([0, 0, 1, 1])
    top = body + 0.55
    # the window
    ax.add_patch(Rectangle((wx, 0), ww, top, facecolor="white", edgecolor=INK, linewidth=1.3))
    ax.add_patch(Rectangle((wx, top - 0.42), ww, 0.42, facecolor="#d9dee3", edgecolor=INK, linewidth=1.3))
    title = "Inbox: new message" if p["kind"] == "email" else f"{p['org']}: log in"
    ax.text(wx + 0.15, top - 0.21, title, ha="left", va="center", fontsize=fs, fontweight="bold")
    y = top - 0.42 - 0.15
    for (letter, pieces), h in zip(lines, heights):
        kind = pieces[0][0]
        mid = y - h / 2
        if kind == "rule":
            ax.plot([wx + 0.1, wx + ww - 0.1], [mid, mid], color="#999999", linewidth=0.8)
        elif kind == "text":
            ax.text(wx + 0.2, mid, pieces[0][1], ha="left", va="center", fontsize=fs, gid=f"part:{letter}")
        elif kind == "small":
            ax.text(wx + 0.2, mid, pieces[0][1], ha="left", va="center", fontsize=fs - 1.5, color="#333333",
                    gid=f"part:{letter}")
        elif kind == "link":
            ax.text(wx + 0.2, y - lh / 2, "Link:", ha="left", va="center", fontsize=fs)
            ax.text(wx + 0.8, y - lh / 2, pieces[0][1], ha="left", va="center", fontsize=fs, color="#1a4fb3",
                    gid=f"part:{letter}")
            ax.plot([wx + 0.8, wx + 0.8 + len(pieces[0][1]) * 0.075], [y - lh / 2 - 0.1] * 2, color="#1a4fb3",
                    linewidth=0.9)
            ax.text(wx + 0.9, y - 1.5 * lh, pieces[0][2], ha="left", va="center", fontsize=fs - 1,
                    bbox={"boxstyle": "round,pad=0.25", "facecolor": "#fff6c8", "edgecolor": "#8a7a2a", "linewidth": 0.8},
                    gid=f"tip:{letter}")
        elif kind == "addr":
            ax.add_patch(FancyBboxPatch((wx + 0.15, mid - 0.14), ww - 0.3, 0.28, boxstyle="round,pad=0.02",
                                        facecolor="#f4f5f6", edgecolor=INK, linewidth=0.9))
            if pieces[0][1] == "lock":
                _lock(ax, wx + 0.38, mid)
                ax.text(wx + 0.58, mid, pieces[0][2], ha="left", va="center", fontsize=fs, gid=f"part:{letter}")
            else:
                ax.text(wx + 0.3, mid, "Not secure", ha="left", va="center", fontsize=fs - 1, color="#a12a2a")
                ax.text(wx + 1.3, mid, pieces[0][2], ha="left", va="center", fontsize=fs, gid=f"part:{letter}")
        elif kind == "banner":
            ax.add_patch(Rectangle((wx + 0.15, mid - h / 2 + 0.05), ww - 0.3, h - 0.1, facecolor="#eef1f3", edgecolor=INK,
                                   linewidth=0.8))
            ax.text(wx + 0.3, mid, pieces[0][1], ha="left", va="center", fontsize=fs, fontweight="bold",
                    gid=f"part:{letter}")
        elif kind == "field":
            for j, (_, label) in enumerate(pieces):
                yy = y - (j + 0.5) * lh
                ax.text(wx + 0.2, yy, label, ha="left", va="center", fontsize=fs, gid=f"part:{letter}" if j == 0 else None)
                ax.add_patch(Rectangle((wx + 2.6, yy - 0.12), 2.6, 0.24, facecolor="white", edgecolor=INK, linewidth=0.9))
        if letter:
            ax.add_patch(Circle((0.35, mid), 0.16, facecolor="white", edgecolor=INK, linewidth=1.2))
            ax.text(0.35, mid, letter, ha="center", va="center", fontsize=fs, fontweight="bold", gid=f"letter:{letter}")
        y -= h
    # the card and the list of warning signs
    cx = wx + ww + 0.3
    ax.add_patch(Rectangle((cx, top - 0.95), 3.3, 0.95, facecolor="#eef1f3", edgecolor=INK, linewidth=1.0))
    ax.text(cx + 0.12, top - 0.28, f"{p['org']}'s" if len(p["org"]) < 22 else p["org"],
            ha="left", va="center", fontsize=fs - 0.5, fontweight="bold")
    ax.text(cx + 0.12, top - 0.62, f"real website: www.{p['domain']}", ha="left", va="center", fontsize=fs - 0.5,
            gid="real")
    signs = P_SIGNS if primary else SIGNS + ([WEB_SIGN] if p["kind"] == "web" else [])
    ax.text(cx, top - 1.3, "Warning signs of phishing", ha="left", va="center", fontsize=fs, fontweight="bold")
    yy = top - 1.3
    for s in signs:
        for k, ln in enumerate(_wrap(s, 34 if not primary else 30)):
            yy -= 0.33 if k == 0 else 0.24
            ax.text(cx + (0.0 if k == 0 else 0.2), yy, ("• " if k == 0 else "") + ln, ha="left", va="center",
                    fontsize=fs - 1)
    bottom = min(0.0, yy - 0.3) - 0.1
    ax.set_xlim(0, cx + 3.45)
    ax.set_ylim(bottom, top + 0.1)
    fig.set_size_inches(cx + 3.45, top + 0.1 - bottom)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _wrap(text: str, n: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    return lines + [cur]


# --- questions ---------------------------------------------------------------------------------------------

def questions(p: dict, rng: random.Random) -> list:
    who = p["name"]
    primary = p["band"] == "P"
    parts = p["parts"]
    letters = [k for k, _ in parts]
    by = {x: k for k, x in parts}
    sign = p["ask"]["sign"]
    key = by[sign]
    what = "email" if p["kind"] == "email" else "web page"
    others = rng.sample([k for k in letters if k != key], 3)
    words = P_SIGN[sign] if primary else SIGN[sign]
    if primary:
        q1 = mcq(f"{who} gets this email. Which letter shows the part that {words}?", key, others, rng)
    else:
        q1 = mcq(f"{who} checks this {what} for phishing. Which letter shows {words}?", key, others, rng)
    n = sum(WARNING[x] for _, x in parts)
    qs = [q1, count(f"How many of the lettered parts of this {what} are warning signs of phishing?", n,
                    "warning signs", "parts", "signs")]
    bad = [k for k, x in parts if WARNING[x]]
    good = [k for k, x in parts if not WARNING[x]]
    if not primary and len(bad) >= 3:
        safe = rng.choice(good)
        qs.append(mcq(f"Which lettered part of this {what} is NOT a warning sign of phishing?", safe,
                      rng.sample(bad, 3), rng))
    if p["kind"] == "web":
        addr = next(x for _, x in parts if x in ("http_fake", "https_real"))
        yes = addr == "https_real"
        qs.append(short(f"Is the address of this web page (letter {by[addr]}) secure? Answer yes or no.",
                        "Yes" if yes else "No", ["yes", "YES"] if yes else ["no", "NO"]))
    return qs
