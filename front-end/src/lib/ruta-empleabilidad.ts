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
