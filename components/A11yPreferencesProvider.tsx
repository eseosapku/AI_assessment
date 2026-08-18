'use client'

import { useEffect } from 'react'
import { readPreferences, applyPreferences } from '@/lib/a11y-preferences'

/**
 * Applies the student's accessibility preferences to the document root.
 *
 * Mounted at the root so the settings hold everywhere — the marketing page,
 * the quiz player, LearnSpace — rather than only inside the signed-in shell.
 * A student who needs larger text needs it on the login screen too.
 */
export default function A11yPreferencesProvider() {
  useEffect(() => {
    applyPreferences(readPreferences())

    // Keep tabs in step: changing the setting in one should not leave another
    // showing the old size.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ss-a11y-preferences') applyPreferences(readPreferences())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return null
}
