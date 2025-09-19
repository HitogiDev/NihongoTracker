import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  MdClose,
  MdArrowBack,
  MdArrowForward,
  MdCheck,
  MdCalendarToday,
} from 'react-icons/md';
import { DayPicker } from 'react-day-picker';
import {
  createMediaVotingFn,
  addVotingCandidateFn,
  finalizeVotingFn,
} from '../../api/clubApi';
import useSearch from '../../hooks/useSearch';
import { IClub, IMediaDocument } from '../../types.d';

interface CreateVotingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  club: IClub;
}

interface VotingData {
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

interface Candidate {
  mediaId: string;
  title: string;
  description?: string;
  image?: string;
}

const MEDIA_TYPES = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'reading', label: 'Light Novel' },
  { value: 'vn', label: 'Visual Novel' },
  { value: 'video', label: 'Video/Movie' },
  { value: 'custom', label: 'Custom' },
];

export default function CreateVotingWizard({
  isOpen,
  onClose,
  club,
}: CreateVotingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Helper function to format date for display
  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const [votingData, setVotingData] = useState<VotingData>({
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

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tempCandidate, setTempCandidate] = useState<Candidate>({
    mediaId: '',
    title: '',
    description: '',
    image: '',
  });

  // Use the search hook for media search
  const searchType =
    votingData.mediaType === 'custom' ? 'anime' : votingData.mediaType;
  const { data: searchResults, isLoading: isSearching } = useSearch(
    searchType,
    searchQuery,
    undefined,
    1,
    10
  );

  const queryClient = useQueryClient();

  const finalizeVotingMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create the voting
      const votingResponse = await createMediaVotingFn(club._id, votingData);
      const createdVotingId = votingResponse.voting._id || '';

      // Step 2: Add all candidates sequentially to avoid version conflicts
      if (candidates.length > 0) {
        for (const candidate of candidates) {
          await addVotingCandidateFn(club._id, createdVotingId, candidate);
        }
      }

      // Step 3: Only finalize the voting if it's manual submission
      // For member suggestions, leave it in 'suggestions_open' status
      if (votingData.candidateSubmissionType === 'manual') {
        await finalizeVotingFn(club._id, createdVotingId);
      }

      return { votingId: createdVotingId };
    },
    onSuccess: () => {
      const message =
        votingData.candidateSubmissionType === 'member_suggestions'
          ? 'Voting created! Members can now submit suggestions.'
          : 'Voting created successfully!';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['club-votings', club._id] });
      queryClient.invalidateQueries({ queryKey: ['club', club._id] });
      onClose();
      resetWizard();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to launch voting';
      toast.error(message);
    },
  });

  const resetWizard = () => {
    setCurrentStep(1);
    setVotingData({
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
    });
    setCandidates([]);
    resetTempCandidate();
  };

  const resetTempCandidate = () => {
    setTempCandidate({
      mediaId: '',
      title: '',
      description: '',
      image: '',
    });
    setSearchQuery('');
    setShowResults(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handleSelectResult = (result: IMediaDocument) => {
    const title =
      result.title.contentTitleEnglish ||
      result.title.contentTitleRomaji ||
      result.title.contentTitleNative;

    // Get description from the first available description
    const description = result.description?.[0]?.description || '';
    const cleanDescription = description
      .replace(/<[^>]*>/g, '')
      .substring(0, 200);

    setTempCandidate({
      mediaId: result.contentId,
      title,
      description: cleanDescription ? cleanDescription + '...' : '',
      image: result.contentImage || '',
    });
    setSearchQuery(title);
    setShowResults(false);
  };

  const handleAddCandidate = () => {
    if (!tempCandidate.title || !tempCandidate.mediaId) {
      toast.error('Please select or enter a media title');
      return;
    }

    const newCandidate = { ...tempCandidate };
    setCandidates((prev) => [...prev, newCandidate]);
    resetTempCandidate();
    toast.success('Candidate added to voting!');
  };

  const validateStep1 = () => {
    const {
      title,
      votingStartDate,
      votingEndDate,
      consumptionStartDate,
      consumptionEndDate,
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

    if (votingEndDate >= consumptionStartDate) {
      toast.error('Consumption must start after voting ends');
      return false;
    }

    if (votingData.candidateSubmissionType === 'member_suggestions') {
      const { suggestionStartDate, suggestionEndDate } = votingData;

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

  const handleStep1Submit = () => {
    if (!validateStep1()) return;
    // Just move to next step, don't create voting yet
    setCurrentStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">
            Create Voting - Step {currentStep} of 3
          </h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="steps w-full mb-8">
          <div className={`step ${currentStep >= 1 ? 'step-primary' : ''}`}>
            Setup
          </div>
          <div className={`step ${currentStep >= 2 ? 'step-primary' : ''}`}>
            Add Candidates
          </div>
          <div className={`step ${currentStep >= 3 ? 'step-primary' : ''}`}>
            Confirm
          </div>
        </div>

        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
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
                      mediaType: e.target.value as VotingData['mediaType'],
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
                            .value as VotingData['candidateSubmissionType'],
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
                            .value as VotingData['candidateSubmissionType'],
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
                              ? undefined
                              : (date) => date < new Date()
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">
                        Suggestion Period End *
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

              <div>
                <label className="label">
                  <span className="label-text">Voting Period Start *</span>
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
                                return votingData.suggestionEndDate
                                  ? date < votingData.suggestionEndDate
                                  : false;
                              }
                              return false;
                            }
                          : (date) => {
                              const minDate =
                                votingData.candidateSubmissionType ===
                                'member_suggestions'
                                  ? votingData.suggestionEndDate || new Date()
                                  : new Date();
                              return date < minDate;
                            }
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Voting Period End *</span>
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
                              if (!votingData.consumptionStartDate)
                                return false;
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
        )}

        {/* Step 2: Add Candidates */}
        {currentStep === 2 &&
          votingData.candidateSubmissionType === 'manual' && (
            <div className="space-y-6">
              <div className="alert alert-info">
                <div className="text-sm">
                  Add candidates for the voting. You can search for{' '}
                  {votingData.mediaType} from AniList or add them manually.
                </div>
              </div>

              {/* Add Candidate Form */}
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body">
                  <h4 className="card-title text-lg">Add Candidate</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text">Search for Media</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={`Search for ${votingData.mediaType}...`}
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                          }}
                          className="input input-bordered w-full"
                        />
                        {isSearching && (
                          <span className="loading loading-spinner loading-sm absolute right-3 top-1/2 transform -translate-y-1/2"></span>
                        )}
                      </div>

                      {/* Search Results */}
                      {showResults &&
                        searchResults &&
                        searchResults.length > 0 && (
                          <div className="card bg-base-100 shadow-lg border border-base-300 max-h-60 overflow-y-auto mt-2">
                            <div className="card-body p-2">
                              {searchResults.map((result) => (
                                <div
                                  key={result.contentId}
                                  onClick={() => handleSelectResult(result)}
                                  className="flex items-center gap-3 p-3 hover:bg-base-200 cursor-pointer rounded"
                                >
                                  <img
                                    src={result.contentImage || ''}
                                    alt={
                                      result.title.contentTitleRomaji ||
                                      result.title.contentTitleNative
                                    }
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {result.title.contentTitleEnglish ||
                                        result.title.contentTitleRomaji ||
                                        result.title.contentTitleNative}
                                    </div>
                                    <div className="text-sm text-base-content/60">
                                      {result.type}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="divider">OR</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">
                          <span className="label-text">Title *</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter title manually"
                          value={tempCandidate.title}
                          onChange={(e) =>
                            setTempCandidate((prev) => ({
                              ...prev,
                              title: e.target.value,
                              mediaId: e.target.value,
                            }))
                          }
                          className="input input-bordered w-full"
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text">Image URL</span>
                        </label>
                        <input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={tempCandidate.image}
                          onChange={(e) =>
                            setTempCandidate((prev) => ({
                              ...prev,
                              image: e.target.value,
                            }))
                          }
                          className="input input-bordered w-full"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="label">
                          <span className="label-text">Description</span>
                        </label>
                        <textarea
                          placeholder="Brief description..."
                          value={tempCandidate.description}
                          onChange={(e) =>
                            setTempCandidate((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          className="textarea textarea-bordered w-full"
                          rows={3}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddCandidate}
                      disabled={!tempCandidate.title}
                      className="btn btn-primary"
                    >
                      Add Candidate
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Candidates */}
              {candidates.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-4">
                    Candidates ({candidates.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {candidates.map((candidate, index) => (
                      <div
                        key={index}
                        className="card bg-base-100 shadow-sm border border-base-300"
                      >
                        <div className="card-body p-4">
                          <div className="flex items-center gap-3">
                            {candidate.image && (
                              <img
                                src={candidate.image}
                                alt={candidate.title}
                                className="w-12 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h5 className="font-medium">{candidate.title}</h5>
                              {candidate.description && (
                                <p className="text-sm text-base-content/60 line-clamp-2">
                                  {candidate.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Step 2: Member Suggestions Info */}
        {currentStep === 2 &&
          votingData.candidateSubmissionType === 'member_suggestions' && (
            <div className="space-y-6">
              <div className="alert alert-info">
                <div>
                  <h4 className="font-medium">Member Suggestions Enabled</h4>
                  <p className="text-sm mt-1">
                    Members will be able to suggest candidates during the
                    suggestion period. You can skip to step 3 to finalize the
                    voting setup.
                  </p>
                </div>
              </div>

              <div className="stats shadow w-full">
                <div className="stat">
                  <div className="stat-title">Suggestion Period</div>
                  <div className="stat-value text-lg">
                    {votingData.suggestionStartDate
                      ? votingData.suggestionStartDate.toLocaleDateString()
                      : 'Not set'}{' '}
                    -{' '}
                    {votingData.suggestionEndDate
                      ? votingData.suggestionEndDate.toLocaleDateString()
                      : 'Not set'}
                  </div>
                  <div className="stat-desc">
                    Members can suggest candidates during this time
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="alert alert-success">
              <div>
                <h4 className="font-medium">Ready to Launch!</h4>
                <p className="text-sm mt-1">
                  Review the information below and click "Launch Voting" to make
                  it live.
                </p>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h4 className="card-title">Voting Summary</h4>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium">Title:</span>{' '}
                    {votingData.title}
                  </div>
                  {votingData.description && (
                    <div>
                      <span className="font-medium">Description:</span>{' '}
                      {votingData.description}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Media Type:</span>{' '}
                    {votingData.mediaType === 'custom'
                      ? votingData.customMediaType
                      : MEDIA_TYPES.find(
                          (t) => t.value === votingData.mediaType
                        )?.label}
                  </div>
                  <div>
                    <span className="font-medium">Candidate Submission:</span>{' '}
                    {votingData.candidateSubmissionType === 'manual'
                      ? 'Manual (Leaders/Moderators)'
                      : 'Member Suggestions'}
                  </div>
                  <div>
                    <span className="font-medium">Voting Period:</span>{' '}
                    {votingData.votingStartDate
                      ? votingData.votingStartDate.toLocaleDateString()
                      : 'Not set'}{' '}
                    -{' '}
                    {votingData.votingEndDate
                      ? votingData.votingEndDate.toLocaleDateString()
                      : 'Not set'}
                  </div>
                  <div>
                    <span className="font-medium">Consumption Period:</span>{' '}
                    {votingData.consumptionStartDate
                      ? votingData.consumptionStartDate.toLocaleDateString()
                      : 'Not set'}{' '}
                    -{' '}
                    {votingData.consumptionEndDate
                      ? votingData.consumptionEndDate.toLocaleDateString()
                      : 'Not set'}
                  </div>
                  {votingData.candidateSubmissionType === 'manual' && (
                    <div>
                      <span className="font-medium">Candidates:</span>{' '}
                      {candidates.length} added
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="modal-action">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="btn btn-outline"
              disabled={finalizeVotingMutation.isPending}
            >
              <MdArrowBack className="w-4 h-4" />
              Back
            </button>
          )}

          <button
            onClick={onClose}
            className="btn btn-outline"
            disabled={finalizeVotingMutation.isPending}
          >
            Cancel
          </button>

          {currentStep === 1 && (
            <button onClick={handleStep1Submit} className="btn btn-primary">
              Next
              <MdArrowForward className="w-4 h-4" />
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={() => setCurrentStep(3)}
              className="btn btn-primary"
            >
              Next
              <MdArrowForward className="w-4 h-4" />
            </button>
          )}

          {currentStep === 3 && (
            <button
              onClick={() => finalizeVotingMutation.mutate()}
              disabled={finalizeVotingMutation.isPending}
              className="btn btn-primary"
            >
              {finalizeVotingMutation.isPending ? (
                'Launching...'
              ) : (
                <>
                  <MdCheck className="w-4 h-4" />
                  Launch Voting
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}
