'use client'

import { useState } from 'react'

interface ModelResult {
  id: string
  label: string
  latencyMs: number | null
  tokensPerSec: number | null
  accuracyScore: number | null
  accuracyDetails: string[]
  response: string
  error: string | null
}

const ALL_MODELS = [
  { id: 'us.google.gemma-3-4b-it', label: 'Gemma 3 27B' },
]

function badge(score: number | null) {
  if (score === null) return null
  const pct = Math.round((score / 3) * 100)
  const color =
    pct === 100 ? 'bg-green-100 text-green-800' :
    pct >= 66  ? 'bg-yellow-100 text-yellow-800' :
                 'bg-red-100 text-red-800'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{score}/3</span>
}

function latencyColor(ms: number | null) {
  if (!ms) return 'text-gray-400'
  if (ms < 1500) return 'text-green-600 font-semibold'
  if (ms < 4000) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

export default function BedrockTestPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_MODELS.map((m) => m.id)))
  const [results, setResults] = useState<ModelResult[]>([])
  const [loading, setLoading] = useState(false)
  const [region, setRegion] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleModel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function runBenchmark() {
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('/api/bedrock-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelIds: [...selected] }),
      })
      const data = await res.json()
      setResults(data.results ?? [])
      setRegion(data.region ?? '')
    } catch (err) {
      alert('Benchmark failed: ' + err)
    } finally {
      setLoading(false)
    }
  }

  const successful = results.filter((r) => !r.error)
  const failed = results.filter((r) => r.error)
  const fastest = successful.reduce<ModelResult | null>(
    (best, r) => (!best || (r.latencyMs ?? 99999) < (best.latencyMs ?? 99999) ? r : best),
    null
  )
  const mostAccurate = successful.reduce<ModelResult | null>(
    (best, r) => (!best || (r.accuracyScore ?? -1) > (best.accuracyScore ?? -1) ? r : best),
    null
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AWS Bedrock Model Benchmark</h1>
        <p className="text-sm text-gray-500 mb-6">
          Tests speed (latency) and accuracy (3-question factual test) across all selected models.
          {region && <span className="ml-2 font-medium text-indigo-600">Region: {region}</span>}
        </p>

        {/* Model selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Select models to test ({selected.size}/{ALL_MODELS.length})</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(ALL_MODELS.map((m) => m.id)))}
                className="text-xs text-indigo-600 hover:underline">All</button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ALL_MODELS.map((m) => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleModel(m.id)}
                  className="rounded text-indigo-600"
                />
                <span className="text-gray-700 truncate">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={runBenchmark}
          disabled={loading || selected.size === 0}
          className="mb-6 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Running benchmark…' : `Run Benchmark (${selected.size} models)`}
        </button>

        {loading && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-3" />
            <p>Testing all models in parallel — this may take up to 30s…</p>
          </div>
        )}

        {/* Summary cards */}
        {results.length > 0 && !loading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{successful.length}</p>
                <p className="text-xs text-gray-500 mt-1">Models OK</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{failed.length}</p>
                <p className="text-xs text-gray-500 mt-1">Errors</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{fastest?.label ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">Fastest ({fastest?.latencyMs}ms)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{mostAccurate?.label ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">Most Accurate ({mostAccurate?.accuracyScore}/3)</p>
              </div>
            </div>

            {/* Results table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Model</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Latency</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Tok/s</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Accuracy</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r) => (
                    <>
                      <tr key={r.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{r.label}</div>
                          <div className="text-xs text-gray-400 font-mono">{r.id}</div>
                        </td>
                        <td className={`px-4 py-3 text-right ${r.error ? 'text-red-400' : latencyColor(r.latencyMs)}`}>
                          {r.error ? 'Error' : r.latencyMs != null ? `${r.latencyMs}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {r.tokensPerSec != null ? `~${r.tokensPerSec}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.error ? <span className="text-xs text-red-400">—</span> : badge(r.accuracyScore)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                            className="text-xs text-indigo-500 hover:underline"
                          >
                            {expanded === r.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr key={`${r.id}-detail`} className="bg-indigo-50">
                          <td colSpan={5} className="px-4 py-3">
                            {r.error ? (
                              <p className="text-red-600 text-xs font-mono">{r.error}</p>
                            ) : (
                              <>
                                <div className="flex gap-4 text-xs mb-2">
                                  {r.accuracyDetails.map((d) => (
                                    <span key={d} className={d.startsWith('✓') ? 'text-green-700' : 'text-red-600'}>{d}</span>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-600 font-mono bg-white rounded p-2 border border-gray-200 whitespace-pre-wrap">
                                  {r.response || '(empty response)'}
                                </p>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Failed models */}
            {failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-700 text-sm mb-2">Failed Models ({failed.length})</h3>
                <div className="space-y-1">
                  {failed.map((r) => (
                    <div key={r.id} className="text-xs text-red-600">
                      <span className="font-medium">{r.label}</span>: {r.error}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-500 mt-3">
                  Common causes: model not enabled in your AWS Bedrock console, wrong region, or IAM permissions missing.
                  Enable models at <span className="font-mono">console.aws.amazon.com/bedrock</span> → Model Access.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
