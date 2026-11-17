/**
 * Encryption: a Caesar cipher wheel, and a line from you to Bo with Eve listening in on it.
 *
 * The wheel is two card discs on one pin. The outer ring holds the plain letters and never moves; the inner ring holds
 * the cipher letters and turns. Turned on three letters, D sits under A, E under B, and so on: that turn is the key, and
 * the hub shows it. Your note (plaintext) is read off the outer ring onto the inner one, and the slip on the line carries
 * the result (ciphertext). The slip slides down the line past Eve's clip, she copies what she sees, and at the far end
 * Bo turns it back with his own key. In 'share', Bo has the note but no key, and the key itself has to travel the same
 * line: on its own (Eve copies it too) or shut in a box with Bo's open padlock (Eve sees only a locked box).
 *
 * A pure picture: no hooks, no state, no clicks. Flat material colours on a quiet light plate, the same in both themes.
 */
import type { CSSProperties, ReactNode } from 'react'

export type PictureProps = {
  /**
   * What the card is doing.
   * 'lock': your note hangs at your end of the line, its letters following the wheel; send it to Bo, who holds the agreed key.
   * 'crack': you are Eve. A caught note hangs on her clip; the card above the wheel shows what it reads as at the current turn.
   * 'share': your locked note already reached Bo (and Eve copied it). Bo has no key yet; your key and Bo's open padlock wait at your end.
   */
  mode: 'lock' | 'crack' | 'share'
  /** The note in plain letters: capitals and single spaces, 2 to 11 characters. */
  plain: string
  /** How many letters the inner ring is turned on from A-under-A, 0 to 25. This is the key set on your wheel, shown in the hub. */
  turn: number
  /**
   * The task's key, 1 to 25. (Not `key`: React keeps that name for itself.)
   * lock: the key Bo holds, stamped on his key (Bo reads the note by turning it back this far).
   * crack: the key the caught note was locked with. Never drawn.
   * share: your key, stamped on the key that travels (the wheel should be set to it).
   */
  cipherKey: number
  /** lock only. false: the note hangs at your end and its letters follow the wheel. true: it has gone down the line to Bo. */
  sent: boolean
  /** share only. Your key waits at your end ('home'), went down the line on its own ('bare'), or went in a box shut with Bo's padlock ('boxed'). */
  keyTrip: 'home' | 'bare' | 'boxed'
  /** Reduced motion: nothing travels, flips or rolls; every change shows its end frame at once. */
  reduced: boolean
}

/** When each motion has finished, from the prop change that starts it, so the View can hold the verdict until the picture has played. */
export const LOCK_SEND_DONE_MS = 2600
export const SHARE_BARE_DONE_MS = 2400
export const SHARE_BOXED_DONE_MS = 3100

// The subject is paper, card, brass and steel: a quiet plate, as skeleton-muscles has, with the objects in their own
// colours, the same in both themes. Flat colours only. One accent (teal) marks the key: the hub number and the window
// that shows which cipher letter sits under A.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const SOFT = '#475569'
const INK = '#1F2937'
const LEAD = '#64748B'
const ACCENT = '#0F766E'
const FONT = 'system-ui, sans-serif'
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace'
// Paper: warm white with a fawn edge; a pencil-grey for what Eve and Bo write.
const PAPER = '#FFFDF7'
const PAPER_EDGE = '#C9BB9C'
const PAPER_LINE = '#E9E1CF'
const PENCIL = '#3A4250'
// The wheel: a cream outer disc, a sage inner disc, an ivory hub cap.
const OUTER = '#EFE3C6'
const OUTER_EDGE = '#9C8660'
const OUTER_INK = '#4A3A1F'
const OUTER_TICK = '#C7B48C'
const INNER = '#D6E5DF'
const INNER_EDGE = '#6C8C83'
const INNER_INK = '#1E3B35'
const INNER_TICK = '#A9C2BA'
const HUB = '#FBF8F0'
// The line: a dark cable; wooden pegs; a steel crocodile clip.
const CABLE = '#4B5563'
const WOOD = '#D2AE84'
const WOOD_EDGE = '#8A6844'
const WOOD_DARK = '#B88F62'
const STEEL = '#CBD3DC'
const STEEL_EDGE = '#5B6673'
const STEEL_DARK = '#9AA5B1'
const BRASS = '#DDB75C'
const BRASS_EDGE = '#8C6A1E'
const BRASS_INK = '#4A3510'
// People: Eve in a muted violet hoodie with headphones, Bo in a sage jumper.
const EVE_SKIN = '#EBC29C'
const EVE_SKIN_EDGE = '#B98A62'
const EVE_HAIR = '#3B2A20'
const EVE_TOP = '#7C7299'
const EVE_TOP_EDGE = '#574E73'
const BO_SKIN = '#9A6544'
const BO_SKIN_EDGE = '#6E4429'
const BO_HAIR = '#221B17'
const BO_TOP = '#5F8B7B'
const BO_TOP_EDGE = '#41665A'
const PHONES = '#374151'

