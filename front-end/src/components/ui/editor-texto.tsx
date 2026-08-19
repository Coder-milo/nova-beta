'use client'

/**
 * Editor de texto enriquecido sobre Quill con respaldo seguro de edición,
 * inserción en cursor de variables dinámicas categorizadas y bloques modulares de correo.
 *
 * Devuelve **HTML**. El backend lo sanea con una lista blanca antes de
 * guardarlo (`HtmlEnriquecido`), así que la barra puede ofrecer todo lo que un
 * anuncio o correo necesita —tipografía, tamaños, alineación, listas, enlaces,
 * imágenes, video incrustado, variables dinámicas y bloques prediseñados— sin que
 * el portal del estudiante quede expuesto a lo que se pegue desde Word.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  Bold as TextB,
  Code,
  FilePlus,
  Italic as TextItalic,
  LayoutTemplate,
  List as ListBullets,
  LoaderCircle as CircleNotch,
  Sparkles,
  Braces,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/lib/preferences'
import type { VariableDisponible } from '@/lib/types'
import { BLOQUES_PREDISENADOS, type BloqueCorreo } from '@/components/admin/bloques-correo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

export interface EditorTextoHandle {
  insertarTexto: (texto: string) => void
  insertarHtml: (html: string) => void
  focus: () => void
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
  variables?: VariableDisponible[]
  mostrarBloques?: boolean
  bloques?: BloqueCorreo[]
}

/** Textos propios de este componente, en los dos idiomas. */
function textos(english: boolean) {
  return english
    ? {
        escribeAqui: 'Type the message content here…',
        noSePudoSubir: 'The file could not be uploaded.',
        volverAlEditor: 'Visual Editor',
        editarHtml: 'Edit HTML',
        cuerpoDelMensaje: 'Message body',
        insertarVariable: 'Dynamic Variables',
        insertarBloque: 'Pre-built Blocks',
        adjuntarArchivo: 'Attach PDF, Word or Excel',
        estudiante: 'Participant / Student',
        empleo: 'Job & Program',
        entrevista: 'Interview & Appointments',
        sistema: 'System & Actions',
        otros: 'General Variables',
      }
    : {
        escribeAqui: 'Escribe aquí el contenido del mensaje…',
        noSePudoSubir: 'No se pudo subir el archivo.',
        volverAlEditor: 'Editor visual',
        editarHtml: 'Editar HTML',
        cuerpoDelMensaje: 'Cuerpo del mensaje',
        insertarVariable: 'Variables dinámicas',
        insertarBloque: 'Bloques prediseñados',
        adjuntarArchivo: 'Adjuntar PDF, Word o Excel',
        estudiante: 'Estudiante / Participante',
        empleo: 'Programa y Empleo',
        entrevista: 'Citas y Entrevistas',
        sistema: 'Sistema y Enlaces',
        otros: 'Variables generales',
      }
}

