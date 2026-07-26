import { useSyncExternalStore } from 'react'

const NAVIGATION_EVENT = 'nova:navigation'

function currentUrl() {
  if (typeof window === 'undefined') return new URL('http://localhost/')
  return new URL(window.location.href)
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  window.addEventListener(NAVIGATION_EVENT, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(NAVIGATION_EVENT, callback)
  }
}

function urlSnapshot() {
  const url = currentUrl()
  return `${url.pathname}${url.search}${url.hash}`
}

function serverSnapshot() {
  return '/'
}

function useUrlSnapshot() {
  return useSyncExternalStore(subscribe, urlSnapshot, serverSnapshot)
}

export function navigate(
  href: string,
  options: { replace?: boolean; scroll?: boolean } = {},
) {
  const target = new URL(href, window.location.href)
  const method = options.replace ? 'replaceState' : 'pushState'
  window.history[method]({}, '', `${target.pathname}${target.search}${target.hash}`)
  window.dispatchEvent(new Event(NAVIGATION_EVENT))

  if (options.scroll !== false) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }
}

export function usePathname() {
  const snapshot = useUrlSnapshot()
  return new URL(snapshot, 'http://localhost').pathname
}

export function useSearchParams() {
  const snapshot = useUrlSnapshot()
  return new URL(snapshot, 'http://localhost').searchParams
}

export function useParams<T extends Record<string, string>>() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const id =
    segments[0] === 'estudiantes' || segments[0] === 'proyectos'
      ? segments[1]
      : undefined
  return { id } as unknown as T
}

export function useRouter() {
  useUrlSnapshot()

  return {
    push: (href: string, options?: { scroll?: boolean }) =>
      navigate(href, options),
    replace: (href: string, options?: { scroll?: boolean }) =>
      navigate(href, { ...options, replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: async () => undefined,
  }
}
