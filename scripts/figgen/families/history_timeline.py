"""A horizontal timeline of real events from one period (P Stages 4 to 6 for Nigeria, LS, UP; AS Level by name), drawn
as history books draw it: a line with a tick for every year (every 5 years over a long span), the years numbered under
it, and each event a dot on the line joined by a leader to a lettered circle with the event's year under the circle. A
key under the line names each lettered event. On half the LS and UP figures one event between two others is drawn as a
"?" with no year and is left out of the key.

Which of four events came first (or last); how many years lie between two events; which lettered event happened in a
stated decade (exactly one did); and which event belongs at the "?" (the options carry their years; exactly one lies
between the two events either side of the "?", and none of them is already on the line).

Every date comes from the fixed tables below, each one a standard school textbook states the same way. Nothing
contested is included, and no battle, massacre, execution or war: the periods are told through their treaties,
constitutions, laws, inventions, meetings and journeys.
"""
from __future__ import annotations

import random

from matplotlib.patches import Circle

from ..core import INK, NAMES, Question, mcq, new_figure, short

ID = "history_timeline"
KIND = "timeline"
SUBJECT = "history"
BANDS = ("P", "LS", "UP")
# An Upper Secondary timeline is drawn the same way in the AS Level coursebooks; there the topic's own name must say
# what the timeline teaches (NEEDS), and each period reaches only the topics its own name list allows (avoid_for).
ALSO_BANDS = {"UP": ("AL",)}

# Nigerian names for the Nigerian periods (NERDC, WAEC and JAMB books); the Rwandan NAMES for the rest.
NG_NAMES = ["Chinedu", "Amina", "Tunde", "Ngozi", "Emeka", "Aisha", "Bola", "Ifeoma", "Musa", "Funke", "Chioma",
            "Ibrahim", "Kemi", "Obinna", "Zainab", "Femi"]

# Source: NERDC Primary 4-6 History "Colonial period", "Independence and nation-building"; WAEC/JAMB History "Nigerian
# history" (amalgamation 1 January 1914; Clifford 1922, Richards 1946, Macpherson 1951 and Lyttelton 1954
# constitutions; NCNC 26 August 1944; independence 1 October 1960; republic 1 October 1963; 12 states 27 May 1967;
# the naira 1 January 1973; ECOWAS, Treaty of Lagos 28 May 1975; 19 states 3 February 1976; Second Republic 1 October
# 1979; Abuja 12 December 1991; 36 states 1 October 1996; Fourth Republic 29 May 1999).
NIGERIA = [["Northern and Southern Nigeria are amalgamated", 1914], ["The Clifford Constitution is introduced", 1922],
           ["The NCNC party is formed", 1944], ["The Richards Constitution is introduced", 1946],
           ["The Macpherson Constitution is introduced", 1951], ["Nigeria becomes a federation", 1954],
           ["Nigeria becomes independent", 1960], ["Nigeria becomes a republic", 1963],
           ["Nigeria is divided into 12 states", 1967], ["The naira replaces the Nigerian pound", 1973],
           ["ECOWAS is founded in Lagos", 1975], ["Nigeria is divided into 19 states", 1976],
           ["The Second Republic begins", 1979], ["Abuja becomes the capital", 1991],
           ["Nigeria is divided into 36 states", 1996], ["The Fourth Republic begins", 1999]]

