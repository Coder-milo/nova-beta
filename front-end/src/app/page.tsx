'use client'

import { useEffect, useState } from 'react'
import { Gauge, RefreshCw as ArrowsClockwise, WifiOff as WifiSlash } from 'lucide-react'
/**
 * Dashboard principal — Server Component.
 *
 * Llama en paralelo a los tres endpoints del backend:
 *   GET /api/v1/dashboard/summary
 *   GET /api/v1/dashboard/charts
 *   GET /api/v1/dashboard/alerts
 *
 * Si el backend no está disponible o el token falta, muestra los datos
 * de mock-data como fallback con un aviso visible.
 */

import { StatCard } from '@/components/dashboard/stat-card'
import { StudentsStatusChart } from '@/components/dashboard/students-status-chart'
import { StudentsProjectChart } from '@/components/dashboard/students-project-chart'
import { EnrollmentChart } from '@/components/dashboard/enrollment-chart'
import { MapaDelAtlantico } from '@/components/admin/mapa-del-atlantico'
import { EmployabilityChart } from '@/components/dashboard/employability-chart'
import { AlertsCard } from '@/components/dashboard/alerts-card'
import { ActivitiesCard } from '@/components/dashboard/activities-card'
import { QuickAccess } from '@/components/dashboard/quick-access'
import { PageSpinner } from '@/components/ui/page-spinner'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { dashboardApi, copilotoApi, ApiCallError } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import type {
  DashboardSummaryResponse,
  DashboardChartsResponse,
  AlertaResponse,
  CentroAccionCopiloto,
} from '@/lib/types'
import type { StatCard as StatCardType } from '@/lib/mock-data'
import { primaryStats, secondaryStats } from '@/lib/mock-data'
import { CentroAccion } from '@/components/dashboard/centro-accion'
// ─── Mapeo de datos del backend a la forma que espera StatCard ───────────────

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        totalEstudiantes: 'Total students',
        estudiantesActivos: 'Active students',
        graduados: 'Graduates',
        retirados: 'Withdrawn',
        docsPendientes: 'Docs. pending',
        requierenAtencion: 'Need attention',
        sinPendientes: 'Nothing pending',
        sinIngresosEste: 'No new entries this month',
        enProceso: 'In progress',
        estadoAcademico: 'Academic status',
        proyectosActivos: 'Active projects',
        enEjecucion: 'Running',
        hvPorGenerar: 'Résumés to generate',
        pendientes: 'Pending',
        almacenados: 'Stored',
        cargandoDashboard: 'Loading dashboard…',
        panelAdministrativo: 'Administrative panel',
        dashboard: 'Dashboard',
        actualizar: 'Refresh',
        sinAutenticacion: 'Not signed in. Sign in to see real data.',
        backendNoDisponible: 'Backend unavailable. Showing sample data.',
        errorDelBackend: (s: number) => `Backend error (HTTP ${s}). Showing sample data.`,
        esteMes: 'This month',
        nuevosEsteMes: (n: number, pct: string) => `+${n} this month (${pct})`,
        pctDelTotal: (pct: string) => `${pct}% of the total`,
      }
    : {
        totalEstudiantes: 'Total estudiantes',
        estudiantesActivos: 'Estudiantes activos',
        graduados: 'Graduados',
        retirados: 'Retirados',
        docsPendientes: 'Docs. pendientes',
        requierenAtencion: 'Requieren atención',
        sinPendientes: 'Sin pendientes',
        sinIngresosEste: 'Sin ingresos este mes',
        enProceso: 'En proceso',
        estadoAcademico: 'Estado académico',
        proyectosActivos: 'Proyectos activos',
        enEjecucion: 'En ejecución',
        hvPorGenerar: 'HV por generar',
        pendientes: 'Pendientes',
        almacenados: 'Almacenados',
        cargandoDashboard: 'Cargando dashboard…',
        panelAdministrativo: 'Panel administrativo',
        dashboard: 'Dashboard',
        actualizar: 'Actualizar',
        sinAutenticacion: 'Sin autenticación. Inicia sesión para ver datos reales.',
        backendNoDisponible: 'Backend no disponible. Mostrando datos de ejemplo.',
        errorDelBackend: (s: number) => `Error del backend (HTTP ${s}). Mostrando datos de ejemplo.`,
        esteMes: 'Este mes',
        nuevosEsteMes: (n: number, pct: string) => `+${n} este mes (${pct})`,
        pctDelTotal: (pct: string) => `${pct}% del total`,
      }
}

