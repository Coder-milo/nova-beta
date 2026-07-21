import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar sesión · Academia CAC',
  description: 'Accede al panel administrativo de la Academia CAC.',
}

// La página de login tiene su propio layout sin el shell administrativo.
// AdminShell en app/layout.tsx detecta la ruta /login y omite sidebar/header.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
