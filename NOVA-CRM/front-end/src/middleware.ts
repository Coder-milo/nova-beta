import { defineMiddleware } from 'astro:middleware'

const publicRoutes = new Set(['/login', '/recuperar-contrasena'])

export const onRequest = defineMiddleware(
  async ({ cookies, request, url, redirect }, next) => {
    if (url.pathname.startsWith('/api/')) {
      const backendBase =
        import.meta.env.BACKEND_URL ?? 'http://localhost:8081'
      const target = new URL(`${url.pathname}${url.search}`, backendBase)
      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.delete('expect')
      headers.delete('origin')

      const body =
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer()

      const backendResponse = await fetch(target, {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
      })

      return new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: backendResponse.headers,
      })
    }

    const token = cookies.get('nova_token')?.value
    const pathname =
      url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
    const isPublic = publicRoutes.has(pathname)

    if (!token && !isPublic) {
      return redirect('/login')
    }

    if (token && pathname === '/login') {
      return redirect('/')
    }

    return next()
  },
)
