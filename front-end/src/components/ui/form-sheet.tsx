'use client'

/**
 * Panel lateral para crear y editar.
 *
 * <p>Los formularios de Colocaciones, Empresas y Postulaciones eran una `Card`
 * dentro de la página gobernada por un `useState`: no cerraban con Escape, ni
 * al hacer click fuera, ni tenían botón de cerrar; el único «Cancelar» estaba
 * al final de un formulario largo, fuera de la pantalla. `Sheet` ya resolvía
 * todo eso y se estaba usando en Vacantes, Estudiantes, Documentos y Auditoría
 * —simplemente no se usó aquí—.
 *
 * <p>Aporta tres cosas sobre `Sheet` pelado:
 *
 * 1. **Pie fijo.** El botón de guardar no se pierde al final del scroll, que es
 *    el problema del formulario de colocación (cuatro secciones y un checklist).
 * 2. **Guardia contra cierre accidental.** Arreglar el «no cierra» sin esto crea
 *    el problema contrario: perder media colocación tecleada por un click fuera
 *    es peor que no poder cerrar.
 * 3. **Bloqueo mientras guarda.** Cerrar a mitad de un POST deja al usuario sin
 *    saber si se guardó.
 */

import { useState } from 'react'
import { CircleNotchIcon as CircleNotch } from '@phosphor-icons/react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Confirmar } from '@/components/ui/confirmar'
import { cn } from '@/lib/utils'

export interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: React.ReactNode
  /**
   * Hay cambios sin guardar.
   *
   * <p>Cuando es cierto, cerrar por Escape o por click fuera pide confirmación.
   * El botón «Cancelar» pregunta igual: es el mismo descarte.
   */
  sucio?: boolean
  /** Guardando. Bloquea el cierre y deshabilita los botones. */
  guardando?: boolean
  /** Deshabilita «Guardar» mientras falten campos obligatorios. */
  puedeGuardar?: boolean
  textoGuardar?: string
  onGuardar: () => void
  /** Ancho del panel. Los formularios de dos columnas necesitan `xl`. */
  ancho?: 'sm' | 'lg' | 'xl' | '2xl'
  children: React.ReactNode
}

const ANCHOS = {
  sm: 'sm:max-w-sm',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
} as const

export function FormSheet({
  open,
  onOpenChange,
  titulo,
  descripcion,
  sucio = false,
  guardando = false,
  puedeGuardar = true,
  textoGuardar = 'Guardar',
  onGuardar,
  ancho = 'xl',
  children,
}: FormSheetProps) {
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  /** Punto único de cierre: Escape, click fuera, la X y «Cancelar» pasan por aquí. */
  const intentarCerrar = () => {
    if (guardando) return
    if (sucio) {
      setConfirmandoDescarte(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(abierto) => {
          if (abierto) {
            onOpenChange(true)
            return
          }
          intentarCerrar()
        }}
      >
        <SheetContent
          side="right"
          // El botón X de `SheetContent` cierra por su cuenta sin pasar por
          // `intentarCerrar`, así que se oculta y se pone uno propio en la
          // cabecera. Si no, la X se saltaría la guardia de cambios sin guardar.
          showCloseButton={false}
          className={cn('flex w-full flex-col gap-0 p-0', ANCHOS[ancho])}
        >
          <SheetHeader className="shrink-0 border-b border-border p-5 pr-14">
            <SheetTitle>{titulo}</SheetTitle>
            {descripcion && <SheetDescription>{descripcion}</SheetDescription>}
          </SheetHeader>

          <button
            type="button"
            onClick={intentarCerrar}
            disabled={guardando}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>

          {/* `min-h-0` hace falta para que el hijo con overflow pueda encogerse
              dentro del flex; sin él, el scroll se va al panel entero y el pie
              deja de estar fijo. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

          <div className="shrink-0 border-t border-border bg-card p-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={intentarCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={onGuardar} disabled={!puedeGuardar || guardando}>
                {guardando ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" /> Guardando…
                  </>
                ) : (
                  textoGuardar
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Confirmar
        open={confirmandoDescarte}
        onOpenChange={setConfirmandoDescarte}
        titulo="¿Descartar los cambios?"
        descripcion="Lo que escribiste en este formulario se perderá."
        textoConfirmar="Descartar"
        textoCancelar="Seguir editando"
        onConfirmar={() => {
          setConfirmandoDescarte(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
