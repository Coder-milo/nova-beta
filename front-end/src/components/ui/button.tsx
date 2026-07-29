import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97] active:duration-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-primary/20 shadow-[0_1px_2px_rgba(0,0,0,0.10),0_8px_18px_-10px_rgba(18,104,232,0.75)] hover:brightness-105 hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(0,0,0,0.10),0_14px_26px_-12px_rgba(18,104,232,0.72)]",
        outline:
          "border-border bg-card/85 backdrop-blur-md text-foreground hover:border-primary/25 hover:bg-accent hover:text-accent-foreground hover:-translate-y-px hover:shadow-sm",
        secondary:
          "border-border/70 bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-px hover:shadow-sm",
        ghost:
          "hover:bg-accent text-foreground/80 hover:text-accent-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/[0.16] border-destructive/15 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8.5 gap-1.5 px-3 rounded-xl has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6.5 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7.5 gap-1.5 rounded-xl px-2.5 text-[0.825rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 rounded-xl text-base",
        icon: "size-8.5 rounded-xl",
        "icon-xs": "size-6.5 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7.5 rounded-xl",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const isNativeButton =
    nativeButton ??
    (render && typeof render === "object" && "type" in render
      ? render.type === "button"
      : undefined)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={isNativeButton}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
