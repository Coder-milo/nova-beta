'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, GraduationCap, MapPin, Users } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner } from '@/components/ui/page-spinner'
import { FormularioCita } from '@/components/admin/formulario-cita'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { portalApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { MovimientoDeEmpresa, PerfilLaboral } from '@/lib/types'

/**
 * Los movimientos que puede hacer una empresa.
 *
 * CONTRATADO no está, y no es un olvido: la colocación —con contrato, salario y
 * verificación— la registra el equipo del programa, y de ella salen las cifras
 * que se reportan al cierre de cohorte. Se explica en la propia pantalla para
 * que no parezca que falta un botón.
 */
const MOVIMIENTOS: { valor: MovimientoDeEmpresa; es: string; en: string; tono: string }[] = [
  { valor: 'EN_PROCESO',          es: 'En proceso',   en: 'In progress',   tono: 'text-primary' },
  { valor: 'ENTREVISTA_AGENDADA', es: 'Citar',        en: 'Schedule',      tono: 'text-primary' },
  { valor: 'ENTREVISTA_REALIZADA',es: 'Entrevistado', en: 'Interviewed',   tono: 'text-foreground' },
  { valor: 'RECHAZADO',           es: 'Descartar',    en: 'Reject',        tono: 'text-destructive' },
]

function fecha(iso: string | null, en: boolean): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(en ? 'en-GB' : 'es-CO',
    { day: 'numeric', month: 'short', year: 'numeric' })
}

