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

import { cookies } from 'next/headers'
import { StatCard } from '@/components/dashboard/stat-card'
import { StudentsStatusChart } from '@/components/dashboard/students-status-chart'
import { StudentsProjectChart } from '@/components/dashboard/students-project-chart'
import { EnrollmentChart } from '@/components/dashboard/enrollment-chart'
import { AlertsCard } from '@/components/dashboard/alerts-card'
import { ActivitiesCard } from '@/components/dashboard/activities-card'
import { QuickAccess } from '@/components/dashboard/quick-access'
import { dashboardApi, ApiCallError } from '@/lib/api'
import type {
  DashboardSummaryResponse,
  DashboardChartsResponse,
  AlertaResponse,
  PuntoDato,
} from '@/lib/types'
import type { StatCard as StatCardType } from '@/lib/mock-data'
import { primaryStats, secondaryStats } from '@/lib/mock-data'
import { WifiOff } from 'lucide-react'

// ─── Mapeo de datos del backend a la forma que espera StatCard ───────────────

function buildPrimaryStats(s: DashboardSummaryResponse): StatCardType[] {
  return [
    {
      id: 'total',
      label: 'Total estudiantes',
      value: s.totalEstudiantes.toLocaleString('es-CO'),
      helper:
        s.nuevosEsteMes > 0
          ? `+${s.nuevosEsteMes} este mes (${s.variacionMesPct > 0 ? '+' : ''}${s.variacionMesPct}%)`
          : 'Sin ingresos este mes',
      icon: 'users',
      tone: 'blue',
    },
    {
      id: 'activos',
      label: 'Estudiantes activos',
      value: s.activos.toLocaleString('es-CO'),
      helper:
        s.totalEstudiantes > 0
          ? `${((s.activos / s.totalEstudiantes) * 100).toFixed(1)}% del total`
          : undefined,
      icon: 'active',
      tone: 'green',
    },
    {
      id: 'graduados',
      label: 'Graduados',
      value: s.graduados.toLocaleString('es-CO'),
      icon: 'graduated',
      tone: 'purple',
    },
    {
      id: 'retirados',
      label: 'Retirados',
      value: s.retirados.toLocaleString('es-CO'),
      helper:
        s.totalEstudiantes > 0
          ? `${((s.retirados / s.totalEstudiantes) * 100).toFixed(1)}% del total`
          : undefined,
      icon: 'retired',
      tone: 'red',
    },
    {
      id: 'docs-pendientes',
      label: 'Docs. pendientes',
      value: s.documentosPendientes.toLocaleString('es-CO'),
      helper: s.documentosPendientes > 0 ? 'Requieren atención' : 'Sin pendientes',
      icon: 'pending',
      tone: 'amber',
    },
  ]
}

function buildSecondaryStats(s: DashboardSummaryResponse): StatCardType[] {
  return [
    {
      id: 'en-proceso',
      label: 'En proceso',
      value: s.enProceso.toLocaleString('es-CO'),
      helper: 'Estado académico',
      icon: 'active',
      tone: 'teal',
    },
    {
      id: 'proyectos-activos',
      label: 'Proyectos activos',
      value: s.totalProyectos.toLocaleString('es-CO'),
      helper: 'En ejecución',
      icon: 'projects',
      tone: 'blue',
    },
    {
      id: 'hv-pendientes',
      label: 'HV por generar',
      value: s.hvsPorGenerar.toLocaleString('es-CO'),
      helper: 'Pendientes',
      icon: 'resumes',
      tone: 'teal',
    },
    {
      id: 'documentos',
      label: 'Docs. pendientes',
      value: s.documentosPendientes.toLocaleString('es-CO'),
      helper: 'Almacenados',
      icon: 'documents',
      tone: 'purple',
    },
  ]
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('nova_token')?.value

  let summary: DashboardSummaryResponse | null = null
  let charts:  DashboardChartsResponse | null  = null
  let alerts:  AlertaResponse[] | null         = null
  let backendError: string | null = null

  try {
    ;[summary, charts, alerts] = await Promise.all([
      dashboardApi.summary(token),
      dashboardApi.charts(token),
      dashboardApi.alerts(token),
    ])
  } catch (err) {
    if (err instanceof ApiCallError) {
      if (err.status === 401 || err.status === 403) {
        backendError = 'Sin autenticación. Inicia sesión para ver datos reales.'
      } else {
        backendError = `Error del backend (HTTP ${err.status}). Mostrando datos de ejemplo.`
      }
    } else {
      backendError = 'Backend no disponible. Mostrando datos de ejemplo.'
    }
  }

  // Si hay datos reales, los usamos; si no, mostramos el mock.
  const useLive = summary !== null && charts !== null && alerts !== null
  const pStats  = useLive ? buildPrimaryStats(summary!) : primaryStats
  const sStats  = useLive ? buildSecondaryStats(summary!) : secondaryStats

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-foreground text-balance">
          Bienvenida de nuevo
        </h2>
        <p className="text-sm text-muted-foreground">
          Este es el resumen general de la Academia CAC.
        </p>
      </div>

      {/* Aviso de backend no disponible */}
      {backendError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <WifiOff className="size-4 shrink-0" />
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
