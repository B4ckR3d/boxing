import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "crimson" | "white" | "outline" | "dark" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "crimson", size = "md", asChild = false, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-display uppercase tracking-wider font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus:outline-none";

    const variants = {
      crimson:
        "bg-fight-red text-ink border border-fight-red hover:bg-fight-red-hover hover:border-fight-red-hover active:translate-y-0 shadow-sm",
      white:
        "bg-charcoal text-ink border border-hard hover:bg-surface-elevated active:translate-y-0",
      dark:
        "bg-charcoal text-ink border border-border-subtle hover:bg-surface-elevated hover:border-ink-muted active:translate-y-0",
      outline:
        "bg-transparent text-ink border border-ink-muted hover:border-ink hover:bg-ink hover:text-canvas active:translate-y-0",
      ghost:
        "bg-transparent text-ink hover:text-fight-red hover:bg-charcoal/5",
    };

    const sizes = {
      sm: "text-xs px-3.5 py-1.5",
      md: "text-xs sm:text-sm px-5 py-2.5",
      lg: "text-sm sm:text-base px-6 py-3",
      xl: "text-base sm:text-lg px-8 py-3.5",
    };

    const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();

    // asChild renders the caller's element (usually a <Link>) with button styling instead of
    // nesting a <button> inside an <a>. Nesting interactive controls breaks the a11y tree and
    // produces overlapping click targets.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: `${classes} ${child.props.className ?? ""}`.trim(),
        ref,
      } as Partial<{ className: string }>);
    }

    return (
      <button
        ref={ref}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
