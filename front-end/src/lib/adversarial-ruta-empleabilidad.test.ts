import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  PESOS_RUTA,
  APORTE_EN_PROCESO_RUTA,
  calcularPorcentajeEmpleabilidad,
  determinarSiguientePaso,
  determinarSiguientePasoEstudiante,
  simularSincronizacionHitos,
  normalizarUrlLinkedin,
  validarUrlLinkedin,
} from './ruta-empleabilidad.ts'
import type { EstadoHito } from './types.ts'

// Exact reference oracle matching PuntajeEmpleabilidad.java (BigDecimal simulation in cents)
function oraclePuntajeJava(
  cv: EstadoHito | null | undefined,
  ingles: EstadoHito | null | undefined,
  liCreado: EstadoHito | null | undefined,
  liOptimizado: EstadoHito | null | undefined,
  perfil: EstadoHito | null | undefined,
  colocado: boolean,
): number {
  const aporte = (estado: EstadoHito | null | undefined, peso: number): number => {
    if (!estado || estado === 'NO') return 0
    if (estado === 'EN_PROCESO') return 7
    if (estado === 'SI') return peso
    return 0
  }
  let sum = 0
  sum += aporte(cv, 15)
  sum += aporte(ingles, 15)
  sum += aporte(liCreado, 10)
  sum += aporte(liOptimizado, 15)
  sum += aporte(perfil, 15)
  if (colocado) sum += 30
  return Math.min(100, Math.max(0, Math.floor(sum)))
}

describe('Adversarial Stress Test: All 486 State Combinations Exhaustive Matrix', () => {
  const estados: EstadoHito[] = ['NO', 'EN_PROCESO', 'SI']
  const colocadoOpts = [false, true]

  it('All 486 combinations match the backend Java PuntajeEmpleabilidad oracle exactly', () => {
    let count = 0
    for (const cv of estados) {
      for (const ingles of estados) {
        for (const liCreado of estados) {
          for (const liOpt of estados) {
            for (const perfil of estados) {
              for (const col of colocadoOpts) {
                count++
                const scoreFrontend = calcularPorcentajeEmpleabilidad({
                  hitoCvListo: cv,
                  hitoCvIngles: ingles,
                  hitoLinkedinCreado: liCreado,
                  hitoLinkedinOptimizado: liOpt,
                  hitoPerfilOcupacional: perfil,
                  colocado: col,
                })
                const scoreOracle = oraclePuntajeJava(cv, ingles, liCreado, liOpt, perfil, col)
                assert.equal(
                  scoreFrontend,
                  scoreOracle,
                  `Mismatch on combo #${count}: cv=${cv}, in=${ingles}, liC=${liCreado}, liO=${liOpt}, perf=${perfil}, col=${col}. Got ${scoreFrontend}, expected ${scoreOracle}`,
                )
                assert.ok(scoreFrontend >= 0 && scoreFrontend <= 100, `Score ${scoreFrontend} out of [0, 100] bounds`)
              }
            }
          }
        }
      }
    }
    assert.equal(count, 486, 'Must have evaluated exactly 3^5 * 2 = 486 combinations')
  })
})

