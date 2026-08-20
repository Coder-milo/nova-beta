import type {
  EstudianteResponse,
  HojaDeVidaResponse,
  PipelineEmpleabilidadResponse,
  PostulacionResponse,
  SeguimientoResponse,
} from './types'

/**
 * La ficha y el tablero deben pedir atención con la misma regla.
 *
 * Es el valor de `TarjetaTablero.DIAS_PARA_ALERTAR` en el backend. Se conserva
 * aquí porque el resumen se calcula con los datos que la ficha ya descargó y
 * no debe abrir otro endpoint solo para repetir esa decisión.
 */
export const DIAS_SIN_SEGUIMIENTO = 14

export type NivelAtencion360 = 'ALTA' | 'MEDIA' | 'INFORMATIVA'

export type CodigoAtencion360 =
  | 'ENTREVISTA_SIN_CERRAR'
  | 'SEGUIMIENTO_VENCIDO'
  | 'SIN_SEGUIMIENTO'
  | 'SIN_CONTACTO_RECIENTE'
  | 'SIN_CV_VIGENTE'
  | 'SIN_POSTULACIONES_ACTIVAS'
  | 'SIN_RESPONSABLE'
  | 'PREPARACION_PENDIENTE'
  | 'ENTREVISTA_PROXIMA'

export type AccionAtencion360 =
  | 'SEGUIMIENTO'
  | 'HV'
  | 'POSTULAR'
  | 'POSTULACIONES'
  | 'PREPARACION'

export interface Atencion360 {
  codigo: CodigoAtencion360
  nivel: NivelAtencion360
  accion?: AccionAtencion360
  cantidad?: number
  dias?: number
  fecha?: string
  detalle?: string
}

export interface CargasResumen360 {
  seguimientos: boolean
  hojasDeVida: boolean
  empleabilidad: boolean
}

export interface ResumenAccionable360 {
  atenciones: Atencion360[]
  responsable: string | null
  ultimoSeguimiento: SeguimientoResponse | null
  diasSinSeguimiento: number | null
  proximoCompromiso: SeguimientoResponse | null
  hojaDeVidaVigente: HojaDeVidaResponse | null
  postulacionesActivas: number | null
  entrevistaProxima: PostulacionResponse | null
  etapa: string | null
}

export interface DatosResumen360 {
  estudiante: Pick<
    EstudianteResponse,
    | 'estadoEmpleabilidad'
    | 'responsableNombre'
    | 'pendientesPreparacion'
  >
  seguimientos: SeguimientoResponse[]
  hojasDeVida: HojaDeVidaResponse[]
  postulaciones: PostulacionResponse[]
  pipeline: PipelineEmpleabilidadResponse | null
  cargas: CargasResumen360
}

/** Una fecha `yyyy-MM-dd` se compara como calendario, sin convertirla a UTC. */
function diaUtc(valor: string | null | undefined): number | null {
  if (!valor) return null
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!coincidencia) return null
  const [, anio, mes, dia] = coincidencia
  return Date.UTC(Number(anio), Number(mes) - 1, Number(dia))
}

function hoyUtc(ahora: Date): number {
  return Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

function diasEntre(desde: string | null | undefined, hasta: Date): number | null {
  const inicio = diaUtc(desde)
  if (inicio == null) return null
  return Math.max(0, Math.floor((hoyUtc(hasta) - inicio) / 86_400_000))
}

function completado(estado: string | null | undefined): boolean {
  return (estado ?? '').trim().toUpperCase().startsWith('COMPLET')
}

function ordenarPorFecha<T>(items: T[], fecha: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => (diaUtc(fecha(a)) ?? 0) - (diaUtc(fecha(b)) ?? 0))
}

function fechaHora(valor: string | null | undefined): number | null {
  if (!valor) return null
  const tiempo = new Date(valor).getTime()
  return Number.isFinite(tiempo) ? tiempo : null
}

/**
 * Construye la lectura operativa del Perfil 360 sin inventar datos.
 *
 * Cada alerta negativa depende de que su fuente haya terminado de cargar. Una
 * API fallida se podrá representar aparte en la pantalla, pero nunca se
 * traduce aquí como «el estudiante no tiene registros».
 */
