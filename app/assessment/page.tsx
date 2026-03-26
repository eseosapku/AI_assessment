'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import 'katex/dist/katex.min.css'
import Latex from 'react-latex-next'

// Wrap bare LaTeX commands in $...$ so react-latex-next renders them correctly.
// Text already containing $ delimiters is left untouched.
function L({ children }: { children: string }) {
  const text = children ?? ''
  const wrapped = text.includes('$') ? text : /\\[a-zA-Z]|[\^_]/.test(text) ? `$${text}$` : text
  return <Latex>{wrapped}</Latex>
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MCQQuestion {
  id: number
  type?: 'mcq'
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  passage?: string
  passage_source?: string
  diagram_svg?: string
}

interface LongFormQuestion {
  id: number
  type: 'longform'
  question: string
  marks: number
  marking_criteria: string[]
  model_answer: string
  explanation: string
  passage?: string
  passage_source?: string
  diagram_svg?: string
}

type Question = MCQQuestion | LongFormQuestion

interface CriterionResult {
  criterion: string
  met: boolean
  relevant_quote: string | null
  note: string
}

interface LongFormGrade {
  marks_awarded: number
  marks_total: number
  criteria_results: CriterionResult[]
  general_feedback: string
}

interface Assessment {
  assessment_id: string
  estimated_time: number
  questions: Question[]
  subject: string
  topics: string[]
  curriculum?: string
  questionType?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLongForm(q: Question): q is LongFormQuestion {
  return q.type === 'longform'
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

function DiagramSvg({ svg }: { svg: string }) {
  return (
    <div
      className="flex flex-col items-center my-4"
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}

function needsMathCanvas(subject: string): boolean {
  return ['math', 'physics', 'chemistry', 'biology', 'science', 'statistics',
    'economics', 'accounting', 'calculus', 'further math', 'additional math',
  ].some(s => subject.toLowerCase().includes(s))
}

function MathWorkingCanvas({ value, onChange }: { value: string; onChange: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [history, setHistory] = useState<string[]>([])
  const isDrawingRef = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const toolRef = useRef(tool)
  useEffect(() => { toolRef.current = tool }, [tool])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
  }, [value])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setHistory(h => [...h.slice(-20), canvas.toDataURL()])
    const pos = getPos(e, canvas)
    lastPos.current = pos
    isDrawingRef.current = true
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, toolRef.current === 'eraser' ? 10 : 1.5, 0, Math.PI * 2)
    ctx.fillStyle = toolRef.current === 'eraser' ? 'white' : '#1e293b'
    ctx.fill()
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawingRef.current || !lastPos.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = toolRef.current === 'eraser' ? 'white' : '#1e293b'
    ctx.lineWidth = toolRef.current === 'eraser' ? 20 : 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    lastPos.current = null
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL())
  }

  const undo = () => {
    if (history.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    const img = new Image()
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); onChange(canvas.toDataURL()) }
    img.src = prev
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    setHistory(h => [...h.slice(-20), canvas.toDataURL()])
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="mb-5 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/40">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Working Space</span>
        <span className="text-xs text-blue-500">— draw your steps here</span>
        <div className="flex items-center gap-1 ml-auto">
          {(['pen', 'eraser'] as const).map(t => (
            <button key={t} onClick={() => setTool(t)}
              className={`px-2 py-0.5 text-xs rounded-md font-medium capitalize transition-colors ${tool === t ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'}`}
            >{t}</button>
          ))}
          <button onClick={undo} disabled={history.length === 0}
            className="px-2 py-0.5 text-xs rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 disabled:opacity-30 font-medium">Undo</button>
          <button onClick={clear}
            className="px-2 py-0.5 text-xs rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 font-medium">Clear</button>
        </div>
      </div>
      <canvas
        ref={canvasRef} width={800} height={240}
        className="w-full bg-white block"
        style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
    </div>
  )
}

// Highlight a quote inside the student answer text
function AnnotatedText({
  answer,
  highlight,
  highlightColor,
}: {
  answer: string
  highlight: string | null
  highlightColor: 'green' | 'red' | null
}) {
  if (!highlight || !highlightColor) {
    return <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{answer}</span>
  }

  const idx = answer.toLowerCase().indexOf(highlight.toLowerCase())
  if (idx === -1) {
    return <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{answer}</span>
  }

  const before = answer.slice(0, idx)
  const match = answer.slice(idx, idx + highlight.length)
  const after = answer.slice(idx + highlight.length)
  const bg = highlightColor === 'green'
    ? 'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100'
    : 'bg-red-200 dark:bg-red-800/60 text-red-900 dark:text-red-100'

  return (
    <span className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
      {before}
      <mark className={`px-0.5 rounded ${bg}`}>{match}</mark>
      {after}
    </span>
  )
}

