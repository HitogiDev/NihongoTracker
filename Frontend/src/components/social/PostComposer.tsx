import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Lock, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  createPostFn,
  externalPostImageSrc,
  postImageSrc,
  updatePostFn,
  type PostDecorationPayload,
  type PostFormInput,
} from '../../api/postsApi';
import { PATREON_URL } from '../../constants/supportPlans';
import { useUserDataStore } from '../../store/userData';
import type {
  IPostActivityMetadata,
  IPostDecoration,
  IPostImage,
  SocialVisibility,
} from '../../types';
import {
  type BackgroundImageChoice,
  DEFAULT_POST_DECORATION,
  hasPostDecoration,
} from '../../utils/postDecoration';
import PostDecorationEditor from './PostDecorationEditor';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  canDecoratePosts,
  canUploadPostImages,
  checkExternalImageUrl,
  POST_CONTENT_MAX_LENGTH,
  POST_IMAGES_MAX,
  POST_UPLOAD_MAX_BYTES,
  POST_UPLOAD_TYPES,
} from '../../utils/postAccess';
import Button from '../ui/Button';
import DropdownSelect from '../ui/DropdownSelect';
import Field from '../ui/Field';
import { CommentFormattingToolbar } from './ActivityComments';

function initialDecoration(
  decoration: IPostDecoration | null | undefined,
): IPostDecoration {
  if (!decoration) return DEFAULT_POST_DECORATION;
  return {
    border: { ...DEFAULT_POST_DECORATION.border, ...decoration.border },
    background: {
      ...DEFAULT_POST_DECORATION.background,
      ...decoration.background,
    },
  };
}

function initialBackgroundImage(
  decoration: IPostDecoration | null | undefined,
): BackgroundImageChoice {
  const image = decoration?.background.image;
  return image ? { kind: 'current', image } : { kind: 'none' };
}

function decorationPayload(
  decoration: IPostDecoration,
  image: BackgroundImageChoice,
): PostDecorationPayload | null {
  if (!hasPostDecoration(decoration)) return null;
  const { type, color, pattern, patternColor, opacity } = decoration.background;
  return {
    border: decoration.border,
    background: {
      type,
      color,
      pattern,
      patternColor,
      opacity,
      ...(image.kind === 'link' ? { imageUrl: image.url } : {}),
      ...(image.kind === 'current' ? { keepImage: true } : {}),
    },
  };
}

