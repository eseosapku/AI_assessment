/**
 * What a Cambridge syllabus code is a paper IN.
 *
 * The second archive names its papers by code alone — `0610_m16_qp_12.pdf`,
 * `5090_s17_qp_21.pdf` — so a figure pulled from one arrived in the library
 * called "Cambridge past paper: 0610_m16_qp_12" and nothing downstream could
 * tell what subject it belonged to.
 *
 * That matters because the subject gate reads the book's NAME. An unlabelled
 * figure passes every check, which is how a Business Studies pyramid ended up
 * beside a Stage 9 Science question about reproduction. Resolving the code
 * turns 1,519 anonymous papers into labelled ones.
 *
 * The level is in the code range: 0xxx is IGCSE, 2xxx–5xxx O Level, 9xxx AS
 * and A Level. Naming it here is what lets a Checkpoint paper refuse an A
 * Level figure.
 *
 * Only the codes actually present in the archive are listed. An unknown code
 * keeps the bare filename, which is honest — better an unlabelled figure than
 * a confidently mislabelled one.
 */

/** code -> [subject, level] */
const CAMBRIDGE_SYLLABI = {
  // Checkpoint -- Primary (Stage 6) and Lower Secondary (Stage 9).
  //
  // These were missing, and 6,295 of the 8,663 past-paper figures come from
  // papers named the way Cambridge names its own files -- 10_0862_01_7RP_AFP
  // -- with the subject in the CODE and nowhere in words. With no entry here
  // every one of them resolved to no subject at all, and a figure with no
  // subject passes the subject gate for every paper. That is how an
  // "Average earnings for writers" bar chart out of a Mathematics paper was
  // printed on a Science paper, and how a Maths fraction cartoon reached a
  // Science question.
  '0057': ['English as a Second Language', 'Checkpoint'],
  '0058': ['English', 'Checkpoint'],
  '0096': ['Mathematics', 'Checkpoint'],
  '0097': ['Science', 'Checkpoint'],
  '0861': ['English', 'Checkpoint'],
  '0862': ['Mathematics', 'Checkpoint'],
  '0876': ['English as a Second Language', 'Checkpoint'],
  '0893': ['Science', 'Checkpoint'],

  // IGCSE
  '0450': ['Business Studies', 'IGCSE'],
  '0452': ['Accounting', 'IGCSE'],
  '0455': ['Economics', 'IGCSE'],
  '0460': ['Geography', 'IGCSE'],
  '0470': ['History', 'IGCSE'],
  '0478': ['Computer Science', 'IGCSE'],
  '0500': ['English', 'IGCSE'],
  '0580': ['Mathematics', 'IGCSE'],
  '0606': ['Additional Mathematics', 'IGCSE'],
  '0610': ['Biology', 'IGCSE'],
  '0620': ['Chemistry', 'IGCSE'],
  '0625': ['Physics', 'IGCSE'],
  '0653': ['Combined Science', 'IGCSE'],
  '0654': ['Coordinated Sciences', 'IGCSE'],
  '0680': ['Environmental Management', 'IGCSE'],
  '0444': ['English as a Second Language', 'IGCSE'],
  '0445': ['Design and Technology', 'IGCSE'],
  '0446': ['Design and Technology', 'IGCSE'],
  '0417': ['Information and Communication Technology', 'IGCSE'],

  // O Level
  '2210': ['Computer Science', 'O Level'],
  '2217': ['Geography', 'O Level'],
  '2281': ['Economics', 'O Level'],
  '4024': ['Mathematics', 'O Level'],
  '4037': ['Additional Mathematics', 'O Level'],
  '5054': ['Physics', 'O Level'],
  '5070': ['Chemistry', 'O Level'],
  '5090': ['Biology', 'O Level'],
  '5129': ['Combined Science', 'O Level'],
  '7010': ['Computer Studies', 'O Level'],
  '7096': ['Travel and Tourism', 'O Level'],
  '7100': ['Commerce', 'O Level'],
  '7110': ['Principles of Accounts', 'O Level'],
  '7115': ['Business Studies', 'O Level'],

  // AS and A Level — named so a Checkpoint paper can refuse them.
  '9700': ['Biology', 'AS & A Level'],
  '9701': ['Chemistry', 'AS & A Level'],
  '9702': ['Physics', 'AS & A Level'],
  '9709': ['Mathematics', 'AS & A Level'],
  '9708': ['Economics', 'AS & A Level'],
}

/**
 * A readable book name for a paper file, or null when the code is unknown.
 *
 * "0610_m16_qp_12.pdf" becomes "Cambridge IGCSE Biology 0610 past paper",
 * which `subjectOfBook` reads as biology and `levelOfBook` as igcse.
 */
function cambridgeBookName(filename) {
  // Not \b: these files are named "0610_m16_qp_12" and an underscore is a word
  // character, so there is no boundary after the code at all.
  const code = String(filename || '').match(/(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/)
  if (!code) return null
  const hit = CAMBRIDGE_SYLLABI[code[1]]
  if (!hit) return null
  const [subject, level] = hit
  return `Cambridge ${level} ${subject} ${code[1]} past paper`
}

module.exports = { CAMBRIDGE_SYLLABI, cambridgeBookName }
