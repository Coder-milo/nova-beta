'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, TriangleAlert } from 'lucide-react'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { useConfirmar } from '@/components/ui/confirmar'
import { postulacionesApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { PostulacionResponse } from '@/lib/types'

/**
 * Las columnas del tablero.
 *
 * <p>Solo los estados vivos. Contratado, rechazado y sin respuesta son finales:
 * una columna para ellos sería un cementerio que crece sin parar y empuja fuera
 * de la pantalla lo que sí hay que mover. Lo cerrado se consulta en la línea de
 * tiempo del estudiante.
 */
const COLUMNAS = [
  { estado: 'ENVIADA',              es: 'Enviada',              en: 'Sent',        tono: 'var(--mod-pizarra)' },
  { estado: 'EN_PROCESO',           es: 'En proceso',           en: 'In progress', tono: 'var(--mod-azul)' },
  { estado: 'ENTREVISTA_AGENDADA',  es: 'Entrevista agendada',  en: 'Interview set', tono: 'var(--mod-naranja)' },
  { estado: 'ENTREVISTA_REALIZADA', es: 'Entrevista realizada', en: 'Interviewed', tono: 'var(--mod-verde)' },
] as const

type EstadoTablero = (typeof COLUMNAS)[number]['estado']

/**
 * A partir de cuántos días sin respuesta una postulación pide atención.
 *
 * <p>Dos semanas es lo que tarda una empresa normal en contestar. Lo que pasa
 * de ahí no está «en curso», está esperando a que alguien insista o lo cierre.
 */
const DIAS_PARA_ALERTAR = 14

/**
 * Tablero de postulaciones, una tarjeta por proceso.
 *
 * <p>Es el segundo eje de Seguimiento y por eso vive dentro de esa pantalla, no
 * en una propia. El tablero por persona responde «cómo va esta persona»; este,
 * «cómo va este proceso». La misma persona puede tener una entrevista agendada
 * en una empresa, un rechazo en otra y tres postulaciones calladas: con un solo
 * estado por estudiante habría que elegir uno y perder los demás.
 *
 * <p>Fueron dos pantallas y eso era el error: quien entraba a «Seguimiento» no
 * tenía forma de saber que la mitad de la información estaba en otro sitio del
 * menú. Un eje distinto de los mismos datos es una vista, no un módulo.
 *
 * @param onResumen se le pasan los contadores para que la cabecera de
 *                  Seguimiento los pinte donde ya pinta los suyos, en vez de
 *                  levantar una segunda cabecera dentro de la pantalla
 */
export function TableroDePostulaciones(
  { onResumen }: { onResumen?: (abiertas: number, esperando: number) => void },
) {
  const { locale } = usePreferences()
  const en = locale === 'en'
  const { confirmar, dialogo } = useConfirmar()

  const [postulaciones, setPostulaciones] = useState<PostulacionResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setPostulaciones(await postulacionesApi.tablero())
      setError(null)
    } catch (e) {
      setPostulaciones([])
      setError(errorDe(e, en ? 'Could not load the board.' : 'No se pudo cargar el tablero.'))
    }
  }, [en])

  useEffect(() => { void cargar() }, [cargar])

  // Los contadores suben a la cabecera de Seguimiento en vez de dibujar otra
  // aquí dentro: dos cabeceras apiladas en la misma pantalla es lo que hace que
  // no se sepa cuál manda.
  useEffect(() => {
    if (!postulaciones || !onResumen) return
    onResumen(
      postulaciones.length,
      postulaciones.filter((p) => (p.diasEsperando ?? 0) >= DIAS_PARA_ALERTAR).length,
    )
  }, [postulaciones, onResumen])

  const porColumna = useMemo(() => {
    const mapa = new Map<string, PostulacionResponse[]>()
    for (const p of postulaciones ?? []) {
      const lista = mapa.get(p.estado) ?? []
      lista.push(p)
      mapa.set(p.estado, lista)
    }
    return mapa
  }, [postulaciones])

  const mover = async (id: string, estado: EstadoTablero) => {
    const p = postulaciones?.find((x) => x.id === id)
    if (!p || p.estado === estado) return

    // Mover a «entrevista agendada» sin fecha deja al estudiante sabiendo que
    // hay cita pero no cuándo. Se avisa antes de hacerlo, no después.
    if (estado === 'ENTREVISTA_AGENDADA' && !p.fechaHoraEntrevista) {
      const sigue = await confirmar({
        titulo: en ? 'Move without a date?' : '¿Mover sin fecha?',
        descripcion: en
          ? 'This application has no interview date yet. You can set it from the agenda afterwards.'
          : 'Esta postulación todavía no tiene fecha de entrevista. Puedes ponerla después desde la agenda.',
        textoConfirmar: en ? 'Move anyway' : 'Mover igualmente',
        destructivo: false,
      })
      if (!sigue) return
    }

    setMoviendo(id)
    // Se pinta el cambio antes de que responda el servidor: arrastrar y ver la
    // tarjeta volver a su sitio medio segundo se siente como un fallo aunque
    // acabe funcionando.
    const antes = postulaciones ?? []
    setPostulaciones(antes.map((x) => (x.id === id ? { ...x, estado } : x)))
    try {
      await postulacionesApi.actualizar(id, { estado })
      await cargar()
    } catch (e) {
      setPostulaciones(antes)
      setError(errorDe(e, en ? 'Could not move it.' : 'No se pudo mover.'))
    } finally {
      setMoviendo(null)
    }
  }

  const diasEsperando = (p: PostulacionResponse) => p.diasEsperando ?? 0

  if (postulaciones === null) {
    return <PageSpinner label={en ? 'Loading board…' : 'Cargando tablero…'} />
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {COLUMNAS.map(({ estado, es, en: rotuloEn, tono }) => {
          const tarjetas = porColumna.get(estado) ?? []
          const encima = sobre === estado
          return (
            <div
              key={estado}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDragEnter={() => setSobre(estado)}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(null)
                const id = arrastrando ?? e.dataTransfer.getData('text/plain')
                if (id) void mover(id, estado)
                setArrastrando(null)
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col gap-2 rounded-(--radius) border p-2 transition-colors',
                encima
                  ? 'border-primary/50 bg-primary/[0.04]'
                  : 'border-[var(--panel-borde)] bg-[var(--panel-superficie-tenue)]',
              )}
            >
              <header className="flex items-center gap-2 px-1 py-0.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: tono }} />
                <span className="text-[13px] font-semibold text-foreground">
                  {en ? rotuloEn : es}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {tarjetas.length}
                </span>
              </header>

              {tarjetas.length === 0 ? (
                <p className="rounded-(--radius) border border-dashed border-[var(--panel-borde)] px-3 py-8 text-center text-xs text-muted-foreground">
                  {en ? 'Nothing here' : 'Nada aquí'}
                </p>
              ) : tarjetas.map((p) => {
                const espera = diasEsperando(p)
                const alerta = espera >= DIAS_PARA_ALERTAR
                const enVuelo = moviendo === p.id || arrastrando === p.id
                return (
                  <article
                    key={p.id}
                    draggable={moviendo === null}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', p.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setArrastrando(p.id)
                    }}
                    onDragEnd={() => setArrastrando(null)}
                    className={cn(
                      'flex cursor-grab flex-col gap-1 rounded-(--radius) border bg-[var(--panel-superficie)] p-2.5 transition-opacity',
                      alerta ? 'border-[color-mix(in_srgb,var(--panel-negativo)_35%,transparent)]' : 'border-[var(--panel-borde)]',
                      enVuelo && 'opacity-40',
                    )}
                  >
                    <Link
                      href={`/estudiantes/${p.estudianteId}`}
                      className="truncate text-[13px] font-semibold text-foreground hover:text-primary"
                    >
                      {p.estudianteNombre}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.empresaNombre} · {p.cargo}
                    </span>

                    {p.fechaHoraEntrevista && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <CalendarDays className="size-3 shrink-0" />
                        {new Date(p.fechaHoraEntrevista).toLocaleString(en ? 'en-GB' : 'es-CO',
                          { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}

                    {/* El silencio es el dato que se pierde. Una postulación
                        contestada se mueve sola; la que nadie contesta se queda
                        en su columna sin que nada la señale. */}
                    {alerta && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--panel-negativo)]">
                        <TriangleAlert className="size-3 shrink-0" />
                        {en ? `${espera} days with no reply` : `${espera} días sin respuesta`}
                      </span>
                    )}
                  </article>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Se dice qué falta del tablero, en vez de dejar pensar que se perdieron. */}
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        {en
          ? 'Closed applications — hired, rejected, no reply — are not shown here. A board is a work queue; you can find them in each student’s history.'
          : 'Las postulaciones cerradas —contratado, rechazado, sin respuesta— no salen aquí. Un tablero es una cola de trabajo; las encuentras en la historia de cada estudiante.'}
      </p>

      {dialogo}
    </div>
  )
}
