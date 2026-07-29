'use client'

import { useState } from 'react'
import { ChatCircleDots, PaperPlaneTilt, Robot, X } from '@phosphor-icons/react'

type Message = { author: 'bot' | 'student'; text: string }

const SUGGESTIONS = [
  '¿Cómo subo un documento?',
  '¿Dónde veo mi proceso?',
  '¿Cómo reviso el calendario?',
]

function answer(question: string) {
  const text = question.toLocaleLowerCase()
  if (text.includes('document')) return 'Abre Documentos en el menú. Allí puedes cargar tus soportes, descargarlos y consultar los certificados que te haya compartido el equipo.'
  if (text.includes('calend') || text.includes('evento')) return 'En Calendario encontrarás las actividades programadas para tu proyecto. Selecciona un día con punto de color para ver todos sus detalles.'
  if (text.includes('proceso') || text.includes('postul') || text.includes('vacante')) return 'En Mi proceso puedes revisar tu preparación y seguimiento. En Postulaciones están las oportunidades sugeridas y el estado de cada aplicación.'
  if (text.includes('hoja') || text.includes('cv')) return 'Actualiza tu información en Configuración y luego entra a Hoja de vida para descargar tu CV profesional.'
  if (text.includes('mensaje') || text.includes('contact')) return 'Usa el ícono de mensajes de la parte superior para escribir al equipo de acompañamiento y consultar sus respuestas.'
  return 'Puedo orientarte dentro del portal: documentos, calendario, proceso de empleabilidad, hoja de vida y mensajes. Cuéntame qué necesitas hacer.'
}

export function StudentHelpChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { author: 'bot', text: 'Hola, soy el asistente de Academy CAC. Te ayudo a usar tu portal.' },
  ])

  const send = (text = draft) => {
    const question = text.trim()
    if (!question) return
    setMessages((current) => [...current, { author: 'student', text: question }, { author: 'bot', text: answer(question) }])
    setDraft('')
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
      {open && (
        <section className="mb-3 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <header className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15"><Robot className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Asistente Academy CAC</p><p className="text-[11px] opacity-85">Guía para usar tu portal</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente" className="rounded-lg p-1.5 hover:bg-primary-foreground/15"><X className="size-4" /></button>
          </header>
          <div className="max-h-80 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => <div key={`${message.author}-${index}`} className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 ${message.author === 'bot' ? 'bg-secondary text-foreground' : 'ml-auto bg-primary text-primary-foreground'}`}>{message.text}</div>)}
            {messages.length === 1 && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="rounded-full border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">{suggestion}</button>)}</div>}
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={(event) => { event.preventDefault(); send() }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe tu pregunta…" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <button type="submit" disabled={!draft.trim()} aria-label="Enviar pregunta" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><PaperPlaneTilt className="size-4" /></button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir asistente del portal" className="flex size-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_28px_-10px_color-mix(in_srgb,var(--primary)_80%,transparent)] transition-transform hover:scale-105 active:scale-95">
        {open ? <X className="size-6" /> : <ChatCircleDots className="size-6" weight="fill" />}
      </button>
    </div>
  )
}
