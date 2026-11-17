// lib/studylab/engines/immune-response/config.ts
//
// Specific antibodies, and what happens after one binds. The learner drags a Y-shaped antibody onto bacteria;
// complementary surface antigens stay bound, other shapes do not. A phagocyte then visibly engulfs each tagged
// bacterium. Marking reads only the tagged ids, never a pointer position or the animation.
//
// School-science sources: Cambridge 0610 wording and common errors (Tutopiya's Topic 10 notes); antibody Y shape,
// binding and marking for phagocytes (OpenStax Biology 2e, 42.3). The tactile fit activity follows the design idea,
// not the artwork or code, of Harris et al., Frontiers in Microbiology 13 (2022), doi:10.3389/fmicb.2022.966282.
// This deliberately models extracellular bacteria only: no viral entry, complement, antitoxins or digestion is implied.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ImmuneResponseView } from './View'

export const ANTIGENS = ['triangle', 'square', 'circle'] as const
export type Antigen = (typeof ANTIGENS)[number]
export type ImmuneTask = 'tag' | 'clear'
export type ImmuneConfig = { task: ImmuneTask; antigen: string }
export type ImmuneState = { tagged?: string[] }
export type Bacterium = { id: string; x: number; y: number; antigen: Antigen }

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')

const TASK_WORDS: Record<string, ImmuneTask> = {
  tag: 'tag', bind: 'tag', match: 'tag', 'match-antigen': 'tag', 'tag-bacterium': 'tag', 'tag-the-bacterium': 'tag',
  antibody: 'tag', antibodies: 'tag', antigen: 'tag', antigens: 'tag', specificity: 'tag', specific: 'tag',
  'antibody-antigen': 'tag', 'antigen-antibody': 'tag', 'immune-response': 'tag',
  clear: 'clear', 'clear-bacteria': 'clear', 'clear-the-bacteria': 'clear', engulf: 'clear', phagocytosis: 'clear',
  remove: 'clear', destroy: 'clear', 'tag-all': 'clear', 'bind-all': 'clear', 'clear-infection': 'clear',
}

function readAntigen(raw: unknown): string | null {
  if (raw === undefined) return 'triangle'
  if (typeof raw !== 'string') return null
  const key = keyOf(raw).replace(/-?(?:antigen|shape|shaped)$/g, '').replace(/^the-/, '')
  const alias: Record<string, Antigen> = {
    triangle: 'triangle', triangular: 'triangle', delta: 'triangle', pyramid: 'triangle',
    square: 'square', box: 'square', cubic: 'square', rectangle: 'square', rectangular: 'square',
    circle: 'circle', circular: 'circle', round: 'circle', sphere: 'circle', ball: 'circle',
  }
  return has(alias, key) ? alias[key] : key
}

/** Three large bacteria, not a cloud. The wanted shape never has a privileged position. */
export function bacteriaFor(config: ImmuneConfig): Bacterium[] {
  const wanted = hasAntigen(config.antigen) ? config.antigen : 'triangle'
  const others = ANTIGENS.filter((a) => a !== wanted)
  const order: Antigen[] = config.task === 'clear'
    ? [wanted, others[0], wanted]
    : wanted === 'triangle'
      ? ['square', 'triangle', 'circle']
      : wanted === 'square'
        ? ['triangle', 'square', 'circle']
        : ['triangle', 'circle', 'square']
  return order.map((antigen, i) => ({ id: `B${i + 1}`, x: [66, 180, 294][i], y: 65, antigen }))
}

export const hasAntigen = (value: string): value is Antigen => (ANTIGENS as readonly string[]).includes(value)
export const expectedTags = (config: ImmuneConfig) => bacteriaFor(config)
  .filter((b) => b.antigen === config.antigen)
  .filter((b) => config.task === 'clear' || b.id === 'B2')
  .map((b) => b.id)

export function taggedOf(config: ImmuneConfig, state: ImmuneState | null | undefined): string[] {
  const raw = state && Array.isArray(state.tagged) ? state.tagged : []
  const valid = bacteriaFor(config).filter((b) => raw.includes(b.id) && b.antigen === config.antigen)
  // Only a complementary shape can remain attached in this model; foreign or malformed ids count for nothing.
  return valid.filter((b) => config.task === 'clear' || expectedTags(config).includes(b.id)).map((b) => b.id)
}

