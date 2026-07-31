/**
 * Cliente HTTP centralizado para el backend NOVA CRM.
 *
 * - Las peticiones van a rutas relativas: las atiende el proxy /api del
 *   servidor de Astro, que es quien habla con el backend.
 * - El token NO se maneja aqui. Vive en una cookie HttpOnly que el navegador
 *   envia sola y que el proxy traduce a la cabecera Authorization. Guardarlo
 *   en localStorage lo dejaba al alcance de cualquier XSS.
 * - En renderizado de servidor se puede pasar el token explicitamente via
 *   options.token.
 * - Lanza ApiCallError con el status HTTP y el cuerpo de error del backend
 *   para que los componentes puedan distinguir 401 de 422 de 500.
 */

import type { ApiError, LoginRequest } from './types'

const BASE_URL = ''

/** Cierra la sesion en el servidor, que es quien puede borrar la cookie. */
async function cerrarSesionCaducada(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await fetch('/auth/session', { method: 'DELETE' })
  } catch {
    // Si la llamada falla igualmente redirigimos: la cookie caducara sola.
  }
}

export class ApiCallError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
    message?: string,
  ) {
    super(message ?? body.message ?? `HTTP ${status}`)
    this.name = 'ApiCallError'
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  // Cuerpo tipado (se serializa como JSON automáticamente).
  data?: unknown
  // Token explícito para renderizado en servidor. En el navegador no se usa:
  // el proxy lo toma de la cookie HttpOnly.
  token?: string
}

async function apiFetch<T>(
  path: string,
  { data, token, headers: extraHeaders, ...init }: FetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders as Record<string, string>),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    headers,
    // La cookie de sesión debe viajar para que el proxy pueda autenticar.
    credentials: init.credentials ?? 'same-origin',
    cache: init.cache ?? 'no-store',
  })

  if (!response.ok) {
    // Solo el 401 cierra la sesión.
    //
    // El 403 significa "estás autenticado pero esto no es para ti", y es una
    // respuesta perfectamente normal: un estudiante pidiendo el dashboard de
    // administración recibe 403 y debe seguir dentro. Cerrarle la sesión ahí lo
    // dejaba sin poder entrar nunca: iniciaba sesión, la primera pantalla
    // pedía datos de admin, y el 403 lo devolvía a /login diciendo que su
    // sesión había expirado cuando acababa de crearla.
    //
    // El caso ambiguo —Spring devuelve 403 cuando un JWT vencido deja la
    // petición como anónima— lo resuelve el proxy antes de llegar aquí: ya
    // intentó renovar y, si el refresh tampoco valía, responde 401.
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !path.startsWith('/api/v1/auth/')
    ) {
      await cerrarSesionCaducada()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?expired=1')
      }
    }
    let errorBody: ApiError = { status: response.status }
    try {
      errorBody = await response.json()
    } catch {
      // el body no era JSON; dejamos el objeto mínimo
    }
    throw new ApiCallError(response.status, errorBody)
  }

  // 204 No Content: devolver undefined tipado como T
  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}

/**
 * Cabecera de autenticación solo para renderizado en servidor. En el navegador
 * se devuelve vacía a propósito: la cookie HttpOnly viaja sola y el proxy la
 * convierte en el Authorization que espera el backend.
 */
