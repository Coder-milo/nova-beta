'use client'

/**
 * Hoja de vida del estudiante: los datos completos y su previsualización.
 *
 * <p>Antes esta pantalla solo resumía cuatro campos del perfil y ofrecía un
 * botón de descarga. Todo lo que da cuerpo a una hoja de vida —experiencia,
 * educación, certificaciones, habilidades— vivía en endpoints que únicamente
 * podía tocar un coordinador, así que el PDF salía con la mitad de las
 * secciones vacías. Aquí el estudiante mantiene su propia información y ve el
 * resultado antes de descargarlo.
 *
 * Consume:
 *   GET  /api/v1/estudiantes/mi-perfil
 *   PUT  /api/v1/estudiantes/mi-perfil
 *   GET  /api/v1/estudiantes/mi-perfil/hv-vista-previa
 *   GET  /api/v1/estudiantes/mi-perfil/hv-pdf
 *   CRUD /api/v1/estudiantes/{id}/experiencias
 *   CRUD /api/v1/estudiantes/{id}/formaciones
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Check,
  CircleNotch,
  GraduationCap,
  Plus,
  Trash,
  User,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { ApiCallError, estudiantesApi, perfilApi } from '@/lib/api'
import type {
  EstudianteRequest,
  EstudianteResponse,
  ExperienciaRequest,
  ExperienciaResponse,
  FormacionRequest,
  FormacionResponse,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Campo, Selector, Aviso } from '@/components/ui/campo'
import { VistaPreviaPdf } from '@/components/ui/vista-previa-pdf'

/** Tipos de formación que entiende el generador de la plantilla CAC. */
const TIPOS_FORMACION = [
  { valor: 'EDUCACION', etiqueta: 'Educación formal' },
  { valor: 'CURSO', etiqueta: 'Curso' },
  { valor: 'CERTIFICACION', etiqueta: 'Certificación' },
] as const

const DISPONIBILIDAD = [
  { valor: 'INMEDIATA', etiqueta: 'Inmediata' },
  { valor: '15_DIAS', etiqueta: '15 días' },
  { valor: '30_DIAS', etiqueta: '30 días' },
  { valor: '60_DIAS', etiqueta: '60 días' },
  { valor: 'NO_DISPONIBLE', etiqueta: 'No disponible' },
] as const

function mensajeDe(error: unknown): string {
  if (error instanceof ApiCallError) {
    return error.body.message ?? `Error del servidor (HTTP ${error.status}).`
  }
  return error instanceof Error ? error.message : 'No se pudo conectar con el servidor.'
}

// ── Datos personales y profesionales ────────────────────────────────────────

type CamposHv = {
  celular: string
  ciudad: string
  nacionalidad: string
  direccion: string
  cargoObjetivo: string
  perfilProfesional: string
  competencias: string
  idiomas: string
  disponibilidadLaboral: string
  linkedinUrl: string
  carpetaUrl: string
  titulo: string
  institucionEducativa: string
  nivelEducativo: string
}

function camposDe(p: EstudianteResponse): CamposHv {
  return {
    celular: p.celular ?? '',
    ciudad: p.ciudad ?? '',
    nacionalidad: p.nacionalidad ?? '',
    direccion: p.direccion ?? '',
    cargoObjetivo: p.cargoObjetivo ?? '',
    perfilProfesional: p.perfilProfesional ?? '',
    competencias: p.competencias ?? '',
    idiomas: p.idiomas ?? '',
    disponibilidadLaboral: p.disponibilidadLaboral ?? '',
    linkedinUrl: p.linkedinUrl ?? '',
    carpetaUrl: p.carpetaUrl ?? '',
    titulo: p.titulo ?? '',
    institucionEducativa: p.institucionEducativa ?? '',
    nivelEducativo: p.nivelEducativo ?? '',
  }
}

