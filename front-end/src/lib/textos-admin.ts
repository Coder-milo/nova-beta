/**
 * El vocabulario que se repite por toda la administración.
 *
 * Se midió antes de escribirlo: de las 988 cadenas distintas que hay en las
 * pantallas de gestión, 72 aparecen en tres o más. Dejarlas en el diccionario
 * de cada página significaría catorce copias de «Cancelar» y catorce
 * traducciones que pueden divergir; una sola vez aquí significa que corregir
 * un término lo corrige en todas.
 *
 * Lo que sí es propio de una pantalla —sus títulos, sus explicaciones— vive
 * junto a ella, igual que en el portal del estudiante. Este módulo es para lo
 * común, no un cajón para todo.
 */

export type TextosAdmin = ReturnType<typeof textosAdmin>

export function textosAdmin(english: boolean) {
  return english
    ? {
        // Acciones
        guardar: 'Save', guardando: 'Saving…', cancelar: 'Cancel', cerrar: 'Close',
        eliminar: 'Delete', editar: 'Edit', crear: 'Create', buscar: 'Search',
        refrescar: 'Refresh', reintentar: 'Retry', ver: 'View', descargar: 'Download',
        volver: 'Back', siguiente: 'Next', anterior: 'Previous', acciones: 'Actions',

        // Campos frecuentes
        nombre: 'Name', nombreObligatorio: 'Name *', email: 'Email',
        telefono: 'Phone', ciudad: 'City', fecha: 'Date', archivo: 'File',
        estado: 'Status', programa: 'Programme', empresa: 'Company',
        estudiantes: 'Students', documentos: 'Documents', notas: 'Notes',

        // Estados de un estudiante
        activo: 'Active', inactivo: 'Inactive', enProceso: 'In progress',
        graduado: 'Graduated', retirado: 'Withdrawn',
        empleado: 'Employed', buscando: 'Job hunting', sinInfo: 'No information',

        // Estados de carga y vacíos
        cargando: 'Loading…', sinResultados: 'No results',
        sinRegistrar: 'Not recorded', sinAsignar: 'Not assigned',

        // Errores que puede dar cualquier pantalla
        errorConexion: 'Could not reach the backend.',
        errorPermisos: 'No permission. Sign in as ADMIN or COORDINADOR.',
        errorProgramas: 'The programmes could not be loaded.',
        errorNombre: 'The name is required.',
      }
    : {
        guardar: 'Guardar', guardando: 'Guardando…', cancelar: 'Cancelar', cerrar: 'Cerrar',
        eliminar: 'Eliminar', editar: 'Editar', crear: 'Crear', buscar: 'Buscar',
        refrescar: 'Refrescar', reintentar: 'Reintentar', ver: 'Ver', descargar: 'Descargar',
        volver: 'Volver', siguiente: 'Siguiente', anterior: 'Anterior', acciones: 'Acciones',

        nombre: 'Nombre', nombreObligatorio: 'Nombre *', email: 'Email',
        telefono: 'Teléfono', ciudad: 'Ciudad', fecha: 'Fecha', archivo: 'Archivo',
        estado: 'Estado', programa: 'Programa', empresa: 'Empresa',
        estudiantes: 'Estudiantes', documentos: 'Documentos', notas: 'Notas',

        activo: 'Activo', inactivo: 'Inactivo', enProceso: 'En proceso',
        graduado: 'Graduado', retirado: 'Retirado',
        empleado: 'Empleado', buscando: 'Buscando', sinInfo: 'Sin información',

        cargando: 'Cargando…', sinResultados: 'Sin resultados',
        sinRegistrar: 'Sin registrar', sinAsignar: 'Sin asignar',

        errorConexion: 'No se pudo conectar con el backend.',
        errorPermisos: 'Sin permisos. Inicia sesión como ADMIN o COORDINADOR.',
        errorProgramas: 'No se pudieron cargar los programas.',
        errorNombre: 'El nombre es obligatorio.',
      }
}
