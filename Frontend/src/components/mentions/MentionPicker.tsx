import { AtSign } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import MentionAutocomplete from './MentionAutocomplete';
import MentionPickerModal from './MentionPickerModal';

type MentionButtonProps = {
  className?: string;
} & (
  | {
      value: string;
      onChange: (value: string) => void;
      textareaRef: RefObject<HTMLTextAreaElement | null>;
      maxLength?: number;
      onInsert?: never;
    }
  | {
      /** Insert the token through an editor that tracks its own selection. */
      onInsert: (token: string) => void;
      value?: never;
      onChange?: never;
      textareaRef?: never;
      maxLength?: never;
    }
);

/**
 * Toolbar button that opens the picker and inserts the mention at the cursor.
 * With a textarea, it also suggests mentions while the author types `@`.
 */
export function MentionButton({
  value,
  onChange,
  textareaRef,
  maxLength,
  onInsert,
  className = 'btn btn-ghost btn-sm btn-square',
}: MentionButtonProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const openPicker = () => {
    const textarea = textareaRef?.current;
    selectionRef.current = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : null;
    setOpen(true);
  };

  const insert = (token: string) => {
    if (onInsert) {
      onInsert(`${token} `);
      return;
    }
    if (value === undefined || !onChange) return;
    const start = selectionRef.current?.start ?? value.length;
    const end = selectionRef.current?.end ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const leading = before && !/\s$/.test(before) ? ' ' : '';
    const trailing = after.startsWith(' ') ? '' : ' ';
    const inserted = `${leading}${token}${trailing}`;
    const nextValue = before + inserted + after;
    if (maxLength !== undefined && nextValue.length > maxLength) return;

    onChange(nextValue);
    const cursor = start + inserted.length;
    requestAnimationFrame(() => {
      const textarea = textareaRef?.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={openPicker}
        title={t('mentions.button')}
        aria-label={t('mentions.button')}
      >
        <AtSign className="h-4 w-4" />
      </button>
      {textareaRef && onChange && (
        <MentionAutocomplete
          textareaRef={textareaRef}
          onChange={onChange}
          maxLength={maxLength}
        />
      )}
      {/* Portal the dialog so its backdrop form never nests inside a composer form. */}
      {createPortal(
        <MentionPickerModal
          open={open}
          onClose={() => setOpen(false)}
          onSelect={insert}
        />,
        document.body
      )}
    </>
  );
}
