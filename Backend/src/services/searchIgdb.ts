import axios from 'axios';
import { IMediaDocument } from '../types.js';
import {
  hasJapaneseLanguageMetadata,
  hasJapaneseTextHeuristic,
  isMainGameCategory,
} from './igdbFilterPolicy.js';

const IGDB_API_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set');
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const response = await axios.post(TWITCH_TOKEN_URL, null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    },
  });

  cachedToken = {
    accessToken: response.data.access_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

function buildImageUrl(imageId: string, size: string = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

interface IgdbGame {
  id: number;
  name: string;
  category?: number;
  language_supports?: Array<{ language?: { locale?: string; name?: string } }>;
  cover?: { image_id: string };
  alternative_names?: Array<{ name: string; comment?: string }>;
  summary?: string;
  platforms?: Array<{ name: string }>;
  genres?: Array<{ name: string }>;
  screenshots?: Array<{ image_id: string }>;
}

function isJapaneseGame(game: IgdbGame): boolean {
  const supportLabels =
    game.language_supports?.flatMap((support) => {
      const locale = support.language?.locale || null;
      const name = support.language?.name || null;
      return [locale, name];
    }) || [];

  if (supportLabels.length > 0) {
    return hasJapaneseLanguageMetadata(supportLabels);
  }

  return (
    hasJapaneseTextHeuristic(game.name) ||
    (game.alternative_names || []).some(
      (alt) =>
        hasJapaneseTextHeuristic(alt.name) ||
        hasJapaneseTextHeuristic(alt.comment)
    )
  );
}

function normalizeGame(game: IgdbGame): IMediaDocument | null {
  if (!isMainGameCategory(game.category ?? null)) {
    return null;
  }

  if (!isJapaneseGame(game)) {
    return null;
  }

  // Try to find Japanese name from alternative_names
  const japaneseName = game.alternative_names?.find(
    (alt) => hasJapaneseTextHeuristic(alt.name) || hasJapaneseTextHeuristic(alt.comment)
  );

  return {
    contentId: `igdb-${game.id}`,
    title: {
      contentTitleNative: japaneseName?.name || game.name,
      contentTitleEnglish: game.name,
    },
    contentImage: game.cover ? buildImageUrl(game.cover.image_id) : undefined,
    coverImage: game.screenshots?.[0]
      ? buildImageUrl(game.screenshots[0].image_id, '720p')
      : undefined,
    description: game.summary
      ? [{ description: game.summary, language: 'eng' as const }]
      : undefined,
    type: 'game',
    igdbId: game.id,
    platforms: game.platforms?.map((platform) => platform.name) || [],
    genres: game.genres?.map((g) => g.name) || [],
    synonyms: game.alternative_names?.map((alt) => alt.name) || [],
    isAdult: false,
  } as IMediaDocument;
}

export async function searchIgdb(query: string): Promise<IMediaDocument[]> {
  try {
    const accessToken = await getAccessToken();
    const clientId = process.env.IGDB_CLIENT_ID!;

    const response = await axios.post<IgdbGame[]>(
      `${IGDB_API_URL}/games`,
      `search "${query.replace(/"/g, '\\"')}";
fields name, category, cover.image_id, alternative_names.name, alternative_names.comment, summary, platforms.name, genres.name, screenshots.image_id, language_supports.language.locale, language_supports.language.name;
limit 10;`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'text/plain',
        },
      }
    );

    if (!response.data || response.data.length === 0) return [];

    return response.data
      .map(normalizeGame)
      .filter((item): item is IMediaDocument => item !== null);
  } catch (error) {
    console.error('IGDB search error:', error);
    return [];
  }
}

export async function getIgdbGame(
  igdbId: number
): Promise<IMediaDocument | null> {
  try {
    const accessToken = await getAccessToken();
    const clientId = process.env.IGDB_CLIENT_ID!;

    const response = await axios.post<IgdbGame[]>(
      `${IGDB_API_URL}/games`,
      `where id = ${igdbId};
fields name, category, cover.image_id, alternative_names.name, alternative_names.comment, summary, platforms.name, genres.name, screenshots.image_id, language_supports.language.locale, language_supports.language.name;
limit 1;`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'text/plain',
        },
      }
    );

    if (!response.data || response.data.length === 0) return null;

    return normalizeGame(response.data[0]);
  } catch (error) {
    console.error('IGDB get game error:', error);
    return null;
  }
}
