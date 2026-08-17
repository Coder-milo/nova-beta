'use client'

import { useEffect, useMemo, useState } from 'react'
import { areaY, barX, defineChart, lineY } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/react'
import type { PuntoDato } from '@/lib/types'

/**
 * Gráficos de las pantallas de reporte, sobre `@tanstack/charts`.
 *
 * El tablero sigue en Recharts a propósito. `@tanstack/charts` está en 0.x y su
 * propio README avisa de que no es para producción: acotarlo a reportes deja
 * la pantalla más vista del panel fuera del alcance de un cambio de API.
 *
 * La gramática es declarativa —marcas, canales y escalas— así que cada gráfico
 * es una definición de datos, no un árbol de componentes.
 */

/**
 * Colores del gráfico, leídos del tema en vez de escritos aquí.
 *
 * Las variables de `.tabler` cambian de valor entre claro y oscuro, y el tema
 * puede cambiar sin recargar (el conmutador escribe la clase `dark` sobre
 * <html>). `getComputedStyle` resuelve el valor vigente, y el observador
 * vuelve a leerlo cuando esa clase se mueve.
 */
const VARIABLES_DE_SERIE = [
  '--tbl-azul',
  '--tbl-verde',
  '--tbl-morado',
  '--tbl-naranja',
  '--tbl-cian',
  '--tbl-rojo',
] as const

type TemaGrafico = {
  foreground: string
  muted: string
  grid: string
  background: string
  palette: string[]
}

const TEMA_INICIAL: TemaGrafico = {
  foreground: '#182433',
  muted: '#667382',
  grid: 'rgba(4, 32, 69, 0.12)',
  background: 'transparent',
  palette: ['#206BC4', '#2FB344', '#AE3EC9', '#F76707', '#17A2B8', '#D63939'],
}

export function useTemaGrafico(elemento: HTMLElement | null): TemaGrafico {
  const [tema, setTema] = useState<TemaGrafico>(TEMA_INICIAL)

  useEffect(() => {
    if (!elemento) return

    const leer = () => {
      const estilos = getComputedStyle(elemento)
      const valor = (nombre: string, respaldo: string) =>
        estilos.getPropertyValue(nombre).trim() || respaldo

      setTema({
        foreground: valor('--tbl-texto', TEMA_INICIAL.foreground),
        muted: valor('--tbl-texto-tenue', TEMA_INICIAL.muted),
        grid: valor('--tbl-borde', TEMA_INICIAL.grid),
        // El lienzo se deja transparente para que se vea la tarjeta detrás:
        // pintarlo repetiría el fondo y delataría el rectángulo del gráfico.
        background: 'transparent',
        palette: VARIABLES_DE_SERIE.map((nombre, indice) =>
          valor(nombre, TEMA_INICIAL.palette[indice]),
        ),
      })
    }

    leer()

    // El conmutador de tema alterna las clases `dark`/`light` sobre <html>, y
    // el de proyecto reescribe el tono de marca en el atributo `style`.
    const observador = new MutationObserver(leer)
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    return () => observador.disconnect()
  }, [elemento])

  return tema
}

/**
 * Envoltorio que ata un gráfico al tema.
 *
 * El `div` existe para tener de dónde leer las variables: `getComputedStyle`
 * necesita un nodo dentro del ámbito `.tabler`, no vale el documento.
 */
function LienzoGrafico({
  children,
}: {
  children: (tema: TemaGrafico) => React.ReactNode
}) {
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null)
  const tema = useTemaGrafico(nodo)

  return (
    <div ref={setNodo} className="w-full">
      {nodo && children(tema)}
    </div>
  )
}

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
  return (
    <LienzoGrafico>
      {(tema) => (
        <GraficoCategoriasInterno
          datos={datos}
          etiquetaEjeX={etiquetaEjeX}
          altura={altura}
          descripcion={descripcion}
          tema={tema}
        />
      )}
    </LienzoGrafico>
  )
}

function GraficoCategoriasInterno({
  datos,
  etiquetaEjeX,
  altura,
  descripcion,
  tema,
}: {
  datos: readonly PuntoDato[]
  etiquetaEjeX: string
  altura: number
  descripcion: string
  tema: TemaGrafico
}) {
  const definicion = useMemo(() => {
    // Cada barra lleva su propio color de la paleta; sin `color` todas saldrían
    // del primer tono y la tabla de al lado, que sí colorea por fila, no
    // coincidiría con el gráfico.
    const filas = datos.map((punto, indice) => ({
      categoria: punto.label,
      cantidad: punto.value,
      porcentaje: punto.pct ?? null,
      tono: tema.palette[indice % tema.palette.length],
    }))

    return defineChart({
      marks: [
        barX(filas, {
          x: 'cantidad',
          y: 'categoria',
          fill: (fila) => fila.tono,
          radius: 2,
        }),
      ],
      x: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: { label: etiquetaEjeX },
      },
      y: { scale: () => scaleBand<string>().padding(0.28) },
      theme: tema,
      tooltip,
    })
  }, [datos, etiquetaEjeX, tema])

  return (
    <Chart
      definition={definicion}
      height={altura}
      ariaLabel={descripcion}
      className="w-full"
    />
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
  return (
    <LienzoGrafico>
      {(tema) => (
        <GraficoSerieMensualInterno
          datos={datos}
          etiquetaEjeY={etiquetaEjeY}
          altura={altura}
          descripcion={descripcion}
          tema={tema}
        />
      )}
    </LienzoGrafico>
  )
}

function GraficoSerieMensualInterno({
  datos,
  etiquetaEjeY,
  altura,
  descripcion,
  tema,
}: {
  datos: readonly PuntoDato[]
  etiquetaEjeY: string
  altura: number
  descripcion: string
  tema: TemaGrafico
}) {
  const definicion = useMemo(() => {
    const filas = datos.map((punto) => ({ mes: punto.label, cantidad: punto.value }))
    const azul = tema.palette[0]

    return defineChart({
      marks: [
        areaY(filas, {
          x: 'mes',
          y: 'cantidad',
          fill: azul,
          fillOpacity: 0.14,
        }),
        lineY(filas, {
          x: 'mes',
          y: 'cantidad',
          stroke: azul,
          strokeWidth: 2,
        }),
      ],
      x: { scale: () => scalePoint<string>().padding(0.5) },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: { label: etiquetaEjeY },
      },
      theme: tema,
      tooltip,
    })
  }, [datos, etiquetaEjeY, tema])

  return (
    <Chart
      definition={definicion}
      height={altura}
      ariaLabel={descripcion}
      className="w-full"
    />
  )
}
