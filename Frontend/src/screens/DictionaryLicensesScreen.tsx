import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink } from 'lucide-react';

import axiosInstance from '../api/axiosConfig';
import PageContainer from '../components/ui/PageContainer';
import type { DictionaryLicense } from '../components/dictionary/DictionaryPopup';

interface FullLicense extends DictionaryLicense {
  sources: { name: string; license: string; url: string | null }[];
}

/**
 * Licences for the dictionaries this instance serves.
 *
 * Not a formality. Jitendex is CC BY-SA 4.0 over JMdict (EDRDG) and Tatoeba;
 * once the definitions come from our servers rather than from a file the reader
 * downloaded, crediting those projects is our obligation. The popup carries the
 * short form and links here for the whole of it.
 */
export default function DictionaryLicensesScreen() {
  const { t } = useTranslation('texthooker');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dictionary-licenses'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<FullLicense[]>('dictionary/licenses');
      return data;
    },
    retry: false,
  });

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {t('dictionary.licensesTitle')}
          </h1>
          <p className="text-base-content/70">{t('dictionary.licensesIntro')}</p>
        </header>

        {isLoading ? <p className="text-base-content/60">{t('dictionary.loading')}</p> : null}

        {isError ? (
          <div className="alert alert-warning">
            <span>{t('dictionary.unavailable')}</span>
          </div>
        ) : null}

        {data?.length === 0 ? (
          <p className="text-base-content/60">{t('dictionary.noDictionaries')}</p>
        ) : null}

        {data?.map((entry) => (
          <section key={entry.name} className="surface p-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-bold">{entry.name}</h2>
              <span className="badge badge-outline badge-sm">{entry.license}</span>
              {entry.url ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link link-hover text-sm inline-flex items-center gap-1"
                >
                  {entry.url.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : null}
            </div>

            <p className="text-sm text-base-content/80">{entry.attribution}</p>

            {entry.sources.length > 0 ? (
              <div className="space-y-1">
                <h3 className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('dictionary.derivedFrom')}
                </h3>
                <ul className="space-y-1">
                  {entry.sources.map((source) => (
                    <li key={source.name} className="text-sm flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{source.name}</span>
                      <span className="badge badge-ghost badge-xs">{source.license}</span>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-hover text-base-content/60"
                        >
                          {source.url.replace(/^https?:\/\//, '')}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
