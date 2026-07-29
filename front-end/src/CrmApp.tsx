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
import { PreferencesProvider } from '@/lib/preferences'
import {
  estudiantePuedeVer,
  soloEsEstudiante,
  RUTA_INICIO_ESTUDIANTE,
} from '@/lib/navigation'
import { usePathname } from '@/compat/next-navigation'

const DashboardPage = lazy(() => import('@/app/page'))
const AuditoriaPage = lazy(() => import('@/app/auditoria/page'))
const ComunicacionesPage = lazy(() => import('@/app/comunicaciones/page'))
const ColocacionesPage = lazy(() => import('@/app/colocaciones/page'))
const ConfiguracionPage = lazy(() => import('@/app/configuracion/page'))
const DocumentosPage = lazy(() => import('@/app/documentos/page'))
const EmpresasPage = lazy(() => import('@/app/empresas/page'))
const EstudiantesPage = lazy(() => import('@/app/estudiantes/page'))
const EstudianteDetallePage = lazy(() => import('@/app/estudiantes/[id]/page'))
const NuevoEstudiantePage = lazy(() => import('@/app/estudiantes/nuevo/page'))
const HojasDeVidaPage = lazy(() => import('@/app/hojas-de-vida/page'))
const ImportacionesPage = lazy(() => import('@/app/importaciones/page'))
const LoginPage = lazy(() => import('@/app/login/page'))
const PortalEstudiantePage = lazy(() => import('@/app/inicio-estudiante/page'))
const PowerBiPage = lazy(() => import('@/app/power-bi/page'))
const ProyectosPage = lazy(() => import('@/app/proyectos/page'))
const ProyectoDetallePage = lazy(() => import('@/app/proyectos/[id]/page'))
const RecuperarContrasenaPage = lazy(
  () => import('@/app/recuperar-contrasena/page'),
)
const ReportesPage = lazy(() => import('@/app/reportes/page'))
const VacantesPage = lazy(() => import('@/app/vacantes/page'))
const MiProcesoPage = lazy(() => import('@/app/mi-proceso/page'))
const MisActividadesPage = lazy(() => import('@/app/mis-actividades/page'))
const MisDocumentosPage = lazy(() => import('@/app/mis-documentos/page'))
const MiHojaDeVidaPage = lazy(() => import('@/app/mi-hoja-de-vida/page'))
const MisPostulacionesPage = lazy(() => import('@/app/mis-postulaciones/page'))
const MiCalendarioPage = lazy(() => import('@/app/mi-calendario/page'))
const MisMensajesPage = lazy(() => import('@/app/mis-mensajes/page'))
const MisNotificacionesPage = lazy(() => import('@/app/mis-notificaciones/page'))
const AyudaEstudiantePage = lazy(() => import('@/app/ayuda-estudiante/page'))
const ConfiguracionEstudiantePage = lazy(() => import('@/app/configuracion-estudiante/page'))

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
  return (
    <div className="glass-card flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">
        Error 404
      </p>
      <h2 className="text-2xl font-semibold text-foreground">
        Esta página no existe
      </h2>
      <a className="text-sm font-medium text-primary hover:underline" href="/">
        Volver al dashboard
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
  const { user } = useAuth()
  const esEstudiante = soloEsEstudiante(user?.roles)

  useEffect(() => {
    if (
      esEstudiante &&
      !estudiantePuedeVer(pathname) &&
      typeof window !== 'undefined'
    ) {
      window.history.replaceState(null, '', RUTA_INICIO_ESTUDIANTE)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [esEstudiante, pathname])

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

    return (
      <main className="flex min-h-svh items-center justify-center bg-[#050b14] p-6 text-white">
        <section className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 p-7 text-center shadow-2xl">
          <h1 className="text-xl font-semibold">No se pudo cargar el panel</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Ocurrió un error al iniciar la interfaz. El detalle técnico aparece
            abajo para poder corregirlo.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-left text-xs text-red-200">
            {this.state.error.message || this.state.error.name}
          </pre>
          <button
            type="button"
            onClick={this.recuperar}
            className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Recuperar aplicación
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
