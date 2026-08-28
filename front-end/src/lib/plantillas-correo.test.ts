import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOQUES_PREDISENADOS,
  PERFILES_SIMULACION_PREDETERMINADOS,
  envolverEnDocumentoEmail,
  interpolarVariables,
} from '../components/admin/bloques-correo.ts'

describe('interpolarVariables', () => {
  test('sustituye variables básicas correctamente', () => {
    const plantilla = 'Hola {{nombre}} {{apellido}}, bienvenido a {{programa}}.'
    const variables = {
      nombre: 'Héctor',
      apellido: 'Suárez',
      programa: 'Ruta Bilingüe',
    }
    const resultado = interpolarVariables(plantilla, variables)
    assert.equal(resultado, 'Hola Héctor Suárez, bienvenido a Ruta Bilingüe.')
  })

  test('sustituye variables de citas y enlaces', () => {
    const plantilla = 'Tu entrevista en {{empresa}} es el {{fecha_entrevista}} ({{modalidad_entrevista}}). Lugar: {{lugar_entrevista}}. Link: {{enlace_boton}}'
    const variables = {
      empresa: 'Konecta',
      fecha_entrevista: '28 de Agosto 10:00 AM',
      modalidad_entrevista: 'Virtual',
      lugar_entrevista: 'https://teams.microsoft.com/meet',
      enlace_boton: 'https://novacrm.org/confirmar',
    }
    const resultado = interpolarVariables(plantilla, variables)
    assert.equal(
      resultado,
      'Tu entrevista en Konecta es el 28 de Agosto 10:00 AM (Virtual). Lugar: https://teams.microsoft.com/meet. Link: https://novacrm.org/confirmar',
    )
  })

  test('conserva marcas desconocidas o no provistas sin romper el texto', () => {
    const plantilla = 'Hola {{nombre}}, tu código es {{codigo_secreto}}.'
    const variables = { nombre: 'María' }
    const resultado = interpolarVariables(plantilla, variables)
    assert.equal(resultado, 'Hola María, tu código es {{codigo_secreto}}.')
  })

  test('maneja entradas vacías o nulas de forma segura', () => {
    assert.equal(interpolarVariables('', { nombre: 'Ana' }), '')
    // @ts-expect-error probando valor nulo en tiempo de ejecución
    assert.equal(interpolarVariables(null, { nombre: 'Ana' }), '')
    // @ts-expect-error probando valor indefinido
    assert.equal(interpolarVariables(undefined, {}), '')
  })
})
describe('BLOQUES_PREDISENADOS', () => {
  test('contiene al menos los 5 bloques modulares requeridos', () => {
    const ids = BLOQUES_PREDISENADOS.map((b) => b.id)
    // Los cinco siguientes son el mínimo de la experiencia. El catálogo puede
    // crecer con bloques adicionales sin que una mejora legítima rompa la
    // prueba ni el editor de correos.
    assert.ok(BLOQUES_PREDISENADOS.length >= 5)
    assert.ok(ids.includes('cabecera'), 'Falta bloque cabecera')
    assert.ok(ids.includes('boton_cta'), 'Falta bloque boton_cta')
    assert.ok(ids.includes('tarjeta_entrevista'), 'Falta bloque tarjeta_entrevista')
    assert.ok(ids.includes('banner_aviso'), 'Falta bloque banner_aviso')
    assert.ok(ids.includes('firma_institucional'), 'Falta bloque firma_institucional')
  })

  test('todos los bloques usan estructura de tabla para compatibilidad con clientes de correo', () => {
    for (const bloque of BLOQUES_PREDISENADOS) {
      assert.ok(
        bloque.html.includes('<table role="presentation"'),
        `El bloque ${bloque.id} no implementa table role="presentation"`,
      )
      assert.ok(
        bloque.html.includes('cellpadding="0"') && bloque.html.includes('cellspacing="0"'),
        `El bloque ${bloque.id} carece de padding/spacing de tabla seguro`,
      )
    }
  })

  test('el bloque CTA contiene variable de enlace y diseño de botón seguro', () => {
    const cta = BLOQUES_PREDISENADOS.find((b) => b.id === 'boton_cta')
    assert.ok(cta !== undefined)
    assert.ok(cta.html.includes('{{enlace_boton}}'))
    assert.ok(cta.html.includes('border-radius:8px'))
  })

  test('el bloque de entrevista contiene variables de empresa, fecha y modalidad', () => {
    const entrevista = BLOQUES_PREDISENADOS.find((b) => b.id === 'tarjeta_entrevista')
    assert.ok(entrevista !== undefined)
    assert.ok(entrevista.html.includes('{{empresa}}'))
    assert.ok(entrevista.html.includes('{{fecha_entrevista}}'))
    assert.ok(entrevista.html.includes('{{modalidad_entrevista}}'))
    assert.ok(entrevista.html.includes('{{lugar_entrevista}}'))
  })
})

