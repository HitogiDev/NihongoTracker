import axios from 'axios';
import type { Readable } from 'stream';

const IGDB_API_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export interface IIgdbDumpListItem {
  endpoint: string;
  file_name: string;
  updated_at: number;
}

export interface IIgdbDumpDetails {
  s3_url: string;
  endpoint: string;
  file_name: string;
  size_bytes: number;
  updated_at: number;
  schema_version: string;
  schema?: Record<string, string>;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set');
  }

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

async function getIgdbAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const clientId = process.env.IGDB_CLIENT_ID;

  if (!clientId) {
    throw new Error('IGDB_CLIENT_ID must be set');
  }

  return {
    'Client-ID': clientId,
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function getIgdbDumpList(): Promise<IIgdbDumpListItem[]> {
  const headers = await getIgdbAuthHeaders();
  const response = await axios.get<IIgdbDumpListItem[]>(
    `${IGDB_API_URL}/dumps`,
    {
      headers,
    }
  );

  return response.data;
}

export async function getIgdbDumpDetails(
  endpoint: string
): Promise<IIgdbDumpDetails> {
  const headers = await getIgdbAuthHeaders();
  const response = await axios.get<IIgdbDumpDetails>(
    `${IGDB_API_URL}/dumps/${endpoint}`,
    {
      headers,
    }
  );

  return response.data;
}

export async function getIgdbDumpStream(s3Url: string): Promise<Readable> {
  const response = await axios.get(s3Url, {
    responseType: 'stream',
    timeout: 120000,
  });

  return response.data as Readable;
}
