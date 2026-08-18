import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { APORTE_EN_PROCESO_RUTA, PESOS_RUTA, totalDeLaRuta } from './ruta-empleabilidad.ts'

/**
 * La ruta que ve el estudiante tiene que sumar lo mismo que el puntaje que
 * reporta el programa.
 *
 * <p>Estos pesos son una copia de `PuntajeEmpleabilidad.java`, que a su vez
 * copia la hoja de seguimiento. Una copia se desincroniza: si alguien cambia un
 * peso en el backend y no aquí, la ruta le diría al estudiante que va por el
 * 60% mientras el informe del programa dice otra cosa, y el primero en notarlo
 * sería él.
 *
 * <p>Sin red no se puede comparar contra el backend. Lo que sí se puede fijar
 * es la propiedad que se rompe en cuanto alguien toca un número suelto: que los
 * seis pasos sumen exactamente 100.
 */
describe('los pesos de la ruta de empleabilidad', () => {
  it('suman 100 entre los seis pasos', () => {
    assert.equal(totalDeLaRuta(), 100,
      'la ruta enseña el peso de cada paso; si no suman 100, el estudiante ve '
      + 'un recorrido que no cuadra con su porcentaje')
  })

  it('mantiene los valores de PuntajeEmpleabilidad.java', () => {
    // Copiados a mano del backend. Si allí cambian, este test falla y el
    // mensaje dice dónde mirar.
    assert.deepEqual({ ...PESOS_RUTA }, {
      perfilOcupacional: 15,
      cvListo: 15,
      cvIngles: 15,
      linkedinCreado: 10,
      linkedinOptimizado: 15,
      colocado: 30,
    }, 'ver back-end/src/main/java/com/novacrm/estudiante/PuntajeEmpleabilidad.java')
  })

  it('la colocación es el paso que más pesa', () => {
    // No es trivia: es lo que justifica que la colocación aparezca en la ruta
    // aunque el estudiante no pueda marcarla. Quitarla dejaría la suma en 70.
    const otros = Object.entries(PESOS_RUTA)
      .filter(([k]) => k !== 'colocado')
      .map(([, v]) => v)
    assert.ok(PESOS_RUTA.colocado > Math.max(...otros))
  })

  it('un hito a medias aporta lo mismo sea cual sea', () => {
    // La rareza heredada de la hoja: 7 puntos fijos, no la mitad del peso.
    // Está escrito para que nadie lo «arregle» a la mitad de cada peso.
    assert.equal(APORTE_EN_PROCESO_RUTA, 7)
    assert.notEqual(APORTE_EN_PROCESO_RUTA, PESOS_RUTA.cvListo / 2)
  })
})
