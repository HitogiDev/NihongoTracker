import { MeiliSearch } from 'meilisearch';
import { customError } from '../../middlewares/errorMiddleware.js';

const host = process.env.MEILISEARCH_HOST;
const apiKey = process.env.MEILISEARCH_API_KEY;

if (!host)
  throw new customError('MeiliSearch host environment variable not set', 500);

if (!apiKey)
  throw new customError(
    'MeiliSearch api key environment variable not set',
    500
  );

const client = new MeiliSearch({
  host,
  apiKey,
});

console.log('📄 MeiliSearch client initialized');

export default client;
