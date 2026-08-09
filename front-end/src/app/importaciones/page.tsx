'use client'

import { ArrowsClockwiseIcon as ArrowsClockwise, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, CheckCircleIcon as CheckCircle, CircleNotchIcon as CircleNotch, ClockCounterClockwiseIcon as ClockCounterClockwise, FileXlsIcon as FileXls, ShieldCheckIcon as ShieldCheck, UploadSimpleIcon as UploadSimple, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
/**
 * Página de Importaciones — asistente en 4 pasos.
 *
 * Consume:
 *   GET  /api/v1/programas            → selector de programa destino
 *   POST /api/v1/importar/preview     → validación previa del archivo
 *   POST /api/v1/importar             → importación definitiva
 *   POST /api/v1/importar/libro       → libro completo, todas sus hojas de una vez
 *   GET  /api/v1/importar/historial   → historial de importaciones
 *
 * Requiere JWT ADMIN o COORDINADOR.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'
import { ImportadorCrm } from '@/components/admin/importador-crm'
import { ImportadorLibro } from '@/components/admin/importador-libro'
import { importarApi, importarExtApi, programasApi } from '@/lib/api'
import type {
  ProgramaResponse, ImportarResponse, ImportPreviewResponse,
  ImportacionHistorialResponse,
} from '@/lib/types'
import { errorDe } from '@/lib/errores'

/** Las etiquetas del stepper salen del diccionario, no de una constante fija. */
const PASOS = ['archivo', 'validacion', 'confirmacion', 'resultado'] as const

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        elArchivoDebe: 'The file must have columns: first name, last name, email (at minimum). Download the template from the reports area, or use the columns listed below.',
        oHazClic: 'or click to choose it (.xlsx)',
        validaElArchivo: 'Validate file',
        contraElPrograma: 'against programme',
        antesDeImportar: 'before importing.',
        nuevaImportacion: 'New import',
        historialDeImportaciones: 'Import history',
        paso1Archivo: 'Step 1 — File and programme',
        paso2Validacion: 'Step 2 — Validation',
        paso3Confirmacion: 'Step 3 — Confirmation',
        paso4Resultado: 'Step 4 — Result',
        arrastraTuArchivo: 'Drag your file here',
        soloSeAceptan: 'Only Excel files (.xlsx or .xls) are accepted.',
        seleccionaUnArchivo: 'Choose a file first.',
        seleccionaUnPrograma: 'Choose a target programme.',
        seleccionaUnProgramaX: 'Choose a programme',
        programaDestino: 'Target programme *',
        programaDestinoX: 'Target programme',
        formatoDelArchivo: 'Excel file format',
        revisaElResumen: 'Review the summary and confirm the final import.',
        resumenDeLa: 'Summary of the import.',
        importacionesRealizadasAnteriormente: 'Previous imports.',
        aunNoSe: 'No imports have been made yet.',
        cargandoHistorial: 'Loading history…',
        importacionCompletadaSin: 'Import completed with no errors!',
        erroresDetectados: 'Errors found:',
        filasRechazadas: 'Rows rejected:',
        advertencias: 'Warnings:',
        filasAProcesar: 'Rows to process',
        totalFilas: 'Total rows',
        nuevosActualizados: 'New / updated',
        conErrores: 'With errors',
        actualizados: 'Updated',
        importados: 'Imported',
        creados: 'Created',
        validos: 'Valid',
        errores: 'Errors',
        nuevos: 'New',
        nombresDelEstudiante: 'Student first name',
        numeroDeDocumento: 'ID number',
        numeroDeCelular: 'Mobile number',
        ciudadDeResidencia: 'City of residence',
        correoUnico: 'Unique email',
        requerida: 'Required',
        confirmacion: 'Confirmation',
        validacion: 'Validation',
        resultado: 'Result',
        columna: 'Column',
        usuario: 'User',
        apellidos: 'Last name',
        descripcion: 'Description',
      }
    : {
        elArchivoDebe: 'El archivo debe tener columnas: nombre, apellido, email (mínimo). Descarga la plantilla desde el área de reportes o usa las columnas indicadas abajo.',
        oHazClic: 'o haz clic para seleccionarlo (.xlsx)',
        validaElArchivo: 'Valida el archivo',
        contraElPrograma: 'contra el programa',
        antesDeImportar: 'antes de importar.',
        nuevaImportacion: 'Nueva importación',
        historialDeImportaciones: 'Historial de importaciones',
        paso1Archivo: 'Paso 1 — Archivo y programa',
        paso2Validacion: 'Paso 2 — Validación',
        paso3Confirmacion: 'Paso 3 — Confirmación',
        paso4Resultado: 'Paso 4 — Resultado',
        arrastraTuArchivo: 'Arrastra tu archivo aquí',
        soloSeAceptan: 'Solo se aceptan archivos Excel (.xlsx o .xls).',
        seleccionaUnArchivo: 'Selecciona un archivo primero.',
        seleccionaUnPrograma: 'Selecciona un programa destino.',
        seleccionaUnProgramaX: 'Selecciona un programa',
        programaDestino: 'Programa destino *',
        programaDestinoX: 'Programa destino',
        formatoDelArchivo: 'Formato del archivo Excel',
        revisaElResumen: 'Revisa el resumen y confirma la importación definitiva.',
        resumenDeLa: 'Resumen de la importación realizada.',
        importacionesRealizadasAnteriormente: 'Importaciones realizadas anteriormente.',
        aunNoSe: 'Aún no se han realizado importaciones.',
        cargandoHistorial: 'Cargando historial…',
        importacionCompletadaSin: '¡Importación completada sin errores!',
        erroresDetectados: 'Errores detectados:',
        filasRechazadas: 'Filas rechazadas:',
        advertencias: 'Advertencias:',
        filasAProcesar: 'Filas a procesar',
        totalFilas: 'Total filas',
        nuevosActualizados: 'Nuevos / Actualizados',
        conErrores: 'Con errores',
        actualizados: 'Actualizados',
        importados: 'Importados',
        creados: 'Creados',
        validos: 'Válidos',
        errores: 'Errores',
        nuevos: 'Nuevos',
        nombresDelEstudiante: 'Nombres del estudiante',
        numeroDeDocumento: 'Número de documento',
        numeroDeCelular: 'Número de celular',
        ciudadDeResidencia: 'Ciudad de residencia',
        correoUnico: 'Correo único',
        requerida: 'Requerida',
        confirmacion: 'Confirmación',
        validacion: 'Validación',
        resultado: 'Resultado',
        columna: 'Columna',
        usuario: 'Usuario',
        apellidos: 'Apellidos',
        descripcion: 'Descripción',
      }
}

