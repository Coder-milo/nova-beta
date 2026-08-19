'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { PuntoDato } from '@/lib/types'

const COLORES_DEFAULT = [
  '#206BC4',
  '#2FB344',
  '#AE3EC9',
  '#F76707',
  '#17A2B8',
  '#D63939',
]

/**
 * Barras horizontales, una por categoría.
 *
 * Horizontal y no vertical porque las etiquetas son nombres largos —«En proceso
 * de formación», nombres de proyecto— y en vertical hay que girarlas para que
 * quepan, que es justo cuando dejan de leerse.
 */
export function GraficoCategorias({
  datos,
  etiquetaEjeX,
  altura = 260,
  descripcion,
}: {
  datos: readonly PuntoDato[]
  etiquetaEjeX: string
  altura?: number
  descripcion: string
}) {
  const chartData = useMemo(() => {
    return datos.map((punto, indice) => ({
      categoria: punto.label,
      cantidad: punto.value,
      porcentaje: punto.pct ?? null,
      color: COLORES_DEFAULT[indice % COLORES_DEFAULT.length],
    }))
  }, [datos])

  return (
    <div className="w-full" style={{ height: altura }} aria-label={descripcion}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 12, right: 30, left: 20, bottom: 12 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--tbl-borde, rgba(255,255,255,0.08))"
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: 'var(--tbl-borde, rgba(255,255,255,0.12))' }}
            tick={{ fill: 'var(--tbl-texto-tenue, #94a3b8)', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis
            type="category"
            dataKey="categoria"
            tickLine={false}
            axisLine={{ stroke: 'var(--tbl-borde, rgba(255,255,255,0.12))' }}
            tick={{ fill: 'var(--tbl-texto, #e2e8f0)', fontSize: 12, fontWeight: 600 }}
            width={130}
          />
          <Tooltip
            cursor={{ fill: 'var(--tbl-superficie-tenue, rgba(255,255,255,0.05))', radius: 4 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const item = payload[0].payload
              return (
                <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                  <span className="font-semibold text-foreground">{item.categoria}</span>
                  <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{etiquetaEjeX}:</span>
                    <span className="font-bold text-primary">
                      {item.cantidad} {item.porcentaje ? `(${item.porcentaje}%)` : ''}
                    </span>
                  </div>
                </div>
              )
            }}
          />
          <Bar
            dataKey="cantidad"
            maxBarSize={32}
            radius={[0, 6, 6, 0]}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Serie mensual: área tenue con la línea encima.
 *
 * El área da la magnitud de un vistazo y la línea marca el mes a mes; una sola
 * de las dos deja fuera una de las dos lecturas.
 */
export function GraficoSerieMensual({
  datos,
  etiquetaEjeY,
  altura = 260,
  descripcion,
}: {
  datos: readonly PuntoDato[]
  etiquetaEjeY: string
  altura?: number
  descripcion: string
}) {
  const chartData = useMemo(() => {
    return datos.map((punto) => ({
      mes: punto.label,
      cantidad: punto.value,
    }))
  }, [datos])

  const colorPrincipal = '#38BDF8'

  return (
    <div className="w-full" style={{ height: altura }} aria-label={descripcion}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 20, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colorPrincipal} stopOpacity={0.4} />
              <stop offset="95%" stopColor={colorPrincipal} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--tbl-borde, rgba(255,255,255,0.08))"
          />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={{ stroke: 'var(--tbl-borde, rgba(255,255,255,0.12))' }}
            tick={{ fill: 'var(--tbl-texto-tenue, #94a3b8)', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis
            tickLine={false}
            axisLine={{ stroke: 'var(--tbl-borde, rgba(255,255,255,0.12))' }}
            tick={{ fill: 'var(--tbl-texto-tenue, #94a3b8)', fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip
            cursor={{ stroke: colorPrincipal, strokeWidth: 1.5, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const item = payload[0].payload
              return (
                <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                  <span className="font-semibold text-foreground">{item.mes}</span>
                  <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{etiquetaEjeY}:</span>
                    <span className="font-bold text-primary">{item.cantidad}</span>
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="cantidad"
            stroke={colorPrincipal}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorIngresos)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
