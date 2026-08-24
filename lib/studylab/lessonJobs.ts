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

export type LessonJob = 'plan' | 'teach_beat' | 'check' | 'grade'

export const JOB_MODELS: Record<LessonJob, string> = {
  plan: 'google.gemma-3-27b-it',
  teach_beat: 'google.gemma-3-27b-it',
  check: 'amazon.nova-lite-v1:0',
  grade: 'amazon.nova-lite-v1:0',
}

const ENV_KEYS: Record<LessonJob, string> = {
  plan: 'AWS_LESSON_PLAN_MODEL_ID',
  teach_beat: 'AWS_LESSON_TEACH_MODEL_ID',
  check: 'AWS_LESSON_CHECK_MODEL_ID',
  grade: 'AWS_LESSON_GRADE_MODEL_ID',
}

/** The model a job runs on right now, honouring its own override only. */
export function modelForJob(job: LessonJob, env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env[ENV_KEYS[job]] ?? '').trim()
  const model = configured || JOB_MODELS[job]
  return model.replace(/^(us|eu|ap)\./, '')
}
