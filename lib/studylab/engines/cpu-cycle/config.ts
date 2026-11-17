// lib/studylab/engines/cpu-cycle/config.ts
//
// A small Von Neumann machine the learner operates as its control unit. Instructions and data share RAM;
// each tap chooses the component that sends next and a visible address, instruction or value travels.
// ADD and STORE have different execute transfers. Rules and marking live here, never in the drawing.
//
// Model and register order: BBC Bitesize's Von Neumann and fetch-decode-execute accounts
// https://www.bbc.co.uk/bitesize/guides/zbfny4j/revision/4 and /revision/5 (read 2026).
// The decimal three-digit instruction encoding is the teaching model of the Little Man Computer:
// 1xx ADD, 3xx STORE, 000 HLT. No binary decoding, pipelining or timing is claimed.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CpuCycleView } from './View'

export type ProgramName = 'add' | 'store'
export type PartId = 'PC' | 'MAR' | 'MDR' | 'CIR' | 'ACC' | 'RAM' | 'CU' | 'ALU'
export type TokenKind = 'address' | 'instruction' | 'data' | 'control' | 'result'

export type CpuConfig = { task: 'cycle'; program: ProgramName }
export type CpuState = { taps?: PartId[] }

export const W = 360
export const H = 306

export type Transfer = {
  from: PartId
  to: PartId
  token: TokenKind
  phase: 'Fetch' | 'Decode' | 'Execute'
  /** A plain account of what moved, using the values before this transfer. */
  say(m: Machine): string
}

export type Machine = {
  pc: number
  mar: number | null
  mdr: number | null
  cir: number | null
  acc: number
  ram: number[]
  decoded: boolean
}

export type MachineFrame = {
  machine: Machine
  transfer: Transfer | null
  /** 0 is ready to send, 1 is the completed transfer. */
  progress: number
  /** Contents before the transfer, used to draw the token that actually travelled. */
  before?: Machine
  stage: string
  phase: Transfer['phase'] | 'Ready'
  halted: boolean
}

export const ADD_RAM = [104, 0, 0, 0, 4]
export const STORE_RAM = [304, 0, 0, 0, 0]
export const ramOf = (config: CpuConfig): number[] => [...(config.program === 'add' ? ADD_RAM : STORE_RAM)]

export const instructionText = (code: number): string => code === 0 ? 'HLT' : code >= 100 && code < 200 ? `ADD ${code % 100}` : code >= 300 && code < 400 ? `STORE ${code % 100}` : String(code)
export const contentText = (config: CpuConfig, address: number, code: number): string =>
  config.program === 'add' && address < 2 || config.program === 'store' && address < 2 ? instructionText(code) : String(code)

export function initialMachine(config: CpuConfig): Machine {
  return { pc: 0, mar: null, mdr: null, cir: null, acc: config.program === 'add' ? 7 : 12, ram: ramOf(config), decoded: false }
}

