import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bold,
  Code,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
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
  Reply,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  canComment: boolean;
  page: number;
  limit: number;
}

function flattenCommentThreads(
  comments: IActivityComment[]
): Array<{
  comment: IActivityComment;
  depth: number;
  rootId: string;
  parentComment?: IActivityComment;
}> {
  const commentIds = new Set(comments.map((comment) => comment._id));
  const repliesByParent = new Map<string, IActivityComment[]>();
  comments.forEach((comment) => {
    if (!comment.parentComment || !commentIds.has(comment.parentComment)) return;
    const replies = repliesByParent.get(comment.parentComment) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentComment, replies);
  });

  const ordered: Array<{
    comment: IActivityComment;
    depth: number;
    rootId: string;
    parentComment?: IActivityComment;
  }> = [];
  const appendThread = (
    comment: IActivityComment,
    depth: number,
    rootId: string,
    parentComment?: IActivityComment,
  ) => {
    ordered.push({ comment, depth, rootId, parentComment });
    repliesByParent.get(comment._id)?.forEach((reply) =>
      appendThread(reply, depth + 1, rootId, comment)
    );
  };

  comments
    .filter(
      (comment) =>
        !comment.parentComment || !commentIds.has(comment.parentComment)
    )
    .forEach((comment) => appendThread(comment, 0, comment._id));

  return ordered;
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
  const [replyingTo, setReplyingTo] = useState<IActivityComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    string | null
  >(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editingRef = useRef<HTMLTextAreaElement>(null);
  const commentsQuery = useQuery({
    queryKey: ['activityComments', activityId],
    queryFn: () => getActivityCommentsFn(activityId),
  });
  const canComment = commentsQuery.data?.canComment === true;
  const threadedComments = useMemo(
    () => flattenCommentThreads(commentsQuery.data?.comments ?? []),
    [commentsQuery.data?.comments]
  );
  const replyCountByRoot = useMemo(() => {
    const counts = new Map<string, number>();
    threadedComments.forEach(({ rootId, depth }) => {
      if (depth > 0) counts.set(rootId, (counts.get(rootId) ?? 0) + 1);
    });
    return counts;
  }, [threadedComments]);
  const visibleThreadedComments = threadedComments.filter(
    ({ rootId, depth }) => depth === 0 || expandedThreads.has(rootId),
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['activityComments', activityId],
      }),
      queryClient.invalidateQueries({ queryKey: ['socialActivities'] }),
    ]);
  };
  const addMutation = useMutation({
    mutationFn: (input: { content: string; parentCommentId?: string }) =>
      addActivityCommentFn(
        activityId,
        input.content,
        input.parentCommentId
      ),
    onSuccess: async () => {
      setContent('');
      setComposerOpen(false);
      setReplyingTo(null);
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
    mutationFn: ({
      commentId,
      liked,
    }: {
      commentId: string;
      liked: boolean;
    }) =>
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
    setReplyingTo(null);
    composerRef.current?.blur();
  };

  const startReply = (comment: IActivityComment) => {
    setReplyingTo(comment);
    setComposerOpen(true);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const toggleThread = (rootId: string) => {
    setExpandedThreads((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  const getCommentExcerpt = (comment: Pick<IActivityComment, 'content'>) => {
    const normalized = comment.content.replace(/\s+/g, ' ').trim();
    return normalized.length > 90
      ? `${normalized.slice(0, 87).trimEnd()}...`
      : normalized;
  };

  useEffect(() => {
    const clearHighlight = (event: globalThis.MouseEvent) => {
      const clickedElement = event.target;
      if (
        clickedElement instanceof Element &&
        clickedElement.closest('[data-comment-navigation]')
      ) {
        return;
      }
      setHighlightedCommentId(null);
    };

    document.addEventListener('click', clearHighlight);
    return () => document.removeEventListener('click', clearHighlight);
  }, []);

  const focusComment = (event: MouseEvent<HTMLAnchorElement>, commentId: string) => {
    event.preventDefault();
    const target = document.getElementById(`comment-${commentId}`);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!isInViewport) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setHighlightedCommentId(commentId);
  };

  return (
    <div className="space-y-3">
      {canComment && (
        <div className="surface-muted p-3 shadow-sm sm:p-4">
          <div className="space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between gap-2 text-xs text-base-content/60">
                <span>
                  {t('comments.replyingTo', {
                    username: replyingTo.user.username,
                  })}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={cancelComment}
                >
                  {t('comments.cancel')}
                </button>
              </div>
            )}
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
                      onClick={() =>
                        addMutation.mutate({
                          content,
                          parentCommentId: replyingTo?._id,
                        })
                      }
                    >
                      {addMutation.isPending && <Spinner size="sm" />}
                      {t(replyingTo ? 'comments.reply' : 'comments.post')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {commentsQuery.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="surface-muted p-4">
            <div className="skeleton h-14 w-full" />
          </div>
          <div className="surface-muted p-4">
            <div className="skeleton h-14 w-full" />
          </div>
        </div>
      ) : commentsQuery.isError ? (
        <p role="alert" className="surface-muted p-4 text-sm text-error">
          {t('comments.loadError')}
        </p>
      ) : threadedComments.length ? (
        <ul className="list gap-3 bg-transparent p-0">
          {visibleThreadedComments.map(
            ({ comment, depth, rootId, parentComment }) => {
            const isOwner = currentUser?._id === comment.user._id;
            const isEditing = editingId === comment._id;
            const replyCount = replyCountByRoot.get(rootId) ?? 0;
            const isExpanded = expandedThreads.has(rootId);
            const isReply = Boolean(comment.parentComment);
            const parentReference =
              parentComment ?? comment.parentCommentPreview ?? undefined;
            return (
              <li
                key={comment._id}
                id={`comment-${comment._id}`}
                className={`${
                  depth > 0
                    ? 'list-row surface-muted ml-4 border-l-2 border-base-300 p-3 pl-3 shadow-sm sm:ml-8 sm:p-4'
                    : 'list-row surface-muted p-3 shadow-sm sm:p-4'
                } transition-colors duration-300 ${
                  highlightedCommentId === comment._id
                    ? 'border-2 border-primary'
                    : ''
                }`}
              >
                <Link to={`/user/${encodeURIComponent(comment.user.username)}`}>
                  <div className="avatar">
                    <UserAvatar
                      username={comment.user.username}
                      avatar={comment.user.avatar}
                      containerClassName="h-9 w-9 overflow-hidden rounded-full"
                      imageClassName="h-full w-full object-cover"
                      fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                      textClassName="text-xs font-semibold"
                    />
                  </div>
                </Link>
                <div className="list-col-grow min-w-0">
                  <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div
                      className={
                        isReply && parentReference
                          ? 'flex min-w-0 flex-col justify-center gap-0.5 text-xs text-base-content/60'
                          : 'flex flex-wrap items-center gap-2 text-xs text-base-content/60'
                      }
                    >
                      {isReply && parentReference ? (
                        <>
                          <a
                            href={`#comment-${parentReference._id}`}
                            className="flex min-w-0 items-center gap-1 text-xs text-base-content/60 hover:text-primary"
                            title={t('comments.jumpToParent')}
                            data-comment-navigation
                            onClick={(event) =>
                              focusComment(event, parentReference._id)
                            }
                          >
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {t('comments.replyingToComment', {
                                username: parentReference.user.username,
                                content: getCommentExcerpt(parentReference),
                              })}
                            </span>
                          </a>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/user/${encodeURIComponent(comment.user.username)}`}
                              className="link link-hover font-semibold text-primary"
                            >
                              {comment.user.username}
                            </Link>
                            {comment.editedAt && (
                              <span>{t('comments.edited')}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <Link
                            to={`/user/${encodeURIComponent(comment.user.username)}`}
                            className="link link-hover font-semibold text-primary"
                          >
                            {comment.user.username}
                          </Link>
                          {comment.editedAt && (
                            <span>{t('comments.edited')}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-base-content/60">
                      {!isEditing && (
                        <button
                          type="button"
                          className={
                            comment.currentUserLiked
                              ? 'btn btn-error btn-soft btn-xs gap-1 px-1.5'
                              : 'btn btn-ghost btn-xs gap-1 px-1.5'
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
                          disabled={likeMutation.isPending || !currentUser}
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
                          {comment.likeCount > 0 && (
                            <span>{comment.likeCount}</span>
                          )}
                        </button>
                      )}
                      <span>
                        {formatRelativeDateInTimezone(comment.createdAt)}
                      </span>
                      {canComment && !isEditing && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs gap-1 px-1.5"
                          onClick={() => startReply(comment)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                          {t('comments.reply')}
                        </button>
                      )}
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
                                onClick={() =>
                                  deleteMutation.mutate(comment._id)
                                }
                                className="flex items-center gap-2 text-sm text-error"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('comments.delete')}
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-3">
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
                    <div
                      className={`prose prose-sm ${
                        isReply && parentReference ? 'mt-2' : 'mt-3'
                      } max-w-none wrap-break-word text-base-content [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownWithSpoilers(comment.content),
                      }}
                    />
                  )}
                  {depth === 0 && replyCount > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs mt-3 gap-1 px-1.5 text-primary"
                      aria-expanded={isExpanded}
                      onClick={() => toggleThread(rootId)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {isExpanded
                        ? t('comments.hideReplies')
                        : t('comments.showReplies', { count: replyCount })}
                    </button>
                  )}
                </div>
              </li>
            );
            },
          )}
        </ul>
      ) : (
        <p className="surface-muted p-4 text-sm text-base-content/60">
          {t('comments.empty')}
        </p>
      )}
    </div>
  );
}
