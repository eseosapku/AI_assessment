"""How dataset families reach our topics (P3q): every family with a writer has a link profile, and a molecule links by
its homologous series, not to every organic topic."""
from figgen.dataset import concepts, writers


def row(family, subtopic="x", **params):
    return {"family": family, "subtopic_id": subtopic, "params": params}


def test_every_family_with_a_writer_has_a_link_profile():
    assert set(writers.WRITERS) <= set(concepts.LINKS)


def test_a_molecule_links_by_its_homologous_series():
    bromo = concepts.family_of(row("chem.molecule", name="bromoethane", smiles="CCBr"), "AL")
    assert "chemistry.halogenoalkanes" in bromo.CONCEPTS and "chemistry.alcohols" not in bromo.CONCEPTS
    ethanol = concepts.family_of(row("chem.molecule", name="ethanol", smiles="CCO"), "UP")
    assert "chemistry.alcohols" in ethanol.CONCEPTS and "chemistry.halogenoalkanes" not in ethanol.CONCEPTS
    # the general organic concepts are mapped to every organic topic, halogenoalkanes included
    assert "chemistry.organic-functional-groups" not in ethanol.CONCEPTS


def test_isomers_link_to_isomerism():
    m = concepts.family_of(row("chem.molecule", "chem.organic.hydrocarbons.alkanes_isomers", name="2-methylpropane",
                               smiles="CC(C)C"), "UP")
    assert {"chemistry.alkanes", "chemistry.isomerism"} <= set(m.CONCEPTS)


def test_a_molecule_with_several_groups_links_to_functional_groups_only():
    import re
    m = concepts.family_of(row("chem.molecule", name="prop-2-en-1-ol", smiles="C=CCO"), "UP")
    assert set(m.CONCEPTS) == {"chemistry.organic-functional-groups"}
    # so it goes to the general organic topics, not to one series' topic
    assert re.search(m.AVOID, "Benzene", re.I) and re.search(m.AVOID, "Halogenoalkanes (Alkyl Halides)", re.I)
    assert not re.search(m.AVOID, "Introduction to Organic Chemistry", re.I)


def test_a_bisector_construction_also_reaches_lower_secondary():
    # Cambridge and Rwanda teach these constructions before IGCSE; the triangle's cosine rule is IGCSE Extended
    assert concepts.extra_bands(row("math.construction", kind="angle_bisector"), "UP") == ("LS",)
    assert concepts.extra_bands(row("math.construction", kind="perp_from_point"), "UP") == ("LS",)
    assert concepts.extra_bands(row("math.construction", kind="triangle_sss"), "UP") == ()
    assert concepts.extra_bands(row("math.vector"), "UP") == ()


def test_a_molecule_avoids_topics_on_another_series():
    import re
    alcohol = concepts.family_of(row("chem.molecule", name="ethanol", smiles="CCO"), "UP")
    assert re.search(alcohol.AVOID, "Carbonyl Compounds: Aldehydes and Ketones", re.I)
    assert not re.search(alcohol.AVOID, "Alcohols and Ethers", re.I)
    assert not re.search(alcohol.AVOID, "Chapter 11: Organic chemistry", re.I)
    alkane = concepts.family_of(row("chem.molecule", name="2-methylpropane", smiles="CC(C)C"), "UP")
    assert re.search(alkane.AVOID, "Benzene", re.I) and re.search(alkane.AVOID, "Alkenes and Alkynes", re.I)
    ester = concepts.family_of(row("chem.molecule", name="ethyl ethanoate", smiles="CCOC(C)=O"), "UP")
    assert not re.search(ester.AVOID, "Esters, Acid Anhydrides, Amides and Nitriles", re.I)


def test_an_a_level_molecule_reaches_representing_organic_molecules():
    import re
    m = concepts.family_of(row("chem.molecule", name="bromoethane", smiles="CCBr"), "AL")
    assert {"chemistry.chemical-formulae", "chemistry.isomerism"} <= set(m.CONCEPTS)
    assert re.search(m.NEEDS, "Naming organic compounds", re.I)
    assert not any(re.search(m.NEEDS, s, re.I) for s in ("Chemical formulae and chemical equations", "From name to formula"))