export default function ImportacionesPage() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [seccion, setSeccion]       = useState<'libro' | 'estudiantes' | 'empresas' | 'colocaciones'>('libro')
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
    }).catch(() => setError(C.errorProgramas))
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
      setError(T.soloSeAceptan)
      return
    }
    setFile(f); setError(null); setPreview(null); setResult(null)
  }

  /**
   * Cambiar el programa invalida lo validado.
   *
   * La previsualizacion dice cuantas filas son altas y cuantas actualizaciones
   * *contra ese programa*: quien ya esta inscrito alli se actualiza y quien no,
   * se crea. Si se cambia el destino y se conserva el resumen, la pantalla de
   * confirmacion muestra el programa nuevo con los numeros del anterior, y se
   * confirma una importacion sobre cifras que no le corresponden. Se limpia,
   * igual que al cambiar de archivo.
   */
  function elegirPrograma(id: string) {
    setProgramaId(id)
    setPreview(null); setResult(null); setError(null)
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
    if (!file) { setError(T.seleccionaUnArchivo); return }
    if (!programaId) { setError(T.seleccionaUnPrograma); return }
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
          onClick={() => setSeccion('libro')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            seccion === 'libro' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Libro completo
        </button>
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

      {seccion === 'libro' && <ImportadorLibro />}
      {seccion === 'empresas' && <ImportadorCrm entidad="empresas" />}
      {seccion === 'colocaciones' && <ImportadorCrm entidad="colocaciones" />}

      {seccion === 'estudiantes' && (
        <>
          {/* ── Stepper ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {PASOS.map((clave, i) => {
          const label = clave === 'archivo' ? C.archivo
            : clave === 'validacion' ? T.validacion
            : clave === 'confirmacion' ? T.confirmacion
            : T.resultado
          const n = i + 1
          const activo = paso === n
          const completado = paso > n
          return (
            <div key={clave} className="flex items-center gap-2 shrink-0">
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
            <CardTitle className="text-base">{T.paso1Archivo}</CardTitle>
            <CardDescription>
              {T.elArchivoDebe}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 max-w-md">
              <label htmlFor="imp-programa" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.programaDestino}</label>
              <select
                id="imp-programa"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={programaId}
                onChange={(e) => elegirPrograma(e.target.value)}
                disabled={programas.length === 0}
              >
                <option value="">{T.seleccionaUnProgramaX}</option>
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
                    <p className="text-sm font-medium text-foreground">{T.arrastraTuArchivo}</p>
                    <p className="text-xs text-muted-foreground">{T.oHazClic}</p>
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
            <CardTitle className="text-base">{T.paso2Validacion}</CardTitle>
            <CardDescription>
              {T.validaElArchivo} <span className="font-medium text-foreground">{file?.name}</span> {T.contraElPrograma} <span className="font-medium text-foreground">{programaNombre}</span> {T.antesDeImportar}
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
                    [T.totalFilas, preview.totalFilas, 'text-foreground'],
                    [T.validos, preview.validos, 'text-[#0F6E56]'],
                    [T.nuevos, preview.nuevos, 'text-navy-600'],
                    [T.actualizados, preview.actualizados, 'text-navy-600'],
                    [T.conErrores, preview.conErrores, preview.conErrores > 0 ? 'text-destructive' : 'text-foreground'],
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
                    <p className="mb-2 text-xs font-medium text-destructive">{T.erroresDetectados}</p>
                    <ul className="flex flex-col gap-1">
                      {preview.errores.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.advertencias.length > 0 && (
                  <div className="rounded-lg border border-amber-300/60 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-950/10 p-3">
                    <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">{T.advertencias}</p>
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
            <CardTitle className="text-base">{T.paso3Confirmacion}</CardTitle>
            <CardDescription>{T.revisaElResumen}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{C.archivo}</span>
                <span className="font-medium text-foreground text-xs">{file?.name}</span>
              </div>
              <div>
                <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{T.programaDestinoX}</span>
                <span className="font-medium text-foreground text-xs">{programaNombre}</span>
              </div>
              {preview && (
                <>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{T.filasAProcesar}</span>
                    <span className="font-medium text-foreground text-xs tabular-nums">{preview.totalFilas} ({preview.validos} válidas)</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{T.nuevosActualizados}</span>
                    <span className="font-medium text-foreground text-xs tabular-nums">{preview.nuevos} / {preview.actualizados}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{T.conErrores}</span>
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
            <CardTitle className="text-base">{T.paso4Resultado}</CardTitle>
            <CardDescription>{T.resumenDeLa}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-green-50 py-4 dark:bg-green-900/20">
                <CheckCircle className="size-7 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{result.importados}</span>
                <span className="text-xs text-green-600 dark:text-green-400">{T.importados}</span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-destructive/10 py-4">
                <WarningCircle className="size-7 text-destructive" />
                <span className="text-2xl font-bold tabular-nums text-destructive">{result.errores}</span>
                <span className="text-xs text-destructive">{T.conErrores}</span>
              </div>
            </div>

            {result.erroresDetalle.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-2 text-xs font-medium text-destructive">{T.filasRechazadas}</p>
                <ul className="flex flex-col gap-1">
                  {result.erroresDetalle.map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.importados > 0 && result.errores === 0 && (
              <p className="text-center text-sm font-medium text-green-600">{T.importacionCompletadaSin}</p>
            )}

            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="outline" onClick={reiniciar}>
                <ArrowsClockwise className="size-4" /> {T.nuevaImportacion}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Formato esperado ───────────────────────────────────────────────── */}
      {paso === 1 && (
        <Card className="rounded-lg border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{T.formatoDelArchivo}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.columna}</th>
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.requerida}</th>
                    <th className="py-2 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.descripcion}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['nombre',          'Sí', T.nombresDelEstudiante],
                    ['apellido',        'Sí', T.apellidos],
                    ['email',           'Sí', T.correoUnico],
                    ['celular',         'No', T.numeroDeCelular],
                    ['tipoDocumento',   'No', 'CC, CE, NIT, PASAPORTE'],
                    ['numeroDocumento', 'No', T.numeroDeDocumento],
                    ['ciudad',          'No', T.ciudadDeResidencia],
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
              <CardTitle className="flex items-center gap-2 text-base"><ClockCounterClockwise className="size-4" /> {T.historialDeImportaciones}</CardTitle>
              <CardDescription>{T.importacionesRealizadasAnteriormente}</CardDescription>
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
              <span className="ml-2 text-sm text-muted-foreground">{T.cargandoHistorial}</span>
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
              <p className="text-sm text-muted-foreground">{T.aunNoSe}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{C.archivo}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.usuario}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.creados}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.actualizados}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.errores}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{C.fecha}</th>
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
