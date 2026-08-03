import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Book,
  CircleStar,
  TrendingUp,
  Users,
  Timer,
  Calendar,
  BarChart,
  Trophy,
  Gauge,
  GitCompare,
  Layers,
  ChartArea,
  ChartLine,
  ClipboardList,
  Settings,
  Newspaper,
  Eye,
  Share2,
  Search,
  CloudUpload,
  MonitorSmartphone,
  Heart,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';

/**
 * The catalogue holds only the parts that are not text: which icon, which
 * accent, which entries are highlighted or still planned. Every title and
 * description lives in `home:features.categories.*` and is looked up by id, so
 * translating this page never touches this file.
 */
interface FeatureEntry {
  id: string;
  icon: React.ElementType;
  highlight?: boolean;
  planned?: boolean;
}

interface FeatureCategory {
  id: string;
  icon: React.ElementType;
  color: string;
  features: FeatureEntry[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'tracking',
    icon: Layers,
    color: 'text-primary',
    features: [
      { id: 'multiMedia', icon: Book },
      { id: 'durationEstimates', icon: Timer },
      { id: 'characterCount', icon: ChartLine },
      { id: 'episodePages', icon: ClipboardList },
      { id: 'databaseIntegration', icon: Search },
      { id: 'importExport', icon: CloudUpload },
      { id: 'texthooker', icon: Book, highlight: true },
    ],
  },
  {
    id: 'analytics',
    icon: ChartArea,
    color: 'text-secondary',
    features: [
      { id: 'readingSpeed', icon: Gauge, highlight: true },
      { id: 'charts', icon: BarChart },
      { id: 'timeBased', icon: Newspaper },
      { id: 'mediaSpecific', icon: Layers },
      { id: 'typeBased', icon: GitCompare },
      { id: 'completion', icon: ChartLine },
    ],
  },
  {
    id: 'gamification',
    icon: CircleStar,
    color: 'text-accent',
    features: [
      { id: 'xpLeveling', icon: CircleStar, highlight: true },
      { id: 'streaks', icon: Calendar },
      { id: 'achievements', icon: CircleStar, planned: true },
      { id: 'goals', icon: Calendar },
      { id: 'progressIndicators', icon: TrendingUp },
      { id: 'dashboard', icon: Heart },
    ],
  },
  {
    id: 'social',
    icon: Users,
    color: 'text-info',
    features: [
      { id: 'rankings', icon: Trophy, highlight: true },
      { id: 'comparison', icon: GitCompare },
      { id: 'profiles', icon: Users },
      { id: 'sharedMedia', icon: Eye },
      { id: 'logSharing', icon: Share2 },
      { id: 'activityFeed', icon: Newspaper },
    ],
  },
  {
    id: 'clubs',
    icon: Users,
    color: 'text-warning',
    features: [
      { id: 'createJoin', icon: Users },
      { id: 'mediaTracking', icon: Layers },
      { id: 'memberRankings', icon: Trophy },
      { id: 'statistics', icon: BarChart },
      { id: 'voting', icon: Heart },
      { id: 'activity', icon: TrendingUp },
    ],
  },
  {
    id: 'tools',
    icon: Settings,
    color: 'text-success',
    features: [
      { id: 'calculator', icon: Timer },
      { id: 'discovery', icon: Search },
      { id: 'lists', icon: ClipboardList },
      { id: 'goals', icon: ClipboardList },
      { id: 'export', icon: CloudUpload },
      { id: 'sync', icon: MonitorSmartphone },
    ],
  },
];

const HOW_IT_WORKS_STEPS = [
  { id: 'track', Icon: Layers, color: 'bg-primary/15 text-primary' },
  { id: 'analyze', Icon: ChartArea, color: 'bg-secondary/15 text-secondary' },
  { id: 'motivate', Icon: CircleStar, color: 'bg-accent/15 text-accent' },
  { id: 'connect', Icon: Users, color: 'bg-info/15 text-info' },
];

