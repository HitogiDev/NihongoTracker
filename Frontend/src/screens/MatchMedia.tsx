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
              component: <AnimeLogs username={user?.username} />,
            },
            {
              label: 'Manga',
              component: <MangaLogs username={user?.username} />,
            },
            { label: 'VN', component: <VNLogs username={user?.username} /> },
            {
              label: 'Reading',
              component: <ReadingLogs username={user?.username} />,
            },
            {
              label: 'Video',
              component: <VideoLogs username={user?.username} />,
            },
            {
              label: 'Movie',
              component: <MovieLogs username={user?.username} />,
            },
            {
              label: 'TV Show',
              component: <TVShowLogs username={user?.username} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

export default AssignMedia;
