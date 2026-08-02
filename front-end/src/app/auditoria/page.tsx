'use client'

import { ArrowsClockwiseIcon as ArrowsClockwise, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, ShieldCheckIcon as ShieldCheck, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
/**
 * Página de Auditoría — registro histórico de acciones del sistema.
 *
 * Consume:
 *   GET /api/v1/auditoria?usuario=&modulo=&accion=&page=&size= → búsqueda paginada
 */

import { useState, useEffect, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { auditoriaApi, ApiCallError } from '@/lib/api'
import type { AuditoriaResponse, Page } from '@/lib/types'

const modulos = ['Proyectos', 'Estudiantes', 'Documentos', 'Hojas de vida', 'Importaciones']
const acciones = ['Creación', 'Actualización', 'Eliminación', 'Cambio de estado']

function formatoFecha(fecha: string): string {
  try {
    return new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return fecha }
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{children}</span>
}

function CampoDetalle({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Etiqueta>{label}</Etiqueta>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  )
}

export default function AuditoriaPage() {
  const [page, setPage]           = useState<Page<AuditoriaResponse> | null>(null)
  const [currentPage, setCurrent] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Filtros
  const [usuarioInput, setUsuarioInput] = useState('')
  const [usuario, setUsuario] = useState('')
  const [modulo, setModulo]   = useState('')
  const [accion, setAccion]   = useState('')

  const [selected, setSelected] = useState<AuditoriaResponse | null>(null)

  const load = useCallback(async (p: number, u: string, m: string, a: string) => {
    setLoading(true); setError(null)
    try {
      setPage(await auditoriaApi.buscar({
        usuario: u || undefined, modulo: m || undefined, accion: a || undefined,
        page: p, size: 20,
      }))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.'
          : `Error al cargar la auditoría (HTTP ${err.status}).`)
      } else { setError('No se pudo conectar con el backend.') }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(currentPage, usuario, modulo, accion) }, [load, currentPage, usuario, modulo, accion])

  const aplicarFiltros = (e: React.SyntheticEvent) => {
    e.preventDefault()
    setCurrent(0); setUsuario(usuarioInput.trim())
  }

  const limpiarFiltros = () => {
    setUsuarioInput(''); setUsuario(''); setModulo(''); setAccion(''); setCurrent(0)
  }

  const hayFiltros = usuario || modulo || accion || usuarioInput

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" size="sm" onClick={() => load(currentPage, usuario, modulo, accion)}>
          <ArrowsClockwise className="size-3.5" /> Refrescar
        </Button>
      </div>

      {/* Filtros */}
      <form onSubmit={aplicarFiltros} className="flex flex-wrap items-center gap-2">
        <Input value={usuarioInput} onChange={(e) => setUsuarioInput(e.target.value)} placeholder="Filtrar por usuario…" className="w-56" />
        <select value={modulo} onChange={(e) => { setModulo(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filtrar por módulo">
          <option value="">Todos los módulos</option>
          {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={accion} onChange={(e) => { setAccion(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filtrar por acción">
          <option value="">Todas las acciones</option>
          {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
        {hayFiltros && (
          <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros}>
            <X className="size-3.5" /> Limpiar
          </Button>
        )}
      </form>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">Cargando registros de auditoría…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => load(currentPage, usuario, modulo, accion)}>
            <ArrowsClockwise className="size-4" /> Reintentar
          </Button>
        </div>
      )}

      {/* Tabla */}
      {!loading && !error && page && (
        page.content.length === 0 ? (
          <Card className="rounded-lg border-border shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <ShieldCheck className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {hayFiltros ? 'No hay registros que coincidan con los filtros.' : 'Aún no hay registros de auditoría.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Módulo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acción</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entidad</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.content.map((reg) => (
                    <tr key={reg.id} onClick={() => setSelected(reg)} className="cursor-pointer hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{formatoFecha(reg.fecha)}</td>
                      <td className="px-4 py-3 text-foreground">{reg.usuario}</td>
                      <td className="px-4 py-3 text-muted-foreground">{reg.modulo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{reg.accion}</td>
                      <td className="px-4 py-3 text-muted-foreground">{reg.entidad}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{reg.registroNombre ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {page.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {page.number + 1} de {page.totalPages} · {page.totalElements} registros
                </span>
                <div className="flex gap-1">
                  <button type="button" disabled={page.number === 0} onClick={() => setCurrent((p) => p - 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretLeft className="size-4" />
                  </button>
                  <button type="button" disabled={page.number >= page.totalPages - 1} onClick={() => setCurrent((p) => p + 1)}
                    className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <CaretRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        )
      )}

      {/* Drawer de detalle */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <SheetTitle className="text-base">Detalle del registro</SheetTitle>
                <SheetDescription className="text-xs tabular-nums">{formatoFecha(selected.fecha)}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoDetalle label="Usuario" value={selected.usuario} />
                  <CampoDetalle label="Módulo" value={selected.modulo} />
                  <CampoDetalle label="Acción" value={selected.accion} />
                  <CampoDetalle label="Entidad" value={selected.entidad} />
                  <CampoDetalle label="Registro" value={selected.registroNombre} />
                  <CampoDetalle label="ID del registro" value={selected.registroId} />
                  <CampoDetalle label="Dirección IP" value={selected.ip} />
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <Etiqueta>Información anterior</Etiqueta>
                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{selected.datosAnteriores ?? '—'}</pre>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <Etiqueta>Información nueva</Etiqueta>
                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{selected.datosNuevos ?? '—'}</pre>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
