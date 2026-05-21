'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import ThemeToggle from '@/components/ThemeToggle'
import SettingsForm from '@/components/SettingsForm'
import { useAuth } from '@/components/AuthProvider'

export default function SettingsPage() {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login')
        }
    }, [isLoading, user, router])

    if (isLoading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[#f7f9ff] dark:bg-[#0A0A0B]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
            </main>
        )
    }

    if (!user) {
        return null
    }

    return (
        <main className="min-h-screen bg-[#f7f9ff] dark:bg-[#0A0A0B] relative overflow-hidden">
            <div className="absolute top-[-12%] left-[-15%] w-[32rem] h-[32rem] bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[28rem] h-[28rem] bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute inset-0 pointer-events-none opacity-60" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(59,130,246,0.08) 1px, transparent 0)',
                backgroundSize: '28px 28px',
            }} />

            <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
                <div className="flex items-start justify-between gap-4 mb-10">
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <p className="text-xs uppercase tracking-[0.25em] text-apple-dark-gray">Settings</p>
                        <h1 className="text-3xl sm:text-4xl font-semibold mt-2">Profile & security</h1>
                        <p className="text-sm text-apple-dark-gray mt-2 max-w-2xl">
                            Update your profile details and change your password. Your student ID is your primary identifier.
                        </p>
                    </motion.div>
                    <div className="mt-1">
                        <ThemeToggle />
                    </div>
                </div>

                <SettingsForm />
            </div>
        </main>
    )
}
