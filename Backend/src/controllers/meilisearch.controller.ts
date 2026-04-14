import { Request, Response, NextFunction } from 'express';
import {
  clearIndex,
  deleteIndex,
  listIndexes,
  updateIndexSettings,
} from '../services/meilisearch/meiliSearch.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  forceSyncAllUsers,
  initUsersIndex,
} from '../services/meilisearch/userIndex.js';
import {
  initMediaIndexes,
  forceSyncAllMedia,
} from '../services/meilisearch/mediaIndex.js';

const MEILI_USERS_INDEX = 'users';
const MEILI_MEDIA_INDEXES = [
  'anime',
  'manga',
  'reading',
  'vn',
  'movie',
  'tv_show',
  'game',
] as const;

function shouldRebuildIndexes(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return false;
}

export async function getMeiliSearchIndexes(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const response = await listIndexes();

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
}

export async function deleteMeiliSearchIndex(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { indexName } = req.params;
  try {
    await deleteIndex(indexName);
    res
      .status(200)
      .json({ message: `Index ${indexName} deleted successfully.` });
  } catch (error) {
    return next(
      new customError(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    );
  }
}

export async function updateMeiliSearchIndexSettings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { indexName } = req.params;
  const settings = req.body;
  try {
    const response = await updateIndexSettings(indexName, settings);
    res.status(200).json({
      message: `Index ${indexName} settings updated successfully.`,
      response,
    });
  } catch (error) {
    return next(
      new customError(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    );
  }
}

export async function syncMeiliSearchIndexes(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rebuild = shouldRebuildIndexes(req.body?.rebuild);

    await Promise.all([initUsersIndex(), initMediaIndexes()]);

    if (rebuild) {
      const indexesToClear = [MEILI_USERS_INDEX, ...MEILI_MEDIA_INDEXES];

      await Promise.all(
        indexesToClear.map(async (indexName) => {
          try {
            await clearIndex(indexName);
          } catch (error) {
            console.warn(
              `Failed to clear Meilisearch index ${indexName}:`,
              error
            );
          }
        })
      );
    }

    const [userCount, mediaCount] = await Promise.all([
      forceSyncAllUsers(),
      forceSyncAllMedia(),
    ]);

    return res.status(200).json({
      message: rebuild
        ? 'Meilisearch indexes rebuilt successfully'
        : 'Meilisearch sync completed successfully',
      rebuild,
      users: userCount,
      media: mediaCount,
    });
  } catch (error) {
    return next(
      new customError(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    );
  }
}
