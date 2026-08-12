import Achievement from '../models/achievement.model.js';
import Log from '../models/log.model.js';
import UserAchievement from '../models/userAchievement.model.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  AVATAR_FRAMES,
  AvatarFrame,
  BANNER_EFFECTS,
  BannerEffect,
  PROFILE_ACCENTS,
  ProfileAccent,
  IUser,
  IUserCustomization,
  NAME_EFFECTS,
  NameEffect,
  SIGNATURE_STATS,
  SignatureStat,
} from '../types.js';
import { Types } from 'mongoose';

/**
 * Cosmetic unlock rules.
 *
 * Two currencies buy customization here: merit (level, achievements) and money
 * (an active Patreon tier). Everything is decided in this module so
 * the controller never has to reason about tiers, and so the "what can I equip"
 * endpoint and the write validation can never drift apart — both read the same
 * `CustomizationCapabilities`.
 */

/** Level needed for each metal avatar frame. */
const FRAME_LEVEL_REQUIREMENTS: Partial<Record<AvatarFrame, number>> = {
  bronze: 5,
  silver: 15,
  gold: 30,
};

/** Frames that animate — the paid-only ones. */
const PREMIUM_PLUS_FRAMES: AvatarFrame[] = ['sakura', 'neon', 'rainbow'];

/**
 * Frames reserved for the top tier alone. Unlike `PREMIUM_PLUS_FRAMES`, an
 * Enthusiast does not get these — they are the one cosmetic that separates
 * Consumer from the tier below it.
 */
const CONSUMER_ONLY_FRAMES: AvatarFrame[] = ['aura'];

/** Gradient/glow need any active tier; shimmer animates, so it costs more. */
const PREMIUM_PLUS_NAME_EFFECTS: NameEffect[] = ['shimmer'];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type CustomizationLockReason =
  | 'none'
  | 'patreon'
  | 'patreonPlus'
  /** Consumer tier specifically, not just "one of the higher tiers". */
  | 'patreonConsumer'
  | 'level'
  | 'achievement';

export interface CustomizationOption<T extends string> {
  value: T;
  unlocked: boolean;
  /** Why it is locked, so the UI can explain it without duplicating the rules. */
  lockReason: CustomizationLockReason;
  /** Level threshold behind `lockReason`, when there is one. */
  requirement?: number;
}

export interface CustomizationCapabilities {
  level: number;
  /** Any active Patreon tier. */
  isPremium: boolean;
  /** Enthusiast or Consumer — the tiers that unlock animated cosmetics. */
  isPremiumPlus: boolean;
  /** Consumer alone — the top tier's exclusive cosmetics. */
  isConsumer: boolean;
  /** Achievement `key`s the user has unlocked, usable as equippable titles. */
  unlockedTitleKeys: Set<string>;
}

export interface CustomizationOptions {
  nameEffects: CustomizationOption<NameEffect>[];
  avatarFrames: CustomizationOption<AvatarFrame>[];
  profileAccents: CustomizationOption<ProfileAccent>[];
  signatureStats: CustomizationOption<SignatureStat>[];
  bannerEffects: CustomizationOption<BannerEffect>[];
  /** Custom name colors are a paid extra on top of a name effect. */
  customNameColors: { unlocked: boolean; lockReason: CustomizationLockReason };
  titles: { key: string; rarity: string; unlockedAt: Date }[];
}

type PopulatedAchievement = { key?: string; rarity?: string };

export async function getCustomizationCapabilities(
  user: Pick<IUser, '_id' | 'stats' | 'patreon'>
): Promise<CustomizationCapabilities> {
  const tier = user.patreon?.tier ?? null;
  const isActive = Boolean(user.patreon?.isActive) && tier !== null;

  const unlockedTitleKeys = new Set(
    (await getUnlockedTitles(user._id)).map((title) => title.key)
  );

  return {
    level: user.stats?.userLevel ?? 1,
    isPremium: isActive,
    isPremiumPlus: isActive && (tier === 'enthusiast' || tier === 'consumer'),
    isConsumer: isActive && tier === 'consumer',
    unlockedTitleKeys,
  };
}

