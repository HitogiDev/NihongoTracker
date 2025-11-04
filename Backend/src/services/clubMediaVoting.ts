import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import {
  ClubMediaVoting,
  IClubMediaVotingDocument,
} from '../models/clubMediaVoting.model.js';
import {
  IClub,
  IClubMedia,
  IClubMediaCandidate,
  IClubMediaVoting,
} from '../types.js';

interface WinnerDetails {
  mediaId: string;
  title: string;
  description?: string;
  image?: string;
}

function chooseWinningCandidate(
  voting: IClubMediaVotingDocument
): IClubMediaCandidate | null {
  if (!Array.isArray(voting.candidates) || voting.candidates.length === 0) {
    return null;
  }

  const highestVoteCount = Math.max(
    ...voting.candidates.map((candidate) => candidate.votes.length)
  );

  const topCandidates = voting.candidates.filter(
    (candidate) => candidate.votes.length === highestVoteCount
  );

  if (topCandidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * topCandidates.length);
  return topCandidates[randomIndex];
}

function buildWinnerDetails(
  voting: IClubMediaVotingDocument,
  candidate: IClubMediaCandidate | null
): WinnerDetails | null {
  if (candidate) {
    return {
      mediaId: candidate.mediaId,
      title: candidate.title || 'Untitled Media',
      description: candidate.description,
      image: candidate.image,
    };
  }

  if (
    voting.winnerCandidate &&
    voting.winnerCandidate.mediaId &&
    voting.winnerCandidate.title
  ) {
    return {
      mediaId: voting.winnerCandidate.mediaId,
      title: voting.winnerCandidate.title,
      description: voting.winnerCandidate.description,
      image: voting.winnerCandidate.image,
    };
  }

  return null;
}

function getMediaTypeForWinner(
  voting: IClubMediaVotingDocument
): IClubMedia['mediaType'] {
  if (voting.mediaType === 'custom') {
    return 'reading';
  }

  return voting.mediaType as IClubMedia['mediaType'];
}

function hasExistingMediaForVoting(
  club: IClub,
  voting: IClubMediaVotingDocument
): boolean {
  const votingIdStr = voting._id?.toString();
  if (!votingIdStr) {
    return false;
  }

  return club.currentMedia.some((media) => {
    if (!media?.votingId) {
      return false;
    }

    return media.votingId.toString() === votingIdStr;
  });
}

async function ensureWinnerMedia(
  club: IClub,
  voting: IClubMediaVotingDocument,
  winner: WinnerDetails
): Promise<void> {
  if (hasExistingMediaForVoting(club, voting)) {
    return;
  }

  const freshClub = await Club.findById(club._id).select('currentMedia');
  if (
    freshClub &&
    hasExistingMediaForVoting(freshClub as unknown as IClub, voting)
  ) {
    if (typeof (club as any).set === 'function') {
      (club as any).set('currentMedia', freshClub.currentMedia);
    }
    return;
  }

  const votingObjectId =
    voting._id instanceof Types.ObjectId
      ? voting._id
      : new Types.ObjectId(voting._id as string);

  const consumptionStartMs = voting.consumptionStartDate
    ? new Date(voting.consumptionStartDate).getTime()
    : null;
  const consumptionEndMs = voting.consumptionEndDate
    ? new Date(voting.consumptionEndDate).getTime()
    : null;

  const locateLegacyMedia = (clubDoc: IClub): IClubMedia | undefined => {
    if (!consumptionStartMs || !consumptionEndMs) {
      return undefined;
    }

    return clubDoc.currentMedia.find((media) => {
      if (!media || media.votingId) {
        return false;
      }

      const mediaStart = media.startDate
        ? new Date(media.startDate).getTime()
        : null;
      const mediaEnd = media.endDate ? new Date(media.endDate).getTime() : null;

      if (!mediaStart || !mediaEnd) {
        return false;
      }

      const sameWindow =
        mediaStart === consumptionStartMs && mediaEnd === consumptionEndMs;
      const sameCreator =
        media.addedBy?.toString() === voting.createdBy?.toString();

      return sameWindow && sameCreator;
    });
  };

  const legacyMedia = locateLegacyMedia(club);
  if (legacyMedia) {
    legacyMedia.votingId = votingObjectId;
    if (!legacyMedia.mediaId) {
      legacyMedia.mediaId = winner.mediaId;
    }
    if (!legacyMedia.mediaType) {
      legacyMedia.mediaType = getMediaTypeForWinner(voting);
    }
    if (!legacyMedia.title) {
      legacyMedia.title = winner.title;
    }
    if (!legacyMedia.description && winner.description) {
      legacyMedia.description = winner.description;
    }

    await club.save();
    return;
  }

  if (freshClub) {
    const freshLegacyMedia = locateLegacyMedia(freshClub as unknown as IClub);
    if (freshLegacyMedia) {
      (freshLegacyMedia as any).votingId = votingObjectId;
      if (!(freshLegacyMedia as any).mediaId) {
        (freshLegacyMedia as any).mediaId = winner.mediaId;
      }
      if (!(freshLegacyMedia as any).mediaType) {
        (freshLegacyMedia as any).mediaType = getMediaTypeForWinner(voting);
      }
      if (!(freshLegacyMedia as any).title) {
        (freshLegacyMedia as any).title = winner.title;
      }
      if (!(freshLegacyMedia as any).description && winner.description) {
        (freshLegacyMedia as any).description = winner.description;
      }

      await freshClub.save();

      if (typeof (club as any).set === 'function') {
        (club as any).set('currentMedia', freshClub.currentMedia);
      }
      return;
    }
  }

  club.currentMedia.push({
    mediaId: winner.mediaId,
    mediaType: getMediaTypeForWinner(voting),
    title: winner.title,
    description: winner.description,
    startDate: voting.consumptionStartDate,
    endDate: voting.consumptionEndDate,
    isActive: true,
    addedBy: voting.createdBy as Types.ObjectId,
    votingId: votingObjectId,
    votes: [],
  });

  await club.save();
}

