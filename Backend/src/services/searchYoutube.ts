import axios from 'axios';
import { IMediaDocument } from '../types.js';
import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';

type MediaDocument = Pick<
  IMediaDocument,
  | 'contentId'
  | 'title'
  | 'contentImage'
  | 'description'
  | 'type'
  | 'episodeDuration'
  | 'isAdult'
>;

interface YouTubeVideoData {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      medium: { url: string };
      high: { url: string };
    };
    channelId: string;
    channelTitle: string;
    duration?: string;
  };
  contentDetails?: {
    duration: string;
  };
}

interface YouTubeChannelData {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      medium: { url: string };
      high: { url: string };
    };
  };
}

export async function getYouTubeVideoInfo(videoUrl: string): Promise<{
  video: MediaDocument;
  channel: MediaDocument;
} | null> {
  try {
    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      return null;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos`,
      {
        params: {
          part: 'snippet,contentDetails',
          id: videoId,
          key: apiKey,
        },
      }
    );

    if (!videoResponse.data.items?.length) {
      return null;
    }

    const videoData: YouTubeVideoData = videoResponse.data.items[0];

    const channelResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels`,
      {
        params: {
          part: 'snippet',
          id: videoData.snippet.channelId,
          key: apiKey,
        },
      }
    );

    if (!channelResponse.data.items?.length) return null;

    const channelData: YouTubeChannelData = channelResponse.data.items[0];

    // Convert duration from ISO 8601 to minutes
    const duration = parseDuration(
      videoData.contentDetails?.duration || 'PT0S'
    );

    const video: MediaDocument = {
      contentId: videoData.id,
      title: {
        contentTitleNative: videoData.snippet.title,
        contentTitleEnglish: videoData.snippet.title,
      },
      contentImage:
        videoData.snippet.thumbnails.high?.url ||
        videoData.snippet.thumbnails.medium?.url,
      description: [
        { description: videoData.snippet.description || '', language: 'eng' },
      ],
      type: 'video',
      episodeDuration: duration,
      isAdult: false,
    };

    const channel: MediaDocument = {
      contentId: channelData.id,
      title: {
        contentTitleNative: channelData.snippet.title,
        contentTitleEnglish: channelData.snippet.title,
      },
      contentImage:
        channelData.snippet.thumbnails.high?.url ||
        channelData.snippet.thumbnails.medium?.url,
      description: [
        { description: channelData.snippet.description || '', language: 'eng' },
      ],
      type: 'video',
      isAdult: false,
    };

    return { video, channel };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Error in getYouTubeVideoInfo:', error.response?.data);
    } else {
      console.error('❌ Error in getYouTubeVideoInfo:', error);
    }
    return null;
  }
}

export async function getYouTubeChannelInfo(
  channelId: string
): Promise<MediaDocument | null> {
  try {
    if (!channelId) return null;

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    const channelResponse = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels',
      {
        params: {
          part: 'snippet',
          id: channelId,
          key: apiKey,
        },
      }
    );

    if (!channelResponse.data.items?.length) return null;

    const channelData: YouTubeChannelData = channelResponse.data.items[0];

    return {
      contentId: channelData.id,
      title: {
        contentTitleNative: channelData.snippet.title,
        contentTitleEnglish: channelData.snippet.title,
      },
      contentImage:
        channelData.snippet.thumbnails.high?.url ||
        channelData.snippet.thumbnails.medium?.url,
      description: [
        {
          description: channelData.snippet.description || '',
          language: 'eng',
        },
      ],
      type: 'video',
      isAdult: false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Error in getYouTubeChannelInfo:', error.response?.data);
    } else {
      console.error('❌ Error in getYouTubeChannelInfo:', error);
    }
    return null;
  }
}

