import api from './axiosConfig';
import type {
  DuelListGroup,
  ICreateDuelPayload,
  IDuel,
  IDuelCounts,
  IDuelListResponse,
  IDuelRecord,
  IDuelStats,
} from '../types';

export async function getDuelsFn(
  status: DuelListGroup,
  page = 1,
  limit = 20
): Promise<IDuelListResponse> {
  const { data } = await api.get<IDuelListResponse>('/duels', {
    params: { status, page, limit },
  });
  return data;
}

export async function getDuelCountsFn(): Promise<IDuelCounts> {
  const { data } = await api.get<IDuelCounts>('/duels/counts');
  return data;
}

export async function createDuelFn(payload: ICreateDuelPayload): Promise<IDuel> {
  const { data } = await api.post<IDuel>('/duels', payload);
  return data;
}

export async function respondToDuelFn(
  duelId: string,
  action: 'accept' | 'decline' | 'cancel' | 'rematch'
): Promise<IDuel> {
  const { data } = await api.post<IDuel>(`/duels/${duelId}/${action}`);
  return data;
}

export async function getDuelHeadToHeadFn(
  username: string
): Promise<IDuelRecord> {
  const { data } = await api.get<IDuelRecord>(
    `/duels/h2h/${encodeURIComponent(username)}`
  );
  return data;
}

export async function getDuelStatsFn(username: string): Promise<IDuelStats> {
  const { data } = await api.get<IDuelStats>(
    `/duels/stats/${encodeURIComponent(username)}`
  );
  return data;
}
