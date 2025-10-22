import { Request, Response } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import Tag from '../models/tag.model.js';
import { Types } from 'mongoose';

// @desc    Get all tags for a user
// @route   GET /api/tags
// @access  Private
export async function getUserTags(_req: Request, res: Response) {
  try {
    const userId = res.locals.user._id;

    const tags = await Tag.find({ user: userId }).sort({ name: 1 });

    res.json(tags);
  } catch (error) {
    throw new customError((error as Error).message, 500);
  }
}

// @desc    Create a new tag
// @route   POST /api/tags
// @access  Private
export async function createTag(req: Request, res: Response) {
  try {
    const userId = res.locals.user._id;
    const user = res.locals.user;
    const { name, color } = req.body;

    if (!name || !color) {
      throw new customError('Name and color are required', 400);
    }

    // Check if user already has a tag with this name
    const existingTag = await Tag.findOne({ user: userId, name });
    if (existingTag) {
      throw new customError('A tag with this name already exists', 400);
    }

    // Determine tag limit based on Patreon tier
    let maxTags = 3; // Default for non-patrons
    const patreonTier = user.patreon?.tier;

    if (patreonTier === 'consumer') {
      maxTags = 25;
    } else if (patreonTier === 'enthusiast') {
      maxTags = 15;
    } else if (patreonTier === 'donator') {
      maxTags = 7;
    }

    // Check tag limit
    const tagCount = await Tag.countDocuments({ user: userId });
    if (tagCount >= maxTags) {
      throw new customError(
        `You can only create up to ${maxTags} tags${patreonTier ? ' with your current tier' : '. Upgrade to Patreon for more tags'}`,
        400
      );
    }

    const tag = await Tag.create({
      user: userId,
      name: name.trim(),
      color,
    });

    res.status(201).json(tag);
  } catch (error) {
    throw new customError((error as Error).message, 500);
  }
}

// @desc    Update a tag
// @route   PATCH /api/tags/:id
// @access  Private
export async function updateTag(req: Request, res: Response) {
  try {
    const userId = res.locals.user._id;
    const { id } = req.params;
    const { name, color } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      throw new customError('Invalid tag ID', 400);
    }

    const tag = await Tag.findOne({ _id: id, user: userId });
    if (!tag) {
      throw new customError('Tag not found', 404);
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({ user: userId, name });
      if (existingTag) {
        throw new customError('A tag with this name already exists', 400);
      }
      tag.name = name.trim();
    }

    if (color) {
      tag.color = color;
    }

    await tag.save();

    res.json(tag);
  } catch (error) {
    throw new customError((error as Error).message, 500);
  }
}

// @desc    Delete a tag
// @route   DELETE /api/tags/:id
// @access  Private
export async function deleteTag(req: Request, res: Response) {
  try {
    const userId = res.locals.user._id;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new customError('Invalid tag ID', 400);
    }

    const tag = await Tag.findOne({ _id: id, user: userId });
    if (!tag) {
      throw new customError('Tag not found', 404);
    }

    await tag.deleteOne();

    // Note: We don't automatically remove this tag from logs
    // The frontend should handle this or we could add a cleanup job

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    throw new customError((error as Error).message, 500);
  }
}
