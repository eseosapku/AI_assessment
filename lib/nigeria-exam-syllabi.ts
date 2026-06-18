/**
 * WAEC WASSCE & JAMB UTME exam syllabi for dedicated Exam Prep mode.
 * WAEC topics aligned to WASSCE subject syllabuses (waecnigeria.org).
 * JAMB topics aligned to UTME syllabus subjects (ibass.jamb.gov.ng).
 */

export interface ExamSubject {
  name: string
  category: string
  topics: string[]
  waecCompulsory?: boolean
}

export interface JambCourseCombo {
  course: string
  faculty: string
  subjects: [string, string, string, string] // Use of English always first
}

/** WASSCE compulsory trio + Civic Education per FG/WAEC guidance */
export const WAEC_COMPULSORY = ['English Language', 'General Mathematics', 'Civic Education'] as const

export const WAEC_SUBJECTS: ExamSubject[] = [
  { name: 'English Language', category: 'Compulsory', waecCompulsory: true, topics: ['Comprehension and summary', 'Essay writing', 'Lexis and structure', 'Oral English', 'Test of orals', 'Literature element'] },
  { name: 'General Mathematics', category: 'Compulsory', waecCompulsory: true, topics: ['Number and numeration', 'Algebraic processes', 'Mensuration', 'Geometry and trigonometry', 'Statistics and probability', 'Commercial arithmetic'] },
  { name: 'Civic Education', category: 'Compulsory', waecCompulsory: true, topics: ['Citizenship and national identity', 'Human rights', 'Law and order', 'Responsible parenting', 'Cultism and substance abuse', 'Emerging issues'] },
  { name: 'Biology', category: 'Science', topics: ['Concept of living things', 'Classification', 'Cell biology', 'Nutrition and transport', 'Respiration and excretion', 'Reproduction and growth', 'Ecology', 'Genetics and evolution'] },
  { name: 'Chemistry', category: 'Science', topics: ['Introduction to chemistry', 'Atomic structure', 'Chemical bonding', 'Stoichiometry', 'States of matter', 'Energetics', 'Equilibrium', 'Acids bases salts', 'Organic chemistry', 'Industrial chemistry'] },
  { name: 'Physics', category: 'Science', topics: ['Measurement and units', 'Scalars and vectors', 'Motion', 'Forces and machines', 'Heat energy', 'Waves and optics', 'Electricity and magnetism', 'Modern physics'] },
  { name: 'Agricultural Science', category: 'Science', topics: ['Soil science', 'Crop production', 'Animal production', 'Agricultural economics', 'Farm mechanization', 'Fisheries and forestry'] },
  { name: 'Further Mathematics', category: 'Science', topics: ['Polynomials', 'Inequalities', 'Matrices', 'Calculus', 'Mechanics', 'Statistics advanced'] },
  { name: 'Geography', category: 'Science/Humanities', topics: ['Map reading', 'Physical geography', 'Human geography', 'Regional geography', 'Geographic techniques', 'Environmental management'] },
  { name: 'Economics', category: 'Commercial', topics: ['Basic economic problems', 'Demand and supply', 'Theory of production', 'Market structures', 'National income', 'Money and banking', 'International trade', 'Development planning'] },
  { name: 'Financial Accounting', category: 'Commercial', topics: ['Introduction to accounting', 'Trial balance', 'Final accounts', 'Control accounts', 'Company accounts', 'Partnership accounts', 'Interpretation of accounts'] },
  { name: 'Commerce', category: 'Commercial', topics: ['Trade', 'Aids to trade', 'Business units', 'Finance and banking', 'Transport and insurance', 'Marketing', 'Consumer protection'] },
  { name: 'Government', category: 'Arts', topics: ['Political concepts', 'Political ideologies', 'Constitution', 'Arms of government', 'Political parties', 'Foreign policy', 'International organizations'] },
  { name: 'Literature in English', category: 'Arts', topics: ['Prose analysis', 'Poetry analysis', 'Drama analysis', 'Literary appreciation', 'Context and themes', 'Character and style'] },
  { name: 'History', category: 'Arts', topics: ['Historiography', 'West African history', 'Nigerian history', 'World history themes', 'Source analysis'] },
  { name: 'Christian Religious Studies', category: 'Arts', topics: ['Old Testament', 'New Testament', 'Christian ethics', 'Church history', 'Religion and society'] },
  { name: 'Islamic Studies', category: 'Arts', topics: ['Quran', 'Hadith', 'Fiqh', 'Islamic history', 'Contemporary issues'] },
  { name: 'Hausa', category: 'Arts', topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'Igbo', category: 'Arts', topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'Yoruba', category: 'Arts', topics: ['Grammar', 'Composition', 'Comprehension', 'Literature', 'Oral tradition'] },
  { name: 'French', category: 'Arts', topics: ['Grammar', 'Reading', 'Writing', 'Oral', 'Culture'] },
  { name: 'Computer Studies', category: 'Science', topics: ['Computer fundamentals', 'Data representation', 'Software and hardware', 'Networking', 'Programming basics', 'ICT applications'] },
  { name: 'Visual Arts', category: 'Arts', topics: ['Drawing', 'Design', 'Art history', 'Craft', 'Portfolio'] },
  { name: 'Food and Nutrition', category: 'Science', topics: ['Nutrition', 'Food science', 'Meal management', 'Food preservation', 'Kitchen equipment'] },
  { name: 'Technical Drawing', category: 'Science', topics: ['Geometric construction', 'Projection', 'Sectional views', 'Dimensioning', 'CAD'] },
  { name: 'Catering Craft Practice', category: 'Vocational', topics: ['Kitchen operations', 'Menu planning', 'Food service', 'Hygiene', 'Practical catering'] },
  { name: 'Garment Making', category: 'Vocational', topics: ['Tools and equipment', 'Pattern drafting', 'Cutting and sewing', 'Finishing', 'Fashion illustration'] },
]

