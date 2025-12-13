import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import crypto from 'crypto';
import axios from 'axios';
import qs from 'qs';
import { IPatreonIdentityResponse } from '../types.js';

// Helper function to get backend and frontend URLs
function getUrls() {
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.PROD_DOMAIN?.replace(/\/$/, '') ||
    '';
  const frontendUrl =
    process.env.FRONTEND_URL ||
    process.env.PROD_DOMAIN?.replace(/\/$/, '') ||
    '';
  return { backendUrl, frontendUrl };
}

// Link Patreon account (user-initiated)
// NOTE: This method is deprecated. Users should use OAuth flow instead.
export async function linkPatreonAccount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { patreonEmail } = req.body;
    const user = res.locals.user;

    // Email is now optional - OAuth is the preferred method
    if (patreonEmail && typeof patreonEmail === 'string') {
      user.patreon = {
        ...user.patreon,
        patreonEmail: patreonEmail.toLowerCase().trim(),
        lastChecked: new Date(),
      };

      await user.save();

      res.status(200).json({
        message:
          'Patreon email saved. Please use OAuth flow for full verification and benefits.',
        patreon: {
          patreonEmail: user.patreon.patreonEmail,
          tier: user.patreon.tier,
          isActive: user.patreon.isActive,
        },
      });
    } else {
      return next(
        new customError(
          'Please use the OAuth flow to link your Patreon account',
          400
        )
      );
    }
  } catch (error) {
    next(error);
  }
}

