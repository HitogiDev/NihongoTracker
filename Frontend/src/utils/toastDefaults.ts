import { toast, type ToastContent, type ToastOptions } from 'react-toastify';

/** An error needs more reading time than a confirmation. */
const ERROR_TOAST_MS = 6000;
const WARNING_TOAST_MS = 5000;

/**
 * Give error and warning toasts a longer default duration.
 * Show one toast for each error text.
 * react-toastify has one `autoClose` value for each container, not for each type.
 * A call that sets its own `autoClose` keeps that value.
 */
export function installToastDefaults() {
  const showError = toast.error;
  const showWarning = toast.warning;
  toast.error = <TData = unknown>(
    content: ToastContent<TData>,
    options?: ToastOptions<TData>,
  ) =>
    showError(content, {
      autoClose: ERROR_TOAST_MS,
      // The same text as the ID stops a second copy of a visible error.
      toastId: typeof content === 'string' ? content : undefined,
      ...options,
    });
  toast.warning = <TData = unknown>(
    content: ToastContent<TData>,
    options?: ToastOptions<TData>,
  ) => showWarning(content, { autoClose: WARNING_TOAST_MS, ...options });
  toast.warn = toast.warning;
}
