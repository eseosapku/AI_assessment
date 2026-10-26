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

export type LessonJob = 'plan' | 'teach_beat' | 'check' | 'grade' | 'help'

/**
 * Claude for the lesson itself (the redesign's model table): Sonnet drafts the
 * plan -- one or two short calls that shape everything after -- and Haiku runs
 * the live turns, the checks (whose keys must be right) and help. Grading stays
 * on Nova Lite: the grade route is frozen, and the practice route shares it.
 */
export const JOB_MODELS: Record<LessonJob, string> = {
  plan: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  teach_beat: 'anthropic.claude-haiku-4-5-20251001-v1:0',
  check: 'anthropic.claude-haiku-4-5-20251001-v1:0',
  grade: 'amazon.nova-lite-v1:0',
  help: 'anthropic.claude-haiku-4-5-20251001-v1:0',
}

const ENV_KEYS: Record<LessonJob, string> = {
  plan: 'AWS_LESSON_PLAN_MODEL_ID',
  teach_beat: 'AWS_LESSON_TEACH_MODEL_ID',
  check: 'AWS_LESSON_CHECK_MODEL_ID',
  grade: 'AWS_LESSON_GRADE_MODEL_ID',
  help: 'AWS_LESSON_HELP_MODEL_ID',
}

/** The model a job runs on right now, honouring its own override only. */
export function modelForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env[ENV_KEYS[job]] ?? '').trim()
  const model = configured || JOB_MODELS[job]
  return model.replace(/^(us|eu|ap)\./, '')
}

/**
 * The model a lesson job falls back to when its own is busy: Sonnet for the
 * Haiku jobs. Dearer, and used only for the call Haiku could not take. The
 * plan is Sonnet already, and marking has its own path.
 */
export function fallbackForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (job === 'plan' || job === 'grade') return undefined
  const fallback = modelForJob('plan', env)
  return fallback === modelForJob(job, env) ? undefined : fallback
}