const W = 376
const H = 296
/** The line runs level across the top. */
const WY = 22
/** The wheel: centre, outer disc and its letter circle, inner disc and its letter circle, hub cap. */
const CX = 94
const CY = 204
const RO = 82
const RO_TXT = 72
const RI = 61
const RI_TXT = 51
const RH = 22
const STEP = 360 / 26
/** Where things hang on the line: your end, Eve's clip, Bo's end. */
const X_HOME = 64
const X_CLIP = 194
const X_BO = 314
/** Eve and Bo stand under the line; their notepads at chest height. */
const EX = 230
const BX = 324
const HEAD_Y = 86
const PAD_Y = 114
const PAD_H = 34
/** Your key and Bo's padlock box hang at your end in 'share', and both arrive over Bo. */
const X_KEY = 30
const X_BOX = 96
const X_ARRIVE = 326

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** Shift every letter on by k places round the alphabet (k may be negative); spaces stay. */
function caesar(text: string, k: number): string {
  const s = ((k % 26) + 26) % 26
  return text
    .split('')
    .map((ch) => {
      const i = LETTERS.indexOf(ch)
      return i < 0 ? ch : LETTERS[(i + s) % 26]
    })
    .join('')
}

const CSS = `
.enc-pop{animation:enc-pop .24s ease-out both}
.enc-fade{animation:enc-fade .3s ease-out both}
.enc-gone{animation:enc-gone .3s ease-in both}
.enc-out{transform-box:fill-box;transform-origin:center;animation:enc-out .13s ease-in both}
.enc-in{transform-box:fill-box;transform-origin:center;animation:enc-in .17s ease-out both}
.enc-shut{animation:enc-shut 2.3s both}
@keyframes enc-pop{from{opacity:0;transform:translateY(-4px)}}
@keyframes enc-fade{from{opacity:0}}
@keyframes enc-gone{to{opacity:0}}
@keyframes enc-out{to{transform:scaleY(0);opacity:0}}
@keyframes enc-in{from{transform:scaleY(0);opacity:0}}
@keyframes enc-shut{0%{transform:translateY(-6px)}17%,88%{transform:translateY(0)}96%,100%{transform:translateY(-6px)}}
`

const at = (delay: number): CSSProperties => ({ animationDelay: `${delay.toFixed(3)}s` })

/** A row of letters, one per cell, centred on cx: monospaced by placement, so no font can push them into each other. */
function row(text: string, cx: number, y: number, size: number, cell: number, fill: string, key: string, anim?: { cls: string; delay: number; step: number }): ReactNode[] {
  const n = text.length
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    if (text[i] === ' ') continue
    out.push(
      <text key={`${key}-${i}`} x={cx + (i - (n - 1) / 2) * cell} y={y} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={size} fill={fill}
        className={anim?.cls} style={anim ? at(anim.delay + i * anim.step) : undefined}>
        {text[i]}
      </text>,
    )
  }
  return out
}

/** Letters that flip, one after another, from one reading to another, like a split-flap board. Reduced: the end reading only. */
function flip(from: string, to: string, cx: number, y: number, size: number, cell: number, fill: string, key: string, delay: number, reduced: boolean): ReactNode[] {
  if (reduced || from === to) return row(to, cx, y, size, cell, fill, key)
  const n = to.length
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    if (to[i] === ' ') continue
    const x = cx + (i - (n - 1) / 2) * cell
    const t = delay + i * 0.045
    out.push(
      <text key={`${key}-o${i}`} x={x} y={y} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={size} fill={fill} className="enc-out" style={at(t)}>{from[i]}</text>,
      <text key={`${key}-n${i}`} x={x} y={y} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={size} fill={fill} className="enc-in" style={at(t + 0.13)}>{to[i]}</text>,
    )
  }
  return out
}

