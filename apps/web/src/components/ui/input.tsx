import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, label, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={id} className="block font-mono-data text-xs font-bold uppercase tracking-wider text-ink-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full bg-canvas text-ink border-2 ${
            error ? "border-crimson" : "border-subtle focus:border-white"
          } px-4 py-2.5 font-mono-data text-sm outline-none transition-colors placeholder:text-ink-subtle ${className}`}
          {...props}
        />
        {error && <p className="font-mono-data text-xs text-crimson font-semibold">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

