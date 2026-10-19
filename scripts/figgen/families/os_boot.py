"""Starting a computer and its operating system (P Stage 6, UP; AS Level by name), of three kinds.

- boot: the steps a computer takes when it is switched on, each on a card, the cards lettered A, B, C... in reading
  order but holding the steps jumbled (no card in its own place). Primary: five plain steps (press the power button,
  POST, the BIOS finds the operating system, the operating system loads into memory, the desktop appears); Upper
  Secondary: six (firmware in ROM, POST, the boot loader, the kernel loads into RAM, drivers and services start, the
  log-in screen). Which card comes straight after a lettered card, and which card is a stated step.
- layers: the four layers of a computer system stacked (the user at the top, application software, the operating
  system with its kernel, the hardware at the bottom), each described but not named, lettered P to S in a shuffled
  order. Which letter shows a named layer, and in which lettered layer a named program or part belongs (a fixed table:
  a spreadsheet program is application software, Linux an operating system, the RAM hardware).
- screens: a graphical user interface (a desktop with named icons, a taskbar and a pointer) and a command-line
  interface (a prompt and typed commands) side by side as "Screen 1" and "Screen 2" in a shuffled order. Which screen is
  a GUI, how many icons the desktop shows, and how many commands have been typed.

Every key comes from the fixed tables below or is counted from the figure.
"""
from __future__ import annotations

import random
import textwrap

from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

from ..core import FILL, FILL_2, INK, NAMES, Question, count, new_figure

ID = "os_boot"
KIND = "process.flow"
SUBJECT = "computing"
BANDS = ("P", "UP")
# The AS Level chapters named "System software" and "The functions of operating systems" teach the layers and the
# interfaces as drawn here.
ALSO_BANDS = {"UP": ("AL",)}
BOOT = tuple(f"computing.{c}" for c in ("system-booting", "linux-operating-system"))
LAYERS = tuple(f"computing.{c}" for c in ("linux-operating-system", "overview-systems", "computer-hardware-software"))
SCREENS = tuple(f"computing.{c}" for c in ("character-user-interface", "dos-commands", "linux-operating-system"))
CONCEPTS = tuple(dict.fromkeys(BOOT + LAYERS + SCREENS))
# A topic whose sections the book lists is reached only if its name or a section names booting, operating systems,
# system software, types or categories of software, or user interfaces; an AS Level topic only if its name does.
NEEDS = (r"boot|operating systems?|system software|types of software|categori[sz]ation of software|interfaces?\b|"
         r"\bGUI\b|command line|application software")
# Topics sharing these concepts that teach keyboards, safety, the web, databases, programming or OS internals that
# these figures do not draw.
AVOID = (r"keyboard|citizenship|safety|smartphone|web|css|html|visual basic|database|network|virtual|"
         r"memory management|process management|scheduling|file management|translat|security|designer|artist|"
         r"input devices|input and output|storage|memory and storage")

P_STEPS = ["Press the power button.", "The computer checks that its parts work (POST).",
           "The BIOS finds the disk that holds the operating system.", "The operating system loads into memory (RAM).",
           "The desktop or the log-in screen appears."]
UP_STEPS = ["Power on: the CPU starts the firmware (BIOS or UEFI) stored in ROM.",
            "POST: the firmware tests the RAM, the keyboard and the disks.",
            "The firmware finds the boot device and loads the boot loader.",
            "The boot loader loads the operating system's kernel into RAM.",
            "The kernel starts the device drivers and the system services.",
            "The log-in screen appears for the user."]
LAYER_NAMES = ["user", "application software", "operating system", "hardware"]
LAYER_SAYS = ["the person who uses the computer",
              "programs that do a task for the user",
              "manages the hardware and runs the programs; its core is the kernel",
              "the physical parts of the computer"]
# Where things belong, by the layers' printed descriptions.
BELONGS = {"a spreadsheet program": "application software", "a game": "application software",
           "a photo editor": "application software", "Linux": "operating system", "Windows": "operating system",
           "Android": "operating system", "the RAM": "hardware", "a printer": "hardware", "the hard disk": "hardware"}
ICONS = ["Documents", "Recycle Bin", "Browser", "Calculator", "Paint", "Music", "Photos", "Games"]
WIN_COMMANDS = [("dir", [" notes.txt", " photo.jpg"]), ("cd Documents", []), ("mkdir Homework", []),
                ("copy notes.txt D:", ["        1 file(s) copied."]), ("type notes.txt", [" Bring a pen tomorrow."])]
