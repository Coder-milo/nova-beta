'use client'

import { useCallback, useEffect, useState } from 'react'
import { BriefcaseBusiness, Plus, Send, Users, X } from 'lucide-react'
import Link from '@/compat/next-link'
import { PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner } from '@/components/ui/page-spinner'
import { useConfirmar } from '@/components/ui/confirmar'
import { portalApi } from '@/lib/api'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import type { EstadoVacantePortal, VacanteDelPortal, VacanteEntrante } from '@/lib/types'

/**
 * Cómo se ve cada estado.
 *
 * «En revisión» no es una advertencia ni un error: es lo normal y lo esperado
 * para todo lo que publica una empresa. Pintarlo en ámbar lo haría parecer un
 * problema que la empresa tiene que resolver, cuando lo único que tiene que
 * hacer es esperar.
 */
const ESTADOS: Record<EstadoVacantePortal, { es: string; en: string; clase: string }> = {
  BORRADOR:    { es: 'Borrador',    en: 'Draft',        clase: 'bg-secondary text-muted-foreground' },
  EN_REVISION: { es: 'En revisión', en: 'Under review', clase: 'bg-primary/15 text-primary' },
  RECHAZADA:   { es: 'Con cambios', en: 'Changes needed', clase: 'bg-[color-mix(in_srgb,var(--panel-negativo)_15%,transparent)] text-[var(--panel-negativo)]' },
  PUBLICADA:   { es: 'Publicada',   en: 'Published',    clase: 'bg-[color-mix(in_srgb,var(--panel-positivo)_15%,transparent)] text-[var(--panel-positivo)]' },
  CERRADA:     { es: 'Cerrada',     en: 'Closed',       clase: 'bg-secondary text-muted-foreground' },
}

const VACIA: VacanteEntrante = { titulo: '' }

