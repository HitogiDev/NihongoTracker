import axios from 'axios';
import { useUserDataStore } from '../store/userData';
import type { IClubResponse, ILoginResponse } from '../types';
import { isNativeApp } from '../utils/nativeRuntime';
import axiosInstance from '../api/axiosConfig';
import {
  getOfflineOperations,
  enqueueOfflineOperation,
  notifyOfflineQueueChanged,
  removeOfflineOperation,
  updateOfflineOperation,
  type OfflineOperation,
  type OfflineOperationType,
} from './offlineStore';

let syncInFlight: Promise<Map<string, unknown>> | null = null;

export function isNetworkFailure(error: unknown) {
  return axios.isAxiosError(error) && !error.response && !axios.isCancel(error);
}

export async function queueOfflineMutation<T>(
  type: OfflineOperationType,
  payload: Record<string, unknown>,
  fallback: (operationId: string) => T | Promise<T>,
  operationId = crypto.randomUUID(),
): Promise<T> {
  if (!isNativeApp())
    throw new Error('Offline actions require the mobile app.');
  const userId = useUserDataStore.getState().user?._id;
  if (!userId) throw new Error('Sign in before saving offline changes.');

  const id = operationId;
  await enqueueOfflineOperation({ id, userId, type, payload });
  const activeResults = await syncInFlight;
  if (useUserDataStore.getState().user?._id !== userId)
    throw new axios.CanceledError('Account changed');
  if (activeResults?.has(id)) return activeResults.get(id) as T;
  const results = await syncOfflineQueue();
  if (useUserDataStore.getState().user?._id !== userId)
    throw new axios.CanceledError('Account changed');
  if (results?.has(id)) return results.get(id) as T;
  const saved = (await getOfflineOperations(userId)).find(
    (operation) => operation.id === id,
  );
  if (saved?.status === 'failed') throw new Error(saved.error);
  return fallback(id);
}

async function sendOperation(operation: OfflineOperation) {
  const { type, payload } = operation;
  if (type === 'settings') {
    const endpoints = {
      customization: 'users/me/customization',
      statsLayout: 'users/settings/stats-layout',
      profileLayout: 'users/settings/profile-layout',
      socialPrivacy: 'users/settings/social-privacy',
      customThemes: 'users/me/custom-themes',
    };
    const key = payload.key as keyof typeof endpoints;
    if (!Object.prototype.hasOwnProperty.call(endpoints, key))
      throw new Error('Unknown offline setting.');
    return axiosInstance.request({
      method: key === 'customThemes' ? 'put' : 'patch',
      url: endpoints[key],
      data: payload.body,
    });
  }
  if (type === 'log') {
    return axiosInstance.post('logs', payload.log, {
      headers: { 'Idempotency-Key': operation.id },
    });
  }
  if (type === 'profile') {
    const form = new FormData();
    Object.entries(payload.fields as Record<string, string>).forEach(
      ([key, value]) => form.append(key, value),
    );
    return axiosInstance.put('/users', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  if (type === 'follow') {
    return axiosInstance.post(
      `users/${encodeURIComponent(String(payload.username))}/follow`,
    );
  }
  if (type === 'unfollow') {
    return axiosInstance.delete(
      `users/${encodeURIComponent(String(payload.username))}/follow`,
    );
  }
  if (type === 'joinClub') {
    try {
      return await axiosInstance.post(`/clubs/${String(payload.clubId)}/join`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const response = await axiosInstance.get<IClubResponse>(
          `clubs/${String(payload.clubId)}`,
        );
        if (
          response.statusText !== 'OK (offline cache)' &&
          (response.data.userStatus === 'pending' ||
            (response.data.isUserMember &&
              response.data.userStatus === 'active'))
        )
          return { data: { message: 'Membership confirmed' } };
      }
      throw error;
    }
  }
  try {
    return await axiosInstance.post(`/clubs/${String(payload.clubId)}/leave`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      const response = await axiosInstance.get<IClubResponse>(
        `clubs/${String(payload.clubId)}`,
      );
      if (
        response.statusText !== 'OK (offline cache)' &&
        !response.data.isUserMember
      )
        return { data: { message: 'Membership confirmed' } };
    }
    throw error;
  }
}

export async function syncOfflineQueue() {
  if (!isNativeApp() || !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;

  const userId = useUserDataStore.getState().user?._id;
  if (!userId) return;

  syncInFlight = (async () => {
    const operations = await getOfflineOperations(userId);
    const results = new Map<string, unknown>();
    let changed = false;
    for (const operation of operations) {
      if (useUserDataStore.getState().user?._id !== userId) break;
      if (operation.status === 'failed') break;
      try {
        await updateOfflineOperation({ ...operation, attempted: true });
        if (useUserDataStore.getState().user?._id !== userId) break;
        const response = await sendOperation(operation);
        results.set(operation.id, response.data);
        await removeOfflineOperation(operation);
        changed = true;
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : null;
        const isRetryable =
          !status || status >= 500 || status === 408 || status === 429;
        await updateOfflineOperation({
          ...operation,
          attempted: true,
          status: isRetryable ? 'pending' : 'failed',
          error: axios.isAxiosError(error)
            ? String(error.response?.data?.message || error.message)
            : 'The server rejected this change.',
        });
        break;
      }
    }
    if (changed) {
      await refreshOfflineAccount();
      const { default: queryClient } = await import('../queryClient');
      await queryClient.invalidateQueries();
    }
    return results;
  })().finally(() => {
    syncInFlight = null;
    notifyOfflineQueueChanged();
  });

  return syncInFlight;
}

export async function retryOfflineQueue() {
  const userId = useUserDataStore.getState().user?._id;
  if (!userId) return;
  const operations = await getOfflineOperations(userId);
  await Promise.all(
    operations
      .filter((operation) => operation.status === 'failed')
      .map((operation) =>
        updateOfflineOperation({
          ...operation,
          status: 'pending',
          error: undefined,
        }),
      ),
  );
  return syncOfflineQueue();
}

export async function refreshOfflineAccount() {
  const userId = useUserDataStore.getState().user?._id;
  if (!isNativeApp() || !userId) return;
  const response = await axiosInstance
    .get<ILoginResponse>('users/me')
    .catch(() => null);
  if (response && useUserDataStore.getState().user?._id === userId) {
    const { overlayUser } = await import('./offlineViews');
    useUserDataStore.getState().setUser(await overlayUser(response.data));
  }
}

export async function getPendingOfflineLogs(userId: string) {
  const operations = await getOfflineOperations(userId);
  return operations.filter((operation) => operation.type === 'log');
}

export function isOfflineMutationError(error: unknown) {
  return isNativeApp() && isNetworkFailure(error);
}

export async function saveOfflineSetting<T>(
  key:
    | 'customization'
    | 'statsLayout'
    | 'profileLayout'
    | 'socialPrivacy'
    | 'customThemes',
  body: Record<string, unknown>,
  send: () => Promise<T>,
  fallback: T,
) {
  if (isNativeApp())
    return queueOfflineMutation('settings', { key, body }, () => fallback);
  try {
    return await send();
  } catch (error) {
    if (!isOfflineMutationError(error)) throw error;
    return queueOfflineMutation('settings', { key, body }, () => fallback);
  }
}
