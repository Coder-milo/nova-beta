'use client'

/**
 * En qué punto de la búsqueda de empleo está la cohorte.
 *
 * El backend calculaba esta serie desde hacía tiempo y la mandaba en
 * `/dashboard/charts` — nadie la pintaba. Es el mismo «construido sin puerta»
 * que ya salió con el registro de rastreo y con el hilo de contactos: el dato
 * existía y no había por dónde verlo.
 *
 * No es lo mismo que «Estudiantes por estado». Aquella dice si alguien sigue en
 * el programa; esta, si el programa le sirvió para trabajar, que es la razón de
 * ser de todo esto. Cuenta las colocaciones registradas y no solo la casilla de
 * la ficha: a quien se coloca por el CRM nadie se la cambia a mano.
 */

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
import type { PuntoDato } from '@/lib/types'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Employability',
        desc: 'How far along the job search the cohort is.',
        sinDatos: 'No employability data yet.',
        empleado: 'Employed',
        buscando: 'Job hunting',
        sinInfo: 'No information',
        colocados: (n: number, pct: number) => `${n} placed · ${pct}% of the cohort`,
      }
    : {
        titulo: 'Empleabilidad',
        desc: 'En qué punto de la búsqueda está la cohorte.',
        sinDatos: 'Sin datos de empleabilidad todavía.',
        empleado: 'Empleado',
        buscando: 'Buscando',
        sinInfo: 'Sin información',
        colocados: (n: number, pct: number) => `${n} colocados · ${pct}% de la cohorte`,
      }
}

/** La clave viene del backend y no cambia; el rótulo sigue al idioma. */
function configuracion(T: ReturnType<typeof textos>) {
  return {
    total: { label: T.titulo },
    empleado: { label: T.empleado, color: 'var(--chart-2)' },
    buscando: { label: T.buscando, color: 'var(--chart-1)' },
    'sin info': { label: T.sinInfo, color: 'var(--chart-4)' },
  } satisfies ChartConfig
}

export function EmployabilityChart({ data }: { data: PuntoDato[] | null }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const puntos = data ?? []
  const chartData = puntos.map((p) => {
    const key = p.label.toLowerCase()
    return { key, total: p.value, fill: `var(--color-${key}, var(--chart-3))` }
  })
  const total = chartData.reduce((acc, cur) => acc + cur.total, 0)
  const empleados = puntos.find((p) => p.label.toLowerCase() === 'empleado')?.value ?? 0

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>{T.titulo}</CardTitle>
        <CardDescription>{T.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{T.sinDatos}</p>
        ) : (
          <>
            <ChartContainer config={configuracion(T)} className="mx-auto h-[240px] w-full">
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
                <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap gap-2" />
              </PieChart>
            </ChartContainer>
            {/* La cifra de colocados va escrita y no solo en el color: es el
                número por el que se mide el programa, y leerlo de un sector de
                dona obliga a estimar. */}
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {T.colocados(empleados, Math.round((empleados / total) * 100))}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
