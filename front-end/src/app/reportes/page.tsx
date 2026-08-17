'use client'

import { CircleAlert as WarningCircle, Download as DownloadSimple, GraduationCap, RefreshCw as ArrowsClockwise, SquareKanban as Kanban, TrendingUp as TrendUp, UserCheck, UserMinus as UserCircleMinus, Users } from 'lucide-react'
/**
 * Página de Reportes — Estadísticas y gráficos.
 *
 * Consume los mismos endpoints del dashboard:
 *   GET /api/v1/dashboard/summary
 *   GET /api/v1/dashboard/charts
 *
 * Presenta los datos en un formato orientado a reportes con tablas
 * y métricas descargables.
 *
 * El aspecto sigue a Tabler: superficies opacas, borde de 1px y tipografía
 * densa. Aquí no se lee de un vistazo sino con la vista puesta, y el vidrio del
 * resto del panel —translúcido, con blur detrás— le quita contraste justo a lo
 * que hay que comparar. El ámbito lo abre `PaginaTabler`; fuera de esta
 * pantalla nada cambia.
 */

import { useState, useEffect } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Button } from '@/components/ui/button'
import {
  CabeceraTabler,
  CabeceraTarjeta,
  CuerpoTarjeta,
  IndicadorTabler,
  PaginaTabler,
  TablaCategorias,
  TarjetaTabler,
} from '@/components/reportes/tabler'
import { GraficoCategorias, GraficoSerieMensual } from '@/components/reportes/graficos'
import { BancosDeInformes } from '@/components/admin/bancos-de-informes'
import { ConstructorDeInformes } from '@/components/admin/constructor-de-informes'
import { dashboardApi, reportesApi, ApiCallError } from '@/lib/api'
import { descargarCsv } from '@/lib/csv'
import { hoyLocal } from '@/lib/utils'
import type { DashboardSummaryResponse, DashboardChartsResponse, PuntoDato } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

/** Tonos de serie de Tabler, en el mismo orden que usa la paleta del gráfico. */
const COLORES_SERIE = [
  'var(--tbl-azul)',
  'var(--tbl-verde)',
  'var(--tbl-morado)',
  'var(--tbl-naranja)',
  'var(--tbl-cian)',
  'var(--tbl-rojo)',
] as const

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
        analitica: 'Analytics',
        totalEstudiantes: 'Total students',
        graduados: 'Graduates',
        retirados: 'Withdrawn',
        enProceso: 'In progress',
        proyectos: 'Projects',
        estudiantes: 'Students',
        proyecto: 'Project',
        estado: 'Status',
        mes: 'Month',
        ingresos: 'Intake',
        refrescar: 'Refresh',
        reintentar: 'Retry',
        cargandoReportes: 'Loading reports…',
        errorServidor: 'Server error',
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
        analitica: 'Analítica',
        totalEstudiantes: 'Total estudiantes',
        graduados: 'Graduados',
        retirados: 'Retirados',
        enProceso: 'En proceso',
        proyectos: 'Proyectos',
        estudiantes: 'Estudiantes',
        proyecto: 'Proyecto',
        estado: 'Estado',
        mes: 'Mes',
        ingresos: 'Ingresos',
        refrescar: 'Refrescar',
        reintentar: 'Reintentar',
        cargandoReportes: 'Cargando reportes…',
        errorServidor: 'Error del servidor',
      }
}

