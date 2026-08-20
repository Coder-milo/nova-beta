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
import { esperarBackendDisponible } from './backend-disponible'

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

// Vive en su propio modulo para poder probarlo con node --test; se reexporta
// para que nada de lo que ya lo importaba desde aqui tenga que cambiar.
export { ApiCallError } from './api-error'
import { ApiCallError } from './api-error'

/**
 * Mensaje legible de un error, para mostrarlo al usuario.
 *
 * Prefiere el mensaje que envió el backend (`ApiCallError.body.message`); si no
 * es un error de API, cae al mensaje del `Error`; y si no, al respaldo. Evita
 * que un 409/422 con detalle útil se muestre como un texto genérico.
 */
/**
 * El texto que se le enseña a alguien cuando algo falla.
 *
 * Solo se repite el mensaje del servidor: ese lo escribimos nosotros, en el
 * idioma de la persona y diciendo qué hacer. Cualquier otro error cae al
 * respaldo, que es la frase que puso la pantalla y siempre encaja con lo que
 * la persona estaba intentando.
 *
 * Antes se devolvía `e.message` de cualquier `Error`, y eso enseñaba dos cosas
 * que no ayudan a nadie: los fallos de red del navegador —«Failed to fetch»,
 * que es lo que sale cuando se cae el wifi— y las cadenas técnicas que lanza
 * el propio código, como «API Error». Quien lo leía no podía hacer nada con
 * eso, y encima tapaba la frase que sí explicaba el caso.
 *
 * El error original va a la consola: quien programa lo sigue teniendo, quien
 * usa la aplicación no.
 */
export function mensajeDeError(e: unknown, respaldo: string): string {
  if (e instanceof ApiCallError) return e.body.message ?? `Error ${e.status}`
  if (e !== undefined && e !== null) console.error(e)
  return respaldo
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
    // `/auth/session` queda fuera por lo mismo: su 401 es "esa contrasena no
    // es", no "tu sesion expiro". Tratarlo como caducidad borraba la sesion que
    // el usuario aun no habia abierto y le cambiaba el mensaje por uno falso.
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !path.startsWith('/api/v1/auth/') &&
      path !== '/auth/session'
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

  // Respuesta sin cuerpo: no hay JSON que parsear. Ocurre con el 204 No
  // Content y también con un 200 de cuerpo vacío, que es lo que devuelve un
  // endpoint `void` de Spring (p. ej. PATCH /matches/{id}/postular). Llamar
  // response.json() sobre un cuerpo vacío lanza "Unexpected end of JSON input"
  // y hacía que una postulación registrada correctamente pareciera fallar.
  if (response.status === 204) {
    return undefined as unknown as T
  }
  const texto = await response.text()
  if (!texto) {
    return undefined as unknown as T
  }
  return JSON.parse(texto) as T
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

  /**
   * Participantes por municipio del Atlántico.
   *
   * Sin `programaId` devuelve el departamento entero. Es el mismo endpoint
   * para «todos» y para un proyecto concreto: dos que calculen lo mismo con un
   * filtro de diferencia acaban divergiendo, y el total de uno deja de cuadrar
   * con la suma de los otros.
   */
  mapaAtlantico: (programaId?: string) =>
    apiFetch<MapaDelAtlantico>(
      `/api/v1/dashboard/mapa-atlantico${programaId ? `?programaId=${programaId}` : ''}`),
}

export interface MapaDelAtlantico {
  /** Los 23, siempre, incluidos los que están a cero. */
  municipios: { codigo: string; nombre: string; estudiantes: number }[]
  /** Ciudades escritas en la ficha que no son del departamento, tal cual. */
  sinUbicar: { ciudad: string; estudiantes: number }[]
  /** Fichas sin ciudad. Aparte: le falta el dato, no está mal escrito. */
  sinDato: number
  /** Municipios + sin ubicar + sin dato tiene que dar esto. */
  total: number
}

// ─── Programas ───────────────────────────────────────────────────────────────

import type { ProgramaResponse, ProgramaRequest, ProgramaEstado, ProgramaResumenResponse } from './types'
import type { MotivoCierre, OpcionCatalogo, CatalogosColocacion, Tablero, TarjetaTablero, EstadoContacto } from './types'
import type { PlantillaCorreo, PlantillaCorreoRequest, VariableDisponible, PrevisualizacionCorreo, ResumenEnvioCorreo, PlantillaDefecto, EnviarPruebaRequest } from './types'

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