function FeaturesScreen() {
  const { t } = useTranslation('home');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Category and feature ids are runtime strings, so the typed `t` signature
  // does not apply to the catalogue lookups; the ids are kept in sync with
  // `home.json` by the structure of FEATURE_CATEGORIES above.
  const tf = t as unknown as (key: string, options?: object) => string;

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <div className="pt-16 bg-base-100 min-h-screen">
      {/* ─── Hero ─── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="badge badge-primary badge-outline mb-6">
            {t('features.hero.badge')}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-6 leading-tight">
            <Trans
              t={t}
              i18nKey="features.hero.title"
              components={{ hl: <span className="text-primary" /> }}
            />
          </h1>
          <p className="text-xl text-base-content/60 mb-10 leading-relaxed">
            {t('features.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register">
              <button className="btn btn-primary btn-lg gap-2 px-10">
                {t('features.hero.ctaPrimary')}
                <ArrowRight size={18} />
              </button>
            </Link>
            <Link to="/ranking">
              <button className="btn btn-ghost btn-lg px-8">
                {t('features.hero.ctaSecondary')}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ─── */}
      <section className="py-10 px-4 bg-base-200/50 border-y border-base-300/50">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">35+</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('features.stats.features')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">6</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('features.stats.mediaTypes')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent">&infin;</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('features.stats.progressTracking')}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-success">100%</div>
            <div className="text-sm text-base-content/50 mt-1">
              {t('features.stats.freeCore')}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature Categories ─── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {FEATURE_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className="rounded-2xl border border-base-300 overflow-hidden bg-base-100 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              {/* Header */}
              <button
                className="w-full px-6 py-5 flex items-center justify-between gap-4 hover:bg-base-200/40 transition-colors duration-200 text-left"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`p-3 rounded-xl bg-base-200 ${category.color} shrink-0`}
                  >
                    <category.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-base-content">
                      {tf(`features.categories.${category.id}.title`)}
                    </h3>
                    <p className="text-sm text-base-content/55">
                      {tf(`features.categories.${category.id}.description`)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="badge badge-outline badge-sm hidden sm:flex">
                    {t('features.count', { count: category.features.length })}
                  </span>
                  {expandedCategory === category.id ? (
                    <ChevronUp className="w-5 h-5 text-base-content/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-base-content/50" />
                  )}
                </div>
              </button>

              {/* Feature grid */}
              {expandedCategory === category.id && (
                <div className="px-6 pb-6 border-t border-base-300/60">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-5">
                    {category.features.map((feature) => (
                      <div
                        key={feature.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border ${
                          feature.highlight
                            ? 'border-primary/25 bg-primary/5'
                            : 'border-base-300/60 bg-base-200/30'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-base-100 border border-base-300/60 flex items-center justify-center shrink-0 mt-0.5">
                          <feature.icon size={15} className={category.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-base-content">
                              {tf(
                                `features.categories.${category.id}.items.${feature.id}.title`
                              )}
                            </span>
                            {feature.planned && (
                              <span className="badge badge-warning badge-xs">
                                {t('features.planned')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-base-content/55 mt-0.5 leading-relaxed">
                            {tf(
                              `features.categories.${category.id}.items.${feature.id}.description`
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-accent badge-outline mb-4">
              {t('features.howItWorks.badge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              {t('features.howItWorks.title')}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS_STEPS.map(({ id, Icon, color }, index) => (
              <div key={id} className="text-center">
                <div
                  className={`w-16 h-16 ${color} rounded-full flex items-center justify-center mx-auto mb-4`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <p className="text-xs font-semibold text-base-content/35 uppercase tracking-widest mb-1">
                  {t('features.howItWorks.step', { number: index + 1 })}
                </p>
                <h3 className="font-bold text-base-content mb-2">
                  {tf(`features.howItWorks.steps.${id}.title`)}
                </h3>
                <p className="text-sm text-base-content/55 leading-relaxed">
                  {tf(`features.howItWorks.steps.${id}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-28 px-4 bg-gradient-to-b from-base-100 to-base-200/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-base-content mb-4">
            {t('features.cta.title')}
          </h2>
          <p className="text-lg text-base-content/55 mb-10">
            {t('features.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register">
              <button className="btn btn-primary btn-lg px-12">
                {t('features.cta.primary')}
              </button>
            </Link>
            <Link to="/ranking">
              <button className="btn btn-ghost btn-lg">
                {t('features.cta.secondary')}
              </button>
            </Link>
          </div>
          <p className="mt-8 text-sm text-base-content/50">
            {t('features.cta.madeWith')}
          </p>
        </div>
      </section>
    </div>
  );
}

export default FeaturesScreen;
