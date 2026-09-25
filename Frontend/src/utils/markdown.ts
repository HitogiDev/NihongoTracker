import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const SPOILER_REGEX = /\|\|([\s\S]+?)\|\|/g;

export function renderMarkdownWithSpoilers(markdownText: string): string {
  if (!markdownText || !markdownText.trim()) {
    return '';
  }

  const withSpoilers = markdownText.replace(
    SPOILER_REGEX,
    '<span class="spoiler">$1</span>'
  );

  const rawHtml = marked.parse(withSpoilers, { async: false }) as string;

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title', 'target', 'rel'],
  });
}
