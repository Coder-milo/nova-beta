'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { enrollmentTrend } from '@/lib/mock-data'
import type { PuntoDato } from '@/lib/types'

const chartConfig = {
  ingresos: { label: 'Ingresos', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface Props {
  /** Datos del backend (historicoIngresos). Si es null usa el mock. */
  data: PuntoDato[] | null
}

export function EnrollmentChart({ data }: Props) {
  // El backend devuelve { label: "Ene", value: 24 } — mapeamos a { mes, ingresos }
  const chartData =
    data !== null
      ? data.map((p) => ({ mes: p.label, ingresos: p.value }))
      : enrollmentTrend

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Ingreso de estudiantes</CardTitle>
        <CardDescription>Nuevos matriculados por mes · año actual</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin registros de ingreso este año.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-ingresos)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-ingresos)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Area
                dataKey="ingresos"
                type="monotone"
                stroke="var(--color-ingresos)"
                strokeWidth={2}
                fill="url(#fillIngresos)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
