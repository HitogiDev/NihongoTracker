import { Router, Request, Response } from 'express';

const router = Router();

const DEFAULT_ANDROID_APP_ID = 'app.nihongotracker.mobile';

/**
 * Android verifies App Links with this file. It lists the SHA-256 fingerprints
 * of the release signing certificate, including the Play App Signing key.
 */
router.get('/assetlinks.json', (_req: Request, res: Response) => {
  const fingerprints = (process.env.ANDROID_APP_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter(Boolean);
  if (!fingerprints.length) return res.status(404).end();

  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_APP_ID || DEFAULT_ANDROID_APP_ID,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
});

export default router;