LINUX_COMMANDS = [("ls", ["notes.txt  photo.jpg"]), ("cd Documents", []), ("mkdir Homework", []),
                  ("cp notes.txt backup.txt", []), ("cat notes.txt", ["Bring a pen tomorrow."])]


def stages(p: dict):
    return (6, 6) if p["band"] == "P" else None


def concepts_for(p: dict) -> tuple[str, ...]:
    return {"boot": BOOT, "layers": LAYERS, "screens": SCREENS}[p["sub"]]


def steps(p: dict) -> list:
    return P_STEPS if p["band"] == "P" else UP_STEPS


def sample(rng: random.Random) -> dict:
    band = rng.choice(["P", "UP"])
    sub = rng.choice(["boot", "boot", "layers", "screens"])
    if sub == "boot":
        n = len(P_STEPS if band == "P" else UP_STEPS)
        while True:
            order = list(range(n))  # order[c] = the step on card c
            rng.shuffle(order)
            if all(order[c] != c for c in range(n)):
                break
        after = rng.choice([c for c in range(n) if order[c] < n - 1])
        nth = rng.choice([k for k in range(1, n) if k != order[after] + 1])
        return {"band": band, "sub": sub, "order": order, "after": after, "nth": nth}
    if sub == "layers":
        letters = list("PQRS")
        rng.shuffle(letters)
        ask = rng.choice(LAYER_NAMES[1:])
        thing = rng.choice([t for t, layer in BELONGS.items() if layer != ask])
        return {"band": band, "sub": sub, "letters": letters, "ask": ask, "thing": thing}
    who = rng.choice(NAMES)
    linux = band == "UP" and rng.random() < 0.5
    pool = LINUX_COMMANDS if linux else WIN_COMMANDS
    typed = rng.sample(range(len(pool)), rng.randint(2, 4))
    return {"band": band, "sub": sub, "gui": rng.choice([1, 2]), "icons": rng.sample(ICONS, rng.randint(3, 7)),
            "user": who, "linux": linux, "commands": [pool[i][0] for i in typed]}


# --- drawing ----------------------------------------------------------------------------------------

def _frame(w: float, h: float):
    fig, ax = new_figure(w, h)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def _draw_boot(p: dict):
    st = steps(p)
    n = len(st)
    cols = 3
    rows = (n + cols - 1) // cols
    cw, ch = 3.6, 1.35
    fig, ax = _frame(0.3 + cols * (cw + 0.25), 0.9 + rows * (ch + 0.35))
    top = 0.6 + rows * (ch + 0.35)
    ax.text(0.2, top, "The steps when a computer starts, on cards in a jumbled order", ha="left", va="center",
            fontsize=11.5, fontweight="bold")
    for c in range(n):
        r, k = divmod(c, cols)
        x, y = 0.2 + k * (cw + 0.25), top - 0.45 - (r + 1) * (ch + 0.3)
        ax.add_patch(FancyBboxPatch((x, y), cw, ch, boxstyle="round,pad=0.02,rounding_size=0.1", facecolor="white",
                                    edgecolor=INK, linewidth=1.4))
        ax.add_patch(Circle((x + 0.32, y + ch - 0.32), 0.22, facecolor=FILL_2, edgecolor=INK, linewidth=1.2))
        ax.text(x + 0.32, y + ch - 0.32, "ABCDEF"[c], ha="center", va="center", fontsize=12, fontweight="bold",
                gid=f"card:{c}")
        ax.text(x + 0.65, y + ch / 2 - 0.05, textwrap.fill(st[p["order"][c]], 30), ha="left", va="center",
                fontsize=10.5, linespacing=1.25)
    return fig


def _draw_layers(p: dict):
    fig, ax = _frame(10.0, 5.6)
    ax.text(0.2, 5.3, "The layers of a computer system", ha="left", va="center", fontsize=11.5, fontweight="bold")
    h, gap = 0.95, 0.3
    for i, (name, says) in enumerate(zip(LAYER_NAMES, LAYER_SAYS)):
        y = 4.75 - (i + 1) * h - i * gap
        inset = 0.0
        ax.add_patch(FancyBboxPatch((1.0 + inset, y), 8.6 - 2 * inset, h, boxstyle="round,pad=0.02,rounding_size=0.08",
                                    facecolor=["#eef0f2", FILL_2, "#b9c1c8", FILL][i], edgecolor=INK, linewidth=1.4))
        ax.add_patch(Circle((0.5, y + h / 2), 0.26, facecolor="white", edgecolor=INK, linewidth=1.4))
        ax.text(0.5, y + h / 2, p["letters"][i], ha="center", va="center", fontsize=13, fontweight="bold",
                gid=f"layer:{name}")
        ax.text(1.25, y + h / 2, says, ha="left", va="center", fontsize=11)
        if i < 3:  # requests pass down a layer, results come back up
            for dx, up in ((7.9, False), (8.5, True)):
                y0, y1 = y - 0.04, y - gap + 0.04
                tip, base = (y1, y0) if not up else (y0, y1)
                ax.plot([dx, dx], [base, tip + (0.1 if not up else -0.1)], color=INK, linewidth=1.2)
                s = 1 if not up else -1
                ax.add_patch(Polygon([(dx, tip), (dx - 0.07, tip + s * 0.12), (dx + 0.07, tip + s * 0.12)], closed=True,
                                     facecolor=INK, edgecolor=INK))
    return fig


