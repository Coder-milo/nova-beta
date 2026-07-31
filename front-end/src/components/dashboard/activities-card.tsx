'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDots,
  Check,
  CircleNotch,
  NotePencil,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
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

function errorMessage(error: unknown): string {
  if (error instanceof ApiCallError) {
    if (error.status === 401 || error.status === 403) return 'No tienes permisos para modificar la agenda.'
    return error.body.message ?? `Error del servidor (HTTP ${error.status}).`
  }
  return 'No se pudo conectar con la agenda.'
}

function formatDate(activity: ActividadResponse): string {
  if (!activity.fecha) return 'Sin fecha'
  try {
    const date = new Date(`${activity.fecha}T${activity.hora ?? '00:00'}:00`)
    if (isNaN(date.getTime())) return activity.fecha
    const day = new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
    if (!activity.hora) return day
    const time = new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
    return `${day} · ${time}`
  } catch {
    return activity.fecha
  }
}

export function ActivitiesCard() {
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
      setError(errorMessage(err))
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.nombre.trim()) { setError('Escribe el título de la actividad.'); return }
    if (!form.fecha) { setError('Selecciona la fecha.'); return }
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
      setError(errorMessage(err))
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
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (activity: ActividadResponse) => {
    if (!confirm(`¿Eliminar "${activity.nombre}" de la agenda?`)) return
    setBusyId(activity.id); setError(null)
    try {
      await actividadesApi.eliminarAgenda(activity.id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Próximas actividades</CardTitle>
            <CardDescription>Agenda y notas de los próximos días</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="size-3.5" /> Nueva
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
              <span className="text-sm font-medium text-foreground">Tu agenda está libre</span>
              <span className="max-w-xs text-xs text-muted-foreground">Crea una reunión, tarea, recordatorio o nota para verla aquí.</span>
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
                  title="Marcar como completada"
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
                  <span className="block text-xs text-muted-foreground">{formatDate(activity)}</span>
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
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 pb-6 pt-20 backdrop-blur-sm sm:items-center sm:py-6" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar actividad' : 'Nueva actividad'}>
          <Card className="flex max-h-[calc(100dvh-6rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-border bg-background shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
            <CardHeader className="flex shrink-0 flex-row items-start justify-between border-b border-border bg-background">
              <div>
                <CardTitle>{editingId ? 'Editar actividad' : 'Nueva actividad o nota'}</CardTitle>
                <CardDescription>Organiza una tarea, reunión, recordatorio o anotación.</CardDescription>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </CardHeader>
            <form onSubmit={submit} className="min-h-0 overflow-y-auto">
              <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="agenda-name" className="text-xs font-medium text-muted-foreground">Título *</label>
                  <Input id="agenda-name" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Comité académico" autoFocus />
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
                  <label htmlFor="agenda-category" className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <select id="agenda-category" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="GENERAL">General</option>
                    <option value="REUNION">Reunión</option>
                    <option value="PROCESO">Proceso</option>
                    <option value="ACADEMICO">Académico</option>
                    <option value="AUDITORIA">Auditoría</option>
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
                  <Textarea id="agenda-description" value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles, pendientes o información útil…" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="agenda-owner" className="text-xs font-medium text-muted-foreground">Responsable</label>
                  <Input id="agenda-owner" value={form.responsable ?? ''} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre del responsable" />
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive sm:col-span-2">
                    <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : editingId ? 'Guardar cambios' : 'Agregar a la agenda'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </>
  )
}
