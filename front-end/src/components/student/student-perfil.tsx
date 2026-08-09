'use client'

import { useEffect, useState } from 'react'
import { BriefcaseIcon as Briefcase, CheckIcon as Check, CircleNotchIcon as CircleNotch, GraduationCapIcon as GraduationCap, PencilSimpleIcon as PencilSimple, UserIcon as User, WarningCircleIcon as WarningCircle, XIcon as X } from '@phosphor-icons/react'
import { ApiCallError, estudiantesApi, mensajeDeError, perfilApi } from '@/lib/api'
import { useAvisos } from '@/components/ui/avisos'
import type { EstudianteRequest, EstudianteResponse, FormacionResponse, ExperienciaResponse } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePreferences } from '@/lib/preferences'

interface Props {
  perfil: EstudianteResponse
  onUpdate: (updated: EstudianteResponse) => void
}

type EditableFields = {
  celular: string
  ciudad: string
  direccion: string
  cargoObjetivo: string
  perfilProfesional: string
  disponibilidadLaboral: string
  competencias: string
  idiomas: string
  linkedinUrl: string
}

function buildEditableFields(p: EstudianteResponse): EditableFields {
  return {
    celular: p.celular ?? '',
    ciudad: p.ciudad ?? '',
    direccion: p.direccion ?? '',
    cargoObjetivo: p.cargoObjetivo ?? '',
    perfilProfesional: p.perfilProfesional ?? '',
    disponibilidadLaboral: p.disponibilidadLaboral ?? '',
    competencias: p.competencias ?? '',
    idiomas: p.idiomas ?? '',
    linkedinUrl: p.linkedinUrl ?? '',
  }
}

/**
 * Los textos de esta pantalla, en los dos idiomas.
 *
 * Junto al componente, como en documentos y postulaciones: `preferences`
 * guarda lo que se repite en toda la aplicacion, no las cadenas de una vista.
 */
function textos(english: boolean) {
  return english
    ? {
        infoPersonal: 'Personal information', datosAdmin: 'Administrative data',
        experiencia: 'Professional experience', formacion: 'Education and certifications',
        competencias: 'Skills', idiomas: 'Languages', cargoObjetivo: 'Target role',
        linkedin: 'LinkedIn profile', enlaceLinkedin: 'LinkedIn link',
        abrirLinkedin: 'Open my LinkedIn profile ↗',
        perfilCompletado: 'Profile completed',
        celular: 'Mobile / WhatsApp', ciudad: 'City of residence', direccion: 'Address',
        documento: 'ID document', programa: 'Programme', nivelIngles: 'English level',
        disponibilidad: 'Availability', inmediata: 'Immediate',
        sinRegistrar: 'Not recorded', sinAsignar: 'Not assigned', sinFecha: 'No date',
        noDisponible: 'Not available', selecciona: 'Choose…', presente: 'Present',
        actualidad: 'Present', institucion: 'Institution',
        phDireccion: 'Street 00 # 00-00', phCiudad: 'Barranquilla',
        phIdiomas: 'Spanish, English B1, Portuguese…',
        phLinkedin: 'https://www.linkedin.com/in/your-profile',
        errorGuardar: 'Could not save. Please try again.',
        errorFoto: 'The photo could not be uploaded',
      }
    : {
        infoPersonal: 'Información personal', datosAdmin: 'Datos administrativos',
        experiencia: 'Experiencia profesional', formacion: 'Formación académica y certificaciones',
        competencias: 'Competencias', idiomas: 'Idiomas', cargoObjetivo: 'Cargo objetivo',
        linkedin: 'Perfil de LinkedIn', enlaceLinkedin: 'Enlace de LinkedIn',
        abrirLinkedin: 'Abrir mi perfil de LinkedIn ↗',
        perfilCompletado: 'Perfil completado',
        celular: 'Celular / WhatsApp', ciudad: 'Ciudad de residencia', direccion: 'Dirección',
        documento: 'Documento', programa: 'Programa', nivelIngles: 'Nivel de inglés',
        disponibilidad: 'Disponibilidad laboral', inmediata: 'Inmediata',
        sinRegistrar: 'Sin registrar', sinAsignar: 'Sin asignar', sinFecha: 'Sin fecha',
        noDisponible: 'No disponible', selecciona: 'Selecciona…', presente: 'Presente',
        actualidad: 'Actualidad', institucion: 'Institución',
        phDireccion: 'Calle 00 # 00-00', phCiudad: 'Barranquilla',
        phIdiomas: 'Español, Inglés B1, Portugués…',
        phLinkedin: 'https://www.linkedin.com/in/tu-perfil',
        errorGuardar: 'No se pudo guardar. Intenta de nuevo.',
        errorFoto: 'Error al subir la foto',
      }
}