def _glyph(ax, name: str, x: float, y: float) -> None:
    """A small picture on an icon, centred on (x, y)."""
    if name in ("Documents", "Games"):
        ax.add_patch(Rectangle((x - 0.22, y - 0.15), 0.44, 0.3, facecolor="#f2c94c", edgecolor=INK, linewidth=0.8))
    elif name == "Recycle Bin":
        ax.add_patch(Polygon([(x - 0.17, y + 0.15), (x + 0.17, y + 0.15), (x + 0.12, y - 0.18), (x - 0.12, y - 0.18)],
                             closed=True, facecolor="#dfe6ee", edgecolor=INK, linewidth=0.8))
    elif name == "Browser":
        ax.add_patch(Circle((x, y), 0.18, facecolor="#5b9bd5", edgecolor=INK, linewidth=0.8))
    elif name == "Calculator":
        ax.add_patch(Rectangle((x - 0.13, y - 0.18), 0.26, 0.36, facecolor="#dddddd", edgecolor=INK, linewidth=0.8))
    elif name == "Paint":
        ax.add_patch(Circle((x, y), 0.18, facecolor="#ed7d31", edgecolor=INK, linewidth=0.8))
    elif name == "Music":
        ax.add_patch(Circle((x - 0.05, y - 0.08), 0.08, facecolor=INK, edgecolor=INK))
        ax.plot([x + 0.03, x + 0.03], [y - 0.08, y + 0.18], color=INK, linewidth=1.2)
    else:  # Photos
        ax.add_patch(Rectangle((x - 0.2, y - 0.15), 0.4, 0.3, facecolor="#70ad47", edgecolor=INK, linewidth=0.8))


def _draw_screens(p: dict):
    fig, ax = _frame(11.4, 5.0)
    sw, sh = 5.3, 3.9
    for k in (1, 2):
        x0 = 0.2 + (k - 1) * (sw + 0.4)
        ax.text(x0 + sw / 2, 4.7, f"Screen {k}", ha="center", va="center", fontsize=12, fontweight="bold")
        if k == p["gui"]:
            _gui(ax, p, x0, 0.4, sw, sh)
        else:
            _cli(ax, p, x0, 0.4, sw, sh)
    return fig


