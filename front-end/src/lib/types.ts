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

// ─── Copiloto de empleabilidad ─────────────────────────────────────────────

export type PrioridadCopiloto = 'ALTA' | 'MEDIA' | 'BAJA'
export type CategoriaCopiloto = 'SEGUIMIENTO' | 'EMPLEABILIDAD' | 'ENTREVISTA' | 'HOJA_DE_VIDA' | 'RADAR'
export type TipoAccionCopiloto = 'SEGUIMIENTO' | 'POSTULACIONES' | 'PREPARACION' | 'HOJA_DE_VIDA' | 'OPORTUNIDADES'

export interface TextoCopiloto {
  tituloEs: string
  tituloEn: string
  queDetectoEs: string
  queDetectoEn: string
  porQueImportaEs: string
  porQueImportaEn: string
}

export interface EvidenciaCopiloto {
  codigo: string
  valor: string
  etiquetaEs: string
  etiquetaEn: string
}

export interface AccionCopiloto {
  tipo: TipoAccionCopiloto
  etiquetaEs: string
  etiquetaEn: string
  ruta: string
}

export interface RecomendacionCopiloto {
  codigo: string
  prioridad: PrioridadCopiloto
  categoria: CategoriaCopiloto
  texto: TextoCopiloto
  evidencia: EvidenciaCopiloto[]
  accion: AccionCopiloto
}

export interface RespuestaCopiloto {
  estudianteId: string
  generadoEn: string
  totalSenales: number
  recomendaciones: RecomendacionCopiloto[]
}

export interface PersonaPrioritariaCopiloto {
  estudianteId: string
  nombre: string
  prioridad: PrioridadCopiloto
  motivoEs: string
  motivoEn: string
  ruta: string
  totalRecomendaciones: number
}

export interface GrupoAccionCopiloto {
  codigo: string
  prioridad: PrioridadCopiloto
  tituloEs: string
  tituloEn: string
  total: number
  estudiantes: PersonaPrioritariaCopiloto[]
}

export interface CentroAccionCopiloto {
  generadoEn: string
  estudiantesEvaluados: number
  grupos: GrupoAccionCopiloto[]
  ranking: PersonaPrioritariaCopiloto[]
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
  /**
   * Quién lleva el caso. Nulo = sin asignar, que es un estado normal y hay que
   * poder verlo para repartir el trabajo.
   *
   * No confundir con los campos de traza —quién escribió aquella nota, quién
   * movió aquella postulación—: aquellos registran el pasado y se quedan
   * quietos; esto es de quién es el caso hoy, y se puede reasignar.
   */
  responsableId: string | null
  responsableNombre: string | null
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
  segmento?: string | null
  /**
   * Campos internos de gestión: el servidor los envía nulos cuando quien
   * pregunta es un estudiante, porque en una oferta sugerida `creadaPor` es el
   * correo de otro participante.
   */
  motivoCierre?: MotivoCierre | null
  creadaPor?: string | null
  /**
   * Lo que declaró quien mandó el formulario público, sin verificar. También
   * son campos de gestión: son datos de contacto de una persona y el
   * estudiante que ve el anuncio no los recibe.
   *
   * `empresaDeclarada` no es `empresaNombre`: aquella es una afirmación sin
   * comprobar y esta, una empresa del CRM. El enlace lo hace una persona al
   * aprobar la oferta.
   */
  empresaDeclarada?: string | null
  contactoDeclarado?: string | null
  emailDeclarado?: string | null
  telefonoDeclarado?: string | null
}

export type CategoriaPlantilla = 'SISTEMA' | 'MASIVO'

export type TipoPlantillaSistema =
  | 'ACTIVACION'
  | 'RECUPERACION'
  | 'CITA_ENTREVISTA'
  | 'ASIGNACION_VACANTE'
  | 'ANUNCIO'
  | 'RECORDATORIO_HV'

/** Una plantilla de correo tal como la devuelve el backend. */
export interface PlantillaCorreo {
  id: string
  programaId: string | null
  nombre: string
  descripcion: string | null
  asunto: string
  cuerpo: string
  botonTexto: string | null
  botonUrl: string | null
  rolMinimo: string | null
  activa: boolean
  /** Las variables que usa, para avisar si pide una que no habrá. */
  variablesUsadas: string[]
  esSistema?: boolean
  tipo?: string | null
  categoria?: CategoriaPlantilla
}

