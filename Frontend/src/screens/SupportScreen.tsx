import { Award, Lightbulb, Heart, Earth, Rocket } from 'lucide-react';

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
        'You like what NihongoTracker stands for — helping self-learners track their Japanese immersion — and you want to show a little love. Every dollar helps keep the servers running and the project alive 💕',
      color: 'badge-accent',
      icon: <Heart className="text-2xl" />,
      benefits: [
        'Show your symbolic support for the project',
        "Your name added to the Supporter Wall in the app's About section (optional)",
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
      icon: <Award className="text-2xl" />,
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
      icon: <Rocket className="text-2xl" />,
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
    <div className="container mx-auto px-4 py-8 pt-32 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
          <Heart className="text-error" />
          Support NihongoTracker
        </h1>
        <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
          Help me keep NihongoTracker free and growing. Your support enables me
          to build the best Japanese immersion tracking platform.
        </p>
      </div>

      {/* Why Support Section */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Why Your Support Matters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {whySupport.map((item) => (
            <div
              key={item.title}
              className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="card-body items-center text-center">
                <div className="mb-3">{item.icon}</div>
                <h3 className="card-title text-lg">{item.title}</h3>
                <p className="text-sm text-base-content/70">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Patreon Tiers */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-12 text-center">
          Patreon Membership Tiers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`card bg-base-100 shadow-lg hover:shadow-xl transition-all ${
                tier.popular ? 'ring-2 ring-secondary scale-105' : ''
              }`}
            >
              <div className="card-body">
                {tier.popular && (
                  <div className="badge badge-secondary absolute -top-3 left-1/2 -translate-x-1/2">
                    Highlighted Tier
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className={`badge ${tier.color} badge-lg gap-2`}>
                    {tier.icon}
                    {tier.name}
                  </div>
                </div>
                <div className="text-3xl font-bold mb-2">
                  {tier.price}
                  <span className="text-sm font-normal text-base-content/60">
                    /month
                  </span>
                </div>
                <p className="text-sm text-base-content/70 mb-4">
                  {tier.description}
                </p>
                <div className="divider my-2"></div>
                <ul className="space-y-3 mb-6 flex-1">
                  {tier.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="text-success text-lg flex-shrink-0">
                        ✓
                      </span>
                      <span className="text-sm">{benefit}</span>
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
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5 fill-current"
                  >
                    <title>Patreon</title>
                    <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
                  </svg>
                  Become a Patron
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One-Time Donation Option */}
      <div className="card bg-base-100 shadow-lg mb-12">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-2xl mb-4">
            Prefer a One-Time Donation?
          </h2>
          <p className="text-base-content/70 mb-6 max-w-2xl">
            Not ready for a monthly commitment? You can still support us with a
            one-time donation through Ko-fi or Buy Me a Coffee!
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

      {/* FAQ */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="collapse collapse-arrow bg-base-100 shadow">
            <input type="radio" name="faq-accordion" defaultChecked />
            <div className="collapse-title text-lg font-medium">
              Will NihongoTracker always be free?
            </div>
            <div className="collapse-content">
              <p className="text-base-content/70">
                Yes! Core features will always remain free. Premium tiers unlock
                additional features and customization options, but you'll always
                be able to track your immersion, view stats, and compete on
                leaderboards for free.
              </p>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100 shadow">
            <input type="radio" name="faq-accordion" />
            <div className="collapse-title text-lg font-medium">
              How do I get my supporter benefits?
            </div>
            <div className="collapse-content">
              <p className="text-base-content/70">
                After becoming a Patreon supporter, link your Patreon account in
                your settings. Benefits will be automatically applied to your
                account within 24 hours.
              </p>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100 shadow">
            <input type="radio" name="faq-accordion" />
            <div className="collapse-title text-lg font-medium">
              Can I cancel anytime?
            </div>
            <div className="collapse-content">
              <p className="text-base-content/70">
                Absolutely! You can cancel your Patreon membership at any time.
                You'll keep your benefits until the end of your current billing
                period.
              </p>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100 shadow">
            <input type="radio" name="faq-accordion" />
            <div className="collapse-title text-lg font-medium">
              What happens to my data if I stop supporting?
            </div>
            <div className="collapse-content">
              <p className="text-base-content/70">
                Your data is always yours! If you stop supporting, you'll lose
                access to premium features, but all your logs, stats, and
                progress remain intact.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="card bg-gradient-to-br from-primary/20 to-secondary/20 shadow-lg">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-2xl mb-4">
            Ready to Support NihongoTracker?
          </h2>
          <p className="text-base-content/80 mb-6 max-w-2xl">
            Join our amazing community of supporters and help us build the best
            Japanese immersion tracking platform!
          </p>
          <a
            href={patreonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg gap-2"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="size-5 fill-current"
            >
              <title>Patreon</title>
              <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
            </svg>
            Become a Patron
          </a>
          <p className="text-sm text-base-content/60 mt-4 flex items-center gap-2 justify-center">
            Thank you for your support! <Heart className="text-error" />
          </p>
        </div>
      </div>
    </div>
  );
}

export default SupportScreen;
