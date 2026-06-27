'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Camera, CheckCircle2, ClipboardList, Eye, EyeOff, FlaskConical, Lock, Save, ShieldCheck, Target, Trash2, User } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Avatar from './studio/Avatar'
import { clearAvatar, fileToAvatarDataUrl, getAvatar, setAvatar } from '@/lib/studio/avatar'
import { getFocus, setFocus, type FocusId } from '@/lib/onboarding'

const FOCI: { id: FocusId; label: string; icon: typeof Target }[] = [
  { id: 'grades', label: 'Boost grades', icon: Target },
  { id: 'exams', label: 'National exams', icon: BookOpen },
  { id: 'explore', label: 'Explore & learn', icon: FlaskConical },
]
import { COUNTRY_LIST, COUNTRY_GROUP_LABELS, classOptionsForCountry, countrySignupHint, examPrepAvailable, type CountryCode } from '@/lib/countries'

const inputClass =
  'w-full rounded-xl border-2 border-black/[0.06] bg-white px-4 py-2.5 text-sm font-medium text-ss-ink outline-none transition-all placeholder:text-[color:var(--ss-slate)]/60 focus:border-ss-accent focus:ring-2 focus:ring-ss-accent-soft disabled:cursor-not-allowed disabled:opacity-70'

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

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [photoError, setPhotoError] = useState('')
    const [hasCustomPhoto, setHasCustomPhoto] = useState(false)
    const [focus, setFocusVal] = useState<FocusId | null>(null)

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
        setHasCustomPhoto(getAvatar(user.id) !== '/art/avatar-default.png')
        setFocusVal(getFocus(user.id))
    }, [user])

    const chooseFocus = (f: FocusId) => {
        if (!user) return
        setFocus(user.id, f)
        setFocusVal(f)
    }

    const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || !user) return
        setPhotoError('')
        if (file.size > 8 * 1024 * 1024) {
            setPhotoError('Image is too large — please pick one under 8MB.')
            return
        }
        try {
            const dataUrl = await fileToAvatarDataUrl(file)
            setAvatar(user.id, dataUrl)
            setHasCustomPhoto(true)
        } catch (error: any) {
            setPhotoError(error.message || 'Could not process that image.')
        }
    }

    const handlePhotoRemove = () => {
        if (!user) return
        clearAvatar(user.id)
        setHasCustomPhoto(false)
        setPhotoError('')
    }

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
                className="studio-card p-6 sm:p-8"
            >
                <div className="inline-flex items-center gap-2 rounded-full bg-ss-accent-soft px-3 py-1 text-xs font-black uppercase tracking-wider text-ss-ink">
                    <Camera className="w-4 h-4" />
                    Profile Photo
                </div>
                <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <Avatar userId={user?.id} name={user?.name} size={88} className="ring-4 ring-[color:var(--ss-accent)]/25" />
                    <div className="flex-1 text-center sm:text-left">
                        <h2 className="font-display text-xl font-black tracking-tight text-ss-ink">Your photo</h2>
                        <p className="mt-1 text-sm font-semibold text-ss-slate">
                            {hasCustomPhoto ? 'Upload a new image or remove it to use the default.' : 'Add a photo, or keep the friendly default.'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-95"
                            >
                                <Camera className="w-4 h-4" />
                                {hasCustomPhoto ? 'Change photo' : 'Upload photo'}
                            </button>
                            {hasCustomPhoto && (
                                <button
                                    type="button"
                                    onClick={handlePhotoRemove}
                                    className="inline-flex items-center gap-2 rounded-full bg-ss-chip px-4 py-2 text-sm font-bold text-ss-slate transition-colors hover:text-ss-ink"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </button>
                            )}
                        </div>
                        {photoError && (
                            <p className="mt-2 text-xs font-semibold text-ss-bad">{photoError}</p>
                        )}
                    </div>
                </div>
            </motion.section>

            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.04 }}
                className="studio-card p-6 sm:p-8"
            >
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-ss-accent-soft px-3 py-1 text-xs font-black uppercase tracking-wider text-ss-ink">
                            <User className="w-4 h-4" />
                            Profile Details
                        </div>
                        <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-ss-ink">Update your profile</h2>
                        <p className="mt-1 text-sm font-semibold text-ss-slate">
                            Edit your name, class, and subjects. No email required.
                        </p>
                    </div>
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-ss-accent text-white shadow-studio-tight">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                                <optgroup label={COUNTRY_GROUP_LABELS.international}>
                                    {COUNTRY_LIST.filter((c) => c.group === 'international').map((c) => (
                                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label={COUNTRY_GROUP_LABELS.africa}>
                                    {COUNTRY_LIST.filter((c) => c.group === 'africa').map((c) => (
                                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                            <p className="mt-1 text-[11px] font-semibold text-ss-slate">
                                {countrySignupHint(country)}
                            </p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
                                Student ID
                            </label>
                            <input
                                value={user?.studentId ?? ''}
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                                disabled
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
                            Subjects (comma separated)
                        </label>
                        <input
                            value={subjectsText}
                            onChange={event => setSubjectsText(event.target.value)}
                            className={inputClass}
                            placeholder="Mathematics, Physics, Chemistry"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
                            Your focus
                        </label>
                        <p className="mt-0.5 text-[11px] font-semibold text-ss-slate">Sets what your dashboard leads with.</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            {FOCI.filter(({ id }) => id !== 'exams' || examPrepAvailable(country)).map(({ id, label, icon: Icon }) => {
                                const selected = focus === id
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => chooseFocus(id)}
                                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all ${
                                            selected ? 'border-ss-accent bg-[color:var(--ss-accent)]/[0.07]' : 'border-ss-line bg-ss-panel hover:border-[color:var(--ss-accent)]/40'
                                        }`}
                                    >
                                        <Icon className={`h-5 w-5 ${selected ? 'text-ss-accent' : 'text-ss-slate'}`} strokeWidth={1.9} />
                                        <span className={`text-[12px] font-bold ${selected ? 'text-ss-ink' : 'text-ss-slate'}`}>{label}</span>
                                    </button>
                                )
                            })}
                        </div>
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
                        className="btn-primary"
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
                className="studio-card p-6 sm:p-8"
            >
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ss-warn)]/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-ss-ink">
                            <ShieldCheck className="w-4 h-4" />
                            Password
                        </div>
                        <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-ss-ink">Change your password</h2>
                        <p className="mt-1 text-sm font-semibold text-ss-slate">
                            Use your current password to set a new one.
                        </p>
                    </div>
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13202A] text-white shadow-studio-tight">
                        <Lock className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ss-slate hover:text-ss-ink"
                            >
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ss-slate hover:text-ss-ink"
                                >
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-ss-slate">
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ss-slate hover:text-ss-ink"
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
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#13202A] px-5 py-2.5 text-sm font-black text-white shadow-studio-tight transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {isSavingPassword ? 'Updating...' : 'Change password'}
                    </button>
                </form>
            </motion.section>
        </div>
    )
}
