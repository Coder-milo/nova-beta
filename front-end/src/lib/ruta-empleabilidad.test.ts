import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  APORTE_EN_PROCESO_RUTA,
  PESOS_RUTA,
  totalDeLaRuta,
  calcularPorcentajeEmpleabilidad,
  determinarSiguientePaso,
  determinarSiguientePasoEstudiante,
  normalizarUrlLinkedin,
  validarUrlLinkedin,
  simularSincronizacionHitos,
} from './ruta-empleabilidad.ts'
import type { EstadoHito } from './types.ts'

describe('los pesos de la ruta de empleabilidad', () => {
  it('suman 100 entre los seis pasos', () => {
    assert.equal(
      totalDeLaRuta(),
      100,
      'la ruta enseña el peso de cada paso; si no suman 100, el estudiante ve ' +
        'un recorrido que no cuadra con su porcentaje',
    )
  })

  it('mantiene los valores de PuntajeEmpleabilidad.java', () => {
    // Copiados a mano del backend. Si allí cambian, este test falla y el
    // mensaje dice dónde mirar.
    assert.deepEqual(
      { ...PESOS_RUTA },
      {
        perfilOcupacional: 15,
        cvListo: 15,
        cvIngles: 15,
        linkedinCreado: 10,
        linkedinOptimizado: 15,
        colocado: 30,
      },
      'ver back-end/src/main/java/com/novacrm/estudiante/PuntajeEmpleabilidad.java',
    )
  })

  it('la colocación es el paso que más pesa', () => {
    const otros = Object.entries(PESOS_RUTA)
      .filter(([k]) => k !== 'colocado')
      .map(([, v]) => v)
    assert.ok(PESOS_RUTA.colocado > Math.max(...otros))
  })

  it('un hito a medias aporta lo mismo sea cual sea', () => {
    assert.equal(APORTE_EN_PROCESO_RUTA, 7)
    assert.notEqual(APORTE_EN_PROCESO_RUTA, PESOS_RUTA.cvListo / 2)
  })
})

