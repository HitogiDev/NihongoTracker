import api from './axiosConfig';
import {
  IMediaCommunityResponse,
  IMediaDocument,
  IMediaRecommendation,
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
