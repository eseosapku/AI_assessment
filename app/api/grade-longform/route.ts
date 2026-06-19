import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { jsonrepair } from 'jsonrepair'
import { getBedrockCredentials, getBedrockRegion } from '@/lib/aws-config'

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

interface LongFormQuestion {
    type: 'longform'
    question: string
    marks: number
    marking_criteria: string[]
    model_answer?: string
    passage?: string
}

const AWS_REGION = getBedrockRegion()
const DEFAULT_GRADING_MODEL =
    process.env.AWS_GRADING_MODEL_ID ||
    process.env.AWS_BEDROCK_MODEL_ID ||
    process.env.AWS_MODEL_ID ||
    'google.gemma-3-27b-it'

const MAX_ATTEMPTS = 3
const PREFIXES = ['eu', 'us', 'ap'] as const

function stripPrefix(modelId: string): string {
    return modelId.replace(/^(us|eu|ap)\./, '')
}

function modelFamily(modelId: string): string {
    return stripPrefix(modelId)
}

function buildInvokeBody(modelId: string, prompt: string, maxTokens: number, temperature: number): string {
    const family = modelFamily(modelId)

    if (family.startsWith('amazon.nova')) {
        return JSON.stringify({
            messages: [{ role: 'user', content: [{ text: prompt }] }],
            inferenceConfig: { maxTokens, temperature },
        })
    }

    if (family.startsWith('meta.llama')) {
        return JSON.stringify({
            prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
            max_gen_len: maxTokens,
            temperature,
        })
    }

    return JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
    })
}

function extractBedrockText(modelId: string, payload: any): string {
    const family = modelFamily(modelId)

    if (family.startsWith('amazon.nova')) {
        return payload?.output?.message?.content?.[0]?.text ?? ''
    }

    if (family.startsWith('meta.llama')) {
        return payload?.generation ?? ''
    }

    const raw =
        payload?.choices?.[0]?.message?.content ??
        payload?.choices?.[0]?.text ??
        payload?.output?.message?.content?.[0]?.text ??
        payload?.output_text ??
        payload?.content?.[0]?.text ??
        payload?.outputs?.[0]?.text ??
        ''

    if (Array.isArray(raw)) {
        return raw
            .map((item: any) => (typeof item === 'string' ? item : item?.text || ''))
            .join('\n')
            .trim()
    }

    return String(raw || '').trim()
}

function parseJsonRobust(text: string): any {
    let t = (text || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

    if (!t.startsWith('{')) {
        const m = t.match(/\{[\s\S]*\}/)
        if (m) t = m[0]
    }

    try {
        return JSON.parse(t)
    } catch {
        // Continue.
    }

    try {
        return JSON.parse(jsonrepair(t))
    } catch {
        // Continue.
    }

    const repairedUnicode = t.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    return JSON.parse(jsonrepair(repairedUnicode))
}

function clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(value)))
}

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0
}

function normalizeQuote(answer: string, quote: unknown): string | null {
    if (!isNonEmptyString(quote)) return null
    const cleaned = quote.trim().replace(/\s+/g, ' ')
    if (!cleaned) return null

    const answerLower = answer.toLowerCase()
    const quoteLower = cleaned.toLowerCase()
    if (answerLower.includes(quoteLower)) return cleaned.slice(0, 180)

    return null
}

function normalizeCriteriaResults(
    criteria: string[],
    rawResults: any,
    studentAnswer: string
): CriterionResult[] {
    const rows = Array.isArray(rawResults) ? rawResults : []
    const mapped = new Map<string, any>()

    rows.forEach((r: any) => {
        const c = typeof r?.criterion === 'string' ? r.criterion.trim() : ''
        if (c) mapped.set(c, r)
    })

    return criteria.map((criterion, idx) => {
        const byName = mapped.get(criterion)
        const byIndex = rows[idx]
        const item = byName || byIndex || {}

        const met = Boolean(item?.met)
        const note = isNonEmptyString(item?.note)
            ? item.note.trim()
            : met
                ? 'Criterion satisfied based on the response.'
                : 'Criterion not satisfied based on the response.'

        return {
            criterion,
            met,
            relevant_quote: met ? normalizeQuote(studentAnswer, item?.relevant_quote) : null,
            note,
        }
    })
}

