import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { MdClose, MdCalendarToday, MdSave } from 'react-icons/md';
import { DayPicker } from 'react-day-picker';
import { editMediaVotingFn } from '../../api/clubApi';
import { IClub, IClubMediaVoting } from '../../types.d';

interface EditVotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: IClub;
  voting: IClubMediaVoting | null;
}

interface EditVotingData {
  title: string;
  description: string;
  mediaType:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'custom';
  customMediaType: string;
  candidateSubmissionType: 'manual' | 'member_suggestions';
  suggestionStartDate: Date | undefined;
  suggestionEndDate: Date | undefined;
  votingStartDate: Date | undefined;
  votingEndDate: Date | undefined;
  consumptionStartDate: Date | undefined;
  consumptionEndDate: Date | undefined;
  testingMode?: boolean;
}

const MEDIA_TYPES = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'reading', label: 'Light Novel' },
  { value: 'vn', label: 'Visual Novel' },
  { value: 'video', label: 'Video' },
  { value: 'movie', label: 'Movie' },
  { value: 'custom', label: 'Custom' },
];

export default function EditVotingModal({
  isOpen,
  onClose,
  club,
  voting,
}: EditVotingModalProps) {
  const queryClient = useQueryClient();

  // Helper function to format date for display
  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const [votingData, setVotingData] = useState<EditVotingData>({
    title: '',
    description: '',
    mediaType: 'anime',
    customMediaType: '',
    candidateSubmissionType: 'manual',
    suggestionStartDate: undefined,
    suggestionEndDate: undefined,
    votingStartDate: undefined,
    votingEndDate: undefined,
    consumptionStartDate: undefined,
    consumptionEndDate: undefined,
    testingMode: false,
  });

  // Initialize form data when voting prop changes
  useEffect(() => {
    if (voting && isOpen) {
      setVotingData({
        title: voting.title,
        description: voting.description || '',
        mediaType: voting.mediaType,
        customMediaType: voting.customMediaType || '',
        candidateSubmissionType: voting.candidateSubmissionType,
        suggestionStartDate: voting.suggestionStartDate
          ? new Date(voting.suggestionStartDate)
          : undefined,
        suggestionEndDate: voting.suggestionEndDate
          ? new Date(voting.suggestionEndDate)
          : undefined,
        votingStartDate: new Date(voting.votingStartDate),
        votingEndDate: new Date(voting.votingEndDate),
        consumptionStartDate: new Date(voting.consumptionStartDate),
        consumptionEndDate: new Date(voting.consumptionEndDate),
        testingMode: false,
      });
    }
  }, [voting, isOpen]);

  const editVotingMutation = useMutation({
    mutationFn: (data: EditVotingData) => {
      if (!voting?._id) throw new Error('No voting ID');
      return editMediaVotingFn(club._id, voting._id, data);
    },
    onSuccess: () => {
      toast.success('Voting updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['club-votings', club._id] });
      queryClient.invalidateQueries({ queryKey: ['club', club._id] });
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update voting';
      toast.error(message);
    },
  });

  const validateForm = () => {
    const {
      title,
      votingStartDate,
      votingEndDate,
      consumptionStartDate,
      consumptionEndDate,
      candidateSubmissionType,
      suggestionStartDate,
      suggestionEndDate,
    } = votingData;

    if (!title.trim()) {
      toast.error('Please enter a voting title');
      return false;
    }

    if (
      !votingStartDate ||
      !votingEndDate ||
      !consumptionStartDate ||
      !consumptionEndDate
    ) {
      toast.error('Please fill in all required dates');
      return false;
    }

    if (votingStartDate >= votingEndDate) {
      toast.error('Voting end date must be after start date');
      return false;
    }

    if (consumptionStartDate >= consumptionEndDate) {
      toast.error('Consumption end date must be after start date');
      return false;
    }

    // Validate suggestion period if member suggestions are enabled
    if (candidateSubmissionType === 'member_suggestions') {
      if (!suggestionStartDate || !suggestionEndDate) {
        toast.error('Please fill in suggestion period dates');
        return false;
      }

      if (suggestionStartDate >= suggestionEndDate) {
        toast.error('Suggestion end date must be after start date');
        return false;
      }

      if (suggestionEndDate >= votingStartDate) {
        toast.error('Suggestions must end before voting starts');
        return false;
      }
    }

    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    editVotingMutation.mutate(votingData);
  };

  if (!isOpen || !voting) return null;

  // Check if voting can be edited
  const canEdit =
    voting.status === 'setup' || voting.status === 'suggestions_closed';

  if (!canEdit) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl">Cannot Edit Voting</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={onClose}
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
          <div className="alert alert-warning">
            <div>
              <h4 className="font-medium">Voting Not Editable</h4>
              <p className="text-sm mt-1">
                Votings can only be edited when they are in "Setup" or
                "Suggestions Closed" status. This voting is currently in "
                {voting.status}" status.
              </p>
            </div>
          </div>
          <div className="modal-action">
            <button onClick={onClose} className="btn">
              Close
            </button>
          </div>
        </div>
        <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
      </div>
    );
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">Edit Voting</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text">Voting Title *</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Summer 2024 Anime Selection"
                value={votingData.title}
                onChange={(e) =>
                  setVotingData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  checked={votingData.testingMode || false}
                  onChange={(e) =>
                    setVotingData((prev) => ({
                      ...prev,
                      testingMode: e.target.checked,
                    }))
                  }
                  className="checkbox checkbox-primary"
                />
                <span className="label-text">
                  Testing Mode (Allow past dates for testing)
                </span>
              </label>
              <div className="text-xs text-base-content/60 ml-6">
                Enable this to test the voting system with past dates
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                placeholder="Describe what this voting is for..."
                value={votingData.description}
                onChange={(e) =>
                  setVotingData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="textarea textarea-bordered w-full"
                rows={3}
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text">Media Type *</span>
              </label>
              <select
                value={votingData.mediaType}
                onChange={(e) =>
                  setVotingData((prev) => ({
                    ...prev,
                    mediaType: e.target.value as EditVotingData['mediaType'],
                  }))
                }
                className="select select-bordered w-full"
              >
                {MEDIA_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {votingData.mediaType === 'custom' && (
              <div>
                <label className="label">
                  <span className="label-text">Custom Media Type *</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Podcast, Book, Game..."
                  value={votingData.customMediaType}
                  onChange={(e) =>
                    setVotingData((prev) => ({
                      ...prev,
                      customMediaType: e.target.value,
                    }))
                  }
                  className="input input-bordered w-full"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text">
                  How will candidates be added? *
                </span>
              </label>
              <div className="space-y-2">
                <label className="cursor-pointer label justify-start gap-3">
                  <input
                    type="radio"
                    value="manual"
                    checked={votingData.candidateSubmissionType === 'manual'}
                    onChange={(e) =>
                      setVotingData((prev) => ({
                        ...prev,
                        candidateSubmissionType: e.target
                          .value as EditVotingData['candidateSubmissionType'],
                      }))
                    }
                    className="radio radio-primary"
                  />
                  <span>
                    I'll add candidates manually (leaders/moderators only)
                  </span>
                </label>
                <label className="cursor-pointer label justify-start gap-3">
                  <input
                    type="radio"
                    value="member_suggestions"
                    checked={
                      votingData.candidateSubmissionType ===
                      'member_suggestions'
                    }
                    onChange={(e) =>
                      setVotingData((prev) => ({
                        ...prev,
                        candidateSubmissionType: e.target
                          .value as EditVotingData['candidateSubmissionType'],
                      }))
                    }
                    className="radio radio-primary"
                  />
                  <span>
                    Members can suggest candidates during a suggestion period
                  </span>
                </label>
              </div>
            </div>

            {/* Suggestion Period (only if member_suggestions is selected) */}
            {votingData.candidateSubmissionType === 'member_suggestions' && (
              <>
                <div>
                  <label className="label">
                    <span className="label-text">
                      Suggestion Period Start *
                    </span>
                  </label>
                  <div className="dropdown dropdown-top dropdown-end w-full">
                    <div
                      tabIndex={0}
                      role="button"
                      className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                    >
                      <span
                        className={
                          votingData.suggestionStartDate
                            ? 'text-base-content'
                            : 'text-base-content/50'
                        }
                      >
                        {formatDateForDisplay(votingData.suggestionStartDate)}
                      </span>
                      <MdCalendarToday className="text-lg" />
                    </div>
                    <div
                      tabIndex={0}
                      className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                    >
                      <DayPicker
                        className="react-day-picker mx-auto"
                        mode="single"
                        selected={votingData.suggestionStartDate}
                        onSelect={(date) => {
                          setVotingData((prev) => ({
                            ...prev,
                            suggestionStartDate: date,
                          }));
                          // Close dropdown by removing focus
                          (document.activeElement as HTMLElement)?.blur?.();
                          // Reset end date if it's before the new start date
                          if (
                            votingData.suggestionEndDate &&
                            date &&
                            votingData.suggestionEndDate < date
                          ) {
                            setVotingData((prev) => ({
                              ...prev,
                              suggestionEndDate: undefined,
                            }));
                          }
                        }}
                        disabled={
                          votingData.testingMode
                            ? () => false
                            : (date) => date < new Date()
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Suggestion Period End *</span>
                  </label>
                  <div className="dropdown dropdown-top dropdown-end w-full">
                    <div
                      tabIndex={0}
                      role="button"
                      className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                    >
                      <span
                        className={
                          votingData.suggestionEndDate
                            ? 'text-base-content'
                            : 'text-base-content/50'
                        }
                      >
                        {formatDateForDisplay(votingData.suggestionEndDate)}
                      </span>
                      <MdCalendarToday className="text-lg" />
                    </div>
                    <div
                      tabIndex={0}
                      className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                    >
                      <DayPicker
                        className="react-day-picker mx-auto"
                        mode="single"
                        selected={votingData.suggestionEndDate}
                        onSelect={(date) => {
                          setVotingData((prev) => ({
                            ...prev,
                            suggestionEndDate: date,
                          }));
                          // Close dropdown by removing focus
                          (document.activeElement as HTMLElement)?.blur?.();
                        }}
                        disabled={
                          votingData.testingMode
                            ? (date) => {
                                // In testing mode, only disable dates before suggestion start
                                if (!votingData.suggestionStartDate)
                                  return false;
                                return date < votingData.suggestionStartDate;
                              }
                            : (date) => {
                                if (!votingData.suggestionStartDate)
                                  return date < new Date();
                                return date < votingData.suggestionStartDate;
                              }
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Voting Period */}
            <div>
              <label className="label">
                <span className="label-text">Voting Start *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      votingData.votingStartDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(votingData.votingStartDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={votingData.votingStartDate}
                    onSelect={(date) => {
                      setVotingData((prev) => ({
                        ...prev,
                        votingStartDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                      // Reset end date if it's before the new start date
                      if (
                        votingData.votingEndDate &&
                        date &&
                        votingData.votingEndDate < date
                      ) {
                        setVotingData((prev) => ({
                          ...prev,
                          votingEndDate: undefined,
                        }));
                      }
                    }}
                    disabled={
                      votingData.testingMode
                        ? (date) => {
                            // In testing mode, only disable dates before suggestion end
                            if (
                              votingData.candidateSubmissionType ===
                              'member_suggestions'
                            ) {
                              if (!votingData.suggestionEndDate) return false;
                              return date < votingData.suggestionEndDate;
                            }
                            return false;
                          }
                        : (date) => {
                            if (
                              votingData.candidateSubmissionType ===
                              'member_suggestions'
                            ) {
                              const minDate =
                                votingData.suggestionEndDate || new Date();
                              return date < minDate;
                            }
                            return date < new Date();
                          }
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Voting End *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      votingData.votingEndDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(votingData.votingEndDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={votingData.votingEndDate}
                    onSelect={(date) => {
                      setVotingData((prev) => ({
                        ...prev,
                        votingEndDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                    }}
                    disabled={
                      votingData.testingMode
                        ? (date) => {
                            // In testing mode, only disable dates before voting start
                            if (!votingData.votingStartDate) return false;
                            return date < votingData.votingStartDate;
                          }
                        : (date) => {
                            if (!votingData.votingStartDate) {
                              const minDate =
                                votingData.candidateSubmissionType ===
                                'member_suggestions'
                                  ? votingData.suggestionEndDate || new Date()
                                  : new Date();
                              return date < minDate;
                            }
                            return date < votingData.votingStartDate;
                          }
                    }
                  />
                </div>
              </div>
            </div>

            {/* Consumption Period */}
            <div>
              <label className="label">
                <span className="label-text">Consumption Period Start *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      votingData.consumptionStartDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(votingData.consumptionStartDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={votingData.consumptionStartDate}
                    onSelect={(date) => {
                      setVotingData((prev) => ({
                        ...prev,
                        consumptionStartDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                      // Reset end date if it's before the new start date
                      if (
                        votingData.consumptionEndDate &&
                        date &&
                        votingData.consumptionEndDate < date
                      ) {
                        setVotingData((prev) => ({
                          ...prev,
                          consumptionEndDate: undefined,
                        }));
                      }
                    }}
                    disabled={
                      votingData.testingMode
                        ? (date) => {
                            // In testing mode, only disable dates before voting end
                            if (!votingData.votingEndDate) return false;
                            return date < votingData.votingEndDate;
                          }
                        : (date) => {
                            const minDate =
                              votingData.votingEndDate || new Date();
                            return date < minDate;
                          }
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Consumption Period End *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      votingData.consumptionEndDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(votingData.consumptionEndDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={votingData.consumptionEndDate}
                    onSelect={(date) => {
                      setVotingData((prev) => ({
                        ...prev,
                        consumptionEndDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                    }}
                    disabled={
                      votingData.testingMode
                        ? (date) => {
                            // In testing mode, only disable dates before consumption start
                            if (!votingData.consumptionStartDate) return false;
                            return date < votingData.consumptionStartDate;
                          }
                        : (date) => {
                            if (!votingData.consumptionStartDate) {
                              const minDate =
                                votingData.votingEndDate || new Date();
                              return date < minDate;
                            }
                            return date < votingData.consumptionStartDate;
                          }
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action">
          <button
            onClick={onClose}
            className="btn btn-outline"
            disabled={editVotingMutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={editVotingMutation.isPending}
            className="btn btn-primary"
          >
            {editVotingMutation.isPending ? (
              'Saving...'
            ) : (
              <>
                <MdSave className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}
