import { canonicalSubject } from '@/lib/canonical-subject'

export interface SubjectImprovementRow {
  subject: string
  students: number
  firstPaper: number
  lastPaper: number
  deltaPoints: number
}

/**
 * First paper against most recent, per subject.
 *
 * Merged on the canonical subject for the same reason the performance table is:
 * one subject is stored under several textbook titles, and listing them apart
 * splits its evidence in two and halves the apparent sample behind each row.
 * Averages are re-weighted by student count, since a subject with nine students
 * should not be outvoted by one with two.
 */
export function SubjectImprovementTable({ rows }: { rows: SubjectImprovementRow[] }) {
  const byName = new Map<string, { students: number; first: number; last: number }>()
  for (const r of rows) {
    const name = canonicalSubject(r.subject)
    const acc = byName.get(name) ?? { students: 0, first: 0, last: 0 }
    acc.students += r.students
    acc.first += r.firstPaper * r.students
    acc.last += r.lastPaper * r.students
    byName.set(name, acc)
  }

  const merged = [...byName.entries()]
    .map(([subject, a]) => {
      const first = a.students > 0 ? a.first / a.students : 0
      const last = a.students > 0 ? a.last / a.students : 0
      return {
        subject,
        students: a.students,
        firstPaper: Math.round(first * 10) / 10,
        lastPaper: Math.round(last * 10) / 10,
        deltaPoints: Math.round((last - first) * 10) / 10,
      }
    })
    .sort((a, b) => b.deltaPoints - a.deltaPoints)
    .slice(0, 10)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ss-line">
            <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Subject</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Students</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">First</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Latest</th>
            <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Change</th>
          </tr>
        </thead>
        <tbody>
          {merged.map((r) => (
            <tr key={r.subject} className="border-b border-ss-line last:border-0">
              <td className="py-2.5 text-[13px] font-bold text-ss-ink">{r.subject}</td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{r.students}</td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{r.firstPaper}%</td>
              <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{r.lastPaper}%</td>
              <td className="py-2.5 text-right">
                {/* Falls shown as falls: a table that can only go up is not
                    evidence of anything. */}
                <span
                  className={`text-[13px] font-extrabold ${
                    r.deltaPoints > 0 ? 'text-ss-good' : r.deltaPoints < 0 ? 'text-ss-bad' : 'text-ss-slate'
                  }`}
                >
                  {r.deltaPoints > 0 ? '+' : ''}
                  {r.deltaPoints}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface MasteryMix {
  gap: number
  developing: number
  mastered: number
  total: number
  masteredShare: number
}

/** Where measured subtopics sit, as one bar plus the counts behind it. */
export function MasteryMixView({ m }: { m: MasteryMix }) {
  const bands = [
    { label: 'Mastered', value: m.mastered, color: 'var(--ss-good)', note: '80% and above' },
    { label: 'Developing', value: m.developing, color: 'var(--ss-warn)', note: '50 to 79%' },
    { label: 'Gap', value: m.gap, color: 'var(--ss-bad)', note: 'below 50%' },
  ]
  return (
    <div>
      <p className="text-[34px] font-extrabold leading-none tracking-tight text-ss-ink">
        {m.masteredShare}%
      </p>
      <p className="mt-1.5 text-[13px] font-semibold text-ss-slate">
        of measured subtopics are solid — {m.mastered.toLocaleString()} of {m.total.toLocaleString()}
      </p>

      <div className="mt-4 flex h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
        {bands.map((b) => (
          <div
            key={b.label}
            style={{ width: `${(b.value / Math.max(1, m.total)) * 100}%`, backgroundColor: b.color }}
          />
        ))}
      </div>

      <dl className="mt-3 grid gap-2.5">
        {bands.map((b) => (
          <div key={b.label} className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[13px] font-medium text-ss-slate">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
              {b.label} <span className="text-[12px]">({b.note})</span>
            </dt>
            <dd className="text-[14px] font-extrabold text-ss-ink">{b.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
