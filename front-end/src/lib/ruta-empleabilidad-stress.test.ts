import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  calcularPorcentajeEmpleabilidad,
  determinarSiguientePaso,
  determinarSiguientePasoEstudiante,
  normalizarUrlLinkedin,
  validarUrlLinkedin,
  simularSincronizacionHitos,
} from './ruta-empleabilidad.ts'
import type { EstadoHito } from './types.ts'

describe('ADVERSARIAL STRESS TEST: Validación y normalización de URLs de LinkedIn', () => {
  const urlsValidas = [
    'https://www.linkedin.com/in/juan-perez',
    'https://linkedin.com/in/juan-perez',
    'http://linkedin.com/in/juan-perez',
    'www.linkedin.com/in/juan-perez',
    'linkedin.com/in/juan-perez',
    'https://www.linkedin.com/in/juan_perez-123/',
    'https://www.linkedin.com/in/a',
    'https://www.linkedin.com/company/novacrm-tech',
    'https://www.linkedin.com/school/universidad-nacional-colombia',
    '  https://www.linkedin.com/in/juan-perez  \n',
    'https://www.linkedin.com/in/juan-perez?trk=public_profile',
    'https://www.linkedin.com/in/juan-perez#experience',
  ]

  for (const url of urlsValidas) {
    it(`valida enlace válido: ${url.trim()}`, () => {
      const res = validarUrlLinkedin(url)
      assert.equal(res.valido, true, `Debería ser válido: ${url}`)
    })
  }

  const urlsInvalidas = [
    'https://evil-linkedin.com/in/juan-perez',
    'https://linkedin.com.attacker.com/in/juan-perez',
    'https://fakelinkedin.com/in/juan-perez',
    'https://www.linkedin.com',
    'https://www.linkedin.com/',
    'https://www.linkedin.com/in',
    'https://www.linkedin.com/in/',
    'https://www.linkedin.com/feed',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/jobs/view/123456',
    'javascript:alert(document.domain)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'ftp://linkedin.com/in/juan-perez',
    'file:///etc/passwd',
    'https://github.com/juan-perez',
    'https://twitter.com/juan-perez',
    'https://facebook.com/juan-perez',
    'https://instagram.com/juan-perez',
    'https://not-linkedin.org/in/user',
    'texto-plano-invalido',
    'http://localhost:3000/in/juan',
  ]

  for (const url of urlsInvalidas) {
    it(`rechaza enlace inválido o malicioso: ${url}`, () => {
      const res = validarUrlLinkedin(url)
      assert.equal(res.valido, false, `Debería ser inválido: ${url}`)
      assert.ok(res.mensaje && res.mensaje.length > 0, 'Debe proveer mensaje de error explicativo')
    })
  }

  it('permite vaciar o borrar el enlace (entradas nulas, vacías o de solo espacios)', () => {
    assert.equal(validarUrlLinkedin('').valido, true)
    assert.equal(validarUrlLinkedin('   ').valido, true)
    assert.equal(validarUrlLinkedin(null).valido, true)
    assert.equal(validarUrlLinkedin(undefined).valido, true)
    assert.equal(normalizarUrlLinkedin(''), '')
    assert.equal(normalizarUrlLinkedin('   \t\n'), '')
    assert.equal(normalizarUrlLinkedin(null), '')
    assert.equal(normalizarUrlLinkedin(undefined), '')
  })

  it('normaliza consistentemente hacia https://www.linkedin.com/...', () => {
    assert.equal(
      normalizarUrlLinkedin('linkedin.com/in/hector-dev///'),
      'https://www.linkedin.com/in/hector-dev',
    )
    assert.equal(
      normalizarUrlLinkedin('http://linkedin.com/in/hector-dev'),
      'https://www.linkedin.com/in/hector-dev',
    )
  })
})

describe('ADVERSARIAL STRESS TEST: Sincronización y perfiles ocupacionales extremos', () => {
  it('gestiona textos muy largos (3000+ caracteres) sin degradación ni errores', () => {
    const cargoLargo = 'A'.repeat(500)
    const perfilLargo = 'B'.repeat(3000)
    const res = simularSincronizacionHitos(
      { hitoPerfilOcupacional: 'NO' },
      { cargoObjetivo: cargoLargo, perfilProfesional: perfilLargo },
    )
    assert.equal(res.hitoPerfilOcupacional, 'SI')
    assert.equal(res.cargoObjetivo.length, 500)
    assert.equal(res.perfilProfesional.length, 3000)
  })

  it('maneja caracteres unicode, emojis y acentos en el cargo y perfil', () => {
    const cargo = '👨‍💻 Desarrollador Full-Stack & Líder Técnico 🚀'
    const perfil = 'Especialista en React, Node.js y Cloud Native — Bogotá, Colombia (Añoranza & Éxito)'
    const res = simularSincronizacionHitos(
      { hitoPerfilOcupacional: 'NO' },
      { cargoObjetivo: cargo, perfilProfesional: perfil },
    )
    assert.equal(res.hitoPerfilOcupacional, 'SI')
    assert.equal(res.cargoObjetivo, cargo)
    assert.equal(res.perfilProfesional, perfil)
  })

  it('espacios en blanco no activan el hito perfil ocupacional', () => {
    const res = simularSincronizacionHitos(
      { hitoPerfilOcupacional: 'SI' },
      { cargoObjetivo: '   \t  \n  ', perfilProfesional: '       ' },
    )
    assert.equal(res.hitoPerfilOcupacional, 'NO')
    assert.equal(res.cargoObjetivo, '')
    assert.equal(res.perfilProfesional, '')
  })

  it('borrar el enlace de LinkedIn revierte tanto creado como optimizado a NO', () => {
    const res = simularSincronizacionHitos(
      {
        linkedinUrl: 'https://www.linkedin.com/in/hector',
        hitoLinkedinCreado: 'SI',
        hitoLinkedinOptimizado: 'SI',
      },
      { linkedinUrl: '   ' },
    )
    assert.equal(res.hitoLinkedinCreado, 'NO')
    assert.equal(res.hitoLinkedinOptimizado, 'NO')
    assert.equal(res.linkedinUrl, '')
  })
})

