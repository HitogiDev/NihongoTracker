import { useQuery } from '@tanstack/react-query';
import {
  BatteryFull,
  BellRing,
  CloudOff,
  Download,
  ExternalLink,
  LayoutGrid,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageContainer from '../components/ui/PageContainer';
import { Skeleton } from '../components/ui/Skeleton';
import { BTN } from '../components/ui/buttons';
import { DISCORD_URL } from '../constants/links';
import { isNativeApp } from '../utils/nativeRuntime';

const REPO = 'HitogiDev/NihongoTracker';
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const ISSUES_URL = `https://github.com/${REPO}/issues`;
// Match the tags and file names that .github/workflows/android-release.yml creates.
const TAG_PREFIX = 'android-v';
const APK_SUFFIX = '.apk';
const CHECKSUM_SUFFIX = '.apk.sha256';

const FEATURES = [
  { id: 'navigation', icon: LayoutGrid },
  { id: 'offline', icon: CloudOff },
  { id: 'notifications', icon: BellRing },
] as const;

const STEPS = ['download', 'allow', 'signIn'] as const;

/**
 * Show every image in `assets/android/`, sorted by file name.
 * The first image goes in the phone mockup. The others go in the gallery.
 */
const SCREENSHOTS = Object.entries(
  import.meta.glob<string>('../assets/android/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

/**
 * Draw an Android phone instead of the daisyUI mockup, which looks like an iPhone.
 * The screen keeps the 390x844 ratio of the screenshots.
 * The status bar and gesture bar fill the safe-area insets of the dark screenshot.
 */
function PhoneMockup() {
  const { t } = useTranslation('android');
  const [screenshot] = SCREENSHOTS;

  return (
    <div className="relative mx-auto w-60 sm:w-72 lg:w-80">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-0.5 top-[16%] h-[7%] w-1 rounded-r-sm bg-neutral" />
      <div className="absolute -right-0.5 top-[27%] h-[13%] w-1 rounded-r-sm bg-neutral" />
      <div className="relative rounded-[2.5rem] bg-neutral p-2.5 shadow-lg ring-1 ring-base-content/10">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[2rem] bg-base-100">
          {screenshot ? (
            <>
              <img
                src={screenshot}
                alt={t('screenshots.alt', { number: 1 })}
                className="size-full object-cover"
              />
              <div className="absolute inset-x-0 top-0 flex h-[5.2%] items-center justify-between px-[8%] text-[0.6rem] font-medium text-white/90 sm:text-xs">
                <span>12:30</span>
                <span className="flex items-center gap-1">
                  <Signal className="size-3" />
                  <Wifi className="size-3" />
                  <BatteryFull className="size-3.5" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-[1%] mx-auto h-1 w-1/3 rounded-full bg-white/60" />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <img src="/favicon.png" alt="" className="size-20 rounded-box" />
              <p className="text-xl font-bold">NihongoTracker</p>
            </div>
          )}
          <div className="absolute left-1/2 top-[1.4%] size-3 -translate-x-1/2 rounded-full bg-black ring-2 ring-white/5 sm:size-3.5" />
        </div>
      </div>
    </div>
  );
}

function ScreenshotStrip() {
  const { t } = useTranslation('android');
  const extra = SCREENSHOTS.slice(1);

  if (extra.length === 0) return null;

  return (
    <section className="flex gap-4 overflow-x-auto pb-2">
      {extra.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={t('screenshots.alt', { number: index + 2 })}
          loading="lazy"
          className="w-44 shrink-0 rounded-box border border-base-300 shadow-sm sm:w-52"
        />
      ))}
    </section>
  );
}

interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

async function getLatestAndroidRelease(): Promise<Release | null> {
  // Use fetch, not the API axios instance, so no credentials go to GitHub.
  // The repository can hold other releases, so do not use /releases/latest.
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=20`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  const releases: Release[] = await response.json();
  return (
    releases.find(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        release.tag_name.startsWith(TAG_PREFIX)
    ) ?? null
  );
}

function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export default function AndroidAppScreen() {
  const { t } = useTranslation('android');
  const [onAndroid] = useState(isAndroidDevice);
  const inApp = isNativeApp();

  const { data: release, isLoading } = useQuery({
    queryKey: ['androidRelease'],
    queryFn: getLatestAndroidRelease,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    meta: { persist: false },
  });

  const apk = release?.assets.find((asset) => asset.name.endsWith(APK_SUFFIX));
  const checksum = release?.assets.find((asset) =>
    asset.name.endsWith(CHECKSUM_SUFFIX)
  );
  const version = release?.tag_name.slice(TAG_PREFIX.length);

  return (
    <PageContainer width="lg" className="space-y-16">
      <section className="grid items-center gap-12 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <span className="badge badge-warning badge-outline">
            {t('beta.badge')}
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('hero.title')}
          </h1>
          <p className="max-w-xl text-lg text-base-content/70">
            {t('hero.subtitle')}
          </p>

          {inApp ? (
            <div className="alert alert-success max-w-xl">
              <Smartphone className="size-5" />
              <span>{t('hero.inApp')}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 lg:items-start">
              {isLoading ? (
                <Skeleton className="h-12 w-64" />
              ) : apk ? (
                <a href={apk.browser_download_url} className={BTN.cta}>
                  <Download className="size-5" />
                  {t('hero.download')}
                </a>
              ) : (
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={BTN.cta}
                >
                  <Download className="size-5" />
                  {t('hero.downloadLatest')}
                </a>
              )}
              <p className="text-sm text-base-content/60">
                {version && apk
                  ? t('hero.versionWithSize', {
                      version,
                      size: formatSize(apk.size),
                    })
                  : t('hero.requirements')}
              </p>
              {!onAndroid && (
                <p className="max-w-md text-sm text-base-content/60">
                  {t('hero.openOnPhone')}
                </p>
              )}
            </div>
          )}

          <p className="max-w-xl text-sm text-base-content/60">
            {t('beta.notice')}{' '}
            {t('beta.report')}{' '}
            <a
              href={ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="link link-hover inline-flex items-center gap-1"
            >
              GitHub
              <ExternalLink className="size-3.5" />
            </a>{' '}
            {t('beta.or')}{' '}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="link link-hover inline-flex items-center gap-1"
            >
              Discord
              <ExternalLink className="size-3.5" />
            </a>
          </p>
        </div>

        <PhoneMockup />
      </section>

      <section className="space-y-6">
        <h2 className="text-center text-3xl font-bold">{t('features.title')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ id, icon: Icon }) => (
            <div key={id} className="surface p-6">
              <div className="mb-4 flex size-12 items-center justify-center rounded-box bg-primary/15 text-primary">
                <Icon className="size-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t(`features.items.${id}.title`)}
              </h3>
              <p className="text-sm text-base-content/70">
                {t(`features.items.${id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ScreenshotStrip />

      <section className="space-y-6">
        <h2 className="text-center text-3xl font-bold">{t('setup.title')}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((id, index) => (
            <li key={id} className="surface-muted p-6">
              <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-content">
                {index + 1}
              </span>
              <p className="mb-2 font-semibold">{t(`setup.${id}.title`)}</p>
              <p className="text-sm text-base-content/70">
                {t(`setup.${id}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface p-6">
          <h3 className="mb-2 font-semibold">{t('updates.title')}</h3>
          <p className="text-sm text-base-content/70">
            {t('updates.description')}
          </p>
        </div>
        <div className="surface p-6">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            {t('safety.title')}
          </h3>
          <p className="mb-3 text-sm text-base-content/70">
            {t('safety.description')}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {checksum && (
              <a
                href={checksum.browser_download_url}
                className="link link-hover inline-flex items-center gap-1 text-base-content/70"
              >
                {t('safety.checksum')}
                <Download className="size-3.5" />
              </a>
            )}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="link link-hover inline-flex items-center gap-1 text-base-content/70"
            >
              {t('safety.allReleases')}
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
