/**
 * WAEC WASSCE & JAMB UTME exam syllabi for dedicated Exam Prep mode.
 *
 * WAEC (2026 guidance): 8–9 subjects — English, Mathematics, Civic Education,
 * one trade/entrepreneurship subject, plus stream electives (Science / Arts (Humanities) / Commercial).
 * Sources: waecnigeria.org, WAEC 2026 subject-combination circulars.
 *
 * JAMB UTME: exactly 25 subjects; Use of English compulsory + any three.
 * Sources: ibass.jamb.gov.ng, JAMB brochure.
 */

export interface ExamSubject {
  name: string
  /** Compulsory | Science | Arts (Humanities) | Commercial | Trade | Languages & Creative */
  category: string
  topics: string[]
  waecCompulsory?: boolean
  /** Typical WASSCE stream(s) — guidance for students, not a hard filter */
  streams?: Array<'science' | 'arts' | 'commercial'>
}

export interface JambCourseCombo {
  course: string
  faculty: string
  subjects: [string, string, string, string] // Use of English always first
}

/** WASSCE compulsory trio (all streams) */
export const WAEC_COMPULSORY = ['English Language', 'General Mathematics', 'Civic Education'] as const

/**
 * WASSCE subjects aligned to official WAEC syllabuses.
 * Arts stream = Humanities (literature, government/history, religion, languages, creative arts).
 * Data Processing & Book Keeping are trade subjects (mandatory to pick at least one trade).
 */
