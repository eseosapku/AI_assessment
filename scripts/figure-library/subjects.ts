// scripts/figure-library/subjects.ts
/**
 * One subject key per book or syllabus subject, so concepts can be shared
 * across curricula. canonicalSubject() is for display and keeps NERDC's class
 * in the name (307 groups); this needs about 40.
 *
 * Order matters: trades before agriculture, agriculture before science
 * ("Agricultural Science"), PE and ICT before accounting ("PES in
 * Accounting", "ICT in Accounting"), literature before English. "Home
 * Economics" is caught before the economics rule.
 */
const RULES: [RegExp, string][] = [
  [/\btrade:|auto mechanic|garment making/i, 'vocational'],
  [/pre[- ]?vocational/i, 'vocational'],
  [/physical (and health )?education|\bpes\b|\bsports?\b/i, 'physical-education'],
  [/\bict\b|information (and communication )?technology|computer|computing|digital (technolog|literacy)|data processing|\bit (coursebook|for)\b/i, 'computing'],
  [/math|statistic|probabilit/i, 'mathematics'],
  [/biolog/i, 'biology'],
  [/chemi/i, 'chemistry'],
  [/physic/i, 'physics'],
  [/geograph|environmental management/i, 'geography'],
  // Before science: "Agricultural Science" is agriculture.
  [/agricult|\bagric\b|husbandry|horticult|livestock/i, 'agriculture'],
  [/basic science|intermediate science|elementary technology|\bset\b|\bscience\b|ibidukikije/i, 'science'],
  [/histor/i, 'history'],
  [/citizenship|civic|government|social studies|\bsst\b|global perspective|\bgscs\b|general studies/i, 'social-studies'],
  [/religio|christian|islamic|ethic/i, 'religion'],
  [/econom/i, 'economics'],
  [/accounti|accounts|book ?keeping|taxation/i, 'accounting'],
  [/business|commerce|entrep|marketing|office practice/i, 'business'],
  [/home (science|economics)|food and nutrition|catering/i, 'home-science'],
  [/literat/i, 'literature'],
  [/english|\besl\b|read aloud/i, 'english'],
  [/french/i, 'french'],
  [/german/i, 'german'],
  [/arabic/i, 'arabic'],
  [/kiswahili|swahili/i, 'kiswahili'],
  [/kinyarwanda/i, 'kinyarwanda'],
  [/hausa|igbo|yoruba|nigerian languages/i, 'nigerian-languages'],
  [/music|dance|drama/i, 'music'],
  [/technical drawing/i, 'technical-drawing'],
  [/\bfine arts?\b|\bcrafts?\b|visual arts|creative arts|\bart\b/i, 'art'],
  [/psycholog/i, 'psychology'],
]

export function subjectKey(name: string): string {
  const n = String(name ?? '')
  if (/home economics/i.test(n)) return 'home-science'
  for (const [pattern, key] of RULES) if (pattern.test(n)) return key
  return 'other'
}