/**
 * Every achievement the user has unlocked, as title candidates. Secret
 * achievements are included on purpose — earning one is exactly the kind of
 * thing people want to show off.
 */
export async function getUnlockedTitles(
  userId: Types.ObjectId
): Promise<{ key: string; rarity: string; unlockedAt: Date }[]> {
  const unlocked = await UserAchievement.find({ user: userId })
    .populate<{ achievement: PopulatedAchievement }>({
      path: 'achievement',
      model: Achievement,
      select: 'key rarity',
    })
    .sort({ unlockedAt: -1 })
    .lean();

  return unlocked
    .filter((entry) => entry.achievement?.key)
    .map((entry) => ({
      key: entry.achievement.key as string,
      rarity: entry.achievement.rarity ?? 'common',
      unlockedAt: entry.unlockedAt,
    }));
}

function frameOption(
  frame: AvatarFrame,
  caps: CustomizationCapabilities
): CustomizationOption<AvatarFrame> {
  if (frame === 'none') {
    return { value: frame, unlocked: true, lockReason: 'none' };
  }

  const levelRequirement = FRAME_LEVEL_REQUIREMENTS[frame];
  if (levelRequirement !== undefined) {
    return {
      value: frame,
      unlocked: caps.level >= levelRequirement,
      lockReason: 'level',
      requirement: levelRequirement,
    };
  }

  if (CONSUMER_ONLY_FRAMES.includes(frame)) {
    return {
      value: frame,
      unlocked: caps.isConsumer,
      lockReason: 'patreonConsumer',
    };
  }

  return {
    value: frame,
    unlocked: caps.isPremiumPlus,
    lockReason: 'patreonPlus',
  };
}

/**
 * The theme accent is free at its default, paid as a preset, and paid at the
 * higher tiers when the user picks their own color.
 */
function accentUnlocked(
  accent: ProfileAccent,
  caps: CustomizationCapabilities
): boolean {
  if (accent === 'default') return true;
  if (accent === 'custom') return caps.isPremiumPlus;
  return caps.isPremium;
}

function accentLockReason(accent: ProfileAccent): CustomizationLockReason {
  if (accent === 'default') return 'none';
  if (accent === 'custom') return 'patreonPlus';
  return 'patreon';
}

function nameEffectOption(
  effect: NameEffect,
  caps: CustomizationCapabilities
): CustomizationOption<NameEffect> {
  if (effect === 'none') {
    return { value: effect, unlocked: true, lockReason: 'none' };
  }

  if (PREMIUM_PLUS_NAME_EFFECTS.includes(effect)) {
    return { value: effect, unlocked: caps.isPremiumPlus, lockReason: 'patreonPlus' };
  }

  return { value: effect, unlocked: caps.isPremium, lockReason: 'patreon' };
}

export async function listCustomizationOptions(
  user: Pick<IUser, '_id' | 'stats' | 'patreon'>
): Promise<CustomizationOptions> {
  const caps = await getCustomizationCapabilities(user);
  const titles = await getUnlockedTitles(user._id);

  return {
    nameEffects: NAME_EFFECTS.map((effect) => nameEffectOption(effect, caps)),
    avatarFrames: AVATAR_FRAMES.map((frame) => frameOption(frame, caps)),
    profileAccents: PROFILE_ACCENTS.map((accent) => ({
      value: accent,
      unlocked: accentUnlocked(accent, caps),
      lockReason: accentLockReason(accent),
    })),
    // Signature stats are free: cheap identity for everyone.
    signatureStats: SIGNATURE_STATS.map((stat) => ({
      value: stat,
      unlocked: true,
      lockReason: 'none' as const,
    })),
    bannerEffects: BANNER_EFFECTS.map((effect) => ({
      value: effect,
      unlocked: effect === 'none' || caps.isPremiumPlus,
      lockReason: effect === 'none' ? 'none' : 'patreonPlus',
    })),
    customNameColors: {
      unlocked: caps.isPremium,
      lockReason: caps.isPremium ? 'none' : 'patreon',
    },
    titles,
  };
}

