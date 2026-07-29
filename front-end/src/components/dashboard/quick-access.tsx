import { FilePlus, FolderPlus, Presentation, ReadCvLogo, UploadSimple, UserPlus } from '@phosphor-icons/react/ssr'
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

const iconMap: Record<QuickAction['icon'], PhosphorIcon> = {
  'add-student': UserPlus,
  'new-project': FolderPlus,
  import: UploadSimple,
  report: Presentation,
  document: FilePlus,
  resume: ReadCvLogo,
}

export function QuickAccess() {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Accesos rápidos</CardTitle>
        <CardDescription>Tareas frecuentes del panel</CardDescription>
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
