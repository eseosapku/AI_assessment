'use client'

import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink } from 'lucide-react'
import { allExamPrepResources } from '@/lib/exam-prep-resources'

export default function DownloadGuidePage() {
  const waec = allExamPrepResources('waec').filter((r) => r.authority === 'WAEC')
  const jamb = allExamPrepResources('jamb').filter((r) => r.authority === 'JAMB')
  const pastWaec = allExamPrepResources('waec').filter((r) => r.type === 'past_papers')
  const pastJamb = allExamPrepResources('jamb').filter((r) => r.type === 'past_papers')

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E]">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#0C0C0E]/80 backdrop-blur border-b border-gray-200/60 dark:border-white/5">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-4">
          <Link href="/exam-prep" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-600" />
            Source download guide
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 prose prose-sm dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-lg font-bold">How it works</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Download past papers and textbooks as PDFs, drop them in the project folders, then run import scripts.
            The app extracts text and uses it to generate questions aligned with real exam content.
          </p>
          <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto">{`data/exam-sources/waec/Biology/2019-may-june.pdf
data/exam-sources/jamb/Biology/2020-utme.pdf
data/nerdc-textbooks/SS1/Biology.pdf

node scripts/import-exam-papers.js
node scripts/import-nerdc-textbooks.js`}</pre>
        </section>

        <section>
          <h2 className="text-lg font-bold">WAEC — official (free)</h2>
          <ul className="space-y-2 text-sm">
            {waec.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1">
                  {r.title} <ExternalLink className="w-3 h-3" />
                </a>
                {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            On waeconline.org.ng/e-learning: open a subject → pick year → Print to PDF → save as <code>2019-may-june.pdf</code>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">WAEC — supplementary past papers</h2>
          <ul className="space-y-2 text-sm">
            {pastWaec.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1">
                  {r.title} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">JAMB — official</h2>
          <ul className="space-y-2 text-sm">
            {jamb.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1">
                  {r.title} <ExternalLink className="w-3 h-3" />
                </a>
                {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">JAMB — past question archives</h2>
          <ul className="space-y-2 text-sm">
            {pastJamb.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1">
                  {r.title} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">NERDC textbooks</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Official pupil books require school copies or NERDC e-Curriculum subscription. Scan or save PDFs from approved
            textbooks (Lantern, UPPLC, Learn Africa, Evans, etc.) into <code>data/nerdc-textbooks/P4/</code> etc., then run{' '}
            <code>node scripts/import-nerdc-textbooks.js</code>.
          </p>
          <ul className="text-sm space-y-1">
            <li><a href="https://nerdc.org.ng/ecurriculum/CurriculumView.aspx" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">NERDC e-Curriculum browser</a></li>
            <li><a href="https://education.gov.ng/wp-content/uploads/2025/09/FG-OVERHAULS-CURRICULUM.pdf" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">FG 2025/26 curriculum PDF</a></li>
          </ul>
        </section>

        <section className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
          <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-100">Recommended starter batch</h2>
          <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
            WAEC: English, Maths, Biology, Chemistry, Physics — 2018–2020 (may-june).<br />
            JAMB: Use of English, Biology, Chemistry, Physics, Maths — 2020–2022 (utme).<br />
            NERDC: SS1 core four subjects.
          </p>
          <p className="text-xs mt-2 text-emerald-700 dark:text-emerald-300">
            When PDFs are in place, tell the agent: &quot;Run the import scripts.&quot;
          </p>
        </section>
      </main>
    </div>
  )
}
