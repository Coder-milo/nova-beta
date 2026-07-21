'use client'

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
import {
  FolderKanban, Plus, Loader2, AlertCircle, Edit2, CheckCircle2, X, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { programasApi, ApiCallError } from '@/lib/api'
import type { ProgramaResponse, ProgramaRequest, ProgramaEstado } from '@/lib/types'

const estadoLabels: Record<ProgramaEstado, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  BORRADOR:   { label: 'Borrador',   variant: 'outline'     },
  ACTIVO:     { label: 'Activo',     variant: 'default'     },
  FINALIZADO: { label: 'Finalizado', variant: 'secondary'   },
  ARCHIVADO:  { label: 'Archivado',  variant: 'destructive' },
}

const emptyForm: ProgramaRequest = {
  nombre: '', descripcion: '', duracionDias: undefined, fechaInicio: '', fechaFin: '', estado: 'BORRADOR',
}

export default function ProyectosPage() {
  const [programas, setProgramas]     = useState<ProgramaResponse[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const [showForm, setShowForm]       = useState(false)
  const [formMode, setFormMode]       = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<ProgramaRequest>(emptyForm)
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
    setFormMode('edit'); setEditingId(p.id)
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', duracionDias: p.duracionDias ?? undefined,
      fechaInicio: p.fechaInicio ?? '', fechaFin: p.fechaFin ?? '', estado: p.estado,
    })
    setFormError(null); setFormSuccess(null); setShowForm(true)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
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
          setFormError(err.status === 401 || err.status === 403 ? 'Sin permisos.' : `Error del servidor (HTTP ${err.status}).`)
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

  const f = (key: keyof ProgramaRequest, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FolderKanban className="size-5" /> Proyectos
          </h2>
          <p className="text-sm text-muted-foreground">Administra los programas de empleabilidad de la academia.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /></Button>
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
                  <AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="col-span-full flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}
              <div className="col-span-full flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><Loader2 className="size-4 animate-spin" /> Guardando…</> : formMode === 'create' ? 'Crear' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Cargando programas…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && (
        <>
          {programas.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <FolderKanban className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay programas registrados.</p>
                <Button onClick={openCreate} variant="outline"><Plus className="size-4" /> Crear el primero</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programas.map((p) => {
                const si = estadoLabels[p.estado] ?? { label: p.estado, variant: 'outline' as const }
                return (
                  <Card key={p.id} className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm leading-tight">{p.nombre}</CardTitle>
                        <Badge variant={si.variant} className="shrink-0">{si.label}</Badge>
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
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)} disabled={isPending}>
                          <Edit2 className="size-3" /> Editar
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
