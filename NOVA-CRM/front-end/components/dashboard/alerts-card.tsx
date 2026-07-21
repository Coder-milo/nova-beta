import { AlertTriangle, Info, TriangleAlert } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { importantAlerts } from '@/lib/mock-data'
import type { AlertaResponse } from '@/lib/types'

/** Mapeo de la severidad del backend a la UI. */
const severityConfig: Record<
  string,
  { label: string; icon: typeof AlertTriangle; dot: string; badge: string }
> = {
  ALTA: {
    label: 'Alta',
    icon: TriangleAlert,
    dot: 'text-destructive',
    badge: 'border-transparent bg-destructive/10 text-destructive',
  },
  MEDIA: {
    label: 'Media',
    icon: AlertTriangle,
    dot: 'text-warning',
    badge: 'border-transparent bg-warning/15 text-warning-foreground',
  },
  BAJA: {
    label: 'Baja',
    icon: Info,
    dot: 'text-primary',
    badge: 'border-transparent bg-primary/10 text-primary',
  },
}

// Fallback para severidades desconocidas
const defaultConfig = severityConfig.MEDIA

interface Props {
  /**
   * Alertas del backend (GET /api/v1/dashboard/alerts).
   * null → usar mock-data.
   */
  alerts: AlertaResponse[] | null
}

export function AlertsCard({ alerts }: Props) {
  // Convertir mock-data al mismo shape que AlertaResponse para reutilizar el render
  const items: AlertaResponse[] =
    alerts !== null
      ? alerts
      : importantAlerts.map((a) => ({
          tipo: a.id,
          severidad: a.nivel.toUpperCase(),
          titulo: a.titulo,
          detalle: a.descripcion,
          referenciaId: null,
        }))

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Alertas importantes</CardTitle>
        <CardDescription>Situaciones que requieren tu atención</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin alertas activas. ¡Todo en orden!
          </p>
        ) : (
          items.map((alert, i) => {
            const config = severityConfig[alert.severidad] ?? defaultConfig
            const Icon   = config.icon
            return (
              <div
                key={alert.referenciaId ?? `${alert.tipo}-${i}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3"
              >
                <Icon className={cn('mt-0.5 size-[18px] shrink-0', config.dot)} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{alert.titulo}</span>
                    <Badge className={cn('shrink-0', config.badge)}>{config.label}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.detalle}</span>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
