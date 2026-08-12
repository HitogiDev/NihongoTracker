import { Target, CalendarRange, FlagTriangleRight, Plus } from 'lucide-react';
import { IClubGoal } from '../../types';
import { useTranslation } from 'react-i18next';

interface ClubGoalsCardProps {
  clubGoals?: IClubGoal[];
  canManage?: boolean;
  onManage?: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString();
}

function formatTarget(goal: IClubGoal): string {
  if (goal.type !== 'time') {
    return goal.target.toLocaleString();
  }

  const totalMinutes = goal.target;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

function getGoalLabel(goal: IClubGoal): string {
  const typeLabel =
    goal.type === 'time'
      ? 'Minutes'
      : goal.type === 'chars'
        ? 'Characters'
        : goal.type === 'episodes'
          ? 'Episodes'
          : 'Pages';

  const periodLabel =
    goal.period === 'weekly'
      ? 'weekly'
      : goal.period === 'monthly'
        ? 'monthly'
        : goal.period === 'custom'
          ? 'custom period'
          : 'ongoing';

  return `${typeLabel} ${periodLabel}`;
}

function getGoalWindowLabel(goal: IClubGoal): string {
  if (goal.period === 'custom' && goal.startDate && goal.endDate) {
    return `${formatDate(goal.startDate)} - ${formatDate(goal.endDate)}`;
  }

  if (goal.period === 'weekly') {
    return 'Resets weekly';
  }

  if (goal.period === 'monthly') {
    return 'Resets monthly';
  }

  if (goal.period === 'indefinite') {
    return goal.createdAt
      ? `Ongoing since ${formatDate(goal.createdAt)}`
      : 'Ongoing goal';
  }

  return 'Custom period';
}

export default function ClubGoalsCard({
  clubGoals,
  canManage = false,
  onManage,
}: ClubGoalsCardProps) {
  const { t } = useTranslation('clubs');
  const activeGoals = (clubGoals || []).filter((goal) => goal.isActive);

  return (
    <div className="card surface">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-lg flex items-center gap-2">
              <Target className="w-5 h-5" />
              {t('goals.title')}
            </h2>
            <p className="text-sm text-base-content/60">
              {t('goals.subtitle')}
            </p>
          </div>

          {canManage && onManage && (
            <button className="btn btn-outline btn-sm" onClick={onManage}>
              {t('goals.manage')}
            </button>
          )}
        </div>

        {activeGoals.length === 0 ? (
          canManage ? (
            <button
              type="button"
              onClick={onManage}
              className="rounded-[2rem] border-2 border-dashed border-base-300 bg-base-200/30 p-8 text-left hover:bg-base-200/60 cursor-pointer transition-colors"
            >
              <div className="flex min-h-[160px] flex-col items-center justify-center text-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-base-content/90">
                  <Plus
                    className="h-10 w-10 text-base-content/90"
                    strokeWidth={2}
                  />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-xl font-semibold text-base-content">
                    {t('goals.addTitle')}
                  </p>
                  <p className="text-sm text-base-content/70">
                    {t('goals.addBody')}
                  </p>
                  <p className="text-sm font-medium text-primary">
                    {t('goals.addCta')}
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-[2rem] border-2 border-dashed border-base-300 bg-base-200/30 p-8 text-left">
              <div className="flex min-h-[160px] flex-col items-center justify-center text-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-base-content/90">
                  <Plus
                    className="h-10 w-10 text-base-content/90"
                    strokeWidth={2}
                  />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-xl font-semibold text-base-content">
                    {t('goals.emptyTitle')}
                  </p>
                  <p className="text-sm text-base-content/70">
                    {t('goals.emptyBody')}
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {activeGoals.map((goal, index) => {
              const totalTarget = Math.max(goal.target, 1);
              const progress = Math.min(goal.currentProgress, totalTarget);
              const percentage = Math.min(
                100,
                Math.round((progress / totalTarget) * 100)
              );

              return (
                <div
                  key={`${goal.type}-${goal.period}-${index}`}
                  className="space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">
                        {getGoalLabel(goal)}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {getGoalWindowLabel(goal)}
                      </p>
                    </div>
                    <span className="badge badge-soft badge-primary">
                      {goal.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <progress
                    className="progress progress-primary w-full"
                    value={progress}
                    max={totalTarget}
                  />

                  <div className="flex items-center justify-between text-xs text-base-content/70">
                    <span className="flex items-center gap-1">
                      <FlagTriangleRight className="w-3 h-3" />
                      {goal.type === 'time'
                        ? `${formatTarget({ ...goal, target: progress })} / ${formatTarget(goal)}`
                        : `${progress.toLocaleString()} / ${totalTarget.toLocaleString()}`}
                    </span>
                    <span>{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {clubGoals && clubGoals.length > activeGoals.length && (
          <div className="divider my-0" />
        )}

        {clubGoals && clubGoals.length > activeGoals.length && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-base-content/50">
              {t('goals.archived')}
            </p>
            {clubGoals
              .filter((goal) => !goal.isActive)
              .map((goal, index) => (
                <div
                  key={`inactive-${goal.type}-${goal.period}-${index}`}
                  className="rounded-lg bg-base-200/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{getGoalLabel(goal)}</span>
                    <span className="text-xs text-base-content/50">
                      {t('goals.paused')}
                    </span>
                  </div>
                  <p className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                    <CalendarRange className="w-3 h-3" />
                    {getGoalWindowLabel(goal)}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
