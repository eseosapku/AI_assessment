/**
 * University Curriculum (standards-informed pilot)
 *
 * Year counts per programme:
 *   Medicine              – 6 years (MBBS/MBChB) — WFME BME 2020, Sudan Medical Council, WHO
 *   Nursing               – 4 years (BSc Nursing) — NMC Standards Framework, WHO
 *   Pharmacy              – 5 years (BPharm)      — FIP Education Standards, WHO/FIP
 *   Computer Science      – 4 years (BSc CS)      — ACM CS2023, IEEE-CS
 *   Business Administration – 4 years (BBA)       — AACSB accreditation standards
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoursePedagogyProfile {
  competencyDomains: string[]
  assessmentPatterns: string[]
  generationGuidance: string[]
}

export interface UniversityCourseYear {
  label: string
  description: string
  topics: string[]
}

export interface UniversityCourseDefinition {
  name: string
  degree: string
  totalYears: number
  pedagogy: CoursePedagogyProfile
  yearProgressionGuide: Record<number, string>
  years: Record<number, UniversityCourseYear>
}

// ── Course catalogue ──────────────────────────────────────────────────────────

export const UNIVERSITY_COURSES: Record<string, UniversityCourseDefinition> = {

  // ──────────────────────────── MEDICINE ──────────────────────────────────────
  Medicine: {
    name: 'Medicine',
    degree: 'MBBS / MBChB',
    totalYears: 6,
    pedagogy: {
      competencyDomains: [
        'Biomedical sciences and clinical knowledge integration',
        'Clinical reasoning, diagnosis and differential diagnosis',
        'Patient safety, rational prescribing and medical ethics',
        'Practical clinical skills and procedural competence',
        'Communication, professionalism and interprofessional collaboration',
      ],
      assessmentPatterns: [
        'Single-best-answer clinical vignettes (SBA)',
        'Case progression questions (history → investigation → diagnosis → management)',
        'OSCE-style applied prompts for long-form questions',
        'Mechanism-based short answers (pharmacology, pathophysiology)',
      ],
      generationGuidance: [
        'Prefer patient-context scenarios over rote anatomical or biochemical definitions',
        'Require explicit clinical justification in advanced questions',
        'Use safety-first framing in drug therapy and emergency questions',
        'Increase clinical complexity and ambiguity with each year level',
      ],
    },
    yearProgressionGuide: {
      1: 'Pre-clinical I: master foundational biomedical sciences — anatomy, physiology, biochemistry',
      2: 'Pre-clinical II: extend into para-clinical sciences — pathology, microbiology, pharmacology foundations',
      3: 'Para-clinical to early clinical: bridge sciences to patient presentations and clinical skills',
      4: 'Clinical I: apply knowledge to systemic disease management across major specialties',
      5: 'Clinical II: advanced specialty rotations, complex case management and critical appraisal',
      6: 'Internship/Housemanship: transition-to-practice, licensing readiness and integrated clinical decision-making',
    },
    years: {
      1: {
        label: 'Year 1 — Pre-clinical I',
        description: 'Foundational biomedical sciences',
        topics: [
          'Gross Anatomy I: Upper and Lower Limbs, Back and Spine',
          'Gross Anatomy II: Thorax, Abdomen, Pelvis and Perineum',
          'Histology and Embryology: Cell Biology and Tissue Classification',
          'Physiology I: Membrane Transport, Haematology and Cardiovascular System',
          'Physiology II: Respiratory, Renal and Gastrointestinal Physiology',
          'Biochemistry I: Biomolecules, Enzymes and Metabolic Pathways',
          'Medical Ethics, Professionalism and Healthcare Communication',
        ],
      },
      2: {
        label: 'Year 2 — Pre-clinical II',
        description: 'Para-clinical sciences and introduction to clinical skills',
        topics: [
          'Neuroanatomy and Head and Neck Anatomy',
          'Physiology III: Endocrine, Reproductive and Nervous System Physiology',
          'Biochemistry II: Molecular Biology, Genetics and Metabolic Disease',
          'General Pathology: Cell Injury, Inflammation, Repair and Neoplasia',
          'Medical Microbiology: Bacteriology, Virology and Mycology',
          'Medical Parasitology and Tropical Infectious Diseases',
          'Introduction to Clinical Skills: History Taking and Physical Examination',
        ],
      },
      3: {
        label: 'Year 3 — Para-clinical and Early Clinical',
        description: 'Applied sciences with structured patient contact',
        topics: [
          'Systemic Pathology: Cardiovascular, Respiratory and Gastrointestinal Systems',
          'Pharmacology I: General Principles, Autonomic Nervous System and Cardiovascular Drugs',
          'Community Medicine, Epidemiology and Biostatistics',
          'Clinical Medicine I: Cardiovascular and Respiratory Assessment and Examination',
          'General Surgery I: Surgical Principles, Asepsis and Acute Surgical Emergencies',
          'Obstetrics I: Normal Pregnancy, Labour and Puerperium',
          'Paediatrics I: Growth, Development and Common Childhood Illnesses',
        ],
      },
      4: {
        label: 'Year 4 — Clinical I',
        description: 'Structured clinical rotations across major specialties',
        topics: [
          'Clinical Medicine II: Endocrine, Renal, Haematological and Neurological Disorders',
          'Pharmacology II: CNS, Antimicrobial and Endocrine Pharmacology',
          'General Surgery II: Gastrointestinal, Urological and Surgical Oncology',
          'Obstetrics and Gynaecology II: Obstetric Complications and Gynaecological Disorders',
          'Paediatrics II: Neonatology, Infectious Diseases and Nutritional Disorders',
          'Psychiatry and Mental Health: Diagnosis, Management and Psychopharmacology',
          'Ophthalmology and Ear, Nose and Throat (ENT) Medicine',
        ],
      },
      5: {
        label: 'Year 5 — Clinical II',
        description: 'Advanced specialty rotations and pre-finals consolidation',
        topics: [
          'Emergency Medicine and Critical Care: Triage, Resuscitation and ICU Principles',
          'Orthopaedics and Trauma Surgery: Fractures, Dislocations and Musculoskeletal Injury',
          'Dermatology and Sexually Transmitted Infections',
          'Clinical Pharmacology and Rational Prescribing: Evidence-Based Drug Therapy',
          'Medical Research Methods and Evidence-Based Medicine: Critical Appraisal',
          'Elective Clinical Rotation and Special Study Module',
          'Final Professional Examination Preparation: Integrated Case-Based Review',
        ],
      },
      6: {
        label: 'Year 6 — Internship / Housemanship',
        description: 'Supervised transition-to-practice and licensing examination',
        topics: [
          'Clinical Internship: Internal Medicine — Ward Management and Case Conferences',
          'Clinical Internship: General Surgery — Perioperative Care and Operative Exposure',
          'Clinical Internship: Obstetrics and Gynaecology — Deliveries and Gynaecological Procedures',
          'Clinical Internship: Paediatrics and Child Health — Neonatal and Paediatric Ward',
          'Clinical Internship: Community and Primary Care — Health Centre and Outreach',
          'Sudan Medical Council Licensing Examination and Professional Registration',
        ],
      },
    },
  },

  // ──────────────────────────── NURSING ───────────────────────────────────────
  Nursing: {
    name: 'Nursing',
    degree: 'BSc Nursing',
    totalYears: 4,
    pedagogy: {
      competencyDomains: [
        'Safe, compassionate and person-centred nursing care',
        'Health promotion, disease prevention and patient education',
        'Clinical assessment, care planning and evidence-based intervention',
        'Leadership, teamwork, delegation and professional accountability',
        'Quality improvement, patient safety and regulatory compliance',
      ],
      assessmentPatterns: [
        'Prioritisation and delegation scenario questions',
        'Care-plan construction and nursing process questions',
        'Medication safety, dose calculation and drug administration items',
        'Structured long-form: SBAR handover, patient education plan',
      ],
      generationGuidance: [
        'Use realistic ward, community and emergency-room clinical contexts',
        'Assess judgment, escalation and patient-centred decision-making',
        'Include interprofessional and continuity-of-care angles',
        'Link pharmacology to nursing administration, monitoring and patient counselling',
      ],
    },
    yearProgressionGuide: {
      1: 'Foundation: establish basic sciences, fundamental nursing skills and professional values',
      2: 'Core clinical: apply nursing process to adult medical-surgical, maternal and mental health settings',
      3: 'Specialised nursing: integrate advanced skills across paediatric, community and complex care contexts',
      4: 'Advanced practice: demonstrate leadership, research application and readiness for registered practice',
    },
    years: {
      1: {
        label: 'Year 1 — Foundation',
        description: 'Biological sciences and fundamental nursing practice',
        topics: [
          'Anatomy and Physiology I: Musculoskeletal, Cardiovascular and Respiratory Systems',
          'Anatomy and Physiology II: Digestive, Urinary, Endocrine and Reproductive Systems',
          'Microbiology and Infection Prevention and Control',
          'Fundamentals of Nursing Practice: Patient Assessment, Basic Procedures and Documentation',
          'Pharmacology for Nurses: Drug Classification, Mechanisms and Safe Administration Principles',
          'Nursing Ethics, Professionalism and Regulatory Framework (NMC/National)',
          'Health Psychology and Therapeutic Communication',
        ],
      },
      2: {
        label: 'Year 2 — Core Clinical Nursing',
        description: 'Applying nursing care across adult medical, maternal and mental health settings',
        topics: [
          'Medical-Surgical Nursing I: Cardiovascular, Respiratory and Gastrointestinal Conditions',
          'Pathophysiology for Nurses: Disease Mechanisms Across Body Systems',
          'Maternal and Newborn Nursing: Antenatal, Intrapartum and Postnatal Care',
          'Mental Health and Psychiatric Nursing: Assessment, Therapeutic Relationships and Interventions',
          'Nutrition, Dietetics and Therapeutic Feeding in Clinical Practice',
          'Evidence-Based Nursing Practice: Introduction to Research Appraisal',
          'Clinical Placement II: Supervised Ward-Based Adult and Maternal Care',
        ],
      },
      3: {
        label: 'Year 3 — Specialised Nursing',
        description: 'Advanced clinical skills across paediatric, surgical, community and complex care',
        topics: [
          'Paediatric and Child Health Nursing: Developmental Assessment and Common Conditions',
          'Medical-Surgical Nursing II: Complex Wounds, Post-Operative Care and Chronic Disease Management',
          'Community and Public Health Nursing: Epidemiology, Health Promotion and Programme Delivery',
          'Research Methods in Nursing: Quantitative and Qualitative Approaches and Ethical Approval',
          'Clinical Decision-Making, Prioritisation and Safe Delegation',
          'Healthcare Management and Team Leadership for Nurses',
          'Clinical Placement III: Paediatric, Community and High-Dependency Settings',
        ],
      },
      4: {
        label: 'Year 4 — Advanced Practice and Leadership',
        description: 'Leadership, research application and transition to registered practice',
        topics: [
          'Critical Care and Emergency Nursing: Haemodynamic Monitoring, Ventilation and Resuscitation',
          'Community Health Nursing II: Programme Design, Evaluation and Policy',
          'Nursing Leadership, Management and Professional Regulation',
          'Nursing Research Project: Proposal, Data Collection, Analysis and Dissemination',
          'Quality Improvement, Patient Safety and Clinical Audit',
          'Interprofessional Collaboration, Care Coordination and Continuity of Care',
          'Clinical Practicum IV: Leadership and Accountability in Clinical Practice',
        ],
      },
    },
  },

  // ──────────────────────────── PHARMACY ──────────────────────────────────────
  Pharmacy: {
    name: 'Pharmacy',
    degree: 'BPharm',
    totalYears: 5,
    pedagogy: {
      competencyDomains: [
        'Pharmaceutical sciences: chemistry, formulation and dosage form reasoning',
        'Clinical pharmacotherapy and evidence-based medication optimisation',
        'Medication safety, pharmacovigilance and regulatory compliance',
        'Patient counselling, adherence support and communication',
        'Evidence appraisal, drug information and therapeutic decision-making',
      ],
      assessmentPatterns: [
        'Therapeutics case analysis: choose, justify and monitor drug regimen',
        'Drug interaction, contraindication and adverse effect identification',
        'Pharmaceutical calculation, dosing and dose-adjustment questions',
        'Counselling and adherence-planning long-form prompts',
      ],
      generationGuidance: [
        'Link pharmaceutical science foundations to practical clinical decisions',
        'Prioritise safe, rational medicine use in real patient scenarios',
        'Use realistic formulary constraints, patient co-morbidities and polypharmacy',
        'Include regulatory and pharmacovigilance angles in advanced years',
      ],
    },
    yearProgressionGuide: {
      1: 'Pharmaceutical science foundations: chemistry, anatomy and introductory practice',
      2: 'Applied sciences: pharmacology, microbiology, natural products and dosage form technology',
      3: 'Clinical pharmacy foundation: medicinal chemistry, pharmacokinetics and therapeutics I',
      4: 'Advanced clinical pharmacy: complex therapeutics, patient care and evidence-based practice',
      5: 'Professional internship: hospital and community rotations, case conferences and licensing readiness',
    },
    years: {
      1: {
        label: 'Year 1 — Pharmaceutical Science Foundations',
        description: 'Chemistry, physiology and introductory pharmacy practice',
        topics: [
          'Pharmaceutical Inorganic Chemistry: Atomic Structure, Ionic Reactions and Medicinal Elements',
          'Pharmaceutical Organic Chemistry: Functional Groups, Reaction Mechanisms and Stereochemistry',
          'Human Anatomy and Physiology for Pharmacists: Systems Overview',
          'Medicinal Biochemistry: Enzymes, Metabolic Pathways and Molecular Biology Basics',
          'Pharmaceutical Mathematics and Statistics: Calculations, Units and Dosage Arithmetic',
          'Introduction to Pharmaceutical Care and Professional Practice',
          'Pharmacy Law, Ethics and Regulatory Affairs',
        ],
      },
      2: {
        label: 'Year 2 — Applied Pharmaceutical Sciences',
        description: 'Pharmacology, microbiology, natural products and dosage form technology',
        topics: [
          'Pharmacology I: General Principles, Autonomic Nervous System and Cardiovascular Pharmacology',
          'Pharmaceutical Microbiology and Immunology: Pathogens, Sterility and Vaccine Science',
          'Pharmacognosy: Plant-Based Medicines, Phytochemicals and Natural Product Quality',
          'Pharmaceutics I: Solid and Liquid Dosage Forms — Tablets, Capsules, Solutions and Suspensions',
          'Pathophysiology for Pharmacists: Disease Mechanisms and Clinical Relevance',
          'Community Pharmacy Practice and Basic Patient Counselling',
          'Pharmaceutical Technology: Formulation Principles and Manufacturing Standards',
        ],
      },
      3: {
        label: 'Year 3 — Clinical Pharmacy Foundations',
        description: 'Medicinal chemistry, pharmacokinetics and introduction to therapeutics',
        topics: [
          'Medicinal Chemistry: Drug Design, Structure-Activity Relationships and Lead Optimisation',
          'Pharmacology II: CNS, Endocrine, Renal and Antimicrobial Pharmacology',
          'Pharmaceutics II: Controlled-Release Drug Delivery and Novel Drug Delivery Systems',
          'Pharmacotherapeutics I: Cardiovascular, Respiratory and Gastrointestinal Disorders',
          'Pharmaceutical Analysis and Quality Control: Assay Methods and Pharmacopoeial Standards',
          'Hospital Pharmacy Practice: Drug Distribution, IV Admixture and Sterile Dispensing',
          'Pharmacokinetics: Absorption, Distribution, Metabolism, Excretion and Dose Optimisation',
        ],
      },
      4: {
        label: 'Year 4 — Advanced Clinical Pharmacy',
        description: 'Complex therapeutics, patient-centred care and evidence-based practice',
        topics: [
          'Pharmacotherapeutics II: Infectious Diseases, CNS Disorders and Endocrine Conditions',
          'Clinical Pharmacy I: Medication Review, Drug-Related Problems and Pharmacist Interventions',
          'Biopharmaceutics: Bioavailability, Bioequivalence and Dissolution-Absorption Relationship',
          'Pharmacovigilance, Adverse Drug Reactions and Medication Error Reporting',
          'Biostatistics and Pharmacoepidemiology: Study Designs and Outcomes Research',
          'Pharmacy Management, Health Economics and National Formulary Systems',
          'Evidence-Based Pharmacy Practice and Drug Information Evaluation',
        ],
      },
      5: {
        label: 'Year 5 — Professional Internship',
        description: 'Hospital and community rotations, case conferences and pre-registration assessment',
        topics: [
          'Hospital Pharmacy Clinical Rotation: Therapeutic Drug Monitoring and Ward Rounds',
          'Community Pharmacy Clinical Rotation: Prescription Dispensing and Patient Counselling',
          'Clinical Pharmacotherapy Case Conference: Complex and Multi-Morbidity Scenarios',
          'Pharmaceutical Industry and Regulatory Affairs Rotation',
          'Pharmacy Research Rotation: Protocol Design, Data Collection and Scientific Writing',
          'Pre-registration Competency Assessment and Professional Licensing Examination Preparation',
        ],
      },
    },
  },

  // ─────────────────────────── COMPUTER SCIENCE ───────────────────────────────
  'Computer Science': {
    name: 'Computer Science',
    degree: 'BSc Computer Science',
    totalYears: 4,
    pedagogy: {
      competencyDomains: [
        'Computational thinking and algorithmic problem-solving',
        'Systems understanding: hardware, operating systems and networks',
        'Software engineering: design, testing, maintainability and collaboration',
        'Data, artificial intelligence and ethical technology deployment',
        'Security, reliability and responsible engineering practice',
      ],
      assessmentPatterns: [
        'Trace-and-reason MCQs on algorithms, data structures and systems',
        'Complexity, trade-off and design-decision questions',
        'Debugging, architecture and code-review long-form questions',
        'Security and AI ethics scenario analysis',
      ],
      generationGuidance: [
        'Assess reasoning, design choices and problem-solving — not memorised syntax',
        'Use realistic constraints, edge cases and performance requirements',
        'Include security, privacy and fairness trade-offs where relevant',
        'Scale abstraction and system complexity with year level',
      ],
    },
    yearProgressionGuide: {
      1: 'Foundations: programming logic, discrete mathematics, computer architecture and early data structures',
      2: 'Core computing: OOP, algorithms, databases, operating systems and networks at depth',
      3: 'Applied and specialised: software engineering, AI/ML, cybersecurity and mobile development',
      4: 'Advanced and capstone: distributed systems, deep learning, ethical computing and final project',
    },
    years: {
      1: {
        label: 'Year 1 — Computing Foundations',
        description: 'Programming, mathematics, hardware and introductory data structures',
        topics: [
          'Programming Fundamentals: Variables, Control Flow, Functions and Debugging (Python / C++)',
          'Discrete Mathematics: Propositional Logic, Set Theory, Relations and Proof Techniques',
          'Computer Systems Organisation: CPU Architecture, Memory Hierarchy and I/O',
          'Calculus and Linear Algebra for Computing: Differentiation, Vectors and Matrices',
          'Introduction to Data Structures: Arrays, Linked Lists, Stacks and Queues',
          'Digital Logic Design: Boolean Algebra, Combinational and Sequential Circuits',
          'Academic and Professional Communication for Computing Professionals',
        ],
      },
      2: {
        label: 'Year 2 — Core Computing',
        description: 'OOP, algorithms, databases, operating systems and computer networks',
        topics: [
          'Object-Oriented Programming: Classes, Inheritance, Polymorphism and Design Patterns',
          'Data Structures and Algorithms: Trees, Graphs, Sorting, Searching and Complexity Analysis',
          'Database Systems: Relational Modelling, SQL, Normalisation and Transaction Management',
          'Operating Systems: Processes, Threads, Scheduling, Memory Management and File Systems',
          'Computer Networks: TCP/IP Protocol Stack, Routing, Switching and Network Security Basics',
          'Probability and Statistics for Computer Science: Distributions, Estimation and Inference',
          'Web Development: HTML/CSS, JavaScript, RESTful APIs and Responsive Design',
        ],
      },
      3: {
        label: 'Year 3 — Applied and Specialised Computing',
        description: 'Software engineering, AI/ML, cybersecurity and mobile development',
        topics: [
          'Software Engineering: Requirements, Architecture, Design Patterns, Testing and Agile/DevOps',
          'Artificial Intelligence: Search, Knowledge Representation, Planning and Expert Systems',
          'Machine Learning: Supervised and Unsupervised Learning, Feature Engineering and Model Evaluation',
          'Cybersecurity: Threat Modelling, Cryptography, Authentication and Penetration Testing Basics',
          'Compiler Design and Programming Languages: Lexical Analysis, Parsing and Intermediate Code',
          'Mobile Application Development: Native and Cross-Platform Frameworks (Android/iOS/Flutter)',
          'Research Methods in Computing: Literature Review, Experiment Design and Technical Writing',
        ],
      },
      4: {
        label: 'Year 4 — Advanced Computing and Capstone',
        description: 'Distributed systems, deep learning, ethics and final-year project',
        topics: [
          'Distributed Systems and Cloud Computing: Microservices, Containers, CAP Theorem and Cloud Platforms',
          'Deep Learning and Neural Networks: CNNs, RNNs, Transformers and Deployment Pipelines',
          'Capstone Project: Full System Design, Implementation, Testing and Evaluation',
          'Big Data Analytics: MapReduce, Data Pipelines, Stream Processing and Visualisation',
          'Professional Ethics, Responsible AI and Digital Policy and Governance',
          'Elective I: Natural Language Processing, Computer Vision or Blockchain Engineering',
          'Elective II: Advanced Cybersecurity, Internet of Things or Human-Computer Interaction',
        ],
      },
    },
  },

  // ─────────────────────── BUSINESS ADMINISTRATION ────────────────────────────
  'Business Administration': {
    name: 'Business Administration',
    degree: 'BBA',
    totalYears: 4,
    pedagogy: {
      competencyDomains: [
        'Strategic and managerial decision-making in organisational contexts',
        'Financial analysis, accounting and quantitative business reasoning',
        'Marketing, operations and value-creation thinking',
        'Leadership, people management and organisational behaviour',
        'Business analytics, digital transformation and societal impact',
      ],
      assessmentPatterns: [
        'Case-based managerial decision and strategy questions',
        'Interpretation of financial statements and business metrics',
        'Strategy and risk trade-off long-form prompts',
        'Ethics, governance and stakeholder-reasoning questions',
      ],
      generationGuidance: [
        'Use realistic market, industry and organisational scenarios',
        'Require argument quality, evidence use and actionable recommendations in long-form responses',
        'Test application and critical thinking rather than theory recall alone',
        'Include quantitative reasoning (ratios, NPV, break-even) where appropriate',
      ],
    },
    yearProgressionGuide: {
      1: 'Business foundations: management principles, economics, accounting and communication',
      2: 'Analytical and functional: managerial accounting, marketing, HR and business statistics',
      3: 'Strategic and integrative: corporate finance, strategy, international business and research',
      4: 'Capstone and specialisation: leadership, analytics, consulting project and elective tracks',
    },
    years: {
      1: {
        label: 'Year 1 — Business Foundations',
        description: 'Management principles, economics, accounting and professional skills',
        topics: [
          'Principles of Management: Planning, Organising, Leading and Controlling Functions',
          'Microeconomics for Business: Supply and Demand, Market Structures and Consumer Theory',
          'Financial Accounting: Double-Entry Bookkeeping, Trial Balance and Financial Statements',
          'Business Mathematics and Quantitative Reasoning: Percentages, Ratios and Break-Even Analysis',
          'Business Communication and Professional Writing: Reports, Emails and Presentations',
          'Business Law and Ethics: Contract Law, Tort Liability and Regulatory Compliance',
          'Introduction to Information Systems and Digital Business Tools',
        ],
      },
      2: {
        label: 'Year 2 — Analytical and Functional Business',
        description: 'Managerial accounting, marketing, HRM and quantitative analysis',
        topics: [
          'Managerial Accounting: Cost Behaviour, Job Costing, Budgeting and Variance Analysis',
          'Marketing Principles: Segmentation, Targeting, Positioning and the 4P Marketing Mix',
          'Macroeconomics and the Business Environment: GDP, Inflation, Monetary and Fiscal Policy',
          'Human Resource Management: Recruitment, Training, Performance Appraisal and Labour Law',
          'Organisational Behaviour: Motivation Theories, Leadership Styles and Group Dynamics',
          'Business Statistics: Descriptive Analysis, Probability, Regression and Forecasting',
          'Operations Management: Process Design, Capacity Planning and Total Quality Management',
        ],
      },
      3: {
        label: 'Year 3 — Strategic and Integrative Management',
        description: 'Corporate finance, strategy, international business and research methods',
        topics: [
          'Corporate Finance: Time Value of Money, Capital Budgeting, Cost of Capital and Valuation',
          'Strategic Management: Industry Analysis (Porter\'s Five Forces), Business Models and Strategy Execution',
          'International Business: Global Trade Theory, Foreign Direct Investment and Cross-Cultural Management',
          'Entrepreneurship and New Venture Creation: Business Planning, Funding and Lean Start-up',
          'Business Research Methods and Data Analysis: Survey Design, Statistical Testing and Reporting',
          'Advanced Marketing Management: Brand Strategy, Digital Marketing and Customer Relationship Management',
          'Supply Chain and Logistics Management: Inventory, Procurement and Distribution Network Design',
        ],
      },
      4: {
        label: 'Year 4 — Capstone and Specialisation',
        description: 'Leadership, business analytics, consulting project and elective specialisation',
        topics: [
          'Strategic Leadership and Organisational Change Management',
          'Business Analytics and Data-Driven Decision-Making: Dashboards, KPIs and Predictive Models',
          'Business Capstone: Applied Consulting Project or Applied Research Thesis',
          'Corporate Governance, Business Ethics and Sustainability Reporting',
          'Elective Track I: Investment Analysis and Portfolio Management, Advanced Marketing or HRM Strategy',
          'Elective Track II: Social Entrepreneurship, International Strategy or Digital Business Transformation',
          'Professional Development: Career Planning, Negotiation Skills and Executive Communication',
        ],
      },
    },
  },
}

// ── Standards references ──────────────────────────────────────────────────────

export interface UniversityStandardReference {
  title: string
  url: string
  relevance: string
}

export const UNIVERSITY_STANDARDS_REFERENCES: UniversityStandardReference[] = [
  {
    title: 'WFME Global Standards for Quality Improvement: Basic Medical Education (2020)',
    url: 'https://wfme.org/standards/bme/',
    relevance: 'Medical curriculum quality framework, assessment standards and continuous improvement',
  },
  {
    title: 'GMC Outcomes for Graduates',
    url: 'https://www.gmc-uk.org/education/standards-guidance-and-curricula/standards-and-outcomes/outcomes-for-graduates',
    relevance: 'Clinical knowledge, skills and professional behaviours expected at MBBS completion',
  },
  {
    title: 'NMC Standards Framework for Nursing and Midwifery Education',
    url: 'https://www.nmc.org.uk/standards-for-education-and-training/standards-framework-for-nursing-and-midwifery-education/',
    relevance: 'Nursing programme structure, practice hours and competency standards',
  },
  {
    title: 'FIP Education Initiatives — Pharmacy Education Standards',
    url: 'https://www.fip.org/fip-education',
    relevance: 'Pharmacy programme outcomes, clinical practice integration and FIP Nanjing Statements',
  },
  {
    title: 'ACM CS2023 — Global Computer Science Curricula',
    url: 'https://csed.acm.org/',
    relevance: 'Computing curriculum breadth, competency-based progression and emerging topic areas',
  },
  {
    title: 'AACSB Business Accreditation Standards',
    url: 'https://www.aacsb.edu/accreditation/standards',
    relevance: 'Business education: learner success outcomes, thought leadership and societal impact',
  },
]

// ── Helper functions ──────────────────────────────────────────────────────────

export function getUniversityCourseNames(): string[] {
  return Object.keys(UNIVERSITY_COURSES)
}

export function getUniversityYearsForCourse(courseName: string): number[] {
  const course = UNIVERSITY_COURSES[courseName]
  if (!course) return []
  return Array.from({ length: course.totalYears }, (_, i) => i + 1)
}

export function isValidUniversityYear(courseName: string, year: number): boolean {
  const course = UNIVERSITY_COURSES[courseName]
  if (!course) return false
  return year >= 1 && year <= course.totalYears
}

export function getUniversityTopicsForCourseAndYear(courseName: string, year: number): string[] {
  return UNIVERSITY_COURSES[courseName]?.years[year]?.topics ?? []
}

export function getUniversityYearLabel(courseName: string, year: number): string {
  return UNIVERSITY_COURSES[courseName]?.years[year]?.label ?? `Year ${year}`
}

export function getUniversityCurriculumContext(
  courseName: string,
  year: number,
  selectedTopics: string[]
): string {
  const course = UNIVERSITY_COURSES[courseName]
  const yearData = course?.years[year]

  if (!course || !yearData) {
    return `**Curriculum Authority:** University-level curriculum\n**Course:** ${courseName}\n**Year:** ${year}\n**Topics:** ${selectedTopics.join(', ')}`
  }

  const profile = course.pedagogy
  const progression = course.yearProgressionGuide[year] ?? 'University-level academic year'

  return `**Curriculum Authority:** University Curriculum (Pilot) — ${course.degree}
**Course:** ${course.name}
**Year:** ${yearData.label} — ${yearData.description}
**Topics for assessment:** ${selectedTopics.join(', ')}
**Year progression target:** ${progression}

**Competency domains to assess:**
- ${profile.competencyDomains.join('\n- ')}

**Assessment pattern guidance:**
- ${profile.assessmentPatterns.join('\n- ')}

**Generation guidance:**
- ${profile.generationGuidance.join('\n- ')}

**Standards-informed references for this curriculum:**
- ${UNIVERSITY_STANDARDS_REFERENCES.map(r => `${r.title} — ${r.url}`).join('\n- ')}

The questions MUST align with ${course.degree} Year ${year} expectations. Questions should:
- Prioritise conceptual depth, clinical/professional application and case-based reasoning
- Use discipline-specific terminology expected at this year level
- Balance knowledge recall, applied problem-solving and analytical reasoning
- Reflect the complexity and scope appropriate for Year ${year} of ${year} out of ${course.totalYears} total years
- Include realistic professional scenarios with clear marking expectations`
}
