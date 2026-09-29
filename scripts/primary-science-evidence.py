"""
How often each Science topic appears in the real Primary (0097) and
Lower Secondary (0893) Checkpoint question papers.

The evidence behind PRIMARY_SCIENCE_FOCI in lib/checkpoint-paper.ts. Each
topic is counted by its own distinctive words, whole words only -- not by
the words of its label, which is what let "what changes the rate of a
reaction" match every paper on "what" and "changes". A count is a lead,
not a verdict: read the hits in context before trusting one ("heat and
pressure" is the rock cycle, "cell" can be a battery).

Usage: python scripts/primary-science-evidence.py
"""
import os, re, sys, fitz
fitz.TOOLS.mupdf_display_errors(False)
sys.stdout.reconfigure(encoding='utf-8')
ROOTS = [r"C:\Users\Stephen\Downloads\Cambridge Past Papers_Etoile X Brain Ink-20260919T214745Z-1-001",
         r"C:\Users\Stephen\Downloads\pastPapers-20260919T222238Z-1-001"]
SKIP = re.compile(r"mark|scheme|insert|report", re.I)

def papers(code, folder_word=None):
    out = []
    for r in ROOTS:
        for d, _, fs in os.walk(r):
            for f in fs:
                if not f.lower().endswith('.pdf') or SKIP.search(f):
                    continue
                p = os.path.join(d, f)
                if code in f or (folder_word and f'\\{folder_word}\\' in p.lower() and not re.search(r'00\d\d|08\d\d', f)):
                    out.append(p)
    return out

def text(paths):
    t = []
    for p in paths:
        try:
            t.append(' '.join(pg.get_text() for pg in fitz.open(p)))
        except Exception:
            pass
    return re.sub(r'\s+', ' ', ' '.join(t)).lower()

TERMS = {
 # Biology
 'cell structure and function': r'\bcells?\b|\bnucleus\b|\bmembrane\b',
 'the human digestive system': r'digest|\bstomach\b|intestine',
 'the circulatory system': r'\bheart\b|\bblood\b',
 'the skeleton and muscles': r'skeleton|\bmuscles?\b|\bbones?\b',
 'breathing and gas exchange': r'\blungs?\b|breath',
 'photosynthesis': r'photosynthe',
 'transport in plants': r'xylem|\broots?\b',
 'food chains and food webs': r'food chain|food web|\bconsumers?\b|\bproducers?\b',
 'adaptation to a habitat': r'adapt',
 'variation and inheritance': r'variation|inherit',
 'reproduction in flowering plants': r'pollinat|seed dispersal|\bpollen\b',
 'human reproduction': r'puberty|\bsperm\b|\bovar|\bembryo',
 'microorganisms and disease': r'micro-?organism|bacteri|\bvirus',
 'diet and health': r'\bdiet\b|nutrient|vitamin',
 'interdependence in an ecosystem': r'ecosystem|interdepend',
 # Chemistry
 'the particle model of solids, liquids and gases': r'\bparticles?\b',
 'changes of state': r'\bmelt|freez|\bboil|condens',
 'elements, compounds and mixtures': r'\belements?\b|\bcompounds?\b',
 'separating mixtures': r'filtrat|\bfilter|\bsieve|chromatograph',
 'the periodic table': r'periodic table',
 'atomic structure': r'\batoms?\b|proton|electron|neutron',
 'acids, alkalis and the pH scale': r'\bacids?\b|alkali|\bph\b',
 'neutralisation': r'neutrali',
 'writing a word equation for a reaction': r'word equation',
 'conservation of mass': r'conservation of mass',
 'the reactivity of metals': r'reactiv',
 'combustion': r'combustion|\bburn',
 'dissolving and solubility': r'dissolv|solub|\bsolution',
 'what changes the rate of a reaction': r'rate of (?:the )?reaction|catalyst|reaction rate',
 'corrosion and rusting': r'\brust|corro',
 # Physics
 'forces and their effects': r'\bforces?\b|newton',
 'balanced and unbalanced forces': r'balanced',
 'speed, distance and time': r'\bspeed\b',
 'friction and air resistance': r'friction|air resistance',
 'pressure in solids, liquids and gases': r'(?<!heat and )\bpressure\b',
 'energy stores and transfers': r'\benergy\b',
 'conservation of energy': r'conservation of energy|energy is (?:never )?(?:lost|wasted|conserved)',
 'series and parallel circuits': r'\bcircuits?\b',
 'current, voltage and resistance': r'\bcurrent\b|voltage|resistance(?! to)|ammeter|voltmeter',
 'magnets and magnetic fields': r'magnet',
 'reflection and refraction of light': r'reflect|refract',
 'how sound travels': r'\bsound\b|vibrat|\bpitch\b',
 'conduction, convection and radiation': r'conduct|convect|radiat|insulat',
 'density': r'densit',
 'levers and turning effect': r'\blevers?\b|\bpivot\b|turning effect',
 # Stage 6's own topics (not in the shared list)
 'reversible and irreversible changes': r'reversible|physical change|chemical change',
 'reactants, products and the signs of a chemical reaction': r'reactants?\b|\bproducts?\b(?!ion)',
 'the changes of puberty': r'puberty',
 'mass and weight': r'\bweight\b',
 'thermal and electrical conductors and insulators': r'conductiv|\bconductors?\b|\binsulators?\b',
 # Earth and Space
 'the structure of the Earth': r'\bcrust\b|\bmantle\b|\bcore\b',
 'rock types and the rock cycle': r'sedimentary|igneous|metamorphic|rock cycle',
 'weathering and erosion': r'weathering|erosion',
 'how soil forms': r'\bsoils?\b',
 'the water cycle': r'water cycle',
 'the gases in the atmosphere': r'atmospher',
 'climate and climate change': r'climate|global warming|greenhouse',
 'day, night and the seasons': r'\bseasons?\b|day and night',
 'the solar system': r'\bplanets?\b|solar system',
 'the phases of the moon': r'\bmoon\b',
 'gravity and orbits': r'gravit|\borbit',
 'stars and galaxies': r'galax|\bstars?\b',
 'earthquakes and volcanoes': r'earthquake|volcan|tectonic',
 'fossils and the age of rocks': r'\bfossils?\b(?! fuel)',
 'renewable and non-renewable resources': r'renewable|fossil fuel',
}

p6 = papers('0097'); p9 = papers('0893', 'science')
t6, t9 = text(p6), text(p9)
print(f'0097 papers: {len(p6)}   0893 papers: {len(p9)}')
print(f"{'focus':52} {'Stage6':>6} {'Stage9':>6}")
for focus, pat in TERMS.items():
    n6 = len(re.findall(pat, t6)); n9 = len(re.findall(pat, t9))
    flag = '  <-- never at Stage 6' if n6 == 0 else ''
    print(f'{focus[:52]:52} {n6:6} {n9:6}{flag}')