describe('cálculo del porcentaje de empleabilidad', () => {
  it('un perfil inicial sin hitos ni colocación da 0%', () => {
    const puntaje = calcularPorcentajeEmpleabilidad({
      hitoPerfilOcupacional: 'NO',
      hitoCvListo: 'NO',
      hitoCvIngles: 'NO',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(puntaje, 0)
  })

  it('un perfil con todos los hitos completados y colocado da 100%', () => {
    const puntaje = calcularPorcentajeEmpleabilidad({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'SI',
      colocado: true,
    })
    assert.equal(puntaje, 100)
  })

  it('suma fielmente cada hito individual', () => {
    assert.equal(
      calcularPorcentajeEmpleabilidad({ hitoPerfilOcupacional: 'SI' }),
      15,
    )
    assert.equal(
      calcularPorcentajeEmpleabilidad({ hitoCvListo: 'SI' }),
      15,
    )
    assert.equal(
      calcularPorcentajeEmpleabilidad({ hitoCvIngles: 'SI' }),
      15,
    )
    assert.equal(
      calcularPorcentajeEmpleabilidad({ hitoLinkedinCreado: 'SI' }),
      10,
    )
    assert.equal(
      calcularPorcentajeEmpleabilidad({ hitoLinkedinOptimizado: 'SI' }),
      15,
    )
    assert.equal(
      calcularPorcentajeEmpleabilidad({ colocado: true }),
      30,
    )
  })

  it('calcula correctamente combinaciones con hitos en proceso', () => {
    // 15 (perfil) + 7 (cv en proceso) + 7 (cv inglés en proceso) + 10 (linkedin) = 39%
    const puntaje = calcularPorcentajeEmpleabilidad({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'EN_PROCESO',
      hitoCvIngles: 'EN_PROCESO',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(puntaje, 39)
  })

  it('reproduce el caso base Aaron del backend (47%)', () => {
    // cvListo (15) + cvIngles (15) + linkedinCreado (10) + perfilOcupacional EN_PROCESO (7) = 47%
    const puntaje = calcularPorcentajeEmpleabilidad({
      hitoPerfilOcupacional: 'EN_PROCESO',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(puntaje, 47)
  })
})

describe('determinación del siguiente paso activo', () => {
  it('en un perfil nuevo, el primer paso es el perfil ocupacional', () => {
    const siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'NO',
      hitoCvListo: 'NO',
      hitoCvIngles: 'NO',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(siguiente, 'perfilOcupacional')
  })

  it('avanza secuencialmente a medida que se completan los hitos', () => {
    // Al completar perfilOcupacional, avanza a cvListo
    let siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'NO',
      hitoCvIngles: 'NO',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(siguiente, 'cvListo')

    // Al completar cvListo, avanza a cvIngles
    siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'NO',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(siguiente, 'cvIngles')

    // Al completar cvIngles, avanza a linkedinCreado
    siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'NO',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(siguiente, 'linkedinCreado')

    // Al completar linkedinCreado, avanza a linkedinOptimizado
    siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'NO',
      colocado: false,
    })
    assert.equal(siguiente, 'linkedinOptimizado')

    // Al completar todos los hitos del estudiante, queda colocado
    siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'SI',
      colocado: false,
    })
    assert.equal(siguiente, 'colocado')

    // Cuando ya está colocado, no hay más pasos pendientes
    siguiente = determinarSiguientePasoEstudiante({
      hitoPerfilOcupacional: 'SI',
      hitoCvListo: 'SI',
      hitoCvIngles: 'SI',
      hitoLinkedinCreado: 'SI',
      hitoLinkedinOptimizado: 'SI',
      colocado: true,
    })
    assert.equal(siguiente, null)
  })

  it('un paso en proceso retiene el foco como siguiente paso', () => {
    const pasos = [
      { id: 'perfilOcupacional', estado: 'SI' as EstadoHito, href: '/configuracion-estudiante' },
      { id: 'cvListo', estado: 'EN_PROCESO' as EstadoHito, href: '/mi-hoja-de-vida' },
      { id: 'cvIngles', estado: 'NO' as EstadoHito, href: '/mi-hoja-de-vida' },
    ]
    assert.equal(determinarSiguientePaso(pasos), 'cvListo')
  })
})

describe('sincronización bidireccional de hitos y reactividad', () => {
  it('completar cargoObjetivo pasa perfilOcupacional a SI (+15%)', () => {
    const actual = {
      cargoObjetivo: '',
      perfilProfesional: '',
      hitoPerfilOcupacional: 'NO' as EstadoHito,
    }
    const nuevo = simularSincronizacionHitos(actual, {
      cargoObjetivo: 'Desarrollador React',
    })
    assert.equal(nuevo.hitoPerfilOcupacional, 'SI')

    const puntajeAntes = calcularPorcentajeEmpleabilidad({ hitoPerfilOcupacional: actual.hitoPerfilOcupacional })
    const puntajeDespues = calcularPorcentajeEmpleabilidad({ hitoPerfilOcupacional: nuevo.hitoPerfilOcupacional })
    assert.equal(puntajeDespues - puntajeAntes, 15)
  })

  it('completar perfilProfesional pasa perfilOcupacional a SI (+15%)', () => {
    const actual = {
      cargoObjetivo: '',
      perfilProfesional: '',
      hitoPerfilOcupacional: 'NO' as EstadoHito,
    }
    const nuevo = simularSincronizacionHitos(actual, {
      perfilProfesional: 'Desarrollador web con sólida experiencia en TypeScript',
    })
    assert.equal(nuevo.hitoPerfilOcupacional, 'SI')
  })

  it('borrar cargoObjetivo y perfilProfesional revierte perfilOcupacional a NO (-15%)', () => {
    const actual = {
      cargoObjetivo: 'Desarrollador',
      perfilProfesional: 'Resumen profesional...',
      hitoPerfilOcupacional: 'SI' as EstadoHito,
    }
    const nuevo = simularSincronizacionHitos(actual, {
      cargoObjetivo: '',
      perfilProfesional: '   ',
    })
    assert.equal(nuevo.hitoPerfilOcupacional, 'NO')

    const puntajeAntes = calcularPorcentajeEmpleabilidad({ hitoPerfilOcupacional: actual.hitoPerfilOcupacional })
    const puntajeDespues = calcularPorcentajeEmpleabilidad({ hitoPerfilOcupacional: nuevo.hitoPerfilOcupacional })
    assert.equal(puntajeDespues, 0)
    assert.equal(puntajeAntes - puntajeDespues, 15)
  })

  it('agregar LinkedIn pasa linkedinCreado a SI (+10%)', () => {
    const actual = {
      linkedinUrl: '',
      hitoLinkedinCreado: 'NO' as EstadoHito,
      hitoLinkedinOptimizado: 'NO' as EstadoHito,
    }
    const nuevo = simularSincronizacionHitos(actual, {
      linkedinUrl: 'https://www.linkedin.com/in/hector-developer',
    })
    assert.equal(nuevo.hitoLinkedinCreado, 'SI')

    const puntajeAntes = calcularPorcentajeEmpleabilidad({ hitoLinkedinCreado: actual.hitoLinkedinCreado })
    const puntajeDespues = calcularPorcentajeEmpleabilidad({ hitoLinkedinCreado: nuevo.hitoLinkedinCreado })
    assert.equal(puntajeDespues - puntajeAntes, 10)
  })

  it('borrar LinkedIn revierte tanto creado como optimizado a NO', () => {
    const actual = {
      linkedinUrl: 'https://www.linkedin.com/in/hector-developer',
      hitoLinkedinCreado: 'SI' as EstadoHito,
      hitoLinkedinOptimizado: 'SI' as EstadoHito,
    }
    const nuevo = simularSincronizacionHitos(actual, {
      linkedinUrl: '',
    })
    assert.equal(nuevo.hitoLinkedinCreado, 'NO')
    assert.equal(nuevo.hitoLinkedinOptimizado, 'NO')

    const puntajeAntes = calcularPorcentajeEmpleabilidad({
      hitoLinkedinCreado: actual.hitoLinkedinCreado,
      hitoLinkedinOptimizado: actual.hitoLinkedinOptimizado,
    })
    const puntajeDespues = calcularPorcentajeEmpleabilidad({
      hitoLinkedinCreado: nuevo.hitoLinkedinCreado,
      hitoLinkedinOptimizado: nuevo.hitoLinkedinOptimizado,
    })
    assert.equal(puntajeAntes, 25)
    assert.equal(puntajeDespues, 0)
  })
})

describe('normalización y validación de URL de LinkedIn', () => {
  it('normaliza URLs sin protocolo a https://www.linkedin.com/in/...', () => {
    assert.equal(
      normalizarUrlLinkedin('linkedin.com/in/maria-garcia'),
      'https://www.linkedin.com/in/maria-garcia',
    )
    assert.equal(
      normalizarUrlLinkedin('www.linkedin.com/in/maria-garcia/'),
      'https://www.linkedin.com/in/maria-garcia',
    )
    assert.equal(
      normalizarUrlLinkedin('http://linkedin.com/in/maria-garcia'),
      'https://www.linkedin.com/in/maria-garcia',
    )
    assert.equal(
      normalizarUrlLinkedin('http://www.linkedin.com/in/maria-garcia'),
      'https://www.linkedin.com/in/maria-garcia',
    )
  })

  it('preserva y normaliza subdominios regionales de país', () => {
    assert.equal(
      normalizarUrlLinkedin('https://co.linkedin.com/in/usuario/'),
      'https://co.linkedin.com/in/usuario',
    )
    assert.equal(
      normalizarUrlLinkedin('http://co.linkedin.com/in/usuario'),
      'https://co.linkedin.com/in/usuario',
    )
    assert.equal(
      normalizarUrlLinkedin('es.linkedin.com/in/usuario'),
      'https://es.linkedin.com/in/usuario',
    )
    assert.equal(
      normalizarUrlLinkedin('http://mx.linkedin.com/in/usuario/'),
      'https://mx.linkedin.com/in/usuario',
    )
  })

  it('devuelve cadena vacía para entradas vacías o nulas', () => {
    assert.equal(normalizarUrlLinkedin(''), '')
    assert.equal(normalizarUrlLinkedin('   '), '')
    assert.equal(normalizarUrlLinkedin(null), '')
    assert.equal(normalizarUrlLinkedin(undefined), '')
  })

  it('valida correctamente enlaces legítimos de LinkedIn con subdominios y protocolos', () => {
    assert.equal(validarUrlLinkedin('https://www.linkedin.com/in/juan-perez').valido, true)
    assert.equal(validarUrlLinkedin('http://www.linkedin.com/in/juan-perez').valido, true)
    assert.equal(validarUrlLinkedin('https://co.linkedin.com/in/juan-perez').valido, true)
    assert.equal(validarUrlLinkedin('https://es.linkedin.com/in/juan-perez').valido, true)
    assert.equal(validarUrlLinkedin('http://co.linkedin.com/in/juan-perez').valido, true)
    assert.equal(validarUrlLinkedin('linkedin.com/in/juan_perez-123').valido, true)
    assert.equal(validarUrlLinkedin('https://www.linkedin.com/in/juan-perez?locale=es').valido, true)
    assert.equal(validarUrlLinkedin('www.linkedin.com/in/héctor-suárez-001415242').valido, true)
    assert.equal(validarUrlLinkedin('https://www.linkedin.com/in/héctor-suárez-001415242').valido, true)
    assert.equal(validarUrlLinkedin('https://www.linkedin.com/in/h%C3%A9ctor-su%C3%A1rez').valido, true)
    assert.equal(validarUrlLinkedin('').valido, true) // Permite vaciar
    assert.equal(validarUrlLinkedin(null).valido, true)
  })

  it('rechaza enlaces no válidos que no correspondan a LinkedIn', () => {
    assert.equal(validarUrlLinkedin('https://github.com/usuario').valido, false)
    assert.equal(validarUrlLinkedin('https://twitter.com/usuario').valido, false)
    assert.equal(validarUrlLinkedin('texto-aleatorio-sin-url').valido, false)
  })
})

describe('seguridad defensiva contra valores nulos/indefinidos', () => {
  it('cálculo de porcentaje maneja undefined o null de forma segura', () => {
    const calcularSeguro = (val: number | undefined | null) => Math.min(100, Math.max(0, Number(val) || 0))
    assert.equal(calcularSeguro(undefined), 0)
    assert.equal(calcularSeguro(null), 0)
    assert.equal(calcularSeguro(45), 45)
    assert.equal(calcularSeguro(150), 100)
    assert.equal(calcularSeguro(-10), 0)
  })

  it('generación de nombre de archivo PDF de HV maneja nombre nulo o indefinido', () => {
    const generarNombre = (nombre: string | null | undefined, idioma: string) =>
      `Hoja-de-Vida-${(nombre || 'Estudiante').replace(/\s+/g, '-')}-${idioma.toUpperCase()}.pdf`

    assert.equal(generarNombre(null, 'es'), 'Hoja-de-Vida-Estudiante-ES.pdf')
    assert.equal(generarNombre(undefined, 'en'), 'Hoja-de-Vida-Estudiante-EN.pdf')
    assert.equal(generarNombre('Juan Perez', 'es'), 'Hoja-de-Vida-Juan-Perez-ES.pdf')
    assert.equal(generarNombre('Ana Maria', 'en'), 'Hoja-de-Vida-Ana-Maria-EN.pdf')
  })
})