function fechaHora(iso: string | null, en: boolean): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(en ? 'en-GB' : 'es-CO',
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function PostulantesDelPortalPage() {
  const { locale } = usePreferences()
  const en = locale === 'en'

  const [perfiles, setPerfiles] = useState<PerfilLaboral[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [moviendo, setMoviendo] = useState<string | null>(null)
  /** Candidatura cuya cita se está editando. */
  const [citando, setCitando] = useState<PerfilLaboral | null>(null)

  // La vacante llega por la URL desde el listado. Se lee una vez al montar: si
  // se leyera en cada render, volver atrás en el navegador no cambiaría nada.
  const [vacanteId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('vacante')
  })

  const cargar = useCallback(async () => {
    try {
      setPerfiles(vacanteId
        ? await portalApi.postulantesDeVacante(vacanteId)
        : await portalApi.postulantes())
      setError(null)
    } catch (e) {
      setError(errorDe(e, en ? 'Could not load candidates.' : 'No se pudieron cargar los candidatos.'))
    }
  }, [vacanteId, en])

  useEffect(() => { void cargar() }, [cargar])

  const mover = async (postulacionId: string, estado: MovimientoDeEmpresa) => {
    setMoviendo(postulacionId)
    try {
      await portalApi.moverPostulacion(postulacionId, {
        estado,
        comentario: comentario.trim() || null,
      })
      setComentario('')
      setAbierto(null)
      await cargar()
    } catch (e) {
      setError(errorDe(e))
    } finally {
      setMoviendo(null)
    }
  }

  if (perfiles === null && !error) {
    return <PageSpinner label={en ? 'Loading candidates…' : 'Cargando candidatos…'} />
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        antetitulo={en ? 'Company portal' : 'Portal de empresas'}
        titulo={vacanteId
          ? (en ? 'Candidates for this post' : 'Candidatos de esta vacante')
          : (en ? 'All candidates' : 'Todos los candidatos')}
        icono={Users}
        campos={perfiles ? [{
          etiqueta: en ? 'Total' : 'Total',
          valor: String(perfiles.length),
        }] : undefined}
      />

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {perfiles && perfiles.length === 0 ? (
        <Card className="gap-0 shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {en ? 'No candidates yet' : 'Todavía no hay candidatos'}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {en
                ? 'Candidates appear here once your post is published and someone applies.'
                : 'Aparecen aquí cuando tu vacante esté publicada y alguien se postule.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {perfiles?.map((p) => (
            <Card key={p.postulacionId} className="gap-0 shadow-none">
              <CardContent className="flex flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {p.nombreCompleto}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.cargoAlQueSePostulo} · {fecha(p.fechaPostulacion, en)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {p.estadoEtiqueta}
                  </span>
                </div>

                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {p.programa && <Dato icono={GraduationCap} valor={p.programa} />}
                  {p.ciudad && <Dato icono={MapPin} valor={p.ciudad} />}
                  {p.fechaHoraEntrevista && (
                    <Dato icono={CalendarDays} valor={`${fechaHora(p.fechaHoraEntrevista, en)}${p.modalidadEntrevista ? ` · ${p.modalidadEntrevista}` : ''}`} />
                  )}
                </dl>

                {p.perfilProfesional && (
                  <p className="line-clamp-3 text-[13px] leading-snug text-foreground/90">
                    {p.perfilProfesional}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  {p.ultimoCargo && <Etiqueta texto={p.ultimoCargo} />}
                  {p.nivelIngles && <Etiqueta texto={`${en ? 'English' : 'Inglés'} ${p.nivelIngles}`} />}
                  {p.aniosExperiencia != null && (
                    <Etiqueta texto={`${p.aniosExperiencia} ${en ? 'yrs exp.' : 'años exp.'}`} />
                  )}
                  {p.habilidades.slice(0, 6).map((h) => <Etiqueta key={h} texto={h} />)}
                  {p.habilidades.length > 6 && (
                    <Etiqueta texto={`+${p.habilidades.length - 6}`} />
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-[var(--panel-borde)] pt-2.5">
                  {abierto === p.postulacionId && (
                    <Textarea
                      minRows={2}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder={en
                        ? 'Optional note for the programme team'
                        : 'Nota opcional para el equipo del programa'}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {MOVIMIENTOS.map((m) => (
                      <Button
                        key={m.valor}
                        variant="outline"
                        size="sm"
                        disabled={moviendo === p.postulacionId}
                        onClick={() => {
                          if (m.valor === 'ENTREVISTA_AGENDADA') { setCitando(p); return }
                          if (abierto !== p.postulacionId) { setAbierto(p.postulacionId); setComentario(''); return }
                          void mover(p.postulacionId, m.valor)
                        }}
                        className={cn(abierto === p.postulacionId && m.tono)}
                      >
                        {en ? m.en : m.es}
                      </Button>
                    ))}
                    {abierto === p.postulacionId && (
                      <Button variant="ghost" size="sm" onClick={() => setAbierto(null)}>
                        {en ? 'Cancel' : 'Cancelar'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={citando !== null} onOpenChange={(abierta) => { if (!abierta) setCitando(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {citando?.fechaHoraEntrevista
                ? (en ? 'Change the interview' : 'Cambiar la entrevista')
                : (en ? 'Schedule interview' : 'Agendar entrevista')}
              {citando && <span className="block text-xs font-normal text-muted-foreground">{citando.nombreCompleto}</span>}
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {citando && (
              <FormularioCita
                // El correo del contacto y el próximo seguimiento son del
                // equipo: el sistema ya tiene el correo por esta cuenta, y la
                // cola de revisión es interna.
                camposDelEquipo={false}
                valores={{
                  fechaHoraEntrevista: citando.fechaHoraEntrevista,
                  modalidadEntrevista: null,
                  lugarEntrevista: null,
                  contactoNombre: null,
                  contactoTelefono: null,
                }}
                guardar={async (cambios) => {
                  await portalApi.agendarCita(citando.postulacionId, {
                    fechaHoraEntrevista: cambios.fechaHoraEntrevista,
                    modalidad: cambios.modalidadEntrevista,
                    lugar: cambios.lugarEntrevista,
                    contactoNombre: cambios.contactoNombre,
                    contactoTelefono: cambios.contactoTelefono,
                    cancelar: cambios.cancelarEntrevista,
                  })
                  await cargar()
                }}
                onCerrar={() => setCitando(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Se dice por qué no está el botón que la empresa va a buscar. Un botón
          ausente sin explicación se lee como una carencia del sistema. */}
      {perfiles && perfiles.length > 0 && (
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          {en
            ? 'Hiring is confirmed by the programme team, not from this portal: it needs the contract and salary on record. Tell us here and we take it from there.'
            : 'La contratación la confirma el equipo del programa, no se marca desde aquí: necesita el contrato y el salario registrados. Avísanos por este medio y nosotros seguimos.'}
        </p>
      )}
    </div>
  )
}

function Dato({ icono: Icono, valor }: { icono: typeof MapPin; valor: string }) {
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Icono className="size-3.5 shrink-0" />
      <span className="truncate">{valor}</span>
    </div>
  )
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <span className="rounded-(--radius) bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {texto}
    </span>
  )
}
