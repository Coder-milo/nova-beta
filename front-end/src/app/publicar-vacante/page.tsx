'use client'

/**
 * Formulario público de captación.
 *
 * Es la única pantalla del sistema a la que se llega sin cuenta. Existe porque
 * hoy solo publica quien ya tiene cuenta del portal y las cuentas son por
 * invitación: una empresa que llega por su cuenta —una feria, una
 * recomendación, el pie de la página institucional— no tiene por dónde entrar y
 * se pierde.
 *
 * Decisiones que se ven en la pantalla:
 *
 * - **No promete publicación, promete revisión.** Lo dice antes de enviar y lo
 *   repite al terminar. Una empresa que cree haber publicado y no ve su oferta
 *   escribe a los tres días preguntando qué pasó.
 * - **No hay campo de enlace.** El alta interna acepta una URL y la lee; hacerlo
 *   sin autenticar convertiría al servidor en un cliente HTTP de cualquiera.
 * - **Hay un campo trampa escondido** (`apodo`). No lo ve nadie: frena al robot
 *   que rellena todo lo que encuentra. El límite por dirección lo pone el
 *   backend, que es donde puede frenar antes de tocar la base.
 * - **La pantalla no confirma nada por correo**, y no lo insinúa: el backend no
 *   escribe a una dirección sin verificar.
 */

import { useState, useTransition } from 'react'
import { Building2, CheckCircle2, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { captacionPublicaApi, ApiCallError, type SolicitudPublicaDeVacante } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'

const VACIO: SolicitudPublicaDeVacante = {
  empresa: '', contacto: '', email: '', telefono: '',
  titulo: '', descripcion: '', requisitos: '', ciudad: '',
  modalidad: '', tipoContrato: '', rangoSalarial: '', apodo: '',
}

const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'] as const
const CONTRATOS = ['Término fijo', 'Término indefinido', 'Obra o labor', 'Prestación de servicios', 'Aprendizaje'] as const

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Post a job with us',
        bajada: 'Tell us about the role and the team reviews it. No account needed.',
        antesDeEnviar:
          'This does not publish the offer. Someone from the team reads it first and contacts you at the email you leave.',
        laEmpresa: 'The company',
        nombreEmpresa: 'Company name',
        contacto: 'Who do we talk to',
        email: 'Contact email',
        telefono: 'Phone (optional)',
        elPuesto: 'The role',
        cargo: 'Job title',
        descripcion: 'What the job involves',
        requisitos: 'Requirements (optional)',
        ciudad: 'City',
        modalidad: 'Work mode',
        tipoContrato: 'Contract type',
        salario: 'Salary range (optional)',
        sinElegir: 'Not specified',
        enviar: 'Send offer',
        enviando: 'Sending…',
        listoTitulo: 'Offer received',
        listoOtra: 'Send another offer',
        faltan: 'Fill in the required fields.',
        fallo: 'The offer could not be sent. Try again in a few minutes.',
        demasiadas: 'You have sent several offers already. Wait an hour before sending another one, or write to us directly.',
        obligatorio: 'Required',
      }
    : {
        titulo: 'Publica una vacante con nosotros',
        bajada: 'Cuéntanos del puesto y el equipo lo revisa. No hace falta tener cuenta.',
        antesDeEnviar:
          'Esto no publica la oferta. Alguien del equipo la lee primero y te contacta al correo que dejes.',
        laEmpresa: 'La empresa',
        nombreEmpresa: 'Nombre de la empresa',
        contacto: 'Con quién hablamos',
        email: 'Correo de contacto',
        telefono: 'Teléfono (opcional)',
        elPuesto: 'El puesto',
        cargo: 'Cargo que se ofrece',
        descripcion: 'En qué consiste el trabajo',
        requisitos: 'Requisitos (opcional)',
        ciudad: 'Ciudad',
        modalidad: 'Modalidad',
        tipoContrato: 'Tipo de contrato',
        salario: 'Rango salarial (opcional)',
        sinElegir: 'Sin especificar',
        enviar: 'Enviar oferta',
        enviando: 'Enviando…',
        listoTitulo: 'Oferta recibida',
        listoOtra: 'Enviar otra oferta',
        faltan: 'Completa los campos obligatorios.',
        fallo: 'No se pudo enviar la oferta. Vuelve a intentarlo en unos minutos.',
        demasiadas: 'Ya enviaste varias ofertas. Espera una hora antes de mandar otra, o escríbenos directamente.',
        obligatorio: 'Obligatorio',
      }
}

