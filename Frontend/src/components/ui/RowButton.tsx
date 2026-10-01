import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Use a full-width row for search results, options, accordion headers, and settings nav.
 * The `btn` class centers content and limits height. That does not fit a list row.
 * This component shares hover, focus, and radius styles across these rows.
 */
interface RowButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Renders the selected/current state. */
  active?: boolean;
  className?: string;
  children: ReactNode;
}

function RowButton({
  active = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: RowButtonProps) {
  return (
    <button
      type={type}
      aria-current={active || undefined}
      className={`flex w-full items-center gap-3 rounded-field px-4 py-3 text-left transition-colors cursor-pointer ${
        active
          ? 'bg-primary text-primary-content'
          : 'hover:bg-base-200 focus-visible:bg-base-200'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default RowButton;
