"""Checks every drawn family must pass, whatever it draws."""
import random
import xml.etree.ElementTree as ET

import pytest

from figgen.core import render
from figgen.families import FAMILIES

FIGURE_KINDS = {
    "graph.line", "graph.bar", "graph.pie", "graph.scatter", "graph.stats", "table.data", "maths.number",
    "maths.geometry", "maths.coordinate", "maths.measure", "maths.solid", "maths.probability", "physics.circuit",
    "physics.ray", "physics.force", "physics.wave", "physics.field", "instrument.reading", "chem.structure",
    "chem.particle", "chem.energy", "chem.chromatogram", "bio.genetics", "bio.ecology", "bio.key", "diagram.template",
    "process.flow", "geo.map", "geo.climate", "geo.section", "timeline", "cs.logic", "cs.structure", "cs.code",
    "econ.curve", "business.document", "text.notice", "music.notation",
}
SEEDS = range(1, 61)


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_declares_a_known_kind_and_levels(fid):
    m = FAMILIES[fid]
    assert m.ID == fid
    assert m.KIND in FIGURE_KINDS
    assert m.BANDS and set(m.BANDS) <= {"P", "LS", "UP", "AL"}


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_same_seed_same_figure(fid):
    m = FAMILIES[fid]
    assert m.sample(random.Random(7)) == m.sample(random.Random(7))


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_questions_are_well_formed(fid):
    m = FAMILIES[fid]
    for seed in SEEDS:
        rng = random.Random(seed)
        p = m.sample(rng)
        qs = m.questions(p, rng)
        assert qs, f"{fid} seed {seed}: no questions"
        for q in qs:
            assert q.stem.strip() and q.kind in ("mcq", "short")
            if q.kind == "mcq":
                assert len(q.options) >= 3, f"{fid} seed {seed}: only {q.options}"
                assert len(set(q.options)) == len(q.options), f"{fid} seed {seed}: repeated options {q.options}"
                assert 0 <= int(q.answer) < len(q.options)
            else:
                assert q.answer and q.accepted[0] == q.answer
                assert len(q.answer) <= 40, f"{fid}: a short answer must be short, not {q.answer!r}"


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_figures_vary_from_seed_to_seed(fid):
    m = FAMILIES[fid]
    # The person in the question is not part of the figure: the same numbers under another name
    # are the same figure (generate.py stores it once).
    specs = {repr({k: v for k, v in m.sample(random.Random(s)).items() if k != "name"}) for s in SEEDS}
    need = getattr(m, "MIN_VARIETY", 40)
    assert len(specs) >= need, f"{fid}: only {len(specs)} different figures in {len(SEEDS)} seeds"


@pytest.mark.parametrize("fid", sorted(FAMILIES))
def test_renders_valid_svg_and_png(fid):
    m = FAMILIES[fid]
    for seed in (1, 2, 3):
        r = render(m.draw(m.sample(random.Random(seed))))
        ET.fromstring(r.svg)  # well-formed
        assert r.png[:8] == b"\x89PNG\r\n\x1a\n" and len(r.png) > getattr(m, "MIN_PNG_BYTES", 2000)


WORDED_SUBJECTS = {"mathematics"}  # waves done; each later wave adds its subject
WORDED = sorted(f for f, m in FAMILIES.items() if m.SUBJECT in WORDED_SUBJECTS)


@pytest.mark.parametrize("fid", WORDED)
def test_most_figures_have_a_wording_of_their_own(fid):
    """The quiz route removes a repeated wording, figure or not (P2a): a family whose figures all
    ask "What is the median?" gives one figure a quiz. Of 30 figures, 27 must each carry a stem
    no other of the 30 has."""
    m = FAMILIES[fid]
    stems = []
    for seed in range(1, 31):
        rng = random.Random(seed)
        stems.append({q.stem for q in m.questions(m.sample(rng), rng)})
    own = sum(1 for i, s in enumerate(stems) if s - set().union(*(t for j, t in enumerate(stems) if j != i)))
    assert own >= 27, f"{fid}: only {own} of 30 figures have a wording of their own"


@pytest.mark.parametrize("fid", WORDED)
def test_declares_its_concepts(fid):
    m = FAMILIES[fid]
    assert m.CONCEPTS and all(c.startswith(f"{m.SUBJECT}.") for c in m.CONCEPTS)
