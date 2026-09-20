/**
 * Lay out a Checkpoint paper, server-side.
 *
 * The blueprint used to be built in the browser, which was fine while it only
 * needed the syllabus. It now also needs to know which foci the figure library
 * can illustrate, and that answer lives in a 13MB manifest read off disk — so
 * the whole layout moves here rather than shipping the library to the client.
 *
 * The form calls this before it shows the briefing, so the marks, the question
 * count and the written-answer count on that screen are read off the paper the
 * learner will actually sit rather than promised ahead of it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkpointSubject, type CheckpointProgramme } from '@/lib/cambridge-checkpoint'
import { buildPaper, paperBrief, paperTopics, STRAND_FOCI, type PaperMode } from '@/lib/checkpoint-paper'
import { fociWithFigures, warmCoverage } from '@/lib/checkpoint-figures'
import { buildableSubjects } from '@/lib/cambridge-checkpoint'

// Scanning a subject's foci against ten thousand figures takes seconds the
// first time. Do it on boot rather than making the first learner after a
// deploy wait for it behind a disabled button.
warmCoverage(
  (['primary', 'lower-secondary'] as const).flatMap((p) =>
    buildableSubjects(p).map((s) => s.strands.flatMap((strand) => [...(STRAND_FOCI[strand] ?? [])])),
  ),
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const programme = String(body?.programme ?? '') as CheckpointProgramme
    if (programme !== 'primary' && programme !== 'lower-secondary') {
      return NextResponse.json({ error: 'Unknown programme' }, { status: 400 })
    }

    const subject = checkpointSubject(programme, String(body?.subject ?? ''))
    if (!subject) return NextResponse.json({ error: 'Unknown subject' }, { status: 400 })

    const component = subject.components.find((c) => c.number === String(body?.component ?? ''))
    if (!component) return NextResponse.json({ error: 'Unknown component' }, { status: 400 })
    // A component that cannot be mocked must not be laid out as though it can.
    // ESL Listening needs audio; producing a silent paper for it would be a
    // worse answer than refusing.
    if (!component.mockable) {
      return NextResponse.json(
        { error: component.notMockableReason ?? 'This component cannot be practised here' },
        { status: 400 },
      )
    }

    const mode: PaperMode = body?.mode === 'practice' ? 'practice' : 'paper'
    const strand = typeof body?.strand === 'string' ? body.strand : undefined

    // Only the foci this paper could draw on, not the whole table: ranking a
    // focus means scanning ten thousand figures, and the other subject's
    // strands can never appear here.
    const reachable = (mode === 'practice' && strand ? [strand] : subject.strands)
      .flatMap((s) => [...(STRAND_FOCI[s] ?? [])])

    let covered: Set<string> | undefined
    try {
      covered = fociWithFigures(reachable)
    } catch (err) {
      // A paper without figures is still a paper. Losing the whole request
      // because the figure manifest could not be read would be the worse
      // failure, so this degrades to the syllabus-only layout.
      console.error('Checkpoint figure coverage unavailable:', err)
    }

    const paper = buildPaper(subject, component, {
      mode,
      strand,
      // A different paper each time it is asked for.
      seed: Math.floor(Math.random() * 1e9),
      covered,
    })

    return NextResponse.json({
      paper,
      // Built here rather than in the browser so the instructions the
      // generator receives and the paper the learner sees cannot drift apart.
      topics: paperTopics(paper),
      // How many of the questions are one-mark short answers. The generator
      // splits its batches on this so no request has to decide per question.
      shortCount: paper.slots.filter((s) => s.format === 'short').length,
      examPrepContext: [
        `Cambridge ${subject.name} ${subject.code}/${component.number}, sat at the end of Stage ${programme === 'primary' ? 6 : 9}. The paper is worth ${paper.totalMarks} marks.`,
        'Below is the paper plan. Write EXACTLY these questions, in this order, one per line of the plan.',
        'Write ORIGINAL questions against the published Cambridge curriculum. Never reproduce a real Checkpoint question or copy a Cambridge diagram - both are copyrighted.',
        '',
        'PAPER PLAN:',
        paperBrief(paper),
      ].join('\n'),
      // Useful to the form and honest about what it is: how much of this paper
      // the library can illustrate, not a promise that it will.
      illustrable: paper.slots.filter((s) => covered?.has(s.focus)).length,
    })
  } catch (err: any) {
    console.error('Checkpoint paper layout failed:', err)
    return NextResponse.json({ error: 'Could not lay out the paper' }, { status: 500 })
  }
}
