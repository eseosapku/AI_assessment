// scripts/figure-library/subjects.test.ts
import { describe, it, expect } from 'vitest'
import { subjectKey } from './subjects'

// Real names from the textbooks table and the WAEC, JAMB and Checkpoint syllabi.
const CASES: [string, string][] = [
  ['Advanced Mathematics S6 SB (1)', 'mathematics'],
  ['Sub Maths S4 Adapted SB 2022 LFK, HLP and HGL', 'mathematics'],
  ['Mathematcs for Accounting Option', 'mathematics'],
  ['NERDC Senior Secondary 1 — Further Mathematics', 'mathematics'],
  ['Cambridge International AS and A Level Mathematics Probability Statistics 1 Coursebook', 'mathematics'],
  ['S1 Chemistry SB', 'chemistry'],
  ['IGCSE-Physics-Coursebook-by-David-Sang', 'physics'],
  ['Cambridge IGCSE Biology MARRY JONES 4th Ed', 'biology'],
  ['P1-SET-PB. (1)', 'science'],
  ['NERDC Junior Secondary 2 — Intermediate Science', 'science'],
  ['Cambridge Primary Science 3 Learners', 'science'],
  ['Ibidukikije N3', 'science'],
  ['Geography and Environment', 'geography'],
  ['Cambridge IGCSE® and O Level Environmental Management Coursebook', 'geography'],
  ['History and Citizenship SB S2', 'history'],
  ['NERDC Primary 5 — Nigerian History', 'history'],
  ['NERDC Senior Secondary 2 — Citizenship and Heritage Studies', 'social-studies'],
  ['GENERAL EDU-GSCS-S4-SB', 'social-studies'],
  ['P3-SST-PB', 'social-studies'],
  ['Civic Education', 'social-studies'],
  ['Government', 'social-studies'],
  ['NERDC Junior Secondary 1 — Christian Religious Studies', 'religion'],
  ['Religion and Ethics', 'religion'],
  ['Economics S4 SB', 'economics'],
  ['Financial Accounting Experimental Version', 'accounting'],
  ['Principles of Accounts', 'accounting'],
  ['Book Keeping', 'accounting'],
  ['Entrepreneurship S1', 'business'],
  ['Office Practice', 'business'],
  ['NERDC Senior Secondary 3 — Marketing', 'business'],
  ['ICT S4 Adapted SB 2022', 'computing'],
  ['ICT in Accounting', 'computing'],
  ['Cambridge International AS A Level IT Coursebook with Digital Access', 'computing'],
  ['Data Processing', 'computing'],
  ['Click Start Computing for Schools 6 (syllabus outline)', 'computing'],
  ['PES TG in Accounting Experimental Version', 'physical-education'],
  ['Physical and Health Education', 'physical-education'],
  ['Agricultural Science', 'agriculture'],
  ['Animal Husbandry', 'agriculture'],
  ['AGRIC S2 SB', 'agriculture'],
  ['NERDC Primary 4 — Pre-vocational Studies', 'vocational'],
  ['NERDC Junior Secondary 1 — Trade: Livestock Farming', 'vocational'],
  ['Auto Mechanics', 'vocational'],
  ['Catering Craft Practice', 'home-science'],
  ['Home Economics', 'home-science'],
  ['GENERAL EDU-Literature in english-S6-SB', 'literature'],
  ['Read Aloud Stories Term 1', 'english'],
  ['Use of English', 'english'],
  ['English as a Second Language', 'english'],
  ['FRENCH S4 LKK SB', 'french'],
  ['Cambridge IGCSE™ German Second', 'german'],
  ['NERDC Junior Secondary 1 — Arabic Language', 'arabic'],
  ['Kiswahili', 'kiswahili'],
  ['NERDC Senior Secondary 1 — Yoruba', 'nigerian-languages'],
  ['Music S2 SB', 'music'],
  ['Fine Art and Crafts S1 SB', 'art'],
  ['NERDC Primary 1 — Cultural and Creative Arts', 'art'],
  ['Visual Arts', 'art'],
  ['Technical Drawing', 'technical-drawing'],
  ['Psychology', 'psychology'],
]

describe('the subject a book or syllabus belongs to', () => {
  it.each(CASES)('%s → %s', (name, key) => {
    expect(subjectKey(name)).toBe(key)
  })
  it('says "other" rather than guessing', () => {
    expect(subjectKey('Something nobody teaches')).toBe('other')
  })
})
