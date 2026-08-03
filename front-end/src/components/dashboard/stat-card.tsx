import { FileTextIcon as FileText, GraduationCapIcon as GraduationCap, KanbanIcon as Kanban, ReadCvLogoIcon as ReadCvLogo, UserCheckIcon as UserCheck, UserMinusIcon as UserMinus, UsersIcon as Users, WarningIcon as Warning } from '@phosphor-icons/react/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatCard as StatCardType } from '@/lib/mock-data'

const iconMap: Record<StatCardType['icon'], PhosphorIcon> = {
  users: Users,
  active: UserCheck,
  graduated: GraduationCap,
  retired: UserMinus,
  projects: Kanban,
  resumes: ReadCvLogo,
  documents: FileText,
  pending: Warning,
}

const toneVar: Record<StatCardType['tone'], string> = {
  blue: 'var(--chart-1)',
  green: 'var(--chart-2)',
  amber: 'var(--chart-3)',
  red: 'var(--chart-4)',
  teal: 'var(--chart-5)',
  purple: 'var(--primary)',
}

export function StatCard({ stat }: { stat: StatCardType }) {
  const Icon = iconMap[stat.icon]
  const color = toneVar[stat.tone]

  return (
    <Card className="gap-0 rounded-lg border-border shadow-none">
      <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase leading-snug tracking-[0.07em] text-muted-foreground">
            {stat.label}
          </span>
          <Icon className="size-5 shrink-0" style={{ color }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[34px] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {stat.value}
          </span>
          {stat.helper && (
            <span className="text-[13px] font-medium leading-snug text-muted-foreground tabular-nums">{stat.helper}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
