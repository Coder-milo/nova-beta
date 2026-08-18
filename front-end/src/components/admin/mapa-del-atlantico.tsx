'use client'

/**
 * Dónde vive la gente del programa, sobre el mapa del Atlántico.
 *
 * De los 108 activos, 104 están en el área metropolitana de Barranquilla.
 * Repartido en una tabla eso no dice nada; sobre el mapa se ve de un golpe, y
 * es lo que decide dónde se hace una jornada presencial o con qué empresa
 * conviene hablar primero.
 *
 * Decisiones que se ven aquí:
 *
 * - **Los 23 municipios se pintan siempre**, también los que están a cero. Uno
 *   que desaparece cuando no tiene a nadie deja un hueco blanco que se lee como
 *   un fallo de dibujo, no como un cero.
 * - **La escala es por tramos y no continua.** Con 73 en Barranquilla y 1 en
 *   Galapa, un degradado lineal pinta todo lo que no es Barranquilla del mismo
 *   color pálido, y el mapa deja de distinguir entre 26 y 1.
 * - **Lo que no se ubica se enseña, no se reparte.** La ciudad es texto libre y
 *   hay fichas con «Otro» o vacías. Colarlas en el municipio más parecido daría
 *   un mapa más bonito y mentiroso.
 * - **El color no va solo.** Cada municipio con gente lleva su número encima:
 *   un mapa que solo colorea obliga a ir y volver a la leyenda para leer una
 *   cifra que cabe en el propio dibujo.
 */

import { useEffect, useMemo, useState } from 'react'
import { MapPin, TriangleAlert, Users } from 'lucide-react'
import Link from '@/compat/next-link'
import { dashboardApi, programasApi, type MapaDelAtlantico as Datos } from '@/lib/api'
import type { ProgramaResponse } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MAPA_ATLANTICO_ALTO,
  MAPA_ATLANTICO_ANCHO,
  MUNICIPIOS_DEL_ATLANTICO,
} from '@/lib/mapa-atlantico'
import { usePreferences } from '@/lib/preferences'

/**
 * Tramos de color, de menos a más.
 *
 * El corte en 1 existe porque «cero» y «una persona» son estados distintos: un
 * municipio con alguien dentro nunca puede verse igual que uno vacío, por poca
 * gente que tenga.
 */
const TRAMOS = [
  { desde: 0, clase: 'fill-muted', texto: 'text-muted-foreground' },
  { desde: 1, clase: 'fill-sky-200 dark:fill-sky-900', texto: 'text-sky-950 dark:text-sky-100' },
  { desde: 5, clase: 'fill-sky-300 dark:fill-sky-800', texto: 'text-sky-950 dark:text-sky-50' },
  { desde: 15, clase: 'fill-sky-500 dark:fill-sky-600', texto: 'text-white' },
  { desde: 40, clase: 'fill-sky-700 dark:fill-sky-400', texto: 'text-white dark:text-sky-950' },
] as const

type Tramo = (typeof TRAMOS)[number]

function tramoDe(n: number): Tramo {
  let elegido: Tramo = TRAMOS[0]
  for (const t of TRAMOS) if (n >= t.desde) elegido = t
  return elegido
}

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Where the participants live',
        desc: 'Active participants by municipality of Atlántico.',
        todos: 'All projects',
        proyecto: 'Project',
        participantes: 'participants',
        participante: 'participant',
        sinUbicar: 'Outside the map',
        sinUbicarPor: 'not a municipality of Atlántico',
        porQueFuera: 'They either live outside the department —the map only covers Atlántico— or the city is written in a way the record does not recognise. The text is shown exactly as it is on file so you can tell which.',
        sinDato: 'no city on record',
        deTotal: (n: number) => `of ${n} active`,
        vacio: 'No active participants in this project.',
        cargando: 'Loading the map…',
        leyenda: 'participants per municipality',
        nadie: 'nobody',
        corrige: 'These are fixed in the student record, not here.',
        verGente: (n: number, m: string) => `See the ${n} in ${m}`,
        pulsaParaVer: 'Click a municipality to see who is there.',
        enElMapa: 'on the map',
        concentracion: (pct: number, m: string) => `${pct}% in ${m}`,
      }
    : {
        titulo: 'Dónde vive la gente del programa',
        desc: 'Participantes activos por municipio del Atlántico.',
        todos: 'Todos los proyectos',
        proyecto: 'Proyecto',
        participantes: 'participantes',
        participante: 'participante',
        sinUbicar: 'Fuera del mapa',
        sinUbicarPor: 'no es un municipio del Atlántico',
        porQueFuera: 'O viven fuera del departamento —el mapa solo cubre el Atlántico— o la ciudad está escrita de una forma que la ficha no reconoce. El texto va tal cual está guardado para que se distinga cuál de las dos.',
        sinDato: 'sin ciudad en la ficha',
        deTotal: (n: number) => `de ${n} activos`,
        vacio: 'Este proyecto no tiene participantes activos.',
        cargando: 'Cargando el mapa…',
        leyenda: 'participantes por municipio',
        nadie: 'nadie',
        corrige: 'Esto se arregla en la ficha del estudiante, no aquí.',
        verGente: (n: number, m: string) => `Ver los ${n} de ${m}`,
        pulsaParaVer: 'Pulsa un municipio para ver quiénes están ahí.',
        enElMapa: 'en el mapa',
        concentracion: (pct: number, m: string) => `${pct}% en ${m}`,
      }
}

