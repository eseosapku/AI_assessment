"""A timeline of real events with their real years, drawn down the page as history books draw them: a line with a
tick for every year (every 5 or 10 years over a long span), the years numbered, and each event's name and year
beside a dot at its year. Only events whose dates are settled, one event a year, from nine eras: Rwanda under
colonial rule, Rwanda since independence, independence in Africa, the First World War, the inter-war years, the
Second World War, the Cold War, the end of the slave trade, and West Africa and the Trans-Saharan trade.

Reading and interval questions the timeline decides: which of four events came first (or last); how many years
lie between two events; the decade or century of an event; and either where an event not drawn belongs (between
which two events) or what year an arrow marked X points to.

Rwanda's history is taught as dates and commemoration only: the 1994 Genocide against the Tutsi is on the timeline
whenever its span crosses 1994, and is never the subject of a question or an option (P3x brief).
"""
from __future__ import annotations

import random

from ..core import INK, NAMES, mcq, new_figure, short

ID = "timeline"
KIND = "timeline"
SUBJECT = "history"
BANDS = ("LS", "UP", "P")

# The 1994 event: drawn as a date, never asked about.
QUIET = "Genocide against the Tutsi"

# Each era: its events (name, year), the bands it is taught at, and the history concepts it teaches. Years are
# settled ones from standard references; nothing contested is included, and no year holds two events.
SETS = {
    # Source: Rwanda History and Citizenship S2 SB, "German and Belgian Colonisation (1897-1962)"; S4 History SB,
    # "Rwanda under German and Belgian colonial rule"; the UN Trusteeship Agreement for Ruanda-Urundi (13 Dec 1946).
    "Rwanda under colonial rule": {
        "events": [("Berlin Conference ends", 1885), ("Von Götzen, a German, reaches Rwanda", 1894),
                   ("German rule in Rwanda begins", 1897), ("First Catholic mission opens at Save", 1900),
                   ("Richard Kandt founds Kigali", 1907), ("Belgian troops take over Rwanda", 1916),
                   ("Treaty of Versailles: Germany loses its colonies", 1919), ("Mwami Musinga is removed by the Belgians", 1931),
                   ("Ruanda-Urundi becomes a UN Trust Territory", 1946), ("Ubuhake is abolished", 1954),
                   ("Mwami Mutara III Rudahigwa dies", 1959), ("Referendum ends the monarchy", 1961),
                   ("Rwanda becomes independent", 1962)],
        "bands": ["LS", "UP", "P"],
        "concepts": ["german-colonisation-rwanda", "national-independence-rwanda", "importance-of-studying-history"],
        "avoid": r"post-independence|^independent rwanda|ghana|slave|trade",
    },
    # Source: Rwanda History and Citizenship S2 SB, "Independent Rwanda"; S5 History SB, "The First and the Second
    # Republics of Rwanda"; S6 History SB, "The 1990-1994 Liberation War"; the Constitution of 2003 (referendum
    # 26 May 2003) and its revision (referendum 18 December 2015); Organic Law 40/2000 of 26 January 2001 on Gacaca
    # courts (closed 18 June 2012); EAC (joined 1 July 2007); the Commonwealth (joined 29 November 2009); the 2008
    # Chamber of Deputies election (45 of 80 seats won by women).
    "Rwanda since independence": {
        "events": [("Rwanda becomes independent", 1962), ("The Second Republic begins", 1973),
                   ("The Liberation War begins", 1990), ("A new constitution allows many parties", 1991),
                   ("Arusha Peace Agreement is signed", 1993), (QUIET, 1994),
                   ("Unity and Reconciliation Commission is set up", 1999), ("Gacaca courts are set up by law", 2001),
                   ("New Constitution is adopted", 2003), ("Rwanda joins the East African Community", 2007),
                   ("Women win most seats in the Chamber of Deputies", 2008), ("Rwanda joins the Commonwealth", 2009),
                   ("Gacaca courts close", 2012), ("Revised Constitution is adopted", 2015)],
        "bands": ["LS", "UP", "P"],
        "concepts": ["first-republic-rwanda", "second-republic-rwanda", "liberation-war-1990-1994",
                     "government-national-unity-achievements", "republican-institutions-evolution", "national-independence-rwanda",
                     "importance-of-studying-history"],
        "avoid": r"colonial|colonis|slave|trade",
    },
    # Source: each country's independence day (Libya 24 Dec 1951 ... South Sudan 9 Jul 2011); S6 History SB,
    # "African nationalism and acquisition of independence".
    "Independence in Africa": {
        "events": [("Libya becomes independent", 1951), ("Sudan becomes independent", 1956), ("Ghana becomes independent", 1957),
                   ("Guinea becomes independent", 1958), ("Nigeria becomes independent", 1960),
                   ("Tanganyika becomes independent", 1961), ("Rwanda becomes independent", 1962),
                   ("Kenya becomes independent", 1963), ("Zambia becomes independent", 1964),
                   ("The Gambia becomes independent", 1965), ("Botswana becomes independent", 1966),
                   ("Swaziland (now Eswatini) becomes independent", 1968), ("Mozambique becomes independent", 1975),
                   ("Djibouti becomes independent", 1977), ("Zimbabwe becomes independent", 1980),
                   ("Namibia becomes independent", 1990), ("Eritrea becomes independent", 1993),
                   ("South Sudan becomes independent", 2011)],
        "bands": ["LS", "UP"],
        "concepts": ["decolonisation-africa", "african-nationalism"],
        "avoid": r"\bcolonial|\bcolonis|\bcoloniz|domination|trade|german|empires|interdependence|neo-colonialism|self-reliance",
    },
    # Source: Cambridge IGCSE History, "The Cold War, 1945-75" and "Who was to blame for the Cold War?";
    # S6 History SB, "The Cold War (1947-1991)".
    "The Cold War": {
        "events": [("Truman Doctrine is announced", 1947), ("Berlin Blockade begins", 1948), ("NATO is formed", 1949),
                   ("Korean War begins", 1950), ("Stalin dies", 1953), ("Warsaw Pact is formed", 1955),
                   ("Hungarian Uprising", 1956), ("Sputnik 1 is launched", 1957), ("Berlin Wall is built", 1961),
                   ("Cuban Missile Crisis", 1962), ("Prague Spring", 1968), ("Fall of Saigon", 1975),
                   ("USSR invades Afghanistan", 1979), ("Berlin Wall falls", 1989), ("Soviet Union breaks up", 1991)],
        "bands": ["UP"],
        "concepts": ["cold-war", "soviet-control-eastern-europe"],
        "avoid": r"nationalism|neo-colonialism|interdependence",
    },
    # Source: S3 History and Citizenship SB, "Causes and effects of the First World War (1914-1918)"; Cambridge
    # IGCSE History, "Was the Treaty of Versailles fair?".
    "The First World War and the peace": {
        "events": [("First World War begins", 1914), ("Gallipoli campaign begins", 1915), ("Battle of the Somme", 1916),
                   ("USA enters the war", 1917), ("Armistice ends the fighting", 1918), ("Treaty of Versailles is signed", 1919),
                   ("League of Nations is set up", 1920)],
        "bands": ["LS", "UP"],
        "concepts": ["first-world-war-1914-1918", "versailles-peace-treaty", "league-of-nations", "world-wars"],
        "avoid": None,
    },
    # Source: S3 History and Citizenship SB, "Between two wars"; Cambridge IGCSE History, "The Inter-War Years,
    # 1919-39" (Locarno 1925, Kellogg-Briand 1928, Manchuria 1931, Abyssinia 1935, Rhineland 1936, Munich 1938).
    "The inter-war years": {
        "events": [("Treaty of Versailles is signed", 1919), ("League of Nations is set up", 1920),
                   ("Mussolini comes to power in Italy", 1922), ("French and Belgian troops occupy the Ruhr", 1923),
                   ("Locarno Treaties are signed", 1925), ("Germany joins the League of Nations", 1926),
                   ("Kellogg-Briand Pact is signed", 1928), ("Wall Street Crash", 1929), ("Japan invades Manchuria", 1931),
                   ("Hitler becomes Chancellor of Germany", 1933), ("Italy invades Abyssinia", 1935),
                   ("German troops enter the Rhineland", 1936), ("Munich Agreement is signed", 1938),
                   ("Germany invades Poland", 1939)],
        "bands": ["LS", "UP"],
        "concepts": ["inter-war-years-1919-1939", "league-of-nations", "appeasement-policy", "great-crash-depression",
                     "totalitarian-regimes-europe", "versailles-peace-treaty"],
        "avoid": None,
    },
    # Source: S3 History and Citizenship SB, "Causes and effects of the Second World War (1939-1945)"; S6 History SB,
    # "Causes, course and effects of the First and Second World Wars".
    "The Second World War": {
        "events": [("Germany invades Poland", 1939), ("Germany invades France", 1940), ("Japan attacks Pearl Harbor", 1941),
                   ("Battle of Stalingrad begins", 1942), ("Italy surrenders", 1943), ("D-Day landings in Normandy", 1944),
                   ("Second World War ends", 1945)],
        "bands": ["LS", "UP"],
        "concepts": ["second-world-war-1939-1945", "world-wars"],
        "avoid": r"genocide",
    },
    # Source: S1 History and Citizenship SB, "Trans-Atlantic slave trade"; S2 SB, "The long distance trade"; the
    # Slave Trade Act 1807, Slavery Abolition Act 1833, the Moresby (1822) and Hamerton (1845) treaties with the
    # Sultan, the 13th Amendment (1865), Brazil's Golden Law (1888), Zanzibar's market (1873) and decree (1897).
    "The end of the slave trade": {
        "events": [("Britain bans the slave trade", 1807), ("USA bans the import of enslaved people", 1808),
                   ("Moresby Treaty is signed", 1822), ("Britain abolishes slavery in its empire", 1833),
                   ("Hamerton Treaty is signed", 1845), ("France abolishes slavery", 1848), ("USA abolishes slavery", 1865),
                   ("Zanzibar slave market is closed", 1873), ("Brazil abolishes slavery", 1888),
                   ("Slavery is abolished in Zanzibar", 1897)],
        "bands": ["LS", "UP"],
        "concepts": ["trans-atlantic-slave-trade", "long-distance-trade"],
        "avoid": r"colonial|domination|trans-saharan|empires|islam|interdependence",
    },
    # Source: S1 History and Citizenship SB, "Trans-Saharan trade"; S4 History SB, "Empires in West and South Africa"
    # (Mansa Musa's pilgrimage 1324, Ibn Battuta in Mali 1352, Sunni Ali at Timbuktu 1468, Askia Muhammad 1493,
    # Tondibi 1591); Ceuta (1415) and Elmina (1482) from the Portuguese records.
    "West Africa and the Trans-Saharan trade": {
        "events": [("Mansa Musa makes his pilgrimage to Mecca", 1324), ("Ibn Battuta reaches Mali", 1352),
                   ("Portugal captures Ceuta", 1415), ("Sunni Ali captures Timbuktu", 1468),
                   ("Portuguese build Elmina Castle", 1482), ("Askia Muhammad becomes ruler of Songhai", 1493),
                   ("Moroccan army defeats Songhai at Tondibi", 1591)],
        "bands": ["LS", "UP"],
        "concepts": ["west-african-empires", "long-distance-trade"],
        "avoid": r"colonial|long.distance|trans-atlantic|interdependence",
    },
}
CONCEPTS = tuple(sorted({f"history.{c}" for s in SETS.values() for c in s["concepts"]}))
# Primary Social Studies teaches Rwanda's colonial and post-independence history on a timeline (P5 "Colonial Rwanda",
# P6 "Post-Independence Rwanda"); only the two Rwanda eras are drawn for primary.
ALSO = ("social-studies.timeline", "social-studies.colonial-rwanda", "social-studies.independence-rwanda",
        "social-studies.post-independence-rwanda", "social-studies.first-republic", "social-studies.second-republic",
        "social-studies.liberation-war")
