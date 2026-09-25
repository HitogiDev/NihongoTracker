import { ILog } from '../types';

export function useFilteredGroupedLogs(
  logs: ILog[] | undefined,
  groupedLogs: Record<string, ILog[]>,
  assignedLogs: ILog[]
) {
  return (() => {
    if (!logs) return {};
    const filteredGroupedLogs: Record<string, ILog[]> = {};
    Object.entries(groupedLogs).forEach(([key, group]) => {
      const filteredGroup = group.filter((log) => !assignedLogs.includes(log));
      if (filteredGroup.length > 0) {
        filteredGroupedLogs[key] = filteredGroup;
      }
    });
    return filteredGroupedLogs;
  })();
}
