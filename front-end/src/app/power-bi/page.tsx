'use client'

import { BarChart3 as ChartBar, Database, ExternalLink as ArrowSquareOut, FileSpreadsheet as FileXls, Info, Key, PieChart as ChartPie } from 'lucide-react'
/**
 * Página de Power BI.
 *
 * Vista previa de los indicadores que se publicarán en Power BI. Todavía no
 * hay un informe conectado a un Data Warehouse real: el CTA abre el portal
 * genérico de Power BI, no un tablero especifico de NOVA CRM.
 */

import { Button } from '@/components/ui/button'
import {
  CabeceraTabler,
  CabeceraTarjeta,
  CuerpoTarjeta,
  PaginaTabler,
  TarjetaTabler,
} from '@/components/reportes/tabler'
import { usePreferences } from '@/lib/preferences'

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        cuandoElInforme: 'Once the report is ready, it will support advanced filters by cohort, geography, gender and monthly income before and after the programme. For now the link opens the general Power BI portal, not a NOVA CRM dashboard.',
        proximamenteEstaSeccion: 'Coming soon: this section is not connected to a real Power BI report yet. The KPIs below are illustrative.',
        tableroDeControl: 'Employability dashboard',
        planeadoInsercionLaboral: 'Planned: job placement and programme impact (coming soon).',
        metricasEIndicadores: 'Key metrics and indicators (planned)',
        tasaDeInsercion: 'Job placement rate',
        porcentajeDeEgresados: 'Share of graduates hired within the first 180 days.',
        multiplicadorDeIngreso: 'Income multiplier',
        incrementoRelativoEn: 'Relative increase in declared monthly income after graduation.',
        efectividadDelMatching: 'Matching effectiveness',
        tasaDeConversion: 'Conversion rate from recommended vacancies to actual applications.',
        indicadoresPropuestos: 'Proposed indicators; not yet synced with any data warehouse.',
        analitica: 'Analytics',
      }
    : {
        cuandoElInforme: 'Cuando el informe esté listo, se podrá interactuar con filtros avanzados por cohorte, geografía, género e ingresos mensuales antes y después del programa. Por ahora el enlace abre el portal general de Power BI, no un tablero específico de NOVA CRM.',
        proximamenteEstaSeccion: 'Próximamente: esta sección aún no está conectada a un informe real de Power BI. Los KPI de abajo son ilustrativos.',
        tableroDeControl: 'Tablero de Control de Empleabilidad',
        planeadoInsercionLaboral: 'Planeado: inserción laboral e impacto de los programas (próximamente).',
        metricasEIndicadores: 'Métricas e Indicadores Clave (planeadas)',
        tasaDeInsercion: 'Tasa de Inserción Laboral',
        porcentajeDeEgresados: 'Porcentaje de egresados contratados dentro de los primeros 180 días.',
        multiplicadorDeIngreso: 'Multiplicador de Ingreso',
        incrementoRelativoEn: 'Incremento relativo en los ingresos mensuales declarados tras la graduación.',
        efectividadDelMatching: 'Efectividad del Matching',
        tasaDeConversion: 'Tasa de conversión de vacantes recomendadas a postulaciones efectivas.',
        indicadoresPropuestos: 'Indicadores propuestos; aún no sincronizados con ningún almacén de datos.',
        analitica: 'Analítica',
      }
}

export default function PowerBiPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  // Los indicadores planeados. En una lista se ven como lo que son —una
  // propuesta pendiente de conectar— y añadir el siguiente no obliga a tocar
  // la maqueta.
  const indicadores = [
    { icono: ChartBar, titulo: T.tasaDeInsercion, detalle: T.porcentajeDeEgresados },
    { icono: FileXls, titulo: T.multiplicadorDeIngreso, detalle: T.incrementoRelativoEn },
    { icono: Key, titulo: T.efectividadDelMatching, detalle: T.tasaDeConversion },
  ]

  return (
    <PaginaTabler>
      <CabeceraTabler
        pretitulo={T.analitica}
        titulo={T.tableroDeControl}
        descripcion={T.planeadoInsercionLaboral}
        acciones={
          <Button
            size="sm"
            className="gap-2"
            render={<a href="https://app.powerbi.com" target="_blank" rel="noopener noreferrer" />}
          >
            Ir a Power BI <ArrowSquareOut className="size-4" />
          </Button>
        }
      />

      <div
        className="flex items-start gap-2 rounded border px-4 py-3 text-sm"
        style={{
          borderColor: 'color-mix(in srgb, var(--tbl-naranja) 35%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--tbl-naranja) 10%, transparent)',
          color: 'var(--tbl-naranja)',
        }}
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{T.proximamenteEstaSeccion}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Acceso al Tablero */}
        <TarjetaTabler className="flex flex-col">
          <CabeceraTarjeta
            titulo={T.tableroDeControl}
            subtitulo={T.planeadoInsercionLaboral}
            acciones={
              <span
                className="flex size-8 items-center justify-center rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tbl-azul) 12%, transparent)',
                  color: 'var(--tbl-azul)',
                }}
              >
                <ChartPie className="size-4" />
              </span>
            }
          />
          <CuerpoTarjeta className="flex-1">
            <p className="text-sm leading-relaxed text-muted-foreground">{T.cuandoElInforme}</p>
          </CuerpoTarjeta>
        </TarjetaTabler>

        {/* Modelo de Datos */}
        <TarjetaTabler>
          <CabeceraTarjeta
            titulo={T.metricasEIndicadores}
            subtitulo={T.indicadoresPropuestos}
            acciones={
              <span
                className="flex size-8 items-center justify-center rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--tbl-morado) 12%, transparent)',
                  color: 'var(--tbl-morado)',
                }}
              >
                <Database className="size-4" />
              </span>
            }
          />
          <table className="tbl-table">
            <tbody>
              {indicadores.map(({ icono: Icono, titulo, detalle }) => (
                <tr key={titulo}>
                  <td className="w-10 align-top">
                    <Icono className="size-4" style={{ color: 'var(--tbl-azul)' }} />
                  </td>
                  <td>
                    <div className="font-semibold">{titulo}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabler>
      </div>
    </PaginaTabler>
  )
}
