'use client'

import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle, Sparkles } from 'lucide-react'
import Link from '@/compat/next-link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { RespuestaCopiloto } from '@/lib/types'

export interface MiSiguientePasoProps {
  respuesta: RespuestaCopiloto | null
  cargando: boolean
  error: boolean
  english: boolean
  onEjecutarAccion?: (ruta: string, codigo?: string) => void
}

export function MiSiguientePaso({
  respuesta,
  cargando,
  error,
  english,
  onEjecutarAccion,
}: MiSiguientePasoProps) {
  const recomendacion = respuesta?.recomendaciones[0]

  if (cargando) {
    return (
      <Card className="border-primary/20 shadow-none">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-primary" />
          {english ? 'Finding your best next step…' : 'Buscando tu mejor siguiente paso…'}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border shadow-none">
        <CardContent className="flex items-start gap-3 p-5">
          <CircleAlert className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-foreground">
              {english
                ? 'Your next step is temporarily unavailable'
                : 'Tu siguiente paso no está disponible temporalmente'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {english
                ? 'You can continue using your route, applications and upcoming appointments below.'
                : 'Puedes seguir usando tu ruta, postulaciones y próximas citas que aparecen debajo.'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!recomendacion) {
    return (
      <Card className="border-emerald-500/25 bg-emerald-500/[0.035] shadow-none">
        <CardContent className="flex items-start gap-3 p-5">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="font-semibold text-foreground">
              {english ? 'Your process is up to date' : 'Tu proceso está al día'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {english
                ? 'No urgent next step was detected with the available information.'
                : 'No encontramos un siguiente paso urgente con la información disponible.'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const titulo = english ? recomendacion.texto.tituloEn : recomendacion.texto.tituloEs
  const detectado = english ? recomendacion.texto.queDetectoEn : recomendacion.texto.queDetectoEs
  const importa = english ? recomendacion.texto.porQueImportaEn : recomendacion.texto.porQueImportaEs
  const accion = english ? recomendacion.accion.etiquetaEn : recomendacion.accion.etiquetaEs

  const botonClases =
    'mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-105 hover:shadow-sm cursor-pointer'

  return (
    <Card className="overflow-hidden border-primary/30 shadow-xs">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-primary/15 bg-primary/[0.055] px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="size-4" />
            {english ? 'My next step' : 'Mi siguiente paso'}
          </span>
          <Badge
            variant={recomendacion.prioridad === 'ALTA' ? 'destructive' : 'outline'}
          >
            {recomendacion.prioridad === 'ALTA'
              ? english
                ? 'Important'
                : 'Importante'
              : english
                ? 'Recommended'
                : 'Recomendado'}
          </Badge>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-1 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{detectado}</p>
              <p className="mt-3 text-sm text-foreground/85">
                <b>{english ? 'Why it matters:' : 'Por qué importa:'}</b> {importa}
              </p>
            </div>
          </div>

          {recomendacion.evidencia.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recomendacion.evidencia.map((e) => (
                <Badge key={e.codigo} variant="outline" className="font-normal text-xs">
                  {english ? e.etiquetaEn : e.etiquetaEs}
                </Badge>
              ))}
            </div>
          )}

          {onEjecutarAccion ? (
            <button
              type="button"
              onClick={() => onEjecutarAccion(recomendacion.accion.ruta, recomendacion.codigo)}
              className={botonClases}
            >
              {accion}
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <Link href={recomendacion.accion.ruta} className={botonClases}>
              {accion}
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
