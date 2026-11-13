import api from './axiosConfig';
import {
  IMediaCommunityResponse,
  IMediaDocument,
  ILevelRecommendationsResponse,
  IMediaRecommendation,
  LevelRecommendationCategory,
  MediaRecommendationStatus,
} from '../types';

export type MediaCommunityRelation = 'followers' | 'friends' | 'following';

export async function getMediaCommunityFn(
  mediaType: string,
  mediaId: string,
  relation?: MediaCommunityRelation
): Promise<IMediaCommunityResponse> {
  const { data } = await api.get<IMediaCommunityResponse>(
    `/media/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}/community`,
    { params: relation ? { relation } : undefined }
  );
  return data;
}

export async function recommendMediaFn(payload: {
  recipientUsername: string;
  mediaId: string;
  mediaType: IMediaDocument['type'];
  message?: string;
}): Promise<{ recommendation: IMediaRecommendation }> {
  const { data } = await api.post('/media-recommendations', payload);
  return data;
}

export async function getMediaRecommendationsFn(params: {
  direction: 'received' | 'sent';
  page?: number;
  limit?: number;
}): Promise<{
  recommendations: IMediaRecommendation[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}> {
  const { data } = await api.get('/media-recommendations', { params });
  return data;
}

export async function updateMediaRecommendationStatusFn(
  recommendationId: string,
  status: Exclude<MediaRecommendationStatus, 'pending'>
): Promise<{ recommendation: IMediaRecommendation }> {
  const { data } = await api.patch(
    `/media-recommendations/${recommendationId}/status`,
    { status }
  );
  return data;
}

export interface LevelRecommendationFilters {
  types: IMediaDocument['type'][];
  genres: string[];
  /** Moves the difficulty window, in Jiten. */
  shift: number;
}

export async function getLevelRecommendationsFn(params: {
  category: LevelRecommendationCategory;
  limit?: number;
  filters?: LevelRecommendationFilters;
}): Promise<ILevelRecommendationsResponse> {
  const { category, limit, filters } = params;
  const { data } = await api.get<ILevelRecommendationsResponse>(
    '/media-recommendations/level',
    {
      params: {
        category,
        limit,
        types: filters?.types.length ? filters.types.join(',') : undefined,
        genres: filters?.genres.length ? filters.genres.join(',') : undefined,
        shift: filters?.shift ? filters.shift : undefined,
      },
    }
  );
  return data;
}

export async function dismissLevelRecommendationFn(
  mediaType: IMediaDocument['type'],
  mediaId: string
): Promise<void> {
  await api.post('/media-recommendations/level/dismissals', {
    mediaType,
    mediaId,
  });
}

export async function restoreLevelRecommendationFn(
  mediaType: IMediaDocument['type'],
  mediaId: string
): Promise<void> {
  await api.delete(
    `/media-recommendations/level/dismissals/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}`
  );
}
