import {
  Component,
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageSpinner } from '@/components/ui/page-spinner'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ProveedorBranding } from '@/lib/branding'
import { PreferencesProvider, usePreferences } from '@/lib/preferences'
import {
  estudiantePuedeVer,
  soloEsEstudiante,
  RUTA_INICIO_ESTUDIANTE,
} from '@/lib/navigation'
import { usePathname } from '@/compat/next-navigation'

function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      const pageKey = 'nova_crm_lazy_retry'
      const lastRetry = sessionStorage.getItem(pageKey)
      if (!lastRetry || Date.now() - Number(lastRetry) > 3000) {
        sessionStorage.setItem(pageKey, String(Date.now()))
        window.location.reload()
      }
      throw error
    }
  })
}

const DashboardPage = lazyRetry(() => import('@/app/page'))
const AuditoriaPage = lazyRetry(() => import('@/app/auditoria/page'))
const ComunicacionesPage = lazyRetry(() => import('@/app/comunicaciones/page'))
const ColocacionesPage = lazyRetry(() => import('@/app/colocaciones/page'))
const ConfiguracionPage = lazyRetry(() => import('@/app/configuracion/page'))
const DocumentosPage = lazyRetry(() => import('@/app/documentos/page'))
const EmpresasPage = lazyRetry(() => import('@/app/empresas/page'))
const EstudiantesPage = lazyRetry(() => import('@/app/estudiantes/page'))
const EstudianteDetallePage = lazyRetry(() => import('@/app/estudiantes/[id]/page'))
const NuevoEstudiantePage = lazyRetry(() => import('@/app/estudiantes/nuevo/page'))
const HojasDeVidaPage = lazyRetry(() => import('@/app/hojas-de-vida/page'))
const ImportacionesPage = lazyRetry(() => import('@/app/importaciones/page'))
const LoginPage = lazyRetry(() => import('@/app/login/page'))
const PortalEstudiantePage = lazyRetry(() => import('@/app/inicio-estudiante/page'))
const PowerBiPage = lazyRetry(() => import('@/app/power-bi/page'))
const ProyectosPage = lazyRetry(() => import('@/app/proyectos/page'))
const SeguimientoPage = lazyRetry(() => import('@/app/seguimiento/page'))
const ProyectoDetallePage = lazyRetry(() => import('@/app/proyectos/[id]/page'))
const RecuperarContrasenaPage = lazyRetry(
  () => import('@/app/recuperar-contrasena/page'),
)
const ReportesPage = lazyRetry(() => import('@/app/reportes/page'))
const ReportesChatPage = lazyRetry(() => import('@/app/reportes-chat/page'))
const VacantesPage = lazyRetry(() => import('@/app/vacantes/page'))
const MiProcesoPage = lazyRetry(() => import('@/app/mi-proceso/page'))
const MisActividadesPage = lazyRetry(() => import('@/app/mis-actividades/page'))
const MisDocumentosPage = lazyRetry(() => import('@/app/mis-documentos/page'))
const MiHojaDeVidaPage = lazyRetry(() => import('@/app/mi-hoja-de-vida/page'))
const MisPostulacionesPage = lazyRetry(() => import('@/app/mis-postulaciones/page'))
const MiCalendarioPage = lazyRetry(() => import('@/app/mi-calendario/page'))
const MisMensajesPage = lazyRetry(() => import('@/app/mis-mensajes/page'))
const MisNotificacionesPage = lazyRetry(() => import('@/app/mis-notificaciones/page'))
const AyudaEstudiantePage = lazyRetry(() => import('@/app/ayuda-estudiante/page'))
const ConfiguracionEstudiantePage = lazyRetry(() => import('@/app/configuracion-estudiante/page'))

const exactRoutes: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/auditoria': AuditoriaPage,
  '/comunicaciones': ComunicacionesPage,
  '/colocaciones': ColocacionesPage,
  '/configuracion': ConfiguracionPage,
  '/documentos': DocumentosPage,
  '/empresas': EmpresasPage,
  '/estudiantes': EstudiantesPage,
  '/estudiantes/nuevo': NuevoEstudiantePage,
  '/hojas-de-vida': HojasDeVidaPage,
  '/importaciones': ImportacionesPage,
  '/login': LoginPage,
  '/portal-estudiante': PortalEstudiantePage,
  '/power-bi': PowerBiPage,
  '/proyectos': ProyectosPage,
  '/recuperar-contrasena': RecuperarContrasenaPage,
  '/reportes': ReportesPage,
  '/reportes-chat': ReportesChatPage,
  '/seguimiento': SeguimientoPage,
  '/vacantes': VacantesPage,
  // Compatibilidad para enlaces guardados: el perfil ahora vive en Configuración.
  '/mi-perfil': ConfiguracionEstudiantePage,
  '/mi-proceso': MiProcesoPage,
  '/mis-actividades': MisActividadesPage,
  '/mis-documentos': MisDocumentosPage,
  '/mi-hoja-de-vida': MiHojaDeVidaPage,
  '/mis-postulaciones': MisPostulacionesPage,
  '/mi-calendario': MiCalendarioPage,
  '/mis-mensajes': MisMensajesPage,
  '/mis-notificaciones': MisNotificacionesPage,
  '/ayuda-estudiante': AyudaEstudiantePage,
  '/configuracion-estudiante': ConfiguracionEstudiantePage,
}

