/**
 * Servicio de vacantes y conectores de scraping para NOVA-CRM.
 */

import { vacantesApi } from '@/lib/api'
import type { EstadoConector, ResultadoPruebaFuente, ResultadoActualizacion } from '@/lib/types'

export async function obtenerEstadoConectores(token?: string): Promise<EstadoConector[]> {
  return vacantesApi.obtenerEstadoConectores(token)
}

export async function probarConector(fuente: string, token?: string): Promise<ResultadoPruebaFuente> {
  return vacantesApi.probarConector(fuente, token)
}

export async function sincronizarConector(fuente: string, token?: string): Promise<ResultadoActualizacion> {
  return vacantesApi.sincronizarConector(fuente, token)
}

export const vacantesService = {
  obtenerEstadoConectores,
  probarConector,
  sincronizarConector,
  listar: vacantesApi.listar,
  obtener: vacantesApi.obtener,
  crear: vacantesApi.crear,
  actualizar: vacantesApi.actualizar,
  eliminar: vacantesApi.eliminar,
  sugerir: vacantesApi.sugerir,
  revisar: vacantesApi.revisar,
  cerrar: vacantesApi.cerrar,
  reabrir: vacantesApi.reabrir,
  escanear: vacantesApi.escanear,
  ejecuciones: vacantesApi.ejecuciones,
}
