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
  empresaPuedeVer,
  soloEsEmpresa,
  RUTA_INICIO_EMPRESA,
} from '@/lib/navigation'
import { usePathname } from '@/compat/next-navigation'
import {
  cargadoresDeRuta,
  cargadoresPorPatron,
  normalizarRuta,
} from '@/lib/rutas'

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

/**
 * Las pantallas salen del registro de `lib/rutas`, que es el mismo del que
 * tira la precarga al apuntar un enlace. Compartir la lista evita que una
 * ruta quede navegable pero sin precargar —o al revés— cuando se añada la
 * siguiente.
 */
const exactRoutes: Record<string, ComponentType> = Object.fromEntries(
  Object.entries(cargadoresDeRuta).map(([ruta, cargar]) => [ruta, lazyRetry(cargar)]),
)

const rutasPorPatron: ReadonlyArray<[RegExp, ComponentType]> = cargadoresPorPatron.map(
  ([patron, cargar]) => [patron, lazyRetry(cargar)],
)

const PortalEstudiantePage = exactRoutes['/portal-estudiante']
const PortalEmpresaPage = exactRoutes['/portal/vacantes']

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
  const normalized = normalizarRuta(pathname)

  const ExactPage = exactRoutes[normalized]
  if (ExactPage) {
    return ExactPage
  }

  const PatronPage = rutasPorPatron.find(([patron]) => patron.test(normalized))?.[1]
  if (PatronPage) {
    return PatronPage
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
  const esEmpresa = soloEsEmpresa(user?.roles)

  // Fuera de sitio: el rol no alcanza esta ruta. Se corrige la URL en vez de
  // navegar, para no dejar la pantalla prohibida en el historial —donde el
  // botón Atrás la volvería a abrir—.
  const fueraDeSitio =
    (esEstudiante && !estudiantePuedeVer(pathname)) ||
    (esEmpresa && !empresaPuedeVer(pathname))

  useEffect(() => {
    if (!cargando && fueraDeSitio && typeof window !== 'undefined') {
      window.history.replaceState(null, '', esEmpresa ? RUTA_INICIO_EMPRESA : RUTA_INICIO_ESTUDIANTE)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [cargando, fueraDeSitio, esEmpresa, pathname])

  // Hasta que se sepa quien entro no se monta ninguna pantalla. La sesion se
  // lee en un efecto, asi que en el primer render `user` es null y
  // `soloEsEstudiante` responde false: pintar ya habria montado el dashboard
  // de administracion —con sus llamadas a datos de todos los proyectos— en la
  // pantalla de un estudiante, que es de donde salian los 403 del arranque.
  const { locale } = usePreferences()
  if (cargando) return <PageSpinner label={locale === 'en' ? 'Signing in…' : 'Iniciando sesión…'} />

  // Mientras el efecto corrige la URL ya se pinta la pantalla de destino, para
  // que no llegue a montarse el dashboard y disparar las llamadas que dan 403.
  const Page = fueraDeSitio
    ? (esEmpresa ? PortalEmpresaPage : PortalEstudiantePage)
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
