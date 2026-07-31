'use client'

import { ArrowsClockwise, CaretLeft, CaretRight, CheckCircle, CircleNotch, ClockCounterClockwise, FileXls, ShieldCheck, UploadSimple, WarningCircle, X } from '@phosphor-icons/react'
/**
 * Página de Importaciones — asistente en 4 pasos.
 *
 * Consume:
 *   GET  /api/v1/programas            → selector de programa destino
 *   POST /api/v1/importar/preview     → validación previa del archivo
 *   POST /api/v1/importar             → importación definitiva
 *   GET  /api/v1/importar/historial   → historial de importaciones
 *
 * Requiere JWT ADMIN o COORDINADOR.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImportadorCrm } from '@/components/admin/importador-crm'
import { importarApi, importarExtApi, programasApi } from '@/lib/api'
import type {
  ProgramaResponse, ImportarResponse, ImportPreviewResponse,
  ImportacionHistorialResponse,
} from '@/lib/types'
import { errorDe } from '@/lib/errores'

const pasos = ['Archivo', 'Validación', 'Confirmación', 'Resultado'] as const

export default function ImportacionesPage() {
  const [seccion, setSeccion]       = useState<'estudiantes' | 'empresas' | 'colocaciones'>('estudiantes')
  const [paso, setPaso]             = useState(1)
  const [programas, setProgramas]   = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [preview, setPreview]       = useState<ImportPreviewResponse | null>(null)
  const [validando, setValidando]   = useState(false)

  const [importando, setImportando] = useState(false)
  const [result, setResult]         = useState<ImportarResponse | null>(null)

  const [historial, setHistorial]       = useState<ImportacionHistorialResponse[]>([])
  const [loadingHist, setLoadingHist]   = useState(true)
  const [errorHist, setErrorHist]       = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Cargas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length > 0) setProgramaId(list[0].id)
    }).catch(() => setError('No se pudieron cargar los programas.'))
  }, [])

  const loadHistorial = useCallback(async () => {
    setLoadingHist(true); setErrorHist(null)
    try { setHistorial(await importarExtApi.historial()) }
    catch (err) { setErrorHist(errorDe(err)) }
    finally { setLoadingHist(false) }
  }, [])

  useEffect(() => { loadHistorial() }, [loadHistorial])

  // ── Selección de archivo ──────────────────────────────────────────────────
  function pickFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Solo se aceptan archivos Excel (.xlsx o .xls).')
      return
    }
    setFile(f); setError(null); setPreview(null); setResult(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  const irAPaso2 = () => {
    setError(null)
    if (!file) { setError('Selecciona un archivo primero.'); return }
    if (!programaId) { setError('Selecciona un programa destino.'); return }
    setPaso(2)
  }

  const handleValidar = async () => {
    if (!file || !programaId) return
    setValidando(true); setError(null)
    try {
      setPreview(await importarExtApi.preview(file, programaId))
    } catch (err) { setError(errorDe(err)) }
    finally { setValidando(false) }
  }

  const handleImportar = async () => {
    if (!file || !programaId) return
    setImportando(true); setError(null)
    try {
      const res = await importarApi.importar(file, programaId)
      setResult(res)
      setPaso(4)
      loadHistorial()
    } catch (err) { setError(errorDe(err)) }
    finally { setImportando(false) }
  }

  const reiniciar = () => {
    setPaso(1); setFile(null); setPreview(null); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const programaNombre = programas.find((p) => p.id === programaId)?.nombre

  return (
    <div className="flex flex-col gap-6">
      {/* ── Selector de Entidad ────────────────────────────────────────────── */}
      <div className="inline-flex max-w-fit rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setSeccion('estudiantes')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            seccion === 'estudiantes' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Importar Estudiantes
        </button>
        <button
          type="button"
          onClick={() => setSeccion('empresas')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            seccion === 'empresas' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Importar Empresas
        </button>
        <button
          type="button"
          onClick={() => setSeccion('colocaciones')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            seccion === 'colocaciones' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Importar Colocaciones
        </button>
      </div>

      {seccion === 'empresas' && <ImportadorCrm entidad="empresas" />}
      {seccion === 'colocaciones' && <ImportadorCrm entidad="colocaciones" />}

      {seccion === 'estudiantes' && (
        <>
          {/* ── Stepper ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {pasos.map((label, i) => {
          const n = i + 1
          const activo = paso === n
          const completado = paso > n
          return (
            <div key={label} className="flex items-center gap-2 shrink-0">
              {i > 0 && <div className={`h-px w-8 ${completado || activo ? 'bg-navy-800' : 'bg-border'}`} />}
              <div className="flex items-center gap-2">
                <span className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums border ${
                  activo ? 'bg-navy-800 text-white border-navy-800'
                  : completado ? 'bg-navy-800/10 text-navy-800 border-navy-800/30'
                  : 'bg-background text-muted-foreground border-border'
                }`}>
                  {completado ? <CheckCircle className="size-3.5" /> : n}
                </span>
                <span className={`text-xs font-medium whitespace-nowrap ${activo ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* ── Paso 1: Archivo ────────────────────────────────────────────────── */}
      {paso === 1 && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Paso 1 — Archivo y programa</CardTitle>
            <CardDescription>
              El archivo debe tener columnas: nombre, apellido, email (mínimo). Descarga la plantilla desde el área de reportes o usa las columnas indicadas abajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 max-w-md">
              <label htmlFor="imp-programa" className="text-[11px] uppercase tracking-wider text-muted-foreground">Programa destino *</label>
              <select
                id="imp-programa"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={programaId}
                onChange={(e) => setProgramaId(e.target.value)}
                disabled={programas.length === 0}
              >
                <option value="">Selecciona un programa</option>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {/* Zona de arrastre */}
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
            >
              {file ? (
                <>
                  <FileXls className="size-10 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-3" /> Quitar archivo
                  </button>
                </>
              ) : (
                <>
                  <UploadSimple className="size-10 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Arrastra tu archivo aquí</p>
                    <p className="text-xs text-muted-foreground">o haz clic para seleccionarlo (.xlsx)</p>
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={irAPaso2} disabled={!file || !programaId}>
                Siguiente <CaretRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Paso 2: Validación ─────────────────────────────────────────────── */}
      {paso === 2 && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Paso 2 — Validación</CardTitle>
            <CardDescription>
              Valida el archivo <span className="font-medium text-foreground">{file?.name}</span> contra el programa <span className="font-medium text-foreground">{programaNombre}</span> antes de importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {!preview && (
              <div>
                <Button onClick={handleValidar} disabled={validando}>
                  {validando ? <><CircleNotch className="size-4 animate-spin" /> Validando…</> : <><ShieldCheck className="size-4" /> Validar archivo</>}
                </Button>
              </div>
            )}

            {preview && (
              <>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {([
                    ['Total filas', preview.totalFilas, 'text-foreground'],
                    ['Válidos', preview.validos, 'text-[#0F6E56]'],
                    ['Nuevos', preview.nuevos, 'text-navy-600'],
                    ['Actualizados', preview.actualizados, 'text-navy-600'],
                    ['Con errores', preview.conErrores, preview.conErrores > 0 ? 'text-destructive' : 'text-foreground'],
                  ] as const).map(([label, valor, color]) => (
                    <Card key={label} className="rounded-lg border-border shadow-none">
                      <CardContent className="pt-5 flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                        <span className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {preview.errores.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="mb-2 text-xs font-medium text-destructive">Errores detectados:</p>
                    <ul className="flex flex-col gap-1">
                      {preview.errores.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.advertencias.length > 0 && (
                  <div className="rounded-lg border border-amber-300/60 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-950/10 p-3">
                    <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">Advertencias:</p>
                    <ul className="flex flex-col gap-1">
                      {preview.advertencias.map((a, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between border-t border-border pt-4">
              <Button variant="outline" onClick={() => { setPaso(1); setPreview(null) }}>
                <CaretLeft className="size-4" /> Anterior
              </Button>
              <Button onClick={() => setPaso(3)} disabled={!preview}>
                Siguiente <CaretRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Paso 3: Confirmación ───────────────────────────────────────────── */}
      {paso === 3 && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Paso 3 — Confirmación</CardTitle>
            <CardDescription>Revisa el resumen y confirma la importación definitiva.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Archivo</span>
                <span className="font-medium text-foreground text-xs">{file?.name}</span>
              </div>
              <div>
                <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Programa destino</span>
                <span className="font-medium text-foreground text-xs">{programaNombre}</span>
              </div>
              {preview && (
                <>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Filas a procesar</span>
                    <span className="font-medium text-foreground text-xs tabular-nums">{preview.totalFilas} ({preview.validos} válidas)</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Nuevos / Actualizados</span>
                    <span className="font-medium text-foreground text-xs tabular-nums">{preview.nuevos} / {preview.actualizados}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">Con errores</span>
                    <span className={`font-medium text-xs tabular-nums ${preview.conErrores > 0 ? 'text-destructive' : 'text-foreground'}`}>{preview.conErrores}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between border-t border-border pt-4">
              <Button variant="outline" onClick={() => setPaso(2)} disabled={importando}>
                <CaretLeft className="size-4" /> Anterior
              </Button>
              <Button onClick={handleImportar} disabled={importando}>
                {importando ? <><CircleNotch className="size-4 animate-spin" /> Importando…</> : <><UploadSimple className="size-4" /> Importar</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Paso 4: Resultado ──────────────────────────────────────────────── */}
      {paso === 4 && result && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Paso 4 — Resultado</CardTitle>
            <CardDescription>Resumen de la importación realizada.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-green-50 py-4 dark:bg-green-900/20">
                <CheckCircle className="size-7 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{result.importados}</span>
                <span className="text-xs text-green-600 dark:text-green-400">Importados</span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-destructive/10 py-4">
                <WarningCircle className="size-7 text-destructive" />
                <span className="text-2xl font-bold tabular-nums text-destructive">{result.errores}</span>
                <span className="text-xs text-destructive">Con errores</span>
              </div>
            </div>

            {result.erroresDetalle.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-2 text-xs font-medium text-destructive">Filas rechazadas:</p>
                <ul className="flex flex-col gap-1">
                  {result.erroresDetalle.map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.importados > 0 && result.errores === 0 && (
              <p className="text-center text-sm font-medium text-green-600">¡Importación completada sin errores!</p>
            )}

            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="outline" onClick={reiniciar}>
                <ArrowsClockwise className="size-4" /> Nueva importación
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Formato esperado ───────────────────────────────────────────────── */}
      {paso === 1 && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Formato del archivo Excel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Columna</th>
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Requerida</th>
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['nombre',          'Sí', 'Nombres del estudiante'],
                    ['apellido',        'Sí', 'Apellidos'],
                    ['email',           'Sí', 'Correo único'],
                    ['celular',         'No', 'Número de celular'],
                    ['tipoDocumento',   'No', 'CC, CE, NIT, PASAPORTE'],
                    ['numeroDocumento', 'No', 'Número de documento'],
                    ['ciudad',          'No', 'Ciudad de residencia'],
                  ].map(([col, req, desc]) => (
                    <tr key={col}>
                      <td className="py-1.5 pr-4 font-mono text-foreground">{col}</td>
                      <td className={`py-1.5 pr-4 ${req === 'Sí' ? 'text-destructive' : 'text-muted-foreground'}`}>{req}</td>
                      <td className="py-1.5 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Historial ──────────────────────────────────────────────────────── */}
      <Card className="rounded-lg border-border shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><ClockCounterClockwise className="size-4" /> Historial de importaciones</CardTitle>
              <CardDescription>Importaciones realizadas anteriormente.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadHistorial} disabled={loadingHist}>
              <ArrowsClockwise className="size-3.5" /> Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHist ? (
            <div className="flex items-center justify-center py-10">
              <PageSpinner />
              <span className="ml-2 text-sm text-muted-foreground">Cargando historial…</span>
            </div>
          ) : errorHist ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <WarningCircle className="size-6 text-destructive" />
              <p className="text-sm text-destructive">{errorHist}</p>
              <Button variant="outline" size="sm" onClick={loadHistorial}><ArrowsClockwise className="size-3.5" /> Reintentar</Button>
            </div>
          ) : historial.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <FileXls className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aún no se han realizado importaciones.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Archivo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Usuario</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Creados</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Actualizados</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Errores</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historial.map((h) => (
                    <tr key={h.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{h.archivo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.usuario}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{h.creados}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{h.actualizados}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${h.errores > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{h.errores}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{new Date(h.createdAt).toLocaleDateString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