function NotFoundPage() {
  const { locale } = usePreferences()
  const english = locale === 'en'
  return (
    <div className="glass-card flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">
        Error 404
      </p>
      <h2 className="text-2xl font-semibold text-foreground">
        {english ? 'This page does not exist' : 'Esta página no existe'}
      </h2>
      <a className="text-sm font-medium text-primary hover:underline" href="/">
        {english ? 'Back to the dashboard' : 'Volver al dashboard'}
      </a>
    </div>
  )
}

function resolvePage(pathname: string): ComponentType {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  const ExactPage = exactRoutes[normalized]
  if (ExactPage) {
    return ExactPage
  }

  if (/^\/estudiantes\/[^/]+$/.test(normalized)) {
    return EstudianteDetallePage
  }

  if (/^\/proyectos\/[^/]+$/.test(normalized)) {
    return ProyectoDetallePage
  }

  return NotFoundPage
}

/**
 * Un estudiante solo abre sus propias pantallas.
 *
 * Sin esto aterrizaba en `/`, que es el dashboard de administración: pedía
 * datos de todos los proyectos, el backend respondia 403 —correctamente— y la
 * pantalla se quedaba en «Cargando dashboard…» para siempre. Se corrige la URL
 * con `replaceState` en vez de navegar para no dejar la pantalla prohibida en
 * el historial, donde el boton Atras la volveria a abrir.
 */
function CurrentRoute() {
  const pathname = usePathname()
  const { user, cargando } = useAuth()
  const esEstudiante = soloEsEstudiante(user?.roles)

  useEffect(() => {
    if (
      !cargando &&
      esEstudiante &&
      !estudiantePuedeVer(pathname) &&
      typeof window !== 'undefined'
    ) {
      window.history.replaceState(null, '', RUTA_INICIO_ESTUDIANTE)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [cargando, esEstudiante, pathname])

  // Hasta que se sepa quien entro no se monta ninguna pantalla. La sesion se
  // lee en un efecto, asi que en el primer render `user` es null y
  // `soloEsEstudiante` responde false: pintar ya habria montado el dashboard
  // de administracion —con sus llamadas a datos de todos los proyectos— en la
  // pantalla de un estudiante, que es de donde salian los 403 del arranque.
  if (cargando) return <PageSpinner />

  // Mientras el efecto corrige la URL ya se pinta el portal, para que no
  // llegue a montarse el dashboard y disparar las llamadas que dan 403.
  const Page =
    esEstudiante && !estudiantePuedeVer(pathname)
      ? PortalEstudiantePage
      : resolvePage(pathname)

  return <Page />
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error al iniciar NOVA CRM', error, info)
  }

  private recuperar = () => {
    localStorage.removeItem('nova_user')
    localStorage.removeItem('nova_tema_proyecto')
    window.location.replace('/login?recovered=1')
  }

  render() {
    if (!this.state.error) return this.props.children

    // Esta pantalla envuelve al proveedor de preferencias, asi que no puede
    // usar su hook: lee directamente la clave que el proveedor guarda. Si
    // fallara la lectura, el espanol es el idioma por defecto del sistema.
    let english = false
    try { english = localStorage.getItem('nova_locale') === 'en' } catch { /* noop */ }

    return (
      <main className="flex min-h-svh items-center justify-center bg-[#050b14] p-6 text-white">
        <section className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 p-7 text-center shadow-2xl">
          <h1 className="text-xl font-semibold">{english ? 'The panel could not be loaded' : 'No se pudo cargar el panel'}</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">{english ? 'Something went wrong starting the interface. The technical detail is shown below so it can be fixed.' : 'Ocurrió un error al iniciar la interfaz. El detalle técnico aparece abajo para poder corregirlo.'}</p>
          <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-left text-xs text-red-200">
            {this.state.error.message || this.state.error.name}
          </pre>
          <button
            type="button"
            onClick={this.recuperar}
            className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {english ? 'Recover the application' : 'Recuperar aplicación'}
          </button>
        </section>
      </main>
    )
  }
}

export default function CrmApp() {
  return (
    <AppErrorBoundary>
      <PreferencesProvider>
      <AuthProvider>
        {/* Dentro de AuthProvider: la identidad se pide con la sesion ya puesta,
            porque el servidor la resuelve a partir de quien eres. */}
        <ProveedorBranding>
          <TooltipProvider delay={200}>
            <AdminShell>
              <Suspense fallback={<PageSpinner />}>
                <CurrentRoute />
              </Suspense>
            </AdminShell>
          </TooltipProvider>
        </ProveedorBranding>
      </AuthProvider>
      </PreferencesProvider>
    </AppErrorBoundary>
  )
}
