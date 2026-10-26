'use client'
/**
 * Bench for the LearnSpace redesign's pieces, in a real ReactFlow canvas with
 * a working CanvasContext -- so a card's saves land and a reload-like remount
 * can be tried -- and a subject switcher, so every family's colours can be
 * looked at.
 *
 * It holds what the node-only suite cannot render: the check bar in learning
 * and test mode, the badges and fades, the practice card's two tries, an
 * activity's hint-on-miss and solve hop, the glossary popover, Inky's moods.
 *
 * Dev only, like /dev/activities: there is no middleware gating /dev/*.
 */
import { notFound } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, useNodesState, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { studyNodeTypes } from '@/components/studylab/canvasNodes'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { Inky } from '@/components/studylab/inky/Inky'
import type { InkyMood } from '@/lib/studylab/inkyMood'
import { SUBJECT_FAMILIES, subjectStyle } from '@/lib/studylab/subjectFamily'
import type { ActivitySpec } from '@/lib/studylab/activities/types'
import type { CheckpointQuestion, StudyNodeData } from '@/lib/studylab/types'

const SUBJECT_FOR: Record<string, string> = {
  number: 'Mathematics', matter: 'Physics', life: 'Biology', world: 'Geography', code: 'Computer Science',
  data: 'Economics', words: 'English Language', time: 'History', craft: 'Art and Design',
}

const MCQ: CheckpointQuestion = {
  id: 'b-mcq', format: 'mcq', prompt: 'A prism splits white light into colours. Where do the colours come from?',
  options: ['The glass adds them', 'They were in the light all along', 'The prism paints them'],
  answer: 1,
  explain: 'White light is every colour travelling together; the glass bends each by a different amount, so they spread apart.',
  optionFeedback: [
    'Glass bends light — it has no colour of its own to add.',
    'Yes — the glass only separates what was already there.',
    'Nothing is painted on: try the beam with no prism and the colours are still there, just mixed.',
  ],
}
const MCQ_TEST: CheckpointQuestion = {
  id: 'b-mcq-test', format: 'mcq', prompt: 'Which colour bends the least in a prism?',
  options: ['Red', 'Green', 'Violet'], answer: 0, explain: 'Red has the longest wavelength and bends least.',
}
const SHORT: CheckpointQuestion = { id: 'b-short', format: 'short', prompt: 'In one sentence: why is the sky blue?', rubric: 'Short (blue) wavelengths scatter far more in air.' }
const MATCH: CheckpointQuestion = {
  id: 'b-match', format: 'match', prompt: 'Match each colour to its wavelength.',
  pairs: [{ left: 'Red', right: 'about 700 nm' }, { left: 'Green', right: 'about 550 nm' }, { left: 'Blue', right: 'about 450 nm' }],
}

const SORT: ActivitySpec = {
  pattern: 'sort',
  prompt: 'Drop each substance into the group it belongs to.',
  payload: {
    bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
    items: [
      { id: 'hcl', label: 'HCl', binId: 'acid' },
      { id: 'naoh', label: 'NaOH', binId: 'base' },
      { id: 'ch3cooh', label: 'CH3COOH', binId: 'acid' },
      { id: 'koh', label: 'KOH', binId: 'base' },
    ],
  },
  success: { kind: 'binAssignment', assign: { hcl: 'acid', naoh: 'base', ch3cooh: 'acid', koh: 'base' } },
  hints: ['Look at the formula: what does each one release in water?', 'An H at the front usually means acid.'],
  reveal: 'Acids release H+; bases release OH-.',
}

