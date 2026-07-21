import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Public_Sans } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AdminShell } from '@/components/admin/admin-shell'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

// Tipografía cívica/institucional — encaja con el carácter de academia pública.
const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans-base',
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
    <html lang="es" className={`light ${publicSans.variable}`}>
      <body className="bg-background font-sans antialiased">
        <AuthProvider>
          <TooltipProvider delay={200}>
            <AdminShell>{children}</AdminShell>
          </TooltipProvider>
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
