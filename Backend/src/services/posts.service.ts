import { Types } from 'mongoose';
import Activity from '../models/activity.model.js';
import Post, {
  POST_CONTENT_MAX_LENGTH,
  POST_IMAGES_MAX,
} from '../models/post.model.js';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  IActivity,
  IPost,
  IPostDecoration,
  IPostImage,
  IUser,
  SOCIAL_VISIBILITIES,
  SocialVisibility,
} from '../types.js';
import { deleteActivitiesBySource } from './activity.service.js';
import { removeNotifications } from './notifications.service.js';
import { hasHostedPostImages, hasPostDecorations } from './postImageAccess.js';
import {
  decorationSignature,
  PostDecorationInput,
  storedDecorationSignature,
} from './postDecoration.js';
import { encodePostImageWithInfo, validatePostImageUrl } from './remoteImage.js';
import { deleteFile, FileUploadBatch } from './uploadFile.js';

/** Hosted images that one user can upload in a rolling window. */
export const HOSTED_POST_IMAGE_QUOTA = 120;
export const HOSTED_POST_IMAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const HOSTED_POST_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const HOSTED_POST_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

type PostAuthor = Pick<IUser, 'roles' | 'patreon'> & { _id: Types.ObjectId };

export interface PostInput {
  content: string;
  visibility: SocialVisibility;
  sensitive: boolean;
  externalUrls: string[];
  files: Express.Multer.File[];
  decoration: PostDecorationInput | null;
  backgroundFile?: Express.Multer.File;
}

export function parsePostContent(value: unknown): string {
  const content = typeof value === 'string' ? value.trim() : '';
  if (content.length > POST_CONTENT_MAX_LENGTH) {
    throw apiError(
      'post.contentTooLong',
      400,
      `Posts must be ${POST_CONTENT_MAX_LENGTH} characters or less`,
      { max: POST_CONTENT_MAX_LENGTH }
    );
  }
  return content;
}

export function parsePostVisibility(value: unknown): SocialVisibility {
  if (value === undefined || value === null || value === '') return 'public';
  if (
    typeof value !== 'string' ||
    !(SOCIAL_VISIBILITIES as readonly string[]).includes(value)
  ) {
    throw apiError('privacy.invalidVisibility', 400, 'Invalid visibility');
  }
  return value as SocialVisibility;
}

/** Multipart fields arrive as strings. */
export function parseBooleanField(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Read a list of strings from a JSON string (multipart) or an array (JSON body). */
export function parseStringListField(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw apiError('post.invalidImageList', 400, 'Invalid image list');
    }
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > POST_IMAGES_MAX ||
    !parsed.every((item) => typeof item === 'string')
  ) {
    throw apiError('post.invalidImageList', 400, 'Invalid image list');
  }
  return parsed as string[];
}

export function parseExternalImageUrls(value: unknown): string[] {
  const urls = parseStringListField(value).map((url) => url.trim());
  return [...new Set(urls)].map((url) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw apiError('post.invalidImageUrl', 400, 'Invalid image URL');
    }
    try {
      return validatePostImageUrl(parsed.href).href;
    } catch {
      throw apiError(
        'post.unsupportedImageHost',
        400,
        'Images from this site are not supported',
        { host: parsed.hostname }
      );
    }
  });
}

export function assertPostImageCount(count: number): void {
  if (count > POST_IMAGES_MAX) {
    throw apiError(
      'post.tooManyImages',
      400,
      `A post can have at most ${POST_IMAGES_MAX} images`,
      { max: POST_IMAGES_MAX }
    );
  }
}

export function assertPostNotEmpty(content: string, imageCount: number): void {
  if (!content && imageCount === 0) {
    throw apiError('post.empty', 400, 'Write something or add an image');
  }
}

/** New uploads need an active tier. Hosted images that a post already has stay after a downgrade. */
export function assertHostedUploadAccess(
  author: PostAuthor,
  fileCount: number
): void {
  if (fileCount > 0 && !hasHostedPostImages(author)) {
    throw apiError(
      'post.hostedImagesTierRequired',
      403,
      'Uploading images requires an Enthusiast or Consumer membership'
    );
  }
}

