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
  title?: {
    contentTitleNative?: string;
    contentTitleRomaji?: string;
    contentTitleEnglish?: string;
  };
}

export interface IReadingSpeedByDifficulty {
  date: Date;
  type: string;
  mediaId: string;
  mediaTitle: string;
  difficulty: number;
  charsPerHour: number;
}

export function buildReadingSpeedByDifficultyData(
  logs: IReadingSpeedDifficultyLog[],
  media: IReadingSpeedDifficultyMedia[]
): IReadingSpeedByDifficulty[] {
  const difficultyByContentId = new Map<
    string,
    { difficulty: number; title: string }
  >();

  media.forEach((entry) => {
    const difficulty = normalizeJitenDifficulty(entry.jitenDifficulty);
    if (difficulty !== null) {
      const title =
        entry.title?.contentTitleNative ||
        entry.title?.contentTitleRomaji ||
        entry.title?.contentTitleEnglish ||
        entry.contentId;
      difficultyByContentId.set(entry.contentId, { difficulty, title });
    }
  });

  return logs.flatMap((log) => {
    const mediaInfo = log.mediaId
      ? difficultyByContentId.get(log.mediaId)
      : undefined;
    if (
      mediaInfo === undefined ||
      !log.mediaId ||
      log.time <= 0 ||
      log.chars <= 0
    ) {
      return [];
    }

    return [
      {
        date: log.date,
        type: log.type,
        mediaId: log.mediaId,
        mediaTitle: mediaInfo.title,
        difficulty: mediaInfo.difficulty,
        charsPerHour: (log.chars * 60) / log.time,
      },
    ];
  });
}