function assertUnlocked(
  option: CustomizationOption<string> | undefined,
  field: string,
  value: string
) {
  if (!option) {
    throw apiError(
      'customization.invalidValue',
      400,
      `Unknown ${field} value: ${value}`
    );
  }

  if (!option.unlocked) {
    throw apiError(
      'customization.locked',
      403,
      `${field} "${value}" is not unlocked for this user`
    );
  }
}

function normalizeColor(value: unknown, field: string): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
    throw apiError(
      'customization.invalidColor',
      400,
      `${field} must be a #rrggbb hex color`
    );
  }

  return value.trim().toLowerCase();
}

/**
 * Merge a client patch onto the stored customization, rejecting anything the
 * user has not unlocked. Only the keys present in `patch` are touched, so the
 * settings UI can save one control at a time.
 */
export async function resolveCustomizationUpdate(
  user: Pick<IUser, '_id' | 'stats' | 'patreon' | 'customization'>,
  patch: Partial<IUserCustomization>
): Promise<IUserCustomization> {
  const options = await listCustomizationOptions(user);
  const current = user.customization ?? {};
  const next: IUserCustomization = {
    nameEffect: current.nameEffect ?? 'none',
    nameColor1: current.nameColor1 ?? '',
    nameColor2: current.nameColor2 ?? '',
    avatarFrame: current.avatarFrame ?? 'none',
    profileAccent: current.profileAccent ?? 'default',
    accentColor: current.accentColor ?? '',
    signatureStat: current.signatureStat ?? 'none',
    equippedTitle: current.equippedTitle ?? '',
    bannerEffect: current.bannerEffect ?? 'none',
  };

  if (patch.nameEffect !== undefined) {
    const option = options.nameEffects.find(
      (entry) => entry.value === patch.nameEffect
    );
    assertUnlocked(option, 'nameEffect', String(patch.nameEffect));
    next.nameEffect = patch.nameEffect;
  }

  if (patch.avatarFrame !== undefined) {
    const option = options.avatarFrames.find(
      (entry) => entry.value === patch.avatarFrame
    );
    assertUnlocked(option, 'avatarFrame', String(patch.avatarFrame));
    next.avatarFrame = patch.avatarFrame;
  }

  if (patch.profileAccent !== undefined) {
    const option = options.profileAccents.find(
      (entry) => entry.value === patch.profileAccent
    );
    assertUnlocked(option, 'profileAccent', String(patch.profileAccent));
    next.profileAccent = patch.profileAccent;
  }

  if (patch.accentColor !== undefined) {
    const color = normalizeColor(patch.accentColor, 'accentColor');
    if (color && !options.profileAccents.find((e) => e.value === 'custom')?.unlocked) {
      throw apiError(
        'customization.locked',
        403,
        'A custom accent color requires the Enthusiast or Consumer tier'
      );
    }
    next.accentColor = color;
  }

  // A custom accent with no color would render as the default anyway; asking
  // for one without the other is a client bug worth surfacing.
  if (next.profileAccent === 'custom' && !next.accentColor) {
    throw apiError(
      'customization.accentColorRequired',
      400,
      'A custom profile accent needs an accentColor'
    );
  }

  if (patch.signatureStat !== undefined) {
    const option = options.signatureStats.find(
      (entry) => entry.value === patch.signatureStat
    );
    assertUnlocked(option, 'signatureStat', String(patch.signatureStat));
    next.signatureStat = patch.signatureStat;
  }

  if (patch.bannerEffect !== undefined) {
    const option = options.bannerEffects.find(
      (entry) => entry.value === patch.bannerEffect
    );
    assertUnlocked(option, 'bannerEffect', String(patch.bannerEffect));
    next.bannerEffect = patch.bannerEffect;
  }

  if (patch.equippedTitle !== undefined) {
    const title = (patch.equippedTitle ?? '').trim();
    if (title && !options.titles.some((entry) => entry.key === title)) {
      throw apiError(
        'customization.titleNotUnlocked',
        403,
        `Achievement "${title}" is not unlocked for this user`
      );
    }
    next.equippedTitle = title;
  }

  if (patch.nameColor1 !== undefined || patch.nameColor2 !== undefined) {
    const color1 = normalizeColor(
      patch.nameColor1 ?? next.nameColor1,
      'nameColor1'
    );
    const color2 = normalizeColor(
      patch.nameColor2 ?? next.nameColor2,
      'nameColor2'
    );

    if ((color1 || color2) && !options.customNameColors.unlocked) {
      throw apiError(
        'customization.locked',
        403,
        'Custom name colors require an active Patreon tier'
      );
    }

    next.nameColor1 = color1;
    next.nameColor2 = color2;
  }

  // A name effect the user lost access to (expired tier) falls back to plain
  // text rather than silently keeping a paid cosmetic alive.
  const effectOption = options.nameEffects.find(
    (entry) => entry.value === next.nameEffect
  );
  if (effectOption && !effectOption.unlocked) {
    next.nameEffect = 'none';
  }

  return next;
}