/** The exact transfers of the syllabus model. PC increments as its address is copied, not when CIR is filled. */
export function transfersOf(config: CpuConfig, m: Machine): Transfer[] {
  // This is the whole next instruction, addressed by PC. CIR may still hold the previous one at the start.
  const nextCode = m.ram[m.pc] ?? 0
  const opcode = Math.floor(nextCode / 100)
  const operand = nextCode % 100
  const halt = nextCode === 0
  const steps: Transfer[] = [
    { from: 'PC', to: 'MAR', token: 'address', phase: 'Fetch', say: (s) => `PC sends address ${s.pc} to MAR. PC becomes ${s.pc + 1}, ready for the next instruction.` },
    { from: 'MAR', to: 'RAM', token: 'address', phase: 'Fetch', say: (s) => `MAR sends address ${s.mar} along the address bus.` },
    { from: 'CU', to: 'RAM', token: 'control', phase: 'Fetch', say: () => 'The control unit sends READ along the control bus.' },
    { from: 'RAM', to: 'MDR', token: 'instruction', phase: 'Fetch', say: (s) => `RAM sends code ${s.mar === null ? '' : s.ram[s.mar] ?? 0} along the data bus to MDR.` },
    { from: 'MDR', to: 'CIR', token: 'instruction', phase: 'Fetch', say: (s) => `MDR copies code ${s.mdr ?? ''} into CIR.` },
    { from: 'CIR', to: 'CU', token: 'instruction', phase: 'Decode', say: (s) => `CIR sends code ${s.cir ?? ''} to the control unit, which decodes ${s.cir === null ? 'it' : instructionText(s.cir)}.` },
  ]
  if (halt || opcode === null) return steps
  if (opcode === 1) {
    steps.push(
      { from: 'CU', to: 'MAR', token: 'address', phase: 'Execute', say: () => `The control unit puts operand address ${operand} into MAR.` },
      { from: 'MAR', to: 'RAM', token: 'address', phase: 'Execute', say: (s) => `MAR sends address ${s.mar} along the address bus.` },
      { from: 'CU', to: 'RAM', token: 'control', phase: 'Execute', say: () => 'The control unit sends READ along the control bus.' },
      { from: 'RAM', to: 'MDR', token: 'data', phase: 'Execute', say: (s) => `RAM sends data ${s.mar === null ? '' : s.ram[s.mar] ?? 0} along the data bus to MDR.` },
      { from: 'MDR', to: 'ALU', token: 'data', phase: 'Execute', say: (s) => `MDR sends ${s.mdr} to the ALU, to add to ACC ${s.acc}.` },
      { from: 'ALU', to: 'ACC', token: 'result', phase: 'Execute', say: (s) => `The ALU sends the result ${s.acc + (s.mdr ?? 0)} to ACC.` },
    )
  } else if (opcode === 3) {
    steps.push(
      { from: 'CU', to: 'MAR', token: 'address', phase: 'Execute', say: () => `The control unit puts destination address ${operand} into MAR.` },
      { from: 'ACC', to: 'MDR', token: 'data', phase: 'Execute', say: (s) => `ACC copies its value ${s.acc} into MDR.` },
      { from: 'CU', to: 'RAM', token: 'control', phase: 'Execute', say: () => 'The control unit sends WRITE along the control bus.' },
      { from: 'MDR', to: 'RAM', token: 'data', phase: 'Execute', say: (s) => `MDR sends ${s.mdr} along the data bus to RAM address ${s.mar}.` },
    )
  }
  return steps
}

function afterTransfer(config: CpuConfig, before: Machine, t: Transfer): Machine {
  const m: Machine = { ...before, ram: [...before.ram] }
  const operand = before.cir === null ? 0 : before.cir % 100
  switch (`${t.from}-${t.to}`) {
    case 'PC-MAR': m.mar = before.pc; m.pc = before.pc + 1; break
    case 'RAM-MDR': m.mdr = before.mar === null ? null : before.ram[before.mar] ?? null; break
    case 'MDR-CIR': m.cir = before.mdr; m.decoded = false; break
    case 'CIR-CU': m.decoded = true; break
    case 'CU-MAR': m.mar = operand; break
    case 'ALU-ACC': m.acc = before.acc + (before.mdr ?? 0); break
    case 'ACC-MDR': m.mdr = before.acc; break
    case 'MDR-RAM': if (before.mar !== null && before.mar >= 0 && before.mar < m.ram.length) m.ram[before.mar] = before.mdr ?? 0; break
  }
  return m
}

/** Every state the learner can reach: one frame after each completed transfer. */
export function framesOf(config: CpuConfig): MachineFrame[] {
  const out: MachineFrame[] = [{ machine: initialMachine(config), transfer: null, progress: 1, stage: 'Ready: the first instruction is waiting in RAM.', phase: 'Ready', halted: false }]
  let m = initialMachine(config)
  while (m.cir !== 0 || !m.decoded) {
    const steps = transfersOf(config, m)
    for (const transfer of steps) {
      const before = m
      m = afterTransfer(config, m, transfer)
      const halted = m.cir === 0 && m.decoded
      out.push({ machine: m, transfer, progress: 1, before, phase: transfer.phase, halted,
        stage: halted ? 'HLT decoded and executed: the processor stops.' : transfer.say(before) })
    }
  }
  return out
}

/** A safe state from taps: only a prefix of the machine's real transfers does anything. */
export function historyOf(config: CpuConfig, raw: CpuState): PartId[] {
  const valid: PartId[] = ['PC', 'MAR', 'MDR', 'CIR', 'ACC', 'RAM', 'CU', 'ALU']
  return Array.isArray(raw?.taps) ? raw.taps.filter((x): x is PartId => valid.includes(x)) : []
}

export function frameAt(config: CpuConfig, raw: CpuState): { frame: MachineFrame; accepted: number; wrong: PartId | null } {
  const frames = framesOf(config)
  let accepted = 0
  let wrong: PartId | null = null
  for (const tap of historyOf(config, raw)) {
    const next = frames[accepted + 1]
    if (!next?.transfer) { wrong = tap; break }
    if (next.transfer.from === tap) accepted++
    // A mistaken tap changes nothing and does not trap the learner: a later correct tap still works.
    else wrong = tap
  }
  return { frame: frames[accepted], accepted, wrong }
}

