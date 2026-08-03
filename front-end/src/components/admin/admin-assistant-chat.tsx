'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightIcon as ArrowRight, BuildingsIcon as Buildings, CircleNotchIcon as CircleNotch, CompassIcon as Compass, FileCsvIcon as FileCsv, GearIcon as Gear, PaperPlaneTiltIcon as PaperPlaneTilt, SparkleIcon as Sparkle, TrashIcon as Trash, UsersIcon as Users, XIcon as X } from '@phosphor-icons/react'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'

interface AccionNavegacion {
  etiqueta: string
  url: string
}

interface RespuestaBackend {
  respuesta: string
  accionNavegacion?: AccionNavegacion | null
  sugerencias?: string[]
}

type Author = 'bot' | 'user'
type Message = {
  id: string
  author: Author
  text: string
  accionNavegacion?: AccionNavegacion | null
  createdAt: number
}

const STORAGE_KEY = 'cac_admin_help_chat'

export function AdminAssistantChat() {
  const router = useRouter()
  const pathname = usePathname()
  const { locale } = usePreferences()
  const english = locale === 'en'
  const storageKey = `${STORAGE_KEY}_${locale}`

  const labels = useMemo(
    () =>
      english
        ? {
            title: 'Nova AI, Admin Assistant',
            subtitle: 'Navigation & Support · Online',
            greeting:
              'Hello! I am Nova AI, your administration assistant. How can I help you manage NOVA-CRM today?',
            placeholder: 'Ask a question or request a page...',
            send: 'Send',
            clear: 'Clear chat',
            quickActions: 'Quick Shortcuts',
            suggestions: [
              'How do I import students from Excel?',
              'Where can I view active job vacancies?',
              'How do I configure email and WhatsApp?',
            ],
            typingText: 'Nova AI is thinking...',
          }
        : {
            title: 'Nova AI, Asistente de Administración',
            subtitle: 'Navegación y Soporte · En línea',
            greeting:
              '¡Hola! Soy Nova AI, tu asistente administrativo. ¿En qué puedo ayudarte a gestionar o a qué sección deseas ir hoy?',
            placeholder: 'Haz una pregunta o solicita una sección...',
            send: 'Enviar',
            clear: 'Limpiar conversación',
            quickActions: 'Accesos Rápidos',
            suggestions: [
              '¿Cómo importo estudiantes desde Excel?',
              '¿Dónde veo las vacantes activas?',
              '¿Dónde configuro el correo y WhatsApp?',
            ],
            typingText: 'Nova AI está pensando...',
          },
    [english],
  )

  const quickShortcuts = useMemo(
    () => [
      { id: 'students', icon: Users, label: english ? 'Students' : 'Estudiantes', route: '/estudiantes' },
      { id: 'vacancies', icon: Buildings, label: english ? 'Vacancies' : 'Vacantes', route: '/vacantes' },
      { id: 'import', icon: FileCsv, label: english ? 'Excel Import' : 'Importar Excel', route: '/importar' },
      { id: 'config', icon: Gear, label: english ? 'Settings' : 'Configuración', route: '/configuracion' },
    ],
    [english],
  )

  const [open, setOpen] = useState(false)
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
      if (chatRef.current?.contains(target) || triggerRef.current?.contains(target)) return
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

      if (!res.ok) throw new Error('API Error')
      const data: RespuestaBackend = await res.json()

      setMessages((actual) => [
        ...actual,
        {
          id: `bot-${Date.now()}`,
          author: 'bot',
          text: data.respuesta || labels.greeting,
          accionNavegacion: data.accionNavegacion,
          createdAt: Date.now(),
        },
      ])
    } catch {
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
        navAction = { etiqueta: english ? 'Open Importer' : 'Abrir Importador', url: '/importar' }
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
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
      {open && (
        <section
          ref={chatRef}
          aria-label={labels.title}
          className="mb-3 flex h-[min(72dvh,620px)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-[0_28px_70px_rgba(0,0,0,0.32)] dark:bg-[#090d16]"
        >
          {/* Header */}
          <header className="relative overflow-hidden border-b border-primary/15 bg-[linear-gradient(125deg,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_65%)] px-4 py-3.5 dark:bg-[#0f172a]">
            <div className="absolute -right-5 -top-8 size-28 rounded-full bg-primary/10 blur-2xl dark:hidden" />
            <div className="relative flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-primary shadow-lg ring-1 ring-primary/20"
              >
                <Sparkle className="size-5 animate-pulse" weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{labels.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {labels.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={limpiar}
                title={labels.clear}
                aria-label={labels.clear}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground dark:hover:bg-[#090d16]"
              >
                <Trash className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground dark:hover:bg-[#090d16]"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* Mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_3%,transparent),transparent_34%)] p-4 dark:bg-[#090d16]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex flex-col', message.author === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm',
                    message.author === 'bot'
                      ? 'rounded-tl-md border border-border bg-card text-foreground dark:bg-[#0f172a]'
                      : 'rounded-tr-md bg-primary text-primary-foreground',
                  )}
                >
                  {message.text}
                </div>

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
              </div>
            ))}

            {typing && (
              <div className="flex">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground dark:bg-[#0f172a]">
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
          <div className="border-t border-border bg-card p-3 dark:bg-[#0f172a]">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                enviar()
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={labels.placeholder}
                maxLength={500}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 dark:bg-[#090d16]"
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
      )}

      {/* Botón Flotante de Activación */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((val) => !val)}
        aria-label={open ? 'Close Assistant' : labels.title}
        title={open ? 'Close Assistant' : labels.title}
        className="group relative flex size-14 items-center justify-center overflow-hidden rounded-[1.15rem] bg-primary text-primary-foreground shadow-[0_16px_34px_-12px_color-mix(in_srgb,var(--primary)_80%,transparent)] ring-1 ring-primary/25 transition hover:scale-105 hover:ring-primary/45 active:scale-95"
      >
        <span className="absolute inset-0 rounded-[1.15rem] bg-primary/30 blur-lg transition group-hover:blur-xl" />
        <Compass className="relative size-7 text-primary-foreground transition-transform duration-300 group-hover:rotate-45" weight="duotone" />
      </button>
    </div>
  )
}
