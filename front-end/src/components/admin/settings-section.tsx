'use client'

/**
 * Bloques de un formulario de configuración.
 *
 * Estaban definidos dentro de la propia página de configuración, así que solo
 * podían usarlos las secciones que vivieran en ese mismo archivo —y eso es
 * parte de por qué el archivo llegó a 1288 líneas—.
 */

import type { LucideIcon as Icon } from 'lucide-react'
import type { ReactNode } from 'react'

export function SettingsSection({
  icon: IconComponent,
  title,
  description,
  children,
}: {
  icon: Icon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="group/section rounded-2xl border border-white/65 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_14px_34px_-28px_rgba(24,65,120,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-primary/20 hover:bg-card/50 dark:border-white/10 dark:bg-slate-950/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_38px_-30px_rgba(0,0,0,0.8)] sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-300 group-hover/section:scale-105">
          <IconComponent className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="text-[13px] font-semibold leading-none text-foreground/85">
      {children}
      {required && <span className="ml-1 text-primary">*</span>}
    </label>
  )
}
