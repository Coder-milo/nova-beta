'use client'

import { ArrowLeft, Briefcase, Camera, Check, CheckCircle2 as CheckCircle, CircleAlert as WarningCircle, ClipboardList as ClipboardText, Download as DownloadSimple, Eye, FileText, FileUser as ReadCvLogo, FolderOpen, GraduationCap, History as ClockCounterClockwise, LayoutGrid as SquaresFour, Link as LinkSimple, LoaderCircle as CircleNotch, Pencil as PencilSimple, Plus, RefreshCw as ArrowsClockwise, Star, Trash2 as Trash, Upload as UploadSimple, User } from 'lucide-react'
/**
 * Perfil completo del estudiante (expediente institucional).
 *
 * Consume:
 *   GET  /api/v1/estudiantes/{id}                       → datos del estudiante
 *   POST /api/v1/estudiantes/{id}/foto                  → subir foto
 *   GET  /api/v1/estudiantes/{id}/formaciones (+CRUD)   → formación adicional
 *   GET  /api/v1/estudiantes/{id}/experiencias (+CRUD)  → experiencia laboral
 *   GET  /api/v1/hojas-de-vida/estudiante/{id}          → versiones de HV
 *   POST /api/v1/hojas-de-vida/generar/{id}             → generar nueva HV
 *   GET  /api/v1/documentos?estudianteId=  (+upload)    → documentos
 *   GET  /api/v1/estudiantes/{id}/seguimientos (+CRUD)  → seguimientos
 *   GET  /api/v1/auditoria?registroId=                  → historial de cambios
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from '@/compat/next-navigation'
import Link from '@/compat/next-link'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LineaDeTiempo } from '@/components/admin/linea-de-tiempo'
import { EstadoDot } from '@/components/ui/estado-dot'
import { FilePreview, FilePreviewSheet } from '@/components/ui/file-preview'
import { useConfirmar } from '@/components/ui/confirmar'
import {
  estudiantesApi, perfilApi, seguimientosApi, hvApi, documentosApi,
  auditoriaApi, pipelineApi, postulacionesApi, colocacionesApi, plataformasApi, ApiCallError,
} from '@/lib/api'
import type {
  EstudianteResponse, FormacionResponse, FormacionRequest,
  ExperienciaResponse, ExperienciaRequest, SeguimientoResponse,
  SeguimientoRequest, HojaDeVidaResponse, DocumentoResponse,
  AuditoriaResponse, PipelineEmpleabilidadResponse, PostulacionResponse, ColocacionResponse,
  PreparacionEstudianteRequest, EstadoHito, EstudianteRequest, PlataformaResponse,
} from '@/lib/types'
import { ModalPostularEstudiante } from '@/components/admin/modal-postular-estudiante'
import { PipelinePostulacionesSalesforce } from '@/components/admin/pipeline-postulaciones-salesforce'
import { Textarea } from '@/components/ui/textarea'
import { errorDe } from '@/lib/errores'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const estadoFallback = { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }

/** El color no depende del idioma; la etiqueta si, y se resuelve aparte. */
const estiloAcademico: Record<string, { dot: string; text: string }> = {
  ACTIVO:     { dot: 'bg-navy-500', text: 'text-navy-600' },
  GRADUADO:   { dot: 'bg-navy-800', text: 'text-navy-800' },
  RETIRADO:   { dot: 'bg-red-600',  text: 'text-red-700' },
  EN_PROCESO: { dot: 'bg-navy-300', text: 'text-navy-500' },
}

const estiloEmpleabilidad: Record<string, { dot: string; text: string }> = {
  EMPLEADO: { dot: 'bg-success',             text: 'text-[#0F6E56]' },
  BUSCANDO: { dot: 'bg-navy-400',            text: 'text-navy-600' },
  SIN_INFO: { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
}

function estadoAcademico(C: TextosAdmin, codigo: string) {
  const etiquetas: Record<string, string> = {
    ACTIVO: C.activo, GRADUADO: C.graduado, RETIRADO: C.retirado, EN_PROCESO: C.enProceso,
  }
  return { label: etiquetas[codigo] ?? codigo, ...(estiloAcademico[codigo] ?? estadoFallback) }
}

function estadoEmpleabilidad(T: ReturnType<typeof textos>, C: TextosAdmin, codigo: string) {
  const etiquetas: Record<string, string> = {
    EMPLEADO: C.empleado, BUSCANDO: T.buscandoEmpleo, SIN_INFO: C.sinInfo,
  }
  return { label: etiquetas[codigo] ?? codigo, ...(estiloEmpleabilidad[codigo] ?? estadoFallback) }
}

const tiposFormacion = ['TECNICA', 'TECNOLOGICA', 'UNIVERSITARIA', 'ESPECIALIZACION', 'CURSO', 'DIPLOMADO', 'IDIOMA'] as const
const tiposSeguimiento = ['LLAMADA', 'REUNION', 'CORREO', 'SIMULACRO_ENTREVISTA', 'CONTACTO_EMPRESA', 'OTRO'] as const

/** `en-GB` y no `en-US`: el dia primero, como en el resto del sistema. */
function fechaCorta(iso: string | null | undefined, english = false): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString(english ? 'en-GB' : 'es-CO') } catch { return iso }
}

