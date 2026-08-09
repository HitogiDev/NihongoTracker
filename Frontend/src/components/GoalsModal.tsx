import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import {
  createDailyGoalFn,
  deleteDailyGoalFn,
  updateDailyGoalFn,
  createLongTermGoalFn,
} from '../api/trackerApi';
import { IDailyGoal, ILongTermGoal } from '../types';

import {
  Plus,
  Trash,
  Pencil,
  Save,
  CircleX,
  Clock5,
  BookOpen,
  Play,
  FileText,
  X,
  Clock12,
} from 'lucide-react';

/** Module scope: key names, never text. */
const goalTypeConfig = {
  time: {
    labelKey: 'types.timeMinutes',
    icon: Clock5,
    color: 'text-primary',
    unit: 'min',
  },
  chars: {
    labelKey: 'types.chars',
    icon: BookOpen,
    color: 'text-secondary',
    unit: 'chars',
  },
  episodes: {
    labelKey: 'types.episodes',
    icon: Play,
    color: 'text-accent',
    unit: 'ep',
  },
  pages: {
    labelKey: 'types.pages',
    icon: FileText,
    color: 'text-info',
    unit: 'pages',
  },
};

interface GoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: IDailyGoal[];
  username: string | undefined;
}

function GoalsModal({ isOpen, onClose, goals, username }: GoalsModalProps) {
  const { t } = useTranslation(['goals', 'common']);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalDuration, setGoalDuration] = useState<'daily' | 'long-term'>(
    'daily'
  );
  const [newGoal, setNewGoal] = useState<
    Omit<IDailyGoal, '_id' | 'createdAt' | 'updatedAt'>
  >({
    type: 'time',
    target: 30,
    isActive: true,
  });
  const [newLongTermGoal, setNewLongTermGoal] = useState<
    Omit<ILongTermGoal, '_id' | 'createdAt' | 'updatedAt' | 'progress'>
  >({
    type: 'chars',
    totalTarget: 1000000,
    targetDate: new Date(new Date().getFullYear() + 1, 0, 1)
      .toISOString()
      .split('T')[0],
    displayTimeframe: 'daily',
    startDate: new Date().toISOString().split('T')[0],
    isActive: true,
  });
  const [editGoal, setEditGoal] = useState<Partial<IDailyGoal>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dailyGoalToDelete, setDailyGoalToDelete] = useState<IDailyGoal | null>(
    null
  );

  const queryClient = useQueryClient();

  const { mutate: createGoal, isPending: isCreatingGoal } = useMutation({
    mutationFn: createDailyGoalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
      toast.success(t('toast.dailyCreated'));
      setIsCreating(false);
      setNewGoal({ type: 'time', target: 30, isActive: true });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message
          : t('common:errors.generic');
      toast.error(errorMessage);
    },
  });

  const { mutate: updateGoal, isPending: isUpdatingGoal } = useMutation({
    mutationFn: ({
      goalId,
      goal,
    }: {
      goalId: string;
      goal: Partial<IDailyGoal>;
    }) => updateDailyGoalFn(goalId, goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
      toast.success(t('toast.dailyUpdated'));
      setEditingGoal(null);
      setEditGoal({});
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message
          : t('common:errors.generic');
      toast.error(errorMessage);
    },
  });

  const { mutate: deleteGoal, isPending: isDeletingGoal } = useMutation({
    mutationFn: deleteDailyGoalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
      toast.success(t('toast.dailyDeleted'));
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message
          : t('common:errors.generic');
      toast.error(errorMessage);
    },
  });

  // Long-term goal mutations
  const { mutate: createLongGoal, isPending: isCreatingLongGoal } = useMutation(
    {
      mutationFn: createLongTermGoalFn,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
        queryClient.invalidateQueries({
          queryKey: [username, 'longTermGoals'],
        });
        toast.success(t('toast.longTermCreated'));
        setIsCreating(false);
        setNewLongTermGoal({
          type: 'chars',
          totalTarget: 1000000,
          targetDate: new Date(new Date().getFullYear() + 1, 0, 1)
            .toISOString()
            .split('T')[0],
          displayTimeframe: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          isActive: true,
        });
      },
      onError: (error) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data?.message
            : t('common:errors.generic');
        toast.error(errorMessage);
      },
    }
  );

  const validateGoal = (
    goal: { type: string; target: number },
    isEdit = false
  ) => {
    const validationErrors: Record<string, string> = {};

    if (goal.target <= 0) {
      validationErrors.target = t('validation.targetPositive');
    }

    if (goal.type === 'time' && goal.target > 1440) {
      validationErrors.target = t('validation.timeTooHigh');
    }

    if (goal.type === 'chars' && goal.target > 100000) {
      validationErrors.target = t('validation.charsTooHigh');
    }

    if (goal.type === 'episodes' && goal.target > 50) {
      validationErrors.target = t('validation.episodesTooHigh');
    }

    if (goal.type === 'pages' && goal.target > 500) {
      validationErrors.target = t('validation.pagesTooHigh');
    }

    // Check for duplicate goal types when creating
    if (!isEdit) {
      const existingGoal = goals.find(
        (g) => g.type === goal.type && g.isActive
      );
      if (existingGoal) {
        validationErrors.duplicate = t('validation.duplicate', {
          type: t(
            goalTypeConfig[goal.type as keyof typeof goalTypeConfig]
              .labelKey as ParseKeys<'goals'>
          ).toLowerCase(),
        });
      }
    }

    return validationErrors;
  };

  const validateLongTermGoal = (goal: {
    type: string;
    totalTarget: number;
    targetDate: string | Date;
    startDate: string | Date;
  }) => {
    const validationErrors: Record<string, string> = {};

    if (goal.totalTarget <= 0) {
      validationErrors.totalTarget = t('validation.totalTargetPositive');
    }

    const targetDate = new Date(goal.targetDate);
    const startDate = new Date(goal.startDate);
    const now = new Date();

    if (targetDate <= now) {
      validationErrors.targetDate = t('validation.targetDateFuture');
    }

    if (startDate >= targetDate) {
      validationErrors.startDate = t('validation.startBeforeTarget');
    }

    // Validate reasonable targets
    if (goal.type === 'chars' && goal.totalTarget > 10000000) {
      validationErrors.totalTarget = t('validation.totalCharsTooHigh');
    }

    if (goal.type === 'time' && goal.totalTarget > 525600) {
      validationErrors.totalTarget = t('validation.totalTimeTooHigh');
    }

    return validationErrors;
  };

  const handleCreateGoal = () => {
    if (goalDuration === 'daily') {
      const validationErrors = validateGoal(newGoal);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        if (validationErrors.duplicate) {
          toast.error(validationErrors.duplicate);
        }
        return;
      }

      createGoal(newGoal);
    } else {
      // Handle long-term goal creation
      const validationErrors = validateLongTermGoal(newLongTermGoal);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      createLongGoal(newLongTermGoal);
    }
  };

  const handleUpdateGoal = (goalId: string) => {
    if (editGoal.target !== undefined && editGoal.type) {
      const validationErrors = validateGoal(
        {
          type: editGoal.type,
          target: editGoal.target,
        },
        true
      );
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }
    }

    updateGoal({ goalId, goal: editGoal });
  };

  const startEdit = (goal: IDailyGoal) => {
    setEditingGoal(goal._id!);
    setEditGoal({
      type: goal.type,
      target: goal.target,
      isActive: goal.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingGoal(null);
    setEditGoal({});
  };

  const formatProgress = (value: number, type: IDailyGoal['type']) => {
    if (type === 'chars') {
      return value.toLocaleString();
    }
    return value.toString();
  };

  if (!isOpen) return null;

  const handleRequestDeleteGoal = (goal: IDailyGoal) => {
    setDailyGoalToDelete(goal);
  };

  const handleConfirmDeleteGoal = () => {
    if (!dailyGoalToDelete?._id) return;
    deleteGoal(dailyGoalToDelete._id);
    setDailyGoalToDelete(null);
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('modal.manageTitle')}</h2>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Goal Form */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t('modal.createNew')}</h3>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? t('modal.cancel') : t('modal.addGoal')}
            </button>
          </div>

          {isCreating && (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="mb-4">
                  <label className="label">
                    <span className="label-text">
                      {t('modal.goalDuration')}
                    </span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={goalDuration}
                    onChange={(e) => {
                      setGoalDuration(e.target.value as 'daily' | 'long-term');
                      setErrors({});
                    }}
                  >
                    <option value="daily">{t('modal.dailyGoal')}</option>
                    <option value="long-term">{t('modal.longTermGoal')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">{t('modal.goalType')}</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={
                        goalDuration === 'daily'
                          ? newGoal.type
                          : newLongTermGoal.type
                      }
                      onChange={(e) => {
                        if (goalDuration === 'daily') {
                          setNewGoal({
                            ...newGoal,
                            type: e.target.value as IDailyGoal['type'],
                          });
                        } else {
                          setNewLongTermGoal({
                            ...newLongTermGoal,
                            type: e.target.value as ILongTermGoal['type'],
                          });
                        }
                        setErrors({});
                      }}
                    >
                      {Object.entries(goalTypeConfig).map(([key, config]) => (
                        <option key={key} value={key}>
                          {t(config.labelKey as ParseKeys<'goals'>)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">
                        {goalDuration === 'daily'
                          ? t('modal.dailyTarget')
                          : t('modal.totalTarget')}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className={`input input-bordered w-full ${
                        (goalDuration === 'daily' && errors.target) ||
                        (goalDuration === 'long-term' && errors.totalTarget)
                          ? 'input-error'
                          : ''
                      }`}
                      value={
                        goalDuration === 'daily'
                          ? newGoal.target
                          : newLongTermGoal.totalTarget
                      }
                      onChange={(e) => {
                        if (goalDuration === 'daily') {
                          setNewGoal({
                            ...newGoal,
                            target: Number(e.target.value),
                          });
                        } else {
                          setNewLongTermGoal({
                            ...newLongTermGoal,
                            totalTarget: Number(e.target.value),
                          });
                        }
                        setErrors({});
                      }}
                      placeholder={t('modal.targetPlaceholder')}
                    />
                    {((goalDuration === 'daily' && errors.target) ||
                      (goalDuration === 'long-term' && errors.totalTarget)) && (
                      <label className="label">
                        <span className="label-text-alt text-error flex items-center gap-1">
                          <Clock12 className="w-4 h-4" />
                          {goalDuration === 'daily'
                            ? errors.target
                            : errors.totalTarget}
                        </span>
                      </label>
                    )}
                  </div>

                  {goalDuration === 'long-term' && (
                    <div>
                      <label className="label">
                        <span className="label-text">
                          {t('modal.displayProgress')}
                        </span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={newLongTermGoal.displayTimeframe}
                        onChange={(e) => {
                          setNewLongTermGoal({
                            ...newLongTermGoal,
                            displayTimeframe: e.target
                              .value as ILongTermGoal['displayTimeframe'],
                          });
                          setErrors({});
                        }}
                      >
                        <option value="daily">
                          {t('modal.dailyProgress')}
                        </option>
                        <option value="weekly">
                          {t('modal.weeklyProgress')}
                        </option>
                        <option value="monthly">
                          {t('modal.monthlyProgress')}
                        </option>
                      </select>
                    </div>
                  )}
                </div>

                {goalDuration === 'long-term' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="label">
                        <span className="label-text">
                          {t('modal.startDate')}
                        </span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered w-full ${errors.startDate ? 'input-error' : ''}`}
                        value={
                          typeof newLongTermGoal.startDate === 'string'
                            ? newLongTermGoal.startDate
                            : new Date(newLongTermGoal.startDate)
                                .toISOString()
                                .split('T')[0]
                        }
                        onChange={(e) => {
                          setNewLongTermGoal({
                            ...newLongTermGoal,
                            startDate: e.target.value,
                          });
                          setErrors({});
                        }}
                      />
                      {errors.startDate && (
                        <div className="label">
                          <span className="label-text-alt text-error">
                            {errors.startDate}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text">
                          {t('modal.targetDate')}
                        </span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered w-full ${errors.targetDate ? 'input-error' : ''}`}
                        value={
                          typeof newLongTermGoal.targetDate === 'string'
                            ? newLongTermGoal.targetDate
                            : new Date(newLongTermGoal.targetDate)
                                .toISOString()
                                .split('T')[0]
                        }
                        onChange={(e) => {
                          setNewLongTermGoal({
                            ...newLongTermGoal,
                            targetDate: e.target.value,
                          });
                          setErrors({});
                        }}
                      />
                      {errors.targetDate && (
                        <div className="label">
                          <span className="label-text-alt text-error">
                            {errors.targetDate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <div className="flex items-end">
                    <button
                      onClick={handleCreateGoal}
                      disabled={
                        (goalDuration === 'daily'
                          ? isCreatingGoal
                          : isCreatingLongGoal) ||
                        Object.keys(errors).length > 0
                      }
                      className="btn btn-primary w-full"
                    >
                      {(
                        goalDuration === 'daily'
                          ? isCreatingGoal
                          : isCreatingLongGoal
                      ) ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          {t('goals:modal.creating')}
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {t('modal.createGoal', {
                            duration:
                              goalDuration === 'daily'
                                ? t('modal.daily')
                                : t('modal.longTerm'),
                          })}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Goals List with Enhanced Validation */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('modal.yourGoals')}</h3>
          {goals.length === 0 ? (
            <div className="alert alert-info">
              <BookOpen className="w-6 h-6" />
              <span>{t('modal.emptyDaily')}</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {goals.map((goal) => {
                const config = goalTypeConfig[goal.type];
                const Icon = config.icon;
                const isEditing = editingGoal === goal._id;

                return (
                  <div
                    key={goal._id}
                    className={`card bg-base-200 shadow-sm ${
                      !goal.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="card-body p-4">
                      {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                          <div>
                            <select
                              className="select select-bordered select-sm w-full"
                              value={editGoal.type || goal.type}
                              onChange={(e) => {
                                setEditGoal({
                                  ...editGoal,
                                  type: e.target.value as IDailyGoal['type'],
                                });
                                setErrors({});
                              }}
                            >
                              {Object.entries(goalTypeConfig).map(
                                ([key, config]) => (
                                  <option key={key} value={key}>
                                    {t(config.labelKey as ParseKeys<'goals'>)}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="1"
                              className={`input input-bordered input-sm w-full ${
                                errors.target ? 'input-error' : ''
                              }`}
                              value={editGoal.target || goal.target}
                              onChange={(e) => {
                                setEditGoal({
                                  ...editGoal,
                                  target: Number(e.target.value),
                                });
                                setErrors({});
                              }}
                            />
                            {errors.target && (
                              <div className="text-xs text-error mt-1 flex items-center gap-1">
                                <Clock12 className="w-4 h-4" />
                                {errors.target}
                              </div>
                            )}
                          </div>
                          <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-2">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={editGoal.isActive ?? goal.isActive}
                                onChange={(e) =>
                                  setEditGoal({
                                    ...editGoal,
                                    isActive: e.target.checked,
                                  })
                                }
                              />
                              <span className="label-text">
                                {t('modal.active')}
                              </span>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateGoal(goal._id!)}
                              disabled={
                                isUpdatingGoal || Object.keys(errors).length > 0
                              }
                              className="btn btn-primary btn-sm"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="btn btn-ghost btn-sm"
                              disabled={isUpdatingGoal}
                            >
                              <CircleX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Icon className={`w-6 h-6 ${config.color}`} />
                            <div>
                              <h4 className="font-semibold">
                                {t(config.labelKey as ParseKeys<'goals'>)}
                              </h4>
                              <p className="text-sm text-base-content/70">
                                {t('modal.target', {
                                  value: formatProgress(goal.target, goal.type),
                                  unit: config.unit,
                                })}
                                {!goal.isActive && t('modal.inactive')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(goal)}
                              className="btn btn-ghost btn-sm"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRequestDeleteGoal(goal)}
                              disabled={isDeletingGoal}
                              className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn">
            {t('common:close')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>

      {dailyGoalToDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">
              {t('modal.deleteDailyTitle')}
            </h3>
            <p className="text-base-content/70 mb-4">
              {t('modal.deleteDailyBody', {
                type: t(
                  goalTypeConfig[dailyGoalToDelete.type]
                    .labelKey as ParseKeys<'goals'>
                ).toLowerCase(),
              })}
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDailyGoalToDelete(null)}
                disabled={isDeletingGoal}
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={handleConfirmDeleteGoal}
                disabled={isDeletingGoal}
              >
                {isDeletingGoal ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    {t('goals:modal.deleting')}
                  </>
                ) : (
                  t('modal.deleteGoal')
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => setDailyGoalToDelete(null)}
              disabled={isDeletingGoal}
            >
              close
            </button>
          </form>
        </dialog>
      )}
    </dialog>
  );
}

export default GoalsModal;
