'use client'

/**
 * La pantalla de mensajes del equipo.
 *
 * `/mis-mensajes` servía el portal del estudiante a todo el mundo. Para quien
 * gestiona eso significaba dos cosas: la pantalla empezaba pidiendo la ficha de
 * estudiante de la sesión —que un administrador no tiene— y saludaba con «El
 * usuario admin@novacrm.com no tiene una ficha de estudiante asociada», y
 * debajo aparecía la bandeja del estudiante, que no es su trabajo. El equipo no
 * viene a leer sus propios chats: viene a atender lo que llega del portal.
 *
 * Por eso aquí solo está la bandeja de solicitudes: quién escribió, qué pidió y
 * si sigue sin respuesta.
 *
 * <p><strong>Aquí no hay chats directos.</strong> El chat entre personas del
 * sistema está construido sobre la ficha de estudiante —las columnas
 * `remitente_id` y `destinatario_id` de `chat_directo_mensaje` apuntan a la
 * tabla `estudiante`—, así que solo existe entre compañeros de un mismo
 * proyecto. Para el equipo no había con quién hablar: la pestaña salía vacía o
 * respondía 403. Hablar entre coordinadores necesita que el chat cuelgue del
 * usuario y no del estudiante, y eso es trabajo de backend, no una pestaña.
 *
 * Consume:
 *   GET  /api/v1/mensajes
 *   GET  /api/v1/mensajes/{id}/turnos   (dentro de <Conversacion />)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  CaretLeftIcon as CaretLeft,
  ChatsCircleIcon as ChatsCircle,
  CircleNotchIcon as CircleNotch,
  MagnifyingGlassIcon as MagnifyingGlass,
  WarningCircleIcon as WarningCircle,
} from '@phosphor-icons/react'
import { mensajesApi, mensajeDeError } from '@/lib/api'
import type { MensajeResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Conversacion } from '@/components/ui/conversacion'
import { usePreferences } from '@/lib/preferences'

type Filtro = 'pendientes' | 'todos'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Student messages',
        descripcion: 'Requests coming from the student portal: read the thread and answer.',
        pendientes: 'Awaiting reply',
        todos: 'All',
        buscar: 'Search by student, email or subject…',
        cargando: 'Loading inbox…',
        noSePudoCargar: 'The inbox could not be loaded.',
        reintentar: 'Retry',
        actualizar: 'Refresh',
        sinMensajes: 'No requests from students yet.',
        sinPendientes: 'Nothing awaiting a reply. Everything is answered.',
        sinCoincidencias: 'No requests match that search.',
        elige: 'Pick a request',
        eligePie: 'Choose one on the left to read the full thread and answer.',
        abierto: 'Awaiting reply',
        respondido: 'Answered',
        volver: 'Back to the inbox',
        deX: (n: number) => `${n} awaiting reply`,
        conversacion: {
          escribir: 'Write a message…', enviar: 'Send', adjuntar: 'Attach a file',
          responder: 'Reply to this message', reaccionar: 'React', cancelar: 'Remove',
          vacio: 'No messages in this conversation yet.', cargando: 'Loading conversation…',
          respondiendoA: 'Replying to', maxArchivos: 'Up to 5 files',
          errorCargar: 'The conversation could not be loaded.',
          errorEnviar: 'The message could not be sent.',
          errorReaccionar: 'The reaction could not be saved.',
        },
      }
    : {
        titulo: 'Mensajes de estudiantes',
        descripcion: 'Lo que llega del portal estudiantil: lee el hilo y responde.',
        pendientes: 'Sin responder',
        todos: 'Todas',
        buscar: 'Buscar por estudiante, correo o asunto…',
        cargando: 'Cargando la bandeja…',
        noSePudoCargar: 'No se pudo cargar la bandeja.',
        reintentar: 'Reintentar',
        actualizar: 'Actualizar',
        sinMensajes: 'Todavía no hay solicitudes de estudiantes.',
        sinPendientes: 'No queda nada sin responder.',
        sinCoincidencias: 'Ninguna solicitud coincide con esa búsqueda.',
        elige: 'Elige una solicitud',
        eligePie: 'Selecciona una de la izquierda para leer el hilo completo y responder.',
        abierto: 'Sin responder',
        respondido: 'Respondido',
        volver: 'Volver a la bandeja',
        deX: (n: number) => `${n} sin responder`,
        conversacion: {
          escribir: 'Escribe un mensaje…', enviar: 'Enviar', adjuntar: 'Adjuntar un archivo',
          responder: 'Responder a este mensaje', reaccionar: 'Reaccionar', cancelar: 'Quitar',
          vacio: 'Todavía no hay mensajes en esta conversación.', cargando: 'Cargando conversación…',
          respondiendoA: 'Respondiendo a', maxArchivos: 'Hasta 5 archivos',
          errorCargar: 'No se pudo cargar la conversación.',
          errorEnviar: 'No se pudo enviar el mensaje.',
          errorReaccionar: 'No se pudo reaccionar.',
        },
      }
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function fechaCorta(valor: string, locale: 'es' | 'en'): string {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  const hoy = new Date()
  const mismoDia = fecha.toDateString() === hoy.toDateString()
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-GB',
    mismoDia ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' },
  ).format(fecha)
}

export function AdminMensajes() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [mensajes, setMensajes] = useState<MensajeResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const data = await mensajesApi.listar()
      setMensajes(data)
      setSeleccionadoId((actual) => (actual && data.some((m) => m.id === actual) ? actual : null))
    } catch (e) {
      setMensajes([])
      setError(mensajeDeError(e, T.noSePudoCargar))
    } finally { setCargando(false) }
  }, [T.noSePudoCargar])

  useEffect(() => { void cargar() }, [cargar])

  const pendientes = useMemo(
    () => mensajes.filter((m) => m.estado === 'ABIERTO').length,
    [mensajes],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return mensajes.filter((m) => {
      if (filtro === 'pendientes' && m.estado !== 'ABIERTO') return false
      if (!q) return true
      return (
        m.estudianteNombre.toLowerCase().includes(q) ||
        m.estudianteEmail.toLowerCase().includes(q) ||
        m.asunto.toLowerCase().includes(q)
      )
    })
  }, [mensajes, filtro, busqueda])

  const seleccionado = mensajes.find((m) => m.id === seleccionadoId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">{T.titulo}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{T.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-semibold text-foreground transition hover:border-primary/40 disabled:opacity-50"
        >
          <ArrowsClockwise className={cn('size-3.5', cargando && 'animate-spin')} /> {T.actualizar}
        </button>
      </div>

      <div className="flex h-[calc(100dvh-14rem)] min-h-[26rem] w-full overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm sm:min-h-[28rem]">
          {/* La bandeja. En móvil ocupa la pantalla entera y desaparece al abrir
              un hilo: las dos columnas juntas no caben en 375 px y quedaban las
              dos partidas por la mitad. */}
          <aside
            className={cn(
              'w-full flex-col border-r border-border/60 bg-muted/20 md:flex md:w-80 md:shrink-0',
              seleccionado ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="space-y-2 border-b border-border/40 p-3">
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={T.buscar}
                  className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-1">
                {([['todos', T.todos], ['pendientes', T.pendientes]] as const).map(([clave, etiqueta]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setFiltro(clave)}
                    aria-pressed={filtro === clave}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold transition',
                      filtro === clave
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {etiqueta}
                  </button>
                ))}
                {pendientes > 0 && (
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {T.deX(pendientes)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {cargando && (
                <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <CircleNotch className="size-4 animate-spin text-primary" /> {T.cargando}
                </p>
              )}

              {!cargando && error && (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                  <WarningCircle className="size-6 text-destructive" />
                  <p className="text-xs text-destructive">{error}</p>
                  <button
                    type="button"
                    onClick={() => void cargar()}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {T.reintentar}
                  </button>
                </div>
              )}

              {!cargando && !error && visibles.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {mensajes.length === 0
                    ? T.sinMensajes
                    : busqueda.trim()
                      ? T.sinCoincidencias
                      : T.sinPendientes}
                </p>
              )}

              {!cargando && !error && visibles.map((m) => {
                const activo = m.id === seleccionadoId
                const pendiente = m.estado === 'ABIERTO'
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSeleccionadoId(m.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition',
                      activo ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {iniciales(m.estudianteNombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-foreground">{m.estudianteNombre}</span>
                        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {fechaCorta(m.createdAt, locale)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{m.asunto}</span>
                      <span
                        className={cn(
                          'mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          pendiente
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {pendiente ? T.abierto : T.respondido}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <main className={cn('min-w-0 flex-1 flex-col bg-background', seleccionado ? 'flex' : 'hidden md:flex')}>
            {seleccionado ? (
              <>
                <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(null)}
                    aria-label={T.volver}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden"
                  >
                    <CaretLeft className="size-4" />
                  </button>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {iniciales(seleccionado.estudianteNombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{seleccionado.estudianteNombre}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {seleccionado.estudianteEmail} · {seleccionado.asunto}
                    </p>
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <Conversacion
                    // Al cambiar de hilo hay que rehacer el estado interno: sin
                    // la clave se quedaban los turnos del anterior mientras
                    // llegaban los nuevos.
                    key={seleccionado.id}
                    mensajeId={seleccionado.id}
                    soyEstudiante={false}
                    locale={locale}
                    textos={T.conversacion}
                    onTurnoNuevo={() => void cargar()}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
                  <ChatsCircle className="size-6 text-muted-foreground" />
                </span>
                <p className="text-sm font-semibold text-foreground">{T.elige}</p>
                <p className="max-w-xs text-xs text-muted-foreground">{T.eligePie}</p>
              </div>
            )}
        </main>
      </div>
    </div>
  )
}