export function done(config: CpuConfig, state: CpuState): boolean {
  return frameAt(config, state).frame.halted
}

export function expectedPart(config: CpuConfig, state: CpuState): PartId | null {
  const f = frameAt(config, state)
  const frames = framesOf(config)
  return frames[f.accepted + 1]?.transfer?.from ?? null
}

export const PART_NAMES: Record<PartId, string> = {
  PC: 'program counter', MAR: 'memory address register', MDR: 'memory data register', CIR: 'current instruction register',
  ACC: 'accumulator', RAM: 'RAM', CU: 'control unit', ALU: 'arithmetic logic unit',
}

export function madeText(config: CpuConfig, state: CpuState): string {
  const f = frameAt(config, state)
  if (f.wrong) return `${PART_NAMES[f.wrong]} is not the sender for this transfer. Its last action left the machine waiting: ${f.frame.stage}`
  if (!f.frame.halted) return `The processor is part way through: ${f.frame.stage}`
  return config.program === 'add'
    ? `The program stopped with ${f.frame.machine.acc} in ACC.`
    : `The program stopped with ${f.frame.machine.ram[4]} stored at RAM address 4.`
}

export function working(config: CpuConfig, state: CpuState): string {
  const m = frameAt(config, state).frame.machine
  return config.program === 'add'
    ? `Yes. The ALU added 4 to ACC 7, giving ${m.acc}. HLT stopped the next cycle.`
    : `Yes. ACC 12 travelled through MDR to RAM address 4. HLT stopped the next cycle.`
}

const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
const PROGRAM_WORDS: Record<string, ProgramName> = {
  add: 'add', addition: 'add', 'add-data': 'add', 'add-instruction': 'add', alu: 'add', accumulator: 'add', arithmetic: 'add', 'fetch-add': 'add',
  store: 'store', storage: 'store', 'store-data': 'store', 'store-instruction': 'store', write: 'store', 'write-memory': 'store', 'fetch-store': 'store',
}
const TASK_WORDS = new Set(['cycle', 'fetch-decode-execute', 'fetch-execute', 'fde', 'step', 'steps', 'registers', 'von-neumann', 'stored-program', 'transfers', ''])

const goodPrompt = (config: CpuConfig) => `You are the control unit. Tap the part that must send next and watch each transfer. Run the ${config.program === 'add' ? 'ADD' : 'STORE'} program through fetch, decode and execute until it stops.`

