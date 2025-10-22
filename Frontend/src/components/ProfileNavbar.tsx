import { Link, useLocation } from 'react-router-dom';

function ProfileNavbar({ username }: { username: string | undefined }) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === `/user/${username}/`) {
      // For overview, match exact path or path ending with username
      return (
        location.pathname === path || location.pathname === `/user/${username}`
      );
    }
    return location.pathname === path;
  };

  return (
    <div className="navbar min-h-12 bg-base-100">
      <div className="mx-auto">
        <ul className="menu menu-horizontal gap-5">
          <li>
            <Link
              to={`/user/${username}/`}
              className={
                isActive(`/user/${username}/`)
                  ? 'active bg-primary text-primary-content'
                  : ''
              }
            >
              Overview
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/stats`}
              className={
                isActive(`/user/${username}/stats`)
                  ? 'active bg-primary text-primary-content'
                  : ''
              }
            >
              Stats
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/list`}
              className={
                isActive(`/user/${username}/list`)
                  ? 'active bg-primary text-primary-content'
                  : ''
              }
            >
              Immersion List
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/goals`}
              className={
                isActive(`/user/${username}/goals`)
                  ? 'active bg-primary text-primary-content'
                  : ''
              }
            >
              Goals
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ProfileNavbar;
