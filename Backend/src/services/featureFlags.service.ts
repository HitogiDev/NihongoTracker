import FeatureFlagModel, {
  FEATURE_FLAGS,
  FeatureFlag,
} from '../models/featureFlag.model.js';

export type FeatureFlags = Record<FeatureFlag, boolean>;

/** A flag without a stored document is off. */
const DEFAULT_FLAGS: FeatureFlags = { wrapped: false };
const CACHE_TTL_MS = 30_000;

let cache: { expiresAt: number; flags: FeatureFlags } | null = null;

export function isFeatureFlag(value: unknown): value is FeatureFlag {
  return (
    typeof value === 'string' &&
    (FEATURE_FLAGS as readonly string[]).includes(value)
  );
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (cache && cache.expiresAt > Date.now()) return cache.flags;
  const stored = await FeatureFlagModel.find().select('key enabled').lean();
  const flags = { ...DEFAULT_FLAGS };
  for (const flag of stored) {
    if (isFeatureFlag(flag.key)) flags[flag.key] = flag.enabled === true;
  }
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, flags };
  return flags;
}

export async function isFeatureEnabled(key: FeatureFlag): Promise<boolean> {
  return (await getFeatureFlags())[key];
}

export async function setFeatureFlag(
  key: FeatureFlag,
  enabled: boolean
): Promise<FeatureFlags> {
  await FeatureFlagModel.updateOne(
    { key },
    { $set: { enabled } },
    { upsert: true }
  );
  cache = null;
  return getFeatureFlags();
}
