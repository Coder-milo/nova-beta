'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenText, CalendarBlank, ChatCircleDots, CircleNotch, FileText, PaperPlaneTilt, Sparkle, Trash, X } from '@phosphor-icons/react'
import { useRouter } from '@/compat/next-navigation'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'

type Author = 'bot' | 'student'
type Message = { id: string; author: Author; text: string; createdAt: number }
type Topic = { id: string; icon: typeof FileText; label: string; route: string; question: string }

const STORAGE_KEY = 'academy_cac_help_chat'

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
  if (text.includes('cv') || text.includes('resume') || text.includes('hoja de vida')) return english
    ? 'Keep your profile up to date in Settings, then visit Resume to download your updated CV in the Academy CAC format.'
    : 'Mantén actualizado tu perfil en Configuración y luego entra a Hoja de vida para descargar tu CV actualizado en el formato Academy CAC.'
  if (text.includes('message') || text.includes('help') || text.includes('mensaje') || text.includes('ayuda')) return english
    ? 'Use the Messages icon in the top bar to contact the support team. You can come back there to read their reply.'
    : 'Usa el icono de Mensajes de la barra superior para contactar al equipo de acompañamiento. Allí mismo podrás leer su respuesta.'
  return english
    ? 'I can guide you through documents, job applications, your employability process, calendar, resume, and support messages. Try one of the quick actions below.'
    : 'Puedo orientarte sobre documentos, postulaciones, tu proceso de empleabilidad, calendario, hoja de vida y mensajes de soporte. Prueba una de las acciones rápidas.'
}

export function StudentHelpChat() {
  const router = useRouter()
  const { locale } = usePreferences()
  const english = locale === 'en'
  const storageKey = `${STORAGE_KEY}_${locale}`
  const labels = useMemo(() => english ? {
    title: 'Academy assistant', subtitle: 'Portal guide · Online', greeting: 'Hi! I am your Academy CAC assistant. What would you like to do today?',
    placeholder: 'Ask about your portal...', send: 'Send question', clear: 'Clear conversation', contact: 'Contact the team',
    documents: 'Upload a document', process: 'Review my process', calendar: 'Open calendar', suggestions: ['How do I upload a document?', 'Where can I see my process?', 'How do I improve my LinkedIn?'],
  } : {
    title: 'Asistente Academy', subtitle: 'Guía del portal · En línea', greeting: '¡Hola! Soy tu asistente de Academy CAC. ¿Qué necesitas hacer hoy?',
    placeholder: 'Pregunta sobre tu portal...', send: 'Enviar pregunta', clear: 'Limpiar conversación', contact: 'Contactar al equipo',
    documents: 'Subir un documento', process: 'Revisar mi proceso', calendar: 'Abrir calendario', suggestions: ['¿Cómo subo un documento?', '¿Dónde veo mi proceso?', '¿Cómo mejoro mi LinkedIn?'],
  }, [english])
  const topics: Topic[] = useMemo(() => [
    { id: 'docs', icon: FileText, label: labels.documents, route: '/mis-documentos', question: labels.suggestions[0] },
    { id: 'process', icon: Sparkle, label: labels.process, route: '/mi-proceso', question: labels.suggestions[1] },
    { id: 'calendar', icon: CalendarBlank, label: labels.calendar, route: '/mi-calendario', question: english ? 'How can I view an event?' : '¿Cómo veo un evento?' },
  ], [english, labels])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const endRef = useRef<HTMLDivElement>(null)

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

  const enviar = (value = draft) => {
    const question = value.trim()
    if (!question || typing) return
    const now = Date.now()
    setMessages((actual) => [...actual, { id: `student-${now}`, author: 'student', text: question, createdAt: now }])
    setDraft(''); setTyping(true)
    window.setTimeout(() => {
      setMessages((actual) => [...actual, { id: `bot-${Date.now()}`, author: 'bot', text: responder(question, english), createdAt: Date.now() }])
      setTyping(false)
    }, 420)
  }

  const limpiar = () => setMessages([{ id: `welcome-${Date.now()}`, author: 'bot', text: labels.greeting, createdAt: Date.now() }])
  const contactar = () => {
    setOpen(false)
    window.dispatchEvent(new Event('nova:open-messages'))
  }

  return <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
    {open && <section aria-label={labels.title} className="mb-3 flex h-[min(72dvh,620px)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-[0_28px_70px_rgba(0,0,0,0.32)]">
      <header className="relative overflow-hidden border-b border-primary/15 bg-[linear-gradient(125deg,color-mix(in_srgb,var(--primary)_23%,transparent),transparent_62%)] px-4 py-3.5"><div className="absolute -right-5 -top-8 size-28 rounded-full bg-primary/10 blur-2xl" /><div className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Sparkle className="size-5" weight="fill" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{labels.title}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" />{labels.subtitle}</p></div><button type="button" onClick={limpiar} title={labels.clear} aria-label={labels.clear} className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"><Trash className="size-4" /></button><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-xl p-2 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"><X className="size-4" /></button></div></header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_3%,transparent),transparent_34%)] p-4">
        {messages.map((message) => <div key={message.id} className={cn('flex', message.author === 'student' && 'justify-end')}><div className={cn('max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm', message.author === 'bot' ? 'rounded-tl-md border border-border bg-card text-foreground' : 'rounded-tr-md bg-primary text-primary-foreground')}>{message.text}</div></div>)}
        {typing && <div className="flex"><div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground"><CircleNotch className="size-3.5 animate-spin text-primary" />{english ? 'Preparing an answer...' : 'Preparando una respuesta...'}</div></div>}
        {messages.length <= 2 && <div className="space-y-2 pt-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{english ? 'Quick actions' : 'Acciones rápidas'}</p><div className="grid gap-2 sm:grid-cols-3">{topics.map((topic) => { const Icon = topic.icon; return <button key={topic.id} type="button" onClick={() => { enviar(topic.question); router.push(topic.route) }} className="rounded-xl border border-border bg-card p-2.5 text-left text-[11px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/[0.04]"><Icon className="mb-1.5 size-4 text-primary" />{topic.label}</button> })}</div><div className="flex flex-wrap gap-1.5">{labels.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => enviar(suggestion)} className="rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10">{suggestion}</button>)}</div></div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border bg-card p-3"><button type="button" onClick={contactar} className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><BookOpenText className="size-3.5" />{labels.contact}</button><form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); enviar() }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={labels.placeholder} maxLength={500} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" /><button type="submit" disabled={!draft.trim() || typing} aria-label={labels.send} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-45"><PaperPlaneTilt className="size-4" weight="fill" /></button></form></div>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close assistant' : labels.title} className="group relative flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_34px_-12px_color-mix(in_srgb,var(--primary)_80%,transparent)] transition hover:scale-105 active:scale-95"><span className="absolute inset-0 rounded-2xl bg-primary/45 blur-lg transition group-hover:blur-xl" />{open ? <X className="relative size-6" /> : <ChatCircleDots className="relative size-6" weight="fill" />}</button>
  </div>
}
