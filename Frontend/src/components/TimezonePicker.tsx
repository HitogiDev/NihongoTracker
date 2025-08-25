import { useState, useRef, useEffect } from 'react';
import {
  getCommonTimezones,
  getTimezones,
  getUserTimezone,
} from '../utils/timezone';

interface TimezonePickerProps {
  value?: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

function TimezonePicker({
  value,
  onChange,
  disabled = false,
}: TimezonePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllTimezones, setShowAllTimezones] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const detectedTimezone = getUserTimezone();
  const commonTimezones = getCommonTimezones();
  const allTimezones = getTimezones();

  // Get the current timezone display
  const currentTimezone = value || 'UTC';
  const currentTimezoneDisplay =
    [...commonTimezones, ...allTimezones].find(
      (tz) => tz.value === currentTimezone
    )?.label || currentTimezone;

  // Filter timezones based on search
  const getFilteredTimezones = () => {
    const timezonesToShow = showAllTimezones ? allTimezones : commonTimezones;

    if (!searchTerm) {
      return timezonesToShow;
    }

    return timezonesToShow.filter(
      (tz) =>
        tz.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tz.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredTimezones = getFilteredTimezones();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
        setShowAllTimezones(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleTimezoneSelect = (timezone: string) => {
    onChange(timezone);
    setIsOpen(false);
    setSearchTerm('');
    setShowAllTimezones(false);
  };

  const handleUseDetected = () => {
    onChange(detectedTimezone);
    setIsOpen(false);
    setSearchTerm('');
    setShowAllTimezones(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input input-bordered w-full text-left flex items-center justify-between min-h-12 ${
          disabled ? 'input-disabled' : 'cursor-pointer hover:border-primary'
        }`}
        title={currentTimezoneDisplay} // Add tooltip for full timezone name
      >
        <span className="truncate pr-2 flex-1 text-sm">
          {currentTimezoneDisplay}
        </span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-base-300">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search timezones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-sm input-bordered w-full"
            />
          </div>

          {/* Auto-detect option */}
          {detectedTimezone !== currentTimezone && (
            <div className="p-2 border-b border-base-300">
              <button
                type="button"
                onClick={handleUseDetected}
                className="w-full text-left px-3 py-2 hover:bg-base-200 rounded-md text-sm flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-info"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <div className="font-medium text-info">
                    Use detected timezone
                  </div>
                  <div className="text-xs text-base-content/60">
                    {commonTimezones.find((tz) => tz.value === detectedTimezone)
                      ?.label || detectedTimezone}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Timezone List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredTimezones.length === 0 ? (
              <div className="p-3 text-center text-base-content/60">
                No timezones found
              </div>
            ) : (
              filteredTimezones.map((timezone) => (
                <button
                  key={timezone.value}
                  type="button"
                  onClick={() => handleTimezoneSelect(timezone.value)}
                  className={`w-full text-left px-3 py-2 hover:bg-base-200 text-sm ${
                    timezone.value === currentTimezone
                      ? 'bg-primary/10 text-primary'
                      : ''
                  }`}
                >
                  <div className="truncate">{timezone.label}</div>
                  <div className="text-xs text-base-content/60 truncate">
                    {timezone.value}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Show More/Less Toggle */}
          {searchTerm === '' && (
            <div className="p-2 border-t border-base-300">
              <button
                type="button"
                onClick={() => setShowAllTimezones(!showAllTimezones)}
                className="w-full text-center text-sm text-primary hover:text-primary-focus py-1"
              >
                {showAllTimezones ? 'Show less' : 'Show all timezones'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimezonePicker;
