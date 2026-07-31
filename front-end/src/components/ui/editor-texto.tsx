'use client'

/**
 * Editor de texto enriquecido sobre Quill con respaldo seguro de edición.
 *
 * Devuelve **HTML**. El backend lo sanea con una lista blanca antes de
 * guardarlo (`HtmlEnriquecido`), así que la barra puede ofrecer todo lo que un
 * anuncio necesita —tipografía, tamaños, alineación, listas, enlaces,
 * imágenes, video incrustado y bloques de código— sin que el portal del
 * estudiante quede expuesto a lo que se pegue desde Word.
 */

import { useEffect, useRef, useState } from 'react'
import { Code, FilePlus, CircleNotch, TextB, TextItalic, LinkSimple, ListBullets } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

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

const FORMATOS = [
  'font', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background',
  'align', 'list', 'indent', 'blockquote', 'code-block', 'link', 'image', 'video', 'header',
]

const VACIO = '<p><br></p>'

const ADJUNTOS_POR_DEFECTO =
  '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface ArchivoSubido {
  url: string
  nombre: string
  tipo?: string
}

export interface EditorTextoProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  id?: string
  'aria-label'?: string
  onSubirArchivo?: (archivo: File) => Promise<ArchivoSubido>
  aceptaAdjuntos?: string
}

export function EditorTexto({
  value,
  onChange,
  placeholder = 'Escribe aquí el contenido del mensaje…',
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
  const [quillListo, setQuillListo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null)

  const alCambiar = useRef(onChange)
  alCambiar.current = onChange
  const subir = useRef(onSubirArchivo)
  subir.current = onSubirArchivo

  const insertar = useRef(async (_archivo: File, _como: 'image' | 'enlace') => {})
  insertar.current = async (archivo: File, como: 'image' | 'enlace') => {
    if (!subir.current) return
    setSubiendo(true)
    setErrorAdjunto(null)
    try {
      const recurso = await subir.current(archivo)
      const q = quill.current
      if (q) {
        const posicion = q.getSelection(true)?.index ?? q.getLength()
        if (como === 'image') {
          q.insertEmbed(posicion, 'image', recurso.url, 'user')
          q.setSelection(posicion + 1)
        } else {
          q.insertText(posicion, recurso.nombre, { link: recurso.url }, 'user')
          q.setSelection(posicion + recurso.nombre.length)
        }
      } else {
        // Respaldar si Quill no se ha iniciado
        if (como === 'image') {
          const etiquetaImg = `<p><img src="${recurso.url}" alt="${recurso.nombre}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
          alCambiar.current((value ?? '') + '\n' + etiquetaImg)
        } else {
          const etiquetaEnlace = `<p><a href="${recurso.url}" target="_blank" rel="noopener noreferrer">${recurso.nombre}</a></p>`
          alCambiar.current((value ?? '') + '\n' + etiquetaEnlace)
        }
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

    Promise.all([
      import('quill'),
      import('quill/dist/quill.snow.css').catch(() => null),
    ])
      .then(([modulo]) => {
        if (!vivo || !contenedor.current || quill.current) return

        const QuillClass = (modulo as any)?.default?.default || (modulo as any)?.default || modulo
        if (typeof QuillClass !== 'function') {
          console.warn('Quill no se pudo importar como clase constructora.')
          return
        }

        try {
          const q = new QuillClass(contenedor.current, {
            theme: 'snow',
            placeholder,
            formats: FORMATOS,
            modules: { toolbar: BARRA },
          })
          quill.current = q
          setQuillListo(true)

          if (value) {
            try {
              q.clipboard.dangerouslyPasteHTML(value)
            } catch {
              // Ignorar error al pegar HTML inicial
            }
          }

          const tb = q.getModule('toolbar')
          if (tb) {
            tb.addHandler('image', () => {
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
          }

          q.on('text-change', () => {
            try {
              const html = q.getSemanticHTML ? q.getSemanticHTML() : q.root?.innerHTML
              alCambiar.current(html === VACIO || !html || html.trim() === '' ? '' : html)
            } catch {
              alCambiar.current(q.root?.innerHTML ?? '')
            }
          })
        } catch (e) {
          console.warn('Error iniciando Quill:', e)
        }
      })
      .catch((e) => {
        console.warn('No se pudo cargar la librería Quill:', e)
      })

    return () => {
      vivo = false
      quill.current = null
      if (nodo) nodo.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = quill.current
    if (!q || modoHtml) return
    try {
      const actual = q.getSemanticHTML ? q.getSemanticHTML() : q.root?.innerHTML
      const normalizado = actual === VACIO ? '' : actual
      if (value !== normalizado) {
        q.clipboard.dangerouslyPasteHTML(value ?? '')
      }
    } catch {
      // Ignorar si falla la comparación externa
    }
  }, [value, modoHtml])

  const insertarEtiquetaRapida = (apertura: string, cierre: string) => {
    const nuevo = (value ?? '') + `${apertura}texto${cierre}`
    onChange(nuevo)
  }

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
                event.target.value = ''
                if (archivo) void insertar.current(archivo, 'enlace')
              }}
            />
          </>
        )}

        {!quillListo && !modoHtml && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => insertarEtiquetaRapida('<strong>', '</strong>')}
              className="rounded p-1 hover:bg-secondary"
              title="Negrita"
            >
              <TextB className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertarEtiquetaRapida('<em>', '</em>')}
              className="rounded p-1 hover:bg-secondary"
              title="Cursiva"
            >
              <TextItalic className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertarEtiquetaRapida('<ul><li>', '</li></ul>')}
              className="rounded p-1 hover:bg-secondary"
              title="Lista"
            >
              <ListBullets className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {errorAdjunto && (
        <p role="alert" className="text-xs text-destructive">
          {errorAdjunto}
        </p>
      )}

      {/* Editor principal Quill */}
      <div
        className={cn(
          'rounded-lg border border-border bg-background',
          (modoHtml || !quillListo) && 'hidden',
        )}
      >
        <div id={id} aria-label={ariaLabel} ref={contenedor} style={{ minHeight }} />
      </div>

      {/* Área de texto totalmente funcional de respaldo (si Quill está cargando, falló, o en modo HTML) */}
      {(modoHtml || !quillListo) && (
        <textarea
          id={id}
          aria-label={ariaLabel || 'Cuerpo del mensaje'}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ minHeight }}
          className="w-full rounded-xl border border-input bg-card/90 px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      )}
    </div>
  )
}
