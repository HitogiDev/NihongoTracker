import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type DropdownSelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'defaultValue' | 'onChange' | 'value'
> & {
  children: ReactNode;
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
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

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
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        {...buttonProps}
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
      <ul
        tabIndex={0}
        role="listbox"
        aria-hidden={!isOpen}
        className={`dropdown-content menu menu-vertical flex-nowrap surface-raised z-[100] mt-1 max-h-72 w-full min-w-48 start-0 end-auto top-full bottom-auto overflow-x-hidden overflow-y-auto p-2 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none invisible'}`}
      >
        {options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              role="option"
              aria-selected={selectedValue === option.value}
              className={selectedValue === option.value ? 'active' : ''}
              disabled={option.disabled}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
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
