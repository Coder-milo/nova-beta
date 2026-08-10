'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowBendUpLeftIcon as ArrowBendUpLeft,
  CheckIcon as Check,
  ChecksIcon as Checks,
  CircleNotchIcon as CircleNotch,
  HeartIcon as Heart,
  ImageIcon as Image,
  MicrophoneIcon as Microphone,
  MinusIcon as Minus,
  PaperclipIcon as Paperclip,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  PhoneIcon as Phone,
  SmileyIcon as Smiley,
  VideoCameraIcon as VideoCamera,
  XIcon as X,
  ArrowsOutIcon as ArrowsOut,
} from '@phosphor-icons/react'
import { chatsApi, gruposApi, mensajeDeError } from '@/lib/api'
import type { ChatDirectoMensajeResponse, ChatGrupoMensajeResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover'
import { VoiceNoteRecorder } from '@/components/ui/voice-note-recorder'
import { useRouter } from '@/compat/next-navigation'

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
  const [minimizado, setMinimizado] = useState(false)
  const [mensajesDirectos, setMensajesDirectos] = useState<ChatDirectoMensajeResponse[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<ChatGrupoMensajeResponse[]>([])
  const [cargando, setCargando] = useState(true)

  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [mostrarEmojis, setMostrarEmojis] = useState(false)
  const [grabandoAudio, setGrabandoAudio] = useState(false)
  const [citandoMensaje, setCitandoMensaje] = useState<{ id: string; texto: string; autor: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Enviar mensaje
  const handleEnviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? borrador).trim()
    if (!texto || enviando) return
    setEnviando(true)

    try {
      if (esGrupo) {
        const nuevo = await gruposApi.enviar(contactoId, texto, citandoMensaje?.id)
        setMensajesGrupo((prev) => [...prev, nuevo])
      } else {
        const nuevo = await chatsApi.enviar(contactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setCitandoMensaje(null)
      setMostrarEmojis(false)
    } catch (e) {
      console.error(e)
    } finally {
      setEnviando(false)
    }
  }

  const handleSendHeart = () => {
    void handleEnviar('❤️')
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
      setErrorEnvio(english
        ? 'Voice notes are not available in groups yet.'
        : 'Las notas de voz todavía no están disponibles en los grupos.')
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
      setErrorEnvio(mensajeDeError(e, english
        ? 'The voice note could not be sent.'
        : 'No se pudo enviar la nota de voz.'))
    } finally {
      setEnviando(false)
    }
  }

  const irAMensajesGrandes = () => {
    router.push('/mis-mensajes')
    onClose()
  }

  // Si está minimizado, mostrar solo una burbuja flotante redonda con el avatar
  if (minimizado) {
    return (
      <div className="fixed bottom-4 right-6 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="relative flex size-14 items-center justify-center rounded-full border-2 border-primary bg-muted/40 shadow-2xl transition hover:scale-110"
          title={`Abrir chat con ${contactoNombre}`}
        >
          {contactoFoto ? (
            <img src={contactoFoto} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-primary font-bold text-white">
              {contactoNombre[0]}
            </div>
          )}
          <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-card bg-emerald-500" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-full bg-muted text-white hover:bg-rose-600"
          title="Cerrar"
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
              <img src={contactoFoto} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-primary font-bold text-white text-xs">
                {contactoNombre[0]}
              </div>
            )}
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border border-card bg-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-xs font-bold text-foreground">{contactoNombre}</h4>
            <p className="text-[9px] text-muted-foreground font-medium">Activo(a) ahora</p>
          </div>
        </div>

        {/* Acciones: Llamada, Videollamada, Pantalla completa, Minimizar, Cerrar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={irAMensajesGrandes}
            className="rounded-full p-1 text-primary hover:bg-muted"
            title="Ver chat completo en /mis-mensajes"
          >
            <ArrowsOut className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setMinimizado(true)}
            className="rounded-full p-1 text-primary hover:bg-muted"
            title="Minimizar"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-rose-600 hover:text-white"
            title="Cerrar chat"
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
            Cargando...
          </div>
        )}

        {!cargando &&
          !esGrupo &&
          mensajesDirectos.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs',
                  m.enviadoPorMi
                    ? 'bg-primary text-white rounded-br-xs'
                    : 'bg-muted text-foreground rounded-bl-xs',
                )}
              >
                <p>{m.contenido}</p>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[8px] opacity-75">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.enviadoPorMi && (m.leidoAt ? <Checks className="size-2.5 text-emerald-300" /> : <Check className="size-2.5" />)}
                </div>
              </div>
            </div>
          ))}

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
                </div>
              </div>
            </div>
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Popover Emoji */}
      {mostrarEmojis && (
        <div className="absolute bottom-12 right-2 z-50">
          <EmojiPickerPopover
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
              title="Nota de voz"
            >
              <Microphone className="size-4" />
            </button>

            <input ref={fileInputRef} type="file" multiple className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-7 items-center justify-center rounded-full text-primary hover:bg-muted"
              title="Adjuntar multimedia"
            >
              <Image className="size-4" />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                placeholder="Aa"
                className="w-full rounded-full border-none bg-muted py-1.5 pl-3 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrarEmojis((prev) => !prev)}
                className="absolute right-2 top-1.5 text-primary hover:scale-110"
                title="Emoji"
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
              <button
                type="button"
                onClick={handleSendHeart}
                className="flex size-7 items-center justify-center rounded-full text-rose-500 hover:scale-125 transition"
                title="Me gusta"
              >
                <Heart className="size-5" weight="fill" />
              </button>
            )}
          </form>
        </footer>
      )}
    </div>
  )
}
