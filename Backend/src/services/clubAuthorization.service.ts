import { Types } from 'mongoose';
import { apiError } from '../i18n/errorCodes.js';
import {
  ClubPermission,
  ClubRole,
  IClub,
  IClubMember,
} from '../types.js';

const ROLE_PERMISSIONS: Record<Exclude<ClubRole, 'leader'>, ClubPermission[]> = {
  owner: [
    'manage_members',
    'moderate_content',
    'create_challenges',
    'manage_media',
    'pin_posts',
    'manage_settings',
  ],
  moderator: [
    'manage_members',
    'moderate_content',
    'create_challenges',
    'manage_media',
    'pin_posts',
  ],
  event_manager: ['create_challenges', 'manage_media'],
  member: [],
};

interface PopulatedMemberUser {
  _id: Types.ObjectId;
}

function memberUserId(member: IClubMember): Types.ObjectId {
  const populated = member.user as unknown as PopulatedMemberUser;
  return populated._id ?? member.user;
}

export function normalizeClubRole(role: ClubRole): Exclude<ClubRole, 'leader'> {
  return role === 'leader' ? 'owner' : role;
}

export function findActiveClubMember(
  club: Pick<IClub, 'members'>,
  userId: Types.ObjectId
): IClubMember | undefined {
  return club.members.find(
    (member) =>
      member.status === 'active' && memberUserId(member).equals(userId)
  );
}

export function hasClubPermission(
  member: IClubMember | undefined,
  permission: ClubPermission
): boolean {
  if (!member || member.status !== 'active') return false;
  return ROLE_PERMISSIONS[normalizeClubRole(member.role)].includes(permission);
}

export function requireClubMember(
  club: Pick<IClub, 'members'>,
  userId: Types.ObjectId
): IClubMember {
  const member = findActiveClubMember(club, userId);
  if (!member) {
    throw apiError('auth.forbidden', 403, 'Active club membership required');
  }
  return member;
}

export function requireClubPermission(
  club: Pick<IClub, 'members'>,
  userId: Types.ObjectId,
  permission: ClubPermission
): IClubMember {
  const member = requireClubMember(club, userId);
  if (!hasClubPermission(member, permission)) {
    throw apiError('auth.forbidden', 403, 'Insufficient club permissions');
  }
  return member;
}
