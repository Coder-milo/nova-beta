'use client'

import { Briefcase, CheckCircle2 as CheckCircle, ChevronLeft as CaretLeft, ChevronRight as CaretRight, CircleAlert as WarningCircle, DollarSign as CurrencyDollar, ExternalLink as ArrowSquareOut, Filter as Funnel, GraduationCap, LoaderCircle as CircleNotch, Pencil as PencilSimple, Plus, RefreshCw as ArrowsClockwise, RotateCcw as ArrowCounterClockwise, Search as MagnifyingGlass, Trash2 as Trash, Trophy, User, UserCheck, X } from 'lucide-react'
/**
 * Página de Estudiantes (CRUD Completo).
 *
 * Consume:
 *   GET  /api/v1/programas                          → lista programas para el selector
 *   GET  /api/v1/estudiantes?programaId=&page=&size= → lista paginada
 *   GET  /api/v1/estudiantes/{id}                   → detalle (usado al refrescar)
 *   POST /api/v1/estudiantes                         → crear
 *   PUT  /api/v1/estudiantes/{id}                   → editar
 *   DEL  /api/v1/estudiantes/{id}                   → soft-delete
 *   GET  /api/v1/matches?estudianteId=              → matches de empleo
 */

import { useState, useEffect, useCallback, useTransition } from 'react'
import Link from '@/compat/next-link'
import { useSearchParams } from '@/compat/next-navigation'
import { PageSpinner } from '@/components/ui/page-spinner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VistasGuardadas } from '@/components/admin/vistas-guardadas'
import { descargarCsv } from '@/lib/csv'
import { Badge } from '@/components/ui/badge'
import { usePreferences } from '@/lib/preferences'
import { useAuth } from '@/lib/auth'
import { textosAdmin, type TextosAdmin } from '@/lib/textos-admin'
import { EstadoDot } from '@/components/ui/estado-dot'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { estudiantesApi, programasApi, matchesApi, ApiCallError, mensajeDeError } from '@/lib/api'
import { normalizarParaBuscar, normalizarDocumento } from '@/lib/texto'
import { useAvisos } from '@/components/ui/avisos'
import { useConfirmar } from '@/components/ui/confirmar'
import type { HitoPreparacion, EstadoHito } from '@/lib/api'
import type {
  EstudianteResponse,
  ProgramaResponse,
  EstudianteRequest,
  MatchResponse,
  Page,
  EstadoAcademico,
  EstadoEmpleabilidad,
  ResponsablePosible,
} from '@/lib/types'

