import { MediaBase } from '../models/media.model.js';
import { ILog, IUser } from '../types.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  computeXp,
  continuousLevel,
  getLogCategory,
  getUserConsumedDifficulty,
  getUserReadingSpeedCph,
  normalizeJitenDifficulty,
  FALLBACK_READING_SPEED_CPH,
  JITEN_MAX_DIFFICULTY,
  READING_TYPES,
} from './xp.js';

export type XpCalculatorMode = 'direct' | 'inverse';
export type XpCalculatorContextMode = 'personal' | 'simulation';
export type XpCalculatorUnit = 'time' | 'chars' | 'pages' | 'episodes';

export interface XpCalculatorRequest {
  mode: XpCalculatorMode;
  contextMode: XpCalculatorContextMode;
  type: ILog['type'];
  mediaId?: string;
  difficultyJiten?: number | null;
  input?: {
    time?: number;
    chars?: number;
    pages?: number;
    episodes?: number;
  };
  targetXp?: number;
  unit?: XpCalculatorUnit;
  simulation?: {
    categoryLevel?: number;
    consumedDifficultyJiten?: number | null;
    personalSpeedCph?: number | null;
  };
}

const LOG_TYPES: ILog['type'][] = [
  'light-novel', 'reading', 'anime', 'vn', 'video', 'manga', 'audio',
  'movie', 'other', 'tv show', 'game', 'book',
];

function validationError(message: string): never {
  throw apiError('common.validationError', 400, message);
}

function assertFiniteNonNegative(value: unknown, name: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    validationError(`${name} must be a finite non-negative number`);
  }
}

function supportsUnit(type: ILog['type'], unit: XpCalculatorUnit): boolean {
  if (type === 'other') return false;
  if (unit === 'time') return true;
  if (unit === 'chars') return READING_TYPES.includes(type);
  if (unit === 'pages') {
    return ['reading', 'light-novel', 'manga', 'book'].includes(type);
  }
  return unit === 'episodes' && (type === 'anime' || type === 'tv show');
}

function inputForUnit(
  type: ILog['type'],
  unit: XpCalculatorUnit,
  quantity: number
) {
  return { type, [unit]: quantity };
}

export async function calculateXpScenario(
  request: XpCalculatorRequest,
  user?: IUser
) {
  if (!request || !['direct', 'inverse'].includes(request.mode)) {
    validationError('mode must be direct or inverse');
  }
  if (!['personal', 'simulation'].includes(request.contextMode)) {
    validationError('contextMode must be personal or simulation');
  }
  if (!LOG_TYPES.includes(request.type)) validationError('Invalid log type');

  assertFiniteNonNegative(request.difficultyJiten, 'difficultyJiten');
  if (
    request.difficultyJiten !== undefined &&
    request.difficultyJiten !== null &&
    request.difficultyJiten > JITEN_MAX_DIFFICULTY
  ) {
    validationError(`difficultyJiten must be at most ${JITEN_MAX_DIFFICULTY}`);
  }

  const category = getLogCategory(request.type);
  let categoryLevel = 0;
  let consumedDifficulty: number | null = null;
  let personalSpeedCph: number | null = FALLBACK_READING_SPEED_CPH;

  if (request.contextMode === 'personal') {
    if (!user) throw apiError('auth.notAuthenticated', 401, 'Authentication required');
    let categoryXp = 0;
    if (category === 'reading') categoryXp = user.stats?.readingXp ?? 0;
    if (category === 'listening') categoryXp = user.stats?.listeningXp ?? 0;
    categoryLevel = continuousLevel(categoryXp ?? 0);
    consumedDifficulty = category
      ? await getUserConsumedDifficulty(user._id, category)
      : null;
    personalSpeedCph = category === 'reading'
      ? await getUserReadingSpeedCph(user._id, request.type)
      : null;
  } else {
    const simulation = request.simulation ?? {};
    assertFiniteNonNegative(simulation.categoryLevel, 'simulation.categoryLevel');
    assertFiniteNonNegative(
      simulation.consumedDifficultyJiten,
      'simulation.consumedDifficultyJiten'
    );
    assertFiniteNonNegative(simulation.personalSpeedCph, 'simulation.personalSpeedCph');
    if ((simulation.consumedDifficultyJiten ?? 0) > JITEN_MAX_DIFFICULTY) {
      validationError(
        `simulation.consumedDifficultyJiten must be at most ${JITEN_MAX_DIFFICULTY}`
      );
    }
    categoryLevel = simulation.categoryLevel ?? 0;
    consumedDifficulty = normalizeJitenDifficulty(
      simulation.consumedDifficultyJiten
    );
    personalSpeedCph = simulation.personalSpeedCph ?? FALLBACK_READING_SPEED_CPH;
  }

  let difficultyJiten = request.difficultyJiten ?? null;
  if (difficultyJiten === null && request.mediaId) {
    const media = await MediaBase.findOne({
      contentId: request.mediaId,
      type: request.type,
    })
      .select('jitenDifficulty')
      .lean();
    difficultyJiten = media?.jitenDifficulty ?? null;
  }
  const difficulty = normalizeJitenDifficulty(difficultyJiten);
  const context = {
    personalSpeedCph,
    difficulty,
    categoryLevel,
    consumedDifficulty,
  };

  let result;
  let quantity: number | null = null;
  if (request.mode === 'direct') {
    const input = request.input ?? {};
    for (const [key, value] of Object.entries(input)) {
      assertFiniteNonNegative(value, `input.${key}`);
    }
    result = computeXp({ type: request.type, ...input }, context);
  } else {
    assertFiniteNonNegative(request.targetXp, 'targetXp');
    if (!request.targetXp || request.targetXp <= 0) {
      validationError('targetXp must be greater than zero');
    }
    if (!request.unit || !supportsUnit(request.type, request.unit)) {
      validationError('Selected unit is not supported for this log type');
    }

    const computeAt = (candidate: number) =>
      computeXp(inputForUnit(request.type, request.unit!, candidate), context);
    let high = 1;
    while (computeAt(high).xp < request.targetXp && high < 1_000_000_000) {
      high *= 2;
    }
    if (computeAt(high).xp < request.targetXp) {
      validationError('Target XP is too large');
    }
    let low = 0;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (computeAt(mid).xp >= request.targetXp) high = mid;
      else low = mid + 1;
    }
    quantity = low;
    result = computeAt(quantity);
  }

  const comfort = result.breakdown.comfortAt ?? 0;
  return {
    ...result,
    context: {
      mode: request.contextMode,
      category,
      categoryLevel,
      consumedDifficultyJiten:
        consumedDifficulty === null ? null : consumedDifficulty / 20,
      personalSpeedCph: personalSpeedCph ?? FALLBACK_READING_SPEED_CPH,
      difficultyJiten,
      comfortJiten: comfort / 20,
      targetDifficultyJiten:
        (result.breakdown.targetDifficulty ?? comfort) / 20,
      bonusPercent: Math.round((result.breakdown.multiplier - 1) * 1000) / 10,
    },
    inverse:
      request.mode === 'inverse'
        ? { targetXp: request.targetXp, unit: request.unit, quantity }
        : null,
  };
}