export const WAEC_SUBJECTS: ExamSubject[] = [
  // ── Compulsory (all streams) ───────────────────────────────────────────────
  { name: 'English Language', category: 'Compulsory', waecCompulsory: true, streams: ['science', 'arts', 'commercial'], topics: ['Comprehension and summary', 'Essay writing', 'Lexis and structure', 'Oral English', 'Test of orals', 'Literature element'] },
  { name: 'General Mathematics', category: 'Compulsory', waecCompulsory: true, streams: ['science', 'arts', 'commercial'], topics: ['Number and numeration', 'Algebraic processes', 'Mensuration', 'Geometry and trigonometry', 'Statistics and probability', 'Commercial arithmetic'] },
  { name: 'Civic Education', category: 'Compulsory', waecCompulsory: true, streams: ['science', 'arts', 'commercial'], topics: ['Citizenship and national identity', 'Human rights', 'Law and order', 'Responsible parenting', 'Cultism and substance abuse', 'Emerging issues'] },

  // ── Arts (Humanities) ──────────────────────────────────────────────────────
  { name: 'Literature in English', category: 'Arts (Humanities)', streams: ['arts'], topics: ['Prose analysis', 'Poetry analysis', 'Drama analysis', 'Literary appreciation', 'Context and themes', 'Character and style'] },
  { name: 'Government', category: 'Arts (Humanities)', streams: ['arts', 'commercial'], topics: ['Political concepts', 'Political ideologies', 'Constitution', 'Arms of government', 'Political parties', 'Foreign policy', 'International organizations'] },
  { name: 'History', category: 'Arts (Humanities)', streams: ['arts'], topics: ['Historiography', 'West African history', 'Nigerian history', 'World history themes', 'Source analysis'] },
  { name: 'Christian Religious Studies', category: 'Arts (Humanities)', streams: ['arts'], topics: ['Old Testament', 'New Testament', 'Christian ethics', 'Church history', 'Religion and society'] },
  { name: 'Islamic Studies', category: 'Arts (Humanities)', streams: ['arts'], topics: ['Quran', 'Hadith', 'Fiqh', 'Islamic history', 'Contemporary issues'] },
  { name: 'Hausa', category: 'Languages & Creative', streams: ['arts'], topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'Igbo', category: 'Languages & Creative', streams: ['arts'], topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'Yoruba', category: 'Languages & Creative', streams: ['arts'], topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'French', category: 'Languages & Creative', streams: ['arts'], topics: ['Grammar', 'Reading', 'Writing', 'Oral', 'Culture'] },
  { name: 'Arabic', category: 'Languages & Creative', streams: ['arts'], topics: ['Grammar', 'Reading', 'Composition', 'Literature', 'Translation'] },
  { name: 'Music', category: 'Languages & Creative', streams: ['arts'], topics: ['Theory of music', 'African music', 'Performance', 'Composition'] },
  { name: 'Visual Arts', category: 'Languages & Creative', streams: ['arts'], topics: ['Drawing', 'Design', 'Art history', 'Craft', 'Portfolio'] },

  // ── Commercial ─────────────────────────────────────────────────────────────
  { name: 'Economics', category: 'Commercial', streams: ['commercial'], topics: ['Basic economic problems', 'Demand and supply', 'Theory of production', 'Market structures', 'National income', 'Money and banking', 'International trade', 'Development planning'] },
  { name: 'Financial Accounting', category: 'Commercial', streams: ['commercial'], topics: ['Introduction to accounting', 'Trial balance', 'Final accounts', 'Control accounts', 'Company accounts', 'Partnership accounts', 'Interpretation of accounts'] },
  { name: 'Commerce', category: 'Commercial', streams: ['commercial'], topics: ['Trade', 'Aids to trade', 'Business units', 'Finance and banking', 'Transport and insurance', 'Marketing', 'Consumer protection'] },
  { name: 'Office Practice', category: 'Commercial', streams: ['commercial'], topics: ['Office organisation', 'Office equipment', 'Communication and correspondence', 'Records management', 'Reception duties', 'Business ethics'] },
  { name: 'Book Keeping', category: 'Commercial', streams: ['commercial'], topics: ['Books of original entry', 'Ledgers', 'Trial balance', 'Final accounts', 'Control accounts', 'Bank reconciliation'] },

  // ── Science ────────────────────────────────────────────────────────────────
  { name: 'Biology', category: 'Science', streams: ['science'], topics: ['Concept of living things', 'Classification', 'Cell biology', 'Nutrition and transport', 'Respiration and excretion', 'Reproduction and growth', 'Ecology', 'Genetics and evolution'] },
  { name: 'Chemistry', category: 'Science', streams: ['science'], topics: ['Introduction to chemistry', 'Atomic structure', 'Chemical bonding', 'Stoichiometry', 'States of matter', 'Energetics', 'Equilibrium', 'Acids bases salts', 'Organic chemistry', 'Industrial chemistry'] },
  { name: 'Physics', category: 'Science', streams: ['science'], topics: ['Measurement and units', 'Scalars and vectors', 'Motion', 'Forces and machines', 'Heat energy', 'Waves and optics', 'Electricity and magnetism', 'Modern physics'] },
  { name: 'Agricultural Science', category: 'Science', streams: ['science'], topics: ['Soil science', 'Crop production', 'Animal production', 'Agricultural economics', 'Farm mechanization', 'Fisheries and forestry'] },
  { name: 'Further Mathematics', category: 'Science', streams: ['science', 'commercial'], topics: ['Polynomials', 'Inequalities', 'Matrices', 'Calculus', 'Mechanics', 'Statistics advanced'] },
  { name: 'Geography', category: 'Science', streams: ['science', 'arts'], topics: ['Map reading', 'Physical geography', 'Human geography', 'Regional geography', 'Geographic techniques', 'Environmental management'] },
  { name: 'Computer Studies', category: 'Science', streams: ['science', 'commercial'], topics: ['Computer fundamentals', 'Data representation', 'Software and hardware', 'Networking', 'Programming basics', 'ICT applications'] },
  { name: 'Food and Nutrition', category: 'Science', streams: ['science'], topics: ['Nutrition', 'Food science', 'Meal management', 'Food preservation', 'Kitchen equipment'] },
  { name: 'Technical Drawing', category: 'Science', streams: ['science'], topics: ['Geometric construction', 'Projection', 'Sectional views', 'Dimensioning', 'CAD'] },
  { name: 'Physical and Health Education', category: 'Science', streams: ['science'], topics: ['Anatomy', 'Sports science', 'Health education', 'First aid'] },

  // ── Trade / Entrepreneurship (pick at least one) ─────────────────────────────
  { name: 'Data Processing', category: 'Trade', streams: ['science', 'arts', 'commercial'], topics: ['Computer applications', 'Word processing', 'Spreadsheets', 'Databases', 'Presentation software', 'Internet and email', 'Data security'] },
  { name: 'Marketing', category: 'Trade', streams: ['commercial'], topics: ['Market research', 'Product and pricing', 'Promotion', 'Distribution', 'Digital marketing'] },
  { name: 'Catering Craft Practice', category: 'Trade', streams: ['commercial'], topics: ['Kitchen operations', 'Menu planning', 'Food service', 'Hygiene', 'Practical catering'] },
  { name: 'Garment Making', category: 'Trade', streams: ['arts', 'commercial'], topics: ['Tools and equipment', 'Pattern drafting', 'Cutting and sewing', 'Finishing', 'Fashion illustration'] },
  { name: 'Animal Husbandry', category: 'Trade', streams: ['science'], topics: ['Livestock management', 'Feed and nutrition', 'Breeding', 'Health and disease control', 'Farm records'] },
  { name: 'Auto Mechanics', category: 'Trade', streams: ['science'], topics: ['Engine systems', 'Vehicle maintenance', 'Workshop safety', 'Tools and equipment', 'Fault diagnosis'] },
]

