import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FolderKanban,
  GraduationCap,
  FileUser,
  Upload,
  FileText,
  BarChart3,
  ShieldCheck,
  PieChart,
  Settings,
} from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Proyectos', href: '/proyectos', icon: FolderKanban },
  { title: 'Estudiantes', href: '/estudiantes', icon: GraduationCap },
  { title: 'Hojas de vida', href: '/hojas-de-vida', icon: FileUser },
  { title: 'Importaciones', href: '/importaciones', icon: Upload },
  { title: 'Documentos', href: '/documentos', icon: FileText },
  { title: 'Reportes', href: '/reportes', icon: BarChart3 },
  { title: 'Auditoría', href: '/auditoria', icon: ShieldCheck },
  { title: 'Power BI', href: '/power-bi', icon: PieChart },
  { title: 'Configuración', href: '/configuracion', icon: Settings },
]
