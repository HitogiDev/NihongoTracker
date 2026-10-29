import { useQuery } from '@tanstack/react-query';
import {
  BookOpenText,
  CloudOff,
  Download,
  ExternalLink,
  Gamepad2,
  KeyRound,
  MousePointerClick,
  Pickaxe,
  Tv,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../components/ui/PageContainer';
import { Skeleton } from '../components/ui/Skeleton';
import { BTN } from '../components/ui/buttons';

const COMPANION_REPO = 'HitogiDev/NihongoTrackerDesktopCompanion';
const RELEASES_URL = `https://github.com/${COMPANION_REPO}/releases/latest`;
const ISSUES_URL = `https://github.com/${COMPANION_REPO}/issues`;

type Platform = 'windows' | 'macos' | 'linux';

interface InstallerOption {
  id: 'exe' | 'dmg' | 'appimage' | 'deb';
  platform: Platform;
  suffix: string;
}

/** Match the file names that the companion release workflow uploads. */
const INSTALLERS: InstallerOption[] = [
  { id: 'exe', platform: 'windows', suffix: '_x64-setup.exe' },
  { id: 'dmg', platform: 'macos', suffix: '_universal.dmg' },
  { id: 'appimage', platform: 'linux', suffix: '_amd64.AppImage' },
  { id: 'deb', platform: 'linux', suffix: '_amd64.deb' },
];

const PLATFORMS: Platform[] = ['windows', 'macos', 'linux'];

const FEATURES = [
  { id: 'anime', icon: Tv },
  { id: 'novels', icon: BookOpenText },
  { id: 'games', icon: Gamepad2 },
  { id: 'mining', icon: Pickaxe },
  { id: 'offline', icon: CloudOff },
  { id: 'community', icon: Users },
] as const;

/** Show every image in `assets/desktop/`, sorted by file name. */
const SCREENSHOTS = Object.entries(
  import.meta.glob<string>('../assets/desktop/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

function ScreenshotGallery() {
  const { t } = useTranslation('desktop');
  const [active, setActive] = useState(0);

  if (SCREENSHOTS.length === 0) return null;

  return (
    <section className="space-y-3">
      <img
        src={SCREENSHOTS[active]}
        alt={t('screenshots.alt', { number: active + 1 })}
        className="w-full rounded-box border border-base-300 shadow-lg"
      />
      {SCREENSHOTS.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {SCREENSHOTS.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={t('screenshots.alt', { number: index + 1 })}
              aria-pressed={index === active}
              className={
                index === active
                  ? 'w-28 shrink-0 overflow-hidden rounded-box ring-2 ring-primary sm:w-36'
                  : 'w-28 shrink-0 overflow-hidden rounded-box opacity-60 transition-opacity hover:opacity-100 sm:w-36'
              }
            >
              <img src={url} alt="" className="aspect-video w-full object-cover" />
            </button>
          ))}
        </div>
      )}
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
  published_at: string;
  assets: ReleaseAsset[];
}

async function getLatestCompanionRelease(): Promise<Release> {
  // Use fetch, not the API axios instance, so no credentials go to GitHub.
  const response = await fetch(
    `https://api.github.com/repos/${COMPANION_REPO}/releases/latest`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return response.json();
}

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  // Phones report Linux or Mac OS in their user agents. The companion does not run on them.
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return null;
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export default function DesktopAppScreen() {
  const { t } = useTranslation('desktop');
  const platform = detectPlatform();

  const { data: release, isLoading } = useQuery({
    queryKey: ['companionRelease'],
    queryFn: getLatestCompanionRelease,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    meta: { persist: false },
  });

  const findAsset = (option: InstallerOption) =>
    release?.assets.find((asset) => asset.name.endsWith(option.suffix));

  const primaryOption = platform
    ? INSTALLERS.find((option) => option.platform === platform)
    : undefined;
  const primaryAsset = primaryOption ? findAsset(primaryOption) : undefined;
  const version = release?.tag_name.replace(/^v/, '');

  return (
    <PageContainer width="lg" className="space-y-12">
      <section className="flex flex-col items-center gap-6 pt-8 text-center sm:pt-12">
        <div className="space-y-3">
          <span className="badge badge-warning badge-outline">
            {t('beta.badge')}
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-base-content/70">
            {t('hero.subtitle')}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-12 w-64" />
          ) : primaryOption && primaryAsset ? (
            <a href={primaryAsset.browser_download_url} className={BTN.cta}>
              <Download className="size-5" />
              {t('hero.downloadFor', {
                platform: t(`platforms.${primaryOption.platform}`),
              })}
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
            {version && primaryAsset
              ? t('hero.versionWithSize', {
                  version,
                  size: formatSize(primaryAsset.size),
                })
              : version
                ? t('hero.version', { version })
                : t('hero.platforms')}
          </p>
        </div>

        <p className="max-w-xl text-sm text-base-content/60">
          {t('beta.notice')}{' '}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="link link-hover inline-flex items-center gap-1"
          >
            {t('beta.report')}
            <ExternalLink className="size-3.5" />
          </a>
        </p>
      </section>

      <ScreenshotGallery />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t('downloads.title')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((id) => (
            <div
              key={id}
              className={
                id === platform
                  ? 'surface p-5 ring-2 ring-primary/40'
                  : 'surface p-5'
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{t(`platforms.${id}`)}</h3>
                {id === platform && (
                  <span className="badge badge-primary badge-sm">
                    {t('downloads.detected')}
                  </span>
                )}
              </div>
              <p className="mb-4 text-sm text-base-content/60">
                {t(`downloads.requirements.${id}`)}
              </p>
              <div className="flex flex-col gap-2">
                {INSTALLERS.filter((option) => option.platform === id).map(
                  (option) => {
                    const asset = findAsset(option);
                    if (isLoading) {
                      return <Skeleton key={option.id} className="h-8 w-full" />;
                    }
                    return (
                      <a
                        key={option.id}
                        href={asset?.browser_download_url ?? RELEASES_URL}
                        target={asset ? undefined : '_blank'}
                        rel={asset ? undefined : 'noreferrer'}
                        className="btn btn-outline btn-sm justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Download className="size-4" />
                          {t(`downloads.formats.${option.id}`)}
                        </span>
                        {asset && (
                          <span className="text-xs font-normal text-base-content/60">
                            {formatSize(asset.size)}
                          </span>
                        )}
                      </a>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>
        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="link link-hover inline-flex items-center gap-1 text-sm text-base-content/70"
        >
          {t('downloads.allReleases')}
          <ExternalLink className="size-3.5" />
        </a>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t('features.title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ id, icon: Icon }) => (
            <div key={id} className="surface p-5">
              <Icon className="mb-3 size-6 text-primary" />
              <h3 className="mb-1 font-semibold">
                {t(`features.items.${id}.title`)}
              </h3>
              <p className="text-sm text-base-content/70">
                {t(`features.items.${id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface space-y-4 p-6">
        <h2 className="text-2xl font-bold">{t('setup.title')}</h2>
        <ol className="space-y-4">
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
              1
            </span>
            <div>
              <p className="font-semibold">{t('setup.install.title')}</p>
              <p className="text-sm text-base-content/70">
                {t('setup.install.description')}
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
              2
            </span>
            <div className="space-y-2">
              <p className="font-semibold">{t('setup.apiKey.title')}</p>
              <p className="text-sm text-base-content/70">
                {t('setup.apiKey.description')}
              </p>
              <Link to="/settings?tab=advanced" className={BTN.actionOutline}>
                <KeyRound className="size-4" />
                {t('setup.apiKey.action')}
              </Link>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
              3
            </span>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                {t('setup.immerse.title')}
                <MousePointerClick className="size-4 text-primary" />
              </p>
              <p className="text-sm text-base-content/70">
                {t('setup.immerse.description')}
              </p>
            </div>
          </li>
        </ol>
      </section>
    </PageContainer>
  );
}
