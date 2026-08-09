
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenTextIcon as BookOpenText, CircleNotchIcon as CircleNotch, FileTextIcon as FileText, PaperPlaneTiltIcon as PaperPlaneTilt, SparkleIcon as Sparkle, TranslateIcon as Translate, TrashIcon as Trash, XIcon as X } from '@phosphor-icons/react'
import { usePathname, useRouter } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

type Author = 'bot' | 'student'
type NavigationAction = { etiqueta: string; url: string }
type AssistantResponse = { respuesta: string; accionNavegacion?: NavigationAction | null; sugerencias?: string[] }
type Message = { id: string; author: Author; text: string; createdAt: number; accionNavegacion?: NavigationAction | null; sugerencias?: string[] }
type Topic = { id: string; icon: typeof FileText; label: string; route?: string; question: string }

const STORAGE_KEY = 'cac_academic_help_chat'

/** Se distingue del resto de fallos para no responderle con texto local. */
class SesionCaducada extends Error {}

function responder(question: string, english: boolean) {
  const text = question.toLocaleLowerCase()
  if (text.includes('document') || text.includes('certif')) return english
    ? 'Open Documents to upload a PDF, image, certificate, or resume. Each file remains in your academic record and the team can review it.'
    : 'Abre Documentos para subir un PDF, imagen, certificado u hoja de vida. Cada archivo queda en tu expediente y el equipo puede revisarlo.'
  if (text.includes('calendar') || text.includes('event') || text.includes('calend') || text.includes('evento')) return english
    ? 'Go to Calendar to find events scheduled for your project. Select a marked day to see the time, category, and notes.'
    : 'Ve a Calendario para ver los eventos programados para tu proyecto. Selecciona un día marcado para consultar la hora, categoría y notas.'
  if (text.includes('linkedin')) return english
    ? 'Complete your LinkedIn link in Settings. If it is marked as pending, use the recommendation in My process and update your headline, summary, and experience.'
    : 'Completa el enlace de LinkedIn en Configuración. Si aparece pendiente, usa la recomendación de Mi proceso y actualiza tu titular, extracto y experiencia.'
  if (text.includes('job') || text.includes('vacan') || text.includes('postul') || text.includes('process') || text.includes('proceso')) return english
    ? 'My process shows your employability milestones and follow-up. Job applications contains opportunities matched to your profile and their current status.'
    : 'Mi proceso muestra tus hitos de empleabilidad y seguimiento. En Postulaciones encuentras oportunidades compatibles con tu perfil y el estado de cada aplicación.'
  if (text.includes('translat') || text.includes('traduc') || text.includes('in english') || text.includes('en inglés') || text.includes('en ingles')) return english
    ? 'Paste the phrase and I will give you the wording job ads actually use, which is not always the literal translation.'
    : 'Pégame la frase y te doy la forma en que se escribe de verdad en una oferta, que no siempre es la traducción literal.'
  if (text.includes('cv') || text.includes('resume') || text.includes('hoja de vida')) return english
    ? 'Paste your resume text here and I will tell you what to fix. You can also download it in the CAC Academic format from Resume.'
    : 'Pégame aquí el texto de tu hoja de vida y te digo qué corregir. También puedes descargarla en el formato CAC Academic desde Hoja de vida.'
  if (text.includes('message') || text.includes('help') || text.includes('mensaje') || text.includes('ayuda')) return english
    ? 'Use the Messages icon in the top bar to contact the support team. You can come back there to read their reply.'
    : 'Usa el icono de Mensajes de la barra superior para contactar al equipo de acompañamiento. Allí mismo podrás leer su respuesta.'
  return english
    ? 'I can guide you through documents, job applications, your employability process, calendar, resume, and support messages. Try one of the quick actions below.'
    : 'Puedo orientarte sobre documentos, postulaciones, tu proceso de empleabilidad, calendario, hoja de vida y mensajes de soporte. Prueba una de las acciones rápidas.'
}