/** Lo que se manda al crear o corregir una plantilla. */
export interface PlantillaCorreoRequest {
  programaId?: string | null
  nombre: string
  descripcion?: string | null
  asunto: string
  cuerpo: string
  botonTexto?: string | null
  botonUrl?: string | null
  rolMinimo?: string | null
  activa?: boolean
  categoria?: CategoriaPlantilla
  tipo?: string | null
}

export interface VariableDisponible {
  clave: string
  /** Cómo se escribe dentro del texto, p. ej. `{{nombre}}`. */
  marca: string
  descripcion: string
  ejemplo: string
  categoria?: string
}

/** Plantilla del sistema con valores predeterminados de fábrica. */
export interface PlantillaDefecto {
  tipo: string
  nombre: string
  descripcion: string
  asunto: string
  cuerpo: string
  botonTexto: string
  botonUrl: string
}

/** Solicitud para enviar un correo de prueba directo. */
export interface EnviarPruebaRequest {
  destinatario: string
  asunto: string
  cuerpo: string
  botonTexto?: string | null
  botonUrl?: string | null
  programaId?: string | null
  variablesSimuladas?: Record<string, string>
}

export interface PrevisualizacionCorreo {
  asunto: string
  html: string
  textoPlano: string
  /** Cosas que conviene saber antes de enviar. */
  avisos: string[]
}

export interface ResultadoEnvioCorreo {
  estudianteId: string
  nombre: string
  email: string | null
  enviado: boolean
  detalle: string
}

export interface ResumenEnvioCorreo {
  destinatarios: number
  enviados: number
  bloqueadosPorLista: number
  fallidos: number
  sinCorreo: number
  simulacion: boolean
  canalDeCorreo: string
  /** La lista de pruebas: si no está vacía, sólo a esas direcciones se envía. */
  destinatariosPermitidos: string[]
  detalle: ResultadoEnvioCorreo[]
}

/**
 * En qué punto de la conversación está un estudiante.
 *
 * Es lo único que el tablero mueve a mano. La etapa de empleabilidad va por
 * otro eje: la deduce el sistema de hechos que ya registran otros módulos
 * —hoja de vida vigente, simulacro hecho, postulaciones— y nadie la arrastra.
 */
export type EstadoContacto = 'SIN_CONTACTO' | 'EN_PROCESO' | 'ENTREVISTA' | 'COLOCADO' | 'CERRADO'

export type EtapaEmpleabilidad = 'SIN_PERFIL' | 'PERFIL_LISTO' | 'PREPARADO' | 'POSTULANDO' | 'COLOCADO'

/**
 * Una tarjeta del tablero.
 *
 * Lleva los dos ejes juntos a propósito: el valor está en verlos a la vez. Un
 * `PREPARADO` en `SIN_CONTACTO` es alguien listo al que nadie ha llamado.
 */
export interface TarjetaTablero {
  estudianteId: string
  nombre: string
  email: string | null
  etapa: EtapaEmpleabilidad
  porcentajeAvance: number
  estadoContacto: EstadoContacto
  postulaciones: number
  accionesSeguimiento: number
  ultimoContacto: string | null
  /** Días desde el último movimiento; null si nunca hubo contacto. */
  diasSinContacto: number | null
  proximaAccion: string | null
}

export interface ColumnaTablero {
  estado: EstadoContacto
  total: number
  necesitanAtencion: number
  tarjetas: TarjetaTablero[]
}

export interface Tablero {
  totalEstudiantes: number
  columnas: ColumnaTablero[]
}

/**
 * Una opción de catálogo tal como la manda el backend.
 *
 * `valor` es el código que viaja de vuelta y no se traduce nunca; `etiqueta`
 * es el texto en español que el servidor tiene para él, y sirve de respaldo
 * cuando aparece un código que la pantalla todavía no conoce.
 */
export interface OpcionCatalogo {
  valor: string
  etiqueta: string
}

