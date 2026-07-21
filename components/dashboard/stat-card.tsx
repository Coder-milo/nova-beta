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
    <Card className="gap-0 rounded-xl shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              color,
              backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
            }}
          >
            <Icon className="size-[18px]" />
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {stat.value}
          </span>
          {stat.helper && (
            <span className="text-xs text-muted-foreground">{stat.helper}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
