import sharp from 'sharp';
import { customError } from '../middlewares/errorMiddleware.js';

export type GifCropMetadata = {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
};

const GIF_MIME_TYPE = 'image/gif';

function validateCropNumber(value: unknown, fieldName: string): number {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new customError(`${fieldName} must be a finite number`, 400);
  }
  return Math.round(parsedValue);
}

export function parseGifCropMetadata(
  rawValue: unknown,
  fieldName: 'avatarCrop' | 'bannerCrop'
): GifCropMetadata | null {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  if (typeof rawValue !== 'string') {
    throw new customError(`${fieldName} must be a JSON string`, 400);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawValue) as Record<string, unknown>;
  } catch {
    throw new customError(`${fieldName} must be valid JSON`, 400);
  }

  const x = validateCropNumber(parsed.x, `${fieldName}.x`);
  const y = validateCropNumber(parsed.y, `${fieldName}.y`);
  const width = validateCropNumber(parsed.width, `${fieldName}.width`);
  const height = validateCropNumber(parsed.height, `${fieldName}.height`);

  if (x < 0 || y < 0) {
    throw new customError(`${fieldName} coordinates must be 0 or greater`, 400);
  }

  if (width <= 0 || height <= 0) {
    throw new customError(
      `${fieldName} width and height must be greater than 0`,
      400
    );
  }

  const sourceWidth =
    parsed.sourceWidth !== undefined
      ? validateCropNumber(parsed.sourceWidth, `${fieldName}.sourceWidth`)
      : undefined;
  const sourceHeight =
    parsed.sourceHeight !== undefined
      ? validateCropNumber(parsed.sourceHeight, `${fieldName}.sourceHeight`)
      : undefined;

  if (sourceWidth !== undefined && sourceWidth <= 0) {
    throw new customError(
      `${fieldName}.sourceWidth must be greater than 0`,
      400
    );
  }

  if (sourceHeight !== undefined && sourceHeight <= 0) {
    throw new customError(
      `${fieldName}.sourceHeight must be greater than 0`,
      400
    );
  }

  return {
    x,
    y,
    width,
    height,
    sourceWidth,
    sourceHeight,
  };
}

export async function cropAnimatedGifBuffer(
  buffer: Buffer,
  crop: GifCropMetadata
): Promise<Buffer> {
  const metadata = await sharp(buffer, { animated: true }).metadata();

  if ((metadata.format ?? '').toLowerCase() !== 'gif') {
    throw new customError(
      'GIF crop metadata can only be used with GIF files',
      400
    );
  }

  const sourceWidth = metadata.width;
  const sourceHeight = metadata.pageHeight ?? metadata.height;

  if (!sourceWidth || !sourceHeight) {
    throw new customError(
      'Could not determine GIF dimensions for cropping',
      400
    );
  }

  const maxX = crop.x + crop.width;
  const maxY = crop.y + crop.height;

  if (maxX > sourceWidth || maxY > sourceHeight) {
    throw new customError(
      'Crop area exceeds GIF bounds. Please reselect the crop area and try again.',
      400
    );
  }

  try {
    return await sharp(buffer, { animated: true })
      .extract({
        left: crop.x,
        top: crop.y,
        width: crop.width,
        height: crop.height,
      })
      .gif({
        effort: 7,
        loop: metadata.loop ?? 0,
        delay: metadata.delay,
      })
      .toBuffer();
  } catch (error) {
    console.error('Animated GIF crop failed:', error);
    throw new customError('Failed to crop animated GIF', 500);
  }
}

export function isGifFile(file: Express.Multer.File): boolean {
  return file.mimetype.toLowerCase() === GIF_MIME_TYPE;
}
