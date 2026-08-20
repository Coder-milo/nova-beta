/**
 * Espera a que el backend esté listo antes de subir archivos grandes.
 *
 * Render apaga las instancias gratuitas cuando no tienen tráfico. Mandar el
 * Excel durante ese arranque hace que el proxy responda 502 y obliga a elegir
 * el archivo otra vez. Un sondeo pequeño despierta el servicio sin transmitir
 * el archivo y evita perder esa interacción.
 */

const TRANSITORIOS = new Set([0, 502, 503, 504])

export interface OpcionesEsperaBackend {
  intentos?: number
  intervaloMs?: number
  sondear?: () => Promise<number>
  pausar?: (ms: number) => Promise<void>
}

async function sondearSalud(): Promise<number> {
  const controlador = new AbortController()
  const limite = setTimeout(() => controlador.abort(), 8_000)
  try {
    const respuesta = await fetch('/api/_health', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controlador.signal,
    })
    return respuesta.status
  } catch {
    // Cero representa una petición sin respuesta (timeout o red interrumpida).
    return 0
  } finally {
    clearTimeout(limite)
  }
}

const pausaReal = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Resuelve cuando el backend deja de responder con un estado de arranque.
 * Un 401/403/404 también demuestra que Spring ya está atendiendo peticiones;
 * la llamada real será quien traduzca después ese resultado concreto.
 */
export async function esperarBackendDisponible(
  opciones: OpcionesEsperaBackend = {},
): Promise<void> {
  const intentos = Math.max(1, opciones.intentos ?? 30)
  const intervaloMs = Math.max(0, opciones.intervaloMs ?? 5_000)
  const sondear = opciones.sondear ?? sondearSalud
  const pausar = opciones.pausar ?? pausaReal

  for (let intento = 0; intento < intentos; intento++) {
    const estado = await sondear()
    if (!TRANSITORIOS.has(estado)) return
    if (intento < intentos - 1) await pausar(intervaloMs)
  }

  throw new Error('El backend no terminó de iniciar dentro del tiempo esperado')
}

export function esFalloTransitorioDelBackend(estado: number): boolean {
  return TRANSITORIOS.has(estado)
}
