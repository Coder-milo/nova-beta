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
import { CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, Image as ImageIcon, LoaderCircle as CircleNotch, Palette, RefreshCw as ArrowsClockwise, Save as FloppyDisk, Upload } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Confirmar } from '@/components/ui/confirmar'
import { brandingApi, programasApi } from '@/lib/api'
import { paletaDesde, textoSobre } from '@/lib/paleta'
import { notificarIdentidadActualizada } from '@/lib/branding'
import type { BrandingResponse, MedidaExigida, ProgramaResponse } from '@/lib/types'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

/** Colores de arranque. Ahorran abrir el selector para lo más habitual. */
function sugerencias(T: ReturnType<typeof textos>) {
  return [
    { hex: '#1268E8', nombre: T.azulInstitucional },
    { hex: '#E8621C', nombre: T.naranjaCorporativo },
    { hex: '#0F7B5A', nombre: T.verdeEsmeralda },
    { hex: '#7C3AED', nombre: T.moradoModerno },
    { hex: '#C81E5B', nombre: T.magentaVibrante },
    { hex: '#0284C7', nombre: T.cianTurquesa },
    { hex: '#D97706', nombre: T.ambarDorado },
    { hex: '#0F172A', nombre: T.azulNoche },
  ]
}

// Permite editar y previsualizar aun si el backend se está actualizando. Al
// volver a estar disponible, sus medidas reemplazan estas mismas referencias.
// La etiqueta y el porqué van en español a propósito: llegan así del backend y
// `CampoImagen` los sustituye por los del diccionario para las claves que
// conoce. Traducirlos aquí solo taparía el caso de una clave nueva.
const MEDIDAS_POR_DEFECTO: MedidaExigida[] = [
  { clave: 'bannerPanel', etiqueta: 'Banner de bienvenida', ancho: 2400, alto: 300, anchoVista: 1200, porque: 'Es el fondo del cuadro de bienvenida del portal del estudiante; no se muestra en el panel administrador, la barra superior ni el menú lateral.' },
  { clave: 'correoHeader', etiqueta: 'Cabecera del correo', ancho: 1200, alto: 400, anchoVista: 600, porque: 'Se muestra en los correos enviados.' },
  { clave: 'correoPie', etiqueta: 'Pie del correo', ancho: 1200, alto: 300, anchoVista: 600, porque: 'Cierra los correos del proyecto.' },
]

function dataUrlABlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
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
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const fileInputId = `file-input-${medida.clave}`
  const esBannerBienvenida = medida.clave === 'bannerPanel'
  // El backend manda `etiqueta` y `porque` en espanol. Para las tres claves
  // conocidas mandan los textos propios; el respaldo solo cubre una clave nueva.
  const propios: Record<string, { etiqueta: string; descripcion: string }> = {
    bannerPanel:  { etiqueta: T.bannerDeBienvenida, descripcion: T.esElFondoX },
    correoHeader: { etiqueta: T.cabeceraDelCorreo,  descripcion: T.seMuestraEn },
    correoPie:    { etiqueta: T.pieDelCorreo,       descripcion: T.cierraLosCorreos },
  }
  const etiqueta = propios[medida.clave]?.etiqueta ?? medida.etiqueta
  const descripcion = propios[medida.clave]?.descripcion ?? medida.porque

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-secondary/10 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <ImageIcon className="size-4 text-primary" />
          {etiqueta}
        </h4>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
          {medida.ancho} × {medida.alto} px
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {descripcion} Se muestra a {medida.anchoVista} px de ancho.
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
            <CheckCircle className="size-3.5 shrink-0" />
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
      <p className="text-[11px] leading-4 text-muted-foreground">
        Al importar una imagen, publícala con <strong>Guardar y publicar identidad</strong> al final del formulario.
      </p>
    </div>
  )
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        azulInstitucional: 'Institutional blue',
        naranjaCorporativo: 'Corporate orange',
        verdeEsmeralda: 'Emerald green',
        moradoModerno: 'Modern purple',
        magentaVibrante: 'Vivid magenta',
        cianTurquesa: 'Turquoise cyan',
        azulNoche: 'Night blue',
        holaEjemplo: 'Hi, Héctor! 👋',
        tienesVacantes: 'You have 3 recommended vacancies.',

        colorEncabezadoBanner: "Colour, header, banner and the email images. Each project has its own identity, visible on its students' portal even in dark mode.",
        identidadGuardadaLos: 'Identity saved. Students on this project will now see this palette, its banner and its own emails.',
        esteProyectoAun: "This project has no identity of its own yet: it is being painted with the panel's global palette.",
        elProyectoVolvera: "The project will go back to the panel's global palette instead of a custom one.",
        noSePudo: 'The image could not be loaded to measure it. Check that the URL is public;',
        esElFondo: 'It is the background of the welcome panel on the student portal; it does not appear in the admin panel, the top bar or the side menu.',
        esElFondoX: 'It is the background of the welcome panel on the student portal. It does not appear in the admin panel, the top bar or the side menu.',
        tieneQueSer: 'It must be a six-digit hex value, like #1268E8.',
        corrigeLasImagenes: 'Fix the flagged images before saving.',
        elServidorVolvera: 'the server will validate it again on save.',
        fundacionSantoDomingo: 'Fundación Santo Domingo · GitLab Foundation · CAC Eurocentres',
        seMuestraEn: 'It appears on the emails that are sent.',
        cierraLosCorreos: "It closes the project's emails.",
        identidadVisualDel: 'Project visual identity',
        cuandoSabesIngles: 'Knowing English shows',
        elegirUnColor: 'Pick a custom colour',
        textoDelPie: 'Email footer text',
        volverALa: 'Back to the global palette',
        bannerDeBienvenida: 'Welcome banner',
        encabezadoDelPanel: 'Panel header',
        portalDelEstudiante: 'Student portal',
        cabeceraDelCorreo: 'Email header',
        sinColorPropio: 'No colour of its own',
        miHojaDe: 'My résumé',
        verVacantes: 'View vacancies',
        pieDelCorreo: 'Email footer',
        ambarDorado: 'Golden amber',
        subtitulo: 'Subtitle',
        titulo: 'Title',
      }
    : {
        azulInstitucional: 'Azul institucional',
        naranjaCorporativo: 'Naranja corporativo',
        verdeEsmeralda: 'Verde esmeralda',
        moradoModerno: 'Morado moderno',
        magentaVibrante: 'Magenta vibrante',
        cianTurquesa: 'Cian turquesa',
        azulNoche: 'Azul noche',
        holaEjemplo: '¡Hola, Héctor! 👋',
        tienesVacantes: 'Tienes 3 vacantes recomendadas.',

        colorEncabezadoBanner: 'Color, encabezado, banner y las imágenes de los correos. Cada proyecto tiene su propia identidad, visible en el portal de sus estudiantes incluso en modo oscuro.',
        identidadGuardadaLos: 'Identidad guardada. Los estudiantes de este proyecto ya verán esta gama, su banner y sus correos personalizados.',
        esteProyectoAun: 'Este proyecto aún no tiene identidad propia: se está pintando con la gama global del panel.',
        elProyectoVolvera: 'El proyecto volverá a usar la gama de colores global del panel en lugar de una personalizada.',
        noSePudo: 'No se pudo cargar la imagen para medirla. Comprueba que la URL sea pública;',
        esElFondo: 'Es el fondo del cuadro de bienvenida del portal del estudiante; no se muestra en el panel administrador, la barra superior ni el menú lateral.',
        esElFondoX: 'Es el fondo del cuadro de bienvenida del portal del estudiante. No aparece en el panel administrador, la barra superior ni el menú lateral.',
        tieneQueSer: 'Tiene que ser un hexadecimal de seis dígitos, tipo #1268E8.',
        corrigeLasImagenes: 'Corrige las imágenes marcadas antes de guardar.',
        elServidorVolvera: 'el servidor volverá a validarla al guardar.',
        fundacionSantoDomingo: 'Fundación Santo Domingo · GitLab Foundation · CAC Eurocentres · Compartamos con Colombia',
        seMuestraEn: 'Se muestra en los correos enviados.',
        cierraLosCorreos: 'Cierra los correos del proyecto.',
        identidadVisualDel: 'Identidad visual del proyecto',
        cuandoSabesIngles: 'Cuando sabes inglés se nota',
        elegirUnColor: 'Elegir un color a medida',
        textoDelPie: 'Aliados, financiadores y texto del pie de correo',
        volverALa: 'Volver a la gama global',
        bannerDeBienvenida: 'Banner de bienvenida',
        encabezadoDelPanel: 'Encabezado del panel',
        portalDelEstudiante: 'Portal del estudiante',
        cabeceraDelCorreo: 'Cabecera del correo',
        sinColorPropio: 'Sin color propio',
        miHojaDe: 'Mi hoja de vida',
        verVacantes: 'Ver vacantes',
        pieDelCorreo: 'Pie del correo',
        ambarDorado: 'Ámbar dorado',
        subtitulo: 'Subtítulo',
        titulo: 'Título',
      }
}

