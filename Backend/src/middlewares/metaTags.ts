import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';

const BOT_USER_AGENTS = [
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /WhatsApp/i,
  /TelegramBot/i,
];

async function generateMetaTags(
  urlPath: string,
  protocol: string,
  host: string
): Promise<string> {
  const fullUrl = `${protocol}://${host}${urlPath}`;
  const pathParts = urlPath.split('/').filter(Boolean);

  if (pathParts[0] === 'user' && pathParts[1]) {
    const username = pathParts[1];
    const user = await User.findOne({ username })
      .collation({ locale: 'en', strength: 2 })
      .select('username stats avatar updatedAt');

    if (user) {
      // Add cache busting parameter based on last update time
      const lastUpdated = user.updatedAt
        ? user.updatedAt.getTime()
        : Date.now();
      const imageUrl = `${protocol}://${host}/og-image/user/${username}?v=${lastUpdated}`;

      return `
  <title>${username}'s Profile - NihongoTracker</title>
  <meta property="og:title" content="${username}'s Profile - NihongoTracker" />
  <meta property="og:description" content="Level ${user.stats.userLevel} • ${user.stats.userXp.toLocaleString()} XP • Check out ${username}'s Japanese learning journey!" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${username}'s Profile" />
  <meta name="twitter:description" content="Level ${user.stats.userLevel} • ${user.stats.userXp.toLocaleString()} XP" />
  <meta name="twitter:image" content="${imageUrl}" />
      `.trim();
    }
  }

  if (pathParts.length >= 2) {
    const mediaTypes = ['anime', 'manga', 'movie', 'vn', 'video', 'tv-show'];
    if (mediaTypes.includes(pathParts[0]) && pathParts[1]) {
      const mediaType = pathParts[0];
      const mediaSlug = pathParts[1];

      const media = await MediaBase.findOne({
        type: mediaType,
        contentId: mediaSlug,
      }).select('title type contentImage coverImage');

      if (media) {
        const imageUrl = media.coverImage || media.contentImage || '';
        const title =
          media.title.contentTitleRomaji ||
          media.title.contentTitleEnglish ||
          media.title.contentTitleNative;
        const typeLabel =
          media.type.charAt(0).toUpperCase() + media.type.slice(1);

        return `
  <title>${title} - NihongoTracker</title>
  <meta property="og:title" content="${title} - NihongoTracker" />
  <meta property="og:description" content="Track your ${typeLabel} progress • ${title}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="Track your ${typeLabel} progress" />
  <meta name="twitter:image" content="${imageUrl}" />`.trim();
      }
    }
  }

  const defaultImage = `${protocol}://${host}/og-image.png`;

  return `
  <title>NihongoTracker - Track Your Japanese Learning</title>
  <meta property="og:title" content="NihongoTracker" />
  <meta property="og:description" content="Track your Japanese immersion with anime, manga, reading, and more!" />
  <meta property="og:image" content="${defaultImage}" />
  <meta property="og:url" content="${fullUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="NihongoTracker" />
  <meta name="twitter:description" content="Track your Japanese learning journey" />
  <meta name="twitter:image" content="${defaultImage}" />
  `.trim();
}

export async function metaTagsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (
    req.path.startsWith('/api') ||
    req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json)$/i)
  ) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_USER_AGENTS.some((botRegex) => botRegex.test(userAgent));

  if (!isBot) {
    return next();
  }

  try {
    const metaTags = await generateMetaTags(
      req.path,
      req.protocol,
      req.get('host') || ''
    );

    const botsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${metaTags}
</head>
<body>
  <h1>NihongoTracker</h1>
  <p>This page is optimized for social media previews.</p>
</body>
</html>`;

    res.send(botsHTML);
    return;
  } catch (error) {
    return next();
  }
}
