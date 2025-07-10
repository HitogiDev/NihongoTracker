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

function DailyGoals({ username }: { username: string | undefined }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: goalsData, isLoading } = useQuery({
    queryKey: [username, 'dailyGoals'],
    queryFn: () => getDailyGoalsFn(username),
    staleTime: 5 * 60 * 1000, // 5 minutes
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

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title text-2xl">Daily Goals</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-ghost btn-sm"
              title="Manage Goals"
            >
              <MdSettings className="w-5 h-5" />
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/70 mb-4">No active goals set</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary"
              >
                Create Your First Goal
              </button>
            </div>
          ) : (
            <>
              {/* Today's Progress */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Today's Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <div
                        key={goal._id}
                        className={`stat bg-base-200 rounded-lg p-4 ${
                          isCompleted ? 'border-2 border-success' : ''
                        }`}
                      >
                        <div className="stat-figure">
                          {isCompleted ? (
                            <MdCheckCircle className="w-8 h-8 text-success" />
                          ) : (
                            <Icon className={`w-8 h-8 ${config.color}`} />
                          )}
                        </div>
                        <div className="stat-title text-xs">{config.label}</div>
                        <div
                          className={`stat-value text-lg ${isCompleted ? 'text-success' : config.color}`}
                        >
                          {formatProgress(current, goal.type)}
                        </div>
                        <div className="stat-desc">
                          of {formatProgress(goal.target, goal.type)}{' '}
                          {config.unit}
                        </div>
                        <div className="w-full bg-base-300 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isCompleted ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

export default DailyGoals;
