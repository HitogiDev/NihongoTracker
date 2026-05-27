import { Link } from 'react-router-dom';
import { Info, BarChart, History } from 'lucide-react';

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
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <Link to={buildUnified()}>
              <Info className="mr-1 w-4 h-4" />
              Information
            </Link>
          </li>
          <li>
            <Link to={buildUnified('activity')}>
              <History className="mr-1 w-4 h-4" />
              Member Activity
            </Link>
          </li>
          <li>
            <Link to={buildUnified('rankings')}>
              <BarChart className="mr-1 w-4 h-4" />
              Club Rankings
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ClubMediaNavbar;
