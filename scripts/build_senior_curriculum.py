# -*- coding: utf-8 -*-
"""
Replaces topics arrays for science/maths/geography subjects in grades 7-12
of lib/rwanda-curriculum.ts with real unit data extracted from REB textbooks.
Non-science subjects (English, History, ICT, Entrepreneurship, Kinyarwanda,
Computer Science, Economics, Literature in English) are preserved as-is.
"""
import re
import sys
import os

CURRICULUM_FILE = r'c:\Users\MSI\AI_Assessment\lib\rwanda-curriculum.ts'

# ─────────────────────────────────────────────────────────────────────────────
# Real unit data from REB senior class textbooks
# ─────────────────────────────────────────────────────────────────────────────

NEW_TOPICS = {
    # ── Grade 7 (S1) ──────────────────────────────────────────────────────────
    (7, 'Mathematics'): [
        'Unit 1: Sets',
        'Unit 2: Sets of Numbers',
        'Unit 3: Linear Functions and Equations',
        'Unit 4: Percentage, Discount and Financial Maths',
        'Unit 5: Ratio and Proportion',
        'Unit 6: Points, Lines and Angles',
        'Unit 7: Solids',
        'Unit 8: Statistics',
        'Unit 9: Probability',
    ],
    (7, 'Chemistry'): [
        'Unit 1: Chemistry and Society',
        'Unit 2: Laboratory Safety and Apparatus',
        'Unit 3: States and Changes of States of Matter',
        'Unit 4: Pure Substances and Mixtures',
        'Unit 5: Atoms, Elements and Compounds',
        'Unit 6: Arrangement of Elements in the Periodic Table',
        'Unit 7: Water and Its Composition',
        'Unit 8: Air, Composition and Pollution',
        'Unit 9: Waste Materials',
        'Unit 10: Chemical Equations',
        'Unit 11: Acids, Bases and pH',
        'Unit 12: Inorganic Salts and Their Properties',
        'Unit 13: Preparation of Oxygen and Its Properties',
    ],
    (7, 'Biology and Health Sciences'): [
        'Unit 1: Introduction to Biology',
        'Unit 2: Introduction to Classification',
        'Unit 3: External Structure and Importance of Plants',
        'Unit 4: Magnifying Instruments and Biological Drawings',
        'Unit 5: Plant and Animal Cells',
        'Unit 6: Levels of Organisation in Multicellular Organisms',
        'Unit 7: Food Nutrients and Diet',
        'Unit 8: Structure and Functions of Human Gas Exchange System',
        'Unit 9: Tropic Responses',
        'Unit 10: Skeletal Systems of Organisms',
        'Unit 11: Classification of Diseases',
        'Unit 12: Human Reproductive System',
        'Unit 13: Puberty and Sexual Maturation',
        'Unit 14: Reproduction, Pregnancy and Childbirth',
    ],
    (7, 'Geography and Environment'): [
        'Unit 1: Introduction to Geography',
        'Unit 2: Elements of a Map',
        'Unit 3: The Earth in Relation to the Universe',
        'Unit 4: The Structure of the Earth',
        'Unit 5: Forms of Relief',
        'Unit 6: Rocks',
        'Unit 7: Soils',
        'Unit 8: Weather and Climate',
        'Unit 9: Vegetation',
        'Unit 10: General Organisation of Hydrography',
        'Unit 11: Hazards',
        'Unit 12: Population and Settlement',
        'Unit 13: Economic Activities',
    ],
    # ── Grade 8 (S2) ──────────────────────────────────────────────────────────
    (8, 'Mathematics'): [
        'Unit 1: Indices and Surds',
        'Unit 2: Polynomials',
        'Unit 3: Simultaneous Linear Equations and Inequalities',
        'Unit 4: Multiplier for Proportional Change',
        "Unit 5: Thales' Theorem",
        "Unit 6: Pythagoras' Theorem",
        'Unit 7: Vectors',
        'Unit 8: Parallel and Orthogonal Projection',
        'Unit 9: Isometries',
        'Unit 10: Statistics (Grouped Data)',
        'Unit 11: Tree and Venn Diagrams and Sample Space',
    ],
    (8, 'Physics'): [
        'Unit 1: Sources of Errors in Measurement of Physical Quantities',
        'Unit 2: Quantitative Analysis of Linear Motion',
        'Unit 3: Frictional Force',
        'Unit 4: Density and Pressure in Solids and Fluids',
        'Unit 5: Measuring Liquid Pressure with a Manometer',
        "Unit 6: Application of Pascal's Principle",
        "Unit 7: Archimedes' Principle and Atmospheric Pressure",
        'Unit 8: Work, Power and Energy',
        'Unit 9: Conservation of Mechanical Energy in Isolated System',
        "Unit 10: Gas Laws' Experiments",
        'Unit 11: Magnetization and Demagnetization',
        'Unit 12: Applications of Electrostatics',
        'Unit 13: Arrangement of Resistors in an Electric Circuit',
        'Unit 14: Reflection of Light in Curved Mirrors',
        'Unit 15: Basic Electronic Components',
    ],
    (8, 'Chemistry'): [
        'Unit 1: Chemical Bonding',
        'Unit 2: Trends in Properties of Elements in the Periodic Table',
        'Unit 3: Water Pollution',
        'Unit 4: Effective Ways of Waste Management',
        'Unit 5: Categories of Chemical Reactions',
        'Unit 6: Preparation of Salts and Identification of Ions',
        'Unit 7: The Mole Concept and Gas Laws',
        'Unit 8: Preparation and Classification of Oxides',
        'Unit 9: Electrolytes and Non-electrolytes',
        'Unit 10: Properties of Organic Compounds',
    ],
    (8, 'Biology and Health Sciences'): [
        'Unit 1: Classification of Kingdom Animalia',
        'Unit 2: Introduction to Environmental Biology',
        'Unit 3: Passive Movement of Substances Across a Cell Membrane',
        'Unit 4: Active Transport',
        'Unit 5: Identification of Food Components',
        'Unit 6: Enzymes',
        'Unit 7: Photosynthesis',
        'Unit 8: Transport of Water, Minerals and Organic Foods in Plants',
        'Unit 9: Gaseous Exchange in Humans and Plants',
        'Unit 10: Excretion in Humans',
        'Unit 11: Joints and Movement',
        'Unit 12: Infectious Diseases',
        'Unit 13: Immunity and Vaccination',
        'Unit 14: Sexual Behaviour and Sexual Response',
        'Unit 15: Pregnancy Prevention',
        'Unit 16: Reducing Risk of STIs, HIV and AIDS',
    ],
    (8, 'Geography and Environment'): [
        'Unit 1: Map Work Interpretation',
        'Unit 2: Types of Photographs',
        'Unit 3: Interpretation of Photographs and Video Images',
        'Unit 4: Tectonic Processes',
        'Unit 5: External Landform Processes',
        'Unit 6: Relief in Rwanda',
        'Unit 7: Weathering and Rocks',
        'Unit 8: Soils in Rwanda',
        'Unit 9: Climate and Climate Change in Rwanda',
        'Unit 10: Vegetation in Rwanda',
        'Unit 11: Drainage System in Rwanda',
        'Unit 12: Environmental Conservation in Rwanda',
        'Unit 13: Population in Rwanda',
        'Unit 14: Rural and Urban Settlement in Rwanda',
        'Unit 15: Agricultural Systems in Rwanda',
        'Unit 16: Forestry in Rwanda',
        'Unit 17: Fishing and Fish Farming in Rwanda',
        'Unit 18: Mining and Quarrying in Rwanda',
        'Unit 19: Power and Energy in Rwanda',
        'Unit 20: Industry in Rwanda',
        'Unit 21: Transport, Communication and Trade in Rwanda',
        'Unit 22: Tourism in Rwanda',
    ],
    # ── Grade 9 (S3) ──────────────────────────────────────────────────────────
    (9, 'Chemistry'): [
        'Unit 1: Carbon and Its Inorganic Compounds',
        'Unit 2: Nitrogen and Its Inorganic Compounds',
        'Unit 3: Sulphur and Its Inorganic Compounds',
        'Unit 4: Chlorine and Its Inorganic Compounds',
        'Unit 5: Rate of Reactions',
        'Unit 6: Chemical Properties of Acids and Bases',
        'Unit 7: Concentration of Solutions',
        'Unit 8: Electrolysis and Its Applications',
        'Unit 9: Structure and Properties of Alkenes and Alcohols',
        'Unit 10: Carboxylic Acids',
        'Unit 11: Petroleum Products and Polymerisation',
    ],
    (9, 'Biology and Health Sciences'): [
        'Unit 1: Interdependence Among Organisms in an Ecosystem',
        'Unit 2: Population Size',
        'Unit 3: Nutrient Cycles',
        'Unit 4: Effects of Human Activities on Ecosystems 1',
        'Unit 5: Effects of Human Activities on Ecosystems 2',
        'Unit 6: Mitosis and Meiosis',
        'Unit 7: Heterotrophic Nutrition',
        'Unit 8: Circulatory System in Humans',
        'Unit 9: Cellular Respiration',
        'Unit 10: Skin and Homeostatic Mechanisms',
        'Unit 11: Response and Coordination in Plants',
        'Unit 12: Response and Coordination in Animals',
        'Unit 13: Asexual and Sexual Reproduction',
        'Unit 14: Sexual Reproduction in Flowering Plants',
        'Unit 15: Reproduction in Human Beings',
        'Unit 16: Social Factors That Affect Good Health',
        'Unit 17: Decision-Making Regarding Sexual Relationships',
        'Unit 18: HIV and AIDS (Stigma, Treatment, Care and Support)',
        'Unit 19: Sexual Behaviour and Sexual Response',
        'Unit 20: Genetics',
        'Unit 21: Gene Technology',
        'Unit 22: Variation and Adaptive Features',
        'Unit 23: Natural and Artificial Selection',
    ],
    (9, 'Geography and Environment'): [
        'Unit 1: Map Work Interpretation',
        'Unit 2: Relief in Africa and the World',
        'Unit 3: Soils in Africa and the World',
        'Unit 4: Climate in Africa and the World',
        'Unit 5: Vegetation of Africa and the World',
        'Unit 6: Drainage in Africa',
        'Unit 7: Environmental Conservation',
        'Unit 8: Population in Africa',
        'Unit 9: Urban Settlement in Africa',
        'Unit 10: Agricultural Systems in Africa',
        'Unit 11: Forestry in Africa',
        'Unit 12: Fishing in Africa',
        'Unit 13: Mining in Africa',
        'Unit 14: Power and Energy in Africa',
        'Unit 15: Industrial Development in Africa',
        'Unit 16: Transport, Communication and Trade',
        'Unit 17: Tourism in Africa',
        'Unit 18: Development Case Studies',
    ],
    # ── Grade 10 (S4) ─────────────────────────────────────────────────────────
    (10, 'Mathematics'): [
        'Unit 1: Fundamentals of Trigonometry',
        'Unit 2: Propositional and Predicate Logic',
        'Unit 3: Binary Operations',
        'Unit 4: Sets',
        'Unit 5: Linear Equations and Inequalities',
        'Unit 6: Quadratic Equations and Inequalities',
        'Unit 7: Polynomial, Rational and Irrational Functions',
        'Unit 8: Limits of Polynomial, Rational and Irrational Functions',
        'Unit 9: Differentiation of Polynomials, Rational and Irrational Functions',
        'Unit 10: Vector Space of Real Numbers',
        'Unit 11: Concepts and Operations on Linear Transformations in 2D',
        'Unit 12: Matrices and Determinants of Order 2',
        'Unit 13: Points, Straight Lines and Circles in 2D',
        'Unit 14: Measures of Dispersion',
        'Unit 15: Combinatorics',
        'Unit 16: Elementary Probability',
    ],
    (10, 'Physics'): [
        'Unit 1: Thin Lenses',
        'Unit 2: Simple and Compound Optical Instruments',
        'Unit 3: Moments and Equilibrium of Bodies',
        'Unit 4: Work, Energy and Power',
        "Unit 5: Kirchhoff's Laws and Electric Circuits",
        'Unit 6: Sources of Energy in the World',
        'Unit 7: Energy Degradation and Power Generation',
        'Unit 8: Projectile and Uniform Circular Motion',
        'Unit 9: Universal Gravitational Field Potential',
        'Unit 10: Effects of Electric and Potential Fields',
        'Unit 11: Application of Thermodynamics Laws',
        'Unit 12: General Structure of the Solar System',
    ],
    (10, 'Chemistry'): [
        'Unit 1: Structure of an Atom and Mass Spectrum',
        'Unit 2: Electronic Configuration of Atoms and Ions',
        'Unit 3: Formation of Ionic and Metallic Bonds',
        'Unit 4: Covalent Bond and Molecular Structure',
        'Unit 5: Variation in Trends of Physical Properties of Transition Elements',
        'Unit 6: Trends in Chemical Properties of Group 1 Elements',
        'Unit 7: Trends in Chemical Properties of Group 2 Elements',
        'Unit 8: Trends of Chemical Properties of Group 13 Elements',
        'Unit 9: Trends in Chemical Properties of Group 14 Elements',
        'Unit 10: Trends in Chemical Properties of Group 15 Elements',
        'Unit 11: Trends of Chemical Properties of Group 16 Elements',
        'Unit 12: Trends of Chemical Properties of Group 17 Elements',
        'Unit 13: Properties and Uses of Group 18 Elements',
        'Unit 14: Trends in Chemical Properties of Period 3 Elements',
        'Unit 16: Acids and Bases',
        'Unit 18: Energy Changes and Energy Profile Diagrams',
    ],
    (10, 'Biology'): [
        'Unit 1: Introduction to Biodiversity',
        'Unit 2: Introduction to Classification',
        'Unit 3: Microscopy',
        'Unit 4: Cell Structure and Specialization',
        'Unit 5: Diversity of Specialized Tissues',
        'Unit 6: Testing for Biological Molecules',
        'Unit 7: Carbohydrates and Lipids',
        'Unit 8: Proteins and Water',
        'Unit 9: Vitamins and Minerals',
        'Unit 10: Enzymes',
        'Unit 11: Principles of Gas Exchange Systems',
        'Unit 12: Gas Exchange in Plants',
        'Unit 13: Growth and Development in Plants and Animals',
        'Unit 14: Support and Locomotion',
        'Unit 15: Classification and Patterns of Disease',
        'Unit 16: Asexual Reproduction in Plants',
        'Unit 17: Sexual Reproduction in Plants',
        'Unit 18: Microbiology',
        'Unit 19: Culturing Micro-organisms',
        'Unit 20: Biotechnology and Its Application',
    ],
    # ── Grade 11 (S5) ─────────────────────────────────────────────────────────
    (11, 'Mathematics'): [
        'Unit 1: Trigonometric Formulae, Equations and Inequalities',
        'Unit 2: Sequences',
        'Unit 3: Logarithmic and Exponential Equations',
        'Unit 4: Solving Equations by Numerical Method',
        'Unit 5: Trigonometric Functions and Their Inverses',
        'Unit 6: Vector Space of Real Numbers',
        'Unit 7: Matrices and Determinant of Order 3',
        'Unit 8: Points, Straight Lines, Planes and Sphere in 3D',
        'Unit 9: Bivariate Statistics',
        'Unit 10: Conditional Probability and Bayes Theorem',
    ],
    (11, 'Physics'): [
        'Unit 1: Wave and Particle Nature of Light',
        'Unit 2: Simple Harmonic Motion',
        'Unit 3: Forced Oscillations and Resonance of a System',
        'Unit 4: Propagation of Mechanical Waves',
        'Unit 5: Complex Electrical Circuit',
        'Unit 6: Fossil and Non-Fossil Fuel and Power Production',
        'Unit 7: Electric Field Potential and Gravitational Potential',
        'Unit 8: Motion in Orbits',
        'Unit 9: Atomic Models and Photoelectric Effect',
        'Unit 10: Analog and Digital Signals',
        'Unit 11: Mobile Phone and Radio Communication',
        'Unit 12: Relativity Concepts and Postulates of Special Relativity',
        'Unit 13: Interference of Light Waves',
        'Unit 14: Stellar Distance and Radiation',
    ],
    (11, 'Chemistry'): [
        'Unit 1: Introduction to Organic Chemistry',
        'Unit 2: Alkanes',
        'Unit 3: Alkenes and Alkynes',
        'Unit 4: Halogenoalkanes (Alkyl Halides)',
        'Unit 5: Alcohols and Ethers',
        'Unit 6: Carbonyl Compounds: Aldehydes and Ketones',
        'Unit 7: Carboxylic Acids and Acyl Chlorides',
        'Unit 8: Esters, Acid Anhydrides, Amides and Nitriles',
        'Unit 9: Amines and Amino Acids',
        'Unit 10: Phase Diagrams',
        'Unit 11: Solutions and Titration',
        'Unit 12: Conductivity of Solutions',
        'Unit 13: Electrolysis',
        'Unit 14: Enthalpy Change of Reactions',
        'Unit 15: Entropy and Free Energy',
    ],
    (11, 'Biology'): [
        'Unit 1: Interdependence Between Organisms Within Their Habitat',
        'Unit 2: Transport Across the Cell Membrane',
        'Unit 3: Chromosomes and Nucleic Acids',
        'Unit 4: DNA Replication',
        'Unit 5: Cell and Nuclear Division',
        'Unit 6: Protein Synthesis',
        'Unit 7: Autotrophic Nutrition',
        'Unit 8: Transport System in Plants',
        'Unit 9: Gas Exchange in Animals',
        'Unit 10: Smoking and Related Diseases',
        'Unit 11: General Principles of Homeostasis',
        'Unit 12: Regulation of Glucose',
        'Unit 13: Regulation of Temperature',
        'Unit 14: Behaviour and Responses in Mammals',
        'Unit 15: Immune System, Vaccination and Antibiotics',
        'Unit 16: Human Reproductive System and Gametogenesis',
        'Unit 17: Genetics',
        'Unit 18: Mutations',
    ],
    (11, 'Geography'): [
        'Unit 1: Statistical Graphs, Diagrams and Maps',
        'Unit 2: Bearings, Directions, Distances and Scales',
        'Unit 3: Map Work Interpretation',
        'Unit 4: The Universe and the Solar System',
        'Unit 5: The Origin of the Earth',
        'Unit 6: Internal Landform Processes',
        'Unit 7: Soils',
        'Unit 8: Weather and Climate of the World',
        'Unit 9: Natural Vegetation of the World',
        'Unit 10: Population Growth in the World',
        'Unit 11: Urbanisation in the World',
        'Unit 12: Agriculture in the World',
        'Unit 13: Forestry in the World',
        'Unit 14: Fishing in the World',
        'Unit 15: Mining in the World',
    ],
    # ── Grade 12 (S6) ─────────────────────────────────────────────────────────
    (12, 'Mathematics'): [
        'Unit 1: Complex Numbers',
        'Unit 2: Logarithmic and Exponential Functions',
        "Unit 3: Taylor and Maclaurin's Expansions",
        'Unit 4: Integration',
        'Unit 5: Differential Equations',
        'Unit 6: Intersection and Sum of Subspaces',
        'Unit 7: Transformation of Matrices',
        'Unit 8: Conics',
        'Unit 9: Random Variables',
    ],
    (12, 'Physics'): [
        'Unit 1: Sound Waves',
        'Unit 2: Climate Change and Greenhouse Effect',
        'Unit 3: Application of Physics in Agriculture',
        'Unit 4: Earthquakes, Landslides, Tsunami, Floods and Volcanoes',
        'Unit 5: Atomic Nuclei and Radioactive Decay',
        'Unit 6: Applications of Optical Fiber in Telecommunication',
        'Unit 7: Block Diagram of Telecommunication',
        'Unit 8: Nature of Particles and Their Interactions',
        'Unit 9: Properties and Basic Principles of Quarks',
        'Unit 11: Effect of Laser',
        'Unit 12: Medical Imaging',
        'Unit 13: Radiations and Medicine',
        'Unit 14: Cosmology, Galaxies and Expansion of Universe',
    ],
    (12, 'Chemistry'): [
        'Unit 1: Properties and Uses of Transition Metals',
        'Unit 2: Extraction of Metals',
        'Unit 3: NPK as Components of Fertilizers',
        'Unit 4: Benzene',
        'Unit 5: Derivatives of Benzene',
        'Unit 6: Polymers and Polymerization',
        'Unit 7: Solvent Extraction and Colligative Properties',
        'Unit 8: Quantitative Chemical Equilibrium',
        'Unit 9: pH of Acidic and Alkaline Solutions',
        'Unit 10: Indicators and Titration Curves',
        'Unit 11: Solubility and Solubility Product of Sparingly Soluble Salts',
        'Unit 12: Electrochemical Cell and Applications',
        'Unit 13: Factors That Affect the Rate of Reactions',
        'Unit 14: Rate Laws and Measurements',
        'Unit 15: Radioactivity',
    ],
    (12, 'Biology'): [
        'Unit 1: Population and Natural Resources',
        'Unit 2: Concept of Ecosystem',
        'Unit 3: Effect of Human Activities on Ecosystem',
        'Unit 4: The Circulatory System',
        'Unit 5: Energy from Respiration',
        'Unit 6: Cellular Respiration',
        'Unit 7: Excretion and Osmoregulation',
        'Unit 8: General Principles of Reception and Response in Animals',
        'Unit 9: Nervous Coordination',
        'Unit 10: Hormonal Coordination in Animals',
        'Unit 11: Skeletons, Muscles and Movement',
        'Unit 12: Human Reproduction',
        'Unit 13: Principles of Gene Technology',
        'Unit 14: Application of Gene Technology',
        'Unit 15: Variation',
        'Unit 16: Natural and Artificial Selection',
        'Unit 17: Evolution and Speciation',
    ],
    (12, 'Geography'): [
        'Unit 1: Cross Sections and Sketch Maps',
        'Unit 2: Interpretation of Photographs and Video Images',
        'Unit 3: The Origin and Distribution of the Continents',
        'Unit 4: External Landform Processes and Related Features',
        'Unit 5: Wave Erosion and Deposition',
        'Unit 6: Rocks and Minerals',
        'Unit 7: Classification of Soils and Soil Formation',
        'Unit 8: Climate Change',
        'Unit 9: Global Drainage Systems',
        'Unit 10: Power and Energy Production in the World',
        'Unit 11: Industrialization in the World',
        'Unit 12: Transport and Communication in the World',
        'Unit 13: Trade and Commerce in the World',
        'Unit 14: World Multipurpose River Projects',
        'Unit 15: Environmental Conservation and Tourism',
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Targeted replacement: parse line-by-line and swap topics arrays
# ─────────────────────────────────────────────────────────────────────────────

def escape_for_ts(s: str) -> str:
    """Escape apostrophes inside single-quoted TS string literals."""
    return s.replace("'", "\\'")


def topics_block(topics: list[str], indent: str = '          ') -> str:
    lines = []
    for t in topics:
        lines.append(f"{indent}'{escape_for_ts(t)}',")
    return '\n'.join(lines)


def process_file(path: str) -> str:
    with open(path, encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    result = []

    current_grade: int | None = None
    current_subject: str | None = None
    inside_topics = False
    skip_until_bracket = False  # skip old topic lines until we hit ],

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Track grade changes  (e.g.  "  7: {")
        grade_match = re.match(r'^\s+(\d+):\s*\{', line)
        if grade_match:
            current_grade = int(grade_match.group(1))
            current_subject = None
            inside_topics = False
            skip_until_bracket = False
            result.append(line)
            i += 1
            continue

        # Track subject name  (e.g.   name: 'Mathematics',)
        subject_match = re.match(r"^\s+name:\s+'([^']+)'", line)
        if subject_match and not inside_topics:
            current_subject = subject_match.group(1)
            result.append(line)
            i += 1
            continue

        # Detect start of topics array
        if stripped == 'topics: [' and not inside_topics:
            key = (current_grade, current_subject)
            if key in NEW_TOPICS:
                # Emit topics: [ with new content, then ],
                result.append(line)  # the "topics: [" line
                # Determine indent from the topics line
                indent = ' ' * (len(line) - len(line.lstrip()) + 2)
                result.append(topics_block(NEW_TOPICS[key], indent))
                # Now skip old topic lines until we see ],
                skip_until_bracket = True
                inside_topics = True
                i += 1
                continue
            else:
                inside_topics = True  # track but don't replace
                result.append(line)
                i += 1
                continue

        # While skipping old topics, look for the closing ],
        if skip_until_bracket:
            if stripped.startswith('],'):
                result.append(line)  # emit the ],
                skip_until_bracket = False
                inside_topics = False
                i += 1
                continue
            else:
                # skip this line (old topic entry)
                i += 1
                continue

        # Normal end of topics block (no replacement)
        if inside_topics and stripped.startswith('],'):
            inside_topics = False
            result.append(line)
            i += 1
            continue

        result.append(line)
        i += 1

    return '\n'.join(result)


if __name__ == '__main__':
    updated = process_file(CURRICULUM_FILE)
    with open(CURRICULUM_FILE, 'w', encoding='utf-8') as f:
        f.write(updated)
    print('Done. Senior curriculum updated.')
