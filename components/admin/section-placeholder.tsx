import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type SectionPlaceholderProps = {
  title: string
  description: string
  icon: LucideIcon
}

export function SectionPlaceholder({
  title,
  description,
  icon: Icon,
}: SectionPlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="rounded-xl border-dashed shadow-none">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-7" />
          </span>
          <div className="flex max-w-md flex-col gap-1.5">
            <h3 className="text-base font-semibold text-foreground">
              Sección en construcción
            </h3>
            <p className="text-sm text-muted-foreground text-pretty">
              El módulo de {title.toLowerCase()} estará disponible próximamente. Aquí podrás
              gestionar toda la información relacionada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