export interface CatalogosColocacion {
  metaSalarial: number | null
  canales: (OpcionCatalogo & { gestionadaPorElPrograma: boolean })[]
  tiposVinculacion: (OpcionCatalogo & { esEmpleo: boolean })[]
}

/**
 * Por qué dejó de mostrarse una oferta. Refleja el enum del backend.
 *
 * Se guarda el motivo y no sólo que está cerrada porque la diferencia importa:
 * cubierta significa que el proceso terminó; expirada, que se dejó pasar.
 */
/**
 * `FUERA_DE_PERFIL` es propio y no `RETIRADA`: la oferta sigue abierta en su
 * portal y es buena para otra persona; lo que dice es que no pide inglés y este
 * es un programa bilingüe. Contarlas como retiradas inflaría las ofertas que
 * «se perdieron» y haría pensar que el programa llega tarde.
 */
export type MotivoCierre = 'EXPIRADA' | 'CUBIERTA' | 'RETIRADA' | 'FUERA_DE_PERFIL'

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
  /**
   * Reconstruido de un mensaje anterior a que cada envío se guardara como
   * turno. Se puede leer, pero no existe como fila: reaccionar o citarlo
   * fallaría siempre, así que la pantalla no ofrece ninguna de las dos.
   */
  historico?: boolean
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

/**
 * Una fila de la lista de conversaciones del estudiante.
 *
 * Lo justo para pintar la bandeja sin abrir nada: con quién, qué fue lo
 * último y cuánto queda por leer. El texto llega ya recortado del servidor.
 */
export interface ChatConversacionResponse {
  contactoId: string
  nombre: string
  fotoUrl: string | null
  ultimoMensaje: string
  ultimaFecha: string
  /** Si lo último lo escribió quien mira, para anteponer «Tú:». */
  mioElUltimo: boolean
  sinLeer: number
  /**
   * Si quien mira la apartó de su bandeja.
   *
   * Lo resuelve el servidor porque la regla no es «está archivada» sino «está
   * archivada y no ha pasado nada desde entonces»: si escriben después de
   * archivarla, vuelve sola a la bandeja.
   */
  archivada: boolean
}

/** Un archivo enviado por el chat. La URL la resuelve `chatsApi.urlAdjunto`. */
export interface ChatAdjuntoResponse {
  id: string
  nombre: string
  contentType: string
  tamano: number
  esAudio: boolean
  duracionSegundos: number | null
  url: string
}

export interface ChatDirectoMensajeResponse {
  id: string
  remitenteId: string
  remitenteNombre: string
  contenido: string
  createdAt: string
  enviadoPorMi: boolean
  leidoAt: string | null
  editado?: boolean
  enRespuestaA?: string | null
  reenviado?: boolean
  /** Vacía si el mensaje es solo texto. */
  adjuntos: ChatAdjuntoResponse[]
}

export interface ChatGrupoResponse {
  id: string
  nombre: string
  descripcion: string
  fotoUrl: string | null
  creadoPorId: string
  totalMiembros: number
  createdAt: string
}

