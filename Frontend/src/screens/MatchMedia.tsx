import { useTranslation } from 'react-i18next';
import { useUserDataStore } from '../store/userData';
import Tabs from '../components/Tabs';
import AnimeLogs from '../components/AnimeLogs';
import VNLogs from '../components/VNLogs';
import MangaLogs from '../components/MangaLogs';
import ReadingLogs from '../components/ReadingLogs';
import BookLogs from '../components/BookLogs';
import VideoLogs from '../components/VideoLogs';
import MovieLogs from '../components/MovieLogs';
import TVShowLogs from '../components/TVShowLogs';
import GameLogs from '../components/GameLogs';

function AssignMedia() {
  const { t } = useTranslation('common');
  const { user } = useUserDataStore();

  return (
    <div className="pt-28 py-16 flex flex-col justify-center items-center bg-base-200 min-h-screen">
      <div className="w-full">
        <Tabs
          tabs={[
            {
              label: t('mediaTypes.anime'),
              component: (isActive) => (
                <AnimeLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.manga'),
              component: (isActive) => (
                <MangaLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.vn'),
              component: (isActive) => (
                <VNLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.game'),
              component: (isActive) => (
                <GameLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.light-novel'),
              component: (isActive) => (
                <ReadingLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.book'),
              component: (isActive) => (
                <BookLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.video'),
              component: (isActive) => (
                <VideoLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.movie'),
              component: (isActive) => (
                <MovieLogs username={user?.username} isActive={isActive} />
              ),
            },
            {
              label: t('mediaTypes.tvShow'),
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
