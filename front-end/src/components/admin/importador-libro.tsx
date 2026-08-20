'use client'

/**
 * Carga de un libro de Excel completo, con todas sus pestañas de una vez.
 *
 * <p>El seguimiento del programa se lleva en un solo archivo con siete hojas:
 * participantes, dos de empresas, postulaciones, colocaciones, un tablero de
 * indicadores y alguna preparada y vacía. Los otros importadores piden un
 * archivo por destino y, además, ninguno lo leía: los tres abrían la primera
 * hoja —el tablero— y fallaban con «no se reconoció ninguna columna».
 *
 * <p>Aquí se sube una vez y cada hoja va a su sitio. Lo que no se importa se
 * muestra con su motivo: una hoja que desaparece en silencio es indistinguible
 * de una que se importó vacía.
 */

import { useRef, useState } from 'react'
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, FileSpreadsheet as FileXls, Info, LoaderCircle as CircleNotch, Sparkles as Sparkle, Upload as UploadSimple, X } from 'lucide-react'
import { importarCrmApi } from '@/lib/api'
import type { HojaProcesada, ResultadoImportacionLibro } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        subeElArchivo: 'Upload the follow-up file with all its tabs. Each sheet is recognized by its headings and mapped to its destination: participants, companies, applications and placements.',

        estoEsUna: 'Preview mode: changes have not been applied yet.',
        elDestinoDe: 'Destination assigned automatically by AI',
        verLasFilas: 'View records with observations',
        importacionTerminada: 'Import completed.',
        loReconocioLa: 'Recognised by AI',
        mapeadoPorIa: 'mapped by AI',
        noSeImporto: 'skipped',
        sinMapear: 'unassigned',
      }
    : {
        subeElArchivo: 'Sube el archivo de seguimiento con todas sus pestañas. Cada hoja se reconoce por sus títulos y se dirige a su destino: participantes, empresas, postulaciones y colocaciones.',

        estoEsUna: 'Vista previa: los cambios no han sido aplicados aún.',
        elDestinoDe: 'Destino asignado automáticamente por IA',
        verLasFilas: 'Ver registros con observaciones',
        importacionTerminada: 'Importación completada.',
        loReconocioLa: 'Reconocido por IA',
        mapeadoPorIa: 'mapeado por IA',
        noSeImporto: 'omitida',
        sinMapear: 'sin asignar',
      }
}

