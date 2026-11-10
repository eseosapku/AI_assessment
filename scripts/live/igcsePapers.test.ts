/**
 * Short IGCSE quizzes through the local generator, using the IGCSE papers.
 * Not the deployed Lambda: that copy does not have these papers until a push.
 *
 *   npx vitest run --config vitest.live.config.ts scripts/live/igcsePapers.test.ts
 */
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { NextRequest } from 'next/server'
import { generateAssessment } from '@/lib/assessment-generation'
import { paperGroups } from '@/lib/exam-parts'
import { loadCambridgeStyle } from '@/lib/past-paper/cambridge-style'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

describe('IGCSE past papers', () => {
  it('generates practice and exam assessments for every native subject and fallback physics', async () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    })
    const { rows } = await pool.query(
      `SELECT textbook_id, textbook_name FROM textbooks WHERE curriculum = 1`,
    )
    const wanted: [RegExp, string, boolean?][] = [
      [/biology/i, 'biology'],
      [/chemistry/i, 'chemistry'],
      [/(?:computer science|\bict\b|information and communication technology)/i, 'computer_science'],
      [/econom/i, 'economics'],
      [/english/i, 'english'],
      [/geography/i, 'geography'],
      [/history/i, 'history'],
      [/math/i, 'math'],
      [/physics/i, 'physics', true],
    ]
    const picks = wanted.map(([pattern, subject, fallback = false]) => {
      const book = rows.find((row) => /igcse/i.test(String(row.textbook_name)) && pattern.test(String(row.textbook_name)))
      return book ? { ...book, subject, fallback } : null
    })
    expect(picks.every(Boolean)).toBe(true)

    const ids: string[] = []
    try {
      let requestIndex = 0
      for (const book of picks) {
        const title = String(book!.textbook_name)
        const style = loadCambridgeStyle(title, 1)
        expect(style?.level).toBe('igcse')
        expect(style?.subject).toBe(book!.subject)
        expect(style?.derived).toBe(book!.fallback)
        if (book!.fallback) {
          expect(style?.sources?.map((source) => source.level)).toEqual(['o_level', 'as_and_a_level'])
          expect(style?.sources?.every((source) => source.subject === 'physics')).toBe(true)
        } else {
          expect(style?.sources).toBeUndefined()
        }
        const topicRows = await pool.query(
          `SELECT topic FROM topics WHERE textbook_id = $1 AND topic IS NOT NULL LIMIT 2`,
          [book!.textbook_id],
        )
        for (const exam of [false, true]) {
          requestIndex += 1
          const body = {
            subject: title,
            topics: topicRows.rows.map((row) => String(row.topic)).filter(Boolean).slice(0, 2),
            textbook_id: book!.textbook_id,
            count: 2,
            questionType: exam ? 'longform' : 'mcq',
            style: exam ? 'Exam Style (Past Papers)' : 'Test Style (Textbooks)',
            className: 'Year 10',
            grade: 10,
            curriculum: 'cambridge',
            difficultyLevel: 'average',
          }
          const request = new NextRequest('http://internal/api/generate-assessment', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.8.4.${requestIndex}` },
            body: JSON.stringify(body),
          })
          const started = Date.now()
          const response = await generateAssessment(request)
          const json = await response.json()
          const questions = Array.isArray(json.questions) ? json.questions : []
          const numbered = exam ? paperGroups(questions).length : questions.length
          console.log(`${book!.subject}/${exam ? 'exam' : 'practice'} status=${response.status} numbered=${numbered} parts=${questions.length} seconds=${Math.round((Date.now() - started) / 1000)} ${json.error ?? ''}`)
          expect(response.status, JSON.stringify(json)).toBe(200)
          expect(numbered).toBe(2)
          if (exam) {
            expect(paperGroups(questions).every((group) => group.end - group.start >= 2 && group.end - group.start <= 3)).toBe(true)
          }
          if (json.assessment_id && json.assessment_id !== 'auto') ids.push(String(json.assessment_id))
        }
      }
    } finally {
      if (ids.length) {
        await pool.query(`DELETE FROM assessments WHERE id = ANY($1::uuid[]) AND user_id IS NULL`, [ids])
      }
      await pool.end()
    }
  }, 1_200_000)
})
