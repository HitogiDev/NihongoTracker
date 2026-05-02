import axiosInstance from './axiosConfig';
import { INotificationSummaryResponse } from '../types';

const api = axiosInstance;

export async function getNotificationSummaryFn(): Promise<INotificationSummaryResponse> {
  const { data } = await api.get<INotificationSummaryResponse>(
    '/notifications/summary'
  );
  return data;
}
