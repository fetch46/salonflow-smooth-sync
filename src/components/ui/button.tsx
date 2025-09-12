/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:font-semibold aria-selected:[&_svg]:text-primary-foreground aria-pressed:[&_svg]:text-primary-foreground data-[state=on]:[&_svg]:text-primary-foreground",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary/20 shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground border border-destructive/20 shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive",
        outline: "bg-background text-foreground border border-border hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground border border-secondary/40 shadow-sm hover:bg-secondary/80",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        link: "bg-transparent text-[hsl(var(--link))] underline underline-offset-4 hover:text-[hsl(var(--link-hover))] focus-visible:ring-ring",
        solid: "bg-primary text-primary-foreground shadow-md transition-all duration-200 border border-primary/20 hover:bg-primary/90",
        "solid-destructive": "bg-destructive text-destructive-foreground shadow-md transition-all duration-200 border border-destructive/20 hover:bg-destructive/90",
        "solid-secondary": "bg-secondary text-secondary-foreground shadow-md transition-all duration-200 border border-secondary/40 hover:bg-secondary/80",
        "theme-neutral": "bg-muted text-muted-foreground border border-muted/50 shadow-sm transition-all duration-200 hover:bg-muted/80",
        whatsapp: "bg-[#25D366] text-white border border-[#25D366]/20 shadow-sm hover:bg-[#1EBE57] focus-visible:ring-[#25D366]",
      },
      size: {
        default: "h-9 px-4 py-2 text-responsive-sm",
        sm: "h-8 rounded-sm px-3 text-responsive-xs",
        lg: "h-10 rounded-sm px-8 text-responsive-base",
        xl: "h-12 rounded-sm px-10 text-responsive-lg",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
