import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The legal pages are pure static prose, so they are stored as structured data
 * in `legal.json` and rendered here instead of living as 1000+ lines of JSX.
 * Translating a document then means editing JSON only, and every language is
 * guaranteed to have the same section structure.
 */

export type LegalDocumentId = 'privacy' | 'terms' | 'refund';

interface ListBlock {
  type: 'ul' | 'ol' | 'plain';
  /** A short bold sub-heading above the list, e.g. "Account Information:". */
  heading?: string;
  headingLevel?: 'h3' | 'h4';
  /** An ordinary lead-in sentence above the list — plain text, not a heading. */
  intro?: string;
  items: string[];
}

interface TextBlock {
  type: 'p' | 'h3' | 'h4';
  text: string;
}

type LegalBlock = ListBlock | TextBlock;

interface LegalSection {
  heading?: string;
  blocks: LegalBlock[];
}

interface LegalDocumentData {
  title: string;
  lastUpdated: string;
  intro?: LegalBlock[];
  sections: LegalSection[];
  seeAlso?: { label: string; href: string }[];
}

/**
 * Minimal inline markup so translators can move links and emphasis around
 * inside a sentence without touching code: `**bold**` and `[text](href)`.
 * Deliberately not full markdown — nothing here is user-generated, so there is
 * no HTML to sanitize.
 */
const INLINE_PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, bold, linkLabel, href] = match;

    if (bold !== undefined) {
      nodes.push(<strong key={match.index}>{bold}</strong>);
    } else if (linkLabel !== undefined && href !== undefined) {
      const isExternal = /^(https?:|mailto:)/.test(href);
      nodes.push(
        <a
          key={match.index}
          href={href}
          className="text-primary hover:underline"
          {...(isExternal && href.startsWith('http')
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {linkLabel}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length === 1 ? nodes[0] : nodes;
}

function ListHeading({ block }: { block: ListBlock }) {
  if (!block.heading) return null;

  return block.headingLevel === 'h3' ? (
    <h3 className="text-xl font-semibold mb-2">
      {renderInline(block.heading)}
    </h3>
  ) : (
    <h4 className="font-semibold mb-2">{renderInline(block.heading)}</h4>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{renderInline(block.text)}</p>;
    case 'h3':
      return (
        <h3 className="text-xl font-semibold mt-6">
          {renderInline(block.text)}
        </h3>
      );
    case 'h4':
      return <h4 className="font-semibold">{renderInline(block.text)}</h4>;
    case 'ul':
    case 'ol':
    case 'plain': {
      const ListTag = block.type === 'ol' ? 'ol' : 'ul';
      const listClass =
        block.type === 'ol'
          ? 'list-decimal list-inside space-y-1 ml-4'
          : block.type === 'ul'
            ? 'list-disc list-inside space-y-1 ml-4'
            : 'list-none space-y-2';

      return (
        <div>
          <ListHeading block={block} />
          {block.intro && <p className="mb-2">{renderInline(block.intro)}</p>}
          <ListTag className={listClass}>
            {block.items.map((item, index) => (
              <li key={index}>{renderInline(item)}</li>
            ))}
          </ListTag>
        </div>
      );
    }
  }
}

export default function LegalDocument({ doc }: { doc: LegalDocumentId }) {
  const { t, i18n } = useTranslation('legal');

  // The document bodies are nested objects rather than flat strings, so the
  // typed `t` signature does not apply; the shape is guarded by the
  // `LegalDocumentData` cast and by every locale sharing one source file.
  const read = t as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => unknown;

  const data = read(doc, { returnObjects: true }) as LegalDocumentData;

  return (
    <div className="container mx-auto px-4 py-8 pt-32 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">{data.title}</h1>
      <p className="text-base-content/70 mb-8">
        {t('common.lastUpdated', { date: data.lastUpdated })}
      </p>

      {i18n.language !== 'en' && (
        <div role="note" className="alert alert-info mb-8 text-sm">
          <span>{renderInline(t('common.translationNotice'))}</span>
        </div>
      )}

      <div className="prose prose-lg max-w-none">
        {data.intro && (
          <div className="space-y-4 mb-8">
            {data.intro.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        )}

        {data.sections.map((section, index) => (
          <section key={index} className="mb-8">
            {section.heading && (
              <h2 className="text-2xl font-bold mb-4">
                {renderInline(section.heading)}
              </h2>
            )}
            <div className="space-y-4">
              {section.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          </section>
        ))}

        <div className="divider my-8"></div>

        <div className="text-center text-base-content/60">
          <p className="font-semibold">NihongoTracker</p>
          <p className="text-sm">{t('common.tagline')}</p>
          {data.seeAlso && (
            <p className="text-sm mt-2">
              {t('common.seeAlso')}{' '}
              {data.seeAlso.map((link, index) => (
                <Fragment key={link.href}>
                  {index > 0 && ' | '}
                  <a href={link.href} className="text-primary hover:underline">
                    {link.label}
                  </a>
                </Fragment>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