export function ImportadorLibro() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const entrada = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [simulacion, setSimulacion] = useState<ResultadoImportacionLibro | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacionLibro | null>(null)
  const [trabajando, setTrabajando] = useState<'simular' | 'importar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const limpiar = () => {
    setArchivo(null)
    setSimulacion(null)
    setResultado(null)
    setError(null)
    if (entrada.current) entrada.current.value = ''
  }

  const elegir = (f: File | null) => {
    setArchivo(f)
    setSimulacion(null)
    setResultado(null)
    setError(null)
  }

  const ejecutar = async (simular: boolean) => {
    if (!archivo) return
    setTrabajando(simular ? 'simular' : 'importar')
    setError(null)
    try {
      // Al importar de verdad se manda el plan de la simulación: escribe el
      // mapeo que está en pantalla en vez de volver a analizar el archivo, que
      // con la IA de por medio puede dar otro resultado. `elegir` borra la
      // simulación, así que el plan es siempre el del archivo que hay puesto.
      const res = await importarCrmApi.libro(archivo, simular, simular ? null : simulacion?.planId)
      if (simular) setSimulacion(res)
      else setResultado(res)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setTrabajando(null)
    }
  }

  const aMostrar = resultado ?? simulacion

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar libro completo</CardTitle>
        <CardDescription>
          {T.subeElArchivo}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => elegir(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={() => entrada.current?.click()}>
            <UploadSimple className="size-4" />
            Elegir archivo
          </Button>

          {archivo && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
              <FileXls className="size-4 text-emerald-600" />
              {archivo.name}
              <button type="button" onClick={limpiar} aria-label="Quitar archivo">
                <X className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          )}
        </div>

        {/* Se simula primero por obligación, no como opción: una carga de siete
            hojas mal mapeada no se deshace con un botón. */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!archivo || trabajando !== null}
            onClick={() => ejecutar(true)}
          >
            {trabajando === 'simular' && <CircleNotch className="size-4 animate-spin" />}
            {trabajando === 'simular' ? 'Preparando servidor y revisando…' : 'Revisar sin guardar'}
          </Button>
          <Button
            disabled={!archivo || !simulacion || trabajando !== null}
            onClick={() => ejecutar(false)}
          >
            {trabajando === 'importar' && <CircleNotch className="size-4 animate-spin" />}
            Importar
          </Button>
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <WarningCircle className="size-5 shrink-0" />
            {error}
          </div>
        )}

        {aMostrar && (
          <div className="space-y-3">
            {aMostrar.simulacion && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <Info className="size-4 shrink-0" />
                {T.estoEsUna}
              </p>
            )}
            {!aMostrar.simulacion && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="size-4 shrink-0" />
                {T.importacionTerminada}
              </p>
            )}

            <ul className="space-y-2">
              {aMostrar.hojas.map((hoja) => (
                <HojaResumen key={hoja.nombre} hoja={hoja} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HojaResumen({ hoja }: { hoja: HojaProcesada }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  if (!hoja.detalle) {
    return (
      <li className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          {hoja.nombre}
          <span className="text-xs font-normal text-muted-foreground">{T.noSeImporto}</span>
        </p>
        <p className="mt-1 pl-6 text-xs text-muted-foreground">{hoja.motivo}</p>
      </li>
    )
  }

  const d = hoja.detalle
  return (
    <li className="rounded-xl border border-border p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <CheckCircle className="size-4 shrink-0 text-emerald-600" />
        {hoja.nombre}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-normal">
          {hoja.destino}
        </span>
        {(hoja.destinoPorIa || (hoja.columnasPorIa?.length ?? 0) > 0) && (
          <span
            title={
              hoja.destinoPorIa
                ? T.elDestinoDe
                : `La IA reconoció: ${hoja.columnasPorIa.join(', ')}`
            }
            className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-normal text-violet-600 dark:text-violet-400"
          >
            <Sparkle className="size-3" />
            {T.mapeadoPorIa}
          </span>
        )}
      </p>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">
        {d.filasLeidas} fila{d.filasLeidas === 1 ? '' : 's'} leída
        {d.filasLeidas === 1 ? '' : 's'}
        {d.creados > 0 && ` · ${d.creados} nueva${d.creados === 1 ? '' : 's'}`}
        {d.actualizados > 0 && ` · ${d.actualizados} actualizada${d.actualizados === 1 ? '' : 's'}`}
        {d.omitidos > 0 && ` · ${d.omitidos} ya estaba${d.omitidos === 1 ? '' : 'n'}`}
        {d.errores.length > 0 && ` · ${d.errores.length} con problemas`}
      </p>

      {d.columnasReconocidas.length > 0 && (
        <details className="mt-2 pl-6">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Columnas reconocidas
          </summary>
          <ul className="mt-1 space-y-0.5">
            {d.columnasReconocidas.map((c) => (
              <li key={c.cabecera} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                «{c.cabecera}» → {c.campo ?? T.sinMapear}
                {c.campo && (hoja.columnasPorIa ?? []).includes(c.cabecera) && (
                  <span
                    title={T.loReconocioLa}
                    className="flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-600 dark:text-violet-400"
                  >
                    <Sparkle className="size-2.5" />
                    IA
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {d.errores.length > 0 && (
        <details className="mt-2 pl-6">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {T.verLasFilas}
          </summary>
          {/* Se citan hasta 20: la lista completa de un archivo mal armado no
              cabe en pantalla y las primeras ya dicen qué corregir. */}
          <ul className="mt-1 space-y-0.5">
            {d.errores.slice(0, 20).map((e) => (
              <li key={e.fila} className="text-xs text-muted-foreground">
                Fila {e.fila}: {e.motivo}
              </li>
            ))}
            {d.errores.length > 20 && (
              <li className="text-xs text-muted-foreground">
                …y {d.errores.length - 20} más.
              </li>
            )}
          </ul>
        </details>
      )}
    </li>
  )
}
