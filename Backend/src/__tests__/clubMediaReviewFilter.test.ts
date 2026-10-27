import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { buildClubMediaReviewFilter } from '../services/activity.service.js';
import { IClub } from '../types.js';

type ClubInput = Pick<IClub, 'members' | 'currentMedia'>;

const active = new Types.ObjectId();
const pending = new Types.ObjectId();

function club(currentMedia: Partial<IClub['currentMedia'][number]>[]): ClubInput {
  return {
    members: [
      { user: active, role: 'member', joinedAt: new Date(), status: 'active' },
      { user: pending, role: 'member', joinedAt: new Date(), status: 'pending' },
    ],
    currentMedia: currentMedia as IClub['currentMedia'],
  } as ClubInput;
}

describe('buildClubMediaReviewFilter', () => {
  it('matches reviews by active members during each media period', () => {
    const filter = buildClubMediaReviewFilter(
      club([
        {
          mediaId: '154587',
          mediaType: 'anime',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2026-01-31T00:00:00Z'),
        },
      ])
    );

    expect(filter).toEqual({
      type: 'media_review',
      club: null,
      actor: { $in: [active] },
      $or: [
        {
          'metadata.mediaId': '154587',
          'metadata.mediaType': 'anime',
          occurredAt: {
            $gte: new Date('2026-01-01T00:00:00Z'),
            $lt: new Date('2026-02-01T00:00:00Z'),
          },
        },
      ],
    });
  });

  it('returns null when no club media has a media ID', () => {
    expect(
      buildClubMediaReviewFilter(
        club([
          {
            mediaType: 'vn',
            startDate: new Date('2026-01-01T00:00:00Z'),
            endDate: new Date('2026-01-31T00:00:00Z'),
          },
        ])
      )
    ).toBeNull();
  });
});