/** Official JAMB UTME 25 subjects (ibass.jamb.gov.ng). Data Processing is WAEC/O-Level, not a UTME paper. */
export const JAMB_UTME_SUBJECTS: ExamSubject[] = [
  { name: 'Use of English', category: 'Compulsory', topics: ['Comprehension', 'Lexis and structure', 'Oral forms', 'Antonyms and synonyms', 'Sentence interpretation', 'Clause and phrase identification'] },
  { name: 'Mathematics', category: 'Sciences', topics: ['Number and numeration', 'Algebra', 'Geometry and trigonometry', 'Calculus basics', 'Statistics', 'Probability'] },
  { name: 'Physics', category: 'Sciences', topics: ['Measurement', 'Motion', 'Forces', 'Heat', 'Waves', 'Electricity', 'Modern physics'] },
  { name: 'Chemistry', category: 'Sciences', topics: ['Atomic structure', 'Bonding', 'Stoichiometry', 'Kinetics', 'Equilibrium', 'Organic chemistry'] },
  { name: 'Biology', category: 'Sciences', topics: ['Cell biology', 'Genetics', 'Ecology', 'Evolution', 'Physiology', 'Reproduction'] },
  { name: 'Agricultural Science', category: 'Sciences', topics: ['Soil science', 'Crop production', 'Animal husbandry', 'Agricultural economics'] },
  { name: 'Economics', category: 'Social Sciences', topics: ['Demand and supply', 'Production theory', 'National income', 'Money and banking', 'International trade'] },
  { name: 'Government', category: 'Social Sciences', topics: ['Political concepts', 'Constitution', 'Arms of government', 'Political parties', 'Foreign policy'] },
  { name: 'Geography', category: 'Social Sciences', topics: ['Physical geography', 'Human geography', 'Map reading', 'Regional geography'] },
  { name: 'Commerce', category: 'Social Sciences', topics: ['Trade', 'Business organisation', 'Finance', 'Marketing'] },
  { name: 'Principles of Accounts', category: 'Social Sciences', topics: ['Double entry', 'Trial balance', 'Final accounts', 'Control accounts'] },
  { name: 'Literature in English', category: 'Arts (Humanities)', topics: ['Prose', 'Poetry', 'Drama', 'Literary devices', 'Contextual questions'] },
  { name: 'History', category: 'Arts (Humanities)', topics: ['West African history', 'Nigerian history', 'World history', 'Historiography'] },
  { name: 'Christian Religious Studies', category: 'Arts (Humanities)', topics: ['Old Testament', 'New Testament', 'Themes and teachings'] },
  { name: 'Islamic Studies', category: 'Arts (Humanities)', topics: ['Quran', 'Hadith', 'Fiqh', 'Islamic history'] },
  { name: 'Hausa', category: 'Arts (Humanities)', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Igbo', category: 'Arts (Humanities)', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Yoruba', category: 'Arts (Humanities)', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Arabic', category: 'Arts (Humanities)', topics: ['Grammar', 'Reading', 'Composition', 'Literature', 'Translation'] },
  { name: 'French', category: 'Arts (Humanities)', topics: ['Grammar', 'Comprehension', 'Composition', 'Oral'] },
  { name: 'Art', category: 'Arts (Humanities)', topics: ['Drawing', 'Painting', 'Design', 'Art history', 'Creative expression'] },
  { name: 'Music', category: 'Arts (Humanities)', topics: ['Theory', 'African music', 'History of music', 'Notation'] },
  { name: 'Home Economics', category: 'Arts (Humanities)', topics: ['Nutrition', 'Food preparation', 'Clothing and textiles', 'Home management'] },
  { name: 'Physical and Health Education', category: 'Sciences', topics: ['Human anatomy', 'Sports science', 'Health education', 'First aid'] },
  { name: 'Computer Studies', category: 'Sciences', topics: ['Computer fundamentals', 'Data', 'Networking', 'Programming', 'ICT in society'] },
]

export const JAMB_COURSE_COMBOS: JambCourseCombo[] = [
  { course: 'Medicine and Surgery', faculty: 'Medical Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Pharmacy', faculty: 'Medical Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Nursing', faculty: 'Medical Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Engineering (all branches)', faculty: 'Engineering', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { course: 'Computer Science', faculty: 'Sciences', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { course: 'Architecture', faculty: 'Environmental Sciences', subjects: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'] },
  { course: 'Law', faculty: 'Law', subjects: ['Use of English', 'Literature in English', 'Government', 'Christian Religious Studies'] },
  { course: 'Mass Communication', faculty: 'Arts (Humanities)', subjects: ['Use of English', 'Literature in English', 'Government', 'Economics'] },
  { course: 'English and Literary Studies', faculty: 'Arts (Humanities)', subjects: ['Use of English', 'Literature in English', 'Government', 'Christian Religious Studies'] },
  { course: 'History and International Studies', faculty: 'Arts (Humanities)', subjects: ['Use of English', 'History', 'Government', 'Literature in English'] },
  { course: 'Accounting', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Principles of Accounts'] },
  { course: 'Business Administration', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Commerce'] },
  { course: 'Economics', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { course: 'Political Science', faculty: 'Social & Management', subjects: ['Use of English', 'Government', 'Economics', 'Literature in English'] },
  { course: 'Agriculture', faculty: 'Agriculture', subjects: ['Use of English', 'Chemistry', 'Biology', 'Agricultural Science'] },
  { course: 'Education (various)', faculty: 'Education', subjects: ['Use of English', 'Mathematics', 'Biology', 'Chemistry'] },
  { course: 'Dentistry', faculty: 'Medical Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Physiotherapy', faculty: 'Medical Sciences', subjects: ['Use of English', 'Biology', 'Physics', 'Chemistry'] },
  { course: 'Microbiology', faculty: 'Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Biochemistry', faculty: 'Sciences', subjects: ['Use of English', 'Biology', 'Chemistry', 'Physics'] },
  { course: 'Industrial Chemistry', faculty: 'Sciences', subjects: ['Use of English', 'Chemistry', 'Mathematics', 'Physics'] },
  { course: 'Estate Management', faculty: 'Environmental Sciences', subjects: ['Use of English', 'Mathematics', 'Economics', 'Geography'] },
  { course: 'Urban and Regional Planning', faculty: 'Environmental Sciences', subjects: ['Use of English', 'Mathematics', 'Geography', 'Economics'] },
  { course: 'Banking and Finance', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Principles of Accounts'] },
  { course: 'Public Administration', faculty: 'Social & Management', subjects: ['Use of English', 'Government', 'Economics', 'Literature in English'] },
  { course: 'International Relations', faculty: 'Social & Management', subjects: ['Use of English', 'Government', 'Economics', 'History'] },
  { course: 'Fine and Applied Arts', faculty: 'Arts (Humanities)', subjects: ['Use of English', 'Art', 'Literature in English', 'Government'] },
  { course: 'Law (Islamic Studies option)', faculty: 'Law', subjects: ['Use of English', 'Literature in English', 'Government', 'Islamic Studies'] },
]

export function getWaecSubject(name: string): ExamSubject | undefined {
  return WAEC_SUBJECTS.find((s) => s.name.toLowerCase() === name.toLowerCase())
}

export function getJambSubject(name: string): ExamSubject | undefined {
  return JAMB_UTME_SUBJECTS.find((s) => s.name.toLowerCase() === name.toLowerCase())
}

export function getJambComboForCourse(course: string): JambCourseCombo | undefined {
  return JAMB_COURSE_COMBOS.find((c) => c.course.toLowerCase() === course.toLowerCase())
}

export function examPrepContext(exam: 'waec' | 'jamb', subject: string, topics: string[], extra?: string): string {
  const authority = exam === 'waec'
    ? 'West African Examinations Council (WAEC) WASSCE'
    : 'Joint Admissions and Matriculation Board (JAMB) UTME'
  return `**Exam Prep Mode:** ${exam.toUpperCase()}
**Authority:** ${authority}
**Subject:** ${subject}
**Syllabus Topics:** ${topics.join('; ')}
${extra ? `**Additional context:** ${extra}` : ''}
Generate questions in official ${exam.toUpperCase()} examination style: Nigerian context, standard marking expectations, and syllabus-aligned scope only.`
}