export const cpuCycleEngine: SceneEngine<CpuConfig, CpuState> = {
  id: 'cpu-cycle',
  covers: ['CPU', 'registers', 'buses', 'Von Neumann'],
  phrases: [
    'central processing unit', 'computer processor', 'processor architecture', 'fetch decode execute', 'fetch-decode-execute cycle', 'fetch execute cycle', 'instruction cycle',
    'stored program', 'stored-program concept', 'Von Neumann architecture', 'program counter', 'memory address register', 'memory data register', 'current instruction register',
    'accumulator register', 'arithmetic logic unit', 'control unit', 'address bus', 'data bus', 'control bus', 'CPU registers', 'CPU buses', 'parts of the CPU',
  ],
  notFor: [
    'logic gates', 'logic circuits', 'truth tables', 'Boolean logic', 'binary numbers', 'binary arithmetic', 'data representation', 'hexadecimal', 'denary',
    'network', 'networks', 'networking', 'packet switching', 'algorithm', 'algorithms', 'trace table', 'trace tables', 'pseudocode', 'bubble sort', 'linear search',
    'storage devices', 'secondary storage', 'magnetic storage', 'optical storage', 'solid state storage', 'memory types', 'RAM and ROM', 'virtual memory',
    'clock speed', 'CPU performance', 'processor performance', 'cores', 'multi-core', 'cache', 'cache memory', 'pipelining', 'assembly programming', 'Little Man Computer programming',
  ],
  isolates: 'order',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = src.task ?? src.kind ?? src.type ?? src.mode
    const task = keyOf(rawTask ?? 'cycle')
    if (!TASK_WORDS.has(task)) return null
    const rawProgram = src.program ?? src.instruction ?? src.operation ?? src.example ?? 'add'
    const word = keyOf(rawProgram)
    if (!word) return null
    return { task: 'cycle', program: PROGRAM_WORDS[word] ?? word as ProgramName }
  },

  faults(config) {
    if (config.task !== 'cycle') return [`This scene draws a fetch-decode-execute cycle: use task "cycle".`]
    if (config.program !== 'add' && config.program !== 'store') {
      return [`There is no "${config.program}" program drawn here: use program "add" to show the ALU and ACC, or program "store" to show a write to RAM; e.g. { "task":"cycle", "program":"add" }.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const gives = /\bPC\s*(?:→|->|⇒|to)\s*MAR\b|\bMDR\s*(?:→|->|⇒|to)\s*CIR\b|\b(?:first|next|then)\s+(?:tap|press|choose|click)\b|\btap\s+(?:the\s+)?(?:PC|MAR|MDR|CIR|ACC|ALU|CU|RAM)\b/i.test(text)
      || /\bprogram counter\b[^.]{0,40}\b(?:increment|next instruction)\b/i.test(text)
      || (config.program === 'add' && (/\b11\b/.test(text) || /\b7\s*\+\s*4\b/.test(text) || /\bdata\s+4\b/i.test(text)))
      || (config.program === 'store' && (/\bRAM\s+(?:address\s+)?4\b/i.test(text) || /\bACC\s*(?:→|->|⇒|to)\s*MDR\b/i.test(text)))
    if (gives) out.push(`the prompt gives the transfer order or result away, which the learner works out by operating the processor -- name only the program and gesture ("${example}")`)
    if (/\bdrag\b|\bslide\b|\btype\b|\bwrite (?:a|an|the)?\s*(?:program|code|assembly)\b|\bcompile\b|\bbinary\b|\bhex\b|\bpipeline\b|\bcache\b|\bclock speed\b|\bcores?\b|\bGHz\b|\bnetwork\b|\btruth table\b|\btrace table\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it only taps CPU/RAM parts through decimal ADD or STORE transfers -- ask for that ("${example}")`)
    }
    return out
  },

  initial: () => ({ taps: [] }),
  check: (config, state) => ({ ok: done(config, state), wrongIds: [] }),
  solve(config) {
    const taps: PartId[] = []
    const frames = framesOf(config)
    for (let i = 1; i < frames.length; i++) {
      const t = frames[i].transfer
      if (t) taps.push(t.from)
    }
    return { taps }
  },
  View: CpuCycleView,

  prompt: `SCENE "cpu-cycle" -- a small Von Neumann processor and one shared RAM stick on a quiet light panel. The learner acts as the control unit: tap the component that sends next. The address, instruction, data or READ/WRITE signal visibly travels, then the receiving register or RAM cell changes. Each correct tap advances exactly one labelled transfer; a wrong tap leaves the machine unchanged and says what that part currently holds. Stage captions say what moved, and Fetch / Decode / Execute is named live. Reduced motion gives the same sequence as still frames.
  For: Von Neumann architecture, the stored-program concept, fetch-decode-execute one transfer at a time, PC/MAR/MDR/CIR/ACC, CU and ALU, address/data/control buses. Instructions and data are visibly in the same RAM. It answers "PC holds the current instruction", "MAR holds data", and "MDR and CIR are the same".
  config: { "task":"cycle", "program":"add" } -- ADD 4 then HLT; ACC starts at 7, RAM holds ADD 4, HLT and data 4, so executing ADD uses MDR, ALU and ACC. The prompt says "You are the control unit. Tap the part that must send next and watch each transfer. Run the ADD program through fetch, decode and execute until it stops."
       or { "task":"cycle", "program":"store" } -- STORE 4 then HLT; ACC starts at 12 and the result is written into RAM address 4. The equivalent prompt ends "Run the STORE program through fetch, decode and execute until it stops."
  Not drawn: writing assembly, binary encoding, branches, pipelining, clock speed, cores, cache, logic gates or algorithm trace tables. Do not promise CPU performance, RAM/ROM or storage-device teaching.
  Before marking the card shows current register/RAM contents, the live phase and the last transfer; it holds back the next sender, full transfer sequence and final result. The prompt must not name the sender sequence, PC increment, operand/result, destination or which register to tap. Do not call it a quiz: there are no options to recognise, only the machine to operate.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"You are the control unit. Tap the part that must send next and watch each transfer. Run the ADD program through fetch, decode and execute until it stops.",
    "payload": { "engine":"cpu-cycle", "config": { "task":"cycle", "program":"add" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:cpu-cycle", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"You are the control unit. Tap the part that must send next and watch each transfer. Run the STORE program through fetch, decode and execute until it stops.",
    "payload": { "engine":"cpu-cycle", "config": { "task":"cycle", "program":"store" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:cpu-cycle", "why":"..." } }`,
}

registerEngine(cpuCycleEngine as SceneEngine<unknown, unknown>)
