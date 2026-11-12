'use client'

import { useEffect, useState } from 'react'
import { Gift, Loader2, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

type ReferralCode = {
  id: string
  code: string
  discount_percentage: number | string
  active: boolean
  effective_active: boolean
  expires_at: string | null
  uses: number
}

type ReferralEvent = { code: string; redeemed_at: string }

export default function ReferralsPage() {
  const { user, isLoading } = useAuth()
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [events, setEvents] = useState<ReferralEvent[]>([])
  const [totalUses, setTotalUses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!user?.id) {
      setLoading(false)
      setError('Sign in to view your referrals.')
      return
    }
    ;(async () => {
      try {
        const response = await fetch(`/api/referrals/mine?user_id=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load your referrals.')
        setCodes(body.codes ?? [])
        setEvents(body.events ?? [])
        setTotalUses(Number(body.summary?.totalUses) || 0)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load your referrals.')
      } finally {
        setLoading(false)
      }
    })()
  }, [isLoading, user?.id])

  if (loading || isLoading) {
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-ss-accent" /></div>
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="rounded-3xl bg-gradient-to-br from-[#0C2A40] via-[#0C74B4] to-[#2ACBF2] p-7 text-white sm:p-9">
        <div className="flex items-center gap-3"><Gift className="h-7 w-7" /><p className="text-sm font-black uppercase tracking-widest text-white/75">Your referrals</p></div>
        <h1 className="mt-4 text-3xl font-black">Share your code. Track the results.</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-white/80">You can see successful referral numbers and times, but never another user&apos;s identity or payment details.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <div className="rounded-2xl bg-white/15 px-5 py-4"><p className="text-3xl font-black">{totalUses}</p><p className="text-xs font-bold uppercase tracking-wide text-white/70">Successful referrals</p></div>
          <div className="rounded-2xl bg-white/15 px-5 py-4"><p className="text-3xl font-black">{codes.filter((code) => code.effective_active).length}</p><p className="text-xs font-bold uppercase tracking-wide text-white/70">Active codes</p></div>
        </div>
      </div>

      {error && <p className="mt-5 rounded-2xl bg-[color:var(--ss-bad)]/10 p-4 text-sm font-bold text-[color:var(--ss-bad)]">{error}</p>}

      <section className="mt-7 grid gap-4 md:grid-cols-2">
        {codes.length === 0 ? (
          <div className="rounded-3xl border border-ss-line bg-ss-panel p-8 md:col-span-2">
            <ShieldCheck className="h-8 w-8 text-ss-accent" />
            <h2 className="mt-3 text-xl font-black text-ss-ink">No referral code assigned yet</h2>
            <p className="mt-1 text-sm font-semibold text-ss-slate">An administrator can create a code and assign it to your email, student ID, or account ID.</p>
          </div>
        ) : codes.map((code) => (
          <article key={code.id} className="rounded-3xl border border-ss-line bg-ss-panel p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-ss-slate">Referral code</p><h2 className="mt-1 text-2xl font-black tracking-wide text-ss-ink">{code.code}</h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${code.effective_active ? 'bg-[color:var(--ss-good)]/10 text-[color:var(--ss-good)]' : 'bg-ss-chip text-ss-slate'}`}>{code.effective_active ? 'Active' : code.active ? 'Expired' : 'Inactive'}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-ss-chip p-4"><p className="text-2xl font-black text-ss-ink">{Number(code.discount_percentage)}%</p><p className="text-xs font-bold text-ss-slate">Customer discount</p></div>
              <div className="rounded-2xl bg-ss-chip p-4"><p className="text-2xl font-black text-ss-ink">{Number(code.uses)}</p><p className="text-xs font-bold text-ss-slate">Successful uses</p></div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-7 overflow-hidden rounded-3xl border border-ss-line bg-ss-panel">
        <div className="flex items-center gap-2 border-b border-ss-line px-6 py-4"><Users className="h-5 w-5 text-ss-accent" /><h2 className="font-black text-ss-ink">Anonymous referral activity</h2></div>
        {events.length === 0 ? <p className="p-7 text-sm font-semibold text-ss-slate">No successful referral payments yet.</p> : (
          <ul className="divide-y divide-ss-line">
            {events.map((event, index) => (
              <li key={`${event.code}-${event.redeemed_at}-${index}`} className="flex items-center justify-between gap-4 px-6 py-4">
                <div><p className="font-black text-ss-ink">Referral #{events.length - index}</p><p className="text-xs font-semibold text-ss-slate">Code {event.code}</p></div>
                <time className="text-sm font-semibold text-ss-slate">{new Date(event.redeemed_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
