import api from './axiosConfig';
import type {
  IInsightsComparisonResponse,
  IInsightsDigestSettings,
  IInsightsResponse,
} from '../types';

export async function getInsightsFn(
  compareMonths: number
): Promise<IInsightsResponse> {
  const { data } = await api.get<IInsightsResponse>('/insights', {
    params: { compareMonths },
  });
  return data;
}

export async function compareInsightPeriodsFn(params: {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
}): Promise<IInsightsComparisonResponse> {
  const { data } = await api.get<IInsightsComparisonResponse>(
    '/insights/compare',
    { params }
  );
  return data;
}

export async function updateInsightsDigestFn(
  settings: Partial<IInsightsDigestSettings>
): Promise<IInsightsDigestSettings> {
  const { data } = await api.put<IInsightsDigestSettings>(
    '/insights/digest',
    settings
  );
  return data;
}
