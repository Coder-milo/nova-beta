'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightIcon as ArrowRight, BuildingsIcon as Buildings, CircleNotchIcon as CircleNotch, CompassIcon as Compass, FileCsvIcon as FileCsv, GearIcon as Gear, PaperPlaneTiltIcon as PaperPlaneTilt, SparkleIcon as Sparkle, TrashIcon as Trash, UsersIcon as Users, XIcon as X } from '@phosphor-icons/react'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { ZorroAsistente } from '@/components/ui/zorro-asistente'
import { usarAnclaDelZorro } from '@/components/ui/usar-ancla-del-zorro'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

interface AccionNavegacion {
  etiqueta: string
  url: string
}

interface PlanAccion {
  tipo: 'MOVER_ESTUDIANTE' | 'CAMBIAR_COLOR' | 'CAMBIAR_TEMA' | 'ABRIR_IMPORTACION'
  titulo: string
  descripcion: string
  parametros: Record<string, any>
  ejecutado?: boolean
}

interface RespuestaBackend {
  respuesta: string
  accionNavegacion?: AccionNavegacion | null
  sugerencias?: string[]
  planAccion?: PlanAccion | null
}

type Author = 'bot' | 'user'
type Message = {
  id: string
  author: Author
  text: string
  accionNavegacion?: AccionNavegacion | null
  sugerencias?: string[]
  planAccion?: PlanAccion | null
  createdAt: number
}

const STORAGE_KEY = 'cac_admin_help_chat'

/** Se distingue del resto de fallos para no responderle con texto local. */
class SesionCaducada extends Error {}