export function StudentPerfil({ perfil, onUpdate }: Props) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const { mostrarError, avisos } = useAvisos()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<EditableFields>(buildEditableFields(perfil))
  const [formaciones, setFormaciones] = useState<FormacionResponse[]>([])
  const [experiencias, setExperiencias] = useState<ExperienciaResponse[]>([])

  useEffect(() => {
    if (perfil.id) {
      perfilApi.formaciones(perfil.id).then(setFormaciones).catch(() => {})
      perfilApi.experiencias(perfil.id).then(setExperiencias).catch(() => {})
    }
  }, [perfil.id])

  const cancelar = () => {
    setForm(buildEditableFields(perfil))
    setError(null)
    setEditing(false)
  }

  const guardar = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: EstudianteRequest = {
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        programaId: perfil.programaId,
        celular: form.celular || undefined,
        ciudad: form.ciudad || undefined,
        direccion: form.direccion || undefined,
        cargoObjetivo: form.cargoObjetivo || undefined,
        perfilProfesional: form.perfilProfesional || undefined,
        disponibilidadLaboral: form.disponibilidadLaboral || undefined,
        competencias: form.competencias || undefined,
        idiomas: form.idiomas || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
      }
      const updated = await estudiantesApi.actualizarMiPerfil(body)
      onUpdate(updated)
      setEditing(false)
    } catch (e) {
      setError(
        e instanceof ApiCallError
          ? (e.body.message ?? `Error del servidor (${e.status})`)
          : T.errorGuardar,
      )
    } finally {
      setSaving(false)
    }
  }

  const completitud = perfil.porcentajeCompletitud ?? 0

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center p-6 text-center">
            {perfil.fotoUrl ? (
              <img
                src={perfil.fotoUrl.startsWith('http') ? perfil.fotoUrl : `/api/v1/estudiantes/${perfil.id}/foto`}
                alt={perfil.nombre}
                className="size-24 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-10" />
              </span>
            )}
            <input
              type="file"
              id="foto-upload-input"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const res = await estudiantesApi.subirFoto(perfil.id, file)
                  onUpdate(res)
                } catch (err) {
                  mostrarError(mensajeDeError(err, T.errorFoto))
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => document.getElementById('foto-upload-input')?.click()}
            >
              Cambiar foto
            </Button>
            <h2 className="mt-4 text-lg font-semibold">
              {perfil.nombre} {perfil.apellido}
            </h2>
            <p className="text-sm text-muted-foreground">{perfil.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge>{perfil.estadoAcademico}</Badge>
              <Badge variant="outline">{perfil.estadoEmpleabilidad}</Badge>
            </div>

            {/* Barra de completitud */}
            <div className="mt-5 w-full">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{T.perfilCompletado}</span>
                <span className="font-semibold text-foreground">{completitud}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completitud}%` }}
                />
              </div>
              {completitud < 80 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Completa tu perfil para mejores oportunidades laborales.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Datos que solo el coordinador puede cambiar */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{T.datosAdmin}</CardTitle>
            <CardDescription className="text-xs">
              Solo el coordinador puede modificarlos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              [
                T.documento,
                `${perfil.tipoDocumento ?? ''} ${perfil.numeroDocumento ?? ''}`.trim() ||
                  'Sin registrar',
              ],
              [T.programa, perfil.programaNombre ?? T.sinAsignar],
              [T.institucion, perfil.institucionEducativa ?? 'Sin registrar'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-sm">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Panel principal ─────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{T.infoPersonal}</CardTitle>
            <CardDescription>
              Completa tu perfil para mejorar tus oportunidades laborales.
            </CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilSimple className="size-4" />
              Editar
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <WarningCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {editing ? (
            /* ── Formulario de edición ── */
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { label: T.celular, key: 'celular', type: 'tel', placeholder: '+57 300 000 0000' },
                  { label: T.ciudad, key: 'ciudad', type: 'text', placeholder: T.phCiudad },
                  { label: T.direccion, key: 'direccion', type: 'text', placeholder: T.phDireccion },
                ] as const
              ).map(({ label, key, type, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Disponibilidad laboral
                </label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.disponibilidadLaboral}
                  onChange={(e) => setForm({ ...form, disponibilidadLaboral: e.target.value })}
                >
                  <option value="">{T.selecciona}</option>
                  <option value="INMEDIATA">{T.inmediata}</option>
                  <option value="15_DIAS">15 días</option>
                  <option value="30_DIAS">30 días</option>
                  <option value="60_DIAS">60 días</option>
                  <option value="NO_DISPONIBLE">{T.noDisponible}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{T.idiomas}</label>
                <Input
                  placeholder={T.phIdiomas}
                  value={form.idiomas}
                  onChange={(e) => setForm({ ...form, idiomas: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{T.cargoObjetivo}</label>
                <Input
                  placeholder="Ej: Desarrollador Frontend, Analista de Datos..."
                  value={form.cargoObjetivo}
                  onChange={(e) => setForm({ ...form, cargoObjetivo: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Perfil profesional
                </label>
                <Textarea
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Describe tu experiencia, habilidades y objetivos profesionales..."
                  value={form.perfilProfesional}
                  onChange={(e) => setForm({ ...form, perfilProfesional: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{T.enlaceLinkedin}</label>
                <Input
                  type="url"
                  placeholder={T.phLinkedin}
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Este enlace permite abrir tu perfil desde tu plan de empleabilidad.</p>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{T.competencias}</label>
                <Textarea
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Trabajo en equipo, liderazgo, comunicación asertiva..."
                  value={form.competencias}
                  onChange={(e) => setForm({ ...form, competencias: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <Button variant="outline" onClick={cancelar} disabled={saving}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button onClick={guardar} disabled={saving}>
                  {saving ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" /> Guardando…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" /> Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Vista de datos ── */
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                [T.celular, perfil.celular],
                ['Ciudad', perfil.ciudad],
                [T.direccion, perfil.direccion],
                [T.nivelIngles, perfil.nivelIngles],
                [T.disponibilidad, perfil.disponibilidadLaboral],
                ['Idiomas', perfil.idiomas],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {l}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {v ?? (
                      <span className="italic text-muted-foreground/60">{T.sinRegistrar}</span>
                    )}
                  </p>
                </div>
              ))}

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cargo objetivo
                </p>
                <p className="mt-1 text-sm">
                  {perfil.cargoObjetivo ?? (
                    <span className="italic text-muted-foreground/60">{T.sinRegistrar}</span>
                  )}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Perfil profesional
                </p>
                <p className="mt-1 text-sm leading-6">
                  {perfil.perfilProfesional ?? (
                    <span className="italic text-muted-foreground/60">{T.sinRegistrar}</span>
                  )}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{T.linkedin}</p>
                {perfil.linkedinUrl ? <a href={perfil.linkedinUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-medium text-primary hover:underline">{T.abrirLinkedin}</a> : <p className="mt-1 text-sm italic text-muted-foreground/60">{T.sinRegistrar}</p>}
              </div>

              {perfil.competencias && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Competencias
                  </p>
                  <p className="mt-1 text-sm">{perfil.competencias}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Experiencia Profesional ──────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-primary" />
            <CardTitle className="text-base">{T.experiencia}</CardTitle>
          </div>
          <a href="/mi-hoja-de-vida" className="text-xs font-medium text-primary hover:underline">
            Gestionar en Hoja de Vida ↗
          </a>
        </CardHeader>
        <CardContent>
          {experiencias.length === 0 ? (
            <p className="text-sm italic text-muted-foreground/70">
              No has registrado cargos o experiencias laborales anteriores.
            </p>
          ) : (
            <div className="space-y-4">
              {experiencias.map((exp) => (
                <div key={exp.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-1 font-semibold">
                    <span>{exp.cargo}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {exp.fechaInicio ?? T.sinFecha} — {exp.actual ? T.actualidad : exp.fechaFin ?? T.presente}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{exp.empresa}</p>
                  {exp.funciones && <p className="mt-2 text-xs leading-relaxed text-foreground/90">{exp.funciones}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Formación Académica y Certificaciones ────────────── */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            <CardTitle className="text-base">{T.formacion}</CardTitle>
          </div>
          <a href="/mi-hoja-de-vida" className="text-xs font-medium text-primary hover:underline">
            Gestionar en Hoja de Vida ↗
          </a>
        </CardHeader>
        <CardContent>
          {formaciones.length === 0 ? (
            <p className="text-sm italic text-muted-foreground/70">
              No has registrado títulos académicos o certificaciones adicionales.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {formaciones.map((f) => (
                <div key={f.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {f.tipo === 'CERTIFICACION' ? 'Certificación' : f.tipo === 'CURSO' ? 'Curso' : 'Educación'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{f.fechaFin ?? f.fechaInicio ?? ''}</span>
                  </div>
                  <p className="mt-1.5 font-medium">{f.programa}</p>
                  <p className="text-xs text-muted-foreground">{f.institucion}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {avisos}
    </div>
  )
}
