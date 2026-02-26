import { Suspense } from 'react'
import ResetPasswordForm from '@/components/ResetPasswordForm'
import ThemeToggle from '@/components/ThemeToggle'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white dark:from-apple-dark-bg dark:via-gray-900 dark:to-apple-dark-bg flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-apple-blue"></div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