describe('ADVERSARIAL STRESS TEST: Exploración exhaustiva de las 486 combinaciones de puntaje', () => {
  const estados: EstadoHito[] = ['NO', 'EN_PROCESO', 'SI']
  const colocados: boolean[] = [false, true]

  it('verifica que el porcentaje esté siempre en [0, 100] y respete monotonía para las 486 combinaciones', () => {
    let totalCombinaciones = 0

    for (const hitoPerfil of estados) {
      for (const hitoCv of estados) {
        for (const hitoIngles of estados) {
          for (const hitoLkCreado of estados) {
            for (const hitoLkOpt of estados) {
              for (const colocado of colocados) {
                totalCombinaciones++
                const perfil = {
                  hitoPerfilOcupacional: hitoPerfil,
                  hitoCvListo: hitoCv,
                  hitoCvIngles: hitoIngles,
                  hitoLinkedinCreado: hitoLkCreado,
                  hitoLinkedinOptimizado: hitoLkOpt,
                  colocado,
                }

                const score = calcularPorcentajeEmpleabilidad(perfil)

                // 1. Rango válido
                assert.ok(Number.isInteger(score), `Puntaje debe ser entero: ${score}`)
                assert.ok(score >= 0, `Puntaje no puede ser negativo: ${score}`)
                assert.ok(score <= 100, `Puntaje no puede exceder 100: ${score}`)

                // 2. Colocado aporta exactamente 30 puntos
                const scoreSinColocado = calcularPorcentajeEmpleabilidad({ ...perfil, colocado: false })
                if (colocado) {
                  assert.equal(
                    score,
                    Math.min(100, scoreSinColocado + 30),
                    `Colocado debe sumar 30% a ${scoreSinColocado}`,
                  )
                }

                // 3. Siguiente paso invariantes
                const siguiente = determinarSiguientePasoEstudiante(perfil)
                if (
                  hitoPerfil === 'SI' &&
                  hitoCv === 'SI' &&
                  hitoIngles === 'SI' &&
                  hitoLkCreado === 'SI' &&
                  hitoLkOpt === 'SI'
                ) {
                  if (colocado) {
                    assert.equal(siguiente, null, 'Con todo completado y colocado, siguiente paso debe ser null')
                    assert.equal(score, 100, 'Score total debe ser 100%')
                  } else {
                    assert.equal(siguiente, 'colocado', 'Si faltaba colocación, siguiente debe ser colocado')
                    assert.equal(score, 70, 'Score sin colocación debe ser 70%')
                  }
                } else {
                  // Siguiente paso no puede ser un hito ya completado con 'SI'
                  if (siguiente === 'perfilOcupacional') assert.notEqual(hitoPerfil, 'SI')
                  if (siguiente === 'cvListo') assert.notEqual(hitoCv, 'SI')
                  if (siguiente === 'cvIngles') assert.notEqual(hitoIngles, 'SI')
                  if (siguiente === 'linkedinCreado') assert.notEqual(hitoLkCreado, 'SI')
                  if (siguiente === 'linkedinOptimizado') assert.notEqual(hitoLkOpt, 'SI')
                }
              }
            }
          }
        }
      }
    }

    assert.equal(totalCombinaciones, 3 * 3 * 3 * 3 * 3 * 2) // 486
  })
})

describe('ADVERSARIAL STRESS TEST: Resiliencia ante valores nulos / indefinidos / corruptos', () => {
  it('calcularPorcentajeEmpleabilidad tolera objetos vacíos o campos undefined', () => {
    assert.equal(calcularPorcentajeEmpleabilidad({}), 0)
    assert.equal(
      calcularPorcentajeEmpleabilidad({
        hitoPerfilOcupacional: undefined,
        hitoCvListo: null,
        hitoCvIngles: undefined,
        hitoLinkedinCreado: null,
        hitoLinkedinOptimizado: undefined,
        colocado: null,
      }),
      0,
    )
  })

  it('determinarSiguientePasoEstudiante tolera campos parciales sin lanzar excepciones', () => {
    const res = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'NO',
      hitoCvIngles: 'NO',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(res, 'cvListo')
  })

  it('determinarSiguientePaso maneja listas vacías o con href nulos', () => {
    assert.equal(determinarSiguientePaso([]), null)
    assert.equal(
      determinarSiguientePaso([
        { id: 'colocado', estado: 'NO', href: null },
      ]),
      null,
    )
  })
})
