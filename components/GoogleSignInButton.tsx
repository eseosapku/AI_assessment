'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              width?: number
              logo_alignment?: 'left' | 'center'
            },
          ) => void
        }
      }
    }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(script)
  })
}

export default function GoogleSignInButton({
  onCredential,
  label = 'continue_with',
  disabled = false,
}: {
  onCredential: (idToken: string) => void
  label?: 'signin_with' | 'signup_with' | 'continue_with'
  disabled?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)
  const [unavailable, setUnavailable] = useState(false)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()

  callbackRef.current = onCredential

  useEffect(() => {
    if (!clientId || disabled) return
    let cancelled = false

    const paint = async () => {
      try {
        await loadGsiScript()
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        hostRef.current.innerHTML = ''
        const width = Math.max(280, Math.min(hostRef.current.offsetWidth || 320, 400))
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: 'outline',
          size: 'large',
          text: label,
          shape: 'rectangular',
          width,
          logo_alignment: 'left',
        })
      } catch {
        if (!cancelled) setUnavailable(true)
      }
    }

    void paint()
    return () => {
      cancelled = true
    }
  }, [clientId, disabled, label])

  if (!clientId) return null
  if (unavailable) {
    return (
      <p className="text-center text-xs text-slate-500">
        Google sign-in could not load. Use email or student ID instead.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div ref={hostRef} className="flex min-h-[40px] w-full justify-center overflow-hidden" />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>
    </div>
  )
}
