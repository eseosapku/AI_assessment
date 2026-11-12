'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Plus, RefreshCw, Users } from 'lucide-react'

type ReferralRow = {
  id: string
  code: string
  discount_percentage: number | string
  active: boolean
  expires_at: string | null
  created_at: string
  owner_name: string
  owner_email: string | null
  owner_student_id: string | null
  uses: number
  last_used_at: string | null
}

function storedUserId(): string {
  try {
    return JSON.parse(localStorage.getItem('user') ?? '{}')?.id ?? ''
  } catch {
    return ''
  }
}

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [code, setCode] = useState('')
  const [owner, setOwner] = useState('')
  const [discount, setDiscount] = useState('40')
  const [expiresAt, setExpiresAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const userId = storedUserId()
      const response = await fetch(`/api/admin/referrals?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not load referral codes.')
      setRows(body.referrals ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load referral codes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const userId = storedUserId()
      const response = await fetch(`/api/admin/referrals?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          owner_identifier: owner,
          discount_percentage: Number(discount),
          expires_at: expiresAt || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Could not create referral code.')
      setSuccess(`${body.referral.code} created successfully.`)
      setCode('')
      setOwner('')
      setExpiresAt('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create referral code.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: ReferralRow) => {
    setError('')
    const userId = storedUserId()
    const response = await fetch(`/api/admin/referrals?user_id=${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(body?.error || 'Could not update referral code.')
      return
    }
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, active: !row.active } : item))
  }

  return (
    <main className="min-h-screen bg-ss-canvas px-5 py-8 text-ss-ink sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-ss-accent">
              <ArrowLeft className="h-4 w-4" /> Platform dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Referral management</h1>
            <p className="mt-1 text-sm font-semibold text-ss-slate">Create codes, assign owners, set discounts, and track successful uses.</p>
          </div>
          <button onClick={() => void load()} className="rounded-xl border border-ss-line bg-ss-panel p-3 text-ss-slate" aria-label="Refresh referrals">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <form onSubmit={create} className="mt-7 grid gap-4 rounded-3xl border border-ss-line bg-ss-panel p-5 shadow-sm md:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-black uppercase tracking-wide text-ss-slate">
            Code
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required placeholder="ALICE40" className="mt-2 w-full rounded-xl border border-ss-line bg-white px-3 py-2.5 text-sm text-ss-ink outline-none focus:border-ss-accent" />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-ss-slate lg:col-span-2">
            Referral owner
            <input value={owner} onChange={(e) => setOwner(e.target.value)} required placeholder="Email, student ID, or user ID" className="mt-2 w-full rounded-xl border border-ss-line bg-white px-3 py-2.5 text-sm text-ss-ink outline-none focus:border-ss-accent" />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-ss-slate">
            Discount %
            <input type="number" min="1" max="99" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} required className="mt-2 w-full rounded-xl border border-ss-line bg-white px-3 py-2.5 text-sm text-ss-ink outline-none focus:border-ss-accent" />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-ss-slate md:col-span-2">
            Expires (optional)
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-2 w-full rounded-xl border border-ss-line bg-white px-3 py-2.5 text-sm text-ss-ink outline-none focus:border-ss-accent" />
          </label>
          <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-ss-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60 md:col-span-2 lg:col-span-3">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create referral code
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-[color:var(--ss-bad)]/10 px-4 py-3 text-sm font-bold text-[color:var(--ss-bad)]">{error}</p>}
        {success && <p className="mt-4 rounded-xl bg-[color:var(--ss-good)]/10 px-4 py-3 text-sm font-bold text-[color:var(--ss-good)]">{success}</p>}

        <div className="mt-7 overflow-hidden rounded-3xl border border-ss-line bg-ss-panel">
          <div className="flex items-center gap-2 border-b border-ss-line px-5 py-4">
            <Users className="h-5 w-5 text-ss-accent" />
            <h2 className="font-black">All referral codes</h2>
          </div>
          {loading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-ss-accent" /></div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm font-semibold text-ss-slate">No referral codes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-ss-chip text-xs uppercase tracking-wide text-ss-slate">
                  <tr><th className="px-5 py-3">Code</th><th>Owner</th><th>Discount</th><th>Uses</th><th>Last used</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-ss-line">
                      <td className="px-5 py-4 font-black">{row.code}</td>
                      <td><p className="font-bold">{row.owner_name}</p><p className="text-xs text-ss-slate">{row.owner_email || row.owner_student_id}</p></td>
                      <td className="font-bold">{Number(row.discount_percentage)}%</td>
                      <td><span className="font-black">{Number(row.uses)}</span></td>
                      <td className="text-ss-slate">{row.last_used_at ? new Date(row.last_used_at).toLocaleString() : 'Never'}</td>
                      <td><button onClick={() => void toggle(row)} className={`rounded-full px-3 py-1 text-xs font-black ${row.active ? 'bg-[color:var(--ss-good)]/10 text-[color:var(--ss-good)]' : 'bg-ss-chip text-ss-slate'}`}>{row.active ? 'Active' : 'Inactive'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
