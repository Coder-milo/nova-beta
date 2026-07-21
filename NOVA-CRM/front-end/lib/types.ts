/**
 * Tipos TypeScript que reflejan exactamente los DTOs del backend NOVA CRM.
 * Fuente de verdad: los record Java en el módulo back-end.
 * NO modificar sin antes verificar el contrato del backend.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  usuarioId: string
  email: string
  nombre: string
  roles: string[]
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

/** GET /api/v1/dashboard/summary */
export interface DashboardSummaryResponse {
  totalEstudiantes: number
  nuevosEsteMes: number
  variacionMesPct: number
  activos: number
  graduados: number
  retirados: number
  enProceso: number
  totalProyectos: number
  documentosPendientes: number
  hvsPorGenerar: number
}

/** Punto genérico para gráficos (label + value + pct opcional). */
export interface PuntoDato {
  label: string
  value: number
  pct: number | null
}

/** GET /api/v1/dashboard/charts */
export interface DashboardChartsResponse {
  distribucionEstado: PuntoDato[]    // torta: estado académico
  historicoIngresos: PuntoDato[]     // línea: ingresos por mes año actual
  estudiantesPorProyecto: PuntoDato[]// barras: activos por programa
  empleabilidad: PuntoDato[]         // dona: Empleado/Buscando/Sin info
}

/** GET /api/v1/dashboard/alerts */
export interface AlertaResponse {
  tipo: string         // DATOS_FALTANTES, PROGRAMA_POR_FINALIZAR, ...
  severidad: string    // ALTA, MEDIA, BAJA
  titulo: string
  detalle: string
  referenciaId: string | null
}

// ─── Programas ───────────────────────────────────────────────────────────────

export type ProgramaEstado = 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'ARCHIVADO'

/** GET /api/v1/programas y GET /api/v1/programas/{id} */
export interface ProgramaResponse {
  id: string
  nombre: string
  descripcion: string | null
  duracionDias: number | null
  fechaInicio: string | null   // LocalDate → "YYYY-MM-DD"
  fechaFin: string | null
  estado: ProgramaEstado
  activo: boolean
  totalEstudiantes: number
  createdAt: string
}

/** POST / PUT /api/v1/programas (requiere COORDINADOR o ADMIN) */
export interface ProgramaRequest {
  nombre: string
  descripcion?: string
  duracionDias?: number
  fechaInicio?: string
  fechaFin?: string
  estado: ProgramaEstado
}

// ─── Estudiantes ─────────────────────────────────────────────────────────────

export type EstadoAcademico = 'ACTIVO' | 'GRADUADO' | 'RETIRADO' | 'EN_PROCESO'
export type EstadoEmpleabilidad = 'EMPLEADO' | 'BUSCANDO' | 'SIN_INFO'

/** GET /api/v1/estudiantes/{id} */
export interface EstudianteResponse {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  celular: string | null
  ciudad: string | null
  barrio: string | null
  tipoDocumento: string | null
  numeroDocumento: string | null
  nivelEducativo: string | null
  titulo: string | null
  aniosExperiencia: number | null
  sectorExperiencia: string | null
  ultimoCargo: string | null
  perfilProfesional: string | null
  sectorObjetivo: string | null
  cargoObjetivo: string | null
  disponibilidadMovilidad: boolean | null
  nacionalidad: string | null
  clasificacionSisben: string | null
  situacionLaboral: string | null
  ingresoMensual: string | null
  responsableEconomico: boolean | null
  haTrabajado: boolean | null
  tieneComputador: boolean | null
  tieneInternet: boolean | null
  motivacion: string | null
  interesMigratorio: boolean | null
  resultadoPruebaEscrita: string | null
  resultadoPruebaOral: string | null
  institucionEducativa: string | null
  programaAcademico: string | null
  areaFormacion: string | null
  estadoFormacion: string | null
  disponibilidadLaboral: string | null
  estadoBusqueda: string | null
  postulacionesEnviadas: number | null
  empresasContactadas: number | null
  estadoAcademico: EstadoAcademico
  estadoEmpleabilidad: EstadoEmpleabilidad
  nivelIngles: string | null
  programaId: string
  programaNombre: string | null
  activo: boolean
  createdAt: string
}

/** POST /api/v1/estudiantes — campos mínimos requeridos: nombre, apellido, email */
export interface EstudianteRequest {
  nombre: string
  apellido: string
  email: string
  telefono?: string
  celular?: string
  ciudad?: string
  barrio?: string
  tipoDocumento?: string
  numeroDocumento?: string
  fechaNacimiento?: string
  genero?: string
  nacionalidad?: string
  nivelEducativo?: string
  titulo?: string
  aniosExperiencia?: number
  sectorExperiencia?: string
  ultimoCargo?: string
  perfilProfesional?: string
  sectorObjetivo?: string
  cargoObjetivo?: string
  disponibilidadMovilidad?: boolean
  clasificacionSisben?: string
  situacionLaboral?: string
  ingresoMensual?: string
  responsableEconomico?: boolean
  haTrabajado?: boolean
  tieneComputador?: boolean
  tieneInternet?: boolean
  motivacion?: string
  interesMigratorio?: boolean
  resultadoPruebaEscrita?: string
  resultadoPruebaOral?: string
  institucionEducativa?: string
  programaAcademico?: string
  areaFormacion?: string
  estadoFormacion?: string
  disponibilidadLaboral?: string
  estadoBusqueda?: string
  postulacionesEnviadas?: number
  empresasContactadas?: number
  estadoAcademico?: EstadoAcademico
  estadoEmpleabilidad?: EstadoEmpleabilidad
  programaId: string
}

/** Página Spring Data */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// ─── Importación Excel ───────────────────────────────────────────────────────

export interface ImportarResponse {
  importados: number
  errores: number
  totalFilas: number
  columnasDetectadas: string[]
  erroresDetalle: string[]
}


// ─── Error genérico del backend ──────────────────────────────────────────────

export interface ApiError {
  timestamp?: string
  status?: number
  error?: string
  message?: string
  path?: string
}

// ─── Vacantes, Matches y Certificaciones ─────────────────────────────────────

export interface VacanteResponse {
  id: string
  titulo: string
  descripcion: string | null
  requisitos: string | null
  ubicacion: string | null
  rangoSalarial: string | null
  tipoContrato: string | null
  modalidadTrabajo: string | null
  nivelInglesRequerido: string | null
  aniosExperienciaRequeridos: number | null
  fuente: string | null
  urlOrigen: string | null
  urlAplicar: string | null
  empresaNombre: string | null
  fechaPublicacion: string | null
  createdAt: string
}

export interface MatchResponse {
  id: string
  estudianteId: string
  vacanteId: string
  vacanteTitulo: string
  vacanteEmpresa: string
  vacanteUbicacion: string
  vacanteUrlOrigen: string | null
  puntaje: number
  notificado: boolean
  postulado: boolean
  createdAt: string
}

export interface CertificacionResponse {
  id: string
  nombre: string
  descripcion: string | null
  horasCurriculares: number | null
  habilidadesCubiertas: string | null
  textoCompartir: string | null
  programaId: string
  programaNombre: string | null
  activo: boolean
}

export interface NotificacionResponse {
  id: string
  titulo: string
  mensaje: string
  tipo: string
  referenciaId: string | null
  leida: boolean
  createdAt: string
}
