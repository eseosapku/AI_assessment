import LoginForm from '@/components/LoginForm'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-[#0A0A0B] flex items-center justify-center p-5 relative overflow-hidden">
      {/* Subtle background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/8 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/8 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <LoginForm />
      </div>
    </main>
  )
}