export function MapaDelAtlantico() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState('')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [resaltado, setResaltado] = useState<string | null>(null)

  useEffect(() => {
    void programasApi.listar().then(setProgramas).catch(() => setProgramas([]))
  }, [])

  useEffect(() => {
    setCargando(true)
    void dashboardApi
      .mapaAtlantico(programaId || undefined)
      .then(setDatos)
      .catch(() => setDatos(null))
      .finally(() => setCargando(false))
  }, [programaId])

  const porCodigo = useMemo(() => {
    const m = new Map<string, { nombre: string; estudiantes: number }>()
    datos?.municipios.forEach((x) => m.set(x.codigo, x))
    return m
  }, [datos])

  const conGente = useMemo(
    () => (datos?.municipios ?? [])
      .filter((m) => m.estudiantes > 0)
      .sort((a, b) => b.estudiantes - a.estudiantes),
    [datos],
  )

  const detalle = resaltado ? porCodigo.get(resaltado) : null
  const enMunicipios = conGente.reduce((s, m) => s + m.estudiantes, 0)
  const mayor = conGente[0]

  /**
   * A dónde lleva pulsar un municipio.
   *
   * A la lista de estudiantes con el nombre del municipio ya escrito en la
   * búsqueda. Ver «Soledad 26» y no poder llegar a esas 26 personas es el mismo
   * «construido sin puerta» que ya apareció cuatro veces en este proyecto: el
   * dato existía y no había por dónde alcanzarlo.
   */
  const enlaceA = (nombre: string) => `/estudiantes?ciudad=${encodeURIComponent(nombre)}`

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" strokeWidth={2} />
              {T.titulo}
            </CardTitle>
            <CardDescription>{T.desc}</CardDescription>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="mapa-programa" className="text-xs font-medium text-muted-foreground">
              {T.proyecto}
            </label>
            <select
              id="mapa-programa"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={programaId}
              onChange={(e) => setProgramaId(e.target.value)}
            >
              <option value="">{T.todos}</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {cargando && !datos ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{T.cargando}</p>
        ) : !datos || datos.total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{T.vacio}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col gap-3">
              <svg
                viewBox={`0 0 ${MAPA_ATLANTICO_ANCHO} ${MAPA_ATLANTICO_ALTO}`}
                className="mx-auto h-auto w-full max-w-[320px]"
                role="img"
                aria-label={T.desc}
              >
                {MUNICIPIOS_DEL_ATLANTICO.map((m) => {
                  const n = porCodigo.get(m.codigo)?.estudiantes ?? 0
                  const tramo = tramoDe(n)
                  const activo = resaltado === m.codigo
                  const etiqueta = `${m.nombre}: ${n} ${n === 1 ? T.participante : T.participantes}`
                  const forma = (
                    <path
                      d={m.d}
                      className={`${tramo.clase} transition-[stroke-width] ${n > 0 ? 'cursor-pointer' : ''}`}
                      /* El contorno se dibuja con un color propio y no con el
                         del fondo. Con el fondo, dos municipios vacíos —los dos
                         del mismo gris— quedaban pegados sin línea entre ellos:
                         la mitad sur del departamento se veía como una sola
                         mancha en vez de como catorce municipios.

                         El realce del ratón y del teclado es ese mismo contorno,
                         más oscuro y más grueso. Un `outline` del navegador
                         sobre una forma irregular dibuja un rectángulo alrededor
                         y parece un fallo de pintado; quitarlo sin poner nada
                         dejaría el mapa sin indicar dónde está el foco. */
                      /* `--color-border` es un gris al 14 % pensado para
                         separar tarjetas sobre blanco; sobre el relleno gris de
                         un municipio vacío no se veía y el sur del departamento
                         quedaba como una mancha. El contorno usa el gris del
                         texto secundario a media opacidad, que sí contrasta con
                         los dos extremos de la escala y con los dos temas. */
                      stroke={activo ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}
                      strokeOpacity={activo ? 1 : 0.5}
                      /* `non-scaling-stroke` mide el grosor en píxeles de
                         pantalla y no en unidades del lienzo. Sin él, el mismo
                         valor da una línea gruesa en el panel y una telaraña en
                         una pantalla grande, porque el dibujo mide 1.000
                         unidades y se pinta en unos 300 píxeles. */
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={activo ? 2.5 : 0.9}
                      strokeLinejoin="round"
                    >
                      {/* Título nativo: el mapa tiene que poder leerse también
                          con el dedo en una tableta, donde no hay hover. */}
                      <title>{etiqueta}</title>
                    </path>
                  )
                  // Los que están a cero se pintan pero no se pulsan: un enlace
                  // que lleva a una lista vacía enseña un callejón sin salida.
                  if (n === 0) return <g key={m.codigo}>{forma}</g>
                  return (
                    <Link
                      key={m.codigo}
                      href={enlaceA(m.nombre)}
                      aria-label={etiqueta}
                      onMouseEnter={() => setResaltado(m.codigo)}
                      onMouseLeave={() => setResaltado(null)}
                      onFocus={() => setResaltado(m.codigo)}
                      onBlur={() => setResaltado(null)}
                      className="focus-visible:outline-none"
                    >
                      {forma}
                    </Link>
                  )
                })}

                {/* El número encima del municipio, solo donde hay gente.
                    Ponerlo en los 23 llena el mapa de ceros y tapa el dibujo. */}
                {MUNICIPIOS_DEL_ATLANTICO.map((m) => {
                  const n = porCodigo.get(m.codigo)?.estudiantes ?? 0
                  if (n === 0) return null
                  return (
                    <text
                      key={`n-${m.codigo}`}
                      x={m.cx}
                      y={m.cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={`pointer-events-none text-[34px] font-semibold ${tramoDe(n).texto}`}
                      fill="currentColor"
                    >
                      {n}
                    </text>
                  )
                })}
              </svg>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                {TRAMOS.map((t, i) => (
                  <span key={t.desde} className="flex items-center gap-1">
                    <svg width="12" height="12" aria-hidden="true">
                      <rect width="12" height="12" rx="2" className={t.clase} />
                    </svg>
                    {t.desde === 0
                      ? T.nadie
                      : i === TRAMOS.length - 1
                        ? `${t.desde}+`
                        : `${t.desde}–${TRAMOS[i + 1].desde - 1}`}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {conGente.map((m) => (
                      <tr
                        key={m.codigo}
                        className={`border-b border-border last:border-0 ${
                          resaltado === m.codigo ? 'bg-secondary/70' : ''
                        }`}
                        onMouseEnter={() => setResaltado(m.codigo)}
                        onMouseLeave={() => setResaltado(null)}
                      >
                        <td className="px-3 py-1.5">
                          <Link
                            href={enlaceA(m.nombre)}
                            className="inline-flex items-center gap-1.5 hover:underline"
                            title={T.verGente(m.estudiantes, m.nombre)}
                          >
                            <Users className="size-3.5 text-muted-foreground" strokeWidth={2} />
                            {m.nombre}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {m.estudiantes}
                        </td>
                        <td className="w-1/2 px-3 py-1.5">
                          <span
                            className="block h-1.5 rounded-full bg-sky-500"
                            style={{
                              width: `${Math.round(
                                (m.estudiantes / (conGente[0]?.estudiantes || 1)) * 100,
                              )}%`,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                {enMunicipios} {T.enElMapa} {T.deTotal(datos.total)}
                {mayor && (
                  <span>
                    {' · '}
                    {T.concentracion(
                      Math.round((mayor.estudiantes / datos.total) * 100), mayor.nombre)}
                  </span>
                )}
                {detalle && detalle.estudiantes > 0 && (
                  <span className="ml-1 font-medium text-foreground">
                    · {detalle.nombre}: {detalle.estudiantes}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{T.pulsaParaVer}</p>

              {/* Lo que no se pudo ubicar. Va a la vista y con el texto tal
                  cual está escrito: es lo único que dice qué hay que corregir
                  en las fichas, y sumado al mapa hace que los totales cuadren. */}
              {(datos.sinUbicar.length > 0 || datos.sinDato > 0) && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
                  <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <TriangleAlert className="size-3.5" strokeWidth={2} />
                    {T.sinUbicar}
                  </p>
                  <ul className="text-muted-foreground">
                    {datos.sinUbicar.map((s) => (
                      <li key={s.ciudad}>
                        <span className="font-medium text-foreground">«{s.ciudad}»</span>
                        {' · '}{s.estudiantes} — {T.sinUbicarPor}
                      </li>
                    ))}
                    {datos.sinDato > 0 && (
                      <li>
                        <span className="font-medium text-foreground">{datos.sinDato}</span>
                        {' '}{T.sinDato}
                      </li>
                    )}
                  </ul>
                  {/* Dos casos distintos con el mismo síntoma: quien vive en
                      Cartagena no tiene nada que corregir, y quien tiene «Otro»
                      en la ficha sí. Por eso se enseña el texto crudo en vez de
                      dar por hecho que todo lo que no encaja es un error. */}
                  <p className="mt-1 text-muted-foreground">{T.porQueFuera}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
