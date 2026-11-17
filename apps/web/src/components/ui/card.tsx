import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: "white" | "crimson" | "none";
}

export const Card: React.FC<CardProps> = ({
  className = "",
  glow = "none",
  children,
  ...props
}) => {
  const glowStyles = {
    white: "border-2 border-hard shadow-brutal-white",
    crimson: "border-2 border-crimson shadow-brutal-crimson",
    none: "border-2 border-subtle",
  };

  return (
    <div
      className={`bg-charcoal text-ink ${glowStyles[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

