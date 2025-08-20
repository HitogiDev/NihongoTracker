import { useQuery } from '@tanstack/react-query';
import { getMediaStatsFn, IMediaStats } from '../api/trackerApi';
import { ILog } from '../types';

interface MediaStatsProps {
  mediaId: string;
  mediaType: ILog['type'];
  mediaName: string;
}

function MediaStats({ mediaId, mediaType, mediaName }: MediaStatsProps) {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<IMediaStats>({
    queryKey: ['mediaStats', mediaId, mediaType],
    queryFn: () => getMediaStatsFn(mediaId, mediaType),
    enabled: !!mediaId && !!mediaType,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-base-300 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="text-sm font-medium">Loading your progress...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Don't show anything if there's an error or no stats
  }

  // If no logs exist for this media, don't show stats
  if (stats.total.logs === 0) {
    return (
      <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-info-content">
            This will be your first log for "{mediaName}"
          </span>
        </div>
      </div>
    );
  }

  // Determine what metrics to show based on media type
  const getRelevantMetrics = () => {
    switch (mediaType) {
      case 'anime':
        return ['episodes', 'hours'];
      case 'manga':
        return ['characters', 'pages', 'hours'];
      case 'reading':
      case 'vn':
        return ['characters', 'hours'];
      case 'video':
      case 'audio':
      case 'movie':
        return ['hours'];
      default:
        return ['hours'];
    }
  };

  const relevantMetrics = getRelevantMetrics();

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  const getMetricValue = (
    metric: string,
    period: 'total' | 'today' | 'thisWeek' | 'thisMonth'
  ) => {
    const data = stats[period];
    switch (metric) {
      case 'episodes':
        return data.episodes;
      case 'characters':
        return data.characters;
      case 'pages':
        return data.pages;
      case 'hours':
        return data.hours;
      default:
        return 0;
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'episodes':
        return 'episodes';
      case 'characters':
        return 'chars';
      case 'pages':
        return 'pages';
      case 'hours':
        return 'hrs';
      default:
        return metric;
    }
  };

  return (
    <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-medium text-sm">Your Progress</span>
        <div className="badge badge-success badge-sm">
          {stats.total.logs} log{stats.total.logs !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Total Progress */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {relevantMetrics.map((metric) => {
          const value = getMetricValue(metric, 'total');
          if (value === 0) return null;

          return (
            <div
              key={metric}
              className="bg-base-100/50 rounded p-2 text-center"
            >
              <div className="text-xs text-base-content/60 flex items-center justify-center gap-1">
                Total {getMetricLabel(metric)}
              </div>
              <div className="font-semibold text-sm">
                {metric === 'hours' ? value.toFixed(1) : formatNumber(value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Summary */}
      {(stats.thisWeek.logs > 0 || stats.thisMonth.logs > 0) && (
        <div className="border-t border-success/20 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {stats.thisWeek.logs > 0 && (
              <div className="text-center">
                <div className="text-base-content/60">This week</div>
                <div className="font-medium">
                  {stats.thisWeek.logs} log
                  {stats.thisWeek.logs !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            {stats.thisMonth.logs > 0 && (
              <div className="text-center">
                <div className="text-base-content/60">This month</div>
                <div className="font-medium">
                  {stats.thisMonth.logs} log
                  {stats.thisMonth.logs !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date Range */}
      {stats.total.firstLogDate && stats.total.lastLogDate && (
        <div className="border-t border-success/20 pt-2 mt-2">
          <div className="text-xs text-base-content/60 text-center">
            {stats.total.firstLogDate === stats.total.lastLogDate
              ? `Logged on ${formatDate(stats.total.firstLogDate)}`
              : `${formatDate(stats.total.firstLogDate)} - ${formatDate(stats.total.lastLogDate)}`}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaStats;
