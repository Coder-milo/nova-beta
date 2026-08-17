import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { navigate } from './next-navigation'
import { precargarRuta } from '@/lib/rutas'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children?: ReactNode
  replace?: boolean
  scroll?: boolean
  /** `false` desactiva la precarga del chunk al apuntar el enlace. */
  prefetch?: boolean
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    children,
    replace = false,
    scroll = true,
    prefetch = true,
    onClick,
    onMouseEnter,
    onFocus,
    onTouchStart,
    target,
    ...props
  },
  ref,
) {
  /**
   * Adelanta el chunk de la pantalla destino.
   *
   * Se dispara al apuntar, al enfocar con el teclado y al empezar a tocar en
   * pantallas táctiles —donde no hay «pasar el ratón», pero entre el `touchstart`
   * y el `click` hay margen suficiente para que llegue el módulo—. La ruta
   * actual del navegador no se toca: esto solo baja código.
   */
  function anticipar() {
    if (prefetch) precargarRuta(href)
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    const isExternal =
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')

    if (
      event.defaultPrevented ||
      isExternal ||
      target === '_blank' ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(href, { replace, scroll })
  }

  return (
    <a
      ref={ref}
      href={href}
      target={target}
      onClick={handleClick}
      onMouseEnter={(event) => {
        anticipar()
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        anticipar()
        onFocus?.(event)
      }}
      onTouchStart={(event) => {
        anticipar()
        onTouchStart?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  )
})

export default Link