/**
 * Strip cosmetics the user is no longer entitled to (tier expired, admin
 * revoked an achievement). Used when serving a profile so an expired supporter
 * does not keep a paid effect forever.
 */
export function sanitizeCustomizationForDisplay(
  customization: IUserCustomization | undefined,
  caps: Pick<
    CustomizationCapabilities,
    'isPremium' | 'isPremiumPlus' | 'isConsumer'
  >
): IUserCustomization {
  // Field by field rather than a spread: `customization` is a Mongoose
  // subdocument whose values live behind prototype getters, so spreading it
  // yields internals instead of the cosmetics.
  const value: IUserCustomization = {
    nameEffect: customization?.nameEffect ?? 'none',
    nameColor1: customization?.nameColor1 ?? '',
    nameColor2: customization?.nameColor2 ?? '',
    avatarFrame: customization?.avatarFrame ?? 'none',
    profileAccent: customization?.profileAccent ?? 'default',
    accentColor: customization?.accentColor ?? '',
    signatureStat: customization?.signatureStat ?? 'none',
    equippedTitle: customization?.equippedTitle ?? '',
    bannerEffect: customization?.bannerEffect ?? 'none',
  };

  if (!caps.isPremium && value.nameEffect && value.nameEffect !== 'none') {
    value.nameEffect = 'none';
  }

  if (
    !caps.isPremiumPlus &&
    value.nameEffect &&
    PREMIUM_PLUS_NAME_EFFECTS.includes(value.nameEffect)
  ) {
    value.nameEffect = 'none';
  }

  if (!caps.isPremium) {
    value.nameColor1 = '';
    value.nameColor2 = '';
    if (value.profileAccent && value.profileAccent !== 'default') {
      value.profileAccent = 'default';
    }
  }

  // A custom accent is a higher-tier perk: a lapsed Consumer keeps a preset
  // accent (still paid-for at the lower tier) but loses their own color.
  if (!caps.isPremiumPlus && value.profileAccent === 'custom') {
    value.profileAccent = 'default';
  }

  if (value.profileAccent !== 'custom') {
    value.accentColor = '';
  }

  if (
    !caps.isPremiumPlus &&
    value.avatarFrame &&
    PREMIUM_PLUS_FRAMES.includes(value.avatarFrame)
  ) {
    value.avatarFrame = 'none';
  }

  // Dropping from Consumer to Enthusiast keeps the animated frames but not the
  // top-tier-only one.
  if (
    !caps.isConsumer &&
    value.avatarFrame &&
    CONSUMER_ONLY_FRAMES.includes(value.avatarFrame)
  ) {
    value.avatarFrame = 'none';
  }

  if (!caps.isPremiumPlus && value.bannerEffect && value.bannerEffect !== 'none') {
    value.bannerEffect = 'none';
  }

  return value;
}