export interface ChatGrupoMensajeResponse {
  id: string
  grupoId: string
  remitenteId: string
  remitenteNombre: string
  contenido: string
  createdAt: string
  enviadoPorMi: boolean
  editado?: boolean
  enRespuestaA?: string | null
  reenviado?: boolean
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

/**
 * El historial que ve el propio estudiante: el mismo sin `responsable`.
 *
 * <p>Ese campo se rellena con el correo de quien anota en los caminos
 * automáticos, y ninguna pantalla del portal lo pinta.
 */
export interface SeguimientoDelEstudianteResponse {
  id: string
  fecha: string | null
  tipo: string
  observacion: string | null
  proximaAccion: string | null
  fechaProxima: string | null
  estado: string
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
  /** El record de Java los trae siempre; se declaran opcionales porque la
   *  pantalla de extracción arma este DTO a mano y no siempre los tiene. */
  ciudad?: string | null
  fechaInicio: string
  fechaFin: string | null
  relacionada?: boolean
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
  /**
   * Los seis últimos existen en el backend desde que la línea de contacto se
   * construye en Java. Este tipo se quedó con quince campos, así que la
   * pantalla de extraer y convertir armaba el DTO sin ellos y el PDF salía sin
   * enlace de LinkedIn, sin portafolio, sin país, sin fijo, sin nivel de inglés
   * y sin la sección de logros —datos que el sistema ya tenía—.
   */
  telefono?: string | null
  nacionalidad?: string | null
  linkedinUrl?: string | null
  portafolioUrl?: string | null
  nivelIngles?: string | null
  logros?: string[] | null
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
  /**
   * Identificador del análisis que produjo esto.
   *
   * Lo devuelve la simulación y hay que mandarlo de vuelta al importar de
   * verdad: significa «ejecuta el mapeo que enseñaste». Sin él el backend
   * vuelve a analizar el archivo, y el reconocimiento por IA no da siempre lo
   * mismo, así que lo revisado podía no ser lo escrito.
   */
  planId: string | null
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
  /** Qué importador la hizo: ESTUDIANTES, CRM o LIBRO. */
  origen: 'ESTUDIANTES' | 'CRM' | 'LIBRO'
}

export interface UsuarioResponse {
  id: string
  email: string
  nombre: string
  roles: string[]
  activo: boolean
  createdAt: string
  empresaId?: string | null
  empresaNombre?: string | null
}

export interface ResultadoBusqueda {
  id: string
  titulo: string
  subtitulo: string | null
  tipo: string
}

export interface BusquedaResponse {
  estudiantes: ResultadoBusqueda[]
  empresas: ResultadoBusqueda[]
  vacantes: ResultadoBusqueda[]
  programas: ResultadoBusqueda[]
  documentos: ResultadoBusqueda[]
  colocaciones: ResultadoBusqueda[]
}

export interface CrearPostulacionRequest {
  estudianteId?: string
  vacanteId?: string | null
  empresaNombre: string
  cargo: string
  canal?: string | null
  fechaPostulacion?: string | null
  estado?: string | null
  urlOferta?: string | null
  observaciones?: string | null
  fechaHoraEntrevista?: string | null
  modalidadEntrevista?: ModalidadEntrevista | null
  lugarEntrevista?: string | null
  contactoNombre?: string | null
  contactoEmail?: string | null
  contactoTelefono?: string | null
  proximoSeguimiento?: string | null
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

/**
 * El canal visto desde el portal del estudiante.
 *
 * <p>No lleva `phoneId` ni `tokenConfigurado`: son de la pantalla de
 * configuración, y el identificador de teléfono de Meta no pinta nada en el
 * navegador de un participante.
 */
export interface CanalDeSoporteResponse {
  configurado: boolean
  activo: boolean
  numeroWhatsapp: string | null
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

export interface CandidatoAutomatizacionWhatsapp {
  estudianteId: string
  nombreCompleto: string
  celular: string
  programaNombre: string
  diasInactivo: number
  vacantesCompatibles: number
  motivo: string
}

export interface ResumenAutomatizacionWhatsapp {
  tipo: string
  totalEvaluados: number
  elegibles: number
  enviados: number
  omitidosPorCooldown: number
  fallidos: number
  simulacion: boolean
  candidatos: CandidatoAutomatizacionWhatsapp[]
}

export interface MetricasPresupuestoWhatsapp {
  totalEnviadosMes: number
  limiteSugerido: number
  porcentajeAhorroEstimado: number
  estudiantesInactivosDetectados: number
  estudiantesConVacantesPendientes: number
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