function normalizeGrade(
    q: LongFormQuestion,
    rawGrade: any,
    studentAnswer: string,
    subject: string
): LongFormGrade {
    const criteria = Array.isArray(q.marking_criteria) ? q.marking_criteria : []
    const marksTotal = Number(q.marks) || Math.max(1, criteria.length)
    const criteriaResults = normalizeCriteriaResults(criteria, rawGrade?.criteria_results, studentAnswer)
    const metCount = criteriaResults.filter((c) => c.met).length

    const proposed = Number(rawGrade?.marks_awarded)
    const marksAwarded = Number.isFinite(proposed)
        ? clampInt(proposed, 0, marksTotal)
        : clampInt(metCount, 0, marksTotal)

    const defaultFeedback = marksAwarded === marksTotal
        ? `Excellent work in ${subject}. You met all rubric points.`
        : marksAwarded > 0
            ? `Good effort in ${subject}. Review the missed criteria notes to improve your answer.`
            : `Your response in ${subject} did not meet the rubric yet. Focus on each criterion one by one.`

    return {
        marks_awarded: marksAwarded,
        marks_total: marksTotal,
        criteria_results: criteriaResults,
        general_feedback: isNonEmptyString(rawGrade?.general_feedback)
            ? rawGrade.general_feedback.trim()
            : defaultFeedback,
    }
}

