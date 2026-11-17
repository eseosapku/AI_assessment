// lib/studylab/engines/encryption/config.ts
//
// The cipher wheel and the line (see .superpowers/bakeoff/encryption/design.md).
// A Caesar wheel's inner ring is turned; the note on the line changes letter by letter; sent, it slides past Eve's clip
// and Bo turns it back with the same key. A key is how far the wheel turns.
//   lock  -- Bo holds the key; lock the note with it and send it;
//   crack -- you are Eve: turn the wheel until the caught note makes sense;
//   share -- Bo has the locked note but no key: send him the key on its own, or shut in his padlock box.
//
// Rules are computed here and never read from the drawing.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EncryptionView } from './View'

export type Kind = 'lock' | 'crack' | 'share'
export type KeyTrip = 'home' | 'bare' | 'boxed'

/** The config as the tutor may write it: read broadly, then refused by faults when it cannot be drawn. */
export type EncryptionConfig =
  | { kind: Kind; plain: string; key: number }
  /** Read but not drawn: faults refuses it. */
  | { kind: 'other'; asked: string; plain: string; key: number }

export type EncryptionState = { turn: number; sent: boolean; keyTrip: KeyTrip; tried: number[] }

export const DEFAULT_PLAIN = 'MEET AT TEN'
export const DEFAULT_KEY: Record<Kind, number> = { lock: 3, crack: 7, share: 7 }

// ---------------------------------------------------------------------------
// The cipher.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** Shift every letter k places on round the alphabet (k may be negative); spaces stay. */
export function shift(text: string, k: number): string {
  const s = ((Math.round(k) % 26) + 26) % 26
  return text
    .split('')
    .map((ch) => {
      const i = LETTERS.indexOf(ch)
      return i < 0 ? ch : LETTERS[(i + s) % 26]
    })
    .join('')
}

const isKind = (v: unknown): v is Kind => v === 'lock' || v === 'crack' || v === 'share'
const isKey = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 25

/** The state, read safely: anything corrupt reads as the start. */
export function readState(state: Partial<EncryptionState> | null | undefined): EncryptionState {
  const turn = typeof state?.turn === 'number' && Number.isFinite(state.turn) ? Math.min(25, Math.max(0, Math.round(state.turn))) : 0
  const sent = state?.sent === true
  const keyTrip: KeyTrip = state?.keyTrip === 'bare' || state?.keyTrip === 'boxed' ? state.keyTrip : 'home'
  const tried = Array.isArray(state?.tried)
    ? Array.from(new Set(state.tried.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 25))).sort((a, b) => a - b)
    : []
  return { turn, sent, keyTrip, tried }
}

/** A config the card can draw (faults is empty). */
const kindOf = (config: EncryptionConfig): Kind => config.kind as Kind

// ---------------------------------------------------------------------------
// Marking.

/** Who can read the note on the line, for a lock card once it has gone. */
export function whoReads(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): 'Bo' | 'Eve' | 'nobody' {
  const s = readState(state)
  if (s.turn === config.key) return 'Bo'
  if (s.turn === 0) return 'Eve'
  return 'nobody'
}

export function done(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): boolean {
  if (faults(config).length) return false
  const s = readState(state)
  if (config.kind === 'lock') return s.sent && s.turn === config.key
  if (config.kind === 'crack') return s.turn === config.key
  if (config.kind === 'share') return s.keyTrip === 'boxed'
  return false
}