function label(text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'start', extra?: { className?: string; style?: CSSProperties }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize={12} fontWeight={600} fill={SOFT} {...extra}>
      {text}
    </text>
  )
}

/** A wooden clothes peg astride the line at x, holding whatever hangs below it. */
function peg(x: number) {
  return (
    <g>
      <rect x={x - 3.2} y={WY - 7} width={6.4} height={17} rx={1.6} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={0.8} />
      <line x1={x} y1={WY - 6} x2={x} y2={WY + 9} stroke={WOOD_DARK} strokeWidth={0.8} />
      <circle cx={x} cy={WY + 2} r={1.3} fill={STEEL_EDGE} />
    </g>
  )
}

/** A brass key hanging bow-up from (x, top), its number stamped in the bow. */
function brassKey(x: number, top: number, n: number) {
  return (
    <g>
      <rect x={x - 1.6} y={top + 17.5} width={3.2} height={22} rx={1} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.8} />
      <path d={`M${x + 1.4} ${top + 30} h4.6 v3 h-2 v2.4 h2.6 v3.2 h-5.2`} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
      <rect x={x - 3.4} y={top + 17} width={6.8} height={2.6} rx={0.8} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.7} />
      <circle cx={x} cy={top + 8.5} r={10} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={0.9} />
      <circle cx={x} cy={top + 8.5} r={7.4} fill="#EBCF86" stroke={BRASS_EDGE} strokeWidth={0.5} />
      <text x={x} y={top + 12.6} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={12} fill={BRASS_INK}>{n}</text>
    </g>
  )
}

