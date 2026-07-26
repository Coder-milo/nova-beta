/**
 * Cliente HTTP centralizado para el backend NOVA CRM.
 *
 * - Lee la URL base desde NEXT_PUBLIC_API_URL (.env.local).
 * - Adjunta automáticamente el header Authorization: Bearer <token>
 *   cuando existe un token en localStorage (clave: "nova_token").
 * - En Server Components de Next.js no hay localStorage; en ese caso
 *   el token debe pasarse explícitamente via options.token.
 * - Lanza ApiCallError con el status HTTP y el cuerpo de error del backend
 *   para que los componentes puedan distinguir 401 de 422 de 500.
 */

import type { ApiError, LoginRequest, LoginResponse } from './types'

const BASE_URL = ''

const TOKEN_KEY = 'nova_token'
const REFRESH_TOKEN_KEY = 'nova_refresh_token'
const USER_KEY = 'nova_user'
const ACCESS_COOKIE_MAX_AGE = 28_800

let refreshPromise: Promise<string | null> | null = null

function clearExpiredSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  document.cookie = 'nova_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

async function renewAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null
        const renewed = (await response.json()) as LoginResponse
        localStorage.setItem(TOKEN_KEY, renewed.token)
        localStorage.setItem(REFRESH_TOKEN_KEY, renewed.refreshToken)
        document.cookie = `nova_token=${renewed.token}; path=/; max-age=${ACCESS_COOKIE_MAX_AGE}; SameSite=Lax`
        window.dispatchEvent(new CustomEvent<string>('nova:token-refreshed', { detail: renewed.token }))
        return renewed.token
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
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
  // Token JWT opcional; si no se provee se intenta desde localStorage.
  token?: string
  retryAfterRefresh?: boolean
}

