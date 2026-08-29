/**
 * Iconografía: Lucide.
 *
 * Se cambió desde Phosphor porque el trazo de Lucide —2px con remates
 * redondeados y una geometría más uniforme— se lee mejor a 16px, que es el
 * tamaño real en el menú, y resulta menos severo. Lucide es ISC, sin
 * atribución, y fue el único juego de los siete evaluados que cubría los
 * dieciséis conceptos de este CRM con nombres exactos.
 *
 * La diferencia que importa al portar: **Lucide no tiene la prop `weight`**.
 * En Phosphor el ítem activo del menú se marcaba con `weight="fill"`; aquí lo
 * marcan el color y el fondo teñido, que es además lo que hace Zoho.
 */
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartColumn,
  ChartPie,
  ClipboardCheck,
  FileText,
  FileUser,
  FolderKanban,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Sparkles,
  ServerCog,
  Trophy,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { translate, type Locale, type TranslationKey } from '@/lib/preferences'
/**
 * Sección del panel lateral a la que pertenece un módulo.
 *
 * Los que no llevan grupo van sueltos arriba del todo, antes de los acordeones:
 * son las pantallas transversales —el tablero y los informes—, las que se abren
 * desde cualquier sitio y no pertenecen a un flujo concreto.
 *
 * Quince entradas en una lista plana no se leen: hay que recorrerlas una a una
 * porque nada dice dónde mirar. Repartidas en tres grupos que se pliegan, la
 * mayor parte del tiempo hay cinco o seis a la vista.
 */
export type GrupoNav = 'operacion' | 'datos' | 'sistema'

/**
 * Color del icono del módulo.
 *
 * Cada módulo con el suyo, como en Zoho. No es adorno: con la lista plegada a
 * solo iconos, el color es lo único que distingue una entrada de otra sin
 * pasar el ratón por encima, y con la lista abierta permite volver al módulo de
 * siempre sin leer los quince rótulos.
 */
export type TonoModulo =
  | 'azul' | 'verde' | 'morado' | 'naranja'
  | 'rojo' | 'cian' | 'indigo' | 'rosa' | 'ambar' | 'pizarra'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  grupo?: GrupoNav
  tono: TonoModulo
}

const ETIQUETAS_GRUPO: Record<GrupoNav, Record<Locale, string>> = {
  operacion: { es: 'Gestión', en: 'Management' },
  datos: { es: 'Documentación', en: 'Records' },
  sistema: { es: 'Sistema', en: 'System' },
}

/** Orden en que se apilan los acordeones. */
export const ORDEN_GRUPOS: GrupoNav[] = ['operacion', 'datos', 'sistema']

export function etiquetaDeGrupo(grupo: GrupoNav, locale: Locale): string {
  return ETIQUETAS_GRUPO[grupo][locale] ?? ETIQUETAS_GRUPO[grupo].es
}

export const navItemsAdmin: NavItem[] = [
  // Transversales: fuera de los acordeones, siempre a la vista.
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, tono: 'azul' },
  { title: 'Reportes', href: '/reportes', icon: ChartColumn, tono: 'morado' },
  { title: 'Power BI', href: '/power-bi', icon: ChartPie, tono: 'ambar' },
  { title: 'Auditoría', href: '/auditoria', icon: ShieldCheck, tono: 'pizarra' },

  { title: 'Estudiantes', href: '/estudiantes', icon: GraduationCap, grupo: 'operacion', tono: 'azul' },
  { title: 'Empresas', href: '/empresas', icon: Building2, grupo: 'operacion', tono: 'indigo' },
  { title: 'Vacantes', href: '/vacantes', icon: BriefcaseBusiness, grupo: 'operacion', tono: 'naranja' },
  { title: 'Colocaciones', href: '/colocaciones', icon: Trophy, grupo: 'operacion', tono: 'verde' },
  { title: 'Seguimiento', href: '/seguimiento', icon: ClipboardCheck, grupo: 'operacion', tono: 'cian' },
  { title: 'Agenda', href: '/agenda', icon: CalendarDays, grupo: 'operacion', tono: 'verde' },
  // «Postulaciones» era una entrada propia y ahora es la segunda vista de
  // Seguimiento. Eran dos ejes de lo mismo —cómo va la persona y cómo va cada
  // proceso— y en dos sitios del menú, así que quien entraba en uno no sabía
  // que existía el otro. La ruta /postulaciones sigue viva y lleva a esa vista.
  { title: 'Proyectos', href: '/proyectos', icon: FolderKanban, grupo: 'operacion', tono: 'morado' },

  { title: 'Hojas de vida', href: '/hojas-de-vida', icon: FileUser, grupo: 'datos', tono: 'morado' },
  { title: 'Documentos', href: '/documentos', icon: FileText, grupo: 'datos', tono: 'azul' },
  { title: 'Importaciones', href: '/importaciones', icon: Upload, grupo: 'datos', tono: 'cian' },
  { title: 'Comunicaciones', href: '/comunicaciones', icon: Megaphone, grupo: 'datos', tono: 'rojo' },

  { title: 'Configuración', href: '/configuracion', icon: Settings, grupo: 'sistema', tono: 'pizarra' },
]

/**
 * El portal del estudiante se queda en lista plana.
 *
 * Son siete entradas y caben todas: agruparlas obligaría a abrir un acordeón
 * para llegar a cualquier sitio, que es pagar el coste de los grupos sin
 * recibir a cambio lo que los justifica.
 */
