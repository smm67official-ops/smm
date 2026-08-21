'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

type FieldShellProps = {
  id: string;
  label?: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

function FieldShell({ id, label, optional, hint, error, children, className = '' }: FieldShellProps) {
  return (
    <div className={`sv-field${error ? ' sv-field--error' : ''} ${className}`.trim()}>
      {label && (
        <label className="sv-label" htmlFor={id}>
          {label} {optional && <span className="sv-label__optional">— optional</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="sv-error-text">{error}</span>
      ) : (
        hint && <span className="sv-hint">{hint}</span>
      )}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  icon?: ReactNode;
  wrapperClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  optional,
  icon,
  wrapperClassName,
  className = '',
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const control = (
    <input id={inputId} className={`sv-input ${className}`.trim()} aria-invalid={!!error} {...rest} />
  );

  return (
    <FieldShell
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={wrapperClassName}
    >
      {icon ? (
        <div className="sv-input-wrap">
          <span className="sv-input-wrap__icon">{icon}</span>
          {control}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
};

export function Textarea({ label, hint, error, optional, className = '', id, rows = 4, ...rest }: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={fieldId}
        rows={rows}
        className={`sv-textarea ${className}`.trim()}
        aria-invalid={!!error}
        {...rest}
      />
    </FieldShell>
  );
}

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode };

export function Checkbox({ label, className = '', ...rest }: CheckboxProps) {
  return (
    <label className={`sv-checkbox ${className}`.trim()}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export default Input;