export function PanelBranding({ programaIdInicial }: { programaIdInicial?: string } = {}) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const [programas, setProgramas] = useState<ProgramaResponse[]>([])
  const [programaId, setProgramaId] = useState(programaIdInicial ?? '')
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
        if (lista.length > 0) setProgramaId((actual) => actual || programaIdInicial || lista[0].id)
      })
      .catch(() => setProgramas([]))
  }, [programaIdInicial])

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
      setBranding({
        programaId: id,
        programaNombre: programas.find((programa) => programa.id === id)?.nombre ?? 'Proyecto seleccionado',
        personalizado: false,
        colorPrimario: null,
        tituloHeader: null,
        subtituloHeader: null,
        bannerPanelUrl: null,
        bannerPanelAncho: null,
        bannerPanelAlto: null,
        correoHeaderUrl: null,
        correoHeaderAncho: null,
        correoHeaderAlto: null,
        correoPieUrl: null,
        correoPieAncho: null,
        correoPieAlto: null,
        correoTextoPie: null,
        medidasExigidas: MEDIDAS_POR_DEFECTO,
      })
      setImagenes({})
    } finally {
      setCargando(false)
    }
  }, [programas])

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
              `${T.noSePudo} ${T.elServidorVolvera}`,
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

  const guardarImagenesPendientes = async () => {
    const urls: Record<string, string | null> = {}
    for (const medida of branding?.medidasExigidas ?? []) {
      const imagen = imagenes[medida.clave]
      if (!imagen?.url) {
        urls[medida.clave] = null
        continue
      }

      if (!imagen.url.startsWith('data:')) {
        urls[medida.clave] = imagen.url
        continue
      }

      const blob = dataUrlABlob(imagen.url)
      const archivo = new File([blob], `${medida.clave}.png`, {
        type: blob.type || 'image/png',
      })
      const subida = await brandingApi.subirImagen(programaId, medida.clave, archivo)
      // El backend devuelve la clave; si aún corre una versión anterior que
      // devuelve la URL completa, se reduce igual al guardar.
      urls[medida.clave] = subida.clave ?? subida.url ?? null
    }
    return urls
  }

  const guardar = async () => {
    if (!programaId) return
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      const urlsImagenes = await guardarImagenesPendientes()
      const b = await brandingApi.guardar(programaId, {
        colorPrimario: color || null,
        tituloHeader: titulo || null,
        subtituloHeader: subtitulo || null,
        correoTextoPie: textoPie || null,
        bannerPanelUrl: urlsImagenes.bannerPanel ?? null,
        bannerPanelAncho: imagenes.bannerPanel?.ancho ?? null,
        bannerPanelAlto: imagenes.bannerPanel?.alto ?? null,
        correoHeaderUrl: urlsImagenes.correoHeader ?? null,
        correoHeaderAncho: imagenes.correoHeader?.ancho ?? null,
        correoHeaderAlto: imagenes.correoHeader?.alto ?? null,
        correoPieUrl: urlsImagenes.correoPie ?? null,
        correoPieAncho: imagenes.correoPie?.ancho ?? null,
        correoPieAlto: imagenes.correoPie?.alto ?? null,
      })
      setBranding(b)
      setGuardado(true)
      notificarIdentidadActualizada(programaId)
      // La identidad se publica para los estudiantes de este proyecto. La
      // vista del administrador conserva deliberadamente la gama global.
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false)

  const volverAGamaGlobal = async () => {
    if (!programaId) return
    setGuardando(true)
    try {
      await brandingApi.restablecer(programaId)
      await cargar(programaId)
      notificarIdentidadActualizada(programaId)
    } catch (err) {
      setError(errorDe(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="rounded-2xl border-primary/25 bg-card/95 shadow-sm dark:border-primary/35 dark:bg-card">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="size-5 text-primary" />
              {T.identidadVisualDel}
            </CardTitle>
            <CardDescription>
              {T.colorEncabezadoBanner}
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
                {T.esteProyectoAun}
              </p>
            )}

            {/* ── Color ─────────────────────────────────────────────────── */}
            <fieldset className="flex flex-col gap-3 rounded-xl border border-border/60 bg-secondary/10 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Color primario
              </legend>

              <div className="flex flex-wrap items-center gap-2">
                {sugerencias(T).map((s) => (
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
                  aria-label={T.elegirUnColor}
                />
                <Input
                  className="h-9 w-32 font-mono"
                  placeholder="#1268E8"
                  value={color}
                  onChange={(e) => cambiarColor(e.target.value)}
                />
                {color && (
                  <Button variant="outline" size="sm" onClick={() => cambiarColor('')}>
                    {T.sinColorPropio}
                  </Button>
                )}
              </div>

              {!colorValido && (
                <p className="text-xs text-destructive">
                  {T.tieneQueSer}
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
                          {subtitulo || T.portalDelEstudiante}
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
                          {T.miHojaDe}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div
                          className="rounded-lg p-2.5"
                          style={{ background: 'var(--primary-soft)' }}
                        >
                          <p className="text-[11px] font-semibold text-foreground">
                            {T.holaEjemplo}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {T.tienesVacantes}
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
                            {T.verVacantes}
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
                {T.encabezadoDelPanel}
              </legend>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-foreground/85">{T.titulo}</label>
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
                <label className="text-[13px] font-semibold text-foreground/85">{T.subtitulo}</label>
                <Input
                  className="h-10"
                  placeholder={T.cuandoSabesIngles}
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
                {T.textoDelPie}
              </label>
              <Input
                className="h-10"
                placeholder={T.fundacionSantoDomingo}
                value={textoPie}
                onChange={(e) => {
                  setTextoPie(e.target.value)
                  setGuardado(false)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Define las entidades aliadas, financiadoras y operadores de este proyecto (ej. Fundación Santo Domingo · GitLab Foundation · CAC Eurocentres · Compartamos con Colombia). Se mostrará en el pie de página de todos los correos del proyecto.
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
                <CheckCircle className="size-4 shrink-0" />
                {T.identidadGuardadaLos}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={guardar} disabled={guardando || !colorValido || hayProblemas}>
                {guardando ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <FloppyDisk className="size-4" />
                )}
                Guardar y publicar identidad
              </Button>
              {branding.personalizado && (
                <Button variant="outline" onClick={() => setShowResetConfirmModal(true)} disabled={guardando}>
                  {T.volverALa}
                </Button>
              )}
              {hayProblemas && (
                <span className="text-xs text-destructive">
                  {T.corrigeLasImagenes}
                </span>
              )}
            </div>

            <Confirmar
              open={showResetConfirmModal}
              onOpenChange={setShowResetConfirmModal}
              titulo="Restablecer gama global"
              descripcion={T.elProyectoVolvera}
              textoConfirmar="Restablecer"
              destructivo={true}
              onConfirmar={volverAGamaGlobal}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
