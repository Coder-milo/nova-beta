'use client'

/**
 * Carga masiva de empresas y colocaciones desde una hoja de cálculo.
 *
 * <p>El asistente de estudiantes no sirve para esto: pide un programa destino,
 * valida contra el formato de los formularios de inscripción y deduplica por
 * documento. Empresas y colocaciones llegan en hojas armadas por cada aliado,
 * con las columnas en el orden y con el nombre que a cada quien le pareció.
 *
 * <p>El flujo es siempre el mismo: elegir archivo, revisar la simulación —qué
 * columnas se reconocieron, cuántas filas entran, cuáles fallan— y confirmar.
 * Se simula primero por obligación, no como opción: una importación de 300
 * empresas mal mapeada no se deshace con un botón.
 */

import { useRef, useState } from 'react'
import {
  CheckCircle,
  CircleNotch,
  FileXls,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { importarCrmApi } from '@/lib/api'
import type { ResultadoImportacionCrm } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorDe } from '@/lib/errores'

export type EntidadImportable = 'empresas' | 'colocaciones'

const TEXTOS = {
  empresas: {
    titulo: 'Importar empresas',
    descripcion:
      'Sube el directorio de empresas. Se reconocen columnas como «Empresa», «Sector», «Ciudad», «Contacto», «Estado» o «Próximo paso».',
    columnaClave: 'Empresa o Razón social',
    nota: 'Las empresas que ya existan se actualizan con lo que traiga el archivo; no se duplican.',
  },
  colocaciones: {
    titulo: 'Importar colocaciones',
    descripcion:
      'Sube el listado de vinculaciones laborales. Debe identificar al estudiante por «Número de documento» o «Correo».',
    columnaClave: 'Documento o Correo, y Empresa',
    nota: 'Si el estudiante ya tiene una colocación vigente, la fila la actualiza en vez de crear una segunda.',
  },
} as const

export function ImportadorCrm({ entidad }: { entidad: EntidadImportable }) {
  const textos = TEXTOS[entidad]
  const entrada = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [simulacion, setSimulacion] = useState<ResultadoImportacionCrm | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacionCrm | null>(null)
  const [trabajando, setTrabajando] = useState<'simular' | 'importar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const llamar = (file: File, simular: boolean) =>
    entidad === 'empresas'
      ? importarCrmApi.empresas(file, simular)
      : importarCrmApi.colocaciones(file, simular)

  const limpiar = () => {
    setArchivo(null)
    setSimulacion(null)
    setResultado(null)
    setError(null)
    if (entrada.current) entrada.current.value = ''
  }

  const elegir = async (file: File | null) => {
    setArchivo(file)
    setSimulacion(null)
    setResultado(null)
    setError(null)
    if (!file) return
    // La simulación arranca sola al elegir el archivo: obligar a pulsar otro
    // botón para ver si el mapeo está bien solo consigue que nadie lo mire.
    setTrabajando('simular')
    try {
      setSimulacion(await llamar(file, true))
    } catch (e) {
      setError(errorDe(e))
    } finally {
      setTrabajando(null)
    }
  }

  const importar = async () => {
    if (!archivo) return
    setTrabajando('importar')
    setError(null)
    try {
      setResultado(await llamar(archivo, false))
    } catch (e) {
      setError(errorDe(e))
    } finally {
      setTrabajando(null)
    }
  }

  const informe = resultado ?? simulacion
  const reconocidas = informe?.columnasReconocidas.filter((c: any) => c.campoDestino) ?? []
  const ignoradas = informe?.columnasReconocidas.filter((c: any) => !c.campoDestino) ?? []

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileXls className="size-4 text-primary" /> {textos.titulo}
        </CardTitle>
        <CardDescription>{textos.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => entrada.current?.click()}
            disabled={trabajando !== null}
          >
            <UploadSimple className="size-4" />
            {archivo ? 'Cambiar archivo' : 'Elegir Excel (.xlsx / .xls)'}
          </Button>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => void elegir(e.target.files?.[0] ?? null)}
          />
          {archivo && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileXls className="size-4 text-emerald-600" />
              {archivo.name}
              <button
                type="button"
                onClick={limpiar}
                className="rounded p-0.5 hover:bg-secondary hover:text-foreground"
                title="Quitar archivo"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <WarningCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {trabajando === 'simular' && (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <CircleNotch className="size-4 animate-spin text-primary" />
            Analizando la hoja de cálculo…
          </div>
        )}

        {informe && (
          <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Filas leídas:</span>{' '}
                <b>{informe.totalFilas}</b>
              </div>
              <div>
                <span className="text-muted-foreground">Válidas:</span>{' '}
                <b className="text-emerald-600">{informe.validos}</b>
              </div>
              <div>
                <span className="text-muted-foreground">Nuevos registros:</span>{' '}
                <b>{informe.nuevos}</b>
              </div>
              <div>
                <span className="text-muted-foreground">Actualizaciones:</span>{' '}
                <b>{informe.actualizados}</b>
              </div>
              {informe.conErrores > 0 && (
                <div>
                  <span className="text-muted-foreground">Con error:</span>{' '}
                  <b className="text-destructive">{informe.conErrores}</b>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Columnas que se van a usar
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reconocidas.map((c: any) => (
                  <span
                    key={c.columnaOrigen}
                    className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs"
                    title={`Se guarda en: ${c.campoDestino}`}
                  >
                    {c.columnaOrigen}
                  </span>
                ))}
              </div>
              {ignoradas.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Se ignoran {ignoradas.length} columna(s): {ignoradas.map((c: any) => c.columnaOrigen).join(', ')}.
                </p>
              )}
            </div>

            {informe.errores.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Filas que no se van a importar
                </p>
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {informe.errores.map((e: any) => (
                    <li key={`${e.fila}-${e.error}`} className="text-muted-foreground">
                      <b>Fila {e.fila}:</b> {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado ? (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="size-4 shrink-0" />
                Importación terminada: {resultado.creados} creado(s) y {resultado.actualizados} actualizado(s).
              </p>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={limpiar} disabled={trabajando !== null}>
                  Cancelar
                </Button>
                <Button onClick={importar} disabled={trabajando !== null || informe.filasLeidas === 0}>
                  {trabajando === 'importar' ? (
                    <CircleNotch className="size-4 animate-spin" />
                  ) : (
                    <UploadSimple className="size-4" />
                  )}
                  Importar de verdad
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