/** El último programa que abrió esta persona, para no aterrizar en uno vacío. */
const PROGRAMA_RECORDADO = 'nova_programa_estudiantes'
import { Textarea } from '@/components/ui/textarea'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const estadoFallback = { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' }

/** El color del estado no depende del idioma; la etiqueta si, y sale aparte. */
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

function estadoAcademico(T: ReturnType<typeof textos>, C: TextosAdmin, codigo: string) {
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

const emptyForm: EstudianteRequest = {
  nombre: '', apellido: '', email: '', telefono: '', celular: '',
  ciudad: '', barrio: '', tipoDocumento: 'CC', numeroDocumento: '',
  fechaNacimiento: '', genero: '', nacionalidad: '', nivelEducativo: '',
  titulo: '', aniosExperiencia: 0, sectorExperiencia: '', ultimoCargo: '',
  perfilProfesional: '', sectorObjetivo: '', cargoObjetivo: '',
  disponibilidadMovilidad: false, clasificacionSisben: '', situacionLaboral: '',
  ingresoMensual: '', responsableEconomico: false, haTrabajado: false,
  tieneComputador: false, tieneInternet: false, motivacion: '',
  interesMigratorio: false, resultadoPruebaEscrita: '', resultadoPruebaOral: '',
  institucionEducativa: '', programaAcademico: '', areaFormacion: '',
  estadoFormacion: '', disponibilidadLaboral: '', estadoBusqueda: '',
  postulacionesEnviadas: 0, empresasContactadas: 0,
  estadoAcademico: 'ACTIVO', estadoEmpleabilidad: 'SIN_INFO', programaId: '',
}

function studentToForm(s: EstudianteResponse): EstudianteRequest {
  return {
    nombre: s.nombre, apellido: s.apellido, email: s.email,
    telefono: s.telefono ?? '', celular: s.celular ?? '',
    ciudad: s.ciudad ?? '', barrio: s.barrio ?? '',
    tipoDocumento: s.tipoDocumento ?? 'CC', numeroDocumento: s.numeroDocumento ?? '',
    fechaNacimiento: '', genero: '', nacionalidad: s.nacionalidad ?? '',
    nivelEducativo: s.nivelEducativo ?? '', titulo: s.titulo ?? '',
    aniosExperiencia: s.aniosExperiencia ?? 0, sectorExperiencia: s.sectorExperiencia ?? '',
    ultimoCargo: s.ultimoCargo ?? '', perfilProfesional: s.perfilProfesional ?? '',
    sectorObjetivo: s.sectorObjetivo ?? '', cargoObjetivo: s.cargoObjetivo ?? '',
    disponibilidadMovilidad: s.disponibilidadMovilidad ?? false,
    clasificacionSisben: s.clasificacionSisben ?? '', situacionLaboral: s.situacionLaboral ?? '',
    ingresoMensual: s.ingresoMensual ?? '', responsableEconomico: s.responsableEconomico ?? false,
    haTrabajado: s.haTrabajado ?? false, tieneComputador: s.tieneComputador ?? false,
    tieneInternet: s.tieneInternet ?? false, motivacion: s.motivacion ?? '',
    interesMigratorio: s.interesMigratorio ?? false,
    resultadoPruebaEscrita: s.resultadoPruebaEscrita ?? '',
    resultadoPruebaOral: s.resultadoPruebaOral ?? '',
    institucionEducativa: s.institucionEducativa ?? '',
    programaAcademico: s.programaAcademico ?? '', areaFormacion: s.areaFormacion ?? '',
    estadoFormacion: s.estadoFormacion ?? '', disponibilidadLaboral: s.disponibilidadLaboral ?? '',
    estadoBusqueda: s.estadoBusqueda ?? '',
    postulacionesEnviadas: s.postulacionesEnviadas ?? 0,
    empresasContactadas: s.empresasContactadas ?? 0,
    estadoAcademico: s.estadoAcademico ?? 'ACTIVO',
    estadoEmpleabilidad: s.estadoEmpleabilidad ?? 'SIN_INFO',
    programaId: s.programaId,
  }
}

// Componente auxiliar para campos de detalle
function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  return (
    <div>
      <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-medium text-foreground text-xs">{value ?? T.noRegistrado}</span>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        buscarNombreEmail: 'Search name, email, ID…',
        marcarHito: 'Mark a milestone',
        marcar: 'Mark',
        hitoMarcado: (n: number) => `Milestone marked on ${n} participant(s).`,
        asignarResponsable: 'Assign owner',
        asignar: 'Assign',
        quitar: 'Unassign',
        sinResponsable: '— Unassign —',
        responsableAsignado: (n: number) => `Owner updated on ${n} participant(s).`,
        seAsignaraA: (n: number, quien: string) => `${n} participant(s) will be assigned to ${quien}.`,
        seQuitaraResponsable: (n: number) => `${n} participant(s) will be left with no owner. Use this to free up someone's caseload.`,
        seMarcaraHito: (n: number, hito: string, valor: string) => `“${hito}” will be set to “${valor}” on ${n} selected participant(s).`,
        hitos: {
          CV_LISTO: 'Résumé ready',
          CV_INGLES: 'Résumé in English',
          LINKEDIN_CREADO: 'LinkedIn created',
          LINKEDIN_OPTIMIZADO: 'LinkedIn improved',
          PERFIL_OCUPACIONAL: 'Occupational profile',
        } as Record<HitoPreparacion, string>,
        valoresHito: { NO: 'No', EN_PROCESO: 'In progress', SI: 'Yes' } as Record<EstadoHito, string>,
        restaurarSeleccionados: 'Restore selected',
        buscarEnEstaPagina: 'Filter what is on this page…',
        exportarSeleccion: 'Export selection',
        seleccionados: (n: number) => `${n} student(s) selected`,
        restauradosParcialmente: (ok: number, mal: number) => `${ok} restored, ${mal} failed. The list shows how it actually ended up.`,
        soloEstaPagina: (p: number, total: number) => `This view has no search of its own: only page ${p} of ${total} is being filtered. Move through the pages to see the rest.`,
        cargandoEstudiantes: 'Loading students…',
        cargandoMatches: 'Loading matches…',
        noHayEstudiantes: 'No students match this search.',
        noHayEstudiantesX: 'The bin has no deleted students for this programme.',
        sinMatchesDe: 'No job matches recorded.',
        seleccionaUnPrograma: 'Choose a programme',
        seleccionaUnProgramaX: 'Choose a programme.',
        nuevoEstudiante: 'New student',
        editarEstudiante: 'Edit student',
        datosBasicos: 'Basic details',
        identificacionYContacto: 'Identification and contact',
        educacionYExperiencia: 'Education and experience',
        socioeconomicoYMetas: 'Socioeconomic and goals',
        metasYBusqueda: 'Goals and job search',
        experienciaLaboral: 'Work experience',
        camposConSon: 'Fields with * are required. Move between the tabs.',
        estudianteRegistradoExitosamente: 'Student registered.',
        estudianteActualizadoExitosamente: 'Student updated.',
        estudianteEliminadoPermanentemente: 'Student permanently deleted.',
        estudiantesEnviadosA: 'Students moved to the bin.',
        estudiantesRestauradosExitosamente: 'Students restored.',
        estudiantesEliminadosDefinitivamente: 'Students permanently deleted.',
        ocurrioUnError: 'Something went wrong deleting them.',
        ocurrioUnErrorX: 'Something went wrong restoring some students.',
        noSePudo: 'The student could not be deleted.',
        noSePudoX: 'The student could not be restored.',
        yaExisteUn: 'A student with that email already exists.',
        errorAlEjecutar: 'Matching could not be run.',
        errorAlRegistrar: 'The application could not be logged.',
        sinPermisosPara: 'No permission for this action.',
        datosInvalidos: 'Invalid data:', verificaLosCampos: 'check the fields.',
        elNombreEs: 'The first name is required.',
        elApellidoEs: 'The last name is required.',
        elEmailEs: 'The email is required.',
        confirmasLaEliminacion: 'Confirm deletion?',
        moverALa: 'Move to bin',
        eliminarDefinitivamente: 'Delete permanently',
        eliminarPermanentemente: 'Delete permanently',
        restaurarEstudiante: 'Restore student',
        restaurarEstudiantes: 'Restore students',
        verActivos: 'View active',
        verPerfilCompleto: 'View full profile',
        seleccionarTodosLos: 'Select every student on this page',
        estudiantesActivosA: 'Active students missing a mobile, email or ID',
        mostrandoEstudiantesCon: 'Showing students with incomplete data, across all projects',
        datosIncompletos: 'Incomplete data',
        losMios: 'Mine',
        sinAsignar: 'Unassigned',
        losQueLlevoYo: 'The participants assigned to me',
        losQueNoLleva: 'Nobody is following these up yet — this is the list to share out',
        filtrarPorEmpleabilidad: 'Filter by employability',
        filtrarPorEstado: 'Filter by academic status',
        todasEmpleabilidad: 'All (employability)',
        todosEstadoAcad: 'All (academic)',
        estadoAcademico: 'Academic status',
        estadoDeBusqueda: 'Job search status',
        estadoBusqueda: 'Search status',
        estadoFormacion: 'Training status',
        nivelEducativo: 'Education level',
        nivelIngles: 'English level',
        areaDeFormacion: 'Field of study',
        areaFormacion: 'Field of study',
        institucionEducativa: 'Educational institution',
        tituloObtenido: 'Qualification obtained',
        perfilProfesional: 'Professional summary',
        cargoObjetivo: 'Target role',
        sectorObjetivo: 'Target sector',
        sectorExperiencia: 'Experience sector',
        ultimoCargo: 'Last role',
        anosExperiencia: 'Years of experience',
        postulacionesEnviadas: 'Applications sent',
        empresasContactadas: 'Companies contacted',
        situacionLaboral: 'Employment situation',
        ingresoMensual: 'Monthly income',
        clasificacionSisben: 'SISBEN classification',
        responsableEconomicoDel: 'Household breadwinner',
        responsableEconomico: 'Breadwinner',
        haTrabajadoAntes: 'Has worked before',
        tieneComputador: 'Has a computer',
        tieneInternet: 'Has internet',
        interesMigratorio: 'Interested in migrating',
        disponibilidadDeMovilidad: 'Willing to relocate',
        disponibilidadLaboral: 'Availability',
        pruebaEscrita: 'Written test',
        pruebaOral: 'Oral test',
        tipoDocumento: 'ID type',
        nDocumento: 'ID number',
        telefonoFijo: 'Landline',
        nacionalidad: 'Nationality',
        motivacionDelEstudiante: "Student's motivation…",
        descripcionDelPerfil: 'Profile description…',
        buscandoEmpleo: 'Job hunting',
        noNotificado: 'Not notified',
        seleccionar: '— Choose —',
        verPapelera: 'View bin',
        faltaCelularCorreo: 'Missing mobile, email or ID number. This view does not filter by the selected project. Open the profile to complete the information.',
        eliminarSeleccionados: 'Delete selected',
        registrarElPrimero: 'Add the first one',
        elSistemaEvalua: 'The system scores vacancies on a schedule, based on the student profile.',
        estasAPunto: (nombre: string) => `You are about to delete ${nombre}. This deactivates the record (soft delete) and can be reversed in the database.`,
        errorDelServidor: (s: number) => `Server error (HTTP ${s}).`,
        matchingEjecutado: (n: number) => `Matching run. ${n} new matches were created.`,
        seRestauraran: (n: number) => `The ${n} selected students will be restored.`,
        seEliminaranPermanentemente: (n: number) => `The ${n} selected students will be permanently deleted. This is irreversible and removes all their associated records.`,
        seMoveranALaPapelera: (n: number) => `The ${n} selected students will be moved to the bin.`,
        seEliminaraPermanentemente: (nombre: string) => `${nombre} will be permanently deleted. This cannot be undone.`,
        verPerfilDe: (nombre: string) => `View ${nombre}'s profile`,
        matchesPendientesDe: (n: number) => `${n} match(es) pending notification`,
        aniosX: (n: number) => `${n} years`,
        noRegistrado: 'Not recorded',
        verTodos: 'View all',
        apellido: 'Last name *',
        apellidos: 'Last name',
        nombres: 'First name',
        programa: 'Programme *',
        email: 'Email *',
        genero: 'Gender',
        masculino: 'Male',
        femenino: 'Female',
        barrio: 'Neighbourhood',
        celular: 'Mobile',
        movilidad: 'Mobility',
        motivacion: 'Motivation',
        pruebas: 'Tests',
        personal: 'Personal',
        social: 'Social',
        academico: 'Academic',
        socioeconomico: 'Socioeconomic',
        empleabilidad: 'Employability',
        postulaciones: 'Applications',
        matches: 'Matches',
        educacion: 'Education',
        ubicacion: 'Location',
        institucion: 'Institution',
        titulo: 'Qualification',
        computador: 'Computer',
        internet: 'Internet',
        remoto: 'Remote',
        inmediata: 'Immediate',
        pendiente: 'Pending',
        postulado: 'Applied',
        pasaporte: 'Passport',
        colombiana: 'Colombian',
        otro: 'Other',
        actualizar: 'Update',
        registrar: 'Register',
        restaurar: 'Restore',
        activa: 'Active',
        ejCarlos: 'e.g. Carlos',
        ejRamirez: 'e.g. Ramírez',
        asesorBilingue: 'Bilingual advisor',
        asesorDeServicio: 'Service advisor',
        bpoTecnologia: 'BPO, Technology',
        tecnologia: 'Technology',
        desempleadoInformal: 'Unemployed, informal',
        graduadoCursando: 'Graduated, studying',
        profesionalTecnologo: 'Professional, technologist',
        ninguno1Smlv: 'None, 1 minimum wage',
        ingDeSistemas: 'Systems engineering',
        universidadNacional: 'National University',
        bogota: 'Barranquilla',
        teusaquillo: 'El Prado',
        documento: 'ID document',
      }
    : {
        buscarNombreEmail: 'Buscar nombre, email, documento…',
        marcarHito: 'Marcar un hito',
        marcar: 'Marcar',
        hitoMarcado: (n: number) => `Hito marcado en ${n} participante(s).`,
        asignarResponsable: 'Asignar responsable',
        asignar: 'Asignar',
        quitar: 'Quitar',
        sinResponsable: '— Quitar responsable —',
        responsableAsignado: (n: number) => `Responsable actualizado en ${n} participante(s).`,
        seAsignaraA: (n: number, quien: string) => `Se asignarán ${n} participante(s) a ${quien}.`,
        seQuitaraResponsable: (n: number) => `${n} participante(s) quedarán sin responsable. Es lo que se hace para liberar los casos de alguien que deja el programa.`,
        seMarcaraHito: (n: number, hito: string, valor: string) => `Se pondrá «${hito}» en «${valor}» a ${n} participante(s) seleccionado(s).`,
        hitos: {
          CV_LISTO: 'Hoja de vida lista',
          CV_INGLES: 'Hoja de vida en inglés',
          LINKEDIN_CREADO: 'LinkedIn creado',
          LINKEDIN_OPTIMIZADO: 'LinkedIn optimizado',
          PERFIL_OCUPACIONAL: 'Perfil ocupacional',
        } as Record<HitoPreparacion, string>,
        valoresHito: { NO: 'No', EN_PROCESO: 'En proceso', SI: 'Sí' } as Record<EstadoHito, string>,
        restaurarSeleccionados: 'Restaurar seleccionados',
        buscarEnEstaPagina: 'Filtrar lo que hay en esta página…',
        exportarSeleccion: 'Exportar selección',
        seleccionados: (n: number) => `${n} estudiante(s) seleccionado(s)`,
        restauradosParcialmente: (ok: number, mal: number) => `Se restauraron ${ok} y fallaron ${mal}. La lista muestra cómo quedó de verdad.`,
        soloEstaPagina: (p: number, total: number) => `Esta vista no tiene búsqueda propia: se está filtrando sólo la página ${p} de ${total}. Recorre las páginas para ver el resto.`,
        cargandoEstudiantes: 'Cargando estudiantes…',
        cargandoMatches: 'Cargando matches…',
        noHayEstudiantes: 'No hay estudiantes que coincidan con la búsqueda.',
        noHayEstudiantesX: 'No hay estudiantes eliminados en la papelera para este programa.',
        sinMatchesDe: 'Sin matches de empleo registrados.',
        seleccionaUnPrograma: 'Selecciona un programa',
        seleccionaUnProgramaX: 'Selecciona un programa.',
        nuevoEstudiante: 'Nuevo Estudiante',
        editarEstudiante: 'Editar Estudiante',
        datosBasicos: 'Datos Básicos',
        identificacionYContacto: 'Identificación y Contacto',
        educacionYExperiencia: 'Educación y Experiencia',
        socioeconomicoYMetas: 'Socioeconómico y Metas',
        metasYBusqueda: 'Metas y Búsqueda',
        experienciaLaboral: 'Experiencia Laboral',
        camposConSon: 'Campos con * son obligatorios. Navega entre las pestañas.',
        estudianteRegistradoExitosamente: 'Estudiante registrado exitosamente.',
        estudianteActualizadoExitosamente: 'Estudiante actualizado exitosamente.',
        estudianteEliminadoPermanentemente: 'Estudiante eliminado permanentemente.',
        estudiantesEnviadosA: 'Estudiantes enviados a la papelera.',
        estudiantesRestauradosExitosamente: 'Estudiantes restaurados exitosamente.',
        estudiantesEliminadosDefinitivamente: 'Estudiantes eliminados definitivamente.',
        ocurrioUnError: 'Ocurrió un error al realizar la eliminación masiva.',
        ocurrioUnErrorX: 'Ocurrió un error al restaurar algunos estudiantes.',
        noSePudo: 'No se pudo eliminar al estudiante.',
        noSePudoX: 'No se pudo restaurar el estudiante.',
        yaExisteUn: 'Ya existe un estudiante con ese correo electrónico.',
        errorAlEjecutar: 'Error al ejecutar el matching.',
        errorAlRegistrar: 'Error al registrar la postulación.',
        sinPermisosPara: 'Sin permisos para esta acción.',
        datosInvalidos: 'Datos inválidos:', verificaLosCampos: 'verifica los campos.',
        elNombreEs: 'El nombre es obligatorio.',
        elApellidoEs: 'El apellido es obligatorio.',
        elEmailEs: 'El email es obligatorio.',
        confirmasLaEliminacion: '¿Confirmas la eliminación?',
        moverALa: 'Mover a la papelera',
        eliminarDefinitivamente: 'Eliminar definitivamente',
        eliminarPermanentemente: 'Eliminar permanentemente',
        restaurarEstudiante: 'Restaurar estudiante',
        restaurarEstudiantes: 'Restaurar estudiantes',
        verActivos: 'Ver Activos',
        verPerfilCompleto: 'Ver perfil completo',
        seleccionarTodosLos: 'Seleccionar todos los estudiantes de esta página',
        estudiantesActivosA: 'Estudiantes activos a los que les falta celular, correo o documento',
        mostrandoEstudiantesCon: 'Mostrando estudiantes con datos incompletos, de todos los proyectos',
        datosIncompletos: 'Datos incompletos',
        losMios: 'Los míos',
        sinAsignar: 'Sin asignar',
        losQueLlevoYo: 'Los participantes que tengo asignados',
        losQueNoLleva: 'No los lleva nadie todavía — es la lista para repartir',
        filtrarPorEmpleabilidad: 'Filtrar por empleabilidad',
        filtrarPorEstado: 'Filtrar por estado académico',
        todasEmpleabilidad: 'Todas (empleabilidad)',
        todosEstadoAcad: 'Todos (estado acad.)',
        estadoAcademico: 'Estado académico',
        estadoDeBusqueda: 'Estado de búsqueda',
        estadoBusqueda: 'Estado búsqueda',
        estadoFormacion: 'Estado formación',
        nivelEducativo: 'Nivel educativo',
        nivelIngles: 'Nivel inglés',
        areaDeFormacion: 'Área de formación',
        areaFormacion: 'Área formación',
        institucionEducativa: 'Institución educativa',
        tituloObtenido: 'Título obtenido',
        perfilProfesional: 'Perfil profesional',
        cargoObjetivo: 'Cargo objetivo',
        sectorObjetivo: 'Sector objetivo',
        sectorExperiencia: 'Sector experiencia',
        ultimoCargo: 'Último cargo',
        anosExperiencia: 'Años experiencia',
        postulacionesEnviadas: 'Postulaciones enviadas',
        empresasContactadas: 'Empresas contactadas',
        situacionLaboral: 'Situación laboral',
        ingresoMensual: 'Ingreso mensual',
        clasificacionSisben: 'Clasificación SISBEN',
        responsableEconomicoDel: 'Responsable económico del hogar',
        responsableEconomico: 'Responsable económico',
        haTrabajadoAntes: 'Ha trabajado antes',
        tieneComputador: 'Tiene computador',
        tieneInternet: 'Tiene internet',
        interesMigratorio: 'Interés migratorio',
        disponibilidadDeMovilidad: 'Disponibilidad de movilidad',
        disponibilidadLaboral: 'Disponibilidad laboral',
        pruebaEscrita: 'Prueba escrita',
        pruebaOral: 'Prueba oral',
        tipoDocumento: 'Tipo documento',
        nDocumento: 'N° documento',
        telefonoFijo: 'Teléfono fijo',
        nacionalidad: 'Nacionalidad',
        motivacionDelEstudiante: 'Motivación del estudiante...',
        descripcionDelPerfil: 'Descripción del perfil...',
        buscandoEmpleo: 'Buscando empleo',
        noNotificado: 'No notificado',
        seleccionar: '— Seleccionar —',
        verPapelera: 'Ver Papelera',
        faltaCelularCorreo: 'Falta celular, correo o número de documento. Esta vista no filtra por el proyecto seleccionado. Abre el perfil para completar la información.',
        eliminarSeleccionados: 'Eliminar Seleccionados',
        registrarElPrimero: 'Registrar el primero',
        elSistemaEvalua: 'El sistema evalúa vacantes de forma programada según el perfil del estudiante.',
        estasAPunto: (nombre: string) => `Estás a punto de eliminar a ${nombre}. Esta acción desactiva el registro (soft-delete) y es reversible en la base de datos.`,
        errorDelServidor: (s: number) => `Error del servidor (HTTP ${s}).`,
        matchingEjecutado: (n: number) => `Matching ejecutado exitosamente. Se crearon ${n} matches nuevos.`,
        seRestauraran: (n: number) => `Se restaurarán los ${n} estudiantes seleccionados.`,
        seEliminaranPermanentemente: (n: number) => `Se eliminarán permanentemente los ${n} estudiantes seleccionados. Es irreversible y removerá todos sus registros asociados.`,
        seMoveranALaPapelera: (n: number) => `Se moverán a la papelera los ${n} estudiantes seleccionados.`,
        seEliminaraPermanentemente: (nombre: string) => `Se eliminará permanentemente a ${nombre}. Esta acción es irreversible.`,
        verPerfilDe: (nombre: string) => `Ver perfil de ${nombre}`,
        matchesPendientesDe: (n: number) => `${n} match(es) pendiente(s) de notificar`,
        aniosX: (n: number) => `${n} años`,
        noRegistrado: 'No registrado',
        verTodos: 'Ver todos',
        apellido: 'Apellido *',
        apellidos: 'Apellidos',
        nombres: 'Nombres',
        programa: 'Programa *',
        email: 'Email *',
        genero: 'Género',
        masculino: 'Masculino',
        femenino: 'Femenino',
        barrio: 'Barrio',
        celular: 'Celular',
        movilidad: 'Movilidad',
        motivacion: 'Motivación',
        pruebas: 'Pruebas',
        personal: 'Personal',
        social: 'Social',
        academico: 'Académico',
        socioeconomico: 'Socioeconómico',
        empleabilidad: 'Empleabilidad',
        postulaciones: 'Postulaciones',
        matches: 'Matches',
        educacion: 'Educación',
        ubicacion: 'Ubicación',
        institucion: 'Institución',
        titulo: 'Título',
        computador: 'Computador',
        internet: 'Internet',
        remoto: 'Remoto',
        inmediata: 'Inmediata',
        pendiente: 'Pendiente',
        postulado: 'Postulado',
        pasaporte: 'Pasaporte',
        colombiana: 'Colombiana',
        otro: 'Otro',
        actualizar: 'Actualizar',
        registrar: 'Registrar',
        restaurar: 'Restaurar',
        activa: 'Activa',
        ejCarlos: 'Ej: Carlos',
        ejRamirez: 'Ej: Ramírez',
        asesorBilingue: 'Asesor Bilingüe',
        asesorDeServicio: 'Asesor de Servicio',
        bpoTecnologia: 'BPO, Tecnología',
        tecnologia: 'Tecnología',
        desempleadoInformal: 'Desempleado, Informal',
        graduadoCursando: 'Graduado, Cursando',
        profesionalTecnologo: 'Profesional, Tecnólogo',
        ninguno1Smlv: 'Ninguno, 1 SMLV',
        ingDeSistemas: 'Ing. de Sistemas',
        universidadNacional: 'Universidad Nacional',
        bogota: 'Bogotá',
        teusaquillo: 'Teusaquillo',
        documento: 'Documento',
      }
}

export default function EstudiantesPage() {
  const { locale } = usePreferences()
  const { user } = useAuth()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  const { confirmar, dialogo } = useConfirmar()
  const { mostrarExito, mostrarError, avisos } = useAvisos()
  const [programas, setProgramas]     = useState<ProgramaResponse[]>([])
  const [selectedPgm, setSelectedPgm] = useState('')
  const [page, setPage]               = useState<Page<EstudianteResponse> | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [verPapelera, setVerPapelera] = useState(false)
  /**
   * Qué subconjunto se está mirando.
   *
   * `mios` son los que lleva quien tiene la sesión abierta; `sinAsignar`, los
   * que no lleva nadie. Los dos salen del mismo endpoint —el `responsableId`
   * ausente significa «sin asignar»—, y por eso son un solo estado y no dos
   * casillas que podrían quedar marcadas a la vez pidiendo cosas contrarias.
   */
  const [vista, setVista] = useState<'todos' | 'mios' | 'sinAsignar'>('todos')
  const [incompleteOnly, setIncompleteOnly] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('incompletos') === '1'
  )

  /**
   * La alerta del panel enlaza a `/estudiantes?incompletos=1`.
   *
   * Leerlo solo al montar bastaba viniendo de otra pantalla, pero no si ya se
   * estaba en esta: la ruta no cambia, el componente no se vuelve a montar y
   * pulsar la alerta no hacia nada. Se escucha el parametro, que si cambia.
   */
  const parametros = useSearchParams()
  const pidenIncompletos = parametros.get('incompletos') === '1'
  useEffect(() => {
    if (pidenIncompletos) {
      setIncompleteOnly(true)
      setVerPapelera(false)
      setCurrentPage(0)
    }
  }, [pidenIncompletos])


  // Filtros
  const [searchQuery, setSearchQuery]             = useState('')
  /**
   * Lo que se le pide al servidor, con retardo respecto a lo que se teclea.
   *
   * Sin esto cada pulsación dispararía una consulta —y con ella un `setPage`
   * fuera de orden, porque las respuestas no vuelven necesariamente en el
   * orden en que salieron—.
   */
  const [busquedaAplicada, setBusquedaAplicada]   = useState('')
  const [academicFilter, setAcademicFilter]       = useState('ALL')
  const [employabilityFilter, setEmployabilityFilter] = useState('ALL')

  useEffect(() => {
    const id = window.setTimeout(() => setBusquedaAplicada(searchQuery.trim()), 300)
    return () => window.clearTimeout(id)
  }, [searchQuery])

  /**
   * Llegar desde el mapa del panel a la gente de un municipio.
   *
   * Se siembra la búsqueda en vez de un filtro propio de ciudad: el término
   * queda escrito en la caja, así que quien llega ve **por qué** está viendo
   * esas 26 personas y lo puede borrar. Un filtro invisible aplicado por la URL
   * deja la lista recortada sin decir quién la recortó.
   */
  const ciudadPedida = parametros.get('ciudad')
  useEffect(() => {
    if (ciudadPedida) {
      setSearchQuery(ciudadPedida)
      setVerPapelera(false)
      setIncompleteOnly(false)
      setCurrentPage(0)
    }
  }, [ciudadPedida])

  /**
   * La papelera y el listado de incompletos son vistas aparte y no tienen
   * búsqueda en el servidor, así que ahí se sigue filtrando lo ya cargado.
   */
  const filtradoEnElCliente = verPapelera || incompleteOnly
  const hayFiltrosDeServidor = !filtradoEnElCliente
    && (busquedaAplicada !== '' || academicFilter !== 'ALL' || employabilityFilter !== 'ALL')

  // Formulario
  const [showForm, setShowForm]         = useState(false)
  const [formMode, setFormMode]         = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [form, setForm]                 = useState<EstudianteRequest>(emptyForm)
  const [formError, setFormError]       = useState<string | null>(null)
  const [formSuccess, setFormSuccess]   = useState<string | null>(null)
  const [formTab, setFormTab]           = useState<'basic' | 'edu' | 'socio'>('basic')
  const [isPending, startTransition]    = useTransition()

  // Drawer
  const [selected, setSelected]           = useState<EstudianteResponse | null>(null)
  const [matches, setMatches]             = useState<MatchResponse[]>([])
  const [matchesPendientes, setMatchesPendientes] = useState(0)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [detailTab, setDetailTab]         = useState<'personal' | 'academic' | 'socio' | 'matches'>('personal')

  // Eliminación
  const [deleting, setDeleting]       = useState<EstudianteResponse | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [executingMatching, setExecutingMatching] = useState(false)

  // Selección Masiva
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy]       = useState(false)
  const [hitoMasivo, setHitoMasivo]   = useState<HitoPreparacion>('CV_LISTO')
  const [responsables, setResponsables] = useState<ResponsablePosible[]>([])
  const [responsableMasivo, setResponsableMasivo] = useState<string>('')

  // ── Cargar programas ──────────────────────────────────────────────────────
  /**
   * Qué programa se abre por defecto.
   *
   * Era `list[0]`, el primero que devolviera el servidor. Con dos programas
   * —uno con los 108 participantes y otro vacío— eso significaba que lo primero
   * que veía un coordinador al entrar era **«no hay estudiantes»**, en la
   * pantalla donde está todo su trabajo.
   *
   * Manda lo último que eligió esa persona; si no hay memoria, el que tiene
   * gente. Un programa vacío es un destino válido —se acaba de crear— pero
   * nunca es un buen sitio donde aterrizar.
   */
  useEffect(() => {
    programasApi.listar().then((list) => {
      setProgramas(list)
      if (list.length === 0) return
      const recordado = localStorage.getItem(PROGRAMA_RECORDADO)
      const sigueExistiendo = recordado && list.some((p) => p.id === recordado)
      const conGente = list.find((p) => p.totalEstudiantes > 0)
      setSelectedPgm(sigueExistiendo ? recordado : (conGente ?? list[0]).id)
    }).catch(() => setError(C.errorProgramas))
  }, [])

  // Se recuerda al cambiar, no al cargar: guardar el valor que acabamos de
  // elegir automáticamente lo convertiría en «elegido por la persona».
  const elegirPrograma = (id: string) => {
    setSelectedPgm(id)
    localStorage.setItem(PROGRAMA_RECORDADO, id)
  }

  // Las cuentas que pueden llevar casos. En silencio si falla: es un
  // desplegable de una acción en lote, no el contenido de la pantalla, y un
  // error rojo al entrar por esto asusta más de lo que informa.
  useEffect(() => {
    estudiantesApi.responsables().then(setResponsables).catch(() => undefined)
  }, [])

  // ── Limpiar selección al cambiar de vista o filtros ───────────────────────
  useEffect(() => {
    setSelectedIds([])
  }, [selectedPgm, verPapelera, incompleteOnly, vista, searchQuery, academicFilter, employabilityFilter, currentPage])

  // ── Cargar estudiantes ────────────────────────────────────────────────────
  /**
   * Los filtros los aplica el servidor.
   *
   * <p>Antes se filtraba `page.content` en el navegador, que son los 20 de la
   * página cargada: buscar a alguien solo lo encontraba si ya estaba a la
   * vista, y con 108 participantes eso deja fuera al 80% de la lista. La
   * papelera y el listado de incompletos siguen filtrando en el cliente porque
   * son vistas aparte, sin endpoint de búsqueda propio.
   */
  const loadEstudiantes = useCallback(async (pgmId: string, pg: number, pap = false) => {
    if (!pgmId) return
    setLoading(true); setError(null)
    try {
      if (pap) {
        setPage(await estudiantesApi.listarPapelera(pgmId, pg))
      } else if (incompleteOnly) {
        setPage(await estudiantesApi.listarIncompletos(pg))
      } else if (vista !== 'todos') {
        // «Sin asignar» es el endpoint sin `responsableId`, no una llamada
        // distinta: en el servidor la ausencia de responsable *es* el filtro.
        setPage(await estudiantesApi.porResponsable(
          vista === 'mios' ? user?.usuarioId : undefined, pg))
      } else if (hayFiltrosDeServidor) {
        setPage(await estudiantesApi.buscarAvanzado({
          q: busquedaAplicada || undefined,
          programaId: pgmId,
          estadoAcademico: academicFilter === 'ALL' ? undefined : academicFilter,
          estadoEmpleabilidad: employabilityFilter === 'ALL' ? undefined : employabilityFilter,
          page: pg,
        }))
      } else {
        setPage(await estudiantesApi.listar(pgmId, pg))
      }
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.status === 401 || err.status === 403
          ? C.errorPermisos
          : `Error al cargar estudiantes (HTTP ${err.status}).`)
      } else {
        setError(C.errorConexion)
      }
    } finally {
      setLoading(false)
    }
  }, [incompleteOnly, vista, user?.usuarioId, hayFiltrosDeServidor, busquedaAplicada, academicFilter, employabilityFilter])

  // Cambiar de programa, de vista o de filtro devuelve a la primera página: la
  // 4 de un listado sin filtrar no existe en el listado filtrado.
  useEffect(() => {
    if (selectedPgm) { setCurrentPage(0); loadEstudiantes(selectedPgm, 0, verPapelera) }
  }, [selectedPgm, loadEstudiantes, verPapelera])

  // ── Matches ───────────────────────────────────────────────────────────────
  const loadMatches = async (estudianteId: string) => {
    setLoadingMatches(true)
    setMatchesPendientes(0)
    try {
      const [res, pendientes] = await Promise.all([
        matchesApi.listarPorEstudiante(estudianteId, 0, 50),
        matchesApi.contarPendientes(estudianteId).catch(() => 0),
      ])
      setMatches(res.content)
      setMatchesPendientes(pendientes)
    } catch { setMatches([]) }
    finally { setLoadingMatches(false) }
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  /**
   * En la vista normal ya viene filtrado del servidor y aquí no se toca:
   * volver a filtrar lo recibido escondería resultados legítimos, porque el
   * servidor compara sin tildes y esta comparación de abajo no.
   */
  const contenido = page?.content ?? []
  const filtered = !filtradoEnElCliente ? contenido : contenido.filter((est) => {
    const q = normalizarParaBuscar(busquedaAplicada)
    const matchQ = !q ||
      normalizarParaBuscar(`${est.nombre} ${est.apellido}`).includes(q) ||
      normalizarParaBuscar(est.email).includes(q) ||
      normalizarDocumento(est.numeroDocumento ?? '').includes(normalizarDocumento(q)) ||
      normalizarParaBuscar(est.ciudad ?? '').includes(q)
    const matchAcad = academicFilter === 'ALL' || est.estadoAcademico === academicFilter
    const matchEmp  = employabilityFilter === 'ALL' || est.estadoEmpleabilidad === employabilityFilter
    return matchQ && matchAcad && matchEmp
  })

  // ── Abrir creación ────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormMode('create'); setEditingId(null); setFormError(null); setFormSuccess(null)
    setForm({ ...emptyForm, programaId: selectedPgm }); setFormTab('basic'); setShowForm(true)
  }

  // ── Abrir edición ─────────────────────────────────────────────────────────
  const openEdit = (s: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation()
    setFormMode('edit'); setEditingId(s.id); setFormError(null); setFormSuccess(null)
    setForm(studentToForm(s)); setFormTab('basic'); setShowForm(true)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault(); setFormError(null); setFormSuccess(null)
    if (!form.nombre.trim()) { setFormError(T.elNombreEs); setFormTab('basic'); return }
    if (!form.apellido.trim()) { setFormError(T.elApellidoEs); setFormTab('basic'); return }
    if (!form.email.trim()) { setFormError(T.elEmailEs); setFormTab('basic'); return }
    if (!form.programaId) { setFormError(T.seleccionaUnProgramaX); setFormTab('basic'); return }

    startTransition(async () => {
      try {
        if (formMode === 'create') {
          await estudiantesApi.crear({ ...form })
          setFormSuccess(T.estudianteRegistradoExitosamente)
        } else if (editingId) {
          await estudiantesApi.actualizar(editingId, { ...form })
          setFormSuccess(T.estudianteActualizadoExitosamente)
        }
        setTimeout(() => { setShowForm(false); loadEstudiantes(selectedPgm, currentPage, verPapelera) }, 800)
      } catch (err) {
        if (err instanceof ApiCallError) {
          if (err.status === 400) setFormError(T.datosInvalidos + ' ' + (err.body.message ?? T.verificaLosCampos))
          // El backend dice con quién choca y dónde está —otro proyecto o la
          // papelera—, que es justo lo que hay que hacer a continuación. El
          // texto fijo solo cubre backends anteriores, que no lo mandaban.
          else if (err.status === 409) setFormError(err.body.message ?? T.yaExisteUn)
          else if (err.status === 401 || err.status === 403) setFormError(T.sinPermisosPara)
          else setFormError(T.errorDelServidor(err.status))
        } else {
          setFormError(C.errorConexion)
        }
      }
    })
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const openDelete = (s: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleting(s)
  }

  const executeDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await estudiantesApi.eliminar(deleting.id)
      setDeleting(null); loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      mostrarError(mensajeDeError(err, C.errorConexion))
    } finally { setDeletingBusy(false) }
  }

  // ── Restaurar desde papelera ──────────────────────────────────────────────
  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await estudiantesApi.restaurar(id)
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      mostrarError(T.noSePudoX)
    }
  }

  // ── Ejecutar matching bajo demanda ────────────────────────────────────────
  const handleEjecutarMatching = async () => {
    setExecutingMatching(true)
    try {
      const res = await matchesApi.ejecutarMatching()
      mostrarExito(T.matchingEjecutado(res.matchesCreados))
      if (selected) {
        loadMatches(selected.id)
      }
    } catch (err) {
      mostrarError(T.errorAlEjecutar)
    } finally {
      setExecutingMatching(false)
    }
  }

  // ── Marcar postulado en match ─────────────────────────────────────────────
  const handlePostularMatch = async (matchId: string) => {
    try {
      await matchesApi.marcarPostulado(matchId)
      if (selected) {
        loadMatches(selected.id)
      }
    } catch (err) {
      mostrarError(T.errorAlRegistrar)
    }
  }

  // ── Selección y Acciones Masivas ──────────────────────────────────────────
  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((est) => est.id))
    } else {
      setSelectedIds([])
    }
  }

  /**
   * Asigna —o quita— responsable a los seleccionados.
   *
   * Es la acción que faltaba desde que se hicieron las acciones en lote: el
   * concepto no existía en el modelo y hubo que decidir antes qué significaba.
   * La opción vacía **quita** el responsable, que es como se libera el trabajo
   * de alguien que deja el programa; por eso el texto lo dice y no se deja como
   * un «— sin elegir —» ambiguo.
   */
  const handleBulkResponsable = async () => {
    if (selectedIds.length === 0) return
    const elegido = responsables.find((r) => r.id === responsableMasivo)
    if (!(await confirmar({
      titulo: T.asignarResponsable,
      descripcion: elegido
        ? T.seAsignaraA(selectedIds.length, elegido.nombre)
        : T.seQuitaraResponsable(selectedIds.length),
      textoConfirmar: elegido ? T.asignar : T.quitar,
      destructivo: false,
    }))) return
    setBulkBusy(true)
    try {
      const { actualizados } = await estudiantesApi.asignarResponsableMasivo(
        selectedIds, responsableMasivo || null)
      mostrarExito(T.responsableAsignado(actualizados))
      setSelectedIds([])
      // El desplegable enseña cuántos lleva cada quien: si no se recarga,
      // reparte la siguiente tanda mirando cifras viejas.
      estudiantesApi.responsables().then(setResponsables).catch(() => undefined)
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      mostrarError(mensajeDeError(err, C.errorConexion))
    } finally { setBulkBusy(false) }
  }

  /**
   * Marca un hito en todos los seleccionados.
   *
   * Es lo que evita volver a la hoja de cálculo: poner al día a treinta
   * participantes de uno en uno no lo hace nadie. Un solo hito por vez, como
   * el endpoint: marcar varios a la vez casi siempre es un descuido.
   */
  const handleBulkHito = async (valor: EstadoHito) => {
    if (selectedIds.length === 0) return
    if (!(await confirmar({
      titulo: T.marcarHito,
      descripcion: T.seMarcaraHito(selectedIds.length, T.hitos[hitoMasivo], T.valoresHito[valor]),
      textoConfirmar: T.marcar,
      destructivo: false,
    }))) return
    setBulkBusy(true)
    try {
      const { actualizados } = await estudiantesApi.actualizarPreparacionMasiva(selectedIds, hitoMasivo, valor)
      // Se informa lo que dijo el servidor y no cuántos se habían marcado: si
      // alguno ya no existía, el número es menor y eso hay que verlo.
      mostrarExito(T.hitoMarcado(actualizados))
      setSelectedIds([])
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch (err) {
      mostrarError(mensajeDeError(err, C.errorConexion))
    } finally { setBulkBusy(false) }
  }

  /**
   * Exporta lo seleccionado a CSV.
   *
   * Se exporta lo que hay en pantalla y no se vuelve a pedir al servidor: la
   * selección es sobre las filas que la persona está viendo, y traer otra vez
   * esos registros abriría la puerta a que el archivo no coincida con lo que
   * acaba de marcar.
   *
   * Sin datos de contacto ni documento: un CSV se reenvía por correo sin
   * pensarlo, y ese es justo el camino por el que los datos personales de una
   * cohorte acaban fuera. Para eso está el informe formal, que deja rastro.
   */
  const handleBulkExport = () => {
    const marcados = filtered.filter((e) => selectedIds.includes(e.id))
    if (marcados.length === 0) return
    descargarCsv(
      `estudiantes-seleccion-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Nombre', 'Apellido', 'Programa', 'Ciudad', 'Estado academico', 'Empleabilidad', 'Completitud %'],
      marcados.map((e) => [
        e.nombre, e.apellido, e.programaNombre ?? '', e.ciudad ?? '',
        e.estadoAcademico, e.estadoEmpleabilidad, e.porcentajeCompletitud,
      ]),
    )
  }

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return
    if (!(await confirmar({
      titulo: T.restaurarEstudiantes,
      descripcion: T.seRestauraran(selectedIds.length),
      textoConfirmar: T.restaurar,
      destructivo: false,
    }))) return
    setBulkBusy(true)
    try {
      // `allSettled` y no `all`: con `all`, si falla uno se aborta el aviso y
      // se decia que la operacion fallo, cuando los demas ya se habian
      // restaurado. La lista quedaba distinta de lo que decia el mensaje.
      const resultados = await Promise.allSettled(selectedIds.map((id) => estudiantesApi.restaurar(id)))
      const fallidos = resultados.filter((r) => r.status === 'rejected').length
      if (fallidos === 0) mostrarExito(T.estudiantesRestauradosExitosamente)
      else if (fallidos === selectedIds.length) mostrarError(T.ocurrioUnErrorX)
      else mostrarError(T.restauradosParcialmente(selectedIds.length - fallidos, fallidos))
      setSelectedIds([])
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDelete = async (permanente: boolean) => {
    if (selectedIds.length === 0) return
    const msg = permanente
      ? T.seEliminaranPermanentemente(selectedIds.length)
      : T.seMoveranALaPapelera(selectedIds.length)

    if (!(await confirmar({
      titulo: permanente ? T.eliminarDefinitivamente : T.moverALa,
      descripcion: msg,
      textoConfirmar: permanente ? T.eliminarDefinitivamente : T.moverALa,
    }))) return
    setBulkBusy(true)
    try {
      await estudiantesApi.eliminarMasivo(selectedIds, permanente)
      mostrarExito(permanente ? T.estudiantesEliminadosDefinitivamente : T.estudiantesEnviadosA)
      setSelectedIds([])
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch {
      mostrarError(T.ocurrioUnError)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleSinglePermanentDelete = async (est: EstudianteResponse, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!(await confirmar({
      titulo: T.eliminarDefinitivamente,
      descripcion: T.seEliminaraPermanentemente(`${est.nombre} ${est.apellido}`),
      textoConfirmar: T.eliminarDefinitivamente,
    }))) return
    try {
      await estudiantesApi.eliminarMasivo([est.id], true)
      mostrarExito(T.estudianteEliminadoPermanentemente)
      loadEstudiantes(selectedPgm, currentPage, verPapelera)
    } catch {
      mostrarError(T.noSePudo)
    }
  }

  // ── Abrir detalles ────────────────────────────────────────────────────────
  const openDetails = (s: EstudianteResponse) => {
    setSelected(s); setDetailTab('personal'); setMatches([]); loadMatches(s.id)
  }

  // ── helpers de update ─────────────────────────────────────────────────────
  const f = (key: keyof EstudianteRequest, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }))

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex justify-end gap-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEjecutarMatching} disabled={executingMatching} className="shrink-0">
            {executingMatching ? (
              <>
                <CircleNotch className="size-4 animate-spin mr-1" />
                Ejecutando...
              </>
            ) : (
              <>
                <Trophy className="size-4 mr-1 text-primary" />
                Ejecutar Matching
              </>
            )}
          </Button>
          <Button className="shrink-0" render={<Link href="/estudiantes/nuevo" />}>
            <Plus className="size-4" /> {T.nuevoEstudiante}
          </Button>
        </div>
      </div>

      {/* ── Formulario ─────────────────────────────────────────────────────── */}
      {showForm && (
        <Card className="rounded-xl shadow-sm border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{formMode === 'create' ? T.nuevoEstudiante : T.editarEstudiante}</CardTitle>
                <CardDescription>{T.camposConSon}</CardDescription>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
                <X className="size-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex border-b border-border mb-5 -mx-6 px-6 gap-1">
              {([
                ['basic', T.datosBasicos, User],
                ['edu', T.educacionYExperiencia, GraduationCap],
                ['socio', T.socioeconomicoYMetas, CurrencyDollar],
              ] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => setFormTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${formTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {/* Pestaña: Datos Básicos */}
              {formTab === 'basic' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-nombre" className="text-xs font-medium">{C.nombreObligatorio}</label>
                    <Input id="f-nombre" required value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder={T.ejCarlos} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-apellido" className="text-xs font-medium">{T.apellido}</label>
                    <Input id="f-apellido" required value={form.apellido} onChange={(e) => f('apellido', e.target.value)} placeholder={T.ejRamirez} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-email" className="text-xs font-medium">{T.email}</label>
                    <Input id="f-email" type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="correo@ejemplo.com" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-celular" className="text-xs font-medium">{T.celular}</label>
                    <Input id="f-celular" value={form.celular ?? ''} onChange={(e) => f('celular', e.target.value)} placeholder="300 000 0000" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-telefono" className="text-xs font-medium">{T.telefonoFijo}</label>
                    <Input id="f-telefono" value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)} placeholder="601 000 0000" disabled={isPending} maxLength={50} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-tipodoc" className="text-xs font-medium">{T.tipoDocumento}</label>
                    <select id="f-tipodoc" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.tipoDocumento ?? 'CC'} onChange={(e) => f('tipoDocumento', e.target.value)} disabled={isPending}>
                      <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option><option value="PASAPORTE">{T.pasaporte}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-numdoc" className="text-xs font-medium">{T.nDocumento}</label>
                    <Input id="f-numdoc" value={form.numeroDocumento ?? ''} onChange={(e) => f('numeroDocumento', e.target.value)} placeholder="1234567890" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-nacionalidad" className="text-xs font-medium">{T.nacionalidad}</label>
                    <Input id="f-nacionalidad" value={form.nacionalidad ?? ''} onChange={(e) => f('nacionalidad', e.target.value)} placeholder={T.colombiana} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-genero" className="text-xs font-medium">{T.genero}</label>
                    <select id="f-genero" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.genero ?? ''} onChange={(e) => f('genero', e.target.value)} disabled={isPending}>
                      <option value="">{T.seleccionar}</option><option value={T.masculino}>{T.masculino}</option><option value={T.femenino}>{T.femenino}</option><option value={T.otro}>{T.otro}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ciudad" className="text-xs font-medium">{C.ciudad}</label>
                    <Input id="f-ciudad" value={form.ciudad ?? ''} onChange={(e) => f('ciudad', e.target.value)} placeholder={T.bogota} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-barrio" className="text-xs font-medium">{T.barrio}</label>
                    <Input id="f-barrio" value={form.barrio ?? ''} onChange={(e) => f('barrio', e.target.value)} placeholder={T.teusaquillo} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-programa" className="text-xs font-medium">{T.programa}</label>
                    <select id="f-programa" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.programaId} onChange={(e) => f('programaId', e.target.value)} required disabled={isPending || formMode === 'edit'}>
                      <option value="">{T.seleccionaUnPrograma}</option>
                      {programas.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estadoacad" className="text-xs font-medium">{T.estadoAcademico}</label>
                    <select id="f-estadoacad" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoAcademico ?? 'ACTIVO'} onChange={(e) => f('estadoAcademico', e.target.value as EstadoAcademico)} disabled={isPending}>
                      <option value="ACTIVO">{C.activo}</option><option value="GRADUADO">{C.graduado}</option><option value="RETIRADO">{C.retirado}</option><option value="EN_PROCESO">{C.enProceso}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Pestaña: Educación y Experiencia */}
              {formTab === 'edu' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-niveledu" className="text-xs font-medium">{T.nivelEducativo}</label>
                    <Input id="f-niveledu" value={form.nivelEducativo ?? ''} onChange={(e) => f('nivelEducativo', e.target.value)} placeholder={T.profesionalTecnologo} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-titulo" className="text-xs font-medium">{T.tituloObtenido}</label>
                    <Input id="f-titulo" value={form.titulo ?? ''} onChange={(e) => f('titulo', e.target.value)} placeholder={T.ingDeSistemas} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-instedu" className="text-xs font-medium">{T.institucionEducativa}</label>
                    <Input id="f-instedu" value={form.institucionEducativa ?? ''} onChange={(e) => f('institucionEducativa', e.target.value)} placeholder={T.universidadNacional} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-areaform" className="text-xs font-medium">{T.areaDeFormacion}</label>
                    <Input id="f-areaform" value={form.areaFormacion ?? ''} onChange={(e) => f('areaFormacion', e.target.value)} placeholder={T.tecnologia} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estform" className="text-xs font-medium">{T.estadoFormacion}</label>
                    <Input id="f-estform" value={form.estadoFormacion ?? ''} onChange={(e) => f('estadoFormacion', e.target.value)} placeholder={T.graduadoCursando} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-aniosexp" className="text-xs font-medium">{T.anosExperiencia}</label>
                    <Input id="f-aniosexp" type="number" min={0} value={form.aniosExperiencia ?? 0} onChange={(e) => f('aniosExperiencia', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-secexp" className="text-xs font-medium">{T.sectorExperiencia}</label>
                    <Input id="f-secexp" value={form.sectorExperiencia ?? ''} onChange={(e) => f('sectorExperiencia', e.target.value)} placeholder={T.bpoTecnologia} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ultcargo" className="text-xs font-medium">{T.ultimoCargo}</label>
                    <Input id="f-ultcargo" value={form.ultimoCargo ?? ''} onChange={(e) => f('ultimoCargo', e.target.value)} placeholder={T.asesorDeServicio} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-prescrita" className="text-xs font-medium">{T.pruebaEscrita}</label>
                    <Input id="f-prescrita" value={form.resultadoPruebaEscrita ?? ''} onChange={(e) => f('resultadoPruebaEscrita', e.target.value)} placeholder="85%" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-proral" className="text-xs font-medium">{T.pruebaOral}</label>
                    <Input id="f-proral" value={form.resultadoPruebaOral ?? ''} onChange={(e) => f('resultadoPruebaOral', e.target.value)} placeholder="B2" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label htmlFor="f-perfil" className="text-xs font-medium">{T.perfilProfesional}</label>
                    <Textarea id="f-perfil" minRows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.perfilProfesional ?? ''} onChange={(e) => f('perfilProfesional', e.target.value)} placeholder={T.descripcionDelPerfil} disabled={isPending} />
                  </div>
                </div>
              )}

              {/* Pestaña: Socioeconómico y Metas */}
              {formTab === 'socio' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-sisben" className="text-xs font-medium">{T.clasificacionSisben}</label>
                    <Input id="f-sisben" value={form.clasificacionSisben ?? ''} onChange={(e) => f('clasificacionSisben', e.target.value)} placeholder="A1, B3" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-sitlab" className="text-xs font-medium">{T.situacionLaboral}</label>
                    <Input id="f-sitlab" value={form.situacionLaboral ?? ''} onChange={(e) => f('situacionLaboral', e.target.value)} placeholder={T.desempleadoInformal} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-ingreso" className="text-xs font-medium">{T.ingresoMensual}</label>
                    <Input id="f-ingreso" value={form.ingresoMensual ?? ''} onChange={(e) => f('ingresoMensual', e.target.value)} placeholder={T.ninguno1Smlv} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-displab" className="text-xs font-medium">{T.disponibilidadLaboral}</label>
                    <Input id="f-displab" value={form.disponibilidadLaboral ?? ''} onChange={(e) => f('disponibilidadLaboral', e.target.value)} placeholder={T.inmediata} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estbus" className="text-xs font-medium">{T.estadoDeBusqueda}</label>
                    <Input id="f-estbus" value={form.estadoBusqueda ?? ''} onChange={(e) => f('estadoBusqueda', e.target.value)} placeholder={T.activa} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-cargoobj" className="text-xs font-medium">{T.cargoObjetivo}</label>
                    <Input id="f-cargoobj" value={form.cargoObjetivo ?? ''} onChange={(e) => f('cargoObjetivo', e.target.value)} placeholder={T.asesorBilingue} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-secobj" className="text-xs font-medium">{T.sectorObjetivo}</label>
                    <Input id="f-secobj" value={form.sectorObjetivo ?? ''} onChange={(e) => f('sectorObjetivo', e.target.value)} placeholder="BPO" disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-postulaciones" className="text-xs font-medium">{T.postulacionesEnviadas}</label>
                    <Input id="f-postulaciones" type="number" min={0} value={form.postulacionesEnviadas ?? 0} onChange={(e) => f('postulacionesEnviadas', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-empresas" className="text-xs font-medium">{T.empresasContactadas}</label>
                    <Input id="f-empresas" type="number" min={0} value={form.empresasContactadas ?? 0} onChange={(e) => f('empresasContactadas', parseInt(e.target.value) || 0)} disabled={isPending} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="f-estemp" className="text-xs font-medium">{T.empleabilidad}</label>
                    <select id="f-estemp" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.estadoEmpleabilidad ?? 'SIN_INFO'} onChange={(e) => f('estadoEmpleabilidad', e.target.value as EstadoEmpleabilidad)} disabled={isPending}>
                      <option value="SIN_INFO">{C.sinInfo}</option><option value="BUSCANDO">{T.buscandoEmpleo}</option><option value="EMPLEADO">{C.empleado}</option>
                    </select>
                  </div>
                  {/* Checkboxes */}
                  <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {([
                      ['disponibilidadMovilidad', T.disponibilidadDeMovilidad],
                      ['responsableEconomico', T.responsableEconomicoDel],
                      ['haTrabajado', T.haTrabajadoAntes],
                      ['tieneComputador', T.tieneComputador],
                      ['tieneInternet', T.tieneInternet],
                      ['interesMigratorio', T.interesMigratorio],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input type="checkbox" checked={!!form[key]} onChange={(e) => f(key, e.target.checked)} disabled={isPending} className="size-3.5 accent-primary rounded" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                    <label htmlFor="f-motivacion" className="text-xs font-medium">{T.motivacion}</label>
                    <Textarea id="f-motivacion" minRows={3} className="rounded-md border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={form.motivacion ?? ''} onChange={(e) => f('motivacion', e.target.value)} placeholder={T.motivacionDelEstudiante} disabled={isPending} />
                  </div>
                </div>
              )}

              {/* Feedback */}
              {formError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <WarningCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="mt-0.5 size-4 shrink-0" /><span>{formSuccess}</span>
                </div>
              )}

              {/* Acciones */}
              <div className="col-span-full flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>{C.cancelar}</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><CircleNotch className="size-4 animate-spin" /> Guardando…</> : formMode === 'create' ? T.registrar : T.actualizar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Programa selector */}
        {programas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{C.programa}:</span>
            {programas.map((p) => (
              <button key={p.id} type="button" onClick={() => elegirPrograma(p.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedPgm === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-secondary'}`}>
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 shrink-0">
          {/* La revisión de datos incompletos existía entera —endpoint,
              consulta y esta misma pantalla— pero sólo se alcanzaba escribiendo
              ?incompletos=1 en la barra de direcciones: nada enlazaba a ella.
              Con 108 fichas cargadas desde Excel, saber a quién le falta
              celular, correo o documento es justo lo que decide si se le puede
              contactar. */}
          {!verPapelera && (
            <Button
              variant={incompleteOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setIncompleteOnly((v) => !v); setCurrentPage(0) }}
              title={T.estudiantesActivosA}
            >
              <WarningCircle className="size-3.5 mr-1" />
              {incompleteOnly ? T.verTodos : T.datosIncompletos}
            </Button>
          )}

          {/* «Los míos» y «Sin asignar». El backend los servía desde que existe
              el responsable y ninguna pantalla los llamaba: el filtro estaba
              hecho y no se podía usar.

              Van juntos y no en un desplegable porque son las dos preguntas
              que se hacen de verdad —«qué llevo yo» y «qué no lleva nadie»— y
              la segunda es la que hace falta para repartir. */}
          {!verPapelera && (
            <>
              <Button
                variant={vista === 'mios' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setVista(vista === 'mios' ? 'todos' : 'mios'); setCurrentPage(0) }}
                title={T.losQueLlevoYo}
              >
                <UserCheck className="size-3.5 mr-1" />
                {T.losMios}
              </Button>
              <Button
                variant={vista === 'sinAsignar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setVista(vista === 'sinAsignar' ? 'todos' : 'sinAsignar'); setCurrentPage(0) }}
                title={T.losQueNoLleva}
              >
                {T.sinAsignar}
              </Button>
            </>
          )}
          <Button
            variant={verPapelera ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              const nuevaPapelera = !verPapelera
              setVerPapelera(nuevaPapelera)
              setCurrentPage(0)
            }}
          >
            {verPapelera ? (
              <>{T.verActivos}</>
            ) : (
              <>
                <Trash className="size-3.5 mr-1" />
                {T.verPapelera}
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadEstudiantes(selectedPgm, currentPage, verPapelera)} className="shrink-0">
            <ArrowsClockwise className="size-3.5" /> Refrescar
          </Button>
        </div>
      </div>

      {incompleteOnly && !verPapelera && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <WarningCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">{T.mostrandoEstudiantesCon}</p>
              {/* Decirlo importa: el selector de proyecto sigue arriba y aquí
                  no aplica, así que sin esta línea la lista parece la del
                  proyecto elegido y no lo es. */}
              <p className="text-xs text-muted-foreground">{T.faltaCelularCorreo}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIncompleteOnly(false)
              window.history.replaceState({}, '', '/estudiantes')
            }}
            className="shrink-0"
          >
            <X className="size-3.5" /> Quitar filtro
          </Button>
        </div>
      )}

      {/* Vistas guardadas.
          Va encima de los filtros y no debajo porque se elige antes: abrir una
          vista *pone* los filtros, así que leerla después de haberlos tocado a
          mano invita a pelearse con la pantalla. */}
      <VistasGuardadas
        modulo="ESTUDIANTES"
        hayFiltros={academicFilter !== 'ALL' || employabilityFilter !== 'ALL' || busquedaAplicada !== ''}
        filtrosActuales={{
          estadoAcademico: academicFilter,
          estadoEmpleabilidad: employabilityFilter,
          q: busquedaAplicada,
        }}
        onAplicar={(f) => {
          // Se ignoran las claves desconocidas: una vista guardada hace meses
          // puede traer un filtro que ya no existe, y reventar al abrirla sería
          // peor que filtrar de menos.
          setAcademicFilter(typeof f.estadoAcademico === 'string' ? f.estadoAcademico : 'ALL')
          setEmployabilityFilter(typeof f.estadoEmpleabilidad === 'string' ? f.estadoEmpleabilidad : 'ALL')
          const q = typeof f.q === 'string' ? f.q : ''
          setSearchQuery(q)
          setBusquedaAplicada(q)
        }}
      />

      {/* Búsqueda y filtros */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {/* La misma caja no busca lo mismo en las tres vistas: en el listado
              normal pregunta al servidor por toda la cohorte, y en la papelera
              y en los incompletos filtra sólo lo ya cargado, porque no tienen
              búsqueda propia. Se dice, en vez de dejar creer que no hay más
              resultados cuando sí los hay en otra página. */}
          <Input
            type="search"
            placeholder={filtradoEnElCliente ? T.buscarEnEstaPagina : T.buscarNombreEmail}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary/40"
          />
          {filtradoEnElCliente && busquedaAplicada !== '' && (page?.totalPages ?? 0) > 1 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {T.soloEstaPagina((page?.number ?? 0) + 1, page?.totalPages ?? 1)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Funnel className="size-3.5 text-muted-foreground shrink-0" />
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={academicFilter} onChange={(e) => setAcademicFilter(e.target.value)} aria-label={T.filtrarPorEstado}>
            <option value="ALL">{T.todosEstadoAcad}</option>
            <option value="ACTIVO">{C.activo}</option><option value="GRADUADO">{C.graduado}</option><option value="RETIRADO">{C.retirado}</option><option value="EN_PROCESO">{C.enProceso}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={employabilityFilter} onChange={(e) => setEmployabilityFilter(e.target.value)} aria-label={T.filtrarPorEmpleabilidad}>
            <option value="ALL">{T.todasEmpleabilidad}</option>
            <option value="SIN_INFO">{C.sinInfo}</option><option value="BUSCANDO">{C.buscando}</option><option value="EMPLEADO">{C.empleado}</option>
          </select>
        </div>
      </div>

      {/* ── Estados ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <PageSpinner />
          <span className="ml-2 text-sm text-muted-foreground">{T.cargandoEstudiantes}</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <WarningCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => loadEstudiantes(selectedPgm, currentPage)}><ArrowsClockwise className="size-4" /> Reintentar</Button>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-medium text-destructive-foreground">
            {T.seleccionados(selectedIds.length)}
          </span>
          <div className="flex gap-2">
            {/* Exportar no destruye nada, así que va antes que lo que sí:
                separar las acciones reversibles de las que no lo son evita el
                clic equivocado con cuarenta filas marcadas. */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-background hover:bg-secondary"
              onClick={handleBulkExport}
            >
              {T.exportarSeleccion}
            </Button>
            {verPapelera ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-background hover:bg-secondary"
                  disabled={bulkBusy}
                  onClick={handleBulkRestore}
                >
                  <ArrowCounterClockwise className="size-3.5 mr-1" /> {T.restaurarSeleccionados}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  disabled={bulkBusy}
                  onClick={() => handleBulkDelete(true)}
                >
                  <Trash className="size-3.5 mr-1" /> {T.eliminarDefinitivamente}
                </Button>
              </>
            ) : (
              <>
                {/* Marcar un hito a los seleccionados. El endpoint existía desde
                    el principio y ninguna pantalla lo llamaba: poner al día a
                    treinta participantes de uno en uno no lo hace nadie. */}
                <select
                  aria-label={T.marcarHito}
                  value={hitoMasivo}
                  disabled={bulkBusy}
                  onChange={(e) => setHitoMasivo(e.target.value as HitoPreparacion)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {(Object.keys(T.hitos) as HitoPreparacion[]).map((h) => (
                    <option key={h} value={h}>{T.hitos[h]}</option>
                  ))}
                </select>
                {(['SI', 'EN_PROCESO', 'NO'] as EstadoHito[]).map((v) => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-background hover:bg-secondary"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkHito(v)}
                  >
                    {T.valoresHito[v]}
                  </Button>
                ))}

                {/* Repartir la cohorte. El desplegable lleva cuántos tiene ya
                    cada quien: repartir a ciegas es como una persona acaba con
                    ochenta y otra con seis. */}
                <select
                  aria-label={T.asignarResponsable}
                  value={responsableMasivo}
                  disabled={bulkBusy}
                  onChange={(e) => setResponsableMasivo(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">{T.sinResponsable}</option>
                  {responsables.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre} ({r.aCargo})</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-background hover:bg-secondary"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkResponsable()}
                >
                  <UserCheck className="size-3.5 mr-1" /> {T.asignar}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  disabled={bulkBusy}
                  onClick={() => handleBulkDelete(false)}
                >
                  <Trash className="size-3.5 mr-1" /> {T.eliminarSeleccionados}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {!loading && !error && page && (
        <>
          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <GraduationCap className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {verPapelera
                    ? T.noHayEstudiantesX
                    : T.noHayEstudiantes}
                </p>
                {!verPapelera && (
                  <Button onClick={openCreate} variant="outline"><Plus className="size-4" /> {T.registrarElPrimero}</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label={T.seleccionarTodosLos}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.nombre}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.email}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.documento}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.estado}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{T.empleabilidad}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{C.ciudad}</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">{C.acciones}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((est) => {
                      const ai = estadoAcademico(T, C, est.estadoAcademico)
                      const ei = estadoEmpleabilidad(T, C, est.estadoEmpleabilidad)
                      return (
                        <tr key={est.id} onClick={() => openDetails(est)} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="size-4 cursor-pointer"
                              checked={selectedIds.includes(est.id)}
                              onChange={() => handleSelectRow(est.id)}
                              aria-label={`Seleccionar a ${est.nombre}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{est.nombre} {est.apellido}</td>
                          <td className="px-4 py-3 text-muted-foreground">{est.email}</td>
                          <td className="px-4 py-3 text-muted-foreground">{est.tipoDocumento && est.numeroDocumento ? `${est.tipoDocumento} ${est.numeroDocumento}` : '—'}</td>
                          <td className="px-4 py-3"><EstadoDot {...ai} /></td>
                          <td className="px-4 py-3"><EstadoDot {...ei} /></td>
                          <td className="px-4 py-3 text-muted-foreground">{est.ciudad ?? '—'}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              {verPapelera ? (
                                <>
                                  <button type="button" onClick={(e) => handleRestore(est.id, e)} title={T.restaurarEstudiante} aria-label={`Restaurar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-green-600 dark:text-green-400 transition-colors hover:bg-green-50 dark:hover:bg-green-950/20">
                                    <ArrowCounterClockwise className="size-4" />
                                  </button>
                                  <button type="button" onClick={(e) => handleSinglePermanentDelete(est, e)} title={T.eliminarPermanentemente} aria-label={`Eliminar permanentemente a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10">
                                    <Trash className="size-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Link href={`/estudiantes/${est.id}`} onClick={(e) => e.stopPropagation()} title={T.verPerfilCompleto} aria-label={T.verPerfilDe(est.nombre)}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                    <ArrowSquareOut className="size-4" />
                                  </Link>
                                  <button type="button" onClick={(e) => openEdit(est, e)} aria-label={`Editar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                    <PencilSimple className="size-4" />
                                  </button>
                                  <button type="button" onClick={(e) => openDelete(est, e)} aria-label={`Eliminar a ${est.nombre}`}
                                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                    <Trash className="size-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {page.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">Página {page.number + 1} de {page.totalPages} · {page.totalElements} estudiantes</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page.number === 0}
                      onClick={() => { const p = currentPage - 1; setCurrentPage(p); loadEstudiantes(selectedPgm, p, verPapelera) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                      <CaretLeft className="size-4" />
                    </button>
                    <button type="button" disabled={page.number >= page.totalPages - 1}
                      onClick={() => { const p = currentPage + 1; setCurrentPage(p); loadEstudiantes(selectedPgm, p, verPapelera) }}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                      <CaretRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── Drawer de Detalles ─────────────────────────────────────────────── */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg shrink-0">
                    {selected.nombre[0]}{selected.apellido[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base truncate">{selected.nombre} {selected.apellido}</SheetTitle>
                    <SheetDescription className="text-xs truncate">{selected.programaNombre ?? C.programa} · Registro: {new Date(selected.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-CO')}</SheetDescription>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      <EstadoDot {...estadoAcademico(T, C, selected.estadoAcademico)} />
                      <EstadoDot {...estadoEmpleabilidad(T, C, selected.estadoEmpleabilidad)} />
                    </div>
                    <Link href={`/estudiantes/${selected.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2">
                      <ArrowSquareOut className="size-3" /> {T.verPerfilCompleto}
                    </Link>
                  </div>
                </div>
              </SheetHeader>

              {/* Tabs */}
              <div className="flex border-b border-border px-4 shrink-0">
                {([
                  ['personal', T.personal, User],
                  ['academic', T.academico, GraduationCap],
                  ['socio', T.social, CurrencyDollar],
                  ['matches', T.matches, Trophy],
                ] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setDetailTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${detailTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    <Icon className="size-3.5" /> {label}
                    {id === 'matches' && matchesPendientes > 0 && (
                      <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                        title={T.matchesPendientesDe(matchesPendientes)}>
                        {matchesPendientes}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Personal */}
                {detailTab === 'personal' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.identificacionYContacto}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.nombres} value={selected.nombre} />
                        <DetailField label={T.apellidos} value={selected.apellido} />
                        <DetailField label={C.email} value={selected.email} />
                        <DetailField label={T.celular} value={selected.celular} />
                        <DetailField label={C.telefono} value={selected.telefono} />
                        <DetailField label={T.documento} value={selected.tipoDocumento && selected.numeroDocumento ? `${selected.tipoDocumento} ${selected.numeroDocumento}` : null} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.ubicacion}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.nacionalidad} value={selected.nacionalidad} />
                        <DetailField label={C.ciudad} value={selected.ciudad} />
                        <DetailField label={T.barrio} value={selected.barrio} />
                      </div>
                    </section>
                  </div>
                )}

                {/* Académico */}
                {detailTab === 'academic' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.educacion}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.nivelEducativo} value={selected.nivelEducativo} />
                        <DetailField label={T.titulo} value={selected.titulo} />
                        <DetailField label={T.institucion} value={selected.institucionEducativa} />
                        <DetailField label={T.areaFormacion} value={selected.areaFormacion} />
                        <DetailField label={T.estadoFormacion} value={selected.estadoFormacion} />
                        <DetailField label={T.nivelIngles} value={selected.nivelIngles} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.pruebas}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.pruebaEscrita} value={selected.resultadoPruebaEscrita} />
                        <DetailField label={T.pruebaOral} value={selected.resultadoPruebaOral} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.experienciaLaboral}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.anosExperiencia} value={selected.aniosExperiencia != null ? T.aniosX(selected.aniosExperiencia) : null} />
                        <DetailField label={T.ultimoCargo} value={selected.ultimoCargo} />
                        <DetailField label={T.sectorExperiencia} value={selected.sectorExperiencia} />
                        <DetailField label={T.cargoObjetivo} value={selected.cargoObjetivo} />
                        <DetailField label={T.sectorObjetivo} value={selected.sectorObjetivo} />
                        <DetailField label={T.movilidad} value={selected.disponibilidadMovilidad != null ? (selected.disponibilidadMovilidad ? 'Sí' : 'No') : null} />
                      </div>
                      {selected.perfilProfesional && (
                        <div className="mt-2">
                          <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.perfilProfesional}</span>
                          <p className="text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap mt-0.5">{selected.perfilProfesional}</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* Social */}
                {detailTab === 'socio' && (
                  <div className="flex flex-col gap-5">
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.socioeconomico}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label="SISBEN" value={selected.clasificacionSisben} />
                        <DetailField label={T.situacionLaboral} value={selected.situacionLaboral} />
                        <DetailField label={T.ingresoMensual} value={selected.ingresoMensual} />
                        <DetailField label={T.responsableEconomico} value={selected.responsableEconomico != null ? (selected.responsableEconomico ? 'Sí' : 'No') : null} />
                        <DetailField label={T.computador} value={selected.tieneComputador != null ? (selected.tieneComputador ? 'Sí' : 'No') : null} />
                        <DetailField label={T.internet} value={selected.tieneInternet != null ? (selected.tieneInternet ? 'Sí' : 'No') : null} />
                      </div>
                    </section>
                    <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{T.metasYBusqueda}</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <DetailField label={T.disponibilidadLaboral} value={selected.disponibilidadLaboral} />
                        <DetailField label={T.estadoBusqueda} value={selected.estadoBusqueda} />
                        <DetailField label={T.postulaciones} value={selected.postulacionesEnviadas} />
                        <DetailField label={T.empresasContactadas} value={selected.empresasContactadas} />
                        <DetailField label={T.interesMigratorio} value={selected.interesMigratorio != null ? (selected.interesMigratorio ? 'Sí' : 'No') : null} />
                      </div>
                      {selected.motivacion && (
                        <div className="mt-2">
                          <span className="block text-muted-foreground text-[10px] uppercase tracking-wider">{T.motivacion}</span>
                          <p className="text-xs text-muted-foreground italic leading-relaxed whitespace-pre-wrap mt-0.5">{selected.motivacion}</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* Matches */}
                {detailTab === 'matches' && (
                  <div className="flex flex-col gap-4">
                    {loadingMatches ? (
                      <div className="flex flex-col items-center py-12 gap-2">
                        <PageSpinner />
                        <span className="text-xs text-muted-foreground">{T.cargandoMatches}</span>
                      </div>
                    ) : matches.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3">
                        <Briefcase className="size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">{T.sinMatchesDe}</p>
                        <p className="text-xs text-muted-foreground max-w-xs">{T.elSistemaEvalua}</p>
                      </div>
                    ) : (
                      matches.map((m) => (
                        <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                          <div className="flex flex-col items-center justify-center px-3 py-2 bg-secondary rounded-lg shrink-0">
                            <span className="text-base font-bold text-primary leading-none">{Number(m.puntaje).toFixed(0)}</span>
                            <span className="text-[9px] text-muted-foreground font-medium mt-0.5">pts</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-semibold text-foreground truncate">{m.vacanteTitulo}</h5>
                            <span className="block text-[11px] text-muted-foreground truncate">{m.vacanteEmpresa} · {m.vacanteUbicacion ?? T.remoto}</span>
                            <div className="flex gap-2 items-center mt-1.5">
                              {m.postulado
                                ? <Badge className="bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 text-[10px] py-0 px-1.5">{T.postulado}</Badge>
                                : <Badge variant="outline" className="text-[10px] py-0 px-1.5">{T.pendiente}</Badge>}
                              <span className="text-[10px] text-muted-foreground">{m.notificado ? '✓ Notificado' : T.noNotificado}</span>
                            </div>
                          </div>
                          {!m.postulado && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground shrink-0"
                              onClick={() => handlePostularMatch(m.id)}
                            >
                              Postularse
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border shrink-0 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { if (selected) openEdit(selected, { stopPropagation: () => {} } as React.MouseEvent) }}>
                  <PencilSimple className="size-4" /> {C.editar}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>{C.cerrar}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Modal de eliminación ───────────────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deletingBusy && setDeleting(null)} onKeyDown={(e) => e.key === 'Escape' && !deletingBusy && setDeleting(null)}>
          <div className="bg-card rounded-xl border border-border shadow-lg p-6 max-w-sm w-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <WarningCircle className="size-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">{T.confirmasLaEliminacion}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{T.estasAPunto(`${deleting.nombre} ${deleting.apellido}`)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>{C.cancelar}</Button>
              <Button variant="destructive" onClick={executeDelete} disabled={deletingBusy}>
                {deletingBusy ? <><CircleNotch className="size-4 animate-spin" /> Eliminando…</> : C.eliminar}
              </Button>
            </div>
          </div>
        </div>
      )}
      {dialogo}
      {avisos}
    </div>
  )
}
