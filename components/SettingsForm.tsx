'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, Eye, EyeOff, Lock, Save, ShieldCheck, User } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { COUNTRY_LIST, classOptionsForCountry, type CountryCode } from '@/lib/countries'

const inputClass =
    'w-full px-4 py-2.5 rounded-xl text-sm bg-white/70 dark:bg-white/[0.06] border border-gray-200/80 dark:border-white/[0.08] focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600'

function parseSubjects(value: string): string[] {
    return value
        .split(',')
        .map(subject => subject.trim())
        .filter(Boolean)
}

export default function SettingsForm() {
    const { user, updateProfile } = useAuth()

    const [name, setName] = useState('')
    const [className, setClassName] = useState('')
    const [subjectsText, setSubjectsText] = useState('')
    const [country, setCountry] = useState<CountryCode>('RW')
    const [profileError, setProfileError] = useState('')
    const [profileSuccess, setProfileSuccess] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [isSavingPassword, setIsSavingPassword] = useState(false)

    useEffect(() => {
        if (!user) return
        setName(user.name ?? '')
        setClassName(user.class ?? '')
        setCountry((user.country as CountryCode) ?? 'RW')
        setSubjectsText(Array.isArray(user.subjects) ? user.subjects.join(', ') : '')
    }, [user])

    const handleProfileSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setProfileError('')
        setProfileSuccess('')

        const trimmedName = name.trim()
        const trimmedClass = className.trim()

        if (!trimmedName) {
            setProfileError('Name is required.')
            return
        }

        if (!trimmedClass) {
            setProfileError('Class or section is required.')
            return
        }

        const subjects = parseSubjects(subjectsText)

        setIsSavingProfile(true)
        try {
            await updateProfile({ name: trimmedName, className: trimmedClass, subjects, country })
            setProfileSuccess('Profile updated successfully.')
        } catch (error: any) {
            setProfileError(error.message || 'Failed to update profile.')
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (!currentPassword) {
            setPasswordError('Current password is required.')
            return
        }

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters.')
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.')
            return
        }

        setIsSavingPassword(true)
        try {
            await updateProfile({ currentPassword, newPassword, confirmPassword })
            setPasswordSuccess('Password updated successfully.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error: any) {
            setPasswordError(error.message || 'Failed to update password.')
        } finally {
            setIsSavingPassword(false)
        }
    }

    return (
        <div className="space-y-8">
            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="glass dark:glass-dark rounded-2xl p-6 sm:p-8"
            >
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-semibold">
                            <User className="w-4 h-4" />
                            Profile Details
                        </div>
                        <h2 className="text-xl sm:text-2xl font-semibold mt-3">Update your profile</h2>
                        <p className="text-sm text-apple-dark-gray mt-1">
                            Edit your name, class, and subjects. No email required.
                        </p>
                    </div>
                    <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-500 items-center justify-center text-white">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Full name
                            </label>
                            <input
                                value={name}
                                onChange={event => setName(event.target.value)}
                                className={inputClass}
                                placeholder="Student name"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Country
                            </label>
                            <select
                                value={country}
                                onChange={(event) => {
                                    const next = event.target.value as CountryCode
                                    setCountry(next)
                                    if (user?.role === 'student') {
                                        const opts = classOptionsForCountry(next)
                                        if (!opts.some((opt) => opt.value === className)) {
                                            setClassName(opts[0]?.value ?? '')
                                        }
                                    }
                                }}
                                className={inputClass}
                            >
                                {COUNTRY_LIST.map((c) => (
                                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-400 mt-1">
                                Rwanda users see REB + Cambridge. Nigeria users see NERDC + Cambridge and Exam Prep.
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Class / Section
                            </label>
                            {user?.role === 'student' ? (
                                <select
                                    value={className}
                                    onChange={(event) => setClassName(event.target.value)}
                                    className={inputClass}
                                    required
                                >
                                    {classOptionsForCountry(country).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={className}
                                    onChange={event => setClassName(event.target.value)}
                                    className={inputClass}
                                    placeholder="Teacher"
                                    required
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Student ID
                            </label>
                            <input
                                value={user?.studentId ?? ''}
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                                disabled
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Role
                            </label>
                            <input
                                value={user?.role ?? 'student'}
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                                disabled
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Subjects (comma separated)
                        </label>
                        <input
                            value={subjectsText}
                            onChange={event => setSubjectsText(event.target.value)}
                            className={inputClass}
                            placeholder="Mathematics, Physics, Chemistry"
                        />
                    </div>

                    {profileError && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300"
                        >
                            {profileError}
                        </motion.div>
                    )}

                    {profileSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {profileSuccess}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                        <Save className="w-4 h-4" />
                        {isSavingProfile ? 'Saving...' : 'Save changes'}
                    </button>
                </form>
            </motion.section>

            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="glass dark:glass-dark rounded-2xl p-6 sm:p-8"
            >
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4" />
                            Password
                        </div>
                        <h2 className="text-xl sm:text-2xl font-semibold mt-3">Change your password</h2>
                        <p className="text-sm text-apple-dark-gray mt-1">
                            Use your current password to set a new one.
                        </p>
                    </div>
                    <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 items-center justify-center text-white">
                        <Lock className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Current password
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={event => setCurrentPassword(event.target.value)}
                                className={`${inputClass} pr-10`}
                                placeholder="Enter current password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(value => !value)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                New password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={event => setNewPassword(event.target.value)}
                                    className={`${inputClass} pr-10`}
                                    placeholder="New password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(value => !value)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Confirm new password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={event => setConfirmPassword(event.target.value)}
                                    className={`${inputClass} pr-10`}
                                    placeholder="Confirm password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(value => !value)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {passwordError && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-300"
                        >
                            {passwordError}
                        </motion.div>
                    )}

                    {passwordSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {passwordSuccess}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isSavingPassword}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-900/20 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {isSavingPassword ? 'Updating...' : 'Change password'}
                    </button>
                </form>
            </motion.section>
        </div>
    )
}
