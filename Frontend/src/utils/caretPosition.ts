/** Styles that change where text wraps inside a textarea. */
const MIRRORED_PROPERTIES = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'textIndent',
  'wordSpacing',
  'tabSize',
] as const;

export interface CaretRect {
  left: number;
  top: number;
  height: number;
}

/**
 * Return the viewport position of a character offset in a textarea.
 * A hidden mirror element copies the textarea layout, because textareas do not expose caret geometry.
 */
export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  offset: number
): CaretRect {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style[property] = style[property];
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.overflow = 'hidden';

  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(offset) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.2;
  const bounds = textarea.getBoundingClientRect();
  const rect = {
    left:
      bounds.left +
      marker.offsetLeft -
      textarea.scrollLeft +
      Number.parseFloat(style.borderLeftWidth),
    top:
      bounds.top +
      marker.offsetTop -
      textarea.scrollTop +
      Number.parseFloat(style.borderTopWidth),
    height: lineHeight,
  };
  mirror.remove();
  return rect;
}
