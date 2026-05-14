import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';
import { Club } from '../models/club.model.js';
import { ClubMediaVoting } from '../models/clubMediaVoting.model.js';
import Log from '../models/log.model.js';

const BOT_USER_AGENTS = [
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /WhatsApp/i,
  /TelegramBot/i,
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function buildTags(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
  themeColor?: string;
  siteName?: string;
}): string {
  const {
    title,
    description,
    image,
    url,
    type = 'website',
    themeColor = '#3b82f6',
    siteName = 'NihongoTracker',
  } = opts;

  const t = esc(title);
  const d = esc(description);
  const img = esc(image);
  const u = esc(url);
  const sn = esc(siteName);

  return `
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta name="theme-color" content="${esc(themeColor)}" />
  <meta property="og:site_name" content="${sn}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${u}" />
  <meta property="og:type" content="${esc(type)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />`.trim();
}

function mediaTypeLabel(raw: string): string {
  const map: Record<string, string> = {
    vn: 'Visual Novel',
    'tv-show': 'TV Show',
    'tv show': 'TV Show',
    anime: 'Anime',
    manga: 'Manga',
    movie: 'Movie',
    video: 'Video',
    reading: 'Reading',
    audio: 'Audio',
    game: 'Video Game',
    other: 'Other',
  };
  return map[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

function logMetricSummary(log: any): string {
  const parts: string[] = [];
  if (log.episodes)
    parts.push(`${log.episodes} ep${log.episodes !== 1 ? 's' : ''}`);
  if (log.pages) parts.push(`${log.pages} pages`);
  if (log.chars) parts.push(`${log.chars.toLocaleString()} chars`);
  if (log.time) parts.push(`${log.time} min`);
  if (log.xp) parts.push(`+${formatNumber(log.xp)} XP`);
  return parts.join(' · ');
}

// ─── per-route meta generators ────────────────────────────────────────────────

async function userMeta(
  username: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  const user = await User.findOne({ username })
    .collation({ locale: 'en', strength: 2 })
    .select('username stats avatar updatedAt');
  if (!user) return null;

  const v = user.updatedAt ? (user.updatedAt as Date).getTime() : Date.now();
  const image = `${protocol}://${host}/og-image/user/${encodeURIComponent(username)}?v=${v}`;

  const streak =
    user.stats.currentStreak > 0
      ? ` • 🔥 ${user.stats.currentStreak}d streak`
      : '';
  const description = `Level ${user.stats.userLevel} • ${formatNumber(user.stats.userXp)} XP${streak} • Japanese immersion tracker`;

  return buildTags({
    title: `${esc(username)}'s Profile — NihongoTracker`,
    description,
    image,
    url: `${protocol}://${host}${urlPath}`,
    type: 'profile',
    themeColor: '#3b82f6',
  });
}

async function mediaMeta(
  mediaType: string,
  mediaSlug: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  // Normalise URL segment (e.g. "tv-show" → "tv show")
  const dbType = mediaType.replace(/-/g, ' ');

  const media = await MediaBase.findOne({
    type: dbType,
    contentId: mediaSlug,
  }).select('title type contentImage coverImage isAdult');
  if (!media) return null;

  const title =
    media.title.contentTitleEnglish ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleNative ||
    '';
  // isAdult → use default OG image to avoid explicit content in embeds
  const image = (media as any).isAdult
    ? `${protocol}://${host}/og-image.png`
    : media.coverImage ||
      media.contentImage ||
      `${protocol}://${host}/og-image.png`;
  const typeLabel = mediaTypeLabel(media.type);
  const themeColors: Record<string, string> = {
    Anime: '#26b2f2',
    Manga: '#ee4466',
    Movie: '#f77118',
    'Visual Novel': '#3a70e4',
    'TV Show': '#f8b420',
    Reading: '#b34ce6',
    Video: '#2cc9a4',
    Audio: '#f2a15a',
    'Video Game': '#59c94e',
  };

  return buildTags({
    title: `${esc(title)} — NihongoTracker`,
    description: `Track your ${typeLabel} progress on NihongoTracker • Log episodes, pages, reading time and more`,
    image,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: themeColors[typeLabel] ?? '#3b82f6',
  });
}

async function clubMeta(
  clubId: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  const club = await Club.findById(clubId).select(
    'name description avatar banner members level totalXp'
  );
  if (!club) return null;

  const memberCount = club.members?.length ?? 0;
  const description = club.description
    ? `${esc(club.description.slice(0, 120))} • ${memberCount} members • Lv ${club.level}`
    : `${memberCount} members • Level ${club.level} • ${formatNumber(club.totalXp)} XP — Join on NihongoTracker`;

  return buildTags({
    title: `${esc(club.name)} — Club on NihongoTracker`,
    description,
    image: club.banner || club.avatar || `${protocol}://${host}/og-image.png`,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#8b5cf6',
  });
}

async function clubVotingMeta(
  clubId: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  // Find the most recent active or recent voting for this club
  const voting = await ClubMediaVoting.findOne({ club: clubId })
    .sort({ createdAt: -1 })
    .select(
      'title description mediaType status votingStartDate votingEndDate candidates club'
    );
  if (!voting) return clubMeta(clubId, protocol, host, urlPath);

  const club = await Club.findById(clubId).select('name banner avatar');
  const clubName = club?.name ?? 'Club';

  const typeLabel = mediaTypeLabel(voting.mediaType);
  const statusLabel: Record<string, string> = {
    setup: 'Setting up',
    suggestions_open: '💬 Suggestions Open',
    suggestions_closed: 'Suggestions Closed',
    voting_open: '🗳️ Voting Open Now',
    voting_closed: 'Voting Closed',
    completed: '✅ Completed',
  };
  const candidates = voting.candidates?.length ?? 0;
  const status = statusLabel[voting.status] ?? voting.status;
  const description = `${status} • ${candidates} ${typeLabel} candidate${candidates !== 1 ? 's' : ''} — Vote for the next ${clubName} ${typeLabel.toLowerCase()}`;

  return buildTags({
    title: `${esc(voting.title)} — ${esc(clubName)} Voting`,
    description,
    image: club?.banner || club?.avatar || `${protocol}://${host}/og-image.png`,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#f59e0b',
  });
}

async function clubVotingByIdMeta(
  clubId: string,
  votingId: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  const voting = await ClubMediaVoting.findOne({
    _id: votingId,
    club: clubId,
  }).select('title description mediaType status candidates club');
  if (!voting) return clubMeta(clubId, protocol, host, urlPath);

  const club = await Club.findById(clubId).select('name banner avatar');
  const clubName = club?.name ?? 'Club';

  const typeLabel = mediaTypeLabel(voting.mediaType);
  const statusLabel: Record<string, string> = {
    setup: 'Setting up',
    suggestions_open: '💬 Suggestions Open',
    suggestions_closed: 'Suggestions Closed',
    voting_open: '🗳️ Voting Open Now',
    voting_closed: 'Voting Closed',
    completed: '✅ Completed',
  };
  const candidates = voting.candidates?.length ?? 0;
  const status = statusLabel[voting.status] ?? voting.status;
  const description = `${status} • ${candidates} ${typeLabel} candidate${candidates !== 1 ? 's' : ''} — Vote for the next ${clubName} ${typeLabel.toLowerCase()}`;

  return buildTags({
    title: `${esc(voting.title)} — ${esc(clubName)} Voting`,
    description,
    image: club?.banner || club?.avatar || `${protocol}://${host}/og-image.png`,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#f59e0b',
  });
}

async function rankingMeta(
  protocol: string,
  host: string,
  urlPath: string
): Promise<string> {
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const image = `${protocol}://${host}/og-image.png`;

  return buildTags({
    title: `${monthName} ${year} Ranking — NihongoTracker`,
    description: `See who's at the top of the monthly Japanese immersion ranking on NihongoTracker • Compete with learners worldwide`,
    image,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#f59e0b',
  });
}

async function sharedLogMeta(
  logId: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  const log = await Log.findById(logId)
    .select('type mediaTitle xp episodes pages chars time user date')
    .populate<{
      user: { username: string; avatar: string };
    }>('user', 'username avatar');
  if (!log || log.private) return null;

  const username = (log.user as any)?.username ?? 'Someone';
  const typeLabel = mediaTypeLabel(log.type);
  const title = log.mediaTitle ?? typeLabel;
  const metric = logMetricSummary(log);
  const description = `${esc(username)} logged "${esc(title)}" (${typeLabel})${metric ? ' • ' + metric : ''} — NihongoTracker`;

  const image = `${protocol}://${host}/og-image.png`;

  return buildTags({
    title: `${esc(username)}'s ${typeLabel} Log — NihongoTracker`,
    description,
    image,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#10b981',
  });
}

async function reviewMeta(
  reviewId: string,
  protocol: string,
  host: string,
  urlPath: string
): Promise<string | null> {
  const MediaReview = (await import('../models/mediaReview.model.js')).default;
  const review = await MediaReview.findById(reviewId).select(
    'summary content rating mediaContentId mediaType'
  );
  if (!review) return null;

  // Look up the media to get its cover image and title
  const media = await MediaBase.findOne({
    contentId: review.mediaContentId,
    type: review.mediaType,
  }).select('title coverImage contentImage');

  const title = media
    ? media.title.contentTitleEnglish ||
      media.title.contentTitleRomaji ||
      media.title.contentTitleNative ||
      'Media'
    : 'Media';
  const stars = review.rating ? '⭐'.repeat(Math.round(review.rating)) : '';
  const summary = (review as any).summary ?? '';
  const image =
    media?.coverImage ||
    media?.contentImage ||
    `${protocol}://${host}/og-image.png`;

  return buildTags({
    title: `Review: ${esc(title)} ${stars} — NihongoTracker`,
    description: summary
      ? esc(summary)
      : `Community review for ${esc(title)} on NihongoTracker`,
    image,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#f59e0b',
  });
}

function defaultMeta(protocol: string, host: string, urlPath: string): string {
  return buildTags({
    title: 'NihongoTracker — Track Your Japanese Learning',
    description:
      'Track your Japanese immersion with anime, manga, reading, visual novels, and more! Compete in monthly rankings and join study clubs.',
    image: `${protocol}://${host}/og-image.png`,
    url: `${protocol}://${host}${urlPath}`,
    themeColor: '#3b82f6',
  });
}

// ─── router ───────────────────────────────────────────────────────────────────

async function generateMetaTags(
  urlPath: string,
  protocol: string,
  host: string
): Promise<string> {
  const base = `${protocol}://${host}`;
  const parsedUrl = new URL(urlPath, base);
  const normalizedPath = parsedUrl.pathname;
  const normalizedUrl = `${parsedUrl.pathname}${parsedUrl.search}`;
  const parts = normalizedPath.split('/').filter(Boolean);
  const votingId = parsedUrl.searchParams.get('voting');

  // /user/:username  (and sub-routes like /user/:username/stats)
  if (parts[0] === 'user' && parts[1]) {
    return (
      (await userMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /ranking
  if (parts[0] === 'ranking') {
    return rankingMeta(protocol, host, normalizedUrl);
  }

  // /clubs (list)
  if (parts[0] === 'clubs' && !parts[1]) {
    return buildTags({
      title: 'Study Clubs — NihongoTracker',
      description:
        'Join a Japanese study club on NihongoTracker! Read manga together, watch anime, and compete in group challenges.',
      image: `${base}/og-image.png`,
      url: `${base}${normalizedUrl}`,
      themeColor: '#8b5cf6',
    });
  }

  // /clubs/:clubId/media/:mediaId  (club media page — check before /clubs/:clubId)
  if (parts[0] === 'clubs' && parts[1] && parts[2] === 'media' && parts[3]) {
    return (
      (await clubMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /clubs/:clubId?voting=... (shared voting)
  if (parts[0] === 'clubs' && parts[1] && votingId) {
    return (
      (await clubVotingByIdMeta(
        parts[1],
        votingId,
        protocol,
        host,
        normalizedUrl
      )) ?? defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /clubs/:clubId/voting  or  /clubs/:clubId  with voting context
  if (parts[0] === 'clubs' && parts[1] && parts[2] === 'voting') {
    return (
      (await clubVotingMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /clubs/:clubId
  if (parts[0] === 'clubs' && parts[1]) {
    return (
      (await clubMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /shared-log/:logId
  if (parts[0] === 'shared-log' && parts[1]) {
    return (
      (await sharedLogMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /review/:reviewId
  if (parts[0] === 'review' && parts[1]) {
    return (
      (await reviewMeta(parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // /:mediaType/:mediaId  (anime, manga, movie, vn, video, tv-show, reading)
  const MEDIA_TYPES = new Set([
    'anime',
    'manga',
    'movie',
    'vn',
    'video',
    'tv-show',
    'reading',
    'game',
  ]);
  if (parts.length >= 2 && MEDIA_TYPES.has(parts[0])) {
    return (
      (await mediaMeta(parts[0], parts[1], protocol, host, normalizedUrl)) ??
      defaultMeta(protocol, host, normalizedUrl)
    );
  }

  // Static / informational pages
  const staticPages: Record<string, { title: string; description: string }> = {
    calculator: {
      title: 'XP Calculator — NihongoTracker',
      description:
        'Calculate how much XP your Japanese immersion activities are worth.',
    },
    features: {
      title: 'Features — NihongoTracker',
      description:
        'Explore everything NihongoTracker has to offer for tracking your Japanese learning journey.',
    },
    changelog: {
      title: 'Changelog — NihongoTracker',
      description:
        "See what's new in NihongoTracker — latest features, fixes and improvements.",
    },
    support: {
      title: 'Support — NihongoTracker',
      description: 'Get help with NihongoTracker or support the project.',
    },
    privacy: {
      title: 'Privacy Policy — NihongoTracker',
      description: 'NihongoTracker privacy policy.',
    },
    terms: {
      title: 'Terms of Service — NihongoTracker',
      description: 'NihongoTracker terms of service.',
    },
    login: {
      title: 'Log In — NihongoTracker',
      description:
        'Sign in to your NihongoTracker account and continue your Japanese immersion journey.',
    },
    register: {
      title: 'Join NihongoTracker',
      description:
        'Create a free account to start tracking your Japanese immersion with anime, manga, reading and more!',
    },
  };
  if (parts[0] && staticPages[parts[0]]) {
    const p = staticPages[parts[0]];
    return buildTags({
      title: p.title,
      description: p.description,
      image: `${base}/og-image.png`,
      url: `${base}${normalizedUrl}`,
    });
  }

  return defaultMeta(protocol, host, normalizedUrl);
}

// ─── middleware ───────────────────────────────────────────────────────────────

export async function metaTagsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (
    req.path.startsWith('/api') ||
    req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf)$/i)
  ) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_USER_AGENTS.some((re) => re.test(userAgent));
  if (!isBot) return next();

  try {
    const metaTags = await generateMetaTags(
      req.originalUrl,
      req.protocol,
      req.get('host') || ''
    );

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${metaTags}
</head>
<body>
  <h1>NihongoTracker</h1>
  <p>Track your Japanese immersion journey.</p>
</body>
</html>`);
  } catch {
    return next();
  }
}
