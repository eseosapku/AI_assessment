"""How each dataset family reaches our topics (P3q): the subject, concepts, NEEDS and AVOID that the link rules apply,
as for a drawn family of the same kind. The band comes from the row's qualification.
"""
from __future__ import annotations

import types

M, B = "mathematics", "biology"
LINKS = {
    "math.trig_triangle": dict(subject=M, kind="maths.geometry",
                               concepts=["right-angled-triangles", "trigonometric-concepts", "sine-cosine-rules", "trigonometric-ratios-exact"],
                               needs=r"trigonometr|sine|cosine|tangent|right.angled|pythag|triangle|bearings",
                               avoid=r"graph|differentiat|integrat|identit|series|vector"),
    "math.transformation": dict(subject=M, kind="maths.coordinate",
                                concepts=["reflection-definition", "rotation-angle-centre", "rotation-introduction", "translation-definition",
                                          "enlargement-definition", "enlargement-locating-scale-factor", "position-transformation"],
                                needs=r"transformation|reflect|rotat|translat|enlarg|symmetr|position|similar",
                                avoid=r"bearings|matri|complex|linear transformation"),
    "math.vector": dict(subject=M, kind="maths.coordinate",
                        concepts=["column-vector-definition", "vectors-column-addition-subtraction", "vector-scalar-multiplication",
                                  "vectors-equivalent", "vectors"],
                        needs=r"vector", avoid=r"bearings|complex|space|eigen|plane|three dimensions"),
    "math.function_graph": dict(subject=M, kind="graph.line",
                                concepts=["linear-functions", "linear-equation-gradient-intercept", "functions-quadratic-graphs", "parabola",
                                          "quadratic-graphs-review", "cubic-polynomials-graphs-moduli", "curves-relationships"],
                                needs=r"graph|function|curve|sketch|polynomial|cubic|quadratic|linear|straight line|gradient",
                                avoid=r"differential|integrat|statistic|kinematic|travel"),
    "math.number_line": dict(subject=M, kind="maths.number",
                             concepts=["linear-inequalities-solving", "inequalities-forming-solving", "number-line", "compound-inequalities"],
                             needs=r"inequal|number line", avoid=r"region|quadratic|trigonometr|modulus"),
    "bio.cell": dict(subject=B, kind="diagram.template", concepts=["cell-structure", "animal-plant-cells"],
                     needs=r"\bcells?\b|cell structure|organelle|prokaryot|bacteri|microscop",
                     avoid=r"enzyme|genetic|inherit|immun|disease|reproduc|excretion|digest|respiration|nerv|hormon|cancer|division|mitosis"),
    "bio.leaf_section": dict(subject=B, kind="diagram.template", concepts=["leaf-internal-structure-photosynthesis"],
                             needs=r"leaf|leaves|photosynth|plant nutrition|plant tissue|transpiration|gas exchange in plants",
                             avoid=r"genetic|inherit|reproduc|ecolog|population"),
}


def family_of(row: dict, band: str):
    """A stand-in for a drawn family module, so `link.topics_for` applies the same rules."""
    spec = LINKS[row["family"]]
    return types.SimpleNamespace(ID=f"ds.{row['family']}", SUBJECT=spec["subject"], KIND=spec["kind"], BANDS=(band,),
                                 CONCEPTS=tuple(f"{spec['subject']}.{c}" for c in spec["concepts"]),
                                 NEEDS=spec.get("needs"), AVOID=spec.get("avoid"))
