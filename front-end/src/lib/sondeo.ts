/**
 * Temporizadores que sólo trabajan mientras alguien está mirando.
 */

/**
 * Tras volver a la pestaña no se repite la tarea si acaba de ejecutarse.
 * Cambiar de pestaña varias veces seguidas no debería disparar una petición
 * por cada cambio.
 */
const MINIMO_ENTRE_VUELTAS_MS = 10_000

/**
 * Repite `tarea` cada `milisegundos`, pero sólo mientras la pestaña se ve.
 *
 * Con `setInterval` a secas, una pestaña olvidada en segundo plano sigue
 * pidiendo datos toda la tarde: nadie los mira y aun así cuentan contra el
 * límite de la API y despiertan la base de datos. Y al volver a la pestaña
 * había que esperar hasta un ciclo entero para ver algo al día, que es justo
 * el momento en que sí importa; por eso, al volver a primer plano, la tarea
 * se ejecuta de inmediato.
 *
 * Quien llama suele ejecutar la tarea una vez antes de programarla, así que
 * aquí se cuenta como si acabara de ejecutarse.
 *
 * @returns la función para detenerlo, lista para devolver desde un `useEffect`.
 */
export function intervaloVisible(tarea: () => void, milisegundos: number): () => void {
  const sePuedeVer = () => typeof document === 'undefined' || !document.hidden
  let ultimaEjecucion = Date.now()

  const ejecutar = () => {
    if (!sePuedeVer()) return
    ultimaEjecucion = Date.now()
    tarea()
  }

  const alCambiarVisibilidad = () => {
    if (!sePuedeVer()) return
    if (Date.now() - ultimaEjecucion < MINIMO_ENTRE_VUELTAS_MS) return
    ejecutar()
  }

  const id = window.setInterval(ejecutar, milisegundos)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)

  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  }
}
