import {
  Award,
  Lightbulb,
  Heart,
  Earth,
  Rocket,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

/**
 * Like FeaturesScreen, the catalogues below hold only presentation: which
 * icon, which accent, which tier is highlighted. Names stay untranslated —
 * they are the actual tier names on Patreon — while descriptions and benefits
 * are looked up in `legal:support.tiers.items.*` by id.
 */
interface PatreonTier {
  id: string;
  name: string;
  price: string;
  color: string;
  icon: React.ReactNode;
  popular?: boolean;
}

const TIERS: PatreonTier[] = [
  {
    id: 'donator',
    name: 'Donator',
    price: '$1',
    color: 'badge-accent',
    icon: <Heart className="w-5 h-5" />,
  },
  {
    id: 'enthusiast',
    name: 'Immersion Enthusiast',
    price: '$5',
    color: 'badge-secondary',
    icon: <Award className="w-5 h-5" />,
    popular: true,
  },
  {
    id: 'consumer',
    name: 'Avid Consumer',
    price: '$10',
    color: 'badge-primary',
    icon: <Rocket className="w-5 h-5" />,
  },
];

const WHY_SUPPORT = [
  { id: 'lights', icon: <Lightbulb className="text-5xl text-warning" /> },
  { id: 'development', icon: <Rocket className="text-5xl text-info" /> },
  { id: 'community', icon: <Heart className="text-5xl text-error" /> },
  { id: 'openSource', icon: <Earth className="text-5xl text-success" /> },
];

const FAQ_IDS = ['alwaysFree', 'benefits', 'cancel', 'notApplying'] as const;

const PATREON_URL = 'https://www.patreon.com/nihongotracker';

function SupportScreen() {
  const { t } = useTranslation('legal');

  // Catalogue ids are runtime strings, so the typed `t` signature does not
  // apply to these lookups; `benefits` is a JSON array rather than a string.
  const tf = t as unknown as (key: string, options?: object) => string;
  const tList = t as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => string[];

  return (
    <div className="pt-20 bg-base-100 min-h-screen">
      {/* ─── Hero ─── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="badge badge-primary badge-outline mb-6">
            {t('support.hero.badge')}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-6 leading-tight">
            <Trans
              t={t}
              i18nKey="support.hero.title"
              components={{ hl: <span className="text-primary" /> }}
            />
          </h1>
          <p className="text-xl text-base-content/60 mb-10 leading-relaxed">
            {t('support.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={PATREON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg gap-2 px-8"
            >
              {t('support.hero.cta')}
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ─── Support strip ─── */}
      <section className="py-10 px-4 bg-base-200/50 border-y border-base-300/50">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">3</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('support.stats.tiers')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">100%</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('support.stats.freeCore')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent">24/7</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('support.stats.community')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-success">1</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('support.stats.creator')}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why support ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-accent badge-outline mb-4">
              {t('support.why.badge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              {t('support.why.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_SUPPORT.map((item) => (
              <div
                key={item.id}
                className="surface p-6 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-base-content mb-2">
                  {tf(`support.why.items.${item.id}.title`)}
                </h3>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  {tf(`support.why.items.${item.id}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tiers ─── */}
      <section className="py-24 px-4 bg-base-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-secondary badge-outline mb-4">
              {t('support.tiers.badge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content mb-4">
              {t('support.tiers.title')}
            </h2>
            <p className="text-base-content/60 mb-6 max-w-2xl mx-auto">
              {t('support.tiers.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm transition-all duration-300 hover:shadow-lg ${
                  tier.popular ? 'ring-2 ring-secondary' : ''
                }`}
              >
                {tier.popular && (
                  <div className="badge badge-secondary absolute -top-3 left-1/2 -translate-x-1/2">
                    {t('support.tiers.highlighted')}
                  </div>
                )}

                <div className="flex items-center justify-between mb-5">
                  <div className={`badge ${tier.color} badge-lg gap-2`}>
                    {tier.icon}
                    {tier.name}
                  </div>
                </div>

                <div className="text-3xl font-bold text-base-content mb-3">
                  {tier.price}
                  <span className="text-sm font-normal text-base-content/60">
                    {t('support.tiers.perMonth')}
                  </span>
                </div>

                <p className="text-sm text-base-content/60 leading-relaxed mb-5 min-h-24">
                  {tf(`support.tiers.items.${tier.id}.description`)}
                </p>

                <ul className="space-y-3 mb-6">
                  {tList(`support.tiers.items.${tier.id}.benefits`, {
                    returnObjects: true,
                  }).map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-3.5 h-3.5 text-success shrink-0 mt-1" />
                      <span className="text-sm text-base-content/75">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={PATREON_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${
                    tier.popular ? 'btn-secondary' : 'btn-outline btn-primary'
                  } w-full gap-2`}
                >
                  {t('support.tiers.cta')}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── One-time support ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-4xl mx-auto">
          <div className="surface p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-base-content mb-4">
              {t('support.oneTime.title')}
            </h2>
            <p className="text-base-content/60 mb-6 max-w-2xl mx-auto">
              {t('support.oneTime.subtitle')}
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <a
                href="https://ko-fi.com/nihongotracker"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-info btn-outline gap-2"
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5 fill-current"
                >
                  <title>Ko-fi</title>
                  <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
                </svg>
                Ko-fi
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-20 px-4 bg-base-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="badge badge-outline mb-4">
              {t('support.faq.badge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              {t('support.faq.title')}
            </h2>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {FAQ_IDS.map((id, index) => (
              <div
                key={id}
                className="collapse collapse-arrow bg-base-100 shadow-sm border border-base-300"
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

      {/* ─── CTA ─── */}
      <section className="py-28 px-4 bg-gradient-to-b from-base-100 to-base-200/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-base-content mb-4">
            {t('support.cta.title')}
          </h2>
          <p className="text-lg text-base-content/55 mb-10">
            {t('support.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={PATREON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg px-8"
            >
              {t('support.cta.button')}
            </a>
          </div>
          <p className="mt-8 text-sm text-base-content/50 flex items-center justify-center gap-2">
            {t('support.cta.thanks')} <Heart className="w-4 h-4 text-error" />
          </p>
        </div>
      </section>
    </div>
  );
}

export default SupportScreen;
