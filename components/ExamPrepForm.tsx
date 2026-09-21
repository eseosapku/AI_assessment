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
import {
  buildableSubjects,
  checkpointSubject,
  stageOf,
  type CheckpointProgramme,
} from '@/lib/cambridge-checkpoint'
import {
  applyBlueprint,
  paperTopics,
  type CheckpointPaper,
  type PaperMode,
} from '@/lib/checkpoint-paper'

type ExamType = 'waec' | 'jamb' | 'checkpoint'
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
  // Checkpoint asks a different question from WAEC and JAMB: which programme,
  // then which subject, then which component. The duration is never asked —
  // it comes from the syllabus, because Cambridge sets it.
  const [programme, setProgramme] = useState<CheckpointProgramme>('lower-secondary')
  const [component, setComponent] = useState('')
  // Sit the whole component, or drill one strand. This is the only choice about
  // the paper's shape a learner gets, and it is a real one: the first is the
  // exam, the second is revision.
  const [cpMode, setCpMode] = useState<PaperMode>('paper')
  const [cpStrand, setCpStrand] = useState('')
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
  // The Nigeria resource catalogue has nothing to say about Cambridge.
  const resources = exam === 'waec' || exam === 'jamb' ? allExamPrepResources(exam) : []

  // Checkpoint: only the subjects this phase built, and within one, only the
  // components that can be mocked. A component that cannot is still rendered —
  // with its reason — so a learner looking for ESL Listening learns why it is
  // absent rather than concluding the product forgot it.
  const cpSubjects = exam === 'checkpoint' ? buildableSubjects(programme) : []
  const cpSubject = exam === 'checkpoint' ? checkpointSubject(programme, subject) : undefined
  const cpComponent = cpSubject?.components.find((c) => c.number === component)

  // The paper the learner is about to sit, laid out before they commit to it,
  // so the briefing below shows the real thing — how many questions, how many
  // written, how the marks fall — instead of a promise about it.
  //
  // Laid out on the server: choosing foci the figure library can illustrate
  // means reading a 13MB manifest, which is not something to ship to a browser.
  const [cpPaper, setCpPaper] = useState<CheckpointPaper | null>(null)
  // The generator's instructions, built server-side beside the paper so the
  // brief and the paper the learner sees cannot drift apart.
  const [cpBrief, setCpBrief] = useState<string>('')
  const [cpShortCount, setCpShortCount] = useState(0)
  const [cpLayingOut, setCpLayingOut] = useState(false)
  // Which real sitting to imitate, and which ones this component has.
  // '' means the full syllabus spread, which is what it always did.
  const [cpSitting, setCpSitting] = useState('')
  const [cpSittings, setCpSittings] = useState<{ id: string; label: string; year: number; foci: number }[]>([])

  useEffect(() => {
    if (exam !== 'checkpoint' || !cpSubject || !cpComponent?.mockable) {
      setCpPaper(null)
      return
    }
    let current = true
    setCpLayingOut(true)
    ;(async () => {
      try {
        const res = await fetch('/api/checkpoint-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programme,
            subject: cpSubject.name,
            component: cpComponent.number,
            mode: cpMode,
            strand: cpStrand || undefined,
            sitting: cpSitting || undefined,
          }),
        })
        const json = await res.json()
        // Ignore a reply that arrives after the learner has moved on, or it
        // would overwrite the paper for the component they are now looking at.
        if (current) {
          setCpPaper(res.ok && json?.paper ? json.paper : null)
          setCpBrief(res.ok && typeof json?.examPrepContext === 'string' ? json.examPrepContext : '')
          setCpShortCount(res.ok ? Number(json?.shortCount) || 0 : 0)
        }
      } catch {
        if (current) { setCpPaper(null); setCpBrief(''); setCpShortCount(0) }
      } finally {
        if (current) setCpLayingOut(false)
      }
    })()
    return () => { current = false }
  }, [exam, programme, cpSubject?.name, cpComponent?.number, cpComponent?.mockable, cpMode, cpStrand, cpSitting])

  // Step 3 loads on its own, the moment a component is picked.
  //
  // It used to read the year list off the layout response, so it could not
  // appear until Step 4 had finished assembling a paper the learner had not
  // asked for yet. This reads a static file and answers in a millisecond.
  useEffect(() => {
    if (exam !== 'checkpoint' || !cpSubject || !cpComponent) { setCpSittings([]); return }
    let current = true
    ;(async () => {
      try {
        const res = await fetch(`/api/checkpoint-sittings?code=${cpSubject.code}&component=${cpComponent.number}`)
        const json = await res.json()
        if (current) setCpSittings(res.ok && Array.isArray(json?.sittings) ? json.sittings : [])
      } catch {
        if (current) setCpSittings([])
      }
    })()
    return () => { current = false }
  }, [exam, cpSubject?.code, cpComponent?.number])

  // A sitting belongs to one component: "0862-01-2025-april" means nothing on
  // 0893/02. Carrying it across would silently ask for a sitting that does not
  // exist and quietly fall back, so it is cleared when the choice above moves.
  useEffect(() => {
    setCpSitting('')
  }, [programme, cpSubject?.name, cpComponent?.number])

  // Counted by what the paper actually contains. This used to be written
  // answers against "everything else, called multiple choice", which told the
  // learner a 34-question Science paper held 17 multiple choice when it held
  // none at all: a real Checkpoint paper is mostly one-mark SHORT answers,
  // and ring-around appears about twice a Mathematics paper and almost never
  // in Science. Describing the paper wrongly is its own fault, separate from
  // building it wrongly.
  const cpCount = (f: string) => cpPaper?.slots.filter((s) => s.format === f).length ?? 0
  const cpWritten = cpCount('written')
  const cpShort = cpCount('short')
  const cpRing = cpCount('select')
  const cpInteractive = cpCount('tick') + cpCount('table')
  const cpMix = [
    cpShort ? `${cpShort} short answer${cpShort === 1 ? '' : 's'}` : '',
    cpWritten ? `${cpWritten} written` : '',
    cpRing ? `${cpRing} ring-around` : '',
    cpInteractive ? `${cpInteractive} tick or table` : '',
  ].filter(Boolean).join(', ')

  const jambCombo = useMemo(
    () => JAMB_COURSE_COMBOS.find((c) => c.course === course),
    [course],
  )

  const selectedPaper = pastPapers.find((p) => p.id === selectedPaperId)
  const hasPastPapers = pastPapers.length > 0
  const syllabusFallback = Boolean(selectedSubject && !loadingPapers && !hasPastPapers)

  useEffect(() => {
    // Checkpoint has no past-paper bank, and asking for one returns a 400 that
    // the catch below swallows — leaving a red error in the console on every
    // subject click and nothing to explain it.
    if (!exam || !subject || exam === 'checkpoint') {
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

  const readyForSettings = exam === 'checkpoint'
    // A Checkpoint component is ready once the subject and component are
    // chosen: the strands come from the syllabus, so there is no topic step.
    ? Boolean(cpSubject && cpComponent?.mockable)
    : Boolean(
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
    if (exam === 'checkpoint') {
      // Checkpoint has no past papers and no topic picker — its strands come
      // from the syllabus. Guarding it on either would refuse every Checkpoint
      // paper silently, which is what a dead "Start practice" button is.
      if (!cpSubject || !cpComponent?.mockable || !cpPaper) return
    } else {
      if (hasPastPapers && !selectedPaperId) return
      if (!hasPastPapers && topics.length === 0) return
    }

    setError('')
    setIsGenerating(true)
    try {
      // A Checkpoint paper mixes multiple choice with written answers that
      // carry marks, so the format is the paper's, not the learner's.
      const qType: QuestionFormat = exam === 'checkpoint'
        ? 'mixed'
        : exam === 'jamb' ? 'mcq' : questionFormat
      const paper = selectedPaper
      // Checkpoint's topics are the blueprint's foci — "photosynthesis",
      // "angles in parallel lines" — one per question.
      //
      // They used to be the strand names, which are the names of whole
      // disciplines rather than topics. Asked for fifteen questions against
      // "Biology, Chemistry, Physics, Earth and Space", the model wrote the
      // same handful of ideas repeatedly, the deduplicator removed the repeats,
      // and the paper came back short of the exact count the route demands —
      // which is a failed request, not a shorter paper.
      const promptTopics = exam === 'checkpoint'
        ? (cpPaper ? paperTopics(cpPaper) : [])
        : topics.length > 0
          ? topics
          : paper
            ? [`${paper.year} ${paper.diet} past paper`]
            : []

      // The blueprint, written out for the generator. Naming every question's
      // strand, focus and mark value is what stops it circling the same few
      // ideas — and it is also just what a paper plan is.
      const checkpointBrief = cpBrief

      const res = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          subject,
          topics: promptTopics,
          // A Checkpoint paper's length is a consequence of its marks, not a
          // number anybody picked. Fifty marks spent on one-mark multiple
          // choice and two- and three-mark written answers comes to this many
          // questions, and that is the only reason it is this many.
          count: exam === 'checkpoint' && cpPaper ? cpPaper.slots.length : count,
          style: exam === 'checkpoint'
            ? `Cambridge ${programme === 'primary' ? 'Primary' : 'Lower Secondary'} Checkpoint ${cpSubject?.code}/${component} practice`
            : exam === 'waec' ? 'WASSCE practice' : 'JAMB UTME practice',
          className: exam === 'checkpoint'
            ? `Stage ${stageOf(programme)}`
            : exam === 'waec' ? 'SS3 WASSCE' : 'UTME Candidate',
          grade: exam === 'checkpoint' ? stageOf(programme) : undefined,
          // customTime, not estimatedTime: the route reads only the former,
          // so Cambridge's published duration was being dropped and the paper
          // timed at whatever the question count implied — 2h25 on a
          // 45-minute component.
          customTime: exam === 'checkpoint' ? cpPaper?.minutes ?? undefined : undefined,
          // Splits generation by kind, so no batch decides which are short.
          shortCount: exam === 'checkpoint' ? cpShortCount : undefined,
          // One request per numbered question, each told its own parts.
          paperSlots: exam === 'checkpoint' && cpPaper
            ? cpPaper.slots.map((s) => ({ q: s.questionNumber, part: s.part, marks: s.marks, format: s.format, strand: s.strand, focus: s.focus }))
            : undefined,
          curriculum: exam,
          difficultyLevel: difficulty,
          questionType: qType,
          textbook_id: paper?.id ?? undefined,
          examPrepContext: exam === 'checkpoint'
            ? checkpointBrief
            : examPrepContext(
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
      // Tag before storing, and carry which paper this was. Both have to survive
      // into the result screen: without the strand tags there is nothing to
      // report, and without the paper's identity the report cannot say which
      // component it is reporting on.
      if (exam === 'checkpoint' && cpSubject && cpPaper && Array.isArray(json?.questions)) {
        // The blueprint assigns the marks and the strand, not the model. Asked
        // for a 2-mark question it returns `"marks": 6` often enough that
        // trusting it would make the totals meaningless, and it tags strands by
        // wording. Neither is a guess here: the question was commissioned
        // against that strand for that many marks.
        json.questions = applyBlueprint(json.questions, cpPaper)
        json.checkpoint = {
          programme,
          subject: cpSubject.name,
          code: cpSubject.code,
          component,
          mode: cpPaper.mode,
          strand: cpPaper.strand,
          totalMarks: cpPaper.totalMarks,
        }
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
          {/* Cambridge Checkpoint is sat in every country, so it is offered in
              every country and leads. The national exams are shown to the
              countries that sit them — WAEC and JAMB to Nigeria, and the same
              rule will hold for whatever is added next. A Rwandan student
              being offered JAMB is noise, not choice. */}
          {([
            { id: 'checkpoint' as const, label: 'Cambridge Checkpoint', desc: 'Primary and Lower Secondary practice papers', icon: BookOpen, countries: null },
            { id: 'waec' as const, label: 'WAEC WASSCE', desc: 'West African Senior School Certificate', icon: BookOpen, countries: ['NG'] },
            { id: 'jamb' as const, label: 'JAMB UTME', desc: 'University matriculation practice', icon: GraduationCap, countries: ['NG'] },
          ]).filter((opt) => !opt.countries || opt.countries.includes(user?.country ?? '')).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setExam(opt.id); setSubject(''); setCourse(''); setTopics([]); setComponent('') }}
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

          {exam === 'checkpoint' && (
            <div className="space-y-4">
              <div>
                <span id="cp-programme" className="block text-xs font-black uppercase tracking-widest text-ss-slate mb-2">
                  Programme
                </span>
                <div className="flex gap-2" role="radiogroup" aria-labelledby="cp-programme">
                  {([
                    { id: 'primary' as const, label: 'Primary', hint: 'End of Stage 6' },
                    { id: 'lower-secondary' as const, label: 'Lower Secondary', hint: 'End of Stage 9' },
                  ]).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={programme === p.id}
                      onClick={() => { setProgramme(p.id); setSubject(''); setComponent('') }}
                      className={`px-3 py-2 rounded-lg text-left border ${programme === p.id
                        ? 'border-ss-accent bg-[color:var(--ss-accent)]/10'
                        : 'border-ss-line dark:border-white/10'}`}
                    >
                      <span className="block text-[12.5px] font-bold text-ss-ink dark:text-white">{p.label}</span>
                      <span className="block text-[12px] font-semibold text-ss-slate">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span id="cp-subject" className="block text-xs font-black uppercase tracking-widest text-ss-slate mb-2">
                  Subject
                </span>
                <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cp-subject">
                  {cpSubjects.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      role="radio"
                      aria-checked={subject === s.name}
                      onClick={() => { setSubject(s.name); setComponent('') }}
                      className={`px-3 py-2 rounded-lg text-left border ${subject === s.name
                        ? 'border-ss-accent bg-[color:var(--ss-accent)]/10'
                        : 'border-ss-line dark:border-white/10'}`}
                    >
                      <span className="block text-[12.5px] font-bold text-ss-ink dark:text-white">{s.name}</span>
                      <span className="block text-[12px] font-semibold text-ss-slate">Syllabus {s.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {cpSubject && (
                <div>
                  <span id="cp-component" className="block text-xs font-black uppercase tracking-widest text-ss-slate mb-2">
                    Component
                  </span>
                  {/* Nothing on this screen said what Paper 01 and 02 ARE, and
                      they are not what most people assume: Checkpoint does not
                      split into a multiple-choice paper and a written one. */}
                  <p className="mb-2 text-[13px] font-medium text-ss-slate">
                    Checkpoint is sat as two papers on the same syllabus — neither is harder and
                    neither is the “theory” one. Cambridge adds both marks together for your result.
                    Pick either; sit both to cover the ground a real candidate does.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-labelledby="cp-component">
                    {/* Components that cannot be mocked are shown, disabled, with
                        the reason. A learner looking for ESL Listening should
                        learn why it is absent, not conclude we forgot it. */}
                    {cpSubject.components.map((c) => (
                      <button
                        key={c.number}
                        type="button"
                        role="radio"
                        aria-checked={component === c.number}
                        disabled={!c.mockable}
                        title={c.notMockableReason}
                        onClick={() => setComponent(c.number)}
                        className={`px-3 py-2 rounded-lg text-left border ${!c.mockable
                          ? 'border-ss-line dark:border-white/10 opacity-60 cursor-not-allowed'
                          : component === c.number
                            ? 'border-ss-accent bg-[color:var(--ss-accent)]/10'
                            : 'border-ss-line dark:border-white/10'}`}
                      >
                        <span className="block text-[12.5px] font-bold text-ss-ink dark:text-white">
                          Paper {c.number}{c.name ? ` — ${c.name}` : ''}
                        </span>
                        <span className="block text-[12px] font-semibold text-ss-slate">
                          {c.mockable ? `${c.minutes} minutes` : c.notMockableReason}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {exam === 'checkpoint' ? null : exam === 'jamb' && jambMode === 'course' ? (
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

      {/* Step 3 (Checkpoint): build from a real sitting */}
      {exam === 'checkpoint' && cpSubject && cpComponent?.mockable && cpMode === 'paper' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass dark:glass-dark rounded-2xl p-6">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 3</p>
          <h2 className="text-xl font-bold text-ss-ink dark:text-white mb-1">Build it like a real sitting</h2>
          <p className="text-[13px] font-medium text-ss-slate mb-4">
            Pick a past paper and you get its topics, in its proportions. The questions are ours —
            original, written against the published curriculum — so you can sit it more than once.
          </p>

          {cpSittings.length === 0 ? (
            <p className="text-[13px] font-medium text-ss-slate">
              No past papers on file for {cpSubject.name} {cpSubject.code}/{cpComponent.number} yet,
              so this one is built across the full syllabus.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setCpSitting('')}
                aria-pressed={cpSitting === ''}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                  cpSitting === '' ? 'border-ss-accent shadow-ss-panel' : 'border-ss-line hover:-translate-y-px hover:border-ss-accent'
                }`}
                style={cpSitting === '' ? { background: 'var(--ss-accent-soft)' } : undefined}
              >
                <span className="block text-[12.5px] font-bold text-ss-ink dark:text-white">Full syllabus</span>
                <span className="block text-[12px] font-semibold text-ss-slate">Across every strand</span>
              </button>
              {cpSittings.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setCpSitting(x.id)}
                  aria-pressed={cpSitting === x.id}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    cpSitting === x.id ? 'border-ss-accent shadow-ss-panel' : 'border-ss-line hover:-translate-y-px hover:border-ss-accent'
                  }`}
                  style={cpSitting === x.id ? { background: 'var(--ss-accent-soft)' } : undefined}
                >
                  <span className="block text-[12.5px] font-bold text-ss-ink dark:text-white">{x.label}</span>
                  <span className="block text-[12px] font-semibold text-ss-slate">{x.foci} topics examined</span>
                </button>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* Step 4: Generate */}
      {readyForSettings && step >= 4 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass dark:glass-dark rounded-2xl p-6">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent dark:text-ss-accent mb-2">Step 4</p>
          <h2 className="text-xl font-bold text-ss-ink dark:text-white mb-4">
            {exam === 'checkpoint' ? 'What you’re about to sit' : 'Practice settings'}
          </h2>
          {selectedPaper && (
            <p className="text-xs text-ss-slate mb-4">
              Source: <span className="font-semibold text-ss-ink dark:text-gray-300">{selectedPaper.year} {selectedPaper.diet?.replace(/-/g, ' ')}</span>
              {topics.length > 0 && (
                <> · Focus: <span className="font-semibold text-ss-ink dark:text-gray-300">{topics.length} topic{topics.length === 1 ? '' : 's'}</span></>
              )}
            </p>
          )}
          <div className={`grid sm:grid-cols-2 gap-4 mb-4 ${exam === 'checkpoint' ? 'hidden' : ''}`}>
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
          {/* What you are about to sit, before you sit it. Without this you
              click Start and land on question 1 with no idea what the paper
              covers, how it is scored, or that the result is read strand by
              strand — which is the part worth staying for. Every number here is
              read off the paper that was actually built, so none of it can
              drift from what arrives. */}
          {exam === 'checkpoint' && cpSubject && cpComponent && !cpPaper && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-ss-line p-4 text-[13px] font-semibold text-ss-slate dark:border-white/10">
              {cpLayingOut ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Laying out the paper…</>
              ) : (
                'The paper could not be laid out. Try picking the component again.'
              )}
            </div>
          )}
          {exam === 'checkpoint' && cpSubject && cpComponent && cpPaper && (
            <div className="mb-4 rounded-xl border border-ss-line p-4 dark:border-white/10">
              <p className="text-[14px] font-bold text-ss-ink dark:text-white">
                {cpSubject.name} {cpSubject.code}/{cpComponent.number} · Cambridge{' '}
                {programme === 'primary' ? 'Primary' : 'Lower Secondary'} Checkpoint
              </p>
              <p className="mt-1 text-[13px] font-medium text-ss-slate">
                Sat at the end of Stage {stageOf(programme)}. Marks are Cambridge&apos;s; the questions are ours,
                written against the published curriculum.
              </p>

              {/* Sit it, or drill one strand. The only choice on offer, and a
                  real one — a count dropdown was neither. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  { id: 'paper' as const, label: 'Sit the paper', note: `${cpComponent.minutes} min · 50 marks` },
                  { id: 'practice' as const, label: 'Drill one strand', note: 'Short · 12 marks' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setCpMode(opt.id)
                      if (opt.id === 'practice' && !cpStrand) setCpStrand(cpSubject.strands[0])
                    }}
                    className={`flex-1 min-w-[150px] rounded-xl border px-3 py-2.5 text-left transition ${
                      cpMode === opt.id
                        ? 'border-ss-accent bg-ss-accent/5'
                        : 'border-ss-line hover:border-ss-accent/40 dark:border-white/10'
                    }`}
                  >
                    <span className="block text-[13.5px] font-bold text-ss-ink dark:text-white">{opt.label}</span>
                    <span className="block text-[12px] font-semibold text-ss-slate">{opt.note}</span>
                  </button>
                ))}
              </div>

              {cpMode === 'practice' && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cpSubject.strands.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCpStrand(s)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                        cpStrand === s
                          ? 'border-ss-accent bg-ss-accent/10 text-ss-ink dark:text-white'
                          : 'border-ss-line text-ss-slate hover:border-ss-accent/40 dark:border-white/10'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ss-line pt-3 dark:border-white/10">
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wider text-ss-slate">Marks</dt>
                  <dd className="text-[18px] font-extrabold text-ss-ink dark:text-white">{cpPaper.totalMarks}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wider text-ss-slate">Questions</dt>
                  <dd className="text-[18px] font-extrabold text-ss-ink dark:text-white">{cpPaper.slots.length}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wider text-ss-slate">Time</dt>
                  <dd className="text-[18px] font-extrabold text-ss-ink dark:text-white">
                    {cpPaper.minutes ? `${cpPaper.minutes}m` : 'Untimed'}
                  </dd>
                </div>
              </dl>

              <ul className="mt-3 space-y-1.5 text-[13px] font-medium text-ss-slate">
                <li>
                  <span className="font-bold text-ss-ink dark:text-white">{cpMix}.</span>{' '}
                  Most of a real Checkpoint paper is one-mark short answers — a word, a name or a number.
                  Written answers are worth 2 or 3 marks and say so in the question, the way the real paper does.
                  You show working; part marks count.
                </li>
                <li>
                  {cpPaper.mode === 'practice'
                    ? `Every question is ${cpPaper.strand}. Good for fixing one weak strand — it is not the paper.`
                    : `Spread across all ${cpSubject.strands.length} strands: ${cpSubject.strands.join(', ')}.`}
                </li>
                <li>
                  {cpPaper.mode === 'practice'
                    ? `You get a mark out of ${cpPaper.totalMarks} for ${cpPaper.strand}. Sit the full paper for a result across the subject.`
                    : `You get a mark out of ${cpPaper.totalMarks} and a breakdown by strand, which is how Cambridge reports Checkpoint — 50 marks is the reporting scale.`}
                </li>
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            type="button"
            disabled={isGenerating || (exam === 'checkpoint' && !cpPaper)}
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-ss-accent hover:brightness-95 text-white font-bold disabled:opacity-60"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Writing your paper…</>
            ) : exam === 'checkpoint' && cpPaper ? (
              <>{cpPaper.mode === 'practice' ? 'Start the drill' : 'Start the paper'} <ChevronRight className="w-4 h-4" /></>
            ) : (
              <>Start practice <ChevronRight className="w-4 h-4" /></>
            )}
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
