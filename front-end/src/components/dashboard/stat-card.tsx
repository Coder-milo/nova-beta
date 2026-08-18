import { ArrowDownRight, ArrowUpRight, FileText, GraduationCap, SquareKanban as Kanban, FileUser as ReadCvLogo, UserCheck, UserMinus, Users, TriangleAlert as Warning } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatCard as StatCardType } from '@/lib/mock-data'

const iconMap: Record<StatCardType['icon'], LucideIcon> = {
  users: Users,
  active: UserCheck,
  graduated: GraduationCap,
  retired: UserMinus,
  projects: Kanban,
  resumes: ReadCvLogo,
  documents: FileText,
  pending: Warning,
}

/**
 * Cada tono apunta al color que dice su nombre.
 *
 * Antes no: `amber` daba el morado de `--chart-3`, `red` el naranja de
 * `--chart-4` y `teal` el rojo de `--chart-5`. La tarjeta de retirados —que
 * pide `red`— salía naranja, y la de documentos pendientes —`amber`— salía
 * morada, de modo que el color no significaba nada y había que leer la etiqueta
 * igualmente. El cian no está entre las series de gráfico y viene del panel.
 */
const toneVar: Record<StatCardType['tone'], string> = {
  blue: 'var(--chart-1)',
  green: 'var(--chart-2)',
  purple: 'var(--chart-3)',
  amber: 'var(--chart-4)',
  red: 'var(--chart-5)',
  teal: 'var(--panel-cian, #17A2B8)',
}

/**
 * Indicador numérico del tablero.
 *
 * Es la pieza que más se repite en pantalla —nueve seguidas en el dashboard—,
 * así que su altura marca cuánto hay que desplazarse para llegar a los
 * gráficos. Con el relleno anterior (24 px) y la cifra a 34 px, las dos filas
 * de indicadores se comían la primera pantalla entera.
 *
 * El orden de lectura es cifra, variación, etiqueta. La etiqueta va debajo y en
 * gris: dice qué se está midiendo, que es lo que ya sabes cuando vuelves a la
 * misma pantalla por décima vez, mientras que la cifra es lo que cambia.
 */
export function StatCard({ stat }: { stat: StatCardType }) {
  const Icon = iconMap[stat.icon]
  const color = toneVar[stat.tone]
  const FlechaDelta = stat.delta?.signo === 'baja' ? ArrowDownRight : ArrowUpRight

  return (
    <Card className="gap-0 shadow-none">
      <CardContent className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[1.375rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {stat.value}
          </span>
          {/* El icono es una ayuda de reconocimiento, no el protagonista: se
              queda al margen, sin recuadro ni fondo que le den peso propio. */}
          <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden="true" />
        </div>

        <span className="truncate text-xs font-medium text-muted-foreground">
          {stat.label}
        </span>

        {(stat.delta || stat.helper) && (
          <div className="flex min-w-0 items-center gap-1.5">
            {stat.delta && (
              <span className="panel-delta" data-signo={stat.delta.signo}>
                {stat.delta.signo !== 'neutro' && (
                  <FlechaDelta className="size-3" aria-hidden="true" />
                )}
                {stat.delta.texto}
              </span>
            )}
            {stat.helper && (
              <span className="truncate text-[11px] leading-snug text-muted-foreground tabular-nums">
                {stat.helper}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
