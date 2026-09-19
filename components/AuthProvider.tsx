'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiUrl } from '@/lib/api-url'

import type { CountryCode } from '@/lib/countries'
import type { Gender } from '@/lib/gender'
import { normalizeCountry } from '@/lib/countries'
import { resolvePostAuthPath } from '@/lib/onboarding'
import { hydrateAvatar } from '@/lib/studio/avatar'

interface User {
  id: string
  name: string
  email: string | null
  studentId: string | null
  class: string
  subjects: string[]
  role: 'student' | 'teacher'
  country: CountryCode
  educationLevel?: 'school' | 'university'
  universityCourse?: string | null
  universityYear?: number | null
  /** Server-stored profile photo. Undefined until the avatar migration runs. */
  avatarUrl?: string | null
  /** False until a first-time Google user finishes role/class. */
  profileComplete: boolean
  /** null means never asked -- what GenderPrompt reads. */
  gender?: Gender | null
}

interface AuthContextType {
  user: User | null
  login: (identifier: string, password: string) => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  signup: (name: string, email: string | null, studentId: string | null, password: string, className: string, role: 'student' | 'teacher', country?: CountryCode, extra?: SignupExtras) => Promise<void>
  completeProfile: (payload: CompleteProfilePayload) => Promise<void>
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>
  /** Answer the one-time gender question. Declining counts as answering. */
  recordGender: (gender: Gender) => Promise<void>
  logout: () => void
  isLoading: boolean
}

/** Everything sign-up sends beyond the positional arguments. */
interface SignupExtras {
  educationLevel?: 'school' | 'university'
  universityCourse?: string
  universityYear?: number
  /** Optional at sign-up; the one-time prompt asks anyone who skips it. */
  gender?: Gender | null
}

interface CompleteProfilePayload {
  name: string
  role: 'student' | 'teacher'
  country: CountryCode
  className: string
  educationLevel?: 'school' | 'university'
  universityCourse?: string
  universityYear?: number
}

interface UpdateProfilePayload {
  name?: string
  className?: string
  subjects?: string[]
  country?: CountryCode
  universityCourse?: string
  universityYear?: number
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => { },
  loginWithGoogle: async () => { },
  signup: async () => { },
  completeProfile: async () => { },
  updateProfile: async () => { },
  recordGender: async () => { },
  logout: () => { },
  isLoading: true,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      parsed.country = normalizeCountry(parsed.country)
      parsed.profileComplete = parsed.profileComplete !== false
      setUser(parsed)
      // Restoring a session on a device that has never shown this account's
      // photo: pull it down (and push a pre-server local photo up).
      void hydrateAvatar(parsed.id, parsed.avatarUrl)
    }
    setIsLoading(false)
  }, [])

  const login = async (identifier: string, password: string) => {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    })
    if (!response.ok) throw new Error('Login failed')
    const userData = await response.json()
    setUser(userData.user)
    localStorage.setItem('user', JSON.stringify(userData.user))
    void hydrateAvatar(userData.user.id, userData.user.avatarUrl)
    if (userData.user.profileComplete === false) {
      router.push('/complete-profile')
      return
    }
    const path = await resolvePostAuthPath(userData.user)
    router.push(path)
  }

  const loginWithGoogle = async (idToken: string) => {
    const response = await fetch(apiUrl('/api/auth/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body?.error || 'Google sign-in failed')
    }
    setUser(body.user)
    localStorage.setItem('user', JSON.stringify(body.user))
    void hydrateAvatar(body.user.id, body.user.avatarUrl)
    if (body.user.profileComplete === false) {
      router.push('/complete-profile')
      return
    }
    const path = await resolvePostAuthPath(body.user)
    router.push(path)
  }

  const signup = async (name: string, email: string | null, studentId: string | null, password: string, className: string, role: 'student' | 'teacher', country?: CountryCode, extra?: SignupExtras) => {

    const response = await fetch(apiUrl('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, studentId, password, className, role, country, ...extra })
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'Signup failed')
    }
    const userData = await response.json()
    setUser(userData.user)
    localStorage.setItem('user', JSON.stringify(userData.user))
    const path = await resolvePostAuthPath(userData.user)
    router.push(path)
  }

  const completeProfile = async (payload: CompleteProfilePayload) => {
    if (!user?.id) {
      throw new Error('You must be signed in to finish your profile.')
    }
    const response = await fetch(apiUrl('/api/auth/complete-profile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...payload }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to save profile')
    }
    setUser(data.user)
    localStorage.setItem('user', JSON.stringify(data.user))
    const path = await resolvePostAuthPath(data.user)
    router.push(path)
  }

  const updateProfile = async (payload: UpdateProfilePayload) => {
    if (!user?.id) {
      throw new Error('You must be logged in to update your profile.')
    }

    const response = await fetch(apiUrl('/api/auth/update-profile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...payload })
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to update profile')
    }

    if (data?.user) {
      setUser(data.user)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
  }

  const recordGender = async (gender: Gender) => {
    if (!user?.id) throw new Error('You must be logged in.')

    const response = await fetch(apiUrl('/api/auth/gender'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, gender }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || 'Could not save that')

    if (data?.user) {
      setUser(data.user)
      localStorage.setItem('user', JSON.stringify(data.user))
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, signup, completeProfile, updateProfile, recordGender, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
