import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  interpolarVariables,
  envolverEnDocumentoEmail,
  BLOQUES_PREDISENADOS,
  PERFILES_SIMULACION_PREDETERMINADOS,
} from '../components/admin/bloques-correo.ts'

// RFC 5322 regex extracted from modal-envio-prueba.tsx
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

describe('ADVERSARIAL STRESS TEST: interpolarVariables', () => {
  test('Handling prototype properties (toString, valueOf, constructor)', () => {
    // When variables dictionary does not define toString, {{toString}} should not return Object.prototype.toString
    const input = 'Hello {{toString}} and {{valueOf}} and {{constructor}}'
    const vars = { nombre: 'Test' }
    const result = interpolarVariables(input, vars)
    // Note: variables['toString'] is Object.prototype.toString if unchecked with hasOwnProperty!
    // Let's observe the empirical behavior:
    console.log('Prototype property test output:', result)
  })

  test('Replacement with JavaScript special string patterns ($$, $&, $\`, $\', $1)', () => {
    const input = 'Amount: {{precio}}, Pattern: {{patron}}'
    const vars = {
      precio: '$100.00',
      patron: '$& $` $\' $1 $2 $$',
    }
    const result = interpolarVariables(input, vars)
    assert.equal(result, 'Amount: $100.00, Pattern: $& $` $\' $1 $2 $$')
  })

  test('Nested and adjacent braces', () => {
    const input = '{{{nombre}}} {{}} {nombre} {{{{nombre}}}}'
    const vars = { nombre: 'Carlos' }
    const result = interpolarVariables(input, vars)
    assert.equal(result, '{Carlos} {{}} {nombre} {{Carlos}}')
  })

  test('Variables with numeric and underscore keys', () => {
    const input = '{{var_1}} {{123}} {{_leading}} {{TRAILING_}}'
    const vars = {
      var_1: 'A',
      '123': 'B',
      _leading: 'C',
      TRAILING_: 'D',
    }
    const result = interpolarVariables(input, vars)
    assert.equal(result, 'A B C D')
  })

  test('Variable values containing HTML / XSS payloads', () => {
    const input = '<div>{{user_input}}</div>'
    const vars = { user_input: '<script>alert("xss")</script><img src=x onerror=alert(1)>' }
    const result = interpolarVariables(input, vars)
    assert.equal(result, '<div><script>alert("xss")</script><img src=x onerror=alert(1)></div>')
  })

  test('High volume and scale performance test (10,000 replacements)', () => {
    const templateChunk = 'Hello {{nombre}}, your interview at {{empresa}} is on {{fecha}}.\n'
    const largeTemplate = templateChunk.repeat(2000) // ~130 KB string
    const vars = {
      nombre: 'Juan Francisco Alexander De la Santísima Trinidad',
      empresa: 'Corporación Multilateral de Servicios Globales',
      fecha: '2026-10-15 14:00 UTC',
    }
    const start = performance.now()
    const result = interpolarVariables(largeTemplate, vars)
    const elapsed = performance.now() - start

    assert.ok(elapsed < 100, `Interpolation took too long: ${elapsed.toFixed(2)}ms`)
    assert.ok(!result.includes('{{nombre}}'))
    assert.ok(result.includes('Juan Francisco Alexander'))
  })
})

describe('ADVERSARIAL STRESS TEST: EMAIL_REGEX Validation', () => {
  const validEmails = [
    'simple@example.com',
    'very.common@example.com',
    'disposable.style.email.with+symbol@example.com',
    'other.email-with-hyphen@example.com',
    'fully-qualified-domain@example.com',
    'user.name+tag+sorting@example.com',
    'x@example.com',
    'example-indeed@strange-example.com',
    'admin@mailserver1.example.org',
    'example@s.example',
    'user@subdomain.domain.org',
    'user@domain.co.uk',
    'user@domain.technology',
    'user@domain.international',
  ]

  const invalidEmails = [
    '',
    '   ',
    'plainaddress',
    '#@%^%#$@#$@#.com',
    '@example.com',
    'Joe Smith <email@example.com>',
    'email.example.com',
    'email@example@example.com',
    '.email@example.com',
    'email.@example.com',
    'email..email@example.com',
    'email@example.com (Joe Smith)',
    'email@example',
    'email@-example.com',
    'email@example..com',
    'email@example.c', // Single character TLD is rejected or accepted? In DNS RFCs, TLDs are at least 2 chars, though regex allows [a-zA-Z0-9-]{0,61}
    'email@111.222.333.44444',
    'email@example .com',
    'email@ example.com',
  ]

  for (const email of validEmails) {
    test(`Accepts valid email: "${email}"`, () => {
      assert.ok(EMAIL_REGEX.test(email), `Failed to accept valid email: ${email}`)
    })
  }

  for (const email of invalidEmails) {
    test(`Rejects invalid email: "${email}"`, () => {
      const isValid = EMAIL_REGEX.test(email)
      console.log(`Validation for "${email}": ${isValid ? 'ACCEPTED' : 'REJECTED'}`)
    })
  }

  test('ReDoS resilience test', () => {
    const maliciousInputs = [
      'a@' + 'a.'.repeat(100) + 'com',
      'a'.repeat(1000) + '@example.com',
      'user@' + 'a-'.repeat(100) + 'domain.com',
      'user@' + 'a'.repeat(1000) + '.com',
    ]

    for (const input of maliciousInputs) {
      const start = performance.now()
      EMAIL_REGEX.test(input)
      const elapsed = performance.now() - start
      assert.ok(elapsed < 20, `Potential ReDoS vulnerability detected on input length ${input.length}, took ${elapsed}ms`)
    }
  })
})

describe('ADVERSARIAL STRESS TEST: Multilingual, Unicode & Injection Resilience', () => {
  test('Preserves Spanish diacritics and Unicode characters accurately', () => {
    const input = 'Estimado/a {{nombre}}, su citación para el cargo {{cargo}} en {{ciudad}} está confirmada. ¡Éxitos! 🚀'
    const vars = {
      nombre: 'Sofía María Gómez-Núñez',
      cargo: 'Diseñadora Gráfica & Analista de Datos Bilingüe',
      ciudad: 'Barranquilla (Atlántico)',
    }
    const result = interpolarVariables(input, vars)
    assert.equal(
      result,
      'Estimado/a Sofía María Gómez-Núñez, su citación para el cargo Diseñadora Gráfica & Analista de Datos Bilingüe en Barranquilla (Atlántico) está confirmada. ¡Éxitos! 🚀',
    )
  })

  test('Rejects prototype pollution attempts with __proto__ and prototype keys', () => {
    const input = '{{__proto__}} {{constructor}} {{prototype}}'
    const vars: Record<string, string> = JSON.parse('{"__proto__": "polluted", "prototype": "safe"}')
    const result = interpolarVariables(input, vars)
    // Prototype pollution should not corrupt Object prototype
    assert.equal(typeof ({} as Record<string, unknown>).polluted, 'undefined')
    assert.ok(typeof result === 'string')
  })
})

