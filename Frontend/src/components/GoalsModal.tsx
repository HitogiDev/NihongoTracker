import { useState } from 'react';
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

const goalTypeConfig = {
  time: {
    label: 'Time (minutes)',
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

interface GoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: IDailyGoal[];
  username: string | undefined;
}

function GoalsModal({ isOpen, onClose, goals, username }: GoalsModalProps) {
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

  const queryClient = useQueryClient();

  const { mutate: createGoal, isPending: isCreatingGoal } = useMutation({
    mutationFn: createDailyGoalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
      toast.success('Daily goal created successfully!');
      setIsCreating(false);
      setNewGoal({ type: 'time', target: 30, isActive: true });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
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
      toast.success('Daily goal updated successfully!');
      setEditingGoal(null);
      setEditGoal({});
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
      toast.error(errorMessage);
    },
  });

  const { mutate: deleteGoal, isPending: isDeletingGoal } = useMutation({
    mutationFn: deleteDailyGoalFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [username, 'dailyGoals'] });
      toast.success('Daily goal deleted successfully!');
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
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
        toast.success('Long-term goal created successfully!');
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
            ? error.response?.data.message
            : 'An error occurred';
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
      validationErrors.target = 'Target must be greater than 0';
    }

    if (goal.type === 'time' && goal.target > 1440) {
      validationErrors.target =
        'Daily time target cannot exceed 24 hours (1440 minutes)';
    }

    if (goal.type === 'chars' && goal.target > 100000) {
      validationErrors.target =
        'Daily character target seems unreasonably high (max: 100,000)';
    }

    if (goal.type === 'episodes' && goal.target > 50) {
      validationErrors.target =
        'Daily episode target seems unreasonably high (max: 50)';
    }

    if (goal.type === 'pages' && goal.target > 500) {
      validationErrors.target =
        'Daily page target seems unreasonably high (max: 500)';
    }

    // Check for duplicate goal types when creating
    if (!isEdit) {
      const existingGoal = goals.find(
        (g) => g.type === goal.type && g.isActive
      );
      if (existingGoal) {
        validationErrors.duplicate = `You already have an active ${goalTypeConfig[goal.type as keyof typeof goalTypeConfig].label} goal`;
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
      validationErrors.totalTarget = 'Total target must be greater than 0';
    }

    const targetDate = new Date(goal.targetDate);
    const startDate = new Date(goal.startDate);
    const now = new Date();

    if (targetDate <= now) {
      validationErrors.targetDate = 'Target date must be in the future';
    }

    if (startDate >= targetDate) {
      validationErrors.startDate = 'Start date must be before target date';
    }

    // Validate reasonable targets
    if (goal.type === 'chars' && goal.totalTarget > 10000000) {
      validationErrors.totalTarget =
        'Character target seems unreasonably high (max: 10M)';
    }

    if (goal.type === 'time' && goal.totalTarget > 525600) {
      validationErrors.totalTarget =
        'Time target seems unreasonably high (max: 1 year)';
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

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Manage Daily Goals</h2>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Goal Form */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Create New Goal</h3>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? 'Cancel' : 'Add Goal'}
            </button>
          </div>

          {isCreating && (
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="mb-4">
                  <label className="label">
                    <span className="label-text">Goal Duration</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={goalDuration}
                    onChange={(e) => {
                      setGoalDuration(e.target.value as 'daily' | 'long-term');
                      setErrors({});
                    }}
                  >
                    <option value="daily">Daily Goal</option>
                    <option value="long-term">Long-term Goal</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">Goal Type</span>
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
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">
                        {goalDuration === 'daily'
                          ? 'Daily Target'
                          : 'Total Target'}
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
                      placeholder="Enter target value"
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
                        <span className="label-text">Display Progress</span>
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
                        <option value="daily">Daily Progress</option>
                        <option value="weekly">Weekly Progress</option>
                        <option value="monthly">Monthly Progress</option>
                      </select>
                    </div>
                  )}
                </div>

                {goalDuration === 'long-term' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="label">
                        <span className="label-text">Start Date</span>
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
                        <span className="label-text">Target Date</span>
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
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Create{' '}
                          {goalDuration === 'daily'
                            ? 'Daily'
                            : 'Long-term'}{' '}
                          Goal
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
          <h3 className="text-lg font-semibold">Your Goals</h3>
          {goals.length === 0 ? (
            <div className="alert alert-info">
              <BookOpen className="w-6 h-6" />
              <span>
                No daily goals set. Create your first goal to start tracking
                your progress!
              </span>
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
                                    {config.label}
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
                              <span className="label-text">Active</span>
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
                              <h4 className="font-semibold">{config.label}</h4>
                              <p className="text-sm text-base-content/70">
                                Target: {formatProgress(goal.target, goal.type)}{' '}
                                {config.unit}
                                {!goal.isActive && ' (Inactive)'}
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
                              onClick={() => deleteGoal(goal._id!)}
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
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export default GoalsModal;
