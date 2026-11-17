import { LatexText as L } from '@/lib/latex-text'
import { scenarioBlocks } from '@/lib/scenario-format'

/** A question's shared setup: its paragraphs, and any results table drawn as a table. */
export default function ScenarioText({ text }: { text: unknown }) {
  return (
    <div className="space-y-3">
      {scenarioBlocks(text).map((block, i) => {
        if (block.kind === 'text') {
          return <p key={i} className="whitespace-pre-line"><L>{block.text}</L></p>
        }
        const [header, ...body] = block.rows
        const width = Math.max(...block.rows.map((row) => row.length))
        const pad = (row: string[]) => [...row, ...Array(width - row.length).fill('')]
        return (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  {pad(header).map((cell, c) => (
                    <th key={c} className="border border-ss-line bg-ss-chip px-3 py-2 text-left font-semibold">
                      <L>{cell}</L>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, r) => (
                  <tr key={r}>
                    {pad(row).map((cell, c) => (
                      <td key={c} className="border border-ss-line px-3 py-2"><L>{cell}</L></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