type Textos = ReturnType<typeof textos>


function buildPrimaryStats(s: DashboardSummaryResponse, T: Textos, locale: string): StatCardType[] {
  return [
    {
      id: 'total',
      label: T.totalEstudiantes,
      value: s.totalEstudiantes.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      // La variación sale del texto de apoyo y pasa a su propia píldora, que es
      // la que lleva el color. El texto se queda solo con el periodo.
      helper: s.nuevosEsteMes > 0 ? T.esteMes : T.sinIngresosEste,
      delta:
        s.nuevosEsteMes > 0
          ? {
              texto: `+${s.nuevosEsteMes} (${s.variacionMesPct > 0 ? '+' : ''}${s.variacionMesPct}%)`,
              signo: s.variacionMesPct < 0 ? 'baja' : s.variacionMesPct > 0 ? 'sube' : 'neutro',
            }
          : undefined,
      icon: 'users',
      tone: 'blue',
    },
    {
      id: 'activos',
      label: T.estudiantesActivos,
      value: s.activos.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper:
        s.totalEstudiantes > 0
          ? T.pctDelTotal(((s.activos / s.totalEstudiantes) * 100).toFixed(1))
          : undefined,
      icon: 'active',
      tone: 'green',
    },
    {
      id: 'graduados',
      label: T.graduados,
      value: s.graduados.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      icon: 'graduated',
      tone: 'purple',
    },
    {
      id: 'retirados',
      label: T.retirados,
      value: s.retirados.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper:
        s.totalEstudiantes > 0
          ? T.pctDelTotal(((s.retirados / s.totalEstudiantes) * 100).toFixed(1))
          : undefined,
      icon: 'retired',
      tone: 'red',
    },
    {
      id: 'docs-pendientes',
      label: T.docsPendientes,
      value: s.documentosPendientes.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper: s.documentosPendientes > 0 ? T.requierenAtencion : T.sinPendientes,
      icon: 'pending',
      tone: 'amber',
    },
  ]
}

