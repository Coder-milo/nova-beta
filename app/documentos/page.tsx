'use client'

/**
 * Página de Documentos — Certificaciones.
 *
 * Consume:
 *   GET /api/v1/certificaciones?programaId= → lista por programa
 *   GET /api/v1/programas                   → lista de programas para el selector
 */

import { useState, useEffect } from 'react'
import {
  FileText, Award, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, XCircle, BookOpen, Clock, Share2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { certificacionesApi, programasApi, ApiCallError } from '@/lib/api'
import type { CertificacionResponse, ProgramaResponse } from '@/lib/types'

export default function DocumentosPage() {
  const [programas, setProgramas]     = useState<ProgramaResponse[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [certs, setCerts]             = useState<CertificacionResponse[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selected, setSelected]       = useState<CertificacionResponse | null>(null)

  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length > 0) setSelectedPgm(list[0].id)
    }).catch(() => setError('No se pudieron cargar los programas.'))
  }, [])

  const load = async (pgmId: string) => {
    if (!pgmId) return
    setLoading(true); setError(null)
    try {
      setCerts(await certificacionesApi.listarPorPrograma(pgmId))
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? 'Sin permisos. Inicia sesión.'
          : `Error al cargar certificaciones (HTTP ${err.status}).`)
      } else { setError('No se pudo conectar con el backend.') }
    } finally { setLoading(false) }
  }

  useEffect(() => { if (selectedPgm) load(selectedPgm) }, [selectedPgm])

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileText className="size-5" /> Documentos — Certificaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestiona las certificaciones digitales de cada programa.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => selectedPgm && load(selectedPgm)}>
          <RefreshCw className="size-3.5" /> Refrescar
        </Button>
      </div>

      {/* Selector de programa */}
      {programas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Programa:</span>
          {programas.map((p) => (
            <button key={p.id} type="button" onClick={() => setSelectedPgm(p.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedPgm === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-secondary'}`}>
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Estados */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Cargando certificaciones…</span>
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => selectedPgm && load(selectedPgm)}><RefreshCw className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Listado */}
      {!loading && !error && (
        <>
          {certs.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <Award className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay certificaciones registradas para este programa.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certs.map((c) => (
                <Card key={c.id} onClick={() => setSelected(c)} className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Award className="size-5" />
                        </span>
                        <CardTitle className="text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{c.nombre}</CardTitle>
                      </div>
                      {c.activo
                        ? <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 shrink-0">Activa</Badge>
                        : <Badge variant="secondary" className="shrink-0">Inactiva</Badge>}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">{c.descripcion || 'Sin descripción.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      {c.horasCurriculares != null && (
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {c.horasCurriculares}h</span>
                      )}
                      {c.programaNombre && (
                        <span className="flex items-center gap-1"><BookOpen className="size-3" /> {c.programaNombre}</span>
                      )}
                      {c.habilidadesCubiertas && (
                        <span className="flex items-center gap-1"><CheckCircle2 className="size-3" /> Habilidades</span>
                      )}
                      {c.textoCompartir && (
                        <span className="flex items-center gap-1"><Share2 className="size-3" /> Compartible</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Drawer de detalle */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <div className="flex items-start gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Award className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <SheetTitle className="text-base">{selected.nombre}</SheetTitle>
                    <SheetDescription className="text-xs">{selected.programaNombre ?? 'Programa'}</SheetDescription>
                    <div className="flex gap-1.5 mt-2">
                      {selected.activo
                        ? <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 className="size-3 mr-1" />Activa</Badge>
                        : <Badge variant="secondary"><XCircle className="size-3 mr-1" />Inactiva</Badge>}
                      {selected.horasCurriculares != null && (
                        <Badge variant="outline"><Clock className="size-3 mr-1" />{selected.horasCurriculares}h</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {selected.descripcion && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Descripción</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
                  </section>
                )}

                {selected.habilidadesCubiertas && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Habilidades Cubiertas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.habilidadesCubiertas.split(',').map((h, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{h.trim()}</Badge>
                      ))}
                    </div>
                  </section>
                )}

                {selected.textoCompartir && (
                  <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">Texto para Compartir</h4>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground leading-relaxed italic whitespace-pre-wrap">{selected.textoCompartir}</p>
                    </div>
                  </section>
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
