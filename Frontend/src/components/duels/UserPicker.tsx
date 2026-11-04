import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchUsersFn } from '../../api/trackerApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useUserDataStore } from '../../store/userData';
import UserAvatar from '../UserAvatar';
import Spinner from '../ui/Spinner';
import { BTN } from '../ui/buttons';

export interface PickedUser {
  username: string;
  avatar?: string;
}

interface UserPickerProps {
  value: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  id?: string;
}

export default function UserPicker({ value, onChange, id }: UserPickerProps) {
  const { t } = useTranslation('duels');
  const currentUsername = useUserDataStore((state) => state.user?.username);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 300);
  const searchQuery = useQuery({
    queryKey: ['userSearch', debouncedQuery],
    queryFn: () => searchUsersFn(debouncedQuery),
    enabled: debouncedQuery.length >= 2 && !value,
    staleTime: 60_000,
    meta: { persist: false },
  });
  const results = (searchQuery.data ?? []).filter(
    (user) => user.username.toLowerCase() !== currentUsername?.toLowerCase()
  );

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 p-2">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar username={value.username} avatar={value.avatar} />
          <span className="truncate font-medium">{value.username}</span>
        </div>
        <button
          type="button"
          className={BTN.clear}
          aria-label={t('modal.opponent')}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  let listContent;
  if (searchQuery.isFetching) {
    listContent = (
      <li className="flex items-center justify-center py-3">
        <Spinner size="sm" />
      </li>
    );
  } else if (results.length === 0) {
    listContent = (
      <li className="px-3 py-2 text-sm text-base-content/60">
        {t('modal.noResults')}
      </li>
    );
  } else {
    listContent = results.map((user) => (
      <li key={user._id}>
        <button
          type="button"
          onClick={() => {
            onChange({ username: user.username, avatar: user.avatar });
            setQuery('');
          }}
        >
          <UserAvatar
            username={user.username}
            avatar={user.avatar}
            containerClassName="w-8 h-8 rounded-full"
          />
          <span className="truncate">{user.username}</span>
        </button>
      </li>
    ));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        className="input w-full focus:input-primary"
        value={query}
        placeholder={t('modal.searchPlaceholder')}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />
      {debouncedQuery.length >= 2 && (
        <ul className="menu max-h-52 w-full flex-nowrap overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1">
          {listContent}
        </ul>
      )}
    </div>
  );
}
