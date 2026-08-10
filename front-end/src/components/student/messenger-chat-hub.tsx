'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowBendUpLeftIcon as ArrowBendUpLeft,
  ArrowRightIcon as ArrowRight,
  BellIcon as Bell,
  CameraIcon as Camera,
  CaretDownIcon as CaretDown,
  CheckIcon as Check,
  ChecksIcon as Checks,
  CircleNotchIcon as CircleNotch,
  DotsThreeIcon as DotsThree,
  FileTextIcon as FileText,
  HeartIcon as Heart,
  ImageIcon as Image,
  InfoIcon as Info,
  MagnifyingGlassIcon as MagnifyingGlass,
  MicrophoneIcon as Microphone,
  PaperclipIcon as Paperclip,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  PencilSimpleIcon as PencilSimple,
  PhoneIcon as Phone,
  PlusIcon as Plus,
  ShareFatIcon as ShareFat,
  SmileyIcon as Smiley,
  StickerIcon as Sticker,
  TrashIcon as Trash,
  UserIcon as User,
  UserPlusIcon as UserPlus,
  UsersThreeIcon as UsersThree,
  VideoCameraIcon as VideoCamera,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from '@phosphor-icons/react'
import { chatsApi, gruposApi, mensajesApi, mensajeDeError } from '@/lib/api'
import type {
  ChatContactoResponse,
  ChatConversacionResponse,
  ChatDirectoMensajeResponse,
  ChatGrupoResponse,
  ChatGrupoMensajeResponse,
  ChatGrupoMiembroResponse,
  MensajeResponse,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Conversacion } from '@/components/ui/conversacion'
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover'
import { VoiceNoteRecorder } from '@/components/ui/voice-note-recorder'

type TabType = 'todos' | 'no_leidos' | 'grupos' | 'soporte'

interface Props {
  locale?: 'es' | 'en'
}

