import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { formatDateValue, parseDateValue } from '../../utils/dateInput';
import { useUserDataStore } from '../../store/userData';
import { isMobileApp } from '../../utils/nativeRuntime';
import Modal from './Modal';
import 'react-day-picker/style.css';
import { useNativeDismiss } from '../../native/useNativeDismiss';

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
  useNativeDismiss(isCalendarOpen, () => setIsCalendarOpen(false));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarPosition, setCalendarPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const selectedValue = value ?? internalValue;
  const weekStartsOn = useUserDataStore(
    (state) => state.user?.settings?.weekStartsOn ?? 1,
  );
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
    if (!isCalendarOpen || isMobileApp()) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target) &&
        !calendarRef.current?.contains(event.target)
      ) {
        setIsCalendarOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsCalendarOpen(false);
      inputRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [isCalendarOpen]);

  useLayoutEffect(() => {
    if (!isCalendarOpen || isMobileApp()) {
      setCalendarPosition(null);
      return;
    }

    const input = inputRef.current;
    const popup = calendarRef.current;
    if (!input || !popup) return;

    const updatePosition = () => {
      const rect = input.getBoundingClientRect();
      const padding = 8;
      const gap = 8;
      const width = popup.getBoundingClientRect().width;
      const height = popup.scrollHeight + popup.offsetHeight - popup.clientHeight;
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - padding - gap);
      const spaceAbove = Math.max(0, rect.top - padding - gap);
      const openAbove = spaceBelow < height && spaceAbove > spaceBelow;
      const maxHeight = openAbove ? spaceAbove : spaceBelow;
      const top = openAbove
        ? Math.max(padding, rect.top - Math.min(height, maxHeight) - gap)
        : rect.bottom + gap;
      const left = Math.max(
        padding,
        Math.min(rect.right - width, window.innerWidth - width - padding),
      );

      setCalendarPosition({ top, left, maxHeight });
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(input);
    observer.observe(popup);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isCalendarOpen]);

  const calendar = (
    <DayPicker
      className="rdp-themed"
      components={{ Chevron: DayPickerChevron }}
      mode="single"
      weekStartsOn={weekStartsOn}
      selected={selectedDate}
      defaultMonth={selectedDate ?? minDate ?? maxDate ?? new Date()}
      startMonth={minDate}
      endMonth={maxDate}
      disabled={(date) => disabled || Boolean(minDate && date < minDate) || Boolean(maxDate && date > maxDate)}
      onSelect={(date) => {
        if (!date && required) return;
        updateValue(date ? formatDateValue(date) : '');
        setIsCalendarOpen(false);
        if (!isMobileApp()) inputRef.current?.focus();
      }}
    />
  );

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

      {isCalendarOpen && !isMobileApp() && createPortal(<div
        ref={calendarRef}
        tabIndex={0}
        role="dialog"
        aria-label={ariaLabel}
        className="fixed z-[1000] card card-sm w-max max-w-[calc(100vw-1rem)] overflow-auto p-2 surface-raised"
        style={{
          top: calendarPosition?.top ?? 0,
          left: calendarPosition?.left ?? 0,
          maxHeight: calendarPosition?.maxHeight,
          visibility: calendarPosition ? 'visible' : 'hidden',
        }}
      >
        {calendar}
      </div>, inputRef.current?.closest('dialog[open]') ?? document.body)}
      {isMobileApp() && createPortal(<Modal open={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} title={ariaLabel} className="p-1"><div className="native-calendar">{calendar}</div></Modal>, document.body)}
    </div>
  );
}
