import { useId, type ReactNode } from 'react';

/**
 * Use `fieldset-legend` to place the label and note at opposite ends of one row.
 * In daisyUI v5, `.label` uses inline-flex and does not keep this layout.
 */
interface FieldProps {
  label: ReactNode;
  /** Right-aligned note on the legend row (char count, "optional", ...). */
  aside?: ReactNode;
  /** Muted help text under the control. */
  hint?: ReactNode;
  /** Replaces `hint` when set. */
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /**
   * The control. Pass a function to receive a generated id and wire the label
   * to it (`{(id) => <input id={id} />}`). Pass plain children when the control
   * already carries its own id or is a group with no single focus target.
   */
  children: ReactNode | ((id: string) => ReactNode);
}

function Field({
  label,
  aside,
  hint,
  error,
  required,
  className = '',
  children,
}: FieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  const wired = typeof children === 'function';

  return (
    <fieldset className={`fieldset min-w-0 ${className}`}>
      {/* A legend shrink-wraps by default. Use full width to split the label and note. */}
      <legend className="fieldset-legend w-full">
        {/* Only claim to label a control when a control actually got the id. */}
        {/* flex row: Tailwind's preflight makes `svg` a block, so an icon in
            the label would otherwise drop onto its own line. */}
        {wired ? (
          <label htmlFor={id} className="flex items-center gap-2">
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
        ) : (
          <span className="flex items-center gap-2">
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </span>
        )}
        {aside && <span className="font-normal opacity-60">{aside}</span>}
      </legend>

      {wired ? children(id) : children}

      {error ? (
        <p
          id={describedBy}
          role="alert"
          className="label w-full min-w-0 whitespace-normal break-words text-error"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={describedBy}
          className="label w-full min-w-0 whitespace-normal break-words"
        >
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

export default Field;
