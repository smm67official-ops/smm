'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
};

export default function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className = '',
  id,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className={`sv-field${error ? ' sv-field--error' : ''}`}>
      {label && (
        <label className="sv-label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} className={`sv-select ${className}`.trim()} aria-invalid={!!error} {...rest}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="sv-error-text">{error}</span> : hint && <span className="sv-hint">{hint}</span>}
    </div>
  );
}
