import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { calcularResumenAccionable360, DIAS_SIN_SEGUIMIENTO } from './resumen-360.ts'
import type {
  EstudianteResponse,
  HojaDeVidaResponse,
  PostulacionResponse,
  SeguimientoResponse,
} from './types.ts'

const AHORA = new Date('2026-08-20T12:00:00')

function estudiante(
  cambios: Partial<Pick<EstudianteResponse, 'estadoEmpleabilidad' | 'responsableNombre' | 'pendientesPreparacion'>> = {},
) {
  return {
    estadoEmpleabilidad: 'BUSCANDO' as const,
    responsableNombre: null,
    pendientesPreparacion: [],
    ...cambios,
  }
}

function seguimiento(cambios: Partial<SeguimientoResponse> = {}): SeguimientoResponse {
  return {
    id: 'seg-1',
    fecha: '2026-08-19',
    tipo: 'LLAMADA',
    responsable: 'Coordinación',
    observacion: null,
    proximaAccion: null,
    fechaProxima: null,
    estado: 'PENDIENTE',
    createdAt: '2026-08-19T15:00:00Z',
    ...cambios,
  }
}

function hojaDeVida(cambios: Partial<HojaDeVidaResponse> = {}): HojaDeVidaResponse {
  return {
    id: 'hv-1',
    estudianteId: 'est-1',
    estudianteNombre: 'Ana Pérez',
    plantillaId: null,
    plantillaNombre: null,
    numeroVersion: 1,
    actual: true,
    generadaPor: 'Coordinación',
    createdAt: '2026-08-18T12:00:00Z',
    ...cambios,
  }
}

function postulacion(cambios: Partial<PostulacionResponse> = {}): PostulacionResponse {
  return {
    id: 'pos-1',
    estudianteId: 'est-1',
    estudianteNombre: 'Ana Pérez',
    vacanteId: 'vac-1',
    empresaNombre: 'Empresa X',
    cargo: 'Desarrolladora',
    canal: 'NOVA',
    fechaPostulacion: '2026-08-18',
    estado: 'EN_PROCESO',
    estadoEtiqueta: 'En proceso',
    estadoFinal: false,
    fechaRespuesta: null,
    diasHastaRespuesta: null,
    diasEsperando: 2,
    resultado: null,
    observaciones: null,
    gestionadaPor: null,
    registradaPorEstudiante: false,
    urlOferta: null,
    esperandoConfirmacion: false,
    fechaHoraEntrevista: null,
    modalidadEntrevista: null,
    modalidadEtiqueta: null,
    lugarEntrevista: null,
    contactoNombre: null,
    contactoEmail: null,
    contactoTelefono: null,
    proximoSeguimiento: null,
    entrevistaPendiente: false,
    entrevistaVencida: false,
    horasParaEntrevista: null,
    ...cambios,
  }
}

describe('resumen accionable del Perfil 360', () => {
  test('no convierte fuentes que siguen cargando en ausencias', () => {
    const resumen = calcularResumenAccionable360({
      estudiante: estudiante({ responsableNombre: 'Laura Gómez' }),
      seguimientos: [],
      hojasDeVida: [],
      postulaciones: [],
      pipeline: null,
      cargas: { seguimientos: true, hojasDeVida: true, empleabilidad: true },
    }, AHORA)

    assert.deepEqual(resumen.atenciones, [])
    assert.equal(resumen.postulacionesActivas, null)
  })

  test('señala las ausencias reales cuando las fuentes terminaron', () => {
    const resumen = calcularResumenAccionable360({
      estudiante: estudiante(),
      seguimientos: [],
      hojasDeVida: [],
      postulaciones: [],
      pipeline: null,
      cargas: { seguimientos: false, hojasDeVida: false, empleabilidad: false },
    }, AHORA)

    assert.deepEqual(
      resumen.atenciones.map((item) => item.codigo),
      ['SIN_SEGUIMIENTO', 'SIN_CV_VIGENTE', 'SIN_POSTULACIONES_ACTIVAS', 'SIN_RESPONSABLE'],
    )
    assert.equal(
      resumen.atenciones.find((item) => item.codigo === 'SIN_RESPONSABLE')?.accion,
      undefined,
    )
  })

  test('un caso al día no recibe alertas negativas', () => {
    const resumen = calcularResumenAccionable360({
      estudiante: estudiante({ responsableNombre: 'Laura Gómez' }),
      seguimientos: [seguimiento()],
      hojasDeVida: [hojaDeVida()],
      postulaciones: [postulacion()],
      pipeline: null,
      cargas: { seguimientos: false, hojasDeVida: false, empleabilidad: false },
    }, AHORA)

    assert.deepEqual(resumen.atenciones, [])
    assert.equal(resumen.postulacionesActivas, 1)
    assert.equal(resumen.diasSinSeguimiento, 1)
  })

  test('prioriza compromisos vencidos y entrevistas pasadas sin cerrar', () => {
    const resumen = calcularResumenAccionable360({
      estudiante: estudiante({ responsableNombre: 'Laura Gómez' }),
      seguimientos: [seguimiento({ fechaProxima: '2026-08-18', proximaAccion: 'Llamar' })],
      hojasDeVida: [hojaDeVida()],
      postulaciones: [postulacion({
        estado: 'ENTREVISTA_AGENDADA',
        fechaHoraEntrevista: '2026-08-19T09:00:00',
        entrevistaPendiente: false,
        entrevistaVencida: true,
      })],
      pipeline: null,
      cargas: { seguimientos: false, hojasDeVida: false, empleabilidad: false },
    }, AHORA)

    assert.deepEqual(
      resumen.atenciones.slice(0, 2).map((item) => [item.codigo, item.nivel]),
      [
        ['SEGUIMIENTO_VENCIDO', 'ALTA'],
        ['ENTREVISTA_SIN_CERRAR', 'ALTA'],
      ],
    )
  })

  test(`usa el mismo umbral de ${DIAS_SIN_SEGUIMIENTO} días del tablero`, () => {
    const resumen = calcularResumenAccionable360({
      estudiante: estudiante({ responsableNombre: 'Laura Gómez', estadoEmpleabilidad: 'EMPLEADO' }),
      seguimientos: [seguimiento({ fecha: '2026-08-06' })],
      hojasDeVida: [hojaDeVida()],
      postulaciones: [],
      pipeline: null,
      cargas: { seguimientos: false, hojasDeVida: false, empleabilidad: false },
    }, AHORA)

    assert.equal(resumen.atenciones[0]?.codigo, 'SIN_CONTACTO_RECIENTE')
    assert.equal(resumen.atenciones[0]?.dias, DIAS_SIN_SEGUIMIENTO)
  })
})
