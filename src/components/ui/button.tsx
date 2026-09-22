import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-[0_8px_24px_-8px_rgba(61,90,254,0.7)] hover:bg-primary-hover",
        secondary: "bg-white text-foreground border border-border hover:bg-subtle",
        ghost: "text-foreground hover:bg-subtle",
        dark: "bg-white/10 text-white border border-white/15 hover:bg-white/15 backdrop-blur",
        whatsapp: "bg-[#1fa855] text-white hover:bg-[#1b9449] shadow-[0_8px_24px_-8px_rgba(31,168,85,0.7)]",
        danger: "bg-attention text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-6 text-base tracking-wide",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
