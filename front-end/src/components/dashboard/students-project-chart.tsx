'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
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
import { SampleDataBadge } from '@/components/dashboard/sample-data-badge'
import { studentsByProject } from '@/lib/mock-data'
import type { PuntoDato } from '@/lib/types'

const chartConfig = {
  total: { label: 'Estudiantes', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface Props {
  /** Datos del backend (estudiantesPorProyecto). Si es null usa el mock. */
  data: PuntoDato[] | null
}

export function StudentsProjectChart({ data }: Props) {
  const chartData =
    data !== null
      ? data.map((p) => ({ proyecto: p.label, total: p.value }))
      : studentsByProject

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Estudiantes por proyecto</CardTitle>
          {data === null && <SampleDataBadge />}
        </div>
        <CardDescription>Inscritos en cada programa</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin datos de proyectos todavía.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="proyecto"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
