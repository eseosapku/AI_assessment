// lib/studylab/lessonJobs.ts

/**
 * Which model runs which part of a lesson.
 *
 * The line is whether the job needs judgement about the subject or is a bounded
 * transform. Planning and teaching are read by a student and shape what they
 * learn; writing a check and marking an answer are structured work against a
 * goal that is already decided.
 *
 * Model choice hangs off the job name rather than a route-level default, so no
 * job can silently inherit a model set during an incident — the failure three
 * call sites are still living with from 22 June, where callGemma has returned
 * Nova Lite ever since and its name says otherwise.
 */

export type LessonJob = 'plan' | 'teach_beat' | 'check' | 'grade' | 'help' | 'author' | 'judge'

/**
 * Kimi K3.1 (a global inference profile) runs every lesson job but marking.
 * The account's Claude access is refused, and in a blind test judged by Claude
 * Opus Kimi was the best model available for each of these jobs. Grading stays
 * on Nova Lite: the grade route is frozen, and the practice route shares it.
 */
const KIMI = 'global.moonshotai.kimi-k3.1'
export const JOB_MODELS: Record<LessonJob, string> = {
  plan: KIMI,
  teach_beat: KIMI,
  check: KIMI,
  grade: 'amazon.nova-lite-v1:0',
  help: KIMI,
  author: KIMI,
  judge: KIMI,
}

export type JobReasoning = 'none' | 'low' | 'medium' | 'high'

/**
 * How hard Kimi thinks per job. Thinking tokens come out of max_tokens (the
 * wrapper adds headroom), so it is off where the answer is a short, bounded
 * transform (plan, check) and low where the wording is read by a student or
 * the content is judged. 'low' is the setting that won the blind test.
 */
export const JOB_REASONING: Record<LessonJob, JobReasoning | undefined> = {
  plan: 'none',
  teach_beat: 'low',
  check: 'none',
  grade: undefined,
  help: 'low',
  author: 'low',
  judge: 'low',
}

const REASONING_ENV_KEYS: Record<LessonJob, string> = {
  plan: 'AWS_LESSON_PLAN_REASONING',
  teach_beat: 'AWS_LESSON_TEACH_REASONING',
  check: 'AWS_LESSON_CHECK_REASONING',
  grade: 'AWS_LESSON_GRADE_REASONING',
  help: 'AWS_LESSON_HELP_REASONING',
  author: 'AWS_LESSON_AUTHOR_REASONING',
  judge: 'AWS_LESSON_JUDGE_REASONING',
}

const ENV_KEYS: Record<LessonJob, string> = {
  plan: 'AWS_LESSON_PLAN_MODEL_ID',
  teach_beat: 'AWS_LESSON_TEACH_MODEL_ID',
  check: 'AWS_LESSON_CHECK_MODEL_ID',
  grade: 'AWS_LESSON_GRADE_MODEL_ID',
  help: 'AWS_LESSON_HELP_MODEL_ID',
  author: 'AWS_LESSON_AUTHOR_MODEL_ID',
  judge: 'AWS_LESSON_JUDGE_MODEL_ID',
}

/** The model a job runs on right now, honouring its own override only. */
export function modelForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env[ENV_KEYS[job]] ?? '').trim()
  const model = configured || JOB_MODELS[job]
  // Regional prefixes are stripped (the wrapper re-adds the right one);
  // `global.` is a different kind of profile and stays.
  return model.replace(/^(us|eu|ap)\./, '')
}

/** How hard a job's model thinks; undefined for models that take no setting. */
export function reasoningForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): JobReasoning | undefined {
  const configured = String(env[REASONING_ENV_KEYS[job]] ?? '').trim().toLowerCase()
  if (configured === 'none' || configured === 'low' || configured === 'medium' || configured === 'high') return configured
  return JOB_REASONING[job]
}

/**
 * Where the live jobs go when Kimi K3.1 is busy. Bedrock often is short of
 * K3.1: on 2026-11-16 it refused 5 of 30 calls, and the older Kimi K3
 * answered all 5 at once.
 *
 * Blind Opus test the same day, on the live prompts:
 * - help: Kimi K3 8/8 acceptable (7.9/10) in 4-8 s; Qwen3 Next 6/8 (4.9).
 * - plan: given room (buildInvokeBody gives K3 three times the budget), K3
 *   7.9/10 in 5-11 s, against Qwen3 Next 5/8 (4.9) with a false fact. One
 *   K3 reply in 8 did not parse, and an unparsed plan asks the learner again.
 * - teach: K3 8/8 (7.4) but 15-21 s a turn with low thinking, and 3 of 8
 *   turns past 24 s with it off; the turn has 24 s. A six-way blind test of
 *   the rest: Mistral Large 3 7/8 (5.3, no factual errors) in about 5 s, then
 *   DeepSeek 6/8 (5.1), GLM 5 and Kimi K2.5 6/8 (5.0), Qwen3 Next 5/8 (4.5).
 *   Nothing came near K3.1 (8/8, 7.8). Mistral is called in us-east-1, its
 *   only region (lib/bedrock.ts homeRegionFor).
 * - check: Qwen3 Next got 22 of 23 keys right, K3 19 of 21.
 */
const BUSY_FALLBACK: Partial<Record<LessonJob, string>> = {
  plan: 'global.moonshotai.kimi-k3',
  teach_beat: 'mistral.mistral-large-3-675b-instruct',
  check: 'qwen.qwen3-next-80b-a3b',
  help: 'global.moonshotai.kimi-k3',
}

/**
 * The model a lesson job falls back to when its own is busy: a slower or
 * weaker answer beats a dead lesson. AWS_LESSON_FALLBACK_MODEL_ID overrides
 * every job's.
 *
 * author and judge get none: authoring is never urgent, and a busy author just
 * fails the pass so the station runs live, which is better than a station
 * written or passed by a weaker model. Grade has its own path.
 */
export function fallbackForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const own = BUSY_FALLBACK[job]
  if (!own) return undefined
  const fallback = String(env.AWS_LESSON_FALLBACK_MODEL_ID ?? '').trim() || own
  return fallback === modelForJob(job, env) ? undefined : fallback
}
