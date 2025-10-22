import { Request, Response, NextFunction } from 'express';
import Changelog from '../models/changelog.model.js';
import { customError } from '../middlewares/errorMiddleware.js';

// Get all published changelogs (public)
export const getChangelogs = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const changelogs = await Changelog.find({ published: true })
      .sort({ date: -1 })
      .select('-__v')
      .populate('createdBy', 'username');

    res.status(200).json({
      success: true,
      data: changelogs,
    });
  } catch (error) {
    return next(error as customError);
  }
};

// Get all changelogs including drafts (admin only)
export const getAllChangelogs = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const changelogs = await Changelog.find()
      .sort({ date: -1 })
      .select('-__v')
      .populate('createdBy', 'username');

    res.status(200).json({
      success: true,
      data: changelogs,
    });
  } catch (error) {
    return next(error as customError);
  }
};

// Get single changelog by ID
export const getChangelog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const changelog = await Changelog.findById(id)
      .select('-__v')
      .populate('createdBy', 'username');

    if (!changelog) {
      const error = new customError('Changelog not found', 404);
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: changelog,
    });
  } catch (error) {
    return next(error as customError);
  }
};

// Create new changelog (admin only)
export const createChangelog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { version, title, description, changes, date, published } = req.body;
    const userId = res.locals.user._id;

    // Validate required fields
    if (!version || !title || !changes || changes.length === 0) {
      const error = new customError(
        'Version, title, and at least one change are required',
        400
      );
      return next(error);
    }

    // Validate change types
    const validTypes = ['feature', 'improvement', 'bugfix', 'breaking'];
    const invalidChanges = changes.filter(
      (change: { type: string }) => !validTypes.includes(change.type)
    );

    if (invalidChanges.length > 0) {
      const error = new customError(
        'Invalid change type. Must be: feature, improvement, bugfix, or breaking',
        400
      );
      return next(error);
    }

    // Check if version already exists
    const existingChangelog = await Changelog.findOne({ version });
    if (existingChangelog) {
      const error = new customError(
        'A changelog with this version already exists',
        409
      );
      return next(error);
    }

    const changelog = await Changelog.create({
      version,
      title,
      description,
      changes,
      date: date || new Date(),
      createdBy: userId,
      published: published || false,
    });

    const populatedChangelog = await Changelog.findById(changelog._id)
      .select('-__v')
      .populate('createdBy', 'username');

    res.status(201).json({
      success: true,
      data: populatedChangelog,
    });
  } catch (error) {
    return next(error as customError);
  }
};

// Update changelog (admin only)
export const updateChangelog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { version, title, description, changes, date, published } = req.body;

    const changelog = await Changelog.findById(id);

    if (!changelog) {
      const error = new customError('Changelog not found', 404);
      return next(error);
    }

    // Validate change types if changes are being updated
    if (changes) {
      const validTypes = ['feature', 'improvement', 'bugfix', 'breaking'];
      const invalidChanges = changes.filter(
        (change: { type: string }) => !validTypes.includes(change.type)
      );

      if (invalidChanges.length > 0) {
        const error = new customError(
          'Invalid change type. Must be: feature, improvement, bugfix, or breaking',
          400
        );
        return next(error);
      }
    }

    // Check if new version conflicts with existing
    if (version && version !== changelog.version) {
      const existingChangelog = await Changelog.findOne({ version });
      if (existingChangelog) {
        const error = new customError(
          'A changelog with this version already exists',
          409
        );
        return next(error);
      }
    }

    // Update fields
    if (version) changelog.version = version;
    if (title) changelog.title = title;
    if (description !== undefined) changelog.description = description;
    if (changes) changelog.changes = changes;
    if (date) changelog.date = date;
    if (published !== undefined) changelog.published = published;

    await changelog.save();

    const populatedChangelog = await Changelog.findById(changelog._id)
      .select('-__v')
      .populate('createdBy', 'username');

    res.status(200).json({
      success: true,
      data: populatedChangelog,
    });
  } catch (error) {
    return next(error as customError);
  }
};

// Delete changelog (admin only)
export const deleteChangelog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const changelog = await Changelog.findById(id);

    if (!changelog) {
      const error = new customError('Changelog not found', 404);
      return next(error);
    }

    await changelog.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Changelog deleted successfully',
    });
  } catch (error) {
    return next(error as customError);
  }
};
