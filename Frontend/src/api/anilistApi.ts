import axiosInstance from './axiosConfig';
import { IMediaDocument } from '../types';

export async function searchAnilist(
  search: string,
  type?: string,
  page: number = 1,
  perPage: number = 10,
  format?: string,
  ids?: number[] | number
): Promise<IMediaDocument[]> {
  if (!type) return [];

  const params: Record<string, any> = {
    search,
    type,
    page,
    perPage,
  };

  if (format) params.format = format;
  if (ids !== undefined)
    params.ids = Array.isArray(ids) ? ids.join(',') : String(ids);

  const { data } = await axiosInstance.get<IMediaDocument[]>(
    'media/anilist/search',
    {
      params,
    }
  );

  return data || [];
}
