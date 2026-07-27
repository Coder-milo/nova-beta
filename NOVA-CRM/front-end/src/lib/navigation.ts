import { Briefcase, ChartBar, ChartPie, FileText, Gear, GraduationCap, Kanban, Megaphone, ReadCvLogo, ShieldCheck, Sparkle, SquaresFour, UploadSimple, UserCheck } from '@phosphor-icons/react/ssr'
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
  { title: 'Comunicaciones', href: '/comunicaciones', icon: Megaphone },
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

/**
 * Un usuario cuyo único rol es ESTUDIANTE. Se comprueba que NO tenga además
 * rol de gestión: alguien puede ser coordinador y estar matriculado a la vez, y
 * en ese caso manda el rol con más alcance.
 */
export function soloEsEstudiante(roles?: string[]): boolean {
  if (!roles || roles.length === 0) return false
  const esEstudiante = roles.includes('ESTUDIANTE') || roles.includes('ROLE_ESTUDIANTE')
  const esGestor =
    roles.includes('ADMIN') ||
    roles.includes('ROLE_ADMIN') ||
    roles.includes('COORDINADOR') ||
    roles.includes('ROLE_COORDINADOR')
  return esEstudiante && !esGestor
}

/** Dónde aterriza cada quien al entrar. */
export const RUTA_INICIO_ESTUDIANTE = '/portal-estudiante'

/**
 * Las únicas rutas que un estudiante puede abrir.
 *
 * El resto son pantallas de gestión que consultan datos de todos los proyectos.
 * El backend ya las rechaza —de ahí los 403—, pero dejarle navegar hasta ellas
 * significaba enseñarle una pantalla rota y, sobre todo, decirle qué existe
 * detrás. La regla del programa es que solo vea el suyo.
 */
const RUTAS_DE_ESTUDIANTE = new Set([
  RUTA_INICIO_ESTUDIANTE,
  '/login',
  '/recuperar-contrasena',
])

export function estudiantePuedeVer(pathname: string): boolean {
  const normalizada =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return RUTAS_DE_ESTUDIANTE.has(normalizada)
}

export function getNavItemsForRoles(roles?: string[]): NavItem[] {
  if (!roles || roles.length === 0) return navItemsAdmin
  return soloEsEstudiante(roles) ? navItemsEstudiante : navItemsAdmin
}

export const navItems: NavItem[] = navItemsAdmin