# Each period: its title (with the range every event lies in), its events (name, year; one event a year), the bands it
# is drawn for, the history concepts it teaches, the topic names it may reach (a regex on the name), and whose names
# the questions use.
PERIODS = {
    # Source: Rwanda S3 History and Citizenship "The 1789 French Revolution"; S4 "Major European Events Between 1789
    # and 1835"; Cambridge AS Modern Europe "France, 1774-1814".
    "france": {"title": "France, 1774–1815", "range": [1774, 1815],
               "events": [["Louis XVI becomes King of France", 1774], ["The Estates-General meets at Versailles", 1789],
                          ["France gets its first written constitution", 1791], ["France is declared a republic", 1792],
                          ["The Directory takes over the government", 1795],
                          ["Napoleon Bonaparte becomes First Consul", 1799], ["The Bank of France is founded", 1800],
                          ["Napoleon is crowned Emperor of the French", 1804],
                          ["Napoleon gives up the throne for the first time", 1814],
                          ["The Congress of Vienna signs its Final Act", 1815]],
               "bands": ["LS", "UP"], "concepts": ["france-1774-1814", "major-european-events-1789-1835"],
               "topics": r"french revolution|france|1789 and 1835", "people": "rw"},
    # Source: Rwanda S2 History and Citizenship "Causes and Impact of the American Revolution".
    "american": {"title": "The American Revolution, 1764–1789", "range": [1764, 1789],
                 "events": [["Britain passes the Sugar Act", 1764], ["Britain passes the Stamp Act", 1765],
                            ["The Stamp Act is repealed", 1766], ["Britain passes the Townshend Acts", 1767],
                            ["The Boston Tea Party", 1773], ["The First Continental Congress meets", 1774],
                            ["The Declaration of Independence is adopted", 1776],
                            ["The Treaty of Paris recognises US independence", 1783], ["The US Constitution is signed", 1787],
                            ["George Washington becomes the first US President", 1789]],
                 "bands": ["LS"], "concepts": ["american-revolution"], "topics": r"american revolution", "people": "rw"},
    # Source: Rwanda S2 "The Industrial Revolution" (technical inventions and their inventors); Cambridge AS Modern
    # Europe "The Industrial Revolution in Britain, 1750-1850".
    "industrial": {"title": "The Industrial Revolution in Britain, 1733–1830", "range": [1733, 1830],
                   "events": [["John Kay invents the flying shuttle", 1733], ["The Bridgewater Canal opens", 1761],
                              ["James Watt patents his steam engine", 1769],
                              ["Richard Arkwright opens his mill at Cromford", 1771],
                              ["Samuel Crompton invents the spinning mule", 1779],
                              ["Edmund Cartwright patents the power loom", 1785],
                              ["Trevithick's steam locomotive runs at Penydarren", 1804],
                              ["The Stockton and Darlington Railway opens", 1825],
                              ["Stephenson's Rocket wins the Rainhill Trials", 1829],
                              ["The Liverpool and Manchester Railway opens", 1830]],
                   "bands": ["LS", "UP"], "concepts": ["industrial-revolution"], "topics": r"industrial revolution",
                   "people": "rw"},
    # Source: Rwanda S5 "Major European Events from 1836 to 1878" (the German unification); Cambridge AS Modern Europe
    # "Liberalism and nationalism in Germany, 1815-71".
    "germany": {"title": "The unification of Germany, 1815–1871", "range": [1815, 1871],
                "events": [["The German Confederation is set up", 1815], ["The Carlsbad Decrees are issued", 1819],
                           ["The Zollverein customs union begins", 1834], ["The Frankfurt Parliament meets", 1848],
                           ["Frederick William IV refuses the German crown", 1849],
                           ["William I becomes King of Prussia", 1861],
                           ["Bismarck becomes Minister-President of Prussia", 1862],
                           ["The North German Confederation is formed", 1867],
                           ["The German Empire is proclaimed at Versailles", 1871]],
                "bands": ["UP"], "concepts": ["german-unification"], "topics": r"germany, 1815|1836 to 1878",
                "people": "rw"},
    # Source: Cambridge AS Modern Europe "The Russian Revolution, 1894-1921"; IGCSE "Depth Study: Russia, 1905-41".
    "russia": {"title": "Russia, 1894–1921", "range": [1894, 1921],
               "events": [["Nicholas II becomes Tsar", 1894], ["The Social Democratic Labour Party is founded", 1898],
                          ["The party splits into Bolsheviks and Mensheviks", 1903],
                          ["The Tsar issues the October Manifesto", 1905], ["The first State Duma meets", 1906],
                          ["The fourth State Duma meets", 1912], ["The Bolsheviks take power", 1917],
                          ["Russia signs the Treaty of Brest-Litovsk", 1918],
                          ["Lenin introduces the New Economic Policy", 1921]],
               "bands": ["UP"], "concepts": ["russia-1905-1941", "bolsheviks-power-consolidation"], "topics": r"russia",
               "people": "rw"},
    # Source: Cambridge AS History of the USA "The origins of the Civil War, 1820-61", "Civil War and Reconstruction,
    # 1861-77".
    "usa": {"title": "The United States, 1820–1877", "range": [1820, 1877],
            "events": [["The Missouri Compromise is agreed", 1820], ["Texas joins the United States", 1845],
                       ["The Compromise of 1850 is agreed", 1850], ["Uncle Tom's Cabin is published", 1852],
                       ["The Kansas-Nebraska Act is passed", 1854],
                       ["The Supreme Court decides the Dred Scott case", 1857],
                       ["Abraham Lincoln is elected President", 1860],
                       ["The Emancipation Proclamation takes effect", 1863], ["The 13th Amendment ends slavery", 1865],
                       ["The 14th Amendment is ratified", 1868], ["The 15th Amendment is ratified", 1870],
                       ["Reconstruction ends", 1877]],
            "bands": ["UP"], "concepts": ["american-civil-war", "sectional-divisions-usa", "reconstruction-era"],
            "topics": r"civil war|reconstruction", "people": "rw"},
    # Source: Cambridge AS International History "The League of Nations and international relations in the 1920s" and
    # "...in the 1930s"; IGCSE "The Inter-War Years, 1919-39".
    "league": {"title": "The League of Nations, 1919–1937", "range": [1919, 1937],
               "events": [["The Treaty of Versailles is signed", 1919], ["The League of Nations is set up", 1920],
                          ["The League settles the Aaland Islands dispute", 1921], ["The Dawes Plan is agreed", 1924],
                          ["The Locarno Treaties are signed", 1925], ["Germany joins the League of Nations", 1926],
                          ["The Kellogg-Briand Pact is signed", 1928], ["The Wall Street Crash", 1929],
                          ["The Lytton Report is published", 1932], ["Japan leaves the League of Nations", 1933],
                          ["The USSR joins the League of Nations", 1934], ["The Stresa Front is formed", 1935],
                          ["Italy leaves the League of Nations", 1937]],
               "bands": ["UP"], "concepts": ["league-of-nations", "inter-war-years-1919-1939"],
               "topics": r"league of nations|inter-war|international relations from 1919", "people": "rw"},
    # Source: Cambridge AS International History "China and Japan 1912-1945".
    "china_japan": {"title": "China and Japan, 1912–1945", "range": [1912, 1945],
                    "events": [["China becomes a republic", 1912], ["The May Fourth Movement begins", 1919],
                               ["The Chinese Communist Party is founded", 1921],
                               ["The Washington Naval Treaty is signed", 1922], ["Sun Yat-sen dies", 1925],
                               ["Hirohito becomes Emperor of Japan", 1926], ["The London Naval Treaty is signed", 1930],
                               ["Japan leaves the League of Nations", 1933],
                               ["Japan and Germany sign the Anti-Comintern Pact", 1936],
                               ["Japan signs the Tripartite Pact", 1940]],
                    "bands": ["UP"], "concepts": ["china-japan-1912-1945", "japan-world-power"],
                    "topics": r"china and japan", "people": "rw"},
    # Source: Rwanda S2 "Exploration of Africa" (explorers and their routes), "European Colonisation of Africa"; S4
    # "Role of Colonial Agents in Colonisation of Africa" (the Berlin Conference, 15 November 1884 to 26 February 1885).
    "africa": {"title": "Exploration and partition of Africa, 1855–1885", "range": [1855, 1885],
               "events": [["Livingstone reaches the Victoria Falls", 1855], ["Speke reaches Lake Victoria", 1858],
                          ["Speke reaches the Nile's source at Ripon Falls", 1862], ["Baker reaches Lake Albert", 1864],
                          ["The Suez Canal opens", 1869], ["Stanley meets Livingstone at Ujiji", 1871],
                          ["Leopold II's Brussels Geographical Conference", 1876],
                          ["Stanley reaches the Atlantic at Boma", 1877], ["France makes Tunisia a protectorate", 1881],
                          ["The Berlin Conference opens", 1884], ["The Berlin Conference ends", 1885]],
               "bands": ["LS", "UP"], "concepts": ["exploration-of-africa", "colonialism-and-capitalism"],
               "topics": r"exploration of africa|coloni[sz]ation of africa|colonial agents", "people": "rw"},
    "nigeria": {"title": "Nigeria, 1914–1999", "range": [1914, 1999], "events": NIGERIA, "bands": ["UP"],
                "concepts": ["nigerian-history"], "topics": r"nigerian history", "people": "ng"},
    "nigeria_colonial": {"title": "Nigeria in colonial times, 1914–1960", "range": [1914, 1960],
                         "events": [e for e in NIGERIA if e[1] <= 1960], "bands": ["P"],
                         "concepts": ["colonial-systems-of-administration"], "topics": r"^colonial period", "people": "ng"},
    "nigeria_independent": {"title": "Nigeria after independence, 1960–1999", "range": [1960, 1999],
                            "events": [e for e in NIGERIA if e[1] >= 1960], "bands": ["P"],
                            "concepts": ["decolonisation-africa", "republican-institutions-evolution"],
                            "topics": r"independence and nation-building", "people": "ng"},
}
CONCEPTS = tuple(sorted({f"history.{c}" for per in PERIODS.values() for c in per["concepts"]}))
# A topic whose sections the book lists (and an AS Level topic, by its name) is reached only if it names a revolution,
# exploration, colonisation, unification, the League, the Civil War, Russia, China and Japan, Nigeria's history or a
# year.
NEEDS = (r"revolution|exploration|coloni[sz]|unification|inter-war|league of nations|international relations|"
         r"civil war|reconstruction|china and japan|russia|nigerian history|independence and nation|\b1[5-9]\d\d\b")
