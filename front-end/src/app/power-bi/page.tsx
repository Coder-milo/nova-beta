'use client'

import { ArrowSquareOutIcon as ArrowSquareOut, ChartBarIcon as ChartBar, ChartPieIcon as ChartPie, DatabaseIcon as Database, FileXlsIcon as FileXls, InfoIcon as Info, KeyIcon as Key } from '@phosphor-icons/react'
/**
 * Página de Power BI.
 *
 * Vista previa de los indicadores que se publicarán en Power BI. Todavía no
 * hay un informe conectado a un Data Warehouse real: el CTA abre el portal
 * genérico de Power BI, no un tablero especifico de NOVA CRM.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

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
      }
}

export default function PowerBiPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
        <Info className="size-4 shrink-0" />
        <span>{T.proximamenteEstaSeccion}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Acceso al Tablero */}
        <Card className="rounded-xl shadow-sm border-primary/30 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ChartPie className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base">{T.tableroDeControl}</CardTitle>
                <CardDescription>{T.planeadoInsercionLaboral}</CardDescription>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-2">{T.cuandoElInforme}</p>
          </CardHeader>
          <CardContent className="pt-0 flex justify-start">
            <Button
              className="gap-2"
              render={<a href="https://app.powerbi.com" target="_blank" rel="noopener noreferrer" />}
            >
              Ir a Power BI <ArrowSquareOut className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Modelo de Datos */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="size-4" />
              {T.metricasEIndicadores}
            </CardTitle>
            <CardDescription>Indicadores propuestos; aun no sincronizados con ningun almacen de datos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <ChartBar className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">{T.tasaDeInsercion}</h4>
                <p className="text-muted-foreground">{T.porcentajeDeEgresados}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileXls className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">{T.multiplicadorDeIngreso}</h4>
                <p className="text-muted-foreground">{T.incrementoRelativoEn}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Key className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">{T.efectividadDelMatching}</h4>
                <p className="text-muted-foreground">{T.tasaDeConversion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
