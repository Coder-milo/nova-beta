'use client'

import { useState } from 'react'
import { ArrowRight, ChevronDown, CircleAlert, LoaderCircle, Target, Users } from 'lucide-react'
import Link from '@/compat/next-link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CentroAccionCopiloto, PrioridadCopiloto } from '@/lib/types'

function badge(prioridad: PrioridadCopiloto): 'destructive' | 'outline' {
  return prioridad === 'ALTA' ? 'destructive' : 'outline'
}

export function CentroAccion({ datos, cargando, error, english }: {
  datos: CentroAccionCopiloto | null
  cargando: boolean
  error: boolean
  english: boolean
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const grupos = datos?.grupos ?? []
  const ranking = datos?.ranking ?? []

  return <Card className="gap-0 shadow-none">
    <CardHeader className="border-b border-[var(--panel-borde)] px-4 pb-3">
      <CardTitle className="flex items-center gap-2 text-sm"><Target className="size-4 text-primary" />{english ? 'Action centre' : 'Centro de acción'}</CardTitle>
      <CardDescription>{english ? 'Who needs attention, why and where to act.' : 'Quién necesita atención, por qué y dónde actuar.'}</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      {cargando && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />{english ? 'Analysing current processes…' : 'Analizando los procesos actuales…'}</div>}
      {!cargando && error && <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"><CircleAlert className="size-5 text-destructive" />{english ? 'The action centre is temporarily unavailable.' : 'El centro de acción no está disponible temporalmente.'}</div>}
      {!cargando && !error && grupos.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">{english ? 'No intervention groups were detected.' : 'No se detectaron grupos de intervención.'}</div>}
      {!cargando && !error && grupos.length > 0 && <div className="grid lg:grid-cols-[1.2fr_.8fr]">
        <section className="divide-y divide-[var(--panel-borde)] border-b border-[var(--panel-borde)] lg:border-b-0 lg:border-r">
          <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{english ? 'Today, focus on' : 'Hoy debes enfocarte en'}</p>
          {grupos.slice(0, 6).map((grupo) => {
            const expandido = abierto === grupo.codigo
            return <div key={grupo.codigo}>
              <button type="button" onClick={() => setAbierto(expandido ? null : grupo.codigo)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40" aria-expanded={expandido}>
                <CircleAlert className={`size-4 shrink-0 ${grupo.prioridad === 'ALTA' ? 'text-destructive' : 'text-warning'}`} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{english ? grupo.tituloEn : grupo.tituloEs}</span><span className="text-xs text-muted-foreground">{grupo.total} {english ? 'student(s)' : 'estudiante(s)'}</span></span>
                <Badge variant={badge(grupo.prioridad)}>{grupo.prioridad}</Badge><ChevronDown className={`size-4 transition-transform ${expandido ? 'rotate-180' : ''}`} />
              </button>
              {expandido && <div className="border-t border-[var(--panel-borde)] bg-muted/20 px-4 py-2">
                {grupo.estudiantes.map((persona) => <Link key={persona.estudianteId} href={persona.ruta} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-background"><span className="min-w-0"><b className="block truncate">{persona.nombre}</b><span className="line-clamp-1 text-xs text-muted-foreground">{english ? persona.motivoEn : persona.motivoEs}</span></span><ArrowRight className="size-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" /></Link>)}
              </div>}
            </div>
          })}
        </section>
        <section>
          <p className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><Users className="size-3.5" />{english ? 'Intervention ranking' : 'Ranking de intervención'}</p>
          <ol className="divide-y divide-[var(--panel-borde)]">{ranking.slice(0, 6).map((persona, indice) => <li key={persona.estudianteId}><Link href={persona.ruta} className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{indice + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{persona.nombre}</span><span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{english ? persona.motivoEn : persona.motivoEs}</span></span><ArrowRight className="mt-1 size-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" /></Link></li>)}</ol>
        </section>
      </div>}
    </CardContent>
  </Card>
}
