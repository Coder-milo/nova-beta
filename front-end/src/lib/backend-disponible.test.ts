import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { esperarBackendDisponible, esFalloTransitorioDelBackend } from './backend-disponible.ts'

describe('esperarBackendDisponible', () => {
  test('espera mientras Render responde 502 y continúa al quedar listo', async () => {
    const estados = [502, 503, 200]
    let pausas = 0

    await esperarBackendDisponible({
      intentos: 4,
      intervaloMs: 0,
      sondear: async () => estados.shift() ?? 200,
      pausar: async () => { pausas++ },
    })

    assert.equal(pausas, 2)
  })

  test('un error de negocio demuestra que el servidor ya está despierto', async () => {
    let consultas = 0
    await esperarBackendDisponible({
      sondear: async () => { consultas++; return 403 },
      pausar: async () => { throw new Error('no debe esperar') },
    })
    assert.equal(consultas, 1)
  })

  test('termina con error si el servidor nunca responde', async () => {
    await assert.rejects(
      esperarBackendDisponible({
        intentos: 3,
        intervaloMs: 0,
        sondear: async () => 502,
        pausar: async () => {},
      }),
      /no terminó de iniciar/,
    )
  })

  test('reconoce los estados transitorios del proxy', () => {
    assert.equal(esFalloTransitorioDelBackend(502), true)
    assert.equal(esFalloTransitorioDelBackend(503), true)
    assert.equal(esFalloTransitorioDelBackend(504), true)
    assert.equal(esFalloTransitorioDelBackend(400), false)
  })
})
