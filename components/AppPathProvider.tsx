'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react'

const TESTLAB_PREFIX = '/testlab'

function normalizeMountPath(value: string) {
  if (!value) return ''
  return value === TESTLAB_PREFIX || value.startsWith(`${TESTLAB_PREFIX}/`) ? TESTLAB_PREFIX : ''
}

function detectMountPath() {
  if (typeof window === 'undefined') return ''
  return normalizeMountPath(window.location.pathname)
}

function withMountPath(path: string, mountPath: string) {
  if (!path || !path.startsWith('/')) return path
  if (!mountPath) return path
  if (path === mountPath || path.startsWith(`${mountPath}/`) || path.startsWith(`${mountPath}?`)) return path
  const [pathname, search = ''] = path.split('?')
  return `${mountPath}${pathname}${search ? `?${search}` : ''}`
}

type AppPathContextValue = {
  mountPath: string
  withMountPath: (path: string) => string
}

const AppPathContext = createContext<AppPathContextValue>({
  mountPath: '',
  withMountPath: path => path,
})

export function AppPathProvider({ mountPath, children }: { mountPath: string; children: ReactNode }) {
  const [clientMountPath, setClientMountPath] = useState(normalizeMountPath(mountPath))

  useEffect(() => {
    if (!clientMountPath) {
      setClientMountPath(detectMountPath())
    }
  }, [clientMountPath])

  const value = useMemo(() => {
    const resolvedMountPath = clientMountPath
    return {
      mountPath: resolvedMountPath,
      withMountPath: (path: string) => withMountPath(path, resolvedMountPath),
    }
  }, [clientMountPath])

  return <AppPathContext.Provider value={value}>{children}</AppPathContext.Provider>
}

export function useAppPath() {
  return useContext(AppPathContext)
}

export function AppLink({ href, children, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const { withMountPath: prefixPath } = useAppPath()
  const resolvedHref = prefixPath(href)

  return (
    <Link href={resolvedHref} {...props}>
      {children}
    </Link>
  )
}

export function useMountedPath() {
  return useAppPath().withMountPath
}

export function useAppRouter() {
  const router = useRouter()
  const { withMountPath: prefixPath } = useAppPath()

  return useMemo(() => ({
    push: (path: string, options?: Parameters<typeof router.push>[1]) => router.push(prefixPath(path), options),
    replace: (path: string, options?: Parameters<typeof router.replace>[1]) => router.replace(prefixPath(path), options),
    prefetch: (path: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(prefixPath(path), options),
    back: () => router.back(),
    forward: () => router.forward(),
    refresh: () => router.refresh(),
  }), [prefixPath, router])
}