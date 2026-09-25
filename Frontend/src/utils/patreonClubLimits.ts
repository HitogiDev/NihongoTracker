type PatreonTier = 'donator' | 'enthusiast' | 'consumer' | null | undefined;

type PatreonUserLike = {
  patreon?: {
    tier?: PatreonTier;
    isActive?: boolean;
  };
};

export const DEFAULT_CLUB_MEMBER_LIMIT = 100;
export const ENTHUSIAST_CLUB_MEMBER_LIMIT = 250;
export const CONSUMER_CLUB_MEMBER_LIMIT = 1000;

export function getUserPatreonTier(user?: PatreonUserLike | null): PatreonTier {
  // Treat explicitly inactive memberships as no active tier.
  if (user?.patreon?.isActive === false) {
    return null;
  }

  return user?.patreon?.tier ?? null;
}

export function getMaxClubMemberLimitForUser(
  user?: PatreonUserLike | null
): number {
  const tier = getUserPatreonTier(user);

  if (tier === 'consumer') {
    return CONSUMER_CLUB_MEMBER_LIMIT;
  }

  if (tier === 'enthusiast') {
    return ENTHUSIAST_CLUB_MEMBER_LIMIT;
  }

  return DEFAULT_CLUB_MEMBER_LIMIT;
}

export function getClubMemberLimitValidationMessage(
  maxAllowed: number
): string {
  if (maxAllowed >= CONSUMER_CLUB_MEMBER_LIMIT) {
    return `Member limit must be 1000 or less`;
  }

  return `Your current Patreon tier allows up to ${maxAllowed} club members`;
}
