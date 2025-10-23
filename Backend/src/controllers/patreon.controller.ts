import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import crypto from 'crypto';
import axios from 'axios';

// Link Patreon account (user-initiated)
export async function linkPatreonAccount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { patreonEmail } = req.body;
    const user = res.locals.user;

    if (!patreonEmail) {
      return next(new customError('Patreon email is required', 400));
    }

    // Update user with Patreon email
    user.patreon = {
      ...user.patreon,
      patreonEmail: patreonEmail.toLowerCase(),
      lastChecked: new Date(),
    };

    await user.save();

    res.status(200).json({
      message:
        'Patreon account linked successfully. Benefits will be applied within 24 hours.',
      patreon: {
        patreonEmail: user.patreon.patreonEmail,
        tier: user.patreon.tier,
        isActive: user.patreon.isActive,
      },
    });
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
      console.error('PATREON_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const hmac = crypto.createHmac('md5', webhookSecret);
    const digest = hmac.update(JSON.stringify(req.body)).digest('hex');

    if (signature !== digest) {
      console.error('Invalid webhook signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventType = req.headers['x-patreon-event'] as string;

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
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
}

// Helper function to handle pledge creation/update
async function handlePledgeCreateOrUpdate(event: any) {
  try {
    const patronId = event.data?.id; // CRÍTICO: Usar ID de Patreon, no email
    const patronEmail = event.data?.attributes?.email;
    const pledgeAmountCents =
      event.data?.attributes?.currently_entitled_amount_cents || 0;

    if (!patronId) {
      return;
    }

    // Determine tier based on pledge amount
    let tier: 'donator' | 'enthusiast' | 'consumer' | null = null;
    if (pledgeAmountCents >= 1000) {
      // $10+
      tier = 'consumer';
    } else if (pledgeAmountCents >= 500) {
      // $5+
      tier = 'enthusiast';
    } else if (pledgeAmountCents >= 100) {
      // $1+
      tier = 'donator';
    }

    // ✅ SEGURIDAD: Buscar usuario por patreonId (único e imposible de falsificar)
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
    const redirectUri = `${process.env.BACKEND_URL}/api/patreon/oauth/callback`;

    if (!clientId) {
      return next(
        new customError('Patreon OAuth is not configured on this server', 500)
      );
    }

    // Generate state token to prevent CSRF attacks
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session or database temporarily (expires in 10 minutes)
    // For simplicity, we'll use a simple in-memory store
    // In production, use Redis or database
    oauthStateStore.set(state, {
      userId: user._id.toString(),
      createdAt: Date.now(),
    });

    // Clean up old states (older than 10 minutes)
    cleanupOAuthStates();

    // Construct Patreon authorization URL
    const authUrl = new URL('https://www.patreon.com/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', 'identity identity.memberships');
    authUrl.searchParams.append('state', state);

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

    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?patreon=error&message=missing_params`
      );
    }

    // Verify state to prevent CSRF
    const stateData = oauthStateStore.get(state as string);
    if (!stateData) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?patreon=error&message=invalid_state`
      );
    }

    // Remove used state
    oauthStateStore.delete(state as string);

    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = `${process.env.BACKEND_URL}/api/patreon/oauth/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?patreon=error&message=oauth_not_configured`
      );
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://www.patreon.com/api/oauth2/token',
      {
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user identity from Patreon
    const identityResponse = await axios.get(
      'https://www.patreon.com/api/oauth2/v2/identity',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        params: {
          'fields[user]': 'email,full_name',
          'fields[member]': 'currently_entitled_amount_cents,patron_status',
          include: 'memberships',
        },
      }
    );

    const patreonData = identityResponse.data.data;
    const patreonId = patreonData.id;
    const patreonEmail = patreonData.attributes.email;

    // Get membership information
    const memberships =
      identityResponse.data.included?.filter(
        (item: any) => item.type === 'member'
      ) || [];

    // Find active membership (if any)
    const activeMembership = memberships.find(
      (m: any) => m.attributes.patron_status === 'active_patron'
    );

    let tier: 'donator' | 'enthusiast' | 'consumer' | null = null;
    let isActive = false;

    if (activeMembership) {
      const pledgeAmountCents =
        activeMembership.attributes.currently_entitled_amount_cents || 0;
      isActive = true;

      // Determine tier based on pledge amount
      if (pledgeAmountCents >= 1000) {
        tier = 'consumer'; // $10+
      } else if (pledgeAmountCents >= 500) {
        tier = 'enthusiast'; // $5+
      } else if (pledgeAmountCents >= 100) {
        tier = 'donator'; // $1+
      }
    }

    // Check if this Patreon account is already linked to another user
    const existingUser = await User.findOne({
      'patreon.patreonId': patreonId,
      _id: { $ne: stateData.userId },
    });

    if (existingUser) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?patreon=error&message=account_already_linked`
      );
    }

    // Update user with Patreon data
    const user = await User.findById(stateData.userId);

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?patreon=error&message=user_not_found`
      );
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // TESTING: Force consumer tier (REMOVE IN PRODUCTION)
    tier = 'enthusiast';
    isActive = true;

    user.patreon = {
      ...user.patreon,
      patreonId,
      patreonEmail: patreonEmail.toLowerCase(),
      patreonAccessToken: access_token,
      patreonRefreshToken: refresh_token,
      patreonTokenExpiry: tokenExpiry,
      tier,
      isActive,
      lastChecked: new Date(),
    };

    await user.save();

    console.log(
      `✅ OAuth: User ${user.username} linked to Patreon ID ${patreonId} - Tier: ${tier}`
    );

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/settings?patreon=success`);
  } catch (error) {
    console.error('Patreon OAuth callback error:', error);
    res.redirect(
      `${process.env.FRONTEND_URL}/settings?patreon=error&message=oauth_failed`
    );
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
