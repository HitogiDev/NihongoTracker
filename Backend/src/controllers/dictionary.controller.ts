import { NextFunction, Request, Response } from 'express';

import { apiError } from '../i18n/errorCodes.js';
import {
  DictionaryUnavailableError,
  health,
  isDictionaryConfigured,
  licenses,
  lookup,
} from '../services/dictionary/dictionaryClient.js';

/** Matches the service's own cap, so an oversized line fails here rather than there. */
const MAX_TEXT_LENGTH = 4096;

/**
 * Look up whatever is at `offset` in `text`.
 *
 * One offset per request, on purpose: the spike measured 2.62 ms for a single
 * offset against 127 ms average and 555 ms p99 for resolving every offset of a
 * line, so the client asks for the character under the cursor and nothing else.
 * Do not add a "resolve this whole line" endpoint without measuring again.
 */
export async function lookupTerm(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { text, offset, maxResults } = req.body ?? {};

    if (typeof text !== 'string' || text.length === 0) {
      throw apiError('common.validationError', 400, 'text is required');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw apiError('common.validationError', 400, 'text is too long');
    }
    const at = Number.isInteger(offset) ? (offset as number) : 0;
    if (at < 0 || at > text.length) {
      throw apiError('common.validationError', 400, 'offset is out of range');
    }

    const result = await lookup(text, at, maxResults);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof DictionaryUnavailableError) {
      // 503 and not 500: the request was fine, the dependency is not. The
      // client hides the popup and the texthooker carries on.
      return next(
        apiError('dictionary.unavailable', 503, error.message)
      );
    }
    return next(error as Error);
  }
}

/**
 * Whether lookups are worth attempting, and what is loaded.
 *
 * The frontend asks once and hides the whole feature when it is not, rather
 * than letting every hover discover the outage for itself.
 */
export async function getStatus(_req: Request, res: Response) {
  if (!isDictionaryConfigured()) {
    return res.status(200).json({ available: false, dictionaries: [] });
  }

  try {
    const status = await health();
    return res.status(200).json({
      available: status.ready,
      dictionaries: status.dictionaries.map((entry) => entry.name),
    });
  } catch {
    // Unavailable is a normal state here, not an error to report.
    return res.status(200).json({ available: false, dictionaries: [] });
  }
}

/**
 * Attribution for the loaded dictionaries.
 *
 * Jitendex is CC BY-SA 4.0 over JMdict and Tatoeba. Serving its content from
 * our own product makes crediting them our obligation rather than the user's,
 * so this endpoint is what the popup and the licences page read.
 */
export async function getLicenses(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.status(200).json(await licenses());
  } catch (error) {
    if (error instanceof DictionaryUnavailableError) {
      return next(apiError('dictionary.unavailable', 503, error.message));
    }
    return next(error as Error);
  }
}