const VISIBILITIES: SocialVisibility[] = [
  'public',
  'followers',
  'following',
  'private',
];

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface PostComposerProps {
  /** Edit mode when set. */
  post?: IPostActivityMetadata & { visibility: SocialVisibility };
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

function ImageThumb({
  src,
  badge,
  onRemove,
  removeLabel,
}: {
  src: string;
  badge: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <li className="relative aspect-square overflow-hidden rounded-box bg-base-300">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <span className="badge badge-neutral badge-xs absolute bottom-1 left-1">
        {badge}
      </span>
      <Button
        appearance="ghost"
        size="xs"
        shape="circle"
        className="absolute right-1 top-1 bg-base-100/80"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export default function PostComposer({
  post,
  onDone,
  onCancel,
  autoFocus = false,
}: PostComposerProps) {
  const { t } = useTranslation('social');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const user = useUserDataStore((state) => state.user);
  const canUpload = canUploadPostImages(user);
  const canDecorate = canDecoratePosts(user);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(post?.content ?? '');
  const [visibility, setVisibility] = useState<SocialVisibility>(
    post?.visibility ?? 'public',
  );
  const [sensitive, setSensitive] = useState(post?.sensitive ?? false);
  const [keptImages, setKeptImages] = useState<IPostImage[]>(
    post?.images ?? [],
  );
  const [externalImages, setExternalImages] = useState<string[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const [decoration, setDecoration] = useState<IPostDecoration>(() =>
    initialDecoration(post?.decoration),
  );
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImageChoice>(
    () => initialBackgroundImage(post?.decoration),
  );

  const imageCount = keptImages.length + externalImages.length + files.length;
  const canAddImage = imageCount < POST_IMAGES_MAX;
  const trimmed = content.trim();
  const isEmpty = !trimmed && imageCount === 0;

  const filesRef = useRef(files);
  filesRef.current = files;
  const backgroundRef = useRef(backgroundImage);
  backgroundRef.current = backgroundImage;
  useEffect(
    () => () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (backgroundRef.current.kind === 'file') {
        URL.revokeObjectURL(backgroundRef.current.previewUrl);
      }
    },
    [],
  );

  const reset = () => {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setContent('');
    setVisibility('public');
    setSensitive(false);
    setKeptImages([]);
    setExternalImages([]);
    setFiles([]);
    setLinkValue('');
    setLinkError('');
    if (backgroundImage.kind === 'file') {
      URL.revokeObjectURL(backgroundImage.previewUrl);
    }
    setDecoration(DEFAULT_POST_DECORATION);
    setBackgroundImage({ kind: 'none' });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const input: PostFormInput = {
        content: trimmed,
        visibility,
        sensitive,
        externalImages,
        files: files.map((item) => item.file),
        decoration: decorationPayload(decoration, backgroundImage),
        backgroundFile:
          decoration.background.type === 'image' &&
          backgroundImage.kind === 'file'
            ? backgroundImage.file
            : undefined,
      };
      return post
        ? updatePostFn(post.postId, {
            ...input,
            keepImageIds: keptImages.map((image) => image._id),
          })
        : createPostFn(input).then(() => undefined);
    },
    onSuccess: async () => {
      toast.success(post ? t('posts.saved') : t('posts.published'));
      if (!post) reset();
      await queryClient.invalidateQueries({ queryKey: ['socialActivities'] });
      onDone?.();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const addLink = () => {
    const value = linkValue.trim();
    if (!value || !canAddImage) return;
    const check = checkExternalImageUrl(value);
    if (!check.ok) {
      setLinkError(
        check.reason === 'host'
          ? tErrors('post.unsupportedImageHost', { host: check.host })
          : tErrors('post.invalidImageUrl'),
      );
      return;
    }
    const alreadyAdded =
      externalImages.includes(check.url) ||
      keptImages.some((image) => image.url === check.url);
    if (!alreadyAdded) setExternalImages((current) => [...current, check.url]);
    setLinkValue('');
    setLinkError('');
  };

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const room = POST_IMAGES_MAX - imageCount;
    const accepted: PendingFile[] = [];
    for (const file of Array.from(selected).slice(0, room)) {
      if (!POST_UPLOAD_TYPES.includes(file.type)) {
        toast.error(tErrors('post.invalidImage'));
        continue;
      }
      if (file.size > POST_UPLOAD_MAX_BYTES) {
        toast.error(tErrors('post.imageTooLarge', { max: 8 }));
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) =>
    setFiles((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });

  const thumbs = useMemo(
    () => [
      ...keptImages.map((image) => ({
        key: `kept-${image._id}`,
        src: postImageSrc(image),
        badge: image.source === 'hosted' ? t('posts.hostedBadge') : t('posts.linkBadge'),
        remove: () =>
          setKeptImages((current) =>
            current.filter((item) => item._id !== image._id),
          ),
      })),
      ...externalImages.map((url) => ({
        key: `link-${url}`,
        src: externalPostImageSrc(url),
        badge: t('posts.linkBadge'),
        remove: () =>
          setExternalImages((current) => current.filter((item) => item !== url)),
      })),
      ...files.map((item) => ({
        key: `file-${item.id}`,
        src: item.previewUrl,
        badge: t('posts.hostedBadge'),
        remove: () => removeFile(item.id),
      })),
    ],
    [externalImages, files, keptImages, t],
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isEmpty && !mutation.isPending) mutation.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <CommentFormattingToolbar
          value={content}
          onChange={setContent}
          textareaRef={textareaRef}
          maxLength={POST_CONTENT_MAX_LENGTH}
          allowImages={false}
        />
        <textarea
          ref={textareaRef}
          className="textarea focus:textarea-primary w-full"
          rows={4}
          value={content}
          maxLength={POST_CONTENT_MAX_LENGTH}
          placeholder={t('posts.composerPlaceholder')}
          aria-label={t('posts.composerPlaceholder')}
          autoFocus={autoFocus}
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="text-right text-xs text-base-content/60">
          {t('posts.count', {
            count: content.length,
            max: POST_CONTENT_MAX_LENGTH,
          })}
        </p>
      </div>

      <Field
        label={t('posts.imagesLabel', {
          count: imageCount,
          max: POST_IMAGES_MAX,
        })}
        hint={t('posts.linkHint')}
        error={linkError || undefined}
      >
        {(id) => (
          <div className="join w-full">
            <input
              id={id}
              type="url"
              inputMode="url"
              className="input join-item focus:input-primary w-full"
              placeholder={t('posts.linkPlaceholder')}
              value={linkValue}
              disabled={!canAddImage}
              onChange={(event) => {
                setLinkValue(event.target.value);
                setLinkError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addLink();
                }
              }}
            />
            <button
              type="button"
              className="join-item btn btn-outline"
              disabled={!canAddImage || !linkValue.trim()}
              onClick={addLink}
            >
              <Link2 className="h-4 w-4" />
              {t('posts.addLinkButton')}
            </button>
          </div>
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept={POST_UPLOAD_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />
        {canUpload ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              appearance="outline"
              disabled={!canAddImage}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t('posts.upload')}
            </Button>
            <span className="text-xs text-base-content/60">
              {t('posts.uploadHint')}
            </span>
          </div>
        ) : (
          <div className="surface-muted flex flex-wrap items-center gap-2 p-2 text-xs text-base-content/70">
            <Lock className="h-4 w-4 shrink-0 text-warning" />
            <span className="min-w-0 flex-1">{t('posts.uploadLocked')}</span>
            <a
              href={PATREON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-warning btn-outline btn-xs"
            >
              {t('posts.uploadLockedShort')}
            </a>
          </div>
        )}
      </div>

      {thumbs.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {thumbs.map((thumb) => (
            <ImageThumb
              key={thumb.key}
              src={thumb.src}
              badge={thumb.badge}
              onRemove={thumb.remove}
              removeLabel={t('posts.removeImage')}
            />
          ))}
        </ul>
      )}

      {imageCount > 0 && (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm mt-0.5"
            checked={sensitive}
            onChange={(event) => setSensitive(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium">
              {t('posts.sensitive')}
            </span>
            <span className="block text-xs text-base-content/60">
              {t('posts.sensitiveHint')}
            </span>
          </span>
        </label>
      )}

      <PostDecorationEditor
        value={decoration}
        onChange={setDecoration}
        image={backgroundImage}
        onImageChange={setBackgroundImage}
        locked={!canDecorate}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t('posts.visibility')} className="w-full sm:w-56">
          <DropdownSelect
            className="select w-full"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as SocialVisibility)
            }
          >
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {t(`posts.visibilityOptions.${value}`)}
              </option>
            ))}
          </DropdownSelect>
        </Field>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <Button appearance="ghost" onClick={onCancel}>
              {t('posts.cancel')}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isEmpty}
            loading={mutation.isPending}
          >
            {post ? t('posts.save') : t('posts.publish')}
          </Button>
        </div>
      </div>
    </form>
  );
}
