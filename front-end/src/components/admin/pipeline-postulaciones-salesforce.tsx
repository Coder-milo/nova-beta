'use client'

import { useState } from 'react'
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  User,
  UserCheck,
  Video,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { postulacionesApi } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { ModalidadEntrevista, PostulacionResponse } from '@/lib/types'

interface PipelinePostulacionesSalesforceProps {
  postulaciones: PostulacionResponse[]
  onActualizado: () => void
}

const ETAPAS_SALESFORCE = [
  { id: 'ENVIADA', labelEs: 'Enviada', labelEn: 'Sent' },
  { id: 'EN_PROCESO', labelEs: 'En Proceso', labelEn: 'In Review' },
  { id: 'ENTREVISTA_AGENDADA', labelEs: 'Entrevista Agendada', labelEn: 'Interview Set' },
  { id: 'ENTREVISTA_REALIZADA', labelEs: 'Entrevista Realizada', labelEn: 'Interviewed' },
  { id: 'CONTRATADO', labelEs: 'Contratado', labelEn: 'Hired' },
] as const

export function PipelinePostulacionesSalesforce({
  postulaciones,
  onActualizado,
}: PipelinePostulacionesSalesforceProps) {
  const { locale } = usePreferences()
  const es = locale === 'es'

  // Modal para editar cita/estado
  const [postulacionEditando, setPostulacionEditando] = useState<PostulacionResponse | null>(null)
  const [modalCitaAbierto, setModalCitaAbierto] = useState(false)
  const [fechaHora, setFechaHora] = useState('')
  const [modalidad, setModalidad] = useState<ModalidadEntrevista>('VIRTUAL')
  const [lugar, setLugar] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [resultado, setResultado] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleCambiarEstadoRapido = async (postulacion: PostulacionResponse, nuevoEstado: string) => {
    if (postulacion.estado === nuevoEstado) return
    try {
      await postulacionesApi.actualizar(postulacion.id, {
        estado: nuevoEstado,
      })
      onActualizado()
    } catch {
      // Si falla, no interrumpir la interfaz
    }
  }

  const abrirEdicionCita = (postulacion: PostulacionResponse) => {
    setPostulacionEditando(postulacion)
    setFechaHora(postulacion.fechaHoraEntrevista ?? '')
    setModalidad(postulacion.modalidadEntrevista ?? 'VIRTUAL')
    setLugar(postulacion.lugarEntrevista ?? '')
    setContactoNombre(postulacion.contactoNombre ?? '')
    setContactoTelefono(postulacion.contactoTelefono ?? '')
    setContactoEmail(postulacion.contactoEmail ?? '')
    setObservaciones(postulacion.observaciones ?? '')
    setResultado(postulacion.resultado ?? '')
    setModalCitaAbierto(true)
  }

  const handleGuardarCita = async () => {
    if (!postulacionEditando) return
    setGuardando(true)
    try {
      await postulacionesApi.actualizar(postulacionEditando.id, {
        fechaHoraEntrevista: fechaHora || null,
        modalidadEntrevista: fechaHora ? modalidad : null,
        lugarEntrevista: lugar.trim() || null,
        contactoNombre: contactoNombre.trim() || null,
        contactoTelefono: contactoTelefono.trim() || null,
        contactoEmail: contactoEmail.trim() || null,
        observaciones: observaciones.trim() || null,
        resultado: resultado.trim() || null,
      })
      setModalCitaAbierto(false)
      onActualizado()
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!confirm(es ? '¿Deseas eliminar este registro de postulación?' : 'Delete this application?')) return
    try {
      await postulacionesApi.eliminar(id)
      onActualizado()
    } catch {
      // noop
    }
  }

  if (postulaciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center">
        <Briefcase className="size-9 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-semibold text-foreground">
          {es ? 'Sin postulaciones registradas' : 'No applications recorded'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {es
            ? 'Usa el botón "+ Postular a vacante / entrevista" para vincular al estudiante con una oportunidad laboral o registrar citas.'
            : 'Use "+ Apply to vacancy / interview" to link the student with job opportunities or schedule interviews.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {postulaciones.map((postulacion) => {
        const indiceEstadoActual = ETAPAS_SALESFORCE.findIndex((e) => e.id === postulacion.estado)
        const esRechazado = postulacion.estado === 'RECHAZADO'
        const esSinRespuesta = postulacion.estado === 'SIN_RESPUESTA'

        return (
          <Card
            key={postulacion.id}
            className="overflow-hidden rounded-2xl border border-border/70 transition-all hover:border-border hover:shadow-md"
          >
            <CardContent className="flex flex-col gap-4 p-5">
              {/* Cabecera de la Tarjeta Salesforce */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-foreground truncate">
                        {postulacion.cargo}
                      </h4>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm font-semibold text-foreground/80">
                        {postulacion.empresaNombre}
                      </span>
                      {postulacion.canal && (
                        <Badge variant="outline" className="text-[10px] py-0 px-2">
                          {postulacion.canal}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {es ? 'Fecha de postulación:' : 'Applied date:'}{' '}
                        <strong className="font-semibold text-foreground">
                          {postulacion.fechaPostulacion}
                        </strong>
                      </span>
                      {postulacion.diasEsperando !== null && (
                        <span>
                          · {postulacion.diasEsperando}{' '}
                          {es ? 'días en seguimiento' : 'days in process'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badge de Autoría (Coordinador vs Estudiante) */}
                <div className="flex items-center gap-2 shrink-0">
                  {postulacion.registradaPorEstudiante ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      <User className="size-3.5" />
                      {es ? 'Auto-postulación (Estudiante)' : 'Student self-applied'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <UserCheck className="size-3.5" />
                      {es ? 'Gestionada por Coordinación' : 'Handled by Coordinator'}{' '}
                      {postulacion.gestionadaPor ? `(${postulacion.gestionadaPor})` : ''}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => abrirEdicionCita(postulacion)}
                    title={es ? 'Editar seguimiento / cita' : 'Edit follow-up / interview'}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEliminar(postulacion.id)}
                    title={es ? 'Eliminar postulación' : 'Delete application'}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Salesforce Chevron Stage Stepper */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{es ? 'Etapa del proceso (Pipeline)' : 'Process Stage (Pipeline)'}</span>
                  <span>{postulacion.estadoEtiqueta}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {ETAPAS_SALESFORCE.map((etapa, idx) => {
                    const esActual = postulacion.estado === etapa.id
                    const esPasada = indiceEstadoActual >= 0 && idx < indiceEstadoActual
                    const esFutura = indiceEstadoActual >= 0 && idx > indiceEstadoActual

                    return (
                      <button
                        key={etapa.id}
                        type="button"
                        onClick={() => handleCambiarEstadoRapido(postulacion, etapa.id)}
                        className={cn(
                          'relative flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all',
                          esActual &&
                            'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20 scale-[1.02]',
                          esPasada &&
                            'bg-primary/15 text-primary hover:bg-primary/25',
                          esFutura &&
                            'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        {esPasada ? (
                          <Check className="size-3.5 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-mono opacity-60">#{idx + 1}</span>
                        )}
                        <span className="truncate">{es ? etapa.labelEs : etapa.labelEn}</span>
                      </button>
                    )
                  })}
                </div>

                {esRechazado && (
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
                    <XCircle className="size-4" />
                    <span>{es ? 'Proceso cerrado: Candidato no seleccionado' : 'Process closed: Not selected'}</span>
                  </div>
                )}

                {esSinRespuesta && (
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="size-4" />
                    <span>{es ? 'Proceso cerrado: Sin respuesta de la empresa' : 'Process closed: No response'}</span>
                  </div>
                )}
              </div>

              {/* Bloque Detallado de Entrevista Agendada (si existe) */}
              {postulacion.fechaHoraEntrevista && (
                <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <CalendarDays className="size-4" />
                      <span>{es ? 'Cita de Entrevista Programada' : 'Scheduled Interview'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                        {postulacion.modalidadEtiqueta || postulacion.modalidadEntrevista || 'Cita'}
                      </Badge>
                      {postulacion.entrevistaVencida && (
                        <Badge variant="destructive" className="text-[10px]">
                          {es ? 'Requiere seguimiento' : 'Needs update'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        {es ? 'Fecha y Hora' : 'Date & Time'}
                      </span>
                      <p className="mt-0.5 font-bold text-foreground tabular-nums">
                        {postulacion.fechaHoraEntrevista.replace('T', ' ')}
                      </p>
                    </div>

                    {postulacion.lugarEntrevista && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {postulacion.modalidadEntrevista === 'VIRTUAL'
                            ? (es ? 'Enlace de Reunión' : 'Meeting Link')
                            : (es ? 'Lugar / Dirección' : 'Location')}
                        </span>
                        {postulacion.lugarEntrevista.startsWith('http') ? (
                          <a
                            href={postulacion.lugarEntrevista}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                          >
                            <Video className="size-3.5" />
                            {postulacion.lugarEntrevista}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <p className="mt-0.5 font-semibold text-foreground flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-muted-foreground" />
                            {postulacion.lugarEntrevista}
                          </p>
                        )}
                      </div>
                    )}

                    {postulacion.contactoNombre && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {es ? 'Entrevistador' : 'Interviewer'}
                        </span>
                        <p className="mt-0.5 font-medium text-foreground">
                          {postulacion.contactoNombre}
                        </p>
                      </div>
                    )}

                    {postulacion.contactoTelefono && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {es ? 'Teléfono' : 'Phone'}
                        </span>
                        <p className="mt-0.5 font-medium text-foreground flex items-center gap-1">
                          <Phone className="size-3 text-muted-foreground" />
                          {postulacion.contactoTelefono}
                        </p>
                      </div>
                    )}

                    {postulacion.proximoSeguimiento && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          {es ? 'Próximo Seguimiento' : 'Next Follow-up'}
                        </span>
                        <p className="mt-0.5 font-medium text-foreground tabular-nums">
                          {postulacion.proximoSeguimiento}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas y Observaciones de Coordinación */}
              {(postulacion.observaciones || postulacion.resultado) && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                  {postulacion.observaciones && (
                    <p>
                      <strong className="font-semibold text-foreground">
                        {es ? 'Notas de Coordinación:' : 'Coordination Notes:'}{' '}
                      </strong>
                      {postulacion.observaciones}
                    </p>
                  )}
                  {postulacion.resultado && (
                    <p className="mt-1">
                      <strong className="font-semibold text-foreground">
                        {es ? 'Resultado / Feedback:' : 'Feedback:'}{' '}
                      </strong>
                      {postulacion.resultado}
                    </p>
                  )}
                </div>
              )}

              {/* Botón para agendar entrevista si aún no tiene */}
              {!postulacion.fechaHoraEntrevista && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => abrirEdicionCita(postulacion)}
                    className="gap-2 rounded-xl text-xs"
                  >
                    <Calendar className="size-3.5 text-primary" />
                    {es ? 'Agendar cita de entrevista' : 'Schedule interview appointment'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Modal para editar cita / feedback */}
      <Dialog open={modalCitaAbierto} onOpenChange={setModalCitaAbierto}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl p-6">
          <DialogHeader className="gap-1 pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="size-4.5 text-primary" />
              {es ? 'Gestión de Entrevista y Seguimiento' : 'Interview & Follow-up Management'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {postulacionEditando?.cargo} · {postulacionEditando?.empresaNombre}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {es ? 'Fecha y Hora de la Entrevista' : 'Interview Date & Time'}
                </label>
                <Input
                  type="datetime-local"
                  value={fechaHora}
                  onChange={(e) => setFechaHora(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {es ? 'Modalidad' : 'Modality'}
                </label>
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value as ModalidadEntrevista)}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none"
                >
                  <option value="VIRTUAL">{es ? 'Virtual (Meet / Zoom / Teams)' : 'Virtual'}</option>
                  <option value="PRESENCIAL">{es ? 'Presencial (En sede)' : 'On-site'}</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {modalidad === 'VIRTUAL' ? (es ? 'Enlace de la reunión' : 'Meeting URL') : (es ? 'Dirección de la sede' : 'Address')}
              </label>
              <Input
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder={modalidad === 'VIRTUAL' ? 'https://meet.google.com/...' : 'Calle 72 # 54-20'}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {es ? 'Contacto del entrevistador' : 'Interviewer Name'}
                </label>
                <Input
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                  placeholder="Ej. Laura Martínez"
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {es ? 'Teléfono del contacto' : 'Contact Phone'}
                </label>
                <Input
                  value={contactoTelefono}
                  onChange={(e) => setContactoTelefono(e.target.value)}
                  placeholder="+57 300 1234567"
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Notas de Coordinación / Seguimiento' : 'Coordination Notes'}
              </label>
              <Textarea
                minRows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={es ? 'Notas internas del coordinador...' : 'Internal notes...'}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Resultado / Feedback de la empresa' : 'Feedback / Outcome'}
              </label>
              <Textarea
                minRows={2}
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder={es ? 'Comentarios posteriores a la entrevista...' : 'Post-interview feedback...'}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCitaAbierto(false)}
              className="rounded-xl"
            >
              {es ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              type="button"
              onClick={handleGuardarCita}
              disabled={guardando}
              className="rounded-xl"
            >
              {guardando ? (es ? 'Guardando...' : 'Saving...') : (es ? 'Guardar Cambios' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
