import { useId, type ReactNode } from 'react';

/**
 * The app's form field.
 *
 * daisyUI v5 removed `form-control` / `label-text` / `label-text-alt`. v4's
 * `.label` was `display:flex; justify-content:space-between`, so a
 * label + right-hand note pair sat at opposite ends of the row; v5's `.label`
 * is `inline-flex`, which collapses that pair to the left. `fieldset-legend`
 * is the v5 element that restores the split, so migrating here is a layout fix
 * rather than a style preference.
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
   * to it (`{(id) => <input id={id} />}`); pass plain children when the control
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
    <fieldset className={`fieldset ${className}`}>
      {/* `w-full`: a <legend> shrink-wraps its content by default, which would
          collapse the label / aside pair together instead of pushing them to
          opposite ends of the row. */}
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
        <p id={describedBy} role="alert" className="label text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="label">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

export default Field;
