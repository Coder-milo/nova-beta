import { BriefcaseIcon as Briefcase, BuildingsIcon as Buildings, CalendarBlankIcon as CalendarBlank, ChartBarIcon as ChartBar, ChartPieIcon as ChartPie, FileTextIcon as FileText, GearIcon as Gear, GraduationCapIcon as GraduationCap, KanbanIcon as Kanban, ListChecksIcon as ListChecks, MegaphoneIcon as Megaphone, ReadCvLogoIcon as ReadCvLogo, ShieldCheckIcon as ShieldCheck, SparkleIcon as Sparkle, SquaresFourIcon as SquaresFour, TrophyIcon as Trophy, UploadSimpleIcon as UploadSimple } from '@phosphor-icons/react/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { translate, type Locale, type TranslationKey } from '@/lib/preferences'
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
  { title: 'Seguimiento', href: '/seguimiento', icon: ListChecks },
  { title: 'Colocaciones', href: '/colocaciones', icon: Trophy },
  { title: 'Empresas', href: '/empresas', icon: Buildings },
  { title: 'Importaciones', href: '/importaciones', icon: UploadSimple },
  { title: 'Documentos', href: '/documentos', icon: FileText },
  { title: 'Comunicaciones', href: '/comunicaciones', icon: Megaphone },
  { title: 'Reportes', href: '/reportes', icon: ChartBar },
  { title: 'Auditoría', href: '/auditoria', icon: ShieldCheck },
  { title: 'Power BI', href: '/power-bi', icon: ChartPie },
  { title: 'Configuración', href: '/configuracion', icon: Gear },
]

export const navItemsEstudiante: NavItem[] = [
  { title: 'Inicio', href: '/portal-estudiante', icon: SquaresFour },
  { title: 'Mi proceso', href: '/mi-proceso', icon: Sparkle },
  { title: 'Documentos', href: '/mis-documentos', icon: FileText },
  { title: 'Hoja de vida', href: '/mi-hoja-de-vida', icon: ReadCvLogo },
  { title: 'Postulaciones', href: '/mis-postulaciones', icon: Briefcase },
  { title: 'Calendario', href: '/mi-calendario', icon: CalendarBlank },
  { title: 'Configuración', href: '/configuracion-estudiante', icon: Gear },
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
  ...navItemsEstudiante.map((item) => item.href),
  '/mi-perfil',
  '/mis-actividades',
  '/mis-mensajes',
  '/mis-notificaciones',
  '/ayuda-estudiante',
  '/login',
  '/recuperar-contrasena',
])

export function estudiantePuedeVer(pathname: string): boolean {
  const normalizada =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return RUTAS_DE_ESTUDIANTE.has(normalizada)
}

const NAVIGATION_LABELS: Record<string, TranslationKey> = {
  '/': 'dashboard', '/proyectos': 'projects', '/estudiantes': 'students',
  '/hojas-de-vida': 'resumes', '/vacantes': 'jobs', '/colocaciones': 'placements',
  '/seguimiento': 'followUp',
  '/empresas': 'companies', '/importaciones': 'imports', '/documentos': 'documents',
  '/comunicaciones': 'communications', '/reportes': 'reports', '/auditoria': 'audit',
  '/configuracion': 'settings', '/portal-estudiante': 'home', '/mi-proceso': 'process',
  '/mis-actividades': 'activities', '/mis-documentos': 'documents',
  '/mi-hoja-de-vida': 'resume', '/mis-postulaciones': 'applications',
  '/mi-calendario': 'calendar', '/mis-mensajes': 'messages',
  '/mis-notificaciones': 'notifications', '/ayuda-estudiante': 'help',
  '/configuracion-estudiante': 'settings',
}

export function getNavItemsForRoles(roles?: string[], locale: Locale = 'es'): NavItem[] {
  const items = !roles || roles.length === 0
    ? navItemsAdmin
    : soloEsEstudiante(roles) ? navItemsEstudiante : navItemsAdmin
  return items.map((item) => ({
    ...item,
    title: NAVIGATION_LABELS[item.href]
      ? translate(locale, NAVIGATION_LABELS[item.href])
      : item.title,
  }))
}