/** El peso colombiano se escribe igual en los dos idiomas; el respaldo no. */
function moneda(valor: number | null | undefined, sinRegistrar: string, english = false): string {
  return valor == null ? sinRegistrar : new Intl.NumberFormat(english ? 'en-GB' : 'es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(valor)
}

function estadoHito(valor: string | null | undefined, C: TextosAdmin) {
  if (valor === 'SI') return { texto: C.completado, clase: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' }
  if (valor === 'EN_PROCESO') return { texto: C.enProceso, clase: 'border-amber-500/25 bg-amber-500/10 text-amber-700' }
  return { texto: C.pendiente, clase: 'border-border bg-muted/50 text-muted-foreground' }
}

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        buscandoEmpleo: 'Job hunting',
        plataformasExternasA: 'External platforms this student has access to. Only those active on their programme are visible on the portal.',
        registroYEstado: 'A record and current status of each selection process. Changes made by the student are reflected here.',
        contactosCompromisosY: 'Contacts, commitments and next employability steps that do not come from an application.',
        avanceCalculadoA: 'Progress calculated from the résumé, readiness and applications of the student.',
        noHayPlataformas: 'No platforms in the catalogue yet. Create one from Settings → Platforms.',
        resultadosVerificadosPor: 'Results verified by the team: company, conditions and onboarding checklist.',
        informacionConsolidadaPara: 'Consolidated information to guide support and find the right opportunities.',
        actualizaLosDatos: 'Update personal, academic and employability data from a single form.',
        hitosPerfilOcupacional: 'Milestones, occupational profile, suggested roles and links managed by the team.',
        actualizaElDetalle: 'Update the detail, the person in charge or the next step of the support.',
        formacionAdicionalDel: 'Further education of the student (courses, diplomas, qualifications).',
        noFuePosible: 'The employability process could not be calculated yet.',
        accesosImportadosDel: 'Access details imported from the operational file of the participant.',
        seEliminaraEsta: 'This education record will be deleted. This cannot be undone.',
        seEliminaraEstaX: 'This experience will be deleted. This cannot be undone.',
        seEliminaraEste: 'This document will be deleted. This cannot be undone.',
        seEliminaraEsteX: 'This follow-up will be deleted. This cannot be undone.',
        certificadosActasY: 'Certificates, records and supporting files of the student.',
        elEstudianteAun: 'The student has not applied to any vacancy yet.',
        noHayUna: 'There is no verified job placement yet.',
        preparacionParaLa: 'Employability readiness updated.',
        herramientasIdiomasY: 'Validated tools, languages and skills',
        enlaceDeDrive: 'Drive link or institutional repository',
        principalesFuncionesDesempenadas: 'Main duties performed…',
        institucionYPrograma: 'The institution and the programme are required.',
        informacionDelEstudiante: 'Student information updated.',
        elTipoDe: 'The follow-up type is required.',
        unCargoPor: 'One role per line, or separated by commas',
        aunNoSe: 'No résumé has been generated yet.',
        sinRegistrosDe: 'No audit records for this student.',
        registrarAccionDe: 'Log a support action',
        cargandoProcesoDe: 'Loading the employability process…',
        empresaYCargo: 'The company and the role are required.',
        noSePudo: 'The information could not be updated',
        noSePudoX: 'The follow-up could not be updated',
        noSePudoXX: 'The readiness could not be updated',
        elEstudianteNo: 'The student does not exist, or was deleted.',
        competenciasTecnicasY: 'Technical skills and strengths',
        historialLaboralDel: 'Work history of the student.',
        lineaDeTiempo: 'History',
        todoLoQuePaso: 'Applications, interviews, documents and follow-up notes, in order.',
        sinExperienciaLaboral: 'No work experience recorded.',
        versionesGeneradasDe: 'Generated versions of the résumé.',
        datosDeContacto: 'Contact details and location of the student.',
        formacionBaseY: 'Base education and language level.',
        cargandoPerfilDel: 'Loading the student profile…',
        editarInformacionDel: 'Edit the student information',
        noSeEncontro: 'The student was not found.',
        sinSeguimientosRegistrados: 'No follow-ups recorded.',
        sinFormacionesRegistradas: 'No education records.',
        sinCargosSugeridos: 'No suggested roles yet.',
        cargandoHojasDe: 'Loading résumés…',
        errorAlMarcar: 'The current version could not be set',
        errorAlEliminar: 'The résumé could not be deleted',
        errorAlGenerar: 'The résumé could not be generated',
        errorAlEliminarX: 'The follow-up could not be deleted',
        errorAlActualizar: 'The follow-up could not be updated',
        errorAlEliminarXX: 'The experience could not be deleted',
        errorAlEliminarXXX: 'The education record could not be deleted',
        errorAlCrear: 'The follow-up could not be created',
        errorAlCrearX: 'The experience could not be created',
        errorAlEliminarXXXX: 'The document could not be deleted',
        errorAlCargar: 'The student could not be loaded',
        errorAlCrearXX: 'The education record could not be created',
        errorAlSubir: 'The document could not be uploaded',
        errorAlDescargar: 'The PDF could not be downloaded',
        errorAlSubirX: 'The photo could not be uploaded',
        errorAlDescargarX: 'The download failed',
        seleccionaUnArchivo: 'Choose a file first.',
        preparacionParaLaX: 'Employability readiness',
        procesoDeEmpleabilidad: 'Employability process',
        formacionYExperiencia: 'Education and experience',
        formacionYCapacidades: 'Education and skills',
        gestionDeEmpleabilidad: 'Employability management',
        informacionIncompleta: 'Incomplete information',
        informacionAcademica: 'Academic information',
        informacionPersonal: 'Personal details',
        fichaDeEmpleabilidad: 'Employability record',
        reportadaPorEl: 'Reported by the student',
        gestionadaPorEl: 'Managed by the programme',
        pendientesParaAvanzar: 'Outstanding to move forward',
        abrirCarpetaDe: 'Open the documents folder',
        abrirPerfilDe: 'Open the LinkedIn profile',
        cargosQuePuede: 'Roles they can apply for',
        carpetaDeDocumentos: 'Documents folder',
        enlaceDeLinkedin: 'LinkedIn link',
        enlacesDeTrabajo: 'Work links',
        enfoqueDelPerfil: 'Profile focus',
        cargoPendienteDe: 'Role not recorded yet',
        modalidadSinRegistrar: 'Mode not recorded',
        contratoSinRegistrar: 'Contract not recorded',
        canalSinRegistrar: 'Channel not recorded',
        sectorPorDefinir: 'Sector to be defined',
        sinAccionPendiente: 'No action pending',
        registradasEnEl: 'recorded in the process',
        nombreDelResponsable: 'Person in charge',
        detalleDelContacto: 'Details of the contact…',
        nombreDelPrograma: 'Programme name',
        nombreDeLa: 'Company name',
        numeroDeDocumento: 'ID number',
        fechaDeNacimiento: 'Date of birth',
        institucionEducativa: 'Educational institution',
        programaAcademico: 'Academic programme',
        estadoDeFormacion: 'Education status',
        estadoDeEmpleabilidad: 'Employability status',
        estadoDelSeguimiento: 'Follow-up status',
        sectorDeExperiencia: 'Sector of experience',
        anosDeExperiencia: 'Years of experience',
        areaDeFormacion: 'Field of study',
        areaDeFormacionX: 'Field of study',
        nivelDeIngles: 'English level',
        nivelDeInglesX: 'English level',
        estadoAcademico: 'Academic status',
        tipoDeDocumento: 'ID type',
        cargoDesempenado: 'Role held',
        tituloCarrera: 'Qualification / degree',
        guardarPreparacion: 'Save readiness',
        generarNuevaVersion: 'Generate a new version',
        marcarComoVigente: 'Set as current',
        registrarSeguimiento: 'Log follow-up',
        editarSeguimiento: 'Edit follow-up',
        agregarExperiencia: 'Add experience',
        agregarFormacion: 'Add education',
        guardarCambios: 'Save changes',
        eliminarSeguimiento: 'Delete follow-up',
        eliminarExperiencia: 'Delete experience',
        eliminarHojaDe: 'Delete résumé',
        eliminarDocumento: 'Delete document',
        eliminarFormacion: 'Delete education record',
        formacionAgregada: 'Education record added.',
        plataformasDeAcceso: 'Access platforms',
        sinDocumentosAdjuntos: 'No documents attached.',
        sinClasificar: '— Unclassified —',
        tieneComputador: 'Has a computer',
        tieneInternet: 'Has internet',
        noDisponible: 'Not available',
        accionARealizar: 'Action to take',
        proximaAccion: 'Next action:',
        proximaAccionX: 'Next action',
        sinPrograma: 'No programme',
        cvEnIngles: 'Résumé in English',
        generadaPor: 'Generated by',
        institucion: 'Institution *',
        verVacante: 'View vacancy',
        noOfrecida: 'not offered',
        observacion: 'Note',
        fechaProxima: 'Next date',
        ultimoCargo: 'Last role',
        direccion: 'Address',
        academico: 'Academic',
        formacion: 'Education',
        version: 'Version',
        tamano: 'Size',
        titulo: 'Qualification',
        genero: 'Gender',
      }
    : {
        buscandoEmpleo: 'Buscando empleo',
        plataformasExternasA: 'Plataformas externas a las que este estudiante tiene acceso. Solo las activas de su programa quedan visibles en el portal.',
        registroYEstado: 'Registro y estado actual de cada proceso de selección. Los cambios hechos por el estudiante quedan reflejados aquí.',
        contactosCompromisosY: 'Contactos, compromisos y próximos pasos de empleabilidad que no provienen de una postulación.',
        avanceCalculadoA: 'Avance calculado a partir de la hoja de vida, preparación y postulaciones del estudiante.',
        noHayPlataformas: 'No hay plataformas en el catálogo todavía. Crea una desde Configuración → Plataformas.',
        resultadosVerificadosPor: 'Resultados verificados por el equipo: empresa, condiciones y checklist de ingreso.',
        informacionConsolidadaPara: 'Información consolidada para orientar el acompañamiento y las oportunidades adecuadas.',
        actualizaLosDatos: 'Actualiza los datos personales, académicos y de empleabilidad desde un único formulario.',
        hitosPerfilOcupacional: 'Hitos, perfil ocupacional, cargos sugeridos y enlaces que gestiona el equipo.',
        actualizaElDetalle: 'Actualiza el detalle, responsable o próximo paso del acompañamiento.',
        formacionAdicionalDel: 'Formación adicional del estudiante (cursos, diplomados, títulos).',
        noFuePosible: 'No fue posible calcular el proceso de empleabilidad todavía.',
        accesosImportadosDel: 'Accesos importados del expediente operativo del participante.',
        seEliminaraEsta: 'Se eliminará esta formación. Esta acción no se puede deshacer.',
        seEliminaraEstaX: 'Se eliminará esta experiencia. Esta acción no se puede deshacer.',
        seEliminaraEste: 'Se eliminará este documento. Esta acción no se puede deshacer.',
        seEliminaraEsteX: 'Se eliminará este seguimiento. Esta acción no se puede deshacer.',
        certificadosActasY: 'Certificados, actas y soportes del estudiante.',
        elEstudianteAun: 'El estudiante aún no registra postulaciones a vacantes.',
        noHayUna: 'No hay una vinculación laboral verificada todavía.',
        preparacionParaLa: 'Preparación para la empleabilidad actualizada.',
        herramientasIdiomasY: 'Herramientas, idiomas y habilidades validadas',
        enlaceDeDrive: 'Enlace de Drive o repositorio institucional',
        principalesFuncionesDesempenadas: 'Principales funciones desempeñadas…',
        institucionYPrograma: 'Institución y programa son obligatorios.',
        informacionDelEstudiante: 'Información del estudiante actualizada.',
        elTipoDe: 'El tipo de seguimiento es obligatorio.',
        unCargoPor: 'Un cargo por línea o separados por coma',
        aunNoSe: 'Aún no se ha generado ninguna hoja de vida.',
        sinRegistrosDe: 'Sin registros de auditoría para este estudiante.',
        registrarAccionDe: 'Registrar acción de acompañamiento',
        cargandoProcesoDe: 'Cargando proceso de empleabilidad…',
        empresaYCargo: 'Empresa y cargo son obligatorios.',
        noSePudo: 'No se pudo actualizar la información',
        noSePudoX: 'No se pudo actualizar el seguimiento',
        noSePudoXX: 'No se pudo actualizar la preparación',
        elEstudianteNo: 'El estudiante no existe o fue eliminado.',
        competenciasTecnicasY: 'Competencias técnicas y fortalezas',
        historialLaboralDel: 'Historial laboral del estudiante.',
        lineaDeTiempo: 'Historia',
        todoLoQuePaso: 'Postulaciones, entrevistas, documentos y notas de seguimiento, en orden.',
        sinExperienciaLaboral: 'Sin experiencia laboral registrada.',
        versionesGeneradasDe: 'Versiones generadas de la hoja de vida.',
        datosDeContacto: 'Datos de contacto y ubicación del estudiante.',
        formacionBaseY: 'Formación base y nivel de idioma.',
        cargandoPerfilDel: 'Cargando perfil del estudiante…',
        editarInformacionDel: 'Editar información del estudiante',
        noSeEncontro: 'No se encontró el estudiante.',
        sinSeguimientosRegistrados: 'Sin seguimientos registrados.',
        sinFormacionesRegistradas: 'Sin formaciones registradas.',
        sinCargosSugeridos: 'Sin cargos sugeridos todavía.',
        cargandoHojasDe: 'Cargando hojas de vida…',
        errorAlMarcar: 'Error al marcar la versión vigente',
        errorAlEliminar: 'Error al eliminar la hoja de vida',
        errorAlGenerar: 'Error al generar la hoja de vida',
        errorAlEliminarX: 'Error al eliminar el seguimiento',
        errorAlActualizar: 'Error al actualizar el seguimiento',
        errorAlEliminarXX: 'Error al eliminar la experiencia',
        errorAlEliminarXXX: 'Error al eliminar la formación',
        errorAlCrear: 'Error al crear el seguimiento',
        errorAlCrearX: 'Error al crear la experiencia',
        errorAlEliminarXXXX: 'Error al eliminar el documento',
        errorAlCargar: 'Error al cargar el estudiante',
        errorAlCrearXX: 'Error al crear la formación',
        errorAlSubir: 'Error al subir el documento',
        errorAlDescargar: 'Error al descargar el PDF',
        errorAlSubirX: 'Error al subir la foto',
        errorAlDescargarX: 'Error al descargar',
        seleccionaUnArchivo: 'Selecciona un archivo primero.',
        preparacionParaLaX: 'Preparación para la empleabilidad',
        procesoDeEmpleabilidad: 'Proceso de empleabilidad',
        formacionYExperiencia: 'Formación y experiencia',
        formacionYCapacidades: 'Formacion y capacidades',
        gestionDeEmpleabilidad: 'Gestion de empleabilidad',
        informacionIncompleta: 'Información incompleta',
        informacionAcademica: 'Información académica',
        informacionPersonal: 'Información personal',
        fichaDeEmpleabilidad: 'Ficha de empleabilidad',
        reportadaPorEl: 'Reportada por el estudiante',
        gestionadaPorEl: 'Gestionada por el programa',
        pendientesParaAvanzar: 'Pendientes para avanzar',
        abrirCarpetaDe: 'Abrir carpeta de documentos',
        abrirPerfilDe: 'Abrir perfil de LinkedIn',
        cargosQuePuede: 'Cargos que puede aplicar',
        carpetaDeDocumentos: 'Carpeta de documentos',
        enlaceDeLinkedin: 'Enlace de LinkedIn',
        enlacesDeTrabajo: 'Enlaces de trabajo',
        enfoqueDelPerfil: 'Enfoque del perfil',
        cargoPendienteDe: 'Cargo pendiente de registrar',
        modalidadSinRegistrar: 'Modalidad sin registrar',
        contratoSinRegistrar: 'Contrato sin registrar',
        canalSinRegistrar: 'Canal sin registrar',
        sectorPorDefinir: 'Sector por definir',
        sinAccionPendiente: 'Sin acción pendiente',
        registradasEnEl: 'registradas en el proceso',
        nombreDelResponsable: 'Nombre del responsable',
        detalleDelContacto: 'Detalle del contacto…',
        nombreDelPrograma: 'Nombre del programa',
        nombreDeLa: 'Nombre de la empresa',
        numeroDeDocumento: 'Número de documento',
        fechaDeNacimiento: 'Fecha de nacimiento',
        institucionEducativa: 'Institución educativa',
        programaAcademico: 'Programa académico',
        estadoDeFormacion: 'Estado de formación',
        estadoDeEmpleabilidad: 'Estado de empleabilidad',
        estadoDelSeguimiento: 'Estado del seguimiento',
        sectorDeExperiencia: 'Sector de experiencia',
        anosDeExperiencia: 'Años de experiencia',
        areaDeFormacion: 'Area de formacion',
        areaDeFormacionX: 'Área de formación',
        nivelDeIngles: 'Nivel de ingles',
        nivelDeInglesX: 'Nivel de inglés',
        estadoAcademico: 'Estado académico',
        tipoDeDocumento: 'Tipo de documento',
        cargoDesempenado: 'Cargo desempeñado',
        tituloCarrera: 'Título / carrera',
        guardarPreparacion: 'Guardar preparación',
        generarNuevaVersion: 'Generar nueva versión',
        marcarComoVigente: 'Marcar como vigente',
        registrarSeguimiento: 'Registrar seguimiento',
        editarSeguimiento: 'Editar seguimiento',
        agregarExperiencia: 'Agregar experiencia',
        agregarFormacion: 'Agregar formación',
        guardarCambios: 'Guardar cambios',
        eliminarSeguimiento: 'Eliminar seguimiento',
        eliminarExperiencia: 'Eliminar experiencia',
        eliminarHojaDe: 'Eliminar hoja de vida',
        eliminarDocumento: 'Eliminar documento',
        eliminarFormacion: 'Eliminar formación',
        formacionAgregada: 'Formación agregada.',
        plataformasDeAcceso: 'Plataformas de acceso',
        sinDocumentosAdjuntos: 'Sin documentos adjuntos.',
        sinClasificar: '— Sin clasificar —',
        tieneComputador: 'Tiene computador',
        tieneInternet: 'Tiene internet',
        noDisponible: 'No disponible',
        accionARealizar: 'Acción a realizar',
        proximaAccion: 'Próxima acción:',
        proximaAccionX: 'Próxima acción',
        sinPrograma: 'Sin programa',
        cvEnIngles: 'CV en inglés',
        generadaPor: 'Generada por',
        institucion: 'Institución *',
        verVacante: 'Ver vacante',
        noOfrecida: 'no ofrecida',
        observacion: 'Observación',
        fechaProxima: 'Fecha próxima',
        ultimoCargo: 'Último cargo',
        direccion: 'Dirección',
        academico: 'Académico',
        formacion: 'Formación',
        version: 'Versión',
        tamano: 'Tamaño',
        titulo: 'Título',
        genero: 'Género',
      }
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div>
      <span className="block text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-foreground text-xs">{value ?? C.sinRegistrar}</span>
    </div>
  )
}

