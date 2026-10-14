"""How each dataset family reaches our topics (P3q): the subject, concepts, NEEDS and AVOID that the link rules apply,
as for a drawn family of the same kind. The band comes from the row's qualification.
"""
from __future__ import annotations

import types

M, B, C = "mathematics", "biology", "chemistry"
LINKS = {
    "math.trig_triangle": dict(subject=M, kind="maths.geometry",
                               concepts=["right-angled-triangles", "trigonometric-concepts", "sine-cosine-rules", "trigonometric-ratios-exact"],
                               needs=r"trigonometr|sine|cosine|tangent|right.angled|pythag|triangle|bearings",
                               avoid=r"graph|differentiat|integrat|identit|series|vector|convert between degrees|formulae, equations|lines, angles and shapes"),
    "math.transformation": dict(subject=M, kind="maths.coordinate",
                                concepts=["reflection-definition", "rotation-angle-centre", "rotation-introduction", "translation-definition",
                                          "enlargement-definition", "enlargement-locating-scale-factor", "position-transformation"],
                                needs=r"transformation|reflect|rotat|translat|enlarg|symmetr|position|similar",
                                avoid=r"bearings|matri|complex|linear transformation"),
    "math.vector": dict(subject=M, kind="maths.coordinate",
                        concepts=["column-vector-definition", "vectors-column-addition-subtraction", "vector-scalar-multiplication",
                                  "vectors-equivalent", "vectors"],
                        needs=r"vector", avoid=r"bearings|complex|space|eigen|plane|three dimensions|matri|equation of a line"),
    "math.function_graph": dict(subject=M, kind="graph.line",
                                concepts=["linear-functions", "linear-equation-gradient-intercept", "functions-quadratic-graphs", "parabola",
                                          "quadratic-graphs-review", "cubic-polynomials-graphs-moduli", "curves-relationships"],
                                needs=r"graph|function|curve|sketch|polynomial|cubic|quadratic|linear|straight line|gradient",
                                avoid=r"differentia|integrat|statistic|kinematic|travel|trigonometr|rational|solving equations of the type|modulus"),
    "math.number_line": dict(subject=M, kind="maths.number",
                             concepts=["linear-inequalities-solving", "inequalities-forming-solving", "number-line", "compound-inequalities"],
                             needs=r"inequal|number line", avoid=r"region|quadratic|trigonometr|modulus"),
    "bio.cell": dict(subject=B, kind="diagram.template", concepts=["cell-structure", "animal-plant-cells"],
                     needs=r"\bcells?\b|cell structure|organelle|prokaryot|bacteri|microscop",
                     avoid=r"enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|respiration|nerv|hormon|cancer|division|mitosis|mitotic|cycle|membrane|transport|movement into|protein synthesis"),
    "bio.leaf_section": dict(subject=B, kind="diagram.template", concepts=["leaf-internal-structure-photosynthesis"],
                             needs=r"leaf|leaves|photosynth|plant nutrition|plant tissue|transpiration|gas exchange in plants",
                             avoid=r"genetic|inherit|reproduc|ecolog|population"),
    # families we draw too: linked as ours are, by that family's concepts, NEEDS and AVOID
    "chem.titration_curve": dict(like="ph_curve"),
    "phys.decay_curve": dict(like="decay_graph"),
    "math.box_plot": dict(like="box_plot", avoid_extra=r"binomial|chi-squared|non-parametric|inferential|distribution"),
    "math.histogram": dict(like="histogram"),
    "math.scatter": dict(like="scatter_graph"),
    "phys.circuit": dict(like="circuit"),
    "chem.energy_profile": dict(like="energy_profile"),
    "bio.pedigree": dict(like="pedigree"),
    "chem.electron_shells": dict(like="electron_shells"),
    "math.inequality_region": dict(like="inequality_region", avoid_extra=r"quadratic|solving equations of the type|modulus"),
    "phys.motion_graph": dict(like="motion_graph", avoid_extra=r"harmonic|circular|projectile"),
    "math.cumulative_frequency": dict(like="cumulative_frequency",
                                      avoid_extra=r"binomial|chi-squared|non-parametric|inferential|distribution|types of data"),
    "bio.punnett": dict(like="punnett"),
    "math.construction": dict(subject=M, kind="maths.geometry", concepts=["constructing-angles", "construction-polygons-nets"],
                              needs=r"construct|loci|locus|bisect|compass|scale drawing",
                              avoid=r"algebra|expression|vector|transformation|statistic|probabil|trigonometr|graph|coordinate"),
    # concepts by the molecule's homologous series (MOLECULE_SERIES), so a halogenoalkane never reaches a topic on alcohols
    "chem.molecule": dict(subject=C, kind="chem.structure", concepts=["organic-functional-groups"],
                          needs=r"organic|hydrocarbon|alkane|alkene|alcohol|carboxylic|ester|carbonyl|aldehyde|ketone|amine|amide"
                                r"|nitrile|halogeno|acyl|homologous|isomer|functional group|skeletal|displayed",
                          avoid=r"ionic|electrolysis|equilibrium|\brates?\b|titration|metal|periodic|isotope|masses of atoms|polymer"
                                r"|analysis|spectr|chromatograph"),
}


