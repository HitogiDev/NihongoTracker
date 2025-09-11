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
    console.log('🔍 Extracting video ID from URL:', videoUrl);
    const videoId = extractVideoId(videoUrl);
    console.log('📹 Extracted video ID:', videoId);

    if (!videoId) {
      console.log('❌ Failed to extract video ID');
      return null;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log('❌ YouTube API key not found');
      throw new Error('YouTube API key not configured');
    }
    console.log('✅ YouTube API key found');

    console.log('🌐 Making YouTube API request for video details...');
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

    console.log('📊 YouTube API response status:', videoResponse.status);
    console.log(
      '📊 Number of video items returned:',
      videoResponse.data.items?.length || 0
    );

    if (!videoResponse.data.items?.length) {
      console.log('❌ No video items found in response');
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

function extractVideoId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
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
    console.log('=== YouTube Search Request ===');
    console.log('Full request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Query parameters:', req.query);
    console.log('URL parameter:', req.query.url);

    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      console.log('❌ URL validation failed:', { url, type: typeof url });
      return res.status(400).json({ message: 'URL is required' });
    }

    console.log('✅ URL validation passed, calling getYouTubeVideoInfo...');
    const result = await getYouTubeVideoInfo(url);

    if (!result) {
      console.log('❌ No result from getYouTubeVideoInfo');
      return res.status(404).json({ message: 'Video not found' });
    }

    console.log('✅ YouTube video found successfully');
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ YouTube search error:', error);
    return next(error as customError);
  }
}