function SeccionCargando({ texto }: { texto: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <div className="flex items-center justify-center py-12">
      <PageSpinner />
      <span className="ml-2 text-sm text-muted-foreground">{texto}</span>
    </div>
  )
}

const emptyFormacion: FormacionRequest = { tipo: 'CURSO', institucion: '', programa: '', fechaInicio: '', fechaFin: '', estado: 'EN_CURSO' }
const emptyExperiencia: ExperienciaRequest = { empresa: '', cargo: '', fechaInicio: '', fechaFin: '', funciones: '', actual: false }
const emptySeguimiento: SeguimientoRequest = { fecha: '', tipo: 'LLAMADA', responsable: '', observacion: '', proximaAccion: '', fechaProxima: '', estado: 'PENDIENTE' }

type TabId = 'resumen' | 'personal' | 'academico' | 'formacion' | 'experiencia' | 'hv' | 'documentos' | 'plataformas' | 'seguimientos' | 'historial'

// ─── Componente principal ────────────────────────────────────────────────────

/**
 * La ficha se monta de nuevo por cada estudiante, y de eso se encarga la clave.
 *
 * Al pasar de una ficha a otra la navegación no recarga la página: cambia el
 * `id` dentro del mismo componente. Las ocho cargas de la ficha anterior seguían
 * en vuelo y escribían al volver, así que los datos de un estudiante acababan
 * pintados bajo el nombre de otro —y aquí eso son datos personales de gente
 * real, no una lista cualquiera—. Con la clave, React descarta la instancia
 * anterior y esas respuestas ya no tienen dónde escribir.
 */
export default function PerfilEstudiantePage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? ''
  return <FichaEstudiante key={id} id={id} />
}

