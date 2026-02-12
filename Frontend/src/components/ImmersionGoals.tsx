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
  Trash,
  Pencil,
  Clock5,
  BookOpen,
  Play,
  FileText,
  CircleCheck,
  Settings,
  EllipsisVertical,
  Target,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Trophy,
} from 'lucide-react';

import GoalsModal from './GoalsModal';

const goalTypeConfig = {
  time: {
    label: 'Time',
    icon: Clock5,
    color: 'text-primary',
    unit: 'min',
  },
  chars: {
    label: 'Characters',
    icon: BookOpen,
    color: 'text-secondary',
    unit: 'chars',
  },
  episodes: {
    label: 'Episodes',
    icon: Play,
    color: 'text-accent',
    unit: 'ep',
  },
  pages: {
    label: 'Pages',
    icon: FileText,
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
    staleTime: 5 * 60 * 1000,
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
              <Settings className="w-5 h-5" />
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
                            <CircleCheck className="w-8 h-8 text-success" />
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
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold">Long-term Goals</h3>
            <span className="badge badge-primary badge-sm">
              {activeLongTermGoals.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
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

              // Calculate timeframe requirement with fallback
              const timeframeRequirement = progress
                ? progress.requiredPerTimeframe > 0
                  ? progress.requiredPerTimeframe
                  : progress.remainingDays > 0
                    ? progress.remainingTarget / progress.remainingDays
                    : 0
                : 0;

              const finalTimeframeRequirement =
                timeframeRequirement > 0
                  ? timeframeRequirement
                  : progress && progress.remainingDays > 0
                    ? goal.totalTarget / progress.remainingDays
                    : 0;

              const timeframeProgress = getTimeframeProgress();
              const timeframeProgressPercentage =
                finalTimeframeRequirement > 0
                  ? Math.min(
                      (timeframeProgress / finalTimeframeRequirement) * 100,
                      100
                    )
                  : 0;

              const timeframeLabel = getTimeframeLabel();

              const isCompleted = progressPercentage >= 100;
              const statusColor = isCompleted
                ? 'success'
                : progress?.isOnTrack
                  ? 'success'
                  : 'warning';

              return (
                <div
                  key={goal._id}
                  className={`card bg-base-100 shadow-lg overflow-hidden transition-all duration-200 hover:shadow-xl ${
                    isCompleted ? 'border-2 border-success/30' : ''
                  }`}
                >
                  {/* Top accent bar */}
                  <div
                    className={`h-1 ${
                      isCompleted
                        ? 'bg-success'
                        : progress?.isOnTrack
                          ? 'bg-primary'
                          : 'bg-warning'
                    }`}
                  />

                  <div className="card-body p-4 sm:p-5 gap-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                            isCompleted
                              ? 'bg-success/15'
                              : `bg-${statusColor === 'success' ? 'primary' : 'warning'}/15`
                          }`}
                        >
                          {isCompleted ? (
                            <Trophy className="w-5 h-5 text-success" />
                          ) : (
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm sm:text-base leading-tight truncate">
                            {formatLongTermProgress(
                              goal.totalTarget,
                              goal.type
                            )}
                            {goal.type !== 'time' ? ` ${config.unit}` : ''}{' '}
                            {config.label} Goal
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-base-content/60 mt-0.5">
                            <CalendarClock className="w-3 h-3 flex-shrink-0" />
                            <span>
                              Due{' '}
                              {new Date(goal.targetDate).toLocaleDateString(
                                undefined,
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )}
                            </span>
                            {progress && (
                              <>
                                <span className="text-base-content/30">·</span>
                                <span className={`text-${statusColor}`}>
                                  {getRemainingTimeText(goal)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions dropdown */}
                      <div className="dropdown dropdown-end">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-ghost btn-xs btn-square"
                        >
                          <EllipsisVertical className="w-4 h-4" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box z-[1] w-36 p-1 shadow-lg"
                        >
                          <li>
                            <button
                              onClick={() => handleEditGoal(goal)}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => handleDeleteGoal(goal._id)}
                              className="flex items-center gap-2 text-sm text-error"
                            >
                              <Trash className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {progress && (
                      <>
                        {/* Overall Progress */}
                        <div className="space-y-2">
                          <div className="flex items-end justify-between">
                            <div>
                              <span className="text-2xl font-bold tabular-nums">
                                {formatLongTermProgress(
                                  progress.totalProgress,
                                  goal.type
                                )}
                              </span>
                              <span className="text-sm text-base-content/50 ml-1">
                                /{' '}
                                {formatLongTermProgress(
                                  goal.totalTarget,
                                  goal.type
                                )}{' '}
                                {goal.type !== 'time' ? config.unit : ''}
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-1 text-sm font-semibold ${
                                isCompleted
                                  ? 'text-success'
                                  : progress.isOnTrack
                                    ? 'text-success'
                                    : 'text-warning'
                              }`}
                            >
                              {isCompleted ? (
                                <CircleCheck className="w-4 h-4" />
                              ) : progress.isOnTrack ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {Math.round(progressPercentage)}%
                            </div>
                          </div>

                          {/* Overall progress bar */}
                          <div className="w-full bg-base-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                isCompleted
                                  ? 'bg-success'
                                  : progress.isOnTrack
                                    ? 'bg-primary'
                                    : 'bg-warning'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Timeframe card */}
                        <div className="bg-base-200/60 rounded-xl p-3 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-semibold flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  timeframeProgressPercentage >= 100
                                    ? 'bg-success animate-pulse'
                                    : timeframeProgressPercentage >= 50
                                      ? 'bg-primary'
                                      : 'bg-warning'
                                }`}
                              />
                              {timeframeLabel}
                            </h5>
                            {timeframeProgressPercentage >= 100 ? (
                              <span className="badge badge-success badge-sm gap-1">
                                <CircleCheck className="w-3 h-3" />
                                Done
                              </span>
                            ) : (
                              <span className="text-xs text-base-content/50">
                                {formatLongTermProgress(
                                  Math.max(
                                    0,
                                    finalTimeframeRequirement -
                                      timeframeProgress
                                  ),
                                  goal.type
                                )}{' '}
                                {goal.type !== 'time' ? config.unit : ''}{' '}
                                remaining
                              </span>
                            )}
                          </div>

                          {/* Timeframe progress bar */}
                          <div className="relative">
                            <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                  timeframeProgressPercentage >= 100
                                    ? 'bg-success'
                                    : timeframeProgressPercentage >= 75
                                      ? 'bg-primary'
                                      : timeframeProgressPercentage >= 40
                                        ? 'bg-warning'
                                        : 'bg-error/70'
                                }`}
                                style={{
                                  width: `${Math.min(timeframeProgressPercentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium tabular-nums">
                              {formatLongTermProgress(
                                timeframeProgress,
                                goal.type
                              )}
                              {goal.type !== 'time' && ` ${config.unit}`}
                            </span>
                            <span className="text-base-content/50 tabular-nums">
                              {formatLongTermProgress(
                                finalTimeframeRequirement,
                                goal.type
                              )}
                              {goal.type !== 'time' && ` ${config.unit}`} needed
                            </span>
                          </div>
                        </div>

                        {/* Footer stats row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-base-content/50">
                          <span className="tabular-nums">
                            <span className="font-medium text-base-content/70">
                              Remaining:
                            </span>{' '}
                            {formatLongTermProgress(
                              progress.remainingTarget,
                              goal.type
                            )}
                            {goal.type !== 'time' && ` ${config.unit}`}
                          </span>
                          <span className="text-base-content/20">·</span>
                          <span className="tabular-nums">
                            {progress.remainingDays} days left
                          </span>
                          <span className="text-base-content/20">·</span>
                          <span
                            className={`font-medium ${
                              progress.isOnTrack
                                ? 'text-success'
                                : 'text-warning'
                            }`}
                          >
                            {progress.isOnTrack ? 'On track' : 'Behind pace'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeLongTermGoals.length > 3 && (
            <div className="text-center pt-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-ghost btn-sm gap-2"
              >
                View all {activeLongTermGoals.length} goals
              </button>
            </div>
          )}
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
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15">
                {(() => {
                  const EditIcon =
                    goalTypeConfig[editingGoal.type]?.icon || Target;
                  return (
                    <EditIcon
                      className={`w-5 h-5 ${goalTypeConfig[editingGoal.type]?.color || 'text-primary'}`}
                    />
                  );
                })()}
              </div>
              <div>
                <h3 className="font-bold text-lg">Edit Goal</h3>
                <p className="text-xs text-base-content/60">
                  Adjust your {goalTypeConfig[editingGoal.type]?.label} target
                </p>
              </div>
            </div>

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
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Goal Type</legend>
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
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Total Target</legend>
                <input
                  type="number"
                  name="totalTarget"
                  className="input input-bordered w-full"
                  defaultValue={editingGoal.totalTarget}
                  required
                  min="1"
                />
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Target Date</legend>
                  <input
                    type="date"
                    name="targetDate"
                    className="input input-bordered w-full"
                    defaultValue={
                      new Date(editingGoal.targetDate)
                        .toISOString()
                        .split('T')[0]
                    }
                    required
                  />
                </fieldset>

                <fieldset className="fieldset">
                  <legend className="fieldset-legend">
                    Display Progress As
                  </legend>
                  <select
                    name="displayTimeframe"
                    className="select select-bordered w-full"
                    defaultValue={editingGoal.displayTimeframe}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </fieldset>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    name="isActive"
                    className="toggle toggle-primary toggle-sm"
                    defaultChecked={editingGoal.isActive}
                  />
                  <span className="label-text">Active Goal</span>
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
                  {updateMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingGoal(null);
              }}
            >
              close
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}

export default ImmersionGoals;