export const navItemsEstudiante: NavItem[] = [
  { title: 'Inicio', href: '/portal-estudiante', icon: LayoutDashboard, tono: 'azul' },
  { title: 'Mi proceso', href: '/mi-proceso', icon: Sparkles, tono: 'morado' },
  { title: 'Postulaciones', href: '/mis-postulaciones', icon: BriefcaseBusiness, tono: 'naranja' },
  { title: 'Hoja de vida', href: '/mi-hoja-de-vida', icon: FileUser, tono: 'indigo' },
  { title: 'Documentos', href: '/mis-documentos', icon: FileText, tono: 'cian' },
  { title: 'Calendario', href: '/mi-calendario', icon: CalendarDays, tono: 'verde' },
  { title: 'Configuración', href: '/configuracion-estudiante', icon: Settings, tono: 'pizarra' },
]

/**
 * El menú de una empresa aliada. Tres entradas y ninguna más.
 *
 * No hay «Estudiantes» ni la habrá: una empresa no navega por personas, entra
 * por sus vacantes y ve quién se postuló a ellas. Poner aquí un buscador de
 * candidatos convertiría el portal en un directorio del censo.
 */
export const navItemsEmpresa: NavItem[] = [
  { title: 'Mis vacantes', href: '/portal/vacantes', icon: BriefcaseBusiness, tono: 'naranja' },
  { title: 'Candidatos', href: '/portal/postulantes', icon: GraduationCap, tono: 'azul' },
  { title: 'Mi cuenta', href: '/portal/cuenta', icon: Settings, tono: 'pizarra' },
]

/**
 * La consola técnica es intencionalmente pequeña: una cuenta de desarrollo no
 * administra el CRM ni navega por datos personales. Su único punto de entrada
 * muestra diagnósticos que vienen del backend.
 */
export const navItemsDesarrollador: NavItem[] = [
  { title: 'Centro de desarrollo', href: '/desarrollador', icon: ServerCog, grupo: 'sistema', tono: 'cian' },
]

/** Dónde aterriza una empresa al entrar. */
export const RUTA_INICIO_EMPRESA = '/portal/vacantes'
export const RUTA_INICIO_DESARROLLADOR = '/desarrollador'

/**
 * Las únicas rutas que una cuenta de empresa puede abrir.
 *
 * <p>Lista blanca, igual que la del estudiante y por una razón más fuerte: una
 * empresa es un tercero. El backend ya rechaza todo lo demás —`SecurityConfig`
 * corta cualquier petición de rol EMPRESA fuera de `/api/v1/portal`—, pero
 * dejarle navegar hasta una pantalla de gestión significa enseñarle una
 * pantalla rota y, sobre todo, decirle qué existe detrás.
 */
const RUTAS_DE_EMPRESA = new Set([
  ...navItemsEmpresa.map((item) => item.href),
  '/login',
  '/recuperar-contrasena',
])

export function empresaPuedeVer(pathname: string): boolean {
  const normalizada = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return RUTAS_DE_EMPRESA.has(normalizada)
}

/**
 * Un desarrollador puro no hereda permisos de coordinación ni administración.
 * Si una cuenta institucional tiene ambos roles, prevalece su menú de gestión
 * y el endpoint técnico sigue protegido por su rol específico.
 */
export function soloEsDesarrollador(roles?: string[]): boolean {
  if (!roles || roles.length === 0) return false
  const esDesarrollador = roles.includes('DESARROLLADOR') || roles.includes('ROLE_DESARROLLADOR')
  const esInstitucional = [
    'ADMIN', 'ROLE_ADMIN',
    'COORDINADOR', 'ROLE_COORDINADOR',
    'ESTUDIANTE', 'ROLE_ESTUDIANTE',
    'EMPRESA', 'ROLE_EMPRESA',
  ].some((rol) => roles.includes(rol))
  return esDesarrollador && !esInstitucional
}

const RUTAS_DE_DESARROLLADOR = new Set([
  RUTA_INICIO_DESARROLLADOR,
  '/login',
  '/recuperar-contrasena',
])

export function desarrolladorPuedeVer(pathname: string): boolean {
  const normalizada = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return RUTAS_DE_DESARROLLADOR.has(normalizada)
}

/**
 * Una cuenta del portal de empresas.
 *
 * <p>Al contrario que con el estudiante, aquí no hay convivencia posible con un
 * rol de gestión: `CuentasEmpresaService` rechaza dar el rol EMPRESA a un
 * correo que ya sea del programa. Aun así se comprueba, porque un dato mal
 * migrado no debería acabar en una cuenta que ve las dos cosas.
 */
export function soloEsEmpresa(roles?: string[]): boolean {
  if (!roles || roles.length === 0) return false
  const esEmpresa = roles.includes('EMPRESA') || roles.includes('ROLE_EMPRESA')
  const esDelPrograma =
    roles.includes('ADMIN') ||
    roles.includes('ROLE_ADMIN') ||
    roles.includes('COORDINADOR') ||
    roles.includes('ROLE_COORDINADOR') ||
    roles.includes('ESTUDIANTE') ||
    roles.includes('ROLE_ESTUDIANTE')
  return esEmpresa && !esDelPrograma
}

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
  // El orden de las ramas importa: `soloEsEmpresa` va primero porque es el
  // único rol que no pertenece a la institución, y caer por descarte en el
  // menú de administración le enseñaría los quince módulos del programa.
  const items = !roles || roles.length === 0
    ? navItemsAdmin
    : soloEsEmpresa(roles) ? navItemsEmpresa
    : soloEsDesarrollador(roles) ? navItemsDesarrollador
    : soloEsEstudiante(roles) ? navItemsEstudiante
    : navItemsAdmin
  return items.map((item) => ({
    ...item,
    title: NAVIGATION_LABELS[item.href]
      ? translate(locale, NAVIGATION_LABELS[item.href])
      : item.title,
  }))
}
