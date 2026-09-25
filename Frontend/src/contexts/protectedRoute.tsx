import { Navigate, Outlet } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';

function ProtectedRoutes() {
  const { user } = useUserDataStore();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return <Outlet />;
}

export default ProtectedRoutes;
