import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FastTrack Builds - Dashboard',
  description: 'Turnkey website generation platform for home service businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  )
}
