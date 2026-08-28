/**
 * Manejo de la sesion en el servidor.
 *
 * Los tokens viven en cookies HttpOnly: el JavaScript de la pagina no puede
 * leerlos, asi que un XSS no puede robarlos. Antes se guardaban en
 * localStorage y ademas se copiaban a una cookie escrita desde JS —que por
 * definicion no puede ser HttpOnly y no llevaba el flag Secure—, con lo que el
 * refresh token, valido durante siete dias, quedaba al alcance de cualquier
 * script inyectado.
 *
 * Este modulo solo debe importarse desde codigo de servidor (middleware y
 * rutas de API de Astro).
 */

import type { AstroCookies } from 'astro'

export const ACCESS_COOKIE = 'nova_token'
export const REFRESH_COOKIE = 'nova_refresh'

/** 8 horas: la misma vigencia que el access token del backend. */
const ACCESS_MAX_AGE = 60 * 60 * 8
/** 7 dias: la misma vigencia que el refresh token del backend. */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

/**
 * A dónde se reenvían las llamadas de `/api/**`.
 *
 * <p>Se mira `process.env` antes que `import.meta.env` porque Vite sustituye
 * `import.meta.env.BACKEND_URL` **en tiempo de compilación**: si el valor no
 * estaba puesto al construir, queda congelado como `undefined` en el bundle y
 * la función desplegada se pone a llamar a `localhost:8080`, que en un entorno
 * serverless no es nadie. Leyendo `process.env` primero, cambiar la URL del
 * backend en el panel del proveedor surte efecto sin volver a compilar.
 */
export function backendBase(): string {
  const desdeEntorno =
    (typeof process !== 'undefined' ? process.env?.BACKEND_URL : undefined) ??
    import.meta.env.BACKEND_URL

  if (!desdeEntorno) {
    return 'http://app:8080'
  }
  return desdeEntorno.endsWith('/') ? desdeEntorno.slice(0, -1) : desdeEntorno
}

function opcionesBase() {
  const frontendUrl =
    (typeof process !== 'undefined' ? process.env?.FRONTEND_URL : undefined) ??
    import.meta.env.FRONTEND_URL ??
    ''
  const isHttps =
    process.env.COOKIE_SECURE === 'true' ||
    frontendUrl.startsWith('https://')

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
  }
}

export function guardarSesion(cookies: AstroCookies, token: string, refreshToken?: string): void {
  cookies.set(ACCESS_COOKIE, token, { ...opcionesBase(), maxAge: ACCESS_MAX_AGE })
  if (refreshToken) {
    cookies.set(REFRESH_COOKIE, refreshToken, { ...opcionesBase(), maxAge: REFRESH_MAX_AGE })
  }
}

export function borrarSesion(cookies: AstroCookies): void {
  cookies.delete(ACCESS_COOKIE, { path: '/' })
  cookies.delete(REFRESH_COOKIE, { path: '/' })
}

/** Datos de usuario que la interfaz necesita mostrar. Nunca incluye tokens. */
export interface UsuarioSesion {
  usuarioId: string
  email: string
  nombre: string
  roles: string[]
}

interface RespuestaLogin extends UsuarioSesion {
  token: string
  refreshToken: string
}

export function soloDatosDeUsuario(respuesta: RespuestaLogin): UsuarioSesion {
  return {
    usuarioId: respuesta.usuarioId,
    email: respuesta.email,
    nombre: respuesta.nombre,
    roles: respuesta.roles,
  }
}

/**
 * Si hay que creerse el `X-Forwarded-For` que llega a este servidor.
 *
 * En desarrollo el navegador habla directamente con Astro, asi que la cabecera
 * la escribe el cliente y no vale nada. En produccion Astro va detras del
 * balanceador de Render, que es quien la pone: ahi es la unica forma de saber
 * quien esta al otro lado. Por eso es una decision de despliegue y viene
 * desactivada por defecto: creersela sin proxy delante permite a cualquiera
 * estrenar contador de rate limit en cada peticion.
 */
function seConfiaEnElProxy(): boolean {
  return import.meta.env.TRUST_PROXY_HEADERS === 'true'
}

/**
 * La IP real de quien hace la peticion.
 *
 * <p>`clientAddress` de Astro es la direccion del socket, y detras de un
 * balanceador esa direccion es la del balanceador: la misma para todo el
 * mundo. Si el backend recibe esa, los 108 estudiantes vuelven a compartir un
 * unico contador y basta con que cinco entren en el mismo minuto para que el
 * sexto reciba un 429.
 *
 * <p>Se toma la entrada **de mas a la derecha** del `X-Forwarded-For`: cada
 * proxy anade la direccion desde la que le llego la peticion, asi que con un
 * unico proxy de confianza delante, la ultima es la que ese proxy vio y las
 * anteriores pudo escribirlas el cliente.
 */
