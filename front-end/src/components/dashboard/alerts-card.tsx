import { ArrowRightIcon as ArrowRight, InfoIcon as Info, WarningIcon as Warning } from '@phosphor-icons/react/ssr'
import Link from '@/compat/next-link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SampleDataBadge } from '@/components/dashboard/sample-data-badge'
import { cn } from '@/lib/utils'
import { importantAlerts } from '@/lib/mock-data'
import type { AlertaResponse } from '@/lib/types'

/** Mapeo de la severidad del backend a la UI. */
const severityConfig: Record<
  string,
  { label: string; icon: typeof Warning; dot: string; badge: string }
> = {
  ALTA: {
    label: 'Alta',
    icon: Warning,
    dot: 'text-[#E53649]',
    badge: 'border-transparent bg-[#E53649]/20 text-[#E53649]',
  },
  MEDIA: {
    label: 'Media',
    icon: Warning,
    dot: 'text-[#F59E0B]',
    badge: 'border-transparent bg-[#F59E0B]/20 text-[#F59E0B]',
  },
  BAJA: {
    label: 'Baja',
    icon: Info,
    dot: 'text-[#2563EB]',
    badge: 'border-transparent bg-[#2563EB]/20 text-[#2563EB]',
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
          ruta: null,
        }))

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Alertas importantes</CardTitle>
          {alerts === null && <SampleDataBadge />}
        </div>
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
            const content = (
              <>
                <Icon className={cn('mt-0.5 size-[18px] shrink-0', config.dot)} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{alert.titulo}</span>
                    <Badge className={cn('shrink-0', config.badge)}>{config.label}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.detalle}</span>
                </div>
                {alert.ruta && <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
              </>
            )
            const key = alert.referenciaId ?? `${alert.tipo}-${i}`
            return alert.ruta ? (
              <Link
                key={key}
                href={alert.ruta}
                className="group flex items-start gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] p-3 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.06] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`${alert.titulo}. Abrir detalle`}
              >
                {content}
              </Link>
            ) : (
              <div key={key} className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] p-3">
                {content}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
