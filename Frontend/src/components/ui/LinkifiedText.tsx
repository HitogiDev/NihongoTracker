import type { ReactNode } from 'react';

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}]$/;

function getSafeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function LinkifiedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const fullMatch = match[0];
    const matchStart = match.index ?? 0;
    const markdownLabel = match[1];
    const markdownUrl = match[2];
    const bareUrl = match[3];

    if (matchStart > cursor) {
      parts.push(text.slice(cursor, matchStart));
    }

    let urlText = markdownUrl ?? bareUrl ?? fullMatch;
    let trailingPunctuation = '';

    if (bareUrl) {
      while (TRAILING_PUNCTUATION.test(urlText)) {
        trailingPunctuation = urlText.slice(-1) + trailingPunctuation;
        urlText = urlText.slice(0, -1);
      }
    }

    const safeUrl = getSafeHttpUrl(urlText);
    if (safeUrl) {
      parts.push(
        <a
          key={`club-link-${matchIndex}`}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary break-all"
          onClick={(event) => event.stopPropagation()}
        >
          {markdownLabel ?? urlText}
        </a>
      );
      if (trailingPunctuation) parts.push(trailingPunctuation);
    } else {
      parts.push(fullMatch);
    }

    cursor = matchStart + fullMatch.length;
    matchIndex += 1;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

export default LinkifiedText;
