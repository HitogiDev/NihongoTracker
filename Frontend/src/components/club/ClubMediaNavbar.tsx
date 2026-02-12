import { Link } from 'react-router-dom';
import { Info, MessageSquareText, BarChart, History } from 'lucide-react';

function ClubMediaNavbar({
  clubId,
  mediaId,
}: {
  clubId: string;
  mediaId: string;
}) {
  return (
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}`}>
              <Info className="mr-1 w-4 h-4" />
              Information
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/activity`}>
              <History className="mr-1 w-4 h-4" />
              Member Activity
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/reviews`}>
              <MessageSquareText className="mr-1 w-4 h-4" />
              Reviews
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/rankings`}>
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
