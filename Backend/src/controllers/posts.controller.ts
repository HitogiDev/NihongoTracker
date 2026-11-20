import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { isFeatureEnabled } from '../services/featureFlags.service.js';
import { notifyMentionedUsers } from '../services/mentions.service.js';
import {
  createPost,
  deletePost,
  parseBooleanField,
  parseExternalImageUrls,
  parsePostContent,
  parsePostVisibility,
  parseStringListField,
  PostInput,
  updatePost,
} from '../services/posts.service.js';
import { parsePostDecorationInput } from '../services/postDecoration.js';
import { downloadPostImage } from '../services/remoteImage.js';
import { canViewActivity } from '../services/socialVisibility.service.js';
import { IActivity, IPost, userRoles } from '../types.js';

function parsePostId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw apiError('post.notFound', 404, 'Post not found');
  }
  return new Types.ObjectId(value);
}

function isAdmin(res: Response): boolean {
  return Boolean(res.locals.user?.roles?.includes(userRoles.admin));
}

/** Admins can use posts before the feature flag is on. */
export async function requirePostsEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isAdmin(res) && !(await isFeatureEnabled('posts'))) {
      throw apiError('post.disabled', 403, 'Posts are not available yet');
    }
    return next();
  } catch (error) {
    return next(error as customError);
  }
}

type PostFiles = Partial<Record<'images' | 'backgroundImage', Express.Multer.File[]>>;

function readPostInput(req: Request): PostInput {
  const files = (req.files ?? {}) as PostFiles;
  return {
    content: parsePostContent(req.body?.content),
    visibility: parsePostVisibility(req.body?.visibility),
    sensitive: parseBooleanField(req.body?.sensitive),
    externalUrls: parseExternalImageUrls(req.body?.externalImages),
    files: files.images ?? [],
    decoration: parsePostDecorationInput(req.body?.decoration),
    backgroundFile: files.backgroundImage?.[0],
  };
}

async function notifyPostMentions(input: {
  post: Pick<IPost, '_id' | 'content'>;
  activity: Pick<IActivity, '_id' | 'actor' | 'visibility'> | null;
  previousContent?: string;
  actor: { _id: Types.ObjectId; username: string; avatar?: string };
}) {
  const { activity } = input;
  if (!activity || !input.post.content) return;
  await notifyMentionedUsers({
    content: input.post.content,
    previousContent: input.previousContent,
    actor: input.actor,
    entityType: 'post',
    entityId: String(input.post._id),
    link: `/?feed=following&activity=${String(activity._id)}`,
    title: `${input.actor.username} mentioned you in a post`,
    titleKey: 'social.mentionedInPost',
    body: input.post.content,
    canView: (userId) => canViewActivity(activity, userId),
  });
}

export async function createPostHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { post, activity } = await createPost(
      res.locals.user,
      readPostInput(req)
    );
    await notifyPostMentions({ post, activity, actor: res.locals.user });
    return res.status(201).json({ post, activityId: String(activity._id) });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updatePostHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const postId = parsePostId(req.params.postId);
    const { post, activity, previousContent } = await updatePost(
      postId,
      res.locals.user,
      {
        ...readPostInput(req),
        keepImageIds: parseStringListField(req.body?.keepImageIds),
      }
    );
    await notifyPostMentions({
      post,
      activity,
      previousContent,
      actor: res.locals.user,
    });
    return res.status(200).json({ post });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deletePostHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const postId = parsePostId(req.params.postId);
    const roles = res.locals.user.roles ?? [];
    const canModerate =
      roles.includes(userRoles.admin) || roles.includes(userRoles.mod);
    await deletePost(postId, res.locals.user._id, canModerate);
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * Serve external post images from this origin.
 * Viewers never send requests to the external host, so it cannot see their IP address.
 */
export async function getPostImage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { url } = req.query;
    if (typeof url !== 'string' || !url) {
      throw apiError('post.invalidImageUrl', 400, 'Image URL is required');
    }
    const image = await downloadPostImage(url);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(image);
  } catch (error) {
    return next(error as customError);
  }
}
