import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import { supabase } from '@/lib/supabase'
import { listCachedExamPapers } from '@/lib/exam-source-cache'
import { examSubjectMatches } from '@/lib/exam-subject-aliases'

const CURRICULUM_BY_EXAM: Record<string, number> = { waec: 3, jamb: 4 }
let autoSyncAttempted = false

function ensureExamCache() {
  if (autoSyncAttempted || listCachedExamPapers().length > 0) return
  autoSyncAttempted = true
  try {
    const script = path.join(process.cwd(), 'scripts', 'sync-exam-question-banks.js')
    execSync(`node "${script}"`, { stdio: 'ignore', timeout: 120_000 })
  } catch {
    // Non-fatal — syllabus-only mode still works
  }
}

export async function GET(request: NextRequest) {
  try {
    const exam = String(request.nextUrl.searchParams.get('exam') ?? '').toLowerCase()
    const subject = String(request.nextUrl.searchParams.get('subject') ?? '').trim()
    const curriculum = CURRICULUM_BY_EXAM[exam]

    if (!curriculum) {
      return NextResponse.json({ error: 'exam must be waec or jamb' }, { status: 400 })
    }

    ensureExamCache()

    const cached = listCachedExamPapers(exam, subject || undefined).map((p) => ({
      id: p.id,
      name: p.name,
      year: p.year,
      subject: p.subject,
      diet: p.diet,
      charCount: p.charCount,
      authority: p.authority,
      hasSourceText: (p.charCount ?? 0) > 500,
      source: 'cache' as const,
    }))

    let query = supabase
      .from('textbooks')
      .select('textbook_id, textbook_name, filename, exam_year, exam_subject, exam_diet, source_char_count, source_authority')
      .eq('curriculum', curriculum)
      .not('exam_year', 'is', null)
      .order('exam_year', { ascending: false })

    const { data, error } = await query

    if (error) {
      if (/column .* does not exist/i.test(error.message ?? '')) {
        const years = Array.from(new Set(cached.map((p) => p.year).filter(Boolean))).sort((a, b) => (b as number) - (a as number))
        return NextResponse.json({ data: cached, years, count: cached.length, source: 'cache' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let rows = data ?? []
    if (subject) {
      rows = rows.filter((r) =>
        examSubjectMatches(subject, String(r.exam_subject ?? ''))
        || examSubjectMatches(subject, String(r.textbook_name ?? '')),
      )
    }

    const dbPapers = rows.map((r) => ({
      id: r.textbook_id,
      name: r.textbook_name,
      year: r.exam_year,
      subject: r.exam_subject,
      diet: r.exam_diet,
      charCount: r.source_char_count,
      authority: r.source_authority,
      hasSourceText: (r.source_char_count ?? 0) > 500,
      source: 'db' as const,
    }))

    const seen = new Set(dbPapers.map((p) => `${p.year}-${p.subject}-${p.diet}`))
    const merged = [
      ...dbPapers,
      ...cached.filter((p) => !seen.has(`${p.year}-${p.subject}-${p.diet}`)),
    ]

    const years = Array.from(new Set(merged.map((p) => p.year).filter(Boolean))).sort((a, b) => (b as number) - (a as number))

    return NextResponse.json({ data: merged, years, count: merged.length })
  } catch (err) {
    console.error('Exam sources error:', err)
    return NextResponse.json({ error: 'Failed to load exam sources' }, { status: 500 })
  }
}
