'use client'

/**
 * Editor de texto enriquecido sobre Quill.
 *
 * Devuelve **HTML**. El backend lo sanea con una lista blanca antes de
 * guardarlo (`HtmlEnriquecido`), así que la barra puede ofrecer todo lo que un
 * anuncio necesita —tipografía, tamaños, alineación, listas, enlaces,
 * imágenes, video incrustado y bloques de código— sin que el portal del
 * estudiante quede expuesto a lo que se pegue desde Word.
 *
 * Tres cosas que no son evidentes:
 *
 * - Quill se carga con `import()` dentro del efecto porque toca `document` al
 *   construirse, y estas páginas también se renderizan en el servidor de Astro.
 * - El manejador de imagen es propio. El de serie incrusta la imagen como
 *   `data:` dentro del HTML; una foto de móvil son varios MB de base64
 *   copiados en la notificación de cada estudiante. Con `onSubirArchivo` se
 *   sube una vez y se inserta la URL.
 * - El modo HTML no es un extra: los anuncios se recortan a veces de un correo
 *   ya maquetado, y sin poder pegar el marcado directamente había que
 *   reconstruirlo a mano.
 */

import { useEffect, useRef, useState } from 'react'
import { Code, FilePlus, CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// Las listas de fuente y tamaño son las que Quill trae registradas de serie.
// `false` es «el valor por defecto» (sans-serif / tamaño normal); poner ahí una
// cadena como 'sans-serif' haría que Quill descartara la opción por no estar en
// su lista blanca y el desplegable saldría con un hueco.
const FUENTES = [false, 'serif', 'monospace']
const TAMANOS = ['small', false, 'large', 'huge']

const BARRA = [
  [{ font: FUENTES }, { size: TAMANOS }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: '' }, { align: 'center' }, { align: 'right' }, { align: 'justify' }],
  [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'video'],
  ['clean'],
]

/** Formatos permitidos; deben cuadrar con la lista blanca del backend. */
const FORMATOS = [
  'font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background',
  'align', 'list', 'indent', 'blockquote', 'code-block', 'link', 'image', 'video', 'header',
]

/** Lo que el editor considera «vacío» tras borrarlo todo. */
const VACIO = '<p><br></p>'

const ADJUNTOS_POR_DEFECTO =
  '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface ArchivoSubido {
  url: string
  nombre: string
  /** IMAGE, VIDEO o FILE. */
  tipo?: string
}

export interface EditorTextoProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Alto mínimo del área editable. */
  minHeight?: string
  id?: string
  'aria-label'?: string
  /**
   * Sube un archivo y devuelve su URL pública. Sin esto se ocultan el botón de
   * adjuntar y el de imagen: incrustar base64 en el cuerpo no es alternativa.
   */
  onSubirArchivo?: (archivo: File) => Promise<ArchivoSubido>
  /** Extensiones aceptadas por el botón de adjuntar. */
  aceptaAdjuntos?: string
}

