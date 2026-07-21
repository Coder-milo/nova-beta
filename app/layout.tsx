import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AdminShell } from '@/components/admin/admin-shell'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Academia CAC · Panel administrativo',
  description:
    'Plataforma de gestión académica y administrativa de la Academia CAC: estudiantes, proyectos, documentos y hojas de vida.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1e293b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`light ${inter.variable}`}>
      <body className="bg-background font-sans antialiased">
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <AdminShell>{children}</AdminShell>
          </TooltipProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