function extractVideoId(url: string): string | null {
  const normalizeVideoId = (
    value: string | null | undefined
  ): string | null => {
    if (!value) return null;
    const cleaned = value.trim();
    return /^[A-Za-z0-9_-]{11}$/.test(cleaned) ? cleaned : null;
  };

  const parseFromUrl = (input: string): string | null => {
    try {
      const parsed = new URL(
        input.startsWith('http://') || input.startsWith('https://')
          ? input
          : `https://${input}`
      );

      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const pathSegments = parsed.pathname.split('/').filter(Boolean);

      if (host === 'youtu.be') {
        return normalizeVideoId(pathSegments[0]);
      }

      if (host.endsWith('youtube.com')) {
        if (parsed.pathname === '/watch') {
          return normalizeVideoId(parsed.searchParams.get('v'));
        }

        if (
          pathSegments[0] === 'live' ||
          pathSegments[0] === 'shorts' ||
          pathSegments[0] === 'embed' ||
          pathSegments[0] === 'v'
        ) {
          return normalizeVideoId(pathSegments[1]);
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  const parsedId = parseFromUrl(url);
  if (parsedId) return parsedId;

  const fallbackRegex =
    /(?:youtube\.com\/(?:watch\?[^\s]*v=|live\/|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
  const match = url.match(fallbackRegex);
  return normalizeVideoId(match?.[1]);
}

function parseDuration(duration: string): number {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = duration.match(regex);

  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 60 + minutes + Math.round(seconds / 60);
}

export async function searchYouTubeVideo(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL is required' });
    }

    const result = await getYouTubeVideoInfo(url);

    if (!result) {
      return res.status(404).json({ message: 'Video not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

// ─── Playlist support ────────────────────────────────────────────────────────

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `https://${url}`
    );
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isYouTubeHost = host.endsWith('youtube.com') || host === 'youtu.be';
    if (!isYouTubeHost) return null;

    // Dedicated playlist page or shared video URL with a list= query param.
    const list = parsed.searchParams.get('list');
    if (list && list.length > 2) return list;
  } catch {
    // ignore parse errors
  }
  return null;
}

const PLAYLIST_MAX_VIDEOS = 200;

export async function getYouTubePlaylistInfo(playlistId: string): Promise<{
  playlistTitle: string;
  truncated: boolean;
  videos: Array<{ video: MediaDocument; channel: MediaDocument }>;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube API key not configured');

  // Step 1 — collect video IDs from playlistItems (paginated, max 200)
  const videoIds: string[] = [];
  const channelIdsByVideoId = new Map<string, string>();
  let pageToken: string | undefined;
  let playlistTitle = '';
  let truncated = false;

  do {
    const params: Record<string, string | number> = {
      part: 'snippet',
      playlistId,
      maxResults: 50,
      key: apiKey,
    };
    if (pageToken) params.pageToken = pageToken;

    const itemsRes = await axios.get(
      'https://www.googleapis.com/youtube/v3/playlistItems',
      { params }
    );

    const items = itemsRes.data.items ?? [];
    if (!playlistTitle && itemsRes.data.pageInfo) {
      // Get the playlist title from the first page
      const firstItem = items[0];
      if (firstItem?.snippet?.playlistId) {
        // We'll fetch the playlist title separately below
      }
    }

    for (const item of items) {
      const videoId: string | undefined = item.snippet?.resourceId?.videoId;
      const channelId: string | undefined = item.snippet?.channelId;
      if (videoId) {
        if (videoIds.length >= PLAYLIST_MAX_VIDEOS) {
          truncated = true;
          break;
        }
        videoIds.push(videoId);
        if (channelId) channelIdsByVideoId.set(videoId, channelId);
      }
    }

    pageToken = truncated
      ? undefined
      : (itemsRes.data.nextPageToken as string | undefined);
  } while (pageToken);

  if (videoIds.length === 0) return null;

  // Step 2 — fetch playlist snippet for title
  try {
    const plRes = await axios.get(
      'https://www.googleapis.com/youtube/v3/playlists',
      { params: { part: 'snippet', id: playlistId, key: apiKey } }
    );
    playlistTitle = plRes.data.items?.[0]?.snippet?.title ?? 'YouTube Playlist';
  } catch {
    playlistTitle = 'YouTube Playlist';
  }

  // Step 3 — batch fetch video details (snippet + contentDetails) in groups of 50
  const videoDetails = new Map<string, YouTubeVideoData>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const vRes = await axios.get(
      'https://www.googleapis.com/youtube/v3/videos',
      {
        params: {
          part: 'snippet,contentDetails',
          id: batch.join(','),
          key: apiKey,
        },
      }
    );
    for (const item of vRes.data.items ?? []) {
      videoDetails.set(item.id, item);
    }
  }

  // Step 4 — batch fetch unique channel details
  const uniqueChannelIds = [...new Set(channelIdsByVideoId.values())];
  const channelDetails = new Map<string, YouTubeChannelData>();
  for (let i = 0; i < uniqueChannelIds.length; i += 50) {
    const batch = uniqueChannelIds.slice(i, i + 50);
    const cRes = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels',
      { params: { part: 'snippet', id: batch.join(','), key: apiKey } }
    );
    for (const item of cRes.data.items ?? []) {
      channelDetails.set(item.id, item);
    }
  }

  // Step 5 — assemble result
  const videos: Array<{ video: MediaDocument; channel: MediaDocument }> = [];

  for (const videoId of videoIds) {
    const vd = videoDetails.get(videoId);
    if (!vd) continue;

    const duration = parseDuration(vd.contentDetails?.duration ?? 'PT0S');
    const channelId = vd.snippet.channelId;
    const cd = channelDetails.get(channelId);

    const video: MediaDocument = {
      contentId: vd.id,
      title: {
        contentTitleNative: vd.snippet.title,
        contentTitleEnglish: vd.snippet.title,
      },
      contentImage:
        vd.snippet.thumbnails?.high?.url ?? vd.snippet.thumbnails?.medium?.url,
      description: [
        { description: vd.snippet.description ?? '', language: 'eng' },
      ],
      type: 'video',
      episodeDuration: duration,
      isAdult: false,
    };

    const channel: MediaDocument = cd
      ? {
          contentId: cd.id,
          title: {
            contentTitleNative: cd.snippet.title,
            contentTitleEnglish: cd.snippet.title,
          },
          contentImage:
            cd.snippet.thumbnails?.high?.url ??
            cd.snippet.thumbnails?.medium?.url,
          description: [
            { description: cd.snippet.description ?? '', language: 'eng' },
          ],
          type: 'video',
          isAdult: false,
        }
      : {
          contentId: channelId,
          title: {
            contentTitleNative: vd.snippet.channelTitle,
            contentTitleEnglish: vd.snippet.channelTitle,
          },
          contentImage: undefined,
          description: [],
          type: 'video',
          isAdult: false,
        };

    videos.push({ video, channel });
  }

  return { playlistTitle, truncated, videos };
}

export async function searchYouTubePlaylist(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL is required' });
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return res
        .status(400)
        .json({ message: 'Not a valid YouTube playlist URL' });
    }

    const result = await getYouTubePlaylistInfo(playlistId);
    if (!result) {
      return res
        .status(404)
        .json({ message: 'Playlist not found or is empty' });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}