function cabeceraAuth(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Arma el query string omitiendo claves vacias o nulas. */
function aQueryParams(p: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  return sp.toString()
}

/** Sube archivos como multipart/form-data (valores string o File). */
async function apiUpload<T>(
  path: string,
  fields: Record<string, File | File[] | string | undefined>,
  token?: string,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    if (Array.isArray(v)) {
      for (const archivo of v) form.append(k, archivo)
      continue
    }
    form.append(k, v)
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    body: form,
    headers: cabeceraAuth(token),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

/** Descarga un binario autenticado y dispara el guardado en el navegador. */
export async function apiDownload(path: string, nombreArchivo: string, opciones?: { method?: string; data?: unknown; token?: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opciones?.method ?? 'GET',
    headers: {
      ...(opciones?.data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...cabeceraAuth(opciones?.token),
    },
    body: opciones?.data !== undefined ? JSON.stringify(opciones.data) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sin el delay, algunos navegadores revocan antes de haber leido el blob y
  // la descarga cae con error de red.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Obtiene un binario autenticado sin descargarlo (previsualizaciones, visor PDF). */
export async function apiBlob(path: string, token?: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: cabeceraAuth(token),
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
  return res.blob()
}

/** Obtiene una respuesta HTML o de texto plano autenticada (vistas previas). */
export async function apiText(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
  return res.text()
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Usuario de la sesión. No incluye tokens: quedan en cookies HttpOnly. */
export interface UsuarioSesion {
  usuarioId: string
  email: string
  nombre: string
  roles: string[]
}

export const authApi = {
  /**
   * El login va contra /auth/session y no contra el backend directamente: esa
   * ruta guarda los tokens en cookies HttpOnly y devuelve solo el usuario, de
   * modo que el token nunca pasa por el JavaScript de la página.
   */
  login: (body: LoginRequest) =>
    apiFetch<UsuarioSesion>('/auth/session', { method: 'POST', data: body }),
  logout: () => apiFetch<{ mensaje: string }>('/auth/session', { method: 'DELETE' }),
  forgotPassword: (email: string) =>
    apiFetch<{ mensaje: string }>('/api/v1/auth/forgot-password', { method: 'POST', data: { email } }),
  resetPassword: (token: string, password: string) =>
    apiFetch<{ mensaje: string }>('/api/v1/auth/reset-password', { method: 'POST', data: { token, password } }),
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

import type {
  DashboardSummaryResponse,
  DashboardChartsResponse,
  AlertaResponse,
} from './types'

export const dashboardApi = {
  summary: (token?: string) =>
    apiFetch<DashboardSummaryResponse>('/api/v1/dashboard/summary', { token }),
  charts: (token?: string) =>
    apiFetch<DashboardChartsResponse>('/api/v1/dashboard/charts', { token }),
  alerts: (token?: string) =>
    apiFetch<AlertaResponse[]>('/api/v1/dashboard/alerts', { token }),
}

// ─── Programas ───────────────────────────────────────────────────────────────

import type { ProgramaResponse, ProgramaRequest, ProgramaEstado, ProgramaResumenResponse } from './types'

export const programasApi = {
  listar: () =>
    apiFetch<ProgramaResponse[]>('/api/v1/programas'),
  obtener: (id: string) =>
    apiFetch<ProgramaResponse>(`/api/v1/programas/${id}`),
  crear: (body: ProgramaRequest, token?: string) =>
    apiFetch<ProgramaResponse>('/api/v1/programas', { method: 'POST', data: body, token }),
  actualizar: (id: string, body: ProgramaRequest, token?: string) =>
    apiFetch<ProgramaResponse>(`/api/v1/programas/${id}`, { method: 'PUT', data: body, token }),
  cambiarEstado: (id: string, estado: ProgramaEstado, token?: string) =>
    apiFetch<ProgramaResponse>(`/api/v1/programas/${id}/estado`, {
      method: 'PATCH',
      data: { estado },
      token,
    }),
  resumen: (id: string, token?: string) =>
    apiFetch<ProgramaResumenResponse>(`/api/v1/programas/${id}/resumen`, { token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/programas/${id}`, { method: 'DELETE', token }),
}

// ─── Estudiantes ─────────────────────────────────────────────────────────────

import type { EstudianteResponse, EstudianteRequest, Page, PreparacionEstudianteRequest } from './types'

export const estudiantesApi = {
  listar: (programaId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(
      `/api/v1/estudiantes?programaId=${programaId}&page=${page}&size=${size}`,
      { token },
    ),
  listarIncompletos: (page = 0, size = 20, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(
      `/api/v1/estudiantes/incompletos?page=${page}&size=${size}`,
      { token },
    ),
  obtener: (id: string, token?: string) =>
    apiFetch<EstudianteResponse>(`/api/v1/estudiantes/${id}`, { token }),
  crear: (body: EstudianteRequest, token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes', {
      method: 'POST',
      data: body,
      token,
    }),
  actualizar: (id: string, body: EstudianteRequest, token?: string) =>
    apiFetch<EstudianteResponse>(`/api/v1/estudiantes/${id}`, {
      method: 'PUT',
      data: body,
      token,
    }),
  actualizarPreparacion: (id: string, body: PreparacionEstudianteRequest, token?: string) =>
    apiFetch<EstudianteResponse>(`/api/v1/estudiantes/${id}/preparacion`, {
      method: 'PATCH', data: body, token,
    }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${id}`, { method: 'DELETE', token }),
  listarPapelera: (programaId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(
      `/api/v1/estudiantes/papelera?programaId=${programaId}&page=${page}&size=${size}`,
      { token },
    ),
  restaurar: (id: string, token?: string) =>
    apiFetch<EstudianteResponse>(`/api/v1/estudiantes/${id}/restaurar`, { method: 'POST', token }),
  eliminarMasivo: (ids: string[], permanente = false, token?: string) =>
    apiFetch<void>('/api/v1/estudiantes/bulk-delete', {
      method: 'POST',
      data: { ids, permanente },
      token,
    }),
  buscarAvanzado: (params: { q?: string; programaId?: string; ciudad?: string; estadoAcademico?: string; estadoEmpleabilidad?: string; page?: number; size?: number }, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(`/api/v1/estudiantes/buscar?${aQueryParams({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`, { token }),
  subirFoto: (id: string, archivo: File, token?: string) =>
    apiUpload<EstudianteResponse>(`/api/v1/estudiantes/${id}/foto`, { archivo }, token),
  obtenerMiPerfil: (token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes/mi-perfil', { token }),
  actualizarMiPerfil: (body: EstudianteRequest, token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes/mi-perfil', { method: 'PUT', data: body, token }),
  guardarPlantillaPreferida: (plantillaId: string | null, token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes/mi-perfil/plantilla-preferida', {
      method: 'PUT',
      data: { plantillaId },
      token,
    }),
  vistaPreviaMiHv: (idioma?: 'es' | 'en', plantillaId?: string) => {
    const qs = aQueryParams({ idioma, plantillaId })
    return apiBlob(`/api/v1/estudiantes/mi-perfil/hv-vista-previa${qs ? `?${qs}` : ''}`)
  },
  descargarMiHvPdf: (idioma?: 'es' | 'en', plantillaId?: string, nombreArchivo = 'Mi-Hoja-de-Vida-CAC.pdf') => {
    const qs = aQueryParams({ idioma, plantillaId })
    return apiDownload(`/api/v1/estudiantes/mi-perfil/hv-pdf${qs ? `?${qs}` : ''}`, nombreArchivo)
  },
}

// ─── Importación Excel ───────────────────────────────────────────────────────

import type { ImportarResponse, ResultadoImportacionCrm } from './types'

export const importarCrmApi = {
  empresas: (archivo: File, simular = false, token?: string) =>
    apiUpload<ResultadoImportacionCrm>(`/api/v1/importar/empresas?simular=${simular}`, { archivo }, token),
  colocaciones: (archivo: File, simular = false, token?: string) =>
    apiUpload<ResultadoImportacionCrm>(`/api/v1/importar/colocaciones?simular=${simular}`, { archivo }, token),
}

/** Un correo automático del sistema, tal como lo describe el backend. */
export interface TipoCorreo {
  id: string
  etiqueta: string
  /** En qué momento lo manda el sistema. */
  cuando: string
}

export const correosApi = {
  tipos: () => apiFetch<TipoCorreo[]>('/api/v1/correos/tipos'),
  /**
   * HTML del correo con datos de ejemplo. Sale del mismo código que el envío
   * real, así que lo que se ve aquí es lo que le llega al estudiante.
   */
  vistaPrevia: (tipo: string, programaId?: string) =>
    apiText(`/api/v1/correos/vista-previa/${tipo}${programaId ? `?programaId=${programaId}` : ''}`),
}

export const reportesApi = {
  exportar: (tipo: string, formato: 'xlsx' | 'pdf' | 'csv', programaId?: string) =>
    apiDownload(
      `/api/v1/reportes/${tipo}/export?formato=${formato}${programaId ? `&programaId=${programaId}` : ''}`,
      // La fecha en el nombre evita el «reporte-estudiantes (3).xlsx» de la
      // carpeta de descargas cuando se saca el mismo informe varias veces.
      `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.${formato}`,
    ),
}

export const importarApi = {
  /** Envía un archivo .xlsx al backend (multipart/form-data). */
  importar: (archivo: File, programaId: string, token?: string): Promise<ImportarResponse> =>
    apiUpload<ImportarResponse>(`/api/v1/importar?programaId=${programaId}`, { archivo }, token),
}

// ─── Importaciones: preview e historial ──────────────────────────────────────

import type { ImportPreviewResponse, ImportacionHistorialResponse } from './types'

export const importarExtApi = {
  preview: (archivo: File, programaId: string, token?: string) =>
    apiUpload<ImportPreviewResponse>(`/api/v1/importar/preview?programaId=${programaId}`, { archivo }, token),
  historial: (token?: string) =>
    apiFetch<ImportacionHistorialResponse[]>('/api/v1/importar/historial', { token }),
}

// ─── Vacantes ────────────────────────────────────────────────────────────────

import type { VacanteRequest, VacanteResponse } from './types'

export const vacantesApi = {
  listar: (page = 0, size = 20, token?: string) =>
    apiFetch<Page<VacanteResponse>>(`/api/v1/vacantes?page=${page}&size=${size}`, { token }),
  obtener: (id: string, token?: string) =>
    apiFetch<VacanteResponse>(`/api/v1/vacantes/${id}`, { token }),
  crear: (datos: VacanteRequest, token?: string) =>
    apiFetch<VacanteResponse>('/api/v1/vacantes', { method: 'POST', data: datos, token }),
  actualizar: (id: string, datos: VacanteRequest, token?: string) =>
    apiFetch<VacanteResponse>(`/api/v1/vacantes/${id}`, { method: 'PUT', data: datos, token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/vacantes/${id}`, { method: 'DELETE', token }),
  /**
   * Registra una oferta que encontró un estudiante. Queda pendiente de que el
   * equipo la valide, así que no entra al listado general.
   */
  sugerir: (datos: VacanteRequest, token?: string) =>
    apiFetch<VacanteResponse>('/api/v1/vacantes/sugeridas', { method: 'POST', data: datos, token }),
  /** Escanea los portales de empleo bajo demanda (COORDINADOR/ADMIN). */
  escanear: (token?: string) =>
    apiFetch<{ vacantesNuevas: number }>('/api/v1/vacantes/scraping', { method: 'POST', token }),
}

// ─── Matches ─────────────────────────────────────────────────────────────────

import type { MatchResponse } from './types'

export const matchesApi = {
  obtenerMisMatches: (page = 0, size = 20, token?: string) =>
    apiFetch<Page<MatchResponse>>(`/api/v1/matches/mis-matches?page=${page}&size=${size}`, { token }),
  listarPorEstudiante: (estudianteId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<MatchResponse>>(
      `/api/v1/matches?estudianteId=${estudianteId}&page=${page}&size=${size}`,
      { token },
    ),
  contarPendientes: (estudianteId: string, token?: string) =>
    apiFetch<number>(`/api/v1/matches/pendientes?estudianteId=${estudianteId}`, { token }),
  marcarPostulado: (matchId: string, token?: string) =>
    apiFetch<void>(`/api/v1/matches/${matchId}/postular`, { method: 'PATCH', token }),
  ejecutarMatching: (token?: string) =>
    apiFetch<{ matchesCreados: number }>('/api/v1/matches/ejecutar', { method: 'POST', token }),
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

import type { NotificacionResponse, MensajeResponse } from './types'

export const notificacionesApi = {
  listarPorEstudiante: (estudianteId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<NotificacionResponse>>(
      `/api/v1/notificaciones?estudianteId=${estudianteId}&page=${page}&size=${size}`,
      { token },
    ),
  contarNoLeidas: (estudianteId: string, token?: string) =>
    apiFetch<number>(`/api/v1/notificaciones/no-leidas?estudianteId=${estudianteId}`, { token }),
  marcarLeida: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/notificaciones/${id}/leer`, { method: 'PUT', token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/notificaciones/${id}`, { method: 'DELETE', token }),
}

export const mensajesApi = {
  mios: (token?: string) =>
    apiFetch<MensajeResponse[]>('/api/v1/mensajes/mios', { token }),
  listar: (token?: string) =>
    apiFetch<MensajeResponse[]>('/api/v1/mensajes', { token }),
  enviar: (body: { asunto: string; contenido: string; archivos?: File[] }, token?: string) =>
    body.archivos?.length
      ? apiUpload<MensajeResponse>('/api/v1/mensajes/mios', {
          asunto: body.asunto,
          contenido: body.contenido,
          archivos: body.archivos,
        }, token)
      : apiFetch<MensajeResponse>('/api/v1/mensajes/mios', {
          method: 'POST', data: body, token,
        }),
  enviarAEstudiante: (estudianteId: string, respuesta: string, archivos?: File[], token?: string) =>
    archivos?.length
      ? apiUpload<MensajeResponse>(`/api/v1/mensajes/estudiantes/${estudianteId}`, { respuesta, archivos }, token)
      : apiFetch<MensajeResponse>(`/api/v1/mensajes/estudiantes/${estudianteId}`, {
          method: 'POST', data: { respuesta }, token,
        }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/mensajes/${id}`, { method: 'DELETE', token }),
}

// ─── Admin ───────────────────────────────────────────────────────────────────

import type { ChatContactoResponse, ChatDirectoMensajeResponse } from './types'

export const chatsApi = {
  contactos: (consulta: string, token?: string) =>
    apiFetch<ChatContactoResponse[]>(`/api/v1/chats/contactos?q=${encodeURIComponent(consulta)}`, { token }),
  conversacion: (contactoId: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse[]>(`/api/v1/chats/directos/${contactoId}`, { token }),
  enviar: (contactoId: string, contenido: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse>(`/api/v1/chats/directos/${contactoId}`, {
      method: 'POST', data: { contenido }, token,
    }),
}

export const adminApi = {
  softDeletePrograma: (programaId: string, token?: string) =>
    apiFetch<{ eliminados: number; tipo: string }>(`/api/v1/admin/programas/${programaId}/estudiantes`, {
      method: 'DELETE',
      token,
    }),
  resetPrograma: (programaId: string, token?: string) =>
    apiFetch<{ estudiantesEliminados: number; tipo: string }>(`/api/v1/admin/programas/${programaId}/reset`, {
      method: 'DELETE',
      token,
    }),
  restaurarProgramaEstudiantes: (programaId: string, token?: string) =>
    apiFetch<{ mensaje: string; estudiantesRestaurados: number }>(
      `/api/v1/admin/programas/${programaId}/restaurar-estudiantes`,
      { method: 'POST', token },
    ),
  purgarPapelera: (token?: string) =>
    apiFetch<{ eliminados: number; tipo: string; retencion: string }>('/api/v1/admin/purgar-papelera', {
      method: 'DELETE',
      token,
    }),
  cleanupSystem: (token?: string) =>
    apiFetch<{ mensaje: string }>('/api/v1/admin/cleanup', { method: 'DELETE', token }),
}

// ─── Documentos ──────────────────────────────────────────────────────────────

import type { DocumentoResponse } from './types'

export const documentosApi = {
  buscar: (params: { estudianteId?: string; programaId?: string; soloAdministrativos?: boolean; tipo?: string; q?: string; page?: number; size?: number }, token?: string) =>
    apiFetch<Page<DocumentoResponse>>(`/api/v1/documentos?${aQueryParams({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`, { token }),
  tipos: (token?: string) => apiFetch<string[]>('/api/v1/documentos/tipos', { token }),
  mios: (params: { tipo?: string; q?: string; page?: number; size?: number } = {}, token?: string) =>
    apiFetch<Page<DocumentoResponse>>(`/api/v1/documentos/mios?${aQueryParams({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`, { token }),
  versiones: (id: string, token?: string) =>
    apiFetch<DocumentoResponse[]>(`/api/v1/documentos/${id}/versiones`, { token }),
  subir: (archivo: File, params: { estudianteId?: string; programaId?: string; tipo?: string }, token?: string) =>
    apiUpload<DocumentoResponse>(`/api/v1/documentos?${aQueryParams(params)}`, { archivo }, token),
  subirMio: (archivo: File, tipo?: string, token?: string) =>
    apiUpload<DocumentoResponse>(`/api/v1/documentos/mios?${aQueryParams({ tipo })}`, { archivo }, token),
  descargar: (id: string, nombre: string) =>
    apiDownload(`/api/v1/documentos/${id}/descargar`, nombre),
  descargarMio: (id: string, nombre: string) =>
    apiDownload(`/api/v1/documentos/${id}/mi-descarga`, nombre),
  actualizar: (id: string, archivo: File, token?: string) =>
    apiUpload<DocumentoResponse>(`/api/v1/documentos/${id}`, { archivo }, token, 'PUT'),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/documentos/${id}`, { method: 'DELETE', token }),
  eliminarMio: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/documentos/${id}/mio`, { method: 'DELETE', token }),
}

// ─── Hojas de vida ───────────────────────────────────────────────────────────

import type {
  PlantillaResponse, HojaDeVidaResponse, GeneracionMasivaResponse, ExtraccionResponse,
  AnalisisCompletitudResponse, GenerarHvOpcionesRequest, DatosHvDto,
} from './types'

export const hvApi = {
  plantillas: (token?: string) =>
    apiFetch<PlantillaResponse[]>('/api/v1/hojas-de-vida/plantillas', { token }),
  crearPlantilla: (nombre: string, colorPrimario?: string, archivo?: File, token?: string) =>
    apiUpload<PlantillaResponse>('/api/v1/hojas-de-vida/plantillas', { nombre, colorPrimario, archivo }, token),
  marcarPredeterminada: (id: string, token?: string) =>
    apiFetch<PlantillaResponse>(`/api/v1/hojas-de-vida/plantillas/${id}/predeterminada`, { method: 'PATCH', token }),
  eliminarPlantilla: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/hojas-de-vida/plantillas/${id}`, { method: 'DELETE', token }),
  vistaPreviaPlantilla: (id: string) =>
    apiBlob(`/api/v1/hojas-de-vida/plantillas/${id}/vista-previa`),
  /**
   * Hoja de vida de un estudiante tal como saldría hoy, sin registrar una
   * versión. Es lo que se enseña antes de generar o descargar.
   */
  vistaPreviaEstudiante: (estudianteId: string, opciones?: { plantillaId?: string; idioma?: 'es' | 'en' }) =>
    apiBlob(`/api/v1/hojas-de-vida/vista-previa/${estudianteId}?${aQueryParams({ ...opciones, idioma: opciones?.idioma ?? 'es' })}`),
  generar: (estudianteId: string, opciones?: GenerarHvOpcionesRequest, token?: string) =>
    apiFetch<HojaDeVidaResponse>(
      `/api/v1/hojas-de-vida/generar/${estudianteId}`,
      { method: 'POST', data: opciones ?? {}, token }),
  generarMasiva: (body: { programaId?: string; estudianteIds?: string[]; plantillaId?: string; soloCompletos?: boolean }, token?: string) =>
    apiFetch<GeneracionMasivaResponse>('/api/v1/hojas-de-vida/generar-masiva', { method: 'POST', data: body, token }),
  deEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<HojaDeVidaResponse[]>(`/api/v1/hojas-de-vida/estudiante/${estudianteId}`, { token }),
  descargarPdf: (id: string, nombre: string) =>
    apiDownload(`/api/v1/hojas-de-vida/${id}/pdf`, nombre),
  marcarActual: (id: string, token?: string) =>
    apiFetch<HojaDeVidaResponse>(`/api/v1/hojas-de-vida/${id}/actual`, { method: 'PATCH', token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/hojas-de-vida/${id}`, { method: 'DELETE', token }),
  descargarZip: (estudianteIds: string[]) =>
    apiDownload('/api/v1/hojas-de-vida/descargar-zip', 'hojas-de-vida.zip', { method: 'POST', data: estudianteIds }),
  extraer: (archivo: File, token?: string) =>
    apiUpload<ExtraccionResponse>('/api/v1/hojas-de-vida/extraer', { archivo }, token),
  analizar: (estudianteId: string, token?: string) =>
    apiFetch<AnalisisCompletitudResponse>(`/api/v1/hojas-de-vida/analizar/${estudianteId}`, { token }),
  convertirPdf: (datos: DatosHvDto, opciones?: { idioma?: 'es' | 'en'; seccionesExcluidas?: string[]; camposExcluidos?: string[] }, nombreArchivo = 'HV-CAC.pdf') =>
    apiDownload('/api/v1/hojas-de-vida/convertir-pdf', nombreArchivo, {
      method: 'POST',
      data: {
        datos,
        idioma: opciones?.idioma ?? 'es',
        seccionesExcluidas: opciones?.seccionesExcluidas,
        camposExcluidos: opciones?.camposExcluidos,
      },
    }),
}


// ─── Perfil del estudiante: formaciones y experiencias ──────────────────────

import type { FormacionRequest, FormacionResponse, ExperienciaRequest, ExperienciaResponse } from './types'

export const perfilApi = {
  formaciones: (estudianteId: string, token?: string) =>
    apiFetch<FormacionResponse[]>(`/api/v1/estudiantes/${estudianteId}/formaciones`, { token }),
  crearFormacion: (estudianteId: string, body: FormacionRequest, token?: string) =>
    apiFetch<FormacionResponse>(`/api/v1/estudiantes/${estudianteId}/formaciones`, { method: 'POST', data: body, token }),
  actualizarFormacion: (estudianteId: string, id: string, body: FormacionRequest, token?: string) =>
    apiFetch<FormacionResponse>(`/api/v1/estudiantes/${estudianteId}/formaciones/${id}`, { method: 'PUT', data: body, token }),
  eliminarFormacion: (estudianteId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${estudianteId}/formaciones/${id}`, { method: 'DELETE', token }),
  experiencias: (estudianteId: string, token?: string) =>
    apiFetch<ExperienciaResponse[]>(`/api/v1/estudiantes/${estudianteId}/experiencias`, { token }),
  crearExperiencia: (estudianteId: string, body: ExperienciaRequest, token?: string) =>
    apiFetch<ExperienciaResponse>(`/api/v1/estudiantes/${estudianteId}/experiencias`, { method: 'POST', data: body, token }),
  actualizarExperiencia: (estudianteId: string, id: string, body: ExperienciaRequest, token?: string) =>
    apiFetch<ExperienciaResponse>(`/api/v1/estudiantes/${estudianteId}/experiencias/${id}`, { method: 'PUT', data: body, token }),
  eliminarExperiencia: (estudianteId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${estudianteId}/experiencias/${id}`, { method: 'DELETE', token }),
}

// ─── Seguimientos ────────────────────────────────────────────────────────────

import type { SeguimientoRequest, SeguimientoResponse } from './types'

export const seguimientosApi = {
  mio: (token?: string) => apiFetch<SeguimientoResponse[]>('/api/v1/seguimientos/mio', { token }),
  listar: (estudianteId: string, token?: string) =>
    apiFetch<SeguimientoResponse[]>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { token }),
  crear: (estudianteId: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { method: 'POST', data: body, token }),
  actualizar: (estudianteId: string, id: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'PUT', data: body, token }),
  eliminar: (estudianteId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'DELETE', token }),
}

import type { EmpresaRequest, EmpresaResponse, EstadoRelacionEmpresa } from './types'

export const empresasApi = {
  buscar: (params: { texto?: string; sector?: string; estado?: EstadoRelacionEmpresa; page?: number; size?: number } = {}) =>
    apiFetch<Page<EmpresaResponse>>(`/api/v1/empresas?${aQueryParams(params)}`),
  crear: (data: EmpresaRequest) => apiFetch<EmpresaResponse>('/api/v1/empresas', { method: 'POST', data }),
  actualizar: (id: string, data: EmpresaRequest) => apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}`, { method: 'PUT', data }),
  resumen: () => apiFetch<{ total: number; sinContactar: number; contactadas: number; enConversacion: number; aliadas: number; descartadas: number }>('/api/v1/empresas/resumen'),
  sectores: () => apiFetch<string[]>('/api/v1/empresas/sectores'),
  obtener: (id: string, token?: string) => apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}`, { token }),
  eliminar: (id: string, token?: string) => apiFetch<void>(`/api/v1/empresas/${id}`, { method: 'DELETE', token }),
  registrarContacto: (id: string, data: { estado?: EstadoRelacionEmpresa; proximoPaso?: string; nota?: string }) =>
    apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}/contacto`, { method: 'POST', data }),
}

// ─── Actividades ─────────────────────────────────────────────────────────────

import type { ActividadRequest, ActividadResponse } from './types'

export const actividadesApi = {
  porPrograma: (programaId: string, token?: string) =>
    apiFetch<ActividadResponse[]>(`/api/v1/programas/${programaId}/actividades`, { token }),
  proximas: (token?: string) =>
    apiFetch<ActividadResponse[]>('/api/v1/actividades/proximas', { token }),
  agenda: (token?: string) =>
    apiFetch<ActividadResponse[]>('/api/v1/actividades', { token }),
  mias: (token?: string) =>
    apiFetch<ActividadResponse[]>('/api/v1/actividades/mias', { token }),
  crearAgenda: (body: ActividadRequest, token?: string) =>
    apiFetch<ActividadResponse>('/api/v1/actividades', { method: 'POST', data: body, token }),
  actualizarAgenda: (id: string, body: ActividadRequest, token?: string) =>
    apiFetch<ActividadResponse>(`/api/v1/actividades/${id}`, { method: 'PUT', data: body, token }),
  alternarCompletada: (id: string, token?: string) =>
    apiFetch<ActividadResponse>(`/api/v1/actividades/${id}/completada`, { method: 'PATCH', token }),
  eliminarAgenda: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/actividades/${id}`, { method: 'DELETE', token }),
  crear: (programaId: string, body: ActividadRequest, token?: string) =>
    apiFetch<ActividadResponse>(`/api/v1/programas/${programaId}/actividades`, { method: 'POST', data: body, token }),
  actualizar: (programaId: string, id: string, body: ActividadRequest, token?: string) =>
    apiFetch<ActividadResponse>(`/api/v1/programas/${programaId}/actividades/${id}`, { method: 'PUT', data: body, token }),
  eliminar: (programaId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/programas/${programaId}/actividades/${id}`, { method: 'DELETE', token }),
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

import type { AuditoriaResponse } from './types'

export const auditoriaApi = {
  buscar: (params: { usuario?: string; modulo?: string; accion?: string; registroId?: string; page?: number; size?: number }, token?: string) =>
    apiFetch<Page<AuditoriaResponse>>(`/api/v1/auditoria?${aQueryParams({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`, { token }),
}



// ─── Buscador global ─────────────────────────────────────────────────────────

import type { BusquedaResponse } from './types'

export const busquedaApi = {
  buscar: (q: string, token?: string) =>
    apiFetch<BusquedaResponse>(`/api/v1/buscar?q=${encodeURIComponent(q)}`, { token }),
}

// ─── Usuarios (administración) ───────────────────────────────────────────────

import type { UsuarioResponse } from './types'

export const usuariosApi = {
  listar: (token?: string) => apiFetch<UsuarioResponse[]>('/api/v1/usuarios', { token }),
  crear: (body: { email: string; nombre: string; password: string; roles: string[] }, token?: string) =>
    apiFetch<UsuarioResponse>('/api/v1/usuarios', { method: 'POST', data: body, token }),
  actualizar: (id: string, body: { nombre?: string; roles?: string[]; activo?: boolean; password?: string }, token?: string) =>
    apiFetch<UsuarioResponse>(`/api/v1/usuarios/${id}`, { method: 'PUT', data: body, token }),
  desactivar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/usuarios/${id}`, { method: 'DELETE', token }),
}

// ─── Comunicaciones ──────────────────────────────────────────────────────────

import type { BrandingRequest, BrandingResponse, Padron, ResumenAltaCuentas } from './types'

/**
 * Recurso que acompaña a un anuncio. `FILE` cubre los documentos que se
 * adjuntan desde el editor (PDF, Word, Excel).
 */
export type TipoMediaAnuncio = 'IMAGE' | 'VIDEO' | 'LINK' | 'FILE'

export const comunicacionesApi = {
  /** Publica un anuncio que llega a los estudiantes como notificación. */
  publicarAnuncio: (
    body: { titulo: string; mensaje: string; programaId?: string; mediaUrl?: string; mediaTipo?: TipoMediaAnuncio },
    token?: string,
  ) =>
    apiFetch<{
      destinatarios: number
      correosEnviados: number
      correosFallidos: number
      mensaje: string
    }>(
      '/api/v1/notificaciones/anuncio',
      { method: 'POST', data: body, token },
    ),
  subirAdjuntoAnuncio: (archivo: File, token?: string) =>
    apiUpload<{ url: string; tipo: TipoMediaAnuncio; nombre: string }>(
      '/api/v1/notificaciones/anuncio/adjunto',
      { archivo },
      token,
    ),

  /**
   * Quién tiene cuenta y quién no. Es un GET: abrir la pantalla no debe hacer
   * una petición a la URL que crea cuentas.
   */
  padronEstudiantes: (token?: string) =>
    apiFetch<Padron>('/api/v1/admin/cuentas-estudiante', { token }),

  /**
   * Crea las cuentas de acceso que falten. `simulacion` va explícito porque el
   * backend simula por defecto: crear 107 cuentas no debe ser el efecto de una
   * llamada hecha por descuido.
   */
  crearCuentasEstudiante: (
    body: { estudianteIds?: string[]; enviarCorreo: boolean; simulacion: boolean },
    token?: string,
  ) =>
    apiFetch<ResumenAltaCuentas>('/api/v1/admin/cuentas-estudiante', {
      method: 'POST',
      data: body,
      token,
    }),
}

/**
 * Identidad visual por proyecto.
 *
 * `mio()` no lleva el id del programa a propósito: un estudiante no debe tener
 * que manejar —ni poder cambiar— el identificador de un proyecto. El servidor
 * lo deduce de su sesión.
 */
export const brandingApi = {
  mio: (token?: string) => apiFetch<BrandingResponse>('/api/v1/branding/mio', { token }),

  obtener: (programaId: string, token?: string) =>
    apiFetch<BrandingResponse>(`/api/v1/branding/${programaId}`, { token }),

  guardar: (programaId: string, body: BrandingRequest, token?: string) =>
    apiFetch<BrandingResponse>(`/api/v1/branding/${programaId}`, {
      method: 'PUT',
      data: body,
      token,
    }),

  /** Vuelve a la gama global del panel. */
  restablecer: (programaId: string, token?: string) =>
    apiFetch<void>(`/api/v1/branding/${programaId}`, { method: 'DELETE', token }),

  /** Sube una imagen ya optimizada y devuelve una URL pública de la marca. */
  subirImagen: (programaId: string, clave: string, archivo: File, token?: string) =>
    apiUpload<{ url: string }>(
      `/api/v1/branding/${programaId}/imagen`,
      { clave, archivo },
      token,
    ),
}

import type {
  ColocacionRequest,
  ColocacionResponse,
  MensajeWhatsappResponse,
  PipelineEmpleabilidadResponse,
  PostulacionResponse,
  ResumenColocaciones,
  ResumenPostulaciones,
  ResultadoEnvio,
  WhatsappRequest,
  WhatsappResponse,
} from './types'

export const whatsappApi = {
  /** El canal del programa del propio usuario. Lo usa el portal del estudiante. */
  mio: (token?: string) => apiFetch<WhatsappResponse>('/api/v1/whatsapp/mio', { token }),

  consultar: (programaId: string, token?: string) =>
    apiFetch<WhatsappResponse>(`/api/v1/whatsapp/${programaId}`, { token }),

  guardar: (programaId: string, body: WhatsappRequest, token?: string) =>
    apiFetch<WhatsappResponse>(`/api/v1/whatsapp/${programaId}`, {
      method: 'PUT',
      data: body,
      token,
    }),

  /** Mensaje de texto al propio número del negocio; única prueba sin plantilla. */
  probar: (programaId: string, token?: string) =>
    apiFetch<ResultadoEnvio>(`/api/v1/whatsapp/${programaId}/probar`, {
      method: 'POST',
      token,
    }),

  /** Bandeja del programa, de más nueva a más vieja. */
  bandeja: (programaId: string, token?: string) =>
    apiFetch<MensajeWhatsappResponse[]>(`/api/v1/whatsapp/${programaId}/mensajes`, { token }),
}

export const pipelineApi = {
  mio: (token?: string) =>
    apiFetch<PipelineEmpleabilidadResponse>('/api/v1/pipeline/mi-pipeline', { token }),
  porEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<PipelineEmpleabilidadResponse>(`/api/v1/pipeline/estudiante/${estudianteId}`, { token }),
}

export const postulacionesApi = {
  mias: (token?: string) =>
    apiFetch<PostulacionResponse[]>('/api/v1/postulaciones/mias', { token }),
  deEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<PostulacionResponse[]>(`/api/v1/postulaciones?estudianteId=${estudianteId}`, { token }),
  // Los nombres siguen a los del controller (`miResumen`, `registrarPropia`).
  // Las dos ramas habian creado un alias cada una para la misma llamada, y con
  // dos nombres por operacion el siguiente que toque esto no sabe cual es el
  // vivo.
  miResumen: (token?: string) =>
    apiFetch<ResumenPostulaciones>('/api/v1/postulaciones/mias/resumen', { token }),
  registrarPropia: (
    body: {
      vacanteId?: string | null
      empresaNombre: string
      cargo: string
      canal?: string | null
      fechaPostulacion?: string | null
      estado?: string | null
      urlOferta?: string | null
      observaciones?: string | null
    },
    token?: string,
  ) => apiFetch<PostulacionResponse>('/api/v1/postulaciones/mias', { method: 'POST', data: body, token }),
  actualizar: (
    id: string,
    body: { estado?: string; fechaRespuesta?: string | null; resultado?: string | null; observaciones?: string | null },
    token?: string,
  ) => apiFetch<PostulacionResponse>(`/api/v1/postulaciones/${id}`, { method: 'PATCH', data: body, token }),
  /** El controller responde con un mensaje, no con 204. */
  eliminar: (id: string, token?: string) =>
    apiFetch<{ mensaje?: string }>(`/api/v1/postulaciones/${id}`, { method: 'DELETE', token }),
  estados: (token?: string) =>
    apiFetch<Array<{ valor: string; etiqueta: string; esFinal: boolean }>>('/api/v1/postulaciones/estados', { token }),
}

/** Resultados laborales verificados; sustituyen la hoja de vinculados. */
export const colocacionesApi = {
  listar: (token?: string) => apiFetch<ColocacionResponse[]>('/api/v1/colocaciones', { token }),
  resumen: (token?: string) => apiFetch<ResumenColocaciones>('/api/v1/colocaciones/resumen', { token }),
  mia: (token?: string) => apiFetch<ColocacionResponse[]>('/api/v1/colocaciones/mia', { token }),
  deEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<ColocacionResponse[]>(`/api/v1/colocaciones/estudiante/${estudianteId}`, { token }),
  registrar: (body: ColocacionRequest, token?: string) =>
    apiFetch<ColocacionResponse>('/api/v1/colocaciones', { method: 'POST', data: body, token }),
  actualizar: (id: string, body: ColocacionRequest, token?: string) =>
    apiFetch<ColocacionResponse>(`/api/v1/colocaciones/${id}`, { method: 'PUT', data: body, token }),
  cerrar: (id: string, motivo?: string, token?: string) =>
    apiFetch<{ mensaje: string }>(`/api/v1/colocaciones/${id}/cerrar`, { method: 'POST', data: { motivo }, token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/colocaciones/${id}`, { method: 'DELETE', token }),
}
