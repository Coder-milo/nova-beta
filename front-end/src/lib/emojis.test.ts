import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buscarEmojis, normalizarBusqueda, CATEGORIAS_EMOJI, TODOS_LOS_EMOJIS } from './emojis.ts'

/**
 * La búsqueda del selector de emojis.
 *
 * Es lo único con lógica del componente: el resto es pintar una rejilla. Y es
 * donde se nota si funciona, porque quien escribe rápido no pone la tilde de
 * «corazón» ni sabe que el suyo se llama «grinning face».
 */
describe('buscar emojis', () => {
  it('encuentra sin tilde lo que se llama con tilde', () => {
    assert.deepEqual(buscarEmojis('corazon').map((e) => e.char).includes('❤️'), true)
    assert.deepEqual(buscarEmojis('corazón').map((e) => e.char).includes('❤️'), true)
  })

  it('busca en español y en inglés, que el portal tiene los dos idiomas', () => {
    assert.equal(buscarEmojis('trabajo').some((e) => e.char === '💼'), true)
    assert.equal(buscarEmojis('job').some((e) => e.char === '💼'), true)
  })

  it('no distingue mayúsculas', () => {
    assert.equal(buscarEmojis('COLOMBIA').some((e) => e.char === '🇨🇴'), true)
  })

  it('sin término no devuelve todo el catálogo', () => {
    assert.deepEqual(buscarEmojis(''), [])
    assert.deepEqual(buscarEmojis('   '), [])
  })

  it('lo que no existe no devuelve nada, en vez de devolver cualquier cosa', () => {
    assert.deepEqual(buscarEmojis('zzzzzz'), [])
  })

  it('pegar un emoji en el buscador lo encuentra', () => {
    assert.equal(buscarEmojis('🔥').some((e) => e.char === '🔥'), true)
  })
})

describe('catálogo', () => {
  it('no repite el mismo emoji en dos categorías', () => {
    const vistos = new Set<string>()
    for (const e of TODOS_LOS_EMOJIS) {
      assert.equal(vistos.has(e.char), false, `repetido: ${e.char}`)
      vistos.add(e.char)
    }
  })

  it('cada emoji tiene al menos una palabra para encontrarlo', () => {
    for (const e of TODOS_LOS_EMOJIS) {
      assert.equal(e.claves.trim().length > 0, true, `sin claves: ${e.char}`)
    }
  })

  it('las categorías tienen id único y contenido', () => {
    const ids = CATEGORIAS_EMOJI.map((c) => c.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const c of CATEGORIAS_EMOJI) {
      assert.equal(c.emojis.length > 0, true, `categoría vacía: ${c.id}`)
    }
  })

  it('normalizar quita tildes y espacios de sobra', () => {
    assert.equal(normalizarBusqueda('  Corazón  '), 'corazon')
  })
})
