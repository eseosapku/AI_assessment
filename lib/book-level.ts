/**
 * A textbook's subject and the level its learners are at, from its name --
 * for the prompts that write and check its figure questions
 * (scripts/build-figure-question-bank.ts).
 *
 * Cambridge books name a stage; the Rwanda books name a class, P1-P6 or
 * S1-S6, and many subjects the Cambridge list never needed.
 */
import { stageOfBook } from './textbook-figure-bank'

export function subjectOfBook(name: string): string {
  const n = name.toLowerCase()
  if (/second language/.test(n)) return 'English as a Second Language'
  // Before the default: "Oxford English for Cambridge Primary" fell through to
  // Science, and its figures were written to as Science.
  if (/\benglish\b|literature/.test(n)) return 'English'
  if (/global perspectives/.test(n)) return 'Global Perspectives'
  // The Rwanda books' subjects, which the Cambridge list never needed.
  if (/geograph/.test(n)) return 'Geography'
  if (/histor/.test(n)) return /citizenship/.test(n) ? 'History and Citizenship' : 'History'
  if (/econom/.test(n)) return 'Economics'
  if (/business/.test(n)) return 'Business Studies'
  if (/environmental management/.test(n)) return 'Environmental Management'
  if (/entrepreneur/.test(n)) return 'Entrepreneurship'
  if (/agri/.test(n)) return 'Agriculture'
  if (/account|taxation/.test(n)) return 'Accounting'
  if (/music/.test(n)) return 'Music'
  if (/fine art|creative art/.test(n)) return 'Creative Arts'
  if (/physical education|\bpes\b/.test(n)) return 'Physical Education'
  if (/religion/.test(n)) return 'Religious Education'
  if (/psycholog/.test(n)) return 'Psychology'
  if (/home science/.test(n)) return 'Home Science'
  if (/\bsst\b|social studies/.test(n)) return 'Social Studies'
  if (/\bset\b|elementary technology/.test(n)) return 'Science and Elementary Technology'
  if (/gscs|general studies/.test(n)) return 'General Studies and Communication Skills'
  if (/biology/.test(n)) return 'Biology'
  if (/chemistry/.test(n)) return 'Chemistry'
  if (/physics/.test(n)) return 'Physics'
  if (/science/.test(n)) return 'Science'
  if (/math/.test(n)) return 'Mathematics'
  if (/comput|ict|\bit\b|information and communic/.test(n)) return 'Computing'
  return 'Science'
}
export function levelOfBook(name: string): string {
  // Rwanda: Primary 1-6 from age 7, Senior 1-6 from age 13.
  const senior = ['one', 'two', 'three', 'four', 'five', 'six']
  const p = name.match(/\bP\s?([1-6])\b/i)?.[1]
  // Not \b: "Physics_Students Book_Senior Five" -- an underscore is a word character.
  const sw = name.match(/(?:^|[^a-z])senior\s+(one|two|three|four|five|six)\b/i)?.[1]
  const sn = name.match(/\bS\s?([1-6])\b/i)?.[1] ?? (sw ? String(senior.indexOf(sw.toLowerCase()) + 1) : undefined)
  if (p) return `Rwanda Primary ${p} (age about ${Number(p) + 6})`
  if (sn) return `Rwanda Senior ${sn} (age about ${Number(sn) + 12})`
  const s = stageOfBook(name)
  if (s == null) return 'secondary level'
  if (s >= 12) return 'AS & A Level (age 16-18)'
  return s >= 10 ? 'IGCSE (age 15-16)' : `Stage ${s}`
}
