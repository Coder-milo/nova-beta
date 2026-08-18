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
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, FileSpreadsheet as FileXls, LoaderCircle as CircleNotch, Upload as UploadSimple, X } from 'lucide-react'
import { importarCrmApi } from '@/lib/api'
import type { ResultadoImportacionCrm } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

export type EntidadImportable = 'empresas' | 'colocaciones'

/** Una constante de modulo no puede leer el idioma; recibe el diccionario. */
function textosDe(entidad: EntidadImportable, T: ReturnType<typeof textos>) {
  return entidad === 'empresas'
    ? {
        titulo: T.importarEmpresas,
        descripcion: T.subeElDirectorio,
        columnaClave: T.empresaORazon,
        nota: T.lasEmpresasQue,
      }
    : {
        titulo: T.importarColocaciones,
        descripcion: T.subeElListado,
        columnaClave: T.documentoOCorreo,
        nota: T.siElEstudiante,
      }
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
        importarEmpresas: 'Import companies',
        importarColocaciones: 'Import placements',
        subeElDirectorio: 'Upload the company directory. Columns such as “Company”, “Sector”, “City”, “Contact”, “Status” or “Next step” are recognised.',
        lasEmpresasQue: 'Companies that already exist are updated with what the file brings; they are not duplicated.',
        subeElListado: 'Upload the list of job placements. It must identify the student by “ID number” or “Email”.',
        siElEstudiante: 'If the student already has an active placement, the row updates it instead of creating a second one.',
        filasQueNo: 'Rows that will not be imported',
        columnasQueSe: 'Columns that will be used',
        analizandoLaHoja: 'Analysing the spreadsheet…',
        documentoOCorreo: 'ID number or email, and company',
        empresaORazon: 'Company or legal name',
        nuevosRegistros: 'New records:',
        filasLeidas: 'Rows read:',
        conError: 'With errors:',
        validas: 'Valid:',
        confirmarImportacion: 'Confirm import',
        importacionCompletada: 'Import completed:',
      }
    : {
        importarEmpresas: 'Importar empresas',
        importarColocaciones: 'Importar colocaciones',
        subeElDirectorio: 'Sube el directorio de empresas. Se reconocen columnas como «Empresa», «Sector», «Ciudad», «Contacto», «Estado» o «Próximo paso».',
        lasEmpresasQue: 'Las empresas que ya existan se actualizan con lo que traiga el archivo; no se duplican.',
        subeElListado: 'Sube el listado de vinculaciones laborales. Debe identificar al estudiante por «Número de documento» o «Correo».',
        siElEstudiante: 'Si el estudiante ya tiene una colocación vigente, la fila la actualiza en vez de crear una segunda.',
        filasQueNo: 'Filas que no se van a importar',
        columnasQueSe: 'Columnas que se van a usar',
        analizandoLaHoja: 'Analizando la hoja de cálculo…',
        documentoOCorreo: 'Documento o Correo, y Empresa',
        empresaORazon: 'Empresa o Razón social',
        nuevosRegistros: 'Nuevos registros:',
        filasLeidas: 'Filas leídas:',
        conError: 'Con error:',
        validas: 'Válidas:',
        confirmarImportacion: 'Confirmar importación',
        importacionCompletada: 'Importación completada:',
      }
}

export function ImportadorCrm({ entidad }: { entidad: EntidadImportable }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const copia = textosDe(entidad, T)
  const entrada = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [simulacion, setSimulacion] = useState<ResultadoImportacionCrm | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacionCrm | null>(null)
  const [trabajando, setTrabajando] = useState<'simular' | 'importar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const llamar = (file: File, simular: boolean, planId?: string | null) =>
    entidad === 'empresas'
      ? importarCrmApi.empresas(file, simular, planId)
      : importarCrmApi.colocaciones(file, simular, planId)

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
      // Se manda el plan de la simulación: es lo que hace que se escriba el
      // mapeo que está en pantalla y no uno recalculado. `simulacion` se
      // rehace al elegir archivo, así que aquí el plan es siempre el del
      // archivo que hay puesto.
      setResultado(await llamar(archivo, false, simulacion?.planId))
    } catch (e) {
      setError(errorDe(e))
    } finally {
      setTrabajando(null)
    }
  }

  const informe = resultado ?? simulacion
  const reconocidas = informe?.columnasReconocidas.filter((c) => c.campo) ?? []
  const ignoradas = informe?.columnasReconocidas.filter((c) => !c.campo) ?? []

  return (
    <Card className="rounded-lg border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileXls className="size-4 text-primary" /> {copia.titulo}
        </CardTitle>
        <CardDescription>{copia.descripcion}</CardDescription>
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
            {T.analizandoLaHoja}
          </div>
        )}

        {informe && (
          <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">{T.filasLeidas}</span>{' '}
                <b>{informe.filasLeidas}</b>
              </div>
              <div>
                <span className="text-muted-foreground">{T.validas}</span>{' '}
                <b className="text-emerald-600">{informe.creados + informe.actualizados}</b>
              </div>
              <div>
                <span className="text-muted-foreground">{T.nuevosRegistros}</span>{' '}
                <b>{informe.creados}</b>
              </div>
              <div>
                <span className="text-muted-foreground">Actualizaciones:</span>{' '}
                <b>{informe.actualizados}</b>
              </div>
              {informe.errores.length > 0 && (
                <div>
                  <span className="text-muted-foreground">{T.conError}</span>{' '}
                  <b className="text-destructive">{informe.errores.length}</b>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {T.columnasQueSe}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {reconocidas.map((c: any) => (
                  <span
                    key={c.cabecera}
                    className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs"
                    title={`Se guarda en: ${c.campo}`}
                  >
                    {c.cabecera}
                  </span>
                ))}
              </div>
              {ignoradas.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Se ignoran {ignoradas.length} columna(s): {ignoradas.map((c) => c.cabecera).join(', ')}.
                </p>
              )}
            </div>

            {informe.errores.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  {T.filasQueNo}
                </p>
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {informe.errores.map((e: any) => (
                    <li key={`${e.fila}-${e.motivo}`} className="text-muted-foreground">
                      <b>Fila {e.fila}:</b> {e.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado ? (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="size-4 shrink-0" />
                {T.importacionCompletada} {resultado.creados} creado(s) y {resultado.actualizados} actualizado(s).
              </p>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={limpiar} disabled={trabajando !== null}>
                  {C.cancelar}
                </Button>
                <Button onClick={importar} disabled={trabajando !== null || informe.filasLeidas === 0}>
                  {trabajando === 'importar' ? (
                    <CircleNotch className="size-4 animate-spin" />
                  ) : (
                    <UploadSimple className="size-4" />
                  )}
                  {T.confirmarImportacion}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
