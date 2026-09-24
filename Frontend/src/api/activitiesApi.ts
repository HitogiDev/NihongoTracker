import api from './axiosConfig';
import {
  ActivityReactionType,
  IActivityComment,
  ISocialActivity,
} from '../types';

export type ActivityFeedScope = 'following' | 'global' | 'clubs' | 'user';

export async function getActivityFeedFn(params: {
  scope: ActivityFeedScope;
  before?: string;
  limit?: number;
  clubId?: string;
  username?: string;
}): Promise<{ activities: ISocialActivity[]; nextCursor: string | null }> {
  const { data } = await api.get('/activities', { params });
  return data;
}

export async function setActivityReactionFn(
  activityId: string,
  type: ActivityReactionType
): Promise<{ reaction: ActivityReactionType }> {
  const { data } = await api.put(`/activities/${activityId}/reaction`, {
    type,
  });
  return data;
}

export async function removeActivityReactionFn(
  activityId: string
): Promise<void> {
  await api.delete(`/activities/${activityId}/reaction`);
}

export async function getActivityCommentsFn(
  activityId: string,
  page = 1,
  limit = 20
): Promise<{
  comments: IActivityComment[];
  total: number;
  canComment: boolean;
  page: number;
  limit: number;
}> {
  const { data } = await api.get(`/activities/${activityId}/comments`, {
    params: { page, limit },
  });
  return data;
}

export async function addActivityCommentFn(
  activityId: string,
  content: string,
  parentCommentId?: string
): Promise<{ comment: IActivityComment }> {
  const { data } = await api.post(`/activities/${activityId}/comments`, {
    content,
    ...(parentCommentId ? { parentCommentId } : {}),
  });
  return data;
}

export async function editActivityCommentFn(
  activityId: string,
  commentId: string,
  content: string
): Promise<{ comment: IActivityComment }> {
  const { data } = await api.patch(
    `/activities/${activityId}/comments/${commentId}`,
    { content }
  );
  return data;
}

export async function deleteActivityCommentFn(
  activityId: string,
  commentId: string
): Promise<void> {
  await api.delete(`/activities/${activityId}/comments/${commentId}`);
}

export async function likeActivityCommentFn(
  activityId: string,
  commentId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await api.put(
    `/activities/${activityId}/comments/${commentId}/like`
  );
  return data;
}

export async function unlikeActivityCommentFn(
  activityId: string,
  commentId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await api.delete(
    `/activities/${activityId}/comments/${commentId}/like`
  );
  return data;
}
