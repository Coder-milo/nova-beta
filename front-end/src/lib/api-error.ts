import type { ApiError } from './types'

/**
 * Un fallo que responde la API, con su código y su cuerpo.
 *
 * Vive en su propio módulo y no dentro de `api.ts` por una razón práctica: las
 * pruebas corren con `node --experimental-strip-types`, que no admite las
 * propiedades declaradas en el constructor —`constructor(public readonly …)`—
 * ni puede cargar `api.ts` entero, que arrastra `fetch` y la configuración del
 * entorno. Separarlo permite probar lo que decide qué texto lee una persona
 * cuando algo falla, que es de lo más visible que tiene la aplicación.
 */
export class ApiCallError extends Error {
  readonly status: number
  readonly body: ApiError

  constructor(status: number, body: ApiError, message?: string) {
    super(message ?? body?.message ?? `HTTP ${status}`)
    this.name = 'ApiCallError'
    this.status = status
    this.body = body
  }
}
