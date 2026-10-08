'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { Globe, Play, RefreshCw, Square } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { assembleWebDoc } from '@/lib/studylab/webDoc'
import { CardFrame, CanvasContext, SafeLatex } from './canvasShared'

type Tab = 'html' | 'css' | 'js'
const TABS: { key: Tab; label: string }[] = [
  { key: 'html', label: 'HTML' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JS' },
]

// CodePen-style card: edit HTML/CSS/JS in tabs, see a combined preview.
//
// Nothing runs until the student presses Run. The preview used to render on
// mount and on every keystroke, and a sandboxed frame still runs its script on
// the page's thread in most browsers: a `while(true){}` from the tutor or a
// half-typed loop froze the tab, and being saved, froze it again on every
// reopen. HTML and CSS cannot loop, so once running they still update live;
// a JavaScript edit waits for "Run again".
export function WebSandboxNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const [html, setHtml] = useState(d.html ?? '')
  const [css, setCss] = useState(d.css ?? '')
  const [js, setJs] = useState(d.js ?? '')
  const [tab, setTab] = useState<Tab>('html')
  // The doc actually rendered; null until the student runs it.
  const [doc, setDoc] = useState<string | null>(null)
  const [jsChanged, setJsChanged] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ html, css, js })

  useEffect(
    () => () => {
      // Save the last edit rather than drop it with the timer.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        onNodeDataChange(id, { ...latest.current })
      }
      if (previewTimer.current) clearTimeout(previewTimer.current)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const run = () => {
    setJsChanged(false)
    setDoc(assembleWebDoc(html, css, js))
  }

  const onEdit = (next: { html?: string; css?: string; js?: string }) => {
    const h = next.html ?? html
    const c = next.css ?? css
    const j = next.js ?? js
    if (next.html !== undefined) setHtml(next.html)
    if (next.css !== undefined) setCss(next.css)
    if (next.js !== undefined) setJs(next.js)
    latest.current = { html: h, css: c, js: j }
    // A running preview follows HTML and CSS edits; JavaScript waits for Run.
    if (next.js !== undefined) setJsChanged(true)
    else if (doc !== null && !jsChanged) {
      if (previewTimer.current) clearTimeout(previewTimer.current)
      previewTimer.current = setTimeout(() => setDoc(assembleWebDoc(h, c, j)), 400)
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      onNodeDataChange(id, { html: h, css: c, js: j })
    }, 800)
  }

  const value = tab === 'html' ? html : tab === 'css' ? css : js
  const placeholder =
    tab === 'html' ? '<h1>Hello</h1>' : tab === 'css' ? 'h1 { color: teal }' : "document.title = 'Hi'"

  return (
    <CardFrame accent="violet">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-violet-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title || 'Web sandbox'}</h3>
        <span className="ml-auto text-[12px] uppercase tracking-wide text-ss-slate">{doc === null ? 'stopped' : 'running'}</span>
      </div>

      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`nodrag px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-violet-500 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-ss-slate hover:text-violet-500'
              }`}
            >
              {t.label}
            </button>
          ))}
          {doc === null ? (
            <button
              type="button"
              onClick={run}
              className="nodrag ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-ss-accent text-white hover:opacity-90"
            >
              <Play className="w-3.5 h-3.5" aria-hidden /> Run preview
            </button>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                onClick={run}
                aria-label={jsChanged ? 'Run again with your JavaScript changes' : 'Run again'}
                className={`nodrag inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold ${jsChanged ? 'bg-ss-accent text-white hover:opacity-90' : 'text-ss-slate hover:text-ss-accent'}`}
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden /> {jsChanged ? 'Run again' : ''}
              </button>
              <button
                type="button"
                onClick={() => setDoc(null)}
                aria-label="Stop the preview"
                className="nodrag inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-ss-slate hover:text-[color:var(--ss-bad)]"
              >
                <Square className="w-3.5 h-3.5" aria-hidden />
              </button>
            </span>
          )}
        </div>

        <textarea
          className="nodrag w-full h-28 font-mono text-[12px] leading-relaxed bg-gray-950 text-gray-100 rounded-xl p-3 resize-y outline-none focus:ring-2 focus:ring-violet-500/40"
          value={value}
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => onEdit({ [tab]: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        />

        {doc === null ? (
          <button
            type="button"
            onClick={run}
            className="nodrag w-full h-48 rounded-lg border border-dashed border-ss-line text-[13px] font-semibold text-ss-slate hover:border-ss-accent hover:text-ss-accent"
          >
            Press Run to see the page
          </button>
        ) : (
          <iframe
            title="Web preview"
            sandbox="allow-scripts"
            srcDoc={doc}
            className="nodrag w-full h-48 rounded-lg border border-ss-line bg-white"
          />
        )}

        {d.body && (
          <p className="text-[12px] text-gray-500">
            <SafeLatex>{d.body}</SafeLatex>
          </p>
        )}
      </div>
    </CardFrame>
  )
}
