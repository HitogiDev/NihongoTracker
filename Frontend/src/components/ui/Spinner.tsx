const SPINNER_SIZE = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
} as const;

export type SpinnerSize = keyof typeof SPINNER_SIZE;

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Screen-reader label. Omit inside a button that already has visible text. */
  label?: string;
}

/** Inline loading indicator. Sized to match the control it sits in. */
function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`loading loading-spinner ${SPINNER_SIZE[size]} ${className}`}
    />
  );
}

/** Centred spinner for a route or a section that is still fetching. */
export function PageLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Spinner size="lg" className="text-primary" label="Loading" />
    </div>
  );
}

export default Spinner;
