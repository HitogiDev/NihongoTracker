import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  MdCalendarToday,
  MdSchedule,
  MdGroup,
  MdHowToVote,
  MdEmojiEvents,
  MdCheckCircle,
} from 'react-icons/md';
import {
  getMediaVotingsFn,
  voteForCandidateFn,
  completeVotingFn,
} from '../../api/clubApi';
import { IClubMediaVoting, IClub } from '../../types';
import { useUserDataStore } from '../../store/userData';

interface VotingSystemProps {
  club: IClub;
  canManageVoting: boolean;
}

interface CompleteVotingResponse {
  message: string;
  winner: {
    mediaId: string;
    title: string;
    description?: string;
    image?: string;
  } | null;
  wasTie?: boolean;
  tiedCandidatesCount?: number;
}

export default function VotingSystem({
  club,
  canManageVoting,
}: VotingSystemProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(
    null
  );
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();

  const { data: votingsData, isLoading } = useQuery({
    queryKey: ['club-votings', club._id],
    queryFn: () => getMediaVotingsFn(club._id, true),
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
      queryClient.invalidateQueries({ queryKey: ['club-votings', club._id] });
      setSelectedCandidate(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to vote';
      toast.error(message);
    },
  });

  const completeVotingMutation = useMutation({
    mutationFn: (votingId: string) => completeVotingFn(club._id, votingId),
    onSuccess: (data: CompleteVotingResponse) => {
      const message = data.wasTie
        ? `Voting completed! Winner selected randomly from ${data.tiedCandidatesCount} tied candidates.`
        : 'Voting completed successfully!';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['club-votings', club._id] });
      queryClient.invalidateQueries({ queryKey: ['club', club._id] });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to complete voting';
      toast.error(message);
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleVoteConfirm = (voting: IClubMediaVoting) => {
    if (selectedCandidate === null || !voting._id) return;
    voteMutation.mutate({
      votingId: voting._id,
      candidateIndex: selectedCandidate,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="loading loading-spinner loading-md"></span>
        <span className="ml-2">Loading votings...</span>
      </div>
    );
  }

  const votings = votingsData?.votings || [];
  const activeVoting = votings.find((v) => v.status === 'voting_open');

  // Show active voting prominently on club page
  if (activeVoting) {
    const status = getVotingStatus(activeVoting);
    const totalVotes = getTotalVotes(activeVoting);

    // Check if user has already voted
    const userVoted = activeVoting.candidates.some((candidate) =>
      candidate.votes.some((vote) => vote === user?._id)
    );

    // Find which candidate the user voted for (if any)
    const userVotedCandidate = activeVoting.candidates.findIndex((candidate) =>
      candidate.votes.some((vote) => vote === user?._id)
    );

    const canVote = status.status === 'voting_open' && !userVoted;

    return (
      <div className="card bg-gradient-to-br from-primary/10 to-secondary/10 shadow-lg border border-primary/20">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MdHowToVote className="w-8 h-8 text-primary" />
              <div>
                <h3 className="card-title text-xl">Active Voting</h3>
                <span className={`badge badge-${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
            {canManageVoting && status.status === 'ended' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() =>
                  activeVoting._id &&
                  completeVotingMutation.mutate(activeVoting._id)
                }
                disabled={completeVotingMutation.isPending}
              >
                <MdEmojiEvents className="w-4 h-4" />
                Complete Voting
              </button>
            )}
          </div>

          <h4 className="text-lg font-semibold mb-2">{activeVoting.title}</h4>

          {activeVoting.description && (
            <p className="text-base-content/70 text-sm mb-4">
              {activeVoting.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-base-content/60 mb-6">
            <div className="flex items-center gap-1">
              <MdCalendarToday className="w-4 h-4" />
              Voting: {formatDate(
                new Date(activeVoting.votingStartDate)
              )} - {formatDate(new Date(activeVoting.votingEndDate))}
            </div>
            <div className="flex items-center gap-1">
              <MdSchedule className="w-4 h-4" />
              Consumption:{' '}
              {formatDate(new Date(activeVoting.consumptionStartDate))} -{' '}
              {formatDate(new Date(activeVoting.consumptionEndDate))}
            </div>
            <div className="flex items-center gap-1">
              <MdGroup className="w-4 h-4" />
              {totalVotes} votes cast
            </div>
          </div>

          {/* Candidates Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {activeVoting.candidates.map((candidate, index) => {
              const percentage =
                totalVotes > 0
                  ? (candidate.votes.length / totalVotes) * 100
                  : 0;
              const isSelected = selectedCandidate === index;
              const isUserVote = userVotedCandidate === index;

              return (
                <div
                  key={index}
                  className={`group relative cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-100'
                      : isUserVote && userVoted
                        ? 'ring-2 ring-success ring-offset-2 ring-offset-base-100'
                        : 'hover:scale-105'
                  } ${!canVote ? 'cursor-default' : ''}`}
                  onClick={() =>
                    canVote && setSelectedCandidate(isSelected ? null : index)
                  }
                >
                  <div className="card bg-base-100 shadow-sm overflow-hidden">
                    <figure className="relative aspect-[2/3] overflow-hidden">
                      {candidate.image ? (
                        <img
                          src={candidate.image}
                          alt={candidate.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-base-200 flex items-center justify-center">
                          <span className="text-base-content/50">No Image</span>
                        </div>
                      )}

                      {/* Hover overlay with title and description */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                        <h5 className="text-white font-medium text-sm mb-1">
                          {candidate.title}
                        </h5>
                        {candidate.description && (
                          <p
                            className="text-white/80 text-xs overflow-hidden"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {candidate.description}
                          </p>
                        )}
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <MdCheckCircle className="w-6 h-6 text-primary bg-white rounded-full" />
                        </div>
                      )}

                      {/* User's vote indicator */}
                      {isUserVote && userVoted && (
                        <div className="absolute top-2 left-2">
                          <span className="badge badge-success badge-sm">
                            Your Vote
                          </span>
                        </div>
                      )}

                      {/* Vote count */}
                      <div className="absolute bottom-2 left-2">
                        <span className="badge badge-primary badge-sm">
                          {candidate.votes.length} votes (
                          {percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </figure>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vote Confirmation */}
          {canVote && selectedCandidate !== null && (
            <div className="alert alert-info">
              <div className="flex-1">
                <span className="font-medium">
                  Selected: {activeVoting.candidates[selectedCandidate]?.title}
                </span>
                <p className="text-sm mt-1">
                  Click the button below to confirm your vote. Once confirmed,
                  your vote cannot be changed.
                </p>
              </div>
              <button
                onClick={() => handleVoteConfirm(activeVoting)}
                disabled={voteMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {voteMutation.isPending ? 'Voting...' : 'Confirm Vote'}
              </button>
            </div>
          )}

          {userVoted && (
            <div className="alert alert-success">
              <div className="text-sm">
                You have successfully voted in this voting. Your vote is final
                and cannot be changed. Results update in real-time.
              </div>
            </div>
          )}

          {!canVote && !userVoted && status.status !== 'voting_open' && (
            <div className="alert alert-warning">
              <div className="text-sm">Voting is not currently open.</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show all votings if no active voting
  if (votings.length === 0) {
    return (
      <div className="text-center py-8">
        <MdHowToVote className="w-12 h-12 mx-auto text-base-content/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Active Votings</h3>
        <p className="text-base-content/70">
          {canManageVoting
            ? 'Create a new voting for members to choose the next media.'
            : 'No votings are currently available.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {votings.map((voting) => {
        const status = getVotingStatus(voting);
        const totalVotes = getTotalVotes(voting);

        return (
          <div
            key={voting._id || voting.title}
            className="card bg-base-100 shadow-sm border border-base-300"
          >
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="card-title text-lg">{voting.title}</h3>
                    <span className={`badge badge-${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {voting.description && (
                    <p className="text-base-content/70 text-sm mb-4">
                      {voting.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-base-content/60 mb-4">
                <div className="flex items-center gap-1">
                  <MdCalendarToday className="w-4 h-4" />
                  Voting: {formatDate(new Date(voting.votingStartDate))} -{' '}
                  {formatDate(new Date(voting.votingEndDate))}
                </div>
                <div className="flex items-center gap-1">
                  <MdSchedule className="w-4 h-4" />
                  Consumption:{' '}
                  {formatDate(new Date(voting.consumptionStartDate))} -{' '}
                  {formatDate(new Date(voting.consumptionEndDate))}
                </div>
                <div className="flex items-center gap-1">
                  <MdGroup className="w-4 h-4" />
                  {totalVotes} votes
                </div>
              </div>

              <div className="space-y-4">
                {voting.candidates.length === 0 ? (
                  <div className="text-center py-8 text-base-content/60">
                    No candidates added yet.
                  </div>
                ) : (
                  voting.candidates.map((candidate, index) => {
                    const percentage =
                      totalVotes > 0
                        ? (candidate.votes.length / totalVotes) * 100
                        : 0;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {candidate.image && (
                              <img
                                src={candidate.image}
                                alt={candidate.title}
                                className="w-12 object-cover rounded aspect-[2/3]"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium">{candidate.title}</h4>
                              {candidate.description && (
                                <p className="text-sm text-base-content/70 mb-1">
                                  {candidate.description}
                                </p>
                              )}
                              <div className="text-sm text-base-content/60">
                                {candidate.votes.length} votes (
                                {percentage.toFixed(1)}%)
                              </div>
                            </div>
                          </div>
                        </div>
                        <progress
                          className="progress progress-primary w-full"
                          value={percentage}
                          max="100"
                        ></progress>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
