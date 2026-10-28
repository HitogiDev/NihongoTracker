import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactPortal,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import {
  MediaMention,
  UserMention,
  type MentionVariant,
} from '../mentions/MentionChips';
import { isMentionableMediaType } from '../../utils/markdown';

interface MarkdownContentProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    'children' | 'dangerouslySetInnerHTML'
  > {
  /** Sanitized output of `renderMarkdownWithSpoilers`. */
  html: string;
  /** Render every mention as an inline chip, also when it is alone on a line. */
  inlineOnly?: boolean;
  ref?: Ref<HTMLDivElement>;
}

function isBlankText(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
}

function isLineBreak(node: Node | null): boolean {
  return node === null || node.nodeName === 'BR';
}

/** Return the nearest sibling that is not blank text, or null at the edge. */
function adjacentNode(element: HTMLElement, direction: 'previous' | 'next') {
  let node =
    direction === 'previous' ? element.previousSibling : element.nextSibling;
  while (node && isBlankText(node)) {
    node = direction === 'previous' ? node.previousSibling : node.nextSibling;
  }
  return node;
}

/**
 * A mention is shown as a card when it is the only content of its line.
 * A line ends at a paragraph boundary or at a <br> from a single line break.
 */
function isStandalone(element: HTMLElement): boolean {
  if (element.parentElement?.tagName !== 'P') return false;
  return (
    isLineBreak(adjacentNode(element, 'previous')) &&
    isLineBreak(adjacentNode(element, 'next'))
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

/**
 * Render sanitized markdown HTML and replace mention placeholders with React chips.
 * The placeholders keep a plain link as a fallback until this component mounts the chips.
 */
export default function MarkdownContent({
  html,
  inlineOnly = false,
  ref,
  ...props
}: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [portals, setPortals] = useState<ReactPortal[]>([]);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      assignRef(ref, node);
    },
    [ref]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setPortals([]);
      return;
    }

    const next: ReactPortal[] = [];
    container
      .querySelectorAll<HTMLElement>('[data-mention]')
      .forEach((element, index) => {
        const variant: MentionVariant =
          !inlineOnly && isStandalone(element) ? 'card' : 'inline';
        const { mention, username, mediaType, mediaId, label } =
          element.dataset;

        let chip = null;
        if (mention === 'user' && username) {
          chip = <UserMention username={username} variant={variant} />;
        } else if (
          mention === 'media' &&
          mediaId &&
          isMentionableMediaType(mediaType)
        ) {
          chip = (
            <MediaMention
              mediaType={mediaType}
              contentId={mediaId}
              label={label}
              variant={variant}
            />
          );
        }
        if (!chip) return;

        if (variant === 'card') {
          element.classList.add('block');
          // A <br> after a block element adds an empty line, so hide it.
          const next = adjacentNode(element, 'next');
          if (next instanceof HTMLBRElement) next.classList.add('hidden');
        }
        element.replaceChildren();
        next.push(createPortal(chip, element, `mention-${index}`));
      });
    setPortals(next);
  }, [html, inlineOnly]);

  return (
    <>
      <div
        ref={setContainerRef}
        {...props}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {portals}
    </>
  );
}