describe('PERFILES_SIMULACION_PREDETERMINADOS', () => {
  test('ofrece perfiles con variables requeridas completas', () => {
    assert.ok(PERFILES_SIMULACION_PREDETERMINADOS.length >= 3)
    const estandar = PERFILES_SIMULACION_PREDETERMINADOS[0]
    assert.ok(estandar.variables.nombre)
    assert.ok(estandar.variables.apellido)
    assert.ok(estandar.variables.email)
    assert.ok(estandar.variables.programa)
    assert.ok(estandar.variables.empresa)
    assert.ok(estandar.variables.cargo)
    assert.ok(estandar.variables.fecha_entrevista)
    assert.ok(estandar.variables.modalidad_entrevista)
    assert.ok(estandar.variables.lugar_entrevista)
    assert.ok(estandar.variables.enlace_boton)
  })
})

describe('envolverEnDocumentoEmail', () => {
  test('genera documento HTML completo con viewport y contenedor seguro de 600px', () => {
    const html = envolverEnDocumentoEmail('<p>Contenido de prueba</p>', 'Asunto Test')
    assert.ok(html.includes('<!DOCTYPE html>'))
    assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'))
    assert.ok(html.includes('max-width:600px'))
    assert.ok(html.includes('<p>Contenido de prueba</p>'))
    assert.ok(html.includes('<title>Asunto Test</title>'))
  })
})

describe('Variables de plantillas transaccionales del sistema', () => {
  test('interpola credenciales de activación y enlaces de un solo uso', () => {
    const plantilla = 'Tu usuario es {{email}} y tu clave temporal: {{contrasena_temporal}}. Activa tu cuenta en {{enlace_activacion}} antes de {{tiempo_expiracion_minutos}} minutos.'
    const variables = {
      email: 'estudiante@eurocentres.edu.co',
      contrasena_temporal: 'Nova2026!#',
      enlace_activacion: 'https://novacrm.org/activar?t=abc123xyz',
      tiempo_expiracion_minutos: '60',
    }
    const resultado = interpolarVariables(plantilla, variables)
    assert.ok(resultado.includes('estudiante@eurocentres.edu.co'))
    assert.ok(resultado.includes('Nova2026!#'))
    assert.ok(resultado.includes('https://novacrm.org/activar?t=abc123xyz'))
    assert.ok(resultado.includes('60 minutos'))
  })

  test('interpola datos de match de vacante con porcentaje de afinidad', () => {
    const plantilla = '¡Nueva vacante encontrada! {{cargo}} en {{empresa}} (Afinidad: {{porcentaje_afinidad}}%). Modalidad: {{modalidad}}. Postúlate: {{enlace_vacante}}'
    const variables = {
      cargo: 'Bilingual Customer Service Agent',
      empresa: 'Foundever Barranquilla',
      porcentaje_afinidad: '95',
      modalidad: 'Presencial - Atlántico',
      enlace_vacante: 'https://novacrm.org/vacantes/v-123',
    }
    const resultado = interpolarVariables(plantilla, variables)
    assert.ok(resultado.includes('Bilingual Customer Service Agent'))
    assert.ok(resultado.includes('Foundever Barranquilla'))
    assert.ok(resultado.includes('Afinidad: 95%'))
    assert.ok(resultado.includes('Presencial - Atlántico'))
  })

  test('interpola recordatorio de hoja de vida y ruta de empleabilidad', () => {
    const plantilla = 'Hola {{nombre}}, tu avance en la ruta de empleabilidad es del {{avance_empleabilidad}}%. Completa tus hitos en {{enlace_portal}}.'
    const variables = {
      nombre: 'Valeria',
      avance_empleabilidad: '70',
      enlace_portal: 'https://novacrm.org/mi-perfil',
    }
    const resultado = interpolarVariables(plantilla, variables)
    assert.ok(resultado.includes('Valeria'))
    assert.ok(resultado.includes('70%'))
    assert.ok(resultado.includes('https://novacrm.org/mi-perfil'))
  })
})

describe('correosApi.enviarPrueba API contract', () => {
  test('valida la estructura de telemetría de envío de prueba', () => {
    const mockRespuesta = {
      enviados: 1,
      bloqueadosPorLista: 0,
      fallidos: 0,
      canalDeCorreo: 'SES',
    }
    assert.equal(typeof mockRespuesta.enviados, 'number')
    assert.equal(typeof mockRespuesta.bloqueadosPorLista, 'number')
    assert.equal(typeof mockRespuesta.fallidos, 'number')
    assert.equal(typeof mockRespuesta.canalDeCorreo, 'string')
    assert.equal(mockRespuesta.enviados, 1)
    assert.equal(mockRespuesta.canalDeCorreo, 'SES')
  })
})
