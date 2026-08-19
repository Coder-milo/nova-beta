import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { evaluarSeguridadContrasena } from './seguridad-contrasena.ts'

describe('evaluarSeguridadContrasena', () => {
  test('contraseñas vacías o muy cortas se clasifican como muy débiles o débiles', () => {
    const vacia = evaluarSeguridadContrasena('')
    assert.equal(vacia.nivel, 'muy_debil')
    assert.equal(vacia.puntaje, 0)

    const corta = evaluarSeguridadContrasena('Ab1!')
    assert.equal(corta.nivel, 'debil')
    assert.equal(corta.puntaje, 1)
  })

  test('contraseñas de 8 caracteres simples o predecibles', () => {
    const soloLetras = evaluarSeguridadContrasena('sololetrasminusculas')
    assert.equal(soloLetras.nivel, 'debil')

    const secuencia = evaluarSeguridadContrasena('12345678')
    assert.equal(secuencia.nivel, 'debil')
  })

  test('contraseñas de nivel medio', () => {
    const medio = evaluarSeguridadContrasena('Academia2026')
    assert.equal(medio.nivel, 'fuerte')

    const medioCorto = evaluarSeguridadContrasena('Clave123')
    assert.equal(medioCorto.nivel, 'medio')
  })

  test('contraseñas fuertes y robustas', () => {
    const fuerte = evaluarSeguridadContrasena('Nova@2026')
    assert.equal(fuerte.nivel, 'fuerte')
    assert.equal(fuerte.puntaje, 3)

    const muyFuerte = evaluarSeguridadContrasena('SuperNova_2026$SecurePass')
    assert.equal(muyFuerte.nivel, 'muy_fuerte')
    assert.equal(muyFuerte.puntaje, 4)
  })

  test('criterios individuales se evalúan fielmente', () => {
    const evalRes = evaluarSeguridadContrasena('Nova@2026')
    const critMap = Object.fromEntries(evalRes.criterios.map((c) => [c.id, c.cumplido]))

    assert.equal(critMap.longitud, true)
    assert.equal(critMap.letras, true)
    assert.equal(critMap.numeros, true)
    assert.equal(critMap.simbolos, true)
  })
})
