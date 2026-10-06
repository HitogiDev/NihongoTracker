import { Image, Palette, Type, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserDataStore } from '../store/userData';
import type {
  AvatarFrame,
  BannerEffect,
  IUserCustomization,
  NameEffect,
} from '../types';
import { getNameEffectRender } from '../utils/customization';
import { DEFAULT_CONSTELLATION_COLOR } from '../utils/constellationColors';
import BannerEffectOverlay from './BannerEffectOverlay';
import UserAvatar from './UserAvatar';
import Button from './ui/Button';
import Field from './ui/Field';

type ShowcaseCategory = 'frames' | 'banners' | 'names';
type SupportTier = 'donator' | 'enthusiast' | 'consumer';
type Frame = Exclude<AvatarFrame, 'none'>;
type Banner = Exclude<BannerEffect, 'none'>;
type Name = Exclude<NameEffect, 'none'>;

const FRAME_ACCESS: Record<Frame, SupportTier | number> = {
  constellations: 'consumer',
  electric: 'consumer',
  crystal: 'consumer',
  petals: 'consumer',
  starlight: 'consumer',
  sigil: 'consumer',
  fireflies: 'consumer',
  aura: 'consumer',
  rainbow: 'enthusiast',
  segmented: 'enthusiast',
  gradient: 'enthusiast',
  sweep: 'enthusiast',
  text: 'enthusiast',
  neon: 'enthusiast',
  sakura: 'enthusiast',
  hearts: 'enthusiast',
  bronze: 5,
  silver: 15,
  gold: 30,
};

const NAME_ACCESS: Record<Name, SupportTier> = {
  gradient: 'donator',
  glow: 'donator',
  shimmer: 'enthusiast',
  aura: 'enthusiast',
};

const BANNERS: Banner[] = ['stars', 'fireflies', 'sakura', 'snow'];
const FRAMES = Object.keys(FRAME_ACCESS) as Frame[];
const NAMES = Object.keys(NAME_ACCESS) as Name[];
const CATEGORIES = [
  { value: 'frames', icon: UserRound },
  { value: 'banners', icon: Image },
  { value: 'names', icon: Type },
] as const;

const PREVIEW_COLORS: IUserCustomization = {
  nameColor1: '#7dd3fc',
  nameColor2: '#c084fc',
};

function optionClass(selected: boolean) {
  return selected
    ? 'surface relative flex w-full min-w-0 flex-col items-center p-4 text-center ring-2 ring-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
    : 'surface relative flex w-full min-w-0 flex-col items-center p-4 text-center hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
}

