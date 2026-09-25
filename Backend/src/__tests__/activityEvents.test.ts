import { describe, expect, it, vi } from 'vitest';
import {
  buildLogActivityInput,
  isNotableImmersionLog,
  resolveImmersionActivityVisibility,
} from '../services/activityEvents.service.js';

vi.mock('../services/activity.service.js', () => ({
  createActivity: vi.fn(),
}));

describe('activity event policy', () => {
  it('always keeps a private source private', () => {
    expect(
      resolveImmersionActivityVisibility(
        {
          settings: {
            blurAdultContent: true,
            socialPrivacy: {
              profile: 'public',
              immersionActivity: 'followers',
              statistics: 'public',
            },
          },
        },
        true
      )
    ).toBe('private');
  });

  it('uses the account activity preference for public source logs', () => {
    expect(
      resolveImmersionActivityVisibility(
        {
          settings: {
            blurAdultContent: true,
            socialPrivacy: {
              profile: 'public',
              immersionActivity: 'followers',
              statistics: 'public',
            },
          },
        },
        false
      )
    ).toBe('followers');
  });

  it('marks sufficiently valuable sessions as notable', () => {
    expect(isNotableImmersionLog({ xp: 249, time: 120 })).toBe(false);
    expect(isNotableImmersionLog({ xp: 250, time: 30 })).toBe(true);
    expect(isNotableImmersionLog({ xp: 250, chars: 3000 })).toBe(true);
    expect(isNotableImmersionLog({ xp: 250, episodes: 2 })).toBe(true);
    expect(isNotableImmersionLog({ xp: 250, pages: 25 })).toBe(true);
    expect(isNotableImmersionLog({ xp: 250 })).toBe(false);
  });

  it('builds a historical activity with its source date and stable key', () => {
    const date = new Date('2024-03-10T12:00:00.000Z');
    const input = buildLogActivityInput(
      {
        _id: '65ed99c00000000000000001',
        user: '65ed99c00000000000000002',
        type: 'anime',
        episodes: 2,
        xp: 100,
        private: false,
        isAdult: false,
        date,
      } as never,
      {
        settings: {
          blurAdultContent: true,
          socialPrivacy: {
          profile: 'public',
          immersionActivity: 'followers',
          statistics: 'public',
          },
        },
      },
      'Historical show'
    );

    expect(input).toMatchObject({
      type: 'immersion_log',
      targetType: 'log',
      dedupeKey: 'log:65ed99c00000000000000001',
      occurredAt: date,
      visibility: 'followers',
      metadata: { mediaTitle: 'Historical show', episodes: 2 },
    });
  });

  it('does not create feed activity for logs with unknown dates', () => {
    const input = buildLogActivityInput(
      { unknownDate: true } as never,
      { settings: { blurAdultContent: true } }
    );
    expect(input).toBeNull();
  });
});