export function resolverIpCliente(request: Request, clientAddress?: string): string | undefined {
  if (!seConfiaEnElProxy()) {
    return clientAddress
  }
  const reenviadas = request.headers.get('x-forwarded-for')
  if (!reenviadas) {
    return clientAddress
  }
  const ultima = reenviadas
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0)
    .pop()
  return ultima ?? clientAddress
}

/**
 * Cabeceras para hablar con el backend desde el servidor.
 *
 * La IP del cliente es obligatoria: el backend limita por IP y todas estas
 * llamadas salen de este mismo servidor. Sin reenviarla, los 108 estudiantes
 * comparten un unico contador.
 */
export function cabecerasHaciaBackend(ipCliente?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ipCliente) {
    headers['x-forwarded-for'] = ipCliente
  }
  return headers
}

/** Por que no se pudo renovar. La diferencia decide si se cierra la sesion. */
export type FalloRenovacion = 'sin-refresh' | 'refresh-invalido' | 'temporal'

export interface ResultadoRenovacion {
  token: string | null
  refreshToken?: string
  fallo?: FalloRenovacion
}

/**
 * Refrescos en vuelo, uno por refresh token.
 *
 * <p>Una pagina que carga con el access token vencido dispara varias llamadas
 * al proxy a la vez, y cada una veia un 401 y llamaba a renovarSesion con el
 * mismo refresh token. El backend rota el token en cada refresh: ganaba uno y
 * los demas recibian 400, borraban la sesion que aquel acababa de renovar y el
 * usuario salia expulsado al azar. Compartiendo la peticion de red, un solo
 * refresh por token y todas las llamadas esperan el mismo resultado.
 */
const refrescosEnVuelo = new Map<string, Promise<ResultadoRenovacion>>()

/**
 * Canjea el refresh token por uno nuevo.
 *
 * <p>Distingue dos fracasos que antes se trataban igual y no lo son:
 *
 * - **El refresh ya no vale** (400/401/403): la sesion se acabo, se borra.
 * - **Algo temporal** (429, 5xx, red caida): el refresh sigue siendo bueno.
 *   Borrar la sesion aqui era el nucleo del bucle: un 429 por rate limit
 *   destruia una sesion valida de siete dias, mandaba al usuario a /login, y
 *   alli su intento de entrar chocaba con el mismo contador agotado. El
 *   mensaje que veia era "Demasiados intentos", que no explicaba nada.
 */
export async function renovarSesion(
  cookies: AstroCookies,
  clientAddress?: string,
): Promise<ResultadoRenovacion> {
  const refreshToken = cookies.get(REFRESH_COOKIE)?.value
  if (!refreshToken) return { token: null, fallo: 'sin-refresh' }

  let enVuelo = refrescosEnVuelo.get(refreshToken)
  if (!enVuelo) {
    enVuelo = ejecutarRefresh(refreshToken, clientAddress)
      .finally(() => refrescosEnVuelo.delete(refreshToken))
    refrescosEnVuelo.set(refreshToken, enVuelo)
  }

  const resultado = await enVuelo
  // Las cookies son por peticion: cada llamada aplica el resultado a las suyas.
  if (resultado.fallo === 'refresh-invalido') {
    borrarSesion(cookies)
  } else if (resultado.token && resultado.refreshToken) {
    guardarSesion(cookies, resultado.token, resultado.refreshToken)
  }
  return resultado
}

/** La llamada de red al backend, sin tocar cookies: la comparten varias peticiones. */
async function ejecutarRefresh(
  refreshToken: string,
  clientAddress?: string,
): Promise<ResultadoRenovacion> {
  let respuesta: Response
  try {
    respuesta = await fetch(new URL('/api/v1/auth/refresh', backendBase()), {
      method: 'POST',
      headers: cabecerasHaciaBackend(clientAddress),
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    // Backend inalcanzable. La sesion no tiene la culpa.
    return { token: null, fallo: 'temporal' }
  }

  // El backend responde 400 cuando el refresh no vale (lanza BusinessException,
  // no una excepcion de seguridad), asi que 400 cuenta como token invalido y no
  // como error temporal. Se incluyen 401 y 403 por si algun dia se corrige a un
  // codigo mas apropiado: la clasificacion seguiria siendo correcta.
  if (respuesta.status === 400 || respuesta.status === 401 || respuesta.status === 403) {
    return { token: null, fallo: 'refresh-invalido' }
  }

  // 429, 5xx: el refresh sigue valido, es el servidor el que no puede ahora.
  if (!respuesta.ok) {
    return { token: null, fallo: 'temporal' }
  }

  const renovado = (await respuesta.json()) as RespuestaLogin
  return { token: renovado.token, refreshToken: renovado.refreshToken }
}
