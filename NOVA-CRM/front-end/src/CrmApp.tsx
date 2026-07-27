import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageSpinner } from '@/components/ui/page-spinner'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ProveedorBranding } from '@/lib/branding'
import {
  estudiantePuedeVer,
  soloEsEstudiante,
  RUTA_INICIO_ESTUDIANTE,
} from '@/lib/navigation'
import { usePathname } from '@/compat/next-navigation'

const DashboardPage = lazy(() => import('@/app/page'))
const AuditoriaPage = lazy(() => import('@/app/auditoria/page'))
const ComunicacionesPage = lazy(() => import('@/app/comunicaciones/page'))
const ConfiguracionPage = lazy(() => import('@/app/configuracion/page'))
const DocumentosPage = lazy(() => import('@/app/documentos/page'))
const EstudiantesPage = lazy(() => import('@/app/estudiantes/page'))
const EstudianteDetallePage = lazy(() => import('@/app/estudiantes/[id]/page'))
const NuevoEstudiantePage = lazy(() => import('@/app/estudiantes/nuevo/page'))
const HojasDeVidaPage = lazy(() => import('@/app/hojas-de-vida/page'))
const ImportacionesPage = lazy(() => import('@/app/importaciones/page'))
const LoginPage = lazy(() => import('@/app/login/page'))
const PortalEstudiantePage = lazy(() => import('@/app/portal-estudiante/page'))
const PowerBiPage = lazy(() => import('@/app/power-bi/page'))
const ProyectosPage = lazy(() => import('@/app/proyectos/page'))
const ProyectoDetallePage = lazy(() => import('@/app/proyectos/[id]/page'))
const RecuperarContrasenaPage = lazy(
  () => import('@/app/recuperar-contrasena/page'),
)
const ReportesPage = lazy(() => import('@/app/reportes/page'))
const VacantesPage = lazy(() => import('@/app/vacantes/page'))

const exactRoutes: Record<string, ComponentType> = {
  '/': DashboardPage,
  '/auditoria': AuditoriaPage,
  '/comunicaciones': ComunicacionesPage,
  '/configuracion': ConfiguracionPage,
  '/documentos': DocumentosPage,
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

export default function CrmApp() {
  return (
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
  )
}