import type { EstudianteResponse, EstudianteRequest, Page, PreparacionEstudianteRequest, ResponsablePosible } from './types'

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
  /**
   * Marca un hito de preparación en varios participantes de una vez.
   *
   * Un solo hito por llamada, como en el backend: en bloque, marcar varios a
   * la vez casi siempre es un descuido. Ponerlos al día de uno en uno es lo
   * que hace que el equipo vuelva a la hoja de cálculo.
   */
  actualizarPreparacionMasiva: (ids: string[], hito: HitoPreparacion, valor: EstadoHito, token?: string) =>
    apiFetch<{ actualizados: number }>('/api/v1/estudiantes/preparacion-masiva', {
      method: 'PATCH',
      data: { ids, hito, valor },
      token,
    }),
  eliminarMasivo: (ids: string[], permanente = false, token?: string) =>
    apiFetch<void>('/api/v1/estudiantes/bulk-delete', {
      method: 'POST',
      data: { ids, permanente },
      token,
    }),
  /**
   * Asigna —o quita— el responsable de varios participantes de una vez.
   *
   * `responsableId` en null los deja sin responsable. No es un caso raro: es
   * como se libera el trabajo de alguien que deja el programa.
   */
  asignarResponsableMasivo: (ids: string[], responsableId: string | null, token?: string) =>
    apiFetch<{ actualizados: number }>('/api/v1/estudiantes/responsable-masivo', {
      method: 'PATCH',
      data: { ids, responsableId },
      token,
    }),
  /** Las cuentas del equipo que pueden llevar casos, con cuántos lleva cada una. */
  responsables: (token?: string) =>
    apiFetch<ResponsablePosible[]>('/api/v1/estudiantes/responsables', { token }),
  /** «Mis estudiantes». Sin `responsableId` devuelve los que no lleva nadie. */
  porResponsable: (responsableId?: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(
      `/api/v1/estudiantes/por-responsable?page=${page}&size=${size}`
        + (responsableId ? `&responsableId=${responsableId}` : ''),
      { token },
    ),
  buscarAvanzado: (params: { q?: string; programaId?: string; ciudad?: string; estadoAcademico?: string; estadoEmpleabilidad?: string; page?: number; size?: number }, token?: string) =>
    apiFetch<Page<EstudianteResponse>>(`/api/v1/estudiantes/buscar?${aQueryParams({ ...params, page: params.page ?? 0, size: params.size ?? 20 })}`, { token }),
  subirFoto: (id: string, archivo: File, token?: string) =>
    apiUpload<EstudianteResponse>(`/api/v1/estudiantes/${id}/foto`, { archivo }, token),
  /**
   * La foto del propio estudiante, sin mandar ningún id.
   *
   * El servidor resuelve de quién es a partir de la sesión. La ruta con id
   * existe para el equipo, que sí edita fichas ajenas, y comprueba la
   * propiedad antes de aceptar; pero desde el portal no hace falta enviar un
   * identificador que el cliente podría cambiar. Menos que comprobar es menos
   * que pueda fallar.
   */
  subirMiFoto: (archivo: File, token?: string) =>
    apiUpload<EstudianteResponse>('/api/v1/estudiantes/mi-perfil/foto', { archivo }, token),
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

import type {
  ImportarResponse,
  ResultadoImportacionCrm,
  ResultadoImportacionLibro,
} from './types'

/**
 * `planId` es lo que devuelve la simulación.
 *
 * Mandarlo de vuelta al importar de verdad significa «ejecuta el análisis que
 * enseñaste»: mismo destino de hoja y mismo campo por columna. Sin él el
 * backend vuelve a analizar el archivo, y como el reconocimiento se apoya en la
 * IA el segundo análisis puede no coincidir con el que se revisó.
 */
const conPlan = (base: string, simular: boolean, planId?: string | null) =>
  `${base}?simular=${simular}${planId ? `&planId=${planId}` : ''}`

/**
 * Despierta Render antes de enviar el archivo. La subida no se repite: un 502
 * también puede significar que el proxy perdió la respuesta mientras Spring
 * todavía procesa el Excel. Repetir en ese caso duplica el análisis y aumenta
 * justamente la presión de memoria que intentamos evitar.
 */
async function subirImportacion<T>(
  path: string,
  archivo: File,
  token?: string,
): Promise<T> {
  try {
    await esperarBackendDisponible()
  } catch {
    throw new ApiCallError(503, {
      status: 503,
      message: 'El servidor tardó demasiado en iniciar. Vuelve a intentarlo en un momento.',
    })
  }

  return apiUpload<T>(path, { archivo }, token)
}

export const importarCrmApi = {
  empresas: (archivo: File, simular = false, planId?: string | null, token?: string) =>
    subirImportacion<ResultadoImportacionCrm>(conPlan('/api/v1/importar/empresas', simular, planId), archivo, token),
  colocaciones: (archivo: File, simular = false, planId?: string | null, token?: string) =>
    subirImportacion<ResultadoImportacionCrm>(conPlan('/api/v1/importar/colocaciones', simular, planId), archivo, token),
  /**
   * Libro completo: una sola subida para un archivo con varias pestañas.
   *
   * Cada hoja se manda a su destino —participantes, empresas, postulaciones,
   * colocaciones— y las que no son datos importables se informan con su motivo.
   */
  libro: (archivo: File, simular = false, planId?: string | null, token?: string) =>
    subirImportacion<ResultadoImportacionLibro>(conPlan('/api/v1/importar/libro', simular, planId), archivo, token),
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

/**
 * Los informes que sabe generar el backend.
 *
 * `perfiles-laborales` es el que se le manda a una empresa: lleva el perfil
 * —experiencia, inglés, habilidades— y **no** documento, correo ni celular.
 * `panorama` es el interno: en PDF sale con gráficos; en xlsx y csv, las mismas
 * cifras en tabla.
 */
export type TipoDeReporte =
  | 'estudiantes'
  | 'empleabilidad'
  | 'academico'
  | 'proyectos'
  | 'perfiles-laborales'
  | 'panorama'

export const reportesApi = {
  /** @param vacanteId acota el banco de perfiles a quienes se postularon a esa oferta. */
  exportar: (
    tipo: TipoDeReporte,
    formato: 'xlsx' | 'pdf' | 'csv',
    programaId?: string,
    vacanteId?: string,
  ) =>
    apiDownload(
      `/api/v1/reportes/${tipo}/export?formato=${formato}`
        + (programaId ? `&programaId=${programaId}` : '')
        + (vacanteId ? `&vacanteId=${vacanteId}` : ''),
      // La fecha en el nombre evita el «reporte-estudiantes (3).xlsx» de la
      // carpeta de descargas cuando se saca el mismo informe varias veces.
      `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.${formato}`,
    ),

  /**
   * El catálogo de columnas elegibles.
   *
   * Lo decide el backend y no esta pantalla: si la lista viviera aquí, pedir
   * una columna que el servidor no conoce sería un error en la descarga en vez
   * de una casilla que no aparece.
   */
  columnas: () => apiFetch<ColumnaDeInforme[]>('/api/v1/reportes/columnas'),

  /** Las ciudades escritas en las fichas; el filtro compara por igualdad. */
  ciudades: () => apiFetch<string[]>('/api/v1/reportes/ciudades'),

  /** Va por POST: la lista de columnas no cabe cómoda en una URL. */
  exportarPersonalizado: (
    cuerpo: InformeAMedida,
    formato: 'xlsx' | 'pdf' | 'csv',
  ) =>
    apiDownload(
      `/api/v1/reportes/personalizado/export?formato=${formato}`,
      `informe-a-medida-${new Date().toISOString().slice(0, 10)}.${formato}`,
      { method: 'POST', data: cuerpo },
    ),
}

/** Una columna del catálogo cerrado de informes. */
export interface ColumnaDeInforme {
  id: string
  etiqueta: string
  /** Identifica o permite contactar a la persona. No se bloquea; se avisa. */
  personal: boolean
}

export interface InformeAMedida {
  columnas: string[]
  programaId?: string
  ciudad?: string
  estadoAcademico?: string
}

// ─── Fichas duplicadas de empresa ────────────────────────────────────────────

/** Cuántas filas cuelgan de una ficha; es lo que se movería al fusionar. */
export interface RegistrosDeEmpresa {
  vacantes: number
  acercamientos: number
  postulaciones: number
  colocaciones: number
  cuentas: number
  total: number
}

export interface PosibleDuplicado {
  fichas: { id: string; nombre: string; registros: number }[]
}

export const duplicadosEmpresaApi = {
  /** Sugerencias, no decisiones: dos nombres casi iguales pueden ser dos empresas. */
  posibles: () =>
    apiFetch<PosibleDuplicado[]>('/api/v1/empresas/posibles-duplicados'),

  registros: (empresaId: string) =>
    apiFetch<RegistrosDeEmpresa>(`/api/v1/empresas/${empresaId}/registros`),

  /**
   * `destinoId` se queda, `origenId` se absorbe y se desactiva.
   * No se borra nada y no se pisa ningún dato. No se puede deshacer.
   */
  fusionar: (destinoId: string, origenId: string) =>
    apiFetch<RegistrosDeEmpresa>(`/api/v1/empresas/${destinoId}/fusionar/${origenId}`,
      { method: 'POST' }),
}

// ─── Cuentas del portal de empresas ──────────────────────────────────────────

/**
 * Una cuenta con la que una empresa aliada entra al portal.
 *
 * No se crea con contraseña: se invita, y la persona la define con el enlace
 * que le llega. El equipo nunca escribe —ni ve— la clave de nadie de fuera.
 */
export interface CuentaDelPortal {
  id: string
  email: string
  nombre: string
  activa: boolean
  /** Invitada y todavía sin entrar: el enlace sigue vivo. */
  invitacionPendiente: boolean
}

export const cuentasEmpresaApi = {
  listar: (empresaId: string) =>
    apiFetch<CuentaDelPortal[]>(`/api/v1/empresas/${empresaId}/cuentas`),

  /** Manda el correo con el enlace. Reinvitar al mismo correo lo reenvía. */
  invitar: (empresaId: string, email: string, nombre?: string) =>
    apiFetch<{ usuarioId: string; email: string; empresaNombre: string; correoEnviado: boolean; detalle: string }>(
      `/api/v1/empresas/${empresaId}/cuentas`,
      { method: 'POST', data: { email, nombre } }),

  /** Desactiva y corta las sesiones abiertas. No borra: la auditoría se conserva. */
  revocar: (empresaId: string, usuarioId: string) =>
    apiFetch<{ mensaje: string }>(`/api/v1/empresas/${empresaId}/cuentas/${usuarioId}`,
      { method: 'DELETE' }),
}

// ─── Captación pública ───────────────────────────────────────────────────────

/**
 * Lo que manda una empresa sin cuenta.
 *
 * No hay campo de enlace a propósito: el alta interna acepta una URL y la lee
 * para completar datos, y hacerlo sin autenticar convertiría al servidor en un
 * cliente HTTP a las órdenes de cualquiera.
 */
export interface SolicitudPublicaDeVacante {
  empresa: string
  contacto: string
  email: string
  telefono: string
  titulo: string
  descripcion: string
  requisitos: string
  ciudad: string
  modalidad: string
  tipoContrato: string
  rangoSalarial: string
  /** Campo trampa: escondido en la pantalla, tiene que llegar vacío. */
  apodo: string
}

export const captacionPublicaApi = {
  /**
   * La única escritura que se hace sin sesión.
   *
   * Devuelve siempre la misma frase, sin identificador: la respuesta a una
   * petición anónima no debe servir para averiguar nada del sistema.
   */
  proponerVacante: (cuerpo: SolicitudPublicaDeVacante) =>
    apiFetch<{ mensaje: string }>('/api/v1/publico/vacantes', {
      method: 'POST',
      data: cuerpo,
    }),
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

import type { VacanteRequest, VacanteResponse, EjecucionDeScraping, EstadoConector, ResultadoPruebaFuente, ResultadoActualizacion } from './types'

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
   * Registra una oferta que encontró un estudiante.
   *
   * Entra con `revisada: false`. Sigue apareciendo en el listado —para que el
   * equipo pueda verla y validarla— pero el motor de matching la excluye, así
   * que no se le recomienda a nadie hasta que alguien la dé por buena con
   * {@link revisar}.
   */
  sugerir: (datos: VacanteRequest, token?: string) =>
    apiFetch<VacanteResponse>('/api/v1/vacantes/sugeridas', { method: 'POST', data: datos, token }),
  /**
   * Da por buena una oferta sugerida y la deja entrar al matching.
   *
   * Es la barrera que impide que una estafa de empleo llegue a toda la
   * cohorte de una sola corrida, así que sólo la cruza alguien del equipo.
   */
  revisar: (id: string, token?: string) =>
    apiFetch<VacanteResponse>(`/api/v1/vacantes/${id}/revisar`, { method: 'POST', token }),
  /**
   * Cierra una oferta indicando por qué.
   *
   * El motivo no es decorativo: distingue una plaza cubierta —el proceso llegó
   * a su fin— de una vencida, que es una oportunidad que se dejó pasar. Sin esa
   * diferencia no se puede medir si el programa está llegando tarde.
   */
  cerrar: (id: string, motivo?: MotivoCierre, token?: string) =>
    apiFetch<VacanteResponse>(
      `/api/v1/vacantes/${id}/cerrar${motivo ? `?motivo=${motivo}` : ''}`,
      { method: 'POST', token },
    ),
  /** Vuelve a abrir una oferta que se cerró por error. */
  reabrir: (id: string, token?: string) =>
    apiFetch<VacanteResponse>(`/api/v1/vacantes/${id}/reabrir`, { method: 'POST', token }),
  /** Escanea los portales de empleo bajo demanda (COORDINADOR/ADMIN). */
  escanear: (token?: string) =>
    apiFetch<{ vacantesNuevas: number }>('/api/v1/vacantes/scraping', { method: 'POST', token }),
  /**
   * Las últimas corridas de actualización, con sus errores.
   *
   * Responde «¿desde cuándo no entra nada de este portal?». Un portal cuyos
   * selectores se caen no falla: responde 200 y devuelve cero, así que sin ver
   * la serie el síntoma es igual que una semana floja de ofertas.
   */
  ejecuciones: (token?: string) =>
    apiFetch<EjecucionDeScraping[]>('/api/v1/vacantes/scraping/ejecuciones', { token }),
  /**
   * Estado en vivo de cada fuente y conector de empleo.
   */
  obtenerEstadoConectores: (token?: string) =>
    apiFetch<EstadoConector[]>('/api/v1/vacantes/scraping/fuentes', { token }),
  /**
   * Ejecuta una prueba exploratoria de conexión y conteo sin guardar datos.
   */
  probarConector: (fuente: string, token?: string) =>
    apiFetch<ResultadoPruebaFuente>(`/api/v1/vacantes/scraping/fuentes/${encodeURIComponent(fuente)}/probar`, {
      method: 'POST',
      token,
    }),
  /**
   * Sincroniza bajo demanda únicamente la fuente seleccionada y guarda las ofertas.
   */
  sincronizarConector: (fuente: string, token?: string) =>
    apiFetch<ResultadoActualizacion>(`/api/v1/vacantes/scraping/fuentes/${encodeURIComponent(fuente)}/sincronizar`, {
      method: 'POST',
      token,
    }),
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
  cancelarPostulacion: (matchId: string, token?: string) =>
    apiFetch<void>(`/api/v1/matches/${matchId}/cancelar-postulacion`, { method: 'PATCH', token }),
  descartar: (matchId: string, token?: string) =>
    apiFetch<void>(`/api/v1/matches/${matchId}`, { method: 'DELETE', token }),
  ejecutarMatching: (token?: string) =>
    apiFetch<{ matchesCreados: number }>('/api/v1/matches/ejecutar', { method: 'POST', token }),
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

import type { NotificacionResponse, MensajeResponse, MensajeTurnoResponse, ReaccionResumen } from './types'

export const notificacionesApi = {
  /**
   * Las del estudiante autenticado, sin mandar su id.
   *
   * Las rutas con `estudianteId` son del equipo, que sí consulta fichas
   * ajenas y por eso comprueban la propiedad. Desde el portal no hace falta
   * enviar un identificador que el cliente podría cambiar, y así tampoco hay
   * que pedir el perfil entero sólo para saberlo.
   */
  mias: (page = 0, size = 20, token?: string) =>
    apiFetch<Page<NotificacionResponse>>(
      `/api/v1/notificaciones/mias?page=${page}&size=${size}`, { token }),
  misNoLeidas: (token?: string) =>
    apiFetch<number>('/api/v1/notificaciones/mias/no-leidas', { token }),
  marcarMisLeidas: (token?: string) =>
    apiFetch<void>('/api/v1/notificaciones/mias/marcar-leidas', { method: 'PUT', token }),
  listarPorEstudiante: (estudianteId: string, page = 0, size = 20, token?: string) =>
    apiFetch<Page<NotificacionResponse>>(
      `/api/v1/notificaciones?estudianteId=${estudianteId}&page=${page}&size=${size}`,
      { token },
    ),
  contarNoLeidas: (estudianteId: string, token?: string) =>
    apiFetch<number>(`/api/v1/notificaciones/no-leidas?estudianteId=${estudianteId}`, { token }),
  marcarLeida: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/notificaciones/${id}/leer`, { method: 'PUT', token }),
  /**
   * Marca de una vez todo lo que quede sin leer.
   *
   * Con una campana que acumula avisos de matches, anuncios y mensajes, dejar
   * el contador a cero de una en una no es viable: el endpoint existía desde
   * el principio y no había forma de llamarlo.
   */
  marcarTodasLeidas: (estudianteId: string, token?: string) =>
    apiFetch<void>(
      `/api/v1/notificaciones/marcar-todas-leidas?estudianteId=${estudianteId}`,
      { method: 'PUT', token },
    ),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/notificaciones/${id}`, { method: 'DELETE', token }),
}

export const mensajesApi = {
  /**
   * Cuántos hilos esperan atención. Sólo el número.
   *
   * La campana lo calculaba trayéndose la lista entera cada 45 segundos y
   * contándola aquí: todos los hilos que existen, con sus adjuntos, para
   * pintar un número de dos dígitos.
   */
  pendientes: (token?: string) => apiFetch<number>('/api/v1/mensajes/pendientes', { token }),
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

  // ── Conversación por turnos ───────────────────────────────────────────────

  /** El hilo completo, en orden, con adjuntos y reacciones de cada turno. */
  turnos: (mensajeId: string, token?: string) =>
    apiFetch<MensajeTurnoResponse[]>(`/api/v1/mensajes/${mensajeId}/turnos`, { token }),

  /**
   * Añade una intervención al hilo.
   *
   * Sirve a las dos partes: el servidor deduce de quién es la sesión para
   * saber de qué lado se pinta, así que no hay que decírselo.
   */
  escribirEnHilo: (
    mensajeId: string,
    body: { contenido: string; enRespuestaA?: string; archivos?: File[] },
    token?: string,
  ) =>
    body.archivos?.length
      ? apiUpload<MensajeTurnoResponse>(`/api/v1/mensajes/${mensajeId}/turnos`, {
          contenido: body.contenido,
          enRespuestaA: body.enRespuestaA,
          archivos: body.archivos,
        }, token)
      : apiFetch<MensajeTurnoResponse>(`/api/v1/mensajes/${mensajeId}/turnos`, {
          method: 'POST',
          data: { contenido: body.contenido, enRespuestaA: body.enRespuestaA ?? null },
          token,
        }),

  /**
   * Pone o quita tu emoji sobre un turno y devuelve el recuento ya resuelto.
   *
   * Alterna: pulsar el mismo dos veces lo retira. Devolver sólo el recuento de
   * ese turno evita recargar el hilo entero para repintar un botón.
   */
  alternarReaccion: (turnoId: string, emoji: string, token?: string) =>
    apiFetch<ReaccionResumen[]>(
      `/api/v1/mensajes/turnos/${turnoId}/reacciones?emoji=${encodeURIComponent(emoji)}`,
      { method: 'POST', token },
    ),
}

/** La paleta que acepta el servidor. Cualquier otro emoji se rechaza. */
export const EMOJIS_REACCION = ['👍', '❤️', '🎉', '👏', '😀', '😮', '😢', '🙏'] as const

// ─── Admin ───────────────────────────────────────────────────────────────────

import type { ChatContactoResponse, ChatConversacionResponse, ChatDirectoMensajeResponse, ChatGrupoResponse, ChatGrupoMensajeResponse, ChatGrupoMiembroResponse } from './types'

export const chatsApi = {
  contactos: (consulta: string, token?: string) =>
    apiFetch<ChatContactoResponse[]>(`/api/v1/chats/contactos?q=${encodeURIComponent(consulta)}`, { token }),
  /** Con quién se ha hablado ya, sin tener que recordar el nombre. */
  conversaciones: (token?: string) =>
    apiFetch<ChatConversacionResponse[]>('/api/v1/chats/conversaciones', { token }),
  conversacion: (contactoId: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse[]>(`/api/v1/chats/directos/${contactoId}`, { token }),
  enviar: (contactoId: string, contenido: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse>(`/api/v1/chats/directos/${contactoId}`, {
      method: 'POST', data: { contenido }, token,
    }),
  /**
   * Envía un mensaje con imágenes o una nota de voz.
   *
   * Va por una ruta distinta y no sustituye a `enviar`: el envío de solo texto
   * es el que se usa en cada tecla y no tiene por qué pagar el coste de un
   * multipart.
   *
   * `duracion` son los segundos que dice durar el audio. El servidor la acota
   * porque la mide el navegador.
   */
  enviarConArchivos: (
    contactoId: string,
    contenido: string,
    archivos: File[],
    duracion?: number,
    token?: string,
  ) =>
    apiUpload<ChatDirectoMensajeResponse>(
      `/api/v1/chats/directos/${contactoId}/con-archivos`,
      {
        contenido,
        archivos,
        duracion: duracion !== undefined ? String(duracion) : undefined,
      },
      token,
    ),
  /** La URL desde la que se descarga un adjunto ya enviado. */
  urlAdjunto: (adjuntoId: string) => `${BASE_URL}/api/v1/chats/adjuntos/${adjuntoId}`,
  editar: (mensajeId: string, contenido: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse>(`/api/v1/chats/directos/mensajes/${mensajeId}`, {
      method: 'PUT', data: { contenido }, token,
    }),
  borrar: (mensajeId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/mensajes/${mensajeId}`, {
      method: 'DELETE', token,
    }),
  reenviar: (mensajeId: string, destinoId: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse>(`/api/v1/chats/directos/mensajes/${mensajeId}/reenviar?destinoId=${destinoId}`, {
      method: 'POST', token,
    }),
  /**
   * Reporta a un compañero por lo que escribió.
   *
   * El servidor guarda copia de lo último de la conversación: quien acosa
   * borra, y un reporte que apunta a mensajes borrados no le sirve a nadie.
   */
  reportar: (contactoId: string, motivo: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/${contactoId}/reportar`, {
      method: 'POST', data: { motivo }, token,
    }),
  /**
   * El tramo anterior a un mensaje, para subir por la conversación.
   *
   * Abrirla trae los últimos 200; esto es lo de antes. Lista vacía significa
   * que ya no hay más arriba.
   */
  anteriores: (contactoId: string, antesDe: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse[]>(
      `/api/v1/chats/directos/${contactoId}/anteriores?antesDe=${antesDe}`, { token }),
  /**
   * Busca dentro de una conversación, sin distinguir tildes ni mayúsculas.
   *
   * Pasa por el mismo control que abrirla: quien no puede leerla, tampoco
   * puede buscar dentro.
   */
  buscarEnConversacion: (contactoId: string, q: string, token?: string) =>
    apiFetch<ChatDirectoMensajeResponse[]>(
      `/api/v1/chats/directos/${contactoId}/buscar?q=${encodeURIComponent(q)}`, { token }),
  /**
   * Aparta la conversación de la bandeja de quien lo pide.
   *
   * Solo de quien lo pide: el otro no se entera. Y si escriben después,
   * vuelve sola a la bandeja — apartar no es dejar de enterarse.
   */
  archivar: (contactoId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/${contactoId}/archivar`, { method: 'POST', token }),
  desarchivar: (contactoId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/${contactoId}/archivar`, { method: 'DELETE', token }),
  /** Deja de recibir mensajes de esa persona, y de poder escribirle. */
  bloquear: (contactoId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/${contactoId}/bloquear`, { method: 'POST', token }),
  desbloquear: (contactoId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/directos/${contactoId}/bloquear`, { method: 'DELETE', token }),
  /** Los ids a los que bloqueó quien pregunta. */
  bloqueados: (token?: string) =>
    apiFetch<string[]>('/api/v1/chats/bloqueados', { token }),
}

import type { ReporteChatResponse } from './types'

/** La bandeja de reportes del chat, para coordinación y administración. */
export const reportesChatApi = {
  listar: (estado?: string, token?: string) =>
    apiFetch<Page<ReporteChatResponse>>(
      `/api/v1/chats/reportes${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`,
      { token },
    ),
  marcarRevisado: (id: string, token?: string) =>
    apiFetch<ReporteChatResponse>(`/api/v1/chats/reportes/${id}/revisado`, {
      method: 'POST', token,
    }),
}

export const gruposApi = {
  crear: (data: { nombre: string; descripcion?: string; miembroIds?: string[] }, token?: string) =>
    apiFetch<ChatGrupoResponse>('/api/v1/chats/grupos', {
      method: 'POST', data, token,
    }),
  misGrupos: (token?: string) =>
    apiFetch<ChatGrupoResponse[]>('/api/v1/chats/grupos', { token }),
  mensajes: (grupoId: string, token?: string) =>
    apiFetch<ChatGrupoMensajeResponse[]>(`/api/v1/chats/grupos/${grupoId}/mensajes`, { token }),
  /**
   * Escribe en el grupo.
   *
   * El texto va en el cuerpo y no en la URL: como parámetro acababa en los
   * registros del servidor, en los del proxy y en el historial del navegador,
   * y además una URL tiene límite de longitud, así que un mensaje largo
   * fallaba con un 414 en vez de con una explicación.
   */
  enviar: (grupoId: string, contenido: string, enRespuestaA?: string, token?: string) =>
    apiFetch<ChatGrupoMensajeResponse>(`/api/v1/chats/grupos/${grupoId}/mensajes`, {
      method: 'POST', data: { contenido, enRespuestaA }, token,
    }),
  /**
   * El tramo anterior a un mensaje del grupo, para subir por la conversación.
   *
   * Lista vacía significa que ya no hay más arriba.
   */
  anteriores: (grupoId: string, antesDe: string, token?: string) =>
    apiFetch<ChatGrupoMensajeResponse[]>(
      `/api/v1/chats/grupos/${grupoId}/anteriores?antesDe=${antesDe}`, { token }),
  /** Busca dentro del grupo. Solo quien pertenece. */
  buscarEnGrupo: (grupoId: string, q: string, token?: string) =>
    apiFetch<ChatGrupoMensajeResponse[]>(
      `/api/v1/chats/grupos/${grupoId}/buscar?q=${encodeURIComponent(q)}`, { token }),
  /** Quién está en el grupo. Solo lo ven sus miembros. */
  miembros: (grupoId: string, token?: string) =>
    apiFetch<ChatGrupoMiembroResponse[]>(`/api/v1/chats/grupos/${grupoId}/miembros`, { token }),
  agregarMiembros: (grupoId: string, estudianteIds: string[], token?: string) =>
    apiFetch<void>(`/api/v1/chats/grupos/${grupoId}/miembros`, {
      method: 'POST', data: estudianteIds, token,
    }),
  /** Salir del grupo. Si sale el último, el grupo se va con él. */
  salir: (grupoId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/grupos/${grupoId}/miembros/yo`, {
      method: 'DELETE', token,
    }),
  /**
   * Reporta a alguien del grupo por lo que escribió en él.
   *
   * Se reporta a la persona, no al grupo: cerrarlo por lo que escribió uno
   * castiga a todos los demás, que no hicieron nada.
   */
  reportarMiembro: (grupoId: string, estudianteId: string, motivo: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/grupos/${grupoId}/miembros/${estudianteId}/reportar`, {
      method: 'POST', data: { motivo }, token,
    }),
  /** Sacar a alguien del grupo. Solo un administrador. */
  expulsar: (grupoId: string, estudianteId: string, token?: string) =>
    apiFetch<void>(`/api/v1/chats/grupos/${grupoId}/miembros/${estudianteId}`, {
      method: 'DELETE', token,
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
  /**
   * Escanea la hoja de vida que sube el propio estudiante.
   *
   * Misma lectura que {@link extraer}, otra ruta: aquélla es la herramienta del
   * equipo para cargar hojas de vida ajenas y por eso pide rol de gestión. Ésta
   * no guarda nada, así que el estudiante puede leer la suya y decidir después
   * qué se lleva a su ficha.
   */
  extraerMia: (archivo: File, token?: string) =>
    apiUpload<ExtraccionResponse>('/api/v1/hojas-de-vida/mi-extraccion', { archivo }, token),
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

import type { SeguimientoDelEstudianteResponse, SeguimientoRequest, SeguimientoResponse } from './types'

export const seguimientosApi = {
  mio: (token?: string) => apiFetch<SeguimientoDelEstudianteResponse[]>('/api/v1/seguimientos/mio', { token }),
  listar: (estudianteId: string, token?: string) =>
    apiFetch<SeguimientoResponse[]>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { token }),
  crear: (estudianteId: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos`, { method: 'POST', data: body, token }),
  actualizar: (estudianteId: string, id: string, body: SeguimientoRequest, token?: string) =>
    apiFetch<SeguimientoResponse>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'PUT', data: body, token }),
  eliminar: (estudianteId: string, id: string, token?: string) =>
    apiFetch<void>(`/api/v1/estudiantes/${estudianteId}/seguimientos/${id}`, { method: 'DELETE', token }),
}

import type { PlataformaResponse, PlataformaRequest } from './types'

export const plataformasApi = {
  catalogo: (token?: string) => apiFetch<PlataformaResponse[]>('/api/v1/plataformas', { token }),
  crear: (body: PlataformaRequest, token?: string) =>
    apiFetch<PlataformaResponse>('/api/v1/plataformas', { method: 'POST', data: body, token }),
  actualizar: (id: string, body: PlataformaRequest, token?: string) =>
    apiFetch<PlataformaResponse>(`/api/v1/plataformas/${id}`, { method: 'PUT', data: body, token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/plataformas/${id}`, { method: 'DELETE', token }),
  mias: (token?: string) => apiFetch<PlataformaResponse[]>('/api/v1/plataformas/mias', { token }),
  dePrograma: (programaId: string, token?: string) =>
    apiFetch<PlataformaResponse[]>(`/api/v1/plataformas/programa/${programaId}`, { token }),
  asignarPrograma: (programaId: string, plataformaIds: string[], token?: string) =>
    apiFetch<PlataformaResponse[]>(`/api/v1/plataformas/programa/${programaId}`, {
      method: 'PUT', data: { plataformaIds }, token,
    }),
  deEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<PlataformaResponse[]>(`/api/v1/plataformas/estudiante/${estudianteId}`, { token }),
  asignarEstudiante: (estudianteId: string, plataformaIds: string[], token?: string) =>
    apiFetch<PlataformaResponse[]>(`/api/v1/plataformas/estudiante/${estudianteId}`, {
      method: 'PUT', data: { plataformaIds }, token,
    }),
}

import type { ContactoEmpresaResponse, EmpresaRequest, EmpresaResponse, EstadoRelacionEmpresa } from './types'

/**
 * Plantillas de correo: editor con variables, previsualización y envío masivo.
 *
 * Todo el módulo es de COORDINADOR o ADMIN; borrar, sólo de ADMIN.
 */
export const plantillasCorreoApi = {
  listar: (token?: string) => apiFetch<PlantillaCorreo[]>('/api/v1/plantillas-correo', { token }),
  /** Las variables que se pueden escribir dentro del texto, con su ejemplo. */
  variables: (token?: string) =>
    apiFetch<VariableDisponible[]>('/api/v1/plantillas-correo/variables', { token }),
  /** Alias para obtener las variables disponibles categorizadas. */
  obtenerVariables: (token?: string) =>
    apiFetch<VariableDisponible[]>('/api/v1/plantillas-correo/variables', { token }),
  obtener: (id: string, token?: string) =>
    apiFetch<PlantillaCorreo>(`/api/v1/plantillas-correo/${id}`, { token }),
  crear: (data: PlantillaCorreoRequest, token?: string) =>
    apiFetch<PlantillaCorreo>('/api/v1/plantillas-correo', { method: 'POST', data, token }),
  actualizar: (id: string, data: PlantillaCorreoRequest, token?: string) =>
    apiFetch<PlantillaCorreo>(`/api/v1/plantillas-correo/${id}`, { method: 'PUT', data, token }),
  eliminar: (id: string, token?: string) =>
    apiFetch<void>(`/api/v1/plantillas-correo/${id}`, { method: 'DELETE', token }),
  /**
   * Cómo queda el correo con datos de ejemplo.
   *
   * Es POST y no GET porque recibe la plantilla que se está escribiendo, que
   * todavía no está guardada.
   */
  previsualizar: (data: PlantillaCorreoRequest, token?: string) =>
    apiFetch<PrevisualizacionCorreo>('/api/v1/plantillas-correo/previsualizar', { method: 'POST', data, token }),
  /**
   * Obtiene la lista de plantillas predeterminadas del sistema.
   */
  obtenerDefaults: (token?: string) =>
    apiFetch<PlantillaDefecto[]>('/api/v1/plantillas-correo/sistema/defaults', { token }),
  /**
   * Restaura una plantilla guardada a sus valores por defecto de fábrica.
   */
  restaurarDefecto: (id: string, tipo?: string, token?: string) =>
    apiFetch<PlantillaCorreo>(`/api/v1/plantillas-correo/${id}/restaurar-defecto${tipo ? `?tipo=${tipo}` : ''}`, {
      method: 'POST',
      token,
    }),
  /**
   * Obtiene la plantilla por defecto para un tipo específico sin asociar a un ID existente.
   */
  restaurarDefectoPorTipo: (tipo: string, token?: string) =>
    apiFetch<PlantillaDefecto>(`/api/v1/plantillas-correo/restaurar-defecto/${tipo}`, {
      method: 'POST',
      token,
    }),
  /**
   * Envía un correo de prueba directo con variables simuladas.
   */
  enviarPrueba: (peticion: EnviarPruebaRequest, token?: string) =>
    apiFetch<ResumenEnvioCorreo>('/api/v1/plantillas-correo/enviar-prueba', {
      method: 'POST',
      data: peticion,
      token,
    }),
  /**
   * Envío masivo o segmentado.
   *
   * `simulacion` va explícito y en true por defecto, igual que en el backend:
   * mandar un correo a 108 personas no debe ser el efecto de un clic distraído.
   */
  enviar: (id: string, opciones: { estudianteIds?: string[]; programaId?: string; cohorte?: string; simulacion: boolean }, token?: string) =>
    apiFetch<ResumenEnvioCorreo>(`/api/v1/plantillas-correo/${id}/enviar`, {
      method: 'POST', data: opciones, token,
    }),
}

/**
 * Tablero de seguimiento: quién está en qué punto de la conversación.
 *
 * Sólo COORDINADOR y ADMIN. El tablero muestra a toda la cohorte a la vez, que
 * es justo lo que un estudiante no puede ver.
 */
/** Los hitos de preparación que se pueden marcar en bloque. */
export type HitoPreparacion =
  | 'CV_LISTO' | 'CV_INGLES' | 'LINKEDIN_CREADO' | 'LINKEDIN_OPTIMIZADO' | 'PERFIL_OCUPACIONAL'

export type EstadoHito = 'NO' | 'EN_PROCESO' | 'SI'

export const tableroApi = {
  obtener: (programaId?: string, token?: string) =>
    apiFetch<Tablero>(`/api/v1/seguimiento/tablero${programaId ? `?programaId=${programaId}` : ''}`, { token }),
  /**
   * Cambia el estado de contacto de un estudiante.
   *
   * Quién lo movió no se manda: sale de la sesión en el servidor. Es un dato de
   * auditoría y no algo que el cliente deba poder escribir.
   */
  mover: (estudianteId: string, estado: EstadoContacto, observacion?: string, token?: string) =>
    apiFetch<TarjetaTablero>(`/api/v1/seguimiento/tablero/${estudianteId}`, {
      method: 'PUT', data: { estado, observacion }, token,
    }),
}

export const empresasApi = {
  buscar: (params: { texto?: string; sector?: string; estado?: EstadoRelacionEmpresa; page?: number; size?: number } = {}) =>
    apiFetch<Page<EmpresaResponse>>(`/api/v1/empresas?${aQueryParams(params)}`),
  crear: (data: EmpresaRequest) => apiFetch<EmpresaResponse>('/api/v1/empresas', { method: 'POST', data }),
  actualizar: (id: string, data: EmpresaRequest) => apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}`, { method: 'PUT', data }),
  resumen: () => apiFetch<{ total: number; sinContactar: number; contactadas: number; enConversacion: number; aliadas: number; descartadas: number }>('/api/v1/empresas/resumen'),
  sectores: () => apiFetch<string[]>('/api/v1/empresas/sectores'),
  /** Los estados de relación que existen, según el enum del backend. */
  estadosRelacion: () => apiFetch<OpcionCatalogo[]>('/api/v1/empresas/estados-relacion'),
  obtener: (id: string, token?: string) => apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}`, { token }),
  eliminar: (id: string, token?: string) => apiFetch<void>(`/api/v1/empresas/${id}`, { method: 'DELETE', token }),
  registrarContacto: (id: string, data: { estado?: EstadoRelacionEmpresa; proximoPaso?: string; nota?: string }) =>
    apiFetch<EmpresaResponse>(`/api/v1/empresas/${id}/contacto`, { method: 'POST', data }),
  /**
   * El historial de acercamientos, lo más reciente primero.
   *
   * La tabla existía desde la migración V9 y nadie la leía ni la escribía: cada
   * nota se pegaba al campo de texto de la ficha.
   */
  contactos: (id: string, token?: string) =>
    apiFetch<ContactoEmpresaResponse[]>(`/api/v1/empresas/${id}/contactos`, { token }),
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
  crear: (body: { email: string; nombre: string; password: string; roles: string[]; empresaId?: string | null }, token?: string) =>
    apiFetch<UsuarioResponse>('/api/v1/usuarios', { method: 'POST', data: body, token }),
  actualizar: (id: string, body: { nombre?: string; roles?: string[]; activo?: boolean; password?: string; empresaId?: string | null }, token?: string) =>
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
    body: {
      titulo: string
      mensaje: string
      programaId?: string
      mediaUrl?: string
      mediaTipo?: TipoMediaAnuncio
      /** Avisar además por WhatsApp; requiere canal activo en el proyecto. */
      porWhatsapp?: boolean
    },
    token?: string,
  ) =>
    apiFetch<{
      destinatarios: number
      /** Cuántos salieron de verdad por WhatsApp, que no tiene por qué ser todos. */
      porWhatsapp: number
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

  /** Sube una imagen ya optimizada y devuelve la clave con la que referenciarla. */
  subirImagen: (programaId: string, clave: string, archivo: File, token?: string) =>
    apiUpload<{ clave?: string; url?: string }>(
      `/api/v1/branding/${programaId}/imagen`,
      { clave, archivo },
      token,
    ),
}

import type {
  ColocacionRequest,
  ColocacionResponse,
  CanalDeSoporteResponse,
  MensajeWhatsappResponse,
  CitaRequest,
  CrearPostulacionRequest,
  HitoDeLaLinea,
  ModalidadEntrevista,
  ModuloDeVista,
  VistaGuardada,
  MovimientoDeEmpresa,
  PerfilLaboral,
  PipelineEmpleabilidadResponse,
  PostulacionResponse,
  MiPostulacion,
  ResumenColocaciones,
  CandidatoAutomatizacionWhatsapp,
  ResumenAutomatizacionWhatsapp,
  MetricasPresupuestoWhatsapp,
  RespuestaCopiloto,
  CentroAccionCopiloto,
  VacanteDelPortal,
  VacanteEntrante,
  ResumenPostulaciones,
  ResultadoEnvio,
  WhatsappRequest,
  WhatsappResponse,
} from './types'

export const whatsappApi = {
  /** El canal del programa del propio usuario. Lo usa el portal del estudiante. */
  mio: (token?: string) => apiFetch<CanalDeSoporteResponse>('/api/v1/whatsapp/mio', { token }),

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

  /** Métricas de presupuesto y candidatos a automatización. */
  metricas: (programaId: string, token?: string) =>
    apiFetch<MetricasPresupuestoWhatsapp>(`/api/v1/whatsapp/${programaId}/automatizaciones/metricas`, { token }),

  /** Nudge de inactividad de postulaciones (simulación o real). */
  ejecutarInactividad: (programaId: string, dias?: number, simulacion?: boolean, token?: string) =>
    apiFetch<ResumenAutomatizacionWhatsapp>(`/api/v1/whatsapp/${programaId}/automatizaciones/inactividad`, {
      method: 'POST',
      data: { dias, simulacion },
      token,
    }),

  /** Resumen semanal consolidado de empleo. */
  ejecutarResumenSemanal: (programaId: string, simulacion?: boolean, token?: string) =>
    apiFetch<ResumenAutomatizacionWhatsapp>(`/api/v1/whatsapp/${programaId}/automatizaciones/resumen-semanal`, {
      method: 'POST',
      data: { simulacion },
      token,
    }),

  /** Check-in periódico de seguimiento laboral. */
  ejecutarSeguimiento: (programaId: string, dias?: number, simulacion?: boolean, token?: string) =>
    apiFetch<ResumenAutomatizacionWhatsapp>(`/api/v1/whatsapp/${programaId}/automatizaciones/seguimiento`, {
      method: 'POST',
      data: { dias, simulacion },
      token,
    }),
}

export const pipelineApi = {
  mio: (token?: string) =>
    apiFetch<PipelineEmpleabilidadResponse>('/api/v1/pipeline/mi-pipeline', { token }),
  porEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<PipelineEmpleabilidadResponse>(`/api/v1/pipeline/estudiante/${estudianteId}`, { token }),
}

export const copilotoApi = {
  mio: (token?: string) =>
    apiFetch<RespuestaCopiloto>('/api/v1/copiloto/mio', { token }),
  porEstudiante: (estudianteId: string, token?: string) =>
    apiFetch<RespuestaCopiloto>(`/api/v1/copiloto/estudiante/${estudianteId}`, { token }),
  centroAccion: (token?: string) =>
    apiFetch<CentroAccionCopiloto>('/api/v1/copiloto/centro-accion', { token }),
}

export const postulacionesApi = {
  /** Registra una postulación por parte de la coordinación o administración. */
  crear: (body: CrearPostulacionRequest, token?: string) =>
    apiFetch<PostulacionResponse>('/api/v1/postulaciones', { method: 'POST', data: body, token }),
  /**
   * Lo del propio estudiante, recortado: sin los campos de gestión del equipo.
   * Ver `MiPostulacion`.
   */
  mias: (token?: string) =>
    apiFetch<MiPostulacion[]>('/api/v1/postulaciones/mias', { token }),
  /** Vista de gestión. Solo COORDINADOR/ADMIN; un estudiante usa `mias`. */
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
  ) => apiFetch<MiPostulacion>('/api/v1/postulaciones/mias', { method: 'POST', data: body, token }),
  actualizar: (
    id: string,
    body: {
      estado?: string
      fechaRespuesta?: string | null
      resultado?: string | null
      observaciones?: string | null
      canal?: string | null
    } & CitaRequest,
    token?: string,
  ) => apiFetch<PostulacionResponse>(`/api/v1/postulaciones/${id}`, { method: 'PATCH', data: body, token }),
  /**
   * El mismo cambio de estado, hecho por el estudiante sobre lo suyo.
   *
   * Existe aparte porque `actualizar` devuelve el registro de gestión: si el
   * portal lo usara, la respuesta del PATCH le devolvería los campos que
   * `mias` ya no manda.
   */
  actualizarPropia: (id: string, body: { estado?: string; observaciones?: string | null }, token?: string) =>
    apiFetch<MiPostulacion>(`/api/v1/postulaciones/mias/${id}`, { method: 'PATCH', data: body, token }),
  /**
   * Las citas de un tramo de fechas. Solo del equipo: es la agenda de todos.
   *
   * Las fechas van como `YYYY-MM-DD`; el backend abre el tramo a instantes por
   * su cuenta para no dejar fuera las citas de la tarde del último día.
   */
  agenda: (desde: string, hasta: string, token?: string) =>
    apiFetch<PostulacionResponse[]>(
      `/api/v1/postulaciones/agenda?desde=${desde}&hasta=${hasta}`,
      { token },
    ),
  /** Postulaciones vivas para el tablero. Las cerradas no salen. */
  tablero: (programaId?: string, token?: string) =>
    apiFetch<PostulacionResponse[]>(
      `/api/v1/postulaciones/tablero${programaId ? `?programaId=${programaId}` : ''}`,
      { token },
    ),
  /** Citas cuya hora pasó y siguen figurando como agendadas. */
  agendaSinCerrar: (token?: string) =>
    apiFetch<PostulacionResponse[]>('/api/v1/postulaciones/agenda/sin-cerrar', { token }),
  /** El controller responde con un mensaje, no con 204. */
  eliminar: (id: string, token?: string) =>
    apiFetch<{ mensaje?: string }>(`/api/v1/postulaciones/${id}`, { method: 'DELETE', token }),
  estados: (token?: string) =>
    apiFetch<Array<{ valor: string; etiqueta: string; esFinal: boolean }>>('/api/v1/postulaciones/estados', { token }),
}

/**
 * Portal de empresas.
 *
 * Ninguna llamada manda el identificador de la empresa: el backend lo saca de
 * la sesión. Enviarlo desde aquí sería ofrecer la oportunidad de cambiarlo.
 */
export const portalApi = {
  vacantes: (token?: string) =>
    apiFetch<VacanteDelPortal[]>('/api/v1/portal/vacantes', { token }),

  crearVacante: (body: VacanteEntrante, borrador = false, token?: string) =>
    apiFetch<VacanteDelPortal>(`/api/v1/portal/vacantes?borrador=${borrador}`, {
      method: 'POST', data: body, token,
    }),

  editarVacante: (id: string, body: VacanteEntrante, enviar = true, token?: string) =>
    apiFetch<VacanteDelPortal>(`/api/v1/portal/vacantes/${id}?enviar=${enviar}`, {
      method: 'PUT', data: body, token,
    }),

  enviarVacante: (id: string, token?: string) =>
    apiFetch<VacanteDelPortal>(`/api/v1/portal/vacantes/${id}/enviar`, { method: 'POST', token }),

  cerrarVacante: (id: string, motivo?: string, token?: string) =>
    apiFetch<VacanteDelPortal>(
      `/api/v1/portal/vacantes/${id}/cerrar${motivo ? `?motivo=${motivo}` : ''}`,
      { method: 'POST', token },
    ),

  postulantes: (token?: string) =>
    apiFetch<PerfilLaboral[]>('/api/v1/portal/postulantes', { token }),

  postulantesDeVacante: (vacanteId: string, token?: string) =>
    apiFetch<PerfilLaboral[]>(`/api/v1/portal/postulantes/vacante/${vacanteId}`, { token }),

  moverPostulacion: (
    postulacionId: string,
    body: { estado: MovimientoDeEmpresa; comentario?: string | null },
    token?: string,
  ) => apiFetch<PerfilLaboral>(`/api/v1/portal/postulantes/${postulacionId}`, {
    method: 'PATCH', data: body, token,
  }),

  /**
   * Agendar, mover o cancelar la entrevista.
   *
   * No lleva estado: poner fecha ya significa citar, y el backend lo deduce.
   * Tampoco el correo del contacto, que el sistema ya tiene por la cuenta.
   */
  agendarCita: (
    postulacionId: string,
    body: {
      fechaHoraEntrevista?: string | null
      modalidad?: ModalidadEntrevista | null
      lugar?: string | null
      contactoNombre?: string | null
      contactoTelefono?: string | null
      cancelar?: boolean
    },
    token?: string,
  ) => apiFetch<PerfilLaboral>(`/api/v1/portal/postulantes/${postulacionId}/cita`, {
    method: 'POST', data: body, token,
  }),
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
  /**
   * Qué canales y tipos de vinculación existen, según el backend.
   *
   * La lista la mandan los enums de Java. Tenerla escrita a mano en la
   * pantalla significaba que añadir un canal allí no lo hacía aparecer aquí:
   * el desplegable se quedaba corto y nadie se enteraba hasta echar de menos
   * el dato.
   */
  catalogos: (token?: string) =>
    apiFetch<CatalogosColocacion>('/api/v1/colocaciones/catalogos', { token }),
}

// ─── Configuración de la instalación ─────────────────────────────────────────

import type {
  ConfiguracionGlobalRequest,
  ConfiguracionGlobalResponse,
  EstadoIntegracion,
} from './types'

export const configuracionApi = {
  /**
   * Datos institucionales y parámetros de operación. Vivían en localStorage:
   * cada navegador tenía su propia versión y el umbral que se editaba no era
   * el que usaba el motor de matching.
   */
  obtener: (token?: string) =>
    apiFetch<ConfiguracionGlobalResponse>('/api/v1/configuracion', { token }),

  /** Requiere COORDINADOR o ADMIN. */
  guardar: (body: ConfiguracionGlobalRequest, token?: string) =>
    apiFetch<ConfiguracionGlobalResponse>('/api/v1/configuracion', {
      method: 'PUT',
      data: body,
      token,
    }),

  /** Estado de cada integración. Solo ADMIN. No devuelve credenciales. */
  integraciones: () =>
    apiFetch<EstadoIntegracion[]>('/api/v1/configuracion/integraciones'),
  probarIntegracion: (id: string) =>
    apiFetch<{ exito: boolean; mensaje: string }>(
      `/api/v1/configuracion/integraciones/${id}/probar`,
      { method: 'POST' },
    ),
}

/**
 * Vistas guardadas de las listas.
 *
 * Los filtros viajan como JSON en una cadena: el servidor no los entiende ni
 * falta que le haga, cada pantalla sabe qué significan los suyos.
 */
export const vistasApi = {
  listar: (modulo: ModuloDeVista, token?: string) =>
    apiFetch<VistaGuardada[]>(`/api/v1/vistas?modulo=${modulo}`, { token }),

  /** Repetir el nombre sobrescribe la propia; no crea una segunda igual. */
  guardar: (
    body: { modulo: ModuloDeVista; nombre: string; filtros: string; compartida: boolean },
    token?: string,
  ) => apiFetch<VistaGuardada>('/api/v1/vistas', { method: 'POST', data: body, token }),

  eliminar: (id: string, token?: string) =>
    apiFetch<{ mensaje?: string }>(`/api/v1/vistas/${id}`, { method: 'DELETE', token }),
}

/** La historia unificada de un estudiante. Se compone en el servidor. */
export const lineaDeTiempoApi = {
  de: (estudianteId: string, token?: string) =>
    apiFetch<HitoDeLaLinea[]>(`/api/v1/estudiantes/${estudianteId}/linea-de-tiempo`, { token }),
}
