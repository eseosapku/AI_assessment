import { OAuth2Client } from 'google-auth-library'

export type GoogleIdentity = {
  googleId: string
  email: string
  name: string
  picture: string | null
  emailVerified: boolean
}

function googleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ''
  )
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(googleClientId())
}

/**
 * Verify a Google Identity Services ID token and extract the profile.
 * Rejects tokens without a verified email — we match accounts by email.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error('Google sign-in is not configured')
  }

  const client = new OAuth2Client(clientId)
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  })
  const payload = ticket.getPayload()
  if (!payload?.sub) {
    throw new Error('Invalid Google token')
  }

  const email = String(payload.email ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    throw new Error('Your Google account has no email we can use. Sign in with email or student ID instead.')
  }

  if (payload.email_verified === false) {
    throw new Error('Please verify your Google email, then try again.')
  }

  return {
    googleId: payload.sub,
    email,
    name: String(payload.name ?? '').trim() || email.split('@')[0] || 'Student',
    picture: payload.picture ? String(payload.picture) : null,
    emailVerified: true,
  }
}
