import React from 'react';
import { cn } from './cn';
import { Icon, IconName } from './Icon';

const fieldClasses =
  'w-full rounded-lg border border-line bg-surface text-sm text-fg placeholder:text-fg-subtle ' +
  'transition-colors duration-150 ' +
  'focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted';

function FieldShell({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger-fg">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-fg-subtle">{hint}</span>
      )}
    </label>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, className, wrapperClassName, id, ...rest }, ref) => (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
        )}
        <input
          ref={ref}
          id={id || rest.name}
          className={cn(
            fieldClasses,
            'h-9 px-3',
            icon && 'pl-9',
            error && 'border-danger focus:border-danger focus:ring-danger/10',
            className
          )}
          {...rest}
        />
      </div>
    </FieldShell>
  )
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, wrapperClassName, children, id, ...rest }, ref) => (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={id || rest.name}
          className={cn(fieldClasses, 'h-9 cursor-pointer appearance-none pl-3 pr-9', className)}
          {...rest}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
      </div>
    </FieldShell>
  )
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, wrapperClassName, id, ...rest }, ref) => (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id || rest.name}
        rows={rest.rows ?? 3}
        className={cn(fieldClasses, 'resize-y px-3 py-2 leading-relaxed', className)}
        {...rest}
      />
    </FieldShell>
  )
);
Textarea.displayName = 'Textarea';

/** Standalone search box used above tables and lists. */
export const SearchInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <Input ref={ref} icon="search" type="search" placeholder="Search…" {...props} />
));
SearchInput.displayName = 'SearchInput';
