'use client'

/**
 * Identidad visual de cada proyecto.
 *
 * Tres decisiones que explican cómo está montado:
 *
 * 1. Se pide **un** color y de él sale toda la gama (`paletaDesde`). Pedir diez
 *    produce combinaciones que no funcionan: casi nadie elige a mano un hover
 *    que contraste ni un color de texto legible sobre el primario.
 *
 * 2. Las medidas de cada imagen las manda el servidor (`medidasExigidas`), no
 *    están escritas aquí. Tenerlas en dos sitios es tenerlas distintas.
 *
 * 3. La imagen se mide **en el navegador antes de guardar**. Descubrir que el
 *    banner medía 800x300 cuando el correo ya salió a los 108 estudiantes no
 *    tiene arreglo.
 *
 * Requiere ADMIN o COORDINADOR.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  FloppyDisk,
  Image as ImageIcon,
  Palette,
  Upload,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { brandingApi, programasApi, ApiCallError } from '@/lib/api'
import { paletaDesde, textoSobre } from '@/lib/paleta'
import { useBranding, guardarProyectoActivo } from '@/lib/branding'
import type { BrandingResponse, MedidaExigida, ProgramaResponse } from '@/lib/types'

/** Colores de arranque. Ahorran abrir el selector para lo más habitual. */
const SUGERENCIAS = [
  { hex: '#1268E8', nombre: 'Azul del panel' },
  { hex: '#E8621C', nombre: 'Naranja' },
  { hex: '#0F7B5A', nombre: 'Verde' },
  { hex: '#7C3AED', nombre: 'Morado' },
  { hex: '#C81E5B', nombre: 'Magenta' },
]

function errorDe(err: unknown): string {
  if (err instanceof ApiCallError) {
    if (err.status === 401 || err.status === 403) {
      return 'Sin permisos. Solo ADMIN o COORDINADOR pueden editar la identidad de un proyecto.'
    }
    const msg = err.body?.message ?? (typeof err.body === 'string' ? err.body : null)
    return msg ?? `Error del servidor (HTTP ${err.status}).`
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return 'No se pudo guardar la identidad. Comprueba la conexión o la imagen cargada.'
}

/** Lee el tamaño real del archivo. Es lo que se compara con lo exigido. */
function medirImagen(url: string): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight })
    // No se puede medir: puede ser una URL que aún no es pública o de otro
    // dominio sin CORS. No es motivo para impedir guardar.
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Adapta y optimiza automáticamente una imagen local a las dimensiones exactas
 * exigidas por el servidor (retina 2x). Evita que archivos pesados o de tamaño
 * no estandarizado fallen la validación de Spring o la transmisión HTTP.
 */
function optimizarAdaptarImagen(
  file: File,
  anchoExigido: number,
  altoExigido: number,
  onListo: (dataUrl: string) => void,
) {
  const reader = new FileReader()
  reader.onload = (evt) => {
    const rawUrl = evt.target?.result as string
    if (!rawUrl) return

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = anchoExigido
      canvas.height = altoExigido

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, anchoExigido, altoExigido)

        const ratioScale = Math.max(anchoExigido / img.naturalWidth, altoExigido / img.naturalHeight)
        const drawW = img.naturalWidth * ratioScale
        const drawH = img.naturalHeight * ratioScale
        const offsetX = (anchoExigido - drawW) / 2
        const offsetY = (altoExigido - drawH) / 2

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
        const dataUrl = canvas.toDataURL('image/png', 0.9)
        onListo(dataUrl)
      } else {
        onListo(rawUrl)
      }
    }
    img.onerror = () => onListo(rawUrl)
    img.src = rawUrl
  }
  reader.readAsDataURL(file)
}

interface EstadoImagen {
  url: string
  ancho: number | null
  alto: number | null
  /** Motivo del rechazo tras medirla, o null. */
  problema: string | null
  midiendo: boolean
}

const IMAGEN_VACIA: EstadoImagen = {
  url: '',
  ancho: null,
  alto: null,
  problema: null,
  midiendo: false,
}

