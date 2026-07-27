/**
 * Alta y cierre de sesion.
 *
 * El login pasa por aqui y no por el proxy generico de /api para que la
 * respuesta del backend —que incluye los tokens— nunca llegue al navegador:
 * los tokens se quedan en cookies HttpOnly y al cliente solo se le devuelve
 * el usuario que necesita para pintar la interfaz.
 */

import type { APIRoute } from 'astro'
import {
  backendBase,
  borrarSesion,
  cabecerasHaciaBackend,
  guardarSesion,
  resolverIpCliente,
  soloDatosDeUsuario,
} from '@/lib/server/session'

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  let credenciales: { email?: string; password?: string }
  try {
    credenciales = await request.json()
  } catch {
    return json({ message: 'Peticion invalida' }, 400)
  }

  let respuesta: Response
  try {
    respuesta = await fetch(new URL('/api/v1/auth/login', backendBase()), {
      method: 'POST',
      // La IP real del cliente. Esta ruta no pasa por el proxy de /api, que es
      // quien la reenvia; sin esto el backend veia la IP de este servidor para
      // todo el mundo y aplicaba un unico contador de cinco intentos por minuto
      // a los 108 estudiantes juntos.
      headers: cabecerasHaciaBackend(resolverIpCliente(request, clientAddress)),
      body: JSON.stringify({
        email: credenciales.email,
        password: credenciales.password,
      }),
    })
  } catch {
    // El backend no responde. Sin esto Astro devolvia un 500 sin cuerpo y la
    // pantalla de login se quedaba sin explicar que habia pasado.
    return json(
      { message: 'No se pudo contactar con el servidor. Intentalo de nuevo en unos minutos.' },
      503,
    )
  }

  const cuerpo = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    // Se reenvia el error del backend tal cual (credenciales invalidas,
    // usuario inactivo, 429 por rate limit...) sin anadir detalle.
    return json(cuerpo ?? { message: 'No se pudo iniciar sesion' }, respuesta.status)
  }

  guardarSesion(cookies, cuerpo.token, cuerpo.refreshToken)
  return json(soloDatosDeUsuario(cuerpo), 200)
}

export const DELETE: APIRoute = async ({ cookies }) => {
  borrarSesion(cookies)
  return json({ mensaje: 'Sesion cerrada' }, 200)
}