export function MessengerChatHub({ locale = 'es' }: Props) {
  const english = locale === 'en'

  const [activeTab, setActiveTab] = useState<TabType>('todos')
  const [conversaciones, setConversaciones] = useState<ChatConversacionResponse[]>([])
  const [grupos, setGrupos] = useState<ChatGrupoResponse[]>([])
  const [soporteHilos, setSoporteHilos] = useState<MensajeResponse[]>([])

  const [selectedContactoId, setSelectedContactoId] = useState<string | null>(null)
  const [selectedContactoNombre, setSelectedContactoNombre] = useState<string>('')
  const [selectedContactoFoto, setSelectedContactoFoto] = useState<string | null>(null)

  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null)
  const [selectedGrupoNombre, setSelectedGrupoNombre] = useState<string>('')
  const [selectedGrupoFoto, setSelectedGrupoFoto] = useState<string | null>(null)

  const [selectedSoporteId, setSelectedSoporteId] = useState<string | null>(null)

  const [mensajesDirectos, setMensajesDirectos] = useState<ChatDirectoMensajeResponse[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<ChatGrupoMensajeResponse[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [busquedaResultados, setBusquedaResultados] = useState<ChatContactoResponse[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)

  // Input & Rich Tools
  const [borrador, setBorrador] = useState('')
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)

  // Popovers & Grabador
  const [mostrarEmojiPicker, setMostrarEmojiPicker] = useState(false)
  const [grabandoAudio, setGrabandoAudio] = useState(false)
  const [mostrarSidebarInfo, setMostrarSidebarInfo] = useState(true)
  const [temaChatFondo, setTemaChatFondo] = useState<'predeterminado' | 'patron_rojo' | 'mar' | 'esmeralda'>('predeterminado')

  // Acciones en mensaje
  const [editandoMensajeId, setEditandoMensajeId] = useState<string | null>(null)
  const [citandoMensaje, setCitandoMensaje] = useState<{ id: string; texto: string; autor: string } | null>(null)
  const [bloqueados, setBloqueados] = useState<string[]>([])

  // Modales
  const [modalCrearGrupo, setModalCrearGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState('')
  const [descNuevoGrupo, setDescNuevoGrupo] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<string[]>([])
  const [contactosParaGrupo, setContactosParaGrupo] = useState<ChatContactoResponse[]>([])

  const [modalMiembros, setModalMiembros] = useState(false)
  const [miembrosGrupo, setMiembrosGrupo] = useState<ChatGrupoMiembroResponse[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)
  const [mostrarAgregarMiembros, setMostrarAgregarMiembros] = useState(false)
  const [nuevosMiembrosSeleccionados, setNuevosMiembrosSeleccionados] = useState<string[]>([])

  const [modalReenviar, setModalReenviar] = useState(false)
  const [mensajeAReenviarId, setMensajeAReenviarId] = useState<string | null>(null)

  const [modalReportar, setModalReportar] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [reportando, setReportando] = useState(false)

  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar conversaciones
  const cargarBandejas = useCallback(async () => {
    setCargando(true)
    try {
      const [convs, grps, sop, blqs] = await Promise.all([
        chatsApi.conversaciones().catch(() => []),
        gruposApi.misGrupos().catch(() => []),
        mensajesApi.mios().catch(() => []),
        chatsApi.bloqueados().catch(() => []),
      ])
      setConversaciones(convs)
      setGrupos(grps)
      setSoporteHilos(sop)
      setBloqueados(blqs)
      if (convs.length && !selectedContactoId && activeTab === 'todos') {
        setSelectedContactoId(convs[0].contactoId)
        setSelectedContactoNombre(convs[0].nombre)
        setSelectedContactoFoto(convs[0].fotoUrl)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }, [activeTab, selectedContactoId])

  useEffect(() => {
    void cargarBandejas()
  }, [cargarBandejas])

  // Cargar directo
  useEffect(() => {
    if (!selectedContactoId || (activeTab !== 'todos' && activeTab !== 'no_leidos')) return
    let active = true
    setCargandoMensajes(true)
    chatsApi.conversacion(selectedContactoId)
      .then((msgs) => { if (active) setMensajesDirectos(msgs) })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })
    return () => { active = false }
  }, [selectedContactoId, activeTab])

  // Cargar grupo
  useEffect(() => {
    if (!selectedGrupoId || activeTab !== 'grupos') return
    let active = true
    setCargandoMensajes(true)
    gruposApi.mensajes(selectedGrupoId)
      .then((msgs) => { if (active) setMensajesGrupo(msgs) })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })
    return () => { active = false }
  }, [selectedGrupoId, activeTab])

  // Buscador de contactos
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setBusquedaResultados([])
      return
    }
    let active = true
    chatsApi.contactos(searchQuery.trim())
      .then((res) => { if (active) setBusquedaResultados(res) })
      .catch(() => undefined)
    return () => { active = false }
  }, [searchQuery])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesDirectos.length, mensajesGrupo.length])

  // Enviar mensaje
  const handleEnviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? borrador).trim()
    if ((!texto && archivosAdjuntos.length === 0) || enviando) return
    setEnviando(true)

    try {
      if (editandoMensajeId) {
        const actualizado = await chatsApi.editar(editandoMensajeId, texto)
        setMensajesDirectos((prev) => prev.map((m) => (m.id === editandoMensajeId ? actualizado : m)))
        setEditandoMensajeId(null)
      } else if (selectedContactoId && (activeTab === 'todos' || activeTab === 'no_leidos')) {
        // Con archivos va por la ruta multipart. Antes se mandaba solo el
        // texto y los adjuntos se limpiaban abajo, asi que la imagen que
        // alguien acababa de elegir desaparecia sin decir nada.
        const nuevo = archivosAdjuntos.length > 0
          ? await chatsApi.enviarConArchivos(selectedContactoId, texto, archivosAdjuntos)
          : await chatsApi.enviar(selectedContactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      } else if (selectedGrupoId && activeTab === 'grupos') {
        if (archivosAdjuntos.length > 0) {
          // Los grupos todavia no guardan adjuntos: la tabla cuelga del
          // mensaje directo. Se dice, en vez de tragarselos.
          setAviso({ tipo: 'error', texto: english
            ? 'Attachments are not available in groups yet.'
            : 'Los grupos todavía no admiten archivos.' })
          setEnviando(false)
          return
        }
        const nuevo = await gruposApi.enviar(selectedGrupoId, texto, citandoMensaje?.id)
        setMensajesGrupo((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setArchivosAdjuntos([])
      setCitandoMensaje(null)
      setMostrarEmojiPicker(false)
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo enviar el mensaje.') })
    } finally {
      setEnviando(false)
    }
  }

  // Enviar audio grabado
  /**
   * Manda la nota de voz.
   *
   * Antes dejaba el audio en el estado y llamaba a `handleEnviar` con el texto
   * «🎤 Nota de voz (12s)». Como el envio mandaba solo texto, eso era lo unico
   * que llegaba: quien la grababa creia haberla mandado y al otro lado no habia
   * ningun audio. Ahora sube el archivo y espera al envio, en vez de fiarse de
   * que el estado se haya actualizado a tiempo.
   */
  const handleSendAudioNote = async (blob: Blob, durationSec: number) => {
    setGrabandoAudio(false)
    if (!selectedContactoId || activeTab === 'grupos') {
      setAviso({ tipo: 'error', texto: english
        ? 'Voice notes are only available in direct chats for now.'
        : 'Las notas de voz solo están disponibles en los chats directos por ahora.' })
      return
    }
    if (enviando) return
    setEnviando(true)
    try {
      const archivo = new File([blob], `nota-de-voz-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      })
      const nuevo = await chatsApi.enviarConArchivos(selectedContactoId, '', [archivo], durationSec)
      setMensajesDirectos((prev) => [...prev, nuevo])
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english
        ? 'The voice note could not be sent.'
        : 'No se pudo enviar la nota de voz.') })
    } finally {
      setEnviando(false)
    }
  }

  // Enviar Corazón Rápido ❤️
  const handleSendHeart = () => {
    void handleEnviar('❤️')
  }

  // Borrar mensaje
  const handleBorrar = async (id: string) => {
    try {
      await chatsApi.borrar(id)
      setMensajesDirectos((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo borrar el mensaje.') })
    }
  }

  // Reenviar mensaje
  const handleReenviar = async (destinoId: string) => {
    if (!mensajeAReenviarId) return
    try {
      await chatsApi.reenviar(mensajeAReenviarId, destinoId)
      setModalReenviar(false)
      setMensajeAReenviarId(null)
      setAviso({ tipo: 'ok', texto: 'Mensaje reenviado.' })
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo reenviar.') })
    }
  }

  // Bloquear / Desbloquear
  const handleBloqueo = async () => {
    if (!selectedContactoId) return
    const idContacto = selectedContactoId
    const bloqueadoAhora = bloqueados.includes(idContacto)
    try {
      if (bloqueadoAhora) {
        await chatsApi.desbloquear(idContacto)
        setBloqueados((prev) => prev.filter((id) => id !== idContacto))
        setAviso({ tipo: 'ok', texto: 'Contacto desbloqueado.' })
      } else {
        await chatsApi.bloquear(idContacto)
        setBloqueados((prev) => [...prev, idContacto])
        setAviso({ tipo: 'ok', texto: 'Contacto bloqueado.' })
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo cambiar el estado de bloqueo.') })
    }
  }

  // Crear grupo
  const handleCrearGrupo = async () => {
    if (!nombreNuevoGrupo.trim()) return
    try {
      const nuevo = await gruposApi.crear({
        nombre: nombreNuevoGrupo.trim(),
        descripcion: descNuevoGrupo.trim(),
        miembroIds: miembrosSeleccionados,
      })
      setModalCrearGrupo(false)
      setNombreNuevoGrupo('')
      setDescNuevoGrupo('')
      setMiembrosSeleccionados([])
      void cargarBandejas()
      setSelectedGrupoId(nuevo.id)
      setSelectedGrupoNombre(nuevo.nombre)
      setSelectedGrupoFoto(nuevo.fotoUrl)
      setActiveTab('grupos')
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo crear el grupo.') })
    }
  }

  // Abrir miembros de grupo
  const abrirMiembros = async () => {
    if (!selectedGrupoId) return
    setModalMiembros(true)
    setCargandoMiembros(true)
    try {
      const lista = await gruposApi.miembros(selectedGrupoId)
      setMiembrosGrupo(lista)
      const contactos = await chatsApi.contactos('a')
      setContactosParaGrupo(contactos)
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo cargar miembros.') })
    } finally {
      setCargandoMiembros(false)
    }
  }

  const contactoBloqueado = selectedContactoId ? bloqueados.includes(selectedContactoId) : false

  return (
    <div className="flex h-[calc(100vh-9.5rem)] min-h-[32rem] w-full overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-card-foreground shadow-xl backdrop-blur-xl transition-all">
      {/* ── COLUMNA 1: BANDEJA IZQUIERDA MESSENGER ────────────────────────────── */}
      <aside className="flex w-72 flex-col border-r border-border/60 bg-muted/30">
        {/* Encabezado Messenger */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-xl font-extrabold text-foreground">Chats</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setModalCrearGrupo(true)
                void chatsApi.contactos('a').then(setContactosParaGrupo)
              }}
              className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 transition"
              title="Nuevo grupo"
            >
              <PencilSimple className="size-5" />
            </button>
          </div>
        </div>

        {/* Buscador en Messenger */}
        <div className="px-3 py-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en Messenger"
              className="w-full rounded-full border border-input bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Pestañas de Filtro (Todos, No leídos, Grupos) */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab('todos')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              activeTab === 'todos' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:bg-muted/80',
            )}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('no_leidos')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              activeTab === 'no_leidos' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:bg-muted/80',
            )}
          >
            No leídos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              activeTab === 'grupos' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:bg-muted/80',
            )}
          >
            Grupos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('soporte')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              activeTab === 'soporte' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:bg-muted/80',
            )}
          >
            Soporte
          </button>
        </div>

        {/* Resultados de búsqueda dinámica */}
        {searchQuery.trim().length >= 2 && (
          <div className="border-b border-border/40 bg-card p-2 space-y-1">
            {busquedaResultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedContactoId(c.id)
                  setSelectedContactoNombre(c.nombre)
                  setSelectedContactoFoto(c.fotoUrl)
                  setSearchQuery('')
                  setActiveTab('todos')
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
              >
                {c.fotoUrl ? (
                  <img src={c.fotoUrl} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {c.nombre[0]}
                  </div>
                )}
                <span className="truncate text-xs font-bold text-foreground">{c.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {/* Lista de Conversaciones */}
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {(activeTab === 'todos' || activeTab === 'no_leidos') &&
            conversaciones
              .filter((c) => (activeTab === 'no_leidos' ? c.sinLeer > 0 : true))
              .map((conv) => (
                <button
                  key={conv.contactoId}
                  type="button"
                  onClick={() => {
                    setSelectedContactoId(conv.contactoId)
                    setSelectedContactoNombre(conv.nombre)
                    setSelectedContactoFoto(conv.fotoUrl)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                    selectedContactoId === conv.contactoId ? 'bg-muted/80 border-l-4 border-primary font-bold' : 'hover:bg-muted/50',
                  )}
                >
                  <div className="relative">
                    {conv.fotoUrl ? (
                      <img src={conv.fotoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                        {conv.nombre[0]}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{conv.nombre}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {conv.mioElUltimo ? 'Tú: ' : ''}{conv.ultimoMensaje}
                    </p>
                  </div>
                </button>
              ))}

          {activeTab === 'grupos' &&
            grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGrupoId(g.id)
                  setSelectedGrupoNombre(g.nombre)
                  setSelectedGrupoFoto(g.fotoUrl)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                  selectedGrupoId === g.id ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                {g.fotoUrl ? (
                  <img src={g.fotoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-muted-foreground">
                    <UsersThree className="size-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{g.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{g.totalMiembros} miembros</p>
                </div>
              </button>
            ))}

          {activeTab === 'soporte' &&
            soporteHilos.map((hilo) => (
              <button
                key={hilo.id}
                type="button"
                onClick={() => setSelectedSoporteId(hilo.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                  selectedSoporteId === hilo.id ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-lg">
                  🎧
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">CAC Academic</p>
                  <p className="truncate text-[11px] text-muted-foreground">{hilo.asunto}</p>
                </div>
              </button>
            ))}
        </div>
      </aside>

      {/* ── COLUMNA 2: LIENZO CENTRAL DE CHAT ─────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Cabecera del Chat Activo */}
        <header className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              {selectedContactoFoto ? (
                <img src={selectedContactoFoto} alt="" className="size-10 rounded-full object-cover" />
              ) : selectedGrupoFoto ? (
                <img src={selectedGrupoFoto} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                  {selectedContactoNombre[0] || 'C'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {activeTab === 'grupos' ? selectedGrupoNombre : (selectedContactoNombre || 'Soporte CAC')}
              </h3>
              {/* Sin «Activo(a) ahora»: no hay presencia en el sistema, y
                  decirle a alguien que su compañero está conectado cuando no
                  se sabe es hacerle esperar una respuesta que no va a llegar. */}
              <p className="text-[10px] font-semibold text-muted-foreground">
                {activeTab === 'grupos'
                  ? (english ? 'Study group' : 'Grupo de estudio')
                  : (english ? 'Classmate on your programme' : 'Compañero de tu programa')}
              </p>
            </div>
          </div>

          {/* Acciones superiores. Sin llamada ni videollamada: no hay nada
              detrás de esos dos botones, y un botón que no hace nada gasta la
              confianza de quien lo pulsa. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarSidebarInfo((prev) => !prev)}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition',
                mostrarSidebarInfo ? 'bg-primary text-white' : 'text-primary hover:bg-muted',
              )}
              title="Informaciones del chat"
            >
              <Info className="size-5" />
            </button>
          </div>
        </header>

        {/* Notificaciones flotantes */}
        {aviso && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2 text-xs font-semibold',
              aviso.tipo === 'ok' ? 'bg-emerald-500/20 text-muted-foreground' : 'bg-rose-500/20 text-rose-400',
            )}
          >
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Lienzo del Chat con Soporte de Fondos */}
        <div
          className={cn(
            'flex-1 overflow-y-auto p-4 space-y-4 transition-all',
            // Los fondos se tiñen sobre el color de fondo del tema, no son
            // grises fijos: escritos con los valores de Messenger dejaban el
            // lienzo negro en modo claro, que es donde trabaja el equipo.
            temaChatFondo === 'predeterminado' && 'bg-background',
            temaChatFondo === 'patron_rojo'
              && 'bg-background bg-[radial-gradient(theme(colors.rose.500/35%)_1px,transparent_1px)] [background-size:16px_16px]',
            temaChatFondo === 'mar' && 'bg-gradient-to-b from-sky-500/10 to-background',
            temaChatFondo === 'esmeralda' && 'bg-gradient-to-b from-emerald-500/10 to-background',
          )}
        >
          {cargandoMensajes && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
              Cargando mensajes...
            </div>
          )}

          {/* Mensajes Directos */}
          {!cargandoMensajes &&
            (activeTab === 'todos' || activeTab === 'no_leidos') &&
            mensajesDirectos.map((m) => (
              <div key={m.id} className={cn('group flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="relative max-w-[70%]">
                  {/* Acciones flotantes en mensaje */}
                  <div
                    className={cn(
                      'absolute -top-3 z-10 hidden items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 shadow-md group-hover:flex',
                      m.enviadoPorMi ? 'right-0' : 'left-0',
                    )}
                  >
                    {m.enviadoPorMi && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoMensajeId(m.id)
                          setBorrador(m.contenido)
                        }}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <PencilSimple className="size-3.5" />
                      </button>
                    )}
                    {m.enviadoPorMi && (
                      <button
                        type="button"
                        onClick={() => void handleBorrar(m.id)}
                        className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCitandoMensaje({ id: m.id, texto: m.contenido, autor: m.remitenteNombre })}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowBendUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensajeAReenviarId(m.id)
                        setModalReenviar(true)
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ShareFat className="size-3.5" />
                    </button>
                  </div>

                  {/* Burbuja Estilo Messenger */}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-xs leading-relaxed shadow-xs',
                      m.enviadoPorMi
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-muted/80 text-foreground border border-border/40 rounded-bl-xs',
                    )}
                  >
                    {m.reenviado && <p className="mb-1 text-[10px] font-bold opacity-75">↪ Reenviado</p>}
                    {m.contenido && <p>{m.contenido}</p>}

                    {/* Los adjuntos. Una nota de voz se reproduce en la propia
                        burbuja: obligar a descargar un audio de ocho segundos
                        para oírlo es no haberlo mandado. */}
                    {m.adjuntos?.map((a) => (
                      <div key={a.id} className={cn('flex flex-col gap-1', m.contenido && 'mt-2')}>
                        {a.esAudio ? (
                          <>
                            <audio
                              controls
                              preload="none"
                              src={chatsApi.urlAdjunto(a.id)}
                              className="h-9 w-56 max-w-full"
                            />
                            {a.duracionSegundos != null && (
                              <span className="text-[9px] opacity-75">
                                {Math.floor(a.duracionSegundos / 60)}:
                                {String(a.duracionSegundos % 60).padStart(2, '0')}
                              </span>
                            )}
                          </>
                        ) : (
                          <a href={chatsApi.urlAdjunto(a.id)} target="_blank" rel="noreferrer">
                            <img
                              src={chatsApi.urlAdjunto(a.id)}
                              alt={a.nombre}
                              className="max-h-56 max-w-full rounded-xl object-cover"
                            />
                          </a>
                        )}
                      </div>
                    ))}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.enviadoPorMi && (m.leidoAt ? <Checks className="size-3 text-emerald-300" /> : <Check className="size-3" />)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Mensajes de Grupo */}
          {!cargandoMensajes &&
            activeTab === 'grupos' &&
            mensajesGrupo.map((m) => (
              <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="max-w-[70%]">
                  {!m.enviadoPorMi && <p className="mb-1 text-[10px] font-bold text-primary">{m.remitenteNombre}</p>}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-xs leading-relaxed shadow-sm',
                      m.enviadoPorMi ? 'bg-primary text-white' : 'bg-muted text-foreground',
                    )}
                  >
                    <p>{m.contenido}</p>
                  </div>
                </div>
              </div>
            ))}

          {/* Hilo de Soporte */}
          {activeTab === 'soporte' && selectedSoporteId && (
            <Conversacion mensajeId={selectedSoporteId} soyEstudiante locale={locale} textos={{
              escribir: 'Escribe tu consulta...', enviar: 'Enviar', adjuntar: 'Adjuntar',
              responder: 'Responder', reaccionar: 'Reaccionar', cancelar: 'Cancelar',
              vacio: 'Sin mensajes', cargando: 'Cargando...', respondiendoA: 'Respondiendo a',
              maxArchivos: 'Max 5', errorCargar: 'Error', errorEnviar: 'Error', errorReaccionar: 'Error',
            }} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Cita Activa */}
        {citandoMensaje && (
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/40 px-4 py-1.5 text-xs">
            <div className="truncate border-l-2 border-primary pl-2 text-muted-foreground">
              <span className="font-bold text-primary">{citandoMensaje.autor}: </span>
              <span>{citandoMensaje.texto}</span>
            </div>
            <button type="button" onClick={() => setCitandoMensaje(null)}>
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Popover de Emojis categorizado */}
        {mostrarEmojiPicker && (
          <div className="absolute bottom-16 right-16 z-50">
            <EmojiPickerPopover
              onSelectEmoji={(emoji) => setBorrador((prev) => prev + emoji)}
              onClose={() => setMostrarEmojiPicker(false)}
            />
          </div>
        )}

        {/* Grabador de Notas de Voz */}
        {grabandoAudio ? (
          <div className="border-t border-border/60 bg-muted/40 p-3">
            <VoiceNoteRecorder
              onSendAudio={(blob, sec) => void handleSendAudioNote(blob, sec)}
              onCancel={() => setGrabandoAudio(false)}
            />
          </div>
        ) : (
          /* BARRA MULTIMEDIA MESSENGER (Mic | Media | Sticker | Input Aa | Emoji | Heart) */
          activeTab !== 'soporte' && (
            <footer className="border-t border-border/60 bg-card p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleEnviar()
                }}
                className="flex items-center gap-2"
              >
                {/* 🎙️ Botón Micrófono Nota de Voz */}
                <button
                  type="button"
                  onClick={() => setGrabandoAudio(true)}
                  className="flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted"
                  title="Nota de voz"
                >
                  <Microphone className="size-5" />
                </button>

                {/* 🖼️ Botón Foto / Archivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setArchivosAdjuntos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted"
                  title="Adjuntar multimedia"
                >
                  <Image className="size-5" />
                </button>

                {/* 🏷️ Botón Stickers */}
                <button
                  type="button"
                  onClick={() => void handleEnviar('🏷️ Sticker')}
                  className="flex size-8 items-center justify-center rounded-full text-primary hover:bg-muted"
                  title="Stickers"
                >
                  <Sticker className="size-5" />
                </button>

                {/* Campo de Texto Aa */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    disabled={contactoBloqueado}
                    placeholder={contactoBloqueado ? 'Contacto bloqueado.' : 'Aa'}
                    className="w-full rounded-full border border-input bg-muted/50 py-2 pl-4 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {/* 😊 Icono Emoji en la esquina del input */}
                  <button
                    type="button"
                    onClick={() => setMostrarEmojiPicker((prev) => !prev)}
                    className="absolute right-2 top-2 flex size-6 items-center justify-center text-primary hover:scale-110"
                    title="Buscador de Emojis"
                  >
                    <Smiley className="size-4" />
                  </button>
                </div>

                {/* ❤️ Reacción Rápida de Corazón si no hay texto, o Enviar si hay texto */}
                {borrador.trim() || archivosAdjuntos.length > 0 ? (
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow hover:brightness-110"
                  >
                    <PaperPlaneTilt className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendHeart}
                    className="flex size-9 items-center justify-center rounded-full text-rose-500 hover:scale-125 transition"
                    title="Enviar Me Gusta"
                  >
                    <Heart className="size-6" weight="fill" />
                  </button>
                )}
              </form>
            </footer>
          )
        )}
      </main>

      {/* ── COLUMNA 3: PANEL DERECHO DE INFORMACIÓN Y DETALLES DEL CHAT ──────────── */}
      {mostrarSidebarInfo && (
        <aside className="w-72 flex-col border-l border-border/60 bg-muted/30 p-4 space-y-5 overflow-y-auto hidden lg:flex">
          {/* Avatar Grande & Nombre */}
          <div className="flex flex-col items-center text-center space-y-2 border-b border-border/40 pb-4">
            {selectedContactoFoto ? (
              <img src={selectedContactoFoto} alt="" className="size-20 rounded-full object-cover shadow-lg" />
            ) : selectedGrupoFoto ? (
              <img src={selectedGrupoFoto} alt="" className="size-20 rounded-full object-cover shadow-lg" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
                {selectedContactoNombre[0] || 'C'}
              </div>
            )}
            <h4 className="text-sm font-bold text-foreground">
              {activeTab === 'grupos' ? selectedGrupoNombre : (selectedContactoNombre || 'Soporte CAC')}
            </h4>
            {/* No decimos «cifrado de extremo a extremo»: no lo es. Los
                mensajes se guardan en la base del programa y lo que alguien
                reporta llega al equipo con una copia. Prometer un cifrado que
                no existe puede hacer que alguien cuente aquí algo que no
                contaría, y eso es peor que no decir nada. */}
            <span className="rounded-full bg-muted px-3 py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
              {english
                ? 'Private conversation. Reports reach the team.'
                : 'Conversación privada. Lo que reportes llega al equipo.'}
            </span>
          </div>

          {/* Aquí había tres accesos rápidos —Perfil, Silenciar, Buscar— sin
              nada detrás: ninguno tenía onClick. Silenciar además no existe en
              el backend. Se quitan en vez de dejarlos apagados: un botón que no
              responde se prueba una vez y enseña que la pantalla no es de fiar.
              Las acciones que sí funcionan están en los acordeones de abajo. */}

          {/* Acordeones de Configuración */}
          <div className="space-y-3 text-xs">
            {/* Personalizar Chat / Temas */}
            <div className="space-y-2 border-b border-border/40 pb-3">
              <p className="font-bold text-foreground">Personalizar chat</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTemaChatFondo('predeterminado')}
                  className={cn('size-6 rounded-full bg-card border-2', temaChatFondo === 'predeterminado' ? 'border-primary' : 'border-border')}
                  title="Predeterminado"
                />
                <button
                  type="button"
                  onClick={() => setTemaChatFondo('patron_rojo')}
                  className={cn('size-6 rounded-full bg-rose-600 border-2', temaChatFondo === 'patron_rojo' ? 'border-primary' : 'border-border')}
                  title="Patrón Rojo Messenger"
                />
                <button
                  type="button"
                  onClick={() => setTemaChatFondo('mar')}
                  className={cn('size-6 rounded-full bg-blue-600 border-2', temaChatFondo === 'mar' ? 'border-primary' : 'border-border')}
                  title="Azul Mar"
                />
                <button
                  type="button"
                  onClick={() => setTemaChatFondo('esmeralda')}
                  className={cn('size-6 rounded-full bg-emerald-600 border-2', temaChatFondo === 'esmeralda' ? 'border-primary' : 'border-border')}
                  title="Esmeralda"
                />
              </div>
            </div>

            {/* Miembros (si es grupo) */}
            {activeTab === 'grupos' && (
              <div className="border-b border-border/40 pb-3">
                <button
                  type="button"
                  onClick={() => void abrirMiembros()}
                  className="flex w-full items-center justify-between font-bold text-foreground hover:text-primary"
                >
                  <span>Miembros del grupo</span>
                  <UsersThree className="size-4" />
                </button>
              </div>
            )}

            {/* Privacidad y Ayuda (Bloquear / Reportar) */}
            <div className="space-y-2 pt-1">
              <p className="font-bold text-foreground">Privacidad y ayuda</p>
              {selectedContactoId && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleBloqueo()}
                    className="block w-full text-left font-semibold text-rose-400 hover:underline"
                  >
                    {contactoBloqueado ? 'Desbloquear compañero' : 'Bloquear compañero'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalReportar(true)}
                    className="block w-full text-left font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Reportar conversación
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ── MODALES (Crear Grupo, Miembros, Reenviar, Reportar) ──────────────── */}
      {modalCrearGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-muted/40 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Crear Nuevo Grupo</h3>
              <button type="button" onClick={() => setModalCrearGrupo(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={nombreNuevoGrupo}
                onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                placeholder="Nombre del Grupo"
                className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none"
              />
              <input
                type="text"
                value={descNuevoGrupo}
                onChange={(e) => setDescNuevoGrupo(e.target.value)}
                placeholder="Descripción (Opcional)"
                className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none"
              />
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-border bg-card p-2">
                {contactosParaGrupo.map((c) => {
                  const sel = miembrosSeleccionados.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setMiembrosSeleccionados((prev) => (sel ? prev.filter((i) => i !== c.id) : [...prev, c.id]))}
                      className={cn('flex w-full items-center justify-between rounded-lg p-1.5 text-xs', sel ? 'bg-primary/20 text-primary' : 'hover:bg-muted')}
                    >
                      <span>{c.nombre}</span>
                      {sel && <Check className="size-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCrearGrupo()}
                disabled={!nombreNuevoGrupo.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-white shadow disabled:opacity-50"
              >
                Crear Grupo
              </button>
              <button type="button" onClick={() => setModalCrearGrupo(false)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Miembros */}
      {modalMiembros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-muted/40 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Miembros del Grupo ({miembrosGrupo.length})</h3>
              <button type="button" onClick={() => setModalMiembros(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-card p-2">
              {miembrosGrupo.map((m) => (
                <div key={m.estudianteId} className="flex items-center justify-between p-1.5 text-xs">
                  <span className="font-semibold text-foreground">{m.nombre}</span>
                  {m.esAdmin && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">Admin</span>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setModalMiembros(false)} className="w-full rounded-xl bg-muted py-2 text-xs font-bold text-foreground">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Reenviar */}
      {modalReenviar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-muted/40 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Reenviar a...</h3>
              <button type="button" onClick={() => setModalReenviar(false)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {conversaciones.map((c) => (
                <button
                  key={c.contactoId}
                  type="button"
                  onClick={() => void handleReenviar(c.contactoId)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
                >
                  <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
