import Link from 'next/link'
import {
  UserPlus,
  FolderPlus,
  Upload,
  FileBarChart,
  FilePlus,
  FileUser,
  type LucideIcon,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { quickActions, type QuickAction } from '@/lib/mock-data'

const iconMap: Record<QuickAction['icon'], LucideIcon> = {
  'add-student': UserPlus,
  'new-project': FolderPlus,
  import: Upload,
  report: FileBarChart,
  document: FilePlus,
  resume: FileUser,
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
                className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.descripcion}</span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
