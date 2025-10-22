import { useQuery } from '@tanstack/react-query';
import { getChangelogsFn } from '../api/trackerApi';

export default function ChangelogScreen() {
  const { data: changelogs, isLoading } = useQuery({
    queryKey: ['changelogs'],
    queryFn: getChangelogsFn,
    staleTime: 60_000,
  });

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return (
          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        );
      case 'improvement':
        return (
          <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-info"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        );
      case 'bugfix':
        return (
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        );
      case 'breaking':
        return (
          <div className="w-8 h-8 rounded-full bg-error/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-error"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
            <span className="text-xs">•</span>
          </div>
        );
    }
  };

  const getChangeLabel = (type: string) => {
    switch (type) {
      case 'feature':
        return <span className="badge badge-success badge-sm">New</span>;
      case 'improvement':
        return <span className="badge badge-info badge-sm">Improved</span>;
      case 'bugfix':
        return <span className="badge badge-warning badge-sm">Fixed</span>;
      case 'breaking':
        return <span className="badge badge-error badge-sm">Breaking</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-200 py-12 pt-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Changelog</h1>
          <p className="text-base-content/70">
            Stay up to date with the latest features, improvements, and bug
            fixes
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : changelogs && changelogs.length > 0 ? (
          <div className="space-y-8">
            {changelogs.map((changelog) => (
              <div key={changelog._id} className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="badge badge-neutral badge-lg">
                      {changelog.version}
                    </span>
                    <h2 className="text-2xl font-bold">{changelog.title}</h2>
                    <span className="text-base-content/60 ml-auto">
                      {new Date(changelog.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {changelog.description && (
                    <p className="text-base-content/80 mb-6">
                      {changelog.description}
                    </p>
                  )}

                  <div className="space-y-4">
                    {changelog.changes.map((change, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        {getChangeIcon(change.type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getChangeLabel(change.type)}
                          </div>
                          <p className="text-base-content/90">
                            {change.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-base-content/30 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg text-base-content/70">
                No changelogs available yet
              </p>
              <p className="text-sm text-base-content/50 mt-2">
                Check back later for updates and new features
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
