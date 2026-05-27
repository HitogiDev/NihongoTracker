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
  const searchParams = new URLSearchParams(window.location.search);
  const clubId = searchParams.get('clubId');
  const clubMediaId = searchParams.get('clubMediaId');

  const buildPath = (section?: 'reviews' | 'social') => {
    const pathname = username
      ? `/${mediaType}/${mediaId}/${username}${section ? `/${section}` : ''}`
      : `/${mediaType}/${mediaId}${section ? `/${section}` : ''}`;

    if (clubId && clubMediaId) {
      const search = new URLSearchParams({
        clubId,
        clubMediaId,
      }).toString();

      return { pathname, search: `?${search}` };
    }

    return pathname;
  };

  const activeTabClass = 'active bg-primary text-primary-content';

  return (
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <NavLink
              to={buildPath()}
              end
              className={({ isActive }) => (isActive ? activeTabClass : '')}
            >
              Overview
            </NavLink>
          </li>
          <li>
            <NavLink
              to={buildPath('reviews')}
              className={({ isActive }) => (isActive ? activeTabClass : '')}
            >
              Reviews
            </NavLink>
          </li>
          <li>
            <NavLink
              to={buildPath('social')}
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
