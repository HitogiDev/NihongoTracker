import type { ReactNode } from 'react';

/**
 * Header.tsx renders `navbar ... absolute w-full`, i.e. it overlays page
 * content, so every page under <App> must reserve the navbar's height at the
 * top. Measured in the browser it is 80px — daisyUI's 4rem `navbar` min-height
 * plus the header's own padding.
 *
 * Reserving only that leaves the first element flush against the header, so
 * which constant a page uses depends on where its top padding lives:
 *
 * - `HEADER_OFFSET` (5rem) on a wrapper whose child container supplies the page
 *   gap itself (`container mx-auto px-4 py-8`).
 * - `HEADER_OFFSET_CONTENT` (7rem) when content sits directly under the offset —
 *   navbar height plus the same 2rem gap the rest of the page is spaced by.
 */
export const HEADER_OFFSET = 'pt-20';
export const HEADER_OFFSET_CONTENT = 'pt-28';

const PAGE_WIDTH = {
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-7xl',
  full: '',
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

interface PageContainerProps {
  width?: PageWidth;
  /** false for pages that own their backdrop (profile / media hero headers). */
  background?: boolean;
  /** Classes for the inner container (spacing, grid). */
  className?: string;
  children: ReactNode;
}

function PageContainer({
  width = 'xl',
  background = true,
  className = '',
  children,
}: PageContainerProps) {
  return (
    <div
      className={`min-h-screen ${background ? 'bg-base-200' : ''} ${HEADER_OFFSET}`}
    >
      <div
        className={`container mx-auto px-4 py-8 ${PAGE_WIDTH[width]} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export default PageContainer;