# A topic whose sections the book lists is reached only if its name or a section names a period, an event or a
# chronology a timeline can show.
NEEDS = (r"histor|timeline|chronolog|colonial|colonis|coloniz|independen|republic|world war|two wars|inter-war|cold war|"
         r"trade|slave|liberation war|decoloni|nationalism|west africa|\b1[0-9]{3}\b")
# Genocide units teach it as a subject of its own (no timeline of it is drawn); Nigeria's books (its own independence
# and nation-building) and the civilizations, human-rights, source and historiography units share a concept word without
# teaching these eras.
AVOID = r"genocide|nigeria|nation-building|civiliz|civilis|human rights|contemporary|source analysis|historiography"


def concepts_for(p: dict) -> frozenset[str]:
    return frozenset(f"history.{c}" for c in SETS[p["title"]]["concepts"])


def avoid_for(p: dict) -> str:
    extra = SETS[p["title"]]["avoid"]
    return f"{AVOID}|{extra}" if extra else AVOID


def stages(p: dict) -> tuple[int, int] | None:
    """Primary only in its last two years, where Rwanda's colonial and later history is taught."""
    return (5, 6) if p["band"] == "P" else None


def step_of(first: int, last: int) -> tuple[int, int]:
    """(small tick, numbered tick): a tick every year up to an 80-year span, then every 5 or 10 years."""
    span = last - first
    if span <= 40:
        return 1, 5
    if span <= 80:
        return 1, 10
    return (5, 20) if span <= 150 else (10, 50)


