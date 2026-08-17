'use client'

/**
 * Escanear una hoja de vida que el estudiante ya tenía hecha.
 *
 * <p>El portal solo dejaba llenar la hoja de vida campo por campo. Casi todo el
 * mundo llega con un PDF suyo, y volver a teclearlo entero es justo el motivo
 * por el que la mitad de las fichas se quedaban a medias y el PDF de la
 * plantilla CAC salía con secciones vacías.
 *
 * <p>El servidor lee el PDF y devuelve lo que encontró; aquí no se guarda nada
 * hasta que la persona marca qué se queda. La extracción se equivoca —fechas
 * sueltas, instituciones sin nombre—, así que lo que falta se puede completar
 * en la misma lista antes de aplicarlo.
 *
 * Consume:
 *   POST /api/v1/hojas-de-vida/mi-extraccion
 *   PUT  /api/v1/estudiantes/mi-perfil
 *   POST /api/v1/estudiantes/{id}/experiencias
 *   POST /api/v1/estudiantes/{id}/formaciones
 */

import { useRef, useState } from 'react'
import { Check, CircleAlert as WarningCircle, FileText as FilePdf, LoaderCircle as CircleNotch, Upload as UploadSimple, Wand2 as MagicWand, X } from 'lucide-react'
import { ApiCallError, estudiantesApi, hvApi, perfilApi } from '@/lib/api'
import type {
  DatosHvDto,
  EstudianteRequest,
  EstudianteResponse,
  ExperienciaRequest,
  ExtraccionResponse,
  FormacionRequest,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Aviso } from '@/components/ui/campo'
import { usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'

const TIPOS_ACEPTADOS = '.pdf,application/pdf'
/** El servidor acepta hasta 50 MB, pero una hoja de vida de más de 10 casi siempre es un escaneo sin texto. */
const MAXIMO_BYTES = 10 * 1024 * 1024

function textos(english: boolean) {
  return english
    ? {
        titulo: 'Scan a résumé you already have',
        descripcion:
          'Upload your current résumé as a PDF and we will read it for you. Nothing is saved until you choose what to keep.',
        elegirArchivo: 'Choose PDF',
        soltarAqui: 'Drop your PDF here, or',
        buscar: 'browse',
        soloPdf: 'PDF with selectable text. Scanned images cannot be read.',
        leyendo: 'Reading your résumé…',
        noSeLeyo: 'The file could not be read.',
        demasiadoGrande: 'The file is larger than 10 MB. Export it again as a text PDF.',
        soloPdfError: 'Only PDF files can be scanned.',
        sinDatos: 'We could not find any usable fields in that PDF. You can still fill the form below by hand.',
        revisa: 'Check what we found',
        revisaPie: 'Untick anything that is wrong. Ticked details replace what your profile has now.',
        datosPersonales: 'Profile details',
        experiencia: 'Work experience',
        educacion: 'Education and certificates',
        aplicar: 'Apply to my résumé',
        aplicando: 'Applying…',
        descartar: 'Discard',
        aplicado: 'Your résumé was updated. Refresh the preview to see it in the PDF.',
        nadaSeleccionado: 'Tick at least one detail to apply.',
        faltaEmpresa: 'Company',
        faltaCargo: 'Role',
        faltaInstitucion: 'Institution',
        completaAntes: 'Fill this in to be able to keep it.',
        actual: 'Current job',
        confianza: 'confidence',
        reemplaza: 'replaces what you have now',
        errorConexion: 'Could not reach the server.',
        parcial: (ok: number, fallidos: number) =>
          `${ok} details saved, ${fallidos} could not be saved.`,
        campos: {
          celular: 'Mobile', ciudad: 'City', nacionalidad: 'Country', telefono: 'Landline',
          cargoObjetivo: 'Target role', perfilProfesional: 'Professional summary',
          competencias: 'Skills', idiomas: 'Languages', titulo: 'Main qualification',
          institucionEducativa: 'Educational institution', nivelEducativo: 'Education level',
          linkedinUrl: 'LinkedIn',
        } as Record<string, string>,
      }
    : {
        titulo: 'Escanear una hoja de vida que ya tengas',
        descripcion:
          'Sube tu hoja de vida actual en PDF y la leemos por ti. No se guarda nada hasta que elijas qué te quedas.',
        elegirArchivo: 'Elegir PDF',
        soltarAqui: 'Suelta aquí tu PDF, o',
        buscar: 'búscalo',
        soloPdf: 'PDF con texto seleccionable. Las imágenes escaneadas no se pueden leer.',
        leyendo: 'Leyendo tu hoja de vida…',
        noSeLeyo: 'No se pudo leer el archivo.',
        demasiadoGrande: 'El archivo pesa más de 10 MB. Vuelve a exportarlo como PDF de texto.',
        soloPdfError: 'Solo se pueden escanear archivos PDF.',
        sinDatos: 'No encontramos campos aprovechables en ese PDF. Puedes llenar el formulario de abajo a mano.',
        revisa: 'Revisa lo que encontramos',
        revisaPie: 'Desmarca lo que esté mal. Lo marcado reemplaza lo que hoy tiene tu ficha.',
        datosPersonales: 'Datos de tu ficha',
        experiencia: 'Experiencia laboral',
        educacion: 'Educación y certificaciones',
        aplicar: 'Aplicar a mi hoja de vida',
        aplicando: 'Aplicando…',
        descartar: 'Descartar',
        aplicado: 'Tu hoja de vida quedó actualizada. Actualiza la vista previa para verla en el PDF.',
        nadaSeleccionado: 'Marca al menos un dato para aplicarlo.',
        faltaEmpresa: 'Empresa',
        faltaCargo: 'Cargo',
        faltaInstitucion: 'Institución',
        completaAntes: 'Complétalo para poder quedártelo.',
        actual: 'Empleo actual',
        confianza: 'de confianza',
        reemplaza: 'reemplaza lo que tienes ahora',
        errorConexion: 'No se pudo conectar con el servidor.',
        parcial: (ok: number, fallidos: number) =>
          `Se guardaron ${ok} datos y ${fallidos} no se pudieron guardar.`,
        campos: {
          celular: 'Celular', ciudad: 'Ciudad', nacionalidad: 'País', telefono: 'Teléfono fijo',
          cargoObjetivo: 'Cargo objetivo', perfilProfesional: 'Perfil profesional',
          competencias: 'Habilidades', idiomas: 'Idiomas', titulo: 'Título principal',
          institucionEducativa: 'Institución educativa', nivelEducativo: 'Nivel educativo',
          linkedinUrl: 'LinkedIn',
        } as Record<string, string>,
      }
}

/** Los campos simples de la ficha que se pueden rellenar desde el PDF. */
const CAMPOS_APLICABLES = [
  'celular', 'telefono', 'ciudad', 'nacionalidad', 'cargoObjetivo', 'perfilProfesional',
  'competencias', 'idiomas', 'titulo', 'institucionEducativa', 'nivelEducativo', 'linkedinUrl',
] as const

type CampoAplicable = (typeof CAMPOS_APLICABLES)[number]

/** @param respaldo texto para cuando el error no trae mensaje propio. */
function mensajeDe(error: unknown, respaldo: string): string {
  if (error instanceof ApiCallError) {
    return error.body.message ?? `Error del servidor (HTTP ${error.status}).`
  }
  return error instanceof Error ? error.message : respaldo
}

/**
 * Deja la fecha como la quiere el servidor, o la descarta.
 *
 * `LocalDate` solo entiende `aaaa-mm-dd`. La extracción devuelve lo que había
 * escrito en el PDF: muchas veces solo el año, o el año y el mes. Mandarlo tal
 * cual devolvía un 400 sin explicación y se perdía el empleo entero por culpa
 * de la fecha, así que se completa al primer día y lo que no encaje se va.
 */
function aFechaIso(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined
  const texto = valor.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  if (/^\d{4}-\d{2}$/.test(texto)) return `${texto}-01`
  if (/^\d{4}$/.test(texto)) return `${texto}-01-01`
  return undefined
}

/** El enlace de LinkedIn a partir de lo que devuelve la extracción, que es el usuario. */
function linkedinDesde(datos: DatosHvDto): string | undefined {
  const bruto = datos.linkedinUrl?.trim() || datos.linkedinUserId?.trim()
  if (!bruto) return undefined
  if (/^https?:\/\//i.test(bruto)) return bruto
  return `https://www.linkedin.com/in/${bruto.replace(/^\/+/, '')}`
}

interface Props {
  perfil: EstudianteResponse
  onUpdate: (perfil: EstudianteResponse) => void
  /** Para que las listas de experiencia y formación se vuelvan a pedir. */
  onAplicado: () => void
}

export function StudentEscaneoHv({ perfil, onUpdate, onAplicado }: Props) {
  const T = textos(usePreferences().locale === 'en')
  const inputRef = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [sobreZona, setSobreZona] = useState(false)

  const [extraccion, setExtraccion] = useState<ExtraccionResponse | null>(null)
  const [camposMarcados, setCamposMarcados] = useState<Record<string, boolean>>({})
  const [valoresCampos, setValoresCampos] = useState<Partial<Record<CampoAplicable, string>>>({})
  const [experiencias, setExperiencias] = useState<ExperienciaRequest[]>([])
  const [expMarcadas, setExpMarcadas] = useState<boolean[]>([])
  const [formaciones, setFormaciones] = useState<FormacionRequest[]>([])
  const [formMarcadas, setFormMarcadas] = useState<boolean[]>([])

  const confianzaDe = (campo: string) =>
    extraccion?.campos.find((c) => c.campo === campo)?.confianza

  const limpiar = () => {
    setExtraccion(null)
    setArchivo(null)
    setCamposMarcados({})
    setValoresCampos({})
    setExperiencias([])
    setExpMarcadas([])
    setFormaciones([])
    setFormMarcadas([])
    setError(null)
    setOk(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const escanear = async (elegido: File) => {
    setError(null)
    setOk(null)
    if (!/\.pdf$/i.test(elegido.name) && elegido.type !== 'application/pdf') {
      setError(T.soloPdfError)
      return
    }
    if (elegido.size > MAXIMO_BYTES) {
      setError(T.demasiadoGrande)
      return
    }
    setArchivo(elegido)
    setLeyendo(true)
    try {
      const respuesta = await hvApi.extraerMia(elegido)
      setExtraccion(respuesta)

      const datos = respuesta.datosEstructurados
      const valores: Partial<Record<CampoAplicable, string>> = {}
      const marcados: Record<string, boolean> = {}
      if (datos) {
        for (const campo of CAMPOS_APLICABLES) {
          const valor = campo === 'linkedinUrl'
            ? linkedinDesde(datos)
            : (datos[campo as keyof DatosHvDto] as string | null | undefined)?.trim() || undefined
          if (valor) {
            valores[campo] = valor
            marcados[campo] = true
          }
        }
      }
      setValoresCampos(valores)
      setCamposMarcados(marcados)

      const exps: ExperienciaRequest[] = (datos?.experiencias ?? []).map((e) => ({
        empresa: e.empresa?.trim() ?? '',
        cargo: e.cargo?.trim() ?? '',
        ciudad: e.ciudad?.trim() || undefined,
        fechaInicio: aFechaIso(e.fechaInicio),
        fechaFin: e.actual ? undefined : aFechaIso(e.fechaFin),
        actual: Boolean(e.actual),
        relacionada: Boolean(e.relacionada),
        funciones: e.funciones?.trim() || undefined,
      }))
      setExperiencias(exps)
      setExpMarcadas(exps.map(() => true))

      const forms: FormacionRequest[] = (datos?.formaciones ?? []).map((f) => ({
        tipo: ['EDUCACION', 'CURSO', 'CERTIFICACION'].includes((f.tipo ?? '').toUpperCase())
          ? (f.tipo ?? '').toUpperCase()
          : 'CURSO',
        institucion: f.institucion?.trim() ?? '',
        programa: f.programa?.trim() ?? '',
        fechaFin: aFechaIso(f.fechaFin),
      }))
      setFormaciones(forms)
      setFormMarcadas(forms.map(() => true))
    } catch (e) {
      setExtraccion(null)
      setError(mensajeDe(e, T.noSeLeyo))
    } finally {
      setLeyendo(false)
    }
  }

  const camposSeleccionados = CAMPOS_APLICABLES.filter((c) => camposMarcados[c] && valoresCampos[c]?.trim())
  const expSeleccionadas = experiencias.filter((e, i) => expMarcadas[i] && e.empresa.trim() && e.cargo.trim())
  const formSeleccionadas = formaciones.filter((f, i) => formMarcadas[i] && f.institucion.trim() && f.programa.trim())
  const totalSeleccionado = camposSeleccionados.length + expSeleccionadas.length + formSeleccionadas.length

  /**
   * Guarda lo marcado.
   *
   * Cada experiencia y cada formación va por su lado a propósito: si una falla
   * —una fecha rara, un texto demasiado largo—, las demás ya están guardadas y
   * se dice cuántas quedaron fuera, en vez de perderlo todo por una.
   */
  const aplicar = async () => {
    if (totalSeleccionado === 0) {
      setError(T.nadaSeleccionado)
      return
    }
    setAplicando(true)
    setError(null)
    setOk(null)
    let fallidos = 0
    let guardados = 0

    try {
      if (camposSeleccionados.length > 0) {
        const cuerpo: EstudianteRequest = {
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          email: perfil.email,
          programaId: perfil.programaId,
          ...Object.fromEntries(camposSeleccionados.map((c) => [c, valoresCampos[c]?.trim()])),
        } as EstudianteRequest
        const actualizado = await estudiantesApi.actualizarMiPerfil(cuerpo)
        onUpdate(actualizado)
        guardados += camposSeleccionados.length
      }

      for (const experiencia of expSeleccionadas) {
        try {
          await perfilApi.crearExperiencia(perfil.id, experiencia)
          guardados += 1
        } catch {
          fallidos += 1
        }
      }

      for (const formacion of formSeleccionadas) {
        try {
          await perfilApi.crearFormacion(perfil.id, formacion)
          guardados += 1
        } catch {
          fallidos += 1
        }
      }

      onAplicado()
      if (fallidos > 0) {
        setError(T.parcial(guardados, fallidos))
      } else {
        setOk(T.aplicado)
      }
      setExtraccion(null)
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(mensajeDe(e, T.errorConexion))
    } finally {
      setAplicando(false)
    }
  }

  const sinNada =
    extraccion !== null &&
    Object.keys(valoresCampos).length === 0 &&
    experiencias.length === 0 &&
    formaciones.length === 0

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MagicWand className="size-5 text-primary" />
          {T.titulo}
        </CardTitle>
        <CardDescription>{T.descripcion}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}

        {!extraccion && (
          <div
            onDragOver={(e) => { e.preventDefault(); setSobreZona(true) }}
            onDragLeave={() => setSobreZona(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSobreZona(false)
              const soltado = e.dataTransfer.files?.[0]
              if (soltado) void escanear(soltado)
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors',
              sobreZona ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={TIPOS_ACEPTADOS}
              className="hidden"
              onChange={(e) => {
                const elegido = e.target.files?.[0]
                if (elegido) void escanear(elegido)
              }}
            />
            {leyendo ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleNotch className="size-4 animate-spin text-primary" />
                {T.leyendo}
              </p>
            ) : (
              <>
                <UploadSimple className="size-7 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {T.soltarAqui}{' '}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="font-semibold text-primary hover:underline"
                  >
                    {T.buscar}
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">{T.soloPdf}</p>
                <Button variant="outline" size="sm" className="mt-1" onClick={() => inputRef.current?.click()}>
                  <FilePdf className="size-4" /> {T.elegirArchivo}
                </Button>
              </>
            )}
          </div>
        )}

        {sinNada && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <WarningCircle className="mt-0.5 size-4 shrink-0" />
            {T.sinDatos}
          </p>
        )}

        {extraccion && !sinNada && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{T.revisa}</p>
                <p className="text-xs text-muted-foreground">{T.revisaPie}</p>
              </div>
              {archivo && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground">
                  <FilePdf className="size-3.5" /> {archivo.name}
                </span>
              )}
            </div>

            {/* ── Campos simples de la ficha ─────────────────────────────── */}
            {Object.keys(valoresCampos).length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {T.datosPersonales}
                </h4>
                <ul className="space-y-1.5">
                  {CAMPOS_APLICABLES.filter((c) => valoresCampos[c]).map((campo) => {
                    const confianza = confianzaDe(campo)
                    const yaTiene = Boolean(
                      (perfil[campo as keyof EstudianteResponse] as string | null | undefined)?.toString().trim(),
                    )
                    return (
                      <li key={campo} className="rounded-xl border border-border p-3">
                        <label className="flex items-start gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 rounded border-border"
                            checked={Boolean(camposMarcados[campo])}
                            onChange={(e) =>
                              setCamposMarcados((previos) => ({ ...previos, [campo]: e.target.checked }))
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{T.campos[campo] ?? campo}</span>
                              {confianza != null && (
                                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {confianza}% {T.confianza}
                                </span>
                              )}
                              {yaTiene && (
                                <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                  {T.reemplaza}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block whitespace-pre-line break-words text-xs text-muted-foreground">
                              {valoresCampos[campo]}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* ── Experiencia ─────────────────────────────────────────────── */}
            {experiencias.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {T.experiencia}
                </h4>
                <ul className="space-y-1.5">
                  {experiencias.map((experiencia, indice) => {
                    const faltaAlgo = !experiencia.empresa.trim() || !experiencia.cargo.trim()
                    return (
                      <li key={indice} className="rounded-xl border border-border p-3">
                        <label className="flex items-start gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 rounded border-border"
                            checked={Boolean(expMarcadas[indice]) && !faltaAlgo}
                            disabled={faltaAlgo}
                            onChange={(e) =>
                              setExpMarcadas((previas) =>
                                previas.map((v, i) => (i === indice ? e.target.checked : v)),
                              )
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">
                              {experiencia.cargo || '—'}
                              {experiencia.empresa ? ` · ${experiencia.empresa}` : ''}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {experiencia.fechaInicio ?? ''}
                              {experiencia.actual
                                ? ` — ${T.actual}`
                                : experiencia.fechaFin
                                  ? ` — ${experiencia.fechaFin}`
                                  : ''}
                            </span>
                            {experiencia.funciones && (
                              <span className="mt-1 block whitespace-pre-line break-words text-xs text-muted-foreground">
                                {experiencia.funciones}
                              </span>
                            )}
                          </span>
                        </label>

                        {faltaAlgo && (
                          <div className="mt-2 space-y-2 rounded-lg bg-secondary/40 p-2">
                            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <WarningCircle className="size-3.5 shrink-0" />
                              {T.completaAntes}
                            </p>
                            {!experiencia.cargo.trim() && (
                              <Input
                                placeholder={T.faltaCargo}
                                value={experiencia.cargo}
                                onChange={(e) =>
                                  setExperiencias((previas) =>
                                    previas.map((x, i) => (i === indice ? { ...x, cargo: e.target.value } : x)),
                                  )
                                }
                              />
                            )}
                            {!experiencia.empresa.trim() && (
                              <Input
                                placeholder={T.faltaEmpresa}
                                value={experiencia.empresa}
                                onChange={(e) =>
                                  setExperiencias((previas) =>
                                    previas.map((x, i) => (i === indice ? { ...x, empresa: e.target.value } : x)),
                                  )
                                }
                              />
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* ── Educación ───────────────────────────────────────────────── */}
            {formaciones.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {T.educacion}
                </h4>
                <ul className="space-y-1.5">
                  {formaciones.map((formacion, indice) => {
                    const faltaAlgo = !formacion.institucion.trim() || !formacion.programa.trim()
                    return (
                      <li key={indice} className="rounded-xl border border-border p-3">
                        <label className="flex items-start gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 rounded border-border"
                            checked={Boolean(formMarcadas[indice]) && !faltaAlgo}
                            disabled={faltaAlgo}
                            onChange={(e) =>
                              setFormMarcadas((previas) =>
                                previas.map((v, i) => (i === indice ? e.target.checked : v)),
                              )
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{formacion.programa || '—'}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formacion.institucion}
                              {formacion.fechaFin ? ` · ${formacion.fechaFin.slice(0, 4)}` : ''}
                            </span>
                          </span>
                        </label>

                        {faltaAlgo && (
                          <div className="mt-2 space-y-2 rounded-lg bg-secondary/40 p-2">
                            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <WarningCircle className="size-3.5 shrink-0" />
                              {T.completaAntes}
                            </p>
                            {!formacion.programa.trim() && (
                              <Input
                                placeholder={T.educacion}
                                value={formacion.programa}
                                onChange={(e) =>
                                  setFormaciones((previas) =>
                                    previas.map((x, i) => (i === indice ? { ...x, programa: e.target.value } : x)),
                                  )
                                }
                              />
                            )}
                            {!formacion.institucion.trim() && (
                              <Input
                                placeholder={T.faltaInstitucion}
                                value={formacion.institucion}
                                onChange={(e) =>
                                  setFormaciones((previas) =>
                                    previas.map((x, i) => (i === indice ? { ...x, institucion: e.target.value } : x)),
                                  )
                                }
                              />
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={limpiar} disabled={aplicando}>
                <X className="size-4" /> {T.descartar}
              </Button>
              <Button onClick={aplicar} disabled={aplicando || totalSeleccionado === 0}>
                {aplicando ? <CircleNotch className="size-4 animate-spin" /> : <Check className="size-4" />}
                {aplicando ? T.aplicando : `${T.aplicar} (${totalSeleccionado})`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
