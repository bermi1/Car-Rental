import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 disabled:bg-primary-300',
  secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:text-neutral-400',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300',
  danger: 'bg-status-cancelledFg text-white hover:opacity-90 disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 rounded-xl',
  lg: 'text-base px-5 py-3 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
