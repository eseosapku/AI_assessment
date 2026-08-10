'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiUrl } from '@/lib/api-url'

import type { CountryCode } from '@/lib/countries'
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
}

interface AuthContextType {
  user: User | null
  login: (identifier: string, password: string) => Promise<void>
  signup: (name: string, email: string | null, studentId: string | null, password: string, className: string, role: 'student' | 'teacher', country?: CountryCode, extra?: UniversitySignup) => Promise<void>
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>
  logout: () => void
  isLoading: boolean
}

interface UniversitySignup {
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
  signup: async () => { },
  updateProfile: async () => { },
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
    const path = await resolvePostAuthPath(userData.user)
    router.push(path)
  }

  const signup = async (name: string, email: string | null, studentId: string | null, password: string, className: string, role: 'student' | 'teacher', country?: CountryCode, extra?: UniversitySignup) => {

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

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    router.push('/')
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
