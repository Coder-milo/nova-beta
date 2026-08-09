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
export type EstadoHito = 'NO' | 'EN_PROCESO' | 'SI'

/** GET /api/v1/estudiantes/{id} */
export interface EstudianteResponse {
  id: string
  nombre: string
  apellido: string
  email: string
  fechaNacimiento: string | null
  genero: string | null
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
  hitoCvListo: EstadoHito
  hitoCvIngles: EstadoHito
  hitoLinkedinCreado: EstadoHito
  hitoLinkedinOptimizado: EstadoHito
  hitoPerfilOcupacional: EstadoHito
  hitosCumplidos: number
  pendientesPreparacion: string[]
  porcentajeEmpleabilidad: number
  colocado: boolean
  carpetaUrl: string | null
  linkedinUrl: string | null
  plantillaPreferidaId: string | null
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
  linkedinUrl?: string
  carpetaUrl?: string
  edadAlRegistrar?: number
  hitoCvListo?: EstadoHito | null
  hitoCvIngles?: EstadoHito | null
  hitoLinkedinCreado?: EstadoHito | null
  hitoLinkedinOptimizado?: EstadoHito | null
  hitoPerfilOcupacional?: EstadoHito | null
}

/** Campos que el equipo actualiza durante el acompañamiento de empleabilidad. */
export interface PreparacionEstudianteRequest {
  cvListo?: EstadoHito | null
  cvEnIngles?: EstadoHito | null
  linkedinCreado?: EstadoHito | null
  linkedinOptimizado?: EstadoHito | null
  perfilOcupacional?: EstadoHito | null
  carpetaUrl?: string | null
  linkedinUrl?: string | null
  sectorObjetivo?: string | null
  cargoObjetivo?: string | null
  perfilProfesional?: string | null
  competencias?: string | null
}

/** Página Spring Data */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface EmpresaResponse {
  id: string
  nombre: string
  sector: string | null
  ciudad: string | null
  sitioWeb: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  contactoNombre: string | null
  contactoEmail: string | null
  contactoCanal: string | null
  fechaPrimerContacto: string | null
  estadoRelacion: EstadoRelacionEmpresa
  estadoRelacionEtiqueta: string
  proximoPaso: string | null
  notas: string | null
  cargosTipicos: string | null
  canalPostulacion: string | null
  participantesEnviados: number
  respuestasRecibidas: number
  contratados: number
  vacantesAbiertas: number
  diasDesdePrimerContacto: number | null
  activo: boolean
}
export type EstadoRelacionEmpresa =
  | 'SIN_CONTACTAR'
  | 'CONTACTADA'
  | 'PERFIL_ENVIADO'
  | 'EN_CONVERSACION'
  | 'ALIADA'
  | 'DESCARTADA'
export interface EmpresaRequest {
  nombre: string
  sector?: string | null
  ciudad?: string | null
  sitioWeb?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  contactoNombre?: string | null
  contactoEmail?: string | null
  contactoCanal?: string | null
  fechaPrimerContacto?: string | null
  estadoRelacion?: EstadoRelacionEmpresa | null
  proximoPaso?: string | null
  notas?: string | null
  cargosTipicos?: string | null
  canalPostulacion?: string | null
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
  ciudad?: string | null
  jornada?: string | null
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
  /** Si sigue abierta. Una oferta cerrada se conserva pero no se recomienda. */
  activa?: boolean
  fechaExpiracion?: string | null
  /**
   * Falso en las que registró un estudiante y nadie ha validado. Hasta que se
   * validen, el matching las excluye: es la barrera que impide que una estafa
   * de empleo llegue a toda la cohorte.
   */
  revisada?: boolean
  /**
   * Campos internos de gestión: el servidor los envía nulos cuando quien
   * pregunta es un estudiante, porque en una oferta sugerida `creadaPor` es el
   * correo de otro participante.
   */
  motivoCierre?: string | null
  creadaPor?: string | null
}

