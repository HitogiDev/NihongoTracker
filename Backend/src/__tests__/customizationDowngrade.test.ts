import { describe, expect, it } from 'vitest';
import User, {
  applyPatreonCustomizationDowngrade,
} from '../models/user.model.js';

/**
 * The wiring, as opposed to the rules (those live in `customization.test.ts`).
 *
 * Mongoose documents work without a connection, so this exercises the real
 * schema and the real subdocument getters — the parts a plain unit test of the
 * service would not touch.
 */
function makeSupporter() {
  const user = new User({
    username: 'supporter',
    password: 'password123',
    email: 'supporter@example.com',
    patreon: { tier: 'consumer', isActive: true },
    customization: {
      nameEffect: 'shimmer',
      nameColor1: '#ff0000',
      nameColor2: '#00ff00',
      avatarFrame: 'rainbow',
      profileAccent: 'custom',
      accentColor: '#123456',
      signatureStat: 'hours',
      equippedTitle: 'century_club',
      bannerEffect: 'snow',
    },
  });

  // Both are optional on `IUser` but always present here, and the aliases point
  // at the same objects the document holds, so writes through them count.
  return { user, patreon: user.patreon!, cosmetics: user.customization! };
}

describe('applyPatreonCustomizationDowngrade', () => {
  it('strips the paid cosmetics when the tier is cleared', () => {
    const { user, patreon } = makeSupporter();

    patreon.tier = null;
    patreon.isActive = false;

    expect(applyPatreonCustomizationDowngrade(user)).toBe(true);

    const after = user.customization!;
    expect(after.nameEffect).toBe('none');
    expect(after.nameColor1).toBe('');
    expect(after.avatarFrame).toBe('none');
    expect(after.profileAccent).toBe('default');
    expect(after.accentColor).toBe('');
    expect(after.bannerEffect).toBe('none');
  });

  it('also fires when the whole patreon object is replaced', () => {
    const { user, patreon } = makeSupporter();

    // How the webhook and the admin panel do it.
    user.patreon = { ...patreon, tier: null, isActive: false };

    expect(applyPatreonCustomizationDowngrade(user)).toBe(true);
    expect(user.customization!.avatarFrame).toBe('none');
  });

  it('keeps merit cosmetics the tier never paid for', () => {
    const { user, patreon, cosmetics } = makeSupporter();
    cosmetics.avatarFrame = 'gold';

    patreon.isActive = false;

    expect(applyPatreonCustomizationDowngrade(user)).toBe(true);

    const after = user.customization!;
    expect(after.avatarFrame).toBe('gold');
    expect(after.signatureStat).toBe('hours');
    expect(after.equippedTitle).toBe('century_club');
  });

  it('leaves an active supporter alone on unrelated saves', () => {
    const { user } = makeSupporter();
    user.username = 'renamed';

    expect(applyPatreonCustomizationDowngrade(user)).toBe(false);
    expect(user.customization!.avatarFrame).toBe('rainbow');
    expect(user.customization!.profileAccent).toBe('custom');
  });

  it('drops only the higher-tier perks when the tier steps down', () => {
    const { user, patreon, cosmetics } = makeSupporter();
    cosmetics.profileAccent = 'ocean';
    cosmetics.accentColor = '';

    patreon.tier = 'donator';

    expect(applyPatreonCustomizationDowngrade(user)).toBe(true);

    const after = user.customization!;
    // A preset accent is paid for by any active tier.
    expect(after.profileAccent).toBe('ocean');
    // The animated ones are not.
    expect(after.avatarFrame).toBe('none');
    expect(after.bannerEffect).toBe('none');
  });
});
