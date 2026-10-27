import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Bell, Send } from 'lucide-react';
import { adminSendNotificationFn } from '../api/trackerApi';
import { getApiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import Field from './ui/Field';
import Modal from './ui/Modal';
import { BTN } from './ui/buttons';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../i18n/languages';

/** Keep aligned with MAX_NOTIFICATION_RECIPIENTS in the admin controller. */
const MAX_RECIPIENTS = 100;
const TITLE_MAX = 300;
const BODY_MAX = 1000;

type Audience = 'all' | 'users';
type Content = Record<SupportedLanguage, { title: string; body: string }>;

function emptyContent(): Content {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, { title: '', body: '' }])
  ) as Content;
}

function parseUsernames(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((name) => name.trim().replace(/^@/, ''))
        .filter(Boolean)
    ),
  ];
}

export default function AdminNotificationPanel() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<Audience>('users');
  const [usernamesText, setUsernamesText] = useState('');
  const [content, setContent] = useState<Content>(emptyContent);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [link, setLink] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const usernames = parseUsernames(usernamesText);
  const trimmedLink = link.trim();
  const linkInvalid =
    trimmedLink !== '' &&
    (!trimmedLink.startsWith('/') || trimmedLink.startsWith('//'));
  const tooManyUsers = usernames.length > MAX_RECIPIENTS;
  const { title, body } = content[language];
  const englishTitle = content.en.title.trim();
  const canSend =
    englishTitle !== '' &&
    !linkInvalid &&
    (audience === 'all' || (usernames.length > 0 && !tooManyUsers));

  const sendMutation = useMutation({
    mutationFn: () =>
      adminSendNotificationFn({
        audience,
        usernames: audience === 'users' ? usernames : undefined,
        title: englishTitle,
        body: content.en.body.trim() || undefined,
        link: trimmedLink || undefined,
        translations: Object.fromEntries(
          SUPPORTED_LANGUAGES.filter((lang) => lang !== 'en').map((lang) => [
            lang,
            {
              title: content[lang].title.trim() || undefined,
              body: content[lang].body.trim() || undefined,
            },
          ])
        ),
      }),
    onSuccess: (res) => {
      toast.success(t('notifications.sent', { count: res.sent }));
      setConfirmOpen(false);
      setContent(emptyContent());
      setLanguage('en');
      setLink('');
      setUsernamesText('');
      // The admin can be a recipient too.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error(getApiErrorMessage(error));
    },
  });

  const updateContent = (field: 'title' | 'body', value: string) => {
    setContent((current) => ({
      ...current,
      [language]: { ...current[language], [field]: value },
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend || sendMutation.isPending) return;
    if (audience === 'all') {
      setConfirmOpen(true);
      return;
    }
    sendMutation.mutate();
  };

  return (
    <section className="card surface">
      <form className="card-body gap-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="card-title">{t('notifications.title')}</h2>
          <p className="text-sm text-base-content/70">
            {t('notifications.description')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-2">
            <Field label={t('notifications.audience')}>
              <div className="join">
                <button
                  type="button"
                  className={audience === 'users' ? BTN.segmentActive : BTN.segment}
                  onClick={() => setAudience('users')}
                >
                  {t('notifications.audienceUsers')}
                </button>
                <button
                  type="button"
                  className={audience === 'all' ? BTN.segmentActive : BTN.segment}
                  onClick={() => setAudience('all')}
                >
                  {t('notifications.audienceAll')}
                </button>
              </div>
            </Field>

            {audience === 'users' ? (
              <Field
                label={t('notifications.usernames')}
                aside={t('notifications.usernamesCount', {
                  count: usernames.length,
                })}
                hint={t('notifications.usernamesHint', { max: MAX_RECIPIENTS })}
                error={
                  tooManyUsers
                    ? t('notifications.tooMany', { max: MAX_RECIPIENTS })
                    : undefined
                }
                required
              >
                {(id) => (
                  <textarea
                    id={id}
                    className="textarea focus:textarea-primary w-full"
                    rows={2}
                    value={usernamesText}
                    placeholder={t('notifications.usernamesPlaceholder')}
                    onChange={(event) => setUsernamesText(event.target.value)}
                  />
                )}
              </Field>
            ) : (
              <p className="text-sm text-base-content/60">
                {t('notifications.allHint')}
              </p>
            )}

            <div className="pt-2">
              <div role="tablist" className="tabs tabs-border">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    className={`tab ${language === lang ? 'tab-active' : ''}`}
                    onClick={() => setLanguage(lang)}
                  >
                    {LANGUAGE_LABELS[lang]}
                    {content[lang].title.trim() && (
                      <span className="badge badge-xs badge-primary ml-2" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-base-content/60">
                {language === 'en'
                  ? t('notifications.englishHint')
                  : t('notifications.translationHint')}
              </p>
            </div>

            <Field
              label={t('notifications.titleField')}
              aside={`${title.length}/${TITLE_MAX}`}
              required={language === 'en'}
            >
              {(id) => (
                <input
                  id={id}
                  className="input focus:input-primary w-full"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(event) => updateContent('title', event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t('notifications.body')}
              aside={`${body.length}/${BODY_MAX}`}
            >
              {(id) => (
                <textarea
                  id={id}
                  className="textarea focus:textarea-primary w-full"
                  rows={3}
                  value={body}
                  maxLength={BODY_MAX}
                  placeholder={t('notifications.bodyPlaceholder')}
                  onChange={(event) => updateContent('body', event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t('notifications.link')}
              hint={t('notifications.linkHint')}
              error={linkInvalid ? t('notifications.linkInvalid') : undefined}
            >
              {(id) => (
                <input
                  id={id}
                  className="input focus:input-primary w-full"
                  value={link}
                  maxLength={500}
                  placeholder="/changelog"
                  onChange={(event) => setLink(event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {t('notifications.preview')} ({LANGUAGE_LABELS[language]})
            </p>
            <div className="rounded-box border border-base-300 border-l-4 border-l-primary bg-base-100 px-3 py-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-base-300 text-base-content/70">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug line-clamp-2 break-words">
                    {title.trim() || englishTitle || (
                      <span className="text-base-content/40">
                        {t('notifications.previewEmpty')}
                      </span>
                    )}
                  </p>
                  {(body.trim() || content.en.body.trim()) && (
                    <p className="mt-0.5 text-xs text-base-content/60 line-clamp-1 break-words">
                      {body.trim() || content.en.body.trim()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-actions justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!canSend}
            loading={sendMutation.isPending && !confirmOpen}
            loadingText={t('notifications.sending')}
          >
            <Send className="w-4 h-4" />
            {t('notifications.send')}
          </Button>
        </div>
      </form>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!sendMutation.isPending) setConfirmOpen(false);
        }}
        title={t('notifications.confirmTitle')}
        size="sm"
        dismissable={!sendMutation.isPending}
        actions={
          <>
            <Button
              appearance="ghost"
              disabled={sendMutation.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={sendMutation.isPending}
              loadingText={t('notifications.sending')}
              onClick={() => sendMutation.mutate()}
            >
              {t('notifications.confirmSend')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-base-content/70">
          {t('notifications.confirmBody')}
        </p>
      </Modal>
    </section>
  );
}