export default function PublicarVacantePage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')

  const [form, setForm] = useState<SolicitudPublicaDeVacante>(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [recibido, setRecibido] = useState<string | null>(null)
  const [enviando, empezar] = useTransition()

  const f = (campo: keyof SolicitudPublicaDeVacante, valor: string) =>
    setForm((previo) => ({ ...previo, [campo]: valor }))

  const enviar = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.empresa.trim() || !form.contacto.trim() || !form.email.trim()
        || !form.titulo.trim() || !form.descripcion.trim()) {
      setError(T.faltan)
      return
    }

    empezar(async () => {
      try {
        const r = await captacionPublicaApi.proponerVacante(form)
        setRecibido(r.mensaje)
      } catch (err) {
        // El mensaje del backend se muestra tal cual cuando lo hay: son los
        // casos que la persona puede corregir —correo mal escrito, oferta ya
        // enviada—. Solo se sustituye por uno propio cuando no hay nada que
        // decir, y en el 429: ese lo responde el filtro con el campo `error` y
        // no `message`, así que sin este caso la persona veía «vuelve a
        // intentarlo en unos minutos» y volvía a chocar durante una hora.
        if (err instanceof ApiCallError) {
          setError(err.status === 429 ? T.demasiadas : (err.body.message ?? T.fallo))
        } else {
          setError(T.fallo)
        }
      }
    })
  }

  if (recibido) {
    return (
      <Marco T={T}>
        <div className="flex flex-col gap-4">
          <div role="status" className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700 dark:border-green-800/30 dark:bg-green-950/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{recibido}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => { setRecibido(null); setForm(VACIO) }}
          >
            {T.listoOtra}
          </Button>
        </div>
      </Marco>
    )
  }

  return (
    <Marco T={T}>
      <form onSubmit={enviar} className="flex flex-col gap-6">
        <p className="flex items-start gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-sky-800 dark:text-sky-300">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {T.antesDeEnviar}
        </p>

        <Seccion titulo={T.laEmpresa}>
          <Campo id="cp-empresa" etiqueta={T.nombreEmpresa} obligatorio={T.obligatorio}>
            <Input id="cp-empresa" value={form.empresa} maxLength={200} disabled={enviando}
              onChange={(e) => f('empresa', e.target.value)} />
          </Campo>
          <Campo id="cp-contacto" etiqueta={T.contacto} obligatorio={T.obligatorio}>
            <Input id="cp-contacto" value={form.contacto} maxLength={200} disabled={enviando}
              onChange={(e) => f('contacto', e.target.value)} />
          </Campo>
          <Campo id="cp-email" etiqueta={T.email} obligatorio={T.obligatorio}>
            <Input id="cp-email" type="email" value={form.email} maxLength={255} disabled={enviando}
              onChange={(e) => f('email', e.target.value)} />
          </Campo>
          <Campo id="cp-telefono" etiqueta={T.telefono}>
            <Input id="cp-telefono" value={form.telefono} maxLength={40} disabled={enviando}
              onChange={(e) => f('telefono', e.target.value)} />
          </Campo>
        </Seccion>

        <Seccion titulo={T.elPuesto}>
          <Campo id="cp-titulo" etiqueta={T.cargo} obligatorio={T.obligatorio} ancho>
            <Input id="cp-titulo" value={form.titulo} maxLength={200} disabled={enviando}
              onChange={(e) => f('titulo', e.target.value)} />
          </Campo>
          <Campo id="cp-descripcion" etiqueta={T.descripcion} obligatorio={T.obligatorio} ancho>
            <Textarea id="cp-descripcion" minRows={5} value={form.descripcion} maxLength={5000}
              disabled={enviando} onChange={(e) => f('descripcion', e.target.value)} />
          </Campo>
          <Campo id="cp-requisitos" etiqueta={T.requisitos} ancho>
            <Textarea id="cp-requisitos" minRows={3} value={form.requisitos} maxLength={3000}
              disabled={enviando} onChange={(e) => f('requisitos', e.target.value)} />
          </Campo>
          <Campo id="cp-ciudad" etiqueta={T.ciudad}>
            <Input id="cp-ciudad" value={form.ciudad} maxLength={255} disabled={enviando}
              onChange={(e) => f('ciudad', e.target.value)} />
          </Campo>
          <Campo id="cp-salario" etiqueta={T.salario}>
            <Input id="cp-salario" value={form.rangoSalarial} maxLength={100} disabled={enviando}
              onChange={(e) => f('rangoSalarial', e.target.value)} />
          </Campo>
          <Campo id="cp-modalidad" etiqueta={T.modalidad}>
            <Seleccion id="cp-modalidad" valor={form.modalidad} vacio={T.sinElegir}
              opciones={MODALIDADES} disabled={enviando}
              onChange={(v) => f('modalidad', v)} />
          </Campo>
          <Campo id="cp-contrato" etiqueta={T.tipoContrato}>
            <Seleccion id="cp-contrato" valor={form.tipoContrato} vacio={T.sinElegir}
              opciones={CONTRATOS} disabled={enviando}
              onChange={(v) => f('tipoContrato', v)} />
          </Campo>
        </Seccion>

        {/* La trampa. Fuera de la vista y fuera del recorrido del teclado y del
            lector de pantalla: quien la rellene no es una persona. `hidden` a
            secas bastaría para el ojo, pero no para un lector de pantalla, y
            una persona ciega no puede caer en una trampa que no ve. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="cp-apodo">No llenar este campo</label>
          <input id="cp-apodo" name="apodo" tabIndex={-1} autoComplete="off"
            value={form.apodo} onChange={(e) => f('apodo', e.target.value)} />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="h-10 w-full">
          {enviando
            ? <><LoaderCircle className="size-4 animate-spin" /> {T.enviando}</>
            : T.enviar}
        </Button>
      </form>
    </Marco>
  )
}

function Marco({ T, children }: { T: ReturnType<typeof textos>; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{T.titulo}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{T.bajada}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Campo({
  id, etiqueta, obligatorio, ancho, children,
}: {
  id: string
  etiqueta: string
  obligatorio?: string
  ancho?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${ancho ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {etiqueta}
        {obligatorio && <span className="ml-1 text-xs text-muted-foreground">· {obligatorio}</span>}
      </label>
      {children}
    </div>
  )
}

function Seleccion({
  id, valor, opciones, vacio, disabled, onChange,
}: {
  id: string
  valor: string
  opciones: readonly string[]
  vacio: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <select
      id={id}
      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
      value={valor}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
