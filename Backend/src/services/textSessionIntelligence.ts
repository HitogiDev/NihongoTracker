import {
  ITextLine,
  ITextSessionAttentionPeriod,
  ITextSessionIntelligence,
  ITextSessionIntelligenceSettings,
} from '../types.js';

export const TEXT_SESSION_INTELLIGENCE_VERSION = 1;
export const DEFAULT_DISTRACTION_THRESHOLD_SECONDS = 40;
export const DEFAULT_AFK_THRESHOLD_SECONDS = 300;

const CALIBRATION_GAPS = 8;
const BASELINE_WINDOW_SIZE = 20;
const MIN_AUTOMATIC_THRESHOLD_SECONDS = 30;
const MAX_AUTOMATIC_THRESHOLD_SECONDS = 180;
const MAX_ANALYZED_SESSION_SECONDS = 24 * 60 * 60;

type IntelligenceLine = Pick<
  ITextLine,
  'charsCount' | 'createdAt' | 'elapsedSeconds'
>;

type NormalizedSettings = {
  mode: ITextSessionIntelligenceSettings['mode'];
  manualThresholdSeconds: number;
  afkThresholdSeconds: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeSettings(
  settings?: Partial<ITextSessionIntelligenceSettings>
): NormalizedSettings {
  const mode =
    settings?.mode === 'manual' || settings?.mode === 'off'
      ? settings.mode
      : 'automatic';
  const manualThresholdSeconds = clamp(
    Math.round(
      settings?.manualThresholdSeconds ?? DEFAULT_DISTRACTION_THRESHOLD_SECONDS
    ),
    30,
    180
  );
  const afkThresholdSeconds = clamp(
    Math.round(settings?.afkThresholdSeconds ?? DEFAULT_AFK_THRESHOLD_SECONDS),
    300,
    600
  );

  return { mode, manualThresholdSeconds, afkThresholdSeconds };
}

function automaticThreshold(normalGaps: number[]): number {
  const recent = normalGaps.slice(-BASELINE_WINDOW_SIZE);
  const baseline = median(recent);
  if (baseline === null || recent.length < CALIBRATION_GAPS) {
    return DEFAULT_DISTRACTION_THRESHOLD_SECONDS;
  }

  const deviations = recent.map((gap) => Math.abs(gap - baseline));
  const medianAbsoluteDeviation = median(deviations) ?? 0;
  const variabilityThreshold = baseline + 3 * 1.4826 * medianAbsoluteDeviation;

  return Math.round(
    clamp(
      Math.max(baseline * 2.5, variabilityThreshold),
      MIN_AUTOMATIC_THRESHOLD_SECONDS,
      MAX_AUTOMATIC_THRESHOLD_SECONDS
    )
  );
}

function readingSpeed(characters: number, seconds: number) {
  if (characters <= 0 || seconds <= 0) return 0;
  return Math.round((characters / seconds) * 3600);
}

function buildCharactersPerMinute(
  lines: IntelligenceLine[],
  sessionSeconds: number
) {
  const bucketCount = Math.max(1, Math.ceil(Math.max(sessionSeconds, 1) / 60));
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const line of lines) {
    if (
      typeof line.elapsedSeconds !== 'number' ||
      !Number.isFinite(line.elapsedSeconds) ||
      line.elapsedSeconds < 0
    ) {
      continue;
    }

    const index = clamp(
      Math.floor(line.elapsedSeconds / 60),
      0,
      bucketCount - 1
    );
    buckets[index] += Math.max(0, Math.floor(line.charsCount || 0));
  }

  return buckets;
}

function peakReadingSpeed(charactersPerMinute: number[], sessionSeconds: number) {
  if (sessionSeconds <= 0) return 0;
  if (sessionSeconds < 300) {
    const total = charactersPerMinute.reduce((sum, characters) => sum + characters, 0);
    return readingSpeed(total, sessionSeconds);
  }

  let peakCharacters = 0;
  for (let index = 0; index < charactersPerMinute.length; index += 1) {
    const windowStart = Math.max(0, index - 4);
    const windowCharacters = charactersPerMinute
      .slice(windowStart, index + 1)
      .reduce((sum, characters) => sum + characters, 0);
    if (index >= 4) peakCharacters = Math.max(peakCharacters, windowCharacters);
  }

  return readingSpeed(peakCharacters, 300);
}

function windowReadingSpeed(
  lines: IntelligenceLine[],
  sessionSeconds: number,
  side: 'first' | 'last'
) {
  if (sessionSeconds <= 0) return 0;
  const windowSeconds = Math.min(sessionSeconds, 1800);
  const startSecond = side === 'last' ? Math.max(0, sessionSeconds - 1800) : 0;
  const endSecond = side === 'first' ? windowSeconds : sessionSeconds;
  const characters = lines.reduce((sum, line) => {
    const elapsed = line.elapsedSeconds;
    if (
      typeof elapsed !== 'number' ||
      elapsed < startSecond ||
      elapsed > endSecond
    ) {
      return sum;
    }
    return sum + Math.max(0, Math.floor(line.charsCount || 0));
  }, 0);

  return readingSpeed(characters, windowSeconds);
}

