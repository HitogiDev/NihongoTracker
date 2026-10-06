import { useCallback, useState } from 'react';
import type { ILog, IMediaDocument } from '../types';

export function useMatchingSelection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<IMediaDocument>();
  const [selectedLogs, setSelectedLogs] = useState<ILog[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [assignedLogs, setAssignedLogs] = useState<ILog[]>([]);
  const [shouldSearch, setShouldSearch] = useState(true);

  const handleCheckboxChange = useCallback((log: ILog) => {
    setSelectedLogs((previous) =>
      previous.some((selected) => selected._id === log._id)
        ? previous.filter((selected) => selected._id !== log._id)
        : [...previous, log]
    );
  }, []);
  const handleOpenGroup = useCallback(
    (group: ILog[] | null, title: string, index: number) => {
      if (!group) return;
      setSelectedGroup(index);
      setSelectedLogs(group);
      setSearchQuery(title);
      setShouldSearch(true);
    },
    []
  );
  const handleLogsDismissed = useCallback(() => {
    setAssignedLogs((previous) => [...previous, ...selectedLogs]);
    setSelectedLogs([]);
    setSelectedGroup(null);
  }, [selectedLogs]);
  const clearSelection = useCallback(() => {
    setSelectedLogs([]);
    setSelectedGroup(null);
    setSelectedMedia(undefined);
    setSearchQuery('');
    setShouldSearch(false);
  }, []);
  const resetState = useCallback(() => {
    setAssignedLogs((previous) => [...previous, ...selectedLogs]);
    clearSelection();
  }, [selectedLogs, clearSelection]);

  return {
    searchQuery,
    setSearchQuery,
    selectedMedia,
    setSelectedMedia,
    selectedLogs,
    setSelectedLogs,
    selectedGroup,
    setSelectedGroup,
    assignedLogs,
    setAssignedLogs,
    shouldSearch,
    setShouldSearch,
    handleCheckboxChange,
    handleOpenGroup,
    handleLogsDismissed,
    resetState,
    clearSelection,
  };
}
