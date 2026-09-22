import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bold,
  Code,
  EllipsisVertical,
  EyeOff,
  Heart,
  Heading,
  Image,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  addActivityCommentFn,
  deleteActivityCommentFn,
  editActivityCommentFn,
  getActivityCommentsFn,
  likeActivityCommentFn,
  unlikeActivityCommentFn,
} from '../../api/activitiesApi';
import { useUserDataStore } from '../../store/userData';
import type { IActivityComment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { renderMarkdownWithSpoilers } from '../../utils/markdown';
import { formatRelativeDateInTimezone } from '../../utils/timezone';
import Spinner from '../ui/Spinner';
import UserAvatar from '../UserAvatar';

interface ActivityCommentsProps {
  activityId: string;
}

interface ActivityCommentsData {
  comments: IActivityComment[];
  total: number;
  page: number;
  limit: number;
}

interface CommentFormattingToolbarProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  maxLength: number;
}

function CommentFormattingToolbar({
  value,
  onChange,
  textareaRef,
  maxLength,
}: CommentFormattingToolbarProps) {
  const { t } = useTranslation('settings');

  const insertSnippet = (
    prefix: string,
    suffix: string,
    placeholder: string,
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart ?? value.length;
    const selectionEnd = textarea.selectionEnd ?? value.length;
    const selected = value.slice(selectionStart, selectionEnd) || placeholder;
    const nextValue =
      value.slice(0, selectionStart) +
      prefix +
      selected +
      suffix +
      value.slice(selectionEnd);
    if (nextValue.length > maxLength) return;

    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        selectionStart + prefix.length,
        selectionStart + prefix.length + selected.length,
      );
    });
  };

  const insertLineSnippet = (prefix: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart ?? value.length;
    const lineBreak = selectionStart > 0 && value[selectionStart - 1] !== '\n';
    insertSnippet(`${lineBreak ? '\n' : ''}${prefix}`, '', placeholder);
  };

  const tools: Array<{
    label: string;
    icon: LucideIcon;
    action: () => void;
  }> = [
    {
      label: t('markdown.bold'),
      icon: Bold,
      action: () => insertSnippet('**', '**', t('markdown.snippets.bold')),
    },
    {
      label: t('markdown.italic'),
      icon: Italic,
      action: () => insertSnippet('*', '*', t('markdown.snippets.italic')),
    },
    {
      label: t('markdown.heading1'),
      icon: Heading,
      action: () =>
        insertLineSnippet('# ', t('markdown.snippets.heading', { level: 1 })),
    },
    {
      label: t('markdown.link'),
      icon: LinkIcon,
      action: () =>
        insertSnippet(
          '[',
          '](https://example.com)',
          t('markdown.snippets.link'),
        ),
    },
    {
      label: t('markdown.image'),
      icon: Image,
      action: () =>
        insertSnippet(
          '![',
          '](https://example.com/image.png)',
          t('markdown.snippets.imageAlt'),
        ),
    },
    {
      label: t('markdown.bulletedList'),
      icon: List,
      action: () => insertLineSnippet('- ', t('markdown.snippets.listItem')),
    },
    {
      label: t('markdown.numberedList'),
      icon: ListOrdered,
      action: () => insertLineSnippet('1. ', t('markdown.snippets.listItem')),
    },
    {
      label: t('markdown.quote'),
      icon: Quote,
      action: () => insertLineSnippet('> ', t('markdown.snippets.quote')),
    },
    {
      label: t('markdown.inlineCode'),
      icon: Code,
      action: () => insertSnippet('`', '`', t('markdown.snippets.inlineCode')),
    },
    {
      label: t('markdown.codeBlock'),
      icon: Code,
      action: () =>
        insertSnippet('```\n', '\n```', t('markdown.snippets.code')),
    },
    {
      label: t('markdown.spoiler'),
      icon: EyeOff,
      action: () => insertSnippet('||', '||', t('markdown.snippets.spoiler')),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-field bg-base-200 p-2">
      {tools.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={action}
          title={label}
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export default function ActivityComments({
  activityId,
}: ActivityCommentsProps) {
  const { t } = useTranslation('social');
  const queryClient = useQueryClient();
  const currentUser = useUserDataStore((state) => state.user);
  const [content, setContent] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editingRef = useRef<HTMLTextAreaElement>(null);
  const commentsQuery = useQuery({
    queryKey: ['activityComments', activityId],
    queryFn: () => getActivityCommentsFn(activityId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['activityComments', activityId],
      }),
      queryClient.invalidateQueries({ queryKey: ['socialActivities'] }),
    ]);
  };
  const addMutation = useMutation({
    mutationFn: () => addActivityCommentFn(activityId, content),
    onSuccess: async () => {
      setContent('');
      setComposerOpen(false);
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const editMutation = useMutation({
    mutationFn: () =>
      editActivityCommentFn(activityId, editingId ?? '', editingContent),
    onSuccess: async () => {
      setEditingId(null);
      setEditingContent('');
      await refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      deleteActivityCommentFn(activityId, commentId),
    onSuccess: refresh,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const likeMutation = useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      liked
        ? unlikeActivityCommentFn(activityId, commentId)
        : likeActivityCommentFn(activityId, commentId),
    onMutate: async ({ commentId, liked }) => {
      const queryKey = ['activityComments', activityId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ActivityCommentsData>(queryKey);
      queryClient.setQueryData<ActivityCommentsData>(queryKey, (current) =>
        current
          ? {
              ...current,
              comments: current.comments.map((comment) =>
                comment._id === commentId
                  ? {
                      ...comment,
                      currentUserLiked: !liked,
                      likeCount: Math.max(
                        0,
                        comment.likeCount + (liked ? -1 : 1),
                      ),
                    }
                  : comment,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['activityComments', activityId],
          context.previous,
        );
      }
      toast.error(getApiErrorMessage(error));
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['activityComments', activityId],
      }),
  });

  const cancelComment = () => {
    setContent('');
    setComposerOpen(false);
    composerRef.current?.blur();
  };

  return (
    <div className="mt-4 border-t border-base-300 pt-4">
      <div className="space-y-2">
        {composerOpen && (
          <CommentFormattingToolbar
            value={content}
            onChange={setContent}
            textareaRef={composerRef}
            maxLength={1000}
          />
        )}
        <textarea
          ref={composerRef}
          className="textarea textarea-sm focus:textarea-primary h-10 min-h-10 w-full resize-none"
          rows={1}
          maxLength={1000}
          value={content}
          onFocus={() => setComposerOpen(true)}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('comments.placeholder')}
          aria-label={t('comments.add')}
        />
        {composerOpen && (
          <div className="flex items-end justify-between gap-3">
            <span className="text-xs text-base-content/60">
              {t('comments.count', { count: content.length })}
            </span>
            <div className="flex flex-col items-end gap-2">
              <Link
                to="/guidelines"
                className="link link-primary text-right text-xs"
              >
                {t('comments.readGuidelines')}
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={addMutation.isPending}
                  onClick={cancelComment}
                >
                  {t('comments.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!content.trim() || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                >
                  {addMutation.isPending && <Spinner size="sm" />}
                  {t('comments.post')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {commentsQuery.isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
        </div>
      ) : commentsQuery.isError ? (
        <p className="mt-4 text-sm text-error">{t('comments.loadError')}</p>
      ) : commentsQuery.data?.comments.length ? (
        <ul className="list mt-4">
          {commentsQuery.data.comments.map((comment) => {
            const isOwner = currentUser?._id === comment.user._id;
            const isEditing = editingId === comment._id;
            return (
              <li key={comment._id} className="list-row px-0">
                <Link to={`/user/${encodeURIComponent(comment.user.username)}`}>
                  <div className="avatar">
                    <UserAvatar
                      username={comment.user.username}
                      avatar={comment.user.avatar}
                      containerClassName="w-9 rounded-full overflow-hidden"
                      imageClassName="h-full w-full object-cover"
                      fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                      textClassName="text-xs font-semibold"
                    />
                  </div>
                </Link>
                <div className="list-col-grow min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                    <Link
                      to={`/user/${encodeURIComponent(comment.user.username)}`}
                      className="link link-hover font-semibold text-base-content"
                    >
                      {comment.user.username}
                    </Link>
                    <span>
                      {formatRelativeDateInTimezone(comment.createdAt)}
                    </span>
                    {comment.editedAt && <span>{t('comments.edited')}</span>}
                  </div>
                  {isEditing ? (
                    <div className="mt-2">
                      <CommentFormattingToolbar
                        value={editingContent}
                        onChange={setEditingContent}
                        textareaRef={editingRef}
                        maxLength={1000}
                      />
                      <textarea
                        ref={editingRef}
                        className="textarea focus:textarea-primary mt-2 w-full"
                        rows={2}
                        maxLength={1000}
                        value={editingContent}
                        onChange={(event) =>
                          setEditingContent(event.target.value)
                        }
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={
                            !editingContent.trim() || editMutation.isPending
                          }
                          onClick={() => editMutation.mutate()}
                        >
                          {t('comments.save')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          {t('comments.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="prose prose-sm mt-1 max-w-none wrap-break-word text-base-content [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownWithSpoilers(comment.content),
                        }}
                      />
                      <button
                        type="button"
                        className={
                          comment.currentUserLiked
                            ? 'btn btn-error btn-soft btn-xs mt-1'
                            : 'btn btn-ghost btn-xs mt-1'
                        }
                        aria-label={t(
                          comment.currentUserLiked
                            ? 'comments.unlike'
                            : 'comments.like',
                        )}
                        aria-pressed={comment.currentUserLiked}
                        title={t(
                          comment.currentUserLiked
                            ? 'comments.unlike'
                            : 'comments.like',
                        )}
                        disabled={likeMutation.isPending}
                        onClick={() =>
                          likeMutation.mutate({
                            commentId: comment._id,
                            liked: comment.currentUserLiked,
                          })
                        }
                      >
                        <Heart
                          className="h-3.5 w-3.5"
                          fill={
                            comment.currentUserLiked ? 'currentColor' : 'none'
                          }
                        />
                        {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                      </button>
                    </>
                  )}
                </div>
                {isOwner && !isEditing && (
                  <div className="dropdown dropdown-end">
                    <div
                      tabIndex={0}
                      role="button"
                      className="btn btn-ghost btn-xs btn-square"
                      aria-label={t('comments.moreActions')}
                      title={t('comments.moreActions')}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu surface-raised z-[1] w-36 p-1"
                    >
                      <li>
                        <button
                          onClick={() => {
                            setEditingId(comment._id);
                            setEditingContent(comment.content);
                          }}
                          className="flex items-center gap-2 text-sm text-warning hover:bg-warning/10"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('comments.edit')}
                        </button>
                      </li>
                      <li>
                        <button
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(comment._id)}
                          className="flex items-center gap-2 text-sm text-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('comments.delete')}
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-base-content/60">
          {t('comments.empty')}
        </p>
      )}
    </div>
  );
}
