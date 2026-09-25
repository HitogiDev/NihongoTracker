import { useOutletContext } from 'react-router-dom';
import { OutletProfileContextType } from '../types';
import ImmersionGoals from '../components/ImmersionGoals';
import { useUserDataStore } from '../store/userData';
import { useTranslation } from 'react-i18next';
import ImmersionPlanner from '../components/ImmersionPlanner';

function GoalsScreen() {
  const { t } = useTranslation('goals');
  const { username } = useOutletContext<OutletProfileContextType>();
  const { user: loggedInUser } = useUserDataStore();

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">
                {username}'s Goals
              </h1>
              {username === loggedInUser?.username ? (
                <p className="text-base-content/70">{t('subtitle')}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Immersion Goals Section */}
        <div className="mb-8">
          <ImmersionGoals username={username} />
          {username === loggedInUser?.username && <ImmersionPlanner />}
        </div>

      </div>
    </div>
  );
}

export default GoalsScreen;