function CampoImagen({
  medida,
  estado,
  onCambio,
}: {
  medida: MedidaExigida
  estado: EstadoImagen
  onCambio: (url: string) => void
}) {
  const fileInputId = `file-input-${medida.clave}`

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-secondary/10 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <ImageIcon className="size-4 text-primary" weight="duotone" />
          {medida.etiqueta}
        </h4>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
          {medida.ancho} × {medida.alto} px
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {medida.porque} Se muestra a {medida.anchoVista} px de ancho.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            className="h-10 flex-1 font-mono text-xs"
            placeholder="https://…/imagen.png"
            value={estado.url.startsWith('data:') ? '[Imagen cargada e importada]' : estado.url}
            onChange={(e) => onCambio(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            id={fileInputId}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                optimizarAdaptarImagen(file, medida.ancho, medida.alto, onCambio)
              }
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(fileInputId)?.click()}
            className="h-10 shrink-0 gap-1.5 px-3 text-xs font-semibold"
          >
            <Upload className="size-4 text-primary" />
            Importar imagen
          </Button>
        </div>
      </div>

      {estado.midiendo && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleNotch className="size-3.5 animate-spin" /> Comprobando el tamaño…
        </p>
      )}

      {!estado.midiendo && estado.problema && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
          {estado.problema}
        </p>
      )}

      {!estado.midiendo && !estado.problema && estado.ancho && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="size-3.5 shrink-0" weight="fill" />
            {estado.ancho} × {estado.alto} px (Válida)
          </p>
          <div className="flex items-center gap-2">
            <img
              src={estado.url}
              alt=""
              className="max-h-12 max-w-[120px] rounded border border-border object-contain bg-card p-0.5"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCambio('')}
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
            >
              Quitar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PanelBranding() {
  const { refrescar: refrescarTemaGlobal } = useBranding()

  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState('')
  const [branding, setBranding] = useState<BrandingResponse | null>(null)

  const [color, setColor] = useState('')
  const [titulo, setTitulo] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [textoPie, setTextoPie] = useState('')
  const [imagenes, setImagenes] = useState<Record<string, EstadoImagen>>({})

  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    programasApi
      .listar()
      .then((lista) => {
        setProgramas(lista)
        if (lista.length > 0) setProgramaId((actual) => actual || lista[0].id)
      })
      .catch(() => setProgramas([]))
  }, [])

  const cargar = useCallback(async (id: string) => {
    if (!id) return
    setCargando(true)
    setError(null)
    setGuardado(false)
    try {
      const b = await brandingApi.obtener(id)
      setBranding(b)
      setColor(b.colorPrimario ?? '')
      setTitulo(b.tituloHeader ?? '')
      setSubtitulo(b.subtituloHeader ?? '')
      setTextoPie(b.correoTextoPie ?? '')
      setImagenes({
        bannerPanel: {
          ...IMAGEN_VACIA,
          url: b.bannerPanelUrl ?? '',
          ancho: b.bannerPanelAncho,
          alto: b.bannerPanelAlto,
        },
        correoHeader: {
          ...IMAGEN_VACIA,
          url: b.correoHeaderUrl ?? '',
          ancho: b.correoHeaderAncho,
          alto: b.correoHeaderAlto,
        },
        correoPie: {
          ...IMAGEN_VACIA,
          url: b.correoPieUrl ?? '',
          ancho: b.correoPieAncho,
          alto: b.correoPieAlto,
        },
      })
    } catch (err) {
      setError(errorDe(err))
      setBranding(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(programaId)
  }, [programaId, cargar])

  const colorValido = color === '' || /^#[0-9a-fA-F]{6}$/.test(color)
  const paletaPrevia = useMemo(
    () => (colorValido && color ? paletaDesde(color) : null),
    [color, colorValido],
  )

  /**
   * Las variables de la gama, acotadas a un contenedor.
   *
   * Escritas sobre un `<div>` en vez de sobre `<html>`, solo tiñen lo que hay
   * dentro. Antes se aplicaban al documento entero y editar un proyecto
   * repintaba el panel del administrador —menú, cabecera, botones—, que no es
   * el proyecto que está editando: la referencia de la que se fía para decidir
   * si un color funciona se movía con cada clic.
   */
  const estiloPrevio = paletaPrevia
    ? (paletaPrevia as unknown as React.CSSProperties)
    : undefined

  const cambiarColor = (nuevo: string) => {
    setColor(nuevo)
    setGuardado(false)
  }

  const cambiarImagen = async (medida: MedidaExigida, url: string) => {
    setGuardado(false)
    const limpia = url.trim()

    if (!limpia) {
      setImagenes((p) => ({ ...p, [medida.clave]: { ...IMAGEN_VACIA } }))
      return
    }

    setImagenes((p) => ({
      ...p,
      [medida.clave]: { ...IMAGEN_VACIA, url: limpia, midiendo: true },
    }))

    const medido = await medirImagen(limpia)

    setImagenes((p) => {
      if (p[medida.clave]?.url !== limpia) return p // llegó tarde, ya cambió
      if (!medido) {
        return {
          ...p,
          [medida.clave]: {
            url: limpia,
            ancho: null,
            alto: null,
            midiendo: false,
            problema:
              'No se pudo cargar la imagen para medirla. Comprueba que la URL sea pública; ' +
              'el servidor volverá a validarla al guardar.',
          },
        }
      }
      const correcta = medido.ancho === medida.ancho && medido.alto === medida.alto
      return {
        ...p,
        [medida.clave]: {
          url: limpia,
          ancho: medido.ancho,
          alto: medido.alto,
          midiendo: false,
          problema: correcta
            ? null
            : `Mide ${medido.ancho} × ${medido.alto} px y se exige ${medida.ancho} × ${medida.alto} px.`,
        },
      }
    })
  }

  const hayProblemas = Object.values(imagenes).some((i) => i.problema !== null)

  const guardar = async () => {
    if (!programaId) return
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      const b = await brandingApi.guardar(programaId, {
        colorPrimario: color || null,
        tituloHeader: titulo || null,
        subtituloHeader: subtitulo || null,
        correoTextoPie: textoPie || null,
        bannerPanelUrl: imagenes.bannerPanel?.url || null,
        bannerPanelAncho: imagenes.bannerPanel?.ancho ?? null,
        bannerPanelAlto: imagenes.bannerPanel?.alto ?? null,
        correoHeaderUrl: imagenes.correoHeader?.url || null,
        correoHeaderAncho: imagenes.correoHeader?.ancho ?? null,
        correoHeaderAlto: imagenes.correoHeader?.alto ?? null,
        correoPieUrl: imagenes.correoPie?.url || null,
        correoPieAncho: imagenes.correoPie?.ancho ?? null,
        correoPieAlto: imagenes.correoPie?.alto ?? null,
      })
      setBranding(b)
      setGuardado(true)
      // Guardar es elegir: a partir de aqui el panel se viste con este
      // proyecto. Mientras se edita la gama sigue acotada a la vista previa,
      // para no perder la referencia con la que se juzgan los colores.
      guardarProyectoActivo(programaId)
      refrescarTemaGlobal()
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  const volverAGamaGlobal = async () => {
    if (!programaId) return
    if (!confirm('El proyecto volverá a usar la gama de colores global del panel. ¿Continuar?')) {
      return
    }
    setGuardando(true)
    try {
      await brandingApi.restablecer(programaId)
      guardarProyectoActivo(null)
      await cargar(programaId)
      refrescarTemaGlobal()
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-5 text-primary" weight="duotone" />
              Identidad visual del proyecto
            </CardTitle>
            <CardDescription>
              Color, encabezado y las imágenes de los correos. Cada proyecto tiene la
              suya; si no eliges color, se usa la gama global del panel.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cargar(programaId)}
            disabled={cargando || !programaId}
          >
            <ArrowsClockwise className="mr-1 size-3.5" /> Recargar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-foreground/85" htmlFor="branding-programa">
            Proyecto
          </label>
          <select
            id="branding-programa"
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {cargando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" /> Cargando…
          </p>
        )}

        {branding && !cargando && (
          <>
            {!branding.personalizado && (
              <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
                Este proyecto aún no tiene identidad propia: se está pintando con la
                gama global del panel.
              </p>
            )}

            {/* ── Color ─────────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/10 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Color primario
              </legend>

              <div className="flex flex-wrap items-center gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s.hex}
                    type="button"
                    title={s.nombre}
                    onClick={() => cambiarColor(s.hex)}
                    className={`size-9 rounded-full border-2 transition-transform hover:scale-110 ${
                      color.toUpperCase() === s.hex ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: s.hex }}
                  >
                    <span className="sr-only">{s.nombre}</span>
                  </button>
                ))}
                <input
                  type="color"
                  className="size-9 cursor-pointer rounded-full border border-border bg-transparent"
                  value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1268E8'}
                  onChange={(e) => cambiarColor(e.target.value.toUpperCase())}
                  aria-label="Elegir un color a medida"
                />
                <Input
                  className="h-9 w-32 font-mono"
                  placeholder="#1268E8"
                  value={color}
                  onChange={(e) => cambiarColor(e.target.value)}
                />
                {color && (
                  <Button variant="outline" size="sm" onClick={() => cambiarColor('')}>
                    Sin color propio
                  </Button>
                )}
              </div>

              {!colorValido && (
                <p className="text-xs text-destructive">
                  Tiene que ser un hexadecimal de seis dígitos, tipo #1268E8.
                </p>
              )}

              {paletaPrevia && (
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Gama derivada automáticamente. Así lo verá quien esté
                    matriculado en este proyecto; tu panel no cambia.
                  </p>

                  {/* La gama solo tiñe lo que hay dentro de este contenedor. */}
                  <div
                    style={estiloPrevio}
                    className="overflow-hidden rounded-xl border border-border bg-background shadow-sm"
                  >
                    <div className="flex items-center gap-2 border-b-2 border-b-[var(--primary)] bg-card px-3 py-2">
                      {imagenes.bannerPanel?.url && !imagenes.bannerPanel.problema && (
                        <img
                          src={imagenes.bannerPanel.url}
                          alt=""
                          className="h-6 max-w-24 object-contain opacity-70"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {titulo || branding.programaNombre}
                        </p>
                        <p className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
                          {subtitulo || 'Portal del estudiante'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-3">
                      <div className="flex w-32 shrink-0 flex-col gap-1">
                        <span
                          className="rounded-md px-2 py-1.5 text-[11px] font-semibold"
                          style={{
                            background: 'var(--sidebar-accent)',
                            color: 'var(--primary)',
                          }}
                        >
                          Inicio
                        </span>
                        <span className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          Mis vacantes
                        </span>
                        <span className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          Mi hoja de vida
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div
                          className="rounded-lg p-2.5"
                          style={{ background: 'var(--primary-soft)' }}
                        >
                          <p className="text-[11px] font-semibold text-foreground">
                            ¡Hola, Héctor! 👋
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Tienes 3 vacantes recomendadas.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              background: 'var(--primary)',
                              color: 'var(--primary-foreground)',
                            }}
                          >
                            Ver vacantes
                          </span>
                          <span
                            className="rounded-md border px-3 py-1.5 text-[11px] font-medium"
                            style={{
                              borderColor: 'var(--primary-border)',
                              color: 'var(--primary)',
                            }}
                          >
                            Mi perfil
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(paletaPrevia).map(([nombre, valor]) => (
                      <div
                        key={nombre}
                        title={`${nombre}: ${valor}`}
                        className="h-7 w-12 rounded-md border border-border/80 shadow-xs"
                        style={{ background: valor }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </fieldset>

            {/* ── Encabezado ────────────────────────────────────────────── */}
            <fieldset className="grid gap-4 rounded-xl border border-border/60 bg-secondary/10 p-4 sm:grid-cols-2">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Encabezado del panel
              </legend>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">Título</label>
                <Input
                  className="h-10"
                  placeholder="Ruta Accelerator"
                  maxLength={120}
                  value={titulo}
                  onChange={(e) => {
                    setTitulo(e.target.value)
                    setGuardado(false)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">Subtítulo</label>
                <Input
                  className="h-10"
                  placeholder="Cuando sabes inglés se nota"
                  maxLength={200}
                  value={subtitulo}
                  onChange={(e) => {
                    setSubtitulo(e.target.value)
                    setGuardado(false)
                  }}
                />
              </div>
            </fieldset>

            {/* ── Imágenes ──────────────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
              {branding.medidasExigidas.map((m) => (
                <CampoImagen
                  key={m.clave}
                  medida={m}
                  estado={imagenes[m.clave] ?? IMAGEN_VACIA}
                  onCambio={(url) => cambiarImagen(m, url)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-foreground/85">
                Texto del pie del correo
              </label>
              <Input
                className="h-10"
                placeholder="Fundación Santo Domingo · GitLab Foundation · CAC Eurocentres"
                value={textoPie}
                onChange={(e) => {
                  setTextoPie(e.target.value)
                  setGuardado(false)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Se muestra también cuando el cliente de correo bloquea las imágenes,
                que es lo que hacen por defecto. Vacío = los aliados del programa marco.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                <WarningCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {guardado && (
              <p className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-300">
                <CheckCircle className="size-4 shrink-0" weight="fill" />
                Identidad guardada. El panel ya se ve con esta gama y los correos
                de este proyecto salen con ella.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={guardar} disabled={guardando || !colorValido || hayProblemas}>
                {guardando ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <FloppyDisk className="size-4" />
                )}
                Guardar identidad
              </Button>
              {branding.personalizado && (
                <Button variant="outline" onClick={volverAGamaGlobal} disabled={guardando}>
                  Volver a la gama global
                </Button>
              )}
              {hayProblemas && (
                <span className="text-xs text-destructive">
                  Corrige las imágenes marcadas antes de guardar.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
