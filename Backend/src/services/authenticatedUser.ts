import { IUser } from '../types.js';

export function serializeAuthenticatedUser(user: IUser) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    verified: user.verified,
    about: user.about,
    stats: user.stats,
    avatar: user.avatar,
    banner: user.banner,
    titles: user.titles,
    roles: user.roles,
    settings: user.settings,
    discordId: user.discordId ?? '',
    patreon: user.patreon,
    moderation: user.moderation,
    customization: user.customization ?? {},
  };
}
