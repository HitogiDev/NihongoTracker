import { NavLink } from 'react-router-dom';
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
  const basePath = username
    ? `/${mediaType}/${mediaId}/${username}`
    : `/${mediaType}/${mediaId}`;

  const activeTabClass = 'active bg-primary text-primary-content';

  return (
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <NavLink
              to={basePath}
              end
              className={({ isActive }) => (isActive ? activeTabClass : '')}
            >
              Overview
            </NavLink>
          </li>
          <li>
            <NavLink
              to={`${basePath}/reviews`}
              className={({ isActive }) => (isActive ? activeTabClass : '')}
            >
              Reviews
            </NavLink>
          </li>
          <li>
            <NavLink
              to={`${basePath}/social`}
              className={({ isActive }) => (isActive ? activeTabClass : '')}
            >
              Social
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default MediaNavbar;
