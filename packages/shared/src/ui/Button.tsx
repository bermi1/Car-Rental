import React from 'react';
import { cn } from './cn';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-xs hover:bg-accent-hover active:scale-[0.98]',
  secondary: 'bg-surface-sunken text-fg hover:bg-line/60 active:scale-[0.98]',
  outline: 'border border-line-strong bg-surface text-fg hover:bg-surface-sunken active:scale-[0.98]',
  ghost: 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-danger text-white shadow-xs hover:brightness-110 active:scale-[0.98]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px] rounded-lg',
  md: 'h-9 gap-2 px-4 text-sm rounded-lg',
  lg: 'h-11 gap-2 px-5 text-[15px] rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} className="shrink-0" />
      )}
      {children}
      {iconRight && !isLoading && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} className="shrink-0" />}
    </button>
  );
}

/** Square icon-only button, for toolbars and table row actions. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: Omit<ButtonProps, 'icon' | 'children'> & { icon: IconName; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        variantClasses[variant],
        size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-lg',
        className
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 17} />
    </button>
  );
}
