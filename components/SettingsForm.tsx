'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Camera, CheckCircle2, ClipboardList, Eye, EyeOff, FlaskConical, Lock, Save, ShieldCheck, Target, Trash2, User } from 'lucide-react'
import { useAuth } from './AuthProvider'
import Avatar from './studio/Avatar'
import { DEFAULT_AVATAR, fileToAvatarDataUrl, getAvatar, removeAvatar, saveAvatar } from '@/lib/studio/avatar'
import { getFocus, setFocus, type FocusId } from '@/lib/onboarding'
import { resetTour } from '@/lib/product-tour'
import { useRouter } from 'next/navigation'
import {
    readPreferences,
    writePreferences,
    applyPreferences,
    DEFAULT_PREFERENCES,
    type A11yPreferences,
} from '@/lib/a11y-preferences'

const A11Y_TOGGLES: { key: keyof A11yPreferences; label: string; hint: string }[] = [
    { key: 'largeText', label: 'Larger text', hint: 'Makes everything bigger, not just this page.' },
    { key: 'highContrast', label: 'Higher contrast', hint: 'Stronger text and borders — helps in bright sunlight.' },
    { key: 'reducedMotion', label: 'Reduce motion', hint: 'Turns off animations and sliding transitions.' },
]

const FOCI: { id: FocusId; label: string; icon: typeof Target }[] = [
  { id: 'grades', label: 'Boost grades', icon: Target },
  { id: 'exams', label: 'National exams', icon: BookOpen },
  { id: 'explore', label: 'Explore & learn', icon: FlaskConical },
]
import { COUNTRY_LIST, COUNTRY_GROUP_LABELS, classOptionsForCountry, countrySignupHint, examPrepAvailable, type CountryCode } from '@/lib/countries'
import { getUniversityCourseNames, getUniversityYearsForCourse, getUniversityYearLabel } from '@/lib/university-curriculum'

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
    const router = useRouter()

    const [name, setName] = useState('')
    const [className, setClassName] = useState('')
    const [subjectsText, setSubjectsText] = useState('')
    const [country, setCountry] = useState<CountryCode>('RW')
    const [uniCourse, setUniCourse] = useState('')
    const [uniYear, setUniYear] = useState<number>(0)
    const isUni = user?.educationLevel === 'university'
    const [profileError, setProfileError] = useState('')
    const [profileSuccess, setProfileSuccess] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [photoError, setPhotoError] = useState('')
    const [savingPhoto, setSavingPhoto] = useState(false)
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
        setUniCourse(user.universityCourse ?? '')
        setUniYear(user.universityYear ?? 0)
        setSubjectsText(Array.isArray(user.subjects) ? user.subjects.join(', ') : '')
        setHasCustomPhoto(getAvatar(user.id) !== DEFAULT_AVATAR)
        setFocusVal(getFocus(user.id))
    }, [user])

    const [a11y, setA11y] = useState<A11yPreferences>(DEFAULT_PREFERENCES)
    useEffect(() => { setA11y(readPreferences()) }, [])

    const updateA11y = (key: keyof A11yPreferences, value: boolean) => {
        const next = { ...a11y, [key]: value }
        setA11y(next)
        writePreferences(next)
        // Applied immediately: a student turning on larger text should see it
        // happen, not have to reload to find out whether it worked.
        applyPreferences(next)
    }

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
        setSavingPhoto(true)
        try {
            const dataUrl = await fileToAvatarDataUrl(file)
            // Saves to the user record, so the photo follows the account to any
            // device rather than living only in this browser.
            await saveAvatar(user.id, dataUrl)
            setHasCustomPhoto(true)
        } catch (error: any) {
            setPhotoError(error.message || 'Could not process that image.')
            setHasCustomPhoto(getAvatar(user.id) !== DEFAULT_AVATAR)
        } finally {
            setSavingPhoto(false)
        }
    }

    const handlePhotoRemove = async () => {
        if (!user) return
        setPhotoError('')
        setSavingPhoto(true)
        try {
            await removeAvatar(user.id)
            setHasCustomPhoto(false)
        } catch (error: any) {
            setPhotoError(error.message || 'Could not remove that photo.')
            setHasCustomPhoto(getAvatar(user.id) !== DEFAULT_AVATAR)
        } finally {
            setSavingPhoto(false)
        }
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

        if (isUni) {
            if (!uniCourse || !uniYear) {
                setProfileError('Course and year of study are required.')
                return
            }
        } else if (!trimmedClass) {
            setProfileError('Class or section is required.')
            return
        }

        const subjects = parseSubjects(subjectsText)

        setIsSavingProfile(true)
        try {
            if (isUni) {
                await updateProfile({ name: trimmedName, subjects, universityCourse: uniCourse, universityYear: uniYear })
            } else {
                await updateProfile({ name: trimmedName, className: trimmedClass, subjects, country })
            }
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
                                disabled={savingPhoto}
                                className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Camera className="w-4 h-4" />
                                {/* The photo now travels to the server, so the
                                    button has to admit it is doing work. */}
                                {savingPhoto ? 'Saving…' : hasCustomPhoto ? 'Change photo' : 'Upload photo'}
                            </button>
                            {hasCustomPhoto && (
                                <button
                                    type="button"
                                    onClick={handlePhotoRemove}
                                    disabled={savingPhoto}
                                    className="inline-flex items-center gap-2 rounded-full bg-ss-chip px-4 py-2 text-sm font-bold text-ss-slate transition-colors hover:text-ss-ink disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </button>
                            )}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-ss-slate">
                            Saved to your account — it follows you to any device you sign in on.
                        </p>
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
                            Your name, class and subjects. These decide what the dashboard and quiz
                            builder show you first.
                        </p>
                    </div>
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-ss-accent text-white shadow-studio-tight">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label htmlFor="set-full-name" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Full name
                            </label>
                            <input id="set-full-name"
                                value={name}
                                onChange={event => setName(event.target.value)}
                                className={inputClass}
                                placeholder="Student name"
                                required
                            />
                        </div>
                        {isUni ? (
                            <>
                                <div>
                                    <label htmlFor="set-course" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">Course</label>
                                    <select id="set-course"
                                        value={uniCourse}
                                        onChange={(event) => {
                                            const c = event.target.value
                                            setUniCourse(c)
                                            const yrs = getUniversityYearsForCourse(c)
                                            if (!yrs.includes(uniYear)) setUniYear(yrs[0] ?? 1)
                                        }}
                                        className={inputClass}
                                    >
                                        {getUniversityCourseNames().map((c) => (<option key={c} value={c}>{c}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="set-year-of-study" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">Year of study</label>
                                    <select id="set-year-of-study"
                                        value={uniYear || ''}
                                        onChange={(event) => setUniYear(Number(event.target.value))}
                                        className={inputClass}
                                    >
                                        {getUniversityYearsForCourse(uniCourse).map((y) => (
                                            <option key={y} value={y}>{getUniversityYearLabel(uniCourse, y)}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                        <>
                        <div>
                            <label htmlFor="set-country" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Country
                            </label>
                            <select id="set-country"
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
                            <p className="mt-1 text-[12px] font-semibold text-ss-slate">
                                {countrySignupHint(country)}
                            </p>
                        </div>
                        <div>
                            <label htmlFor="set-class-section" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Class / Section
                            </label>
                            {user?.role === 'student' ? (
                                <select
                                    id="set-class-section"
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
                                    id="set-class-section"
                                    value={className}
                                    onChange={event => setClassName(event.target.value)}
                                    className={inputClass}
                                    placeholder="Teacher"
                                    required
                                />
                            )}
                        </div>
                        </>
                        )}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label htmlFor="set-student-id" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Student ID
                            </label>
                            <input id="set-student-id"
                                value={user?.studentId ?? ''}
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                                disabled
                                aria-describedby="set-student-id-hint"
                            />
                            <p id="set-student-id-hint" className="mt-1 text-[12px] font-semibold text-ss-slate">
                                Your school set this. It can&apos;t be changed here.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="set-role" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Role
                            </label>
                            <input id="set-role"
                                value={user?.role ?? 'student'}
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                                disabled
                                aria-describedby="set-role-hint"
                            />
                            <p id="set-role-hint" className="mt-1 text-[12px] font-semibold text-ss-slate">
                                Set when your account was made. Ask your school to change it.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="set-subjects" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                            Your subjects
                        </label>
                        <p className="mt-0.5 text-[12px] font-semibold text-ss-slate">
                            These come up first when you build a quiz. Separate them with commas.
                        </p>
                        <input id="set-subjects"
                            value={subjectsText}
                            onChange={event => setSubjectsText(event.target.value)}
                            className={`${inputClass} mt-2`}
                            placeholder="Mathematics, Physics, Chemistry"
                        />
                    </div>

                    <div>
                        <h3 id="set-focus-label" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                            Your focus
                        </h3>
                        <p className="mt-0.5 text-[12px] font-semibold text-ss-slate">Sets what your dashboard leads with.</p>
                        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-labelledby="set-focus-label">
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

                    {/* Accessibility. The defaults were fixed to meet AA, but a
                        default can only suit most people — someone with low
                        vision may want larger text than any design ships, and a
                        device may never set the OS reduced-motion flag. */}
                    <div>
                        <h3 id="set-a11y-label" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                            Accessibility
                        </h3>
                        <p className="mt-0.5 text-[12px] font-semibold text-ss-slate">
                            Saved on this device, so you can set it differently on your phone.
                        </p>
                        <div className="mt-2 space-y-2" role="group" aria-labelledby="set-a11y-label">
                            {A11Y_TOGGLES.map(({ key, label, hint }) => {
                                const on = a11y[key]
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="switch"
                                        aria-checked={on}
                                        onClick={() => updateA11y(key, !on)}
                                        className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                                            on ? 'border-ss-accent bg-[color:var(--ss-accent)]/[0.07]' : 'border-ss-line bg-ss-panel hover:border-[color:var(--ss-accent)]/40'
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[13.5px] font-bold text-ss-ink">{label}</span>
                                            <span className="block text-[12.5px] font-medium text-ss-slate">{hint}</span>
                                        </span>
                                        <span
                                            aria-hidden
                                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-ss-accent' : 'bg-ss-chip border border-ss-line'}`}
                                        >
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Replaying the tour is separate from the signup
                        questions in lib/onboarding — a student who wants a
                        reminder of where things are should not have to redo
                        those. */}
                    <div>
                        <h3 className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                            Finding your way
                        </h3>
                        <p className="mt-0.5 text-[12px] font-semibold text-ss-slate">
                            Replays the short tour of the menu.
                        </p>
                        <button
                            type="button"
                            onClick={() => { resetTour(); router.push('/dashboard') }}
                            className="mt-2 rounded-xl border-2 border-ss-line px-4 py-2.5 text-[13px] font-bold text-ss-ink transition-colors hover:border-ss-accent hover:text-ss-accent"
                        >
                            Show me around again
                        </button>
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
                            Enter your current password, then a new one of at least 6 characters.
                        </p>
                    </div>
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13202A] text-white shadow-studio-tight">
                        <Lock className="w-6 h-6" />
                    </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="set-current-password" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                            Current password
                        </label>
                        <div className="relative">
                            <input id="set-current-password"
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={event => setCurrentPassword(event.target.value)}
                                className={`${inputClass} pr-10`}
                                placeholder="Enter current password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(value => !value)}
                                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                                aria-pressed={showCurrent}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ss-slate hover:text-ss-ink"
                            >
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label htmlFor="set-new-password" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                New password
                            </label>
                            <div className="relative">
                                <input id="set-new-password"
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={event => setNewPassword(event.target.value)}
                                    className={`${inputClass} pr-10`}
                                    placeholder="New password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(value => !value)}
                                    aria-label={showNew ? 'Hide new password' : 'Show new password'}
                                    aria-pressed={showNew}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ss-slate hover:text-ss-ink"
                                >
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="set-confirm-new-password" className="text-[12px] font-black uppercase tracking-widest text-ss-slate">
                                Confirm new password
                            </label>
                            <div className="relative">
                                <input id="set-confirm-new-password"
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={event => setConfirmPassword(event.target.value)}
                                    className={`${inputClass} pr-10`}
                                    placeholder="Confirm password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(value => !value)}
                                    aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                                    aria-pressed={showConfirm}
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
