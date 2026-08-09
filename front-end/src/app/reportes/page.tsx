'use client'

import { ArrowsClockwiseIcon as ArrowsClockwise, BriefcaseIcon as Briefcase, ChartBarIcon as ChartBar, DownloadSimpleIcon as DownloadSimple, GraduationCapIcon as GraduationCap, KanbanIcon as Kanban, TrendUpIcon as TrendUp, UserCheckIcon as UserCheck, UserCircleMinusIcon as UserCircleMinus, UsersIcon as Users, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
/**
 * Página de Reportes — Estadísticas y gráficos.
 *
 * Consume los mismos endpoints del dashboard:
 *   GET /api/v1/dashboard/summary
 *   GET /api/v1/dashboard/charts
 *
 * Presenta los datos en un formato orientado a reportes con tablas
 * y métricas descargables.
 */

import { useState, useEffect } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { dashboardApi, reportesApi, ApiCallError } from '@/lib/api'
import { descargarCsv } from '@/lib/csv'
import { hoyLocal } from '@/lib/utils'
import type { DashboardSummaryResponse, DashboardChartsResponse, PuntoDato } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Users; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className={`flex size-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function BarRow({ label, value, max, pct }: { label: string; value: number; max: number; pct?: number | null }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-muted-foreground truncate shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      <span className="w-14 text-xs font-semibold text-foreground text-right shrink-0">
        {value}{pct != null ? ` (${pct.toFixed(0)}%)` : ''}
      </span>
    </div>
  )
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        estadisticasInstitucionalesY: 'Institutional statistics and downloads in Excel, PDF and CSV.',
        estudiantesAgrupadosPor: 'Students grouped by their current academic status.',
        distribucionDeEstudiantes: 'Active students broken down by programme.',
        estadoDeEmpleabilidad: 'Employability status of the students.',
        nuevosEstudiantesRegistrados: 'New students registered per month (current year).',
        distribucionPorEstado: 'Breakdown by academic status',
        historicoDeIngresos: 'Monthly intake history',
        reportesYAnalitica: 'Reports and analytics',
        estudiantesPorProyecto: 'Students by project',
        nuevosEsteMes: 'New this month',
        variacionMes: 'Month-on-month change',
        activos: 'Active',
        categoria: 'Category',
      }
    : {
        estadisticasInstitucionalesY: 'Estadísticas institucionales y descargas en Excel, PDF y CSV.',
        estudiantesAgrupadosPor: 'Estudiantes agrupados por su estado académico actual.',
        distribucionDeEstudiantes: 'Distribución de estudiantes activos por programa.',
        estadoDeEmpleabilidad: 'Estado de empleabilidad de los estudiantes.',
        nuevosEstudiantesRegistrados: 'Nuevos estudiantes registrados por mes (año actual).',
        distribucionPorEstado: 'Distribución por Estado Académico',
        historicoDeIngresos: 'Histórico de Ingresos Mensuales',
        reportesYAnalitica: 'Reportes y Analítica',
        estudiantesPorProyecto: 'Estudiantes por Proyecto',
        nuevosEsteMes: 'Nuevos este mes',
        variacionMes: 'Variación mes',
        activos: 'Activos',
        categoria: 'Categoría',
      }
}

export default function ReportesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [charts, setCharts] = useState<DashboardChartsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [s, c] = await Promise.all([dashboardApi.summary(), dashboardApi.charts()])
      setSummary(s); setCharts(c)
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? C.errorPermisos
          : `Error del servidor (HTTP ${err.status}).`)
      } else { setError(C.errorConexion) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const maxDistribucion = charts ? Math.max(...charts.distribucionEstado.map((d) => d.value), 1) : 1
  const maxProyectos = charts ? Math.max(...charts.estudiantesPorProyecto.map((d) => d.value), 1) : 1
  const maxEmpleabilidad = charts ? Math.max(...charts.empleabilidad.map((d) => d.value), 1) : 1

  // El detalle de un gráfico, tal cual se ve, para pegarlo en una hoja. El CSV
  // se arma con `descargarCsv`, que pone la marca UTF-8 y el punto y coma que
  // Excel espera en español; con comas y sin BOM, cada fila caía entera en la
  // columna A y los acentos salían rotos.
  const exportCSV = (rows: PuntoDato[], filename: string) => {
    const fecha = hoyLocal()
    descargarCsv(
      `${filename}-${fecha}.csv`,
      [T.categoria, 'Cantidad', 'Porcentaje'],
      // El porcentaje va con coma decimal: con punto, Excel en español lo lee
      // como texto y no deja ni sumarlo ni graficarlo.
      rows.map((r) => [r.label, r.value, r.pct != null ? r.pct.toFixed(1).replace('.', ',') : '']),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{T.reportesYAnalitica}</h2>
          <p className="text-xs text-muted-foreground">{T.estadisticasInstitucionalesY}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reportesApi.exportar('estudiantes', 'xlsx')}>
            <DownloadSimple className="size-3.5 text-emerald-600" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => reportesApi.exportar('estudiantes', 'pdf')}>
            <DownloadSimple className="size-3.5 text-rose-600" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => reportesApi.exportar('estudiantes', 'csv')}>
            <DownloadSimple className="size-3.5 text-sky-600" /> CSV (UTF-8)
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <ArrowsClockwise className="size-3.5" /> Refrescar
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner label="Cargando reportes…" />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={load}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {!loading && !error && summary && charts && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Total estudiantes" value={summary.totalEstudiantes.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={Users} color="bg-primary/10 text-primary" />
            <MetricCard label={T.activos} value={summary.activos.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={UserCheck} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" />
            <MetricCard label="Graduados" value={summary.graduados.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={GraduationCap} color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" />
            <MetricCard label={T.nuevosEsteMes} value={summary.nuevosEsteMes.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={TrendUp} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Retirados" value={summary.retirados.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={UserCircleMinus} color="bg-destructive/10 text-destructive" />
            <MetricCard label="En proceso" value={summary.enProceso.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={Users} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" />
            <MetricCard label="Proyectos" value={summary.totalProyectos.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO')} icon={Kanban} color="bg-primary/10 text-primary" />
            <MetricCard label={T.variacionMes} value={`${summary.variacionMesPct > 0 ? '+' : ''}${summary.variacionMesPct}%`} icon={TrendUp} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" />
          </div>

          {/* Distribución por Estado Académico */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{T.distribucionPorEstado}</CardTitle>
                <CardDescription>{T.estudiantesAgrupadosPor}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportCSV(charts.distribucionEstado, 'distribucion_estado')}>
                <DownloadSimple className="size-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {charts.distribucionEstado.map((d) => (
                <BarRow key={d.label} label={d.label} value={d.value} max={maxDistribucion} pct={d.pct} />
              ))}
            </CardContent>
          </Card>

          {/* Estudiantes por Proyecto */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{T.estudiantesPorProyecto}</CardTitle>
                <CardDescription>{T.distribucionDeEstudiantes}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportCSV(charts.estudiantesPorProyecto, 'estudiantes_por_proyecto')}>
                <DownloadSimple className="size-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {charts.estudiantesPorProyecto.map((d) => (
                <BarRow key={d.label} label={d.label} value={d.value} max={maxProyectos} pct={d.pct} />
              ))}
            </CardContent>
          </Card>

          {/* Empleabilidad */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Empleabilidad</CardTitle>
                <CardDescription>{T.estadoDeEmpleabilidad}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportCSV(charts.empleabilidad, 'empleabilidad')}>
                <DownloadSimple className="size-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {charts.empleabilidad.map((d) => (
                <BarRow key={d.label} label={d.label} value={d.value} max={maxEmpleabilidad} pct={d.pct} />
              ))}
            </CardContent>
          </Card>

          {/* Histórico de Ingresos */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{T.historicoDeIngresos}</CardTitle>
                <CardDescription>{T.nuevosEstudiantesRegistrados}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportCSV(charts.historicoIngresos, 'historico_ingresos')}>
                <DownloadSimple className="size-3.5" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 text-left font-medium text-muted-foreground">Mes</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {charts.historicoIngresos.map((d) => (
                      <tr key={d.label}>
                        <td className="py-2 text-foreground">{d.label}</td>
                        <td className="py-2 text-right font-semibold text-foreground">{d.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