function buildQuestionPrompt(
    q: LongFormQuestion,
    studentAnswer: string,
    subject: string,
    workingsProvided: boolean
): string {
    const criteria = (q.marking_criteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')
    const passageBlock = q.passage ? `\nReading passage (if provided to the student):\n"""\n${q.passage}\n"""` : ''
    const modelAnswerBlock = q.model_answer ? `\nReference model answer:\n"""\n${q.model_answer}\n"""` : ''

    return `You are an expert ${subject} teacher grading ONE long-form response against a rubric.

Question (${q.marks} marks):
${q.question}

Marking criteria (1 mark each unless stated otherwise):
${criteria}${modelAnswerBlock}${passageBlock}

Student answer:
"""
${studentAnswer}
"""

Extra context: separate workings canvas submitted = ${workingsProvided ? 'yes' : 'no'}.
If it is "yes", you may treat that as evidence the student attempted workings, but do not invent specific steps not present in text.

Strict grading guidance:
1. Grade the actual answer to each criterion, not writing style.
2. A short answer (single word/number/equation) can still fully satisfy a criterion if the criterion only requires identification/spelling/result.
3. For arithmetic questions, an equation like "4 + 2 = 6" counts as valid working.
4. For criteria requiring units, award only if units are explicitly present.
5. If a reading passage exists, copied text without original explanation should not earn analysis marks.
6. Do not punish correct concise answers when the rubric does not require explanation.
7. For comparison questions (bigger/smaller/greater/less), a correct direct choice like "18" can satisfy comparison criteria unless explanation is explicitly required.
8. For "write in words" or spelling criteria, a correctly spelled single-word answer should be accepted.

Return ONLY valid JSON with this exact shape:
{
  "marks_awarded": <integer 0-${q.marks}>,
  "criteria_results": [
    {
      "criterion": "<exact criterion text>",
      "met": <true|false>,
      "relevant_quote": "<short direct quote from student answer or null>",
      "note": "<one short sentence explaining why met or not>"
    }
  ],
  "general_feedback": "<2-3 sentence specific teacher feedback>"
}

Use exactly ${q.marking_criteria.length} criteria_results entries, in the same order as the rubric.`
}

function isModelIdError(err: any): boolean {
    const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
    return (
        text.includes('provided model identifier is invalid') ||
        text.includes('invalid model') ||
        text.includes('validationexception') ||
        text.includes('on-demand throughput')
    )
}

function buildModelCandidates(seedIds: string[]): string[] {
    const expanded: string[] = []

    const appendWithPrefixes = (id: string) => {
        const clean = (id || '').trim()
        if (!clean) return

        const bare = stripPrefix(clean)
        expanded.push(clean)
        expanded.push(bare)
        PREFIXES.forEach((p) => expanded.push(`${p}.${bare}`))
    }

    seedIds.forEach(appendWithPrefixes)

    // Extra safety set for Gemma naming variants.
    appendWithPrefixes('google.gemma-3-27b-it')
    appendWithPrefixes('google.gemma-3-27b-it-v1:0')
    appendWithPrefixes('eu.google.gemma-3-27b-it')

    return [...new Set(expanded.filter(Boolean))]
}

async function callBedrockGrade(
    client: BedrockRuntimeClient,
    prompt: string,
    modelCandidates: string[],
    preferredModelId?: string
): Promise<{ grade: any; modelId: string }> {
    const ordered = preferredModelId
        ? [preferredModelId, ...modelCandidates.filter((m) => m !== preferredModelId)]
        : modelCandidates

    let lastErr: any = null
    let onlyModelIdErrors = true

    for (const modelId of ordered) {
        try {
            const command = new InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: buildInvokeBody(modelId, prompt, 1200, 0.15),
            })

            const response = await client.send(command)
            const payload = JSON.parse(new TextDecoder().decode(response.body))
            const text = extractBedrockText(modelId, payload)
            if (!text) throw new Error(`Empty model response from ${modelId}`)

            const parsed = parseJsonRobust(text)
            return { grade: parsed?.grade ?? parsed, modelId }
        } catch (err: any) {
            lastErr = err
            if (!isModelIdError(err)) {
                onlyModelIdErrors = false
            }

            // Try next candidate on model identifier / throughput style errors.
            if (isModelIdError(err)) continue

            // If this is the sticky preferred model and it failed for other reasons,
            // allow a second chance with other models.
            if (preferredModelId && modelId === preferredModelId) continue

            throw err
        }
    }

    if (onlyModelIdErrors) {
        const e: any = new Error('No valid Bedrock model identifier found for grading in this account/region.')
        e.code = 'MODEL_ID_INVALID'
        e.attemptedModels = ordered
        throw e
    }

    throw lastErr || new Error('All grading model candidates failed.')
}

function isCopied(answer: string, passage: string | undefined): boolean {
    if (!passage || !answer) return false
    const passageWords = new Set(
        passage
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(Boolean)
    )
    const answerWords = answer
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)

    if (answerWords.length < 20) return false
    const matchCount = answerWords.filter((w) => passageWords.has(w)).length
    return matchCount / answerWords.length > 0.65
}

