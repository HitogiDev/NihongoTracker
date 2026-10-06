import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import Button from './Button';

interface MultiSelectDropdownProps {
  label: ReactNode;
  options: { value: string; label: ReactNode; checkboxColor?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  selectAllLabel: string;
  selectNoneLabel: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  value,
  onChange,
  selectAllLabel,
  selectNoneLabel,
}: MultiSelectDropdownProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 256,
    maxHeight: 320,
  });

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 256), window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const desiredHeight = Math.min(menuRef.current?.scrollHeight ?? 360, 560);
      const openAbove = below < desiredHeight && above > below;
      const maxHeight = Math.max(
        0,
        Math.min(desiredHeight, openAbove ? above : below),
      );
      setPosition({
        width,
        maxHeight,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: openAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options.length]);

  return (
    <div className="dropdown flex-1 sm:flex-none">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-outline w-full justify-between gap-2"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="flex items-center gap-2">{label}</span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            ref={menuRef}
            className="dropdown-content surface-raised z-[1000] overflow-y-auto p-3"
            style={{ position: 'fixed', ...position }}
          >
            <div className="mb-3 flex gap-2 border-b border-base-300 pb-3">
              <Button
                appearance="outline"
                size="sm"
                className="flex-1"
                onClick={() => onChange(options.map((option) => option.value))}
              >
                {selectAllLabel}
              </Button>
              <Button
                appearance="outline"
                size="sm"
                className="flex-1"
                onClick={() => onChange([])}
              >
                {selectNoneLabel}
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-11 items-center justify-between gap-3 px-3 py-2 rounded-box hover:bg-base-200 cursor-pointer ${value.includes(option.value) ? 'bg-base-200' : ''}`}
                >
                  <span className="min-w-0 flex-1 text-sm">{option.label}</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm h-6 w-6 shrink-0 rounded-full"
                    style={option.checkboxColor ? {
                      '--input-color': option.checkboxColor,
                      color: 'var(--color-neutral-content)',
                    } as CSSProperties : undefined}
                    checked={value.includes(option.value)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...value, option.value]
                          : value.filter((item) => item !== option.value),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
