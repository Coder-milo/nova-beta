'use client'

/**
 * Área de texto que crece con lo que se escribe.
 *
 * <p>Los formularios de la plataforma usaban `<textarea>` con una altura fija
 * (`rows={3}`, `min-h-32`). Con eso, escribir el detalle de un evento o el
 * perfil profesional obligaba a redactar mirando por una rendija de tres
 * líneas, o a arrastrar la esquina de redimensionado cada vez. Aquí la altura
 * se recalcula en cada cambio a partir del contenido real.
 *
 * <p>El truco es poner `height: auto` antes de leer `scrollHeight`: sin eso el
 * navegador devuelve la altura anterior y el campo crece pero no vuelve a
 * encoger al borrar texto.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends Omit<React.ComponentProps<'textarea'>, 'rows'> {
  /** Líneas visibles cuando está vacío. */
  minRows?: number
  /**
   * Tope de crecimiento, en líneas. Al superarlo aparece scroll interno.
   * Sin tope, pegar diez páginas empujaría el botón de guardar fuera de la
   * pantalla.
   */
  maxRows?: number
}

function Textarea({ className, minRows = 3, maxRows = 18, value, onChange, ...props }: TextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const ajustar = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el) return
      const estilos = window.getComputedStyle(el)
      const linea = parseFloat(estilos.lineHeight) || 20
      const relleno = parseFloat(estilos.paddingTop) + parseFloat(estilos.paddingBottom)
      // `scrollHeight` incluye el padding pero no el borde, y la caja mide en
      // `border-box`. Sumarlos aparte evita que el campo se recorte una línea.
      const bordes = parseFloat(estilos.borderTopWidth) + parseFloat(estilos.borderBottomWidth)

      el.style.height = 'auto'
      const contenido = el.scrollHeight + bordes
      const minimo = linea * minRows + relleno + bordes
      const maximo = linea * maxRows + relleno + bordes
      el.style.height = `${Math.max(minimo, Math.min(contenido, maximo))}px`
      el.style.overflowY = contenido > maximo ? 'auto' : 'hidden'
    },
    [minRows, maxRows],
  )

  // También al montar y cuando el valor llega de fuera (cargar un borrador,
  // limpiar el formulario tras enviar): sin esto el campo arrancaría con la
  // altura mínima aunque ya trajera cuatro párrafos dentro.
  React.useLayoutEffect(() => {
    ajustar(ref.current)
  }, [ajustar, value])

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      value={value}
      onChange={(event) => {
        ajustar(event.currentTarget)
        onChange?.(event)
      }}
      className={cn(
        'w-full resize-none rounded-xl border border-input bg-card/90 px-3.5 py-2 text-sm leading-6 transition-colors outline-none',
        'text-foreground placeholder:text-muted-foreground',
        'focus:border-primary focus:ring-3 focus:ring-primary/15',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
        'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
        'dark:bg-slate-950/35 dark:text-slate-100 dark:placeholder:text-slate-500',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
