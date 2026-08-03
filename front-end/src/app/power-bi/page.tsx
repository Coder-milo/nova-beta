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

export default function PowerBiPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
        <Info className="size-4 shrink-0" />
        <span>Próximamente: esta sección aún no está conectada a un informe real de Power BI. Los KPI de abajo son ilustrativos.</span>
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
                <CardTitle className="text-base">Tablero de Control de Empleabilidad</CardTitle>
                <CardDescription>Planeado: inserción laboral e impacto de los programas (próximamente).</CardDescription>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
              Cuando el informe este listo, se podra interactuar con filtros avanzados por cohorte,
              geografía, género e ingresos mensuales antes y después del programa. Por ahora el enlace
              abre el portal general de Power BI, no un tablero especifico de NOVA CRM.
            </p>
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
              Métricas e Indicadores Clave (planeadas)
            </CardTitle>
            <CardDescription>Indicadores propuestos; aun no sincronizados con ningun almacen de datos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <ChartBar className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Tasa de Inserción Laboral</h4>
                <p className="text-muted-foreground">Porcentaje de egresados contratados dentro de los primeros 180 días.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileXls className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Multiplicador de Ingreso</h4>
                <p className="text-muted-foreground">Incremento relativo en los ingresos mensuales declarados tras la graduación.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Key className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Efectividad del Matching</h4>
                <p className="text-muted-foreground">Tasa de conversión de vacantes recomendadas a postulaciones efectivas.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