function attentionAnalysis(
  lines: IntelligenceLine[],
  loggedAt: Date,
  settings: NormalizedSettings
) {
  if (settings.mode === 'off' || lines.length === 0) {
    return {
      baselineIntervalSeconds: null,
      distractionThresholdSeconds: null,
      focusedSeconds: 0,
      distractedSeconds: 0,
      afkSeconds: 0,
      distractionCount: 0,
      longestDistractionSeconds: 0,
      focusPercentage: 0,
      periods: [] as ITextSessionAttentionPeriod[],
    };
  }

  const chronological = [...lines]
    .filter((line) => !Number.isNaN(new Date(line.createdAt).getTime()))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  if (chronological.length === 0) {
    return {
      baselineIntervalSeconds: null,
      distractionThresholdSeconds:
        settings.mode === 'manual' ? settings.manualThresholdSeconds : null,
      focusedSeconds: 0,
      distractedSeconds: 0,
      afkSeconds: 0,
      distractionCount: 0,
      longestDistractionSeconds: 0,
      focusPercentage: 0,
      periods: [] as ITextSessionAttentionPeriod[],
    };
  }

  const first = chronological[0];
  const firstElapsed = Math.max(0, first.elapsedSeconds ?? 0);
  const estimatedStart =
    new Date(first.createdAt).getTime() - firstElapsed * 1000;
  const points = [
    { at: estimatedStart, elapsedSeconds: 0, boundary: true },
    ...chronological.map((line) => ({
      at: new Date(line.createdAt).getTime(),
      elapsedSeconds: Math.max(0, line.elapsedSeconds ?? 0),
      boundary: false,
    })),
    {
      at: Math.max(
        loggedAt.getTime(),
        new Date(chronological[chronological.length - 1].createdAt).getTime()
      ),
      elapsedSeconds: null,
      boundary: true,
    },
  ];

  const normalGaps: number[] = [];
  const periods: ITextSessionAttentionPeriod[] = [];
  let focusedSeconds = 0;
  let distractedSeconds = 0;
  let afkSeconds = 0;
  let distractionCount = 0;
  let longestDistractionSeconds = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const gapSeconds = Math.max(
      0,
      Math.round((current.at - previous.at) / 1000)
    );
    if (gapSeconds === 0) continue;

    const threshold =
      settings.mode === 'manual'
        ? settings.manualThresholdSeconds
        : automaticThreshold(normalGaps);
    const startSecond = Math.max(0, Math.round(previous.elapsedSeconds ?? 0));
    const inferredEnd = startSecond + gapSeconds;
    const endSecond = Math.max(
      startSecond,
      Math.round(current.elapsedSeconds ?? inferredEnd)
    );

    if (gapSeconds >= settings.afkThresholdSeconds) {
      afkSeconds += gapSeconds;
      periods.push({ startSecond, endSecond, type: 'afk' });
      continue;
    }

    const isCalibrationCandidate =
      settings.mode === 'automatic' &&
      normalGaps.length < CALIBRATION_GAPS &&
      !previous.boundary &&
      !current.boundary &&
      gapSeconds <= Math.min(120, settings.afkThresholdSeconds / 2);
    if (isCalibrationCandidate) {
      focusedSeconds += gapSeconds;
      normalGaps.push(gapSeconds);
      continue;
    }

    if (gapSeconds > threshold) {
      const distractionSeconds = gapSeconds - threshold;
      focusedSeconds += threshold;
      distractedSeconds += distractionSeconds;
      distractionCount += 1;
      longestDistractionSeconds = Math.max(
        longestDistractionSeconds,
        distractionSeconds
      );
      periods.push({
        startSecond: Math.min(endSecond, startSecond + threshold),
        endSecond,
        type: 'distracted',
      });
      continue;
    }

    focusedSeconds += gapSeconds;
    if (!previous.boundary && !current.boundary) {
      normalGaps.push(gapSeconds);
      if (normalGaps.length > BASELINE_WINDOW_SIZE) normalGaps.shift();
    }
  }

  const attentionSeconds = focusedSeconds + distractedSeconds;
  return {
    baselineIntervalSeconds: median(normalGaps),
    distractionThresholdSeconds:
      settings.mode === 'manual'
        ? settings.manualThresholdSeconds
        : automaticThreshold(normalGaps),
    focusedSeconds,
    distractedSeconds,
    afkSeconds,
    distractionCount,
    longestDistractionSeconds,
    focusPercentage:
      attentionSeconds > 0
        ? Math.round((focusedSeconds / attentionSeconds) * 100)
        : 0,
    periods,
  };
}

export function computeTextSessionIntelligence({
  lines,
  sessionSeconds,
  loggedAt = new Date(),
  settings: requestedSettings,
}: {
  lines: IntelligenceLine[];
  sessionSeconds: number;
  loggedAt?: Date;
  settings?: Partial<ITextSessionIntelligenceSettings>;
}): ITextSessionIntelligence {
  const settings = normalizeSettings(requestedSettings);
  const normalizedSessionSeconds = clamp(
    Number.isFinite(sessionSeconds) ? Math.floor(sessionSeconds) : 0,
    0,
    MAX_ANALYZED_SESSION_SECONDS
  );
  const charactersPerMinute = buildCharactersPerMinute(
    lines,
    normalizedSessionSeconds
  );
  const attention = attentionAnalysis(lines, loggedAt, settings);

  return {
    algorithmVersion: TEXT_SESSION_INTELLIGENCE_VERSION,
    detectionMode: settings.mode,
    afkThresholdSeconds: settings.afkThresholdSeconds,
    ...attention,
    firstThirtyMinutesSpeed: windowReadingSpeed(
      lines,
      normalizedSessionSeconds,
      'first'
    ),
    lastThirtyMinutesSpeed: windowReadingSpeed(
      lines,
      normalizedSessionSeconds,
      'last'
    ),
    peakReadingSpeed: peakReadingSpeed(
      charactersPerMinute,
      normalizedSessionSeconds
    ),
    charactersPerMinute,
  };
}
