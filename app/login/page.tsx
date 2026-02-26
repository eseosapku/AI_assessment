import LoginForm from '@/components/LoginForm'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-apple-gray dark:bg-apple-black flex items-center justify-center p-4 relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-apple-blue/5 to-purple-500/5 dark:from-apple-blue/10 dark:to-purple-500/10" />
      
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Login Form */}
      <div className="relative z-10">
        <LoginForm />
      </div>
    </main>
  )
}
