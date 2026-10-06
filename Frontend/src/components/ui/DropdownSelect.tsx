import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  ReactElement,
  ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

type DropdownSelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'defaultValue' | 'onChange' | 'value'
> & {
  children: ReactNode;
  optionClassName?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  required?: boolean;
};

function getOptions(children: ReactNode): DropdownOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== 'option') {
      return [];
    }

    const option = child as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    }>;
    const optionValue = option.props.value ?? option.props.children;
    return [
      {
        value: String(optionValue ?? ''),
        label: option.props.children,
        disabled: Boolean(option.props.disabled),
      },
    ];
  });
}

function normalizeButtonClasses(className = '') {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token === 'select') return '';
      if (token.startsWith('focus:select-')) return '';
      if (token.startsWith('select-')) {
        return token.replace(/^select-/, 'btn-');
      }
      return token;
    })
    .filter(Boolean)
    .join(' ');
}

function getDropdownLayoutClasses(className = '') {
  return className
    .split(/\s+/)
    .filter((token) => /^(?:[a-z-]+:)?(?:w-|min-w-|max-w-)/.test(token))
    .join(' ');
}

export default function DropdownSelect({
  children,
  optionClassName,
  value,
  defaultValue,
  onChange,
  className,
  disabled,
  id,
  name,
  required,
  ...buttonProps
}: DropdownSelectProps) {
  const options = useMemo(() => getOptions(children), [children]);
  const initialValue = String(
    value ?? defaultValue ?? options[0]?.value ?? ''
  );
  const [internalValue, setInternalValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const selectedValue = value === undefined ? internalValue : String(value);
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0];
  const layoutClasses = getDropdownLayoutClasses(className);

  useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setInternalValue(String(defaultValue));
    }
  }, [defaultValue, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !dropdownRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (
        !dropdownRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(
        Math.max(rect.width, 192),
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );
      const desiredHeight = Math.min(
        menuRef.current?.scrollHeight ?? options.length * 40 + 16,
        288,
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        96,
        Math.min(desiredHeight, openAbove ? spaceAbove : spaceBelow),
      );
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - maxHeight - 4)
        : Math.min(
            window.innerHeight - maxHeight - viewportPadding,
            rect.bottom + 4,
          );

      setMenuPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  const handleSelect = (nextValue: string) => {
    if (disabled) return;
    if (value === undefined) setInternalValue(nextValue);
    setIsOpen(false);
    onChange?.({
      target: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div
      ref={dropdownRef}
      className={`dropdown dropdown-bottom dropdown-start ${layoutClasses || 'w-fit max-w-full'} ${isOpen ? 'dropdown-open' : ''}`}
    >
      <button
        {...buttonProps}
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        className={`btn btn-outline list-none justify-between ${normalizeButtonClasses(className)} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {isOpen && menuPosition && createPortal(
        <ul
          ref={menuRef}
          tabIndex={0}
          role="listbox"
          className="menu menu-vertical flex-nowrap surface-raised z-[1000] overflow-x-hidden overflow-y-auto p-2"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={selectedValue === option.value}
                className={[
                  optionClassName,
                  selectedValue === option.value ? 'active' : '',
                ].filter(Boolean).join(' ')}
                disabled={option.disabled}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedValue}
          required={required}
          disabled={disabled}
        />
      )}
    </div>
  );
}
