import { CalendarClock } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { upcomingActivities } from '@/lib/mock-data'

export function ActivitiesCard() {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Próximas actividades</CardTitle>
        <CardDescription>Agenda de los próximos días</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {upcomingActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {activity.titulo}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {activity.categoria}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {activity.fecha} · {activity.hora}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