/** Has the card been taken far enough to mark? lock: the note is sent. share: the key has gone. */
export function ready(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): boolean {
  const s = readState(state)
  if (config.kind === 'lock') return s.sent
  if (config.kind === 'share') return s.keyTrip !== 'home'
  return true
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

export function goalText(config: EncryptionConfig): string {
  if (config.kind === 'lock') return "Lock your note with Bo's key and send it"
  if (config.kind === 'crack') return 'Read the caught note'
  if (config.kind === 'share') return 'Get the key to Bo so that only he can read the note'
  return ''
}

export function measureOf(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): { label: string; value: string }[] {
  const s = readState(state)
  if (config.kind === 'lock') {
    const out = [{ label: 'Your key', value: String(s.turn) }]
    if (s.sent) out.push({ label: 'Can read it', value: whoReads(config, s) })
    return out
  }
  if (config.kind === 'crack') return [{ label: 'Keys tried', value: `${s.tried.length} of 25` }]
  const value = s.keyTrip === 'home' ? 'nobody yet' : s.keyTrip === 'bare' ? 'Bo and Eve' : 'only Bo'
  return [{ label: 'Can read it', value }]
}

const letters = (n: number) => `${n} letter${n === 1 ? '' : 's'}`

/** What the caught note reads as at this turn (crack). */
export function readingOf(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): string {
  return shift(shift(config.plain, config.key), -readState(state).turn)
}

export function captionText(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'lock') {
    if (!s.sent) {
      if (s.turn === 0) return 'The ring is not turned, so every letter stays itself and the slip says the note as it is.'
      return `The ring is turned ${letters(s.turn)}, so every letter swaps for the one ${s.turn} place${s.turn === 1 ? '' : 's'} on. The window shows A becoming the letter under it.`
    }
    if (s.turn === config.key) return `Eve copied scrambled letters, and Bo turned them back ${letters(s.turn)} to read the note.`
    if (s.turn === 0) return "The note went as it was, so Eve can read it, and Bo's key scrambles it."
    return "Eve can't read it, and Bo's key turns it into different nonsense."
  }
  if (config.kind === 'crack') return `Turned back ${letters(s.turn)}, the note reads ${readingOf(config, s)}.`
  if (config.kind === 'share') {
    if (s.keyTrip === 'bare') return 'The key went past Eve, who copied it, so now both of them read the note.'
    if (s.keyTrip === 'boxed') return 'Eve saw only a locked box, and Bo opened it with his private key.'
    return "Bo and Eve both hold the scrambled note and neither has the key. Anyone can snap Bo's padlock shut, but only his private key opens it."
  }
  return ''
}

/** What a marked card says. */
export function verdictText(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'other') return ''
  if (!ready(config, s)) return config.kind === 'lock' ? 'Send the note first.' : 'Send your key first.'
  const ok = done(config, s)
  if (config.kind === 'lock') {
    if (ok) return 'Bo reads it and Eve has only scrambled letters: the same key locks and unlocks.'
    if (s.turn === 0) return 'Eve reads your note because it was never locked.'
    return `Key ${s.turn} is not Bo's key ${config.key}, so he gets nonsense too.`
  }
  if (config.kind === 'crack') {
    if (ok) {
      const t = s.tried.length
      return `It reads ${config.plain}: key ${config.key} was found in ${t} ${t === 1 ? 'try' : 'tries'}. There are only 25 keys to try, so a Caesar cipher is easy to break.`
    }
    if (s.turn === 0) return 'The ring has not been turned, so the note is still scrambled.'
    return `At key ${s.turn} it still is not the note.`
  }
  if (ok) return 'Only Bo can read it.'
  return 'Bo can read it, but so can Eve, who copied the key on its way.'
}

export function describe(config: EncryptionConfig, state: Partial<EncryptionState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'lock') {
    return s.sent
      ? `A cipher wheel with its inner ring turned ${letters(s.turn)}. The locked note has gone down the line past Eve to Bo.`
      : `A cipher wheel with its inner ring turned ${letters(s.turn)}. The note on the line reads ${shift(config.plain, s.turn)}. Bo holds a numbered key.`
  }
  if (config.kind === 'crack') return `A cipher wheel with its inner ring turned back ${letters(s.turn)}. Eve's clip holds a caught note that reads ${readingOf(config, s)} at this turn.`
  const trip = s.keyTrip === 'home' ? 'Your key and Bo’s open padlock box wait at your end of the line.' : s.keyTrip === 'bare' ? 'Your key has gone down the line on its own, past Eve.' : "Your key has gone down the line shut in Bo's padlock box."
  return `Bo and Eve both hold your locked note. ${trip}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))

function readKey(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : -1
  if (typeof raw === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(raw)) return Number(raw)
  return -1
}

const EX_LOCK = '{ "kind":"lock", "plain":"MEET AT TEN", "key":3 }'
const EX_CRACK = '{ "kind":"crack", "plain":"GO AT NOON", "key":7 }'
const EX_SHARE = '{ "kind":"share", "plain":"MEET AT TEN", "key":7 }'

function faults(config: EncryptionConfig): string[] {
  if (config.kind === 'other') {
    return [`Only three tasks are built: lock a note with Bo's key and send it (${EX_LOCK}), read a caught note as Eve (${EX_CRACK}) and get a key to Bo (${EX_SHARE}), not "${config.asked}". Use ${EX_LOCK}.`]
  }
  const out: string[] = []
  const p = config.plain
  if (typeof p !== 'string' || !p) out.push(`The note needs capital letters: use "plain":"MEET AT TEN".`)
  else if (/[a-z]/.test(p) && !/[^A-Za-z ]/.test(p)) out.push(`The note is in capitals, not "${p}": use "plain":"${p.toUpperCase().replace(/\s+/g, ' ').trim()}".`)
  else if (/[^A-Z ]/.test(p)) out.push(`The note holds only capital letters and spaces, not "${p}" (digits and punctuation are not turned by the wheel): use "plain":"MEET AT TEN".`)
  else if (p !== p.trim() || /  /.test(p)) out.push(`The note has single spaces between words and none at the ends, not "${p}": use "plain":"${p.trim().replace(/\s+/g, ' ')}".`)
  else if (p.length < 2 || p.length > 11) out.push(`The note is 2 to 11 characters so it fits the slip and the notepads, not ${p.length}: use "plain":"MEET AT TEN".`)
  else if (new Set(p.replace(/ /g, '')).size < 3) out.push(`The note needs at least 3 different letters, or every turn looks equally like nonsense: use "plain":"GO AT NOON".`)
  if (!isKey(config.key)) out.push(`The key is a whole number from 1 to 25 (key 0 locks nothing), not ${config.key}: use "key":3.`)
  return out
}

