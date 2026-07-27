import { defineMiddleware } from 'astro:middleware'
import {
  ACCESS_COOKIE,
  backendBase,
  renovarSesion,
  resolverIpCliente,
} from '@/lib/server/session'

const publicRoutes = new Set(['/login', '/recuperar-contrasena'])

/**
 * Cabeceras que describen el cuerpo tal y como lo envio el backend. Se
 * descartan al reenviar porque la respuesta se re-emite en streaming: copiar
 * un Content-Length o un Content-Encoding que ya no corresponde corrompe la
 * respuesta.
 */
const CABECERAS_DE_TRANSPORTE = [
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
]

function respuestaReenviada(backendResponse: Response, cuerpo: BodyInit | null): Response {
  const headers = new Headers(backendResponse.headers)
  CABECERAS_DE_TRANSPORTE.forEach((h) => headers.delete(h))
  return new Response(cuerpo, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers,
  })
}

export const onRequest = defineMiddleware(
  async ({ cookies, request, url, redirect, clientAddress }, next) => {
    // Detras del balanceador, clientAddress es la IP del balanceador —la misma
    // para todos—, asi que se resuelve la real antes de usarla.
    const ipCliente = resolverIpCliente(request, clientAddress)

    if (url.pathname.startsWith('/api/')) {
      const target = new URL(`${url.pathname}${url.search}`, backendBase())

      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.delete('expect')
      headers.delete('origin')
      // La cookie de sesion es para este servidor, no para el backend.
      headers.delete('cookie')

      // El backend limita por IP. Como todas las llamadas salen de este
      // servidor, sin reenviar la IP real todos los usuarios compartirian un
      // unico contador y la API responderia 429 con poca concurrencia.
      // La cabecera que traiga el navegador se descarta: la escribe el
      // cliente y le serviria para estrenar contador en cada peticion.
      headers.delete('x-forwarded-for')
      if (ipCliente) {
        headers.set('x-forwarded-for', ipCliente)
      }

      // El token viaja en una cookie HttpOnly y se traduce aqui a la cabecera
      // que espera el backend. Asi el navegador nunca lo tiene accesible.
      const token = cookies.get(ACCESS_COOKIE)?.value
      headers.delete('authorization')
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }

      const body =
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer()

      let backendResponse: Response
      try {
        backendResponse = await fetch(target, {
          method: request.method,
          headers,
          body,
          redirect: 'manual',
        })
      } catch {
        // Backend caido o inalcanzable: se responde un error con cuerpo JSON,
        // que es lo que el cliente sabe interpretar. Sin esto salia un 500
        // vacio y la interfaz no podia explicar nada.
        return new Response(
          JSON.stringify({ message: 'El servidor no esta disponible en este momento.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // Spring responde 403 cuando un JWT vencido deja la peticion como
      // anonima, de ahi que se contemplen los dos codigos. Se renueva una sola
      // vez y se repite la peticion original.
      const sesionCaducada = backendResponse.status === 401 || backendResponse.status === 403
      if (sesionCaducada && token && !url.pathname.startsWith('/api/v1/auth/')) {
        const renovacion = await renovarSesion(cookies, ipCliente)
        if (renovacion.token) {
          headers.set('authorization', `Bearer ${renovacion.token}`)
          backendResponse = await fetch(target, {
            method: request.method,
            headers,
            body,
            redirect: 'manual',
          })
        } else if (renovacion.fallo === 'refresh-invalido' || renovacion.fallo === 'sin-refresh') {
          // La sesion se acabo de verdad. Se traduce a 401 —y no se deja pasar
          // el 403 del backend— porque el navegador tiene que poder distinguir
          // "ya no estas autenticado" de "no tienes permiso para esto". Con los
          // dos casos llegando como 403, cualquier denegacion legitima cerraba
          // la sesion: un estudiante entraba, el dashboard de admin le devolvia
          // 403 y salia expulsado con "Tu sesion expiro".
          return new Response(
            JSON.stringify({ message: 'Tu sesion expiro. Vuelve a iniciar sesion.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          )
        } else if (renovacion.fallo === 'temporal') {
          // La sesion sigue siendo buena; el servidor no puede renovarla ahora
          // mismo. Devolver el 401/403 original haria que la interfaz mandase
          // al usuario a iniciar sesion y perdiera una sesion valida. Se
          // responde 503, que la interfaz trata como "vuelve a intentarlo".
          return new Response(
            JSON.stringify({
              message:
                'El servidor esta ocupado y no pudo renovar tu sesion. Vuelve a intentarlo en unos segundos.',
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          )
        }
      }

      return respuestaReenviada(backendResponse, backendResponse.body)
    }

    // Las rutas de sesion son endpoints JSON y tienen que seguir accesibles
    // sin sesion: son justamente las que la abren y la cierran. Redirigirlas
    // a /login dejaria al usuario sin poder autenticarse.
    if (url.pathname.startsWith('/auth/')) {
      return next()
    }

    const token = cookies.get(ACCESS_COOKIE)?.value
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
