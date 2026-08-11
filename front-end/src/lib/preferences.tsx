'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Locale = 'es' | 'en'

const BASE_THEME_KEY = 'nova_theme'
const BASE_LOCALE_KEY = 'nova_locale'

const copy = {
  es: {
    dashboard: 'Dashboard', projects: 'Proyectos', students: 'Estudiantes',
    resumes: 'Hojas de vida', jobs: 'Vacantes', placements: 'Colocaciones',
    companies: 'Empresas', imports: 'Importaciones', documents: 'Documentos',
    followUp: 'Seguimiento',
    communications: 'Comunicaciones', reports: 'Reportes', audit: 'Auditoría',
    settings: 'Configuración', home: 'Inicio', process: 'Mi proceso',
    activities: 'Actividades', resume: 'Hoja de vida', applications: 'Postulaciones',
    calendar: 'Calendario', messages: 'Mensajes', notifications: 'Notificaciones',
    help: 'Ayuda', studentPortal: 'Portal del estudiante', adminPanel: 'Panel administrativo',
    administrator: 'Administrador', signOut: 'Cerrar sesión', openMenu: 'Abrir menú',
    generalSearch: 'Búsqueda general', search: 'Buscar', noNotifications: 'No tienes notificaciones nuevas.',
    viewAllNotifications: 'Ver todas las notificaciones', searchTitle: 'Búsqueda general',
    searchDescription: 'Encuentra estudiantes, proyectos y documentos desde un solo lugar.',
    searchPlaceholder: 'Escribe al menos 2 caracteres', searchAdminOnly: 'La búsqueda general está disponible para el equipo administrativo. En tu portal encuentras tus vacantes, documentos y seguimiento en el menú lateral.',
    searching: 'Buscando…', searchStart: 'Empieza por el nombre, correo, documento o proyecto.',
    searchEmpty: 'No encontramos resultados para “{query}”.',
    appearance: 'Apariencia', appearanceDescription: 'Esta preferencia se conserva en tu cuenta en este dispositivo.',
    interfaceAppearance: 'Apariencia visual del CRM', interfaceAppearanceDescription: 'Selecciona la modalidad de visualización de la interfaz.',
    language: 'Idioma', languageDescription: 'Elige el idioma de navegación de esta aplicación.',
    light: 'Claro', dark: 'Oscuro', system: 'Sistema', spanish: 'Español', english: 'English',
  },
  en: {
    dashboard: 'Dashboard', projects: 'Projects', students: 'Students',
    resumes: 'Resumes', jobs: 'Job openings', placements: 'Placements',
    companies: 'Companies', imports: 'Imports', documents: 'Documents',
    followUp: 'Follow-up',
    communications: 'Communications', reports: 'Reports', audit: 'Audit',
    settings: 'Settings', home: 'Home', process: 'My process',
    activities: 'Activities', resume: 'Resume', applications: 'Applications',
    calendar: 'Calendar', messages: 'Messages', notifications: 'Notifications',
    help: 'Help', studentPortal: 'Student portal', adminPanel: 'Admin panel',
    administrator: 'Administrator', signOut: 'Sign out', openMenu: 'Open menu',
    generalSearch: 'General search', search: 'Search', noNotifications: 'You have no new notifications.',
    viewAllNotifications: 'View all notifications', searchTitle: 'General search',
    searchDescription: 'Find students, projects, and documents in one place.',
    searchPlaceholder: 'Enter at least 2 characters', searchAdminOnly: 'General search is available to the administrative team. Your portal includes your openings, documents, and progress in the side menu.',
    searching: 'Searching…', searchStart: 'Start with a name, email address, document, or project.',
    searchEmpty: 'No results found for “{query}”.',
    appearance: 'Appearance', appearanceDescription: 'This preference is stored for your account on this device.',
    interfaceAppearance: 'CRM appearance', interfaceAppearanceDescription: 'Choose the interface display mode.',
    language: 'Language', languageDescription: 'Choose the navigation language for this application.',
    light: 'Light', dark: 'Dark', system: 'System', spanish: 'Español', english: 'English',
  },
} as const

export type TranslationKey = keyof typeof copy.es

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isLocale(value: string | null): value is Locale {
  return value === 'es' || value === 'en'
}

/** Obtiene la clave de preferencia aislada por correo de usuario para evitar contagiar preferencias a otros roles/cuentas */
function getPrefKey(baseKey: string): string {
  if (typeof window === 'undefined') return baseKey
  try {
    const rawUser = localStorage.getItem('nova_user')
    if (!rawUser) return baseKey
    const parsed = JSON.parse(rawUser)
    if (parsed && typeof parsed.email === 'string' && parsed.email.trim()) {
      return `${baseKey}_${parsed.email.trim().toLowerCase()}`
    }
  } catch {
    // fallback
  }
  return baseKey
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const saved = localStorage.getItem(getPrefKey(BASE_THEME_KEY))
  return isThemePreference(saved) ? saved : 'system'
}

export function getLocalePreference(): Locale {
  if (typeof window === 'undefined') return 'es'
  const saved = localStorage.getItem(getPrefKey(BASE_LOCALE_KEY))
  return isLocale(saved) ? saved : 'es'
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === 'undefined') return
  const dark = theme === 'dark' || (
    theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
  root.dataset.themePreference = theme
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function applyLocalePreference(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}

export function translate(locale: Locale, key: TranslationKey, variables?: Record<string, string>) {
  let value: string = copy[locale][key]
  for (const [name, variable] of Object.entries(variables ?? {})) {
    value = value.replace(`{${name}}`, variable)
  }
  return value
}

type PreferencesContextValue = {
  theme: ThemePreference
  locale: Locale
  setTheme: (theme: ThemePreference) => void
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, variables?: Record<string, string>) => string
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(getThemePreference)
  const [locale, setLocaleState] = useState<Locale>(getLocalePreference)

  // Re-evalúa y aplica el tema adecuado al iniciar o cuando cambia el usuario autenticado
  const reevaluarPreferencias = () => {
    const nuevoTema = getThemePreference()
    const nuevoIdioma = getLocalePreference()
    setThemeState(nuevoTema)
    setLocaleState(nuevoIdioma)
    applyThemePreference(nuevoTema)
    applyLocalePreference(nuevoIdioma)
  }

  useEffect(() => {
    applyThemePreference(theme)
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemePreference('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => {
    applyLocalePreference(locale)
  }, [locale])

  // Escuchar cambios de sesión y localStorage para actualizar el tema del usuario activo
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'nova_user' || event.key?.startsWith(BASE_THEME_KEY) || event.key?.startsWith(BASE_LOCALE_KEY)) {
        reevaluarPreferencias()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<PreferencesContextValue>(() => ({
    theme,
    locale,
    setTheme: (nextTheme) => {
      const key = getPrefKey(BASE_THEME_KEY)
      localStorage.setItem(key, nextTheme)
      applyThemePreference(nextTheme)
      setThemeState(nextTheme)
    },
    setLocale: (nextLocale) => {
      const key = getPrefKey(BASE_LOCALE_KEY)
      localStorage.setItem(key, nextLocale)
      applyLocalePreference(nextLocale)
      setLocaleState(nextLocale)
    },
    t: (key, variables) => translate(locale, key, variables),
  }), [locale, theme])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences debe usarse dentro de PreferencesProvider')
  return value
}
