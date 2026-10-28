import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('../models/featureFlag.model.js', () => ({
  FEATURE_FLAGS: ['wrapped'],
  default: { find: mocks.find, updateOne: mocks.updateOne },
}));

function mockStored(flags: { key: string; enabled: boolean }[]) {
  mocks.find.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(flags) }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.updateOne.mockResolvedValue({});
});

describe('feature flags', () => {
  it('keeps flags off when nothing is stored', async () => {
    mockStored([]);
    const { getFeatureFlags } = await import(
      '../services/featureFlags.service.js'
    );
    expect(await getFeatureFlags()).toEqual({ wrapped: false });
  });

  it('reads stored values and ignores unknown keys', async () => {
    mockStored([
      { key: 'wrapped', enabled: true },
      { key: 'retired', enabled: true },
    ]);
    const { getFeatureFlags } = await import(
      '../services/featureFlags.service.js'
    );
    expect(await getFeatureFlags()).toEqual({ wrapped: true });
  });

  it('clears the cache after an update', async () => {
    mockStored([]);
    const { isFeatureEnabled, setFeatureFlag } = await import(
      '../services/featureFlags.service.js'
    );
    expect(await isFeatureEnabled('wrapped')).toBe(false);
    mockStored([{ key: 'wrapped', enabled: true }]);
    expect(await setFeatureFlag('wrapped', true)).toEqual({ wrapped: true });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { key: 'wrapped' },
      { $set: { enabled: true } },
      { upsert: true }
    );
  });
});