function ungradedFallback(q: LongFormQuestion, reason: string, feedback?: string): LongFormGrade {
    const criteria = Array.isArray(q.marking_criteria) ? q.marking_criteria : []
    const marksTotal = Number(q.marks) || Math.max(1, criteria.length)

    return {
        marks_awarded: 0,
        marks_total: marksTotal,
        criteria_results: criteria.map((criterion) => ({
            criterion,
            met: false,
            relevant_quote: null,
            note: reason,
        })),
        general_feedback: feedback || 'Automatic grading could not finalize this answer. Please retry grading.',
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { questions, answers, subject, workingsProvided, gradingModel, aiModel } = body

        if (!questions || !answers) {
            return NextResponse.json({ error: 'Questions and answers required' }, { status: 400 })
        }

        const longFormQuestions = (questions as any[])
            .map((q: any, idx: number) => ({ q: q as LongFormQuestion, idx }))
            .filter(({ q }) => q?.type === 'longform')

        if (longFormQuestions.length === 0) {
            return NextResponse.json({ grades: {} })
        }

        const grades: Record<number, LongFormGrade> = {}
        const questionsToGrade: Array<{ q: LongFormQuestion; idx: number; studentAnswer: string }> = []

        for (const { q, idx } of longFormQuestions) {
            const studentAnswer = ((answers as Record<number, string>)[idx] || '').trim()
            const criteria = Array.isArray(q.marking_criteria) ? q.marking_criteria : []
            const marksTotal = Number(q.marks) || Math.max(1, criteria.length)

            if (!studentAnswer) {
                grades[idx] = {
                    marks_awarded: 0,
                    marks_total: marksTotal,
                    criteria_results: criteria.map((criterion) => ({
                        criterion,
                        met: false,
                        relevant_quote: null,
                        note: 'No answer provided.',
                    })),
                    general_feedback: 'No answer was written for this question.',
                }
                continue
            }

            if (isCopied(studentAnswer, q.passage)) {
                grades[idx] = {
                    marks_awarded: 0,
                    marks_total: marksTotal,
                    criteria_results: criteria.map((criterion) => ({
                        criterion,
                        met: false,
                        relevant_quote: null,
                        note: 'Answer appears copied from the passage instead of using original explanation.',
                    })),
                    general_feedback: 'Your answer appears copied from the passage. Use your own words and explain your reasoning to earn marks.',
                }
                continue
            }

            questionsToGrade.push({ q, idx, studentAnswer })
        }

        if (questionsToGrade.length === 0) {
            return NextResponse.json({ grades })
        }

        const credentials = getBedrockCredentials()
        if (!credentials) {
            questionsToGrade.forEach(({ q, idx }) => {
                grades[idx] = ungradedFallback(q, 'AWS credentials are missing for automatic grading.')
            })
            return NextResponse.json({ grades })
        }

        const modelCandidates = buildModelCandidates([
            String(gradingModel || ''),
            String(aiModel || ''),
            DEFAULT_GRADING_MODEL,
        ])

        const client = new BedrockRuntimeClient({
            region: AWS_REGION,
            credentials,
        })

        let activeModelId: string | undefined
        let modelUnavailable = false

        for (const { q, idx, studentAnswer } of questionsToGrade) {
            if (modelUnavailable) {
                grades[idx] = ungradedFallback(
                    q,
                    'No valid Bedrock model identifier is configured for grading.',
                    'Automatic grading is currently unavailable because no valid Bedrock model identifier could be found. Please set AWS_GRADING_MODEL_ID to a model enabled in your Bedrock account.'
                )
                continue
            }

            const hasWorkings = Boolean((workingsProvided as Record<number, boolean> | undefined)?.[idx])
            let lastError: unknown = null

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    const prompt = buildQuestionPrompt(q, studentAnswer, subject || 'this subject', hasWorkings)
                    const result = await callBedrockGrade(client, prompt, modelCandidates, activeModelId)
                    activeModelId = result.modelId
                    grades[idx] = normalizeGrade(q, result.grade, studentAnswer, subject || 'this subject')
                    lastError = null
                    break
                } catch (err: any) {
                    lastError = err
                    if (err?.code === 'MODEL_ID_INVALID') {
                        modelUnavailable = true
                        break
                    }
                    if (attempt === MAX_ATTEMPTS) break
                }
            }

            if (lastError) {
                console.error(`Long-form grading failed for question index ${idx}:`, lastError)

                if ((lastError as any)?.code === 'MODEL_ID_INVALID') {
                    grades[idx] = ungradedFallback(
                        q,
                        'No valid Bedrock model identifier is configured for grading.',
                        'Automatic grading is currently unavailable because no valid Bedrock model identifier could be found. Please set AWS_GRADING_MODEL_ID to a model enabled in your Bedrock account.'
                    )
                } else {
                    grades[idx] = ungradedFallback(q, 'Automatic grading could not parse a valid rubric result for this answer.')
                }
            }
        }

        return NextResponse.json({ grades })
    } catch (error: any) {
        console.error('Grade longform route error:', error)
        return NextResponse.json({ error: 'Failed to grade answers' }, { status: 500 })
    }
}
