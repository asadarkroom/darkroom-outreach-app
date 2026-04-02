import type { Metadata } from 'next'
import './globals.css'
import NextAuthSessionProvider from '@/components/providers/SessionProvider'

export const metadata: Metadata = {
  title: 'Darkroom Outreach',
  description: 'AI-powered email outreach sequencing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="bg-gray-950 text-white min-h-full antialiased font-sans">
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  )
}
