export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalizedPath}` : normalizedPath
}