/** Capabilities of someone who owns everything money can buy. */
const FULL_PAID_ACCESS = {
  isPremium: true,
  isPremiumPlus: true,
  isConsumer: true,
} as const;

/**
 * What the stored customization has to become now that the user's paid access
 * changed, or `null` when it can stay as it is.
 *
 * `sanitizeCustomizationForDisplay` already hides cosmetics a lapsed supporter
 * no longer owns, but it never writes them back, and hiding is not enough: the
 * owner's own settings page would still show a locked option selected, and
 * every read path added later would have to remember to sanitize. When a tier
 * actually goes away the downgrade gets persisted — see the `pre('save')` hook
 * in `models/user.model.ts`, which is where this is called from.
 *
 * Both sides of the comparison go through the same sanitizer, once with full
 * access and once with the real one, so "what changed" can never drift from
 * "what is allowed".
 */
export function getCustomizationDowngrade(
  customization: IUserCustomization | undefined,
  patreon: IUser['patreon']
): IUserCustomization | null {
  const stored = sanitizeCustomizationForDisplay(
    customization,
    FULL_PAID_ACCESS
  );
  const allowed = sanitizeCustomizationForDisplay(
    customization,
    getDisplayCapabilities(patreon)
  );

  const keys = Object.keys(allowed) as (keyof IUserCustomization)[];
  const changed = keys.some((key) => allowed[key] !== stored[key]);

  return changed ? allowed : null;
}

/**
 * Values behind every signature stat. Hours/chars/log count need an aggregation
 * over the user's logs, so callers that only render a profile should ask for
 * the single stat the owner equipped (`computeSignatureValue`) instead.
 */
export async function computeSignatureValues(
  user: Pick<IUser, '_id' | 'stats'>
): Promise<Record<Exclude<SignatureStat, 'none'>, number>> {
  const [totals] = await Log.aggregate<{
    minutes: number;
    chars: number;
    logs: number;
  }>([
    { $match: { user: user._id } },
    {
      $group: {
        _id: null,
        minutes: { $sum: { $ifNull: ['$time', 0] } },
        chars: { $sum: { $ifNull: ['$chars', 0] } },
        logs: { $sum: 1 },
      },
    },
  ]);

  return {
    hours: Math.round(((totals?.minutes ?? 0) / 60) * 10) / 10,
    chars: totals?.chars ?? 0,
    logs: totals?.logs ?? 0,
    streak: user.stats?.currentStreak ?? 0,
    level: user.stats?.userLevel ?? 1,
    xp: user.stats?.userXp ?? 0,
  };
}

/**
 * The one signature value a profile needs, skipping the log aggregation
 * entirely for the stats that live on the user document.
 */
export async function computeSignatureValue(
  user: Pick<IUser, '_id' | 'stats'>,
  stat: SignatureStat | undefined,
  liveStreak?: number
): Promise<{ stat: SignatureStat; value: number } | null> {
  if (!stat || stat === 'none') return null;

  if (stat === 'streak') {
    return { stat, value: liveStreak ?? user.stats?.currentStreak ?? 0 };
  }
  if (stat === 'level') {
    return { stat, value: user.stats?.userLevel ?? 1 };
  }
  if (stat === 'xp') {
    return { stat, value: user.stats?.userXp ?? 0 };
  }

  const values = await computeSignatureValues(user);
  return { stat, value: values[stat] };
}

/** Cheap capability check for display paths that must not hit the DB. */
export function getDisplayCapabilities(
  patreon: IUser['patreon']
): Pick<
  CustomizationCapabilities,
  'isPremium' | 'isPremiumPlus' | 'isConsumer'
> {
  const tier = patreon?.tier ?? null;
  const isActive = Boolean(patreon?.isActive) && tier !== null;

  return {
    isPremium: isActive,
    isPremiumPlus: isActive && (tier === 'enthusiast' || tier === 'consumer'),
    isConsumer: isActive && tier === 'consumer',
  };
}
