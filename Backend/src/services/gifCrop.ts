import sharp from 'sharp';
import { apiError } from '../i18n/errorCodes.js';

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
    throw apiError(
      'upload.fieldNotFinite',
      400,
      `${fieldName} must be a finite number`,
      { field: fieldName }
    );
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
    throw apiError(
      'upload.fieldNotJsonString',
      400,
      `${fieldName} must be a JSON string`,
      { field: fieldName }
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawValue) as Record<string, unknown>;
  } catch {
    throw apiError(
      'upload.fieldInvalidJson',
      400,
      `${fieldName} must be valid JSON`,
      { field: fieldName }
    );
  }

  const x = validateCropNumber(parsed.x, `${fieldName}.x`);
  const y = validateCropNumber(parsed.y, `${fieldName}.y`);
  const width = validateCropNumber(parsed.width, `${fieldName}.width`);
  const height = validateCropNumber(parsed.height, `${fieldName}.height`);

  if (x < 0 || y < 0) {
    throw apiError(
      'upload.fieldNegative',
      400,
      `${fieldName} coordinates must be 0 or greater`,
      { field: fieldName }
    );
  }

  if (width <= 0 || height <= 0) {
    throw apiError(
      'upload.fieldDimensionsPositive',
      400,
      `${fieldName} width and height must be greater than 0`,
      { field: fieldName }
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
    throw apiError(
      'upload.sourceDimensionPositive',
      400,
      `${fieldName}.sourceWidth must be greater than 0`,
      { field: `${fieldName}.sourceWidth` }
    );
  }

  if (sourceHeight !== undefined && sourceHeight <= 0) {
    throw apiError(
      'upload.sourceDimensionPositive',
      400,
      `${fieldName}.sourceHeight must be greater than 0`,
      { field: `${fieldName}.sourceHeight` }
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
    throw apiError(
      'upload.gifOnlyMetadata',
      400,
      'GIF crop metadata can only be used with GIF files'
    );
  }

  const sourceWidth = metadata.width;
  const sourceHeight = metadata.pageHeight ?? metadata.height;

  if (!sourceWidth || !sourceHeight) {
    throw apiError(
      'upload.gifDimensionsUnknown',
      400,
      'Could not determine GIF dimensions for cropping'
    );
  }

  const maxX = crop.x + crop.width;
  const maxY = crop.y + crop.height;

  if (maxX > sourceWidth || maxY > sourceHeight) {
    throw apiError(
      'upload.cropOutOfBounds',
      400,
      'Crop area exceeds GIF bounds. Please reselect the crop area and try again.'
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
    throw apiError('upload.gifCropFailed', 500, 'Failed to crop animated GIF');
  }
}

export function isGifFile(file: Express.Multer.File): boolean {
  return file.mimetype.toLowerCase() === GIF_MIME_TYPE;
}