export function AdminAssistantChat() {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setTheme } = usePreferences()
  const english = locale === 'en'
  const storageKey = `${STORAGE_KEY}_${locale}`

  /**
   * Qué planes cambian algo de verdad y cuáles sólo llevan a la pantalla.
   *
   * La diferencia importa porque el botón dice «Confirmar y ejecutar» y la
   * tarjeta se marca «Ejecutado»: prometer un cambio que no ocurre es peor que
   * no ofrecerlo. El tema lo puede cambiar el cliente porque es una preferencia
   * de quien mira. La gama de marca no: es un ajuste del proyecto que se guarda
   * en el servidor y que ven todos sus estudiantes. Y mover a un estudiante
   * necesita saber a cuál, que es justo lo que una frase suelta no dice.
   */
  const PLANES_QUE_EJECUTAN: PlanAccion['tipo'][] = ['CAMBIAR_TEMA']

  const ejecutarPlan = (mensajeId: string, plan: PlanAccion) => {
    try {
      if (plan.tipo === 'CAMBIAR_TEMA') {
        setTheme((plan.parametros.mode ?? 'dark') as 'dark' | 'light')
      } else if (plan.tipo === 'MOVER_ESTUDIANTE') {
        // Se lleva la columna en la URL para no perder lo que se pidió.
        const estado = String(plan.parametros.estado ?? '')
        router.push(estado ? `/seguimiento?estado=${estado}` : '/seguimiento')
      } else if (plan.tipo === 'CAMBIAR_COLOR') {
        router.push('/configuracion')
      } else if (plan.tipo === 'ABRIR_IMPORTACION') {
        router.push('/importaciones')
      }

      // Sólo se marca lo que de verdad se ejecutó. Navegar no es ejecutar, y
      // la tarjeta desaparece en ese caso porque la pantalla ya cambió.
      setMessages((actual) =>
        actual.map((m) =>
          m.id === mensajeId && m.planAccion
            ? {
                ...m,
                planAccion: PLANES_QUE_EJECUTAN.includes(plan.tipo)
                  ? { ...m.planAccion, ejecutado: true }
                  : null,
              }
            : m,
        ),
      )
    } catch (e) {
      console.error('Error al ejecutar plan:', e)
    }
  }

  const cancelarPlan = (mensajeId: string) => {
    setMessages((actual) =>
      actual.map((m) =>
        m.id === mensajeId ? { ...m, planAccion: null } : m,
      ),
    )
  }

  const labels = useMemo(
    () =>
      english
        ? {
            title: 'Nova AI, Admin Assistant',
            subtitle: 'Navigation & Support · Online',
            greeting:
              'Hello! I am Nova AI. I can take you to any module, explain how each CRM field should be filled in and why it matters, and help you read what the reports are telling you. How can I help?',
            placeholder: 'Ask about a section, a field or your data...',
            send: 'Send',
            clear: 'Clear chat',
            quickActions: 'Quick Shortcuts',
            suggestions: [
              'What goes in the target role field?',
              'Why does matching recommend so few vacancies?',
              'How do I import students from Excel?',
            ],
            typingText: 'Nova AI is thinking...',
          }
        : {
            title: 'Nova AI, Asistente de Administración',
            subtitle: 'Navegación y Soporte · En línea',
            greeting:
              '¡Hola! Soy Nova AI. Puedo llevarte a cualquier módulo, explicarte cómo se llena cada campo del CRM y por qué importa, y ayudarte a interpretar lo que muestran los informes. ¿En qué te ayudo?',
            placeholder: 'Pregunta por una sección, un campo o tus datos...',
            send: 'Enviar',
            clear: 'Limpiar conversación',
            quickActions: 'Accesos Rápidos',
            suggestions: [
              '¿Qué pongo en cargo objetivo?',
              '¿Por qué el matching recomienda pocas vacantes?',
              '¿Cómo importo estudiantes desde Excel?',
            ],
            typingText: 'Nova AI está pensando...',
          },
    [english],
  )

  const quickShortcuts = useMemo(
    () => [
      { id: 'students', icon: Users, label: english ? 'Students' : 'Estudiantes', route: '/estudiantes' },
      { id: 'vacancies', icon: Buildings, label: english ? 'Vacancies' : 'Vacantes', route: '/vacantes' },
      { id: 'import', icon: FileCsv, label: english ? 'Excel Import' : 'Importar Excel', route: '/importaciones' },
      { id: 'config', icon: Gear, label: english ? 'Settings' : 'Configuración', route: '/configuracion' },
    ],
    [english],
  )

  const [open, setOpen] = useState(false)
  // El panel sale del lado en el que esté el zorro; si no, se abriría
  // cruzando la pantalla desde el otro extremo.
  const [ladoZorro, setLadoZorro] = useState<'izquierda' | 'derecha'>('derecha')
  const [zorroY, setZorroY] = useState(0)
  const anclaAbajo = usarAnclaDelZorro(zorroY)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      const parsed = saved ? (JSON.parse(saved) as Message[]) : []
      setMessages(
        parsed.length
          ? parsed
          : [{ id: 'welcome', author: 'bot', text: labels.greeting, createdAt: Date.now() }],
      )
    } catch {
      setMessages([{ id: 'welcome', author: 'bot', text: labels.greeting, createdAt: Date.now() }])
    }
  }, [labels.greeting, storageKey])

  useEffect(() => {
    if (messages.length) window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)))
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, storageKey, typing])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (chatRef.current?.contains(target) || (target as HTMLElement)?.closest?.('button[aria-expanded]')) return
      setOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [open])

  const enviar = async (value = draft) => {
    const question = value.trim()
    if (!question || typing) return
    const now = Date.now()

    setMessages((actual) => [
      ...actual,
      { id: `user-${now}`, author: 'user', text: question, createdAt: now },
    ])
    setDraft('')
    setTyping(true)

    try {
      const res = await fetch('/api/v1/ia/asistente-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: question, rutaActual: pathname }),
      })

      // Una sesión caducada no se puede tapar con la respuesta local: el
      // fallback de abajo contestaría como si nada y quien administra seguiría
      // escribiendo a un panel en el que ya no está dentro.
      if (res.status === 401) throw new SesionCaducada()
      if (!res.ok) throw new Error('API Error')
      const data: RespuestaBackend = await res.json()

      setMessages((actual) => [
        ...actual,
        {
          id: `bot-${Date.now()}`,
          author: 'bot',
          text: data.respuesta || labels.greeting,
          accionNavegacion: data.accionNavegacion,
          sugerencias: data.sugerencias,
          planAccion: data.planAccion,
          createdAt: Date.now(),
        },
      ])
    } catch (error) {
      if (error instanceof SesionCaducada) {
        setMessages((actual) => [
          ...actual,
          {
            id: `bot-${Date.now()}`,
            author: 'bot',
            text: english
              ? 'Your session expired. Sign in again to keep using the assistant.'
              : 'Tu sesión expiró. Vuelve a iniciar sesión para seguir usando el asistente.',
            createdAt: Date.now(),
          },
        ])
        // El `finally` de abajo apaga el indicador de escritura.
        return
      }

      // Fallback local en frontend si la API del proxy o red falla
      const textLower = question.toLowerCase()
      let navAction: AccionNavegacion | null = null
      let botResponse = english
        ? 'I can guide you to any section of NOVA-CRM. Try one of the quick shortcuts below.'
        : 'Puedo orientarte sobre cualquier sección de NOVA-CRM. Prueba una de las acciones rápidas.'

      if (textLower.includes('estudiante') || textLower.includes('alumno')) {
        botResponse = english
          ? 'In the Students module you can manage all enrolled candidates and download their CVs.'
          : 'En el módulo de Estudiantes puedes gestionar a los candidatos inscritos y descargar sus HVs.'
        navAction = { etiqueta: english ? 'Go to Students' : 'Ir a Estudiantes', url: '/estudiantes' }
      } else if (textLower.includes('vacan') || textLower.includes('empleo') || textLower.includes('oferta')) {
        botResponse = english
          ? 'In Job Vacancies you can publish offers and run the intelligent matching engine.'
          : 'En Vacantes puedes publicar ofertas y ejecutar el motor de coincidencia inteligente.'
        navAction = { etiqueta: english ? 'Go to Vacancies' : 'Ir a Vacantes', url: '/vacantes' }
      } else if (textLower.includes('excel') || textLower.includes('import')) {
        botResponse = english
          ? 'The Excel Importer maps columns dynamically to load students and vacancies.'
          : 'El Importador Excel mapea columnas dinámicamente para cargar estudiantes y vacantes.'
        navAction = { etiqueta: english ? 'Open Importer' : 'Abrir Importaciones', url: '/importaciones' }
      } else if (textLower.includes('configur') || textLower.includes('correo') || textLower.includes('whatsapp')) {
        botResponse = english
          ? 'Go to Settings to adjust branding, SMTP/SES email credentials, and integrations.'
          : 'En Configuración ajustas marca, credenciales SMTP/SES de correo e integraciones.'
        navAction = { etiqueta: english ? 'Go to Settings' : 'Ir a Configuración', url: '/configuracion' }
      }

      setMessages((actual) => [
        ...actual,
        {
          id: `bot-${Date.now()}`,
          author: 'bot',
          text: botResponse,
          accionNavegacion: navAction,
          createdAt: Date.now(),
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const limpiar = () =>
    setMessages([
      { id: `welcome-${Date.now()}`, author: 'bot', text: labels.greeting, createdAt: Date.now() },
    ])

  const navegar = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <>
      <div
        // La altura sale del zorro: el panel termina donde esta el personaje
        // que lo abre, sin subirse a la cabecera. En movil sigue anclado abajo.
        style={anclaAbajo}
        className={cn(
          'pointer-events-none fixed z-40 flex flex-col transition-all duration-300',
          'bottom-20 inset-x-3 sm:inset-auto sm:bottom-6',
          ladoZorro === 'derecha'
            ? 'sm:right-24 sm:left-auto sm:items-end'
            : 'sm:left-24 sm:right-auto sm:items-start',
        )}
      >
        {/* Ventana Chat con Animación Gota / macOS Spring Scale */}
        <section
          ref={chatRef}
          aria-label={labels.title}
          className={cn(
            'flex h-[min(70dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border/80 bg-popover/95 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu dark:border-primary/20',
            ladoZorro === 'derecha' ? 'origin-bottom-right' : 'origin-bottom-left',
            open
              ? 'pointer-events-auto scale-100 opacity-100 translate-y-0 translate-x-0 blur-none'
              : 'pointer-events-none scale-0 opacity-0 translate-y-12 blur-sm',
          )}
        >
        {/* Header */}
        <header className="relative overflow-hidden border-b border-primary/15 bg-[linear-gradient(125deg,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_65%)] px-4 py-3.5">
          <div className="absolute -right-5 -top-8 size-28 rounded-full bg-primary/10 blur-2xl dark:hidden" />
          <div className="relative flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-primary shadow-lg ring-1 ring-primary/20"
            >
              <Sparkle className="size-5 animate-pulse" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{labels.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="size-1.5 rounded-full bg-emerald-500 -ml-3" />
                {labels.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={limpiar}
              title={labels.clear}
              aria-label={labels.clear}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
            >
              <Trash className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Mensajes */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_3%,transparent),transparent_34%)] p-4">
          {messages.map((message, indice) => (
            <div
              key={message.id}
              className={cn('flex flex-col', message.author === 'user' ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm',
                  message.author === 'bot'
                    ? 'rounded-tl-md border border-border bg-card text-foreground'
                    : 'rounded-tr-md bg-primary text-primary-foreground',
                )}
              >
                {message.text}
              </div>

              {/* Tarjeta de Plan de Acción con Confirmación */}
              {message.author === 'bot' && message.planAccion && (
                <div className="mt-2.5 w-full max-w-[92%] rounded-2xl border border-primary/30 bg-card p-3 shadow-md">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Sparkle className="size-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {english ? 'Proposed Action Plan' : 'Plan de Acción Propuesto'}
                    </span>
                    {message.planAccion.ejecutado && (
                      <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ {english ? 'Executed' : 'Ejecutado'}
                      </span>
                    )}
                  </div>
                  <div className="py-2">
                    <h4 className="text-xs font-semibold text-foreground">{message.planAccion.titulo}</h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-4">{message.planAccion.descripcion}</p>
                  </div>
                  {!message.planAccion.ejecutado ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => ejecutarPlan(message.id, message.planAccion!)}
                        className="flex-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-95"
                      >
                        {PLANES_QUE_EJECUTAN.includes(message.planAccion.tipo)
                          ? (english ? 'Confirm & Execute' : 'Confirmar y Ejecutar')
                          : (english ? 'Take me there' : 'Llévame allí')}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelarPlan(message.id)}
                        className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                      >
                        {english ? 'Cancel' : 'Cancelar'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {english ? 'Action completed successfully.' : 'Acción completada con éxito.'}
                    </p>
                  )}
                </div>
              )}

              {/* Botón de acción de navegación en la respuesta de la IA */}
              {message.author === 'bot' && message.accionNavegacion && (
                <button
                  type="button"
                  onClick={() => navegar(message.accionNavegacion!.url)}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 hover:shadow-md"
                >
                  <span>{message.accionNavegacion.etiqueta}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}

              {/* Solo las del último mensaje: las de mensajes viejos ya no
                  vienen a cuento y llenarían el hilo de botones muertos. */}
              {message.author === 'bot' &&
                indice === messages.length - 1 &&
                !!message.sugerencias?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.sugerencias.map((sugerencia) => (
                      <button
                        key={sugerencia}
                        type="button"
                        onClick={() => enviar(sugerencia)}
                        className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/15"
                      >
                        {sugerencia}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}

          {typing && (
            <div className="flex">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
                <CircleNotch className="size-3.5 animate-spin text-primary" />
                {labels.typingText}
              </div>
            </div>
          )}

          {/* Atajos Rápidos */}
          {messages.length <= 2 && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {labels.quickActions}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickShortcuts.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navegar(item.route)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 text-left text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/[0.05]"
                    >
                      <Icon className="size-4 text-primary shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {labels.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => enviar(suggestion)}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/15"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Formulario de Entrada */}
        <div className="border-t border-border bg-card p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              enviar()
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void enviar()
                }
              }}
              placeholder={labels.placeholder}
              maxLength={500}
              minRows={1}
              maxRows={4}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={!draft.trim() || typing}
              aria-label={labels.send}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-45"
            >
              <PaperPlaneTilt className="size-4" weight="fill" />
            </button>
          </form>
        </div>
      </section>
    </div>

    <ZorroAsistente
      abierto={open}
      onToggle={() => setOpen((val) => !val)}
      etiqueta={open ? (english ? 'Close assistant' : 'Cerrar asistente') : labels.title}
      claveStorage="nova-crm:zorro-posicion-admin"
      onLadoChange={setLadoZorro}
      onPosicionChange={(p) => setZorroY(p.y)}
    />
  </>
)
}
