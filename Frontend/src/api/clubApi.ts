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
  IMediaDocument,
} from '../types';

const api = axiosInstance;

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
  const { data } = await api.get<IClubListResponse>('/clubs', {
    params,
  });
  return data;
}

// Get a specific club by ID
export async function getClubFn(clubId: string): Promise<IClubResponse> {
  const { data } = await api.get<IClubResponse>(`/clubs/${clubId}`);
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

  const { data } = await api.post<IClub>('/clubs', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

// Join a club
export async function joinClubFn(clubId: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(`/clubs/${clubId}/join`);
  return data;
}

// Leave a club
export async function leaveClubFn(
  clubId: string
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    `/clubs/${clubId}/leave`
  );
  return data;
}

// Update club (leaders only)
export async function updateClubFn(
  clubId: string,
  updateData: Partial<ICreateClubRequest & { avatar?: string; banner?: string }>
): Promise<IClub> {
  const { data } = await api.put<IClub>(`/clubs/${clubId}`, updateData);
  return data;
}

// Update club with file uploads (leaders only)
export async function updateClubWithFilesFn(
  clubId: string,
  clubData: Partial<ICreateClubRequest> & {
    avatarFile?: File;
    bannerFile?: File;
  }
): Promise<IClub> {
  const formData = new FormData();

  // Add regular form fields
  Object.keys(clubData).forEach((key) => {
    if (key !== 'avatarFile' && key !== 'bannerFile') {
      const value = clubData[key as keyof Partial<ICreateClubRequest>];
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

  const { data } = await api.put<IClub>(`/clubs/${clubId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

// Get user's clubs
export async function getUserClubsFn(): Promise<IClub[]> {
  const { data } = await api.get<IClub[]>('/clubs/user/my-clubs');
  return data;
}

// Approve/reject membership request (leaders only)
export async function manageMembershipRequestFn(
  clubId: string,
  memberId: string,
  action: 'approve' | 'reject'
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    `/clubs/${clubId}/members/${memberId}`,
    { action }
  );
  return data;
}

// Get pending membership requests (leaders only)
export async function getPendingMembershipRequestsFn(
  clubId: string
): Promise<{ pending: IClub['members'] }> {
  const { data } = await api.get<{ pending: IClub['members'] }>(
    `/clubs/${clubId}/members/pending`
  );
  return data;
}

// Transfer club leadership (leaders only)
export async function transferLeadershipFn(
  clubId: string,
  newLeaderId: string
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    `/clubs/${clubId}/transfer-leadership`,
    { newLeaderId }
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
    mediaData?: Partial<IMediaDocument>; // Media creation data
  }
): Promise<{ message: string; media: IClubMedia }> {
  const { data } = await api.post<{
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
  const { data } = await api.get<{ media: IClubMedia[] }>(
    `/clubs/${clubId}/media`,
    { params: { active: active.toString() } }
  );
  return data;
}

// Edit club media
export async function editClubMediaFn(
  clubId: string,
  mediaId: string,
  data: {
    title?: string;
    description?: string;
    startDate: string;
    endDate: string;
  }
): Promise<{ message: string; media: IClubMedia }> {
  const res = await api.put(`/clubs/${clubId}/media/${mediaId}`, data);
  return res.data;
}

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
  const { data } = await api.post<{
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
  const { data } = await api.get<{ reviews: IClubReview[] }>(
    `/clubs/${clubId}/media/${mediaId}/reviews`
  );
  return data;
}

// Edit review for club media
export async function editClubReviewFn(
  clubId: string,
  mediaId: string,
  reviewId: string,
  reviewData: {
    content: string;
    rating?: number;
    hasSpoilers: boolean;
  }
): Promise<{ message: string; review: IClubReview }> {
  const { data } = await api.put<{
    message: string;
    review: IClubReview;
  }>(`/clubs/${clubId}/media/${mediaId}/reviews/${reviewId}`, reviewData);
  return data;
}

// Toggle like/unlike on review
export async function toggleReviewLikeFn(
  clubId: string,
  mediaId: string,
  reviewId: string
): Promise<{ message: string; liked: boolean; likesCount: number }> {
  const { data } = await api.post<{
    message: string;
    liked: boolean;
    likesCount: number;
  }>(`/clubs/${clubId}/media/${mediaId}/reviews/${reviewId}/like`);
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

  const { data } = await api.post<{
    message: string;
    voting: IClubMediaVoting;
  }>(`/clubs/${clubId}/votings`, apiData);
  return data;
}

// Edit media voting
export async function editMediaVotingFn(
  clubId: string,
  votingId: string,
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
    testingMode?: boolean;
  }
): Promise<{ message: string; voting: IClubMediaVoting }> {
  // Validate required dates
  if (
    !votingData.votingStartDate ||
    !votingData.votingEndDate ||
    !votingData.consumptionStartDate ||
    !votingData.consumptionEndDate
  ) {
    throw new Error('All voting and consumption dates are required');
  }

  const { data } = await api.put<{
    message: string;
    voting: IClubMediaVoting;
  }>(`/clubs/${clubId}/votings/${votingId}`, votingData);
  return data;
}

// Delete media voting
export async function deleteMediaVotingFn(
  clubId: string,
  votingId: string
): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(
    `/clubs/${clubId}/votings/${votingId}`
  );
  return data;
}

// Get media votings
export async function getMediaVotingsFn(
  clubId: string,
  active: boolean = true
): Promise<{ votings: IClubMediaVoting[] }> {
  const { data } = await api.get<{ votings: IClubMediaVoting[] }>(
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
  const { data } = await api.post<{
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
  const { data } = await api.post<{
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
  const { data } = await api.post<{ message: string }>(
    `/clubs/${clubId}/votings/${votingId}/vote/${candidateIndex}`
  );
  return data;
}

// Complete voting
export async function completeVotingFn(
  clubId: string,
  votingId: string
): Promise<{ message: string; winner: IClubMediaCandidate }> {
  const { data } = await api.post<{
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
  const { data } = await api.get(`/clubs/${clubId}/media/${mediaId}/logs`, {
    params,
  });
  return data;
}

// Get club member rankings for specific media
export async function getClubMediaRankingsFn(
  clubId: string,
  mediaId: string,
  period: 'consumption' | 'alltime' = 'consumption'
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
  const { data } = await api.get(`/clubs/${clubId}/media/${mediaId}/rankings`, {
    params: { period },
  });
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
  const { data } = await api.get(`/clubs/${clubId}/media/${mediaId}/stats`, {
    params: { period },
  });
  return data;
}

// Get club member rankings (overall)
export async function getClubMemberRankingsFn(
  clubId: string,
  params: {
    sortBy?: 'totalXp' | 'totalLogs' | 'totalTime' | 'level';
    period?: 'week' | 'month' | 'all-time';
    limit?: number;
    page?: number;
  } = {}
): Promise<{
  rankings: Array<{
    user: {
      _id: string;
      username: string;
      avatar?: string;
      stats: {
        userLevel: number;
        userXp: number;
      };
      patreon?: {
        isActive: boolean;
        tier: 'donator' | 'enthusiast' | 'consumer' | null;
        customBadgeText?: string;
        badgeColor?: string;
        badgeTextColor?: string;
      };
    };
    totalLogs: number;
    totalXp: number;
    totalTime: number; // in minutes
    totalHours: number; // calculated field
    rank: number;
    joinDate: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { data } = await api.get(`/clubs/${clubId}/rankings`, {
    params,
  });
  return data;
}

// Get club recent activity
export async function getClubRecentActivityFn(
  clubId: string,
  params?: { limit?: number; days?: number; page?: number }
): Promise<{
  activities: Array<{
    type: 'log' | 'review';
    _id: string;
    user: {
      _id: string;
      username: string;
      avatar?: string;
    };
    media: {
      _id: string;
      title: string;
    };
    clubMedia: boolean;
    content: string;
    metadata: {
      episodes?: number;
      pages?: number;
      time?: number;
      xp?: number;
      rating?: number;
      hasSpoilers?: boolean;
    };
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const { data } = await api.get(`/clubs/${clubId}/recent-activity`, {
    params,
  });
  return data;
}