export default function ReportesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const idioma = locale === 'en' ? 'en-GB' : 'es-CO'
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
          : `${T.errorServidor} (HTTP ${err.status}).`)
      } else { setError(C.errorConexion) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

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

  const numero = (valor: number) => valor.toLocaleString(idioma)

  const botonCsv = (rows: PuntoDato[], nombre: string) => (
    <Button variant="ghost" size="sm" onClick={() => exportCSV(rows, nombre)}>
      <DownloadSimple className="size-3.5" /> CSV
    </Button>
  )

  return (
    <PaginaTabler>
      <CabeceraTabler
        pretitulo={T.analitica}
        titulo={T.reportesYAnalitica}
        descripcion={T.estadisticasInstitucionalesY}
        acciones={
          <>
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
              <ArrowsClockwise className="size-3.5" /> {T.refrescar}
            </Button>
          </>
        }
      />

      {/* Antes de los gráficos: son las dos descargas que alguien viene a
          buscar aquí, y una de ellas es la que se manda fuera. */}
      <BancosDeInformes />

      {/* Despues de los dos bancos y no antes: los bancos cubren los dos casos
          frecuentes —lo que se manda a una empresa y el panorama interno— y el
          constructor es para cuando ninguno sirve. Ponerlo primero convertiria
          cada descarga rutinaria en una decision de doce casillas. */}
      <ConstructorDeInformes />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner label={T.cargandoReportes} />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={load}><ArrowsClockwise className="size-4" /> {T.reintentar}</Button>
        </div>
      )}

      {!loading && !error && summary && charts && (
        <>
          {/* Fila de indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <IndicadorTabler
              etiqueta={T.totalEstudiantes}
              valor={numero(summary.totalEstudiantes)}
              icono={<Users className="size-5" />}
              color="var(--tbl-azul)"
            />
            <IndicadorTabler
              etiqueta={T.activos}
              valor={numero(summary.activos)}
              icono={<UserCheck className="size-5" />}
              color="var(--tbl-verde)"
            />
            <IndicadorTabler
              etiqueta={T.graduados}
              valor={numero(summary.graduados)}
              icono={<GraduationCap className="size-5" />}
              color="var(--tbl-morado)"
            />
            <IndicadorTabler
              etiqueta={T.nuevosEsteMes}
              valor={numero(summary.nuevosEsteMes)}
              icono={<TrendUp className="size-5" />}
              color="var(--tbl-naranja)"
              variacion={{ valor: summary.variacionMesPct }}
            />
            <IndicadorTabler
              etiqueta={T.retirados}
              valor={numero(summary.retirados)}
              icono={<UserCircleMinus className="size-5" />}
              color="var(--tbl-rojo)"
            />
            <IndicadorTabler
              etiqueta={T.enProceso}
              valor={numero(summary.enProceso)}
              icono={<Users className="size-5" />}
              color="var(--tbl-cian)"
            />
            <IndicadorTabler
              etiqueta={T.proyectos}
              valor={numero(summary.totalProyectos)}
              icono={<Kanban className="size-5" />}
              color="var(--tbl-azul)"
            />
            <IndicadorTabler
              etiqueta={T.variacionMes}
              valor={`${summary.variacionMesPct > 0 ? '+' : ''}${summary.variacionMesPct}%`}
              icono={<TrendUp className="size-5" />}
              color={summary.variacionMesPct >= 0 ? 'var(--tbl-verde)' : 'var(--tbl-rojo)'}
            />
          </div>

          {/* Estado académico y empleabilidad, uno al lado del otro: son las dos
              lecturas que se comparan entre sí. */}
          <div className="grid gap-3 xl:grid-cols-2">
            <TarjetaTabler>
              <CabeceraTarjeta
                titulo={T.distribucionPorEstado}
                subtitulo={T.estudiantesAgrupadosPor}
                acciones={botonCsv(charts.distribucionEstado, 'distribucion_estado')}
              />
              <CuerpoTarjeta>
                <GraficoCategorias
                  datos={charts.distribucionEstado}
                  etiquetaEjeX={T.estudiantes}
                  descripcion={T.distribucionPorEstado}
                />
              </CuerpoTarjeta>
              <TablaCategorias
                columnaCategoria={T.estado}
                filas={charts.distribucionEstado}
                colores={COLORES_SERIE}
              />
            </TarjetaTabler>

            <TarjetaTabler>
              <CabeceraTarjeta
                titulo="Empleabilidad"
                subtitulo={T.estadoDeEmpleabilidad}
                acciones={botonCsv(charts.empleabilidad, 'empleabilidad')}
              />
              <CuerpoTarjeta>
                <GraficoCategorias
                  datos={charts.empleabilidad}
                  etiquetaEjeX={T.estudiantes}
                  descripcion="Empleabilidad"
                />
              </CuerpoTarjeta>
              <TablaCategorias
                columnaCategoria={T.categoria}
                filas={charts.empleabilidad}
                colores={COLORES_SERIE}
              />
            </TarjetaTabler>
          </div>

          {/* Estudiantes por proyecto: a lo ancho, porque la lista crece con
              cada programa nuevo y las etiquetas son largas. */}
          <TarjetaTabler>
            <CabeceraTarjeta
              titulo={T.estudiantesPorProyecto}
              subtitulo={T.distribucionDeEstudiantes}
              acciones={botonCsv(charts.estudiantesPorProyecto, 'estudiantes_por_proyecto')}
            />
            <CuerpoTarjeta>
              <GraficoCategorias
                datos={charts.estudiantesPorProyecto}
                etiquetaEjeX={T.estudiantes}
                altura={Math.max(220, charts.estudiantesPorProyecto.length * 34 + 60)}
                descripcion={T.estudiantesPorProyecto}
              />
            </CuerpoTarjeta>
            <TablaCategorias
              columnaCategoria={T.proyecto}
              filas={charts.estudiantesPorProyecto}
              colores={COLORES_SERIE}
            />
          </TarjetaTabler>

          {/* Histórico mensual */}
          <TarjetaTabler>
            <CabeceraTarjeta
              titulo={T.historicoDeIngresos}
              subtitulo={T.nuevosEstudiantesRegistrados}
              acciones={botonCsv(charts.historicoIngresos, 'historico_ingresos')}
            />
            <CuerpoTarjeta>
              <GraficoSerieMensual
                datos={charts.historicoIngresos}
                etiquetaEjeY={T.ingresos}
                altura={280}
                descripcion={T.historicoDeIngresos}
              />
            </CuerpoTarjeta>
            <div className="overflow-x-auto">
              <table className="tbl-table">
                <thead>
                  <tr>
                    <th>{T.mes}</th>
                    <th className="text-right">{T.ingresos}</th>
                  </tr>
                </thead>
                <tbody>
                  {charts.historicoIngresos.map((d) => (
                    <tr key={d.label}>
                      <td className="font-medium">{d.label}</td>
                      <td className="tbl-numero text-right font-semibold">{numero(d.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TarjetaTabler>
        </>
      )}
    </PaginaTabler>
  )
}