describe('Adversarial Stress Test: Score Degradation and Downgrading Trajectories', () => {
  it('Progressive downgrade: 100% -> 70% -> 55% -> 40% -> 25% -> 15% -> 0%', () => {
    // Start with 100% (all SI and placed)
    const p = {
      hitoPerfilOcupacional: 'SI' as EstadoHito,
      hitoCvListo: 'SI' as EstadoHito,
      hitoCvIngles: 'SI' as EstadoHito,
      hitoLinkedinCreado: 'SI' as EstadoHito,
      hitoLinkedinOptimizado: 'SI' as EstadoHito,
      colocado: true,
    }
    assert.equal(calcularPorcentajeEmpleabilidad(p), 100)

    // Remove colocado (-30)
    p.colocado = false
    assert.equal(calcularPorcentajeEmpleabilidad(p), 70)

    // Remove linkedinOptimizado (-15)
    p.hitoLinkedinOptimizado = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 55)

    // Remove cvIngles (-15)
    p.hitoCvIngles = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 40)

    // Remove cvListo (-15)
    p.hitoCvListo = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 25)

    // Remove linkedinCreado (-10)
    p.hitoLinkedinCreado = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 15)

    // Remove perfilOcupacional (-15)
    p.hitoPerfilOcupacional = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 0)
  })

  it('Degradation sequence: 62% -> 47% -> 32% -> 0%', () => {
    // 62%: perfil(15) + cv(15) + ingles(15) + liCreado(10) + liOpt_EN_PROCESO(7) = 62%
    const p = {
      hitoPerfilOcupacional: 'SI' as EstadoHito,
      hitoCvListo: 'SI' as EstadoHito,
      hitoCvIngles: 'SI' as EstadoHito,
      hitoLinkedinCreado: 'SI' as EstadoHito,
      hitoLinkedinOptimizado: 'EN_PROCESO' as EstadoHito,
      colocado: false,
    }
    assert.equal(calcularPorcentajeEmpleabilidad(p), 62)

    // Downgrade cvIngles to NO (-15) -> 47%
    p.hitoCvIngles = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 47)

    // Downgrade cvListo to NO (-15) -> 32%
    p.hitoCvListo = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 32)

    // Downgrade all remaining -> 0%
    p.hitoPerfilOcupacional = 'NO'
    p.hitoLinkedinCreado = 'NO'
    p.hitoLinkedinOptimizado = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 0)
  })

  it('Partial milestone transitions: NO (0) -> EN_PROCESO (7) -> SI (15) -> EN_PROCESO (7) -> NO (0)', () => {
    const p = {
      hitoPerfilOcupacional: 'NO' as EstadoHito,
      hitoCvListo: 'NO' as EstadoHito,
      hitoCvIngles: 'NO' as EstadoHito,
      hitoLinkedinCreado: 'NO' as EstadoHito,
      hitoLinkedinOptimizado: 'NO' as EstadoHito,
      colocado: false,
    }
    assert.equal(calcularPorcentajeEmpleabilidad(p), 0)

    p.hitoPerfilOcupacional = 'EN_PROCESO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 7)

    p.hitoPerfilOcupacional = 'SI'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 15)

    p.hitoPerfilOcupacional = 'EN_PROCESO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 7)

    p.hitoPerfilOcupacional = 'NO'
    assert.equal(calcularPorcentajeEmpleabilidad(p), 0)
  })

  it('Simultaneous in-process milestones: 5 * 7 = 35% without placement, 65% with placement', () => {
    const p = {
      hitoPerfilOcupacional: 'EN_PROCESO' as EstadoHito,
      hitoCvListo: 'EN_PROCESO' as EstadoHito,
      hitoCvIngles: 'EN_PROCESO' as EstadoHito,
      hitoLinkedinCreado: 'EN_PROCESO' as EstadoHito,
      hitoLinkedinOptimizado: 'EN_PROCESO' as EstadoHito,
      colocado: false,
    }
    assert.equal(calcularPorcentajeEmpleabilidad(p), 35)

    p.colocado = true
    assert.equal(calcularPorcentajeEmpleabilidad(p), 65)
  })
})