export function StudentHelpChat() {
  const router = useRouter()
  const pathname = usePathname()
  const { locale } = usePreferences()
  const english = locale === 'en'
  const storageKey = `${STORAGE_KEY}_${locale}`
  const labels = useMemo(() => english ? {
    title: 'Alex, virtual assistant', subtitle: 'Your fox guide · Online', greeting: 'Hi! I am Alex, your CAC Academic fox guide. I can guide you through the portal, review your resume if you paste it here, and translate employability terms into English. What would you like to do today?',
    placeholder: 'Ask, or paste your resume to have it reviewed...', send: 'Send question', clear: 'Clear conversation', contact: 'Contact the team',
    documents: 'Upload a document', resume: 'Review my resume', translate: 'Translate a phrase', suggestions: ['Review my professional summary', 'How do I say "servicio al cliente" in English?', 'How do I describe an achievement with numbers?'],
    hint: 'Enter sends · Shift+Enter for a new line',
  } : {
    title: 'Alex, asistente virtual', subtitle: 'Tu zorro guía · En línea', greeting: '¡Hola! Soy Alex, tu zorro guía de CAC Academic. Puedo orientarte en el portal, revisarte la hoja de vida si me la pegas aquí y traducirte los términos al inglés. ¿Qué necesitas hacer hoy?',
    placeholder: 'Pregunta, o pega tu hoja de vida para que la revise...', send: 'Enviar pregunta', clear: 'Limpiar conversación', contact: 'Contactar al equipo',
    documents: 'Subir un documento', resume: 'Revisar mi hoja de vida', translate: 'Traducir una frase', suggestions: ['Revisa mi perfil profesional', '¿Cómo se dice "servicio al cliente" en inglés?', '¿Cómo describo un logro con cifras?'],
    hint: 'Enter envía · Shift+Enter salta línea',
  }, [english])
  const topics: Topic[] = useMemo(() => [
    { id: 'docs', icon: FileText, label: labels.documents, route: '/mis-documentos', question: english ? 'How do I upload a document?' : '¿Cómo subo un documento?' },
    // Sin ruta: revisar y traducir ocurren en el propio chat. Navegar seria
    // sacar al estudiante de donde esta la respuesta.
    { id: 'resume', icon: Sparkle, label: labels.resume, question: labels.suggestions[0] },
    { id: 'translate', icon: Translate, label: labels.translate, question: labels.suggestions[1] },
  ], [english, labels])
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
      const parsed = saved ? JSON.parse(saved) as Message[] : []
      setMessages(parsed.length ? parsed : [{ id: 'welcome', author: 'bot', text: labels.greeting, createdAt: Date.now() }])
    } catch { setMessages([{ id: 'welcome', author: 'bot', text: labels.greeting, createdAt: Date.now() }]) }
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
    setMessages((actual) => [...actual, { id: `student-${now}`, author: 'student', text: question, createdAt: now }])
    setDraft(''); setTyping(true)
    try {
      const response = await fetch('/api/v1/ia/asistente-estudiante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: question, rutaActual: pathname }),
      })
      // Una sesión caducada no se puede tapar con la respuesta local: el
      // estudiante creería que le contestamos y seguiría escribiendo a un
      // portal en el que ya no está dentro.
      if (response.status === 401) throw new SesionCaducada()
      if (!response.ok) throw new Error('Student assistant unavailable')
      const data = await response.json() as AssistantResponse
      setMessages((actual) => [...actual, {
        id: `bot-${Date.now()}`,
        author: 'bot',
        text: data.respuesta || responder(question, english),
        accionNavegacion: data.accionNavegacion,
        sugerencias: data.sugerencias,
        createdAt: Date.now(),
      }])
    } catch (error) {
      const texto = error instanceof SesionCaducada
        ? (english ? 'Your session expired. Sign in again to keep chatting.' : 'Tu sesión expiró. Vuelve a iniciar sesión para seguir conversando.')
        : responder(question, english)
      setMessages((actual) => [...actual, { id: `bot-${Date.now()}`, author: 'bot', text: texto, createdAt: Date.now() }])
    } finally {
      setTyping(false)
    }
  }

  const limpiar = () => setMessages([{ id: `welcome-${Date.now()}`, author: 'bot', text: labels.greeting, createdAt: Date.now() }])
  const contactar = () => {
    setOpen(false)
    window.dispatchEvent(new Event('nova:open-messages'))
  }

  return <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end sm:right-6 sm:bottom-6">
    <section ref={chatRef} aria-label={labels.title} className={cn('absolute bottom-14 right-0 flex h-[min(72dvh,620px)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-border/80 bg-popover/95 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom-right transform-gpu dark:bg-[#0c1714]/95 dark:border-primary/20', open ? 'pointer-events-auto scale-100 opacity-100 translate-y-0 translate-x-0 blur-none' : 'pointer-events-none scale-0 opacity-0 translate-y-12 translate-x-4 blur-sm')}>
      <header className="relative overflow-hidden border-b border-primary/15 bg-[linear-gradient(125deg,color-mix(in_srgb,var(--primary)_23%,transparent),transparent_62%)] px-4 py-3.5 dark:bg-[#13221d]"><div className="absolute -right-5 -top-8 size-28 rounded-full bg-primary/10 blur-2xl dark:hidden" /><div className="relative flex items-center gap-3"><span aria-hidden="true" className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 shadow-lg"><img src="/brand/alex-fox.png" alt="" className="size-full object-contain" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{labels.title}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500 animate-ping" /><span className="size-1.5 rounded-full bg-emerald-500 -ml-3" />{labels.subtitle}</p></div><button type="button" onClick={limpiar} title={labels.clear} aria-label={labels.clear} className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground dark:hover:bg-[#0c1714]"><Trash className="size-4" /></button><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground dark:hover:bg-[#0c1714]"><X className="size-4" /></button></div></header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_3%,transparent),transparent_34%)] p-4 dark:bg-[#0c1714]">
        {messages.map((message, indice) => <div key={message.id} className={cn('flex flex-col', message.author === 'student' ? 'items-end' : 'items-start')}><div className={cn('max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm', message.author === 'bot' ? 'rounded-tl-md border border-border bg-card text-foreground dark:bg-[#13221d]' : 'rounded-tr-md bg-primary text-primary-foreground')}>{/* La revisión de hoja de vida responde en varias líneas: sin esto llegaban todas pegadas en un párrafo. */}<p className="whitespace-pre-wrap">{message.text}</p>{message.author === 'bot' && message.accionNavegacion && <button type="button" onClick={() => { setOpen(false); router.push(message.accionNavegacion!.url) }} className="mt-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15">{message.accionNavegacion.etiqueta}</button>}</div>{/* Solo las del último mensaje: las anteriores ya no vienen a cuento y llenarían el hilo. */}{message.author === 'bot' && indice === messages.length - 1 && !!message.sugerencias?.length && <div className="mt-2 flex flex-wrap gap-1.5">{message.sugerencias.map((sugerencia) => <button key={sugerencia} type="button" onClick={() => enviar(sugerencia)} className="rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10">{sugerencia}</button>)}</div>}</div>)}
        {typing && <div className="flex"><div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground dark:bg-[#13221d]"><CircleNotch className="size-3.5 animate-spin text-primary" />{english ? 'Preparing an answer...' : 'Preparando una respuesta...'}</div></div>}
        {messages.length <= 2 && <div className="space-y-2 pt-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{english ? 'Quick actions' : 'Acciones rápidas'}</p><div className="grid gap-2 sm:grid-cols-3">{topics.map((topic) => { const Icon = topic.icon; return <button key={topic.id} type="button" onClick={() => { enviar(topic.question); if (topic.route) router.push(topic.route) }} className="rounded-xl border border-border bg-card p-2.5 text-left text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/[0.04]"><Icon className="mb-1.5 size-4 text-primary" />{topic.label}</button> })}</div><div className="flex flex-wrap gap-1.5">{labels.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => enviar(suggestion)} className="rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10">{suggestion}</button>)}</div></div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border bg-card p-3 dark:bg-[#13221d]"><button type="button" onClick={contactar} className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><BookOpenText className="size-3.5" />{labels.contact}</button><form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); enviar() }}>{/* Area de varias lineas y no un campo simple: aqui se pega la hoja de vida para que la revisen, y en un input de una linea eso no se puede ni releer. */}<Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); enviar() } }} placeholder={labels.placeholder} maxLength={4000} minRows={1} maxRows={4} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 dark:bg-[#0c1714]" /><button type="submit" disabled={!draft.trim() || typing} aria-label={labels.send} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-45"><PaperPlaneTilt className="size-4" weight="fill" /></button></form><p className="mt-1.5 text-[10px] text-muted-foreground">{labels.hint}</p></div>
    </section>
    <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close Alex' : labels.title} title={open ? 'Close Alex' : labels.title} className={cn('group relative flex h-11 items-center gap-2.5 rounded-full border border-primary/25 bg-card/90 px-3.5 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-primary/20 active:scale-95 dark:bg-[#0c1714]/90', open && 'bg-primary text-primary-foreground border-primary hover:bg-primary')}>
      <span className="absolute inset-0 rounded-full bg-primary/20 blur-md transition group-hover:blur-lg" />
      {open ? <X className="relative size-5 text-primary-foreground transition-transform duration-300 rotate-0 group-hover:rotate-90" /> : <><img src="/brand/alex-fox.png" alt="" className="relative size-6 object-contain" /><span className="relative text-xs font-bold tracking-wide text-foreground group-hover:text-primary">Alex</span></>}
    </button>
  </div>
}
