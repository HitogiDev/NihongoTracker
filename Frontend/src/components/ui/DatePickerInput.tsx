import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { formatDateValue, parseDateValue } from '../../utils/dateInput';
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedValue = value ?? internalValue;
  const selectedDate = parseDateValue(selectedValue);
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);
  const inputClass =
    size === 'sm'
      ? 'input input-sm w-full pr-10'
      : 'input w-full pr-10';

  const updateValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  useEffect(() => {
    if (!isCalendarOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isCalendarOpen]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        id={id}
        ref={inputRef}
        name={name}
        type="text"
        autoComplete="off"
        className={`${inputClass} ${className}`}
        value={selectedValue}
        onChange={(event) => updateValue(event.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square absolute right-1 top-1/2 z-10 -translate-y-1/2"
        aria-label={ariaLabel ? `${ariaLabel} calendar` : 'Open calendar'}
        aria-haspopup="dialog"
        aria-expanded={isCalendarOpen}
        onClick={() => setIsCalendarOpen((open) => !open)}
        disabled={disabled}
      >
        <Calendar className="w-4 h-4" />
      </button>

      {isCalendarOpen && <div
        tabIndex={0}
        role="dialog"
        aria-label={ariaLabel}
        className="absolute bottom-full right-0 z-[1000] mb-2 card card-sm w-72 p-2 surface-raised"
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
            setIsCalendarOpen(false);
            inputRef.current?.focus();
          }}
        />
      </div>}
    </div>
  );
}
