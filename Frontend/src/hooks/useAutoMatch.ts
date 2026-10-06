import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { assignMediaFn, searchMediaFn } from '../api/trackerApi';
import {
  autoMatchLogGroups,
  type AutoMatchMediaType,
} from '../utils/mediaMatching';
import { invalidateMediaAssignmentQueries } from '../utils/logQueryInvalidation';
import type { ILog } from '../types';

export function useAutoMatch(options: {
  type: AutoMatchMediaType;
  username?: string;
  groups: Record<string, ILog[]>;
  logs?: ILog[];
  setAssignedLogs: Dispatch<SetStateAction<ILog[]>>;
  onAssigned: () => void;
}) {
  const { type, username, groups, logs, setAssignedLogs, onAssigned } = options;
  const { t } = useTranslation(['logs', 'common']);
  const queryClient = useQueryClient();
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [showAutoMatchModal, setShowAutoMatchModal] = useState(false);
  const performAutoMatch = useCallback(async () => {
    setShowAutoMatchModal(false);
    setIsAutoMatching(true);
    const assignedIds = new Set<string>();
    try {
      const result = await autoMatchLogGroups({
        groups,
        type,
        search: searchMediaFn,
        assign: assignMediaFn,
        onBatch: (batch) =>
          batch.forEach((assignment) =>
            assignment.logsId.forEach((id) => assignedIds.add(id))
          ),
      });
      if (result.matches) {
        toast.success(
          t('matcher.autoMatchedSuccess', {
            count: result.totalProcessed,
            matches: result.matches,
            type: t(`common:mediaTypesPlural.${type}`),
          })
        );
      } else {
        toast.info(
          t(
            type === 'book'
              ? 'matcher.noExactMatches'
              : 'matcher.noExactMatchesDb'
          )
        );
      }
    } catch (error) {
      console.error('Auto-match error:', error);
      toast.error(t('matcher.autoMatchFailed'));
    } finally {
      if (assignedIds.size) {
        setAssignedLogs((previous) => [
          ...previous,
          ...(logs?.filter((log) => assignedIds.has(log._id)) || []),
        ]);
        invalidateMediaAssignmentQueries(queryClient, type, username);
        onAssigned();
      }
      setIsAutoMatching(false);
    }
  }, [groups, type, logs, username, queryClient, setAssignedLogs, onAssigned, t]);
  const handleAutoMatch = useCallback(async () => {
    const count = Object.keys(groups).length;
    if (!count) {
      toast.info(t('matcher.noGroups'));
      return;
    }
    if (count > 20) {
      setShowAutoMatchModal(true);
      return;
    }
    await performAutoMatch();
  }, [groups, performAutoMatch, t]);
  return {
    isAutoMatching,
    showAutoMatchModal,
    setShowAutoMatchModal,
    performAutoMatch,
    handleAutoMatch,
  };
}