function FichaEstudiante({ id }: { id: string }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()

  const [estudiante, setEstudiante] = useState<EstudianteResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [tab, setTab]               = useState<TabId>('resumen')
  const [mensaje, setMensaje]       = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [editandoFicha, setEditandoFicha] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [fichaForm, setFichaForm] = useState<EstudianteRequest | null>(null)

  // Foto
  const fotoRef = useRef<HTMLInputElement>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  // Formaciones
  const [formaciones, setFormaciones]     = useState<FormacionResponse[]>([])
  const [loadingForm, setLoadingForm]     = useState(true)
  const [nuevaFormacion, setNuevaFormacion] = useState<FormacionRequest>(emptyFormacion)
  const [guardandoFormacion, setGuardandoFormacion] = useState(false)

  // Experiencias
  const [experiencias, setExperiencias]   = useState<ExperienciaResponse[]>([])
  const [loadingExp, setLoadingExp]       = useState(true)
  const [nuevaExperiencia, setNuevaExperiencia] = useState<ExperienciaRequest>(emptyExperiencia)
  const [guardandoExperiencia, setGuardandoExperiencia] = useState(false)

  // Hojas de vida
  const [hvs, setHvs]           = useState<HojaDeVidaResponse[]>([])
  const [loadingHv, setLoadingHv] = useState(true)
  const [generandoHv, setGenerandoHv] = useState(false)

  // Documentos
  const [documentos, setDocumentos]     = useState<DocumentoResponse[]>([])
  const [totalDocs, setTotalDocs]       = useState(0)
  const [loadingDocs, setLoadingDocs]   = useState(true)
  const [tiposDoc, setTiposDoc]         = useState<string[]>([])
  const [docFile, setDocFile]           = useState<File | null>(null)
  const [docTipo, setDocTipo]           = useState('')
  const [subiendoDoc, setSubiendoDoc]   = useState(false)
  const [documentoPreview, setDocumentoPreview] = useState<DocumentoResponse | null>(null)
  const docRef = useRef<HTMLInputElement>(null)

  // Plataformas de acceso
  const [plataformasCat, setPlataformasCat] = useState<PlataformaResponse[]>([])
  const [plataformasEst, setPlataformasEst] = useState<string[]>([])
  const [plataformasPgm, setPlataformasPgm] = useState<string[]>([])
  const [loadingPlataformas, setLoadingPlataformas] = useState(true)
  const [guardandoPlataformas, setGuardandoPlataformas] = useState(false)

  // Seguimientos
  const [seguimientos, setSeguimientos]   = useState<SeguimientoResponse[]>([])
  const [loadingSeg, setLoadingSeg]       = useState(true)
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState<SeguimientoRequest>(emptySeguimiento)
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState(false)
  const [seguimientoEditando, setSeguimientoEditando] = useState<SeguimientoResponse | null>(null)
  const [formSeguimientoEdit, setFormSeguimientoEdit] = useState<SeguimientoRequest>(emptySeguimiento)
  const [guardandoSeguimientoEdit, setGuardandoSeguimientoEdit] = useState(false)

  // Empleabilidad: el expediente muestra hechos (postulaciones) y no solo
  // notas manuales. Cada cambio que hace el estudiante queda visible aqui.
  const [pipeline, setPipeline] = useState<PipelineEmpleabilidadResponse | null>(null)
  const [postulaciones, setPostulaciones] = useState<PostulacionResponse[]>([])
  const [colocaciones, setColocaciones] = useState<ColocacionResponse[]>([])
  const [loadingEmpleabilidad, setLoadingEmpleabilidad] = useState(true)
  const [editandoPreparacion, setEditandoPreparacion] = useState(false)
  const [guardandoPreparacion, setGuardandoPreparacion] = useState(false)
  const [preparacion, setPreparacion] = useState<PreparacionEstudianteRequest>({})
  const [modalPostularAbierto, setModalPostularAbierto] = useState(false)

  // Historial (auditoría)
  const [historial, setHistorial]     = useState<AuditoriaResponse[]>([])
  const [loadingHist, setLoadingHist] = useState(true)

  // ── Cargas ────────────────────────────────────────────────────────────────

  const loadEstudiante = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setEstudiante(await estudiantesApi.obtener(id))
    } catch (err) {
      setError(err instanceof ApiCallError
        ? (err.status === 404 ? T.elEstudianteNo : errorDe(err, T.errorAlCargar))
        : C.errorConexion)
    } finally { setLoading(false) }
  }, [id])

  const loadFormaciones = useCallback(async () => {
    setLoadingForm(true)
    try { setFormaciones(await perfilApi.formaciones(id)) } catch { setFormaciones([]) }
    finally { setLoadingForm(false) }
  }, [id])

  const loadExperiencias = useCallback(async () => {
    setLoadingExp(true)
    try { setExperiencias(await perfilApi.experiencias(id)) } catch { setExperiencias([]) }
    finally { setLoadingExp(false) }
  }, [id])

  const loadHvs = useCallback(async () => {
    setLoadingHv(true)
    try { setHvs(await hvApi.deEstudiante(id)) } catch { setHvs([]) }
    finally { setLoadingHv(false) }
  }, [id])

  const loadDocumentos = useCallback(async () => {
    setLoadingDocs(true)
    try {
      const pg = await documentosApi.buscar({ estudianteId: id, size: 50 })
      setDocumentos(pg.content); setTotalDocs(pg.totalElements)
    } catch { setDocumentos([]); setTotalDocs(0) }
    finally { setLoadingDocs(false) }
  }, [id])

  const loadSeguimientos = useCallback(async () => {
    setLoadingSeg(true)
    try {
      const list = await seguimientosApi.listar(id)
      setSeguimientos([...list].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')))
    } catch { setSeguimientos([]) }
    finally { setLoadingSeg(false) }
  }, [id])

  const loadEmpleabilidad = useCallback(async () => {
    setLoadingEmpleabilidad(true)
    try {
      const [pipelineActual, postulacionesActuales, colocacionesActuales] = await Promise.all([
        pipelineApi.porEstudiante(id),
        postulacionesApi.deEstudiante(id),
        colocacionesApi.deEstudiante(id),
      ])
      setPipeline(pipelineActual)
      setPostulaciones(postulacionesActuales)
      setColocaciones(colocacionesActuales)
    } catch {
      setPipeline(null)
      setPostulaciones([])
      setColocaciones([])
    } finally { setLoadingEmpleabilidad(false) }
  }, [id])

  const loadHistorial = useCallback(async () => {
    setLoadingHist(true)
    try {
      const pg = await auditoriaApi.buscar({ registroId: id, size: 50 })
      setHistorial(pg.content)
    } catch { setHistorial([]) }
    finally { setLoadingHist(false) }
  }, [id])

  const loadPlataformas = useCallback(async () => {
    setLoadingPlataformas(true)
    try {
      const [cat, est, pgm] = await Promise.all([
        plataformasApi.catalogo(),
        plataformasApi.deEstudiante(id),
        estudiante?.programaId ? plataformasApi.dePrograma(estudiante.programaId) : Promise.resolve([]),
      ])
      setPlataformasCat(cat)
      setPlataformasEst(est.map((p) => p.id))
      setPlataformasPgm(pgm.map((p) => p.id))
    } catch { setPlataformasCat([]); setPlataformasEst([]); setPlataformasPgm([]) }
    finally { setLoadingPlataformas(false) }
  }, [id, estudiante?.programaId])

  useEffect(() => {
    if (!id) return
    loadEstudiante()
    loadFormaciones(); loadExperiencias(); loadHvs(); loadDocumentos(); loadSeguimientos(); loadEmpleabilidad(); loadHistorial()
    documentosApi.tipos().then(setTiposDoc).catch(() => setTiposDoc([]))
  }, [id, loadEstudiante, loadFormaciones, loadExperiencias, loadHvs, loadDocumentos, loadSeguimientos, loadEmpleabilidad, loadHistorial])

  // Las plataformas del programa solo se saben cuando la ficha del estudiante
  // ya dijo a qué programa pertenece.
  useEffect(() => {
    if (id && estudiante) loadPlataformas()
  }, [id, estudiante?.programaId, loadPlataformas])

  // ── Acciones ──────────────────────────────────────────────────────────────

  const flash = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto })
    setTimeout(() => setMensaje(null), 5000)
  }

  const togglePlataforma = (pid: string) =>
    setPlataformasEst((prev) => prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid])

  const guardarPlataformas = async () => {
    setGuardandoPlataformas(true)
    try {
      const asignadas = await plataformasApi.asignarEstudiante(id, plataformasEst)
      setPlataformasEst(asignadas.map((p) => p.id))
      flash('ok', 'Plataformas actualizadas.')
    } catch (err) {
      flash('error', errorDe(err))
    } finally { setGuardandoPlataformas(false) }
  }

  const abrirEdicionFicha = () => {
    if (!estudiante) return
    setFichaForm({
      nombre: estudiante.nombre, apellido: estudiante.apellido, email: estudiante.email,
      telefono: estudiante.telefono ?? '', celular: estudiante.celular ?? '', ciudad: estudiante.ciudad ?? '', barrio: estudiante.barrio ?? '',
      tipoDocumento: estudiante.tipoDocumento ?? '', numeroDocumento: estudiante.numeroDocumento ?? '', fechaNacimiento: estudiante.fechaNacimiento ?? '', genero: estudiante.genero ?? '', nacionalidad: estudiante.nacionalidad ?? '',
      nivelEducativo: estudiante.nivelEducativo ?? '', titulo: estudiante.titulo ?? '', aniosExperiencia: estudiante.aniosExperiencia ?? undefined,
      sectorExperiencia: estudiante.sectorExperiencia ?? '', ultimoCargo: estudiante.ultimoCargo ?? '', perfilProfesional: estudiante.perfilProfesional ?? '',
      sectorObjetivo: estudiante.sectorObjetivo ?? '', cargoObjetivo: estudiante.cargoObjetivo ?? '', disponibilidadMovilidad: estudiante.disponibilidadMovilidad ?? undefined,
      clasificacionSisben: estudiante.clasificacionSisben ?? '', situacionLaboral: estudiante.situacionLaboral ?? '', ingresoMensual: estudiante.ingresoMensual ?? '',
      responsableEconomico: estudiante.responsableEconomico ?? undefined, haTrabajado: estudiante.haTrabajado ?? undefined, tieneComputador: estudiante.tieneComputador ?? undefined, tieneInternet: estudiante.tieneInternet ?? undefined,
      motivacion: estudiante.motivacion ?? '', interesMigratorio: estudiante.interesMigratorio ?? undefined, resultadoPruebaEscrita: estudiante.resultadoPruebaEscrita ?? '', resultadoPruebaOral: estudiante.resultadoPruebaOral ?? '',
      institucionEducativa: estudiante.institucionEducativa ?? '', programaAcademico: estudiante.programaAcademico ?? '', areaFormacion: estudiante.areaFormacion ?? '', estadoFormacion: estudiante.estadoFormacion ?? '',
      disponibilidadLaboral: estudiante.disponibilidadLaboral ?? '', estadoBusqueda: estudiante.estadoBusqueda ?? '', postulacionesEnviadas: estudiante.postulacionesEnviadas ?? undefined, empresasContactadas: estudiante.empresasContactadas ?? undefined,
      estadoAcademico: estudiante.estadoAcademico, estadoEmpleabilidad: estudiante.estadoEmpleabilidad, programaId: estudiante.programaId,
      direccion: estudiante.direccion ?? '', competencias: estudiante.competencias ?? '', idiomas: estudiante.idiomas ?? '', referencias: estudiante.referencias ?? '', disponibilidad: estudiante.disponibilidad ?? '', linkedinUrl: estudiante.linkedinUrl ?? '',
    })
    setEditandoFicha(true)
  }

  const guardarFicha = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!fichaForm) return
    setGuardandoFicha(true)
    try {
      const actualizada = await estudiantesApi.actualizar(id, fichaForm)
      setEstudiante(actualizada)
      setEditandoFicha(false)
      flash('ok', T.informacionDelEstudiante)
    } catch (err) { flash('error', errorDe(err, T.noSePudo)) }
    finally { setGuardandoFicha(false) }
  }

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoFoto(true)
    try {
      const actualizado = await estudiantesApi.subirFoto(id, archivo)
      setEstudiante(actualizado)
      flash('ok', 'Foto actualizada correctamente.')
    } catch (err) { flash('error', errorDe(err, T.errorAlSubirX)) }
    finally {
      setSubiendoFoto(false)
      if (fotoRef.current) fotoRef.current.value = ''
    }
  }

  const handleGenerarHv = async (idioma: 'es' | 'en' = 'es') => {
    setGenerandoHv(true)
    try {
      const hv = await hvApi.generar(id, { idioma })
      flash('ok', `Hoja de vida versión ${hv.numeroVersion} (${idioma.toUpperCase()}) generada correctamente.`)
      loadHvs(); setTab('hv')
    } catch (err) { flash('error', errorDe(err, T.errorAlGenerar)) }
    finally { setGenerandoHv(false) }
  }

  const handleCrearFormacion = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!nuevaFormacion.institucion.trim() || !nuevaFormacion.programa.trim()) {
      flash('error', T.institucionYPrograma); return
    }
    setGuardandoFormacion(true)
    try {
      await perfilApi.crearFormacion(id, {
        ...nuevaFormacion,
        fechaInicio: nuevaFormacion.fechaInicio || undefined,
        fechaFin: nuevaFormacion.fechaFin || undefined,
      })
      setNuevaFormacion(emptyFormacion)
      loadFormaciones()
      flash('ok', T.formacionAgregada)
    } catch (err) { flash('error', errorDe(err, T.errorAlCrearXX)) }
    finally { setGuardandoFormacion(false) }
  }

  const handleEliminarFormacion = async (fid: string) => {
    if (!(await confirmar({ titulo: T.eliminarFormacion, descripcion: T.seEliminaraEsta, textoConfirmar: C.eliminar }))) return
    try { await perfilApi.eliminarFormacion(id, fid); loadFormaciones() }
    catch (err) { flash('error', errorDe(err, T.errorAlEliminarXXX)) }
  }

  const handleCrearExperiencia = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!nuevaExperiencia.empresa.trim() || !nuevaExperiencia.cargo.trim()) {
      flash('error', T.empresaYCargo); return
    }
    setGuardandoExperiencia(true)
    try {
      await perfilApi.crearExperiencia(id, {
        ...nuevaExperiencia,
        fechaInicio: nuevaExperiencia.fechaInicio || undefined,
        fechaFin: nuevaExperiencia.fechaFin || undefined,
        funciones: nuevaExperiencia.funciones || undefined,
      })
      setNuevaExperiencia(emptyExperiencia)
      loadExperiencias()
      flash('ok', 'Experiencia agregada.')
    } catch (err) { flash('error', errorDe(err, T.errorAlCrearX)) }
    finally { setGuardandoExperiencia(false) }
  }

  const handleEliminarExperiencia = async (eid: string) => {
    if (!(await confirmar({ titulo: T.eliminarExperiencia, descripcion: T.seEliminaraEstaX, textoConfirmar: C.eliminar }))) return
    try { await perfilApi.eliminarExperiencia(id, eid); loadExperiencias() }
    catch (err) { flash('error', errorDe(err, T.errorAlEliminarXX)) }
  }

  const handleMarcarActual = async (hvId: string) => {
    try { await hvApi.marcarActual(hvId); loadHvs() }
    catch (err) { flash('error', errorDe(err, T.errorAlMarcar)) }
  }

  const handleEliminarHv = async (hv: HojaDeVidaResponse) => {
    if (!(await confirmar({ titulo: T.eliminarHojaDe, descripcion: `Se eliminará definitivamente la hoja de vida versión ${hv.numeroVersion}. Esta acción no se puede deshacer.`, textoConfirmar: C.eliminar }))) return
    try {
      await hvApi.eliminar(hv.id)
      loadHvs()
      flash('ok', `Hoja de vida versión ${hv.numeroVersion} eliminada.`)
    } catch (err) { flash('error', errorDe(err, T.errorAlEliminar)) }
  }

  const handleSubirDocumento = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!docFile) { flash('error', T.seleccionaUnArchivo); return }
    setSubiendoDoc(true)
    try {
      await documentosApi.subir(docFile, { estudianteId: id, tipo: docTipo || undefined })
      setDocFile(null); setDocTipo('')
      if (docRef.current) docRef.current.value = ''
      loadDocumentos()
      flash('ok', 'Documento subido correctamente.')
    } catch (err) { flash('error', errorDe(err, T.errorAlSubir)) }
    finally { setSubiendoDoc(false) }
  }

  const handleEliminarDocumento = async (did: string) => {
    if (!(await confirmar({ titulo: T.eliminarDocumento, descripcion: T.seEliminaraEste, textoConfirmar: C.eliminar }))) return
    try { await documentosApi.eliminar(did); loadDocumentos() }
    catch (err) { flash('error', errorDe(err, T.errorAlEliminarXXXX)) }
  }

  const handleCrearSeguimiento = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!nuevoSeguimiento.tipo) { flash('error', T.elTipoDe); return }
    setGuardandoSeguimiento(true)
    try {
      await seguimientosApi.crear(id, {
        ...nuevoSeguimiento,
        fecha: nuevoSeguimiento.fecha || undefined,
        responsable: nuevoSeguimiento.responsable || undefined,
        observacion: nuevoSeguimiento.observacion || undefined,
        proximaAccion: nuevoSeguimiento.proximaAccion || undefined,
        fechaProxima: nuevoSeguimiento.fechaProxima || undefined,
      })
      setNuevoSeguimiento(emptySeguimiento)
      loadSeguimientos()
      flash('ok', 'Seguimiento registrado.')
    } catch (err) { flash('error', errorDe(err, T.errorAlCrear)) }
    finally { setGuardandoSeguimiento(false) }
  }

  const handleEstadoSeguimiento = async (seg: SeguimientoResponse, estado: string) => {
    try {
      await seguimientosApi.actualizar(id, seg.id, {
        fecha: seg.fecha ?? undefined,
        tipo: seg.tipo,
        responsable: seg.responsable ?? undefined,
        observacion: seg.observacion ?? undefined,
        proximaAccion: seg.proximaAccion ?? undefined,
        fechaProxima: seg.fechaProxima ?? undefined,
        estado,
      })
      loadSeguimientos()
    } catch (err) { flash('error', errorDe(err, T.errorAlActualizar)) }
  }

  const handleEliminarSeguimiento = async (sid: string) => {
    if (!(await confirmar({ titulo: T.eliminarSeguimiento, descripcion: T.seEliminaraEsteX, textoConfirmar: C.eliminar }))) return
    try { await seguimientosApi.eliminar(id, sid); loadSeguimientos() }
    catch (err) { flash('error', errorDe(err, T.errorAlEliminarX)) }
  }

  const abrirEdicionSeguimiento = (seguimiento: SeguimientoResponse) => {
    setSeguimientoEditando(seguimiento)
    setFormSeguimientoEdit({ fecha: seguimiento.fecha ?? '', tipo: seguimiento.tipo, responsable: seguimiento.responsable ?? '', observacion: seguimiento.observacion ?? '', proximaAccion: seguimiento.proximaAccion ?? '', fechaProxima: seguimiento.fechaProxima ?? '', estado: seguimiento.estado })
  }

  const guardarSeguimientoEdit = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!seguimientoEditando) return
    setGuardandoSeguimientoEdit(true)
    try {
      await seguimientosApi.actualizar(id, seguimientoEditando.id, formSeguimientoEdit)
      setSeguimientoEditando(null)
      loadSeguimientos()
      flash('ok', 'Seguimiento actualizado.')
    } catch (err) { flash('error', errorDe(err, T.noSePudoX)) }
    finally { setGuardandoSeguimientoEdit(false) }
  }

  const abrirEdicionPreparacion = () => {
    if (!estudiante) return
    setPreparacion({
      cvListo: estudiante.hitoCvListo,
      cvEnIngles: estudiante.hitoCvIngles,
      linkedinCreado: estudiante.hitoLinkedinCreado,
      linkedinOptimizado: estudiante.hitoLinkedinOptimizado,
      perfilOcupacional: estudiante.hitoPerfilOcupacional,
      carpetaUrl: estudiante.carpetaUrl ?? '',
      linkedinUrl: estudiante.linkedinUrl ?? '',
      sectorObjetivo: estudiante.sectorObjetivo ?? '',
      cargoObjetivo: estudiante.cargoObjetivo ?? '',
      perfilProfesional: estudiante.perfilProfesional ?? '',
      competencias: estudiante.competencias ?? '',
    })
    setEditandoPreparacion(true)
  }

  const guardarPreparacion = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    setGuardandoPreparacion(true)
    try {
      const actualizada = await estudiantesApi.actualizarPreparacion(id, preparacion)
      setEstudiante(actualizada)
      setEditandoPreparacion(false)
      loadEmpleabilidad()
      flash('ok', T.preparacionParaLa)
    } catch (err) { flash('error', errorDe(err, T.noSePudoXX)) }
    finally { setGuardandoPreparacion(false) }
  }

  // ── Estados globales ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <PageSpinner />
        <span className="ml-2 text-sm text-muted-foreground">{T.cargandoPerfilDel}</span>
      </div>
    )
  }

  if (error || !estudiante) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <WarningCircle className="size-8 text-destructive" />
        <p className="text-sm text-destructive">{error ?? T.noSeEncontro}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadEstudiante}><ArrowsClockwise className="size-4" /> Reintentar</Button>
          <Button variant="outline" render={<Link href="/estudiantes" />}><ArrowLeft className="size-4" /> Volver</Button>
        </div>
      </div>
    )
  }

  const est = estudiante
  const ai = estadoAcademico(C, est.estadoAcademico)
  const ei = estadoEmpleabilidad(T, C, est.estadoEmpleabilidad)
  const completitud = Math.max(0, Math.min(100, est.porcentajeCompletitud ?? 0))

  const camposFaltantes: string[] = []
  if (!est.celular) camposFaltantes.push('Celular')
  if (!est.numeroDocumento) camposFaltantes.push(T.numeroDeDocumento)
  if (!est.perfilProfesional) camposFaltantes.push('Perfil profesional')

  const tabs: { id: TabId; label: string; icon: typeof User }[] = [
    { id: 'resumen',      label: 'Resumen',      icon: SquaresFour },
    { id: 'personal',     label: 'Personal',     icon: User },
    { id: 'academico',    label: T.academico,    icon: GraduationCap },
    { id: 'formacion',    label: T.formacion,    icon: FileText },
    { id: 'experiencia',  label: 'Experiencia',  icon: Briefcase },
    { id: 'hv',           label: 'Hoja de vida', icon: ReadCvLogo },
    { id: 'documentos',   label: 'Documentos',   icon: FolderOpen },
    { id: 'plataformas',  label: 'Plataformas',  icon: LinkSimple },
    { id: 'seguimientos', label: 'Seguimientos', icon: ClipboardText },
    { id: 'historial',    label: 'Historial',    icon: ClockCounterClockwise },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Volver */}
      <div>
        <Link href="/estudiantes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Volver a estudiantes
        </Link>
      </div>

      {/* ── Cabecera del expediente ────────────────────────────────────────── */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xl">
                  {est.nombre[0]}{est.apellido[0]}
                </span>
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  disabled={subiendoFoto}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {subiendoFoto ? <CircleNotch className="size-3 animate-spin" /> : <Camera className="size-3" />}
                  Subir foto
                </button>
                <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleSubirFoto} />
              </div>
              <div className="min-w-0 flex flex-col gap-1.5">
                <h2 className="text-xl font-semibold text-foreground truncate">{est.nombre} {est.apellido}</h2>
                <p className="text-xs text-muted-foreground">
                  {est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : 'Sin documento'} · {est.programaNombre ?? T.sinPrograma}
                </p>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  <EstadoDot {...ai} />
                  <EstadoDot {...ei} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {est.email}{est.celular ? ` · ${est.celular}` : ''}{est.ciudad ? ` · ${est.ciudad}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:items-end shrink-0">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={abrirEdicionFicha}>
                  <PencilSimple className="size-3.5" /> Editar
                </Button>
                <Button size="sm" onClick={() => handleGenerarHv()} disabled={generandoHv}>
                  {generandoHv
                    ? <><CircleNotch className="size-3.5 animate-spin" /> Generando…</>
                    : <><ReadCvLogo className="size-3.5" /> Generar hoja de vida</>}
                </Button>
              </div>
              <div className="w-full md:w-56">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Perfil completado</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">{completitud}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-navy-800 transition-all" style={{ width: `${completitud}%` }} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensaje flash */}
      {mensaje && (
        <div
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300'
          }`}
        >
          {mensaje.tipo === 'error' ? <WarningCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      {editandoFicha && fichaForm && (
        <Card className="rounded-2xl border-primary/25 shadow-sm">
          <CardHeader className="border-b border-border/70"><CardTitle className="flex items-center gap-2 text-base"><PencilSimple className="size-4 text-primary" />{T.editarInformacionDel}</CardTitle><CardDescription>{T.actualizaLosDatos}</CardDescription></CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={guardarFicha} className="space-y-6">
              <section><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos personales</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1"><span className="text-xs font-medium">Nombres *</span><Input value={fichaForm.nombre} onChange={(e) => setFichaForm({ ...fichaForm, nombre: e.target.value })} required /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Apellidos *</span><Input value={fichaForm.apellido} onChange={(e) => setFichaForm({ ...fichaForm, apellido: e.target.value })} required /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Correo *</span><Input type="email" value={fichaForm.email} onChange={(e) => setFichaForm({ ...fichaForm, email: e.target.value })} required /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Celular</span><Input value={fichaForm.celular ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, celular: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Ciudad</span><Input value={fichaForm.ciudad ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, ciudad: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Documento</span><Input value={fichaForm.numeroDocumento ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, numeroDocumento: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.tipoDeDocumento}</span><Input value={fichaForm.tipoDocumento ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, tipoDocumento: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.fechaDeNacimiento}</span><Input type="date" value={fichaForm.fechaNacimiento ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, fechaNacimiento: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.genero}</span><Input value={fichaForm.genero ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, genero: e.target.value })} /></label>
              </div></section>
              <section><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{T.formacionYExperiencia}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1"><span className="text-xs font-medium">Nivel educativo</span><Input value={fichaForm.nivelEducativo ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, nivelEducativo: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.tituloCarrera}</span><Input value={fichaForm.titulo ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, titulo: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{C.institucion}</span><Input value={fichaForm.institucionEducativa ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, institucionEducativa: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.ultimoCargo}</span><Input value={fichaForm.ultimoCargo ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, ultimoCargo: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.sectorDeExperiencia}</span><Input value={fichaForm.sectorExperiencia ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, sectorExperiencia: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.anosDeExperiencia}</span><Input type="number" min="0" value={fichaForm.aniosExperiencia ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, aniosExperiencia: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
              </div></section>
              <section><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empleabilidad</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1"><span className="text-xs font-medium">Sector objetivo</span><Input value={fichaForm.sectorObjetivo ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, sectorObjetivo: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">Cargo objetivo</span><Input value={fichaForm.cargoObjetivo ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, cargoObjetivo: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium">LinkedIn</span><Input type="url" value={fichaForm.linkedinUrl ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." /></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.estadoAcademico}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fichaForm.estadoAcademico ?? 'ACTIVO'} onChange={(e) => setFichaForm({ ...fichaForm, estadoAcademico: e.target.value as EstudianteRequest['estadoAcademico'] })}><option value="ACTIVO">{C.activo}</option><option value="EN_PROCESO">En proceso</option><option value="GRADUADO">Graduado</option><option value="RETIRADO">Retirado</option></select></label>
                <label className="space-y-1"><span className="text-xs font-medium">{T.estadoDeEmpleabilidad}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fichaForm.estadoEmpleabilidad ?? 'SIN_INFO'} onChange={(e) => setFichaForm({ ...fichaForm, estadoEmpleabilidad: e.target.value as EstudianteRequest['estadoEmpleabilidad'] })}><option value="SIN_INFO">{C.sinInfo}</option><option value="BUSCANDO">Buscando empleo</option><option value="EMPLEADO">Empleado</option></select></label>
                <label className="space-y-1"><span className="text-xs font-medium">Disponibilidad laboral</span><Input value={fichaForm.disponibilidadLaboral ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, disponibilidadLaboral: e.target.value })} /></label>
              </div><label className="mt-3 block space-y-1"><span className="text-xs font-medium">Perfil profesional</span><Textarea minRows={3} className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" value={fichaForm.perfilProfesional ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, perfilProfesional: e.target.value })} /></label><label className="mt-3 block space-y-1"><span className="text-xs font-medium">Competencias</span><Textarea minRows={2} className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" value={fichaForm.competencias ?? ''} onChange={(e) => setFichaForm({ ...fichaForm, competencias: e.target.value })} /></label></section>
              <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={() => setEditandoFicha(false)} disabled={guardandoFicha}>Cancelar</Button><Button type="submit" disabled={guardandoFicha}>{guardandoFicha ? <><CircleNotch className="size-4 animate-spin" />Guardando…</> : <><CheckCircle className="size-4" />{T.guardarCambios}</>}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex border-b border-border gap-1 overflow-x-auto">
        {tabs.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} type="button" onClick={() => setTab(tid)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${tab === tid ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Resumen ────────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-5 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado actual</span>
                <EstadoDot {...ai} />
                <EstadoDot {...ei} />
              </CardContent>
            </Card>
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-5 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Programa</span>
                <span className="text-sm font-medium text-foreground">{est.programaNombre ?? T.sinPrograma}</span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-5 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Formaciones</span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">{loadingForm ? '…' : formaciones.length}</span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-5 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Experiencias</span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">{loadingExp ? '…' : experiencias.length}</span>
              </CardContent>
            </Card>
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-5 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Documentos / HV</span>
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {loadingDocs ? '…' : totalDocs} <span className="text-sm text-muted-foreground font-normal">/ {loadingHv ? '…' : hvs.length} HV</span>
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Historia unificada. Va antes de la ficha porque «qué ha pasado
              con esta persona» es la pregunta que se hace antes de cualquier
              otra, y hasta ahora obligaba a abrir cuatro pestañas. */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="border-b border-border/70 pb-4">
              <CardTitle className="text-base">{T.lineaDeTiempo}</CardTitle>
              <CardDescription>{T.todoLoQuePaso}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <LineaDeTiempo estudianteId={id} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{T.fichaDeEmpleabilidad}</CardTitle>
                  <CardDescription>{T.informacionConsolidadaPara}</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-lg">Perfil {completitud}% completado</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 lg:grid-cols-3">
              <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Briefcase className="size-3.5" /></span><p className="text-sm font-semibold">Perfil laboral</p></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3"><DetailField label="Ultimo cargo" value={est.ultimoCargo} /><DetailField label="Experiencia" value={est.aniosExperiencia != null ? `${est.aniosExperiencia} anos` : null} /><DetailField label="Sector experiencia" value={est.sectorExperiencia} /><DetailField label="Cargo objetivo" value={est.cargoObjetivo} /></div>
              </section>
              <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><GraduationCap className="size-3.5" /></span><p className="text-sm font-semibold">{T.formacionYCapacidades}</p></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3"><DetailField label="Nivel educativo" value={est.nivelEducativo} /><DetailField label="Titulo" value={est.titulo} /><DetailField label={T.nivelDeIngles} value={est.nivelIngles} /><DetailField label={T.areaDeFormacion} value={est.areaFormacion} /></div>
              </section>
              <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><ClipboardText className="size-3.5" /></span><p className="text-sm font-semibold">{T.gestionDeEmpleabilidad}</p></div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3"><DetailField label="Situacion laboral" value={est.situacionLaboral} /><DetailField label="Sector objetivo" value={est.sectorObjetivo} /><DetailField label="Disponibilidad" value={est.disponibilidadLaboral} /><DetailField label="Postulaciones" value={est.postulacionesEnviadas} /></div>
              </section>
            </CardContent>
          </Card>

          {camposFaltantes.length > 0 && (
            <Card className="rounded-lg border-border shadow-none border-amber-300/60 dark:border-amber-700/40">
              <CardContent className="pt-5">
                <div className="flex items-start gap-2">
                  <WarningCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{T.informacionIncompleta}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Faltan los siguientes campos: {camposFaltantes.join(', ')}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Personal ───────────────────────────────────────────────────────── */}
      {tab === 'personal' && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">{T.informacionPersonal}</CardTitle>
            <CardDescription>{T.datosDeContacto}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Email" value={est.email} />
              <DetailField label={C.telefono} value={est.telefono} />
              <DetailField label="Celular" value={est.celular} />
              <DetailField label={T.direccion} value={est.direccion} />
              <DetailField label="Ciudad" value={est.ciudad} />
              <DetailField label="Barrio" value={est.barrio} />
              <DetailField label="Documento" value={est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : null} />
              <DetailField label="SISBEN" value={est.clasificacionSisben} />
              <DetailField label={T.tieneComputador} value={est.tieneComputador == null ? null : est.tieneComputador ? 'Si' : 'No'} />
              <DetailField label={T.tieneInternet} value={est.tieneInternet == null ? null : est.tieneInternet ? 'Si' : 'No'} />
              <DetailField label="Movilidad" value={est.disponibilidadMovilidad == null ? null : est.disponibilidadMovilidad ? 'Disponible' : T.noDisponible} />
              <DetailField label={T.fechaDeNacimiento} value={null} />
              <DetailField label={T.genero} value={null} />
              <DetailField label="Nacionalidad" value={est.nacionalidad} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Académico ──────────────────────────────────────────────────────── */}
      {tab === 'academico' && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">{T.informacionAcademica}</CardTitle>
            <CardDescription>{T.formacionBaseY}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              <DetailField label="Nivel educativo" value={est.nivelEducativo} />
              <DetailField label={T.titulo} value={est.titulo} />
              <DetailField label={T.institucionEducativa} value={est.institucionEducativa} />
              <DetailField label={T.programaAcademico} value={est.programaAcademico} />
              <DetailField label={T.areaDeFormacionX} value={est.areaFormacion} />
              <DetailField label={T.estadoDeFormacion} value={est.estadoFormacion} />
              <DetailField label={T.nivelDeInglesX} value={est.nivelIngles} />
              <DetailField label="Prueba escrita" value={est.resultadoPruebaEscrita} />
              <DetailField label="Prueba oral" value={est.resultadoPruebaOral} />
              <DetailField label="Idiomas" value={est.idiomas} />
              <DetailField label="Competencias" value={est.competencias} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Formación ──────────────────────────────────────────────────────── */}
      {tab === 'formacion' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{T.agregarFormacion}</CardTitle>
              <CardDescription>{T.formacionAdicionalDel}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCrearFormacion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
                  <select id="form-tipo" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={nuevaFormacion.tipo} onChange={(e) => setNuevaFormacion((p) => ({ ...p, tipo: e.target.value }))} disabled={guardandoFormacion}>
                    {tiposFormacion.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-inst" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.institucion}</label>
                  <Input id="form-inst" value={nuevaFormacion.institucion} onChange={(e) => setNuevaFormacion((p) => ({ ...p, institucion: e.target.value }))} placeholder="SENA, Universidad…" disabled={guardandoFormacion} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-prog" className="text-[11px] uppercase tracking-wider text-muted-foreground">Programa *</label>
                  <Input id="form-prog" value={nuevaFormacion.programa} onChange={(e) => setNuevaFormacion((p) => ({ ...p, programa: e.target.value }))} placeholder={T.nombreDelPrograma} disabled={guardandoFormacion} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-fi" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha inicio</label>
                  <Input id="form-fi" type="date" value={nuevaFormacion.fechaInicio ?? ''} onChange={(e) => setNuevaFormacion((p) => ({ ...p, fechaInicio: e.target.value }))} disabled={guardandoFormacion} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-ff" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha fin</label>
                  <Input id="form-ff" type="date" value={nuevaFormacion.fechaFin ?? ''} onChange={(e) => setNuevaFormacion((p) => ({ ...p, fechaFin: e.target.value }))} disabled={guardandoFormacion} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-estado" className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado</label>
                  <select id="form-estado" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={nuevaFormacion.estado ?? 'EN_CURSO'} onChange={(e) => setNuevaFormacion((p) => ({ ...p, estado: e.target.value }))} disabled={guardandoFormacion}>
                    <option value="EN_CURSO">En curso</option>
                    <option value="FINALIZADA">Finalizada</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={guardandoFormacion}>
                    {guardandoFormacion ? <><CircleNotch className="size-3.5 animate-spin" /> Guardando…</> : <><Plus className="size-3.5" /> {T.agregarFormacion}</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {loadingForm ? <SeccionCargando texto="Cargando formaciones…" /> : formaciones.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.sinFormacionesRegistradas}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border-border shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{C.institucion}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Programa</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Fechas</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {formaciones.map((fm) => (
                      <tr key={fm.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{fm.tipo}</Badge></td>
                        <td className="px-4 py-3 text-foreground">{fm.institucion}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fm.programa}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{fechaCorta(fm.fechaInicio, locale === 'en')} — {fechaCorta(fm.fechaFin, locale === 'en')}</td>
                        <td className="px-4 py-3">
                          <EstadoDot
                            label={fm.estado === 'FINALIZADA' ? 'Finalizada' : 'En curso'}
                            dot={fm.estado === 'FINALIZADA' ? 'bg-navy-800' : 'bg-navy-400'}
                            text={fm.estado === 'FINALIZADA' ? 'text-navy-800' : 'text-navy-600'}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => handleEliminarFormacion(fm.id)} aria-label={T.eliminarFormacion}
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Experiencia ────────────────────────────────────────────────────── */}
      {tab === 'experiencia' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{T.agregarExperiencia}</CardTitle>
              <CardDescription>{T.historialLaboralDel}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCrearExperiencia} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exp-empresa" className="text-[11px] uppercase tracking-wider text-muted-foreground">Empresa *</label>
                  <Input id="exp-empresa" value={nuevaExperiencia.empresa} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, empresa: e.target.value }))} placeholder={T.nombreDeLa} disabled={guardandoExperiencia} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exp-cargo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Cargo *</label>
                  <Input id="exp-cargo" value={nuevaExperiencia.cargo} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, cargo: e.target.value }))} placeholder={T.cargoDesempenado} disabled={guardandoExperiencia} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input type="checkbox" checked={!!nuevaExperiencia.actual} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, actual: e.target.checked }))} disabled={guardandoExperiencia} className="size-3.5 accent-primary rounded" />
                    Trabajo actual
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exp-fi" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha inicio</label>
                  <Input id="exp-fi" type="date" value={nuevaExperiencia.fechaInicio ?? ''} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, fechaInicio: e.target.value }))} disabled={guardandoExperiencia} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exp-ff" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha fin</label>
                  <Input id="exp-ff" type="date" value={nuevaExperiencia.fechaFin ?? ''} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, fechaFin: e.target.value }))} disabled={guardandoExperiencia || !!nuevaExperiencia.actual} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                  <label htmlFor="exp-func" className="text-[11px] uppercase tracking-wider text-muted-foreground">Funciones</label>
                  <Textarea id="exp-func" minRows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={nuevaExperiencia.funciones ?? ''} onChange={(e) => setNuevaExperiencia((p) => ({ ...p, funciones: e.target.value }))} placeholder={T.principalesFuncionesDesempenadas} disabled={guardandoExperiencia} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={guardandoExperiencia}>
                    {guardandoExperiencia ? <><CircleNotch className="size-3.5 animate-spin" /> Guardando…</> : <><Plus className="size-3.5" /> {T.agregarExperiencia}</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {loadingExp ? <SeccionCargando texto="Cargando experiencias…" /> : experiencias.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <Briefcase className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.sinExperienciaLaboral}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {experiencias.map((ex) => (
                <Card key={ex.id} className="rounded-lg border-border shadow-none">
                  <CardContent className="pt-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{ex.cargo}</span>
                        {ex.actual && <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 text-[10px] py-0 px-1.5">Actual</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ex.empresa} · <span className="tabular-nums">{fechaCorta(ex.fechaInicio, locale === 'en')} — {ex.actual ? 'Presente' : fechaCorta(ex.fechaFin, locale === 'en')}</span></p>
                      {ex.funciones && <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">{ex.funciones}</p>}
                    </div>
                    <button type="button" onClick={() => handleEliminarExperiencia(ex.id)} aria-label={T.eliminarExperiencia}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive shrink-0">
                      <Trash className="size-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hoja de vida ───────────────────────────────────────────────────── */}
      {tab === 'hv' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{T.versionesGeneradasDe}</p>
            <Button size="sm" onClick={() => handleGenerarHv()} disabled={generandoHv}>
              {generandoHv ? <><CircleNotch className="size-3.5 animate-spin" /> Generando…</> : <><Plus className="size-3.5" /> {T.generarNuevaVersion}</>}
            </Button>
          </div>

          {loadingHv ? <SeccionCargando texto={T.cargandoHojasDe} /> : hvs.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <ReadCvLogo className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.aunNoSe}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border-border shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.version}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Plantilla</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.generadaPor}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {hvs.map((hv) => (
                      <tr key={hv.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium tabular-nums text-foreground">v{hv.numeroVersion}</span>
                          {hv.actual && <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 text-[10px] py-0 px-1.5">Vigente</Badge>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{hv.plantillaNombre ?? 'Predeterminada'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{hv.generadaPor ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{fechaCorta(hv.createdAt, locale === 'en')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => hvApi.descargarPdf(hv.id, `HV-v${hv.numeroVersion}.pdf`).catch((err) => flash('error', errorDe(err, T.errorAlDescargar)))}
                              aria-label={`Descargar versión ${hv.numeroVersion}`} title="Descargar PDF"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                              <DownloadSimple className="size-4" />
                            </button>
                            {!hv.actual && (
                              <button type="button" onClick={() => handleMarcarActual(hv.id)} aria-label={T.marcarComoVigente} title={T.marcarComoVigente}
                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                <Star className="size-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => void handleEliminarHv(hv)} aria-label={`Eliminar versión ${hv.numeroVersion}`} title={C.eliminar}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                              <Trash className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Documentos ─────────────────────────────────────────────────────── */}
      {tab === 'documentos' && (
        <div className="flex flex-col gap-4">
          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Subir documento</CardTitle>
              <CardDescription>{T.certificadosActasY}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubirDocumento} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label htmlFor="doc-file" className="text-[11px] uppercase tracking-wider text-muted-foreground">Archivo</label>
                  <input ref={docRef} id="doc-file" type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    className="h-10 w-full rounded-xl border border-input bg-card/90 px-3 py-1.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium" disabled={subiendoDoc} />
                </div>
                <div className="flex flex-col gap-1.5 sm:w-52">
                  <label htmlFor="doc-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
                  <select id="doc-tipo" className="h-10 rounded-xl border border-input bg-card/90 px-3 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15" value={docTipo} onChange={(e) => setDocTipo(e.target.value)} disabled={subiendoDoc}>
                    <option value="">{T.sinClasificar}</option>
                    {tiposDoc.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Button type="submit" size="sm" disabled={subiendoDoc || !docFile}>
                  {subiendoDoc ? <><CircleNotch className="size-3.5 animate-spin" /> Subiendo…</> : <><UploadSimple className="size-3.5" /> Subir</>}
                </Button>
                </div>
                {docFile && <FilePreview archivo={docFile} nombre={docFile.name} contentType={docFile.type} />}
              </form>
            </CardContent>
          </Card>

          {loadingDocs ? <SeccionCargando texto="Cargando documentos…" /> : documentos.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <FolderOpen className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.sinDocumentosAdjuntos}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border-border shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">{T.tamano}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documentos.map((doc) => (
                      <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{doc.nombre}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{doc.tipo}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{(doc.tamano / 1024).toFixed(1)} KB</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{fechaCorta(doc.createdAt, locale === 'en')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => setDocumentoPreview(doc)} aria-label={`Previsualizar ${doc.nombre}`} title="Vista previa"
                              className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                              <Eye className="size-4" />
                            </button>
                            <button type="button" onClick={() => documentosApi.descargar(doc.id, doc.nombre).catch((err) => flash('error', errorDe(err, T.errorAlDescargarX)))}
                              aria-label={`Descargar ${doc.nombre}`} title="Descargar"
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                              <DownloadSimple className="size-4" />
                            </button>
                            <button type="button" onClick={() => handleEliminarDocumento(doc.id)} aria-label={`Eliminar ${doc.nombre}`} title={C.eliminar}
                              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                              <Trash className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {documentoPreview && <FilePreviewSheet
            open={Boolean(documentoPreview)}
            onOpenChange={(open) => { if (!open) setDocumentoPreview(null) }}
            endpoint={`/api/v1/documentos/${documentoPreview.id}/descargar`}
            nombre={documentoPreview.nombre}
            contentType={documentoPreview.contentType}
            onDownload={() => documentosApi.descargar(documentoPreview.id, documentoPreview.nombre).catch((err) => flash('error', errorDe(err, T.errorAlDescargarX)))}
          />}
        </div>
      )}

      {/* ── Plataformas de acceso ─────────────────────────────────────────── */}
      {tab === 'plataformas' && (
        <Card className="rounded-lg border-primary/20 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base"><LinkSimple className="me-2 inline size-4 text-primary" /> {T.plataformasDeAcceso}</CardTitle>
            <CardDescription>
              {T.plataformasExternasA}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loadingPlataformas ? <SeccionCargando texto="Cargando plataformas…" /> : (
              plataformasCat.length === 0 ? (
                <p className="text-sm text-muted-foreground">{T.noHayPlataformas}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {plataformasCat.map((p) => {
                    const ofrecida = plataformasPgm.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${ofrecida ? 'cursor-pointer hover:bg-muted/50' : 'opacity-60'}`}
                        title={p.url}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          disabled={loadingPlataformas || guardandoPlataformas || !ofrecida}
                          checked={plataformasEst.includes(p.id)}
                          onChange={() => togglePlataforma(p.id)}
                        />
                        {p.iconoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.iconoUrl} alt="" className="size-6 rounded object-contain" />
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">{p.nombre.charAt(0).toUpperCase()}</span>
                        )}
                        <span className="font-medium">{p.nombre}</span>
                        {!ofrecida && <span className="ml-auto text-xs text-muted-foreground">{T.noOfrecida}</span>}
                      </label>
                    )
                  })}
                </div>
              )
            )}
            {!loadingPlataformas && plataformasCat.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={guardarPlataformas} disabled={guardandoPlataformas}>
                  {guardandoPlataformas ? <CircleNotch className="animate-spin" /> : <Check size={16} />} Guardar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Seguimientos ───────────────────────────────────────────────────── */}
      {tab === 'seguimientos' && (
        <div className="flex flex-col gap-4">
          {loadingEmpleabilidad ? <SeccionCargando texto={T.cargandoProcesoDe} /> : (
            <>
              <Card className="rounded-lg border-primary/20 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="size-4 text-primary" />{T.procesoDeEmpleabilidad}</CardTitle>
                      <CardDescription>{T.avanceCalculadoA}</CardDescription>
                    </div>
                    {pipeline && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{pipeline.etapa}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {pipeline ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avance</p><p className="mt-1 text-xl font-semibold text-foreground">{pipeline.porcentajeAvance}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pipeline.porcentajeAvance))}%` }} /></div></div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Postulaciones</p><p className="mt-1 text-xl font-semibold text-foreground">{pipeline.postulacionesEnviadas}</p><p className="mt-1 text-xs text-muted-foreground">{T.registradasEnEl}</p></div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.proximaAccionX}</p><p className="mt-1 text-sm font-medium leading-5 text-foreground">{pipeline.proximaAccion || T.sinAccionPendiente}</p></div>
                      </div>
                      {pipeline.pendientes.length > 0 && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><p className="text-xs font-semibold text-foreground">{T.pendientesParaAvanzar}</p><ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">{pipeline.pendientes.map((pendiente) => <li key={pendiente}>{pendiente}</li>)}</ul></div>}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">{T.noFuePosible}</p>}
                </CardContent>
              </Card>

              {estudiante && <Card className="rounded-lg border-border shadow-none">
                <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{T.preparacionParaLaX}</CardTitle><CardDescription>{T.hitosPerfilOcupacional}</CardDescription></div><div className="flex items-center gap-2"><Badge variant="outline">{estudiante.hitosCumplidos}/5 hitos · {estudiante.porcentajeEmpleabilidad}%</Badge>{!editandoPreparacion && <Button type="button" variant="outline" size="sm" onClick={abrirEdicionPreparacion}><PencilSimple className="size-3.5" /> Gestionar</Button>}</div></div></CardHeader>
                <CardContent className="space-y-4">
                  {editandoPreparacion ? <form onSubmit={guardarPreparacion} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
                      ['CV listo', 'cvListo'], [T.cvEnIngles, 'cvEnIngles'], ['LinkedIn creado', 'linkedinCreado'], ['LinkedIn optimizado', 'linkedinOptimizado'], ['Perfil ocupacional', 'perfilOcupacional'],
                    ].map(([nombre, campo]) => <label key={campo} className="space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{nombre}</span><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={(preparacion[campo as keyof PreparacionEstudianteRequest] as EstadoHito | undefined) ?? 'NO'} onChange={(event) => setPreparacion((prev) => ({ ...prev, [campo]: event.target.value as EstadoHito }))} disabled={guardandoPreparacion}><option value="NO">{C.pendiente}</option><option value="EN_PROCESO">En proceso</option><option value="SI">Completado</option></select></label>)}</div>
                    <div className="grid gap-3 lg:grid-cols-2"><label className="space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sector objetivo</span><Input value={preparacion.sectorObjetivo ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, sectorObjetivo: event.target.value }))} placeholder="Ej. BPO, tecnología, logística" disabled={guardandoPreparacion} /></label><label className="space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{T.enlaceDeLinkedin}</span><Input type="url" value={preparacion.linkedinUrl ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, linkedinUrl: event.target.value }))} placeholder="https://linkedin.com/in/..." disabled={guardandoPreparacion} /></label><label className="space-y-1.5 lg:col-span-2"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{T.carpetaDeDocumentos}</span><Input type="url" value={preparacion.carpetaUrl ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, carpetaUrl: event.target.value }))} placeholder={T.enlaceDeDrive} disabled={guardandoPreparacion} /></label></div>
                    <div className="grid gap-3 lg:grid-cols-2"><label className="space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Perfil profesional / ocupacional</span><Textarea minRows={5} className="w-full rounded-md border border-input bg-background p-2.5 text-sm" value={preparacion.perfilProfesional ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, perfilProfesional: event.target.value }))} placeholder="Resumen profesional validado en la tutoría" disabled={guardandoPreparacion} /></label><label className="space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{T.cargosQuePuede}</span><Textarea minRows={5} maxLength={255} className="w-full rounded-md border border-input bg-background p-2.5 text-sm" value={preparacion.cargoObjetivo ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, cargoObjetivo: event.target.value }))} placeholder={T.unCargoPor} disabled={guardandoPreparacion} /></label></div>
                    <label className="block space-y-1.5"><span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{T.competenciasTecnicasY}</span><Textarea minRows={3} className="w-full rounded-md border border-input bg-background p-2.5 text-sm" value={preparacion.competencias ?? ''} onChange={(event) => setPreparacion((prev) => ({ ...prev, competencias: event.target.value }))} placeholder={T.herramientasIdiomasY} disabled={guardandoPreparacion} /></label>
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditandoPreparacion(false)} disabled={guardandoPreparacion}>Cancelar</Button><Button type="submit" disabled={guardandoPreparacion}>{guardandoPreparacion && <CircleNotch className="size-3.5 animate-spin" />}{guardandoPreparacion ? 'Guardando…' : T.guardarPreparacion}</Button></div>
                  </form> : <>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{[
                      ['CV listo', estudiante.hitoCvListo], [T.cvEnIngles, estudiante.hitoCvIngles], ['LinkedIn creado', estudiante.hitoLinkedinCreado], ['LinkedIn optimizado', estudiante.hitoLinkedinOptimizado], ['Perfil ocupacional', estudiante.hitoPerfilOcupacional],
                    ].map(([nombre, estado]) => { const hito = estadoHito(estado, C); return <div key={nombre} className={`rounded-xl border p-3 ${hito.clase}`}><p className="text-[11px] font-medium uppercase tracking-wide">{nombre}</p><p className="mt-1 text-sm font-semibold">{hito.texto}</p></div> })}</div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-border/70 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{T.cargosQuePuede}</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{estudiante.cargoObjetivo || T.sinCargosSugeridos}</p></div>
                      <div className="rounded-xl border border-border/70 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{T.enfoqueDelPerfil}</p><p className="mt-2 text-sm text-foreground">{estudiante.sectorObjetivo || estudiante.sectorExperiencia || T.sectorPorDefinir}</p>{estudiante.competencias && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">{estudiante.competencias}</p>}</div>
                    </div>
                    {estudiante.pendientesPreparacion.length > 0 && <p className="text-xs text-muted-foreground">Pendientes: {estudiante.pendientesPreparacion.join(' · ')}</p>}
                  </>}
                </CardContent>
              </Card>}

              {(estudiante?.carpetaUrl || estudiante?.linkedinUrl) && (
                <Card className="rounded-lg border-border shadow-none">
                  <CardHeader className="pb-3"><CardTitle className="text-base">{T.enlacesDeTrabajo}</CardTitle><CardDescription>{T.accesosImportadosDel}</CardDescription></CardHeader>
                  <CardContent className="flex flex-wrap gap-3 text-sm">
                    {estudiante.carpetaUrl && <a href={estudiante.carpetaUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 font-medium text-primary hover:bg-primary/5">{T.abrirCarpetaDe}</a>}
                    {estudiante.linkedinUrl && <a href={estudiante.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 font-medium text-primary hover:bg-primary/5">{T.abrirPerfilDe}</a>}
                  </CardContent>
                </Card>
              )}

              {/* Pipeline de Postulaciones y Entrevistas Estilo Salesforce */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Briefcase className="size-4 text-primary" />
                      {locale === 'es' ? `Pipeline de Postulaciones y Entrevistas (${postulaciones.length})` : `Applications & Interviews Pipeline (${postulaciones.length})`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {locale === 'es'
                        ? 'Seguimiento de procesos de selección y citas de entrevista estilo CRM Salesforce con trazabilidad de autoría.'
                        : 'Tracking selection processes and interview appointments in Salesforce CRM style with author audit.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setModalPostularAbierto(true)}
                    className="gap-2 rounded-xl"
                  >
                    <Plus className="size-3.5" />
                    {locale === 'es' ? 'Postular a vacante / entrevista' : 'Apply to vacancy / interview'}
                  </Button>
                </div>

                <PipelinePostulacionesSalesforce
                  postulaciones={postulaciones}
                  onActualizado={() => {
                    void loadEmpleabilidad()
                    void loadSeguimientos()
                  }}
                />
              </div>

              <Card className="rounded-lg border-emerald-500/20 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vinculaciones laborales ({colocaciones.length})</CardTitle>
                  <CardDescription>{T.resultadosVerificadosPor}</CardDescription>
                </CardHeader>
                <CardContent>
                  {colocaciones.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{T.noHayUna}</p> : (
                    <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                      {colocaciones.map((colocacion) => (
                        <div key={colocacion.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{colocacion.empresaNombre}</p><Badge variant="outline" className="text-[10px]">{colocacion.tipoVinculacionEtiqueta}</Badge>{colocacion.gestionadaPorElPrograma && <span className="text-[10px] text-emerald-700">{T.gestionadaPorEl}</span>}</div>
                            <p className="mt-1 text-sm text-muted-foreground">{colocacion.cargo || T.cargoPendienteDe} · Inicio: {fechaCorta(colocacion.fechaInicio, locale === 'en')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{colocacion.canalConsecucionEtiqueta || T.canalSinRegistrar} · {colocacion.modalidad || T.modalidadSinRegistrar} · {colocacion.tipoContrato || T.contratoSinRegistrar}</p>
                            {colocacion.observaciones && <p className="mt-2 text-xs leading-5 text-muted-foreground">{colocacion.observaciones}</p>}
                          </div>
                          <div className="shrink-0 text-left sm:text-right"><p className="text-sm font-semibold text-foreground">{moneda(colocacion.salario, C.sinRegistrar, locale === 'en')}</p><p className="mt-1 text-xs text-muted-foreground">Checklist: {colocacion.checklistVerificados}/{colocacion.checklistTotal} · {colocacion.checklistResumen}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Card className="rounded-lg border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{T.registrarAccionDe}</CardTitle>
              <CardDescription>{T.contactosCompromisosY}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCrearSeguimiento} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="seg-fecha" className="text-[11px] uppercase tracking-wider text-muted-foreground">Fecha</label>
                  <Input id="seg-fecha" type="date" value={nuevoSeguimiento.fecha ?? ''} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, fecha: e.target.value }))} disabled={guardandoSeguimiento} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="seg-tipo" className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo</label>
                  <select id="seg-tipo" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={nuevoSeguimiento.tipo} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, tipo: e.target.value }))} disabled={guardandoSeguimiento}>
                    {tiposSeguimiento.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ').toLowerCase().replace(/^./, (letra) => letra.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="seg-resp" className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsable</label>
                  <Input id="seg-resp" value={nuevoSeguimiento.responsable ?? ''} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, responsable: e.target.value }))} placeholder={T.nombreDelResponsable} disabled={guardandoSeguimiento} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                  <label htmlFor="seg-obs" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.observacion}</label>
                  <Textarea id="seg-obs" minRows={2} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={nuevoSeguimiento.observacion ?? ''} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, observacion: e.target.value }))} placeholder={T.detalleDelContacto} disabled={guardandoSeguimiento} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="seg-prox" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.proximaAccionX}</label>
                  <Input id="seg-prox" value={nuevoSeguimiento.proximaAccion ?? ''} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, proximaAccion: e.target.value }))} placeholder={T.accionARealizar} disabled={guardandoSeguimiento} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="seg-fprox" className="text-[11px] uppercase tracking-wider text-muted-foreground">{T.fechaProxima}</label>
                  <Input id="seg-fprox" type="date" value={nuevoSeguimiento.fechaProxima ?? ''} onChange={(e) => setNuevoSeguimiento((p) => ({ ...p, fechaProxima: e.target.value }))} disabled={guardandoSeguimiento} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={guardandoSeguimiento}>
                    {guardandoSeguimiento ? <><CircleNotch className="size-3.5 animate-spin" /> Guardando…</> : <><Plus className="size-3.5" /> {T.registrarSeguimiento}</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {seguimientoEditando && <Card className="rounded-xl border-primary/25 shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base">{T.editarSeguimiento}</CardTitle><CardDescription>{T.actualizaElDetalle}</CardDescription></CardHeader><CardContent><form onSubmit={guardarSeguimientoEdit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="space-y-1"><span className="text-xs font-medium">Fecha</span><Input type="date" value={formSeguimientoEdit.fecha ?? ''} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, fecha: e.target.value })} /></label><label className="space-y-1"><span className="text-xs font-medium">Tipo</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={formSeguimientoEdit.tipo} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, tipo: e.target.value })}>{tiposSeguimiento.map((tipo) => <option key={tipo} value={tipo}>{tipo.replaceAll('_', ' ')}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-medium">Responsable</span><Input value={formSeguimientoEdit.responsable ?? ''} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, responsable: e.target.value })} /></label><label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium">{T.proximaAccionX}</span><Input value={formSeguimientoEdit.proximaAccion ?? ''} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, proximaAccion: e.target.value })} /></label><label className="space-y-1"><span className="text-xs font-medium">{T.fechaProxima}</span><Input type="date" value={formSeguimientoEdit.fechaProxima ?? ''} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, fechaProxima: e.target.value })} /></label><label className="space-y-1 lg:col-span-3"><span className="text-xs font-medium">{T.observacion}</span><Textarea minRows={3} className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" value={formSeguimientoEdit.observacion ?? ''} onChange={(e) => setFormSeguimientoEdit({ ...formSeguimientoEdit, observacion: e.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setSeguimientoEditando(null)} disabled={guardandoSeguimientoEdit}>Cancelar</Button><Button type="submit" disabled={guardandoSeguimientoEdit}>{guardandoSeguimientoEdit ? <CircleNotch className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}Guardar seguimiento</Button></div></form></CardContent></Card>}

          {loadingSeg ? <SeccionCargando texto="Cargando seguimientos…" /> : seguimientos.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <ClipboardText className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.sinSeguimientosRegistrados}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {seguimientos.map((seg) => (
                <Card key={seg.id} className="rounded-lg border-border shadow-none">
                  <CardContent className="pt-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{seg.tipo}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">{fechaCorta(seg.fecha, locale === 'en')}</span>
                        {seg.responsable && <span className="text-xs text-muted-foreground">· {seg.responsable}</span>}
                      </div>
                      {seg.observacion && <p className="text-sm text-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">{seg.observacion}</p>}
                      {seg.proximaAccion && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          <span className="text-[11px] uppercase tracking-wider">{T.proximaAccion}</span> {seg.proximaAccion}
                          {seg.fechaProxima && <span className="tabular-nums"> ({fechaCorta(seg.fechaProxima, locale === 'en')})</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={seg.estado}
                        onChange={(e) => handleEstadoSeguimiento(seg, e.target.value)}
                        aria-label={T.estadoDelSeguimiento}
                      >
                        <option value="PENDIENTE">{C.pendiente}</option>
                        <option value="COMPLETADA">Completada</option>
                      </select>
                      <button type="button" onClick={() => abrirEdicionSeguimiento(seg)} aria-label={T.editarSeguimiento}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                        <PencilSimple className="size-4" />
                      </button>
                      <button type="button" onClick={() => handleEliminarSeguimiento(seg.id)} aria-label={T.eliminarSeguimiento}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Historial ──────────────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="flex flex-col gap-4">
          {loadingHist ? <SeccionCargando texto="Cargando historial…" /> : historial.length === 0 ? (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <ClockCounterClockwise className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{T.sinRegistrosDe}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="pt-6">
                <ol className="relative border-l border-border ml-2 flex flex-col gap-5">
                  {historial.map((h) => (
                    <li key={h.id} className="ml-4">
                      <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-navy-400 border-2 border-background" aria-hidden="true" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{h.accion}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">{fechaCorta(h.fecha, locale === 'en')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{h.usuario}</span> · {h.modulo} · {h.entidad}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {estudiante && (
        <ModalPostularEstudiante
          open={modalPostularAbierto}
          onOpenChange={setModalPostularAbierto}
          estudianteId={id}
          estudianteNombre={`${estudiante.nombre} ${estudiante.apellido}`}
          onGuardado={() => {
            void loadEmpleabilidad()
            void loadSeguimientos()
            flash('ok', locale === 'es' ? 'Postulación registrada con éxito' : 'Application registered successfully')
          }}
        />
      )}
      {dialogo}
    </div>
  )
}
