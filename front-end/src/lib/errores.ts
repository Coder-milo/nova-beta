import { ApiCallError } from './api'

/**
 * Traduce un fallo de la API a algo que el usuario pueda leer.
 *
 * <p>Estaba copiado en nueve pantallas con textos distintos para el mismo
 * código, y en dos de ellas 403 decía "tu sesión expiró" —que es justo lo que
 * no significa—. Aquí se decide una vez:
 *
 * - **401** no se traduce con detalle porque el usuario no llega a verlo: lo
 *   intercepta `api.ts`, que cierra la sesión y manda a `/login`.
 * - **403** es "estás dentro pero esto no es para ti". Nunca sugerir volver a
 *   iniciar sesión: hacerlo empujaba a la gente a salirse sin motivo.
 * - **503** es pasajero. Merece "reintenta", no "algo salió mal".
 */
export function errorDe(err: unknown, respaldo = 'No se pudo completar la acción.'): string {
  if (err instanceof ApiCallError) {
    // El mensaje del backend es el bueno cuando existe: lo escribe quien sabe
    // por qué falló (validaciones de dominio, reglas de negocio).
    const delServidor = err.body?.message
    if (delServidor) return delServidor

    switch (err.status) {
      case 400:
        return 'Hay datos incompletos o con formato inválido.'
      case 403:
        return 'No tienes permisos para esta acción.'
      case 404:
        return 'No se encontró lo que buscabas. Puede que alguien lo haya borrado.'
      case 409:
        return 'Ese registro ya existe.'
      case 429:
        return 'Demasiadas peticiones seguidas. Espera un momento.'
      case 503:
        return 'El servidor está ocupado. Vuelve a intentarlo en unos segundos.'
      default:
        return `${respaldo} (HTTP ${err.status})`
    }
  }
  return 'No se pudo conectar con el servidor.'
}

/** Igual, pero diciendo qué rol hace falta. Para pantallas solo de gestión. */
export function errorDeGestion(err: unknown): string {
  if (err instanceof ApiCallError && err.status === 403 && !err.body?.message) {
    return 'Necesitas rol COORDINADOR o ADMIN.'
  }
  return errorDe(err)
}
