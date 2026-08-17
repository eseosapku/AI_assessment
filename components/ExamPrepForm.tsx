'use client'

import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Check, ExternalLink, Loader2, BookOpen, GraduationCap, FileText } from 'lucide-react'
import {
  WAEC_SUBJECTS,
  JAMB_UTME_SUBJECTS,
  JAMB_COURSE_COMBOS,
  examPrepContext,
} from '@/lib/nigeria-exam-syllabi'
import { allExamPrepResources } from '@/lib/exam-prep-resources'
import { useAuth } from '@/components/AuthProvider'
import { useSubscription } from '@/components/SubscriptionProvider'
import { isPaymentRequiredResponse } from '@/lib/subscription'

type ExamType = 'waec' | 'jamb'
type QuestionFormat = 'mcq' | 'longform' | 'mixed'

type PastPaper = {
  id: number
  name: string
  year: number
  subject: string
  diet: string
  hasSourceText: boolean
}

const DIFFICULTY_LEVELS = [
  { id: 'average', label: 'Standard', description: 'Typical exam difficulty' },
  { id: 'intermediate', label: 'Challenging', description: 'Upper-band WASSCE / UTME style' },
  { id: 'advanced', label: 'Exam-hard', description: 'Stretch questions, strict marking' },
]

export default function ExamPrepForm() {
  const router = useRouter()
  const { user } = useAuth()
  const { canGenerateAssessment, handlePaymentRequired, refresh } = useSubscription()
  const [exam, setExam] = useState<ExamType | ''>('')
  const [subject, setSubject] = useState('')
  const [jambMode, setJambMode] = useState<'subject' | 'course'>('subject')
  const [course, setCourse] = useState('')
  const [comboSubject, setComboSubject] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState('average')
  const [count, setCount] = useState(10)
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>('mcq')
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null)
  const [loadingPapers, setLoadingPapers] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const subjects = exam === 'waec' ? WAEC_SUBJECTS : exam === 'jamb' ? JAMB_UTME_SUBJECTS : []
  const selectedSubject = subjects.find((s) => s.name === subject)
  const resources = exam ? allExamPrepResources(exam) : []

  const jambCombo = useMemo(
    () => JAMB_COURSE_COMBOS.find((c) => c.course === course),
    [course],
  )

  const selectedPaper = pastPapers.find((p) => p.id === selectedPaperId)
  const hasPastPapers = pastPapers.length > 0
  const syllabusFallback = Boolean(selectedSubject && !loadingPapers && !hasPastPapers)

  useEffect(() => {
    if (!exam || !subject) {
      setPastPapers([])
      setSelectedPaperId(null)
      return
    }
    const load = async () => {
      setLoadingPapers(true)
      try {
        const res = await fetch(`/api/exam-sources?exam=${exam}&subject=${encodeURIComponent(subject)}`)
        const json = await res.json()
        const papers = Array.isArray(json?.data) ? json.data.filter((p: PastPaper) => p.hasSourceText) : []
        setPastPapers(papers)
        setSelectedPaperId(papers.length > 0 ? papers[0].id : null)
      } catch {
        setPastPapers([])
        setSelectedPaperId(null)
      } finally {
        setLoadingPapers(false)
      }
    }
    load()
  }, [exam, subject])

  const readyForSettings = Boolean(
    selectedSubject
    && !loadingPapers
    && (hasPastPapers ? selectedPaperId : topics.length > 0),
  )

  const step = !exam ? 1
    : !subject && !(exam === 'jamb' && jambMode === 'course' && course) ? 2
    : !readyForSettings ? 3
    : 4

  const toggleTopic = (name: string) => {
    setTopics((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]))
  }

  const selectAllTopics = () => {
    if (!selectedSubject) return
    setTopics(selectedSubject.topics)
  }

  const clearTopics = () => setTopics([])

  const handleGenerate = async () => {
    if (!exam || !subject) return
    if (!canGenerateAssessment) {
      handlePaymentRequired('assessment')
      return
    }
    if (hasPastPapers && !selectedPaperId) return
    if (!hasPastPapers && topics.length === 0) return

    setError('')
    setIsGenerating(true)
    try {
      const qType: QuestionFormat = exam === 'jamb' ? 'mcq' : questionFormat
      const paper = selectedPaper
      const promptTopics = topics.length > 0
        ? topics
        : paper
          ? [`${paper.year} ${paper.diet} past paper`]
          : []

      const res = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          subject,
          topics: promptTopics,
          count,
          style: exam === 'waec' ? 'WASSCE practice' : 'JAMB UTME practice',
          className: exam === 'waec' ? 'SS3 WASSCE' : 'UTME Candidate',
          curriculum: exam,
          difficultyLevel: difficulty,
          questionType: qType,
          textbook_id: paper?.id ?? undefined,
          examPrepContext: examPrepContext(
            exam,
            subject,
            promptTopics,
            [
              jambCombo ? `Target course: ${jambCombo.course} (${jambCombo.faculty}). UTME subjects: ${jambCombo.subjects.join(', ')}` : '',
              paper
                ? `Primary source: ${paper.year} ${paper.diet} synced past-question bank. Adapt real past questions; preserve official exam style and difficulty.`
                : 'No synced past paper for this subject — generate syllabus-aligned practice questions only.',
              topics.length > 0 && paper
                ? `Focus on: ${topics.join('; ')}. Use the past paper first; if it does not contain enough questions for these areas, add new syllabus-aligned questions in the same ${exam.toUpperCase()} style to reach the requested count.`
                : paper
                  ? 'Draw from across the full past paper — vary topics and question styles.'
                  : '',
              exam === 'waec' && qType !== 'mcq'
                ? 'Include WASSCE Paper 2 style theory: structured answers, definitions, explanations, and worked problems. Describe any diagram in words when needed.'
                : '',
              exam === 'jamb' && paper
                ? 'Where the source references figures or diagrams, describe them clearly in the question stem so they are answerable without a separate image.'
                : '',
            ].filter(Boolean).join(' '),
          ),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (isPaymentRequiredResponse(res.status, json)) {
          await refresh()
          handlePaymentRequired('assessment')
          return
        }
        throw new Error(json?.error || 'Failed to generate assessment')
      }
      sessionStorage.setItem('currentAssessment', JSON.stringify(json))
      await refresh()
      router.push('/assessment')
    } catch (e: any) {
      setError(e?.message || 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Exam type */}
      <section className="glass dark:glass-dark rounded-2xl p-6">
        <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 1</p>
        <h2 className="text-xl font-bold text-ss-ink dark:text-white mb-4">Choose your exam</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            { id: 'waec' as const, label: 'WAEC WASSCE', desc: 'West African Senior School Certificate', icon: BookOpen },
            { id: 'jamb' as const, label: 'JAMB UTME', desc: 'University matriculation practice', icon: GraduationCap },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setExam(opt.id); setSubject(''); setCourse(''); setTopics([]) }}
              className={`text-left p-4 rounded-xl border transition-all ${exam === opt.id
                ? 'border-ss-accent bg-ss-accent-soft dark:bg-ss-accent-soft'
                : 'border-ss-line dark:border-white/10 hover:border-ss-accent'}`}
            >
              <opt.icon className="w-5 h-5 text-ss-accent mb-2" />
              <p className="font-bold text-ss-ink dark:text-white">{opt.label}</p>
              <p className="text-xs text-ss-slate mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Step 2: Subject */}
      {exam && step >= 2 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass dark:glass-dark rounded-2xl p-6">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 2</p>
          <h2 className="text-xl font-bold text-ss-ink dark:text-white mb-4">Select subject</h2>

          {exam === 'jamb' && (
            <div className="flex gap-2 mb-4">
              {(['subject', 'course'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setJambMode(m); setSubject(''); setCourse(''); setTopics([]) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${jambMode === m
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700'
                    : 'border-ss-line dark:border-white/10'}`}
                >
                  {m === 'subject' ? 'By subject' : 'By course combo'}
                </button>
              ))}
            </div>
          )}

          {exam === 'jamb' && jambMode === 'course' ? (
            <div className="space-y-3">
              <select
                value={course}
                onChange={(e) => {
                  const c = JAMB_COURSE_COMBOS.find((x) => x.course === e.target.value)
                  setCourse(e.target.value)
                  const first = c?.subjects[1] ?? ''
                  setComboSubject(first)
                  setSubject(first)
                  setTopics([])
                }}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-ss-line dark:border-white/10 bg-ss-panel dark:bg-ss-panel/5"
              >
                <option value="">Select target course</option>
                {JAMB_COURSE_COMBOS.map((c) => (
                  <option key={c.course} value={c.course}>{c.course} — {c.faculty}</option>
                ))}
              </select>
              {jambCombo && (
                <div>
                  <p className="text-xs text-ss-slate mb-2">UTME subject combination (English is compulsory for all):</p>
                  <div className="flex flex-wrap gap-2">
                    {jambCombo.subjects.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setComboSubject(s); setSubject(s); setTopics([]) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${comboSubject === s || subject === s
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-800'
                          : 'border-ss-line dark:border-white/10'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {subjects.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => { setSubject(s.name); setTopics([]) }}
                  className={`text-left px-3 py-2 rounded-lg text-sm border ${subject === s.name
                    ? 'border-ss-accent bg-ss-accent-soft dark:bg-ss-accent-soft font-semibold'
                    : 'border-ss-line dark:border-white/10'}`}
                >
                  {s.name}
                  <span className="block text-[12px] text-ss-slate">{s.category}</span>
                </button>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* Step 3: Past paper (+ optional topic focus) */}
      {selectedSubject && step >= 3 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass dark:glass-dark rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 3</p>
            <h2 className="text-xl font-bold text-ss-ink dark:text-white">
              {hasPastPapers ? 'Choose past paper year' : 'Syllabus topics'}
            </h2>
            <p className="text-xs text-ss-slate mt-1">
              {hasPastPapers
                ? 'Practice from real synced past questions. Optionally narrow to specific syllabus areas below.'
                : 'No past paper synced for this subject yet — pick topics to generate syllabus-style practice.'}
            </p>
          </div>

          {loadingPapers ? (
            <p className="text-sm text-ss-slate flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading past papers…
            </p>
          ) : hasPastPapers ? (
            <div>
              <h3 className="text-sm font-semibold text-ss-ink dark:text-white mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-ss-accent" />
                Past paper
              </h3>
              <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {pastPapers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPaperId(p.id)}
                    className={`text-left px-3 py-2 rounded-lg text-sm border ${selectedPaperId === p.id
                      ? 'border-ss-accent bg-ss-accent-soft dark:bg-ss-accent-soft font-semibold'
                      : 'border-ss-line dark:border-white/10'}`}
                  >
                    {p.year} — {p.diet?.replace(/-/g, ' ')}
                    <span className="block text-[12px] text-ss-slate">Synced past questions</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">No past papers available yet for {subject}.</p>
              <p className="text-xs mt-1 text-amber-800/80 dark:text-amber-300/80">
                Select at least one syllabus topic below. Past papers are added automatically when synced.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-ss-ink dark:text-white">
                  {hasPastPapers ? 'Focus topics (optional)' : 'Syllabus topics'}
                </h3>
                {hasPastPapers && (
                  <p className="text-[12px] text-ss-slate mt-0.5">
                    We use the past paper first; extra syllabus questions fill gaps if needed.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {topics.length > 0 && (
                  <button type="button" onClick={clearTopics} className="text-xs font-semibold text-ss-slate hover:underline">
                    Clear
                  </button>
                )}
                <button type="button" onClick={selectAllTopics} className="text-xs font-semibold text-ss-accent hover:underline">
                  Select all
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedSubject.topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${topics.includes(t)
                    ? 'border-ss-accent bg-ss-accent text-white'
                    : 'border-ss-line dark:border-white/10 text-ss-ink dark:text-gray-300'}`}
                >
                  {topics.includes(t) && <Check className="w-3 h-3 inline mr-1" />}
                  {t}
                </button>
              ))}
            </div>
            {syllabusFallback && topics.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">Select at least one topic to continue.</p>
            )}
          </div>
        </motion.section>
      )}

      {/* Step 4: Generate */}
      {readyForSettings && step >= 4 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass dark:glass-dark rounded-2xl p-6">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 4</p>
          <h2 className="text-xl font-bold text-ss-ink dark:text-white mb-4">Practice settings</h2>
          {selectedPaper && (
            <p className="text-xs text-ss-slate mb-4">
              Source: <span className="font-semibold text-ss-ink dark:text-gray-300">{selectedPaper.year} {selectedPaper.diet?.replace(/-/g, ' ')}</span>
              {topics.length > 0 && (
                <> · Focus: <span className="font-semibold text-ss-ink dark:text-gray-300">{topics.length} topic{topics.length === 1 ? '' : 's'}</span></>
              )}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {exam === 'waec' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-ss-slate uppercase">Question format</label>
                <select
                  value={questionFormat}
                  onChange={(e) => setQuestionFormat(e.target.value as QuestionFormat)}
                  className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-ss-line dark:border-white/10 bg-ss-panel dark:bg-ss-panel/5"
                >
                  <option value="mcq">Objective (Paper 1 style)</option>
                  <option value="longform">Theory (Paper 2 style)</option>
                  <option value="mixed">Mixed objective + theory</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-ss-slate uppercase">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-ss-line dark:border-white/10 bg-ss-panel dark:bg-ss-panel/5">
                {DIFFICULTY_LEVELS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ss-slate uppercase">Questions</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-ss-line dark:border-white/10 bg-ss-panel dark:bg-ss-panel/5">
                {[5, 10, 15, 20, 25, 40].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-ss-accent hover:brightness-95 text-white font-bold disabled:opacity-60"
          >
            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <>Start practice <ChevronRight className="w-4 h-4" /></>}
          </button>
        </motion.section>
      )}

      {/* Official links — footer */}
      {exam && resources.length > 0 && (
        <details className="rounded-2xl border border-ss-line dark:border-white/10 bg-ss-panel/40 dark:bg-ss-panel/[0.02] p-4">
          <summary className="text-xs font-semibold text-ss-slate cursor-pointer select-none">
            Official {exam.toUpperCase()} resources &amp; syllabuses
          </summary>
          <ul className="space-y-2 mt-3">
            {resources.map((r) => (
              <li key={`${r.url}-${r.title}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-ss-accent dark:text-ss-accent hover:underline"
                >
                  {r.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
