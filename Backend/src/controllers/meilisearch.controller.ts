import { Request, Response, NextFunction } from 'express';
import {
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
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await Promise.all([initUsersIndex(), initMediaIndexes()]);

    const [userCount, mediaCount] = await Promise.all([
      forceSyncAllUsers(),
      forceSyncAllMedia(),
    ]);

    return res.status(200).json({
      message: 'Meilisearch sync started successfully',
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