/** Datos que el equipo registra cuando crea una vacante sin importar un enlace. */
export interface VacanteRequest {
  url?: string
  titulo: string
  descripcion?: string
  requisitos?: string
  ubicacion?: string
  ciudad?: string
  rangoSalarial?: string
  tipoContrato?: string
  jornada?: string
  modalidadTrabajo?: string
  nivelInglesRequerido?: string
  aniosExperienciaRequeridos?: number
  empresaNombre?: string
  urlAplicar?: string
  fechaExpiracion?: string
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
  vacanteDescripcion: string | null
  vacanteCiudad: string | null
  vacanteTipoContrato: string | null
  vacanteJornada: string | null
  vacanteNivelInglesRequerido: string | null
  vacanteAniosExperienciaRequeridos: number | null
  vacanteFechaExpiracion: string | null
  vacanteFuente: string | null
  puntaje: number
  notificado: boolean
  postulado: boolean
  createdAt: string
  /**
   * Por qué se recomendó, criterio por criterio (ratio de 0 a 1). Solo trae los
   * criterios que se pudieron evaluar; vacío en los matches anteriores a que se
   * guardara el desglose.
   */
  razones: RazonDeMatch[]
  /** Fracción del peso que tenía datos reales al puntuar, de 0 a 1. */
  cobertura: number | null
}

export interface RazonDeMatch {
  criterio: string
  ratio: number
  peso: number
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
  mediaUrl: string | null
  /** `FILE` son los documentos adjuntos del anuncio (PDF, Word, Excel). */
  mediaTipo: 'IMAGE' | 'VIDEO' | 'LINK' | 'FILE' | null
  leida: boolean
  createdAt: string
}

export interface MensajeResponse {
  id: string
  estudianteId: string
  estudianteNombre: string
  estudianteEmail: string
  asunto: string
  contenido: string
  estado: 'ABIERTO' | 'RESPONDIDO'
  createdAt: string
  respuesta: string | null
  respondidoPor: string | null
  respondidoAt: string | null
  adjuntos: MensajeAdjuntoResponse[]
  respuestaAdjuntos: MensajeAdjuntoResponse[]
}

/**
 * Una intervención dentro de una conversación.
 *
 * Sustituye al par `contenido`/`respuesta` de `MensajeResponse`, que sólo
 * admitía un intercambio por hilo. Aquél sigue existiendo mientras la bandeja
 * antigua se apoye en él.
 */
export interface MensajeTurnoResponse {
  id: string
  autorNombre: string
  autorEsEstudiante: boolean
  contenido: string
  createdAt: string
  /** Turno citado, si esta intervención responde a uno concreto. */
  enRespuestaA: string | null
  /** Primeras palabras del citado, para dibujar la cita sin buscarlo. */
  enRespuestaAExtracto: string | null
  adjuntos: MensajeAdjuntoResponse[]
  reacciones: ReaccionResumen[]
}

/**
 * Cuántos pusieron cada emoji y si uno fue quien mira.
 *
 * No llega la lista de quiénes reaccionaron: para el contador y el estado del
 * botón basta con esto, y enviar los correos convertiría el hilo en un
 * directorio de la cohorte.
 */
export interface ReaccionResumen {
  emoji: string
  total: number
  mia: boolean
}

export interface MensajeAdjuntoResponse {
  id: string
  nombre: string
  contentType: string
  tamano: number
  /** Ruta autenticada para abrir o descargar el adjunto. */
  url: string
}

export interface ChatContactoResponse {
  id: string
  nombre: string
  fotoUrl: string | null
}