export default function SupportCustomizationShowcase() {
  const { t } = useTranslation('legal');
  const { t: settingsT } = useTranslation('settings');
  const user = useUserDataStore((state) => state.user);
  const [category, setCategory] = useState<ShowcaseCategory>('frames');
  const [frame, setFrame] = useState<Frame>('constellations');
  const [banner, setBanner] = useState<Banner>('stars');
  const [name, setName] = useState<Name>('aura');
  const [constellationColor, setConstellationColor] = useState('');
  const username = user?.username || 'NihongoTracker';
  const customization: IUserCustomization = {
    ...PREVIEW_COLORS,
    avatarFrame: frame,
    bannerEffect: banner,
    nameEffect: name,
    frameColor1: frame === 'constellations' ? constellationColor : undefined,
  };
  const nameRender = getNameEffectRender(customization);
  const accessLabel = (access: SupportTier | number) =>
    typeof access === 'number'
      ? t('support.showcase.cosmetics.level', { level: access })
      : t(`support.showcase.cosmetics.tiers.${access}`);
  const selectedLabel =
    category === 'frames'
      ? settingsT(`customization.avatarFrames.${frame}`)
      : category === 'banners'
        ? settingsT(`customization.bannerEffects.${banner}`)
        : settingsT(`customization.nameEffects.${name}`);
  const selectedAccess =
    category === 'frames'
      ? FRAME_ACCESS[frame]
      : category === 'banners'
        ? 'enthusiast'
        : NAME_ACCESS[name];

  return (
    <section
      className="surface-muted mt-6 p-5 sm:p-8"
      aria-labelledby="support-cosmetics-title"
    >
      <div className="flex items-center gap-3">
        <Palette className="size-6 shrink-0 text-accent" aria-hidden="true" />
        <h3 id="support-cosmetics-title" className="text-2xl font-bold">
          {t('support.showcase.cosmetics.title')}
        </h3>
      </div>
      <p className="mt-3 max-w-3xl leading-relaxed text-base-content/65">
        {t('support.showcase.cosmetics.description')}
      </p>

      <div className="surface-muted mt-6 overflow-hidden">
        <div
          className="relative h-96 w-full bg-linear-to-br from-primary/40 via-secondary/30 to-neutral bg-cover bg-center bg-no-repeat"
          style={
            user?.banner
              ? { backgroundImage: `url(${user.banner})` }
              : undefined
          }
        >
          <BannerEffectOverlay effect={banner} seed="support-cosmetics" />
          <div className="relative z-[1] flex size-full flex-col justify-end bg-linear-to-t from-shadow/[0.6] to-40% bg-cover">
            <div className="mx-auto mb-2 flex w-full min-w-0 flex-col items-center gap-2 px-5 sm:flex-row sm:items-end sm:gap-4">
              <div className="shrink-0">
                <UserAvatar
                  username={username}
                  avatar={user?.avatar}
                  alt={t('support.showcase.profile.avatarAlt', { username })}
                  customization={customization}
                  containerClassName="size-24 rounded-full"
                  textClassName="text-xl font-semibold"
                />
              </div>
              <div className="w-full min-w-0 px-25px py-2 text-center sm:w-auto sm:py-22px sm:text-left">
                <p
                  className={`inline-block max-w-full break-all text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] ${nameRender.className}`}
                  style={nameRender.style}
                >
                  {username}
                </p>
                <p className="mt-2 text-sm text-white/90">
                  {t('support.showcase.cosmetics.preview')}
                </p>
              </div>
            </div>
          </div>
        </div>
        <dl className="grid gap-3 border-t border-base-300 p-5 text-sm sm:grid-cols-3 sm:px-8">
          <div>
            <dt className="text-base-content/60">
              {t('support.showcase.cosmetics.categories.frames')}
            </dt>
            <dd className="mt-1 font-medium">
              {settingsT(`customization.avatarFrames.${frame}`)}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/60">
              {t('support.showcase.cosmetics.categories.banners')}
            </dt>
            <dd className="mt-1 font-medium">
              {settingsT(`customization.bannerEffects.${banner}`)}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/60">
              {t('support.showcase.cosmetics.categories.names')}
            </dt>
            <dd className="mt-1 font-medium">
              {settingsT(`customization.nameEffects.${name}`)}
            </dd>
          </div>
        </dl>
      </div>

      <div
        className="join mt-8 flex w-fit max-w-full"
        role="group"
        aria-label={t('support.showcase.cosmetics.categoryLabel')}
      >
        {CATEGORIES.map(({ value, icon: Icon }) => (
          <Button
            key={value}
            size="sm"
            variant={category === value ? 'primary' : 'default'}
            appearance={category === value ? 'solid' : 'outline'}
            className="join-item"
            aria-pressed={category === value}
            aria-controls="support-cosmetics-options"
            onClick={() => setCategory(value)}
          >
            <Icon className="size-4 hidden sm:block" aria-hidden="true" />
            {t(`support.showcase.cosmetics.categories.${value}`)}
          </Button>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-base-content/65">
        {t(`support.showcase.cosmetics.hints.${category}`)}
      </p>
      <p className="mt-3 text-sm" role="status">
        {t('support.showcase.cosmetics.selected', {
          name: selectedLabel,
          access: accessLabel(selectedAccess),
        })}
      </p>

      <div id="support-cosmetics-options" className="mt-5">
        {category === 'frames' && frame === 'constellations' && (
          <div className="mb-5 flex flex-wrap items-end gap-4">
            <Field label={settingsT('customization.constellationColor')} className="p-0">
              {(id) => (
                <input
                  id={id}
                  type="color"
                  className="surface h-10 w-20 cursor-pointer"
                  value={constellationColor || DEFAULT_CONSTELLATION_COLOR}
                  onChange={(event) => setConstellationColor(event.target.value)}
                />
              )}
            </Field>
            <Button size="sm" appearance="ghost" onClick={() => setConstellationColor('')}>
              {settingsT('customization.resetColors')}
            </Button>
          </div>
        )}
        {category === 'frames' && (
          <div className="carousel carousel-start w-full min-w-0 gap-4 p-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
            {FRAMES.map((value) => (
              <div
                key={value}
                className="carousel-item w-[calc(100%-1rem)] sm:w-auto"
              >
                <button
                  type="button"
                  className={optionClass(frame === value)}
                  aria-pressed={frame === value}
                  onClick={() => setFrame(value)}
                >
                  <div
                    className="mb-4 flex h-32 w-full items-center justify-center rounded-box bg-base-content/20 text-base-content"
                    aria-hidden="true"
                  >
                    <UserAvatar
                      username={username}
                      avatar={user?.avatar}
                      frame={value}
                      customization={value === 'constellations' ? { frameColor1: constellationColor } : undefined}
                      containerClassName="size-20 rounded-full"
                      fallbackClassName="flex size-full items-center justify-center rounded-full bg-base-200 text-base-content"
                      textClassName="text-xl font-bold"
                    />
                  </div>
                  <span className="font-semibold">
                    {settingsT(`customization.avatarFrames.${value}`)}
                  </span>
                  <span className="mt-2 text-xs text-base-content/60">
                    {accessLabel(FRAME_ACCESS[value])}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
        {category === 'banners' && (
          <div className="carousel carousel-start w-full min-w-0 gap-4 p-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {BANNERS.map((value) => (
              <div
                key={value}
                className="carousel-item w-[calc(100%-1rem)] sm:w-auto"
              >
                <button
                  type="button"
                  className={optionClass(banner === value)}
                  aria-pressed={banner === value}
                  onClick={() => setBanner(value)}
                >
                  <div className="relative mb-4 h-32 w-full overflow-hidden rounded-box bg-neutral">
                    <BannerEffectOverlay
                      effect={value}
                      seed={`support-banner-${value}`}
                    />
                  </div>
                  <span className="font-semibold">
                    {settingsT(`customization.bannerEffects.${value}`)}
                  </span>
                  <span className="mt-2 text-xs text-base-content/60">
                    {accessLabel('enthusiast')}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
        {category === 'names' && (
          <div className="carousel carousel-start w-full min-w-0 gap-4 p-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {NAMES.map((value) => {
              const render = getNameEffectRender({
                ...PREVIEW_COLORS,
                nameEffect: value,
              });
              return (
                <div
                  key={value}
                  className="carousel-item w-[calc(100%-1rem)] sm:w-auto"
                >
                  <button
                    type="button"
                    className={optionClass(name === value)}
                    aria-pressed={name === value}
                    onClick={() => setName(value)}
                  >
                    <span
                      className="mb-4 flex h-28 w-full min-w-0 items-center justify-center rounded-box bg-neutral px-2 text-neutral-content"
                      aria-hidden="true"
                    >
                      <span
                        className={`inline-block max-w-full break-all text-xl font-bold ${render.className}`}
                        style={render.style}
                      >
                        NihongoTracker
                      </span>
                    </span>
                    <span className="font-semibold">
                      {settingsT(`customization.nameEffects.${value}`)}
                    </span>
                    <span className="mt-2 text-xs text-base-content/60">
                      {accessLabel(NAME_ACCESS[value])}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
