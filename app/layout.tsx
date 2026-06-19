import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Space_Grotesk } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { SubscriptionProvider } from '@/components/SubscriptionProvider'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'StudySquare — AI study & assessments | A Brain Ink product',
  description:
    'StudySquare turns your textbooks and topics into adaptive assessments, interactive study sets, and instant AI feedback for students and teachers. A Brain Ink product.',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${fraunces.variable} font-sans`}>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              {children}
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
