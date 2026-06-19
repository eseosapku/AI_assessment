/**
 * Exam prep resource catalogue for Nigeria.
 * URLs verified June 2026 — prefer official sources; third-party links labelled clearly.
 */

export interface OfficialResource {
  title: string
  url: string
  type: 'syllabus' | 'brochure' | 'past_papers' | 'portal' | 'policy'
  authority: string
  notes?: string
}

export const NERDC_RESOURCES: OfficialResource[] = [
  {
    title: 'NERDC — Official Website',
    url: 'https://nerdc.org.ng/',
    type: 'portal',
    authority: 'NERDC',
    notes: 'National curriculum body; curriculum updates and publications.',
  },
  {
    title: 'FG Curriculum Overhaul Press Release (PDF)',
    url: 'https://education.gov.ng/wp-content/uploads/2025/09/FG-OVERHAULS-CURRICULUM.pdf',
    type: 'policy',
    authority: 'Federal Ministry of Education',
    notes: 'Approved subject lists P1–SS3, trade subjects, implementation 2025/26.',
  },
  {
    title: 'Federal Ministry of Education',
    url: 'https://education.gov.ng/',
    type: 'portal',
    authority: 'FME',
  },
  {
    title: 'UBEC — Universal Basic Education Commission',
    url: 'https://ubec.gov.ng/',
    type: 'portal',
    authority: 'UBEC',
    notes: 'Primary and junior secondary policy; basic education standards.',
  },
]

export const WAEC_RESOURCES: OfficialResource[] = [
  {
    title: 'WAEC Nigeria — Official Site',
    url: 'https://www.waecnigeria.org/',
    type: 'portal',
    authority: 'WAEC',
  },
  {
    title: 'WASSCE Syllabuses (WAEC Nigeria)',
    url: 'https://www.waecnigeria.org/article/wassce-syllabuses-2017-2019',
    type: 'syllabus',
    authority: 'WAEC',
    notes: 'Per-subject WASSCE syllabuses; check for latest examination cycle.',
  },
  {
    title: 'WAEC e-Learning Portal',
    url: 'https://waeconline.org.ng/e-learning/',
    type: 'portal',
    authority: 'WAEC',
    notes: 'Official past questions by subject and year; chief examiners’ reports.',
  },
  {
    title: 'WAEC E-Study Portal',
    url: 'https://waec.estudy.ng/',
    type: 'past_papers',
    authority: 'WAEC',
    notes: 'Official 2025+ prep platform — past papers, marking schemes, insights.',
  },
  {
    title: 'WAEC Konnect',
    url: 'https://www.waeckonnect.com/',
    type: 'past_papers',
    authority: 'WAEC',
    notes: 'Past papers with answers and chief examiners’ booklets.',
  },
  {
    title: 'WAEC FAQ — Registration & Exam Cycles',
    url: 'https://www.waecnigeria.org/faq',
    type: 'portal',
    authority: 'WAEC',
    notes: 'School vs private candidate registration, timetables, and exam schedules.',
  },
  {
    title: 'WAEC Online Services',
    url: 'https://waeconline.org.ng/',
    type: 'portal',
    authority: 'WAEC',
    notes: 'Online registration and candidate services portal.',
  },
  {
    title: 'WAEC Results (WAECDirect)',
    url: 'https://www.waecdirect.org/',
    type: 'portal',
    authority: 'WAEC',
    notes: 'Official WASSCE result checking website.',
  },
  {
    title: 'WAEC Nigeria National Office',
    url: 'https://www.waecnigeria.org/national-office',
    type: 'portal',
    authority: 'WAEC',
  },
]

export const JAMB_RESOURCES: OfficialResource[] = [
  {
    title: 'JAMB IBASS — Brochure & Syllabus System',
    url: 'https://ibass.jamb.gov.ng/',
    type: 'brochure',
    authority: 'JAMB',
    notes: 'Official UTME syllabus, subject combinations, and eligibility by course/institution.',
  },
  {
    title: 'JAMB UTME Syllabus (IBASS print view)',
    url: 'https://ibass.jamb.gov.ng/printsyllabus',
    type: 'syllabus',
    authority: 'JAMB',
    notes: 'Per-subject UTME syllabuses from the official brochure system.',
  },
  {
    title: 'JAMB Eligibility Checker',
    url: 'https://eligibility.jamb.gov.ng/',
    type: 'portal',
    authority: 'JAMB',
  },
  {
    title: 'JAMB Official Website',
    url: 'https://www.jamb.gov.ng/',
    type: 'portal',
    authority: 'JAMB',
  },
  {
    title: 'JAMB CAPS — Central Admissions Processing',
    url: 'https://www.jamb.gov.ng/caps',
    type: 'portal',
    authority: 'JAMB',
  },
]

/** Third-party past paper archives (for student reference; not official) */
export const SUPPLEMENTARY_PAST_PAPER_SOURCES: OfficialResource[] = [
  {
    title: 'WAEC Past Questions (myschool.ng)',
    url: 'https://myschool.ng/classroom/waec',
    type: 'past_papers',
    authority: 'Third-party',
    notes: 'Subject-organised WASSCE practice; cross-check with official marking schemes.',
  },
  {
    title: 'WAEC Past Questions by Year (myschool.ng)',
    url: 'https://myschool.ng/classroom/waec-past-questions',
    type: 'past_papers',
    authority: 'Third-party',
  },
  {
    title: 'JAMB UTME Past Questions (myschool.ng)',
    url: 'https://myschool.ng/classroom/jamb-utme',
    type: 'past_papers',
    authority: 'Third-party',
  },
  {
    title: 'JAMB Past Questions by Year (myschool.ng)',
    url: 'https://myschool.ng/classroom/jamb-past-questions',
    type: 'past_papers',
    authority: 'Third-party',
  },
  {
    title: 'WAEC Past Questions (flashlearners.com)',
    url: 'https://www.flashlearners.com/waec-past-questions/',
    type: 'past_papers',
    authority: 'Third-party',
    notes: 'Free WASSCE past questions with worked answers.',
  },
  {
    title: 'JAMB Past Questions (flashlearners.com)',
    url: 'https://www.flashlearners.com/jamb-past-questions/',
    type: 'past_papers',
    authority: 'Third-party',
    notes: 'Free UTME past questions with explanations.',
  },
]

export function allExamPrepResources(exam: 'waec' | 'jamb' | 'nerdc') {
  if (exam === 'waec') {
    return [...WAEC_RESOURCES, ...SUPPLEMENTARY_PAST_PAPER_SOURCES.filter((r) => r.url.toLowerCase().includes('waec'))]
  }
  if (exam === 'jamb') {
    return [...JAMB_RESOURCES, ...SUPPLEMENTARY_PAST_PAPER_SOURCES.filter((r) => r.url.toLowerCase().includes('jamb'))]
  }
  return NERDC_RESOURCES
}
