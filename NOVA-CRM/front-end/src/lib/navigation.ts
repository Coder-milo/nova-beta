import { Briefcase, ChartBar, ChartPie, FileText, Gear, GraduationCap, Kanban, ReadCvLogo, ShieldCheck, Sparkle, SquaresFour, UploadSimple, UserCheck } from '@phosphor-icons/react/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
export type NavItem = {
  title: string
  href: string
  icon: PhosphorIcon
}

export const navItemsAdmin: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: SquaresFour },
  { title: 'Proyectos', href: '/proyectos', icon: Kanban },
  { title: 'Estudiantes', href: '/estudiantes', icon: GraduationCap },
  { title: 'Hojas de vida', href: '/hojas-de-vida', icon: ReadCvLogo },
  { title: 'Vacantes', href: '/vacantes', icon: Briefcase },
  { title: 'Importaciones', href: '/importaciones', icon: UploadSimple },
  { title: 'Documentos', href: '/documentos', icon: FileText },
  { title: 'Reportes', href: '/reportes', icon: ChartBar },
  { title: 'Auditoría', href: '/auditoria', icon: ShieldCheck },
  { title: 'Power BI', href: '/power-bi', icon: ChartPie },
  { title: 'Configuración', href: '/configuracion', icon: Gear },
]

export const navItemsEstudiante: NavItem[] = [
  { title: 'Inicio Estudiante', href: '/portal-estudiante', icon: Sparkle },
  { title: 'Mis Vacantes Matcheadas', href: '/portal-estudiante?tab=vacantes', icon: Briefcase },
  { title: 'Mi Perfil & Hoja de Vida', href: '/portal-estudiante?tab=perfil', icon: FileText },
  { title: 'Mis Postulaciones', href: '/portal-estudiante?tab=postulaciones', icon: UserCheck },
]

export function getNavItemsForRoles(roles?: string[]): NavItem[] {
  if (!roles || roles.length === 0) return navItemsAdmin
  const esEstudiante = roles.includes('ESTUDIANTE') || roles.includes('ROLE_ESTUDIANTE')
  const esAdminOManager = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN') || roles.includes('COORDINADOR') || roles.includes('ROLE_COORDINADOR')

  if (esEstudiante && !esAdminOManager) {
    return navItemsEstudiante
  }
  return navItemsAdmin
}

export const navItems: NavItem[] = navItemsAdmin
