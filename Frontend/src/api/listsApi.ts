import api from './axiosConfig';

import {
  IMediaList,
  IMediaListComment,
  MediaListMediaType,
} from '../types';

export interface IMediaListsResponse {
  lists: IMediaList[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IBrowseListsParams {
  page?: number;
  limit?: number;
  sort?: 'popular' | 'recent' | 'updated';
  q?: string;
  mediaType?: MediaListMediaType;
}

export interface IMediaListPayload {
  title: string;
  description?: string;
  isRanked?: boolean;
  isPublic?: boolean;
  entries?: Array<{
    mediaId: string;
    mediaType: MediaListMediaType;
    note?: string;
  }>;
}

export async function browseMediaListsFn(
  params: IBrowseListsParams = {}
): Promise<IMediaListsResponse> {
  const { data } = await api.get<IMediaListsResponse>('lists', { params });
  return data;
}

export async function getUserMediaListsFn(
  username: string
): Promise<{ lists: IMediaList[] }> {
  const { data } = await api.get<{ lists: IMediaList[] }>(
    `lists/user/${username}`
  );
  return data;
}

export async function getMyMediaListsFn(query?: {
  mediaId: string;
  mediaType: MediaListMediaType;
}): Promise<{ lists: IMediaList[] }> {
  const { data } = await api.get<{ lists: IMediaList[] }>('lists/mine', {
    params: query,
  });
  return data;
}

export async function getMediaListFn(
  listId: string
): Promise<{ list: IMediaList }> {
  const { data } = await api.get<{ list: IMediaList }>(`lists/${listId}`);
  return data;
}

export async function createMediaListFn(
  payload: IMediaListPayload
): Promise<{ message: string; list: IMediaList }> {
  const { data } = await api.post<{ message: string; list: IMediaList }>(
    'lists',
    payload
  );
  return data;
}

export async function updateMediaListFn(
  listId: string,
  payload: Partial<IMediaListPayload>
): Promise<{ message: string; list: IMediaList }> {
  const { data } = await api.put<{ message: string; list: IMediaList }>(
    `lists/${listId}`,
    payload
  );
  return data;
}

export async function deleteMediaListFn(
  listId: string
): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`lists/${listId}`);
  return data;
}

export async function addMediaListEntryFn(
  listId: string,
  entry: { mediaId: string; mediaType: MediaListMediaType; note?: string }
): Promise<{ message: string; list: IMediaList }> {
  const { data } = await api.post<{ message: string; list: IMediaList }>(
    `lists/${listId}/entries`,
    entry
  );
  return data;
}

export async function removeMediaListEntryFn(
  listId: string,
  mediaType: MediaListMediaType,
  mediaId: string
): Promise<{ message: string; list: IMediaList }> {
  const { data } = await api.delete<{ message: string; list: IMediaList }>(
    `lists/${listId}/entries/${encodeURIComponent(mediaType)}/${mediaId}`
  );
  return data;
}

export async function toggleMediaListLikeFn(
  listId: string
): Promise<{ isLiked: boolean; likeCount: number }> {
  const { data } = await api.post<{ isLiked: boolean; likeCount: number }>(
    `lists/${listId}/like`
  );
  return data;
}

export async function cloneMediaListFn(
  listId: string,
  title?: string
): Promise<{ message: string; list: IMediaList }> {
  const { data } = await api.post<{ message: string; list: IMediaList }>(
    `lists/${listId}/clone`,
    { title }
  );
  return data;
}

export async function getMediaListCommentsFn(
  listId: string
): Promise<{ comments: IMediaListComment[] }> {
  const { data } = await api.get<{ comments: IMediaListComment[] }>(
    `lists/${listId}/comments`
  );
  return data;
}

export async function addMediaListCommentFn(
  listId: string,
  content: string
): Promise<{ message: string; comment: IMediaListComment }> {
  const { data } = await api.post<{
    message: string;
    comment: IMediaListComment;
  }>(`lists/${listId}/comments`, { content });
  return data;
}

export async function deleteMediaListCommentFn(
  listId: string,
  commentId: string
): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(
    `lists/${listId}/comments/${commentId}`
  );
  return data;
}
