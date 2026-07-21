import {
  Users,
  UserCheck,
  GraduationCap,
  UserMinus,
  FolderKanban,
  FileUser,
  FileText,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatCard as StatCardType } from '@/lib/mock-data'

const iconMap: Record<StatCardType['icon'], LucideIcon> = {
  users: Users,
  active: UserCheck,
  graduated: GraduationCap,
  retired: UserMinus,
  projects: FolderKanban,
  resumes: FileUser,
  documents: FileText,
  pending: AlertTriangle,
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
      <CardContent className="flex flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {stat.label}
          </span>
          <Icon className="size-4 shrink-0" style={{ color }} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {stat.value}
          </span>
          {stat.helper && (
            <span className="text-xs text-muted-foreground tabular-nums">{stat.helper}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
