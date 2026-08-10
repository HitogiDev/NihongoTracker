/**
 * customization.test.ts
 *
 * Tests the cosmetic unlock rules: what a user may equip, what the API must
 * reject, and what gets stripped when a Patreon tier lapses.
 *
 * Strategy: mock the three models the service touches (achievements the user
 * unlocked, and logs for signature totals) so the rules are tested on their
 * own, without a database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

// `vi.hoisted` so the mock factories below (which are hoisted above the imports)
// can read this without hitting the temporal dead zone.
const state = vi.hoisted(() => ({
  unlockedAchievements: [] as {
    achievement: { key: string; rarity: string };
    unlockedAt: Date;
  }[],
}));

vi.mock('../models/achievement.model.js', () => ({
  default: {},
}));

vi.mock('../models/userAchievement.model.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn(() => Promise.resolve(state.unlockedAchievements)),
    })),
  },
}));

vi.mock('../models/log.model.js', () => ({
  default: {
    aggregate: vi.fn(() =>
      Promise.resolve([{ minutes: 630, chars: 12345, logs: 42 }])
    ),
  },
}));

import {
  listCustomizationOptions,
  resolveCustomizationUpdate,
  sanitizeCustomizationForDisplay,
  computeSignatureValues,
  getDisplayCapabilities,
} from '../services/customization.js';

type TestUser = Parameters<typeof listCustomizationOptions>[0] & {
  customization?: Record<string, unknown>;
};

function makeUser(overrides?: {
  level?: number;
  longestStreak?: number;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  isActive?: boolean;
  customization?: Record<string, unknown>;
}): TestUser {
  return {
    _id: new Types.ObjectId(),
    stats: {
      userLevel: overrides?.level ?? 1,
      longestStreak: overrides?.longestStreak ?? 0,
      currentStreak: 0,
      userXp: 5000,
    },
    patreon: {
      tier: overrides?.tier ?? null,
      isActive: overrides?.isActive ?? false,
    },
    customization: overrides?.customization,
  } as unknown as TestUser;
}

beforeEach(() => {
  state.unlockedAchievements.length = 0;
});

describe('listCustomizationOptions', () => {
  it('locks metal frames until the level requirement is met', async () => {
    const options = await listCustomizationOptions(makeUser({ level: 15 }));
    const byValue = Object.fromEntries(
      options.avatarFrames.map((frame) => [frame.value, frame])
    );

    expect(byValue.bronze.unlocked).toBe(true);
    expect(byValue.silver.unlocked).toBe(true);
    expect(byValue.gold.unlocked).toBe(false);
    expect(byValue.gold.lockReason).toBe('level');
    expect(byValue.gold.requirement).toBe(30);
  });

  it('unlocks the streak frame from the longest streak, not the current one', async () => {
    const options = await listCustomizationOptions(
      makeUser({ longestStreak: 30 })
    );
    const streak = options.avatarFrames.find(
      (frame) => frame.value === 'streak'
    );

    expect(streak?.unlocked).toBe(true);
  });

  it('keeps animated frames and banner effects behind the higher tiers', async () => {
    const donator = await listCustomizationOptions(
      makeUser({ tier: 'donator', isActive: true })
    );
    const consumer = await listCustomizationOptions(
      makeUser({ tier: 'consumer', isActive: true })
    );

    const rainbowFor = (options: typeof donator) =>
      options.avatarFrames.find((frame) => frame.value === 'rainbow');

    expect(rainbowFor(donator)?.unlocked).toBe(false);
    expect(rainbowFor(donator)?.lockReason).toBe('patreonPlus');
    expect(rainbowFor(consumer)?.unlocked).toBe(true);

    expect(
      donator.bannerEffects.find((effect) => effect.value === 'snow')?.unlocked
    ).toBe(false);
    expect(
      consumer.bannerEffects.find((effect) => effect.value === 'snow')?.unlocked
    ).toBe(true);
  });

  it('gives every signature stat away for free', async () => {
    const options = await listCustomizationOptions(makeUser());
    expect(options.signatureStats.every((stat) => stat.unlocked)).toBe(true);
  });

  it('offers unlocked achievements as titles', async () => {
    state.unlockedAchievements.push({
      achievement: { key: 'century_club', rarity: 'epic' },
      unlockedAt: new Date('2026-01-01'),
    });

    const options = await listCustomizationOptions(makeUser());
    expect(options.titles).toEqual([
      {
        key: 'century_club',
        rarity: 'epic',
        unlockedAt: new Date('2026-01-01'),
      },
    ]);
  });
});

describe('resolveCustomizationUpdate', () => {
  it('rejects an option the user has not unlocked', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser({ level: 1 }), {
        avatarFrame: 'gold',
      })
    ).rejects.toMatchObject({ code: 'customization.locked', statusCode: 403 });
  });

  it('rejects a value that is not a known option', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser(), {
        nameEffect: 'sparkle' as never,
      })
    ).rejects.toMatchObject({ code: 'customization.invalidValue' });
  });

  it('rejects colors that are not #rrggbb', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser({ tier: 'consumer', isActive: true }), {
        nameColor1: 'red',
      })
    ).rejects.toMatchObject({ code: 'customization.invalidColor' });
  });

  it('rejects custom colors without an active tier', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser(), { nameColor1: '#ff0000' })
    ).rejects.toMatchObject({ code: 'customization.locked' });
  });

  it('rejects a title the user has not earned', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser(), { equippedTitle: 'century_club' })
    ).rejects.toMatchObject({ code: 'customization.titleNotUnlocked' });
  });

  it('only touches the keys present in the patch', async () => {
    const user = makeUser({
      level: 30,
      customization: { avatarFrame: 'gold', signatureStat: 'hours' },
    });

    const next = await resolveCustomizationUpdate(user, {
      signatureStat: 'streak',
    });

    expect(next.avatarFrame).toBe('gold');
    expect(next.signatureStat).toBe('streak');
  });

  it('drops a stored name effect the user can no longer afford', async () => {
    const user = makeUser({ customization: { nameEffect: 'shimmer' } });

    const next = await resolveCustomizationUpdate(user, {
      signatureStat: 'level',
    });

    expect(next.nameEffect).toBe('none');
  });

  it('keeps a custom accent behind the higher tiers', async () => {
    await expect(
      resolveCustomizationUpdate(makeUser({ tier: 'donator', isActive: true }), {
        profileAccent: 'custom',
        accentColor: '#123456',
      })
    ).rejects.toMatchObject({ code: 'customization.locked' });
  });

  it('accepts a custom accent with a color on the higher tiers', async () => {
    const next = await resolveCustomizationUpdate(
      makeUser({ tier: 'enthusiast', isActive: true }),
      { profileAccent: 'custom', accentColor: '#123456' }
    );

    expect(next.profileAccent).toBe('custom');
    expect(next.accentColor).toBe('#123456');
  });

  it('refuses a custom accent with no color behind it', async () => {
    await expect(
      resolveCustomizationUpdate(
        makeUser({ tier: 'consumer', isActive: true }),
        { profileAccent: 'custom' }
      )
    ).rejects.toMatchObject({ code: 'customization.accentColorRequired' });
  });

  it('allows preset accents on any active tier', async () => {
    const next = await resolveCustomizationUpdate(
      makeUser({ tier: 'donator', isActive: true }),
      { profileAccent: 'ocean' }
    );

    expect(next.profileAccent).toBe('ocean');
  });

  it('normalizes accepted colors to lowercase', async () => {
    const next = await resolveCustomizationUpdate(
      makeUser({ tier: 'consumer', isActive: true }),
      { nameColor1: '#AABBCC' }
    );

    expect(next.nameColor1).toBe('#aabbcc');
  });
});

describe('sanitizeCustomizationForDisplay', () => {
  const paid = {
    nameEffect: 'shimmer' as const,
    nameColor1: '#ff0000',
    nameColor2: '#00ff00',
    avatarFrame: 'rainbow' as const,
    profileAccent: 'ocean' as const,
    accentColor: '',
    signatureStat: 'hours' as const,
    equippedTitle: 'century_club',
    bannerEffect: 'snow' as const,
  };

  it('strips every paid cosmetic once the tier lapses', () => {
    const visible = sanitizeCustomizationForDisplay(paid, {
      isPremium: false,
      isPremiumPlus: false,
    });

    expect(visible.nameEffect).toBe('none');
    expect(visible.nameColor1).toBe('');
    expect(visible.avatarFrame).toBe('none');
    expect(visible.profileAccent).toBe('default');
    expect(visible.bannerEffect).toBe('none');
  });

  it('keeps merit-earned cosmetics for a lapsed supporter', () => {
    const visible = sanitizeCustomizationForDisplay(
      { ...paid, avatarFrame: 'gold' },
      { isPremium: false, isPremiumPlus: false }
    );

    expect(visible.avatarFrame).toBe('gold');
    expect(visible.signatureStat).toBe('hours');
    expect(visible.equippedTitle).toBe('century_club');
  });

  it('downgrades animated cosmetics for the lower tier', () => {
    const visible = sanitizeCustomizationForDisplay(paid, {
      isPremium: true,
      isPremiumPlus: false,
    });

    expect(visible.nameEffect).toBe('none');
    expect(visible.avatarFrame).toBe('none');
    expect(visible.bannerEffect).toBe('none');
    // Paid-but-not-animated cosmetics survive on any active tier.
    expect(visible.profileAccent).toBe('ocean');
    expect(visible.nameColor1).toBe('#ff0000');
  });

  it('downgrades a custom accent when the higher tier lapses', () => {
    const visible = sanitizeCustomizationForDisplay(
      { profileAccent: 'custom', accentColor: '#123456' },
      { isPremium: true, isPremiumPlus: false }
    );

    expect(visible.profileAccent).toBe('default');
    expect(visible.accentColor).toBe('');
  });

  it('drops a stale accent color left over on a preset accent', () => {
    const visible = sanitizeCustomizationForDisplay(
      { profileAccent: 'ocean', accentColor: '#123456' },
      { isPremium: true, isPremiumPlus: true }
    );

    expect(visible.accentColor).toBe('');
  });

  it('fills defaults when the user never customized anything', () => {
    const visible = sanitizeCustomizationForDisplay(undefined, {
      isPremium: true,
      isPremiumPlus: true,
    });

    expect(visible).toEqual({
      nameEffect: 'none',
      nameColor1: '',
      nameColor2: '',
      avatarFrame: 'none',
      profileAccent: 'default',
      accentColor: '',
      signatureStat: 'none',
      equippedTitle: '',
      bannerEffect: 'none',
    });
  });
});

describe('getDisplayCapabilities', () => {
  it('treats an inactive membership as no membership', () => {
    expect(
      getDisplayCapabilities({ tier: 'consumer', isActive: false })
    ).toEqual({ isPremium: false, isPremiumPlus: false });
  });

  it('separates the plain tier from the animated-cosmetics tiers', () => {
    expect(getDisplayCapabilities({ tier: 'donator', isActive: true })).toEqual({
      isPremium: true,
      isPremiumPlus: false,
    });
    expect(
      getDisplayCapabilities({ tier: 'enthusiast', isActive: true })
    ).toEqual({ isPremium: true, isPremiumPlus: true });
  });
});

describe('computeSignatureValues', () => {
  it('converts logged minutes into hours with one decimal', async () => {
    const values = await computeSignatureValues(makeUser({ level: 7 }));

    expect(values.hours).toBe(10.5);
    expect(values.chars).toBe(12345);
    expect(values.logs).toBe(42);
    expect(values.level).toBe(7);
  });
});
