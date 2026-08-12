import { useState, useEffect } from 'react';
import Field from '../components/ui/Field';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getLogFn, createLogFn } from '../api/trackerApi';
import { ICreateLog } from '../types';
import { useUserDataStore } from '../store/userData';
import { invalidateLogScreenQueries } from '../utils/logQueryInvalidation.js';
import {
  Book,
  BookOpen,
  Play,
  GamepadDirectional,
  Video,
  Volume2,
  Ellipsis,
  Share2,
  Plus,
  Clapperboard,
  MonitorPlay,
} from 'lucide-react';
import { validateSharedLogData } from '../utils/validation';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { useTranslation } from 'react-i18next';

const logTypeConfig = {
  reading: {
    labelKey: 'common:mediaTypes.reading',
    icon: Book,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  anime: {
    labelKey: 'common:mediaTypes.anime',
    icon: Play,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    borderColor: 'border-secondary/20',
  },
  vn: {
    labelKey: 'common:mediaTypes.vn',
    icon: GamepadDirectional,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/20',
  },
  game: {
    labelKey: 'common:mediaTypes.game',
    icon: GamepadDirectional,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  video: {
    labelKey: 'common:mediaTypes.video',
    icon: Video,
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
  },
  manga: {
    labelKey: 'common:mediaTypes.manga',
    icon: Book,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  audio: {
    labelKey: 'common:mediaTypes.audio',
    icon: Volume2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  movie: {
    labelKey: 'common:mediaTypes.movie',
    icon: Clapperboard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
  },
  'tv show': {
    labelKey: 'common:mediaTypes.tvShow',
    icon: MonitorPlay,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  book: {
    labelKey: 'common:mediaTypes.book',
    icon: BookOpen,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
  },
  other: {
    labelKey: 'common:mediaTypes.other',
    icon: Ellipsis,
    color: 'text-neutral',
    bgColor: 'bg-neutral/10',
    borderColor: 'border-neutral/20',
  },
} as const;

function SharedLogScreen() {
  const { t } = useTranslation(['logs', 'common']);
  const vt = useValidationText();
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();

  const [customValues, setCustomValues] = useState({
    episodes: 0,
    time: 0,
    chars: 0,
    pages: 0,
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const {
    data: sharedLog,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sharedLog', logId],
    queryFn: () => getLogFn(logId!),
    enabled: !!logId,
  });

  const { mutate: createLog, isPending: isCreating } = useMutation({
    mutationFn: createLogFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', 'user'].includes(query.queryKey[0] as string),
      });
      invalidateLogScreenQueries(queryClient, sharedLog?.type, user?.username);
      toast.success(t('toast.createdFromShared'));
      navigate(`/user/${user?.username}`);
    },
  });

  useEffect(() => {
    if (sharedLog) {
      setCustomValues({
        episodes: sharedLog.type === 'anime' ? sharedLog.episodes || 0 : 0,
        time: sharedLog.time || 0,
        chars: sharedLog.chars || 0,
        pages: sharedLog.pages || 0,
        description: sharedLog.description || '',
      });
    }
  }, [sharedLog]);

  // Validate form when values change
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      const validation = validateSharedLogData(customValues);
      setErrors(validation.errors);
    }
  }, [customValues, touched]);

  const handleFieldChange = (
    field: keyof typeof customValues,
    value: string | number
  ) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setCustomValues({ ...customValues, [field]: value });
  };

  const handleCreateLog = () => {
    // Mark all fields as touched
    setTouched({
      description: true,
      episodes: true,
      time: true,
      chars: true,
      pages: true,
    });

    const validation = validateSharedLogData(customValues);
    setErrors(validation.errors);

    if (!validation.isValid) {
      toast.error(t('toast.fixValidation'));
      return;
    }

    if (!sharedLog) {
      toast.error(t('toast.sharedUnavailable'));
      return;
    }

    const logData: ICreateLog = {
      type: sharedLog.type,
      description: customValues.description || sharedLog.description || '',
      episodes:
        sharedLog.type === 'anime'
          ? customValues.episodes || undefined
          : undefined,
      time: customValues.time || undefined,
      chars: customValues.chars || undefined,
      pages: customValues.pages || undefined,
      private: false,
      isAdult: sharedLog.isAdult || false,
      date: sharedLog.date,
      ...(sharedLog.mediaId && { mediaId: sharedLog.mediaId }),
    };

    createLog(logData);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg surface">
          <div className="card-body text-center p-8">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-base-content mb-2">
                {t('shared.ctaTitle')}
              </h2>
              <p className="text-base-content/70 text-lg">
                {t('shared.ctaBody')}
              </p>
            </div>

            <div className="bg-primary/5 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="badge badge-primary badge-outline">
                  <Book className="w-3 h-3 mr-1" />
                  {t('shared.sharedProgress')}
                </div>
              </div>
              <p className="text-sm text-base-content/60">
                {t('shared.joinBody')}
              </p>
            </div>

            <div className="space-y-3">
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={() => navigate('/login')}
              >
                <Play className="w-5 h-5" />
                {t('shared.signIn')}
              </button>
              <div className="divider text-xs">or</div>
              <button
                className="btn btn-outline btn-lg w-full"
                onClick={() => navigate('/register')}
              >
                {t('shared.createAccount')}
              </button>
            </div>

            <p className="text-xs text-base-content/50 mt-6">
              {t('shared.joinPitch')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card w-full max-w-md surface">
          <div className="card-body text-center p-8">
            <div className="flex justify-center mb-6">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {t('shared.loadingTitle')}
            </h2>
            <p className="text-base-content/60">
              {t('shared.loadingSubtitle')}
            </p>
            <div className="flex justify-center gap-1 mt-4">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedLog) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card w-full max-w-md surface">
          <div className="card-body text-center p-8">
            <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">😔</span>
            </div>
            <h2 className="text-2xl font-bold text-base-content mb-4">
              {t('shared.notFoundTitle')}
            </h2>
            <p className="text-base-content/70 mb-6">
              {t('shared.notFoundBody')}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/')}
                className="btn btn-primary w-full"
              >
                {t('shared.goToDashboard')}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="btn btn-ghost w-full"
              >
                {t('shared.goBack')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = logTypeConfig[sharedLog.type];
  const TypeIcon = typeConfig.icon;

  const logTitle =
    sharedLog.media &&
    typeof sharedLog.media === 'object' &&
    sharedLog.media.title?.contentTitleNative
      ? sharedLog.media.title.contentTitleNative
      : sharedLog.description || 'Untitled Log';

  const coverImage =
    sharedLog.media &&
    typeof sharedLog.media === 'object' &&
    sharedLog.media.contentImage;

  return (
    <div className="min-h-screen bg-base-200 pt-28 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-base-100 rounded-full px-6 py-3 shadow-lg mb-4">
            <Share2 className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">{t('shared.title')}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-base-content mb-2">
            {t('shared.addHeading')}
          </h1>
          <p className="text-base-content/70 text-lg max-w-2xl mx-auto">
            {t('shared.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {coverImage && (
                <div className="card surface mb-6">
                  <figure className="aspect-[3/4] overflow-hidden rounded-xl">
                    <img
                      src={coverImage}
                      alt={logTitle}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </figure>
                </div>
              )}

              <div className="card surface">
                <div className="card-body p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 ${typeConfig.bgColor} rounded-xl`}>
                      <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
                    </div>
                    <div>
                      <div className={`badge ${typeConfig.color} gap-1`}>
                        <TypeIcon className="w-3 h-3" />
                        {t(typeConfig.labelKey)}
                      </div>
                      <h3 className="font-semibold text-lg mt-1">
                        {t('shared.sharedProgress')}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-base-content/60">
                        {t('shared.titleLabel')}
                      </span>
                      <p className="font-semibold">{logTitle}</p>
                    </div>

                    {sharedLog.media &&
                      typeof sharedLog.media === 'object' &&
                      sharedLog.media.title?.contentTitleEnglish && (
                        <div>
                          <span className="text-sm font-medium text-base-content/60">
                            {t('shared.englishTitle')}
                          </span>
                          <p className="text-sm">
                            {sharedLog.media.title.contentTitleEnglish}
                          </p>
                        </div>
                      )}

                    <div className="divider my-4"></div>

                    <div className="space-y-2">
                      {sharedLog.type === 'anime' && sharedLog.episodes ? (
                        <div className="flex justify-between items-center py-2 px-3 surface-muted">
                          <span className="text-sm font-medium">
                            {t('shared.episodes')}
                          </span>
                          <span className="font-bold">
                            {sharedLog.episodes}
                          </span>
                        </div>
                      ) : null}
                      {sharedLog.time ? (
                        <div className="flex justify-between items-center py-2 px-3 surface-muted">
                          <span className="text-sm font-medium">
                            {t('shared.time')}
                          </span>
                          <span className="font-bold">
                            {sharedLog.time >= 60
                              ? `${Math.floor(sharedLog.time / 60)}h ${sharedLog.time % 60}m`
                              : `${sharedLog.time}m`}
                          </span>
                        </div>
                      ) : null}
                      {sharedLog.chars ? (
                        <div className="flex justify-between items-center py-2 px-3 surface-muted">
                          <span className="text-sm font-medium">
                            {t('shared.characters')}
                          </span>
                          <span className="font-bold">
                            {sharedLog.chars.toLocaleString()}
                          </span>
                        </div>
                      ) : null}
                      {sharedLog.pages ? (
                        <div className="flex justify-between items-center py-2 px-3 surface-muted">
                          <span className="text-sm font-medium">
                            {t('shared.pages')}
                          </span>
                          <span className="font-bold">{sharedLog.pages}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded-lg">
                        <span className="text-sm font-medium">
                          {t('shared.xpEarned')}
                        </span>
                        <span className="font-bold text-primary">
                          {sharedLog.xp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card surface">
              <div className="card-body p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-success/10 rounded-xl">
                    <Plus className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {t('shared.addToProgress')}
                    </h2>
                    <p className="text-base-content/60">
                      {t('shared.copyHint')}
                    </p>
                  </div>
                </div>

                <div className="alert alert-success mb-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-bold">{t('shared.readyToAdd')}</h3>
                    <div className="text-sm">
                      This log will be added to your profile: "
                      {customValues.description}" • {t(typeConfig.labelKey)}
                      {customValues.time > 0 && ` • ${customValues.time} min`}
                      {sharedLog.type === 'anime' &&
                        customValues.episodes > 0 &&
                        ` • ${customValues.episodes} episodes`}
                      {customValues.chars > 0 &&
                        ` • ${customValues.chars.toLocaleString()} chars`}
                      {customValues.pages > 0 &&
                        ` • ${customValues.pages} pages`}
                    </div>
                  </div>
                </div>

                <details className="collapse collapse-arrow bg-base-200">
                  <summary className="collapse-title text-lg font-medium">
                    {t('shared.adjustValues')}
                  </summary>
                  <div className="collapse-content">
                    <div className="space-y-4 pt-4">
                      <Field label={t('shared.description')}>
                        <input
                          type="text"
                          className={`input w-full ${
                            errors.description
                              ? 'input-error'
                              : touched.description &&
                                  customValues.description &&
                                  !errors.description
                                ? 'input-success'
                                : ''
                          }`}
                          value={customValues.description}
                          onChange={(e) =>
                            handleFieldChange('description', e.target.value)
                          }
                          placeholder={t('shared.descriptionPlaceholder')}
                        />
                        {errors.description && (
                          <label className="label">
                            <span className="text-error">
                              {vt(errors.description)}
                            </span>
                          </label>
                        )}
                      </Field>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sharedLog.type === 'anime' && (
                          <Field label={t('shared.episodes')}>
                            <input
                              type="number"
                              min="0"
                              className={`input w-full ${
                                errors.episodes ? 'input-error' : ''
                              }`}
                              value={customValues.episodes}
                              onChange={(e) =>
                                handleFieldChange(
                                  'episodes',
                                  Number(e.target.value)
                                )
                              }
                              placeholder={t('shared.episodesPlaceholder')}
                            />
                            {errors.episodes && (
                              <label className="label">
                                <span className="text-error">
                                  {vt(errors.episodes)}
                                </span>
                              </label>
                            )}
                          </Field>
                        )}

                        <Field label={t('shared.timeMinutes')}>
                          <input
                            type="number"
                            min="0"
                            className="input w-full"
                            value={customValues.time}
                            onChange={(e) =>
                              setCustomValues({
                                ...customValues,
                                time: Number(e.target.value),
                              })
                            }
                            placeholder={t('shared.timePlaceholder')}
                          />
                        </Field>

                        {(sharedLog.type === 'reading' ||
                          sharedLog.type === 'vn' ||
                          sharedLog.type === 'manga') && (
                          <Field label={t('shared.characters')}>
                            <input
                              type="number"
                              min="0"
                              className="input w-full"
                              value={customValues.chars}
                              onChange={(e) =>
                                setCustomValues({
                                  ...customValues,
                                  chars: Number(e.target.value),
                                })
                              }
                              placeholder={t('shared.charsPlaceholder')}
                            />
                          </Field>
                        )}

                        {sharedLog.type === 'manga' && (
                          <Field label={t('shared.pages')}>
                            <input
                              type="number"
                              min="0"
                              className="input w-full"
                              value={customValues.pages}
                              onChange={(e) =>
                                setCustomValues({
                                  ...customValues,
                                  pages: Number(e.target.value),
                                })
                              }
                              placeholder={t('shared.pagesPlaceholder')}
                            />
                          </Field>
                        )}
                      </div>
                    </div>
                  </div>
                </details>

                <div className="flex flex-col sm:flex-row gap-4 justify-end mt-8 pt-6 border-t border-base-300">
                  <button
                    onClick={() => navigate('/')}
                    className="btn btn-outline btn-lg w-full sm:w-auto"
                    disabled={isCreating}
                  >
                    {t('shared.maybeLater')}
                  </button>
                  <button
                    onClick={handleCreateLog}
                    disabled={isCreating || Object.keys(errors).length > 0}
                    className="btn btn-primary btn-lg w-full sm:w-auto"
                  >
                    {isCreating ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        {t('shared.adding')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        {t('shared.addToMyProgress')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SharedLogScreen;