def frame(first: int, last: int) -> tuple[int, int]:
    """The years the line runs from and to: a little beyond the first and last events, on a small tick."""
    small, _ = step_of(first, last)
    pad = max(2, small)
    return (first - pad) // small * small, -(-(last + pad) // small) * small


def sample(rng: random.Random) -> dict:
    title = rng.choice(sorted(SETS))
    era = SETS[title]
    band = rng.choice(era["bands"])
    pool = [e for e in era["events"] if e[0] != QUIET]
    while True:
        events = sorted(rng.sample(pool, rng.choice([5, 5, 6])), key=lambda e: e[1])
        quiet = [e for e in era["events"] if e[0] == QUIET and events[0][1] < e[1] < events[-1][1]]
        events = sorted(events + quiet, key=lambda e: e[1])
        first, last = events[0][1], events[-1][1]
        small, big = step_of(first, last)
        years = [y for _, y in events]
        lo, hi = frame(first, last)
        # X points to an unlabelled small tick, two ticks clear of every event (one tick off read as the event's own
        # year) and well clear of the numbered years (its arrow would run through their numbers).
        clear = max(2 * small, round(0.05 * (hi - lo)))
        numbered = range(-(-lo // big) * big, hi + 1, big)
        marks = [x for x in range(first + 1, last) if x % small == 0 and x % big
                 and all(abs(x - y) >= 2 * small for y in years) and min(abs(x - t) for t in numbered) >= clear
                 and all(abs(x - y) >= 5 for n, y in events if n == QUIET)]  # nor read off from the 1994 event
        extras = [list(e) for e in era["events"] if e not in events and e[0] != QUIET
                  and any(y < e[1] for n, y in events if n != QUIET) and any(y > e[1] for n, y in events if n != QUIET)]
        kinds = (["mark"] if marks else []) + (["extra"] if extras else [])
        if not kinds:
            continue
        kind = rng.choice(kinds)
        return {"band": band, "title": title, "events": [list(e) for e in events],
                "mark": rng.choice(marks) if kind == "mark" else None, "extra": rng.choice(extras) if kind == "extra" else None}


def draw(p: dict):
    events = p["events"]
    first, last = events[0][1], events[-1][1]
    small, big = step_of(first, last)
    lo, hi = frame(first, last)
    fig, ax = new_figure(6.6, 5.2)
    ax.plot([0, 0], [lo, hi], color=INK, linewidth=2)
    for y in range(lo, hi + 1, small):  # a small tick for every year (or every 5 or 10), so each dot's year can be checked by eye
        ax.plot([-0.06, 0.06], [y, y], color=INK, linewidth=0.8)
    for y in range(-(-lo // big) * big, hi + 1, big):
        ax.plot([-0.12, 0.12], [y, y], color=INK, linewidth=1)
        ax.text(-0.25, y, str(y), ha="right", va="center", fontsize=10)
    # Each label sits at its year, or lower when the one above is too close: labels keep
    # the events' order down the page, so none overlaps another and no leader crosses one.
    gap = (hi - lo) * 0.085
    pos: list[float] = []
    for _, year in events:
        pos.append(max(year, pos[-1] + gap) if pos else max(year, lo + gap / 2))
    if pos[-1] > hi - gap / 2:
        pos[-1] = hi - gap / 2
        for i in range(len(pos) - 2, -1, -1):
            pos[i] = min(pos[i], pos[i + 1] - gap)
    for i, ((name, year), y) in enumerate(zip(events, pos)):
        ax.plot([0, 0.6, 0.9], [year, year, y], color=INK, linewidth=0.8, gid=f"leader-{i}")
        ax.plot(0, year, marker="o", color=INK)
        ax.text(1.0, y, f"{name} ({year})", ha="left", va="center", fontsize=10, gid=f"label-{i}")
    if p.get("mark") is not None:
        x = p["mark"]
        ax.annotate("", xy=(-0.04, x), xytext=(-0.7, x), arrowprops={"arrowstyle": "-|>", "color": INK, "lw": 1.2})
        ax.text(-0.82, x, "X", ha="right", va="center", fontsize=11, fontweight="bold", gid="mark")
    ax.set_xlim(-1.2, 7.5)
    ax.set_ylim(hi + 1, lo - 1)  # earliest at the top
    ax.axis("off")
    ax.set_title(p["title"])
    return fig


SETTINGS = ["in a history lesson", "for homework", "on a revision card", "before a class test", "in the school library",
            "at the history club", "for a group presentation"]
VERBS = ["studies", "reads", "looks at", "copies"]


def ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def _decade(y: int) -> str:
    return f"the {y // 10 * 10}s"


def _century(y: int) -> str:
    return f"the {ordinal((y - 1) // 100 + 1)} century"


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    events = [e for e in p["events"] if e[0] != QUIET]  # the 1994 event is a date on the line, never asked about
    years = {n: y for n, y in events}
    qs = []
    # 1. Order: four events, the earliest or the latest of them.
    four = rng.sample([n for n, _ in events], 4)
    first = rng.random() < 0.6
    key = min(four, key=years.get) if first else max(four, key=years.get)
    qs.append(mcq(f"{who} {rng.choice(VERBS)} this timeline {rng.choice(SETTINGS)}. Which of these events happened "
                  f"{'first' if first else 'last'}?", key, [n for n in four if n != key], rng))
    # 2. An interval between two events.
    (a, ya), (b, yb) = sorted(rng.sample(events, 2), key=lambda e: e[1])
    gap = yb - ya
    stem = rng.choice([f'How many years after "{a}" did "{b}" happen?',
                       f'{friend} counts the years from "{a}" to "{b}". How many years is that?',
                       f'How many years passed between "{a}" and "{b}"?'])
    qs.append(short(stem, gap, [f"{gap} years"]))
    # 3. The decade, or over a long span the century, of an event.
    n, y = rng.choice([e for e in events if e[1] % 100])
    if last_span(p) > 80 or rng.random() < 0.3:
        c = (y - 1) // 100 + 1
        qs.append(mcq(f'In which century did "{n}" happen?', _century(y),
                      [f"the {ordinal(k)} century" for k in (c - 1, c + 1, c - 2) if k > 0], rng))
    else:
        d = y // 10 * 10
        qs.append(mcq(f'In which decade did "{n}" happen?', _decade(y), [_decade(d + k) for k in (-10, 10, rng.choice([-20, 20]))], rng))
    # 4. Placing an event not drawn, or reading the year an arrow points to.
    if p.get("extra"):
        name, year = p["extra"]
        pairs = list(zip(events, events[1:]))
        right = next(i for i, (e, f) in enumerate(pairs) if e[1] < year < f[1])
        near = sorted(range(len(pairs)), key=lambda i: (abs(i - right), i))[:4]
        text = [f'Between "{pairs[i][0][0]}" and "{pairs[i][1][0]}"' for i in near]
        qs.append(mcq(f'"{name}" happened in {year}. Between which two events on this timeline does it belong?', text[0], text[1:], rng))
    else:
        x = p["mark"]
        qs.append(short(rng.choice(["The arrow marked X points to a year on this timeline. What year is it?",
                                    "Which year does the arrow marked X point to on this timeline?"]), x))
    return qs


def last_span(p: dict) -> int:
    return p["events"][-1][1] - p["events"][0][1]
