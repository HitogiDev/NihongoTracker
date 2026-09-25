import Hero from '../components/Hero';
import Dashboard from '../components/Dashboard';
import { useUserDataStore } from '../store/userData';

function HomeScreen() {
  const { user } = useUserDataStore();

  return user ? <Dashboard /> : <Hero />;
}

export default HomeScreen;
