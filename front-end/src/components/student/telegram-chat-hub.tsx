'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowBendUpLeftIcon as ArrowBendUpLeft,
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
  ChecksIcon as Checks,
  CircleNotchIcon as CircleNotch,
  DotsThreeVerticalIcon as DotsThreeVertical,
  MagnifyingGlassIcon as MagnifyingGlass,
  PencilSimpleIcon as PencilSimple,
  PlusIcon as Plus,
  ShareFatIcon as ShareFat,
  SmileyIcon as Smiley,
  TrashIcon as Trash,
  UserPlusIcon as UserPlus,
  UsersThreeIcon as UsersThree,
  XIcon as X,
  PaperPlaneTiltIcon as PaperPlaneTilt,
} from '@phosphor-icons/react'
import { chatsApi, gruposApi, mensajesApi, EMOJIS_REACCION, mensajeDeError } from '@/lib/api'
import type {
  ChatContactoResponse,
  ChatConversacionResponse,
  ChatDirectoMensajeResponse,
  ChatGrupoResponse,
  ChatGrupoMensajeResponse,
  MensajeResponse,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Conversacion } from '@/components/ui/conversacion'

type TabType = 'directos' | 'grupos' | 'soporte'

interface Props {
  locale?: 'es' | 'en'
}

export function TelegramChatHub({ locale = 'es' }: Props) {
  const english = locale === 'en'

  const [activeTab, setActiveTab] = useState<TabType>('directos')
  const [conversaciones, setConversaciones] = useState<ChatConversacionResponse[]>([])
  const [grupos, setGrupos] = useState<ChatGrupoResponse[]>([])
  const [soporteHilos, setSoporteHilos] = useState<MensajeResponse[]>([])
  
  const [selectedContactoId, setSelectedContactoId] = useState<string | null>(null)
  const [selectedContactoNombre, setSelectedContactoNombre] = useState<string>('')
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null)
  const [selectedGrupoNombre, setSelectedGrupoNombre] = useState<string>('')
  const [selectedSoporteId, setSelectedSoporteId] = useState<string | null>(null)

  const [mensajesDirectos, setMensajesDirectos] = useState<ChatDirectoMensajeResponse[]>([])
  const [mensajesGrupo, setMensajesGrupo] = useState<ChatGrupoMensajeResponse[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [busquedaResultados, setBusquedaResultados] = useState<ChatContactoResponse[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoMensajes, setCargandoMensajes] = useState(false)

  // Input de envío
  const [borrador, setBorrador] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Acciones en mensaje (Editar, Citar, Reenviar)
  const [editandoMensajeId, setEditandoMensajeId] = useState<string | null>(null)
  const [citandoMensaje, setCitandoMensaje] = useState<{ id: string; texto: string; autor: string } | null>(null)

  // Modales
  const [modalCrearGrupo, setModalCrearGrupo] = useState(false)
  const [nombreNuevoGrupo, setNombreNuevoGrupo] = useState('')
  const [descNuevoGrupo, setDescNuevoGrupo] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<string[]>([])
  const [contactosParaGrupo, setContactosParaGrupo] = useState<ChatContactoResponse[]>([])

  const [modalReenviar, setModalReenviar] = useState(false)
  const [mensajeAReenviarId, setMensajeAReenviarId] = useState<string | null>(null)

  const [modalReportar, setModalReportar] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [reportando, setReportando] = useState(false)

  /**
   * Lo que sale mal, dicho.
   *
   * Antes cada `catch` de esta pantalla iba a `console.error` y nada más: el
   * mensaje no se enviaba y quien escribía no se enteraba. En un reporte eso
   * es peor todavía —creer que has pedido ayuda y no haberla pedido—, así que
   * aquí se ve.
   */
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Cargar conversaciones iniciales
  const cargarBandejas = useCallback(async () => {
    setCargando(true)
    try {
      const [convs, grps, sop] = await Promise.all([
        chatsApi.conversaciones().catch(() => []),
        gruposApi.misGrupos().catch(() => []),
        mensajesApi.mios().catch(() => []),
      ])
      setConversaciones(convs)
      setGrupos(grps)
      setSoporteHilos(sop)
      if (convs.length && !selectedContactoId && activeTab === 'directos') {
        setSelectedContactoId(convs[0].contactoId)
        setSelectedContactoNombre(convs[0].nombre)
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

  // Cargar conversación directa seleccionada
  useEffect(() => {
    if (!selectedContactoId || activeTab !== 'directos') return
    let active = true
    setCargandoMensajes(true)
    chatsApi.conversacion(selectedContactoId)
      .then((msgs) => {
        if (active) setMensajesDirectos(msgs)
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })

    return () => { active = false }
  }, [selectedContactoId, activeTab])

  // Cargar grupo seleccionado
  useEffect(() => {
    if (!selectedGrupoId || activeTab !== 'grupos') return
    let active = true
    setCargandoMensajes(true)
    gruposApi.mensajes(selectedGrupoId)
      .then((msgs) => {
        if (active) setMensajesGrupo(msgs)
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCargandoMensajes(false) })

    return () => { active = false }
  }, [selectedGrupoId, activeTab])

  // Búsqueda dinámica de contactos
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setBusquedaResultados([])
      return
    }
    let active = true
    chatsApi.contactos(searchQuery.trim())
      .then((res) => {
        if (active) setBusquedaResultados(res)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [searchQuery])

  // Auto-scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesDirectos.length, mensajesGrupo.length])

  // Enviar mensaje directo o grupal
  const handleEnviar = async () => {
    const texto = borrador.trim()
    if (!texto || enviando) return
    setEnviando(true)

    try {
      if (editandoMensajeId) {
        // Editar mensaje directo
        const actualizado = await chatsApi.editar(editandoMensajeId, texto)
        setMensajesDirectos((prev) => prev.map((m) => (m.id === editandoMensajeId ? actualizado : m)))
        setEditandoMensajeId(null)
      } else if (activeTab === 'directos' && selectedContactoId) {
        // Nuevo mensaje directo
        const nuevo = await chatsApi.enviar(selectedContactoId, texto)
        setMensajesDirectos((prev) => [...prev, nuevo])
      } else if (activeTab === 'grupos' && selectedGrupoId) {
        // Nuevo mensaje grupal
        const nuevo = await gruposApi.enviar(selectedGrupoId, texto, citandoMensaje?.id)
        setMensajesGrupo((prev) => [...prev, nuevo])
      }
      setBorrador('')
      setCitandoMensaje(null)
      void cargarBandejas()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The message could not be sent.' : 'No se pudo enviar el mensaje.') })
    } finally {
      setEnviando(false)
    }
  }

  // Borrar mensaje
  const handleBorrar = async (id: string) => {
    try {
      await chatsApi.borrar(id)
      setMensajesDirectos((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The message could not be deleted.' : 'No se pudo borrar el mensaje.') })
    }
  }

  /**
   * Reporta al compañero de la conversación abierta.
   *
   * El motivo es opcional a propósito: obligar a explicarse por escrito, justo
   * cuando alguien acaba de recibir algo desagradable, hace que no se reporte.
   */
  const handleReportar = async () => {
    if (!selectedContactoId) return
    setReportando(true)
    try {
      await chatsApi.reportar(selectedContactoId, motivoReporte.trim())
      setModalReportar(false)
      setMotivoReporte('')
      setAviso({
        tipo: 'ok',
        texto: english
          ? 'Reported. The support team will review this conversation.'
          : 'Reportado. El equipo de acompañamiento va a revisar esta conversación.',
      })
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, english ? 'The report could not be sent.' : 'No se pudo enviar el reporte.') })
    } finally {
      setReportando(false)
    }
  }

  // Reenviar mensaje
  const handleReenviar = async (destinoId: string) => {
    if (!mensajeAReenviarId) return
    try {
      await chatsApi.reenviar(mensajeAReenviarId, destinoId)
      setModalReenviar(false)
      setMensajeAReenviarId(null)
      void cargarBandejas()
    } catch (e) {
      console.error(e)
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
      setActiveTab('grupos')
    } catch (e) {
      console.error(e)
    }
  }

  const abrirModalCrearGrupo = () => {
    setModalCrearGrupo(true)
    void chatsApi.contactos('a').then(setContactosParaGrupo).catch(() => undefined)
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[38rem] overflow-hidden rounded-2xl border border-border bg-card shadow-lg dark:bg-[#090d16]">
      {/* ── BARRA LATERAL IZQUIERDA ────────────────────────────────────────────── */}
      <aside className="flex w-80 flex-col border-r border-border bg-muted/20 dark:bg-[#0f172a]">
        {/* Pestañas Telegram */}
        <div className="flex border-b border-border p-2">
          <button
            type="button"
            onClick={() => setActiveTab('directos')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'directos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            💬 {english ? 'Direct' : 'Directos'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grupos')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'grupos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            👥 {english ? 'Groups' : 'Grupos'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('soporte')}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-semibold transition',
              activeTab === 'soporte' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            🎧 {english ? 'Support' : 'Soporte'}
          </button>
        </div>

        {/* Buscador de contactos */}
        <div className="p-3">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={english ? 'Search classmates...' : 'Buscar compañeros...'}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {searchQuery.trim().length >= 2 && (
          <div className="border-b border-border bg-background p-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {english ? 'Search Results' : 'Resultados de Búsqueda'}
            </p>
            {busquedaResultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedContactoId(c.id)
                  setSelectedContactoNombre(c.nombre)
                  setSearchQuery('')
                  setActiveTab('directos')
                }}
                className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-muted"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {c.nombre[0]}
                </div>
                <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {/* Botón "+ Crear Grupo" en la pestaña de grupos */}
        {activeTab === 'grupos' && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={abrirModalCrearGrupo}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <Plus className="size-4" />
              <span>{english ? 'New Group' : 'Crear Nuevo Grupo'}</span>
            </button>
          </div>
        )}

        {/* Lista de Chats / Conversaciones */}
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {activeTab === 'directos' &&
            conversaciones.map((conv) => (
              <button
                key={conv.contactoId}
                type="button"
                onClick={() => {
                  setSelectedContactoId(conv.contactoId)
                  setSelectedContactoNombre(conv.nombre)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedContactoId === conv.contactoId ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                  {conv.nombre[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-bold text-foreground">{conv.nombre}</p>
                    {conv.sinLeer > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {conv.sinLeer}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{conv.ultimoMensaje}</p>
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
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedGrupoId === g.id ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                  <UsersThree className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">{g.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{g.totalMiembros} {english ? 'members' : 'miembros'}</p>
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
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition',
                  selectedSoporteId === hilo.id ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-muted/60',
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-600 dark:text-amber-400">
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

      {/* ── ÁREA PRINCIPAL DE CONVERSACIÓN ────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Cabecera limpia sin duplicación de nombres */}
        <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3.5 shadow-sm dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
              {activeTab === 'directos' ? (selectedContactoNombre[0] || 'C') : activeTab === 'grupos' ? '👥' : '🎧'}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {activeTab === 'directos'
                  ? selectedContactoNombre || 'Selecciona un contacto'
                  : activeTab === 'grupos'
                  ? selectedGrupoNombre || 'Selecciona un grupo'
                  : 'Soporte y Acompañamiento CAC'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {activeTab === 'directos' ? (english ? 'Direct Chat' : 'Chat Directo') : activeTab === 'grupos' ? (english ? 'Group Chat' : 'Grupo de Estudio') : (english ? 'Official Support Channel' : 'Canal Oficial de Soporte')}
              </p>
            </div>
          </div>

          {/* Reportar. Solo con una conversación de dos abierta: en el canal de
              soporte se está hablando ya con el equipo, y un grupo necesita
              decir a quién se reporta, que no es lo mismo. */}
          {activeTab === 'directos' && selectedContactoId && (
            <button
              type="button"
              onClick={() => setModalReportar(true)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              title={english ? 'Report this conversation' : 'Reportar esta conversación'}
            >
              {english ? 'Report' : 'Reportar'}
            </button>
          )}
        </header>

        {aviso && (
          <div
            role="status"
            className={cn(
              'flex items-start justify-between gap-3 border-b px-5 py-2.5 text-xs',
              aviso.tipo === 'ok'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/25 bg-destructive/10 text-destructive',
            )}
          >
            <span>{aviso.texto}</span>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label={english ? 'Dismiss' : 'Cerrar aviso'}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Cuerpo del Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cargandoMensajes && (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              <CircleNotch className="mr-2 size-4 animate-spin text-primary" />
              {english ? 'Loading chat...' : 'Cargando conversación...'}
            </div>
          )}

          {/* Mensajes Directos */}
          {activeTab === 'directos' &&
            !cargandoMensajes &&
            mensajesDirectos.map((m) => (
              <div key={m.id} className={cn('group flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="relative max-w-[80%]">
                  {/* Menú flotante de acciones (Editar, Borrar, Citar, Reenviar) */}
                  <div
                    className={cn(
                      'absolute -top-3 z-10 hidden items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md group-hover:flex dark:bg-[#0f172a]',
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
                        title="Editar"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <PencilSimple className="size-3.5" />
                      </button>
                    )}
                    {m.enviadoPorMi && (
                      <button
                        type="button"
                        onClick={() => void handleBorrar(m.id)}
                        title="Borrar"
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCitandoMensaje({ id: m.id, texto: m.contenido, autor: m.remitenteNombre })}
                      title="Responder"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ArrowBendUpLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensajeAReenviarId(m.id)
                        setModalReenviar(true)
                      }}
                      title="Reenviar"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ShareFat className="size-3.5" />
                    </button>
                  </div>

                  {/* Burbuja de Mensaje */}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm',
                      m.enviadoPorMi
                        ? 'rounded-tr-xs bg-primary text-primary-foreground'
                        : 'rounded-tl-xs border border-border bg-card text-foreground dark:bg-[#0f172a]',
                    )}
                  >
                    {m.reenviado && (
                      <p className="mb-1 text-[10px] font-bold italic opacity-80">
                        ↪ {english ? 'Forwarded' : 'Reenviado'}
                      </p>
                    )}
                    <p>{m.contenido}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                      {m.editado && <span>({english ? 'edited' : 'editado'})</span>}
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {m.enviadoPorMi && (
                        m.leidoAt ? <Checks className="size-3 text-emerald-400" /> : <Check className="size-3" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Mensajes de Grupo */}
          {activeTab === 'grupos' &&
            !cargandoMensajes &&
            mensajesGrupo.map((m) => (
              <div key={m.id} className={cn('flex flex-col', m.enviadoPorMi ? 'items-end' : 'items-start')}>
                <div className="max-w-[80%]">
                  {!m.enviadoPorMi && <p className="mb-0.5 text-[10px] font-bold text-primary">{m.remitenteNombre}</p>}
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm',
                      m.enviadoPorMi
                        ? 'rounded-tr-xs bg-primary text-primary-foreground'
                        : 'rounded-tl-xs border border-border bg-card text-foreground dark:bg-[#0f172a]',
                    )}
                  >
                    <p>{m.contenido}</p>
                    <div className="mt-1 flex items-center justify-end text-[9px] opacity-75">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* Pestaña de Soporte Oficial */}
          {activeTab === 'soporte' && selectedSoporteId && (
            <div className="h-full">
              <Conversacion mensajeId={selectedSoporteId} soyEstudiante locale={locale} textos={{
                escribir: 'Escribe tu consulta al equipo...',
                enviar: 'Enviar',
                adjuntar: 'Adjuntar',
                responder: 'Responder',
                reaccionar: 'Reaccionar',
                cancelar: 'Cancelar',
                vacio: 'Sin mensajes.',
                cargando: 'Cargando hilo...',
                respondiendoA: 'Respondiendo a',
                maxArchivos: 'Máximo 5 archivos',
                errorCargar: 'Error al cargar',
                errorEnviar: 'Error al enviar',
                errorReaccionar: 'Error al reaccionar',
              }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Caja de cita activa */}
        {citandoMensaje && (
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-1.5 text-xs">
            <div className="truncate border-l-2 border-primary pl-2 text-muted-foreground">
              <span className="font-bold text-primary">{citandoMensaje.autor}: </span>
              <span>{citandoMensaje.texto}</span>
            </div>
            <button type="button" onClick={() => setCitandoMensaje(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar Estilo Telegram */}
        {activeTab !== 'soporte' && (
          <footer className="border-t border-border bg-card p-3 dark:bg-[#0f172a]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleEnviar()
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                placeholder={
                  editandoMensajeId
                    ? (english ? 'Edit message...' : 'Editar mensaje...')
                    : (english ? 'Write a message...' : 'Escribe un mensaje...')
                }
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!borrador.trim() || enviando}
                className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
              >
                <PaperPlaneTilt className="size-4" />
              </button>
            </form>
          </footer>
        )}
      </main>

      {/* ── MODAL: CREAR GRUPO ────────────────────────────────────────────────── */}
      {modalCrearGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{english ? 'Create New Group' : 'Crear Nuevo Grupo'}</h3>
              <button type="button" onClick={() => setModalCrearGrupo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Group Name' : 'Nombre del Grupo'}</label>
                <input
                  type="text"
                  value={nombreNuevoGrupo}
                  onChange={(e) => setNombreNuevoGrupo(e.target.value)}
                  placeholder="ej. Grupo de Estudio Cohorte 4"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Description' : 'Descripción (Opcional)'}</label>
                <input
                  type="text"
                  value={descNuevoGrupo}
                  onChange={(e) => setDescNuevoGrupo(e.target.value)}
                  placeholder="ej. Preparación para entrevistas de trabajo"
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">{english ? 'Add Members' : 'Añadir Miembros'}</label>
                <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-border bg-background p-2">
                  {contactosParaGrupo.map((c) => {
                    const selected = miembrosSeleccionados.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setMiembrosSeleccionados((prev) =>
                            selected ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                          )
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg p-1.5 text-xs transition',
                          selected ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-muted',
                        )}
                      >
                        <span>{c.nombre}</span>
                        {selected && <Check className="size-3.5 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCrearGrupo()}
                disabled={!nombreNuevoGrupo.trim()}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
              >
                {english ? 'Create Group' : 'Crear Grupo'}
              </button>
              <button
                type="button"
                onClick={() => setModalCrearGrupo(false)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                {english ? 'Cancel' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REENVIAR MENSAJE ───────────────────────────────────────────── */}
      {modalReenviar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">{english ? 'Forward Message to...' : 'Reenviar Mensaje a...'}</h3>
              <button type="button" onClick={() => setModalReenviar(false)} className="text-muted-foreground hover:text-foreground">
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
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {c.nombre[0]}
                  </div>
                  <span className="truncate text-xs font-semibold text-foreground">{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalReportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl dark:bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {english ? `Report ${selectedContactoNombre}` : `Reportar a ${selectedContactoNombre}`}
              </h3>
              <button type="button" onClick={() => setModalReportar(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {english
                ? 'The support team will see a copy of the latest messages in this conversation, so it stays available even if they are deleted afterwards.'
                : 'El equipo de acompañamiento verá una copia de los últimos mensajes de esta conversación, para que siga estando aunque después se borren.'}
            </p>

            <textarea
              value={motivoReporte}
              onChange={(e) => setMotivoReporte(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={english ? 'What happened? (optional)' : '¿Qué pasó? (opcional)'}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalReportar(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {english ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => void handleReportar()}
                disabled={reportando}
                className="rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {reportando
                  ? (english ? 'Sending…' : 'Enviando…')
                  : (english ? 'Report' : 'Reportar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
