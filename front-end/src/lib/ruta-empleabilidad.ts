import type { EstadoHito, EstudianteResponse } from './types'

/**
 * Cuánto aporta cada paso al «% de empleabilidad» del programa.
 *
 * <p>No son números de diseño: replican `PuntajeEmpleabilidad` del backend, que
 * a su vez replica la fórmula de la hoja de seguimiento con la que el programa
 * reporta a su financiador. Por eso están aquí y no dentro del componente: son
 * dato del dominio, y el componente solo los pinta.
 *
 * <p>Si allí cambian, aquí quedan desfasados. El test de al lado comprueba lo
 * único que se puede comprobar sin red —que sumen 100— y deja escrito de dónde
 * salen, para que quien toque una cosa encuentre la otra.
 */
export const PESOS_RUTA = {
  perfilOcupacional: 15,
  cvListo: 15,
  cvIngles: 15,
  linkedinCreado: 10,
  linkedinOptimizado: 15,
  /** Casi un tercio. Lo registra el equipo con el contrato, no el estudiante. */
  colocado: 30,
} as const

export type PasoRutaId = keyof typeof PESOS_RUTA

/**
 * Lo que suma un hito a medias, en puntos.
 *
 * <p>Es un valor fijo e igual para los cinco hitos, no la mitad del peso de
 * cada uno. Es una rareza heredada de la hoja —un único `IF` copiado a las
 * cinco columnas— y se conserva porque cambiarla movería el promedio publicado.
 */
export const APORTE_EN_PROCESO_RUTA = 7

/** La suma de los seis pasos. Tiene que ser 100 o la ruta miente. */
export function totalDeLaRuta(): number {
  return Object.values(PESOS_RUTA).reduce((a, b) => a + b, 0)
}

/**
 * Calcula el porcentaje de empleabilidad idéntico a PuntajeEmpleabilidad.java del backend.
 * Devuelve un número entero entre 0 y 100.
 */
export function calcularPorcentajeEmpleabilidad(perfil: {
  hitoCvListo?: EstadoHito | null
  hitoCvIngles?: EstadoHito | null
  hitoLinkedinCreado?: EstadoHito | null
  hitoLinkedinOptimizado?: EstadoHito | null
  hitoPerfilOcupacional?: EstadoHito | null
  colocado?: boolean | null
  [key: string]: unknown
}): number {
  const aporte = (estado: EstadoHito | null | undefined, peso: number): number => {
    if (!estado) return 0
    if (estado === 'SI') return peso
    if (estado === 'EN_PROCESO') return APORTE_EN_PROCESO_RUTA
    return 0
  }

  let total = 0
  total += aporte(perfil.hitoPerfilOcupacional, PESOS_RUTA.perfilOcupacional)
  total += aporte(perfil.hitoCvListo, PESOS_RUTA.cvListo)
  total += aporte(perfil.hitoCvIngles, PESOS_RUTA.cvIngles)
  total += aporte(perfil.hitoLinkedinCreado, PESOS_RUTA.linkedinCreado)
  total += aporte(perfil.hitoLinkedinOptimizado, PESOS_RUTA.linkedinOptimizado)
  if (perfil.colocado) {
    total += PESOS_RUTA.colocado
  }

  return Math.min(100, Math.max(0, Math.floor(total)))
}

/**
 * Determina el id del siguiente paso activo en la ruta.
 * Es el primer paso no completado (distinto de 'SI') que no sea nulo.
 */
export function determinarSiguientePaso(
  pasos: Array<{ id: string; estado: EstadoHito; href?: string | null }>,
): string | null {
  return pasos.find((p) => p.estado !== 'SI' && p.href !== null)?.id ?? null
}

/**
 * Determina el siguiente paso a partir del objeto de perfil del estudiante.
 */
export function determinarSiguientePasoEstudiante(
  perfil: Pick<
    EstudianteResponse,
    | 'hitoPerfilOcupacional'
    | 'hitoCvListo'
    | 'hitoCvIngles'
    | 'hitoLinkedinCreado'
    | 'hitoLinkedinOptimizado'
    | 'colocado'
  >,
): PasoRutaId | null {
  const orden: Array<{ id: PasoRutaId; estado: EstadoHito; accionable: boolean }> = [
    { id: 'perfilOcupacional', estado: perfil.hitoPerfilOcupacional, accionable: true },
    { id: 'cvListo', estado: perfil.hitoCvListo, accionable: true },
    { id: 'cvIngles', estado: perfil.hitoCvIngles, accionable: true },
    { id: 'linkedinCreado', estado: perfil.hitoLinkedinCreado, accionable: true },
    { id: 'linkedinOptimizado', estado: perfil.hitoLinkedinOptimizado, accionable: true },
    { id: 'colocado', estado: perfil.colocado ? 'SI' : 'NO', accionable: false },
  ]

  const siguienteAccionable = orden.find((p) => p.estado !== 'SI' && p.accionable)
  if (siguienteAccionable) return siguienteAccionable.id
  if (!perfil.colocado) return 'colocado'
  return null
}