export async function countRecentHostedImages(
  authorId: Types.ObjectId,
  now = new Date()
): Promise<number> {
  const since = new Date(now.getTime() - HOSTED_POST_IMAGE_WINDOW_MS);
  const [result] = await Post.aggregate<{ count: number }>([
    { $match: { author: authorId, 'images.uploadedAt': { $gte: since } } },
    { $unwind: '$images' },
    {
      $match: {
        'images.source': 'hosted',
        'images.uploadedAt': { $gte: since },
      },
    },
    { $count: 'count' },
  ]);
  const backgrounds = await Post.countDocuments({
    author: authorId,
    'decoration.background.image.source': 'hosted',
    'decoration.background.image.uploadedAt': { $gte: since },
  });
  return (result?.count ?? 0) + backgrounds;
}

async function assertHostedQuota(
  authorId: Types.ObjectId,
  fileCount: number
): Promise<void> {
  if (fileCount === 0) return;
  const used = await countRecentHostedImages(authorId);
  if (used + fileCount > HOSTED_POST_IMAGE_QUOTA) {
    throw apiError(
      'post.hostedImageQuota',
      429,
      `You can upload ${HOSTED_POST_IMAGE_QUOTA} images every 30 days`,
      {
        max: HOSTED_POST_IMAGE_QUOTA,
        remaining: Math.max(0, HOSTED_POST_IMAGE_QUOTA - used),
      }
    );
  }
}

function validateHostedFile(file: Express.Multer.File): void {
  if (!HOSTED_POST_IMAGE_TYPES.includes(file.mimetype)) {
    throw apiError(
      'post.invalidImage',
      400,
      'Only JPEG, PNG, WebP, and GIF images are allowed'
    );
  }
  if (file.size > HOSTED_POST_IMAGE_MAX_BYTES) {
    throw apiError('post.imageTooLarge', 400, 'Images must be 8 MB or less', {
      max: 8,
    });
  }
}

async function uploadHostedImages(
  files: Express.Multer.File[],
  uploads: FileUploadBatch
): Promise<Omit<IPostImage, '_id'>[]> {
  files.forEach(validateHostedFile);
  const uploadedAt = new Date();
  const images: Omit<IPostImage, '_id'>[] = [];
  for (const file of files) {
    let encoded: Awaited<ReturnType<typeof encodePostImageWithInfo>>;
    try {
      encoded = await encodePostImageWithInfo(file.buffer);
    } catch (error) {
      if (error instanceof customError && error.statusCode === 413) {
        throw apiError('post.imageTooLarge', 400, 'Image is too large', {
          max: 8,
        });
      }
      throw apiError('post.invalidImage', 400, 'Invalid image');
    }
    const uploaded = await uploads.upload(
      {
        ...file,
        fieldname: 'postImage',
        mimetype: 'image/webp',
        buffer: encoded.data,
        size: encoded.data.length,
      },
      undefined,
      {
        allowedMimeTypes: ['image/webp'],
        maxFileSizeBytes: HOSTED_POST_IMAGE_MAX_BYTES,
      }
    );
    images.push({
      url: uploaded.downloadURL,
      source: 'hosted',
      width: encoded.width,
      height: encoded.height,
      uploadedAt,
    });
  }
  return images;
}

const UPLOAD_KEY = 'upload';

/** The new background image source: an upload, an external link, the current image, or none. */
function backgroundImageKey(
  input: PostDecorationInput | null,
  backgroundFile: Express.Multer.File | undefined,
  current: IPostDecoration | null | undefined
): string | null {
  if (!input || input.background.type !== 'image') return null;
  if (backgroundFile) return UPLOAD_KEY;
  if (input.background.imageUrl) return input.background.imageUrl;
  if (input.background.keepImage) return current?.background.image?.url ?? null;
  return null;
}

/**
 * Check a decoration change before any upload.
 * Users without access can keep the current decoration unchanged after a downgrade.
 */
export function assertDecorationAllowed(
  author: PostAuthor,
  input: PostDecorationInput | null,
  backgroundFile: Express.Multer.File | undefined,
  current: IPostDecoration | null | undefined
): void {
  const imageKey = backgroundImageKey(input, backgroundFile, current);
  if (input?.background.type === 'image' && !imageKey) {
    throw apiError(
      'post.decorationImageRequired',
      400,
      'Choose a background image'
    );
  }
  if (hasPostDecorations(author)) return;
  const next = input
    ? decorationSignature({
        border: input.border,
        background: { ...input.background, imageKey },
      })
    : 'none';
  if (next !== storedDecorationSignature(current)) {
    throw apiError(
      'post.decorationTierRequired',
      403,
      'Post decorations require an Enthusiast or Consumer membership'
    );
  }
}

