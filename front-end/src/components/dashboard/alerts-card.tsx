import { ArrowRight, Info, TriangleAlert as Warning } from 'lucide-react'
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
import { usePreferences } from '@/lib/preferences'
import { textosAdmin } from '@/lib/textos-admin'

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

/**
 * Textos propios de esta pantalla.
 *
 * Lo que se repite en varias pantallas de gestion sale de
 * `textosAdmin`; aqui solo va lo que es de esta y de ninguna otra.
 */
function textos(english: boolean) {
  return english
    ? {
        situacionesQueRequieren: 'Situations that need your attention',
        sinAlertasActivas: 'No active alerts. All good!',
      }
    : {
        situacionesQueRequieren: 'Situaciones que requieren tu atención',
        sinAlertasActivas: 'Sin alertas activas. ¡Todo en orden!',
      }
}

export function AlertsCard({ alerts }: Props) {
  const { locale } = usePreferences()
  const T = textos(locale === 'en')
  const C = textosAdmin(locale === 'en')
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
    <Card className="gap-0 shadow-none">
      {/* La cabecera se separa del cuerpo con una línea en vez de con espacio:
          a esta densidad el hueco solo no basta para leerla como cabecera. */}
      <CardHeader className="border-b border-[var(--panel-borde)] px-4 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Alertas importantes</CardTitle>
          {alerts === null && <SampleDataBadge />}
        </div>
        <CardDescription className="text-xs">{T.situacionesQueRequieren}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {T.sinAlertasActivas}
          </p>
        ) : (
          /*
           * Lista dividida por filetes, no una pila de tarjetas dentro de otra
           * tarjeta. Cada alerta llevaba su propio borde y su propio fondo, de
           * modo que la tarjeta contenedora repetía el marco tantas veces como
           * alertas hubiera y el conjunto se leía como cinco cajas sueltas.
           */
          <ul className="divide-y divide-[var(--panel-borde)]">
            {items.map((alert, i) => {
              const config = severityConfig[alert.severidad] ?? defaultConfig
              const Icon   = config.icon
              const content = (
                <>
                  <Icon className={cn('mt-px size-4 shrink-0', config.dot)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-foreground">{alert.titulo}</span>
                      <Badge className={cn('shrink-0', config.badge)}>{config.label}</Badge>
                    </div>
                    <span className="text-xs leading-snug text-muted-foreground">{alert.detalle}</span>
                  </div>
                  {alert.ruta && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
                </>
              )
              const key = alert.referenciaId ?? `${alert.tipo}-${i}`
              return (
                <li key={key}>
                  {alert.ruta ? (
                    <Link
                      href={alert.ruta}
                      className="group flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--panel-superficie-tenue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      aria-label={`${alert.titulo}. Abrir detalle`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5 px-4 py-2.5">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
