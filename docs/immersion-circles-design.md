# Immersion Circles technical design

Status: deferred from Phase 5 implementation. The earlier live presence and
lightweight club-session prototype was removed pending a future redesign.

## Decision

Immersion Circles introduce a separate membership lifecycle, invitations,
daily and weekly aggregation, removal rules, and privacy-sensitive summaries.
That is a larger domain than the existing club and TextHooker changes. The
earlier live presence and lightweight club-session prototype has been removed,
while circles stay as this implementation-ready design. This avoids weakening
privacy or shipping an untested second group-membership system.

## Reuse points

- Authentication: `protect` and `res.locals.user._id`.
- Privacy: `getVisibleSocialOwnerIds(..., category: 'statistics')` for daily
  and weekly totals. A circle membership never overrides this setting.
- Source data: `Log` for completed immersion. No client-submitted progress is
  stored.
- Authorization style: helpers parallel to `clubAuthorization.service.ts`, with
  no inline role checks in controllers.

## Proposed schema

`ImmersionCircle`

- `_id: ObjectId`
- `name: string`, trimmed, maximum 80 characters
- `owner: ObjectId<User>`
- `members: [{ user: ObjectId<User>, role: 'owner' | 'member', joinedAt }]`
- `pendingInvites: [{ user: ObjectId<User>, invitedBy, expiresAt }]`
- `maxMembers: number`, fixed to 8 for the initial release, never controlled by
  premium membership
- `createdAt`, `updatedAt`

Model guards:

- Validate `members.length <= 8` on create and save.
- A transaction or conditional update joins only where
  `members.7` does not exist, preventing concurrent joins beyond eight.
- Unique multikey membership cannot safely enforce one circle per user by
  itself. If that product rule is wanted, add `CircleMembership` with unique
  `{ user: 1 }`; otherwise use unique `{ circle: 1, user: 1 }`.

Indexes:

- `{ 'members.user': 1, updatedAt: -1 }` for a user's circles.
- `{ 'pendingInvites.user': 1, 'pendingInvites.expiresAt': 1 }` for invites.
- Optional normalized `{ name: 'text' }` for discovery only if public circle
  discovery is later approved.

## Proposed endpoints

- `POST /api/circles`: create with authenticated user as owner.
- `GET /api/circles`: list circles containing the authenticated user.
- `GET /api/circles/:circleId`: require authenticated membership, return the
  privacy-filtered consistency summary.
- `POST /api/circles/:circleId/invites`: owner invites a user.
- `POST /api/circles/:circleId/join`: authenticated invited user accepts.
- `DELETE /api/circles/:circleId/members/me`: authenticated user leaves.
- `DELETE /api/circles/:circleId/members/:memberId`: owner removes a member.

No endpoint accepts an acting user ID. The target member ID is used only for
owner removal or invitation, never as the caller identity.

## Summary aggregation

1. Load the circle and require authenticated membership.
2. Pass every member ID to `getVisibleSocialOwnerIds` with `statistics`.
3. Query `Log` only for returned IDs and the requested local-day or week window.
4. Group by user and local day in MongoDB, summing `time` and recording whether
   at least one log exists.
5. Return `immersedToday`, `todayMinutes`, `weeklyActiveDays`, and
   `groupConsistency` as a neutral group statistic. Do not sort members or emit
   ranks.

## Required implementation tests

- Reject the ninth member at model validation and conditional-update levels.
- Two concurrent eighth-member joins result in exactly eight members.
- A non-member cannot read, invite, join without an invite, remove, or leave on
  behalf of another user.
- Caller identity always comes from `res.locals.user._id`.
- Private and non-followed followers-only statistics never enter the Log query.
- Missing privacy settings preserve existing safe defaults.

## Explicit exclusions

No chat, rankings, XP, premium multipliers, seasons, scheduled events, or live
voice/video belong to the initial circles implementation.
