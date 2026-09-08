import {
  Activity,
  ArrowRight,
  Award,
  Brain,
  CalendarClock,
  Check,
  Clock3,
  Coffee,
  Gauge,
  Gift,
  Heart,
  Lightbulb,
  Palette,
  Rocket,
  Server,
  Target,
  TimerOff,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { multiSearchMediaFn } from '../api/trackerApi';
import BannerEffectOverlay from '../components/BannerEffectOverlay';
import UserAvatar from '../components/UserAvatar';
import { useUserDataStore } from '../store/userData';
import type { IUserCustomization } from '../types';
import {
  getNameEffectRender,
  getProfileAccentStyle,
} from '../utils/customization';

interface PatreonTier {
  id: string;
  name: string;
  price: string;
  badgeClassName: string;
  cardClassName: string;
  buttonClassName: string;
  icon: React.ReactNode;
  popular?: boolean;
}

const TIERS: PatreonTier[] = [
  {
    id: 'donator',
    name: 'Donator',
    price: '$1',
    badgeClassName: 'badge badge-accent badge-lg gap-2',
    cardClassName:
      'card card-border relative bg-base-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
    buttonClassName: 'btn btn-outline w-full gap-2',
    icon: <Heart className="w-5 h-5" />,
  },
  {
    id: 'enthusiast',
    name: 'Immersion Enthusiast',
    price: '$5',
    badgeClassName: 'badge badge-secondary badge-lg gap-2',
    cardClassName:
      'card card-border relative border-secondary bg-base-100 shadow-sm ring-2 ring-secondary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
    buttonClassName: 'btn btn-secondary w-full gap-2',
    icon: <Award className="w-5 h-5" />,
    popular: true,
  },
  {
    id: 'consumer',
    name: 'Avid Consumer',
    price: '$10',
    badgeClassName: 'badge badge-primary badge-lg gap-2',
    cardClassName:
      'card card-border relative bg-base-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
    buttonClassName: 'btn btn-outline w-full gap-2',
    icon: <Rocket className="w-5 h-5" />,
  },
];

const WHY_SUPPORT = [
  { id: 'lights', icon: <Server className="w-7 h-7 text-warning" /> },
  {
    id: 'development',
    icon: <Lightbulb className="w-7 h-7 text-info" />,
  },
  { id: 'features', icon: <Gift className="w-7 h-7 text-secondary" /> },
];

type PlannerMetric = 'chars' | 'episodes' | 'pages' | 'minutes';

interface PlannerExample {
  search: string;
  fallbackTitle: string;
  fallbackImage: string;
  progress: number;
  remaining: number;
  daily: number;
  estimated: string;
  metric: PlannerMetric;
}

const PLANNER_EXAMPLES: PlannerExample[] = [
  {
    search: 'Frieren',
    fallbackTitle: '葬送のフリーレン',
    fallbackImage: 'https://covers.openlibrary.org/b/isbn/9781974736139-M.jpg',
    progress: 39,
    remaining: 17,
    daily: 1,
    estimated: '6h 48m',
    metric: 'episodes',
  },
  {
    search: 'Yotsuba',
    fallbackTitle: 'よつばと!',
    fallbackImage: 'https://covers.openlibrary.org/b/isbn/9780316073875-M.jpg',
    progress: 28,
    remaining: 1186,
    daily: 14,
    estimated: '39h 32m',
    metric: 'pages',
  },
  {
    search: 'Steins;Gate',
    fallbackTitle: 'STEINS;GATE',
    fallbackImage: 'https://covers.openlibrary.org/b/isbn/9781927925504-M.jpg',
    progress: 24,
    remaining: 1083632,
    daily: 11909,
    estimated: '146h 41m',
    metric: 'chars',
  },
  {
    search: 'Spirited Away',
    fallbackTitle: '千と千尋の神隠し',
    fallbackImage: 'https://covers.openlibrary.org/b/isbn/9781569317778-M.jpg',
    progress: 42,
    remaining: 72,
    daily: 12,
    estimated: '1h 12m',
    metric: 'minutes',
  },
];

const FAQ_IDS = ['alwaysFree', 'benefits', 'cancel', 'notApplying'] as const;

const PATREON_URL = 'https://www.patreon.com/nihongotracker';

interface PremiumProfileCombination {
  customization: IUserCustomization;
  bannerClassName: string;
  badgeClassName: string;
}

const PREMIUM_PROFILE_COMBINATIONS: PremiumProfileCombination[] = [
  {
    customization: {
      avatarFrame: 'aura',
      bannerEffect: 'stars',
      nameEffect: 'shimmer',
      nameColor1: '#7dd3fc',
      nameColor2: '#c084fc',
      profileAccent: 'ocean',
    },
    bannerClassName: 'bg-linear-to-br from-primary/80 via-secondary/60 to-base-300',
    badgeClassName: 'badge-rainbow',
  },
  {
    customization: {
      avatarFrame: 'sakura',
      bannerEffect: 'sakura',
      nameEffect: 'glow',
      nameColor1: '#f9a8d4',
      nameColor2: '#fda4af',
      profileAccent: 'sakura',
    },
    bannerClassName: 'bg-linear-to-br from-secondary/75 via-accent/45 to-base-300',
    badgeClassName: 'badge-secondary',
  },
  {
    customization: {
      avatarFrame: 'neon',
      bannerEffect: 'fireflies',
      nameEffect: 'gradient',
      nameColor1: '#6ef2ff',
      nameColor2: '#a855f7',
      profileAccent: 'forest',
    },
    bannerClassName: 'bg-linear-to-br from-accent/70 via-primary/50 to-neutral',
    badgeClassName: 'badge-primary',
  },
  {
    customization: {
      avatarFrame: 'rainbow',
      bannerEffect: 'snow',
      nameEffect: 'shimmer',
      nameColor1: '#fde68a',
      nameColor2: '#fb7185',
      profileAccent: 'retro',
    },
    bannerClassName: 'bg-linear-to-br from-warning/70 via-secondary/50 to-base-300',
    badgeClassName: 'badge-accent',
  },
];

function PremiumProfilePreview({
  tf,
}: {
  tf: (key: string, options?: object) => string;
}) {
  const user = useUserDataStore((state) => state.user);
  const [combination] = useState(
    () =>
      PREMIUM_PROFILE_COMBINATIONS[
        Math.floor(Math.random() * PREMIUM_PROFILE_COMBINATIONS.length)
      ],
  );
  const { customization, bannerClassName, badgeClassName } = combination;
  const username = user?.username || 'user';
  const nameEffect = getNameEffectRender(customization);
  const badgeText =
    user?.patreon?.customBadgeText?.trim() || tf('support.showcase.profile.badge');

  return (
    <div
      className="relative mt-4 overflow-hidden rounded-box bg-base-200 text-base-content shadow-sm"
      style={getProfileAccentStyle(customization)}
    >
      <div
        className={`relative h-56 bg-cover bg-center bg-no-repeat sm:h-64 ${bannerClassName}`}
        style={user?.banner ? { backgroundImage: `url(${user.banner})` } : undefined}
      >
        <BannerEffectOverlay
          effect={customization.bannerEffect}
          seed={`support-${username}`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-shadow/80 via-shadow/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col items-center gap-4 px-5 pb-5 sm:flex-row sm:items-center sm:px-7">
          <div className="avatar shrink-0">
            <UserAvatar
              username={username}
              avatar={user?.avatar}
              alt={tf('support.showcase.profile.avatarAlt', { username })}
              frame={customization.avatarFrame}
              containerClassName="size-20 rounded-full sm:size-24"
              imageClassName="size-full rounded-full object-cover"
              fallbackClassName="flex size-full items-center justify-center rounded-full bg-base-100 text-base-content"
              textClassName="text-xl font-bold sm:text-2xl"
              loading="eager"
            />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <div className="flex min-w-0 max-w-full items-center justify-center gap-2 sm:justify-start">
              <p
                className={`inline-block whitespace-nowrap text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] sm:text-2xl ${nameEffect.className}`}
                style={nameEffect.style}
              >
                {username}
              </p>
              <span
                className={`badge badge-sm shrink-0 gap-1.5 border-0 font-bold shadow-sm ${badgeClassName}`}
              >
                <Heart className="w-3 h-3 fill-current" />
                {badgeText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionIntelligencePreview({
  tf,
}: {
  tf: (key: string, options?: object) => string;
}) {
  return (
    <div className="surface-raised p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-xl font-bold text-base-content">
          {tf('support.showcase.session.previewTitle')}
        </h4>
        <X className="w-5 h-5 text-base-content/60" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-base-content/60">
        {tf('support.showcase.session.previewSubtitle')}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="surface-muted p-3">
          <Brain className="mb-3 w-5 h-5 text-primary" />
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.focus')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">62%</p>
        </div>
        <div className="surface-muted p-3">
          <Clock3 className="mb-3 w-5 h-5 text-success" />
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.focusedTime')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">15m 11s</p>
        </div>
        <div className="surface-muted p-3">
          <Activity className="mb-3 w-5 h-5 text-warning" />
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.distractionTime')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">9m 11s</p>
        </div>
        <div className="surface-muted p-3">
          <Activity className="mb-3 w-5 h-5 text-info" />
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.distractions')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">6</p>
        </div>
        <div className="surface-muted col-span-2 p-3 sm:col-span-1">
          <TimerOff className="mb-3 w-5 h-5 text-base-content/60" />
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.afk')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">9m 30s</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="surface p-3">
          <p className="flex items-center gap-2 text-xs text-base-content/60">
            <Gauge className="w-4 h-4" />
            {tf('support.showcase.session.firstThirty')}
          </p>
          <p className="mt-1 font-bold tabular-nums">8,492 chars/h</p>
        </div>
        <div className="surface p-3">
          <p className="flex items-center gap-2 text-xs text-base-content/60">
            <Gauge className="w-4 h-4" />
            {tf('support.showcase.session.lastThirty')}
          </p>
          <p className="mt-1 font-bold tabular-nums">8,492 chars/h</p>
        </div>
        <div className="surface p-3">
          <p className="flex items-center gap-2 text-xs text-base-content/60">
            <Gauge className="w-4 h-4" />
            {tf('support.showcase.session.peak')}
          </p>
          <p className="mt-1 font-bold tabular-nums">9,468 chars/h</p>
        </div>
        <div className="surface p-3">
          <p className="text-xs text-base-content/60">
            {tf('support.showcase.session.longest')}
          </p>
          <p className="mt-1 font-bold tabular-nums">2m 59s</p>
        </div>
      </div>

      <div
        className="surface mt-4 p-4"
        role="img"
        aria-label={tf('support.showcase.session.chartLabel')}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h5 className="font-semibold text-base-content">
            {tf('support.showcase.session.chartTitle')}
          </h5>
          <span className="text-xs text-base-content/55">
            {tf('support.showcase.session.baseline')}
          </span>
        </div>

        <div className="grid grid-cols-[2rem_1fr] gap-2">
          <div className="flex h-44 flex-col justify-between pb-5 text-right text-xs text-base-content/45">
            <span>250</span>
            <span>200</span>
            <span>150</span>
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
          <div className="min-w-0">
            <svg
              viewBox="0 0 640 180"
              className="h-44 w-full overflow-visible"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {[20, 48, 76, 104, 132, 160].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="640"
                  y1={y}
                  y2={y}
                  className="stroke-base-content/15"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                d="M0 112 C22 96 30 26 48 24 S76 105 104 118 S142 128 170 94 S207 69 228 66 S259 63 276 118 S305 42 327 48 S354 101 380 106 S411 104 428 62 S462 116 488 110 S516 28 536 26 S578 59 600 73 S626 125 640 132 L640 160 L0 160 Z"
                className="fill-primary/15"
              />
              <path
                d="M0 112 C22 96 30 26 48 24 S76 105 104 118 S142 128 170 94 S207 69 228 66 S259 63 276 118 S305 42 327 48 S354 101 380 106 S411 104 428 62 S462 116 488 110 S516 28 536 26 S578 59 600 73 S626 125 640 132"
                className="fill-none stroke-primary"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              {[
                [0, 112],
                [48, 24],
                [104, 118],
                [170, 94],
                [228, 66],
                [276, 118],
                [327, 48],
                [380, 106],
                [428, 62],
                [488, 110],
                [536, 26],
                [600, 73],
                [640, 132],
              ].map(([x, y], index) => (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3.5"
                  className={
                    index === 5 || index === 8
                      ? 'fill-warning stroke-primary'
                      : 'fill-primary'
                  }
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="flex justify-between text-xs text-base-content/50">
              <span>Min 1</span>
              <span>Min 5</span>
              <span>Min 9</span>
              <span>Min 13</span>
              <span>Min 16</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-base-content/60">
          <span className="flex items-center gap-1.5">
            <span className="status status-primary" />
            {tf('support.showcase.session.focused')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="status status-warning" />
            {tf('support.showcase.session.distracted')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="status" />
            {tf('support.showcase.session.away')}
          </span>
        </div>
      </div>
    </div>
  );
}

function SupportScreen() {
  const { t, i18n } = useTranslation('legal');
  const [plannerExample] = useState(
    () => PLANNER_EXAMPLES[Math.floor(Math.random() * PLANNER_EXAMPLES.length)],
  );
  const [plannerDeadline] = useState(() => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    return deadline;
  });
  const { data: plannerResults, isLoading: plannerLoading } = useQuery({
    queryKey: ['supportPlannerPreview', plannerExample.search],
    queryFn: () =>
      multiSearchMediaFn({ search: plannerExample.search, perPage: 6 }),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const plannerMedia = plannerResults?.find((media) => {
    if (media.isAdult || !(media.contentImage || media.coverImage)) {
      return false;
    }

    if (plannerExample.metric === 'chars') return media.type === 'vn';
    if (plannerExample.metric === 'episodes') {
      return media.type === 'anime' || media.type === 'tv show';
    }
    if (plannerExample.metric === 'pages') {
      return media.type === 'manga' || media.type === 'light-novel';
    }
    return media.type === 'movie';
  });
  const plannerTitle =
    plannerMedia?.title.contentTitleNative ||
    plannerMedia?.title.contentTitleRomaji ||
    plannerMedia?.title.contentTitleEnglish ||
    plannerExample.fallbackTitle;
  const plannerImage =
    plannerMedia?.contentImage ||
    plannerMedia?.coverImage ||
    plannerExample.fallbackImage;
  const plannerDate = plannerDeadline.toLocaleDateString(i18n.language);

  const tf = t as unknown as (key: string, options?: object) => string;
  const tList = t as unknown as (
    key: string,
    options: { returnObjects: true },
  ) => string[];

  return (
    <div className="min-h-screen overflow-hidden bg-base-100 pt-20">
      <section className="px-4 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <span className="badge badge-primary badge-soft mb-6 gap-2">
              <Heart className="w-3.5 h-3.5" />
              {t('support.hero.badge')}
            </span>
            <h1 className="mb-6 text-4xl leading-tight font-bold text-base-content sm:text-5xl lg:text-6xl">
              <Trans
                t={t}
                i18nKey="support.hero.title"
                components={{ hl: <span className="text-primary" /> }}
              />
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-base-content/65 sm:text-xl">
              {t('support.hero.subtitle')}
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <a
                href={PATREON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg gap-2 px-8"
              >
                {t('support.hero.cta')}
                <ArrowRight className="w-5 h-5" />
              </a>
              <a href="#supporter-benefits" className="btn btn-ghost btn-lg">
                {t('support.hero.seeBenefits')}
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="surface-raised relative p-6 shadow-lg sm:p-7">
              <div className="mb-4">
                <p className="text-xs font-semibold tracking-widest text-base-content/45 uppercase">
                  {t('support.hero.noteEyebrow')}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {t('support.hero.noteTitle')}
                </h2>
              </div>
              <p className="max-w-xl text-base leading-relaxed text-base-content/70">
                {t('support.hero.noteBody')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="supporter-benefits"
        className="scroll-mt-24 bg-base-100 px-4 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <span className="badge badge-secondary badge-soft mb-4">
              {t('support.showcase.badge')}
            </span>
            <h2 className="mb-4 text-3xl font-bold text-base-content md:text-4xl">
              {t('support.showcase.title')}
            </h2>
            <p className="text-lg leading-relaxed text-base-content/60">
              {t('support.showcase.subtitle')}
            </p>
          </div>

          <div className="card card-border bg-base-200 shadow-sm">
            <div className="card-body p-6 sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
                <div>
                  <span className="badge badge-secondary badge-soft w-fit">
                    {t('support.showcase.session.tier')}
                  </span>
                  <div className="mt-3 flex items-center gap-3">
                    <Activity className="w-7 h-7 text-secondary" />
                    <h3 className="card-title text-2xl sm:text-3xl">
                      {t('support.showcase.session.title')}
                    </h3>
                  </div>
                  <p className="mt-3 leading-relaxed text-base-content/65">
                    {t('support.showcase.session.description')}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {tList('support.showcase.session.benefits', {
                      returnObjects: true,
                    }).map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-success" />
                        <span className="text-sm text-base-content/75">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-xs leading-relaxed text-base-content/50">
                    {t('support.showcase.session.note')}
                  </p>
                </div>
                <SessionIntelligencePreview tf={tf} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card card-border bg-base-100 shadow-sm">
              <div className="card-body p-6 sm:p-8">
                <span className="badge badge-secondary badge-soft w-fit">
                  {t('support.showcase.planner.tier')}
                </span>
                <h3 className="card-title mt-2 text-2xl">
                  <Target className="w-6 h-6 text-secondary" />
                  {t('support.showcase.planner.title')}
                </h3>
                <p className="text-base-content/60">
                  {t('support.showcase.planner.description')}
                </p>

                <div className="card surface card-sm mt-3 min-w-0 overflow-hidden">
                  <div className="card-body min-w-0 gap-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={plannerImage}
                        alt=""
                        className="h-22 w-16 shrink-0 rounded-field object-cover"
                        loading="lazy"
                        onError={(event) => {
                          if (
                            event.currentTarget.src !==
                            plannerExample.fallbackImage
                          ) {
                            event.currentTarget.src =
                              plannerExample.fallbackImage;
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-lg leading-snug font-bold">
                          {plannerLoading
                            ? plannerExample.fallbackTitle
                            : plannerTitle}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="badge badge-success badge-sm">
                            {t('support.showcase.planner.onTrack')}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-base-content/60">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {plannerDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <progress
                      className="progress progress-primary w-full"
                      value={plannerExample.progress}
                      max="100"
                    />

                    <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div className="min-w-0">
                        <p className="text-base-content/60">
                          {t('support.showcase.planner.remaining')}
                        </p>
                        <p className="break-words font-bold tabular-nums">
                          {plannerExample.remaining.toLocaleString(
                            i18n.language,
                          )}{' '}
                          {tf(
                            `support.showcase.planner.units.${plannerExample.metric}`,
                          )}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-base-content/60">
                          {t('support.showcase.planner.daily')}
                        </p>
                        <p className="break-words font-bold tabular-nums">
                          {plannerExample.daily.toLocaleString(i18n.language)}{' '}
                          {tf(
                            `support.showcase.planner.units.${plannerExample.metric}`,
                          )}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-base-content/60">
                          {t('support.showcase.planner.timeLeft')}
                        </p>
                        <p className="font-bold tabular-nums">
                          {plannerExample.estimated}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card card-border bg-base-100 shadow-sm">
              <div className="card-body p-6 sm:p-8">
                <span className="badge badge-accent badge-soft w-fit">
                  {t('support.showcase.profile.tier')}
                </span>
                <h3 className="card-title mt-2 text-2xl">
                  <Palette className="w-6 h-6 text-accent" />
                  {t('support.showcase.profile.title')}
                </h3>
                <p className="text-base-content/60">
                  {t('support.showcase.profile.description')}
                </p>
                <PremiumProfilePreview tf={tf} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-base-200 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <span className="badge badge-accent badge-soft mb-4">
                {t('support.why.badge')}
              </span>
              <h2 className="text-3xl font-bold text-base-content md:text-4xl">
                {t('support.why.title')}
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-base-content/60 lg:ml-auto">
              {t('support.why.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {WHY_SUPPORT.map((item) => (
              <div
                key={item.id}
                className="surface p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 grid size-12 place-items-center rounded-box bg-base-200">
                  {item.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold text-base-content">
                  {tf(`support.why.items.${item.id}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-base-content/60">
                  {tf(`support.why.items.${item.id}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-base-100 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <span className="badge badge-secondary badge-soft mb-4">
              {t('support.tiers.badge')}
            </span>
            <h2 className="mb-4 text-3xl font-bold text-base-content md:text-4xl">
              {t('support.tiers.title')}
            </h2>
            <p className="mx-auto max-w-2xl text-base-content/60">
              {t('support.tiers.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.id} className={tier.cardClassName}>
                {tier.popular && (
                  <div className="badge badge-secondary absolute -top-3 left-1/2 -translate-x-1/2">
                    {t('support.tiers.highlighted')}
                  </div>
                )}

                <div className="card-body p-6">
                  <div className={tier.badgeClassName}>
                    {tier.icon}
                    {tier.name}
                  </div>

                  <div className="mt-3 text-3xl font-bold text-base-content">
                    {tier.price}
                    <span className="text-sm font-normal text-base-content/60">
                      {t('support.tiers.perMonth')}
                    </span>
                  </div>

                  <p className="min-h-24 text-sm leading-relaxed text-base-content/60">
                    {tf(`support.tiers.items.${tier.id}.description`)}
                  </p>

                  <ul className="mb-2 flex-1 space-y-3">
                    {tList(`support.tiers.items.${tier.id}.benefits`, {
                      returnObjects: true,
                    }).map((benefit, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="mt-1 w-3.5 h-3.5 shrink-0 text-success" />
                        <span className="text-sm text-base-content/75">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="card-actions">
                    <a
                      href={PATREON_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tier.buttonClassName}
                    >
                      {t('support.tiers.cta')}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-base-content/50">
            {t('support.tiers.noPressure')}
          </p>
        </div>
      </section>

      <section className="bg-base-200 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="surface-raised flex flex-col items-center gap-6 p-7 text-center shadow-sm sm:flex-row sm:p-8 sm:text-left">
            <div className="grid size-14 shrink-0 place-items-center rounded-box bg-info/15 text-info">
              <Coffee className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h2 className="mb-2 text-2xl font-bold text-base-content">
                {t('support.oneTime.title')}
              </h2>
              <p className="text-base-content/60">
                {t('support.oneTime.subtitle')}
              </p>
            </div>
            <a
              href="https://ko-fi.com/nihongotracker"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-info btn-outline shrink-0 gap-2"
            >
              <Coffee className="w-5 h-5" />
              Ko-fi
            </a>
          </div>
        </div>
      </section>

      <section className="bg-base-100 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <span className="badge badge-outline mb-4">
              {t('support.faq.badge')}
            </span>
            <h2 className="text-3xl font-bold text-base-content md:text-4xl">
              {t('support.faq.title')}
            </h2>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {FAQ_IDS.map((id, index) => (
              <div
                key={id}
                className="collapse collapse-arrow border border-base-300 bg-base-100 shadow-sm"
              >
                <input
                  type="radio"
                  name="faq-accordion"
                  defaultChecked={index === 0}
                />
                <div className="collapse-title text-lg font-medium">
                  {tf(`support.faq.${id}.question`)}
                </div>
                <div className="collapse-content">
                  <p className="text-base-content/70">
                    <Trans
                      t={t}
                      i18nKey={`support.faq.${id}.answer`}
                      components={{
                        code: <span className="font-mono" />,
                        br: <br />,
                        mail: (
                          <a
                            href="mailto:support@nihongotracker.app"
                            className="link underline"
                          />
                        ),
                      }}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-base-200 px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Heart className="mx-auto mb-5 w-9 h-9 text-error" />
          <h2 className="mb-4 text-4xl font-bold text-base-content md:text-5xl">
            {t('support.cta.title')}
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-base-content/60">
            {t('support.cta.subtitle')}
          </p>
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg gap-2 px-8"
          >
            {t('support.cta.button')}
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="mt-6 text-sm text-base-content/50">
            {t('support.cta.thanks')}
          </p>
        </div>
      </section>
    </div>
  );
}

export default SupportScreen;