function usesBackgroundUpload(input: PostInput): boolean {
  return Boolean(
    input.backgroundFile && input.decoration?.background.type === 'image'
  );
}

async function resolveDecoration(
  input: PostInput,
  current: IPostDecoration | null | undefined,
  uploads: FileUploadBatch
): Promise<IPostDecoration | null> {
  const { decoration } = input;
  let image: IPostDecoration['background']['image'] = null;
  if (decoration?.background.type === 'image') {
    const currentImage = current?.background.image ?? null;
    if (input.backgroundFile) {
      const [uploaded] = await uploadHostedImages([input.backgroundFile], uploads);
      image = {
        url: uploaded.url,
        source: 'hosted',
        uploadedAt: uploaded.uploadedAt,
      };
    } else if (
      decoration.background.imageUrl &&
      decoration.background.imageUrl !== currentImage?.url
    ) {
      image = { url: decoration.background.imageUrl, source: 'external' };
    } else if (currentImage) {
      image = {
        url: currentImage.url,
        source: currentImage.source,
        uploadedAt: currentImage.uploadedAt,
      };
    }
  }
  const currentImage = current?.background.image;
  if (currentImage?.source === 'hosted' && currentImage.url !== image?.url) {
    uploads.remove(currentImage.url);
  }
  if (!decoration) return null;
  const { imageUrl: _imageUrl, keepImage: _keepImage, ...background } =
    decoration.background;
  return { border: decoration.border, background: { ...background, image } };
}

function decorationMetadata(
  decoration: IPostDecoration | null | undefined
): Record<string, unknown> | null {
  if (!decoration) return null;
  const { border, background } = decoration;
  return {
    border: {
      style: border.style,
      color1: border.color1,
      color2: border.color2,
    },
    background: {
      type: background.type,
      color: background.color,
      pattern: background.pattern,
      patternColor: background.patternColor,
      opacity: background.opacity,
      image: background.image
        ? { url: background.image.url, source: background.image.source }
        : null,
    },
  };
}

export function buildPostActivityMetadata(
  post: Pick<
    IPost,
    '_id' | 'content' | 'images' | 'sensitive' | 'editedAt' | 'decoration'
  >
): Record<string, unknown> {
  return {
    postId: String(post._id),
    content: post.content,
    sensitive: post.sensitive,
    decoration: decorationMetadata(post.decoration),
    editedAt: post.editedAt ?? null,
    images: post.images.map((image) => ({
      _id: String(image._id),
      url: image.url,
      source: image.source,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
    })),
  };
}

export async function createPost(author: PostAuthor, input: PostInput) {
  const imageCount = input.externalUrls.length + input.files.length;
  assertPostImageCount(imageCount);
  assertPostNotEmpty(input.content, imageCount);
  assertHostedUploadAccess(author, input.files.length);
  assertDecorationAllowed(author, input.decoration, input.backgroundFile, null);
  await assertHostedQuota(
    author._id,
    input.files.length + (usesBackgroundUpload(input) ? 1 : 0)
  );

  const uploads = new FileUploadBatch();
  let post: IPost | null = null;
  try {
    const hostedImages = await uploadHostedImages(input.files, uploads);
    const decoration = await resolveDecoration(input, null, uploads);
    post = await Post.create({
      author: author._id,
      content: input.content,
      visibility: input.visibility,
      sensitive: input.sensitive,
      decoration,
      images: [
        ...input.externalUrls.map((url) => ({ url, source: 'external' })),
        ...hostedImages,
      ],
    });
    const activity = await Activity.create({
      actor: author._id,
      type: 'post',
      targetType: 'post',
      targetId: post._id,
      visibility: post.visibility,
      metadata: buildPostActivityMetadata(post),
      dedupeKey: `post:${String(post._id)}`,
      occurredAt: post.createdAt,
    });
    await uploads.commit();
    return { post, activity };
  } catch (error) {
    if (post) {
      await Post.deleteOne({ _id: post._id }).catch(() => undefined);
    }
    await uploads.rollback();
    throw error;
  }
}

