import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // `appearance-none` y las dos reglas de `-webkit-search-*`: un
        // `input[type=search]` conserva el dibujo nativo del sistema, que en
        // Windows pinta su propio recuadro y su crucecita dentro del borde que
        // ya dibuja este componente. Se veía como una caja metida en otra caja,
        // y con un estilo que no es el de la aplicación.
        "h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-card/90 px-3.5 py-2 text-sm transition-all duration-200 outline-none text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 shadow-[inset_0_1px_2px_rgba(15,23,42,0.025)] dark:bg-slate-950/35 dark:text-slate-100 dark:placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Input }