  // ── La cita ───────────────────────────────────────────────────────────────
  /** ISO local sin zona, tal y como lo guarda el backend: `2026-08-20T15:30:00`. */
  fechaHoraEntrevista: string | null
  modalidadEntrevista: ModalidadEntrevista | null
  modalidadEtiqueta: string | null
  /** Dirección si es presencial, enlace de reunión si es virtual. */
  lugarEntrevista: string | null
  contactoNombre: string | null
  contactoEmail: string | null
  contactoTelefono: string | null
  proximoSeguimiento: string | null
  entrevistaPendiente: boolean
  /** Pasó la hora y el proceso sigue en «entrevista agendada»: hay que mirarlo. */
  entrevistaVencida: boolean
  /** Horas que faltan; negativo si ya pasó, nulo si no hay cita. */
  horasParaEntrevista: number | null
}

/**
 * Una postulación vista por el estudiante que la hizo (GET /postulaciones/mias).
 *
 * Es un recorte de `PostulacionResponse`, no un alias. El endpoint devolvía el
 * registro completo del panel, así que el estudiante recibía —en la respuesta,
 * la pintara o no la pantalla— quién de la institución lleva su caso, la fecha
 * del próximo seguimiento interno y el correo del reclutador.
 *
 * Sí trae la cita entera: cuándo, dónde, en qué modalidad, con quién y a qué
 * teléfono. Es su entrevista.
 */
export interface MiPostulacion {
  id: string
  vacanteId: string | null
  empresaNombre: string
  cargo: string
  canal: string | null
  fechaPostulacion: string
  estado: string
  estadoEtiqueta: string
  estadoFinal: boolean
  fechaRespuesta: string | null
  diasEsperando: number | null
  resultado: string | null
  /** Las escribe el propio estudiante al registrar la postulación. */
  observaciones: string | null
  registradaPorEstudiante: boolean
  urlOferta: string | null
  esperandoConfirmacion: boolean

