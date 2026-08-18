'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Calendar, Building2, Check, Clock, Link2, MapPin, Plus, User, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { postulacionesApi, vacantesApi } from '@/lib/api'
import { usePreferences } from '@/lib/preferences'
import type { ModalidadEntrevista, VacanteResponse } from '@/lib/types'

interface ModalPostularEstudianteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  estudianteId: string
  estudianteNombre: string
  onGuardado: () => void
}

const CANALES_SUGERIDOS = [
  'Contacto directo del programa',
  'LinkedIn',
  'Computrabajo',
  'Magneto',
  'Feria de empleo',
  'Alianza empresarial CAC',
  'Recomendación',
  'Otro',
]

export function ModalPostularEstudiante({
  open,
  onOpenChange,
  estudianteId,
  estudianteNombre,
  onGuardado,
}: ModalPostularEstudianteProps) {
  const { locale } = usePreferences()
  const es = locale === 'es'

  const [vacantes, setVacantes] = useState<VacanteResponse[]>([])
  const [cargandoVacantes, setCargandoVacantes] = useState(false)
  const [modoManual, setModoManual] = useState(false)

  // Form state
  const [vacanteSeleccionada, setVacanteSeleccionada] = useState<string>('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [cargo, setCargo] = useState('')
  const [canal, setCanal] = useState('Contacto directo del programa')
  const [urlOferta, setUrlOferta] = useState('')
  const [estado, setEstado] = useState<'ENVIADA' | 'EN_PROCESO' | 'ENTREVISTA_AGENDADA'>('ENVIADA')
  
  // Entrevista fields
  const [agendarEntrevista, setAgendarEntrevista] = useState(false)
  const [fechaHoraEntrevista, setFechaHoraEntrevista] = useState('')
  const [modalidadEntrevista, setModalidadEntrevista] = useState<ModalidadEntrevista>('VIRTUAL')
  const [lugarEntrevista, setLugarEntrevista] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [contactoTelefono, setContactoTelefono] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [proximoSeguimiento, setProximoSeguimiento] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar vacantes activas cuando se abre el modal
  useEffect(() => {
    if (!open) return
    let activo = true
    setCargandoVacantes(true)
    setError(null)
    void vacantesApi.listar(0, 60)
      .then((page) => {
        if (activo) {
          const activas = page.content.filter((v) => v.activa !== false)
          setVacantes(activas)
        }
      })
      .catch(() => {
        if (activo) setVacantes([])
      })
      .finally(() => {
        if (activo) setCargandoVacantes(false)
      })

    return () => { activo = false }
  }, [open])

  // Sincronizar selección de vacante
  const handleSeleccionarVacante = (vacanteId: string) => {
    setVacanteSeleccionada(vacanteId)
    if (!vacanteId) {
      setEmpresaNombre('')
      setCargo('')
      setUrlOferta('')
      return
    }
    const match = vacantes.find((v) => v.id === vacanteId)
    if (match) {
      setEmpresaNombre(match.empresaNombre || match.empresaDeclarada || 'Empresa aliada')
      setCargo(match.titulo)
      setUrlOferta(match.urlAplicar || match.urlOrigen || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaNombre.trim() || !cargo.trim()) {
      setError(es ? 'La empresa y el cargo son requeridos.' : 'Company and role are required.')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const estadoFinal = agendarEntrevista ? 'ENTREVISTA_AGENDADA' : estado
      await postulacionesApi.crear({
        estudianteId,
        vacanteId: modoManual || !vacanteSeleccionada ? null : vacanteSeleccionada,
        empresaNombre: empresaNombre.trim(),
        cargo: cargo.trim(),
        canal: canal.trim() || null,
        urlOferta: urlOferta.trim() || null,
        estado: estadoFinal,
        fechaHoraEntrevista: agendarEntrevista && fechaHoraEntrevista ? fechaHoraEntrevista : null,
        modalidadEntrevista: agendarEntrevista ? modalidadEntrevista : null,
        lugarEntrevista: agendarEntrevista && lugarEntrevista.trim() ? lugarEntrevista.trim() : null,
        contactoNombre: agendarEntrevista && contactoNombre.trim() ? contactoNombre.trim() : null,
        contactoEmail: agendarEntrevista && contactoEmail.trim() ? contactoEmail.trim() : null,
        contactoTelefono: agendarEntrevista && contactoTelefono.trim() ? contactoTelefono.trim() : null,
        observaciones: observaciones.trim() || null,
        proximoSeguimiento: proximoSeguimiento || null,
      })

      onGuardado()
      onOpenChange(false)
      // Reset form
      setVacanteSeleccionada('')
      setEmpresaNombre('')
      setCargo('')
      setAgendarEntrevista(false)
      setFechaHoraEntrevista('')
      setObservaciones('')
    } catch (err) {
      setError(err instanceof Error ? err.message : (es ? 'No se pudo registrar la postulación.' : 'Could not register application.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="gap-1.5 pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="size-5" />
            </div>
            {es ? 'Postular Estudiante a Vacante / Entrevista' : 'Apply Student to Vacancy / Interview'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {es
              ? `Registra el proceso de postulación y seguimiento en nombre de ${estudianteNombre}. Quedará registrado en la línea de tiempo de auditoría.`
              : `Register application and interview follow-up on behalf of ${estudianteNombre}. Will be tracked in the Salesforce-style audit log.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {/* Selección de Origen: Catálogo vs Manual */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                {es ? 'Origen de la oportunidad' : 'Opportunity source'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setModoManual((prev) => !prev)
                  if (!modoManual) {
                    setVacanteSeleccionada('')
                  }
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {modoManual
                  ? (es ? '← Seleccionar del catálogo de vacantes' : '← Pick from vacancy catalog')
                  : (es ? '+ Ingresar empresa/cargo manual' : '+ Enter custom company/role')}
              </button>
            </div>

            {!modoManual && (
              <div className="flex flex-col gap-1.5">
                <select
                  value={vacanteSeleccionada}
                  onChange={(e) => handleSeleccionarVacante(e.target.value)}
                  disabled={cargandoVacantes || guardando}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">
                    {cargandoVacantes
                      ? (es ? 'Cargando vacantes...' : 'Loading vacancies...')
                      : (es ? '— Selecciona una vacante activa del CRM —' : '— Select an active CRM vacancy —')}
                  </option>
                  {vacantes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.titulo} · {v.empresaNombre || v.empresaDeclarada || 'Empresa aliada'} {v.ubicacion ? `(${v.ubicacion})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Datos de Empresa y Cargo */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Empresa *' : 'Company *'}
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={empresaNombre}
                  onChange={(e) => setEmpresaNombre(e.target.value)}
                  placeholder={es ? 'Nombre de la empresa' : 'Company name'}
                  disabled={guardando}
                  className="h-9.5 rounded-xl pl-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Cargo / Posición *' : 'Role / Position *'}
              </label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder={es ? 'Ej. Desarrollador Web Junior' : 'e.g. Junior Web Developer'}
                  disabled={guardando}
                  className="h-9.5 rounded-xl pl-9 text-xs"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Canal de postulación' : 'Application channel'}
              </label>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                disabled={guardando}
                className="h-9.5 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                {CANALES_SUGERIDOS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Enlace de la oferta (opcional)' : 'Offer URL (optional)'}
              </label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="url"
                  value={urlOferta}
                  onChange={(e) => setUrlOferta(e.target.value)}
                  placeholder="https://..."
                  disabled={guardando}
                  className="h-9.5 rounded-xl pl-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Toggle de Entrevista */}
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-agendar-entrevista"
                  checked={agendarEntrevista}
                  onChange={(e) => {
                    setAgendarEntrevista(e.target.checked)
                    if (e.target.checked) setEstado('ENTREVISTA_AGENDADA')
                  }}
                  className="size-4 rounded accent-primary cursor-pointer"
                />
                <label htmlFor="chk-agendar-entrevista" className="cursor-pointer text-xs font-bold text-foreground">
                  {es ? '¿Agendar cita de entrevista de inmediato?' : 'Schedule interview appointment right now?'}
                </label>
              </div>
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                {agendarEntrevista ? (es ? 'Entrevista Agendada' : 'Interview Scheduled') : (es ? 'Postulación Enviada' : 'Application Sent')}
              </span>
            </div>

            {agendarEntrevista && (
              <div className="mt-3.5 grid gap-3 border-t border-primary/20 pt-3.5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {es ? 'Fecha y Hora de la Entrevista *' : 'Interview Date & Time *'}
                  </label>
                  <Input
                    type="datetime-local"
                    value={fechaHoraEntrevista}
                    onChange={(e) => setFechaHoraEntrevista(e.target.value)}
                    disabled={guardando}
                    className="h-9 rounded-xl text-xs"
                    required={agendarEntrevista}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {es ? 'Modalidad' : 'Modality'}
                  </label>
                  <select
                    value={modalidadEntrevista}
                    onChange={(e) => setModalidadEntrevista(e.target.value as ModalidadEntrevista)}
                    disabled={guardando}
                    className="h-9 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none"
                  >
                    <option value="VIRTUAL">{es ? 'Virtual (Meet / Zoom / Teams)' : 'Virtual'}</option>
                    <option value="PRESENCIAL">{es ? 'Presencial (En sede de la empresa)' : 'On-site'}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {modalidadEntrevista === 'VIRTUAL'
                      ? (es ? 'Enlace de la videollamada / reunión' : 'Meeting video link')
                      : (es ? 'Dirección o sede de la empresa' : 'On-site location address')}
                  </label>
                  <div className="relative">
                    {modalidadEntrevista === 'VIRTUAL' ? (
                      <Video className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                    <Input
                      value={lugarEntrevista}
                      onChange={(e) => setLugarEntrevista(e.target.value)}
                      placeholder={modalidadEntrevista === 'VIRTUAL' ? 'https://meet.google.com/...' : 'Calle 72 # 54-20, Piso 5'}
                      disabled={guardando}
                      className="h-9 rounded-xl pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {es ? 'Nombre del entrevistador / contacto' : 'Interviewer contact name'}
                  </label>
                  <Input
                    value={contactoNombre}
                    onChange={(e) => setContactoNombre(e.target.value)}
                    placeholder="Ej. Laura Martínez (RRHH)"
                    disabled={guardando}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {es ? 'Teléfono del contacto' : 'Contact phone'}
                  </label>
                  <Input
                    value={contactoTelefono}
                    onChange={(e) => setContactoTelefono(e.target.value)}
                    placeholder="+57 300 1234567"
                    disabled={guardando}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observaciones y Próximo Seguimiento */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Observaciones / Notas de Coordinación' : 'Coordination Notes & Observations'}
              </label>
              <Textarea
                minRows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={es ? 'Notas sobre la postulación, feedback del reclutador o recomendaciones para el estudiante...' : 'Internal notes, recruiter feedback, etc.'}
                disabled={guardando}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {es ? 'Próxima fecha de seguimiento' : 'Next follow-up date'}
              </label>
              <Input
                type="date"
                value={proximoSeguimiento}
                onChange={(e) => setProximoSeguimiento(e.target.value)}
                disabled={guardando}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
              className="rounded-xl"
            >
              {es ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={guardando || !empresaNombre.trim() || !cargo.trim()}
              className="rounded-xl"
            >
              {guardando ? (es ? 'Guardando...' : 'Saving...') : (
                <>
                  <Check className="size-4" />
                  {agendarEntrevista
                    ? (es ? 'Postular y Agendar Entrevista' : 'Apply & Schedule Interview')
                    : (es ? 'Registrar Postulación' : 'Register Application')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
