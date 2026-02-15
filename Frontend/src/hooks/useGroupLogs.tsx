import { ILog } from '../types';
import { fuzzy } from 'fast-fuzzy';

export function useGroupLogs(
  logs: ILog[] | undefined,
  type: ILog['type']
): Record<string, ILog[]> {
  const stripSymbols = (description: string, logType: ILog['type']) => {
    let result = description;

    // For manga, strip volume patterns like "v1", "v14", "v36"
    if (logType === 'manga') {
      result = result.replace(/\s+v\d+\s*$/i, ''); // Remove trailing volume markers
    }

    // For all types except video, remove episode/chapter ranges and numbers
    result = result
      .replace(/\s*[-–—:]\s*\d+[-–]\d+\s*$/g, '') // Remove episode ranges like "1-5" or "6-12"
      .replace(/\s*[-–—:]\s*\d+\s*$/g, '') // Remove single episode numbers like "- 5"
      .replace(/\s+\d+\s*$/, '') // Remove standalone trailing numbers
      .trim();

    return result;
  };

  return (() => {
    if (!logs) return {};
    const groupedLogs = new Map<string, ILog[]>();
    logs.forEach((log) => {
      if (!log.description || log.type !== type || log.mediaId) return;
      let strippedDescription = log.description;
      if (type !== 'video')
        strippedDescription = stripSymbols(log.description, type);
      let foundGroup = false;
      for (const [key, group] of groupedLogs) {
        if (fuzzy(key, strippedDescription) > 0.8) {
          group.push(log);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        groupedLogs.set(strippedDescription, [log]);
      }
    });

    // Merge groups with the exact same name
    const mergedGroups: Record<string, ILog[]> = {};
    groupedLogs.forEach((logs, description) => {
      if (mergedGroups[description]) {
        mergedGroups[description].push(...logs);
      } else {
        mergedGroups[description] = logs;
      }
    });

    return mergedGroups;
  })();
}
