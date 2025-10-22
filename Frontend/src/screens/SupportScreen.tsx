import { FaPatreon, FaHeart, FaCoffee } from 'react-icons/fa';
import { IoRocketSharp } from 'react-icons/io5';
import {
  MdWorkspacePremium,
  MdLightbulb,
  MdFavorite,
  MdPublic,
} from 'react-icons/md';

interface PatreonTier {
  name: string;
  price: string;
  description: string;
  color: string;
  icon: JSX.Element;
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
      icon: <FaHeart className="text-2xl" />,
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
      icon: <MdWorkspacePremium className="text-2xl" />,
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
      icon: <IoRocketSharp className="text-2xl" />,
      benefits: [
        'Custom donator badge color (rainbow included)',
        'Site-wide donator badge',
        'Increase the maximum log tags to 25',
        'Increase maximum club members to 250',
      ],
    },
  ];

  const whySupport = [
    {
      title: 'Keep the Lights On',
      description:
        "Server costs, database hosting, and API integrations aren't free. Your support helps me maintain reliable service.",
      icon: <MdLightbulb className="text-5xl text-warning" />,
    },
    {
      title: 'Continuous Development',
      description:
        "We're constantly adding new features, improving performance, and fixing bugs. Support enables full-time development.",
      icon: <IoRocketSharp className="text-5xl text-info" />,
    },
    {
      title: 'Community First',
      description:
        'NihongoTracker will always have a generous free tier. Supporters help me keep it that way for everyone.',
      icon: <MdFavorite className="text-5xl text-error" />,
    },
    {
      title: 'Open Source Values',
      description:
        'Your support helps me contribute back to the open source community and keep our codebase transparent.',
      icon: <MdPublic className="text-5xl text-success" />,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 pt-32 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
          <FaHeart className="text-error" />
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
                  <FaPatreon className="text-xl" />
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
              <FaCoffee />
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
            <FaPatreon className="text-2xl" />
            Become a Patron
          </a>
          <p className="text-sm text-base-content/60 mt-4 flex items-center gap-2 justify-center">
            Thank you for your support! <FaHeart className="text-error" />
          </p>
        </div>
      </div>
    </div>
  );
}

export default SupportScreen;