export async function completeVotingDocument(
  club: IClub,
  voting: IClubMediaVotingDocument,
  now: Date = new Date()
): Promise<{ winner: WinnerDetails | null }> {
  const candidate = chooseWinningCandidate(voting);
  const winnerDetails = buildWinnerDetails(voting, candidate);

  if (winnerDetails) {
    voting.winnerCandidate = winnerDetails;
  } else {
  }

  voting.status = 'completed';
  voting.isActive = false;
  voting.completedAt = voting.completedAt ?? now;

  await voting.save();

  if (winnerDetails) {
    await ensureWinnerMedia(club, voting, winnerDetails);
  }

  return { winner: winnerDetails };
}

export async function updateVotingStatusesForClub(club: IClub): Promise<void> {
  const now = new Date();
  const votings = await ClubMediaVoting.find({ club: club._id });

  for (const voting of votings) {
    if (voting.status === 'completed') {
      if (voting.isActive) {
        voting.isActive = false;
        await voting.save();
      }
      continue;
    }

    if (now >= voting.consumptionStartDate) {
      await completeVotingDocument(club, voting, now);
      continue;
    }

    let nextStatus: IClubMediaVoting['status'] = voting.status;

    if (now >= voting.votingEndDate) {
      nextStatus = 'voting_closed';
    } else if (now >= voting.votingStartDate) {
      nextStatus = 'voting_open';
    } else if (voting.candidateSubmissionType === 'member_suggestions') {
      if (
        voting.suggestionStartDate &&
        voting.suggestionEndDate &&
        now >= voting.suggestionStartDate &&
        now < voting.suggestionEndDate
      ) {
        nextStatus = 'suggestions_open';
      } else if (voting.suggestionEndDate && now >= voting.suggestionEndDate) {
        nextStatus = 'suggestions_closed';
      } else {
        nextStatus = 'setup';
      }
    } else {
      nextStatus = 'setup';
    }

    if (nextStatus !== voting.status) {
      voting.status = nextStatus;
      await voting.save();
    }
  }
}

export async function findVotingForClub(
  clubId: Types.ObjectId,
  votingId: string
): Promise<IClubMediaVotingDocument | null> {
  if (!Types.ObjectId.isValid(votingId)) {
    return null;
  }

  return ClubMediaVoting.findOne({
    _id: new Types.ObjectId(votingId),
    club: clubId,
  });
}

export async function deleteVotingById(
  clubId: Types.ObjectId,
  votingId: string
): Promise<void> {
  if (!Types.ObjectId.isValid(votingId)) {
    return;
  }

  await ClubMediaVoting.deleteOne({
    _id: new Types.ObjectId(votingId),
    club: clubId,
  });
}

export { WinnerDetails };
