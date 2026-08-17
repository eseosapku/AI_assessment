'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import LoginForm from '@/components/LoginForm'
import SignupForm from '@/components/SignupForm'
import { SquareMark } from '@/components/Brand'
import { useDialogBehavior } from '@/components/ui/Modal'

type AuthMode = 'login' | 'signup'

export default function AuthModal({
  mode,
  onClose,
  onSwitch,
}: {
  mode: AuthMode
  onClose: () => void
  onSwitch: (mode: AuthMode) => void
}) {
  // Mounted only while shown (see LandingPage), so it is open whenever it exists.
  const { ref, dialogProps } = useDialogBehavior({ open: true, onClose, labelledBy: 'auth-modal-title' })
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          ref={ref}
          {...dialogProps}
          className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-white shadow-2xl dark:border-white/10 dark:bg-[#0e1424]"
        >
          <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg,#0C2A40,#0C74B4 60%,#2ACBF2)' }}>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3">
              <SquareMark className="h-10 w-10" />
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.28em] text-[#9BE3FB]">
              {mode === 'login' ? 'Welcome back' : 'Join StudySquare'}
            </p>
            <h2 id="auth-modal-title" className="mt-1 font-display text-2xl font-black tracking-tight">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h2>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            {mode === 'login' ? (
              <LoginForm
                embedded
                onSwitchToSignup={() => onSwitch('signup')}
              />
            ) : (
              <SignupForm
                embedded
                onSwitchToLogin={() => onSwitch('login')}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