/**
 * Normaliza una URL de LinkedIn para asegurar un formato consistente (https://www.linkedin.com/in/...).
 * Si viene vacía o solo con espacios, devuelve "".
 */
export function normalizarUrlLinkedin(url: string | null | undefined): string {
  if (!url) return ''
  let limpia = url.trim()
  if (!limpia) return ''

  // Eliminar espacios y slash final
  limpia = limpia.replace(/\/+$/, '')

  // Si no empieza con protocolo, agregarlo; si es http, pasarlo a https
  if (!/^https?:\/\//i.test(limpia)) {
    limpia = `https://${limpia}`
  } else {
    limpia = limpia.replace(/^http:\/\//i, 'https://')
  }

  // Preservar subdominios de país (ej. co.linkedin.com, es.linkedin.com) o asignar www.linkedin.com
  limpia = limpia.replace(/^https:\/\/(?!www\.)([a-z]{2}\.)?linkedin\.com/i, (_match, country) => {
    return country ? `https://${country}linkedin.com` : 'https://www.linkedin.com'
  })

  return limpia
}

/**
 * Valida si una URL de LinkedIn es aceptable.
 * Admite enlaces vacíos (para cuando se desea borrar el perfil).
 */
export function validarUrlLinkedin(url: string | null | undefined): { valido: boolean; mensaje?: string } {
  if (!url || !url.trim()) {
    return { valido: true }
  }
  const normalizada = normalizarUrlLinkedin(url)
  const esLinkedin = /^https:\/\/(www\.|[a-z]{2}\.)?linkedin\.com\/(in|company|school)\/[\p{L}\p{N}_.\-%]+([/?#].*)?$/iu.test(normalizada)
  if (!esLinkedin) {
    return {
      valido: false,
      mensaje: 'Ingresa un enlace válido de LinkedIn (ej. https://www.linkedin.com/in/tu-nombre)',
    }
  }
  return { valido: true }
}

/**
 * Simula la sincronización bidireccional de hitos del backend EstudianteService.sincronizarHitosConDatosReales.
 * Permite predecir y probar de forma determinista cómo cambian los hitos ante cambios locales.
 */
export function simularSincronizacionHitos(
  actual: {
    cargoObjetivo?: string | null
    perfilProfesional?: string | null
    linkedinUrl?: string | null
    hitoPerfilOcupacional?: EstadoHito
    hitoLinkedinCreado?: EstadoHito
    hitoLinkedinOptimizado?: EstadoHito
  },
  cambios: {
    cargoObjetivo?: string | null
    perfilProfesional?: string | null
    linkedinUrl?: string | null
  },
) {
  const cargo = cambios.cargoObjetivo !== undefined ? cambios.cargoObjetivo : actual.cargoObjetivo
  const perfil = cambios.perfilProfesional !== undefined ? cambios.perfilProfesional : actual.perfilProfesional
  const linkedin = cambios.linkedinUrl !== undefined ? cambios.linkedinUrl : actual.linkedinUrl

  const tienePerfilOcupacional = Boolean(
    (cargo && cargo.trim().length > 0) || (perfil && perfil.trim().length > 0),
  )

  let hitoPerfilOcupacional: EstadoHito = actual.hitoPerfilOcupacional ?? 'NO'
  if (!tienePerfilOcupacional) {
    hitoPerfilOcupacional = 'NO'
  } else if (hitoPerfilOcupacional === 'NO') {
    hitoPerfilOcupacional = 'SI'
  }

  const tieneLinkedin = Boolean(linkedin && linkedin.trim().length > 0)
  let hitoLinkedinCreado: EstadoHito = actual.hitoLinkedinCreado ?? 'NO'
  let hitoLinkedinOptimizado: EstadoHito = actual.hitoLinkedinOptimizado ?? 'NO'

  if (!tieneLinkedin) {
    hitoLinkedinCreado = 'NO'
    hitoLinkedinOptimizado = 'NO'
  } else if (hitoLinkedinCreado === 'NO') {
    hitoLinkedinCreado = 'SI'
  }

  return {
    cargoObjetivo: cargo ? cargo.trim() : '',
    perfilProfesional: perfil ? perfil.trim() : '',
    linkedinUrl: linkedin ? normalizarUrlLinkedin(linkedin) : '',
    hitoPerfilOcupacional,
    hitoLinkedinCreado,
    hitoLinkedinOptimizado,
  }
}
