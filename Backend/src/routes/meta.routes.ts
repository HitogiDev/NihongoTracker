import { Router, Request, Response } from 'express';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';

const router = Router();

// Generate meta tags for different pages
router.get('/user/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select(
      'username totalXp level'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const metaTags = `
      <meta property="og:title" content="${username}'s Profile - NihongoTracker" />
      <meta property="og:description" content="Check out ${username}'s Japanese learning progress! Level ${user.stats.userLevel} with ${user.stats.userXp} XP." />
      <meta property="og:image" content="/og-image.png" />
      <meta property="og:url" content="https://yourdomain.com/user/${username}" />
    `;

    return res.json({ metaTags, user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/media/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const media = await MediaBase.findOne({ contentId: id, type });

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const metaTags = `
      <meta property="og:title" content="${media.title.contentTitleEnglish || media.title.contentTitleNative} - NihongoTracker" />
      <meta property="og:description" content="Track your progress for this ${type} on NihongoTracker!" />
      <meta property="og:image" content="${media.contentImage || '/og-image.png'}" />
      <meta property="og:url" content="https://yourdomain.com/${type}/${id}" />
    `;

    return res.json({ metaTags, media });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
