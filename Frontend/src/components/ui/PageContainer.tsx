import type { ReactNode } from 'react';

/**
 * The absolute navbar overlaps page content and is 80px high.
 * Use `HEADER_OFFSET` when a child container adds top padding.
 * Use `HEADER_OFFSET_CONTENT` when content starts directly below the navbar.
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
