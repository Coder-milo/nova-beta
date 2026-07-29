'use client'

import { useState } from 'react'
import {
  Check,
  CircleNotch,
  PencilSimple,
  User,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { ApiCallError, estudiantesApi } from '@/lib/api'
import type { EstudianteRequest, EstudianteResponse } from '@/lib/types'
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

export function StudentPerfil({ perfil, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<EditableFields>(buildEditableFields(perfil))

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
          : 'No se pudo guardar. Intenta de nuevo.',
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
                src={perfil.fotoUrl}
                alt={perfil.nombre}
                className="size-24 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-10" />
              </span>
            )}
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
                <span>Perfil completado</span>
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
            <CardTitle className="text-sm">Datos administrativos</CardTitle>
            <CardDescription className="text-xs">
              Solo el coordinador puede modificarlos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              [
                'Documento',
                `${perfil.tipoDocumento ?? ''} ${perfil.numeroDocumento ?? ''}`.trim() ||
                  'Sin registrar',
              ],
              ['Programa', perfil.programaNombre ?? 'Sin asignar'],
              ['Institución', perfil.institucionEducativa ?? 'Sin registrar'],
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
            <CardTitle>Información personal</CardTitle>
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
                  { label: 'Celular / WhatsApp', key: 'celular', type: 'tel', placeholder: '+57 300 000 0000' },
                  { label: 'Ciudad de residencia', key: 'ciudad', type: 'text', placeholder: 'Medellín' },
                  { label: 'Dirección', key: 'direccion', type: 'text', placeholder: 'Calle 00 # 00-00' },
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
                  <option value="">Selecciona…</option>
                  <option value="INMEDIATA">Inmediata</option>
                  <option value="15_DIAS">15 días</option>
                  <option value="30_DIAS">30 días</option>
                  <option value="60_DIAS">60 días</option>
                  <option value="NO_DISPONIBLE">No disponible</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Idiomas</label>
                <Input
                  placeholder="Español, Inglés B1, Portugués..."
                  value={form.idiomas}
                  onChange={(e) => setForm({ ...form, idiomas: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Cargo objetivo</label>
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
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Describe tu experiencia, habilidades y objetivos profesionales..."
                  value={form.perfilProfesional}
                  onChange={(e) => setForm({ ...form, perfilProfesional: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Enlace de LinkedIn</label>
                <Input
                  type="url"
                  placeholder="https://www.linkedin.com/in/tu-perfil"
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Este enlace permite abrir tu perfil desde tu plan de empleabilidad.</p>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Competencias</label>
                <textarea
                  className="min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
                ['Celular / WhatsApp', perfil.celular],
                ['Ciudad', perfil.ciudad],
                ['Dirección', perfil.direccion],
                ['Nivel de inglés', perfil.nivelIngles],
                ['Disponibilidad laboral', perfil.disponibilidadLaboral],
                ['Idiomas', perfil.idiomas],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {l}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {v ?? (
                      <span className="italic text-muted-foreground/60">Sin registrar</span>
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
                    <span className="italic text-muted-foreground/60">Sin registrar</span>
                  )}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Perfil profesional
                </p>
                <p className="mt-1 text-sm leading-6">
                  {perfil.perfilProfesional ?? (
                    <span className="italic text-muted-foreground/60">Sin registrar</span>
                  )}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfil de LinkedIn</p>
                {perfil.linkedinUrl ? <a href={perfil.linkedinUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-medium text-primary hover:underline">Abrir mi perfil de LinkedIn ↗</a> : <p className="mt-1 text-sm italic text-muted-foreground/60">Sin registrar</p>}
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
    </div>
  )
}
