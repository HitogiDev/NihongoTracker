import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * The app's dialog. Native <dialog> + showModal() so focus trapping, the top
 * layer, ESC and inertness come from the platform instead of being reinvented
 * per modal.
 *
 * daisyUI's default `modal-box` is already `width: 91.667%; max-width: 32rem`,
 * so `md` intentionally adds nothing — writing `max-w-lg` there is a no-op.
 */
const MODAL_SIZE = {
  sm: 'max-w-sm',
  md: '',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export type ModalSize = keyof typeof MODAL_SIZE;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: ModalSize;
  /** false for flows that must not close on ESC or a backdrop click. */
  dismissable?: boolean;
  /** Rendered inside `modal-action`. Omit for a bespoke footer. */
  actions?: ReactNode;
  /** Layout-only classes for `modal-box` (`p-0`, `flex flex-col`, ...). */
  className?: string;
  children: ReactNode;
}

function Modal({
  open,
  onClose,
  title,
  size = 'md',
  dismissable = true,
  actions,
  className = '',
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // <dialog> fires `cancel` on ESC and then closes itself. Preventing the
  // default and routing through onClose keeps React state the single source of
  // truth instead of letting the DOM's `open` attribute drift out of sync.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissable) onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [dismissable, onClose]);

  return (
    <dialog ref={ref} className="modal modal-bottom sm:modal-middle">
      <div className={`modal-box ${MODAL_SIZE[size]} ${className}`}>
        {(title || dismissable) && (
          <div className="flex items-start justify-between gap-4 mb-4">
            {title ? <h3 className="text-lg font-bold">{title}</h3> : <span />}
            {dismissable && (
              <Button
                appearance="ghost"
                size="sm"
                shape="circle"
                aria-label="Close"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        {children}
        {actions && <div className="modal-action">{actions}</div>}
      </div>
      {dismissable && (
        // No bg-black/* here: `.modal` already dims to oklch(0 0 0 / .4).
        // Adding one stacks a second layer and darkens the page to ~0.7.
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={onClose}>
            close
          </button>
        </form>
      )}
    </dialog>
  );
}

export default Modal;
