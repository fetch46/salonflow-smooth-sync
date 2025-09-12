/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary/20 shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "bg-background text-foreground border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
        solid: "bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90",
        "solid-destructive": "bg-destructive text-destructive-foreground shadow-md transition-all duration-200 hover:bg-destructive/90",
        "solid-secondary": "bg-secondary text-secondary-foreground shadow-md transition-all duration-200 hover:bg-secondary/80",
        "theme-neutral": "bg-muted text-muted-foreground border border-muted/50 shadow-sm hover:bg-muted/80",
        whatsapp: "bg-[#25D366] text-white border border-[#25D366]/20 shadow-sm hover:bg-[#1EBE57] focus-visible:ring-[#25D366]",
      },
      size: {
        default: "h-9 px-4 py-2 text-responsive-sm",
        sm: "h-8 rounded-md px-3 text-responsive-xs",
        lg: "h-10 rounded-md px-8 text-responsive-base",
        xl: "h-12 rounded-md px-10 text-responsive-lg",
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