// ── Passage / extract display ─────────────────────────────────────────────────

function PassageBox({ passage, source }: { passage: string; source?: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const wordCount = passage.split(/\s+/).filter(Boolean).length

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 dark:border-amber-600/60 bg-amber-50 dark:bg-amber-900/10 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-amber-800 dark:text-amber-300 text-sm font-bold tracking-tight">
            📄 Reading Extract — read carefully before answering
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
            ~{wordCount} words
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0 ml-3"
        >
          {collapsed ? '▼ Show extract' : '▲ Hide'}
        </button>
      </div>

      {/* Source line */}
      {source && !collapsed && (
        <div className="px-5 pt-3 pb-0">
          <p className="text-xs italic text-amber-600 dark:text-amber-400 border-l-2 border-amber-300 dark:border-amber-600 pl-2">
            {source}
          </p>
        </div>
      )}

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Scrollable passage body — tall enough for 500+ words */}
            <div className="px-5 py-4 max-h-[480px] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-[1.85] whitespace-pre-wrap font-serif">
                {passage}
              </p>
            </div>
            {/* Footer hint */}
            <div className="px-5 pb-3 text-xs text-amber-600 dark:text-amber-500 italic">
              Scroll up to re-read the extract at any time while answering.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Long-form result card ──────────────────────────────────────────────────────

function LongFormResultCard({
  q,
  idx,
  studentAnswer,
  studentWorkings,
  grade,
}: {
  q: LongFormQuestion
  idx: number
  studentAnswer: string
  studentWorkings?: string
  grade: LongFormGrade | undefined
}) {
  const [activeCriterion, setActiveCriterion] = useState<number | null>(null)
  const [showModelAnswer, setShowModelAnswer] = useState(false)

  const isGraded = !!grade
  const overallPass = isGraded && grade.marks_awarded >= Math.ceil(grade.marks_total / 2)

  const activeCrit = activeCriterion !== null ? grade?.criteria_results[activeCriterion] : null
  const highlightQuote = activeCrit?.met ? activeCrit.relevant_quote : null
  const highlightColor = activeCrit?.met ? 'green' : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${
        !isGraded
          ? 'border-l-gray-400'
          : overallPass
          ? 'border-l-green-500'
          : 'border-l-red-500'
      }`}
    >
      {/* Question header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-sm font-bold ${
          !isGraded
            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            : overallPass
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {isGraded ? `${grade.marks_awarded}/${grade.marks_total}` : '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-apple-dark-gray">Question {idx + 1}</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              Long-form · {q.marks} marks
            </span>
          </div>
          {q.diagram_svg && (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <DiagramSvg svg={q.diagram_svg} />
            </div>
          )}
          {q.passage && (
            <PassageBox passage={q.passage} source={q.passage_source} />
          )}
          <h3 className="text-lg font-medium text-gray-900 dark:text-white"><L>{q.question}</L></h3>
        </div>
      </div>

      {/* Student workings drawing */}
      {studentWorkings && (
        <div className="ml-12 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Your Workings</div>
          <NextImage src={studentWorkings} alt="Student workings" width={0} height={0} sizes="100vw" unoptimized className="w-full h-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white" />
        </div>
      )}

      {/* Student answer with annotation */}
      <div className="ml-12 mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Your Answer</div>
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 min-h-[60px]">
          {studentAnswer ? (
            <AnnotatedText
              answer={studentAnswer}
              highlight={highlightQuote ?? null}
              highlightColor={highlightColor}
            />
          ) : (
            <span className="text-gray-400 italic text-sm">No answer written</span>
          )}
        </div>
        {activeCrit && (
          <motion.div
            key={activeCriterion}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 p-3 rounded-xl text-sm border ${
              activeCrit.met
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
            }`}
          >
            <span className="font-semibold">{activeCrit.met ? '✓ Criterion met:' : '✗ Criterion missed:'}</span>{' '}
            {activeCrit.note}
            {activeCrit.met && activeCrit.relevant_quote && (
              <div className="mt-1 text-xs opacity-75">Highlighted in your answer above</div>
            )}
          </motion.div>
        )}
      </div>

      {/* Criteria checklist */}
      {isGraded && (
        <div className="ml-12 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Marking Criteria — click any to see why
          </div>
          <div className="space-y-2">
            {grade.criteria_results.map((cr, crIdx) => (
              <motion.button
                key={crIdx}
                onClick={() => setActiveCriterion(activeCriterion === crIdx ? null : crIdx)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full text-left flex items-start gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  activeCriterion === crIdx
                    ? cr.met
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/40'
                }`}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                  cr.met
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {cr.met ? '✓' : '✗'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{cr.criterion}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">tap</span>
              </motion.button>
            ))}
          </div>

          {/* AI general feedback */}
          {grade.general_feedback && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">AI Feedback: </span>{grade.general_feedback}
            </div>
          )}
        </div>
      )}

      {!isGraded && (
        <div className="ml-12 mb-4 flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-gray-400"></div>
          Grading in progress...
        </div>
      )}

      {/* Model answer toggle */}
      <div className="ml-12">
        <button
          onClick={() => setShowModelAnswer(!showModelAnswer)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showModelAnswer ? 'Hide model answer' : 'Show model answer'}
        </button>
        <AnimatePresence>
          {showModelAnswer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Model Answer</div>
              <p className="leading-relaxed">{q.model_answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Client-side MCQ answer validator ───────────────────────────────────────────
// Mirrors the server-side validator so old assessments loaded from sessionStorage
// also get corrected. Explanation-first strategy is most reliable.
function fixMcqAnswers(questions: Question[]): void {
  for (const q of questions) {
    if (isLongForm(q)) continue
    const mcq = q as MCQQuestion
    if (!Array.isArray(mcq.options) || mcq.options.length !== 4) continue
    const ci = Number(mcq.correct_answer)
    if (isNaN(ci) || ci < 0 || ci > 3) mcq.correct_answer = 0

    // Skip when options are sequences (e.g. "3, 5, 8, 12") — stripping commas gives
    // a bare number that wrongly matches a single-value option.
    if (mcq.options.some(o => String(o).includes(','))) continue

    // Skip when options are arithmetic expressions like "5+5" or "3+7".
    if (mcq.options.some(o => /[+\-×÷\/]/.test(String(o)))) continue

    // ── Strategy 1: deterministic arithmetic from question text ───────────────
    const t = (mcq.question || '').replace(/\$+/g, '').trim()
    let computed: number | null = null

    const a = t.match(/(\d+)\s*\+\s*(\d+)\s*=?\s*\?/)
    if (a) computed = +a[1] + +a[2]
    if (computed === null) { const s = t.match(/(\d+)\s*[-−]\s*(\d+)\s*=?\s*\?/); if (s) computed = +s[1] - +s[2] }
    if (computed === null) { const m = t.match(/(\d+)\s*[×x*]\s*(\d+)\s*=?\s*\?/); if (m) computed = +m[1] * +m[2] }
    if (computed === null) {
      const ma = t.match(/(\d+)\s*\+\s*\?\s*=\s*(\d+)/) || t.match(/\?\s*\+\s*(\d+)\s*=\s*(\d+)/)
      if (ma) computed = +ma[2] - +ma[1]
    }
    if (computed === null) {
      // "same sum: A+B and C+?" → (A+B) - C
      const ss = t.match(/(\d+)\s*\+\s*(\d+)\s+and\s+(\d+)\s*\+\s*\?/i)
      if (ss) computed = (+ss[1] + +ss[2]) - +ss[3]
    }
    if (computed === null) { const bf = t.match(/bond\s+to\s+(\d+)\s+for\s+(\d+)/i); if (bf) computed = +bf[1] - +bf[2] }
    if (computed === null) { const aft = t.match(/(?:comes?|right)\s+after\s+(\d+)/i); if (aft) computed = +aft[1] + 1 }
    if (computed === null) { const bef = t.match(/(?:comes?|right)\s+before\s+(\d+)/i); if (bef) { const v = +bef[1] - 1; if (v >= 0) computed = v } }
    if (computed === null) { const df = t.match(/difference\s+between\s+(\d+)\s+and\s+(\d+)/i); if (df) computed = Math.abs(+df[1] - +df[2]) }
    if (computed === null) {
      const sw = t.match(/(\d+)\s+(?:\w+\s+){0,8}(?:take\s+away|give[s]?(?:\s+away)?|subtract[s]?|minus|remove[s]?)\s+(\d+)/i)
      if (sw) computed = +sw[1] - +sw[2]
    }
    if (computed === null) {
      const aw = t.match(/(?:combining|adding)\s+(\d+)\s+and\s+(\d+)/i)
        || t.match(/(\d+)\s+(?:\w+\s+){0,8}(?:add[s]?\s+(\d+)\s+more|get[s]?\s+(\d+)\s+more|and\s+(\d+)\s+more|plus\s+(\d+))/i)
        || t.match(/have\s+(\d+)\s+(?:\w+\s+){0,6}add[s]?\s+(\d+)/i)
      if (aw) { const b = Number(aw[2] || aw[3] || aw[4]); if (Number.isFinite(b)) computed = +aw[1] + b }
    }

    if (computed !== null && Number.isFinite(computed)) { applyPatch(mcq, computed); continue }

    // ── Strategy 2: extract answer value from explanation text ────────────────
    // Inline arithmetic (5+3=8) comes first — when the AI contradicts itself,
    // the math in the explanation is right even when "correct answer is N" is wrong.
    if (mcq.explanation) {
      const expl = mcq.explanation.replace(/\$+/g, '').replace(/[−–]/g, '-')
      const pats = [
        /\d+\s*[+\-×*]\s*\d+\s*=\s*(-?\d+(?:\.\d+)?)/,            // "5 + 3 = 8" — most reliable
        /missing\s+number\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /the\s+(?:result|sum|total|difference|product|answer)\s+is\s+(-?\d+(?:\.\d+)?)/i,
        /(?:therefore|thus|so|hence)[,\s]+(?:the\s+)?(?:correct\s+)?answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /(?:the\s+)?(?:only\s+)?correct\s+answer\s+is\s+(?:[A-D]:\s*)?(-?\d+(?:\.\d+)?)/i,
        /equals?\s+(-?\d+(?:\.\d+)?)/i,
      ]
      for (const p of pats) {
        const m = expl.match(p)
        if (m) { const v = Number(m[1]); if (Number.isFinite(v)) { applyPatch(mcq, v); break } }
      }
    }
  }
}

function applyPatch(q: MCQQuestion, expected: number): void {
  if (!Number.isFinite(expected)) return
  const optNum = (o: string) => Number(o.replace(/[^0-9.\-]/g, ''))
  if (optNum(String(q.options[q.correct_answer])) === expected) return
  const idx = q.options.findIndex(o => optNum(String(o)) === expected)
  if (idx !== -1) {
    q.correct_answer = idx
  } else {
    // Correct answer is not in options at all — replace the marked slot with the right value
    q.options[q.correct_answer] = String(expected)
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AssessmentPage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [longFormAnswers, setLongFormAnswers] = useState<Record<number, string>>({})
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)
  const [longFormGrades, setLongFormGrades] = useState<Record<number, LongFormGrade>>({})
  const [isGradingLongForm, setIsGradingLongForm] = useState(false)
  const [mathWorkings, setMathWorkings] = useState<Record<number, string>>({})

  useEffect(() => {
    const data = sessionStorage.getItem('currentAssessment')
    if (data) {
      const assessmentData = JSON.parse(data)
      if (Array.isArray(assessmentData.questions)) {
        // Strip embedded "(A)...(D)" option text from question fields
        assessmentData.questions.forEach((q: Question) => {
          if (!isLongForm(q)) {
            q.question = q.question.replace(/\s*[\(\[]\s*[Aa]\s*[\)\]]\s*[\s\S]*$/, '').trim()
            q.question = q.question.replace(/\$\?\$/g, '?')
          }
        })
        // Fix any wrong correct_answer indices
        fixMcqAnswers(assessmentData.questions)
      }
      setAssessment(assessmentData)
      setTimeRemaining(assessmentData.estimated_time * 60)
    } else {
      router.push('/')
    }
  }, [router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex })
  }

  const handleLongFormChange = (text: string) => {
    setLongFormAnswers({ ...longFormAnswers, [currentQuestion]: text })
  }

  const allAnswered = assessment?.questions.every((q, idx) => {
    if (isLongForm(q)) return (longFormAnswers[idx] || '').trim().length > 0
    return selectedAnswers[idx] !== undefined
  }) ?? false

  const downloadReport = () => {
    if (!assessment || !results) return
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const optionLabels = ['A', 'B', 'C', 'D']

    const questionsHtml = assessment.questions.map((q, idx) => {
      if (isLongForm(q)) {
        const lf = q as LongFormQuestion
        const grade = longFormGrades[idx]
        const studentAnswer = longFormAnswers[idx] || ''
        const marksLabel = grade ? `${grade.marks_awarded}/${grade.marks_total}` : `?/${lf.marks}`

        const criteriaRows = grade
          ? grade.criteria_results.map(cr => `
              <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${cr.met ? '✓' : '✗'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${cr.met ? '#15803d' : '#b91c1c'};">${cr.criterion}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${cr.note}</td>
              </tr>`).join('')
          : ''

        const passageHtml = lf.passage ? `
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
            <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Reading Passage${lf.passage_source ? ` — ${lf.passage_source}` : ''}</div>
            <p style="font-size:14px;line-height:1.75;color:#374151;white-space:pre-wrap;font-family:Georgia,serif;">${lf.passage}</p>
          </div>` : ''

        return `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:20px;border-left:4px solid ${grade && grade.marks_awarded >= Math.ceil(grade.marks_total/2) ? '#22c55e' : '#ef4444'};">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="background:#f3e8ff;color:#7c3aed;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">Q${idx + 1} · Long-form · ${lf.marks} marks</span>
              <span style="font-weight:700;font-size:15px;color:${grade && grade.marks_awarded >= Math.ceil(grade.marks_total/2) ? '#15803d' : '#b91c1c'};">${marksLabel} marks awarded</span>
            </div>
            ${passageHtml}
            <p style="font-size:16px;font-weight:600;color:#111827;margin-bottom:14px;">${lf.question}</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Your Answer</div>
              <p style="font-size:14px;line-height:1.8;color:#374151;white-space:pre-wrap;">${studentAnswer || '<em style="color:#9ca3af;">No answer written.</em>'}</p>
            </div>
            ${criteriaRows ? `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Marking Criteria</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#f3f4f6;">
                  <th style="padding:6px 10px;text-align:left;width:30px;"></th>
                  <th style="padding:6px 10px;text-align:left;">Criterion</th>
                  <th style="padding:6px 10px;text-align:left;">Note</th>
                </tr></thead>
                <tbody>${criteriaRows}</tbody>
              </table>
            </div>` : ''}
            ${grade?.general_feedback ? `
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
              <span style="font-weight:700;color:#1d4ed8;">AI Feedback: </span><span style="color:#1e40af;font-size:14px;">${grade.general_feedback}</span>
            </div>` : ''}
            <details style="margin-top:8px;">
              <summary style="cursor:pointer;font-size:13px;color:#3b82f6;font-weight:600;">Show model answer</summary>
              <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-top:8px;font-size:14px;color:#374151;line-height:1.7;">${lf.model_answer}</div>
            </details>
          </div>`
      }

      // MCQ
      const mcq = q as any
      const userAnswer = results.answers[idx]
      const isCorrect = userAnswer === mcq.correct_answer
      const optionsHtml = mcq.options.map((opt: string, oi: number) => {
        let bg = '#f9fafb', border = '#e5e7eb', color = '#374151'
        if (oi === mcq.correct_answer) { bg = '#f0fdf4'; border = '#86efac'; color = '#166534' }
        else if (oi === userAnswer && !isCorrect) { bg = '#fef2f2'; border = '#fca5a5'; color = '#991b1b' }
        return `<div style="padding:10px 14px;border:1px solid ${border};border-radius:8px;background:${bg};color:${color};margin-bottom:6px;font-size:14px;">
          <strong>${optionLabels[oi]}.</strong> ${opt}${oi === mcq.correct_answer ? ' <span style="font-size:12px;font-weight:700;">✓ Correct</span>' : ''}${oi === userAnswer && !isCorrect ? ' <span style="font-size:12px;font-weight:700;">← Your answer</span>' : ''}
        </div>`
      }).join('')

      return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid ${isCorrect ? '#22c55e' : '#ef4444'};">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;">Q${idx + 1} · MCQ</span>
            <span style="font-weight:700;color:${isCorrect ? '#15803d' : '#b91c1c'};">${isCorrect ? '✓ Correct' : '✗ Incorrect'}</span>
          </div>
          <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:12px;">${mcq.question}</p>
          ${optionsHtml}
          ${mcq.explanation ? `<div style="margin-top:10px;padding:10px 14px;background:#f0f9ff;border-radius:8px;font-size:13px;color:#0369a1;"><strong>Explanation:</strong> ${mcq.explanation}</div>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Assessment Report — ${assessment.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; color: #111827; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px 24px; }
    @media print {
      body { background: #fff; }
      .page { padding: 20px; }
      details { display: block; }
      details summary { display: none; }
    }
  </style>
</head>
<body>
<div class="page">
  <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#fff;border-radius:16px;padding:32px;margin-bottom:28px;">
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;">${assessment.subject}</h1>
    <p style="margin:0 0 4px;opacity:.85;font-size:15px;">${assessment.topics?.join(', ')}</p>
    <p style="margin:0;opacity:.7;font-size:13px;">${date}</p>
    ${results.score !== null ? `
    <div style="display:flex;gap:40px;margin-top:24px;">
      <div><div style="font-size:48px;font-weight:900;line-height:1;">${results.score}%</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Score</div></div>
      <div style="width:1px;background:rgba(255,255,255,.3);"></div>
      <div><div style="font-size:48px;font-weight:900;line-height:1;">${results.grade}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Grade</div></div>
      ${results.mcqTotal > 0 ? `<div style="width:1px;background:rgba(255,255,255,.3);"></div><div><div style="font-size:24px;font-weight:700;line-height:1;">${results.mcqCorrect}/${results.mcqTotal}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">MCQ</div></div>` : ''}
      ${results.longFormTotal > 0 ? `<div style="width:1px;background:rgba(255,255,255,.3);"></div><div><div style="font-size:24px;font-weight:700;line-height:1;">${results.longFormMarksEarned}/${results.longFormTotal}</div><div style="font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:.05em;">Written</div></div>` : ''}
    </div>` : ''}
  </div>

  ${feedback ? `
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:24px;margin-bottom:28px;">
    <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1e40af;">✨ AI Feedback</h2>
    <div style="font-size:14px;line-height:1.8;color:#1e3a8a;white-space:pre-wrap;">${feedback}</div>
  </div>` : ''}

  <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">Detailed Review</h2>
  ${questionsHtml}

  <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
    Generated by AI Assessment Platform · ${date}
  </div>
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Report_${assessment.subject.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSubmit = useCallback(async () => {
    setIsSubmitted(true)

    const questions = assessment?.questions ?? []

    // Calculate MCQ marks
    let mcqCorrect = 0
    let mcqTotal = 0
    questions.forEach((q, idx) => {
      if (!isLongForm(q)) {
        mcqTotal++
        if (selectedAnswers[idx] === q.correct_answer) mcqCorrect++
      }
    })

    const hasLongForm = questions.some(isLongForm)
    const longFormTotal = questions.filter(isLongForm).reduce((sum, q) => sum + (q as LongFormQuestion).marks, 0)

    // Show results immediately (long-form grades come in async)
    const preliminaryResult = {
      assessment_id: assessment?.assessment_id,
      mcqCorrect,
      mcqTotal,
      longFormMarksEarned: 0,
      longFormTotal,
      score: mcqTotal > 0 && !hasLongForm ? Math.round((mcqCorrect / mcqTotal) * 100) : null,
      grade: '',
      answers: selectedAnswers,
      longFormAnswers,
      completed_at: new Date().toISOString(),
    }

    setResults(preliminaryResult)
    setShowResults(true)
    setIsSubmitted(false)

    // Grade long-form questions
    let longFormGradesResult: Record<number, LongFormGrade> = {}
    if (hasLongForm) {
      setIsGradingLongForm(true)
      try {
        const res = await fetch('/api/grade-longform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions,
            answers: longFormAnswers,
            subject: assessment?.subject,
          }),
        })
        const data = await res.json()
        longFormGradesResult = data.grades ?? {}
        setLongFormGrades(longFormGradesResult)
      } catch (err) {
        console.error('Long-form grading failed:', err)
      } finally {
        setIsGradingLongForm(false)
      }
    }

    // Final score with long-form results
    const longFormEarned = Object.values(longFormGradesResult).reduce(
      (sum, g) => sum + (g.marks_awarded ?? 0),
      0
    )
    const totalEarned = mcqCorrect + longFormEarned
    const totalPossible = mcqTotal + longFormTotal
    const finalScore = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0
    const grade =
      finalScore >= 90 ? 'A+' :
      finalScore >= 80 ? 'A' :
      finalScore >= 70 ? 'B+' :
      finalScore >= 60 ? 'B' :
      finalScore >= 50 ? 'C' : 'D'

    const finalResult = { ...preliminaryResult, longFormMarksEarned: longFormEarned, score: finalScore, grade }
    setResults(finalResult)

    // Generate overall AI feedback
    setIsGeneratingFeedback(true)
    let generatedFeedback = 'Great effort! Review the criteria and explanations below to improve.'
    const user = JSON.parse(localStorage.getItem('user') || '{}')

    try {
      const feedbackRes = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment,
          answers: selectedAnswers,
          longFormAnswers,
          longFormGrades: longFormGradesResult,
          score: finalScore,
          grade,
          className: user.class,
        }),
      })
      const feedbackData = await feedbackRes.json()
      if (feedbackData.feedback) generatedFeedback = feedbackData.feedback
    } catch {
      // keep fallback
    } finally {
      setFeedback(generatedFeedback)
      setIsGeneratingFeedback(false)
    }

    if (user.id) {
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          assessment_id: assessment?.assessment_id,
          answers: { mcq: selectedAnswers, longform: longFormAnswers },
          total_questions: questions.length,
          score: finalScore,
          grade,
          feedback: generatedFeedback,
        }),
      })
    }
  }, [assessment, selectedAnswers, longFormAnswers])

  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeRemaining, isSubmitted, handleSubmit])

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue mx-auto mb-4"></div>
          <p className="text-apple-dark-gray">Loading assessment...</p>
        </div>
      </div>
    )
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (showResults && results) {
    const hasLongForm = assessment.questions.some(isLongForm)

    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-gray-200/50 dark:border-gray-800/50"
          >
            <div className="w-20 h-20 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">
              Assessment Complete!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg">
              {assessment.subject} — {assessment.topics.join(', ')}
            </p>

            {/* Score / Grade */}
            {results.score !== null ? (
              <div className="flex justify-center items-center gap-12 mb-10">
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.score}%
                  </div>
                  <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Final Score</div>
                </div>
                <div className="w-px h-20 bg-gray-200 dark:bg-gray-800"></div>
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-2 tracking-tighter">
                    {results.grade}
                  </div>
                  <div className="text-sm font-medium text-gray-400 uppercase tracking-widest">Grade</div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center gap-3 mb-10 text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
                <span className="font-medium">Grading written answers…</span>
              </div>
            )}

            {/* Marks breakdown for mixed/longform */}
            {hasLongForm && results.score !== null && (
              <div className="flex justify-center gap-6 mb-8 text-sm text-gray-500 dark:text-gray-400">
                {results.mcqTotal > 0 && (
                  <span>MCQ: {results.mcqCorrect}/{results.mcqTotal}</span>
                )}
                {results.longFormTotal > 0 && (
                  <span>Written: {results.longFormMarksEarned}/{results.longFormTotal} marks</span>
                )}
              </div>
            )}

            {/* AI Feedback */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 text-left border border-blue-100 dark:border-blue-800/30">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span className="text-xl">✨</span> AI Feedback
              </h3>
              {isGeneratingFeedback || (isGradingLongForm && results.score === null) ? (
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                  <p className="text-sm">
                    {isGradingLongForm ? 'Grading written answers…' : 'Analysing your performance…'}
                  </p>
                </div>
              ) : (
                <div className="text-sm sm:text-base leading-relaxed space-y-1">
                  {feedback.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2"></div>
                    const isHeader = /^\*\*.*\*\*$/.test(line.trim())
                    if (isHeader) {
                      return (
                        <div key={i} className="flex items-center gap-2 mt-4 mb-1 pb-1 border-b border-blue-300 dark:border-blue-600">
                          <strong className="text-blue-700 dark:text-blue-300 font-bold text-base">
                            {line.trim().slice(2, -2)}
                          </strong>
                        </div>
                      )
                    }
                    return <div key={i} className="text-blue-900 dark:text-blue-100 pl-1">{line}</div>
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Download report button */}
          {results.score !== null && !isGeneratingFeedback && (
            <div className="flex justify-center">
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:opacity-80 transition-opacity shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Report
              </button>
            </div>
          )}

          {/* Detailed review */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold px-2">Detailed Review</h2>
            {assessment.questions.map((q, idx) => {
              if (isLongForm(q)) {
                return (
                  <LongFormResultCard
                    key={idx}
                    q={q}
                    idx={idx}
                    studentAnswer={longFormAnswers[idx] || ''}
                    studentWorkings={mathWorkings[idx]}
                    grade={longFormGrades[idx]}
                  />
                )
              }

              // MCQ result card
              const userAnswer = results.answers[idx]
              const isCorrect = userAnswer === q.correct_answer
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`glass dark:glass-dark rounded-apple p-6 border-l-4 ${
                    isCorrect ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                      isCorrect
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {isCorrect ? <Check className="w-5 h-5" /> : <span className="font-bold text-lg">×</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-apple-dark-gray mb-1">Question {idx + 1}</div>
                      {q.diagram_svg && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                          <DiagramSvg svg={q.diagram_svg} />
                        </div>
                      )}
                      {q.passage && (
                        <PassageBox passage={q.passage} source={q.passage_source} />
                      )}
                      <h3 className="text-lg font-medium"><L>{q.question}</L></h3>
                    </div>
                  </div>

                  <div className="space-y-2 ml-12 mb-4">
                    {q.options.map((opt, optIdx) => {
                      let optClass = 'p-3 rounded-xl text-sm sm:text-base border '
                      if (optIdx === q.correct_answer) {
                        optClass += 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-200 font-medium'
                      } else if (optIdx === userAnswer && !isCorrect) {
                        optClass += 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
                      } else {
                        optClass += 'bg-gray-50 border-transparent text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
                      }
                      return (
                        <div key={optIdx} className={optClass}>
                          <L>{opt}</L>
                          {optIdx === q.correct_answer && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-green-600 dark:text-green-400">(Correct)</span>
                          )}
                          {optIdx === userAnswer && !isCorrect && (
                            <span className="ml-2 text-xs uppercase tracking-wider font-bold text-red-600 dark:text-red-400">(Your Answer)</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="ml-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-apple-dark-gray">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Explanation: </span>
                    <L>{q.explanation ?? ''}</L>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex justify-center pt-8 pb-12">
            <button onClick={() => router.push('/')} className="btn-primary px-8 py-3">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz view ───────────────────────────────────────────────────────────────
  const question = assessment.questions[currentQuestion]
  const isCurrentLongForm = isLongForm(question)
  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl sticky top-0 z-30 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {assessment.subject}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {assessment.topics.join(', ')}
              </p>
            </div>

            <motion.div
              className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 ${
                timeRemaining < 120 ? 'text-orange-500' : 'text-apple-blue'
              }`}
              animate={timeRemaining < 120 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-mono font-bold text-sm sm:text-base tracking-tight">
                {formatTime(timeRemaining)}
              </span>
            </motion.div>
          </div>

          <div className="mt-5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 flex items-start justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-200/50 dark:border-gray-800/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold">
                  Question {currentQuestion + 1} of {assessment.questions.length}
                </div>
                {isCurrentLongForm && (
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-semibold">
                    {(question as LongFormQuestion).marks} marks
                  </div>
                )}
              </div>

              {question.diagram_svg && (
                <div className="bg-gray-50 dark:bg-gray-900/60 rounded-2xl p-4 mb-6 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <DiagramSvg svg={question.diagram_svg} />
                </div>
              )}

              {question.passage && (
                <PassageBox passage={question.passage} source={question.passage_source} />
              )}

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-8 sm:mb-10 leading-relaxed tracking-tight">
                <L>{question.question}</L>
              </h2>

              {/* MCQ options */}
              {!isCurrentLongForm && (
                <div className="space-y-3 sm:space-y-4">
                  {(question as MCQQuestion).options.map((option, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`mcq-option w-full text-left ${
                        selectedAnswers[currentQuestion] === index ? 'selected' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedAnswers[currentQuestion] === index
                            ? 'border-apple-blue bg-apple-blue'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedAnswers[currentQuestion] === index && (
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                          )}
                        </div>
                        <span className="flex-1 text-sm sm:text-base"><L>{option}</L></span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Long-form textarea */}
              {isCurrentLongForm && (
                <div>
                  {assessment && needsMathCanvas(assessment.subject) && (
                    <MathWorkingCanvas
                      value={mathWorkings[currentQuestion] || ''}
                      onChange={(data) => setMathWorkings(prev => ({ ...prev, [currentQuestion]: data }))}
                    />
                  )}
                  <div className="text-xs text-gray-400 mb-2">
                    {assessment && needsMathCanvas(assessment.subject)
                      ? 'Write your final answer and explanation below — your workings are above.'
                      : 'Write a detailed answer. Each mark has a specific criterion — cover as much as you can.'}
                  </div>
                  <textarea
                    value={longFormAnswers[currentQuestion] || ''}
                    onChange={(e) => handleLongFormChange(e.target.value)}
                    placeholder={`Write your answer here… (${(question as LongFormQuestion).marks} marks available)`}
                    className="w-full min-h-[220px] p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white resize-y focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors text-sm sm:text-base leading-relaxed"
                    rows={9}
                  />
                  <div className="mt-2 flex justify-between text-xs text-gray-400">
                    <span>
                      {(longFormAnswers[currentQuestion] || '').split(/\s+/).filter(Boolean).length} words
                    </span>
                    <span>
                      Aim for ~{(question as LongFormQuestion).marks * 25}–{(question as LongFormQuestion).marks * 40} words
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-4 sm:mt-6 gap-2">
            <motion.button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              whileHover={{ scale: currentQuestion === 0 ? 1 : 1.05 }}
              whileTap={{ scale: currentQuestion === 0 ? 1 : 0.95 }}
              className="btn-secondary flex items-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </motion.button>

            {currentQuestion === assessment.questions.length - 1 ? (
              <motion.button
                onClick={handleSubmit}
                disabled={!allAnswered}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span className="hidden sm:inline">Submit Assessment</span>
                <span className="sm:hidden">Submit</span>
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setCurrentQuestion(Math.min(assessment.questions.length - 1, currentQuestion + 1))}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {/* Question navigator */}
          <div className="flex gap-1 sm:gap-2 justify-center mt-4 sm:mt-6 flex-wrap">
            {assessment.questions.map((q, idx) => {
              const answered = isLongForm(q)
                ? (longFormAnswers[idx] || '').trim().length > 0
                : selectedAnswers[idx] !== undefined
              const isLF = isLongForm(q)

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  title={isLF ? `Q${idx + 1} — Long-form (${(q as LongFormQuestion).marks} marks)` : `Q${idx + 1} — MCQ`}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    idx === currentQuestion
                      ? 'bg-apple-blue text-white'
                      : answered
                      ? isLF
                        ? 'bg-purple-500 text-white'
                        : 'bg-green-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>

          {/* Legend for mixed */}
          {assessment.questions.some(isLongForm) && assessment.questions.some((q) => !isLongForm(q)) && (
            <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span> MCQ answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block"></span> Written answered
              </span>
            </div>
          )}
        </div>
      </div>

      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="glass dark:glass-dark p-6 sm:p-8 rounded-apple text-center max-w-sm mx-4"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">Assessment Submitted!</h3>
            <p className="text-sm sm:text-base text-apple-dark-gray">Calculating your results…</p>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
