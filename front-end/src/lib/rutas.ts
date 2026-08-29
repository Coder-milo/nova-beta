import type { ComponentType } from 'react'

/**
 * Registro único de rutas y su carga diferida.
 *
 * Antes cada `import()` vivía dentro de `CrmApp`, envuelto en `lazy()`. Eso
 * bastaba para partir el bundle, pero dejaba la carga atada al render: el
 * chunk de una pantalla no empezaba a bajar hasta que ya se estaba navegando
 * a ella, y el usuario veía el spinner mientras la red hacía su trabajo.
 *
 * Sacando los cargadores aquí, el enlace puede pedirlos antes: al pasar el
 * ratón por encima (ver `precargarRuta`, que usa `next-link`). Cuando llega
 * el clic el módulo ya está en memoria y la pantalla aparece sin espera.
 *
 * `CrmApp` sigue siendo quien los envuelve en `lazy()`; aquí solo viven las
 * funciones que importan, para que precarga y render usen exactamente el
 * mismo módulo y el navegador reutilice la misma promesa.
 */
export type CargadorDeRuta = () => Promise<{ default: ComponentType<any> }>

/** Rutas que se resuelven por coincidencia exacta del pathname. */
export const cargadoresDeRuta: Record<string, CargadorDeRuta> = {
  '/': () => import('@/app/page'),
  '/agenda': () => import('@/app/agenda/page'),
  '/auditoria': () => import('@/app/auditoria/page'),
  '/comunicaciones': () => import('@/app/comunicaciones/page'),
  '/colocaciones': () => import('@/app/colocaciones/page'),
  '/configuracion': () => import('@/app/configuracion/page'),
  '/documentos': () => import('@/app/documentos/page'),
  '/desarrollador': () => import('@/app/desarrollador/page'),
  '/empresas': () => import('@/app/empresas/page'),
  '/estudiantes': () => import('@/app/estudiantes/page'),
  '/estudiantes/nuevo': () => import('@/app/estudiantes/nuevo/page'),
  '/hojas-de-vida': () => import('@/app/hojas-de-vida/page'),
  '/importaciones': () => import('@/app/importaciones/page'),
  '/login': () => import('@/app/login/page'),
  '/portal-estudiante': () => import('@/app/inicio-estudiante/page'),
  // Portal de empresas. Cuelga de `/portal` para que la separación con el panel
  // se vea en la URL y coincida con la del backend (`/api/v1/portal`).
  '/portal/vacantes': () => import('@/app/portal/vacantes/page'),
  '/portal/postulantes': () => import('@/app/portal/postulantes/page'),
  '/portal/cuenta': () => import('@/app/portal/cuenta/page'),
  '/postulaciones': () => import('@/app/postulaciones/page'),
  // Pública: no cuelga de /portal porque no es del portal de empresas. A esto
  // se llega sin cuenta, y el portal es justo lo que exige tenerla.
  '/publicar-vacante': () => import('@/app/publicar-vacante/page'),
  '/power-bi': () => import('@/app/power-bi/page'),
  '/proyectos': () => import('@/app/proyectos/page'),
  '/recuperar-contrasena': () => import('@/app/recuperar-contrasena/page'),
  '/reportes': () => import('@/app/reportes/page'),
  '/reportes-chat': () => import('@/app/reportes-chat/page'),
  '/seguimiento': () => import('@/app/seguimiento/page'),
  '/vacantes': () => import('@/app/vacantes/page'),
  // Compatibilidad para enlaces guardados: el perfil ahora vive en Configuración.
  '/mi-perfil': () => import('@/app/configuracion-estudiante/page'),
  '/mi-proceso': () => import('@/app/mi-proceso/page'),
  '/mis-actividades': () => import('@/app/mis-actividades/page'),
  '/mis-documentos': () => import('@/app/mis-documentos/page'),
  '/mi-hoja-de-vida': () => import('@/app/mi-hoja-de-vida/page'),
  '/mis-postulaciones': () => import('@/app/mis-postulaciones/page'),
  '/mi-calendario': () => import('@/app/mi-calendario/page'),
  '/mis-mensajes': () => import('@/app/mis-mensajes/page'),
  '/mis-notificaciones': () => import('@/app/mis-notificaciones/page'),
  '/ayuda-estudiante': () => import('@/app/ayuda-estudiante/page'),
  '/configuracion-estudiante': () => import('@/app/configuracion-estudiante/page'),
}

/** Rutas con parámetro en la URL. El orden no importa: los patrones no se solapan. */
export const cargadoresPorPatron: ReadonlyArray<[RegExp, CargadorDeRuta]> = [
  [/^\/estudiantes\/[^/]+$/, () => import('@/app/estudiantes/[id]/page')],
  [/^\/proyectos\/[^/]+$/, () => import('@/app/proyectos/[id]/page')],
]

/** Quita la barra final para que `/estudiantes/` y `/estudiantes` sean la misma ruta. */
export function normalizarRuta(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function resolverCargador(pathname: string): CargadorDeRuta | undefined {
  const normalizada = normalizarRuta(pathname)
  const exacto = cargadoresDeRuta[normalizada]
  if (exacto) return exacto
  return cargadoresPorPatron.find(([patron]) => patron.test(normalizada))?.[1]
}

/**
 * Rutas cuyo chunk ya se pidió.
 *
 * El navegador cachea el módulo, así que repetir el `import()` no vuelve a la
 * red; el conjunto está para no rehacer el trabajo de resolver la ruta en cada
 * `mouseenter`, que en una lista larga se dispara muchas veces por segundo.
 */
const rutasPrecargadas = new Set<string>()

/**
 * Adelanta el chunk de una ruta sin navegar a ella.
 *
 * Se llama al apuntar un enlace. Si falla —red caída, despliegue nuevo que
 * borró el chunk viejo— se ignora a propósito: es una optimización, y el
 * clic real volverá a intentarlo con el manejo de errores de `lazyRetry`.
 */
export function precargarRuta(href: string): void {
  if (typeof window === 'undefined') return

  let pathname: string
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return
    pathname = url.pathname
  } catch {
    return
  }

  const normalizada = normalizarRuta(pathname)
  if (rutasPrecargadas.has(normalizada)) return

  const cargar = resolverCargador(normalizada)
  if (!cargar) return

  rutasPrecargadas.add(normalizada)
  void cargar().catch(() => {
    rutasPrecargadas.delete(normalizada)
  })
}
