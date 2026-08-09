import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Trash } from 'lucide-react';
import {
  addMediaListCommentFn,
  deleteMediaListCommentFn,
  getMediaListCommentsFn,
} from '../api/listsApi';
import UserAvatar from './UserAvatar';

interface MediaListCommentsProps {
  listId: string;
  listOwnerId?: string;
  currentUserId?: string;
}

const COMMENT_MAX_LENGTH = 2000;

function MediaListComments({
  listId,
  listOwnerId,
  currentUserId,
}: MediaListCommentsProps) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mediaListComments', listId],
    queryFn: () => getMediaListCommentsFn(listId),
  });

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: ['mediaListComments', listId],
    });
    void queryClient.invalidateQueries({ queryKey: ['mediaList', listId] });
  }

  const addComment = useMutation({
    mutationFn: (text: string) => addMediaListCommentFn(listId, text),
    onSuccess: () => {
      setContent('');
      refresh();
    },
    onError: () => toast.error(t('comments.postFailed')),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) =>
      deleteMediaListCommentFn(listId, commentId),
    onSuccess: () => refresh(),
    onError: () => toast.error(t('comments.deleteFailed')),
  });

  const comments = data?.comments ?? [];

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h2>

      {currentUserId ? (
        <form
          className="flex flex-col gap-2 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            const text = content.trim();
            if (text) addComment.mutate(text);
          }}
        >
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder={t('comments.placeholder')}
            maxLength={COMMENT_MAX_LENGTH}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!content.trim() || addComment.isPending}
            >
              {t('comments.post')}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-base-content/60 mb-6">
          <Trans
            i18nKey="comments.loginPrompt"
            ns="media"
            components={{ login: <Link to="/login" className="link" /> }}
          />
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-base-content/60">{t('comments.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => {
            const canDelete =
              !!currentUserId &&
              (comment.user._id === currentUserId ||
                listOwnerId === currentUserId);

            return (
              <li key={comment._id} className="flex gap-3">
                <UserAvatar
                  username={comment.user.username}
                  avatar={comment.user.avatar}
                  containerClassName="w-9 h-9 rounded-full shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/user/${comment.user.username}`}
                      className="font-medium hover:underline"
                    >
                      {comment.user.username}
                    </Link>
                    {comment.createdAt && (
                      <span className="text-xs text-base-content/50">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs ml-auto"
                        onClick={() => deleteComment.mutate(comment._id)}
                        aria-label={t('comments.delete')}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm mt-1">
                    {comment.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default MediaListComments;