export function EditorTexto({
  value,
  onChange,
  placeholder,
  minHeight = '14rem',
  id,
  'aria-label': ariaLabel,
  onSubirArchivo,
  aceptaAdjuntos = ADJUNTOS_POR_DEFECTO,
}: EditorTextoProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const quill = useRef<any>(null)
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const [modoHtml, setModoHtml] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null)

  // Los callbacks en refs: Quill registra sus listeners una sola vez, y sin
  // esto se quedaría con la primera versión y dejaría de avisar de los cambios
  // en cuanto el componente padre volviera a renderizar.
  const alCambiar = useRef(onChange)
  alCambiar.current = onChange
  const subir = useRef(onSubirArchivo)
  subir.current = onSubirArchivo

  /**
   * Sube el archivo e inserta lo que corresponda: la imagen incrustada, o un
   * enlace con el nombre del documento para PDF, Word y Excel.
   *
   * <p>Vive en una ref porque el manejador de imagen de la barra se registra
   * una sola vez, al construir el editor, y necesita la versión vigente.
   */
  const insertar = useRef(async (_archivo: File, _como: 'image' | 'enlace') => {})
  insertar.current = async (archivo: File, como: 'image' | 'enlace') => {
    if (!subir.current) return
    setSubiendo(true)
    setErrorAdjunto(null)
    try {
      const recurso = await subir.current(archivo)
      const q = quill.current
      if (!q) return
      const posicion = q.getSelection(true)?.index ?? q.getLength()
      if (como === 'image') {
        q.insertEmbed(posicion, 'image', recurso.url, 'user')
        q.setSelection(posicion + 1)
      } else {
        q.insertText(posicion, recurso.nombre, { link: recurso.url }, 'user')
        q.setSelection(posicion + recurso.nombre.length)
      }
    } catch (error) {
      setErrorAdjunto(error instanceof Error ? error.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
    }
  }

  useEffect(() => {
    let vivo = true
    const nodo = contenedor.current
    if (!nodo) return

    Promise.all([import('quill'), import('quill/dist/quill.snow.css')]).then(([modulo]) => {
      const Quill = modulo.default
      if (!vivo || !contenedor.current || quill.current) return

      const q = new Quill(contenedor.current, {
        theme: 'snow',
        placeholder,
        formats: FORMATOS,
        modules: { toolbar: BARRA },
      })
      quill.current = q

      if (value) q.clipboard.dangerouslyPasteHTML(value)

      q.getModule('toolbar').addHandler('image', () => {
        if (!subir.current) return
        const entrada = document.createElement('input')
        entrada.type = 'file'
        entrada.accept = 'image/png,image/jpeg,image/webp,image/gif'
        entrada.onchange = () => {
          const archivo = entrada.files?.[0]
          if (archivo) void insertar.current(archivo, 'image')
        }
        entrada.click()
      })

      q.on('text-change', () => {
        // `getSemanticHTML` da HTML limpio; el `innerHTML` del editor arrastra
        // clases internas de Quill que no significan nada fuera de él.
        const html = q.getSemanticHTML()
        alCambiar.current(html === VACIO || html.trim() === '' ? '' : html)
      })
    })

    return () => {
      vivo = false
      quill.current = null
      if (nodo) nodo.innerHTML = ''
    }
    // Solo al montar: reconstruir el editor en cada cambio de `value` perdería
    // el cursor con cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cambios que vienen de fuera (cargar una plantilla existente, limpiar el
  // formulario tras publicar). Se compara antes para no reescribir mientras se
  // teclea, que movería el cursor al principio. En modo HTML no se toca: el
  // textarea es la fuente de verdad mientras está abierto.
  useEffect(() => {
    const q = quill.current
    if (!q || modoHtml) return
    const actual = q.getSemanticHTML()
    const normalizado = actual === VACIO ? '' : actual
    if (value !== normalizado) q.clipboard.dangerouslyPasteHTML(value ?? '')
  }, [value, modoHtml])

  return (
    <div className="editor-texto space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModoHtml((activo) => !activo)}
          aria-pressed={modoHtml}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            modoHtml
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-secondary',
          )}
        >
          <Code className="size-3.5" />
          {modoHtml ? 'Volver al editor' : 'Editar HTML'}
        </button>

        {onSubirArchivo && (
          <>
            <button
              type="button"
              onClick={() => entradaArchivo.current?.click()}
              disabled={subiendo || modoHtml}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subiendo ? <CircleNotch className="size-3.5 animate-spin" /> : <FilePlus className="size-3.5" />}
              Adjuntar PDF, Word o Excel
            </button>
            <input
              ref={entradaArchivo}
              type="file"
              accept={aceptaAdjuntos}
              className="hidden"
              onChange={(event) => {
                const archivo = event.target.files?.[0]
                // Se limpia el valor para que elegir el mismo archivo dos veces
                // seguidas vuelva a disparar el evento.
                event.target.value = ''
                if (archivo) void insertar.current(archivo, 'enlace')
              }}
            />
          </>
        )}
      </div>

      {errorAdjunto && (
        <p role="alert" className="text-xs text-destructive">
          {errorAdjunto}
        </p>
      )}

      {/* El editor no se desmonta al pasar a HTML: reconstruirlo perdería el
          historial de deshacer. Se oculta y se muestra el textarea. */}
      <div className={cn('rounded-lg border border-border bg-background', modoHtml && 'hidden')}>
        <div id={id} aria-label={ariaLabel} ref={contenedor} style={{ minHeight }} />
      </div>

      {modoHtml && (
        <textarea
          aria-label="Código HTML del mensaje"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ minHeight }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-primary"
        />
      )}
    </div>
  )
}
