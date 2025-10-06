import { Link } from 'react-router-dom';
import { MdInfo, MdComment, MdLeaderboard, MdHistory } from 'react-icons/md';

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
              <MdInfo className="mr-2" />
              Information
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/activity`}>
              <MdHistory className="mr-2" />
              Member Activity
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/reviews`}>
              <MdComment className="mr-2" />
              Reviews
            </Link>
          </li>
          <li>
            <Link to={`/clubs/${clubId}/media/${mediaId}/rankings`}>
              <MdLeaderboard className="mr-2" />
              Club Rankings
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ClubMediaNavbar;
