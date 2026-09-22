import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  hasClubPermission,
  normalizeClubRole,
} from '../services/clubAuthorization.service.js';
import { IClubMember } from '../types.js';

function member(role: IClubMember['role']): IClubMember {
  return {
    user: new Types.ObjectId(),
    role,
    status: 'active',
    joinedAt: new Date(),
  };
}

describe('club role authorization', () => {
  it('keeps legacy leaders equivalent to owners', () => {
    expect(normalizeClubRole('leader')).toBe('owner');
    expect(hasClubPermission(member('leader'), 'manage_settings')).toBe(true);
  });

  it('grants event managers event and media permissions only', () => {
    const eventManager = member('event_manager');
    expect(hasClubPermission(eventManager, 'create_challenges')).toBe(true);
    expect(hasClubPermission(eventManager, 'manage_media')).toBe(true);
    expect(hasClubPermission(eventManager, 'manage_members')).toBe(false);
    expect(hasClubPermission(eventManager, 'pin_posts')).toBe(false);
  });

  it('does not authorize inactive members', () => {
    const moderator = member('moderator');
    moderator.status = 'banned';
    expect(hasClubPermission(moderator, 'moderate_content')).toBe(false);
  });
});
