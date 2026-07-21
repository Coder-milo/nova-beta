// Datos ficticios en español para el panel administrativo de la Academia CAC.
// Separados de los componentes visuales. No hay backend ni base de datos todavía.

export const adminUser = {
  nombre: 'Laura Martínez',
  rol: 'Administradora',
  email: 'admin@academia-cac.co',
  iniciales: 'LM',
}

export type StatCard = {
  id: string
  label: string
  value: string
  helper?: string
  icon:
    | 'users'
    | 'active'
    | 'graduated'
    | 'retired'
    | 'projects'
    | 'resumes'
    | 'documents'
    | 'pending'
  tone: 'blue' | 'green' | 'purple' | 'red' | 'amber' | 'teal'
}

export const primaryStats: StatCard[] = [
  {
    id: 'total',
    label: 'Total estudiantes',
    value: '479',
    helper: '+14 este mes',
    icon: 'users',
    tone: 'blue',
  },
  {
    id: 'activos',
    label: 'Estudiantes activos',
    value: '312',
    helper: '65.1% del total',
    icon: 'active',
    tone: 'green',
  },
  {
    id: 'graduados',
    label: 'Graduados',
    value: '98',
    helper: '+8 vs. trimestre anterior',
    icon: 'graduated',
    tone: 'purple',
  },
  {
    id: 'retirados',
    label: 'Retirados',
    value: '42',
    helper: '8.8% del total',
    icon: 'retired',
    tone: 'red',
  },
  {
    id: 'docs-pendientes',
    label: 'Docs. pendientes',
    value: '37',
    helper: 'Requieren atención',
    icon: 'pending',
    tone: 'amber',
  },
]

export const secondaryStats: StatCard[] = [
  {
    id: 'proyectos-activos',
    label: 'Proyectos activos',
    value: '6',
    helper: 'En ejecución',
    icon: 'projects',
    tone: 'blue',
  },
  {
    id: 'hv-pendientes',
    label: 'Hojas de vida pendientes',
    value: '54',
    helper: 'Por generar',
    icon: 'resumes',
    tone: 'teal',
  },
  {
    id: 'proyectos-finalizados',
    label: 'Proyectos finalizados',
    value: '11',
    helper: 'En 2024',
    icon: 'projects',
    tone: 'green',
  },
  {
    id: 'documentos',
    label: 'Documentos totales',
    value: '1.4K',
    helper: 'Almacenados',
    icon: 'documents',
    tone: 'purple',
  },
]

// Estudiantes por estado (gráfico de dona)
export const studentsByStatus = [
  { estado: 'Activos', total: 312, fill: 'var(--color-activos)' },
  { estado: 'Graduados', total: 98, fill: 'var(--color-graduados)' },
  { estado: 'Retirados', total: 42, fill: 'var(--color-retirados)' },
  { estado: 'Suspendidos', total: 27, fill: 'var(--color-suspendidos)' },
]

// Estudiantes por proyecto (gráfico de barras)
export const studentsByProject = [
  { proyecto: 'Desarrollo Web', total: 128 },
  { proyecto: 'Ciberseguridad', total: 86 },
  { proyecto: 'Diseño UX/UI', total: 74 },
  { proyecto: 'Data & IA', total: 92 },
  { proyecto: 'Redes', total: 58 },
  { proyecto: 'Soporte TI', total: 41 },
]

// Ingreso de estudiantes por mes (gráfico de línea)
export const enrollmentTrend = [
  { mes: 'Ene', ingresos: 24 },
  { mes: 'Feb', ingresos: 31 },
  { mes: 'Mar', ingresos: 45 },
  { mes: 'Abr', ingresos: 38 },
  { mes: 'May', ingresos: 52 },
  { mes: 'Jun', ingresos: 47 },
  { mes: 'Jul', ingresos: 61 },
  { mes: 'Ago', ingresos: 55 },
  { mes: 'Sep', ingresos: 68 },
  { mes: 'Oct', ingresos: 72 },
  { mes: 'Nov', ingresos: 64 },
  { mes: 'Dic', ingresos: 49 },
]

