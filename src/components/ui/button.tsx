/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 aria-selected:bg-primary aria-selected:text-white aria-selected:font-semibold aria-pressed:bg-primary aria-pressed:text-white aria-pressed:font-semibold data-[state=on]:bg-primary data-[state=on]:text-white data-[state=on]:font-semibold aria-selected:[&_svg]:text-white aria-pressed:[&_svg]:text-white data-[state=on]:[&_svg]:text-white",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        destructive: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        outline: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        secondary: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        ghost: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        link: "bg-primary text-primary-foreground border border-primary/20 shadow-sm",
        solid: "bg-primary text-primary-foreground shadow-md transition-all duration-200 border border-primary/20",
        "solid-destructive": "bg-primary text-primary-foreground shadow-md transition-all duration-200 border border-primary/20",
        "solid-secondary": "bg-primary text-primary-foreground shadow-md transition-all duration-200 border border-primary/20",
        "theme-neutral": "bg-primary text-primary-foreground border border-primary/20 shadow-sm transition-all duration-200",
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