  /** ISO local sin zona, tal y como lo guarda el backend: `2026-08-20T15:30:00`. */
  fechaHoraEntrevista: string | null
  modalidadEntrevista: ModalidadEntrevista | null
  modalidadEtiqueta: string | null
  /** Dirección si es presencial, enlace de reunión si es virtual. */
  lugarEntrevista: string | null
  contactoNombre: string | null
  contactoTelefono: string | null
  entrevistaPendiente: boolean
  entrevistaVencida: boolean
  /** Horas que faltan; negativo si ya pasó, nulo si no hay cita. */
  horasParaEntrevista: number | null
}

/** Una cuenta del equipo que puede llevar casos, con cuántos lleva ya. */
export interface ResponsablePosible {
  id: string
  nombre: string
  email: string
  /** Repartir sin ver esto es como una persona acaba con ochenta y otra con seis. */
  aCargo: number
}

/**
 * Un acercamiento a una empresa (GET /empresas/{id}/contactos).
 *
 * Es un hilo de verdad: una fila por contacto, con quién lo hizo y cuándo.
 * Antes esto se concatenaba al campo `notas` de la ficha —«2026-08-16: llamé y
 * no contestan» pegado al anterior—, con lo que no se sabía quién había escrito
 * cada línea y dos personas guardando a la vez se pisaban.
 */
export interface ContactoEmpresaResponse {
  id: string
  /** ISO local sin zona. */
  fecha: string
  tipo: string
  asunto: string
  contacto: string | null
  /** Quién lo registró. Es la mitad que faltaba en el bloque de texto. */
  responsable: string | null
  notas: string | null
}

export type ModalidadEntrevista = 'PRESENCIAL' | 'VIRTUAL' | 'TELEFONICA'

// ── Portal de empresas ───────────────────────────────────────────────────────

export type EstadoVacantePortal =
  | 'BORRADOR'
  | 'EN_REVISION'
  /** Rechazada con motivo. Sigue viva y editable: corregirla y reenviarla basta. */
  | 'RECHAZADA'
  | 'PUBLICADA'
  | 'CERRADA'

export interface VacanteDelPortal {
  id: string
  titulo: string
  descripcion: string | null
  requisitos: string | null
  ciudad: string | null
  modalidadTrabajo: string | null
  tipoContrato: string | null
  jornada: string | null
  rangoSalarial: string | null
  nivelInglesRequerido: string | null
  aniosExperienciaRequeridos: number | null
  fechaPublicacion: string | null
  fechaExpiracion: string | null
  estado: EstadoVacantePortal
  /** Lo que dijo el equipo al rechazarla. Nulo si no está rechazada. */
  motivoRechazo: string | null
  postulantes: number
}

export interface VacanteEntrante {
  titulo: string
  descripcion?: string | null
  requisitos?: string | null
  ciudad?: string | null
  modalidadTrabajo?: string | null
  tipoContrato?: string | null
  jornada?: string | null
  rangoSalarial?: string | null
  nivelInglesRequerido?: string | null
  aniosExperienciaRequeridos?: number | null
  fechaExpiracion?: string | null
}

/**
 * Lo que una empresa ve de un candidato.
 *
 * Espejo de `PerfilLaboralDto` del backend, que es una lista blanca: no hay
 * documento, ni fecha de nacimiento, ni dirección, ni teléfono, ni correo, ni
 * el id del estudiante. Se identifica por la postulación, no por la persona.
 */
export interface PerfilLaboral {
  postulacionId: string
  nombreCompleto: string
  programa: string | null
  ciudad: string | null
  tituloAcademico: string | null
  perfilProfesional: string | null
  ultimoCargo: string | null
  sectorExperiencia: string | null
  aniosExperiencia: number | null
  nivelIngles: string | null
  habilidades: string[]
  disponibilidadMovilidad: boolean | null
  fechaPostulacion: string | null
  cargoAlQueSePostulo: string | null
  estadoPostulacion: string
  estadoEtiqueta: string
  fechaHoraEntrevista: string | null
  modalidadEntrevista: string | null
}

/** Los únicos estados que la empresa puede poner. CONTRATADO lo confirma el equipo. */
export type MovimientoDeEmpresa =
  | 'EN_PROCESO'
  | 'ENTREVISTA_AGENDADA'
  | 'ENTREVISTA_REALIZADA'
  | 'RECHAZADO'

/** Lo que se manda al agendar o mover una cita. */
export interface CitaRequest {
  fechaHoraEntrevista?: string | null
  modalidadEntrevista?: ModalidadEntrevista | null
  lugarEntrevista?: string | null
  contactoNombre?: string | null
  contactoEmail?: string | null
  contactoTelefono?: string | null
  proximoSeguimiento?: string | null
  /** Los campos nulos no se tocan, así que borrar la cita necesita bandera. */
  cancelarEntrevista?: boolean
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

/**
 * Una corrida de actualización de vacantes (GET /api/v1/vacantes/scraping/ejecuciones).
 *
 * `errores` vacío no quiere decir que todo fuera bien: quiere decir que nada
 * falló **ruidosamente**. Un portal cuyos selectores se caen responde 200 y
 * devuelve cero, y eso llega aquí como una corrida correcta con `vacantesNuevas`
 * en 0. Por eso el registro se lee en serie y no fila a fila.
 */
export interface EjecucionDeScraping {
  id: string
  inicio: string
  fin: string | null
  origen: 'PROGRAMADA' | 'MANUAL'
  portales: string[]
  vacantesNuevas: number
  vacantesCerradas: number
  errores: string[]
  enCurso: boolean
  duracionSegundos: number | null
  /**
   * Cuántas devolvió cada portal, antes de deduplicar.
   *
   * Vacío significa **«no se registró»** —corridas anteriores a la columna—,
   * nunca «todos trajeron cero». Sin este desglose, «0 nuevas y sin errores»
   * no distingue entre traer cuarenta ofertas ya conocidas (sano) y no traer
   * nada porque cambió el HTML (roto).
   */
  ofertasPorPortal: { portal: string; ofertas: number }[]
  /** Los que respondieron sin traer nada. Repetidos varios días = scraper muerto. */
  portalesEnCero: string[]
  /**
   * Ofertas que llegaron pero no exigían inglés, y no se guardaron.
   *
   * El programa es de empleabilidad bilingüe. Este número es lo que separa «el
   * portal está caído» de «el portal trajo cuarenta plazas monolingües»: sin
   * él, los dos casos se ven igual —una corrida de cero nuevas—.
   */
  descartadasPorIdioma: number
  /** Lo calcula el backend para no repetir la regla en cada pantalla. */
  estado: 'EN_CURSO' | 'CORRECTA' | 'PARCIAL' | 'FALLIDA'
}

export interface ResultadoImportacionLibro {
  simulacion: boolean
  hojas: HojaProcesada[]
  /** Ver `ResultadoImportacionCrm.planId`. */
  planId: string | null
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

/**
 * Un reporte del chat, tal como lo ve el equipo.
 *
 * El extracto es la copia que se guardó al reportar, no la conversación en
 * vivo: sigue estando aunque después se borren los mensajes.
 */
export interface ReporteChatResponse {
  id: string
  /** Null si se borró la ficha: el reporte sobrevive a las personas que nombra. */
  denuncianteId: string | null
  denunciante: string
  denunciadoId: string | null
  denunciado: string
  motivo: string | null
  extracto: string | null
  estado: 'ABIERTO' | 'REVISADO'
  fecha: string
}

/** Alguien dentro de un grupo del chat. */
export interface ChatGrupoMiembroResponse {
  estudianteId: string
  nombre: string
  fotoUrl: string | null
  esAdmin: boolean
  soyYo: boolean
}

// ── Vistas guardadas ─────────────────────────────────────────────────────────

export type ModuloDeVista =
  | 'ESTUDIANTES' | 'VACANTES' | 'EMPRESAS' | 'POSTULACIONES' | 'SEGUIMIENTO'

export interface VistaGuardada {
  id: string
  nombre: string
  modulo: ModuloDeVista
  /** JSON con los filtros. Las claves que la pantalla no conozca se ignoran. */
  filtros: string
  propietario: string
  compartida: boolean
  /** Si quien pregunta puede editarla o borrarla. Compartir da lectura, no escritura. */
  mia: boolean
}

// ── Línea de tiempo del estudiante ───────────────────────────────────────────

export type TipoDeHito =
  | 'POSTULACION' | 'ENTREVISTA' | 'SEGUIMIENTO' | 'DOCUMENTO' | 'COLOCACION'

export interface HitoDeLaLinea {
  referenciaId: string
  tipo: TipoDeHito
  /** Siempre con hora; una fecha sin hora se ancla al mediodía en el backend. */
  cuando: string | null
  titulo: string
  detalle: string | null
  responsable: string | null
  /** Dónde se corrige. Nula cuando el suceso no tiene pantalla propia. */
  ruta: string | null
}

// ── Conectores y Scraping ───────────────────────────────────────────────────

export interface EstadoConector {
  nombre: string
  segmento: string
  descripcion: string
  habilitado: boolean
  filtraPorCiudad: boolean
  estado: 'ACTIVO' | 'ESPERA_CONFIGURACION' | 'ERROR' | 'DESACTIVADO'
  cuotaRestante: number | null
  cuotaLimite: number | null
  ultimaEjecucion: string | null
  ultimoConteo: number | null
  ultimoError: string | null
}

export interface ResultadoPruebaFuente {
  fuente: string
  exito: boolean
  estado: 'OK' | 'SIN_RESULTADOS' | 'ERROR' | 'DESHABILITADO'
  ofertasEncontradas: number
  latenciaMs: number
  mensaje: string
  timestamp: string
}

export interface ResultadoActualizacion {
  vacantesNuevas: number
  vacantesCerradas: number
  vigentesTotal: number
  inicio: string
  fin: string | null
}

// ── Auditoría y Diagnóstico de LinkedIn (Estilo Manfred / ATS) ──────────────

export interface CriterioAuditoriaDto {
  clave: string
  titulo: string
  cumplido: boolean
  puntosObtenidos: number
  puntosMaximos: number
  detalle: string
  sugerencia: string | null
}

export interface AuditoriaLinkedinDto {
  puntuacion: number
  nivel: 'Básico' | 'Intermedio' | 'Avanzado' | 'Estelar / All-Star' | string
  optimizado: boolean
  criterios: CriterioAuditoriaDto[]
  fortalezas: string[]
  recomendaciones: string[]
  datosExtraidos: DatosHvDto
}

export interface AplicarAuditoriaLinkedinRequest {
  linkedinUrl: string
  sincronizarPerfil: boolean
  datosASincronizar?: DatosHvDto
}

export interface AdaptacionCvInglesRequest {
  cargoObjetivo?: string
  perfilProfesional?: string
  competencias?: string
  experiencias?: ExperienciaDto[]
  nivelIngles?: string
}

export interface AdaptacionCvInglesResponse {
  targetRole: string
  professionalSummary: string
  skills: string
  experiences: ExperienciaDto[]
  actionVerbsUsed: string[]
  suggestions: string
}

export interface AplicarAdaptacionInglesRequest {
  nivelIngles?: string
  targetRole?: string
  professionalSummary?: string
  skills?: string
  experiences?: ExperienciaDto[]
}

