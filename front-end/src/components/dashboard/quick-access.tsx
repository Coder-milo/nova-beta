import { FilePlus, FolderPlus, Presentation, FileUser as ReadCvLogo, Upload as UploadSimple, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from '@/compat/next-link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { quickActions, type QuickAction } from '@/lib/mock-data'
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

const iconMap: Record<QuickAction['icon'], LucideIcon> = {
  'add-student': UserPlus,
  'new-project': FolderPlus,
  import: UploadSimple,
  report: Presentation,
  document: FilePlus,
  resume: ReadCvLogo,
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
        tareasFrecuentesDel: 'Common panel tasks',
        accesosRapidos: 'Quick links',
      }
    : {
        tareasFrecuentesDel: 'Tareas frecuentes del panel',
        accesosRapidos: 'Accesos rápidos',
      }
}

export function QuickAccess() {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
  return (
    <Card className="gap-0 shadow-none">
      <CardHeader className="border-b border-[var(--panel-borde)] px-4 pb-2.5">
        <CardTitle className="text-sm">{T.accesosRapidos}</CardTitle>
        <CardDescription className="text-xs">{T.tareasFrecuentesDel}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Rejilla a hueso: las celdas se separan por el filete que comparten,
            no por espacio más borde propio. */}
        <div className="grid grid-cols-2 gap-px bg-[var(--panel-borde)] sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = iconMap[action.icon]
            return (
              <Link
                key={action.id}
                href={action.href}
                className="group flex min-w-0 flex-col gap-1 bg-[var(--panel-superficie)] p-3 transition-colors hover:bg-[var(--panel-superficie-tenue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                {/* El icono seguía un azul escrito a fuego, así que era de lo
                    poco del panel que no se enteraba del color del proyecto. */}
                <span className="mb-0.5 flex size-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="truncate text-[13px] font-semibold text-foreground">{action.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{action.descripcion}</span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
