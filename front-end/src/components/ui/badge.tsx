import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all duration-200 backdrop-blur-md [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20 [a]:hover:bg-[#0071E3]/20 font-semibold",
        secondary:
          "bg-black/[0.05] text-[#1D1D1F] border-black/[0.08] [a]:hover:bg-black/[0.08]",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-black/[0.12] bg-white text-[#1D1D1F] [a]:hover:bg-black/[0.04]",
        ghost:
          "hover:bg-black/[0.04] text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