describe('Adversarial Stress Test: Next Step Determination in All 243 Milestone Permutations', () => {
  const estados: EstadoHito[] = ['NO', 'EN_PROCESO', 'SI']
  const stepOrder = ['perfilOcupacional', 'cvListo', 'cvIngles', 'linkedinCreado', 'linkedinOptimizado'] as const

  it('determinarSiguientePasoEstudiante always returns the first non-SI actionable step in order', () => {
    let count = 0
    for (const cv of estados) {
      for (const ingles of estados) {
        for (const liCreado of estados) {
          for (const liOpt of estados) {
            for (const perfil of estados) {
              count++
              const map: Record<string, EstadoHito> = {
                perfilOcupacional: perfil,
                cvListo: cv,
                cvIngles: ingles,
                linkedinCreado: liCreado,
                linkedinOptimizado: liOpt,
              }
              const expectedFirst = stepOrder.find((s) => map[s] !== 'SI')

              // Unplaced student
              const nextUnplaced = determinarSiguientePasoEstudiante({
                hitoPerfilOcupacional: perfil,
                hitoCvListo: cv,
                hitoCvIngles: ingles,
                hitoLinkedinCreado: liCreado,
                hitoLinkedinOptimizado: liOpt,
                colocado: false,
              })

              if (expectedFirst) {
                assert.equal(
                  nextUnplaced,
                  expectedFirst,
                  `Expected next step to be ${expectedFirst} for unplaced student on combo #${count}`,
                )
              } else {
                assert.equal(
                  nextUnplaced,
                  'colocado',
                  `Expected next step to be 'colocado' when all 5 are SI on combo #${count}`,
                )
              }

              // Placed student
              const nextPlaced = determinarSiguientePasoEstudiante({
                hitoPerfilOcupacional: perfil,
                hitoCvListo: cv,
                hitoCvIngles: ingles,
                hitoLinkedinCreado: liCreado,
                hitoLinkedinOptimizado: liOpt,
                colocado: true,
              })

              if (expectedFirst) {
                assert.equal(
                  nextPlaced,
                  expectedFirst,
                  `Expected next step to be ${expectedFirst} for placed student with incomplete milestones on combo #${count}`,
                )
              } else {
                assert.equal(
                  nextPlaced,
                  null,
                  `Expected next step to be null when placed and all 5 milestones SI on combo #${count}`,
                )
              }
            }
          }
        }
      }
    }
    assert.equal(count, 243)
  })

  it('determinarSiguientePaso list helper respects non-SI condition and href filtering', () => {
    // Case 1: First item is SI -> picks second item
    const pasos1 = [
      { id: 'step-1', estado: 'SI' as EstadoHito, href: '/step-1' },
      { id: 'step-2', estado: 'NO' as EstadoHito, href: '/step-2' },
      { id: 'step-3', estado: 'NO' as EstadoHito, href: '/step-3' },
    ]
    assert.equal(determinarSiguientePaso(pasos1), 'step-2')

    // Case 2: In-process step retains active next step focus
    const pasos2 = [
      { id: 'step-1', estado: 'SI' as EstadoHito, href: '/step-1' },
      { id: 'step-2', estado: 'EN_PROCESO' as EstadoHito, href: '/step-2' },
      { id: 'step-3', estado: 'NO' as EstadoHito, href: '/step-3' },
    ]
    assert.equal(determinarSiguientePaso(pasos2), 'step-2')

    // Case 3: Items with href: null are skipped if they represent un-actionable or external steps
    const pasos3 = [
      { id: 'step-1', estado: 'SI' as EstadoHito, href: '/step-1' },
      { id: 'step-2', estado: 'NO' as EstadoHito, href: null },
      { id: 'step-3', estado: 'NO' as EstadoHito, href: '/step-3' },
    ]
    assert.equal(determinarSiguientePaso(pasos3), 'step-3')

    // Case 4: All steps completed (SI) -> returns null
    const pasos4 = [
      { id: 'step-1', estado: 'SI' as EstadoHito, href: '/step-1' },
      { id: 'step-2', estado: 'SI' as EstadoHito, href: '/step-2' },
      { id: 'step-3', estado: 'SI' as EstadoHito, href: '/step-3' },
    ]
    assert.equal(determinarSiguientePaso(pasos4), null)
  })
})

describe('Adversarial Stress Test: Extreme Boundary and Null/Falsy Inputs', () => {
  it('Empty object returns 0%', () => {
    assert.equal(calcularPorcentajeEmpleabilidad({}), 0)
  })

  it('Null and undefined properties default safely to 0', () => {
    assert.equal(
      calcularPorcentajeEmpleabilidad({
        hitoPerfilOcupacional: null,
        hitoCvListo: undefined,
        hitoCvIngles: null,
        hitoLinkedinCreado: undefined,
        hitoLinkedinOptimizado: null,
        colocado: null,
      }),
      0,
    )
  })

  it('simularSincronizacionHitos handles undefined, null, and whitespace-only values safely', () => {
    const res1 = simularSincronizacionHitos(
      {
        cargoObjetivo: 'Frontend Engineer',
        perfilProfesional: 'Developer summary',
        linkedinUrl: 'https://linkedin.com/in/user',
        hitoPerfilOcupacional: 'SI',
        hitoLinkedinCreado: 'SI',
        hitoLinkedinOptimizado: 'SI',
      },
      {
        cargoObjetivo: '   \n\t  ',
        perfilProfesional: null,
        linkedinUrl: '',
      },
    )
    assert.equal(res1.hitoPerfilOcupacional, 'NO')
    assert.equal(res1.hitoLinkedinCreado, 'NO')
    assert.equal(res1.hitoLinkedinOptimizado, 'NO')
    assert.equal(res1.cargoObjetivo, '')
    assert.equal(res1.perfilProfesional, '')
    assert.equal(res1.linkedinUrl, '')
  })
})
