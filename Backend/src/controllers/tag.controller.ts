import { Request, Response } from 'express';
import { apiError } from '../i18n/errorCodes.js';
import Tag from '../models/tag.model.js';
import User from '../models/user.model.js';
import { Types } from 'mongoose';

// @desc    Get all tags for a user by username
// @route   GET /api/tags/user/:username
// @access  Public
export async function getUserTagsByUsername(req: Request, res: Response) {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
      throw apiError('user.notFound', 404, 'User not found');
    }

    const tags = await Tag.find({ user: user._id }).sort({ name: 1 });

    res.json(tags);
  } catch (error) {
    throw apiError('common.internal', 500, (error as Error).message);
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
      throw apiError('tag.fieldsRequired', 400, 'Name and color are required');
    }

    // Check if user already has a tag with this name
    const existingTag = await Tag.findOne({ user: userId, name });
    if (existingTag) {
      throw apiError('tag.nameExists', 400, 'A tag with this name already exists');
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
      throw apiError(
        patreonTier ? 'tag.limitReachedTier' : 'tag.limitReached',
        400,
        `You can only create up to ${maxTags} tags${patreonTier ? ' with your current tier' : '. Upgrade to Patreon for more tags'}`,
        { max: maxTags }
      );
    }

    const tag = await Tag.create({
      user: userId,
      name: name.trim(),
      color,
    });

    res.status(201).json(tag);
  } catch (error) {
    throw apiError('common.internal', 500, (error as Error).message);
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
      throw apiError('tag.invalidId', 400, 'Invalid tag ID');
    }

    const tag = await Tag.findOne({ _id: id, user: userId });
    if (!tag) {
      throw apiError('tag.notFound', 404, 'Tag not found');
    }

    // Check if new name conflicts with existing tag
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({ user: userId, name });
      if (existingTag) {
        throw apiError('tag.nameExists', 400, 'A tag with this name already exists');
      }
      tag.name = name.trim();
    }

    if (color) {
      tag.color = color;
    }

    await tag.save();

    res.json(tag);
  } catch (error) {
    throw apiError('common.internal', 500, (error as Error).message);
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
      throw apiError('tag.invalidId', 400, 'Invalid tag ID');
    }

    const tag = await Tag.findOne({ _id: id, user: userId });
    if (!tag) {
      throw apiError('tag.notFound', 404, 'Tag not found');
    }

    await tag.deleteOne();

    // Note: We don't automatically remove this tag from logs
    // The frontend should handle this or we could add a cleanup job

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    throw apiError('common.internal', 500, (error as Error).message);
  }
}
