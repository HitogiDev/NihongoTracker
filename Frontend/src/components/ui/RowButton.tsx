import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * A full-width clickable row: search results, option lists, accordion headers,
 * settings nav items. These are not `btn`s — a `btn` centres its content and
 * caps its height, which is wrong for a list row — but they still need one
 * shared hover/focus/radius treatment instead of ~20 hand-rolled ones.
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
