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

import type { ApiError } from './types'

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

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
}

async function apiFetch<T>(
  path: string,
  { data, token, headers: extraHeaders, ...init }: FetchOptions = {},
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
    // 401 fuera de /auth/ = token vencido o inválido: limpiar la sesión y
    // volver al login. (En /auth/ un 401 significa credenciales incorrectas
    // y lo maneja el formulario de login.)
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !path.startsWith('/api/v1/auth/')
    ) {
      localStorage.removeItem('nova_token')
      localStorage.removeItem('nova_user')
      document.cookie = 'nova_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
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

// ─── Auth ────────────────────────────────────────────────────────────────────

import type { LoginRequest, LoginResponse } from './types'

export const authApi = {
  login: (body: LoginRequest) =>
    apiFetch<LoginResponse>('/api/v1/auth/login', { method: 'POST', data: body }),
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

import type { ProgramaResponse, ProgramaRequest, ProgramaEstado } from './types'

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
}

// ─── Estudiantes ─────────────────────────────────────────────────────────────

import type { EstudianteResponse, EstudianteRequest, Page } from './types'

export const estudiantesApi = {
  listar: (programaId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(
      `/api/v1/estudiantes?programaId=${programaId}&page=${page}&size=${size}`,
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