function DatosHv({
  perfil,
  onUpdate,
  onGuardado,
}: {
  perfil: EstudianteResponse
  onUpdate: (p: EstudianteResponse) => void
  onGuardado: () => void
}) {
  const [form, setForm] = useState<CamposHv>(() => camposDe(perfil))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const cambiar = (clave: keyof CamposHv, valor: string) => {
    setForm((actual) => ({ ...actual, [clave]: valor }))
    setOk(false)
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setOk(false)
    try {
      // Los campos nulos no se tocan en el backend, así que se mandan como
      // `undefined` cuando están vacíos y no se borra lo que haya puesto el
      // coordinador desde su lado.
      const body: EstudianteRequest = {
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        email: perfil.email,
        programaId: perfil.programaId,
        ...Object.fromEntries(
          Object.entries(form).map(([clave, valor]) => [clave, valor.trim() || undefined]),
        ),
      } as EstudianteRequest
      const actualizado = await estudiantesApi.actualizarMiPerfil(body)
      onUpdate(actualizado)
      setForm(camposDe(actualizado))
      setOk(true)
      onGuardado()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5 text-primary" weight="duotone" />
          Datos de tu hoja de vida
        </CardTitle>
        <CardDescription>
          Esto es lo que aparece en la cabecera y en el perfil profesional del PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Celular / WhatsApp" ayuda="Sale en la línea de contacto.">
            <Input
              type="tel"
              placeholder="+57 300 000 0000"
              value={form.celular}
              onChange={(e) => cambiar('celular', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Ciudad de residencia">
            <Input
              placeholder="Barranquilla"
              value={form.ciudad}
              onChange={(e) => cambiar('ciudad', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="País" ayuda="Si lo dejas vacío solo se imprime la ciudad.">
            <Input
              placeholder="Colombia"
              value={form.nacionalidad}
              onChange={(e) => cambiar('nacionalidad', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Disponibilidad laboral">
            <Selector
              value={form.disponibilidadLaboral}
              onChange={(valor) => cambiar('disponibilidadLaboral', valor)}
              opciones={DISPONIBILIDAD}
              vacio="Selecciona…"
            />
          </Campo>

          <Campo etiqueta="Enlace de LinkedIn" ancho>
            <Input
              type="url"
              placeholder="https://www.linkedin.com/in/tu-perfil"
              value={form.linkedinUrl}
              onChange={(e) => cambiar('linkedinUrl', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta="Portafolio o carpeta de trabajos"
            ancho
            ayuda="Opcional. Aparece como «Portafolio» junto a tus datos de contacto."
          >
            <Input
              type="url"
              placeholder="https://…"
              value={form.carpetaUrl}
              onChange={(e) => cambiar('carpetaUrl', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Cargo objetivo" ancho requerido ayuda="Es el titular que se lee bajo tu nombre.">
            <Input
              placeholder="Analista de datos"
              value={form.cargoObjetivo}
              onChange={(e) => cambiar('cargoObjetivo', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta="Perfil profesional"
            ancho
            requerido
            ayuda="Tres o cuatro líneas: qué sabes hacer y qué buscas."
          >
            <Textarea
              minRows={4}
              placeholder="Describe tu experiencia, tus fortalezas y tu objetivo profesional…"
              value={form.perfilProfesional}
              onChange={(e) => cambiar('perfilProfesional', e.target.value)}
            />
          </Campo>

          <Campo
            etiqueta="Habilidades y competencias"
            ancho
            ayuda="Una por línea, o separadas por comas. Puedes agrupar con «Ofimática: Excel, Word»."
          >
            <Textarea
              minRows={3}
              placeholder={'Excel avanzado\nAtención al cliente\nIdiomas: inglés B2'}
              value={form.competencias}
              onChange={(e) => cambiar('competencias', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Idiomas" ancho ayuda="Tu nivel de inglés registrado se añade solo si no lo mencionas aquí.">
            <Input
              placeholder="Español nativo, Inglés B2"
              value={form.idiomas}
              onChange={(e) => cambiar('idiomas', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Título académico principal">
            <Input
              placeholder="Técnico en Sistemas"
              value={form.titulo}
              onChange={(e) => cambiar('titulo', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Institución educativa">
            <Input
              placeholder="SENA"
              value={form.institucionEducativa}
              onChange={(e) => cambiar('institucionEducativa', e.target.value)}
            />
          </Campo>

          <Campo etiqueta="Nivel educativo" ancho>
            <Input
              placeholder="Técnico, Tecnólogo, Profesional…"
              value={form.nivelEducativo}
              onChange={(e) => cambiar('nivelEducativo', e.target.value)}
            />
          </Campo>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">Datos guardados. Actualiza la vista previa para verlos en el PDF.</Aviso>}

        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
            {guardando ? 'Guardando…' : 'Guardar datos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Experiencia laboral ─────────────────────────────────────────────────────

const EXPERIENCIA_VACIA: ExperienciaRequest = {
  empresa: '',
  cargo: '',
  fechaInicio: '',
  fechaFin: '',
  funciones: '',
  actual: false,
  relacionada: false,
}

function Experiencias({
  estudianteId,
  onCambio,
}: {
  estudianteId: string
  onCambio: () => void
}) {
  const [items, setItems] = useState<ExperienciaResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<ExperienciaRequest>(EXPERIENCIA_VACIA)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setItems(await perfilApi.experiencias(estudianteId))
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [estudianteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const cerrar = () => {
    setForm(EXPERIENCIA_VACIA)
    setEditandoId(null)
    setAbierto(false)
    setError(null)
  }

  const editar = (item: ExperienciaResponse) => {
    setForm({
      empresa: item.empresa,
      cargo: item.cargo,
      fechaInicio: item.fechaInicio ?? '',
      fechaFin: item.fechaFin ?? '',
      funciones: item.funciones ?? '',
      actual: item.actual,
      relacionada: item.relacionada,
    })
    setEditandoId(item.id)
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.empresa.trim() || !form.cargo.trim()) {
      setError('La empresa y el cargo son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const body: ExperienciaRequest = {
        ...form,
        empresa: form.empresa.trim(),
        cargo: form.cargo.trim(),
        fechaInicio: form.fechaInicio || undefined,
        // Un empleo actual no lleva fecha de fin: si el estudiante marca la
        // casilla después de haberla escrito, mandarla haría que el PDF
        // imprimiera un rango cerrado y «Presente» a la vez.
        fechaFin: form.actual ? undefined : form.fechaFin || undefined,
        funciones: form.funciones?.trim() || undefined,
      }
      if (editandoId) await perfilApi.actualizarExperiencia(estudianteId, editandoId, body)
      else await perfilApi.crearExperiencia(estudianteId, body)
      cerrar()
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    setError(null)
    try {
      await perfilApi.eliminarExperiencia(estudianteId, id)
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5 text-primary" weight="duotone" />
            Experiencia laboral
          </CardTitle>
          <CardDescription>
            Empieza por el empleo más reciente. Cada línea de funciones sale como una viñeta.
          </CardDescription>
        </div>
        {!abierto && (
          <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
            <Plus className="size-4" /> Añadir
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {abierto && (
          <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:grid-cols-2">
            <Campo etiqueta="Empresa" requerido>
              <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </Campo>
            <Campo etiqueta="Cargo" requerido>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </Campo>
            <Campo etiqueta="Fecha de inicio">
              <Input
                type="date"
                value={form.fechaInicio ?? ''}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Fecha de fin" ayuda={form.actual ? 'No aplica: es tu empleo actual.' : undefined}>
              <Input
                type="date"
                disabled={form.actual}
                value={form.actual ? '' : (form.fechaFin ?? '')}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.actual ?? false}
                onChange={(e) => setForm({ ...form, actual: e.target.checked })}
              />
              Sigo trabajando aquí
            </label>
            <Campo
              etiqueta="Funciones y logros"
              ancho
              ayuda="Una por línea. Empieza con un verbo: «Atendí…», «Coordiné…»."
            >
              <Textarea
                minRows={4}
                value={form.funciones ?? ''}
                onChange={(e) => setForm({ ...form, funciones: e.target.value })}
                placeholder={'Atendí en promedio 60 clientes diarios\nCapacité a 4 personas nuevas del equipo'}
              />
            </Campo>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={cerrar} disabled={guardando}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editandoId ? 'Guardar cambios' : 'Añadir experiencia'}
              </Button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Todavía no has registrado experiencia. Si nunca has trabajado, puedes dejarlo vacío:
            la sección no aparecerá en el PDF.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.cargo}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.empresa}
                      {item.fechaInicio ? ` · ${item.fechaInicio}` : ''}
                      {item.actual ? ' — Presente' : item.fechaFin ? ` — ${item.fechaFin}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => editar(item)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => eliminar(item.id)}>
                      <Trash className="size-4 text-destructive" />
                      <span className="sr-only">Eliminar {item.cargo}</span>
                    </Button>
                  </div>
                </div>
                {item.funciones && (
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{item.funciones}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Educación y certificaciones ─────────────────────────────────────────────

const FORMACION_VACIA: FormacionRequest = {
  tipo: 'CURSO',
  institucion: '',
  programa: '',
  fechaInicio: '',
  fechaFin: '',
  estado: '',
}

function Formaciones({
  estudianteId,
  onCambio,
}: {
  estudianteId: string
  onCambio: () => void
}) {
  const [items, setItems] = useState<FormacionResponse[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<FormacionRequest>(FORMACION_VACIA)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setItems(await perfilApi.formaciones(estudianteId))
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [estudianteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const cerrar = () => {
    setForm(FORMACION_VACIA)
    setEditandoId(null)
    setAbierto(false)
    setError(null)
  }

  const editar = (item: FormacionResponse) => {
    setForm({
      tipo: item.tipo,
      institucion: item.institucion,
      programa: item.programa,
      fechaInicio: item.fechaInicio ?? '',
      fechaFin: item.fechaFin ?? '',
      estado: item.estado ?? '',
    })
    setEditandoId(item.id)
    setAbierto(true)
  }

  const guardar = async () => {
    if (!form.institucion.trim() || !form.programa.trim()) {
      setError('La institución y el programa son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const body: FormacionRequest = {
        ...form,
        institucion: form.institucion.trim(),
        programa: form.programa.trim(),
        fechaInicio: form.fechaInicio || undefined,
        fechaFin: form.fechaFin || undefined,
        estado: form.estado?.trim() || undefined,
      }
      if (editandoId) await perfilApi.actualizarFormacion(estudianteId, editandoId, body)
      else await perfilApi.crearFormacion(estudianteId, body)
      cerrar()
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: string) => {
    setError(null)
    try {
      await perfilApi.eliminarFormacion(estudianteId, id)
      await recargar()
      onCambio()
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" weight="duotone" />
            Educación y certificaciones
          </CardTitle>
          <CardDescription>
            Lo marcado como curso o certificación va a su propia sección del PDF; el resto
            aparece bajo «Educación».
          </CardDescription>
        </div>
        {!abierto && (
          <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
            <Plus className="size-4" /> Añadir
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {abierto && (
          <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 sm:grid-cols-2">
            <Campo etiqueta="Tipo" requerido>
              <Selector
                value={form.tipo}
                onChange={(valor) => setForm({ ...form, tipo: valor })}
                opciones={TIPOS_FORMACION}
              />
            </Campo>
            <Campo etiqueta="Institución" requerido>
              <Input
                value={form.institucion}
                onChange={(e) => setForm({ ...form, institucion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Programa o nombre del curso" ancho requerido>
              <Input value={form.programa} onChange={(e) => setForm({ ...form, programa: e.target.value })} />
            </Campo>
            <Campo etiqueta="Fecha de inicio">
              <Input
                type="date"
                value={form.fechaInicio ?? ''}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Fecha de finalización" ayuda="De aquí sale el año que se imprime.">
              <Input
                type="date"
                value={form.fechaFin ?? ''}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
              />
            </Campo>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={cerrar} disabled={guardando}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                {guardando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editandoId ? 'Guardar cambios' : 'Añadir formación'}
              </Button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Añade aquí los cursos y certificaciones que hayas hecho, dentro o fuera del programa.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.programa}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.institucion}
                    {item.fechaFin ? ` · ${item.fechaFin.slice(0, 4)}` : ''}
                    {` · ${TIPOS_FORMACION.find((t) => t.valor === item.tipo)?.etiqueta ?? item.tipo}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editar(item)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => eliminar(item.id)}>
                    <Trash className="size-4 text-destructive" />
                    <span className="sr-only">Eliminar {item.programa}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export function StudentHojaDeVida({
  perfil,
  onUpdate,
}: {
  perfil: EstudianteResponse
  onUpdate: (p: EstudianteResponse) => void
}) {
  // Cada guardado incrementa el contador y con él cambia la identidad de
  // `cargar`, que es lo que hace que el visor vuelva a pedir el PDF. Sin esta
  // dependencia el estudiante guardaba y seguía viendo la versión anterior.
  const [revision, setRevision] = useState(0)
  const [idioma, setIdioma] = useState<'es' | 'en'>('es')

  const cargar = useCallback(
    () => estudiantesApi.vistaPreviaMiHv(idioma),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idioma, revision],
  )

  const descargar = () =>
    estudiantesApi.descargarMiHvPdf(
      `HV-${perfil.nombre}-${perfil.apellido}.pdf`.replace(/[^\w.\-]/g, '_'),
    )

  const faltan = !perfil.cargoObjetivo || !perfil.perfilProfesional

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-5">
        {faltan && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <WarningCircle className="size-4 shrink-0" />
            Completa el cargo objetivo y el perfil profesional: son lo primero que lee un reclutador.
          </p>
        )}
        <DatosHv perfil={perfil} onUpdate={onUpdate} onGuardado={() => setRevision((n) => n + 1)} />
        <Experiencias estudianteId={perfil.id} onCambio={() => setRevision((n) => n + 1)} />
        <Formaciones estudianteId={perfil.id} onCambio={() => setRevision((n) => n + 1)} />
      </div>

      <Card className="h-fit shadow-none xl:sticky xl:top-24">
        <CardHeader>
          <CardTitle>Cómo va a quedar</CardTitle>
          <CardDescription>
            Así se verá tu hoja de vida con la información que tienes guardada ahora mismo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(
              [
                ['es', 'Español'],
                ['en', 'English'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setIdioma(valor)}
                aria-pressed={idioma === valor}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  idioma === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <VistaPreviaPdf
            cargar={cargar}
            onDescargar={descargar}
            titulo="Vista previa de tu hoja de vida"
            descripcion="Descargar guarda una versión nueva en tu historial."
            altura="34rem"
          />
        </CardContent>
      </Card>
    </div>
  )
}
