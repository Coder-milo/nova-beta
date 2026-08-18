'use client'

import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Piezas del lenguaje visual de Tabler para las pantallas de reporte.
 *
 * Solo maquetan: el estilo vive en `.tabler` dentro de `globals.css`, donde
 * también se reescriben las variables semánticas. Por eso estos componentes
 * tienen que ir dentro de un contenedor con la clase `tabler` —lo pone
 * `PaginaTabler`— y por eso no llevan colores propios.
 */

/** Raíz de una pantalla de reporte. Abre el ámbito `.tabler`. */
export function PaginaTabler({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('tabler flex flex-col gap-4', className)} {...props}>
      {children}
    </div>
  )
}

/**
 * Cabecera de página de Tabler: antetítulo en versalitas, título, y acciones
 * alineadas a la derecha que bajan debajo cuando no caben.
 */
export function CabeceraTabler({
  pretitulo,
  titulo,
  descripcion,
  acciones,
}: {
  pretitulo?: string
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {pretitulo && <div className="tbl-pretitulo">{pretitulo}</div>}
        <h2 className="tbl-titulo mt-0.5 truncate">{titulo}</h2>
        {descripcion && (
          <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

export function TarjetaTabler({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('tbl-card', className)} {...props}>
      {children}
    </div>
  )
}

export function CabeceraTarjeta({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string
  subtitulo?: string
  acciones?: ReactNode
}) {
  return (
    <div className="tbl-card-header">
      <div className="min-w-0 flex-1">
        <h3 className="tbl-card-titulo truncate">{titulo}</h3>
        {subtitulo && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitulo}</p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-1">{acciones}</div>}
    </div>
  )
}

export function CuerpoTarjeta({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('tbl-card-body', className)} {...props}>
      {children}
    </div>
  )
}

/**
 * Indicador de Tabler: etiqueta en versalitas, cifra grande y una variación
 * opcional al lado. El icono va en un cuadro tenue del color de la serie.
 */
export function IndicadorTabler({
  etiqueta,
  valor,
  icono,
  color = 'var(--tbl-azul)',
  variacion,
}: {
  etiqueta: string
  valor: string | number
  icono?: ReactNode
  color?: string
  variacion?: { valor: number; sufijo?: string }
}) {
  const sube = variacion ? variacion.valor >= 0 : false

  return (
    <div className="tbl-card">
      <div className="flex items-center gap-3 p-3">
        {icono && (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded"
            /* El fondo se deriva del color de la serie, así el bloque sigue a
               la paleta al cambiar de tema sin duplicar cada tono aquí. */
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
          >
            {icono}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="tbl-pretitulo truncate">{etiqueta}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="tbl-numero text-2xl font-semibold leading-none">{valor}</span>
            {variacion && (
              <span
                className="tbl-numero text-xs font-medium"
                style={{ color: sube ? 'var(--tbl-verde)' : 'var(--tbl-rojo)' }}
              >
                {sube ? '↑' : '↓'} {Math.abs(variacion.valor)}
                {variacion.sufijo ?? '%'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Barra de progreso de una celda de tabla. */
export function ProgresoTabler({
  porcentaje,
  color = 'var(--tbl-azul)',
}: {
  porcentaje: number
  color?: string
}) {
  const ancho = Math.min(Math.max(porcentaje, 0), 100)
  return (
    <div
      className="tbl-progress"
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${ancho}%`, backgroundColor: color }} />
    </div>
  )
}

/**
 * Tabla de Tabler con una fila por categoría: nombre, barra proporcional,
 * cifra y porcentaje. Es la lectura que sustituye a las barras sueltas que
 * había antes, porque permite ordenar y comparar con la vista puesta.
 */
export function TablaCategorias({
  columnaCategoria,
  filas,
  colores,
}: {
  columnaCategoria: string
  filas: ReadonlyArray<{ label: string; value: number; pct?: number | null }>
  colores: readonly string[]
}) {
  const maximo = Math.max(...filas.map((f) => f.value), 1)

  return (
    <div className="overflow-x-auto">
      <table className="tbl-table">
        <thead>
          <tr>
            <th>{columnaCategoria}</th>
            <th className="w-1/2">Distribución</th>
            <th className="text-right">Cantidad</th>
            <th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr key={fila.label}>
              <td className="font-medium">{fila.label}</td>
              <td>
                <ProgresoTabler
                  porcentaje={(fila.value / maximo) * 100}
                  color={colores[indice % colores.length]}
                />
              </td>
              <td className="tbl-numero text-right font-semibold">
                {fila.value.toLocaleString('es-CO')}
              </td>
              <td className="tbl-numero text-right text-muted-foreground">
                {fila.pct != null ? `${fila.pct.toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                Sin datos para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
