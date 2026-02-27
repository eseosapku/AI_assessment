import SignupForm from '@/components/SignupForm'
import ThemeToggle from '@/components/ThemeToggle'

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center p-4 relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 dark:from-purple-500/10 dark:to-blue-500/10" />
      
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Signup Form */}
      <div className="relative z-10">
        <SignupForm />
      </div>
    </main>
  )
}
