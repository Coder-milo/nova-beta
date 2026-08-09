import { FilePlusIcon as FilePlus, FolderPlusIcon as FolderPlus, PresentationIcon as Presentation, ReadCvLogoIcon as ReadCvLogo, UploadSimpleIcon as UploadSimple, UserPlusIcon as UserPlus } from '@phosphor-icons/react/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
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

const iconMap: Record<QuickAction['icon'], PhosphorIcon> = {
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
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>{T.accesosRapidos}</CardTitle>
        <CardDescription>{T.tareasFrecuentesDel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = iconMap[action.icon]
            return (
              <Link
                key={action.id}
                href={action.href}
                className="flex flex-col items-start gap-2 rounded-xl border border-black/[0.08] bg-black/[0.02] p-4 transition-all hover:border-black/[0.15] hover:bg-black/[0.04]"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#0071E3] text-white shadow-xs">
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-sm font-semibold text-foreground">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.descripcion}</span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
