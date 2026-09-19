'use client'

/**
 * The one-time gender question, for people who signed up before the field
 * existed.
 *
 * Mounted in the studio layout so it reaches teachers and students alike — the
 * boards schools report to count staff too, and a question only students see
 * is one the teacher side can never answer.
 *
 * ## Why it asks rather than lets you escape
 *
 * There is no dismiss. There is **"Prefer not to say"**, which is a real
 * answer, stored like any other, and after which nobody is ever asked again.
 * That pairing is deliberate: a prompt you can only duck reappears every
 * session, which nags hardest at the people least willing to answer. One
 * click — including one click to decline — and it is gone for good.
 *
 * It waits for anyone still finishing sign-up, so it never stacks on top of
 * the /complete-profile redirect.
 */
import { useState } from 'react'
import { Users, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { GENDER_OPTIONS, needsGenderPrompt, type Gender } from '@/lib/gender'

export default function GenderPrompt() {
  const { user, isLoading, recordGender } = useAuth()
  const [saving, setSaving] = useState<Gender | null>(null)
  const [error, setError] = useState('')

  // Not while loading, not for a signed-out visitor, and not on top of the
  // profile-completion redirect.
  if (isLoading || !user || user.profileComplete === false) return null
  if (!needsGenderPrompt(user)) return null

  const choose = async (gender: Gender) => {
    setError('')
    setSaving(gender)
    try {
      await recordGender(gender)
    } catch (e: any) {
      setError(e?.message || 'Could not save that. Try again.')
      setSaving(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gender-prompt-title"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-ss-line bg-ss-panel p-6 shadow-xl dark:border-white/10">
        <span
          className="mb-4 grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--ss-accent) 12%, transparent)' }}
        >
          <Users className="h-5 w-5" style={{ color: 'var(--ss-accent)' }} />
        </span>

        <h2 id="gender-prompt-title" className="text-[19px] font-extrabold text-ss-ink dark:text-white">
          One quick question
        </h2>
        <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-ss-slate">
          Schools report on how many girls and boys they reach, and we can only answer that if we know.
          We ask once — whatever you pick, we won&apos;t ask again.
        </p>

        <div className="mt-5 grid gap-2">
          {GENDER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={saving !== null}
              onClick={() => choose(o.value)}
              className="flex items-center justify-between rounded-xl border border-ss-line px-4 py-3 text-left text-[14px] font-bold text-ss-ink transition hover:border-ss-accent disabled:opacity-60 dark:border-white/10 dark:text-white"
            >
              {o.label}
              {saving === o.value && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          ))}
        </div>

        {/* Token, not a literal red: the palette retune has to reach this too. */}
        {error && (
          <p className="mt-3 text-[13px] font-semibold" style={{ color: 'var(--ss-bad)' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
