'use client'

import { ArrowsClockwise, CheckCircle, CircleNotch, Eye, Kanban, PencilSimple, Plus, Trash, WarningCircle, X } from '@phosphor-icons/react'
/**
 * Página de Proyectos / Programas — CRUD completo.
 *
 * Consume:
 *   GET    /api/v1/programas           → lista
 *   POST   /api/v1/programas           → crear
 *   PUT    /api/v1/programas/{id}      → editar
 *   PATCH  /api/v1/programas/{id}/estado → cambiar estado
 */

import { useState, useEffect, useTransition } from 'react'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EstadoDot } from '@/components/ui/estado-dot'
import { programasApi, ApiCallError } from '@/lib/api'
import type { ProgramaResponse, ProgramaRequest, ProgramaEstado } from '@/lib/types'

const estadoLabels: Record<ProgramaEstado, { label: string; dot: string; text: string }> = {
  PLANEACION:   { label: 'Planeación',   dot: 'bg-navy-200', text: 'text-navy-400' },
  BORRADOR:     { label: 'Borrador',     dot: 'bg-navy-300', text: 'text-navy-500' },
  ACTIVO:       { label: 'Activo',       dot: 'bg-success',  text: 'text-[#0F6E56]' },
  EN_EJECUCION: { label: 'En ejecución', dot: 'bg-success',  text: 'text-[#0F6E56]' },
  PAUSADO:      { label: 'Pausado',      dot: 'bg-warning',  text: 'text-amber-700' },
  FINALIZADO:   { label: 'Finalizado',   dot: 'bg-navy-800', text: 'text-navy-800' },
  CANCELADO:    { label: 'Cancelado',    dot: 'bg-red-600',  text: 'text-red-700' },
  ARCHIVADO:    { label: 'Archivado',    dot: 'bg-red-600',  text: 'text-red-700' },
}

// Campos extendidos del programa que aún no están en el DTO base.
type ProgramaExtra = {
  cliente?: string | null
  responsable?: string | null
  observaciones?: string | null
  porcentajeAvance?: number | null
}
type ProgramaForm = ProgramaRequest & {
  cliente?: string
  responsable?: string
  observaciones?: string
  porcentajeAvance?: number
}

const emptyForm: ProgramaForm = {
  nombre: '', descripcion: '', duracionDias: undefined, fechaInicio: '', fechaFin: '', estado: 'BORRADOR',
  cliente: '', responsable: '', observaciones: '', porcentajeAvance: undefined,
}

