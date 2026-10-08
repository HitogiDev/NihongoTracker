import Hero from '../components/Hero';
import Dashboard from '../components/Dashboard';
import { useUserDataStore } from '../store/userData';
import { Navigate } from 'react-router-dom';
import { isMobileApp } from '../utils/nativeRuntime';

function HomeScreen() {
  const { user } = useUserDataStore();

  if (isMobileApp() && !user) return <Navigate to="/login" replace />;
  return user ? <Dashboard /> : <Hero />;
}

export default HomeScreen;