export const countWord = (n: number) => ['no', 'one', 'two', 'three'][n] ?? String(n)

export function working(config: ImmuneConfig, state: ImmuneState): string {
  const n = taggedOf(config, state).length
  const noun = config.antigen === 'circle' ? 'round' : config.antigen
  return `Yes. ${n === 1 ? 'The' : `Both`} ${noun} antigen${n === 1 ? '' : 's'} fit this antibody. The tagged ${n === 1 ? 'bacterium was' : 'bacteria were'} engulfed by the phagocyte: antibodies mark pathogens; phagocytes engulf them.`
}

export function madeText(config: ImmuneConfig, state: ImmuneState): string {
  const tagged = taggedOf(config, state).length
  const wanted = expectedTags(config).length
  if (tagged === 0) return 'No bacterium has been tagged. The antibody attaches only when its binding site and the antigen have complementary shapes; a mismatch springs back.'
  const left = wanted - tagged
  return `You tagged ${countWord(tagged)} of the ${countWord(wanted)} matching bacteria. ${left === 1 ? 'One is' : `${countWord(left)} are`} still outside the phagocyte: look for the same antigen shape.`
}

// The bacteria are labelled with their antigen shapes, so naming the shape in the prompt would hand over the answer:
// the learner matches the antibody's tips instead.
function examplePrompt(config: ImmuneConfig): string {
  return config.task === 'tag'
    ? 'Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.'
    : 'Drag the Y-shaped antibody onto every bacterium whose antigen fits its tips, one at a time. Clear them with the phagocyte.'
}

