import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "crimson" | "white" | "outline" | "champ" | "dark";
}

export const Badge: React.FC<BadgeProps> = ({
  className = "",
  variant = "crimson",
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center gap-1 font-mono-data text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5";

  const variants = {
    crimson: "bg-fight-red text-ink",
    white: "bg-charcoal text-ink",
    dark: "bg-charcoal text-ink border border-border-subtle",
    outline: "bg-transparent text-ink border border-subtle",
    champ:
      "bg-canvas text-fight-red border border-fight-red py-0.5 px-2.5 font-bold",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
