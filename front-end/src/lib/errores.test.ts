import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiCallError } from './api-error.ts'
import { errorDe } from './errores.ts'

test('un 502 explica que el servicio está arrancando', () => {
  const error = new ApiCallError(502, { status: 502 })

  assert.equal(
    errorDe(error),
    'El servidor se está iniciando. Espera un minuto y vuelve a intentarlo.',
  )
})