def _gui(ax, p, x0, y0, w, h):
    ax.add_patch(Rectangle((x0, y0), w, h, facecolor="#cfe0f1", edgecolor=INK, linewidth=1.6))
    ax.add_patch(Rectangle((x0, y0), w, 0.4, facecolor="#9aa4ad", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((x0 + 0.1, y0 + 0.07), 0.6, 0.26, facecolor="#5b9bd5", edgecolor=INK, linewidth=0.8))
    ax.text(x0 + 0.4, y0 + 0.2, "Start", ha="center", va="center", fontsize=10, color="white", fontweight="bold")
    ax.text(x0 + w - 0.15, y0 + 0.2, "09:30", ha="right", va="center", fontsize=10)
    for i, name in enumerate(p["icons"]):
        col, row = divmod(i, 3)  # three to a column, so no name reaches the taskbar
        cx, cy = x0 + 0.65 + col * 1.3, y0 + h - 0.55 - row * 0.95
        ax.add_patch(FancyBboxPatch((cx - 0.28, cy - 0.22), 0.56, 0.48, boxstyle="round,pad=0.01,rounding_size=0.06",
                                    facecolor="white", edgecolor=INK, linewidth=0.9))
        _glyph(ax, name, cx, cy + 0.02)
        ax.text(cx, cy - 0.38, name, ha="center", va="center", fontsize=10)
    # a window and the pointer
    wx, wy = x0 + 3.95, y0 + 0.9
    ax.add_patch(Rectangle((wx, wy), 1.25, 1.5, facecolor="white", edgecolor=INK, linewidth=1.0))
    ax.add_patch(Rectangle((wx, wy + 1.22), 1.25, 0.28, facecolor="#5b9bd5", edgecolor=INK, linewidth=1.0))
    for j, s in enumerate(("_", "□", "×")):
        ax.text(wx + 0.6 + j * 0.22, wy + 1.36, s, ha="center", va="center", fontsize=10, color="white")
    px, py = wx + 0.7, wy + 0.85
    ax.add_patch(Polygon([(px, py), (px, py - 0.4), (px + 0.1, py - 0.3), (px + 0.18, py - 0.45), (px + 0.24, py - 0.42),
                          (px + 0.16, py - 0.27), (px + 0.28, py - 0.27)], closed=True, facecolor="white",
                         edgecolor=INK, linewidth=0.9))


def _cli(ax, p, x0, y0, w, h):
    ax.add_patch(Rectangle((x0, y0), w, h, facecolor="#111111", edgecolor=INK, linewidth=1.6))
    user = p["user"].lower()
    lines = []
    pool = dict(LINUX_COMMANDS if p["linux"] else WIN_COMMANDS)
    folder = ""
    for c in p["commands"]:
        prompt = f"{user}@pc:~{folder}$ " if p["linux"] else f"C:\\Users\\{p['user']}{folder}> "
        lines.append(prompt + c)
        lines += pool[c]
        if c == "cd Documents":
            folder = "/Documents" if p["linux"] else "\\Documents"
    lines.append((f"{user}@pc:~{folder}$ " if p["linux"] else f"C:\\Users\\{p['user']}{folder}> ") + "_")
    for i, line in enumerate(lines):
        ax.text(x0 + 0.15, y0 + h - 0.3 - i * 0.34, line, ha="left", va="center", fontsize=10, family="monospace",
                color="#e8e8e8")


def draw(p: dict):
    return {"boot": _draw_boot, "layers": _draw_layers, "screens": _draw_screens}[p["sub"]](p)


# --- questions --------------------------------------------------------------------------------------

SETTINGS = ["in an ICT lesson", "for homework", "on a revision card", "for a class test", "at the computer club",
            "in a Computer Science lesson"]
ORDINAL = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth"}


def _letters(stem: str, key: str, letters) -> Question:
    options = sorted(letters)
    return Question("mcq", stem, str(options.index(key)), options)


def questions(p: dict, rng: random.Random) -> list:
    who = rng.choice(NAMES)
    setting = rng.choice(SETTINGS)
    if p["sub"] == "boot":
        order, n = p["order"], len(p["order"])
        card = {step: "ABCDEF"[c] for c, step in enumerate(order)}
        a = p["after"]
        nxt = card[order[a] + 1]
        others = rng.sample([card[s] for s in range(n) if card[s] not in (nxt, "ABCDEF"[a])], 3)
        nth = card[p["nth"]]  # p["nth"] counts from 0: step p["nth"] + 1
        k = p["nth"] + 1
        others2 = rng.sample([card[s] for s in range(n) if card[s] != nth], 3)
        return [_letters(f"{who} puts these cards in the order a computer starts up {setting}. Which card comes "
                         f"straight after card {'ABCDEF'[a]}?", nxt, [nxt] + others),
                _letters(f"When the cards are put in the order a computer starts up, which card is the {ORDINAL[k]} "
                         f"step?", nth, [nth] + others2)]
    if p["sub"] == "layers":
        letters = dict(zip(LAYER_NAMES, p["letters"]))
        ask, thing = p["ask"], p["thing"]
        where = BELONGS[thing]
        what = {"application software": "the application software layer", "operating system": "the operating system "
                "layer", "hardware": "the hardware layer"}[ask]
        return [_letters(f"{who} labels this diagram {setting}. Which letter shows {what}?", letters[ask],
                         letters.values()),
                _letters(f"By the descriptions in the diagram of the layers, in which lettered layer does {thing} "
                         f"belong?", letters[where], letters.values())]
    gui = f"Screen {p['gui']}"
    options = ["Screen 1", "Screen 2", "Both screens", "Neither screen"]
    return [Question("mcq", f"{who} compares these two screens {setting}. Which screen shows a graphical user "
                            f"interface (GUI)?", str(options.index(gui)), options),
            count("How many icons are on the desktop in the screen with the graphical user interface?", len(p["icons"]),
                  "icons"),
            count("How many commands has the user typed on the command-line screen?", len(p["commands"]), "commands")]