MOLECULE_SERIES = {"Alkanes": ["alkanes"], "Alkenes": ["alkene-chemistry"], "Alcohols": ["alcohols"],
                   "Carboxylic acids": ["carboxylic-acids"], "Esters": ["esters"], "Aldehydes": ["aldehydes-and-ketones"],
                   "Ketones": ["aldehydes-and-ketones"], "Amines": ["amines"], "Halogenoalkanes": ["halogenoalkanes"],
                   "Nitriles": ["nitriles"], "Amides": ["amides"], "Acyl chlorides": ["acyl-chlorides"]}
# A topic that names another series and not the molecule's own teaches the other one: an alcohol is no figure for
# "Carbonyl compounds", nor an alkane for "Benzene".
SERIES_WORDS = {"Alkanes": r"\balkane", "Alkenes": r"\balkene", "Alcohols": r"\balcohol", "Carboxylic acids": r"carboxylic",
                "Esters": r"\bester", "Aldehydes": r"carbonyl|aldehyde", "Ketones": r"carbonyl|ketone", "Amines": r"\bamine",
                "Halogenoalkanes": r"halogeno|alkyl halide", "Nitriles": r"nitrile", "Amides": r"\bamide", "Acyl chlorides": r"\bacyl"}
OTHER_SERIES = "benzene|arene|phenol|" + "|".join(SERIES_WORDS.values())

# A function graph links by its own kind: a quadratic is no figure for rational functions.
GRAPH_KINDS = {"linear": ["linear-functions", "linear-equation-gradient-intercept", "intercepts"],
               "quadratic": ["functions-quadratic-graphs", "parabola", "quadratic-graphs-review", "quadratic-equations-graphical-method"],
               "cubic": ["cubic-polynomials-graphs-moduli", "curves-relationships"]}


def extra_bands(row: dict, band: str) -> tuple:
    """Bands a row also links at: the bisector constructions are taught at Lower Secondary before IGCSE (the triangle's
    cosine-rule question is IGCSE Extended, so it stays at its own band)."""
    if row["family"] == "math.construction" and band == "UP" and (row.get("params") or {}).get("kind") != "triangle_sss":
        return ("LS",)
    return ()


def family_of(row: dict, band: str):
    """A stand-in for a drawn family module, so `link.topics_for` applies the same rules."""
    spec = LINKS[row["family"]]
    if "like" in spec:
        from ..families import FAMILIES
        m = FAMILIES[spec["like"]]
        avoid = "|".join(x for x in (getattr(m, "AVOID", None), spec.get("avoid_extra")) if x) or None
        return types.SimpleNamespace(ID=f"ds.{row['family']}", SUBJECT=m.SUBJECT, KIND=m.KIND, BANDS=(band,), CONCEPTS=tuple(m.CONCEPTS),
                                     NEEDS=getattr(m, "NEEDS", None), AVOID=avoid)
    kind = (row.get("params") or {}).get("kind")
    if row["family"] == "math.function_graph" and kind in GRAPH_KINDS:
        spec = {**spec, "concepts": GRAPH_KINDS[kind]}
    if row["family"] == "chem.molecule":
        from .writers import series_of
        series = series_of(row["params"]["name"])
        if series:
            # its series only: the general organic concepts are mapped to every organic topic, halogenoalkanes included
            spec = {**spec, "concepts": MOLECULE_SERIES[series] + (["isomerism"] if "isomer" in row.get("subtopic_id", "") else []),
                    "avoid": f"{spec['avoid']}|^(?!.*(?:{SERIES_WORDS[series]})).*(?:{OTHER_SERIES})"}
        else:  # several groups: the general organic topics, not one series' topic
            spec = {**spec, "avoid": f"{spec['avoid']}|{OTHER_SERIES}"}
        if band == "AL":  # the A-level books map their organic chapters to mechanisms; "Representing organic molecules" is this
            spec = {**spec, "concepts": spec["concepts"] + ["chemical-formulae", "isomerism"]}
    return types.SimpleNamespace(ID=f"ds.{row['family']}", SUBJECT=spec["subject"], KIND=spec["kind"], BANDS=(band,),
                                 CONCEPTS=tuple(f"{spec['subject']}.{c}" for c in spec["concepts"]),
                                 NEEDS=spec.get("needs"), AVOID=spec.get("avoid"))
