// lib/studylab/engines/day-night/config.ts
//
// Day and night, made by hand. The Earth is seen from above the North Pole with the Sun shining from the left, and
// "you" stand on it. The learner turns the Earth (it turns only one way) and watches their own sky answer: the Sun
// comes up in the east, climbs, goes down in the west, and the stars come out, while the Sun itself never moves.
//   watch   -- your sky is open: turn the Earth until it is sunrise, midday, sunset, midnight, daytime or night-time
//              for you, watching it happen;
//   predict -- your curtains are closed: you decide from the globe alone, and the curtains open on the sky you made.
//
// The rules, all computed here and never read from the drawing:
//   your local time is the start hour plus the hours turned, round a 24-hour turn;
//   the half of the Earth facing the Sun has day; you meet the light at sunrise and leave it at sunset;
//   a target is met within NEAR hours either side (sunrise, midday, sunset, midnight), or when you are clearly
//   inside the lit or the dark half (daytime, night-time).
//
// Facts (school astronomy; NAAP's Lunar Phase Simulator for the polar view, the BEST "Day and night" notes for the
// misconceptions):
//   - the Earth spins on its axis once every 24 hours, west to east: anticlockwise seen from above the North Pole;
//   - so a place turns into the sunlight at sunrise and the Sun appears in the east, and turns out of it at sunset with
//     the Sun in the west; midday faces the Sun, midnight faces straight away from it;
//   - "you" stand on the equator, and the light falls as at an equinox: sunrise and sunset are a quarter of a turn either
//     side of midday. The card counts hours turned and never shows a clock, because a clock's sunrise depends on the
//     place, the time zone and the season (the tilt is the climate-station card's, not this one's).
// Ideas taken, never code or art:
//   - a globe turned by hand under a lamp, the classroom model (Wellcome Explorify; BEST);
//   - the observer on the Earth seen from above the North Pole, turned by dragging (NAAP, University of Nebraska);
//   - predict, then see (South Australia's and the Philippines DepEd's day-and-night models).
// Refused:
//   - clouds and hills in the sky: children's first ideas of night are the Sun going behind hills or clouds (Baxter
//     1989), so the sky has neither;
//   - turning the Earth backwards: a picture of the Sun climbing out of the west would teach the very slip this card
//     is for. The Earth turns one way only, and says so when pushed the other way;
//   - clock times, time zones and day length through the year.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { DayNightView } from './View'

export const MOMENTS = ['sunrise', 'midday', 'sunset', 'midnight'] as const
export const SPANS = ['day', 'night'] as const
export const TIMES = [...MOMENTS, ...SPANS] as const
export type Moment = (typeof MOMENTS)[number]
export type TimeName = (typeof TIMES)[number]
export const TASKS = ['watch', 'predict'] as const
export type Task = (typeof TASKS)[number]

/** time: what to make for you. A word outside the list still parses, and faults says what would work. */
export type DayNightConfig = { task: Task; time: string }
/** How far the learner has turned the Earth, in hours, since the card opened. It only ever grows. */
export type DayNightState = { turned: number }

/** Your local time at each moment, on a 24-hour turn: midday faces the Sun. */
export const MOMENT_HOUR: Record<Moment, number> = { midnight: 0, sunrise: 6, midday: 12, sunset: 18 }
/**
 * Where each card starts. For sunrise and sunset the first edge of the light you reach is the other one, so a learner
 * who stops at the first edge has made the wrong moment and is told which.
 */
export const START_HOUR: Record<TimeName, number> = { sunrise: 14, sunset: 2, midday: 3, midnight: 15, day: 22, night: 10 }
/** If it looks right, it is right: a moment is met this many hours either side (15 degrees of turn an hour). */
export const NEAR = 1
/** Daytime and night-time count once you are this far past the edge of the light, clearly inside the half. */
export const INSIDE = 0.5
/** What solve turns to for the spans: the middle of the half. */
const SPAN_HOUR: Record<(typeof SPANS)[number], number> = { day: 12, night: 0 }

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const isTime = (t: string): t is TimeName => (TIMES as readonly string[]).includes(t)
const isMoment = (t: string): t is Moment => (MOMENTS as readonly string[]).includes(t)

