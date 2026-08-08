import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { normalizarParaBuscar, normalizarDocumento } from './texto.ts'

/**
 * Los mismos casos que fija `ClaveNormalizadaTest` en el backend.
 *
 * Se repiten a propósito: la regla vive tres veces —en SQL, en Java y aquí— y
 * lo único que impide que se separen es que las tres pruebas exijan lo mismo.
 * En esta cohorte 48 de los 108 nombres llevan tilde, así que una divergencia
 * no es teórica: deja fuera a casi la mitad de la lista en una pestaña y no en
 * la otra.
 */
describe('normalizarParaBuscar', () => {
  test('mayúsculas, tildes y signos dejan de distinguir un nombre', () => {
    const esperado = 'jose andres perez gomez'
    assert.equal(normalizarParaBuscar('José Andrés Pérez Gómez'), esperado)
    assert.equal(normalizarParaBuscar('JOSE ANDRES PEREZ GOMEZ'), esperado)
    assert.equal(normalizarParaBuscar('  josé   andrés  pérez-gómez  '), esperado)
  })

  test('coincide con lo que devuelve la función SQL', () => {
    // Verificado contra Postgres: novacrm_normalizar('José  PÉREZ-Gómez').
    assert.equal(normalizarParaBuscar('José  PÉREZ-Gómez'), 'jose perez gomez')
  })

  test('dos personas distintas siguen siendo distintas', () => {
    assert.notEqual(
      normalizarParaBuscar('Ana María Pérez'),
      normalizarParaBuscar('Ana Maria Perez Gómez'),
    )
    // Las partículas forman parte del apellido y no se quitan.
    assert.notEqual(
      normalizarParaBuscar('Juan de la Cruz'),
      normalizarParaBuscar('Juan Cruz'),
    )
  })

  test('el espacio separa: un guion no es lo mismo que pegar las palabras', () => {
    assert.equal(normalizarParaBuscar('Perez-Gomez'), normalizarParaBuscar('Perez Gomez'))
    assert.notEqual(normalizarParaBuscar('Perez Gomez'), normalizarParaBuscar('Perezgomez'))
  })

  test('los dígitos sobreviven', () => {
    // Si el rango de diacríticos estuviera mal escrito, esto se comería los
    // números: fue exactamente el error que casi se cuela al escribirlo.
    assert.equal(normalizarParaBuscar('CC 1.234.567'), 'cc 1 234 567')
  })

  test('vacío y sólo signos dan cadena vacía', () => {
    assert.equal(normalizarParaBuscar('   '), '')
    assert.equal(normalizarParaBuscar('...---'), '')
  })
})

describe('normalizarDocumento', () => {
  test('pierde los puntos de miles sin partirse en trozos', () => {
    assert.equal(normalizarDocumento('1.234.567'), '1234567')
    assert.equal(normalizarDocumento(' 1234567 '), '1234567')
    assert.equal(normalizarDocumento('CC-1234567'), 'cc1234567')
  })

  test('las dos formas del mismo documento coinciden', () => {
    assert.equal(normalizarDocumento('1.234.567'), normalizarDocumento('1234567'))
  })
})