export default function ProyectosPage() {
  const [programas, setProgramas]     = useState<ProgramaResponse[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const [showForm, setShowForm]       = useState(false)
  const [formMode, setFormMode]       = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<ProgramaForm>(emptyForm)
  const [formError, setFormError]     = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  // ── Cargar ────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true); setError(null)
    try { setProgramas(await programasApi.listar()) }
    catch { setError('No se pudieron cargar los programas.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Abrir formularios ─────────────────────────────────────────────────────
  const openCreate = () => {
    setFormMode('create'); setEditingId(null); setForm(emptyForm)
    setFormError(null); setFormSuccess(null); setShowForm(true)
  }
  const openEdit = (p: ProgramaResponse) => {
    const ext = p as ProgramaResponse & ProgramaExtra
    setFormMode('edit'); setEditingId(p.id)
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', duracionDias: p.duracionDias ?? undefined,
      fechaInicio: p.fechaInicio ?? '', fechaFin: p.fechaFin ?? '', estado: p.estado,
      cliente: ext.cliente ?? '', responsable: ext.responsable ?? '',
      observaciones: ext.observaciones ?? '', porcentajeAvance: ext.porcentajeAvance ?? undefined,
    })
    setFormError(null); setFormSuccess(null); setShowForm(true)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      setFormError('La fecha final debe ser posterior a la fecha de inicio.')
      return
    }
    startTransition(async () => {
      try {
        if (formMode === 'create') {
          await programasApi.crear(form)
          setFormSuccess('Programa creado exitosamente.')
        } else if (editingId) {
          await programasApi.actualizar(editingId, form)
          setFormSuccess('Programa actualizado.')
        }
        setTimeout(() => { setShowForm(false); load() }, 800)
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 401 || err.status === 403) {
            setFormError('No tienes permisos para guardar este programa.')
          } else {
            setFormError(err.body.message || `No fue posible guardar el programa (HTTP ${err.status}).`)
          }
        } else { setFormError('No se pudo conectar con el backend.') }
      }
    })
  }

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const changeStatus = (id: string, estado: ProgramaEstado) => {
    startTransition(async () => {
      try {
        await programasApi.cambiarEstado(id, estado)
        load()
      } catch (err) {
        if (err instanceof ApiCallError) alert(`Error: ${err.body.message ?? `HTTP ${err.status}`}`)
        else alert('Error de conexión.')
      }
    })
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const handleDelete = (p: ProgramaResponse) => {
    if (!confirm(`¿Eliminar el proyecto "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      try {
        await programasApi.eliminar(p.id)
        load()
      } catch (err) {
        if (err instanceof ApiCallError) alert(`Error: ${err.body.message ?? `HTTP ${err.status}`}`)
        else alert('Error de conexión.')
      }
    })
  }

  const f = (key: keyof ProgramaForm, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><ArrowsClockwise className="size-3.5" /></Button>
          <Button onClick={openCreate} className="shrink-0"><Plus className="size-4" /> Nuevo Programa</Button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="rounded-xl shadow-sm border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{formMode === 'create' ? 'Nuevo Programa' : 'Editar Programa'}</CardTitle>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            <CardDescription>El nombre es obligatorio. Las fechas y duración son opcionales.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="p-nombre" className="text-xs font-medium">Nombre *</label>
                <Input id="p-nombre" required value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ruta Accelerator" disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="p-desc" className="text-xs font-medium">Descripción</label>
                <textarea id="p-desc" rows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.descripcion ?? ''} onChange={(e) => f('descripcion', e.target.value)} placeholder="Descripción del programa…" disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-cliente" className="text-xs font-medium">Cliente</label>
                <Input id="p-cliente" value={form.cliente ?? ''} onChange={(e) => f('cliente', e.target.value)} placeholder="Entidad o cliente" disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-responsable" className="text-xs font-medium">Responsable</label>
                <Input id="p-responsable" value={form.responsable ?? ''} onChange={(e) => f('responsable', e.target.value)} placeholder="Nombre del responsable" disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-avance" className="text-xs font-medium">% de avance</label>
                <Input id="p-avance" type="number" min={0} max={100} value={form.porcentajeAvance ?? ''} onChange={(e) => f('porcentajeAvance', e.target.value === '' ? undefined : Math.min(100, Math.max(0, parseInt(e.target.value))))} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="p-obs" className="text-xs font-medium">Observaciones</label>
                <textarea id="p-obs" rows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.observaciones ?? ''} onChange={(e) => f('observaciones', e.target.value)} placeholder="Observaciones internas…" disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-duracion" className="text-xs font-medium">Duración (días)</label>
                <Input id="p-duracion" type="number" min={1} value={form.duracionDias ?? ''} onChange={(e) => f('duracionDias', e.target.value ? parseInt(e.target.value) : undefined)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-inicio" className="text-xs font-medium">Fecha inicio</label>
                <Input id="p-inicio" type="date" value={form.fechaInicio ?? ''} onChange={(e) => f('fechaInicio', e.target.value)} disabled={isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="p-fin" className="text-xs font-medium">Fecha fin</label>
                <Input id="p-fin" type="date" value={form.fechaFin ?? ''} onChange={(e) => f('fechaFin', e.target.value)} disabled={isPending} />
              </div>

              {formError && (
                <div role="alert" className="col-span-full flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="col-span-full flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}
              <div className="col-span-full flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : formMode === 'create' ? 'Crear' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner label="Cargando programas…" />
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={load}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && (
        <>
          {programas.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <Kanban className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay programas registrados.</p>
                <Button onClick={openCreate} variant="outline"><Plus className="size-4" /> Crear el primero</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programas.map((p) => {
                const si = estadoLabels[p.estado] ?? { label: p.estado, dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }
                return (
                  <Card key={p.id} className="rounded-lg border-border shadow-none">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm leading-tight">{p.nombre}</CardTitle>
                        <EstadoDot {...si} className="shrink-0" />
                      </div>
                      <CardDescription className="line-clamp-2 text-xs">{p.descripcion || 'Sin descripción.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="block text-muted-foreground text-[10px] uppercase">Duración</span>
                          <span className="font-medium">{p.duracionDias ? `${p.duracionDias} días` : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground text-[10px] uppercase">Estudiantes</span>
                          <span className="font-medium">{p.totalEstudiantes}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground text-[10px] uppercase">Inicio</span>
                          <span className="font-medium">{p.fechaInicio ?? '—'}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground text-[10px] uppercase">Fin</span>
                          <span className="font-medium">{p.fechaFin ?? '—'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                        <Link href={`/proyectos/${p.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                          <Eye className="size-3" /> Ver
                        </Link>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)} disabled={isPending}>
                          <PencilSimple className="size-3" /> Editar
                        </Button>
                        {p.estado === 'BORRADOR' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => changeStatus(p.id, 'ACTIVO')} disabled={isPending}>Activar</Button>
                        )}
                        {p.estado === 'ACTIVO' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => changeStatus(p.id, 'FINALIZADO')} disabled={isPending}>Finalizar</Button>
                        )}
                        {p.estado === 'FINALIZADO' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => changeStatus(p.id, 'ARCHIVADO')} disabled={isPending}>Archivar</Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(p)} disabled={isPending}>
                          <Trash className="size-3" /> Eliminar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