export const immuneResponseEngine: SceneEngine<ImmuneConfig, ImmuneState> = {
  id: 'immune-response',
  // Distinctive school words. body-flow owns whole-body routes; enzyme-rate owns enzyme/substrate active-site fit.
  covers: ['immune', 'immunity', 'antibodies', 'antigens', 'phagocytosis', 'phagocytes', 'lymphocytes', 'pathogens'],
  phrases: [
    'immune system', 'immune response', 'white blood cells', 'defence against disease', 'defense against disease',
    'disease and immunity', 'diseases and immunity', 'antibody antigen binding', 'antigen antibody binding',
    'active immunity', 'vaccination', 'vaccines', 'antibody specificity', 'specific immune response',
  ],
  notFor: [
    'blood groups', 'blood group', 'blood transfusion', 'blood transfusions', 'transfusion', 'agglutination blood',
    'circulatory system', 'double circulation', 'blood flow', 'heart', 'body flow',
    'natural selection', 'evolution', 'resistant bacteria', 'antibiotic resistance', 'antibiotics', 'antibiotic',
    'food hygiene', 'food safety', 'food preservation', 'microbiology lab', 'microbiology laboratory', 'aseptic technique',
    'herd immunity', 'controlling the spread', 'disease transmission', 'cholera', 'passive immunity', 'breast milk',
    'autoimmune', 'allergy', 'allergies', 'blood typing', 'enzymes', 'active site',
  ],
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const first = (keys: string[]) => keys.map((k) => src[k]).find((v) => v !== undefined)
    const word = keyOf(first(nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    if (word && !has(TASK_WORDS, word)) return null
    const task = word ? TASK_WORDS[word] : first(['count', 'all']) !== undefined ? 'clear' : 'tag'
    const antigen = readAntigen(first(['antigen', 'shape', 'target', 'epitope']))
    return antigen === null || antigen === '' ? null : { task, antigen }
  },

  faults(config) {
    if (hasAntigen(config.antigen)) return []
    return [`There is no "${config.antigen}" antigen drawn here: use triangle, square or circle, e.g. { task: "${config.task}", antigen: "triangle" }.`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = examplePrompt(config)
    const out: string[] = []
    if (/\b(?:triangle|triangular|square|round|circle|circular)\b/i.test(text)) {
      out.push(`the prompt names the antigen shape: each bacterium is labelled with its shape, so the learner would only have to read; ask them to match the antibody's tips instead ("${example}")`)
    }
    if (/\b(?:left|right|middle|centre|center|first|second|third|outer|outside|end)\s+(?:bacteri|pathogen|one|two)/i.test(text)
      || /\b(?:bacteri|pathogen)\w*\s+(?:on\s+the\s+)?(?:left|right|middle|centre|center)\b/i.test(text)
      || /\bboth\s+(?:outer|end)\b/i.test(text)
      || /\b(?:first|second|third|last|1st|2nd|3rd)\s+(?:one|bacteri|pathogen)/i.test(text)
      || /\b(?:leftmost|rightmost)\b/i.test(text)) {
      out.push(`the prompt gives the answer away: it says where the complementary antigens are, which the learner finds by trying the antibody -- name the antigen shape only ("${example}")`)
    }
    if (/\bvaccin|memory cells?|antitoxins?|antibiotics?|viruses|digest|kill|lymphocytes?\s+(?:make|produce|release)|breast milk|herd immunity|graph|secondary response/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it models antibody binding, tagging and phagocyte engulfing of bacteria only, not antibody production, vaccination, digestion or memory -- ask for that ("${example}")`)
    }
    return out
  },

  initial() { return { tagged: [] } },

  check(config, state) {
    const tagged = taggedOf(config, state)
    const wanted = expectedTags(config)
    const ok = tagged.length === wanted.length && wanted.every((id) => tagged.includes(id))
    return { ok, wrongIds: ok ? [] : wanted.filter((id) => !tagged.includes(id)) }
  },

  solve(config) { return { tagged: expectedTags(config) } },

  View: ImmuneResponseView,

  prompt: `SCENE "immune-response" -- three large crafted bacteria on a quiet light panel, each carrying one gold surface antigen named in words (triangle, square or round). Below are a purple lymphocyte, a phagocyte with a lobed nucleus, and one blue Y-shaped antibody with a visible grip. The learner drags the antibody by its stem onto a bacterium. Complementary shapes visibly stay bound; a mismatch springs back. After a short hold the tagged bacterium moves into the phagocyte and appears inside a vacuole, while the phagocyte changes shape. Reduced motion shows the same attached/engulfed states without movement.
  For: antibody-antigen specificity, complementary shapes, antigens on pathogens, antibodies made by lymphocytes (the source cell is named, but production is not animated), tagging/marking bacteria, phagocytes engulfing tagged pathogens, and the distinction between lymphocytes and phagocytes. It answers "any antibody fits any pathogen", "antibodies directly kill pathogens" and "phagocytes make antibodies". It is useful as the molecular prerequisite for vaccination and active immunity, but does NOT show vaccination, memory cells, primary/secondary responses, passive immunity, antitoxins, viruses, antibiotics, herd immunity or antibody production. Use body-flow for circulation and enzyme-rate for enzyme active sites.
  tag: one bacterium among the three carries the named antigen; tag that one. clear: two bacteria carry the named antigen and the third is different; tag both, one at a time. The named target shape and "both" for clear are the goal, not a location. Never say left, right, middle, first, outer etc. Before marking the card names all visible shapes and cells and shows binding/engulfing, but does not say which antigen is complementary or whether the task is complete. Marking explains the fit and the separate roles of antibodies and phagocytes; wrong marking says how many matching bacteria remain. Prompts must give the drag gesture and must not promise digestion, killing, vaccines, memory or antibody production.
  config: { "task":"tag", "antigen":"triangle" }  -- prompt: "Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does."
       or { "task":"tag", "antigen":"square" }  -- prompt: "Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does."
       or { "task":"clear", "antigen":"circle" }  -- prompt: "Drag the Y-shaped antibody onto every bacterium whose antigen fits its tips, one at a time. Clear them with the phagocyte."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.",
    "payload": { "engine":"immune-response", "config": { "task":"tag", "antigen":"triangle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:immune-response", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.",
    "payload": { "engine":"immune-response", "config": { "task":"tag", "antigen":"square" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:immune-response", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Y-shaped antibody onto every bacterium whose antigen fits its tips, one at a time. Clear them with the phagocyte.",
    "payload": { "engine":"immune-response", "config": { "task":"clear", "antigen":"circle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:immune-response", "why":"..." } }`,
}

registerEngine(immuneResponseEngine as SceneEngine<unknown, unknown>)