export const EditorTexto = forwardRef<EditorTextoHandle, EditorTextoProps>(function EditorTexto(
  {
    value,
    onChange,
    placeholder,
    minHeight = '14rem',
    id,
    'aria-label': ariaLabel,
    onSubirArchivo,
    aceptaAdjuntos = ADJUNTOS_POR_DEFECTO,
    variables,
    mostrarBloques = false,
    bloques = BLOQUES_PREDISENADOS,
  },
  ref,
) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const contenedor = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const quill = useRef<any>(null)
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const [modoHtml, setModoHtml] = useState(false)
  const [quillListo, setQuillListo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null)

  const esCambioInterno = useRef(false)

  const alCambiar = useRef(onChange)
  alCambiar.current = onChange
  const subir = useRef(onSubirArchivo)
  subir.current = onSubirArchivo

  const valorActualRef = useRef(value)
  valorActualRef.current = value

  const insertarTextoEnCursor = (texto: string) => {
    const q = quill.current
    if (!modoHtml && q && quillListo) {
      const range = q.getSelection(true)
      const index = range ? range.index : q.getLength()
      q.insertText(index, texto, 'user')
      q.setSelection(index + texto.length, 0, 'user')
      try {
        const html = q.getSemanticHTML ? q.getSemanticHTML() : q.root?.innerHTML
        alCambiar.current(html === VACIO || !html || html.trim() === '' ? '' : html)
      } catch {
        alCambiar.current(q.root?.innerHTML ?? '')
      }
    } else {
      const ta = textareaRef.current
      const actual = valorActualRef.current ?? ''
      if (ta) {
        const start = ta.selectionStart ?? actual.length
        const end = ta.selectionEnd ?? actual.length
        const nuevo = actual.substring(0, start) + texto + actual.substring(end)
        alCambiar.current(nuevo)
        setTimeout(() => {
          ta.focus()
          ta.setSelectionRange(start + texto.length, start + texto.length)
        }, 0)
      } else {
        alCambiar.current(actual + texto)
      }
    }
  }

  const insertarHtmlEnCursor = (htmlBloque: string) => {
    const q = quill.current
    if (!modoHtml && q && quillListo) {
      const range = q.getSelection(true)
      const index = range ? range.index : q.getLength()
      q.clipboard.dangerouslyPasteHTML(index, htmlBloque, 'user')
      try {
        const html = q.getSemanticHTML ? q.getSemanticHTML() : q.root?.innerHTML
        alCambiar.current(html === VACIO || !html || html.trim() === '' ? '' : html)
      } catch {
        alCambiar.current(q.root?.innerHTML ?? '')
      }
    } else {
      const ta = textareaRef.current
      const actual = valorActualRef.current ?? ''
      if (ta) {
        const start = ta.selectionStart ?? actual.length
        const end = ta.selectionEnd ?? actual.length
        const separador = start > 0 && !actual.substring(0, start).endsWith('\n') ? '\n' : ''
        const nuevo = actual.substring(0, start) + separador + htmlBloque + '\n' + actual.substring(end)
        alCambiar.current(nuevo)
        setTimeout(() => {
          ta.focus()
          const pos = start + separador.length + htmlBloque.length + 1
          ta.setSelectionRange(pos, pos)
        }, 0)
      } else {
        alCambiar.current((actual ? actual + '\n' : '') + htmlBloque)
      }
    }
  }

  useImperativeHandle(ref, () => ({
    insertarTexto: insertarTextoEnCursor,
    insertarHtml: insertarHtmlEnCursor,
    focus: () => {
      if (!modoHtml && quill.current && quillListo) {
        quill.current.focus()
      } else if (textareaRef.current) {
        textareaRef.current.focus()
      }
    },
  }))

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
        if (como === 'image') {
          const etiquetaImg = `<p><img src="${recurso.url}" alt="${recurso.nombre}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
          alCambiar.current((value ?? '') + '\n' + etiquetaImg)
        } else {
          const etiquetaEnlace = `<p><a href="${recurso.url}" target="_blank" rel="noopener noreferrer">${recurso.nombre}</a></p>`
          alCambiar.current((value ?? '') + '\n' + etiquetaEnlace)
        }
      }
    } catch (error) {
      setErrorAdjunto(error instanceof Error ? error.message : T.noSePudoSubir)
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
            placeholder: placeholder ?? T.escribeAqui,
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

          q.on('text-change', (_delta: any, _oldDelta: any, source: string) => {
            if (source === 'user') {
              esCambioInterno.current = true
            }
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

    if (q.hasFocus() || esCambioInterno.current) {
      esCambioInterno.current = false
      return
    }

    try {
      const actual = q.getSemanticHTML ? q.getSemanticHTML() : q.root?.innerHTML
      const normalizado = actual === VACIO || !actual || actual.trim() === '' ? '' : actual
      const valorNormalizado = value === VACIO || !value || value.trim() === '' ? '' : value
      if (valorNormalizado !== normalizado) {
        q.clipboard.dangerouslyPasteHTML(valorNormalizado)
      }
    } catch {
      // Ignorar si falla la comparación externa
    }
  }, [value, modoHtml])

  const insertarEtiquetaRapida = (apertura: string, cierre: string) => {
    insertarTextoEnCursor(`${apertura}texto${cierre}`)
  }

  // Agrupación de variables por categoría
  const variablesPorCategoria = (variables ?? []).reduce<Record<string, VariableDisponible[]>>(
    (acc, v) => {
      const cat = (v.categoria || 'otros').toLowerCase()
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(v)
      return acc
    },
    {},
  )

  const categoriaNombre = (cat: string) => {
    switch (cat) {
      case 'estudiante': return T.estudiante
      case 'empleo': return T.empleo
      case 'entrevista': return T.entrevista
      case 'sistema': return T.sistema
      default: return T.otros
    }
  }

  return (
    <div className="editor-texto space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModoHtml((activo) => !activo)}
          aria-pressed={modoHtml}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
            modoHtml
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-secondary text-foreground',
          )}
        >
          <Code className="size-3.5" />
          {modoHtml ? T.volverAlEditor : T.editarHtml}
        </button>

        {/* Dropdown de Variables Dinámicas Categorizadas */}
        {variables && variables.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer"
                />
              }
            >
              <Braces className="size-3.5 text-primary" />
              {T.insertarVariable}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
              {Object.keys(variablesPorCategoria).length > 0 ? (
                Object.entries(variablesPorCategoria).map(([catKey, vars], index) => (
                  <DropdownMenuGroup key={catKey}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {categoriaNombre(catKey)}
                    </DropdownMenuLabel>
                    {vars.map((v) => (
                      <DropdownMenuItem
                        key={v.clave}
                        onClick={() => insertarTextoEnCursor(v.marca)}
                        className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-primary">{v.marca}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{v.clave}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground leading-tight">{v.descripcion}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))
              ) : (
                <DropdownMenuItem disabled>No hay variables disponibles</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Dropdown de Bloques Modulares Prediseñados */}
        {(mostrarBloques || (bloques && bloques.length > 0)) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer"
                />
              }
            >
              <LayoutTemplate className="size-3.5 text-primary" />
              {T.insertarBloque}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bloques de Correo HTML
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {bloques.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onClick={() => insertarHtmlEnCursor(b.html)}
                  className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                >
                  <span className="font-medium text-xs text-foreground">{b.nombre}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{b.descripcion}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onSubirArchivo && (
          <>
            <button
              type="button"
              onClick={() => entradaArchivo.current?.click()}
              disabled={subiendo || modoHtml}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
            >
              {subiendo ? <CircleNotch className="size-3.5 animate-spin" /> : <FilePlus className="size-3.5" />}
              {T.adjuntarArchivo}
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
              className="rounded p-1 hover:bg-secondary text-foreground"
              title="Negrita"
            >
              <TextB className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertarEtiquetaRapida('<em>', '</em>')}
              className="rounded p-1 hover:bg-secondary text-foreground"
              title="Cursiva"
            >
              <TextItalic className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertarEtiquetaRapida('<ul><li>', '</li></ul>')}
              className="rounded p-1 hover:bg-secondary text-foreground"
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
          ref={textareaRef}
          id={id}
          aria-label={ariaLabel || T.cuerpoDelMensaje}
          placeholder={placeholder ?? T.escribeAqui}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ minHeight }}
          className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 font-mono"
        />
      )}
    </div>
  )
})
