import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { AppPathProvider } from '@/components/AppPathProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Brain Ink | AI Assessment Platform',
  description: 'Enterprise-grade AI-powered assessment platform by Brain Ink.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1D1D1F' }
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const mountPath = requestHeaders.get('x-app-mount-path') || ''

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AppPathProvider mountPath={mountPath}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AppPathProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
