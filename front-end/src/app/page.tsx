'use client'

import { useEffect, useState } from 'react'
import { WifiSlashIcon as WifiSlash } from '@phosphor-icons/react'
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
import { AlertsCard } from '@/components/dashboard/alerts-card'
import { ActivitiesCard } from '@/components/dashboard/activities-card'
import { QuickAccess } from '@/components/dashboard/quick-access'
import { PageSpinner } from '@/components/ui/page-spinner'
import { dashboardApi, ApiCallError } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import type {
  DashboardSummaryResponse,
  DashboardChartsResponse,
  AlertaResponse,
  PuntoDato,
} from '@/lib/types'
import type { StatCard as StatCardType } from '@/lib/mock-data'
import { primaryStats, secondaryStats } from '@/lib/mock-data'
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
        sinAutenticacion: 'Not signed in. Sign in to see real data.',
        backendNoDisponible: 'Backend unavailable. Showing sample data.',
        errorDelBackend: (s: number) => `Backend error (HTTP ${s}). Showing sample data.`,
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
        sinAutenticacion: 'Sin autenticación. Inicia sesión para ver datos reales.',
        backendNoDisponible: 'Backend no disponible. Mostrando datos de ejemplo.',
        errorDelBackend: (s: number) => `Error del backend (HTTP ${s}). Mostrando datos de ejemplo.`,
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
      helper:
        s.nuevosEsteMes > 0
          ? T.nuevosEsteMes(s.nuevosEsteMes, `${s.variacionMesPct > 0 ? '+' : ''}${s.variacionMesPct}%`)
          : T.sinIngresosEste,
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
    {
      id: 'documentos',
      label: T.docsPendientes,
      value: s.documentosPendientes.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO'),
      helper: T.almacenados,
      icon: 'documents',
      tone: 'purple',
    },
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
        if (active) setLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return <PageSpinner label={T.cargandoDashboard} />
  }

  // Si hay datos reales, los usamos; si no, mostramos el mock.
  const useLive = summary !== null && charts !== null && alerts !== null
  const pStats  = useLive ? buildPrimaryStats(summary!, T, locale) : primaryStats
  const sStats  = useLive ? buildSecondaryStats(summary!, T, locale) : secondaryStats

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso de backend no disponible */}
      {backendError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <WifiSlash className="size-4 shrink-0" />
          <span>{backendError}</span>
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {pStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Estadísticas secundarias */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StudentsStatusChart
          data={useLive ? charts!.distribucionEstado : null}
        />
        <div className="lg:col-span-2">
          <EnrollmentChart
            data={useLive ? charts!.historicoIngresos : null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StudentsProjectChart
          data={useLive ? charts!.estudiantesPorProyecto : null}
        />
        <AlertsCard alerts={useLive ? alerts! : null} />
      </div>

      {/* Actividades y accesos rápidos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivitiesCard />
        <QuickAccess />
      </div>
    </div>
  )
}
