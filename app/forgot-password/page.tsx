import ForgotPasswordForm from '@/components/ForgotPasswordForm'
import ThemeToggle from '@/components/ThemeToggle'

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white dark:from-apple-dark-bg dark:via-gray-900 dark:to-apple-dark-bg flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <ForgotPasswordForm />
    </main>
  )
}