export function calcularResumenAccionable360(
  datos: DatosResumen360,
  ahora = new Date(),
): ResumenAccionable360 {
  const atenciones: Atencion360[] = []
  const responsable = datos.estudiante.responsableNombre?.trim() || null

  let ultimoSeguimiento: SeguimientoResponse | null = null
  let diasSinSeguimiento: number | null = null
  let proximoCompromiso: SeguimientoResponse | null = null

  if (!datos.cargas.seguimientos) {
    const conFecha = datos.seguimientos.filter((item) => diaUtc(item.fecha) != null)
    ultimoSeguimiento = ordenarPorFecha(conFecha, (item) => item.fecha).at(-1) ?? null
    diasSinSeguimiento = ultimoSeguimiento ? diasEntre(ultimoSeguimiento.fecha, ahora) : null

    const compromisos = ordenarPorFecha(
      datos.seguimientos.filter(
        (item) => !completado(item.estado) && diaUtc(item.fechaProxima) != null,
      ),
      (item) => item.fechaProxima,
    )
    proximoCompromiso = compromisos[0] ?? null

    const vencidos = compromisos.filter(
      (item) => (diaUtc(item.fechaProxima) ?? Number.POSITIVE_INFINITY) <= hoyUtc(ahora),
    )
    if (vencidos.length > 0) {
      atenciones.push({
        codigo: 'SEGUIMIENTO_VENCIDO',
        nivel: 'ALTA',
        accion: 'SEGUIMIENTO',
        cantidad: vencidos.length,
        fecha: vencidos[0].fechaProxima ?? undefined,
        detalle: vencidos[0].proximaAccion ?? undefined,
      })
    } else if (!ultimoSeguimiento) {
      atenciones.push({
        codigo: 'SIN_SEGUIMIENTO',
        nivel: 'ALTA',
        accion: 'SEGUIMIENTO',
      })
    } else if ((diasSinSeguimiento ?? 0) >= DIAS_SIN_SEGUIMIENTO) {
      atenciones.push({
        codigo: 'SIN_CONTACTO_RECIENTE',
        nivel: 'MEDIA',
        accion: 'SEGUIMIENTO',
        dias: diasSinSeguimiento ?? undefined,
        fecha: ultimoSeguimiento.fecha,
      })
    }
  }

  let hojaDeVidaVigente: HojaDeVidaResponse | null = null
  if (!datos.cargas.hojasDeVida) {
    hojaDeVidaVigente = [...datos.hojasDeVida]
      .filter((item) => item.actual)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    if (!hojaDeVidaVigente) {
      atenciones.push({
        codigo: 'SIN_CV_VIGENTE',
        nivel: 'ALTA',
        accion: 'HV',
      })
    }
  }

  let postulacionesActivas: number | null = null
  let entrevistaProxima: PostulacionResponse | null = null
  if (!datos.cargas.empleabilidad) {
    postulacionesActivas = datos.postulaciones.filter((item) => !item.estadoFinal).length

    const entrevistasVencidas = datos.postulaciones.filter((item) => item.entrevistaVencida)
    if (entrevistasVencidas.length > 0) {
      atenciones.push({
        codigo: 'ENTREVISTA_SIN_CERRAR',
        nivel: 'ALTA',
        accion: 'POSTULACIONES',
        cantidad: entrevistasVencidas.length,
        fecha: entrevistasVencidas[0].fechaHoraEntrevista ?? undefined,
        detalle: entrevistasVencidas[0].cargo,
      })
    }

    entrevistaProxima = [...datos.postulaciones]
      .filter((item) => {
        const fecha = fechaHora(item.fechaHoraEntrevista)
        return item.entrevistaPendiente && fecha != null && fecha >= ahora.getTime()
      })
      .sort(
        (a, b) =>
          (fechaHora(a.fechaHoraEntrevista) ?? Number.POSITIVE_INFINITY)
          - (fechaHora(b.fechaHoraEntrevista) ?? Number.POSITIVE_INFINITY),
      )[0] ?? null

    if (datos.estudiante.estadoEmpleabilidad === 'BUSCANDO' && postulacionesActivas === 0) {
      atenciones.push({
        codigo: 'SIN_POSTULACIONES_ACTIVAS',
        nivel: 'MEDIA',
        accion: 'POSTULAR',
      })
    }

    if (entrevistaProxima) {
      atenciones.push({
        codigo: 'ENTREVISTA_PROXIMA',
        nivel: 'INFORMATIVA',
        accion: 'POSTULACIONES',
        fecha: entrevistaProxima.fechaHoraEntrevista ?? undefined,
        detalle: entrevistaProxima.cargo,
      })
    }
  }

  if (!responsable) {
    atenciones.push({
      codigo: 'SIN_RESPONSABLE',
      nivel: 'MEDIA',
    })
  }

  if (datos.estudiante.pendientesPreparacion.length > 0) {
    atenciones.push({
      codigo: 'PREPARACION_PENDIENTE',
      nivel: 'MEDIA',
      accion: 'PREPARACION',
      cantidad: datos.estudiante.pendientesPreparacion.length,
      detalle: datos.estudiante.pendientesPreparacion[0],
    })
  }

  const ordenNivel: Record<NivelAtencion360, number> = {
    ALTA: 0,
    MEDIA: 1,
    INFORMATIVA: 2,
  }
  atenciones.sort((a, b) => ordenNivel[a.nivel] - ordenNivel[b.nivel])

  return {
    atenciones,
    responsable,
    ultimoSeguimiento,
    diasSinSeguimiento,
    proximoCompromiso,
    hojaDeVidaVigente,
    postulacionesActivas,
    entrevistaProxima,
    etapa: datos.pipeline?.etapa ?? null,
  }
}
