'use client'

import { useState } from 'react'
import { CalendarDays, Link2, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmar } from '@/components/ui/confirmar'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import type { CitaRequest, ModalidadEntrevista } from '@/lib/types'

/**
 * Convierte lo que guarda el backend a lo que espera `<input type="datetime-local">`.
 *
 * El control exige exactamente `YYYY-MM-DDTHH:mm`, sin segundos. El backend
 * manda `LocalDateTime`, que serializa con ellos —`2026-08-20T15:30:00`— y el
 * control descarta en silencio cualquier valor que no encaje: el campo salía
 * vacío al abrir a editar una cita que sí existía.
 */
function aValorDeControl(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

const MODALIDADES: { valor: ModalidadEntrevista; es: string; en: string }[] = [
  { valor: 'PRESENCIAL', es: 'Presencial', en: 'In person' },
  { valor: 'VIRTUAL', es: 'Virtual', en: 'Virtual' },
  { valor: 'TELEFONICA', es: 'Telefónica', en: 'Phone' },
]

/** Lo que el formulario necesita saber para abrirse con datos. */
export type ValoresDeCita = {
  fechaHoraEntrevista: string | null
  modalidadEntrevista: ModalidadEntrevista | null
  lugarEntrevista: string | null
  contactoNombre: string | null
  contactoEmail?: string | null
  contactoTelefono: string | null
  proximoSeguimiento?: string | null
}

type Props = {
  valores: ValoresDeCita
  /**
   * Quién guarda.
   *
   * El endpoint no puede vivir aquí dentro: el panel escribe en
   * `/api/v1/postulaciones/{id}` y el portal de empresas en
   * `/api/v1/portal/postulantes/{id}/cita`, y una cuenta de empresa no alcanza
   * el primero —`SecurityConfig` la corta fuera de `/portal`—. Inyectarlo es lo
   * que permite que el mismo formulario sirva a los dos lados en vez de
   * duplicarlo y que se separen con el tiempo.
   */
  guardar: (cambios: CitaRequest) => Promise<void>
  onCerrar: () => void
  /**
   * Campos que solo tienen sentido del lado del equipo.
   *
   * El correo del contacto y el próximo seguimiento son cosa del programa: el
   * correo ya lo tiene el sistema por la cuenta de la empresa, y la cola de
   * revisión es interna. Pedírselos a la empresa sería recoger datos que nadie
   * de su lado va a usar.
   */
  camposDelEquipo?: boolean
}

/**
 * Agendar, mover o cancelar la entrevista de una postulación.
 *
 * Hasta ahora la cita se escribía dentro de las observaciones, en texto libre.
 * Eso valía para leerla y para nada más: no se podía sacar la agenda de la
 * semana, ni avisar a nadie, ni saber cuántas citas se habían quedado sin
 * cerrar. Estos campos son los que hacen falta para presentarse a una
 * entrevista y no uno más: día y hora, cómo es, dónde o por dónde, y con quién.
 */
export function FormularioCita({ valores, guardar: alGuardar, onCerrar, camposDelEquipo = true }: Props) {
  const { locale } = usePreferences()
  const en = locale === 'en'

  const [cuando, setCuando] = useState(aValorDeControl(valores.fechaHoraEntrevista))
  const [modalidad, setModalidad] = useState<ModalidadEntrevista>(
    valores.modalidadEntrevista ?? 'PRESENCIAL',
  )
  const [lugar, setLugar] = useState(valores.lugarEntrevista ?? '')
  const [contacto, setContacto] = useState(valores.contactoNombre ?? '')
  const [correo, setCorreo] = useState(valores.contactoEmail ?? '')
  const [telefono, setTelefono] = useState(valores.contactoTelefono ?? '')
  const [proximo, setProximo] = useState(valores.proximoSeguimiento ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirmar, dialogo } = useConfirmar()

  const yaHabiaCita = Boolean(valores.fechaHoraEntrevista)
  const requiereLugar = modalidad !== 'TELEFONICA'

  const enviar = async (cuerpo: CitaRequest) => {
    setGuardando(true)
    setError(null)
    try {
      await alGuardar(cuerpo)
      onCerrar()
    } catch (e) {
      setError(errorDe(e, en ? 'The appointment could not be saved.' : 'No se pudo guardar la cita.'))
    } finally {
      setGuardando(false)
    }
  }

  const guardar = () => {
    if (!cuando) {
      setError(en ? 'Falta la fecha y la hora de la cita.' : 'Falta la fecha y la hora de la cita.')
      return
    }
    void enviar({
      // El control ya entrega `YYYY-MM-DDTHH:mm`, que es un LocalDateTime válido.
      fechaHoraEntrevista: cuando,
      modalidadEntrevista: modalidad,
      lugarEntrevista: requiereLugar ? lugar.trim() : '',
      contactoNombre: contacto.trim(),
      contactoEmail: correo.trim(),
      contactoTelefono: telefono.trim(),
      proximoSeguimiento: proximo || null,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="cita-cuando" className="text-xs font-medium text-muted-foreground">
          {en ? 'Date and time' : 'Fecha y hora'}
        </label>
        <Input
          id="cita-cuando"
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">
          {en ? 'Format' : 'Modalidad'}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {MODALIDADES.map((m) => {
            const activa = modalidad === m.valor
            const Icono = m.valor === 'VIRTUAL' ? Link2 : m.valor === 'TELEFONICA' ? Phone : MapPin
            return (
              <button
                key={m.valor}
                type="button"
                onClick={() => setModalidad(m.valor)}
                aria-pressed={activa}
                className={
                  'inline-flex items-center gap-1.5 rounded-(--radius) border px-2.5 py-1.5 text-[13px] font-medium transition-colors ' +
                  (activa
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground')
                }
              >
                <Icono className="size-3.5" />
                {en ? m.en : m.es}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Un solo campo para dirección y enlace: son excluyentes, y la modalidad
          ya dice cuál de los dos se está pidiendo. */}
      {requiereLugar && (
        <div className="flex flex-col gap-1">
          <label htmlFor="cita-lugar" className="text-xs font-medium text-muted-foreground">
            {modalidad === 'VIRTUAL'
              ? (en ? 'Meeting link' : 'Enlace de la reunión')
              : (en ? 'Address' : 'Dirección')}
          </label>
          <Input
            id="cita-lugar"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder={
              modalidad === 'VIRTUAL'
                ? 'https://meet.google.com/…'
                : (en ? 'Street, city' : 'Calle, ciudad')
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="cita-contacto" className="text-xs font-medium text-muted-foreground">
            {en ? 'Contact at the company' : 'Contacto en la empresa'}
          </label>
          <Input id="cita-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cita-telefono" className="text-xs font-medium text-muted-foreground">
            {en ? 'Phone' : 'Teléfono'}
          </label>
          <Input id="cita-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
      </div>

      {camposDelEquipo && (
        <div className="flex flex-col gap-1">
          <label htmlFor="cita-correo" className="text-xs font-medium text-muted-foreground">
            {en ? 'Contact email' : 'Correo del contacto'}
          </label>
          <Input id="cita-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
      )}

      {camposDelEquipo && (
      <div className="flex flex-col gap-1">
          <label htmlFor="cita-proximo" className="text-xs font-medium text-muted-foreground">
            {en ? 'Next follow-up' : 'Próximo seguimiento'}
          </label>
          <Input id="cita-proximo" type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} />
          <p className="text-[11px] leading-snug text-muted-foreground">
            {en
              ? 'The applications that get lost are the silent ones. Put a date and it comes back to the queue.'
              : 'Las que se pierden son las que se quedan calladas. Pon una fecha y vuelve a la cola.'}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--panel-borde)] pt-3">
        {/* Cancelar la cita borra datos, así que pasa por confirmación —nunca
            por un `confirm()` del navegador—. */}
        {yaHabiaCita ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={guardando}
            onClick={async () => {
              const aceptado = await confirmar({
                titulo: en ? 'Cancel the interview?' : '¿Cancelar la entrevista?',
                descripcion: en
                  ? 'The date, format and location will be cleared. The application stays.'
                  : 'Se borran la fecha, la modalidad y el lugar. La postulación se mantiene.',
                textoConfirmar: en ? 'Cancel interview' : 'Cancelar cita',
                textoCancelar: en ? 'Keep it' : 'Mantenerla',
              })
              if (!aceptado) return
              await enviar({ cancelarEntrevista: true })
            }}
          >
            {en ? 'Cancel interview' : 'Cancelar cita'}
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={guardando}>
            {en ? 'Close' : 'Cerrar'}
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            <CalendarDays className="size-4" />
            {guardando
              ? (en ? 'Saving…' : 'Guardando…')
              : yaHabiaCita
                ? (en ? 'Save changes' : 'Guardar cambios')
                : (en ? 'Schedule' : 'Agendar')}
          </Button>
        </div>
      </div>

      {/* El diálogo de confirmación se monta una vez; `confirmar()` lo abre. */}
      {dialogo}
    </div>
  )
}
