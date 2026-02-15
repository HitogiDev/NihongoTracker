import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  Calendar,
  Clock,
  Vote,
  CircleCheck,
  Pencil,
  Trash,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Hourglass,
  Trophy,
} from 'lucide-react';
import {
  getMediaVotingsFn,
  voteForCandidateFn,
  deleteMediaVotingFn,
} from '../../api/clubApi';
import { IClubMediaVoting, IClubResponse } from '../../types';
import { useUserDataStore } from '../../store/userData';
import EditVotingModal from './EditVotingModal';
import CreateVotingWizard from './CreateVotingWizard';
import SuggestMediaModal from './SuggestMediaModal';

type ResultsTimespan = '7' | '30' | '90' | '180' | '365' | 'all';

const RESULTS_TIMESPAN_OPTIONS: { label: string; value: ResultsTimespan }[] = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'Last 6 months', value: '180' },
  { label: 'Last 12 months', value: '365' },
  { label: 'All time', value: 'all' },
];

interface VotingSystemProps {
  club: IClubResponse;
  canManageVoting: boolean;
  showManagement: boolean;
}

export default function VotingSystem({
  club,
  canManageVoting,
  showManagement,
}: VotingSystemProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(
    null
  );
  const [editingVoting, setEditingVoting] = useState<IClubMediaVoting | null>(
    null
  );
  const [deletingVoting, setDeletingVoting] = useState<IClubMediaVoting | null>(
    null
  );
  const [currentVotingIndex, setCurrentVotingIndex] = useState(0);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [suggestingVoting, setSuggestingVoting] =
    useState<IClubMediaVoting | null>(null);
  const [resultsTimespan, setResultsTimespan] = useState<ResultsTimespan>('30');

  const queryClient = useQueryClient();
  const { user } = useUserDataStore();

  const invalidateVotingQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ['club-votings', club._id, 'active'],
    });
    queryClient.invalidateQueries({
      queryKey: ['club-votings', club._id, 'inactive'],
    });
  };

  const { data: votingsData, isLoading } = useQuery({
    queryKey: ['club-votings', club._id, 'active'],
    queryFn: () => getMediaVotingsFn(club._id, true),
  });

  const { data: inactiveVotingsData } = useQuery({
    queryKey: ['club-votings', club._id, 'inactive'],
    queryFn: () => getMediaVotingsFn(club._id, false),
  });

  const voteMutation = useMutation({
    mutationFn: ({
      votingId,
      candidateIndex,
    }: {
      votingId: string;
      candidateIndex: number;
    }) => voteForCandidateFn(club._id, votingId, candidateIndex),
    onSuccess: () => {
      toast.success('Vote recorded successfully!');
      invalidateVotingQueries();
      setSelectedCandidate(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to vote';
      toast.error(message);
    },
  });

  const deleteVotingMutation = useMutation({
    mutationFn: (votingId: string) => deleteMediaVotingFn(club._id, votingId),
    onSuccess: () => {
      toast.success('Voting deleted successfully!');
      invalidateVotingQueries();
      setDeletingVoting(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to delete voting';
      toast.error(message);
      setDeletingVoting(null);
    },
  });

  const getVotingStatus = (voting: IClubMediaVoting) => {
    const now = new Date();
    const votingEnd = new Date(voting.votingEndDate);

    switch (voting.status) {
      case 'setup':
        return { status: 'setup', label: 'Setting Up', color: 'warning' };
      case 'suggestions_open':
        return {
          status: 'suggestions_open',
          label: 'Suggestions Open',
          color: 'info',
        };
      case 'suggestions_closed':
        return {
          status: 'suggestions_closed',
          label: 'Suggestions Closed',
          color: 'warning',
        };
      case 'voting_open':
        if (now > votingEnd) {
          return { status: 'ended', label: 'Voting Ended', color: 'error' };
        }
        return {
          status: 'voting_open',
          label: 'Voting Open',
          color: 'success',
        };
      case 'voting_closed':
        return {
          status: 'voting_closed',
          label: 'Voting Closed',
          color: 'error',
        };
      case 'completed':
        return { status: 'completed', label: 'Completed', color: 'success' };
      default:
        return { status: 'unknown', label: 'Unknown', color: 'neutral' };
    }
  };

  const getTotalVotes = (voting: IClubMediaVoting) => {
    return voting.candidates.reduce(
      (total, candidate) => total + candidate.votes.length,
      0
    );
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  };

  const votings = votingsData?.votings ?? [];

  const openVotings = votings.filter((v) => v.status === 'voting_open');

  const suggestionVotings = votings.filter(
    (v) => v.status === 'suggestions_open'
  );

  const managementVotings = votings.filter(
    (v) => v.status === 'setup' || v.status === 'suggestions_closed'
  );

  const closedVotings = votings.filter((v) => v.status === 'voting_closed');

  const completedVotings = (() => {
    const activeCompleted = votings.filter((v) => v.status === 'completed');
    const inactiveCompleted = (inactiveVotingsData?.votings ?? []).filter(
      (v) => v.status === 'completed'
    );

    const combined = new Map<string, IClubMediaVoting>();

    [...activeCompleted, ...inactiveCompleted].forEach((voting) => {
      const key = voting._id
        ? voting._id.toString()
        : `${voting.title}-${voting.votingStartDate}`;
      combined.set(key, voting);
    });

    return Array.from(combined.values()).sort(
      (a, b) =>
        new Date(b.votingEndDate).getTime() -
        new Date(a.votingEndDate).getTime()
    );
  })();

  const filteredCompletedVotings = (() => {
    if (resultsTimespan === 'all') {
      return completedVotings;
    }

    const days = Number(resultsTimespan);
    if (Number.isNaN(days)) {
      return completedVotings;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return completedVotings.filter((voting) => {
      const votingEndTime = new Date(voting.votingEndDate).getTime();
      return votingEndTime >= cutoff;
    });
  })();

  // Reset carousel index if it's out of bounds
  useEffect(() => {
    if (openVotings.length === 0) {
      if (currentVotingIndex !== 0) {
        setCurrentVotingIndex(0);
      }
      return;
    }

    if (currentVotingIndex >= openVotings.length) {
      setCurrentVotingIndex(0);
    }
  }, [currentVotingIndex, openVotings.length]);

  if (isLoading && votings.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="loading loading-spinner loading-md"></span>
        <span className="ml-2">Loading votings...</span>
      </div>
    );
  }

  const nextVoting = () => {
    setCurrentVotingIndex((prev) => (prev + 1) % openVotings.length);
  };

  const prevVoting = () => {
    setCurrentVotingIndex((prev) =>
      prev === 0 ? openVotings.length - 1 : prev - 1
    );
  };

  return (
    <>
      {/* Open Votings Section */}
      <div className="space-y-6">
        {openVotings.length === 0 ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body text-center py-12">
              <Vote className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">No Active Votings</h3>
              <p className="text-base-content/60">
                There are no votings open for voting right now.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Carousel Navigation */}
            {openVotings.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevVoting}
                  className="btn btn-circle btn-outline"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-base-content/60">
                    {currentVotingIndex + 1} of {openVotings.length}
                  </span>
                  <div className="flex gap-1">
                    {openVotings.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentVotingIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentVotingIndex
                            ? 'bg-primary'
                            : 'bg-base-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={nextVoting}
                  className="btn btn-circle btn-outline"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Display Current Open Voting */}
            {openVotings[currentVotingIndex] && (
              <VotingCard voting={openVotings[currentVotingIndex]} />
            )}
          </>
        )}

        {closedVotings.length > 0 && (
          <div className="card bg-base-100 shadow-sm border border-warning/30">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2 mb-4">
                <Hourglass className="w-5 h-5" />
                Voting Closed
              </h3>

              <p className="text-sm text-base-content/60 mb-4">
                These votings have ended and will finalize automatically when
                the consumption period begins.
              </p>

              <div className="space-y-4">
                {closedVotings
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.votingEndDate).getTime() -
                      new Date(a.votingEndDate).getTime()
                  )
                  .slice(0, 3)
                  .map((voting, index) => (
                    <ClosedVotingCard
                      key={
                        voting._id
                          ? voting._id.toString()
                          : `${voting.title}-${index}`
                      }
                      voting={voting}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {completedVotings.length > 0 && (
          <div className="card bg-base-100 shadow-sm border border-success/30">
            <div className="card-body">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h3 className="card-title flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Recent Results
                </h3>
                <label className="form-control w-full md:w-auto">
                  <span className="label-text text-xs uppercase tracking-wide text-base-content/60">
                    Timespan
                  </span>
                  <select
                    className="select select-sm"
                    value={resultsTimespan}
                    onChange={(event) =>
                      setResultsTimespan(event.target.value as ResultsTimespan)
                    }
                  >
                    {RESULTS_TIMESPAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {filteredCompletedVotings.length === 0 ? (
                <p className="text-sm text-base-content/60">
                  No completed votings found in this timespan.
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredCompletedVotings.map((voting, index) => (
                    <CompletedVotingCard
                      key={
                        voting._id
                          ? voting._id.toString()
                          : `${voting.title}-${index}`
                      }
                      voting={voting}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Member Suggestion Section */}
        {suggestionVotings.length > 0 && (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5" />
                Media Suggestions Open
              </h3>

              <div className="space-y-4">
                {suggestionVotings.map((voting) => (
                  <SuggestionVotingCard
                    key={voting._id}
                    voting={voting}
                    onSuggest={setSuggestingVoting}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Management Section */}
        {canManageVoting && showManagement && (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body">
              <h3 className="card-title flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5" />
                Voting Management
              </h3>

              {managementVotings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-base-content/60">
                    No votings in setup or suggestion phase.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {managementVotings.map((voting) => (
                    <ManagementVotingCard
                      key={voting._id}
                      voting={voting}
                      onEdit={setEditingVoting}
                      onDelete={setDeletingVoting}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateWizard && (
        <CreateVotingWizard
          isOpen={showCreateWizard}
          club={club}
          onClose={() => setShowCreateWizard(false)}
        />
      )}

      {editingVoting && (
        <EditVotingModal
          isOpen={editingVoting !== null}
          club={club}
          voting={editingVoting}
          onClose={() => setEditingVoting(null)}
        />
      )}

      {suggestingVoting && (
        <SuggestMediaModal
          isOpen={suggestingVoting !== null}
          club={club}
          voting={suggestingVoting}
          onClose={() => setSuggestingVoting(null)}
        />
      )}

      {deletingVoting && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Delete Voting</h3>
            <p className="mb-6">
              Are you sure you want to delete the voting "{deletingVoting.title}
              "? This action cannot be undone.
            </p>
            <div className="modal-action">
              <button
                onClick={() => setDeletingVoting(null)}
                className="btn btn-ghost"
                disabled={deleteVotingMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deletingVoting?._id &&
                  deleteVotingMutation.mutate(deletingVoting._id)
                }
                className="btn btn-error"
                disabled={deleteVotingMutation.isPending}
              >
                {deleteVotingMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => setDeletingVoting(null)}
          ></div>
        </div>
      )}
    </>
  );

  // VotingCard Component
  function VotingCard({ voting }: { voting: IClubMediaVoting }) {
    const status = getVotingStatus(voting);
    const totalVotes = getTotalVotes(voting);
    const userVoted = voting.candidates.some((candidate) =>
      candidate.votes.some((vote) => vote === user?._id)
    );
    const userVotedCandidate = voting.candidates.findIndex((candidate) =>
      candidate.votes.some((vote) => vote === user?._id)
    );
    const isUserMember = club.isUserMember;
    const canVote =
      status.status === 'voting_open' && !userVoted && isUserMember;

    return (
      <div className="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-lg border border-primary/20">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="card-title text-xl">{voting.title}</h3>
              <span className={`badge badge-${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>

          {voting.description && (
            <p className="text-base-content/70 mb-4">{voting.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span>
                Voting: {formatDate(voting.votingStartDate)} -{' '}
                {formatDate(voting.votingEndDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-secondary" />
              <span>
                Consumption: {formatDate(voting.consumptionStartDate)} -{' '}
                {formatDate(voting.consumptionEndDate)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Vote className="w-4 h-4" />
              <span className="text-sm">{totalVotes} votes cast</span>
            </div>
          </div>

          {userVoted && (
            <div className="alert alert-success mb-6">
              <CircleCheck className="w-5 h-5" />
              <div>
                <h4 className="font-medium">Vote submitted!</h4>
                <p className="text-sm mt-1">
                  You voted for:{' '}
                  <span className="font-medium">
                    {userVotedCandidate !== -1
                      ? voting.candidates[userVotedCandidate].title
                      : 'Unknown'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {!isUserMember && status.status === 'voting_open' && (
            <div className="alert alert-warning mb-6">
              <Vote className="w-5 h-5" />
              <div>
                <h4 className="font-medium">Join the club to vote!</h4>
                <p className="text-sm mt-1">
                  You need to be a member of this club to participate in voting.
                </p>
              </div>
            </div>
          )}

          {/* Candidates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {voting.candidates.map((candidate, index) => {
              const candidateVotes = candidate.votes.length;
              const votePercentage =
                totalVotes > 0 ? (candidateVotes / totalVotes) * 100 : 0;
              const isUserChoice = userVotedCandidate === index;
              const isSelected = selectedCandidate === index;

              return (
                <div
                  key={index}
                  className={`card bg-base-100 transition-all duration-200 ${
                    isUserChoice
                      ? 'ring-2 ring-success shadow-success/20'
                      : isSelected
                        ? 'ring-2 ring-primary shadow-primary/20'
                        : canVote
                          ? 'hover:shadow-lg hover:ring-1 hover:ring-primary/50 cursor-pointer'
                          : ''
                  } ${!canVote && !userVoted ? 'opacity-60' : ''} ${!isUserMember && status.status === 'voting_open' ? 'cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (canVote) {
                      setSelectedCandidate(isSelected ? null : index);
                    }
                  }}
                >
                  <figure className="px-4 pt-4">
                    {candidate.image && (
                      <img
                        src={candidate.image}
                        alt={candidate.title}
                        className={`rounded-lg w-full h-48 object-cover ${
                          candidate.isAdult && user?.settings?.blurAdultContent
                            ? 'blur-sm'
                            : ''
                        }`}
                      />
                    )}
                  </figure>
                  <div className="card-body p-4">
                    <h4 className="card-title text-base">{candidate.title}</h4>
                    {candidate.description && (
                      <p className="text-xs text-base-content/70 line-clamp-3">
                        {candidate.description}
                      </p>
                    )}

                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-base-content/60">
                          Votes
                        </span>
                        <span className="text-sm font-medium">
                          {candidateVotes} ({votePercentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-base-300 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            isUserChoice
                              ? 'bg-success'
                              : votePercentage > 0
                                ? 'bg-primary'
                                : 'bg-transparent'
                          }`}
                          style={{ width: `${votePercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {isUserChoice && (
                      <div className="badge badge-success badge-sm mt-2">
                        Your Vote
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vote Button */}
          {canVote && selectedCandidate !== null && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  if (selectedCandidate !== null) {
                    voteMutation.mutate({
                      votingId: voting._id!,
                      candidateIndex: selectedCandidate,
                    });
                  }
                }}
                disabled={voteMutation.isPending}
                className="btn btn-primary btn-lg"
              >
                <Vote className="w-5 h-5" />
                {voteMutation.isPending ? 'Submitting Vote...' : 'Submit Vote'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ClosedVotingCard Component
  function ClosedVotingCard({ voting }: { voting: IClubMediaVoting }) {
    const totalVotes = getTotalVotes(voting);
    const sortedCandidates = voting.candidates
      .slice()
      .sort((a, b) => b.votes.length - a.votes.length)
      .slice(0, 3);

    return (
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{voting.title}</h4>
                <span className="badge badge-error badge-sm">
                  Voting Closed
                </span>
              </div>
              <p className="text-sm text-base-content/70">
                Consumption begins on {formatDate(voting.consumptionStartDate)}.
              </p>
              <p className="text-xs text-base-content/50 mt-1">
                Results will finalize automatically when the consumption period
                starts.
              </p>
            </div>
            <Hourglass className="w-6 h-6 text-warning flex-shrink-0" />
          </div>

          {sortedCandidates.length > 0 && (
            <div className="mt-4 space-y-3">
              {sortedCandidates.map((candidate, index) => {
                const votes = candidate.votes.length;
                const percentage =
                  totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

                return (
                  <div
                    key={`${candidate.mediaId}-${index}`}
                    className={`rounded-lg border p-3 transition-colors ${
                      index === 0
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-base-300 bg-base-200/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge badge-sm ${
                            index === 0 ? 'badge-primary' : 'badge-ghost'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <span className="font-medium text-sm">
                          {candidate.title}
                        </span>
                      </div>
                      <span className="text-xs text-base-content/60">
                        {votes} vote{votes === 1 ? '' : 's'} (
                        {percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-primary' : 'bg-base-content/30'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // CompletedVotingCard Component
  function CompletedVotingCard({ voting }: { voting: IClubMediaVoting }) {
    const totalVotes = getTotalVotes(voting);
    const sortedCandidates = voting.candidates
      .slice()
      .sort((a, b) => b.votes.length - a.votes.length);

    const winnerFromCandidates = sortedCandidates.find((candidate) =>
      voting.winnerCandidate
        ? candidate.mediaId === voting.winnerCandidate.mediaId
        : false
    );

    const winner =
      voting.winnerCandidate ||
      (sortedCandidates.length > 0
        ? {
            mediaId: sortedCandidates[0].mediaId,
            title: sortedCandidates[0].title,
            description: sortedCandidates[0].description,
            image: sortedCandidates[0].image,
          }
        : undefined);

    const winnerVotes = winnerFromCandidates
      ? winnerFromCandidates.votes.length
      : sortedCandidates.length > 0
        ? sortedCandidates[0].votes.length
        : 0;

    return (
      <div className="card bg-base-100 border border-success/40 shadow-sm">
        <div className="card-body">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{voting.title}</h4>
                <span className="badge badge-success badge-sm">Completed</span>
              </div>
              <p className="text-sm text-base-content/70">
                Consumption period: {formatDate(voting.consumptionStartDate)}
                {' – '}
                {formatDate(voting.consumptionEndDate)}
              </p>
              <p className="text-xs text-base-content/50 mt-1">
                {totalVotes} total vote{totalVotes === 1 ? '' : 's'} cast.
              </p>
            </div>
            <Trophy className="w-6 h-6 text-success flex-shrink-0" />
          </div>

          {winner ? (
            <div className="mt-4 flex flex-col md:flex-row gap-4">
              {winner.image && (
                <img
                  src={winner.image}
                  alt={winner.title}
                  className="w-28 h-36 object-cover rounded-lg shadow"
                />
              )}
              <div className="flex-1">
                <h5 className="font-semibold text-base">
                  Winner: {winner.title}
                </h5>
                {winner.description && (
                  <p className="text-sm text-base-content/70 mt-2 line-clamp-4">
                    {winner.description}
                  </p>
                )}
                <p className="text-sm text-base-content/60 mt-2">
                  {winnerVotes} vote{winnerVotes === 1 ? '' : 's'} in favour.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-base-content/60">
              No winner was recorded for this voting.
            </p>
          )}

          {sortedCandidates.length > 0 && (
            <div className="mt-6">
              <h6 className="text-xs uppercase font-semibold text-base-content/50 mb-2">
                Final standings
              </h6>
              <div className="space-y-3">
                {sortedCandidates.slice(0, 5).map((candidate, index) => {
                  const votes = candidate.votes.length;
                  const percentage =
                    totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  const isWinner =
                    winner && candidate.mediaId === winner.mediaId;

                  return (
                    <div
                      key={`${candidate.mediaId}-${index}`}
                      className={`rounded-lg border p-3 transition-colors ${
                        isWinner
                          ? 'border-success/50 bg-success/5'
                          : 'border-base-300 bg-base-200/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge badge-sm ${
                              isWinner ? 'badge-success' : 'badge-ghost'
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <span className="font-medium text-sm">
                            {candidate.title}
                          </span>
                        </div>
                        <span className="text-xs text-base-content/60">
                          {votes} vote{votes === 1 ? '' : 's'} (
                          {percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-base-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            isWinner ? 'bg-success' : 'bg-base-content/30'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ManagementVotingCard Component
  function ManagementVotingCard({
    voting,
    onEdit,
    onDelete,
  }: {
    voting: IClubMediaVoting;
    onEdit: (voting: IClubMediaVoting) => void;
    onDelete: (voting: IClubMediaVoting) => void;
  }) {
    const status = getVotingStatus(voting);

    return (
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{voting.title}</h4>
                <span className={`badge badge-${status.color} badge-sm`}>
                  {status.label}
                </span>
              </div>
              {voting.description && (
                <p className="text-sm text-base-content/70 mb-2">
                  {voting.description}
                </p>
              )}
              <div className="text-xs text-base-content/60">
                {voting.candidates.length} candidates • Created{' '}
                {voting.createdAt ? formatDate(voting.createdAt) : 'Unknown'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(voting)}
                className="btn btn-sm btn-outline btn-primary"
                title="Edit voting"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(voting)}
                className="btn btn-sm btn-outline btn-error"
                title="Delete voting"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SuggestionVotingCard Component
  function SuggestionVotingCard({
    voting,
    onSuggest,
  }: {
    voting: IClubMediaVoting;
    onSuggest: (voting: IClubMediaVoting) => void;
  }) {
    const status = getVotingStatus(voting);

    return (
      <div className="card bg-gradient-to-br from-secondary/10 to-accent/10 shadow-sm border border-secondary/20">
        <div className="card-body">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{voting.title}</h4>
                <span className={`badge badge-${status.color} badge-sm`}>
                  {status.label}
                </span>
              </div>
              {voting.description && (
                <p className="text-sm text-base-content/70 mb-3">
                  {voting.description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <span className="font-medium">Media Type:</span>{' '}
                  {voting.mediaType === 'custom'
                    ? voting.customMediaType
                    : voting.mediaType}
                </div>
                <div>
                  <span className="font-medium">Suggestions Close:</span>{' '}
                  {voting.suggestionEndDate
                    ? formatDate(voting.suggestionEndDate)
                    : 'Unknown'}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-base-content/60">
                <span>{voting.candidates.length} suggestions so far</span>
                <span>•</span>
                <span>
                  Created{' '}
                  {voting.createdAt ? formatDate(voting.createdAt) : 'Unknown'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => onSuggest(voting)}
                className="btn btn-secondary btn-sm"
                disabled={!club.isUserMember}
                title={
                  !club.isUserMember
                    ? 'You must be a club member to suggest media'
                    : 'Suggest media for this voting'
                }
              >
                <Plus className="w-4 h-4" />
                Suggest Media
              </button>
              {voting.candidates.length > 0 && (
                <span className="text-xs text-center text-base-content/60">
                  {voting.candidates.length} suggestion
                  {voting.candidates.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Show existing suggestions */}
          {voting.candidates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-base-300">
              <h5 className="font-medium text-sm mb-2">Current Suggestions:</h5>
              <div className="flex flex-wrap gap-2">
                {voting.candidates.map((candidate, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-base-200 rounded-full px-3 py-1 text-xs"
                  >
                    {candidate.image && (
                      <img
                        src={candidate.image}
                        alt={candidate.title}
                        className={`w-4 h-4 rounded object-cover ${
                          candidate.isAdult && user?.settings?.blurAdultContent
                            ? 'filter blur-sm'
                            : ''
                        }`}
                      />
                    )}
                    <span>{candidate.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