export type Alert = {
  id: string
  titulo: string
  descripcion: string
  nivel: 'alta' | 'media' | 'baja'
}

export const importantAlerts: Alert[] = [
  {
    id: 'a1',
    titulo: '37 documentos vencidos',
    descripcion: 'Requieren renovación antes del 30 de julio.',
    nivel: 'alta',
  },
  {
    id: 'a2',
    titulo: '12 hojas de vida sin validar',
    descripcion: 'Pendientes de revisión por el área académica.',
    nivel: 'media',
  },
  {
    id: 'a3',
    titulo: 'Importación con errores',
    descripcion: 'El archivo de estudiantes tuvo 5 filas rechazadas.',
    nivel: 'alta',
  },
  {
    id: 'a4',
    titulo: 'Cupos limitados',
    descripcion: 'El proyecto Data & IA supera el 90% de su capacidad.',
    nivel: 'baja',
  },
]

export type Activity = {
  id: string
  titulo: string
  fecha: string
  hora: string
  categoria: string
}

export const upcomingActivities: Activity[] = [
  {
    id: 'e1',
    titulo: 'Comité académico',
    fecha: '18 jul 2026',
    hora: '09:00 a. m.',
    categoria: 'Reunión',
  },
  {
    id: 'e2',
    titulo: 'Cierre de matrículas',
    fecha: '22 jul 2026',
    hora: '05:00 p. m.',
    categoria: 'Proceso',
  },
  {
    id: 'e3',
    titulo: 'Entrega de proyectos finales',
    fecha: '25 jul 2026',
    hora: '11:00 a. m.',
    categoria: 'Académico',
  },
  {
    id: 'e4',
    titulo: 'Auditoría documental',
    fecha: '29 jul 2026',
    hora: '10:00 a. m.',
    categoria: 'Auditoría',
  },
]

export type QuickAction = {
  id: string
  label: string
  descripcion: string
  href: string
  icon: 'add-student' | 'new-project' | 'import' | 'report' | 'document' | 'resume'
}

export const quickActions: QuickAction[] = [
  {
    id: 'q1',
    label: 'Registrar estudiante',
    descripcion: 'Añade un nuevo estudiante',
    href: '/estudiantes',
    icon: 'add-student',
  },
  {
    id: 'q2',
    label: 'Crear proyecto',
    descripcion: 'Inicia un nuevo proyecto',
    href: '/proyectos',
    icon: 'new-project',
  },
  {
    id: 'q3',
    label: 'Importar datos',
    descripcion: 'Carga archivos de Excel',
    href: '/importaciones',
    icon: 'import',
  },
  {
    id: 'q4',
    label: 'Generar hoja de vida',
    descripcion: 'Documento del estudiante',
    href: '/hojas-de-vida',
    icon: 'resume',
  },
  {
    id: 'q5',
    label: 'Ver reportes',
    descripcion: 'Métricas y estadísticas',
    href: '/reportes',
    icon: 'report',
  },
  {
    id: 'q6',
    label: 'Subir documento',
    descripcion: 'Adjunta un archivo',
    href: '/documentos',
    icon: 'document',
  },
]

export type Notification = {
  id: string
  titulo: string
  detalle: string
  tiempo: string
  leida: boolean
}

export const notifications: Notification[] = [
  {
    id: 'n1',
    titulo: 'Nueva hoja de vida',
    detalle: 'Carlos Ramírez subió su hoja de vida.',
    tiempo: 'Hace 10 min',
    leida: false,
  },
  {
    id: 'n2',
    titulo: 'Importación completada',
    detalle: 'Se cargaron 48 estudiantes correctamente.',
    tiempo: 'Hace 1 h',
    leida: false,
  },
  {
    id: 'n3',
    titulo: 'Documento vencido',
    detalle: 'El certificado de Ana Gómez venció ayer.',
    tiempo: 'Hace 3 h',
    leida: false,
  },
  {
    id: 'n4',
    titulo: 'Proyecto actualizado',
    detalle: 'Se cerró la fase 2 de Ciberseguridad.',
    tiempo: 'Ayer',
    leida: true,
  },
]
