'use client'

/**
 * Página de Importaciones.
 *
 * Consume:
 *   GET  /api/v1/programas                 → lista de programas para el selector
 *   POST /api/v1/importar (multipart/form-data, campos: archivo + programaId)
 *         → { importados: number, errores: string[] }
 *
 * Requiere JWT ADMIN o COORDINADOR.
 */

import { useState, useEffect, useRef, useTransition } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { importarApi, programasApi, ApiCallError } from '@/lib/api'
import type { ProgramaResponse, ImportarResponse } from '@/lib/types'

export default function ImportacionesPage() {
  const [programas, setProgramas]   = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState<string>('')
  const [file, setFile]             = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult]         = useState<ImportarResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Cargar programas al montar
  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length > 0) setProgramaId(list[0].id)
    }).catch(() => {
      setError('No se pudieron cargar los programas.')
    })
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function pickFile(f: File) {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Solo se aceptan archivos Excel (.xlsx o .xls).')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Selecciona un archivo primero.'); return }
    if (!programaId) { setError('Selecciona un programa.'); return }
    setError(null)
    setResult(null)

    startTransition(async () => {
      try {
        const res = await importarApi.importar(file, programaId)
        setResult(res)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 401 || err.status === 403) {
            setError('Sin permisos. Inicia sesión como ADMIN o COORDINADOR.')
          } else if (err.status === 400) {
            setError('El archivo no tiene el formato correcto o está vacío.')
          } else {
            setError(`Error del servidor (HTTP ${err.status}). Intenta de nuevo.`)
          }
        } else {
          setError('No se pudo conectar con el backend.')
        }
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Upload className="size-5" />
          Importaciones
        </h2>
        <p className="text-sm text-muted-foreground">
          Carga masiva de estudiantes desde un archivo Excel (.xlsx).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario de carga */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Importar desde Excel</CardTitle>
            <CardDescription>
              El archivo debe tener columnas: nombre, apellido, email (mínimo).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Selector de programa */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="imp-programa" className="text-sm font-medium">
                  Programa destino *
                </label>
                <select
                  id="imp-programa"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={programaId}
                  onChange={(e) => setProgramaId(e.target.value)}
                  required
                  disabled={isPending || programas.length === 0}
                >
                  <option value="">Selecciona un programa</option>
                  {programas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
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
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                }`}
              >
                {file ? (
                  <>
                    <FileSpreadsheet className="size-10 text-primary" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="size-3" /> Quitar archivo
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="size-10 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Arrastra tu archivo aquí
                      </p>
                      <p className="text-xs text-muted-foreground">
                        o haz clic para seleccionarlo (.xlsx, .xls)
                      </p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isPending || !file || !programaId}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Importar estudiantes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultado de la importación */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              Aquí verás cuántos registros se importaron y qué filas tuvieron errores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result === null ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground/50">
                <FileSpreadsheet className="size-12" />
                <p className="text-sm">Sin resultados aún. Importa un archivo para comenzar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Resumen */}
                <div className="flex gap-4">
                  <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-green-50 py-4 dark:bg-green-900/20">
                    <CheckCircle2 className="size-7 text-green-600 dark:text-green-400" />
                    <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {result.importados}
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400">Importados</span>
                  </div>
                  <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-destructive/10 py-4">
                    <AlertCircle className="size-7 text-destructive" />
                    <span className="text-2xl font-bold text-destructive">
                      {result.errores}
                    </span>
                    <span className="text-xs text-destructive">Con errores</span>
                  </div>
                </div>

                {/* Lista de errores */}
                {result.erroresDetalle.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                    <p className="mb-2 text-xs font-medium text-destructive">
                      Filas rechazadas:
                    </p>
                    <ul className="flex flex-col gap-1">
                      {result.erroresDetalle.map((e, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          • {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.importados > 0 && result.errores === 0 && (
                  <p className="text-center text-sm font-medium text-green-600">
                    ¡Importación completada sin errores!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Formato del archivo Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium text-muted-foreground">Columna</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">Requerida</th>
                  <th className="py-2 text-left font-medium text-muted-foreground">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['nombre',         'Sí',  'Nombres del estudiante'],
                  ['apellido',       'Sí',  'Apellidos'],
                  ['email',          'Sí',  'Correo único'],
                  ['celular',        'No',  'Número de celular'],
                  ['tipoDocumento',  'No',  'CC, CE, NIT, PASAPORTE'],
                  ['numeroDocumento','No',  'Número de documento'],
                  ['ciudad',         'No',  'Ciudad de residencia'],
                ].map(([col, req, desc]) => (
                  <tr key={col}>
                    <td className="py-1.5 pr-4 font-mono text-foreground">{col}</td>
                    <td className={`py-1.5 pr-4 ${req === 'Sí' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {req}
                    </td>
                    <td className="py-1.5 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