/** Bo's own steel key: no number, a round bow with a hole, a longer bit. */
function steelKey(x: number, top: number) {
  return (
    <g>
      <rect x={x - 1.6} y={top + 16} width={3.2} height={24} rx={1} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={0.8} />
      <path d={`M${x + 1.4} ${top + 29} h5 v2.6 h-2.4 v2.6 h3.2 v3 h-2 v2.4 h-3.8`} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M${x} ${top - 1} a9.5 9.5 0 1 1 -0.01 0 Z M${x} ${top + 4.5} a4 4 0 1 0 0.01 0 Z`} fill={STEEL} fillRule="evenodd" stroke={STEEL_EDGE} strokeWidth={0.9} />
    </g>
  )
}

/** A spiral notepad held at chest height, centred on x, with two hands at its lower corners. */
function notepad(x: number, skin: string, skinEdge: string, children: ReactNode) {
  const l = x - 44
  return (
    <g>
      <rect x={l} y={PAD_Y} width={88} height={PAD_H} rx={3} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} />
      <line x1={l + 6} y1={PAD_Y + 27} x2={l + 82} y2={PAD_Y + 27} stroke={PAPER_LINE} strokeWidth={1} />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={l + 8 + i * 9} cy={PAD_Y} r={1.9} fill="none" stroke={STEEL_EDGE} strokeWidth={1} />
      ))}
      {children}
      <rect x={l + 7} y={PAD_Y + PAD_H - 5} width={7} height={9} rx={3.5} fill={skin} stroke={skinEdge} strokeWidth={0.8} />
      <rect x={l + 74} y={PAD_Y + PAD_H - 5} width={7} height={9} rx={3.5} fill={skin} stroke={skinEdge} strokeWidth={0.8} />
    </g>
  )
}

function Eve() {
  const x = EX
  const y = HEAD_Y
  return (
    <g>
      {/* The lead from her clip on the line down to her headphones. */}
      <path d={`M${X_CLIP + 12} ${WY + 3} C${X_CLIP + 16} ${WY + 30} ${x - 32} ${y - 16} ${x - 15} ${y + 5}`} fill="none" stroke={PHONES} strokeWidth={1.3} />
      <path d={`M${x - 26} ${PAD_Y + 20} L${x - 26} ${PAD_Y + 8} C${x - 26} ${y + 26} ${x - 17} ${y + 19} ${x} ${y + 19} C${x + 17} ${y + 19} ${x + 26} ${y + 26} ${x + 26} ${PAD_Y + 8} L${x + 26} ${PAD_Y + 20} Z`} fill={EVE_TOP} stroke={EVE_TOP_EDGE} strokeWidth={1} />
      <path d={`M${x - 12} ${y + 19.5} C${x - 9} ${y + 27} ${x + 9} ${y + 27} ${x + 12} ${y + 19.5}`} fill="none" stroke={EVE_TOP_EDGE} strokeWidth={1} />
      <rect x={x - 4} y={y + 8} width={8} height={12} fill={EVE_SKIN} />
      <circle cx={x} cy={y} r={11.5} fill={EVE_SKIN} stroke={EVE_SKIN_EDGE} strokeWidth={0.8} />
      {/* A bob with a side fringe. */}
      <path d={`M${x - 12.6} ${y + 9} C${x - 14.5} ${y - 6} ${x - 9} ${y - 14.5} ${x} ${y - 14.2} C${x + 9.5} ${y - 14} ${x + 14.5} ${y - 6} ${x + 12.6} ${y + 9} L${x + 9.8} ${y + 9} C${x + 10.6} ${y + 2} ${x + 10} ${y - 3} ${x + 7.5} ${y - 6} C${x + 2} ${y - 3.2} ${x - 5} ${y - 3} ${x - 9.6} ${y - 5} C${x - 10.6} ${y} ${x - 10.4} ${y + 4} ${x - 9.8} ${y + 9} Z`} fill={EVE_HAIR} />
      {/* Eyes turned up towards the line. */}
      <circle cx={x - 4.2} cy={y + 1.5} r={1.3} fill={INK} />
      <circle cx={x + 3.6} cy={y + 1.5} r={1.3} fill={INK} />
      <path d={`M${x - 2.4} ${y + 6.6} q2.4 1 4.8 0`} fill="none" stroke={EVE_SKIN_EDGE} strokeWidth={1} strokeLinecap="round" />
      {/* Headphones. */}
      <path d={`M${x - 13} ${y + 1} C${x - 13.5} ${y - 19} ${x + 13.5} ${y - 19} ${x + 13} ${y + 1}`} fill="none" stroke={PHONES} strokeWidth={2.4} />
      <rect x={x - 16.5} y={y - 4} width={6.5} height={11} rx={3} fill={PHONES} />
      <rect x={x + 10} y={y - 4} width={6.5} height={11} rx={3} fill={PHONES} />
    </g>
  )
}

function Bo() {
  const x = BX
  const y = HEAD_Y
  return (
    <g>
      <path d={`M${x - 26} ${PAD_Y + 20} L${x - 26} ${PAD_Y + 8} C${x - 26} ${y + 26} ${x - 17} ${y + 19} ${x} ${y + 19} C${x + 17} ${y + 19} ${x + 26} ${y + 26} ${x + 26} ${PAD_Y + 8} L${x + 26} ${PAD_Y + 20} Z`} fill={BO_TOP} stroke={BO_TOP_EDGE} strokeWidth={1} />
      <path d={`M${x - 7} ${y + 19.5} L${x} ${y + 25} L${x + 7} ${y + 19.5}`} fill="none" stroke={BO_TOP_EDGE} strokeWidth={1} />
      <rect x={x - 4} y={y + 8} width={8} height={12} fill={BO_SKIN} />
      <circle cx={x - 11.6} cy={y + 1} r={2.6} fill={BO_SKIN} stroke={BO_SKIN_EDGE} strokeWidth={0.7} />
      <circle cx={x + 11.6} cy={y + 1} r={2.6} fill={BO_SKIN} stroke={BO_SKIN_EDGE} strokeWidth={0.7} />
      <circle cx={x} cy={y} r={11.5} fill={BO_SKIN} stroke={BO_SKIN_EDGE} strokeWidth={0.8} />
      {/* Close-cropped hair. */}
      <path d={`M${x - 11.6} ${y - 1} C${x - 12.5} ${y - 12} ${x - 6} ${y - 14.6} ${x} ${y - 14.4} C${x + 6.5} ${y - 14.6} ${x + 12.5} ${y - 12} ${x + 11.6} ${y - 1} C${x + 9.5} ${y - 6} ${x + 4} ${y - 7.6} ${x - 1} ${y - 7.2} C${x - 5.5} ${y - 7} ${x - 9.6} ${y - 5.5} ${x - 11.6} ${y - 1} Z`} fill={BO_HAIR} />
      <circle cx={x - 4} cy={y + 2} r={1.3} fill={INK} />
      <circle cx={x + 4} cy={y + 2} r={1.3} fill={INK} />
      <path d={`M${x - 2.6} ${y + 6.6} q2.6 1 5.2 0`} fill="none" stroke={BO_SKIN_EDGE} strokeWidth={1} strokeLinecap="round" />
    </g>
  )
}

/** The paper slip on its peg, centred on x = 0, carrying the ciphertext. */
function slip(letters: ReactNode[]) {
  return (
    <g>
      <rect x={-46} y={WY + 6} width={92} height={25} rx={2} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} />
      <line x1={-40} y1={WY + 26} x2={40} y2={WY + 26} stroke={PAPER_LINE} strokeWidth={1} />
      {letters}
      {peg(0)}
    </g>
  )
}

/** Bo's padlock box, centred on x = 0, hanging from a hook on the line. The shackle stands open, or is shut. */
function box(shackle: ReactNode) {
  return (
    <g>
      <path d={`M-5 ${WY + 9} C-5 ${WY - 2} 5 ${WY - 2} 5 ${WY + 9}`} fill="none" stroke={STEEL_EDGE} strokeWidth={1.6} />
      <rect x={-16} y={WY + 8} width={32} height={23} rx={2.2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1} />
      <rect x={-16} y={WY + 8} width={32} height={6.5} rx={2.2} fill={WOOD_DARK} stroke={WOOD_EDGE} strokeWidth={1} />
      <line x1={-12} y1={WY + 20} x2={12} y2={WY + 20} stroke={WOOD_DARK} strokeWidth={0.8} />
      <line x1={-12} y1={WY + 25.5} x2={12} y2={WY + 25.5} stroke={WOOD_DARK} strokeWidth={0.8} />
      <rect x={-3} y={WY + 11} width={6} height={10} rx={1} fill={STEEL_DARK} stroke={STEEL_EDGE} strokeWidth={0.7} />
      {shackle}
      <rect x={-8} y={WY + 21} width={16} height={14.5} rx={2.6} fill={STEEL} stroke={STEEL_EDGE} strokeWidth={1} />
      <line x1={-5.5} y1={WY + 23.5} x2={5.5} y2={WY + 23.5} stroke="#E6EBF0" strokeWidth={1} />
      <circle cx={0} cy={WY + 27.2} r={1.9} fill={STEEL_EDGE} />
      <rect x={-0.75} y={WY + 27.8} width={1.5} height={4.2} fill={STEEL_EDGE} />
    </g>
  )
}

export default function Picture(props: PictureProps) {
  const { mode, plain, turn, cipherKey, sent, keyTrip, reduced } = props
  const glide = reduced ? 'none' : undefined
  const anim = (cls: string, delay: number) => (reduced ? {} : { className: cls, style: at(delay) })

  // What each piece of paper says.
  const onSlip = mode === 'lock' ? caesar(plain, turn) : caesar(plain, cipherKey)
  const lockSent = mode === 'lock' && sent
  const boReads = mode === 'lock' ? caesar(onSlip, -cipherKey) : keyTrip === 'home' ? onSlip : plain
  const eveHasKey = mode === 'share' && keyTrip === 'bare'

  // The slip: at your end in 'lock' (until sent), on Eve's clip in 'crack', gone to Bo in 'share'.
  const slipX = mode === 'crack' ? X_CLIP : lockSent ? X_BO : X_HOME
  const slipGlide: CSSProperties = {
    transform: `translateX(${slipX - X_HOME}px)`,
    transition: glide ?? 'transform 1.4s cubic-bezier(.45,0,.3,1) .1s',
  }
  const slipLetters =
    mode === 'lock' && !sent && !reduced
      ? row(onSlip, 0, WY + 22.5, 12.5, 7.6, INK, `s${turn}`, { cls: 'enc-pop', delay: 0, step: 0.018 })
      : row(onSlip, 0, WY + 22.5, 12.5, 7.6, INK, 's')

  // The card above the wheel: your note, or (as Eve) what the caught note reads as at this turn.
  const cardText = mode === 'crack' ? caesar(onSlip, -turn) : plain
  const cardLetters =
    mode === 'crack' && !reduced
      ? row(cardText, 22 + ((cardText.length - 1) / 2) * 8.6, 106, 14, 8.6, INK, `c${turn}`, { cls: 'enc-pop', delay: 0, step: 0.018 })
      : row(cardText, 22 + ((cardText.length - 1) / 2) * 8.6, 106, 14, 8.6, INK, 'c')

  // Share: the key, and the box with Bo's padlock, set off along the line.
  const keyX = keyTrip === 'bare' ? X_ARRIVE : keyTrip === 'boxed' ? X_BOX : X_KEY
  const keyGlide: CSSProperties = {
    transform: `translate(${keyX - X_KEY}px, ${keyTrip === 'boxed' ? 8 : 0}px)`,
    opacity: keyTrip === 'boxed' ? 0 : 1,
    transition: glide ?? (keyTrip === 'bare' ? 'transform 1.4s cubic-bezier(.45,0,.3,1)' : 'transform .35s ease-in, opacity .3s ease-in .1s'),
  }
  const boxGlide: CSSProperties = {
    transform: `translateX(${keyTrip === 'boxed' ? X_ARRIVE - X_BOX : 0}px)`,
    transition: glide ?? 'transform 1.4s cubic-bezier(.45,0,.3,1) .55s',
  }
  // The shackle stands open at your end; snaps shut on the key; opens again over Bo, under Bo's own key.
  const shackle = (
    <path key={`sh-${keyTrip}`} d={`M-5 ${WY + 22} V${WY + 15.5} A5 5 0 0 1 5 ${WY + 15.5} V${WY + 22}`} fill="none" stroke={STEEL_EDGE} strokeWidth={2.6}
      className={keyTrip === 'boxed' && !reduced ? 'enc-shut' : undefined}
      style={{ transform: 'translateY(-6px)' }} />
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
      aria-label="A cipher wheel, and a line from you to Bo with Eve listening in on it">
      <style>{CSS}</style>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill={PLATE} stroke={PLATE_EDGE} />

      {/* The line, end to end. */}
      <line x1={8} y1={WY} x2={W - 8} y2={WY} stroke={CABLE} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={8} cy={WY} r={3.4} fill={CABLE} />
      <circle cx={W - 8} cy={WY} r={3.4} fill={CABLE} />

      <Eve />
      <Bo />
      {label('Eve', EX + 21, HEAD_Y + 4)}
      {label('Bo', BX + 18, HEAD_Y + 4)}

      {/* Eve's crocodile clip, biting the line. */}
      <g>
        <path d={`M${X_CLIP - 9} ${WY - 1.2} L${X_CLIP - 7} ${WY - 3} L${X_CLIP - 5} ${WY - 1.4} L${X_CLIP - 3} ${WY - 3.4} L${X_CLIP - 1} ${WY - 1.6} L${X_CLIP + 1} ${WY - 3.8} L${X_CLIP + 5} ${WY - 5.6} L${X_CLIP + 6} ${WY - 1} Z`} fill={STEEL_DARK} stroke={STEEL_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <path d={`M${X_CLIP - 9} ${WY + 1.2} L${X_CLIP - 7} ${WY + 3} L${X_CLIP - 5} ${WY + 1.4} L${X_CLIP - 3} ${WY + 3.4} L${X_CLIP - 1} ${WY + 1.6} L${X_CLIP + 1} ${WY + 3.8} L${X_CLIP + 5} ${WY + 5.6} L${X_CLIP + 6} ${WY + 1} Z`} fill={STEEL_DARK} stroke={STEEL_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
        <rect x={X_CLIP + 4} y={WY - 4} width={9} height={8} rx={2} fill="#A34A3B" stroke="#6F2C22" strokeWidth={0.8} />
      </g>

      {/* Eve's notepad: what she copied as the note went past. */}
      {mode === 'lock' && lockSent && (
        <g key="eve-lock" {...anim('enc-fade', 0.72)}>
          {notepad(EX, EVE_SKIN, EVE_SKIN_EDGE, reduced ? row(onSlip, EX, PAD_Y + 23, 12, 7.4, PENCIL, 'e') : row(onSlip, EX, PAD_Y + 23, 12, 7.4, PENCIL, 'e', { cls: 'enc-pop', delay: 0.82, step: 0.03 }))}
        </g>
      )}
      {mode === 'share' && (
        <g>
          {notepad(EX, EVE_SKIN, EVE_SKIN_EDGE, flip(onSlip, eveHasKey ? plain : onSlip, EX, PAD_Y + 23, 12, 7.4, PENCIL, `e-${keyTrip}`, 0.85, reduced))}
          {eveHasKey && <g key="eve-key" {...anim('enc-fade', 0.72)}>{brassKey(EX, PAD_Y + PAD_H + 8, cipherKey)}</g>}
        </g>
      )}

      {/* Bo's notepad: what the note says once he turns it back with his key. */}
      {lockSent && (
        <g key="bo-lock" {...anim('enc-fade', 1.5)}>
          {notepad(BX, BO_SKIN, BO_SKIN_EDGE, flip(onSlip, boReads, BX, PAD_Y + 23, 12, 7.4, PENCIL, 'b', 1.84, reduced))}
        </g>
      )}
      {mode === 'share' && (
        <g>{notepad(BX, BO_SKIN, BO_SKIN_EDGE, flip(onSlip, boReads, BX, PAD_Y + 23, 12, 7.4, PENCIL, `b-${keyTrip}`, keyTrip === 'boxed' ? 2.3 : 1.5, reduced))}</g>
      )}

      {/* Bo's key on its nail: the agreed key in 'lock'; his own private key in 'share'. */}
      {mode !== 'crack' && <circle cx={X_ARRIVE + 4} cy={PAD_Y + PAD_H + 10} r={1.6} fill={STEEL_EDGE} />}
      {mode === 'lock' && (
        <g>
          {brassKey(X_ARRIVE + 4, PAD_Y + PAD_H + 11, cipherKey)}
          {label("Bo's key", X_ARRIVE + 4, PAD_Y + PAD_H + 68, 'middle')}
        </g>
      )}
      {mode === 'share' && (
        <g>
          {steelKey(X_ARRIVE + 4, PAD_Y + PAD_H + 13)}
          {label("Bo's private key", W - 10, PAD_Y + PAD_H + 68, 'end')}
        </g>
      )}

      {/* The slip on the line. */}
      {mode !== 'share' && (
        <g transform={`translate(${X_HOME} 0)`}>
          <g style={slipGlide}>{slip(slipLetters)}</g>
        </g>
      )}
      {mode === 'lock' && label('ciphertext', X_HOME + 52, WY + 22, 'start', { style: { opacity: sent ? 0 : 1, transition: glide ?? 'opacity .25s' } })}
      {mode === 'crack' && label('ciphertext', X_CLIP + 52, WY + 22)}

      {/* Share: your key and Bo's open padlock box at your end. */}
      {mode === 'share' && (
        <g>
          <g transform={`translate(${X_BOX} 0)`}>
            <g style={boxGlide}>{box(shackle)}</g>
          </g>
          <g transform={`translate(${X_KEY} 0)`}>
            <g style={keyGlide}>
              <line x1={0} y1={WY + 6} x2={0} y2={WY + 8} stroke={WOOD_EDGE} strokeWidth={1} />
              {brassKey(0, WY + 7, cipherKey)}
              {peg(0)}
            </g>
          </g>
          <g style={{ opacity: keyTrip === 'home' ? 1 : 0, transition: glide ?? 'opacity .25s' }}>
            {label('your key', 14, 88)}
            <line x1={X_BOX} y1={WY + 39} x2={X_BOX} y2={94} stroke={LEAD} strokeWidth={1} />
            {label("Bo's public padlock", 50, 106)}
          </g>
        </g>
      )}

      {/* The card above the wheel: plaintext. */}
      {mode !== 'share' && (
        <g>
          <rect x={12} y={74} width={164} height={41} rx={4} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} />
          {label('plaintext', 22, 89)}
          {cardLetters}
        </g>
      )}

      {/* The wheel. Outer disc: plain letters, fixed. */}
      <circle cx={CX} cy={CY} r={RO} fill={OUTER} stroke={OUTER_EDGE} strokeWidth={1.2} />
      {LETTERS.split('').map((ch, i) => {
        const a = i * STEP
        const r = (a * Math.PI) / 180
        const x = CX + RO_TXT * Math.sin(r)
        const y = CY - RO_TXT * Math.cos(r)
        const tA = ((i + 0.5) * STEP * Math.PI) / 180
        return (
          <g key={ch}>
            <line x1={CX + (RO - 5) * Math.sin(tA)} y1={CY - (RO - 5) * Math.cos(tA)} x2={CX + RO * Math.sin(tA)} y2={CY - RO * Math.cos(tA)} stroke={OUTER_TICK} strokeWidth={1} />
            <text x={x} y={y} transform={`rotate(${a.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={12} fill={OUTER_INK}>{ch}</text>
          </g>
        )
      })}
      {/* Inner disc: cipher letters, turned on by the key. */}
      <g style={{ transform: `rotate(${(-turn * STEP).toFixed(3)}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box', transition: glide ?? 'transform .45s cubic-bezier(.3,.7,.3,1)' }}>
        <circle cx={CX} cy={CY} r={RI} fill={INNER} stroke={INNER_EDGE} strokeWidth={1.2} />
        {LETTERS.split('').map((ch, i) => {
          const a = i * STEP
          const r = (a * Math.PI) / 180
          const x = CX + RI_TXT * Math.sin(r)
          const y = CY - RI_TXT * Math.cos(r)
          const tA = ((i + 0.5) * STEP * Math.PI) / 180
          return (
            <g key={ch}>
              <line x1={CX + (RI - 4) * Math.sin(tA)} y1={CY - (RI - 4) * Math.cos(tA)} x2={CX + RI * Math.sin(tA)} y2={CY - RI * Math.cos(tA)} stroke={INNER_TICK} strokeWidth={1} />
              <text x={x} y={y} transform={`rotate(${a.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={11} fill={INNER_INK}>{ch}</text>
            </g>
          )
        })}
        {/* A thumb grip pressed into the inner disc, so its turning shows. */}
        <ellipse cx={CX} cy={CY + 32} rx={8} ry={5.5} fill={INNER_TICK} stroke={INNER_EDGE} strokeWidth={0.8} />
        <ellipse cx={CX} cy={CY + 33} rx={5.4} ry={3.4} fill={INNER} />
      </g>
      {/* The window over A: the plain letter and the cipher letter that stands under it. */}
      <rect x={CX - 10.5} y={CY - RO + 0.5} width={21} height={RO - 38} rx={5} fill={ACCENT} fillOpacity={0.08} stroke={ACCENT} strokeWidth={1.6} />
      {/* The hub cap on the pin: the key, as a number of letters turned. */}
      <circle cx={CX} cy={CY} r={RH} fill={HUB} stroke={OUTER_EDGE} strokeWidth={1.1} />
      <text x={CX} y={CY - 5} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={12} fill={SOFT}>key</text>
      <text x={CX} y={CY + 13} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={18} fill={ACCENT}>{turn}</text>

      {/* Leader lines naming the rings. */}
      <path d={ringLead(RO_TXT, 7.5, 233)} fill="none" stroke={LEAD} strokeWidth={1} />
      {label('plain letters', 190, 237)}
      <path d={ringLead(RI_TXT + 2, 8.5, 256)} fill="none" stroke={LEAD} strokeWidth={1} />
      {label('cipher letters', 190, 260)}
    </svg>
  )
}

/** A leader from a gap between two outer letters (slot s, in letter steps from A) at radius r, out past the rim, then level to a label at y. */
function ringLead(r: number, s: number, y: number): string {
  const a = (s * STEP * Math.PI) / 180
  const p = (rr: number) => `${(CX + rr * Math.sin(a)).toFixed(1)} ${(CY - rr * Math.cos(a)).toFixed(1)}`
  return `M${p(r)} L${p(RO + 5)} L186 ${y}`
}
