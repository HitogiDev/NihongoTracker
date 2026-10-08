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
  if (
    !data ||
    !Array.isArray(data.items) ||
    !Number.isInteger(data.page) ||
    data.page < 1 ||
    !Number.isInteger(data.limit) ||
    data.limit < 1 ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    typeof data.hasMore !== 'boolean' ||
    data.items.some(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        !item.id ||
        typeof item.label !== 'string' ||
        typeof item.isRead !== 'boolean' ||
        !Number.isFinite(item.count) ||
        typeof item.createdAt !== 'string'
    )
  ) {
    throw new Error('Invalid notification list response');
  }
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
