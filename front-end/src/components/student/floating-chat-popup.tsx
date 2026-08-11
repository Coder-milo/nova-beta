'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon as Check,
  ChecksIcon as Checks,
  CircleNotchIcon as CircleNotch,
  HeartIcon as Heart,
  ImageIcon as Image,
  FileTextIcon as FileText,
  DownloadSimpleIcon as DownloadSimple,
  MicrophoneIcon as Microphone,
  MinusIcon as Minus,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  SmileyIcon as Smiley,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
  XIcon as X,
  ArrowsOutIcon as ArrowsOut,
} from '@phosphor-icons/react'
import { chatsApi, gruposApi, mensajeDeError } from '@/lib/api'
import type { ChatDirectoMensajeResponse, ChatGrupoMensajeResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover'
import { VoiceNoteRecorder } from '@/components/ui/voice-note-recorder'
import { useRouter } from '@/compat/next-navigation'

/**
 * Los textos de la ventanita, en los dos idiomas.
 *
 * Estaban todos en español fijo aunque el componente ya recibía `locale` y solo
 * lo usaba para dos mensajes de error.
 */
function textosPopup(english: boolean) {
  return english
    ? {
        abrirCompleto: 'Open the full conversation', minimizar: 'Minimise', cerrarChat: 'Close chat',
        cerrar: 'Close', abrirChatCon: (n: string) => `Open chat with ${n}`,
        cargando: 'Loading…', sinMensajes: 'No messages yet. Say hello.',
        escribe: 'Write a message', emoji: 'Emoji', notaDeVoz: 'Voice note', adjuntar: 'Attach a file',
        enviarEmoji: 'Click to send, right-click to change the quick emoji',
        editar: 'Edit', borrar: 'Delete', enviarReaccion: 'Send a quick emoji',
        guardar: 'Save', cancelar: 'Cancel', editado: 'edited', audioDeVoz: 'Voice note',
        errorEnviar: 'The message could not be sent.',
        errorBorrar: 'Could not delete message.', errorEditar: 'Could not edit message.',
        errorArchivo: 'Could not send file.', errorAudio: 'The voice note could not be sent.',
        grupoSinArchivos: 'Group attachments are coming soon.',
        grupoSinAudio: 'Voice notes are not available in groups yet.',
      }
    : {
        abrirCompleto: 'Abrir la conversación completa', minimizar: 'Minimizar', cerrarChat: 'Cerrar chat',
        cerrar: 'Cerrar', abrirChatCon: (n: string) => `Abrir chat con ${n}`,
        cargando: 'Cargando…', sinMensajes: 'Todavía no hay mensajes. Saluda tú.',
        escribe: 'Escribe un mensaje', emoji: 'Emoji', notaDeVoz: 'Nota de voz', adjuntar: 'Adjuntar un archivo',
        enviarEmoji: 'Clic para enviar, clic derecho para cambiar el icono',
        editar: 'Editar', borrar: 'Eliminar', enviarReaccion: 'Enviar un emoji rápido',
        guardar: 'Guardar', cancelar: 'Cancelar', editado: 'editado', audioDeVoz: 'Nota de voz',
        errorEnviar: 'No se pudo enviar el mensaje.',
        errorBorrar: 'No se pudo eliminar el mensaje.', errorEditar: 'No se pudo editar el mensaje.',
        errorArchivo: 'No se pudo enviar el archivo.', errorAudio: 'No se pudo enviar la nota de voz.',
        grupoSinArchivos: 'Los adjuntos en grupos estarán disponibles pronto.',
        grupoSinAudio: 'Las notas de voz todavía no están disponibles en los grupos.',
      }
}

interface FloatingChatProps {
  contactoId: string
  contactoNombre: string
  contactoFoto?: string | null
  esGrupo?: boolean
  locale?: 'es' | 'en'
  onClose: () => void
}

export function FloatingChatPopup({
  contactoId,
  contactoNombre,
  contactoFoto,
  esGrupo = false,
  locale = 'es',
  onClose,
}: FloatingChatProps) {
  const router = useRouter()
  const english = locale === 'en'
  const T = textosPopup(english)
  const [minimizado, setMinimizado] = useState(false)
  const [mensajesDirectos, setMensajesDirectos] = useState<ChatDirectoMensajeResponse[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<ChatGrupoMensajeResponse[]>([])
  const [cargando, setCargando] = useState(true)

  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [mostrarEmojis, setMostrarEmojis] = useState(false)
  const [grabandoAudio, setGrabandoAudio] = useState(false)
  const [editandoMensajeId, setEditandoMensajeId] = useState<string | null>(null)
  const [textoEditando, setTextoEditando] = useState('')
  const [reaccionMenuId, setReaccionMenuId] = useState<string | null>(null)

  const OPCIONES_QUICK_EMOJI = ['❤️', '👍', '🔥', '🎉', '👏', '⚡', '😊', '🚀', '😍', '💯'] as const
  const [quickEmoji, setQuickEmoji] = useState('❤️')
  const [mostrarSelectorQuickEmoji, setMostrarSelectorQuickEmoji] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const guardado = localStorage.getItem(`quick_emoji_${contactoId}`)
      if (guardado) setQuickEmoji(guardado)
      else setQuickEmoji('❤️')
    }
  }, [contactoId])

  const handleBorrar = async (id: string) => {
    try {
      await chatsApi.borrar(id)
      setMensajesDirectos((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setErrorEnvio(mensajeDeError(e, T.errorBorrar))
    }
  }

  const handleGuardarEdicion = async (id: string) => {
    if (!textoEditando.trim()) return
    try {
      const editado = await chatsApi.editar(id, textoEditando.trim())
      setMensajesDirectos((prev) => prev.map((m) => (m.id === id ? editado : m)))
      setEditandoMensajeId(null)
      setTextoEditando('')
    } catch (e) {
      setErrorEnvio(mensajeDeError(e, T.errorEditar))
    }
  }

  const handleReaccionar = (emoji: string) => {
    void handleEnviar(emoji)
    setReaccionMenuId(null)
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const quickEmojiSelectorRef = useRef<HTMLDivElement>(null)

  // Cerrar popovers al hacer clic afuera
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (mostrarEmojis && emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setMostrarEmojis(false)
      }
      if (
        mostrarSelectorQuickEmoji &&
        quickEmojiSelectorRef.current &&
        !quickEmojiSelectorRef.current.contains(target)
      ) {
        setMostrarSelectorQuickEmoji(false)
      }
      if (reaccionMenuId) {
        setReaccionMenuId(null)
      }
    }

    document.addEventListener('pointerdown', handleDocumentClick)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick)
    }
  }, [mostrarEmojis, mostrarSelectorQuickEmoji, reaccionMenuId])

  // Cargar conversación
  useEffect(() => {
    let active = true
    setCargando(true)
    if (esGrupo) {
      gruposApi
        .mensajes(contactoId)
        .then((msgs) => { if (active) setMensajesGrupo(msgs) })
        .catch(() => undefined)
        .finally(() => { if (active) setCargando(false) })
    } else {
      chatsApi
        .conversacion(contactoId)
        .then((msgs) => { if (active) setMensajesDirectos(msgs) })
        .catch(() => undefined)
        .finally(() => { if (active) setCargando(false) })
    }
    return () => { active = false }
  }, [contactoId, esGrupo])

  // Scroll al fondo
  useEffect(() => {
    if (!minimizado) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajesDirectos.length, mensajesGrupo.length, minimizado])

  /**
   * Manda el mensaje.
   *
   * El `catch` no estaba: si el envío fallaba —sin red, contacto bloqueado, el
   * texto pasado de largo— la promesa se rompía sin que nadie la recogiera. El
   * mensaje se quedaba escrito en la caja, no aparecía en el hilo y no salía
   * ningún aviso, así que la única lectura posible era que se había enviado.
   */
  const handleEnviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? borrador).trim()
    if (!texto || enviando) return
    setEnviando(true)
    setErrorEnvio(null)

    try {
      if (esGrupo) {
        const nuevo = await gruposApi.enviar(contactoId, texto)
        setMensajesGrupo((prev) => [...prev, nuevo])
      } else {
        const nuevo = await chatsApi.enviar(contactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setMostrarEmojis(false)
    } catch (e) {
      setErrorEnvio(mensajeDeError(e, T.errorEnviar))
    } finally {
      setEnviando(false)
    }
  }

  const seleccionarQuickEmoji = (emoji: string) => {
    setQuickEmoji(emoji)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`quick_emoji_${contactoId}`, emoji)
    }
    setMostrarSelectorQuickEmoji(false)
  }

  const handleSendQuickEmoji = () => {
    void handleEnviar(quickEmoji)
  }

  const handleSeleccionarArchivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || enviando) return
    if (esGrupo) {
      setErrorEnvio(T.grupoSinArchivos)
      return
    }
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const nuevo = await chatsApi.enviarConArchivos(contactoId, '', files)
      setMensajesDirectos((prev) => [...prev, nuevo])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setErrorEnvio(mensajeDeError(err, T.errorArchivo))
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Manda la nota de voz de verdad.
   *
   * Antes esto tiraba el audio y enviaba un texto que decía «🎤 Nota de voz
   * (12s)». Quien la grababa veía salir el mensaje y creía que la había
   * mandado; al otro lado no llegaba ningún audio, solo esa frase.
   *
   * Los grupos todavía no guardan adjuntos —la tabla cuelga del mensaje
   * directo—, así que ahí se avisa en vez de fingir que salió.
   */
  const handleEnviarAudio = async (audio: Blob, segundos: number) => {
    if (enviando) return
    setGrabandoAudio(false)
    if (esGrupo) {
      setErrorEnvio(T.grupoSinAudio)
      return
    }
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const archivo = new File([audio], `nota-de-voz-${Date.now()}.webm`, {
        type: audio.type || 'audio/webm',
      })
      const nuevo = await chatsApi.enviarConArchivos(contactoId, '', [archivo], segundos)
      setMensajesDirectos((prev) => [...prev, nuevo])
    } catch (e) {
      setErrorEnvio(mensajeDeError(e, T.errorAudio))
    } finally {
      setEnviando(false)
    }
  }

  const irAMensajesGrandes = () => {
    router.push('/mis-mensajes')
    onClose()
  }

  // Si está minimizado, mostrar solo una burbuja flotante redonda con el avatar
  const fotoDe = (id: string, clave?: string | null, esG?: boolean) => {
    if (!clave) return undefined
    if (clave.startsWith('http') || clave.includes('/api/')) return clave
    return esG ? `/api/v1/chats/grupos/${id}/foto` : `/api/v1/chats/directos/${id}/foto`
  }

  if (minimizado) {
    return (
      <div className="fixed bottom-4 right-6 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="relative flex size-14 items-center justify-center rounded-full border-2 border-primary bg-muted/40 shadow-2xl transition hover:scale-110"
          title={T.abrirChatCon(contactoNombre)}
        >
          {contactoFoto ? (
            <img src={fotoDe(contactoId, contactoFoto, esGrupo)} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-primary font-bold text-white">
              {contactoNombre[0]}
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-full bg-muted text-white hover:bg-rose-600"
          title={T.cerrar}
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-6 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-card text-foreground shadow-2xl">
      {/* ── CABECERA POPUP ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            {contactoFoto ? (
              <img src={fotoDe(contactoId, contactoFoto, esGrupo)} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-primary font-bold text-white text-xs">
                {contactoNombre[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Sin punto verde ni «Activo(a) ahora»: el sistema no sabe quien
                esta conectado, y afirmarlo hace esperar una respuesta que
                puede no llegar hoy. */}
            <h4 className="truncate text-xs font-bold text-foreground">{contactoNombre}</h4>
          </div>
        </div>

        {/* Sin llamada ni videollamada: no hay nada detras de esos botones. */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={irAMensajesGrandes}
            className="rounded-full p-1 text-primary hover:bg-muted"
            title={T.abrirCompleto}
          >
            <ArrowsOut className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setMinimizado(true)}
            className="rounded-full p-1 text-primary hover:bg-muted"
            title={T.minimizar}
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-rose-600 hover:text-white"
            title={T.cerrarChat}
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {errorEnvio && (
        <div className="flex items-center justify-between bg-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-rose-400">
          <span>{errorEnvio}</span>
          <button type="button" onClick={() => setErrorEnvio(null)}>
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* ── LIENZO DE MENSAJES ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {cargando && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
            {T.cargando}
          </div>
        )}

        {!cargando &&
          !esGrupo &&
          mensajesDirectos.map((m) => {
            const esAudioTexto = !m.adjuntos?.length && m.contenido && /Nota de voz/i.test(m.contenido)
            return (
              <div key={m.id} className={cn('group relative flex flex-col my-1', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                {/* Menú Flotante de Reacciones Rápida */}
                {reaccionMenuId === m.id && (
                  <div className="absolute -top-7 z-50 flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95">
                    {['👍', '❤️', '🎉', '👏', '😀', '😮', '😢', '🙏'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleReaccionar(emoji)}
                        className="text-xs transition-transform hover:scale-130 active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <div className={cn('relative flex items-center gap-1 max-w-[90%]', m.enviadoPorMi && 'flex-row-reverse')}>
                  {/* Burbuja Principal */}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs max-w-full',
                      m.enviadoPorMi
                        ? 'bg-primary text-white rounded-br-xs'
                        : 'bg-muted text-foreground rounded-bl-xs',
                    )}
                  >
                    {editandoMensajeId === m.id ? (
                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                        <input
                          type="text"
                          value={textoEditando}
                          onChange={(e) => setTextoEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleGuardarEdicion(m.id)
                            if (e.key === 'Escape') setEditandoMensajeId(null)
                          }}
                          className="w-full rounded-lg border border-white/30 bg-black/20 px-2 py-1 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setEditandoMensajeId(null)}
                            className="rounded px-1.5 py-0.5 bg-black/20 text-white/80 hover:bg-black/30"
                          >
                            {T.cancelar}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleGuardarEdicion(m.id)}
                            className="rounded px-1.5 py-0.5 bg-white text-primary font-semibold hover:bg-white/90"
                          >
                            {T.guardar}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.contenido && <p>{m.contenido}</p>}
                        {esAudioTexto && (
                          <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-[11px]">
                            <Microphone className="size-3.5 shrink-0 text-primary" />
                            <span className="italic opacity-90">{T.audioDeVoz}</span>
                          </div>
                        )}
                        {m.adjuntos?.map((a) => {
                          const esImagen = a.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(a.nombre)
                          const esAudio = a.esAudio || a.contentType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|aac)$/i.test(a.nombre)
                          if (esAudio) {
                            return (
                              <div key={a.id} className="mt-1 flex flex-col gap-0.5">
                                <audio
                                  controls
                                  preload="metadata"
                                  src={chatsApi.urlAdjunto(a.id)}
                                  className="h-8 w-44 max-w-full"
                                />
                                {a.duracionSegundos != null && (
                                  <span className="text-[8px] opacity-75">
                                    {Math.floor(a.duracionSegundos / 60)}:{String(a.duracionSegundos % 60).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            )
                          }
                          if (esImagen) {
                            return (
                              <div key={a.id} className="mt-1">
                                <a href={chatsApi.urlAdjunto(a.id)} target="_blank" rel="noreferrer">
                                  <img
                                    src={chatsApi.urlAdjunto(a.id)}
                                    alt={a.nombre}
                                    className="max-h-40 max-w-full rounded-lg object-cover shadow-xs hover:opacity-90"
                                  />
                                </a>
                              </div>
                            )
                          }
                          return (
                            <div key={a.id} className="mt-1">
                              <a
                                href={chatsApi.urlAdjunto(a.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/10 p-2 text-xs transition hover:bg-black/20"
                              >
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                                  <FileText className="size-3.5" />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate font-semibold">{a.nombre}</span>
                                  {a.tamano != null && <span className="text-[9px] opacity-75">{(a.tamano / 1024).toFixed(1)} KB</span>}
                                </div>
                                <DownloadSimple className="size-3.5 shrink-0 opacity-80" />
                              </a>
                            </div>
                          )
                        })}
                      </>
                    )}

                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[8px] opacity-75">
                      {m.editado && <span className="italic mr-0.5">{T.editado}</span>}
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.enviadoPorMi && (m.leidoAt ? <Checks className="size-2.5 text-emerald-300" /> : <Check className="size-2.5" />)}
                    </div>
                  </div>

                  {/* Acciones al pasar el cursor. Aqui habia un boton de
                      responder: el envio de un chat directo no admite cita, asi
                      que marcaba el mensaje, pintaba una banda de «Respondiendo
                      a…» y al enviar se perdia. La conversacion completa, en
                      /mis-mensajes, si cita en los grupos. */}
                  <div className="hidden group-hover:flex items-center gap-0.5 rounded-full border border-border/60 bg-card/90 p-0.5 shadow-xs backdrop-blur-xs opacity-90 hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setReaccionMenuId((prev) => (prev === m.id ? null : m.id))}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={T.enviarReaccion}
                    >
                      <Smiley className="size-3" />
                    </button>
                    {m.enviadoPorMi && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoMensajeId(m.id)
                            setTextoEditando(m.contenido)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={T.editar}
                        >
                          <PencilSimple className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBorrar(m.id)}
                          className="rounded p-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-600"
                          title={T.borrar}
                        >
                          <Trash className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

        {!cargando &&
          esGrupo &&
          mensajesGrupo.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
              <div className="max-w-[82%]">
                {!m.enviadoPorMi && <p className="mb-0.5 text-[9px] font-bold text-primary">{m.remitenteNombre}</p>}
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs',
                    m.enviadoPorMi ? 'bg-primary text-white' : 'bg-muted text-foreground',
                  )}
                >
                  <p>{m.contenido}</p>
                  <div className="mt-0.5 flex justify-end text-[8px] opacity-75">
                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {!cargando && (esGrupo ? mensajesGrupo.length === 0 : mensajesDirectos.length === 0) && (
          <p className="py-10 text-center text-[11px] text-muted-foreground">{T.sinMensajes}</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Popover Emoji Compacto */}
      {mostrarEmojis && (
        <div ref={emojiPickerRef} className="absolute bottom-12 right-2 z-50">
          <EmojiPickerPopover
            compact
            onSelectEmoji={(emoji) => setBorrador((prev) => prev + emoji)}
            onClose={() => setMostrarEmojis(false)}
          />
        </div>
      )}

      {/* ── BARRA INFERIOR DE MENSAJES MESSENGER ───────────────────────────── */}
      {grabandoAudio ? (
        <div className="border-t border-border/60 bg-muted/40 p-2">
          <VoiceNoteRecorder
            onSendAudio={(blob, sec) => void handleEnviarAudio(blob, sec)}
            onCancel={() => setGrabandoAudio(false)}
          />
        </div>
      ) : (
        <footer className="border-t border-border/60 bg-muted/40 p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleEnviar()
            }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => setGrabandoAudio(true)}
              className="flex size-7 items-center justify-center rounded-full text-primary hover:bg-muted"
              title={T.notaDeVoz}
            >
              <Microphone className="size-4" />
            </button>

            <input ref={fileInputRef} type="file" multiple onChange={handleSeleccionarArchivos} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-7 items-center justify-center rounded-full text-primary hover:bg-muted"
              title={T.adjuntar}
            >
              <Image className="size-4" />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                placeholder={T.escribe}
                className="w-full rounded-full border-none bg-muted py-1.5 pl-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrarEmojis((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-primary hover:scale-110"
                title={T.emoji}
              >
                <Smiley className="size-4" />
              </button>
            </div>

            {borrador.trim() ? (
              <button
                type="submit"
                disabled={enviando}
                className="flex size-7 items-center justify-center rounded-full bg-primary text-white shadow hover:brightness-110"
              >
                <PaperPlaneTilt className="size-3.5" />
              </button>
            ) : (
              <div ref={quickEmojiSelectorRef} className="relative flex items-center">
                {mostrarSelectorQuickEmoji && (
                  <div className="absolute bottom-9 right-0 z-50 flex items-center gap-1 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                    {OPCIONES_QUICK_EMOJI.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => seleccionarQuickEmoji(e)}
                        className="flex size-6 items-center justify-center text-sm transition-transform hover:scale-125 active:scale-95"
                        title={e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSendQuickEmoji}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMostrarSelectorQuickEmoji((prev) => !prev)
                  }}
                  className="flex size-7 items-center justify-center rounded-full text-primary hover:bg-muted/80 transition-transform active:scale-95"
                  title={T.enviarEmoji}
                >
                  {quickEmoji === '❤️' ? (
                    <Heart className="size-4 text-rose-500" weight="fill" />
                  ) : (
                    <span className="flex size-5 items-center justify-center text-center text-base leading-none select-none">{quickEmoji}</span>
                  )}
                </button>
              </div>
            )}
          </form>
        </footer>
      )}
    </div>
  )
}
