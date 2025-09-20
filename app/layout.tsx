import type { Metadata } from 'next'
import './globals.css'
import ToasterClient from '@/components/toaster-client'

export const metadata: Metadata = {
  title: 'Claude Code Web Interface',
  description: 'Web interface for interacting with Claude Code',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <ToasterClient />
      </body>
    </html>
  )
}