const FILL: CheckpointQuestion = {
  id: 'b-fill', format: 'fill', prompt: 'Complete the sentence about photosynthesis.',
  text: 'Plants take in ___ and water, and use light to make ___ and oxygen.',
  tiles: ['carbon dioxide', 'glucose', 'nitrogen', 'starch'], answer: ['carbon dioxide', 'glucose'],
}
const ORDER: CheckpointQuestion = {
  id: 'b-order', format: 'order', prompt: 'Put the stages of a butterfly’s life in order.',
  items: ['Egg', 'Caterpillar', 'Pupa', 'Butterfly'],
  clues: [
    { text: 'The caterpillar hatches from the egg.', before: 'Egg', after: 'Caterpillar' },
    { text: 'The butterfly comes out of the pupa.', before: 'Pupa', after: 'Butterfly' },
  ],
}
const TAP: CheckpointQuestion = { id: 'b-tap', format: 'tap', prompt: 'Tap the part that controls what the cell does.', figure: 'asset:plant-cell', answer: ['nucleus'] }

function quizNode(id: string, q: CheckpointQuestion, gate: 'hard' | 'soft', x: number, y: number): Node {
  return { id, type: 'quiz', position: { x, y }, data: { kind: 'quiz', quiz: { checkpointId: 'bench', gate, question: q, state: 'unanswered' } } as never }
}

const initialNodes: Node[] = [
  quizNode('q-learn', MCQ, 'soft', 0, 0),
  quizNode('q-test', MCQ_TEST, 'hard', 380, 0),
  quizNode('q-short', SHORT, 'soft', 760, 0),
  quizNode('q-match', MATCH, 'soft', 1140, 0),
  quizNode('q-fill', FILL, 'soft', 1520, 0),
  quizNode('q-order', ORDER, 'soft', 1900, 0),
  quizNode('q-tap', TAP, 'hard', 2280, 0),
  {
    id: 'practice', type: 'practice', position: { x: 0, y: 520 },
    data: {
      kind: 'practice', title: 'Your turn', body: 'Factor $x^2 + 5x + 6$.', answer: '(x+2)(x+3)',
      rubric: 'Two brackets whose numbers multiply to 6 and add to 5.',
      steps: ['Find two numbers that multiply to $6$ and add to $5$: $2$ and $3$.', 'So $x^2 + 5x + 6 = (x+2)(x+3)$.'],
    } as never,
  },
  {
    id: 'practice-tap', type: 'practice', position: { x: 1520, y: 640 },
    data: {
      kind: 'practice', title: 'Your turn', body: 'Animal cells release energy from food in their own small organs.',
      question: { id: 'practice-tap-q', format: 'tap', prompt: 'Tap where the cell releases energy from glucose.', figure: 'asset:animal-cell', answer: ['mitochondrion'] },
      steps: ['Respiration happens in the mitochondria.', 'They are the small oval parts with folded insides.'],
    } as never,
  },
  {
    id: 'balance', type: 'activity', position: { x: 1900, y: 640 },
    data: { spec: {
      pattern: 'balance', prompt: 'Balance the scale.', seed: 1,
      payload: { left: [{ id: 'l1', label: 'Box', weight: 5 }], right: [], pool: [{ id: 'p1', label: 'Bag', weight: 3 }, { id: 'p2', label: 'Tin', weight: 2 }, { id: 'p3', label: 'Jar', weight: 4 }], mode: 'weights' },
      success: { kind: 'numericWithin', target: 0, tolerance: 0 },
    }, activityState: undefined } as never,
  },
  {
    id: 'vary', type: 'activity', position: { x: 2400, y: 640 },
    data: { spec: {
      pattern: 'vary', prompt: "Move the slider to change the river's gradient.", seed: 1,
      payload: {
        variable: { id: 'g', label: 'Gradient', min: 0, max: 20, step: 1, unit: 'degrees' },
        model: { kind: 'bars', bars: [{ label: 'Flow speed', expr: 'g * 2', max: 40 }, { label: 'Erosion', expr: 'g * g / 10', max: 40 }] },
        readouts: [{ label: 'Flow speed', expr: 'g * 2', unit: 'cm/s' }],
        scene: 'asset:river-profile',
      },
      success: { kind: 'numericWithin', target: 15, tolerance: 1 },
    }, activityState: undefined } as never,
  },
  {
    id: 'code-py', type: 'code', position: { x: 1520, y: 1180 },
    data: { kind: 'code', title: 'Doubling in a loop', language: 'python', runnable: true, code: 'def double(x):\n    return x * 2\n\ntotal = 0\nfor i in range(3):\n    total = total + double(i)\n    print(i, total)\nprint("done", total)' } as never,
  },
  {
    id: 'code-js', type: 'code', position: { x: 1900, y: 1180 },
    data: { kind: 'code', title: 'Counting down', language: 'javascript', runnable: true, code: 'let n = 3\nwhile (n > 0) {\n  console.log(n)\n  n = n - 1\n}\nconsole.log("lift off")' } as never,
  },
  {
    id: 'orbit', type: 'activity', position: { x: 2280, y: 1180 },
    data: { spec: {
      pattern: 'scene', prompt: 'Move the Moon to where we see a first quarter.', seed: 1,
      payload: { engine: 'orbit', config: { task: { kind: 'make-phase', phase: 'first quarter' } } },
      success: { kind: 'scene' },
    }, activityState: undefined } as never,
  },
  { id: 'activity', type: 'activity', position: { x: 380, y: 520 }, data: { spec: SORT, activityState: undefined } as never },
  {
    id: 'concept', type: 'concept', position: { x: 880, y: 520 },
    data: {
      kind: 'concept', title: 'How a language model starts',
      body: 'Every model learns from a [[corpus|the collection of texts a model is trained on]]. Words outside it are words it has never seen, so its [[vocabulary|the set of words the model knows]] is fixed by what it read.',
    } as never,
  },
]

