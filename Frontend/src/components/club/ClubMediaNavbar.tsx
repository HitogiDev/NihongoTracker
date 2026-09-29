import { Link } from 'react-router-dom';
import { Info, BarChart, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHideRankingFeatures } from '../../hooks/useRankingVisibility';

function ClubMediaNavbar({
  clubId,
  mediaId,
  mediaType,
  contentId,
  clubMediaId,
}: {
  clubId: string;
  mediaId: string;
  mediaType?: string;
  contentId?: string;
  clubMediaId?: string;
}) {
  const { t } = useTranslation('clubs');
  const hideRankingFeatures = useHideRankingFeatures();
  const buildUnified = (tab?: string) => {
    if (mediaType && contentId && clubId && clubMediaId) {
      const base = `/${mediaType}/${contentId}?clubId=${encodeURIComponent(
        clubId
      )}&clubMediaId=${encodeURIComponent(clubMediaId)}`;
      return tab ? `${base}&tab=${tab}` : base;
    }
    // fallback to legacy paths
    if (!tab) return `/clubs/${clubId}/media/${mediaId}`;
    if (tab === 'activity') return `/clubs/${clubId}/media/${mediaId}/activity`;
    if (tab === 'rankings') return `/clubs/${clubId}/media/${mediaId}/rankings`;
    return `/clubs/${clubId}/media/${mediaId}`;
  };

  return (
    <div className="navbar min-h-12 w-full min-w-0 overflow-x-auto bg-base-100">
      <div className="mx-auto min-w-max md:min-w-0">
        <ul className="menu menu-horizontal flex-nowrap gap-2 px-2 md:gap-5">
          <li>
            <Link to={buildUnified()}>
              <Info className="mr-1 w-4 h-4" />
              {t('media.tabs.info')}
            </Link>
          </li>
          <li>
            <Link to={buildUnified('activity')}>
              <History className="mr-1 w-4 h-4" />
              {t('media.tabs.activity')}
            </Link>
          </li>
          {!hideRankingFeatures && <li>
            <Link to={buildUnified('rankings')}>
              <BarChart className="mr-1 w-4 h-4" />
              {t('media.tabs.rankings')}
            </Link>
          </li>}
        </ul>
      </div>
    </div>
  );
}

export default ClubMediaNavbar;