function buildSecondaryStats(s: DashboardSummaryResponse, T: Textos, locale: string): StatCardType[] {
  return [
    {
      id: 'en-proceso',
      label: T.enProceso,
      value: s.enProceso.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper: T.estadoAcademico,
      icon: 'active',
      tone: 'teal',
    },
    {
      id: 'proyectos-activos',
      label: T.proyectosActivos,
      value: s.totalProyectos.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper: T.enEjecucion,
      icon: 'projects',
      tone: 'blue',
    },
    {
      id: 'hv-pendientes',
      label: T.hvPorGenerar,
      value: s.hvsPorGenerar.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper: T.pendientes,
      icon: 'resumes',
      tone: 'teal',
    },
    // Aquí había una segunda tarjeta de «Docs. pendientes» con el mismo campo
    // (`documentosPendientes`) y el mismo rótulo que la de arriba: solo cambiaba
    // el texto de apoyo, «Almacenados» en vez de «Requieren atención». Eran dos
    // tarjetas enseñando el mismo 108 y dando a entender que se contaban dos
    // cosas distintas. Con ocho indicadores la rejilla además cierra en dos
    // filas de cuatro, sin el hueco que quedaba al final.
  ]
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [charts, setCharts] = useState<DashboardChartsResponse | null>(null)
  const [alerts, setAlerts] = useState<AlertaResponse[] | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [centroAccion, setCentroAccion] = useState<CentroAccionCopiloto | null>(null)
  const [loadingCentroAccion, setLoadingCentroAccion] = useState(true)
  const [errorCentroAccion, setErrorCentroAccion] = useState(false)
  /**
   * Contador de recargas.
   *
   * El botón de la cabecera lo incrementa y el efecto vuelve a pedir los tres
   * endpoints. Se hace con un contador y no sacando la función del efecto
   * porque `T` se reconstruye en cada render: un `useCallback` que dependa de
   * él se invalidaría siempre, y sin la dependencia el mensaje de error se
   * quedaría en el idioma que estuviera puesto al montar.
   */
  const [recarga, setRecarga] = useState(0)
  /** La primera carga ocupa la pantalla; las siguientes no la vacían. */
  const [primeraCarga, setPrimeraCarga] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setBackendError(null)

      try {
        const [nextSummary, nextCharts, nextAlerts] = await Promise.all([
          dashboardApi.summary(),
          dashboardApi.charts(),
          dashboardApi.alerts(),
        ])

        if (!active) return
        setSummary(nextSummary)
        setCharts(nextCharts)
        setAlerts(nextAlerts)
      } catch (err) {
        if (!active) return

        if (err instanceof ApiCallError) {
          if (err.status === 401 || err.status === 403) {
            setBackendError(
              T.sinAutenticacion,
            )
          } else {
            setBackendError(
              T.errorDelBackend(err.status),
            )
          }
        } else {
          setBackendError(
            T.backendNoDisponible,
          )
        }
      } finally {
        if (active) {
          setLoading(false)
          setPrimeraCarga(false)
        }
      }
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [recarga]) // eslint-disable-line react-hooks/exhaustive-deps

  // El Copiloto carga aparte: si esta lectura falla, los KPIs reales del resto
  // del panel no se sustituyen por datos de ejemplo ni desaparecen.
  useEffect(() => {
    let active = true
    setLoadingCentroAccion(true)
    setErrorCentroAccion(false)
    copilotoApi.centroAccion()
      .then((datos) => { if (active) setCentroAccion(datos) })
      .catch(() => { if (active) { setCentroAccion(null); setErrorCentroAccion(true) } })
      .finally(() => { if (active) setLoadingCentroAccion(false) })
    return () => { active = false }
  }, [recarga])

  if (loading && primeraCarga) {
    return <PageSpinner label={T.cargandoDashboard} />
  }

  // Si hay datos reales, los usamos; si no, mostramos el mock.
  const useLive = summary !== null && charts !== null && alerts !== null
  const pStats  = useLive ? buildPrimaryStats(summary!, T, locale) : primaryStats
  const sStats  = useLive ? buildSecondaryStats(summary!, T, locale) : secondaryStats

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        antetitulo={T.panelAdministrativo}
        titulo={T.dashboard}
        icono={Gauge}
        acciones={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecarga((n) => n + 1)}
            disabled={loading}
          >
            <ArrowsClockwise className={loading ? 'animate-spin' : undefined} />
            {T.actualizar}
          </Button>
        }
      />

      {/* Aviso de backend no disponible */}
      {backendError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <WifiSlash className="size-4 shrink-0" />
          <span>{backendError}</span>
        </div>
      )}

      {/* Los ocho indicadores van en una sola rejilla y no en dos: partirlos
          en principales y secundarios obligaba a saltar un hueco entre filas
          que no significaba nada, porque todos se leen igual. Cuatro columnas
          y no cinco: con ocho tarjetas, cinco columnas dejan la última fila con
          un hueco al final que parece una tarjeta que no cargó. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {pStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
        {sStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <StudentsStatusChart
          data={useLive ? charts!.distribucionEstado : null}
        />
        <div className="lg:col-span-2">
          <EnrollmentChart
            data={useLive ? charts!.historicoIngresos : null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <StudentsProjectChart
          data={useLive ? charts!.estudiantesPorProyecto : null}
        />
        {/* `charts.empleabilidad` lo calculaba el backend desde hacía tiempo y
            no lo pintaba nadie. Va junto a «por proyecto» porque las dos
            responden a «cómo va la cohorte», mientras que la de estado dice
            quién sigue dentro. */}
        <EmployabilityChart data={useLive ? charts!.empleabilidad : null} />
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        <AlertsCard alerts={useLive ? alerts! : null} />
      </div>

      <CentroAccion
        datos={centroAccion}
        cargando={loadingCentroAccion}
        error={errorCentroAccion}
        english={locale === 'en'}
      />

      {/* El mapa va después de las barras por proyecto y no antes: aquellas
          dicen cuánta gente hay, y este, dónde está. La pregunta de dónde solo
          aparece cuando ya se sabe cuántos. Trae su propio selector de proyecto
          porque se mira al revés que el resto del panel —se entra por el sitio,
          no por el programa—. */}
      <MapaDelAtlantico />

      {/* Actividades y accesos rápidos */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ActivitiesCard />
        <QuickAccess />
      </div>
    </div>
  )
}