async function requireOwnPost(postId: Types.ObjectId, authorId: Types.ObjectId) {
  const post = await Post.findById(postId);
  if (!post || !post.author.equals(authorId)) {
    throw apiError('post.notFound', 404, 'Post not found');
  }
  return post;
}

export async function updatePost(
  postId: Types.ObjectId,
  author: PostAuthor,
  input: PostInput & { keepImageIds: string[] }
) {
  const post = await requireOwnPost(postId, author._id);
  const keep = new Set(input.keepImageIds);
  const keptImages = post.images.filter((image) => keep.has(String(image._id)));
  const removedImages = post.images.filter(
    (image) => !keep.has(String(image._id))
  );
  const keptExternalUrls = new Set(
    keptImages
      .filter((image) => image.source === 'external')
      .map((image) => image.url)
  );
  const newExternalUrls = input.externalUrls.filter(
    (url) => !keptExternalUrls.has(url)
  );
  const imageCount =
    keptImages.length + newExternalUrls.length + input.files.length;
  assertPostImageCount(imageCount);
  assertPostNotEmpty(input.content, imageCount);
  assertHostedUploadAccess(author, input.files.length);
  assertDecorationAllowed(
    author,
    input.decoration,
    input.backgroundFile,
    post.decoration
  );
  await assertHostedQuota(
    author._id,
    input.files.length + (usesBackgroundUpload(input) ? 1 : 0)
  );

  const previousContent = post.content;
  const uploads = new FileUploadBatch();
  try {
    const hostedImages = await uploadHostedImages(input.files, uploads);
    const decoration = await resolveDecoration(input, post.decoration, uploads);
    removedImages
      .filter((image) => image.source === 'hosted')
      .forEach((image) => uploads.remove(image.url));

    post.set({
      content: input.content,
      visibility: input.visibility,
      sensitive: input.sensitive,
      decoration,
      images: [
        ...keptImages.map((image) => ({
          _id: image._id,
          url: image.url,
          source: image.source,
          width: image.width,
          height: image.height,
          uploadedAt: image.uploadedAt,
        })),
        ...newExternalUrls.map((url) => ({ url, source: 'external' })),
        ...hostedImages,
      ],
      editedAt: new Date(),
    });
    await post.save();
    const activity = await Activity.findOneAndUpdate(
      { targetType: 'post', targetId: post._id },
      {
        $set: {
          visibility: post.visibility,
          metadata: buildPostActivityMetadata(post),
        },
      },
      { new: true }
    );
    await uploads.commit();
    return { post, activity, previousContent };
  } catch (error) {
    await uploads.rollback();
    throw error;
  }
}

function postHostedFiles(
  post: Pick<IPost, 'images' | 'decoration'>
): Pick<IPostImage, 'url' | 'source'>[] {
  const background = post.decoration?.background.image;
  return [...(post.images ?? []), ...(background ? [background] : [])];
}

async function deleteHostedImages(images: Pick<IPostImage, 'url' | 'source'>[]) {
  await Promise.all(
    images
      .filter((image) => image.source === 'hosted')
      .map((image) => deleteFile(image.url))
  );
}

export async function deletePost(
  postId: Types.ObjectId,
  userId: Types.ObjectId,
  canModerate: boolean
): Promise<IPost> {
  const post = await Post.findById(postId);
  if (!post || (!post.author.equals(userId) && !canModerate)) {
    throw apiError('post.notFound', 404, 'Post not found');
  }
  const activity = await Activity.findOne({
    targetType: 'post',
    targetId: post._id,
  })
    .select('_id')
    .lean<Pick<IActivity, '_id'>>();
  await deleteActivitiesBySource('post', [post._id as Types.ObjectId]);
  await post.deleteOne();
  await Promise.all([
    deleteHostedImages(postHostedFiles(post)),
    removeNotifications({ entityType: 'post', entityId: String(post._id) }),
    activity
      ? removeNotifications({
          entityType: 'activity',
          entityId: String(activity._id),
        })
      : Promise.resolve(),
  ]);
  return post;
}

/** Delete every post of a user and its hosted files. Activity rows are removed by the caller. */
export async function deletePostsForUser(userId: Types.ObjectId): Promise<void> {
  const posts = await Post.find({ author: userId })
    .select('images decoration')
    .lean();
  await Post.deleteMany({ author: userId });
  await deleteHostedImages(posts.flatMap((post) => postHostedFiles(post)));
}
