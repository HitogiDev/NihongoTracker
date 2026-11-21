import { useState } from 'react';
import { ChevronLeft, ChevronRight, EyeOff, Images } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './ui/Modal';
import Button from './ui/Button';
import OfflineImage from './OfflineImage';
import { IMediaScreenshot } from '../types';

interface VnScreenshotGalleryProps {
  screenshots: IMediaScreenshot[];
  blurAdult: boolean;
}

/**
 * Show VNDB screenshots. The images load from the VNDB CDN, so the server
 * stores only their URLs.
 */
export default function VnScreenshotGallery({
  screenshots,
  blurAdult,
}: VnScreenshotGalleryProps) {
  const { t } = useTranslation('media');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (screenshots.length === 0) return null;

  const current = openIndex !== null ? screenshots[openIndex] : null;
  const step = (delta: number) =>
    setOpenIndex((index) =>
      index === null
        ? null
        : (index + delta + screenshots.length) % screenshots.length
    );

  return (
    <div className="card surface">
      <div className="card-body">
        <h2 className="card-title text-xl mb-2 flex items-center gap-2">
          <Images className="w-5 h-5" />
          {t('screenshots.title')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {screenshots.map((shot, index) => {
            const blurred = blurAdult && shot.isAdult;
            return (
              <button
                key={shot.url}
                type="button"
                className="relative aspect-video overflow-hidden rounded-box bg-base-300"
                onClick={() => setOpenIndex(index)}
                aria-label={t('screenshots.open', { index: index + 1 })}
              >
                <OfflineImage
                  src={shot.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className={`size-full object-cover ${blurred ? 'blur-md scale-110' : ''}`}
                />
                {blurred && (
                  <span className="absolute inset-0 flex items-center justify-center text-base-content">
                    <EyeOff className="w-5 h-5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-base-content/70 mt-2">
          {t('screenshots.source')}
        </p>
      </div>

      <Modal
        open={current !== null}
        onClose={() => setOpenIndex(null)}
        size="xl"
        title={
          openIndex !== null
            ? t('screenshots.counter', {
                index: openIndex + 1,
                total: screenshots.length,
              })
            : undefined
        }
      >
        {current && (
          <div className="flex flex-col gap-3">
            <OfflineImage
              src={current.url}
              alt=""
              className="w-full h-auto rounded-box"
            />
            {screenshots.length > 1 && (
              <div className="flex justify-between">
                <Button
                  appearance="ghost"
                  size="sm"
                  aria-label={t('screenshots.previous')}
                  onClick={() => step(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  appearance="ghost"
                  size="sm"
                  aria-label={t('screenshots.next')}
                  onClick={() => step(1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
