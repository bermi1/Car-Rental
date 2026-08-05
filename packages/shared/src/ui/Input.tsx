import React from 'react';
import { cn } from './cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900',
            'placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100',
            error && 'border-status-cancelledFg',
            className
          )}
          {...rest}
        />
        {error && <span className="mt-1 block text-xs text-status-cancelledFg">{error}</span>}
      </label>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className, children, id, ...rest }, ref) => {
    const selectId = id || rest.name;
    return (
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900',
            'focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100',
            className
          )}
          {...rest}
        >
          {children}
        </select>
      </label>
    );
  }
);
Select.displayName = 'Select';
