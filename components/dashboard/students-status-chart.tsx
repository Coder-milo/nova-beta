'use client'

import { Pie, PieChart } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { studentsByStatus } from '@/lib/mock-data'
import type { PuntoDato } from '@/lib/types'

const chartConfig = {
  total: { label: 'Estudiantes' },
  activos:     { label: 'Activos',     color: 'var(--chart-2)' },
  graduados:   { label: 'Graduados',   color: 'var(--chart-1)' },
  retirados:   { label: 'Retirados',   color: 'var(--chart-4)' },
  'en proceso':{ label: 'En proceso',  color: 'var(--chart-3)' },
  suspendidos: { label: 'Suspendidos', color: 'var(--chart-3)' },
} satisfies ChartConfig

/**
 * Convierte un PuntoDato del backend en el formato que espera el PieChart.
 * La clave debe coincidir con la entrada en chartConfig.
 */
function toChartEntry(p: PuntoDato) {
  const key = p.label.toLowerCase()
  return {
    key,
    total: p.value,
    fill: `var(--color-${key}, var(--chart-3))`,
  }
}

interface Props {
  /** Datos del backend. Si es null, usa el mock. */
  data: PuntoDato[] | null
}

export function StudentsStatusChart({ data }: Props) {
  const chartData =
    data !== null
      ? data.map(toChartEntry)
      : studentsByStatus.map((d) => ({
          ...d,
          key: d.estado.toLowerCase(),
          fill: `var(--color-${d.estado.toLowerCase()})`,
        }))

  const total = chartData.reduce((acc, cur) => acc + cur.total, 0)

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Estudiantes por estado</CardTitle>
        <CardDescription>Distribución actual del alumnado</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin datos de estudiantes todavía.
          </p>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto h-[240px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="key"
                  innerRadius={55}
                  outerRadius={90}
                  strokeWidth={4}
                  isAnimationActive={false}
                />
                <ChartLegend
                  content={<ChartLegendContent nameKey="key" />}
                  className="flex-wrap gap-2"
                />
              </PieChart>
            </ChartContainer>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> estudiantes en total
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
