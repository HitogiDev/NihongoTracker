import axiosInstance from './axiosConfig';
import {
  IClubListResponse,
  IClubResponse,
  IClub,
  ICreateClubRequest,
  IClubMedia,
  IClubReview,
  IClubMediaVoting,
  IClubMediaCandidate,
  ILog,
} from '../types';

// Get all clubs with filtering and pagination
export async function getClubsFn(params: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isPublic?: boolean;
  tags?: string;
}): Promise<IClubListResponse> {
  const { data } = await axiosInstance.get<IClubListResponse>('/clubs', {
    params,
  });
  return data;
}

// Get a specific club by ID
export async function getClubFn(clubId: string): Promise<IClubResponse> {
  const { data } = await axiosInstance.get<IClubResponse>(`/clubs/${clubId}`);
  return data;
}

// Create a new club
export async function createClubFn(
  clubData: ICreateClubRequest & { avatarFile?: File; bannerFile?: File }
): Promise<IClub> {
  const formData = new FormData();

  // Add regular form fields
  Object.keys(clubData).forEach((key) => {
    if (key !== 'avatarFile' && key !== 'bannerFile') {
      const value = clubData[key as keyof ICreateClubRequest];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    }
  });

  // Add files if provided
  if (clubData.avatarFile) {
    formData.append('avatar', clubData.avatarFile);
  }

  if (clubData.bannerFile) {
    formData.append('banner', clubData.bannerFile);
  }

  const { data } = await axiosInstance.post<IClub>('/clubs', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

// Join a club
export async function joinClubFn(clubId: string): Promise<{ message: string }> {
  const { data } = await axiosInstance.post<{ message: string }>(
    `/clubs/${clubId}/join`
  );
  return data;
}

// Leave a club
export async function leaveClubFn(
  clubId: string
): Promise<{ message: string }> {
  const { data } = await axiosInstance.post<{ message: string }>(
    `/clubs/${clubId}/leave`
  );
  return data;
}

// Update club (leaders only)
export async function updateClubFn(
  clubId: string,
  updateData: Partial<ICreateClubRequest & { avatar?: string; banner?: string }>
): Promise<IClub> {
  const { data } = await axiosInstance.put<IClub>(
    `/clubs/${clubId}`,
    updateData
  );
  return data;
}

// Get user's clubs
export async function getUserClubsFn(): Promise<IClub[]> {
  const { data } = await axiosInstance.get<IClub[]>('/clubs/user/my-clubs');
  return data;
}

// Approve/reject membership request (leaders only)
export async function manageMembershipRequestFn(
  clubId: string,
  memberId: string,
  action: 'approve' | 'reject'
): Promise<{ message: string }> {
  const { data } = await axiosInstance.post<{ message: string }>(
    `/clubs/${clubId}/members/${memberId}`,
    { action }
  );
  return data;
}

// Club Media Functions

// Add media to club
export async function addClubMediaFn(
  clubId: string,
  mediaData: {
    mediaId: string;
    mediaType: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
  }
): Promise<{ message: string; media: IClubMedia }> {
  const { data } = await axiosInstance.post<{
    message: string;
    media: IClubMedia;
  }>(`/clubs/${clubId}/media`, mediaData);
  return data;
}

// Get club media
export async function getClubMediaFn(
  clubId: string,
  active: boolean = true
): Promise<{ media: IClubMedia[] }> {
  const { data } = await axiosInstance.get<{ media: IClubMedia[] }>(
    `/clubs/${clubId}/media`,
    { params: { active: active.toString() } }
  );
  return data;
}

// Vote for club media - REMOVED
// This functionality has been removed since club media voting is now only for candidate selection
// Comments/reviews are handled through the dedicated review system
/*
export async function voteClubMediaFn(
  clubId: string,
  mediaId: string,
  vote: number
): Promise<{ message: string }> {
  const { data } = await axiosInstance.post<{ message: string }>(
    `/clubs/${clubId}/media/${mediaId}/vote`,
    { vote }
  );
  return data;
}
*/

// Club Review Functions

// Add review for club media
export async function addClubReviewFn(
  clubId: string,
  mediaId: string,
  reviewData: {
    content: string;
    rating?: number;
    hasSpoilers?: boolean;
  }
): Promise<{ message: string; review: IClubReview }> {
  const { data } = await axiosInstance.post<{
    message: string;
    review: IClubReview;
  }>(`/clubs/${clubId}/media/${mediaId}/reviews`, reviewData);
  return data;
}

// Get reviews for club media
export async function getClubReviewsFn(
  clubId: string,
  mediaId: string
): Promise<{ reviews: IClubReview[] }> {
  const { data } = await axiosInstance.get<{ reviews: IClubReview[] }>(
    `/clubs/${clubId}/media/${mediaId}/reviews`
  );
  return data;
}

// Club Media Voting Functions

// Create new media voting (Step 1)
export async function createMediaVotingFn(
  clubId: string,
  votingData: {
    title: string;
    description?: string;
    mediaType:
      | 'anime'
      | 'manga'
      | 'reading'
      | 'vn'
      | 'video'
      | 'movie'
      | 'custom';
    customMediaType?: string;
    candidateSubmissionType: 'manual' | 'member_suggestions';
    suggestionStartDate?: Date;
    suggestionEndDate?: Date;
    votingStartDate: Date | undefined;
    votingEndDate: Date | undefined;
    consumptionStartDate: Date | undefined;
    consumptionEndDate: Date | undefined;
  }
): Promise<{ message: string; voting: IClubMediaVoting }> {
  // Validate required dates
  if (
    !votingData.votingStartDate ||
    !votingData.votingEndDate ||
    !votingData.consumptionStartDate ||
    !votingData.consumptionEndDate
  ) {
    throw new Error('All required dates must be provided');
  }

  // Convert Date objects to ISO strings for the API
  const apiData = {
    ...votingData,
    suggestionStartDate: votingData.suggestionStartDate?.toISOString(),
    suggestionEndDate: votingData.suggestionEndDate?.toISOString(),
    votingStartDate: votingData.votingStartDate.toISOString(),
    votingEndDate: votingData.votingEndDate.toISOString(),
    consumptionStartDate: votingData.consumptionStartDate.toISOString(),
    consumptionEndDate: votingData.consumptionEndDate.toISOString(),
  };

  const { data } = await axiosInstance.post<{
    message: string;
    voting: IClubMediaVoting;
  }>(`/clubs/${clubId}/votings`, apiData);
  return data;
}

// Get media votings
export async function getMediaVotingsFn(
  clubId: string,
  active: boolean = true
): Promise<{ votings: IClubMediaVoting[] }> {
  const { data } = await axiosInstance.get<{ votings: IClubMediaVoting[] }>(
    `/clubs/${clubId}/votings`,
    { params: { active: active.toString() } }
  );
  return data;
}

// Add candidate to voting (Step 2 or during suggestion period)
export async function addVotingCandidateFn(
  clubId: string,
  votingId: string,
  candidateData: {
    mediaId: string;
    title: string;
    description?: string;
    image?: string;
  }
): Promise<{ message: string; candidate: IClubMediaCandidate }> {
  const { data } = await axiosInstance.post<{
    message: string;
    candidate: IClubMediaCandidate;
  }>(`/clubs/${clubId}/votings/${votingId}/candidates`, candidateData);
  return data;
}

// Finalize voting setup (Step 3)
export async function finalizeVotingFn(
  clubId: string,
  votingId: string
): Promise<{ message: string; status: string }> {
  const { data } = await axiosInstance.post<{
    message: string;
    status: string;
  }>(`/clubs/${clubId}/votings/${votingId}/finalize`);
  return data;
}

// Vote for candidate
export async function voteForCandidateFn(
  clubId: string,
  votingId: string,
  candidateIndex: number
): Promise<{ message: string }> {
  const { data } = await axiosInstance.post<{ message: string }>(
    `/clubs/${clubId}/votings/${votingId}/vote/${candidateIndex}`
  );
  return data;
}

// Complete voting
export async function completeVotingFn(
  clubId: string,
  votingId: string
): Promise<{ message: string; winner: IClubMediaCandidate }> {
  const { data } = await axiosInstance.post<{
    message: string;
    winner: IClubMediaCandidate;
  }>(`/clubs/${clubId}/votings/${votingId}/complete`);
  return data;
}

// Get club member logs for specific media
export async function getClubMediaLogsFn(
  clubId: string,
  mediaId: string,
  params?: { page?: number; limit?: number }
): Promise<{
  logs: ILog[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { data } = await axiosInstance.get(
    `/clubs/${clubId}/media/${mediaId}/logs`,
    { params }
  );
  return data;
}

// Get club member rankings for specific media
export async function getClubMediaRankingsFn(
  clubId: string,
  mediaId: string
): Promise<{
  rankings: Array<{
    user: {
      _id: string;
      username: string;
      avatar?: string;
    };
    totalLogs: number;
    totalXp: number;
    totalTime: number;
    totalEpisodes: number;
    totalPages: number;
    firstLog: string | null;
    lastLog: string | null;
    score: number;
    rank: number;
  }>;
  mediaInfo: {
    title: string;
    mediaType: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
}> {
  const { data } = await axiosInstance.get(
    `/clubs/${clubId}/media/${mediaId}/rankings`
  );
  return data;
}

// Get club media statistics
export async function getClubMediaStatsFn(
  clubId: string,
  mediaId: string,
  period: 'consumption' | 'alltime' = 'consumption'
): Promise<{
  mediaInfo: {
    mediaId: string;
    mediaType: string;
    title: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  period: string;
  total: {
    logs: number;
    members: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
    firstLogDate: string | null;
    lastLogDate: string | null;
  };
  thisWeek: {
    logs: number;
    activeMembers: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  thisMonth: {
    logs: number;
    activeMembers: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
}> {
  const { data } = await axiosInstance.get(
    `/clubs/${clubId}/media/${mediaId}/stats`,
    { params: { period } }
  );
  return data;
}
