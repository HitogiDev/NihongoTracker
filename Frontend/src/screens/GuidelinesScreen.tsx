import { useTranslation } from 'react-i18next';

interface GuidelinesLink {
  after?: string;
  before?: string;
  href: string;
  label: string;
}

interface GuidelinesSection {
  heading: string;
  items?: string[];
  link?: GuidelinesLink;
  paragraphs?: string[];
}

interface GuidelinesData {
  intro: string[];
  lastUpdated: string;
  sections: GuidelinesSection[];
  title: string;
}

export default function GuidelinesScreen() {
  const { t } = useTranslation('guidelines');
  const read = t as unknown as (
    key: string,
    options: { returnObjects: true },
  ) => unknown;
  const data = read('document', { returnObjects: true }) as GuidelinesData;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 pt-28">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">{data.title}</h1>
        <p className="mt-3 text-sm text-base-content/60">
          {t('lastUpdated', { date: data.lastUpdated })}
        </p>
        <div className="mt-6 space-y-3 text-base-content/80">
          {data.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </header>

      <div className="space-y-5">
        {data.sections.map((section) => (
          <section key={section.heading} className="surface p-5 sm:p-6">
            <h2 className="text-2xl font-bold">{section.heading}</h2>

            {section.paragraphs && (
              <div className="mt-4 space-y-3 text-base-content/80">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}

            {section.items && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-base-content/80">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}

            {section.link && (
              <p className="mt-4 text-base-content/80">
                {section.link.before}{' '}
                <a
                  href={section.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  {section.link.label}
                </a>
                {section.link.after ? ` ${section.link.after}` : ''}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