export default function VacantesDelPortalPage() {
  const { locale } = usePreferences()
  const en = locale === 'en'
  const { confirmar, dialogo } = useConfirmar()

  const [vacantes, setVacantes] = useState<VacanteDelPortal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<VacanteDelPortal | 'nueva' | null>(null)
  const [borrador, setBorrador] = useState<VacanteEntrante>(VACIA)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setVacantes(await portalApi.vacantes())
      setError(null)
    } catch (e) {
      setError(errorDe(e, en ? 'Could not load your job posts.' : 'No se pudieron cargar tus vacantes.'))
    }
  }, [en])

  useEffect(() => { void cargar() }, [cargar])

  const abrir = (v: VacanteDelPortal | 'nueva') => {
    setEditando(v)
    setBorrador(v === 'nueva' ? VACIA : {
      titulo: v.titulo,
      descripcion: v.descripcion,
      requisitos: v.requisitos,
      ciudad: v.ciudad,
      modalidadTrabajo: v.modalidadTrabajo,
      tipoContrato: v.tipoContrato,
      jornada: v.jornada,
      rangoSalarial: v.rangoSalarial,
      nivelInglesRequerido: v.nivelInglesRequerido,
      aniosExperienciaRequeridos: v.aniosExperienciaRequeridos,
      fechaExpiracion: v.fechaExpiracion,
    })
  }

  const guardar = async (enviar: boolean) => {
    setGuardando(true)
    setError(null)
    try {
      if (editando === 'nueva') {
        await portalApi.crearVacante(borrador, !enviar)
      } else if (editando) {
        await portalApi.editarVacante(editando.id, borrador, enviar)
      }
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(errorDe(e, en ? 'Could not save.' : 'No se pudo guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  const cerrarVacante = async (v: VacanteDelPortal) => {
    const ok = await confirmar({
      titulo: en ? 'Close this job post?' : '¿Cerrar esta vacante?',
      descripcion: en
        ? 'It stops being visible to candidates. The applications already received are kept.'
        : 'Deja de verse para los candidatos. Las postulaciones ya recibidas se conservan.',
      textoConfirmar: en ? 'Close post' : 'Cerrar vacante',
    })
    if (!ok) return
    try {
      await portalApi.cerrarVacante(v.id)
      await cargar()
    } catch (e) {
      setError(errorDe(e))
    }
  }

  if (vacantes === null && !error) {
    return <PageSpinner label={en ? 'Loading job posts…' : 'Cargando vacantes…'} />
  }

  // ── Formulario ──────────────────────────────────────────────────────────
  if (editando) {
    const esPublicada = editando !== 'nueva' && editando.estado === 'PUBLICADA'
    const esBorrador = editando !== 'nueva' && editando.estado === 'BORRADOR'

    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          antetitulo={en ? 'Job post' : 'Vacante'}
          titulo={editando === 'nueva'
            ? (en ? 'New job post' : 'Nueva vacante')
            : editando.titulo}
          icono={BriefcaseBusiness}
          acciones={
            <Button variant="outline" size="sm" onClick={() => setEditando(null)} disabled={guardando}>
              <X className="size-4" />{en ? 'Cancel' : 'Cancelar'}
            </Button>
          }
        />

        {/* Se avisa ANTES de que escriba, no al guardar: enterarse de que el
            texto vuelve a revisión después de reescribirlo entero es la forma
            de que nadie corrija una errata. */}
        {/* El motivo va donde se corrige, no en el listado: leerlo lejos del
            texto obliga a memorizarlo y volver. */}
        {editando !== 'nueva' && editando.motivoRechazo && (
          <div className="rounded-(--radius) border border-[color-mix(in_srgb,var(--panel-negativo)_35%,transparent)] bg-[color-mix(in_srgb,var(--panel-negativo)_7%,transparent)] px-3 py-2">
            <p className="text-[13px] font-semibold text-foreground">
              {en ? 'The team asked for changes' : 'El equipo pidió cambios'}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-foreground/90">{editando.motivoRechazo}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {en
                ? 'Fix it and send it again. You do not have to start over.'
                : 'Corrígelo y vuelve a enviarla. No hace falta empezar de cero.'}
            </p>
          </div>
        )}

        {esPublicada && (
          <p className="rounded-(--radius) border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[13px] text-foreground">
            {en
              ? 'This post is published. Any edit sends it back for review before it is visible again.'
              : 'Esta vacante está publicada. Cualquier cambio la devuelve a revisión antes de volver a verse.'}
          </p>
        )}

        <Card className="gap-0 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4">
            <Campo etiqueta={en ? 'Job title' : 'Título del puesto'} requerido>
              <Input
                value={borrador.titulo}
                onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })}
                placeholder={en ? 'Bilingual customer advisor' : 'Asesor bilingüe de servicio'}
              />
            </Campo>

            <Campo etiqueta={en ? 'Description' : 'Descripción'}>
              <Textarea
                minRows={5}
                value={borrador.descripcion ?? ''}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
              />
            </Campo>

            <Campo etiqueta={en ? 'Requirements' : 'Requisitos'}>
              <Textarea
                minRows={3}
                value={borrador.requisitos ?? ''}
                onChange={(e) => setBorrador({ ...borrador, requisitos: e.target.value })}
              />
            </Campo>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo etiqueta={en ? 'City' : 'Ciudad'}>
                <Input
                  value={borrador.ciudad ?? ''}
                  onChange={(e) => setBorrador({ ...borrador, ciudad: e.target.value })}
                />
              </Campo>
              <Campo etiqueta={en ? 'Work mode' : 'Modalidad'}>
                <Input
                  value={borrador.modalidadTrabajo ?? ''}
                  onChange={(e) => setBorrador({ ...borrador, modalidadTrabajo: e.target.value })}
                  placeholder={en ? 'On site / Hybrid / Remote' : 'Presencial / Híbrida / Remota'}
                />
              </Campo>
              <Campo etiqueta={en ? 'Contract type' : 'Tipo de contrato'}>
                <Input
                  value={borrador.tipoContrato ?? ''}
                  onChange={(e) => setBorrador({ ...borrador, tipoContrato: e.target.value })}
                />
              </Campo>
              <Campo etiqueta={en ? 'Salary range' : 'Rango salarial'}>
                <Input
                  value={borrador.rangoSalarial ?? ''}
                  onChange={(e) => setBorrador({ ...borrador, rangoSalarial: e.target.value })}
                />
              </Campo>
              <Campo etiqueta={en ? 'English level' : 'Nivel de inglés'}>
                <Input
                  value={borrador.nivelInglesRequerido ?? ''}
                  onChange={(e) => setBorrador({ ...borrador, nivelInglesRequerido: e.target.value })}
                  placeholder="B2"
                />
              </Campo>
              <Campo etiqueta={en ? 'Years of experience' : 'Años de experiencia'}>
                <Input
                  type="number"
                  min={0}
                  value={borrador.aniosExperienciaRequeridos ?? ''}
                  onChange={(e) => setBorrador({
                    ...borrador,
                    aniosExperienciaRequeridos: e.target.value === '' ? null : Number(e.target.value),
                  })}
                />
              </Campo>
            </div>

            {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--panel-borde)] pt-3">
              {/* Guardar sin enviar solo aparece mientras es borrador: en una
                  publicada no significaría nada, porque el cambio la devuelve
                  a revisión de todos modos. */}
              {(editando === 'nueva' || esBorrador) && (
                <Button variant="outline" size="sm" onClick={() => void guardar(false)} disabled={guardando}>
                  {en ? 'Save draft' : 'Guardar borrador'}
                </Button>
              )}
              <Button size="sm" onClick={() => void guardar(true)} disabled={guardando}>
                <Send className="size-4" />
                {guardando
                  ? (en ? 'Saving…' : 'Guardando…')
                  : (en ? 'Send for review' : 'Enviar a revisión')}
              </Button>
            </div>
          </CardContent>
        </Card>
        {dialogo}
      </div>
    )
  }

  // ── Listado ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        antetitulo={en ? 'Company portal' : 'Portal de empresas'}
        titulo={en ? 'My job posts' : 'Mis vacantes'}
        icono={BriefcaseBusiness}
        acciones={
          <Button size="sm" onClick={() => abrir('nueva')}>
            <Plus className="size-4" />{en ? 'New post' : 'Nueva vacante'}
          </Button>
        }
      />

      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}

      {vacantes && vacantes.length === 0 ? (
        <Card className="gap-0 shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BriefcaseBusiness className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {en ? 'No job posts yet' : 'Todavía no hay vacantes'}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {en
                ? 'Publish one and the programme team reviews it before candidates can see it.'
                : 'Publica una y el equipo del programa la revisa antes de que los candidatos puedan verla.'}
            </p>
            <Button size="sm" className="mt-1" onClick={() => abrir('nueva')}>
              <Plus className="size-4" />{en ? 'New post' : 'Nueva vacante'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 shadow-none">
          <CardContent className="p-0">
            <ul className="divide-y divide-[var(--panel-borde)]">
              {vacantes?.map((v) => {
                const estado = ESTADOS[v.estado]
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-foreground">{v.titulo}</span>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          estado.clase,
                        )}>
                          {en ? estado.en : estado.es}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {[v.ciudad, v.modalidadTrabajo, v.tipoContrato].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </div>

                    {/* El contador solo enlaza si hay a quien ver: un enlace a
                        una lista vacía es una promesa incumplida. */}
                    {v.postulantes > 0 ? (
                      <Link
                        href={`/portal/postulantes?vacante=${v.id}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-(--radius) px-2 py-1 text-[13px] font-medium text-primary hover:bg-primary/10"
                      >
                        <Users className="size-3.5" />
                        {v.postulantes} {en ? 'candidates' : 'candidatos'}
                      </Link>
                    ) : (
                      <span className="shrink-0 px-2 text-xs text-muted-foreground">
                        {en ? 'No candidates yet' : 'Sin candidatos'}
                      </span>
                    )}

                    <div className="flex shrink-0 items-center gap-1.5">
                      {v.estado !== 'CERRADA' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => abrir(v)}>
                            {en ? 'Edit' : 'Editar'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void cerrarVacante(v)}>
                            {en ? 'Close' : 'Cerrar'}
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      {dialogo}
    </div>
  )
}

function Campo({
  etiqueta,
  requerido,
  children,
}: {
  etiqueta: string
  requerido?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  )
}