/** 25 JAMB UTME subjects (Use of English compulsory) */
export const JAMB_UTME_SUBJECTS: ExamSubject[] = [
  { name: 'Use of English', category: 'Compulsory', topics: ['Comprehension', 'Lexis and structure', 'Oral forms', 'Antonyms and synonyms', 'Sentence interpretation', 'Clause and phrase identification'] },
  { name: 'Mathematics', category: 'Sciences', topics: ['Number and numeration', 'Algebra', 'Geometry and trigonometry', 'Calculus basics', 'Statistics', 'Probability'] },
  { name: 'Physics', category: 'Sciences', topics: ['Measurement', 'Motion', 'Forces', 'Heat', 'Waves', 'Electricity', 'Modern physics'] },
  { name: 'Chemistry', category: 'Sciences', topics: ['Atomic structure', 'Bonding', 'Stoichiometry', 'Kinetics', 'Equilibrium', 'Organic chemistry'] },
  { name: 'Biology', category: 'Sciences', topics: ['Cell biology', 'Genetics', 'Ecology', 'Evolution', 'Physiology', 'Reproduction'] },
  { name: 'Agriculture', category: 'Sciences', topics: ['Soil science', 'Crop production', 'Animal husbandry', 'Agricultural economics'] },
  { name: 'Economics', category: 'Social Sciences', topics: ['Demand and supply', 'Production theory', 'National income', 'Money and banking', 'International trade'] },
  { name: 'Government', category: 'Social Sciences', topics: ['Political concepts', 'Constitution', 'Arms of government', 'Political parties', 'Foreign policy'] },
  { name: 'Geography', category: 'Social Sciences', topics: ['Physical geography', 'Human geography', 'Map reading', 'Regional geography'] },
  { name: 'Commerce', category: 'Social Sciences', topics: ['Trade', 'Business organisation', 'Finance', 'Marketing'] },
  { name: 'Principles of Accounts', category: 'Social Sciences', topics: ['Double entry', 'Trial balance', 'Final accounts', 'Control accounts'] },
  { name: 'Literature in English', category: 'Arts', topics: ['Prose', 'Poetry', 'Drama', 'Literary devices', 'Contextual questions'] },
  { name: 'History', category: 'Arts', topics: ['West African history', 'Nigerian history', 'World history', 'Historiography'] },
  { name: 'Christian Religious Studies', category: 'Arts', topics: ['Old Testament', 'New Testament', 'Themes and teachings'] },
  { name: 'Islamic Studies', category: 'Arts', topics: ['Quran', 'Hadith', 'Fiqh', 'Islamic history'] },
  { name: 'Hausa', category: 'Arts', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Igbo', category: 'Arts', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Yoruba', category: 'Arts', topics: ['Grammar', 'Comprehension', 'Composition', 'Literature'] },
  { name: 'Arabic', category: 'Arts', topics: ['Grammar', 'Reading', 'Composition', 'Literature'] },
  { name: 'Art', category: 'Arts', topics: ['Drawing', 'Design', 'Art history', 'Creative expression'] },
  { name: 'French', category: 'Arts', topics: ['Grammar', 'Reading', 'Writing', 'Oral'] },
  { name: 'Music', category: 'Arts', topics: ['Theory', 'African music', 'History of music', 'Notation'] },
  { name: 'Home Economics', category: 'Arts', topics: ['Nutrition', 'Food preparation', 'Clothing and textiles', 'Home management'] },
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
  { course: 'Mass Communication', faculty: 'Arts', subjects: ['Use of English', 'Literature in English', 'Government', 'Economics'] },
  { course: 'Accounting', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Principles of Accounts'] },
  { course: 'Business Administration', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Commerce'] },
  { course: 'Economics', faculty: 'Social & Management', subjects: ['Use of English', 'Mathematics', 'Economics', 'Government'] },
  { course: 'Political Science', faculty: 'Social & Management', subjects: ['Use of English', 'Government', 'Economics', 'Literature in English'] },
  { course: 'Agriculture', faculty: 'Agriculture', subjects: ['Use of English', 'Chemistry', 'Biology', 'Agriculture'] },
  { course: 'Education (various)', faculty: 'Education', subjects: ['Use of English', 'Mathematics', 'Biology', 'Chemistry'] },
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
