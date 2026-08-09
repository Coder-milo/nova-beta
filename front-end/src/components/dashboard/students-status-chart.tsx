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
import { SampleDataBadge } from '@/components/dashboard/sample-data-badge'
import { studentsByStatus } from '@/lib/mock-data'
import type { PuntoDato } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'

/**
 * La clave viene del backend en minusculas y no cambia; solo el rotulo que
 * se lee en la leyenda y en el globo del grafico sigue al idioma.
 */
function configuracion(T: ReturnType<typeof textos>, C: TextosAdmin) {
  return {
    total: { label: C.estudiantes },
    activos:     { label: T.activos,   color: 'var(--chart-2)' },
    graduados:   { label: C.graduado,  color: 'var(--chart-1)' },
    retirados:   { label: C.retirado,  color: 'var(--chart-4)' },
    'en proceso':{ label: C.enProceso, color: 'var(--chart-3)' },
  } satisfies ChartConfig
}

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

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        sinDatosDe: 'No student data yet.',
        distribucionActualDel: 'Current breakdown of the student body',
        estudiantesPorEstado: 'Students by status',
        activos: 'Active',
      }
    : {
        sinDatosDe: 'Sin datos de estudiantes todavía.',
        distribucionActualDel: 'Distribución actual del alumnado',
        estudiantesPorEstado: 'Estudiantes por estado',
        activos: 'Activos',
      }
}

export function StudentsStatusChart({ data }: Props) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{T.estudiantesPorEstado}</CardTitle>
          {data === null && <SampleDataBadge />}
        </div>
        <CardDescription>{T.distribucionActualDel}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {T.sinDatosDe}
          </p>
        ) : (
          <>
            <ChartContainer
              config={configuracion(T, C)}
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
