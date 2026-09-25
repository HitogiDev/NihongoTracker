/** Single placeholder block. Give it `h-*` / `w-*` utilities. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Placeholder paragraph. The last line is short so it reads as prose. */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`skeleton h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/** Placeholder that occupies the same box as a `surface` panel. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`surface p-4 space-y-3 ${className}`}>
      <div className="skeleton h-5 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}

export default Skeleton;
