'use client'

/**
 * Parámetros de operación: cohorte, corte del motor de matching y retención de
 * la papelera.
 *
 * Los dos números mandan de verdad. Antes no: el umbral se editaba aquí,
 * arrancaba en 70 y se guardaba en `localStorage`, mientras el motor cortaba
 * por el 55 de `matching-config.yml`. Subirlo a 80 no cambiaba ni un match, y
 * nada lo advertía. Los días de retención iban igual: la purga borraba a los 30
 * pasara lo que pasara.
 *
 * Aquí ya no hay casillas de alertas ni plantilla de hoja de vida: prometían
 * correos que nadie envía y duplicaban un control que existe de verdad en
 * Hojas de vida › Plantillas.
 *
 * Requiere COORDINADOR o ADMIN para guardar.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  CheckCircleIcon as CheckCircle,
  CircleNotchIcon as CircleNotch,
  FloppyDiskIcon as FloppyDisk,
  InfoIcon as Info,
  SlidersIcon as Sliders,
  WarningCircleIcon as WarningCircle,
} from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { configuracionApi } from '@/lib/api'
import { errorDeGestion } from '@/lib/errores'
import type { ConfiguracionGlobalResponse } from '@/lib/types'

const CLAVE_LEGADA = 'nova_acad_config'

export function PanelAcademico() {
  const [config, setConfig] = useState<ConfiguracionGlobalResponse | null>(null)
  const [cohorte, setCohorte] = useState('')
  const [umbral, setUmbral] = useState('')
  const [dias, setDias] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setGuardado(false)
    try {
      const c = await configuracionApi.obtener()
      setConfig(c)
      setUmbral(String(c.umbralMatchMinimo))
      setDias(String(c.diasRetencionPapelera))

      // La cohorte sí se rescata del navegador si el servidor no tiene nada:
      // es un dato que alguien escribió. El umbral no se rescata a propósito
      // —el que había guardado ahí nunca estuvo en efecto, y recuperarlo sería
      // reintroducir un número que nadie llegó a elegir de verdad—.
      let cohorteLocal: string | null = null
      if (!c.guardado) {
        try {
          const bruto = localStorage.getItem(CLAVE_LEGADA)
          if (bruto) {
            const previo = JSON.parse(bruto) as { cohorteActiva?: string }
            cohorteLocal = previo.cohorteActiva ?? null
          }
        } catch {
          // Sin acceso a localStorage se sigue con lo del servidor.
        }
      }
      setCohorte(c.cohorteActiva ?? cohorteLocal ?? '')
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async (evento: React.SyntheticEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!config) return

    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      // Los datos institucionales viajan tal y como llegaron: este formulario
      // no los edita y mandarlos vacíos los borraría.
      const actualizada = await configuracionApi.guardar({
        nombreOficial: config.nombreOficial,
        nit: config.nit,
        registroEducativo: config.registroEducativo,
        sedePrincipal: config.sedePrincipal,
        telefonoContacto: config.telefonoContacto,
        whatsappSoporte: config.whatsappSoporte,
        emailContacto: config.emailContacto,
        emailSoporte: config.emailSoporte,
        sitioWeb: config.sitioWeb,
        linkedinUrl: config.linkedinUrl,
        instagramUrl: config.instagramUrl,
        cohorteActiva: cohorte.trim() || null,
        umbralMatchMinimo: umbral.trim() === '' ? null : Number(umbral),
        diasRetencionPapelera: dias.trim() === '' ? null : Number(dias),
      })
      setConfig(actualizada)
      setUmbral(String(actualizada.umbralMatchMinimo))
      setDias(String(actualizada.diasRetencionPapelera))
      setCohorte(actualizada.cohorteActiva ?? '')
      setGuardado(true)

      try {
        localStorage.removeItem(CLAVE_LEGADA)
      } catch {
        // Un navegador que no deja tocar localStorage no impide guardar.
      }
    } catch (err) {
      setError(errorDeGestion(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sliders className="size-5 text-primary" /> Parámetros de operación
              </CardTitle>
              <CardDescription>
                Corte del motor de matching, retención de la papelera y cohorte en curso.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando || guardando}>
                <ArrowsClockwise className="mr-1 size-3.5" /> Recargar
              </Button>
              <Button type="submit" size="sm" disabled={cargando || guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk className="size-4" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-6">
          {cargando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" /> Cargando…
            </p>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {guardado && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="size-4 shrink-0" />
              <span>Guardado en el servidor. El próximo cálculo de matches usa este umbral.</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cohorte / período activo
              </label>
              <Input
                value={cohorte}
                onChange={(e) => {
                  setCohorte(e.target.value)
                  setGuardado(false)
                }}
                placeholder="2026-I"
                disabled={cargando}
              />
              <span className="text-[10px] text-muted-foreground">
                Etiqueta del período en curso, para informes y seguimiento.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Umbral mínimo de match
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={umbral}
                onChange={(e) => {
                  setUmbral(e.target.value)
                  setGuardado(false)
                }}
                placeholder={config ? String(config.umbralPorDefecto) : '55'}
                disabled={cargando}
              />
              <span className="text-[10px] text-muted-foreground">
                Puntaje mínimo para recomendar una vacante. Súbelo y habrá menos matches,
                mejor sostenidos.
                {config && ` Sin configurar son ${config.umbralPorDefecto}, de matching-config.yml.`}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Días en papelera antes de purgar
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={dias}
                onChange={(e) => {
                  setDias(e.target.value)
                  setGuardado(false)
                }}
                placeholder={config ? String(config.diasRetencionPorDefecto) : '30'}
                disabled={cargando}
              />
              <span className="text-[10px] text-muted-foreground">
                Pasado ese plazo, «Purgar papelera» borra la ficha de forma definitiva.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              El umbral solo afecta a los matches que se calculen de aquí en adelante; los
              ya existentes conservan el puntaje y el desglose con que se crearon. La
              plantilla de hoja de vida predeterminada se elige en Hojas de vida ›
              Plantillas.
            </span>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