const MOODS: InkyMood[] = ['idle', 'looking', 'talking', 'thinking', 'happy', 'concerned', 'celebrating']

function Bench() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [family, setFamily] = useState('matter')
  const [epoch, setEpoch] = useState(0)

  const onNodeDataChange = useCallback((id: string, patch: Partial<StudyNodeData>) => {
    setNodes((current) => current.map((n) => (n.id === id ? { ...n, data: { ...(n.data as object), ...patch } } : n)))
  }, [setNodes])

  return (
    <div className="ss-lesson relative bg-ss-canvas" style={{ width: '100vw', height: '100vh', ...subjectStyle(SUBJECT_FOR[family]) }}>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-ss-line bg-ss-panel p-2.5 shadow">
        <label className="flex items-center gap-2 text-xs font-semibold text-ss-slate">
          Subject
          <select className="nodrag rounded border border-ss-line bg-ss-panel px-2 py-1" value={family} onChange={(e) => setFamily(e.target.value)}>
            {SUBJECT_FAMILIES.map((f) => <option key={f.name} value={f.name}>{f.label} — {SUBJECT_FOR[f.name]}</option>)}
          </select>
        </label>
        <button type="button" className="rounded border border-ss-line px-2 py-1 text-xs font-semibold" onClick={() => setEpoch((e) => e + 1)}>
          Remount cards (as a reload would)
        </button>
        <div className="flex items-end gap-2">
          {MOODS.map((m) => (
            <div key={m} className="flex flex-col items-center text-[12px] text-ss-slate"><Inky size={34} mood={m} />{m}</div>
          ))}
        </div>
      </div>
      <CanvasContext.Provider
        value={{ onToggleGroup: () => {}, onNodeDataChange, onDeleteNode: () => {}, onAskTutor: () => {}, onNodeResize: () => {} }}
      >
        <ReactFlowProvider key={epoch}>
          <ReactFlow nodeTypes={studyNodeTypes} nodes={nodes} onNodesChange={onNodesChange} deleteKeyCode={null} defaultViewport={{ x: 24, y: 120, zoom: 1 }} minZoom={0.2} maxZoom={2}>
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      </CanvasContext.Provider>
    </div>
  )
}

export default function DevLearnSpacePage() {
  // Inlined by the bundler, so the bench does not ship to a production build.
  if (process.env.NODE_ENV === 'production') notFound()
  return <Bench />
}
