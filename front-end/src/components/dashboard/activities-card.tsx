'use client'

import { useEffect, useState } from 'react'
import { CalendarDotsIcon as CalendarDots, CheckIcon as Check, CircleNotchIcon as CircleNotch, NotePencilIcon as NotePencil, PencilSimpleIcon as PencilSimple, PlusIcon as Plus, TrashIcon as Trash, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { actividadesApi, programasApi, ApiCallError } from '@/lib/api'
import { hoyLocal } from '@/lib/utils'
import type { ActividadRequest, ActividadResponse, ProgramaResponse } from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmar } from '@/components/ui/confirmar'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

const categoryStyles: Record<string, string> = {
  REUNION: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  PROCESO: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  ACADEMICO: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  AUDITORIA: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  NOTA: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  GENERAL: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
}

const emptyForm: ActividadRequest = {
  nombre: '',
  fecha: new Date().toISOString().slice(0, 10),
  hora: '09:00',
  descripcion: '',
  categoria: 'GENERAL',
  responsable: '',
  programaId: undefined,
  estado: 'PENDIENTE',
}

/** No son componentes: no pueden leer el idioma, se lo pasan. */
function errorMessage(error: unknown, T: ReturnType<typeof textos>): string {
  if (error instanceof ApiCallError) {
    if (error.status === 401 || error.status === 403) return T.noTienesPermisos
    return error.body.message ?? `Error ${error.status}.`
  }
  return T.noSePudo
}