// Unlink Patreon account
export async function unlinkPatreonAccount(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;

    user.patreon = {
      patreonId: undefined,
      patreonEmail: undefined,
      tier: null,
      isActive: false,
      lastChecked: new Date(),
    };

    await user.save();

    res.status(200).json({
      message: 'Patreon account unlinked successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Update custom badge text (Enthusiast+ only)
export async function updateCustomBadgeText(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { customBadgeText } = req.body;
    const user = res.locals.user;

    // Check if user has Enthusiast or Consumer tier
    if (
      !user.patreon?.isActive ||
      (user.patreon.tier !== 'enthusiast' && user.patreon.tier !== 'consumer')
    ) {
      return next(
        new customError(
          'Custom badge text is only available for Enthusiast and Consumer tier supporters',
          403
        )
      );
    }

    // Validate badge text length
    if (customBadgeText && customBadgeText.length > 20) {
      return next(
        new customError('Custom badge text must be 20 characters or less', 400)
      );
    }

    // Update custom badge text
    user.patreon.customBadgeText = customBadgeText?.trim() || '';
    await user.save();

    res.status(200).json({
      message: 'Custom badge text updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        discordId: user.discordId,
        about: user.about,
        stats: user.stats,
        avatar: user.avatar,
        banner: user.banner,
        titles: user.titles,
        roles: user.roles,
        settings: user.settings,
        patreon: user.patreon,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Update badge colors (Consumer only)
export async function updateBadgeColors(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { badgeColor, badgeTextColor } = req.body;
    const user = res.locals.user;

    // Check if user has Consumer tier
    if (!user.patreon?.isActive || user.patreon.tier !== 'consumer') {
      return next(
        new customError(
          'Custom badge colors are only available for Consumer tier supporters',
          403
        )
      );
    }

    // Validate color format (hex or special values)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const validSpecialColors = ['rainbow', 'primary', 'secondary'];
    const validTextColors = [
      'primary-content',
      'secondary-content',
      ...validSpecialColors,
    ];

    if (
      badgeColor &&
      badgeColor !== '' &&
      !hexColorRegex.test(badgeColor) &&
      !validSpecialColors.includes(badgeColor)
    ) {
      return next(
        new customError(
          'Badge color must be a valid hex color, "rainbow", "primary", or "secondary"',
          400
        )
      );
    }

    if (
      badgeTextColor &&
      badgeTextColor !== '' &&
      !hexColorRegex.test(badgeTextColor) &&
      !validTextColors.includes(badgeTextColor)
    ) {
      return next(
        new customError(
          'Badge text color must be a valid hex color, "primary-content", or "secondary-content"',
          400
        )
      );
    }

    // Update badge colors
    user.patreon.badgeColor = badgeColor?.trim() || '';
    user.patreon.badgeTextColor = badgeTextColor?.trim() || '';
    await user.save();

    res.status(200).json({
      message: 'Badge colors updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        discordId: user.discordId,
        about: user.about,
        stats: user.stats,
        avatar: user.avatar,
        banner: user.banner,
        titles: user.titles,
        roles: user.roles,
        settings: user.settings,
        patreon: user.patreon,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Patreon webhook handler
export async function handlePatreonWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers['x-patreon-signature'] as string;
    const webhookSecret = process.env.PATREON_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ PATREON_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    if (!signature) {
      console.error('❌ Missing X-Patreon-Signature header');
      return res.status(403).json({ error: 'Missing signature' });
    }

    // ✅ IMPORTANTE: req.body debe estar como string RAW para verificar firma
    // Express debe usar express.raw() o bodyParser.raw() para webhooks
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Verify webhook signature using MD5 HMAC
    const hmac = crypto.createHmac('md5', webhookSecret);
    const digest = hmac.update(rawBody).digest('hex');

    console.log('🔐 Webhook signature verification:', {
      received: signature,
      computed: digest,
      match: signature === digest,
      bodyLength: rawBody.length,
    });

    if (signature !== digest) {
      console.error('❌ Invalid webhook signature', {
        received: signature,
        expected: digest,
      });
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log('✅ Webhook signature valid');

    const event = req.body;
    const eventType = req.headers['x-patreon-event'] as string;

    console.log(`📬 Patreon webhook received: ${eventType}`);

    // Handle different webhook events
    switch (eventType) {
      case 'members:pledge:create':
      case 'members:pledge:update':
        await handlePledgeCreateOrUpdate(event);
        break;

      case 'members:pledge:delete':
        await handlePledgeDelete(event);
        break;

      default:
        console.log(`ℹ️  Unhandled webhook event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Patreon webhook error:', error);
    return next(error);
  }
}

async function handlePledgeCreateOrUpdate(event: any) {
  try {
    // Get user ID from the relationships (member event)
    const patronId = event.data?.relationships?.user?.data?.id;
    const patronEmail = event.data?.attributes?.email;
    const currentlyEntitledTiers =
      event.data?.relationships?.currently_entitled_tiers?.data || [];

    console.log('📥 Webhook received:', {
      eventType: 'pledge:create/update',
      event: JSON.stringify(event),
    });

    if (!patronId) {
      console.error('❌ No patron ID found in webhook event');
      return;
    }

    let tier: 'donator' | 'enthusiast' | 'consumer' | null = null;

    const included = event.included || [];
    for (const tierData of currentlyEntitledTiers) {
      const tierDetails = included.find(
        (item: any) => item.type === 'tier' && item.id === tierData.id
      );

      if (tierDetails?.attributes?.title) {
        const tierTitle = tierDetails.attributes.title.toLowerCase();

        // Map tier titles to internal tier names
        if (
          tierTitle.includes('consumer') ||
          tierTitle.includes('avid consumer')
        ) {
          tier = 'consumer';
          break; // Consumer is highest, use it if found
        } else if (
          tierTitle.includes('enthusiast') ||
          tierTitle.includes('immersion enthusiast')
        ) {
          tier = 'enthusiast';
        } else if (tierTitle.includes('donator') && !tier) {
          tier = 'donator';
        }
      }
    }

    // If no tier found but they have entitled tiers, log for debugging
    if (!tier && currentlyEntitledTiers.length > 0) {
      console.warn(
        'Could not determine tier from titles:',
        currentlyEntitledTiers.map((t: any) => {
          const details = included.find(
            (item: any) => item.type === 'tier' && item.id === t.id
          );
          return details?.attributes?.title;
        })
      );
    }

    const user = await User.findOne({
      'patreon.patreonId': patronId,
    });

    if (!user) {
      throw new customError('User not found', 404);
    }

    user.patreon = {
      ...user.patreon,
      patreonId: patronId,
      patreonEmail: patronEmail?.toLowerCase(),
      tier: tier,
      isActive: true,
      lastChecked: new Date(),
    };

    return await user.save();
  } catch (error) {
    console.error('Error handling pledge create/update:', error);
    return null;
  }
}

// Helper function to handle pledge deletion
async function handlePledgeDelete(event: any) {
  try {
    const patronId = event.data?.id;

    if (!patronId) {
      console.error('No patron ID found in webhook data');
      return;
    }

    // Find user by Patreon ID
    const user = await User.findOne({ 'patreon.patreonId': patronId });

    if (user) {
      user.patreon = {
        ...user.patreon,
        tier: null,
        isActive: false,
        lastChecked: new Date(),
      };

      await user.save();
      console.log(`Removed benefits for user: ${user.username}`);
    }
  } catch (error) {
    console.error('Error handling pledge delete:', error);
  }
}

// Get current Patreon status
export async function getPatreonStatus(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;

    res.status(200).json({
      patreonEmail: user.patreon?.patreonEmail,
      patreonId: user.patreon?.patreonId,
      tier: user.patreon?.tier,
      isActive: user.patreon?.isActive || false,
      lastChecked: user.patreon?.lastChecked,
      customBadgeText: user.patreon?.customBadgeText,
      badgeColor: user.patreon?.badgeColor,
      badgeTextColor: user.patreon?.badgeTextColor,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// OAUTH2 IMPLEMENTATION
// ============================================

/**
 * Initiate Patreon OAuth2 flow
 * Step 1: Generate authorization URL and redirect user to Patreon
 */
export async function initiatePatreonOAuth(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    const clientId = process.env.PATREON_CLIENT_ID;

    const { backendUrl } = getUrls();

    if (!backendUrl) {
      console.error('BACKEND_URL is not configured');
      return next(
        new customError('OAuth is not configured properly on this server', 500)
      );
    }

    const redirectUri = `${backendUrl}/api/patreon/oauth/callback`;

    if (!clientId) {
      return next(
        new customError('Patreon OAuth is not configured on this server', 500)
      );
    }

    // Generate state token to prevent CSRF attacks
    const state = crypto.randomBytes(32).toString('hex');

    oauthStateStore.set(state, {
      userId: user._id.toString(),
      createdAt: Date.now(),
    });

    cleanupOAuthStates();

    // Construct Patreon authorization URL
    const authUrl = new URL('https://www.patreon.com/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    // ✅ FIX: Agregar identity[email] explícitamente
    authUrl.searchParams.append(
      'scope',
      'identity identity[email] identity.memberships'
    );
    authUrl.searchParams.append('state', state);

    console.log(
      `🔗 OAuth initiated for user ${user.username}, redirect URI: ${redirectUri}`
    );

    res.status(200).json({
      authUrl: authUrl.toString(),
      message: 'Redirect user to this URL to authorize',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle Patreon OAuth2 callback
 * Step 2: Exchange authorization code for access token and user data
 */
export async function handlePatreonOAuthCallback(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  try {
    const { code, state } = req.query;
    const { backendUrl, frontendUrl } = getUrls();

    console.log('📨 OAuth callback received:', {
      code: !!code,
      state: !!state,
    });

    if (!code || !state) {
      console.error('❌ Missing code or state parameters');
      return res.redirect(
        `${frontendUrl}/settings?patreon=error&message=missing_params`
      );
    }

    // Verify state to prevent CSRF
    const stateData = oauthStateStore.get(state as string);
    if (!stateData) {
      console.error('❌ Invalid or expired state token');
      return res.redirect(
        `${frontendUrl}/settings?patreon=error&message=invalid_state`
      );
    }

    oauthStateStore.delete(state as string);

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = `${backendUrl}/api/patreon/oauth/callback`;

    if (!clientId || !clientSecret) {
      console.error('❌ OAuth credentials not configured');
      return res.redirect(
        `${frontendUrl}/settings?patreon=error&message=oauth_not_configured`
      );
    }

    console.log('🔄 Exchanging code for access token...');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://www.patreon.com/api/oauth2/token',
      qs.stringify({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log('✅ Access token obtained');

    console.log('🔄 Fetching user identity from Patreon...');

    const userFields = 'email,full_name,is_email_verified';
    const memberFields = 'patron_status,currently_entitled_amount_cents';
    const tierFields = 'title,amount_cents';

    const includes =
      'memberships,memberships.currently_entitled_tiers,memberships.campaign';

    const identityResponse = await axios.get<IPatreonIdentityResponse>(
      'https://www.patreon.com/api/oauth2/v2/identity',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        params: {
          'fields[user]': userFields,
          'fields[member]': memberFields,
          'fields[tier]': tierFields,
          include: includes,
        },
      }
    );

    console.log('✅ Patreon identity response received.');

    console.log(JSON.stringify(identityResponse.data, null, 2));

    const patreonData = identityResponse.data.data;
    const patreonId = patreonData.id;
    const patreonEmail = patreonData.attributes?.email;

    // Get membership information
    const memberships =
      identityResponse.data.included?.filter(
        (item) => item.type === 'member'
      ) || [];

    console.log(`👥 Found ${memberships.length} membership(s)`);

    // Find active membership (if any)
    const activeMembership = memberships.find(
      (membership) =>
        membership.attributes &&
        membership.relationships &&
        membership.relationships.campaign.data.id &&
        membership.relationships.campaign.data.id ===
          process.env.PATREON_CAMPAIGN_ID &&
        membership.attributes.patron_status === 'active_patron'
    );

    // Para acceder a los tiers:
    const tiers =
      identityResponse.data.included?.filter((item) => item.type === 'tier') ||
      [];

    const campaignTier = tiers.find((tier) => {
      return (
        activeMembership &&
        activeMembership.relationships?.currently_entitled_tiers?.data.some(
          (entitledTier) => entitledTier.id === tier.id
        )
      );
    });

    let campaignTierTitle: string | undefined | null =
      campaignTier?.attributes.title.toLowerCase();
    let tier: 'donator' | 'enthusiast' | 'consumer' | null = null;
    if (
      campaignTierTitle?.includes('consumer') ||
      campaignTierTitle?.includes('avid consumer')
    ) {
      tier = 'consumer';
    } else if (
      campaignTierTitle?.includes('enthusiast') ||
      campaignTierTitle?.includes('immersion enthusiast')
    ) {
      tier = 'enthusiast';
    } else if (campaignTierTitle?.includes('donator')) {
      tier = 'donator';
    }

    const isActive = !!activeMembership;

    console.log(
      `🎖️  User Patreon tier: ${tier || 'none'}, active: ${isActive}`
    );

    const existingUser = await User.findOne({
      'patreon.patreonId': patreonId,
      _id: { $ne: stateData.userId },
    });

    if (existingUser) {
      console.error(
        `❌ Patreon account already linked to user: ${existingUser.username}`
      );
      return res.redirect(
        `${frontendUrl}/settings?patreon=error&message=account_already_linked`
      );
    }

    const user = await User.findById(stateData.userId);

    if (!user) {
      console.error('❌ User not found:', stateData.userId);
      return res.redirect(
        `${frontendUrl}/settings?patreon=error&message=user_not_found`
      );
    }

    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    user.patreon = {
      ...user.patreon,
      patreonId,
      patreonEmail: patreonEmail?.toLowerCase() || undefined,
      patreonAccessToken: access_token,
      patreonRefreshToken: refresh_token,
      patreonTokenExpiry: tokenExpiry,
      tier,
      isActive,
      lastChecked: new Date(),
    };

    await user.save();

    console.log(
      `✅ OAuth Success: User "${user.username}" linked to Patreon ID ${patreonId}`,
      {
        tier: tier || 'none',
        isActive,
        email: patreonEmail ? 'provided' : 'not provided (ok)',
      }
    );

    // Redirect to frontend with success
    res.redirect(`${frontendUrl}/settings?patreon=success`);
  } catch (error: any) {
    console.error('❌ Patreon OAuth callback error:', {
      message: error.message,
      response: JSON.stringify(error.response?.data),
      status: error.response?.status,
    });
    const { frontendUrl } = getUrls();
    res.redirect(`${frontendUrl}/settings?patreon=error&message=oauth_failed`);
  }
}

/**
 * Refresh Patreon access token
 * Used when the access token expires
 */
export async function refreshPatreonToken(
  userId: string
): Promise<string | null> {
  try {
    const user = await User.findById(userId).select(
      '+patreon.patreonRefreshToken'
    );

    if (!user?.patreon?.patreonRefreshToken) {
      console.error('No refresh token available for user:', userId);
      return null;
    }

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Patreon OAuth not configured');
      return null;
    }

    const tokenResponse = await axios.post(
      'https://www.patreon.com/api/oauth2/token',
      {
        grant_type: 'refresh_token',
        refresh_token: user.patreon.patreonRefreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Update tokens
    user.patreon.patreonAccessToken = access_token;
    user.patreon.patreonRefreshToken = refresh_token;
    user.patreon.patreonTokenExpiry = new Date(Date.now() + expires_in * 1000);

    await user.save();

    console.log(`✅ Refreshed Patreon token for user: ${user.username}`);

    return access_token;
  } catch (error) {
    console.error('Error refreshing Patreon token:', error);
    return null;
  }
}

// ============================================
// OAUTH STATE MANAGEMENT
// ============================================

// In-memory store for OAuth states (use Redis in production)
const oauthStateStore = new Map<
  string,
  { userId: string; createdAt: number }
>();

// Clean up old OAuth states (older than 10 minutes)
function cleanupOAuthStates() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.createdAt < tenMinutesAgo) {
      oauthStateStore.delete(state);
    }
  }
}
