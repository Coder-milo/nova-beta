'use client'

/**
 * Confirmación de una acción que no se puede deshacer.
 *
 * <p>Había tres formas de preguntar lo mismo: `confirm()` nativo en Documentos,
 * Proyectos y Configuración; un modal a mano en `estudiantes/page.tsx`; y en
 * Postulaciones no se preguntaba nada —`eliminar` borraba y ya—. El `confirm()`
 * del navegador bloquea el hilo, no se puede estilar y en algunos navegadores
 * ofrece "impedir que esta página cree más diálogos", que deja la aplicación
 * muda sin avisar.
 *
 * <p>Se monta sobre la misma primitiva que `Sheet` (`@base-ui/react/dialog`),
 * así que cierra con Escape y con click fuera, y devuelve el foco al elemento
 * que lo abrió.
 */

import { useCallback, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { CircleNotchIcon as CircleNotch, WarningCircleIcon as WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ConfirmarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion?: React.ReactNode
  /** Texto del botón que ejecuta. Debe nombrar la acción, no decir "Aceptar". */
  textoConfirmar?: string
  textoCancelar?: string
  /** Rojo para lo destructivo. Por defecto sí, que es el caso habitual. */
  destructivo?: boolean
  onConfirmar: () => void | Promise<void>
}

export function Confirmar({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  destructivo = true,
  onConfirmar,
}: ConfirmarProps) {
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async () => {
    setOcupado(true)
    try {
      await onConfirmar()
      onOpenChange(false)
    } finally {
      // Se libera pase lo que pase: si falla, el diálogo sigue abierto y quien
      // maneje el error decidirá qué mostrar, pero el botón no puede quedarse
      // girando para siempre.
      setOcupado(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      // Mientras se ejecuta no se cierra: cancelar a medias deja al usuario sin
      // saber si la acción llegó a hacerse.
      onOpenChange={(abierto) => !ocupado && onOpenChange(abierto)}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-lg',
            'transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0',
            'data-starting-style:scale-95 data-starting-style:opacity-0',
          )}
        >
          <div className="flex items-start gap-3">
            <WarningCircle
              className={cn('mt-0.5 size-6 shrink-0', destructivo ? 'text-destructive' : 'text-amber-500')}
              weight="duotone"
            />
            <div className="min-w-0">
              <Dialog.Title className="text-sm font-semibold text-foreground">{titulo}</Dialog.Title>
              {descripcion && (
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {descripcion}
                </Dialog.Description>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={ocupado}>
              {textoCancelar}
            </Button>
            <Button
              variant={destructivo ? 'destructive' : 'default'}
              size="sm"
              onClick={ejecutar}
              disabled={ocupado}
            >
              {ocupado ? (
                <>
                  <CircleNotch className="size-4 animate-spin" /> Procesando…
                </>
              ) : (
                textoConfirmar
              )}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Lo que pide `confirmar()`, sin las props de control que gestiona el hook. */
export type OpcionesConfirmar = Pick<
  ConfirmarProps,
  'titulo' | 'descripcion' | 'textoConfirmar' | 'textoCancelar' | 'destructivo'
>

/**
 * Reemplazo imperativo de `confirm()` nativo.
 *
 * <p>Devuelve `confirmar(opts)`, una promesa que resuelve `true` si la persona
 * acepta y `false` si cancela o cierra —igual que el `confirm()` del navegador,
 * pero con el diálogo estilado de la app—. El control de flujo queda idéntico:
 *
 * <pre>if (!(await confirmar({ titulo: '¿Eliminar?' }))) return</pre>
 *
 * <p>Hay que montar el elemento `dialogo` que también devuelve, una vez, en el
 * árbol del componente.
 */
export function useConfirmar() {
  const [pendiente, setPendiente] = useState<{
    opts: OpcionesConfirmar
    resolver: (aceptado: boolean) => void
  } | null>(null)

  const confirmar = useCallback(
    (opts: OpcionesConfirmar) =>
      new Promise<boolean>((resolver) => setPendiente({ opts, resolver })),
    [],
  )

  // Resuelve una sola vez: al cerrar tras aceptar, el segundo intento ve
  // `actual === null` y no vuelve a resolver.
  const cerrar = (aceptado: boolean) =>
    setPendiente((actual) => {
      actual?.resolver(aceptado)
      return null
    })

  const dialogo = pendiente ? (
    <Confirmar
      open
      onOpenChange={(abierto) => {
        if (!abierto) cerrar(false)
      }}
      titulo={pendiente.opts.titulo}
      descripcion={pendiente.opts.descripcion}
      textoConfirmar={pendiente.opts.textoConfirmar}
      textoCancelar={pendiente.opts.textoCancelar}
      destructivo={pendiente.opts.destructivo}
      onConfirmar={() => cerrar(true)}
    />
  ) : null

  return { confirmar, dialogo }
}
