import {
  Award,
  Lightbulb,
  Heart,
  Earth,
  Rocket,
  Check,
  ArrowRight,
} from 'lucide-react';

interface PatreonTier {
  name: string;
  price: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  benefits: string[];
  popular?: boolean;
}

function SupportScreen() {
  const patreonUrl = 'https://www.patreon.com/nihongotracker';

  const tiers: PatreonTier[] = [
    {
      name: 'Donator',
      price: '$1',
      description:
        'You like what NihongoTracker strives for: "helping self-learners track their Japanese immersion", and you want to show a little love. Every dollar helps keep the servers running and the project alive 💕',
      color: 'badge-accent',
      icon: <Heart className="w-5 h-5" />,
      benefits: [
        'Show your symbolic support for the project',
        'Donator Badge on the profile',
        'Increase maximum log tags to 7',
        'Unlock more themes',
      ],
    },
    {
      name: 'Immersion Enthusiast',
      price: '$5',
      description:
        'For those who use NihongoTracker daily and want to contribute a little more to its development. This tier helps fund hosting, testing, and small feature improvements.',
      color: 'badge-secondary',
      icon: <Award className="w-5 h-5" />,
      benefits: [
        'Animated GIF Avatars',
        'Custom text in the profile donator badge',
        'Increase maximum log tags to 15',
        'Increase maximum club members to 250',
      ],
      popular: true,
    },
    {
      name: 'Avid Consumer',
      price: '$10',
      description:
        "You're going above and beyond to support NihongoTracker. This tier helps cover development and server costs while allowing the project to grow sustainably. Every update, every improvement, and every new feature is made possible thanks to people like you.",
      color: 'badge-primary',
      icon: <Rocket className="w-5 h-5" />,
      benefits: [
        'Custom donator badge color (rainbow included)',
        'Site-wide donator badge',
        'Increase the maximum log tags to 25',
        'Increase maximum club members to 1000',
      ],
    },
  ];

  const whySupport = [
    {
      title: 'Keep the Lights On',
      description:
        "Server costs, database hosting, and API integrations aren't free. Your support helps me maintain reliable service.",
      icon: <Lightbulb className="text-5xl text-warning" />,
    },
    {
      title: 'Continuous Development',
      description:
        "We're constantly adding new features, improving performance, and fixing bugs. Support enables full-time development.",
      icon: <Rocket className="text-5xl text-info" />,
    },
    {
      title: 'Community First',
      description:
        'NihongoTracker will always have a generous free tier. Supporters help me keep it that way for everyone.',
      icon: <Heart className="text-5xl text-error" />,
    },
    {
      title: 'Open Source Values',
      description:
        'Your support helps me contribute back to the open source community and keep our codebase transparent.',
      icon: <Earth className="text-5xl text-success" />,
    },
  ];

  return (
    <div className="pt-16 bg-base-100 min-h-screen">
      {/* ─── Hero ─── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="badge badge-primary badge-outline mb-6">
            Support the Project
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-6 leading-tight">
            Keep NihongoTracker <span className="text-primary">free</span>,
            fast, and growing
          </h1>
          <p className="text-xl text-base-content/60 mb-10 leading-relaxed">
            Your support helps cover infrastructure and development so I can
            keep building the best immersion tracker for Japanese learners.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={patreonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg gap-2 px-10"
            >
              Become a Patron
              <ArrowRight size={18} />
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
              Patreon Tiers
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">100%</div>
            <div className="text-sm text-base-content/50 mt-1">
              Core Features Free
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent">24/7</div>
            <div className="text-sm text-base-content/50 mt-1">
              Community Access
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-success">1</div>
            <div className="text-sm text-base-content/50 mt-1">
              Independent Creator
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why support ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-accent badge-outline mb-4">
              Why It Matters
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              Where your support goes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {whySupport.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-base-content mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  {item.description}
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
              Patreon Tiers
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              Pick the support level that fits you
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm transition-all duration-300 hover:shadow-md ${
                  tier.popular ? 'ring-2 ring-secondary' : ''
                }`}
              >
                {tier.popular && (
                  <div className="badge badge-secondary absolute -top-3 left-1/2 -translate-x-1/2">
                    Highlighted Tier
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
                    /month
                  </span>
                </div>

                <p className="text-sm text-base-content/60 leading-relaxed mb-5 min-h-24">
                  {tier.description}
                </p>

                <ul className="space-y-3 mb-6">
                  {tier.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check size={14} className="text-success shrink-0 mt-1" />
                      <span className="text-sm text-base-content/75">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={patreonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${
                    tier.popular ? 'btn-secondary' : 'btn-outline btn-primary'
                  } w-full gap-2`}
                >
                  Become a Patron
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── One-time support ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 shadow-sm text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-base-content mb-4">
              Prefer a one-time donation?
            </h2>
            <p className="text-base-content/60 mb-6 max-w-2xl mx-auto">
              Not ready for a monthly commitment? You can still support the
              project through Ko-fi.
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <a
                href="https://ko-fi.com/nihongotracker"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-info gap-2"
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
            <span className="badge badge-outline mb-4">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="collapse collapse-arrow bg-base-100 shadow border border-base-300">
              <input type="radio" name="faq-accordion" defaultChecked />
              <div className="collapse-title text-lg font-medium">
                Will NihongoTracker always be free?
              </div>
              <div className="collapse-content">
                <p className="text-base-content/70">
                  Yes! Core features will always remain free. Premium tiers
                  unlock additional features and customization options, but
                  you'll always be able to track your immersion, view stats, and
                  compete on leaderboards for free.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-100 shadow border border-base-300">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-lg font-medium">
                How do I get my supporter benefits?
              </div>
              <div className="collapse-content">
                <p className="text-base-content/70">
                  After becoming a Patreon supporter, link your Patreon account
                  in your settings. Benefits will be automatically applied to
                  your account within 24 hours.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-100 shadow border border-base-300">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-lg font-medium">
                Can I cancel anytime?
              </div>
              <div className="collapse-content">
                <p className="text-base-content/70">
                  Absolutely. You can cancel your Patreon membership at any
                  time, and you'll keep your benefits until the end of your
                  current billing period.
                </p>
              </div>
            </div>

            <div className="collapse collapse-arrow bg-base-100 shadow border border-base-300">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-lg font-medium">
                I linked my patreon and my benefits are not applying, what
                should I do?
              </div>
              <div className="collapse-content">
                <p className="text-base-content/70">
                  You can contact me through Discord:
                  <span className="font-mono">hitogi</span>.<br /> Or email me
                  at:{' '}
                  <a
                    href="mailto:support@nihongotracker.app"
                    className="link underline"
                  >
                    support@nihongotracker.app
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-28 px-4 bg-gradient-to-b from-base-100 to-base-200/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-base-content mb-4">
            Ready to support?
          </h2>
          <p className="text-lg text-base-content/55 mb-10">
            Join the supporters helping NihongoTracker stay free and keep
            improving.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={patreonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg px-12"
            >
              Become a Patron
            </a>
          </div>
          <p className="mt-8 text-sm text-base-content/50 flex items-center justify-center gap-2">
            Thank you for supporting the project{' '}
            <Heart className="text-error" size={16} />
          </p>
        </div>
      </section>
    </div>
  );
}

export default SupportScreen;
