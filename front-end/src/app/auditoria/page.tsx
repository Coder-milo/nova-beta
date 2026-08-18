'use client'

import { ChevronLeft as CaretLeft, ChevronRight as CaretRight, CircleAlert as WarningCircle, RefreshCw as ArrowsClockwise, ShieldCheck, X } from 'lucide-react'
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
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'

/**
 * El valor va tal cual al backend, que guarda el modulo y la accion en
 * espanol; solo la etiqueta cambia de idioma. Por eso van separados.
 */
const MODULOS = ['Proyectos', 'Estudiantes', 'Documentos', 'Hojas de vida', 'Importaciones'] as const
const ACCIONES = ['Creación', 'Actualización', 'Eliminación', 'Cambio de estado'] as const

function etiquetaModulo(T: ReturnType<typeof textos>, C: TextosAdmin, valor: string) {
  return { Proyectos: T.proyectos, Estudiantes: C.estudiantes, Documentos: C.documentos,
           'Hojas de vida': T.hojasDeVida, Importaciones: T.importaciones }[valor] ?? valor
}

function etiquetaAccion(T: ReturnType<typeof textos>, valor: string) {
  return { 'Creación': T.creacion, 'Actualización': T.actualizacion,
           'Eliminación': T.eliminacion, 'Cambio de estado': T.cambioDeEstado }[valor] ?? valor
}

/** `en-GB` y no `en-US`: el dia primero, como en el resto del sistema. */
function formatoFecha(fecha: string, english = false): string {
  try {
    return new Date(fecha).toLocaleString(english ? 'en-GB' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' })
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

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        noHayRegistros: 'No records match the filters.',
        aunNoHay: 'There are no audit records yet.',
        cargandoRegistrosDe: 'Loading audit records…',
        detalleDelRegistro: 'Record detail',
        informacionAnterior: 'Previous data',
        informacionNueva: 'New data',
        filtrarPorUsuario: 'Filter by user…',
        filtrarPorModulo: 'Filter by module',
        filtrarPorAccion: 'Filter by action',
        todosLosModulos: 'All modules',
        todasLasAcciones: 'All actions',
        cambioDeEstado: 'Status change',
        idDelRegistro: 'Record ID',
        direccionIp: 'IP address',
        hojasDeVida: 'Résumés',
        importaciones: 'Imports',
        actualizacion: 'Update',
        eliminacion: 'Deletion',
        creacion: 'Creation',
        proyectos: 'Projects',
        modulo: 'Module',
        accion: 'Action',
      }
    : {
        noHayRegistros: 'No hay registros que coincidan con los filtros.',
        aunNoHay: 'Aún no hay registros de auditoría.',
        cargandoRegistrosDe: 'Cargando registros de auditoría…',
        detalleDelRegistro: 'Detalle del registro',
        informacionAnterior: 'Información anterior',
        informacionNueva: 'Información nueva',
        filtrarPorUsuario: 'Filtrar por usuario…',
        filtrarPorModulo: 'Filtrar por módulo',
        filtrarPorAccion: 'Filtrar por acción',
        todosLosModulos: 'Todos los módulos',
        todasLasAcciones: 'Todas las acciones',
        cambioDeEstado: 'Cambio de estado',
        idDelRegistro: 'ID del registro',
        direccionIp: 'Dirección IP',
        hojasDeVida: 'Hojas de vida',
        importaciones: 'Importaciones',
        actualizacion: 'Actualización',
        eliminacion: 'Eliminación',
        creacion: 'Creación',
        proyectos: 'Proyectos',
        modulo: 'Módulo',
        accion: 'Acción',
      }
}

export default function AuditoriaPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
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
          ? C.errorPermisos
          : `Error al cargar la auditoría (HTTP ${err.status}).`)
      } else { setError(C.errorConexion) }
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
        <Input value={usuarioInput} onChange={(e) => setUsuarioInput(e.target.value)} placeholder={T.filtrarPorUsuario} className="w-56" />
        <select value={modulo} onChange={(e) => { setModulo(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={T.filtrarPorModulo}>
          <option value="">{T.todosLosModulos}</option>
          {MODULOS.map((m) => <option key={m} value={m}>{etiquetaModulo(T, C, m)}</option>)}
        </select>
        <select value={accion} onChange={(e) => { setAccion(e.target.value); setCurrent(0) }}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={T.filtrarPorAccion}>
          <option value="">{T.todasLasAcciones}</option>
          {ACCIONES.map((a) => <option key={a} value={a}>{etiquetaAccion(T, a)}</option>)}
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
          <span className="ml-2 text-sm text-muted-foreground">{T.cargandoRegistrosDe}</span>
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
                {hayFiltros ? T.noHayRegistros : T.aunNoHay}
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.modulo}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.accion}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entidad</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.content.map((reg) => (
                    <tr key={reg.id} onClick={() => setSelected(reg)} className="cursor-pointer hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{formatoFecha(reg.fecha, locale === 'en')}</td>
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
                <SheetTitle className="text-base">{T.detalleDelRegistro}</SheetTitle>
                <SheetDescription className="text-xs tabular-nums">{formatoFecha(selected.fecha, locale === 'en')}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoDetalle label="Usuario" value={selected.usuario} />
                  <CampoDetalle label={T.modulo} value={selected.modulo} />
                  <CampoDetalle label={T.accion} value={selected.accion} />
                  <CampoDetalle label="Entidad" value={selected.entidad} />
                  <CampoDetalle label="Registro" value={selected.registroNombre} />
                  <CampoDetalle label={T.idDelRegistro} value={selected.registroId} />
                  <CampoDetalle label={T.direccionIp} value={selected.ip} />
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <Etiqueta>{T.informacionAnterior}</Etiqueta>
                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{selected.datosAnteriores ?? '—'}</pre>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <Etiqueta>{T.informacionNueva}</Etiqueta>
                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{selected.datosNuevos ?? '—'}</pre>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>{C.cerrar}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
