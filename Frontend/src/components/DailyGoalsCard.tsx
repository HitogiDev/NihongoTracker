import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyGoalsFn } from '../api/trackerApi';
import {
  MdSchedule,
  MdBook,
  MdPlayArrow,
  MdPages,
  MdCheckCircle,
  MdSettings,
} from 'react-icons/md';
import GoalsModal from './GoalsModal';

const goalTypeConfig = {
  time: {
    label: 'Time',
    icon: MdSchedule,
    color: 'text-primary',
    unit: 'min',
  },
  chars: {
    label: 'Characters',
    icon: MdBook,
    color: 'text-secondary',
    unit: 'chars',
  },
  episodes: {
    label: 'Episodes',
    icon: MdPlayArrow,
    color: 'text-accent',
    unit: 'ep',
  },
  pages: {
    label: 'Pages',
    icon: MdPages,
    color: 'text-info',
    unit: 'pages',
  },
};

function DailyGoalsCard({ username }: { username: string | undefined }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: goalsData, isLoading } = useQuery({
    queryKey: [username, 'dailyGoals'],
    queryFn: () => getDailyGoalsFn(username), // Replace 'username' with actual username
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const formatProgress = (value: number, type: string) => {
    if (type === 'chars') {
      return value.toLocaleString();
    }
    return value.toString();
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const activeGoals = goalsData?.goals.filter((goal) => goal.isActive) || [];
  const completedToday = activeGoals.filter(
    (goal) => goalsData?.todayProgress.completed[goal.type]
  ).length;

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4 sm:p-6">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Daily Goals</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-ghost btn-sm"
              title="Manage Goals"
            >
              <MdSettings className="w-4 h-4" />
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-base-content/70 mb-3">No active goals set</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary btn-sm"
              >
                Create Your First Goal
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="stat bg-base-200 rounded-lg p-3">
                  <div className="stat-title text-xs">Today's Progress</div>
                  <div className="stat-value text-lg">
                    {completedToday}/{activeGoals.length}
                  </div>
                  <div className="stat-desc">goals completed</div>
                </div>
              </div>

              <div className="space-y-3">
                {activeGoals.map((goal) => {
                  const current = goalsData?.todayProgress[goal.type] || 0;
                  const isCompleted =
                    goalsData?.todayProgress.completed[goal.type];
                  const percentage = getProgressPercentage(
                    current,
                    goal.target
                  );
                  const config = goalTypeConfig[goal.type];
                  const Icon = config.icon;

                  return (
                    <div key={goal._id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <MdCheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          )}
                          <span className="text-sm font-medium">
                            {config.label}
                          </span>
                        </div>
                        <span className="text-sm text-base-content/70">
                          {formatProgress(current, goal.type)}/
                          {formatProgress(goal.target, goal.type)} {config.unit}
                        </span>
                      </div>
                      <div className="w-full bg-base-300 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <GoalsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        goals={goalsData?.goals || []}
      />
    </>
  );
}

export default DailyGoalsCard;
