import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createMediaListFn, getUserMediaListsFn } from '../api/listsApi';
import { useUserDataStore } from '../store/userData';
import MediaListCard from '../components/MediaListCard';
import MediaListFormModal, {
  MediaListFormValues,
} from '../components/MediaListFormModal';

function UserListsScreen() {
  const { t } = useTranslation('media');
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  const { data, isLoading } = useQuery({
    queryKey: ['userMediaLists', username],
    queryFn: () => getUserMediaListsFn(username as string),
    enabled: !!username,
  });

  const createList = useMutation({
    mutationFn: (values: MediaListFormValues) => createMediaListFn(values),
    onSuccess: (result) => {
      setShowCreateModal(false);
      void queryClient.invalidateQueries({ queryKey: ['userMediaLists'] });
      toast.success(t('lists.toast.created'));
      navigate(`/lists/${result.list._id}`);
    },
    onError: () => toast.error(t('lists.toast.createFailed')),
  });

  const lists = data?.lists ?? [];

  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold">{t('lists.heading')}</h2>
          {isOwnProfile && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" /> {t('lists.create')}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-base-content/60 py-12 text-center">
            {isOwnProfile ? t('lists.emptyOwn') : t('lists.emptyOther')}
          </p>
        ) : (
          <div className="border-t border-base-content/10">
            {lists.map((list) => (
              <MediaListCard
                key={list._id}
                list={list}
                variant="row"
                showOwner={false}
              />
            ))}
          </div>
        )}
      </div>

      <MediaListFormModal
        open={showCreateModal}
        isSubmitting={createList.isPending}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(values) => createList.mutate(values)}
      />
    </div>
  );
}

export default UserListsScreen;