function formatDate(activity: ActividadResponse, sinFecha: string, english: boolean): string {
  if (!activity.fecha) return sinFecha
  const idioma = english ? 'en-GB' : 'es-CO'
  try {
    const date = new Date(`${activity.fecha}T${activity.hora ?? '00:00'}:00`)
    if (isNaN(date.getTime())) return activity.fecha
    const day = new Intl.DateTimeFormat(idioma, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
    if (!activity.hora) return day
    const time = new Intl.DateTimeFormat(idioma, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
    return `${day} · ${time}`
  } catch {
    return activity.fecha
  }
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        creaUnaReunion: 'Create a meeting, task, reminder or note to see it here.',
        organizaUnaTarea: 'Organise a task, meeting, reminder or note.',
        noTienesPermisos: 'You do not have permission to change the agenda.',
        detallesPendientesO: 'Details, pending items or useful information…',
        noSePudo: 'Could not reach the agenda.',
        escribeElTitulo: 'Type the title of the activity.',
        agendaYNotas: 'Agenda and notes for the coming days',
        nuevaActividadO: 'New activity or note',
        marcarComoCompletada: 'Mark as completed',
        agregarALa: 'Add to the agenda',
        nombreDelResponsable: 'Person in charge',
        proximasActividades: 'Upcoming activities',
        tuAgendaEsta: 'Your agenda is clear',
        seleccionaLaFecha: 'Choose the date.',
        eliminarActividad: 'Delete activity',
        ejComiteAcademico: 'e.g. Academic committee',
        editarActividad: 'Edit activity',
        nuevaActividad: 'New activity',
        guardarCambios: 'Save changes',
        titulo: 'Title *',
        categoria: 'Category',
        auditoria: 'Audit',
        academico: 'Academic',
        reunion: 'Meeting',
        sinFecha: 'No date',
        nueva: 'New',
      }
    : {
        creaUnaReunion: 'Crea una reunión, tarea, recordatorio o nota para verla aquí.',
        organizaUnaTarea: 'Organiza una tarea, reunión, recordatorio o anotación.',
        noTienesPermisos: 'No tienes permisos para modificar la agenda.',
        detallesPendientesO: 'Detalles, pendientes o información útil…',
        noSePudo: 'No se pudo conectar con la agenda.',
        escribeElTitulo: 'Escribe el título de la actividad.',
        agendaYNotas: 'Agenda y notas de los próximos días',
        nuevaActividadO: 'Nueva actividad o nota',
        marcarComoCompletada: 'Marcar como completada',
        agregarALa: 'Agregar a la agenda',
        nombreDelResponsable: 'Nombre del responsable',
        proximasActividades: 'Próximas actividades',
        tuAgendaEsta: 'Tu agenda está libre',
        seleccionaLaFecha: 'Selecciona la fecha.',
        eliminarActividad: 'Eliminar actividad',
        ejComiteAcademico: 'Ej: Comité académico',
        editarActividad: 'Editar actividad',
        nuevaActividad: 'Nueva actividad',
        guardarCambios: 'Guardar cambios',
        titulo: 'Título *',
        categoria: 'Categoría',
        auditoria: 'Auditoría',
        academico: 'Académico',
        reunion: 'Reunión',
        sinFecha: 'Sin fecha',
        nueva: 'Nueva',
      }
}

export function ActivitiesCard() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const [activities, setActivities] = useState<ActividadResponse[]>([])
  const [programs, setPrograms] = useState<ProgramaResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ActividadRequest>({ ...emptyForm })

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [nextActivities, nextPrograms] = await Promise.all([
        actividadesApi.proximas(),
        programasApi.listar().catch(() => []),
      ])
      setActivities(nextActivities)
      setPrograms(nextPrograms)
    } catch (err) {
      setError(errorMessage(err, T))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
  fecha: hoyLocal(),
    })
    setError(null)
    setOpen(true)
  }

  const openEdit = (activity: ActividadResponse) => {
    setEditingId(activity.id)
    setForm({
      nombre: activity.nombre,
      fecha: activity.fecha,
      hora: activity.hora?.slice(0, 5) ?? '',
      descripcion: activity.descripcion ?? '',
      categoria: activity.categoria || 'GENERAL',
      responsable: activity.responsable ?? '',
      programaId: activity.programaId ?? undefined,
      estado: activity.estado,
    })
    setError(null)
    setOpen(true)
  }

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!form.nombre.trim()) { setError(T.escribeElTitulo); return }
    if (!form.fecha) { setError(T.seleccionaLaFecha); return }
    setSaving(true); setError(null)
    try {
      const body: ActividadRequest = {
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || undefined,
        responsable: form.responsable?.trim() || undefined,
        hora: form.hora || undefined,
        programaId: form.programaId || undefined,
      }
      if (editingId) await actividadesApi.actualizarAgenda(editingId, body)
      else await actividadesApi.crearAgenda(body)
      setOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err, T))
    } finally {
      setSaving(false)
    }
  }

  const complete = async (id: string) => {
    setBusyId(id); setError(null)
    try {
      await actividadesApi.alternarCompletada(id)
      await load()
    } catch (err) {
      setError(errorMessage(err, T))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (activity: ActividadResponse) => {
    if (
      !(await confirmar({
        titulo: T.eliminarActividad,
        descripcion: `Se eliminará "${activity.nombre}" de la agenda.`,
        textoConfirmar: C.eliminar,
      }))
    )
      return
    setBusyId(activity.id); setError(null)
    try {
      await actividadesApi.eliminarAgenda(activity.id)
      await load()
    } catch (err) {
      setError(errorMessage(err, T))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{T.proximasActividades}</CardTitle>
            <CardDescription>{T.agendaYNotas}</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="size-3.5" /> {T.nueva}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && !open && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <CircleNotch className="size-5 animate-spin" /> Cargando agenda…
            </div>
          ) : activities.length === 0 ? (
            <button
              type="button"
              onClick={openCreate}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center transition-colors hover:border-primary/35 hover:bg-primary/[0.04]"
            >
              <NotePencil className="size-8 text-muted-foreground/50" />
              <span className="text-sm font-medium text-foreground">{T.tuAgendaEsta}</span>
              <span className="max-w-xs text-xs text-muted-foreground">{T.creaUnaReunion}</span>
            </button>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="group flex items-center gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] p-3 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/[0.04] hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => complete(activity.id)}
                  disabled={busyId === activity.id}
                  className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-[#0071E3] text-white shadow-xs transition-colors hover:bg-emerald-600 disabled:opacity-60"
                  title={T.marcarComoCompletada}
                  aria-label={`Completar ${activity.nombre}`}
                >
                  {busyId === activity.id ? <CircleNotch className="size-5 animate-spin" /> : <CalendarDots className="size-5 group-hover:hidden" />}
                  {busyId !== activity.id && <Check className="hidden size-5 group-hover:block" />}
                </button>
                <button type="button" onClick={() => openEdit(activity)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{activity.nombre}</span>
                    <Badge className={`shrink-0 border-0 text-[10px] ${categoryStyles[activity.categoria] ?? categoryStyles.GENERAL}`}>
                      {activity.categoria.charAt(0) + activity.categoria.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <span className="block text-xs text-muted-foreground">{formatDate(activity, T.sinFecha, locale === 'en')}</span>
                  {(activity.programaNombre || activity.descripcion) && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                      {activity.programaNombre ?? activity.descripcion}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button type="button" onClick={() => openEdit(activity)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Editar ${activity.nombre}`}>
                    <PencilSimple className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(activity)} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${activity.nombre}`}>
                    <Trash className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 pb-6 pt-20 backdrop-blur-sm sm:items-center sm:py-6" role="dialog" aria-modal="true" aria-label={editingId ? T.editarActividad : T.nuevaActividad}>
          <Card className="flex max-h-[calc(100dvh-6rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-border bg-background shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
            <CardHeader className="flex shrink-0 flex-row items-start justify-between border-b border-border bg-background">
              <div>
                <CardTitle>{editingId ? T.editarActividad : T.nuevaActividadO}</CardTitle>
                <CardDescription>{T.organizaUnaTarea}</CardDescription>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={C.cerrar}>
                <X className="size-5" />
              </button>
            </CardHeader>
            <form onSubmit={submit} className="min-h-0 overflow-y-auto">
              <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="agenda-name" className="text-xs font-medium text-muted-foreground">{T.titulo}</label>
                  <Input id="agenda-name" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={T.ejComiteAcademico} autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="agenda-date" className="text-xs font-medium text-muted-foreground">Fecha *</label>
                  <Input id="agenda-date" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="agenda-time" className="text-xs font-medium text-muted-foreground">Hora</label>
                  <Input id="agenda-time" type="time" value={form.hora ?? ''} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="agenda-category" className="text-xs font-medium text-muted-foreground">{T.categoria}</label>
                  <select id="agenda-category" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="GENERAL">General</option>
                    <option value="REUNION">{T.reunion}</option>
                    <option value="PROCESO">Proceso</option>
                    <option value="ACADEMICO">{T.academico}</option>
                    <option value="AUDITORIA">{T.auditoria}</option>
                    <option value="NOTA">Nota</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="agenda-program" className="text-xs font-medium text-muted-foreground">Proyecto relacionado</label>
                  <select id="agenda-program" value={form.programaId ?? ''} onChange={(e) => setForm({ ...form, programaId: e.target.value || undefined })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Agenda general</option>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="agenda-description" className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Textarea id="agenda-description" value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder={T.detallesPendientesO} className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="agenda-owner" className="text-xs font-medium text-muted-foreground">Responsable</label>
                  <Input id="agenda-owner" value={form.responsable ?? ''} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder={T.nombreDelResponsable} />
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive sm:col-span-2">
                    <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : editingId ? T.guardarCambios : T.agregarALa}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
      {dialogo}
    </>
  )
}
