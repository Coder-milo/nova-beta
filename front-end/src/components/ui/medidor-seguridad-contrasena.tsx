import React from 'react'
import { Check, X } from 'lucide-react'
import { evaluarSeguridadContrasena } from '@/lib/seguridad-contrasena'

export { evaluarSeguridadContrasena }
export type { CriterioSeguridad, ResultadoSeguridad } from '@/lib/seguridad-contrasena'

interface MedidorSeguridadContrasenaProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  mostrarCriterios?: boolean
}

export const MedidorSeguridadContrasena = React.forwardRef<HTMLDivElement, MedidorSeguridadContrasenaProps>(
  ({ value, mostrarCriterios = true, className = '', ...props }, ref) => {
    const evaluacion = evaluarSeguridadContrasena(value)

    if (!value) return null

    return (
      <div ref={ref} className={`space-y-2 pt-1 text-xs ${className}`} {...props}>
        {/* Barra de 4 segmentos */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-muted-foreground">Seguridad de la contraseña:</span>
            <span className={`font-semibold ${evaluacion.colorTextoClase}`}>{evaluacion.etiqueta}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full rounded-full overflow-hidden bg-muted/60">
            {[1, 2, 3, 4].map((seg) => (
              <div
                key={seg}
                className={`h-full rounded-full transition-all duration-300 ${
                  seg <= evaluacion.puntaje ? evaluacion.colorClase : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Lista de criterios */}
        {mostrarCriterios && (
          <div className="grid gap-1 pt-1 sm:grid-cols-2 text-[11px] text-muted-foreground">
            {evaluacion.criterios.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                {c.cumplido ? (
                  <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold" />
                ) : (
                  <X className="size-3.5 shrink-0 text-muted-foreground/60" />
                )}
                <span className={c.cumplido ? 'text-foreground font-medium' : ''}>{c.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

MedidorSeguridadContrasena.displayName = 'MedidorSeguridadContrasena'