# Never genocide, human rights or the source and assessment units (source_provenance serves those).
AVOID = r"genocide|human rights|preparing for assessment|source|historiograph"


def concepts_for(p: dict) -> tuple[str, ...]:
    return tuple(f"history.{c}" for c in PERIODS[p["period"]]["concepts"])


def avoid_for(p: dict) -> str:
    """The shared AVOID, and any topic whose name is not one of this period's own."""
    return f"{AVOID}|^(?!.*(?:{PERIODS[p['period']]['topics']}))"


def stages(p: dict):
    """Nigeria's colonial and independent years are taught in Primary 4 to 6."""
    return (4, 6) if p["band"] == "P" else None


# --- geometry (inches: one data unit is one inch) ---------------------------------------------------------

W = 10.6
X0, X1 = 0.55, W - 0.55  # the line's ends
RADIUS = 0.21  # a letter's circle on the line
GAP = 0.64  # the least distance between two letters' centres


def frame(first: int, last: int) -> tuple[int, int, int, int]:
    """(the year the line starts, the year it ends, the small tick step, the numbered step)."""
    span = last - first
    small, big = (1, 5) if span <= 26 else (1, 10) if span <= 56 else (5, 10)
    lo = (first - 2) // small * small
    hi = -(-(last + 2) // small) * small
    return lo, hi, small, big


def xs_of(events: list) -> tuple:
    """Where each event's dot stands on the line, and where its letter stands above it (spread so no two letters
    touch, in the events' order)."""
    lo, hi, _, _ = frame(events[0][1], events[-1][1])
    dots = [X0 + (y - lo) / (hi - lo) * (X1 - X0) for _, y in events]
    # pack the letters into clusters centred on their dots, then keep them inside the line's ends
    clusters: list[list[float]] = []  # [first index, count, centre]
    for i, x in enumerate(dots):
        clusters.append([i, 1, x])
        while len(clusters) > 1:
            a, b = clusters[-2], clusters[-1]
            if (b[2] - (b[1] - 1) * GAP / 2) - (a[2] + (a[1] - 1) * GAP / 2) >= GAP:
                break
            n = a[1] + b[1]
            clusters[-2:] = [[a[0], n, (a[2] * a[1] + b[2] * b[1]) / n]]
    labels = [c - (n - 1) * GAP / 2 + k * GAP for _, n, c in clusters for k in range(n)]
    left, right = X0 + 0.3, X1 - 0.3
    for i in range(len(labels)):
        labels[i] = max(labels[i], left + i * GAP)
    for i in range(len(labels) - 1, -1, -1):
        labels[i] = min(labels[i], right - (len(labels) - 1 - i) * GAP)
    return dots, labels


def outside(table: list, events: list, i: int) -> list:
    """The period's events not on the line whose years lie outside the two events either side of event i."""
    before, after = events[i - 1][1], events[i + 1][1]
    drawn = {n for n, _ in events}
    return [e for e in table if e[0] not in drawn and not before < e[1] < after]


def sample(rng: random.Random) -> dict:
    key = rng.choice(sorted(PERIODS))
    per = PERIODS[key]
    band = rng.choice(per["bands"])
    table = per["events"]
    while True:
        n = 4 if band == "P" else rng.choice([5, 6])
        events = sorted(rng.sample(table, n), key=lambda e: e[1])
        blank = None
        if band != "P" and rng.random() < 0.5:
            inner = [i for i in range(1, n - 1) if len(outside(table, events, i)) >= 3]
            if not inner:
                continue
            blank = rng.choice(inner)
        letters = list("ABCDEF"[:n - (blank is not None)])
        rng.shuffle(letters)
        marks = []
        for i in range(n):
            marks.append("?" if i == blank else letters.pop())
        years = [y for (_, y), mk in zip(events, marks) if mk != "?"]
        decades = sorted({y // 10 * 10 for y in years if sum(1 for z in years if z // 10 == y // 10) == 1})
        if not decades:
            continue
        dots, labels = xs_of(events)
        if max(abs(a - b) for a, b in zip(dots, labels)) > 1.5:
            continue  # a cluster too tight to letter clearly
        return {"band": band, "period": key, "events": [list(e) for e in events], "letters": marks,
                "decade": rng.choice(decades)}


# --- drawing ----------------------------------------------------------------------------------------------

def draw(p: dict):
    per = PERIODS[p["period"]]
    events, marks = p["events"], p["letters"]
    big_print = p["band"] == "P"
    fs_letter, fs_year, fs_tick, fs_key, fs_title = (13, 12, 11, 12, 14) if big_print else (12, 11, 10, 11, 13)
    row = 0.46 if big_print else 0.42
    keyed = [(mk, n) for (n, _), mk in zip(events, marks) if mk != "?"]
    keyed.sort()
    rows = -(-len(keyed) // 2)
    H = 2.15 + 1.2 + (rows - 1) * row + 0.4
    title_y, circle_y = H - 0.32, H - 1.05
    year_y = circle_y - 0.45
    line_y = H - 2.15
    fig, ax = new_figure(W, H)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    ax.text(W / 2, title_y, per["title"], ha="center", va="center", fontsize=fs_title, fontweight="bold")
    lo, hi, small, big = frame(events[0][1], events[-1][1])

    def X(year):
        return X0 + (year - lo) / (hi - lo) * (X1 - X0)

    ax.plot([X0, X1], [line_y, line_y], color=INK, linewidth=2, gid="line")
    for y in range(lo, hi + 1, small):
        size = 0.12 if y % big == 0 else 0.06
        ax.plot([X(y), X(y)], [line_y - size, line_y + size], color=INK, linewidth=1.0 if y % big == 0 else 0.7)
        if y % big == 0:
            ax.text(X(y), line_y - 0.3, str(y), ha="center", va="center", fontsize=fs_tick, gid="tick")
    dots, labels = xs_of(events)
    for (name, year), mk, xd, xl in zip(events, marks, dots, labels):
        top = circle_y - RADIUS - 0.04 if mk == "?" else year_y - 0.17
        ax.plot([xd, xl], [line_y + 0.05, top], color=INK, linewidth=0.9, gid=f"leader:{mk}")
        ax.plot([xd], [line_y], marker="o", markersize=7, color=INK, zorder=4)
        ax.add_patch(Circle((xl, circle_y), RADIUS, facecolor="white", edgecolor=INK, linewidth=1.4, zorder=3))
        ax.text(xl, circle_y, mk, ha="center", va="center", fontsize=fs_letter, fontweight="bold", zorder=4,
                gid=f"letter:{mk}")
        if mk != "?":
            ax.text(xl, year_y, str(year), ha="center", va="center", fontsize=fs_year, gid=f"year:{mk}")
    # the key
    head = "Key" if "?" not in marks else "Key (the event at ? is not named here)"
    ax.text(0.45, line_y - 0.75, head, ha="left", va="center", fontsize=fs_key, fontweight="bold")
    for i, (mk, name) in enumerate(keyed):
        col, r = divmod(i, rows)
        kx, ky = 0.62 + col * 5.05, line_y - 1.2 - r * row
        ax.add_patch(Circle((kx, ky), 0.17, facecolor="white", edgecolor=INK, linewidth=1.2))
        ax.text(kx, ky, mk, ha="center", va="center", fontsize=fs_key - 1, fontweight="bold", gid=f"keyletter:{mk}")
        ax.text(kx + 0.3, ky, name, ha="left", va="center", fontsize=fs_key, gid=f"keyname:{mk}")
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


# --- questions --------------------------------------------------------------------------------------------

SETTINGS = ["in a history lesson", "for homework", "on a revision card", "before a class test", "in the school library",
            "at the history club", "for a group presentation"]
VERBS = ["studies", "reads", "looks at", "copies"]


def questions(p: dict, rng: random.Random) -> list:
    per = PERIODS[p["period"]]
    people = NG_NAMES if per["people"] == "ng" else NAMES
    who, friend = rng.sample(people, 2)
    events, marks = p["events"], p["letters"]
    lettered = [(mk, n, y) for (n, y), mk in zip(events, marks) if mk != "?"]
    qs = []
    # 1. Which of four events came first (or last).
    four = rng.sample([n for _, n, _ in lettered], 4)
    year = {n: y for _, n, y in lettered}
    first = rng.random() < 0.6
    key = min(four, key=year.get) if first else max(four, key=year.get)
    qs.append(mcq(f"{who} {rng.choice(VERBS)} this timeline {rng.choice(SETTINGS)}. Which of these events happened "
                  f"{'first' if first else 'last'}?", key, [n for n in four if n != key], rng))
    # 2. The years between two events.
    (_, a, ya), (_, b, yb) = sorted(rng.sample(lettered, 2), key=lambda e: e[2])
    gap = yb - ya
    stem = rng.choice([f'How many years after "{a}" did "{b}" happen?',
                       f'{friend} counts the years from "{a}" to "{b}". How many years is that?',
                       f'How many years passed between "{a}" and "{b}"?'])
    qs.append(short(stem, gap, [f"{gap} years"]))
    # 3. The one lettered event in a decade.
    d = p["decade"]
    right = next(mk for mk, _, y in lettered if d <= y < d + 10)
    others = rng.sample([mk for mk, _, y in lettered if not d <= y < d + 10], 3)
    options = sorted([right, *others])
    qs.append(Question("mcq", f"Which lettered event on the timeline happened in the {d}s?", str(options.index(right)),
                       options))
    # 4. The event that belongs at the "?".
    if "?" in marks:
        i = marks.index("?")
        name, y = events[i]
        wrong = rng.sample(outside(per["events"], events, i), 3)
        qs.append(mcq("The event marked ? on the timeline is left out of the key. Which of these events belongs at the "
                      "? mark?", f"{name} ({y})", [f"{n} ({z})" for n, z in wrong], rng))
    return qs
