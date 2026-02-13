import { useUserDataStore } from '../store/userData';
import Tabs from '../components/Tabs';
import AnimeLogs from '../components/AnimeLogs';
import VNLogs from '../components/VNLogs';
import MangaLogs from '../components/MangaLogs';
import ReadingLogs from '../components/ReadingLogs';
import VideoLogs from '../components/VideoLogs';
import MovieLogs from '../components/MovieLogs';
import TVShowLogs from '../components/TVShowLogs';

function AssignMedia() {
  const { user } = useUserDataStore();

  return (
    <div className="pt-24 py-16 flex flex-col justify-center items-center bg-base-200 min-h-screen">
      <div className="w-full">
        <Tabs
          tabs={[
            {
              label: 'Anime',
              component: (isActive) => (
                <AnimeLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'Manga',
              component: (isActive) => (
                <MangaLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'VN',
              component: (isActive) => (
                <VNLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'Reading',
              component: (isActive) => (
                <ReadingLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'Video',
              component: (isActive) => (
                <VideoLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'Movie',
              component: (isActive) => (
                <MovieLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: 'TV Show',
              component: (isActive) => (
                <TVShowLogs username={user?.username} isActive={isActive} />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export default AssignMedia;
