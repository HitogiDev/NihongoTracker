import { Link } from 'react-router-dom';
import { IMediaDocument } from '../types';

function MediaNavbar({
  mediaType,
  mediaId,
  username,
}: {
  mediaType: IMediaDocument['type'] | undefined;
  mediaId: string | undefined;
  username: string | undefined;
}) {
  return (
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <Link to={`/${mediaType}/${mediaId}/${username}`}>Overview</Link>
          </li>
          <li>
            <Link to={`/${mediaType}/${mediaId}/${username}/social`}>
              Social
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default MediaNavbar;
