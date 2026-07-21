'use client'

/**
 * Página de Power BI.
 *
 * Muestra el acceso a tableros interactivos e informes corporativos integrados.
 * Proporciona un enlace directo a los reportes en el servicio en la nube y
 * detalla los indicadores clave de rendimiento (KPI) analizados.
 */

import { PieChart, ExternalLink, BarChart3, Database, FileSpreadsheet, KeyRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PowerBiPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <PieChart className="size-5" />
          Power BI
        </h2>
        <p className="text-sm text-muted-foreground">
          Tableros interactivos e inteligencia de negocios de la Academia CAC.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Acceso al Tablero */}
        <Card className="rounded-xl shadow-sm border-primary/30 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PieChart className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base">Tablero de Control de Empleabilidad</CardTitle>
                <CardDescription>Informe en tiempo real de inserción laboral e impacto de los programas.</CardDescription>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
              Accede al entorno oficial de Power BI Service para interactuar con los filtros avanzados por cohorte, 
              geografía, género e ingresos mensuales antes y después del programa.
            </p>
          </CardHeader>
          <CardContent className="pt-0 flex justify-start">
            <Button
              className="gap-2"
              render={<a href="https://app.powerbi.com" target="_blank" rel="noopener noreferrer" />}
            >
              Ir a Power BI <ExternalLink className="size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Modelo de Datos */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="size-4" />
              Métricas e Indicadores Clave
            </CardTitle>
            <CardDescription>Métricas sincronizadas con el almacén de datos (Data Warehouse).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <BarChart3 className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Tasa de Inserción Laboral</h4>
                <p className="text-muted-foreground">Porcentaje de egresados contratados dentro de los primeros 180 días.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileSpreadsheet className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Multiplicador de Ingreso</h4>
                <p className="text-muted-foreground">Incremento relativo en los ingresos mensuales declarados tras la graduación.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <KeyRound className="size-4 text-primary shrink-0 mt-0.5" />
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
