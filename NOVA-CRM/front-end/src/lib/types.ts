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
  refreshToken: string
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
  ruta: string | null
}

// ─── Programas ───────────────────────────────────────────────────────────────

export type ProgramaEstado = 'PLANEACION' | 'BORRADOR' | 'ACTIVO' | 'EN_EJECUCION' | 'PAUSADO' | 'FINALIZADO' | 'CANCELADO' | 'ARCHIVADO'

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
  direccion: string | null
  fotoUrl: string | null
  competencias: string | null
  idiomas: string | null
  referencias: string | null
  disponibilidad: string | null
  porcentajeCompletitud: number
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
  direccion?: string
  competencias?: string
  idiomas?: string
  referencias?: string
  disponibilidad?: string
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
  vacanteUrlAplicar: string | null
  vacanteRangoSalarial: string | null
  vacanteModalidadTrabajo: string | null
  vacanteRequisitos: string | null
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

// ─── Módulos del diseño (proyectos enriquecidos, HV, documentos, etc.) ────────

export interface ProgramaResumenResponse {
  totalEstudiantes: number
  activos: number
  graduados: number
  retirados: number
  enProceso: number
  conInformacionIncompleta: number
  hojasDeVidaGeneradas: number
  documentos: number
}

export interface DocumentoResponse {
  id: string
  grupoId: string
  numeroVersion: number
  estudianteId: string | null
  estudianteNombre: string | null
  programaId: string | null
  programaNombre: string | null
  tipo: string
  nombre: string
  contentType: string | null
  tamano: number
  subidoPor: string | null
  actual: boolean
  createdAt: string
}

export interface SeguimientoResponse {
  id: string
  fecha: string
  tipo: string
  responsable: string | null
  observacion: string | null
  proximaAccion: string | null
  fechaProxima: string | null
  estado: string
  createdAt: string
}

export interface SeguimientoRequest {
  fecha?: string
  tipo: string
  responsable?: string
  observacion?: string
  proximaAccion?: string
  fechaProxima?: string
  estado?: string
}

export interface FormacionResponse {
  id: string
  tipo: string
  institucion: string
  programa: string
  fechaInicio: string | null
  fechaFin: string | null
  estado: string | null
  createdAt: string
}

export interface FormacionRequest {
  tipo: string
  institucion: string
  programa: string
  fechaInicio?: string
  fechaFin?: string
  estado?: string
}

export interface ExperienciaResponse {
  id: string
  empresa: string
  cargo: string
  fechaInicio: string | null
  fechaFin: string | null
  relacionada: boolean
  funciones: string | null
  actual: boolean
  createdAt: string
}

export interface ExperienciaRequest {
  empresa: string
  cargo: string
  fechaInicio?: string
  fechaFin?: string
  relacionada?: boolean
  funciones?: string
  actual?: boolean
}

export interface ActividadResponse {
  id: string
  programaId: string | null
  programaNombre: string | null
  nombre: string
  fecha: string
  hora: string | null
  descripcion: string | null
  categoria: string
  responsable: string | null
  estado: string
}

export interface ActividadRequest {
  nombre: string
  fecha: string
  hora?: string
  descripcion?: string
  categoria?: string
  responsable?: string
  estado?: string
  programaId?: string
}

export interface AuditoriaResponse {
  id: string
  fecha: string
  usuario: string
  modulo: string
  accion: string
  entidad: string
  registroId: string | null
  registroNombre: string | null
  datosAnteriores: string | null
  datosNuevos: string | null
  ip: string | null
}

export interface PlantillaResponse {
  id: string
  nombre: string
  colorPrimario: string
  predeterminada: boolean
  tieneArchivo: boolean
  tieneHtml: boolean
  tipoArchivo: string | null
  camposDetectados: number
  automatica: boolean
  createdAt: string
}

export interface CampoCompletitud {
  placeholder: string
  label: string
  completo: boolean
  valorActual: string
  fuente: string
}

export interface SeccionCompletitud {
  id: string
  titulo: string
  porcentaje: number
  camposCompletos: number
  camposTotales: number
  campos: CampoCompletitud[]
}

export interface AnalisisCompletitudResponse {
  templateName: string
  porcentajeTotal: number
  secciones: SeccionCompletitud[]
  recomendaciones: string[]
  datosEstudiante: Record<string, unknown>
}

export interface HojaDeVidaResponse {
  id: string
  estudianteId: string
  estudianteNombre: string
  plantillaId: string | null
  plantillaNombre: string | null
  numeroVersion: number
  actual: boolean
  generadaPor: string | null
  createdAt: string
}

export interface GenerarHvOpcionesRequest {
  plantillaId?: string
  idioma?: 'es' | 'en'
  seccionesExcluidas?: string[]
  camposExcluidos?: string[]
}

export interface GeneracionMasivaResponse {
  solicitadas: number
  generadas: number
  fallidas: number
  resultados: { estudianteId: string; nombre: string; generada: boolean; error: string | null }[]
}

export interface ExperienciaDto {
  cargo: string
  empresa: string
  fechaInicio: string
  fechaFin: string | null
  actual: boolean
  funciones: string
}

export interface FormacionDto {
  tipo: string
  programa: string
  institucion: string
  fechaFin: string
}

export interface DatosHvDto {
  nombre: string | null
  apellido: string | null
  cargoObjetivo: string | null
  email: string | null
  celular: string | null
  ciudad: string | null
  linkedinUserId: string | null
  perfilProfesional: string | null
  competencias: string | null
  idiomas: string | null
  titulo: string | null
  institucionEducativa: string | null
  nivelEducativo: string | null
  experiencias: ExperienciaDto[]
  formaciones: FormacionDto[]
}

export interface CampoExtraido {
  campo: string
  valor: string
  confianza: number
}

export interface ExtraccionResponse {
  campos: CampoExtraido[]
  textoDetectado: string
  datosEstructurados?: DatosHvDto
}


export interface ImportPreviewResponse {
  totalFilas: number
  validos: number
  nuevos: number
  actualizados: number
  conErrores: number
  errores: string[]
  advertencias: string[]
}

export interface ImportacionHistorialResponse {
  id: string
  archivo: string
  usuario: string
  creados: number
  actualizados: number
  errores: number
  createdAt: string
}

export interface UsuarioResponse {
  id: string
  email: string
  nombre: string
  roles: string[]
  activo: boolean
  createdAt: string
}

export interface ResultadoBusqueda {
  id: string
  titulo: string
  subtitulo: string | null
  tipo: string
}

export interface BusquedaResponse {
  estudiantes: ResultadoBusqueda[]
  programas: ResultadoBusqueda[]
  documentos: ResultadoBusqueda[]
}
