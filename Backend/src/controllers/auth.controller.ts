import User from '../models/user.model.js';
import { Request, Response, NextFunction } from 'express';
import generateToken from '../libs/jwt.js';
import { ILogin, IRegister } from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendVerificationEmail,
} from '../mailtrap/emails.js';

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { username, email, password, passwordConfirmation }: IRegister =
    req.body;
  try {
    const userExists = await User.findOne({
      $or: [{ username: username }, { email: { $exists: true, $eq: email } }],
    }).collation({
      locale: 'en',
      strength: 2,
    });

    if (userExists) {
      throw new customError(
        'An user with that username or email already exists!',
        400
      );
    }

    if (password !== passwordConfirmation) {
      throw new customError('Passwords do not match!', 400);
    }

    const user = await User.create({
      username,
      password,
      email,
      verified: false,
      verificationToken: email
        ? Math.floor(100000 + Math.random() * 900000).toString()
        : undefined,
      verificationTokenExpiry: email
        ? new Date(Date.now() + 15 * 60 * 1000)
        : undefined,
    });

    if (!user) throw new customError('Invalid user data', 400);

    generateToken(res, user._id.toString());

    if (email && user.verificationToken)
      await sendVerificationEmail(email, user.verificationToken);

    return res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      stats: user.stats,
      avatar: user.avatar,
      banner: user.banner,
      titles: user.titles,
      roles: user.roles,
      patreon: user.patreon,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  const { login, password }: ILogin = req.body;
  try {
    if (!login || !password)
      throw new customError('Please provide username and password', 400);

    const user = await User.findOne({
      $or: [{ username: login }, { email: { $exists: true, $eq: login } }],
    }).collation({
      locale: 'en',
      strength: 2,
    });

    if (user && (await user.matchPassword(password))) {
      generateToken(res, user._id.toString());
      return res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        discordId: user.discordId,
        stats: user.stats,
        avatar: user.avatar,
        banner: user.banner,
        titles: user.titles,
        roles: user.roles,
        settings: user.settings,
        patreon: user.patreon,
      });
    } else {
      throw new customError('Incorrect login or password', 401);
    }
  } catch (error) {
    return next(error as customError);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({ message: 'User logged out' });
}

export async function verifyToken(_req: Request, res: Response) {
  res.status(200).json({
    valid: true,
    user: res.locals.user,
  });
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { token } = req.body;
  try {
    if (!token) {
      throw new customError('Token is required', 400);
    }
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      throw new customError('Invalid or expired token', 400);
    }
    if (user.verified) {
      throw new customError('Email is already verified', 400);
    }
    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();
    res.status(200).json({
      message: 'Email verified successfully!',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        stats: user.stats,
        avatar: user.avatar,
        banner: user.banner,
        titles: user.titles,
        roles: user.roles,
        settings: user.settings,
        discordId: user.discordId,
        patreon: user.patreon,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { email } = req.body;
  try {
    if (!email) {
      throw new customError('Email is required', 400);
    }
    const user = await User.findOne({
      email: { $exists: true, $eq: email },
    }).collation({
      locale: 'en',
      strength: 2,
    });
    if (!user) {
      throw new customError('No user found with that email', 404);
    }
    user.resetPasswordToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    user.resetPasswordTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await user.save();

    await sendPasswordResetEmail(
      email,
      process.env.NODE_ENV === 'production'
        ? `https://tracker.manabe.es/reset-password/${user.resetPasswordToken}`
        : `http://localhost:5173/reset-password/${user.resetPasswordToken}`
    );

    res.status(200).json({
      message: 'Password reset token generated and sent to email',
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { token } = req.params;
  const { password, passwordConfirmation } = req.body;

  try {
    if (!token) {
      throw new customError('Token is required', 400);
    }
    if (!password || !passwordConfirmation) {
      throw new customError(
        'Password and password confirmation are required',
        400
      );
    }
    if (password !== passwordConfirmation) {
      throw new customError('Passwords do not match', 400);
    }
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      throw new customError('Invalid or expired token', 400);
    }
    if (!user.email)
      throw new customError('User does not have an email set', 400);
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save();
    sendPasswordResetSuccessEmail(user.email);
    res.status(200).json({ message: 'Password has been reset successfully!' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function resendVerificationEmail(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;

    if (!user) {
      throw new customError('User not authenticated', 401);
    }

    if (!user.email) {
      throw new customError('User does not have an email set', 400);
    }

    if (user.verified) {
      throw new customError('Email is already verified', 400);
    }

    // Check if email was sent within the last 60 seconds
    if (user.lastVerificationEmailSent) {
      const timeSinceLastEmail =
        Date.now() - user.lastVerificationEmailSent.getTime();
      const cooldownPeriod = 60 * 1000; // 60 seconds in milliseconds

      if (timeSinceLastEmail < cooldownPeriod) {
        const remainingTime = Math.ceil(
          (cooldownPeriod - timeSinceLastEmail) / 1000
        );
        throw new customError(
          `Please wait ${remainingTime} seconds before requesting another email`,
          429
        );
      }
    }

    // Generate new verification token
    const crypto = await import('crypto');
    user.verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    user.lastVerificationEmailSent = new Date();

    await user.save();

    // Send verification email
    await sendVerificationEmail(user.email, user.verificationToken);

    res.status(200).json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Public stats endpoint for homepage/register page
export async function getPublicStats(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const Log = (await import('../models/log.model.js')).default;

    const [totalUsers, totalLogs, totalXpAgg] = await Promise.all([
      User.countDocuments(),
      Log.countDocuments(),
      User.aggregate([
        {
          $group: {
            _id: null,
            totalXp: { $sum: '$stats.userXp' },
          },
        },
      ]),
    ]);

    res.status(200).json({
      totalUsers,
      totalLogs,
      totalXp: totalXpAgg[0]?.totalXp || 0,
    });
  } catch (error) {
    return next(error as customError);
  }
}
