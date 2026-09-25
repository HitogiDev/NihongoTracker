import { MeiliSearch } from 'meilisearch';
import { apiError } from '../../i18n/errorCodes.js';

const host = process.env.MEILISEARCH_HOST;
const apiKey = process.env.MEILISEARCH_API_KEY;

if (!host)
  throw apiError('integration.meiliHostNotSet', 500, 'MeiliSearch host environment variable not set');

if (!apiKey)
  throw apiError(
    'integration.meiliKeyNotSet',
    500,
    'MeiliSearch api key environment variable not set'
  );

const client = new MeiliSearch({
  host,
  apiKey,
});

console.log('📄 MeiliSearch client initialized');

export default client;
