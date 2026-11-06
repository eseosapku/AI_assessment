/** Existing backend already deployed by .github/workflows/deploy-backend.yml. */
export function jobApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  // The browser stays on this site. Amplify serves /api/jobs from the same database.
  if (typeof window !== 'undefined') return normalized
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://3o9up71dt8.execute-api.eu-west-1.amazonaws.com/study-prod' : '')
  return `${base.replace(/\/$/, '')}${normalized}`
}
