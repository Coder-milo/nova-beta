'use client'

/**
 * Un hilo de conversación: turnos, citas, adjuntos y reacciones.
 *
 * Lo usan la bandeja del equipo y el portal del estudiante con el mismo
 * código. De qué lado se pinta cada turno lo decide el servidor
 * (`autorEsEstudiante`) y no quien mira, así que el equipo ve las
 * intervenciones del estudiante a la izquierda y el estudiante las suyas a la
 * derecha con la misma respuesta: `soyEstudiante` es lo único que invierte el
 * lado.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowBendUpLeftIcon as ArrowBendUpLeft,
  CircleNotchIcon as CircleNotch,
  DownloadSimpleIcon as DownloadSimple,
  PaperclipIcon as Paperclip,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  SmileyIcon as Smiley,
  XIcon as X,
} from '@phosphor-icons/react'
import { EMOJIS_REACCION, mensajesApi, mensajeDeError } from '@/lib/api'
import type { MensajeTurnoResponse, ReaccionResumen } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

/** Hasta cuántos archivos acepta el servidor por intervención. */
const MAX_ARCHIVOS = 5

function esImagen(contentType: string) {
  return contentType.startsWith('image/')
}

function pesoLegible(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hora(valor: string, locale: 'es' | 'en') {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(fecha)
}

type Props = {
  mensajeId: string
  /** Invierte el lado: quien mira ve lo suyo a la derecha. */
  soyEstudiante: boolean
  locale: 'es' | 'en'
  textos: {
    escribir: string
    enviar: string
    adjuntar: string
    responder: string
    reaccionar: string
    cancelar: string
    vacio: string
    cargando: string
    respondiendoA: string
    maxArchivos: string
    errorCargar: string
    errorEnviar: string
    errorReaccionar: string
  }
  /** Para que la lista de fuera pueda refrescar su resumen al escribir. */
  onTurnoNuevo?: () => void
}

export function Conversacion({ mensajeId, soyEstudiante, locale, textos, onTurnoNuevo }: Props) {
  const [turnos, setTurnos] = useState<MensajeTurnoResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [citado, setCitado] = useState<MensajeTurnoResponse | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [paletaEn, setPaletaEn] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      setTurnos(await mensajesApi.turnos(mensajeId))
    } catch (e) {
      setError(mensajeDeError(e, textos.errorCargar))
    } finally { setCargando(false) }
  }, [mensajeId])

  useEffect(() => { void cargar() }, [cargar])

  // Al fondo cuando entra un turno: lo último dicho es lo que interesa.
  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [turnos.length])

  const enviar = async () => {
    const texto = borrador.trim()
    if ((!texto && archivos.length === 0) || enviando) return
    setEnviando(true); setError(null)
    try {
      const turno = await mensajesApi.escribirEnHilo(mensajeId, {
        contenido: texto,
        enRespuestaA: citado?.id,
        archivos: archivos.length ? archivos : undefined,
      })
      setTurnos((actuales) => [...actuales, turno])
      setBorrador(''); setArchivos([]); setCitado(null)
      if (archivoRef.current) archivoRef.current.value = ''
      onTurnoNuevo?.()
    } catch (e) {
      setError(mensajeDeError(e, textos.errorEnviar))
    } finally { setEnviando(false) }
  }

  /**
   * Repinta sólo el turno tocado con lo que devuelve el servidor.
   *
   * No se recarga el hilo: hacerlo perdería el desplazamiento y el borrador a
   * medio escribir por pulsar un emoji.
   */
  const reaccionar = async (turnoId: string, emoji: string) => {
    setPaletaEn(null)
    try {
      const reacciones: ReaccionResumen[] = await mensajesApi.alternarReaccion(turnoId, emoji)
      setTurnos((actuales) => actuales.map((t) => (t.id === turnoId ? { ...t, reacciones } : t)))
    } catch (e) {
      setError(mensajeDeError(e, textos.errorReaccionar))
    }
  }

  const elegirArchivos = (lista: FileList | null) => {
    if (!lista) return
    setArchivos(Array.from(lista).slice(0, MAX_ARCHIVOS))
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
        {cargando && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleNotch className="size-3.5 animate-spin" />{textos.cargando}
          </p>
        )}
        {!cargando && turnos.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">{textos.vacio}</p>
        )}

        {turnos.map((turno) => {
          // El lado depende de quién mira, no de quién escribió.
          const mio = turno.autorEsEstudiante === soyEstudiante
          return (
            <div key={turno.id} className={cn('group flex flex-col', mio ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm',
                  mio
                    ? 'rounded-tr-md bg-primary text-primary-foreground'
                    : 'rounded-tl-md border border-border bg-card text-foreground',
                )}
              >
                {!mio && (
                  <p className="mb-0.5 text-[11px] font-semibold opacity-70">{turno.autorNombre}</p>
                )}

                {/* La cita: se muestra el extracto que envía el servidor, para
                    no tener que buscar el turno original en la lista. */}
                {turno.enRespuestaAExtracto && (
                  <div className={cn(
                    'mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px] leading-4',
                    mio ? 'border-primary-foreground/50 bg-black/10' : 'border-primary/40 bg-primary/5',
                  )}>
                    {turno.enRespuestaAExtracto}
                  </div>
                )}

                {turno.contenido && <p className="whitespace-pre-wrap">{turno.contenido}</p>}

                {turno.adjuntos.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {turno.adjuntos.map((adjunto) => esImagen(adjunto.contentType) ? (
                      // Las capturas se ven; no obligan a descargar para mirarlas.
                      <a key={adjunto.id} href={adjunto.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={adjunto.url}
                          alt={adjunto.nombre}
                          className="max-h-56 w-auto rounded-lg border border-border/40 object-contain"
                        />
                      </a>
                    ) : (
                      <a
                        key={adjunto.id}
                        href={adjunto.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition',
                          mio ? 'bg-black/10 hover:bg-black/20' : 'bg-secondary hover:bg-secondary/70',
                        )}
                      >
                        <DownloadSimple className="size-3.5 shrink-0" />
                        <span className="truncate">{adjunto.nombre}</span>
                        <span className="shrink-0 opacity-70">{pesoLegible(adjunto.tamano)}</span>
                      </a>
                    ))}
                  </div>
                )}

                <p className={cn('mt-1 text-[10px]', mio ? 'opacity-70' : 'text-muted-foreground')}>
                  {hora(turno.createdAt, locale)}
                </p>
              </div>

              {/* Acciones. Aparecen al pasar por encima para no llenar el hilo,
                  pero siguen siendo alcanzables con el teclado.

                  En un turno histórico no se pintan: se reconstruyó de un
                  mensaje antiguo y no hay ninguna fila a la que apuntar, así
                  que responder o reaccionar daría error cada vez. Mejor no
                  ofrecerlo que ofrecerlo roto. */}
              {!turno.historico && (
              <div className="mt-1 flex items-center gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setCitado(turno)}
                  title={textos.responder}
                  aria-label={textos.responder}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <ArrowBendUpLeft className="size-3.5" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPaletaEn(paletaEn === turno.id ? null : turno.id)}
                    title={textos.reaccionar}
                    aria-label={textos.reaccionar}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Smiley className="size-3.5" />
                  </button>
                  {paletaEn === turno.id && (
                    <div className={cn('absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-lg', mio ? 'right-0' : 'left-0')}>
                      {EMOJIS_REACCION.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void reaccionar(turno.id, emoji)}
                          className="rounded-md px-1.5 py-1 text-sm transition hover:bg-secondary"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {turno.reacciones.length > 0 && (
                <div className={cn('mt-1 flex flex-wrap gap-1', mio ? 'justify-end' : 'justify-start')}>
                  {turno.reacciones.map((reaccion) => (
                    <button
                      key={reaccion.emoji}
                      type="button"
                      onClick={() => void reaccionar(turno.id, reaccion.emoji)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition',
                        reaccion.mia
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      <span>{reaccion.emoji}</span>
                      <span>{reaccion.total}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={finRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

        {citado && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary/50 bg-primary/5 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-primary">{textos.respondiendoA}</p>
              <p className="truncate text-[11px] text-muted-foreground">{citado.contenido}</p>
            </div>
            <button
              type="button"
              onClick={() => setCitado(null)}
              aria-label={textos.cancelar}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {archivos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {archivos.map((archivo) => (
              <span key={archivo.name} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px]">
                <Paperclip className="size-3" />
                <span className="max-w-40 truncate">{archivo.name}</span>
                <button
                  type="button"
                  onClick={() => setArchivos((a) => a.filter((x) => x !== archivo))}
                  aria-label={textos.cancelar}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void enviar() }}>
          <input
            ref={archivoRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => elegirArchivos(e.target.files)}
          />
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            title={`${textos.adjuntar} · ${textos.maxArchivos}`}
            aria-label={textos.adjuntar}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-input text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Paperclip className="size-4" />
          </button>
          {/* Enter envía y Shift+Enter salta línea, como en cualquier chat. */}
          <Textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onPaste={(e) => {
              const imagenes = Array.from(e.clipboardData.files).filter((archivo) => archivo.type.startsWith('image/'))
              if (imagenes.length > 0) {
                e.preventDefault()
                setArchivos((actual) => [...actual, ...imagenes].slice(0, MAX_ARCHIVOS))
              }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
            placeholder={textos.escribir}
            maxLength={5000}
            minRows={1}
            maxRows={4}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
          />
          <button
            type="submit"
            disabled={enviando || (!borrador.trim() && archivos.length === 0)}
            aria-label={textos.enviar}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-45"
          >
            {enviando ? <CircleNotch className="size-4 animate-spin" /> : <PaperPlaneTilt className="size-4" weight="fill" />}
          </button>
        </form>
      </div>
    </div>
  )
}
