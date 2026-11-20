import { PenLine } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useUserDataStore } from '../../store/userData';
import { canUsePosts } from '../../utils/postAccess';
import UserAvatar from '../UserAvatar';
import PostComposer from './PostComposer';

/** Collapsed post composer at the top of a feed. It renders nothing while posts are off. */
export default function FeedPostComposer() {
  const { t } = useTranslation('social');
  const user = useUserDataStore((state) => state.user);
  const { posts } = useFeatureFlags();
  const [open, setOpen] = useState(false);

  if (!user || !canUsePosts(user, posts)) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="surface-muted flex w-full items-center gap-3 p-3 text-left text-sm text-base-content/60 transition-colors hover:text-base-content"
        onClick={() => setOpen(true)}
      >
        <UserAvatar
          username={user.username}
          avatar={user.avatar}
          containerClassName="h-8 w-8 shrink-0 overflow-hidden rounded-full"
          imageClassName="h-full w-full object-cover"
          fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
          textClassName="text-xs font-semibold"
        />
        <span className="min-w-0 flex-1 truncate">
          {t('posts.composerPlaceholder')}
        </span>
        <PenLine className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <div className="surface-muted p-3 sm:p-4">
      <PostComposer
        autoFocus
        onDone={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