export const wrap24 = (h: number) => ((h % 24) + 24) % 24
/** Hours from a to b round the clock, either way: 0 to 12. */
export const apart = (a: number, b: number) => {
  const d = Math.abs(wrap24(a) - wrap24(b))
  return Math.min(d, 24 - d)
}

/** The hours turned, read safely: anything else counts as no turn at all. */
export function turnedOf(state: DayNightState | null | undefined): number {
  const t = state?.turned
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 ? t : 0
}
const startOf = (config: DayNightConfig) => (isTime(config.time) ? START_HOUR[config.time] : START_HOUR.sunrise)
/** Your local time now, 0 to 24, midnight at 0. */
export const hourAt = (config: DayNightConfig, state: DayNightState) => wrap24(startOf(config) + turnedOf(state))

/** The Sun's height in your sky, in degrees: you are on the equator and the light falls as at an equinox. */
export const sunHeight = (hour: number) => 90 - 15 * apart(hour, 12)
export const isDay = (hour: number) => sunHeight(hour) > 0

/** Whether a local time meets the target. */
export function meets(time: TimeName, hour: number): boolean {
  if (isMoment(time)) return apart(hour, MOMENT_HOUR[time]) <= NEAR + 1e-9
  // Clearly inside the half: INSIDE hours of turn past either edge of the light.
  const pastEdge = Math.min(apart(hour, 6), apart(hour, 18))
  return pastEdge >= INSIDE - 1e-9 && (time === 'day' ? isDay(hour) : !isDay(hour))
}

