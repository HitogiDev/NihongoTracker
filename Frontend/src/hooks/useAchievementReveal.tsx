import { useState, useCallback } from 'react';
import { IPendingAchievement } from '../types';
import AchievementRevealModal from '../components/achievements/AchievementRevealModal';
import { getPendingAchievementsFn } from '../api/trackerApi';

/**
 * Hook to trigger the achievement reveal modal.
 * Prioritizes inline achievements returned from the createLog response,
 * with a fallback to polling the /me/pending endpoint.
 */
export function useAchievementReveal() {
  const [pendingQueue, setPendingQueue] = useState<IPendingAchievement[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const triggerCheck = useCallback(async (inlineAchievements?: any[]) => {
    if (inlineAchievements && inlineAchievements.length > 0) {
      const queue: IPendingAchievement[] = inlineAchievements.map((a) => ({
        userAchievementId: a._id ?? String(Math.random()),
        unlockedAt: new Date().toISOString(),
        achievement: a,
        rarityPercent: a.rarityPercent ?? 0,
      }));
      setPendingQueue(queue);
      setModalOpen(true);
      return;
    }

    // Fallback: poll the pending endpoint
    try {
      const pending = await getPendingAchievementsFn();
      if (pending.length > 0) {
        setPendingQueue(pending);
        setModalOpen(true);
      }
    } catch {
      // Silently fail — achievement display is non-critical
    }
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setPendingQueue([]);
  }, []);

  const RevealModal = modalOpen && pendingQueue.length > 0
    ? () => (
        <AchievementRevealModal
          achievements={pendingQueue}
          onClose={handleClose}
        />
      )
    : null;

  return { triggerCheck, RevealModal, modalOpen };
}
