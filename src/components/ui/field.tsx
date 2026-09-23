import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-11", invalid ? "border-attention" : "border-border", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        base,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b6478' stroke-width='2.5'><path d='m6 9 6 6 6-6'/></svg>\")] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9",
        invalid ? "border-attention" : "border-border",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-24 border-border py-2.5", className)} {...props} />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-foreground/80", className)} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-attention">{message}</p>;
}

/**
 * Campo com rótulo. Por padrão envolve o controle num <label> (associação implícita,
 * acessível e clicável). Use group para conjuntos de botões (renderiza <div>).
 */
export function Field({ label, error, children, className, group }: { label: string; error?: string; children: React.ReactNode; className?: string; group?: boolean }) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</span>
      {children}
      <FieldError message={error} />
    </Wrapper>
  );
}
