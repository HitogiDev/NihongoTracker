import axiosInstance from './axiosConfig';
import {
  INotificationListResponse,
  INotificationSummaryResponse,
} from '../types';

const api = axiosInstance;

export async function getNotificationSummaryFn(): Promise<INotificationSummaryResponse> {
  const { data } = await api.get<INotificationSummaryResponse>(
    '/notifications/summary'
  );
  return data;
}

export async function getNotificationListFn({
  page,
  limit,
}: {
  page: number;
  limit: number;
}): Promise<INotificationListResponse> {
  const { data } = await api.get<INotificationListResponse>(
    '/notifications/list',
    {
      params: { page, limit },
    }
  );
  return data;
}

export async function markNotificationsAsReadFn(): Promise<void> {
  await api.patch('/notifications/read');
}

export async function markNotificationsAsUnreadFn(): Promise<void> {
  await api.patch('/notifications/unread');
}

export async function deleteNotificationFn(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
