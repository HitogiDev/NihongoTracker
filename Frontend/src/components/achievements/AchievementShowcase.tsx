import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPendingAchievement } from '../../types';
import { updateShowcaseFn, getMyAchievementsFn } from '../../api/trackerApi';
import AchievementCard from './AchievementCard';

interface AchievementShowcaseProps {
  username: string;
  isOwner: boolean;
  showcaseItems?: IPendingAchievement[];
}

export default function AchievementShowcase({
  username,
  isOwner,
  showcaseItems,
}: AchievementShowcaseProps) {
  const [editMode, setEditMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: myAchievements } = useQuery({
    queryKey: ['myAchievements'],
    queryFn: getMyAchievementsFn,
    enabled: isOwner && editMode,
  });

  const { mutate: updateShowcase, isPending } = useMutation({
    mutationFn: (ids: string[]) => updateShowcaseFn(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase', username] });
      setEditMode(false);
    },
  });

  const earnedAchievements = myAchievements?.filter((a) => a.isEarned) ?? [];

  const currentIds = showcaseItems?.map((s) => s.achievement._id) ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  if (!showcaseItems || showcaseItems.length === 0) {
    if (!isOwner) return null;
    return (
      <div className="border border-dashed rounded-xl p-6 text-center opacity-50">
        <p className="text-sm">No achievements pinned yet.</p>
        <button
          className="btn btn-xs btn-ghost mt-2"
          onClick={() => setEditMode(true)}
        >
          + Pin achievements
        </button>
      </div>
    );
  }

  if (editMode && isOwner) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm opacity-70">
            Select up to 5 to showcase ({selectedIds.length}/5)
          </h3>
          <div className="flex gap-2">
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                setEditMode(false);
                setSelectedIds(currentIds);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-xs btn-primary"
              disabled={isPending}
              onClick={() => updateShowcase(selectedIds)}
            >
              Save
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {earnedAchievements.map((a) => (
            <div
              key={a._id}
              onClick={() => toggleSelect(a._id)}
              className={`cursor-pointer rounded-xl transition-all duration-200 ${
                selectedIds.includes(a._id)
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-base-100'
                  : 'opacity-60 hover:opacity-90'
              }`}
            >
              <AchievementCard achievement={a} compact />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm opacity-60 uppercase tracking-wider">Showcase</h3>
        {isOwner && (
          <button
            className="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
            onClick={() => {
              setSelectedIds(currentIds);
              setEditMode(true);
            }}
          >
            Edit
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {showcaseItems.slice(0, 5).map((item) => (
          <AchievementCard
            key={item.userAchievementId}
            achievement={{ ...item.achievement, isEarned: true, unlockedAt: item.unlockedAt }}
            compact
          />
        ))}
      </div>
    </div>
  );
}
