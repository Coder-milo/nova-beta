'use client'

/**
 * Las entrevistas del estudiante, en su portal.
 *
 * El modelo guarda desde hace unos turnos la fecha y hora de la cita, la
 * modalidad, el sitio y con quién es. Lo veía el equipo en la agenda y lo veía
 * la empresa en su portal. **La única que no lo veía era la persona que tiene
 * que presentarse.** Se enteraba por WhatsApp, si alguien se acordaba de
 * escribirle.
 *
 * Va arriba del todo y no en una pestaña: es lo único del portal con hora de
 * caducidad. Una hoja de vida a medias se termina mañana; una entrevista a las
 * 3 de la tarde, no.
 *
 * No se pide a un endpoint nuevo. Las postulaciones del estudiante ya vienen
 * enteras en `/mias` —son decenas, no miles— y filtrar aquí evita una segunda
 * llamada que devolvería un subconjunto de lo que ya está en memoria.
 */

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, MapPin, Phone, User, Video } from 'lucide-react'
import { postulacionesApi } from '@/lib/api'
import type { MiPostulacion } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/lib/preferences'

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Your interviews',
        descripcion: 'Confirmed appointments. Bring your ID and arrive ten minutes early.',
        hoy: 'Today',
        manana: 'Tomorrow',
        enHoras: (h: number) => `In ${h} h`,
        enDias: (d: number) => `In ${d} days`,
        conQuien: 'Ask for',
        donde: 'Where',
        enlace: 'Join the meeting',
        vencida: 'This appointment has passed',
        vencidaDetalle: 'If you attended, tell your advisor so it can be recorded.',
      }
    : {
        titulo: 'Tus entrevistas',
        descripcion: 'Citas confirmadas. Lleva tu documento y llega diez minutos antes.',
        hoy: 'Hoy',
        manana: 'Mañana',
        enHoras: (h: number) => `En ${h} h`,
        enDias: (d: number) => `En ${d} días`,
        conQuien: 'Pregunta por',
        donde: 'Dónde',
        enlace: 'Entrar a la reunión',
        vencida: 'Esta cita ya pasó',
        vencidaDetalle: 'Si asististe, avísale a tu asesor para que quede registrado.',
      }
}

/**
 * Cuánto falta, dicho como lo diría una persona.
 *
 * «En 34 h» no le sirve a nadie para organizarse; «Mañana» sí. Se cambia a
 * horas solo el mismo día, que es cuando la hora exacta importa.
 */
function cuantoFalta(horas: number, T: ReturnType<typeof textos>, iso: string) {
  const cita = new Date(iso)
  const ahora = new Date()
  const dias = Math.round(
    (new Date(cita.getFullYear(), cita.getMonth(), cita.getDate()).getTime()
      - new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime())
    / 86_400_000,
  )
  if (dias === 0) return horas <= 0 ? T.hoy : T.enHoras(Math.max(1, Math.round(horas)))
  if (dias === 1) return T.manana
  return T.enDias(dias)
}

function cuando(iso: string, locale: string) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString(locale === 'en' ? 'en-GB' : 'es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const esEnlace = (lugar: string) => /^https?:\/\//i.test(lugar.trim())

export function ProximasCitas() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const [postulaciones, setPostulaciones] = useState<MiPostulacion[]>([])

  useEffect(() => {
    let vivo = true
    postulacionesApi
      .mias()
      .then((lista) => { if (vivo) setPostulaciones(lista) })
      // En silencio: es un panel de apoyo dentro de una pantalla que ya tiene
      // sus propios avisos. Un error rojo aquí por una lista que puede estar
      // vacía de todos modos asusta más de lo que informa.
      .catch(() => undefined)
    return () => { vivo = false }
  }, [])

  const citas = useMemo(
    () =>
      postulaciones
        .filter((p) => p.entrevistaPendiente || p.entrevistaVencida)
        .sort((a, b) => (a.fechaHoraEntrevista ?? '').localeCompare(b.fechaHoraEntrevista ?? '')),
    [postulaciones],
  )

  // Sin citas no se pinta nada. Una tarjeta que dice «no tienes entrevistas»
  // ocupa el sitio de arriba para dar una noticia que no es noticia.
  if (citas.length === 0) return null

  return (
    <Card className="glass-card border-primary/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" strokeWidth={2} />
          {T.titulo}
        </CardTitle>
        <CardDescription>{T.descripcion}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {citas.map((cita) => {
          const virtual = cita.modalidadEntrevista === 'VIRTUAL'
          const lugar = cita.lugarEntrevista?.trim()
          return (
            <div
              key={cita.id}
              className={`rounded-lg border p-3 ${
                cita.entrevistaVencida ? 'border-border bg-secondary/40' : 'border-primary/25 bg-primary/5'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{cita.cargo}</p>
                {cita.entrevistaVencida ? (
                  <Badge variant="secondary">{T.vencida}</Badge>
                ) : (
                  cita.horasParaEntrevista != null && cita.fechaHoraEntrevista && (
                    <Badge className="shrink-0">
                      {cuantoFalta(cita.horasParaEntrevista, T, cita.fechaHoraEntrevista)}
                    </Badge>
                  )
                )}
              </div>

              <p className="text-sm text-muted-foreground">{cita.empresaNombre}</p>

              {cita.fechaHoraEntrevista && (
                <p className="mt-1 text-sm font-medium first-letter:uppercase">
                  {cuando(cita.fechaHoraEntrevista, locale)}
                  {cita.modalidadEtiqueta && (
                    <span className="font-normal text-muted-foreground"> · {cita.modalidadEtiqueta}</span>
                  )}
                </p>
              )}

              {/* El sitio puede ser una dirección o un enlace de reunión. Se
                  distingue por la forma y no por la modalidad: hay citas
                  marcadas como presenciales cuyo «lugar» acabó siendo un Meet. */}
              {lugar && (
                <p className="mt-1 flex items-start gap-1.5 text-sm">
                  {virtual || esEnlace(lugar)
                    ? <Video className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    : <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />}
                  {esEnlace(lugar) ? (
                    <a
                      href={lugar}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {T.enlace}
                    </a>
                  ) : (
                    <span>{lugar}</span>
                  )}
                </p>
              )}

              {cita.contactoNombre && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="size-3.5 shrink-0" strokeWidth={2} />
                  {T.conQuien} <span className="text-foreground">{cita.contactoNombre}</span>
                </p>
              )}

              {/* Pulsable de verdad: en el móvil, que es donde se abre esto
                  camino de la entrevista, un teléfono que no llama es un
                  teléfono que hay que copiar a mano. */}
              {cita.contactoTelefono && (
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Phone className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <a
                    href={`tel:${cita.contactoTelefono.replace(/\s+/g, '')}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {cita.contactoTelefono}
                  </a>
                </p>
              )}

              {cita.entrevistaVencida && (
                <p className="mt-2 text-xs text-muted-foreground">{T.vencidaDetalle}</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
