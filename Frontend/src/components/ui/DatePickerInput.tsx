import { useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

interface DatePickerInputProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

function parseDateValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return undefined;
  }
  return date;
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DayPickerChevron({ orientation }: { orientation?: string }) {
  const iconClass = 'w-4 h-4 text-base-content/60';
  return orientation === 'left' ? (
    <ChevronLeft className={iconClass} />
  ) : (
    <ChevronRight className={iconClass} />
  );
}

/**
 * Shared date control matching the calendar used by the Create Log form.
 * Values stay in YYYY-MM-DD form so API payloads and FormData remain stable.
 */
export default function DatePickerInput({
  id,
  name,
  value,
  defaultValue = '',
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = 'YYYY-MM-DD',
  ariaLabel,
  className = '',
  size = 'md',
}: DatePickerInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedValue = value ?? internalValue;
  const selectedDate = parseDateValue(selectedValue);
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);
  const inputClass =
    size === 'sm'
      ? 'input input-sm w-full flex items-center justify-between cursor-pointer'
      : 'input w-full flex items-center justify-between cursor-pointer';

  const updateValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  return (
    <div className="dropdown dropdown-top dropdown-end w-full">
      <button
        id={id}
        ref={buttonRef}
        type="button"
        className={`${inputClass} ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-required={required}
        disabled={disabled}
      >
        <span className={selectedDate ? 'text-base-content' : 'text-base-content/50'}>
          {selectedDate ? selectedDate.toLocaleDateString() : placeholder}
        </span>
        <Calendar className="w-4 h-4" />
      </button>

      {(name || required) && (
        <input
          className="sr-only"
          name={name}
          value={selectedValue}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
        />
      )}

      <div
        tabIndex={0}
        role="dialog"
        aria-label={ariaLabel}
        className="dropdown-content z-[1000] card card-sm w-72 p-2 surface-raised"
      >
        <DayPicker
          className="rdp-themed"
          components={{ Chevron: DayPickerChevron }}
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? minDate ?? maxDate ?? new Date()}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={(date) =>
            disabled ||
            Boolean(minDate && date < minDate) ||
            Boolean(maxDate && date > maxDate)
          }
          onSelect={(date) => {
            if (!date && required) return;
            updateValue(date ? formatDateValue(date) : '');
            buttonRef.current?.focus();
            buttonRef.current?.blur();
          }}
        />
      </div>
    </div>
  );
}