export function done(config: DayNightConfig, state: DayNightState): boolean {
  return isTime(config.time) && meets(config.time, hourAt(config, state))
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card names no time at all.

export type Phase = Moment | 'early-night' | 'morning' | 'afternoon' | 'late-night'

/** The part of the day an hour falls in, with the moments taking NEAR hours either side. */
export function phaseOf(hour: number): Phase {
  for (const m of MOMENTS) if (apart(hour, MOMENT_HOUR[m]) <= NEAR + 1e-9) return m
  const h = wrap24(hour)
  if (h < 6) return 'early-night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'late-night'
}

const WHAT_YOU_MADE: Record<Phase, string> = {
  midnight: 'midnight: you are facing straight away from the Sun, in the middle of the dark half',
  sunrise: 'sunrise: you are on the edge of the light and being turned into it, so the Sun is coming up in the east',
  midday: 'midday: you are facing straight at the Sun, so it is at its highest in your sky',
  sunset: 'sunset: you are on the edge of the light and being turned out of it, so the Sun is going down in the west',
  'early-night': 'night-time, a few hours before sunrise: you are on the half facing away from the Sun',
  morning: 'morning: you are on the half facing the Sun, and the Sun is part-way up in the east',
  afternoon: 'afternoon: you are on the half facing the Sun, and the Sun is part-way down in the west',
  'late-night': 'night-time, a few hours after sunset: you are on the half facing away from the Sun',
}

/** On the far side of the Earth, at the same moment. */
const FAR_SIDE: Record<TimeName, string> = {
  sunrise: 'sunset', sunset: 'sunrise', midday: 'midnight', midnight: 'midday', day: 'night-time', night: 'daytime',
}

const WHY: Record<TimeName, string> = {
  sunrise: 'Yes, sunrise. You are being turned into the light. The Sun did not move: the Earth spins towards the east, so the Sun comes up in the east.',
  midday: 'Yes, midday. You face straight at the Sun, so it is highest in your sky. The Sun did not climb: the Earth turned you towards it.',
  sunset: 'Yes, sunset. You are being turned out of the light, so the Sun drops out of sight in the west.',
  midnight: 'Yes, midnight. You face straight away from the Sun. It is still shining, on the other half of the Earth.',
  day: 'Yes, daytime. You are on the half of the Earth that faces the Sun.',
  night: 'Yes, night-time. You are on the half facing away from the Sun. Nothing covered the Sun: the Earth turned you away from it.',
}

const minutesText = (m: number) => (m >= 55 ? 'about an hour' : `about ${m} minutes`)

/** What a correct card says: near enough with the exact moment, why, and what it is on the far side of the Earth. */
export function working(config: DayNightConfig, state: DayNightState): string {
  const time: TimeName = isTime(config.time) ? config.time : 'sunrise'
  const hour = hourAt(config, state)
  let why = WHY[time]
  if (isMoment(time)) {
    const target = MOMENT_HOUR[time]
    const off = wrap24(hour - target + 12) - 12
    const minutes = Math.round((Math.abs(off) * 60) / 10) * 10
    // Near is right too, and says the exact moment in place of the plain yes.
    if (minutes >= 20) why = `Near enough: ${minutesText(minutes)} ${off > 0 ? 'after' : 'before'} ${time}. ${why.replace(/^Yes, [^.]*\.\s*/, '')}`
  }
  return `${why} It is ${FAR_SIDE[time]} on the far side of the Earth.${time === 'sunrise' ? '' : ' One turn takes 24 hours.'}`
}

/** What a wrong card says: what the learner made, never how far to go. */
export function madeText(config: DayNightConfig, state: DayNightState): string {
  return `You made it ${WHAT_YOU_MADE[phaseOf(hourAt(config, state))]}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, Task> = {
  watch: 'watch', see: 'watch', look: 'watch', sky: 'watch', 'watch-the-sky': 'watch', open: 'watch', turn: 'watch', spin: 'watch', rotate: 'watch', 'turn-the-earth': 'watch', 'spin-the-earth': 'watch',
  explore: 'watch', show: 'watch', make: 'watch', set: 'watch', find: 'watch',
  predict: 'predict', prediction: 'predict', guess: 'predict', closed: 'predict', curtains: 'predict', 'curtains-closed': 'predict', 'closed-curtains': 'predict', blind: 'predict', reason: 'predict', 'no-sky': 'predict',
  'without-the-sky': 'predict', test: 'predict', quiz: 'predict',
}

const TIME_WORDS: Record<string, TimeName> = {
  sunrise: 'sunrise', 'sun-rise': 'sunrise', 'sun-rising': 'sunrise', 'sun-rises': 'sunrise', dawn: 'sunrise', daybreak: 'sunrise', 'day-break': 'sunrise', sunup: 'sunrise', 'sun-up': 'sunrise', 'first-light': 'sunrise',
  midday: 'midday', 'mid-day': 'midday', noon: 'midday', 'twelve-noon': 'midday', '12-noon': 'midday', 'solar-noon': 'midday', 'local-noon': 'midday', noontime: 'midday',
  sunset: 'sunset', 'sun-set': 'sunset', 'sun-setting': 'sunset', 'sun-sets': 'sunset', dusk: 'sunset', sundown: 'sunset', 'sun-down': 'sunset', nightfall: 'sunset',
  midnight: 'midnight', 'mid-night': 'midnight', '12-midnight': 'midnight', 'twelve-midnight': 'midnight', 'middle-of-the-night': 'midnight',
  day: 'day', daytime: 'day', 'day-time': 'day', daylight: 'day', 'in-daylight': 'day',
  night: 'night', nighttime: 'night', 'night-time': 'night', dark: 'night', darkness: 'night', 'in-the-dark': 'night',
}

function readTime(raw: unknown): string | null {
  if (raw === undefined) return 'sunrise'
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const key = keyOf(String(raw)).replace(/^(?:it-is-|its-|it-s-|make-it-|at-|the-|a-)+/, '').replace(/-for-(?:you|me)$/, '')
  if (key === '') return null
  return has(TIME_WORDS, key) ? TIME_WORDS[key] : key
}

/** What a prompt can safely say: the gesture and the goal, nothing about how far or where. */
const GOAL: Record<TimeName, string> = {
  sunrise: 'you see the Sun rise', midday: 'it is midday for you', sunset: 'you see the Sun set', midnight: 'it is midnight for you', day: 'it is daytime for you', night: 'it is night-time for you',
}
const TIME_SAID: Record<TimeName, string> = {
  sunrise: 'sunrise', midday: 'midday', sunset: 'sunset', midnight: 'midnight', day: 'daytime', night: 'night-time',
}
export function goodPrompt(config: DayNightConfig): string {
  const time: TimeName = isTime(config.time) ? config.time : 'sunrise'
  if (config.task === 'predict') return `Your curtains are closed, so use the globe. Drag the Earth round the way its arrow points, or tap the turn buttons, and stop when you think it is ${TIME_SAID[time]} for you.`
  return `Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when ${GOAL[time]}.`
}

/** The nearest working time for a word this card cannot make. */
function nearestTime(word: string): TimeName {
  if (/morn|am\b|early|wake/.test(word)) return 'sunrise'
  if (/after|even|pm\b|tea|supper|dinner/.test(word)) return 'sunset'
  if (/lunch|high/.test(word)) return 'midday'
  if (/sleep|bed|late/.test(word)) return 'night'
  return 'sunrise'
}

export const dayNightEngine: SceneEngine<DayNightConfig, DayNightState> = {
  id: 'day-night',
  // Distinctive words only: "time", "day", "night", "spin" and "rotation" alone would catch clocks, shapes and crops.
  covers: ['sunrise', 'sunset'],
  phrases: [
    'day and night', 'night and day', 'day night', 'day-night cycle', 'day and night cycle', 'cycle of day and night', 'why we have day and night', 'what causes day and night', 'causes of day and night', 'how day and night happen',
    'daytime and night-time', 'daytime and nighttime', 'night-time and daytime',
    'the earth spinning', 'earth spinning', 'spinning earth', 'the spinning earth', 'earth spins', 'the earth spins', 'earth turning', 'the earth turning', 'the earth turns', 'earth turns',
    'earth rotation', "earth's rotation", 'earths rotation', 'rotation of the earth', 'the earth rotates', 'earth rotates', 'rotating earth', 'the rotating earth',
    'spins on its axis', 'spinning on its axis', 'spin on its axis', 'rotates on its axis', 'rotating on its axis', 'rotation on its axis', 'turns on its axis',
    'apparent movement of the sun', "sun's apparent movement", 'apparent motion of the sun', "sun's apparent motion", 'movement of the sun across the sky', 'the sun across the sky', 'sun across the sky',
    'sun moves across the sky', 'the sun appears to move', 'sun appears to move', 'sun seems to move', 'the sun seems to move', 'sun rises in the east', 'rises in the east', 'sets in the west',
    'sunrise and sunset', 'sun rise and sun set', 'dawn and dusk',
  ],
  // Near misses: the Moon, the seasons and the tilt, shadows, turning shapes, and "sunrise" as a business word.
  notFor: [
    'phases of the moon', 'moon phases', 'lunar phases', 'phase of the moon', 'eclipse', 'eclipses', 'solar eclipse', 'lunar eclipse',
    'why we have seasons', 'cause of the seasons', 'causes of the seasons', 'reason for the seasons', 'reasons for the seasons', "earth's tilt", 'earths tilt', 'tilt of the earth', 'axial tilt', 'tilted axis', 'tilt of the axis',
    'day length', 'length of day', 'length of the day', 'length of daylight', 'hours of daylight', 'daylight hours', 'midnight sun', 'polar night', 'polar day', 'land of the midnight sun',
    'shadow stick', 'shadow sticks', 'shadows', 'sundial', 'sundials', 'shadow clock',
    'rotational symmetry', 'rotation of shapes', 'rotating shapes', 'rotating a shape', 'centre of rotation', 'center of rotation', 'angle of rotation', 'rotations and reflections', 'crop rotation', 'rotation of crops', 'job rotation', 'rotating shifts',
    'nocturnal', 'nocturnal animals', 'diurnal', 'day and night animals', 'animals active at night', 'night sky', 'stars at night', 'constellations', 'body clock', 'circadian',
    'sunrise industry', 'sunrise industries', 'sunset industry', 'sunset industries', 'sunset clause', 'sunset clauses', 'sunset provision',
  ],
  // The learner sets where they are on the turn: how far round the Earth has carried them.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type', 'mode'] : ['task', 'kind', 'type', 'mode'])
    const rawTime = first(src, ['time', 'target', 'moment', 'goal', 'when', 'make'])
    let task: Task = 'watch'
    if (rawTask !== undefined) {
      const word = keyOf(rawTask)
      // A time as the task ("sunrise") is a watch task for that time.
      if (has(TIME_WORDS, word) && rawTime === undefined) return { task: 'watch', time: TIME_WORDS[word] }
      if (!has(TASK_WORDS, word)) return null
      task = TASK_WORDS[word]
    }
    // A closed sky, or drawn curtains, make it a prediction.
    const sky = first(src, ['sky', 'window'])
    const curtains = first(src, ['curtains'])
    if (sky === false || ['closed', 'hidden', 'off', 'none', 'shut', 'covered'].includes(keyOf(sky)) || curtains === true || ['closed', 'shut', 'drawn'].includes(keyOf(curtains))) task = 'predict'
    const time = readTime(rawTime)
    return time === null ? null : { task, time }
  },

  faults(config) {
    const out: string[] = []
    if (!isTime(config.time)) {
      const near = nearestTime(config.time)
      out.push(`This card cannot make "${config.time}": time must be one of sunrise, midday, sunset, midnight, day or night (clock times are not shown, since sunrise is not at the same clock time everywhere), e.g. time "${near}".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    // "24 hours" is the fact of one whole turn, not a distance to go.
    const howFar = /\b(?!24\b)(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|several)\s+(?:more\s+)?hours?\b|\b(?:quarter|half|three[- ]quarters?)(?:\s+of)?\s+(?:a\s+)?(?:turn|spin|rotation|way round|way around)\b|\bhalf ?way\b|\bdegrees?\b|°/i.test(text)
    const where = /\b(?:to|at|on|onto|near)\s+the\s+(?:top|bottom|left|right|far side|middle of the (?:light|dark|lit|day|night))\b|\b(?:top|bottom|left-hand|right-hand)\s+(?:side|half|edge)\b|\bthe\s+(?:top|bottom|left|right)(?:[- ]hand)?\s+(?:of|side|edge|half)\b|\bedge\b|\bline between\b|\bborder\b|\bboundary\b|\bterminator\b|\b(?:into|out of)\s+the\s+(?:light|sunlight|sun|dark|darkness|shadow)\b|\bfac(?:e|es|ing)\s+(?:straight\s+)?(?:at\s+|towards?\s+|away\s+from\s+)?the\s+sun\b|\bstraight (?:at|away)\b|\bfirst (?:edge|time)\b|\bkeep (?:turning|going) (?:past|through)\b|\bgo (?:past|through) the\b/i.test(text)
    if (howFar || where) {
      out.push(`the prompt gives the answer away: it says how far to turn or where on the globe to stop, which the learner is to find by turning it -- ask for the goal only ("${example}")`)
    }
    // Anticlockwise is the real turn, and the card's arrow shows it; plain clockwise is not.
    const promise = /\b(?:drag|move|push|pull)\s+the\s+sun\b|\bthe sun (?:goes round|goes around|orbits)\b|\btilt|\bseasons?\b|\bsummer\b|\bwinter\b|\bmoon\b|\borbit|\bo['’]?clock\b|\bclocks?\b|\b\d{1,2}(?::\d\d)?\s*(?:am|pm|a\.m\.|p\.m\.)(?![a-z])|\btime ?zones?\b|\bshadows?\b|\bclouds?\b|\bclockwise\b|\bslider\b|\bdial\b|\bfriend\b/i.test(text.replace(/\bcounter-?clockwise\b|\banti-?clockwise\b/gi, 'anticlock'))
    if (promise) {
      out.push(`the prompt promises something the card does not show: it draws the Earth from above the North Pole, a Sun that never moves and your own sky, and the Earth turns one way only -- ask for that ("${example}")`)
    }
    if (config.task === 'predict' && /\b(?:watch|look at|see|check) (?:your |the )?sky\b|\bwatch (?:the )?sun\b|\bsee the sun\b/i.test(text)) {
      out.push(`the prompt promises a sky to watch, but on a predict card the curtains stay closed until it is marked -- say so ("${example}")`)
    }
    if (config.task === 'watch' && /\bcurtains?\b/i.test(text)) {
      out.push(`the prompt mentions curtains, but on a watch card the sky is open -- use task "predict" for closed curtains, or ask "${example}"`)
    }
    return out
  },

  initial() {
    return { turned: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const time: TimeName = isTime(config.time) ? config.time : 'sunrise'
    const target = isMoment(time) ? MOMENT_HOUR[time] : SPAN_HOUR[time]
    return { turned: wrap24(target - startOf(config)) }
  },

  View: DayNightView,

  prompt: `SCENE "day-night" -- the Earth seen from above the North Pole on a dark space panel: real continents, a Sun at the left edge with its light falling on the Earth, the half facing it lit and labelled "day", the other half shaded and labelled "night", and a white arrow round the pole showing the way the Earth spins (anticlockwise, west to east). A child, "you", stands on the Earth. Under it is "your sky": the ground with a house and a tree, "east" on the left of the horizon and "west" on the right. The learner drags the Earth round (it turns only the real way; pushed backwards it says so) or taps "1 hour" and "6 hours"; "Hours turned" counts up. The Sun never moves: as you are turned, your sky answers -- the Sun comes up in the east, climbs, goes down in the west, the sky darkens and the stars and the house's window light come out.
  For: day and night, why we have day and night, the Earth spinning on its axis once every 24 hours, the Earth's rotation, sunrise and sunset, the Sun's apparent movement across the sky (rising in the east and setting in the west), different places having day and night at different times. It answers "the Sun goes round the Earth", "the Sun goes behind the hills or clouds at night" and "the Sun rises in the west".
  task: "watch" (your sky is open, so the learner sees each moment happen) or "predict" (your curtains are closed until it is marked, so the learner decides from the globe alone; then the curtains open on the sky they made). Use watch first, then predict.
  time: what to make for you -- "sunrise", "midday", "sunset", "midnight", "day" (daytime) or "night" (night-time). Moments are marked right within an hour either side; day and night when you are clearly inside that half. For sunrise and sunset the card starts so that the first edge of the light the learner reaches is the other one.
  Not drawn: clock times, time zones, the tilt and the seasons, day length, the Moon, orbits, shadows and clouds. Do not use it for the phases of the Moon, the seasons, shadow sticks or rotating shapes.
  Before marking the card shows the goal above the picture ("Make it sunrise for you"), the turning Earth, the day and night halves, and (on watch) your sky; it never names the time you have made. Marking names the time made, why, and what it is on the far side of the Earth. The prompt must give the goal only: do NOT say how many hours or how far to turn, or where to stop (an edge, the line between day and night, into or out of the light, facing the Sun, the top or the left).
  config: { "task":"watch", "time":"sunrise" }  -- the prompt says "Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when you see the Sun rise."
       or { "task":"watch", "time":"midnight" }  -- the prompt says "Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when it is midnight for you."
       or { "task":"predict", "time":"sunset" }  -- the prompt says "Your curtains are closed, so use the globe. Drag the Earth round the way its arrow points, or tap the turn buttons, and stop when you think it is sunset for you."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when you see the Sun rise.",
    "payload": { "engine":"day-night", "config": { "task":"watch", "time":"sunrise" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:day-night", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when it is midnight for you.",
    "payload": { "engine":"day-night", "config": { "task":"watch", "time":"midnight" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:day-night", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Your curtains are closed, so use the globe. Drag the Earth round the way its arrow points, or tap the turn buttons, and stop when you think it is sunset for you.",
    "payload": { "engine":"day-night", "config": { "task":"predict", "time":"sunset" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:day-night", "why":"..." } }`,
}

registerEngine(dayNightEngine as SceneEngine<unknown, unknown>)
