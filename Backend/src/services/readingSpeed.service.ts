import { normalizeJitenDifficulty } from './xp.js';

export interface IReadingSpeedDifficultyLog {
  date: Date;
  type: string;
  time: number;
  chars: number;
  mediaId?: string | null;
}

export interface IReadingSpeedDifficultyMedia {
  contentId: string;
  jitenDifficulty?: number | null;
}

export interface IReadingSpeedByDifficulty {
  date: Date;
  type: string;
  difficulty: number;
  charsPerHour: number;
}

export function buildReadingSpeedByDifficultyData(
  logs: IReadingSpeedDifficultyLog[],
  media: IReadingSpeedDifficultyMedia[]
): IReadingSpeedByDifficulty[] {
  const difficultyByContentId = new Map<string, number>();

  media.forEach((entry) => {
    const difficulty = normalizeJitenDifficulty(entry.jitenDifficulty);
    if (difficulty !== null) {
      difficultyByContentId.set(entry.contentId, difficulty);
    }
  });

  return logs.flatMap((log) => {
    const difficulty = log.mediaId
      ? difficultyByContentId.get(log.mediaId)
      : undefined;
    if (difficulty === undefined || log.time <= 0 || log.chars <= 0) {
      return [];
    }

    return [
      {
        date: log.date,
        type: log.type,
        difficulty,
        charsPerHour: (log.chars * 60) / log.time,
      },
    ];
  });
}