// ---------------------------------------------------------------------------
// Prompts.

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
export function keyWord(n: number): string {
  if (n <= 20) return NUMBER_WORDS[n]
  return `twenty-${NUMBER_WORDS[n - 20]}`
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasWordIn = (text: string, w: string) => new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(text)
const mentionsKey = (text: string, n: number) => hasWordIn(text, String(n)) || new RegExp(`\\b${keyWord(n).replace('-', '[- ]')}\\b`, 'i').test(text)

const VERDICT_TELLS = [/\bright\b/i, /\bwrong\b/i, /\bcorrect\b/i]
const SHARE_TELLS = [/\bpadlock\b/i, /\bbox(?:es|ed)?\b/i, /\bpublic\b/i, /\bprivate\b/i, /\block it\b/i]

export const EXAMPLES: { prompt: string; config: EncryptionConfig }[] = [
  { prompt: 'You and Bo agreed on key 3. Turn the wheel to lock your note, then send it past Eve.', config: { kind: 'lock', plain: 'MEET AT TEN', key: 3 } },
  { prompt: "Bo's key is 5. Turn the inner ring to lock your note, then send it down the line.", config: { kind: 'lock', plain: 'BRING CAKE', key: 5 } },
  { prompt: "You're Eve. You caught this note but not its key. Turn the wheel until the note makes sense.", config: { kind: 'crack', plain: 'GO AT NOON', key: 7 } },
  { prompt: 'Bo has your locked note but not the key. Send him the key so that only Bo can read the note.', config: { kind: 'share', plain: 'MEET AT TEN', key: 7 } },
]

function promptFaults(config: EncryptionConfig, prompt: string): string[] {
  if (config.kind === 'other' || faults(config).length) return []
  const text = prompt.replace(/\s+/g, ' ')
  const out: string[] = []
  const found: string[] = []
  for (const r of VERDICT_TELLS) {
    const m = text.match(r)?.[0]
    if (m) found.push(m)
  }
  if (config.kind === 'crack') {
    for (const w of config.plain.split(' ')) if (hasWordIn(text, w)) found.push(w)
    if (mentionsKey(text, config.key)) found.push(String(config.key))
  } else if (config.kind === 'lock') {
    const cipher = shift(config.plain, config.key)
    for (const w of cipher.split(' ')) if (hasWordIn(text, w)) found.push(w)
    if (!mentionsKey(text, config.key)) out.push(`the prompt must name Bo's key, ${config.key}, since the wheel is set to it: say "Bo's key is ${config.key}", e.g. "${EXAMPLES[1].prompt}"`)
  } else {
    for (const r of SHARE_TELLS) {
      const m = text.match(r)?.[0]
      if (m) found.push(m)
    }
  }
  if (found.length) out.unshift(`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the situation and the gesture, e.g. "${config.kind === 'share' ? EXAMPLES[3].prompt : config.kind === 'crack' ? EXAMPLES[2].prompt : EXAMPLES[0].prompt}"`)
  return out
}

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const encryptionEngine: SceneEngine<EncryptionConfig, EncryptionState> = {
  id: 'encryption',
  covers: ['encryption', 'decryption', 'cipher'],
  phrases: [
    'caesar cipher', 'caesar shift', 'shift cipher', 'substitution cipher', 'cipher wheel', 'plaintext', 'plain text', 'ciphertext', 'cipher text',
    'encryption key', 'secret key', 'shared key', 'symmetric encryption', 'asymmetric encryption', 'public key', 'private key', 'public and private keys',
    'public key encryption', 'key exchange', 'sharing the key', 'key distribution', 'why data is encrypted', 'encrypting data', 'intercepted data',
    'interception of data', 'eavesdropping', 'eavesdropper', 'cryptography', 'code breaking', 'codebreaking', 'brute force attack', 'secret messages', 'secret codes',
  ],
  notFor: [
    'julius caesar', 'caesar salad', 'roman empire', 'lock and key', 'lock and key model', 'lock and key hypothesis', 'active site', 'hashing', 'hash function', 'hash functions',
    'password', 'passwords', 'password strength', 'firewall', 'firewalls', 'malware', 'phishing', 'data packets', 'binary code', 'genetic code', 'morse code', 'key signature',
    'musical key', 'key stage', 'map key', 'keywords', 'key words', 'piano keys', 'keyboard',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawKind = first(o, ['kind', 'task', 'type', 'mode'])
    if (rawKind === undefined) return null
    const k = keyOf(rawKind)
    let kind: Kind | 'other'
    if (hasWord(k, ['lock', 'encrypt', 'encryption', 'send'])) kind = 'lock'
    else if (hasWord(k, ['crack', 'break', 'decrypt', 'decryption', 'eve', 'read'])) kind = 'crack'
    else if (hasWord(k, ['share', 'exchange', 'key', 'deliver', 'sharing'])) kind = 'share'
    else kind = 'other'
    const plainRaw = first(o, ['plain', 'plaintext', 'note', 'message', 'text'])
    const plain = plainRaw === undefined ? DEFAULT_PLAIN : typeof plainRaw === 'string' ? plainRaw : String(plainRaw)
    const keyRaw = first(o, ['key', 'cipherKey', 'shift', 'turn'])
    if (kind === 'other') return { kind: 'other', asked: String(rawKind), plain, key: keyRaw === undefined ? 3 : readKey(keyRaw) }
    return { kind, plain, key: keyRaw === undefined ? DEFAULT_KEY[kind] : readKey(keyRaw) }
  },

  faults,
  promptFaults,

  initial(config) {
    if (config.kind === 'share') return { turn: config.key, sent: true, keyTrip: 'home', tried: [] }
    return { turn: 0, sent: false, keyTrip: 'home', tried: [] }
  },

  check(config, state) {
    const ok = done(config, state)
    return { ok, wrongIds: ok ? [] : ['note'] }
  },

  solve(config) {
    const kind = kindOf(config)
    if (kind === 'lock') return { turn: config.key, sent: true, keyTrip: 'home', tried: [] }
    if (kind === 'crack') return { turn: config.key, sent: false, keyTrip: 'home', tried: Array.from({ length: config.key }, (_, i) => i + 1) }
    return { turn: config.key, sent: true, keyTrip: 'boxed', tried: [] }
  },

  View: EncryptionView,

  prompt: `SCENE "encryption" -- a Caesar cipher wheel (an outer ring of plain letters and an inner ring of cipher letters that the learner turns), and a line from the learner to Bo with Eve listening in on it with a crocodile clip. Turning the ring changes the note on the line letter by letter; a number on the hub shows how far it is turned (the key). Sent, the note slides past Eve, who copies the scrambled letters, and Bo's notepad flips letter by letter into what he reads with his key.
  Tasks: "lock" (Bo holds a key, shown on his brass key; turn the wheel to it, lock the note and send it), "crack" (you are Eve: a caught note hangs on her clip and a card shows what it reads at each turn; turn the wheel back until it makes sense, then see that there are only 25 keys to try), "share" (Bo already has your locked note but no key; send him the key on its own, where Eve copies it, or shut in Bo's open padlock box, which only his private key opens: public/private key exchange).
  For: encryption, decryption, ciphers, keys, the Caesar cipher, why a shared key is a problem, public and private keys. The idea it isolates is the consequence: change the key, or how the key travels, and see who can read the note.
  Before marking the card shows the goal, a live "who can read it" or "keys tried" readout and a caption, and never says right or wrong. The prompt must say the situation and the gesture. For "lock" it must name Bo's key number (the wheel is set to it) but never the locked letters. For "crack" never the note's words or the key. For "share" never "padlock", "box", "public", "private" or "lock it". Never "right", "wrong" or "correct".
  The note is capitals and single spaces, 2 to 11 characters, with at least 3 different letters; the key is a whole number from 1 to 25.
  Not drawn: lower case, digits or punctuation in the note, a longer note, key 0 or beyond 25, other ciphers (substitution tables, Vigenere), hashing, passwords.
  config examples:
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[0].prompt}",
    "payload": { "engine":"encryption", "config": ${JSON.stringify(EXAMPLES[0].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:encryption", "why":"..." } }`,
}

registerEngine(encryptionEngine as SceneEngine<unknown, unknown>)
