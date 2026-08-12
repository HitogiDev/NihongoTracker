import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';
import { buttonClass, BTN_SPINNER, type ButtonStyleProps } from './buttons';

/**
 * The app's button. Every daisyUI button class the app is allowed to use is
 * behind a prop here, so sizes and colours stay consistent by construction.
 * For elements that must not be a `<button>`, use `buttonClass()` instead.
 */
export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    ButtonStyleProps {
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Replaces the children while `loading`. Otherwise the spinner precedes them. */
  loadingText?: ReactNode;
  children?: ReactNode;
}

function Button({
  variant = 'default',
  appearance = 'solid',
  size = 'md',
  shape = 'none',
  block = false,
  className = '',
  loading = false,
  loadingText,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // `disabled` (not the `btn-disabled` class) so the control leaves the tab
      // order and stops responding to Enter/Space.
      disabled={disabled || loading}
      type={type}
      className={buttonClass({
        variant,
        appearance,
        size,
        shape,
        block,
        className,
      })}
      {...rest}
    >
      {loading && <Spinner size={BTN_SPINNER[size]} />}
      {loading && loadingText !== undefined ? loadingText : children}
    </button>
  );
}

export default Button;
