'use client'

/**
 * Página de Hojas de Vida — Vacantes y Matching.
 *
 * Consume:
 *   GET /api/v1/vacantes?page=&size=  → lista paginada de vacantes activas
 *   GET /api/v1/vacantes/{id}         → detalle de vacante
 */

import { useState, useEffect, useCallback } from 'react'
import {
  FileUser, Briefcase, MapPin, DollarSign, ExternalLink,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw,
  Search, Building2, CalendarDays, Globe, Languages,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { vacantesApi, matchesApi, ApiCallError } from '@/lib/api'
import type { VacanteResponse, Page } from '@/lib/types'

export default function HojasDeVidaPage() {
  const [page, setPage]               = useState<Page<VacanteResponse> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected]       = useState<VacanteResponse | null>(null)
  const [matching, setMatching]       = useState(false)
  const [matchingMsg, setMatchingMsg] = useState<string | null>(null)

  const runMatching = async () => {
    setMatching(true); setMatchingMsg(null)
    try {
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(res.matchesCreados > 0
        ? `Matching completado: ${res.matchesCreados} match(es) nuevos. Revísalos en la pestaña Matches de cada estudiante.`
        : 'Matching completado: sin matches nuevos (los pares ya evaluados no se repiten).')
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? 'Sin permisos para ejecutar el matching.' : `Error del servidor (HTTP ${err.status}).`)
        : 'No se pudo conectar con el backend.')
    } finally { setMatching(false) }
  }

  /** Flujo de un solo paso: escanea los portales y luego ejecuta el matching. */
  const runScanAndMatch = async () => {
    setMatching(true); setMatchingMsg('Escaneando portales de empleo…')
    try {
      const scan = await vacantesApi.escanear()
      setMatchingMsg(`${scan.vacantesNuevas} vacante(s) nuevas encontradas. Ejecutando matching…`)
      const res = await matchesApi.ejecutarMatching()
      setMatchingMsg(
        `Escaneo completado: ${scan.vacantesNuevas} vacante(s) nuevas · ${res.matchesCreados} match(es) nuevos.`
        + (res.matchesCreados > 0 ? ' Revísalos en la pestaña Matches de cada estudiante.' : ''))
      load(0); setCurrentPage(0)
    } catch (err) {
      setMatchingMsg(err instanceof ApiCallError
        ? (err.status === 401 || err.status === 403 ? 'Sin permisos para escanear vacantes.' : `Error del servidor (HTTP ${err.status}).`)
        : 'No se pudo conectar con el backend.')
    } finally { setMatching(false) }
  }

  const load = useCallback(async (pg: number) => {
    setLoading(true); setError(null)
    try {
      setPage(await vacantesApi.listar(pg, 20))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión.'
          : `Error al cargar vacantes (HTTP ${err.status}).`)
      } else { setError('No se pudo conectar con el backend.') }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(0) }, [load])

  const filtered = (page?.content ?? []).filter((v) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return v.titulo.toLowerCase().includes(q) ||
      (v.empresaNombre?.toLowerCase().includes(q)) ||
      (v.ubicacion?.toLowerCase().includes(q)) ||
      (v.descripcion?.toLowerCase().includes(q))
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileUser className="size-5" /> Hojas de Vida — Vacantes
          </h2>
          <p className="text-sm text-muted-foreground">
            Vacantes de empleo disponibles para matching con los estudiantes.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => load(currentPage)}>
            <RefreshCw className="size-3.5" /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={runMatching} disabled={matching}>
            Solo matching
          </Button>
          <Button size="sm" onClick={runScanAndMatch} disabled={matching}>
            {matching
              ? <><Loader2 className="size-3.5 animate-spin" /> Procesando…</>
              : <><Search className="size-3.5" /> Escanear y hacer matching</>}
          </Button>
        </div>
      </div>

      {matchingMsg && (
        <div role="status" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          {matchingMsg}
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" placeholder="Buscar por título, empresa o ubicación…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-secondary/40" />
      </div>

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Cargando vacantes…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => load(currentPage)}><RefreshCw className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && page && (
        <>
          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <Briefcase className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay vacantes registradas.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((v) => (
                  <Card key={v.id} onClick={() => setSelected(v)} className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{v.titulo}</CardTitle>
                        {v.urlAplicar && (
                          <a href={v.urlAplicar} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary shrink-0">
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Building2 className="size-3 shrink-0" />
                        {v.empresaNombre ?? 'Empresa no especificada'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        {v.ubicacion && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                            <MapPin className="size-2.5" />{v.ubicacion}
                          </Badge>
                        )}
                        {v.tipoContrato && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                            <Briefcase className="size-2.5" />{v.tipoContrato}
                          </Badge>
                        )}
                        {v.modalidadTrabajo && (
                          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                            <Globe className="size-2.5" />{v.modalidadTrabajo}
                          </Badge>
                        )}
                        {v.nivelInglesRequerido && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
                            <Languages className="size-2.5" />{v.nivelInglesRequerido}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {v.rangoSalarial && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="size-3 shrink-0" />{v.rangoSalarial}
                          </div>
                        )}
                        {v.aniosExperienciaRequeridos != null && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Briefcase className="size-3 shrink-0" />{v.aniosExperienciaRequeridos} años exp.
                          </div>
                        )}
                        {v.fuente && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Globe className="size-3 shrink-0" />{v.fuente}
                          </div>
                        )}
                        {v.fechaPublicacion && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <CalendarDays className="size-3 shrink-0" />{v.fechaPublicacion}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Paginación */}
              {page.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">Página {page.number + 1} de {page.totalPages} · {page.totalElements} vacantes</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page.number === 0}
                      onClick={() => { const p = currentPage - 1; setCurrentPage(p); load(p) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                      <ChevronLeft className="size-4" />
                    </button>
                    <button type="button" disabled={page.number >= page.totalPages - 1}
                      onClick={() => { const p = currentPage + 1; setCurrentPage(p); load(p) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Drawer de detalle */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <SheetTitle className="text-base leading-tight">{selected.titulo}</SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-xs">
                  <Building2 className="size-3" /> {selected.empresaNombre ?? 'Empresa no especificada'}
                  {selected.fechaPublicacion && <> · <CalendarDays className="size-3" /> {selected.fechaPublicacion}</>}
                </SheetDescription>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selected.ubicacion && <Badge variant="outline" className="gap-1"><MapPin className="size-3" />{selected.ubicacion}</Badge>}
                  {selected.tipoContrato && <Badge variant="secondary" className="gap-1"><Briefcase className="size-3" />{selected.tipoContrato}</Badge>}
                  {selected.modalidadTrabajo && <Badge variant="secondary" className="gap-1"><Globe className="size-3" />{selected.modalidadTrabajo}</Badge>}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {/* Info principal */}
                <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Información General</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Rango salarial</span>
                      <span className="font-medium">{selected.rangoSalarial ?? 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Experiencia</span>
                      <span className="font-medium">{selected.aniosExperienciaRequeridos != null ? `${selected.aniosExperienciaRequeridos} años` : 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Inglés requerido</span>
                      <span className="font-medium">{selected.nivelInglesRequerido ?? 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">Fuente</span>
                      <span className="font-medium">{selected.fuente ?? 'Manual'}</span>
                    </div>
                  </div>
                </section>

                {selected.descripcion && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Descripción</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
                  </section>
                )}

                {selected.requisitos && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Requisitos</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.requisitos}</p>
                  </section>
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                {selected.urlAplicar && (
                  <Button
                    variant="default"
                    size="sm"
                    render={<a href={selected.urlAplicar} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink className="size-4" /> Aplicar
                  </Button>
                )}
                {selected.urlOrigen && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={selected.urlOrigen} target="_blank" rel="noopener noreferrer" />}
                  >
                    <Globe className="size-4" /> Ver fuente
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