async function apiFetch<T>(
  path: string,
  { data, token, headers: extraHeaders, retryAfterRefresh = false, ...init }: FetchOptions = {},
): Promise<T> {
  // Resolver token: primero el parámetro explícito, luego localStorage.
  let jwt = token
  if (!jwt && typeof window !== 'undefined') {
    jwt = localStorage.getItem('nova_token') ?? undefined
  }

  const headers: Record<string, string> = {
    ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...(extraHeaders as Record<string, string>),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    headers,
    // Evita que Next.js cachee respuestas de la API del backend
    // a menos que el llamador lo solicite explícitamente.
    cache: init.cache ?? 'no-store',
  })

  if (!response.ok) {
    // Spring puede responder 403 cuando un JWT vencido deja la solicitud
    // como anónima. Renovamos una sola vez y repetimos la petición original.
    if (
      (response.status === 401 || response.status === 403) &&
      typeof window !== 'undefined' &&
      !path.startsWith('/api/v1/auth/') &&
      !retryAfterRefresh &&
      jwt
    ) {
      const renewedToken = await renewAccessToken()
      if (renewedToken) {
        return apiFetch<T>(path, {
          ...init,
          data,
          headers: extraHeaders,
          token: renewedToken,
          retryAfterRefresh: true,
        })
      }

      clearExpiredSession()
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

function resolverJwt(token?: string): string | undefined {
  if (token) return token
  if (typeof window !== 'undefined') return localStorage.getItem('nova_token') ?? undefined
  return undefined
}

/** Sube archivos como multipart/form-data (valores string o File). */
async function apiUpload<T>(path: string, fields: Record<string, File | string | undefined>, token?: string): Promise<T> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    form.append(k, v)
  }
  const jwt = resolverJwt(token)
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
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
export async function apiDownload(path: string, nombreArchivo: string, opciones?: { method?: string; data?: unknown }): Promise<void> {
  const jwt = resolverJwt()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opciones?.method ?? 'GET',
    headers: {
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(opciones?.data !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones?.data !== undefined ? JSON.stringify(opciones.data) : undefined,
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
  URL.revokeObjectURL(url)
}

/** Obtiene un binario autenticado sin descargarlo (previsualizaciones, visor PDF). */
export async function apiBlob(path: string): Promise<Blob> {
  const jwt = resolverJwt()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: ApiError = { status: res.status }
    try { body = await res.json() } catch { /* noop */ }
    throw new ApiCallError(res.status, body)
  }
  return res.blob()
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (body: LoginRequest) =>
    apiFetch<LoginResponse>('/api/v1/auth/login', { method: 'POST', data: body }),
  refresh: (refreshToken: string) =>
    apiFetch<LoginResponse>('/api/v1/auth/refresh', { method: 'POST', data: { refreshToken } }),
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

import type { EstudianteResponse, EstudianteRequest, Page } from './types'

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
  buscarAvanzado: (params: { q?: string; programaId?: string; ciudad?: string; estadoAcademico?: string; estadoEmpleabilidad?: string; page?: number; size?: number }, token?: string) => {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.programaId) sp.set('programaId', params.programaId)
    if (params.ciudad) sp.set('ciudad', params.ciudad)
    if (params.estadoAcademico) sp.set('estadoAcademico', params.estadoAcademico)
    if (params.estadoEmpleabilidad) sp.set('estadoEmpleabilidad', params.estadoEmpleabilidad)
    sp.set('page', String(params.page ?? 0)); sp.set('size', String(params.size ?? 20))
    return apiFetch<Page<EstudianteResponse>>(`/api/v1/estudiantes/buscar?${sp}`, { token })
  },
  vincularPrograma: (id: string, programaId: string, token?: string) =>
    apiFetch<EstudianteResponse>(`/api/v1/estudiantes/${id}/programa`, { method: 'PATCH', data: { programaId }, token }),
  subirFoto: (id: string, archivo: File, token?: string) =>
    apiUpload<EstudianteResponse>(`/api/v1/estudiantes/${id}/foto`, { archivo }, token),
  obtenerMiPerfil: (token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes/mi-perfil', { token }),
  actualizarMiPerfil: (body: EstudianteRequest, token?: string) =>
    apiFetch<EstudianteResponse>('/api/v1/estudiantes/mi-perfil', { method: 'PUT', data: body, token }),
  descargarMiHvPdf: (nombreArchivo = 'Mi-Hoja-de-Vida-CAC.pdf') =>
    apiDownload('/api/v1/estudiantes/mi-perfil/hv-pdf', nombreArchivo),
}

// ─── Importación Excel ───────────────────────────────────────────────────────

import type { ImportarResponse } from './types'

export const importarApi = {
  /**
   * Envía un archivo .xlsx al backend.
   * Usa FormData (multipart/form-data); NO poner Content-Type manualmente.
   */
  importar: (archivo: File, programaId: string, token?: string): Promise<ImportarResponse> => {
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('programaId', programaId)

    let jwt = token
    if (!jwt && typeof window !== 'undefined') {
      jwt = localStorage.getItem('nova_token') ?? undefined
    }

    return fetch(`${BASE_URL}/api/v1/importar`, {
      method: 'POST',
      body: form,
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      cache: 'no-store',
    }).then(async (res) => {
      if (!res.ok) {
        let body: ApiError = { status: res.status }
        try { body = await res.json() } catch { /* noop */ }
        throw new ApiCallError(res.status, body)
      }
      return res.json()
    })
  },
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

import type { VacanteResponse } from './types'

export const vacantesApi = {
  listar: (page = 0, size = 20, token?: string) =>
    apiFetch<Page<VacanteResponse>>(`/api/v1/vacantes?page=${page}&size=${size}`, { token }),
  obtener: (id: string, token?: string) =>
    apiFetch<VacanteResponse>(`/api/v1/vacantes/${id}`, { token }),
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

// ─── Certificaciones ─────────────────────────────────────────────────────────

import type { CertificacionResponse } from './types'

export const certificacionesApi = {
  listarPorPrograma: (programaId: string, token?: string) =>
    apiFetch<CertificacionResponse[]>(`/api/v1/certificaciones?programaId=${programaId}`, { token }),
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

import type { NotificacionResponse } from './types'

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
}

// ─── Admin ───────────────────────────────────────────────────────────────────

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
  buscar: (params: { estudianteId?: string; programaId?: string; tipo?: string; q?: string; page?: number; size?: number }, token?: string) => {
    const sp = new URLSearchParams()
    if (params.estudianteId) sp.set('estudianteId', params.estudianteId)
    if (params.programaId) sp.set('programaId', params.programaId)
    if (params.tipo) sp.set('tipo', params.tipo)
    if (params.q) sp.set('q', params.q)
    sp.set('page', String(params.page ?? 0)); sp.set('size', String(params.size ?? 20))
    return apiFetch<Page<DocumentoResponse>>(`/api/v1/documentos?${sp}`, { token })
  },
  tipos: (token?: string) => apiFetch<string[]>('/api/v1/documentos/tipos', { token }),
  versiones: (id: string, token?: string) =>
    apiFetch<DocumentoResponse[]>(`/api/v1/documentos/${id}/versiones`, { token }),
  subir: (archivo: File, params: { estudianteId?: string; programaId?: string; tipo?: string }, token?: string) => {
    const sp = new URLSearchParams()
    if (params.estudianteId) sp.set('estudianteId', params.estudianteId)
    if (params.programaId) sp.set('programaId', params.programaId)
    if (params.tipo) sp.set('tipo', params.tipo)
    return apiUpload<DocumentoResponse>(`/api/v1/documentos?${sp}`, { archivo }, token)
  },
  descargar: (id: string, nombre: string) =>
    apiDownload(`/api/v1/documentos/${id}/descargar`, nombre),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/documentos/${id}`, { method: 'DELETE', token }),
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
  listar: (estudianteId: string, token?: string) =>
    apiFetch<SeguimientoResponse[]>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { token }),
  crear: (estudianteId: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { method: 'POST', data: body, token }),
  actualizar: (estudianteId: string, id: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'PUT', data: body, token }),
  eliminar: (estudianteId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'DELETE', token }),
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
  buscar: (params: { usuario?: string; modulo?: string; accion?: string; registroId?: string; page?: number; size?: number }, token?: string) => {
    const sp = new URLSearchParams()
    if (params.usuario) sp.set('usuario', params.usuario)
    if (params.modulo) sp.set('modulo', params.modulo)
    if (params.accion) sp.set('accion', params.accion)
    if (params.registroId) sp.set('registroId', params.registroId)
    sp.set('page', String(params.page ?? 0)); sp.set('size', String(params.size ?? 20))
    return apiFetch<Page<AuditoriaResponse>>(`/api/v1/auditoria?${sp}`, { token })
  },
  obtener: (id: string, token?: string) =>
    apiFetch<AuditoriaResponse>(`/api/v1/auditoria/${id}`, { token }),
}

// ─── Reportes (exportación) ──────────────────────────────────────────────────

export const reportesApi = {
  exportar: (tipo: 'estudiantes' | 'empleabilidad' | 'academico' | 'proyectos', formato: 'xlsx' | 'pdf', programaId?: string) =>
    apiDownload(
      `/api/v1/reportes/${tipo}/export?formato=${formato}${programaId ? `&programaId=${programaId}` : ''}`,
      `reporte-${tipo}.${formato}`),
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