export interface ChatDirectoMensajeResponse {
  id: string
  remitenteId: string
  remitenteNombre: string
  contenido: string
  createdAt: string
  enviadoPorMi: boolean
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
  ciudad?: string | null
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
  ciudad?: string
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
  codigo?: string | null
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

/**
 * Espejo exacto de `ResultadoImportacionCrm` (record Java).
 *
 * Los nombres de antes —`totalFilas`, `validos`, `nuevos`, `conErrores`,
 * `columnaOrigen`, `campoDestino`, `error`— no existen en el backend: la
 * pantalla de importación mostraba `undefined` en todos los contadores y una
 * lista de columnas en blanco.
 */
export interface ResultadoImportacionCrm {
  simulacion: boolean
  filasLeidas: number
  creados: number
  actualizados: number
  /** Filas que ya estaban registradas y se dejaron como estaban. */
  omitidos: number
  errores: { fila: number; motivo: string }[]
  /** `campo` en null son columnas que se ignoran; verlas explica por qué falta un dato. */
  columnasReconocidas: { cabecera: string; campo: string | null }[]
}

export type CrearVacante = VacanteRequest

export type PreparacionRequest = PreparacionEstudianteRequest

export const HITOS = ['hojaDeVida', 'linkedin', 'simulacro'] as const
export const APORTE_EN_PROCESO = 33.3

export interface CrearPostulacion {
  vacanteId?: string
  empresaNombre: string
  cargo: string
  canal?: string
  fechaPostulacion?: string
  estado?: string
  urlOferta?: string
  observaciones?: string
}

export type EstadoPostulacion =
  | 'ENVIADA'
  | 'POSTULADO'
  | 'EN_PROCESO'
  | 'ENTREVISTA'
  | 'ENTREVISTA_AGENDADA'
  | 'ENTREVISTA_REALIZADA'
  | 'OFERTA'
  | 'RECHAZADO'
  | 'CONTRATADO'
  | 'SIN_RESPUESTA'

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

// ─── Comunicaciones ──────────────────────────────────────────────────────────

/** Qué pasó con la cuenta de acceso de un estudiante. */
export interface FilaPadron {
  estudianteId: string
  nombre: string
  /** null si la ficha no tiene correo: no hay a dónde escribirle. */
  email: string | null
  tieneCuenta: boolean
  /** false si hay lista de direcciones de prueba y esta no está en ella. */
  sePuedeEscribir: boolean
}

/** Quién tiene cuenta y quién no. Solo lectura, alimenta el selector. */
export interface Padron {
  total: number
  conCuenta: number
  sinCuenta: number
  sinCorreo: number
  /** Vacía = se escribe a todos. Con valores = solo a esas direcciones. */
  destinatariosPermitidos: string[]
  canalDeCorreo: string
  estudiantes: FilaPadron[]
}

/** Qué pasó con la cuenta. No dice nada del correo: son cosas distintas. */
export type EstadoCuenta = 'CREADA' | 'YA_TENIA' | 'SIN_CORREO'

/** Qué pasó con el correo, que es una pregunta aparte del alta. */
export type EnvioCorreo =
  | 'ENVIADO'
  | 'NO_SOLICITADO'
  | 'BLOQUEADO_POR_LISTA'
  | 'FALLIDO'
  | 'SIN_DIRECCION'

export interface ResultadoCuenta {
  estudianteId: string
  nombre: string
  email: string | null
  estado: EstadoCuenta
  envio: EnvioCorreo
  correoEnviado: boolean
  detalle: string
}

export interface ResumenAltaCuentas {
  creadas: number
  yaTenian: number
  sinCorreo: number
  correosEnviados: number
  correosFallidos: number
  simulacion: boolean
  /** Canal por el que se envió: SMTP, SES o "ninguno". */
  canalDeCorreo: string
  detalle: ResultadoCuenta[]
}

// ─── Identidad visual por proyecto ───────────────────────────────────────────

/** Medida exacta que se exige al subir una imagen, con el motivo. */
export interface MedidaExigida {
  clave: string
  etiqueta: string
  /** Ancho exacto del archivo, en px. */
  ancho: number
  /** Alto exacto del archivo, en px. */
  alto: number
  /** A qué ancho se muestra: la mitad, por las pantallas retina. */
  anchoVista: number
  /** Qué pasa si no se respeta. Se muestra al administrador. */
  porque: string
}

export interface BrandingRequest {
  colorPrimario?: string | null
  tituloHeader?: string | null
  subtituloHeader?: string | null
  bannerPanelUrl?: string | null
  bannerPanelAncho?: number | null
  bannerPanelAlto?: number | null
  correoHeaderUrl?: string | null
  correoHeaderAncho?: number | null
  correoHeaderAlto?: number | null
  correoPieUrl?: string | null
  correoPieAncho?: number | null
  correoPieAlto?: number | null
  correoTextoPie?: string | null
}

export interface BrandingResponse {
  programaId: string
  programaNombre: string
  /** false = el proyecto usa la gama global del panel. */
  personalizado: boolean
  colorPrimario: string | null
  tituloHeader: string | null
  subtituloHeader: string | null
  bannerPanelUrl: string | null
  bannerPanelAncho: number | null
  bannerPanelAlto: number | null
  correoHeaderUrl: string | null
  correoHeaderAncho: number | null
  correoHeaderAlto: number | null
  correoPieUrl: string | null
  correoPieAncho: number | null
  correoPieAlto: number | null
  correoTextoPie: string | null
  medidasExigidas: MedidaExigida[]
}

// ─── Canal de WhatsApp por proyecto ──────────────────────────────────────────

/**
 * Configuración de la instalación. Una sola para todo el CRM: el NIT de la
 * institución es uno, no uno por navegador.
 */
export interface ConfiguracionGlobalRequest {
  nombreOficial?: string | null
  nit?: string | null
  registroEducativo?: string | null
  sedePrincipal?: string | null
  telefonoContacto?: string | null
  whatsappSoporte?: string | null
  emailContacto?: string | null
  emailSoporte?: string | null
  sitioWeb?: string | null
  linkedinUrl?: string | null
  instagramUrl?: string | null
  cohorteActiva?: string | null
  /** Puntaje mínimo para que un par estudiante–vacante llegue a ser match. */
  umbralMatchMinimo?: number | null
  diasRetencionPapelera?: number | null
}

export interface ConfiguracionGlobalResponse {
  nombreOficial: string | null
  nit: string | null
  registroEducativo: string | null
  sedePrincipal: string | null
  telefonoContacto: string | null
  whatsappSoporte: string | null
  emailContacto: string | null
  emailSoporte: string | null
  sitioWeb: string | null
  linkedinUrl: string | null
  instagramUrl: string | null
  cohorteActiva: string | null
  umbralMatchMinimo: number
  diasRetencionPapelera: number
  /** false = nadie ha guardado nada todavía; lo que llega es lo de fábrica. */
  guardado: boolean
  actualizadoEn: string | null
  /** El de matching-config.yml, para poder decir de dónde sale el número. */
  umbralPorDefecto: number
  diasRetencionPorDefecto: number
}

export interface WhatsappRequest {
  numeroWhatsapp?: string | null
  phoneId?: string | null
  /** Solo viaja de ida: null = conservar el token guardado. */
  token?: string | null
  activo?: boolean | null
}

export interface WhatsappResponse {
  programaId: string
  programaNombre: string
  /** false = el proyecto no tiene canal de WhatsApp. */
  configurado: boolean
  tokenConfigurado: boolean
  numeroWhatsapp: string | null
  phoneId: string | null
  activo: boolean
}

export interface MensajeWhatsappResponse {
  id: string
  tipo: string
  remitente: string
  texto: string
  /** Nombre del estudiante del remitente, o cadena vacía si no se identificó. */
  estudiante: string
  fecha: string
}

export interface ResultadoEnvio {
  enviado: boolean
  motivoFallo: string
}

export interface PipelineEmpleabilidadResponse {
  estudianteId: string
  nombreCompleto: string
  hvGenerada: boolean
  linkedinOptimizado: boolean
  simulacroRealizado: boolean
  postulacionesEnviadas: number
  empresasContactadas: number
  etapa: string
  porcentajeAvance: number
  pendientes: string[]
  proximaAccion: string | null
}

export interface PostulacionResponse {
  id: string
  estudianteId: string
  estudianteNombre: string
  vacanteId: string | null
  empresaNombre: string
  cargo: string
  canal: string | null
  fechaPostulacion: string
  estado: string
  estadoEtiqueta: string
  estadoFinal: boolean
  fechaRespuesta: string | null
  diasHastaRespuesta: number | null
  diasEsperando: number | null
  resultado: string | null
  observaciones: string | null
  gestionadaPor: string | null
  registradaPorEstudiante: boolean
  urlOferta: string | null
  esperandoConfirmacion: boolean
}

export interface ResumenPostulaciones {
  total: number
  activas: number
  conRespuesta: number
  entrevistas: number
  contratados: number
  sinRespuesta: number
}

/** Colocación laboral verificada por el equipo de empleabilidad. */
export interface ColocacionResponse {
  id: string
  estudianteId: string
  estudianteNombre: string
  sectorObjetivo: string | null
  nivelIngles: string | null
  porcentajeEmpleabilidad: number
  empresaNombre: string
  cargo: string | null
  tipoVinculacion: string
  tipoVinculacionEtiqueta: string
  fechaInicio: string | null
  canalConsecucion: string | null
  canalConsecucionEtiqueta: string | null
  gestionadaPorElPrograma: boolean
  salario: number | null
  diferenciaVsMeta: number | null
  superaMeta: boolean
  bonificaciones: string | null
  modalidad: string | null
  tipoContrato: string | null
  chkContrato: boolean | null
  chkVerificacionVacante: boolean | null
  chkBenchmark: boolean | null
  chkReglamentoInterno: boolean | null
  chkColillaPago: boolean | null
  checklistVerificados: number
  checklistTotal: number
  checklistResumen: string
  checklistIncumplidos: string[]
  observaciones: string | null
  activa: boolean
}

export interface ColocacionRequest {
  estudianteId: string
  postulacionId?: string | null
  empresaNombre: string
  cargo?: string | null
  tipoVinculacion?: string | null
  fechaInicio?: string | null
  canalConsecucion?: string | null
  salario?: number | null
  bonificaciones?: string | null
  modalidad?: string | null
  tipoContrato?: string | null
  chkContrato?: boolean | null
  chkVerificacionVacante?: boolean | null
  chkBenchmark?: boolean | null
  chkReglamentoInterno?: boolean | null
  chkColillaPago?: boolean | null
  observaciones?: string | null
}

export interface ResumenColocaciones {
  total: number
  sobreMeta: number
  bajoMeta: number
  gestionadasPorElPrograma: number
  autogestionadas: number
  metaSalarial: number
  salarioPromedio: number | null
  checklistCompletos: number
  porCanal: Array<{ canal: string; etiqueta: string; total: number }>
}

/** Una pestaña del libro, después de intentar importarla. */
export interface HojaProcesada {
  nombre: string
  /** A qué se importó, o null si se omitió. */
  destino: string | null
  /** Por qué se omitió; null si se importó. */
  motivo: string | null
  detalle: ResultadoImportacionCrm | null
  /** Cabeceras que reconoció la IA, no el diccionario de sinónimos. */
  columnasPorIa: string[]
  /** Si el destino de la hoja lo decidió la IA. */
  destinoPorIa: boolean
}

export interface ResultadoImportacionLibro {
  simulacion: boolean
  hojas: HojaProcesada[]
}

/**
 * Estado de una integración externa (GET /api/v1/configuracion/integraciones).
 *
 * Nunca trae credenciales, ni enmascaradas: solo si están puestas y en qué
 * variable de entorno se ponen.
 */
export interface EstadoIntegracion {
  id: string
  nombre: string
  categoria: string
  configurada: boolean
  resumen: string
  detalles: { etiqueta: string; valor: string }[]
  variablesEntorno: string[]
  /** Si admite una prueba de conexión en vivo. */
  probable: boolean
  advertencia: string | null
}

export interface PlataformaResponse {
  id: string
  codigo: string
  nombre: string
  url: string
  iconoUrl: string | null
  activo: boolean
}

export interface PlataformaRequest {
  codigo: string
  nombre: string
  url: string
  iconoUrl?: string | null
}

export interface PlataformaAsignacionRequest {
  plataformaIds: string[]
}
