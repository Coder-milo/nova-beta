import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { navigate } from './next-navigation'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children?: ReactNode
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    children,
    replace = false,
    scroll = true,
    prefetch: _prefetch,
    onClick,
    target,
    ...props
  },
  ref,
) {
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
    <a ref={ref} href={href} target={target} onClick={handleClick} {...props}>
      {children}
    </a>
  )
})

export default Link
