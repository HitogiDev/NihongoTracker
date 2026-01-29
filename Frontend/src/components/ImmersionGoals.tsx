import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDailyGoalsFn,
  getLongTermGoalsFn,
  updateLongTermGoalFn,
  deleteLongTermGoalFn,
} from '../api/trackerApi';
import { ILongTermGoal } from '../types';
import {
  MdSchedule,
  MdBook,
  MdPlayArrow,
  MdPages,
  MdCheckCircle,
  MdSettings,
  MdEdit,
  MdDelete,
  MdMoreVert,
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

function ImmersionGoals({ username }: { username: string | undefined }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ILongTermGoal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: goalsData, isLoading } = useQuery({
    queryKey: [username, 'dailyGoals'],
    queryFn: () => getDailyGoalsFn(username),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: longTermGoalsData, isLoading: isLoadingLongTerm } = useQuery({
    queryKey: [username, 'longTermGoals'],
    queryFn: () => getLongTermGoalsFn(username),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes for dynamic updates
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteLongTermGoalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'longTermGoals'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      goalId,
      goal,
    }: {
      goalId: string;
      goal: Partial<ILongTermGoal>;
    }) => updateLongTermGoalFn(goalId, goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'longTermGoals'] });
      setIsEditModalOpen(false);
      setEditingGoal(null);
    },
  });

  const handleDeleteGoal = (goalId: string | undefined) => {
    if (!goalId) return;
    if (window.confirm('Are you sure you want to delete this goal?')) {
      deleteMutation.mutate(goalId);
    }
  };

  const handleEditGoal = (goal: ILongTermGoal) => {
    setEditingGoal(goal);
    setIsEditModalOpen(true);
  };

  const formatProgress = (value: number, type: string) => {
    if (type === 'chars') {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'k';
      }
      return value.toLocaleString();
    }
    if (type === 'time') {
      if (value >= 60) {
        return Math.round(value / 60) + 'h';
      }
      return value + 'min';
    }
    return value.toString();
  };

  const formatLongTermProgress = (value: number, type: string) => {
    if (type === 'chars') {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }
      return Math.round(value).toString();
    }
    if (type === 'time') {
      // Assuming value is in minutes
      if (value >= 60) {
        const hours = Math.round(value / 60);
        return hours === 1 ? '1hr' : `${hours}hrs`;
      }
      return Math.round(value) + 'min';
    }
    return value.toLocaleString();
  };

  const getRemainingTimeText = (goal: {
    progress?: { remainingDays: number };
  }) => {
    if (!goal.progress) return '';

    const days = goal.progress.remainingDays;
    if (days === 0) return 'Due today!';
    if (days === 1) return '1 day left';
    if (days < 7) return `${days} days left`;
    if (days < 30) return `${Math.ceil(days / 7)} weeks left`;
    return `${Math.ceil(days / 30)} months left`;
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const activeGoals = goalsData?.goals.filter((goal) => goal.isActive) || [];
  const activeLongTermGoals =
    longTermGoalsData?.goals.filter((goal) => goal.isActive) || [];

  if (isLoading || isLoadingLongTerm) {
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
            <h2 className="card-title text-2xl">Immersion Goals</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-ghost btn-sm"
              title="Manage Goals"
            >
              <MdSettings className="w-5 h-5" />
            </button>
          </div>

          {activeGoals.length === 0 && activeLongTermGoals.length === 0 ? (
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
                        className={`stat bg-base-200 rounded-lg p-4 relative ${
                          isCompleted ? 'border-2 border-success' : ''
                        }`}
                      >
                        <div className="stat-figure absolute right-4 top-4">
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

      {/* Long-term Goals Section */}
      {activeLongTermGoals.length > 0 && (
        <div className="card bg-base-100 shadow-xl mt-6">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-4">Long-term Goals</h3>
            <div className="space-y-4">
              {activeLongTermGoals.slice(0, 3).map((goal) => {
                const progress = goal.progress;
                const config = goalTypeConfig[goal.type];
                const Icon = config.icon;
                const progressPercentage = progress
                  ? Math.min(
                      (progress.totalProgress / goal.totalTarget) * 100,
                      100
                    )
                  : 0;

                // Get progress based on displayTimeframe
                const getTimeframeProgress = () => {
                  if (!progress) return 0;
                  switch (goal.displayTimeframe) {
                    case 'weekly':
                      return progress.progressThisWeek || 0;
                    case 'monthly':
                      return progress.progressThisMonth || 0;
                    default:
                      return progress.progressToday || 0;
                  }
                };

                const getTimeframeLabel = () => {
                  switch (goal.displayTimeframe) {
                    case 'weekly':
                      return 'This Week';
                    case 'monthly':
                      return 'This Month';
                    default:
                      return 'Today';
                  }
                };

                const getTimeframePeriod = () => {
                  switch (goal.displayTimeframe) {
                    case 'weekly':
                      return 'this week';
                    case 'monthly':
                      return 'this month';
                    default:
                      return 'today';
                  }
                };

                // Calculate timeframe requirement with fallback
                const timeframeRequirement = progress
                  ? progress.requiredPerTimeframe > 0
                    ? progress.requiredPerTimeframe
                    : progress.remainingDays > 0
                      ? progress.remainingTarget / progress.remainingDays
                      : 0
                  : 0;

                // Fallback calculation if all else fails
                const finalTimeframeRequirement =
                  timeframeRequirement > 0
                    ? timeframeRequirement
                    : progress && progress.remainingDays > 0
                      ? goal.totalTarget / progress.remainingDays
                      : 0;

                // Calculate timeframe progress percentage
                const timeframeProgress = getTimeframeProgress();
                const timeframeProgressPercentage =
                  finalTimeframeRequirement > 0
                    ? Math.min(
                        (timeframeProgress / finalTimeframeRequirement) * 100,
                        100
                      )
                    : 0;

                const timeframeLabel = getTimeframeLabel();
                const timeframePeriod = getTimeframePeriod();

                return (
                  <div key={goal._id} className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${config.color}`} />
                        <div>
                          <span className="font-medium text-sm">
                            {formatLongTermProgress(
                              goal.totalTarget,
                              goal.type
                            )}
                            {goal.type !== 'time' ? ` ${config.unit}` : ''} Goal
                          </span>
                          <div className="text-xs text-base-content/60 flex items-center gap-1">
                            {new Date(goal.targetDate).toLocaleDateString()}
                            {progress && (
                              <span className="ml-2 text-warning">
                                ({getRemainingTimeText(goal)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {progress && (
                          <div className="text-right text-xs">
                            <div className="font-medium">
                              {formatLongTermProgress(
                                progress.totalProgress,
                                goal.type
                              )}{' '}
                              /{' '}
                              {formatLongTermProgress(
                                goal.totalTarget,
                                goal.type
                              )}
                            </div>
                            <div
                              className={
                                progress.isOnTrack
                                  ? 'text-success'
                                  : 'text-warning'
                              }
                            >
                              {Math.round(progressPercentage)}% complete
                            </div>
                          </div>
                        )}

                        {/* Edit/Delete Dropdown */}
                        <div className="dropdown dropdown-end">
                          <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost btn-sm btn-square"
                          >
                            <MdMoreVert className="w-4 h-4" />
                          </div>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-base-100 rounded-box z-[1] w-32 p-1 shadow"
                          >
                            <li>
                              <button
                                onClick={() => handleEditGoal(goal)}
                                className="flex items-center gap-2 text-sm"
                              >
                                <MdEdit className="w-4 h-4" />
                                Edit
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => handleDeleteGoal(goal._id)}
                                className="flex items-center gap-2 text-sm text-error"
                              >
                                <MdDelete className="w-4 h-4" />
                                Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {progress && (
                      <>
                        {/* Overall Progress Bar */}
                        <div className="w-full bg-base-300 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              progress.isOnTrack ? 'bg-success' : 'bg-warning'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>

                        {/* Timeframe Progress Section */}
                        <div className="bg-base-200 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-sm">
                              {timeframeLabel}'s Progress
                            </h4>
                            <div className="badge badge-sm badge-outline">
                              {Math.round(timeframeProgressPercentage)}% of{' '}
                              {goal.displayTimeframe}
                              goal
                            </div>
                          </div>

                          {/* Timeframe Progress Bar - More Prominent */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium">
                                {formatLongTermProgress(
                                  timeframeProgress,
                                  goal.type
                                )}
                                {goal.type !== 'time' && ` ${config.unit}`}
                              </span>
                              <span className="text-base-content/60">
                                /{' '}
                                {formatLongTermProgress(
                                  finalTimeframeRequirement,
                                  goal.type
                                )}
                                {goal.type !== 'time' && ` ${config.unit}`}{' '}
                                needed
                              </span>
                            </div>
                            <div className="w-full bg-base-300 rounded-full h-3 relative">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  timeframeProgressPercentage >= 100
                                    ? 'bg-gradient-to-r from-success to-success'
                                    : timeframeProgressPercentage >= 75
                                      ? 'bg-gradient-to-r from-warning to-warning'
                                      : 'bg-gradient-to-r from-error to-warning'
                                }`}
                                style={{
                                  width: `${Math.min(timeframeProgressPercentage, 100)}%`,
                                }}
                              >
                                {timeframeProgressPercentage >= 100 && (
                                  <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse"></div>
                                )}
                              </div>
                              {/* Goal marker at 100% */}
                              <div className="absolute right-0 top-0 h-3 w-0.5 bg-base-content/40 rounded-full"></div>
                            </div>

                            {/* Remaining for timeframe */}
                            <div className="flex items-center justify-between text-xs">
                              <div
                                className={`flex items-center gap-1 ${
                                  timeframeProgressPercentage >= 100
                                    ? 'text-success'
                                    : 'text-warning'
                                }`}
                              >
                                {timeframeProgressPercentage >= 100 ? (
                                  <>
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                                    {goal.displayTimeframe
                                      .charAt(0)
                                      .toUpperCase() +
                                      goal.displayTimeframe.slice(1)}{' '}
                                    goal completed!
                                  </>
                                ) : (
                                  <>
                                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                                    {formatLongTermProgress(
                                      Math.max(
                                        0,
                                        finalTimeframeRequirement -
                                          timeframeProgress
                                      ),
                                      goal.type
                                    )}
                                    {goal.type !== 'time' && ` ${config.unit}`}{' '}
                                    remaining {timeframePeriod}
                                  </>
                                )}
                              </div>
                              <div className="text-base-content/60">
                                {progress.remainingDays} days left
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Overall Goal Summary */}
                        <div
                          className={`alert alert-sm ${
                            progress.isOnTrack
                              ? 'alert-success'
                              : 'alert-warning'
                          }`}
                        >
                          <div className="text-xs opacity-80">
                            <strong>Total remaining:</strong>{' '}
                            {formatLongTermProgress(
                              progress.remainingTarget,
                              goal.type
                            )}
                            {goal.type !== 'time' && ` ${config.unit}`}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {activeLongTermGoals.length > 3 && (
                <div className="text-center">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-ghost btn-sm"
                  >
                    View All ({activeLongTermGoals.length}) Long-term Goals
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <GoalsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        goals={goalsData?.goals || []}
        username={username}
      />

      {/* Edit Long-term Goal Modal */}
      {isEditModalOpen && editingGoal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Edit Long-term Goal</h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updatedGoal = {
                  type: editingGoal.type,
                  totalTarget: Number(formData.get('totalTarget')),
                  targetDate: formData.get('targetDate') as string,
                  displayTimeframe: formData.get('displayTimeframe') as
                    | 'daily'
                    | 'weekly'
                    | 'monthly',
                  isActive: formData.get('isActive') === 'on',
                };
                updateMutation.mutate({
                  goalId: editingGoal._id!,
                  goal: updatedGoal,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="label">
                  <span className="label-text">Goal Type</span>
                </label>
                <select
                  name="type"
                  className="select select-bordered w-full"
                  defaultValue={editingGoal.type}
                  disabled
                >
                  <option value="time">Time (minutes)</option>
                  <option value="chars">Characters</option>
                  <option value="episodes">Episodes</option>
                  <option value="pages">Pages</option>
                </select>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Total Target</span>
                </label>
                <input
                  type="number"
                  name="totalTarget"
                  className="input input-bordered w-full"
                  defaultValue={editingGoal.totalTarget}
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Target Date</span>
                </label>
                <input
                  type="date"
                  name="targetDate"
                  className="input input-bordered w-full"
                  defaultValue={
                    new Date(editingGoal.targetDate).toISOString().split('T')[0]
                  }
                  required
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Display Timeframe</span>
                </label>
                <select
                  name="displayTimeframe"
                  className="select select-bordered w-full"
                  defaultValue={editingGoal.displayTimeframe}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Active Goal</span>
                  <input
                    type="checkbox"
                    name="isActive"
                    className="checkbox"
                    defaultChecked={editingGoal.isActive}
                  />
                </label>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingGoal(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ImmersionGoals;
