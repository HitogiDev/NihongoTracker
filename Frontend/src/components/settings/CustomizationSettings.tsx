import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { Info, Lock } from 'lucide-react';
import {
  getCustomizationFn,
  updateCustomizationFn,
} from '../../api/trackerApi';
import { useUserDataStore } from '../../store/userData';
import { getApiErrorMessage } from '../../utils/apiError';
import { getAchievementName } from '../../utils/achievementText';
import {
  ACCENT_PRESET_COLORS,
  getAvatarFrameClass,
  getHeatmapCellColor,
  getNameEffectRender,
  getProfileAccentStyle,
  getSignatureStatValue,
  hasAvatarFrame,
  resolveAccentColor,
} from '../../utils/customization';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getAvatarInitials } from '../../utils/avatar';
import BannerEffectOverlay from '../BannerEffectOverlay';
import type {
  AvatarFrame,
  BannerEffect,
  CustomizationLockReason,
  ProfileAccent,
  ICustomizationOption,
  IUserCustomization,
  NameEffect,
  SignatureStat,
} from '../../types';

const DEFAULT_COLOR_1 = '#7c3aed';
const DEFAULT_COLOR_2 = '#ec4899';
const DEFAULT_ACCENT_COLOR = '#7c3aed';

/**
 * Settings › Customization.
 *
 * The server is the source of truth for what is unlocked: this screen renders
 * whatever `GET /users/me/customization` reports, so adding a cosmetic (or
 * changing a tier rule) needs no change here.
 */
export default function CustomizationSettings() {
  const { t } = useTranslation('settings');
  const { t: tProfile } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const { user, setUser } = useUserDataStore();
  const prefersReducedMotion = useReducedMotion();

  const { data, isLoading } = useQuery({
    queryKey: ['customization'],
    queryFn: getCustomizationFn,
  });

  const [draft, setDraft] = useState<IUserCustomization>({});

  useEffect(() => {
    if (data?.customization) {
      setDraft({
        nameEffect: data.customization.nameEffect ?? 'none',
        nameColor1: data.customization.nameColor1 ?? '',
        nameColor2: data.customization.nameColor2 ?? '',
        avatarFrame: data.customization.avatarFrame ?? 'none',
        profileAccent: data.customization.profileAccent ?? 'default',
        accentColor: data.customization.accentColor ?? '',
        signatureStat: data.customization.signatureStat ?? 'none',
        equippedTitle: data.customization.equippedTitle ?? '',
        bannerEffect: data.customization.bannerEffect ?? 'none',
      });
    }
  }, [data?.customization]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: updateCustomizationFn,
    onSuccess: (result) => {
      toast.success(t('customization.saved'));
      if (user) {
        setUser({ ...user, customization: result.customization });
      }
      void queryClient.invalidateQueries({ queryKey: ['customization'] });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'user',
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof AxiosError
          ? getApiErrorMessage(error)
          : tCommon('errors.generic')
      );
    },
  });

  const options = data?.options;

  const equippedTitleName = draft.equippedTitle
    ? getAchievementName({ key: draft.equippedTitle })
    : '';

  const previewEffect = getNameEffectRender(draft);
  const previewSignature = getSignatureStatValue(
    draft.signatureStat,
    draft.signatureStat && draft.signatureStat !== 'none'
      ? data?.signatureValues?.[draft.signatureStat]
      : null
  );

  const titleOptions = useMemo(() => {
    if (!options?.titles) return [];
    return options.titles
      .map((title) => ({
        key: title.key,
        label: getAchievementName({ key: title.key }) || title.key,
        rarity: title.rarity,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [options?.titles]);

  function lockLabel(option: {
    lockReason: CustomizationLockReason;
    requirement?: number;
  }): string {
    switch (option.lockReason) {
      case 'patreon':
        return t('customization.locks.patreon');
      case 'patreonPlus':
        return t('customization.locks.patreonPlus');
      case 'patreonConsumer':
        return t('customization.locks.patreonConsumer');
      case 'level':
        return t('customization.locks.level', {
          level: option.requirement ?? 0,
        });
      default:
        return '';
    }
  }

  function optionButton<T extends string>(
    option: ICustomizationOption<T>,
    label: string,
    selected: boolean,
    onSelect: () => void,
    preview?: React.ReactNode
  ) {
    const locked = !option.unlocked;
    return (
      <button
        key={option.value}
        type="button"
        disabled={locked}
        onClick={onSelect}
        title={locked ? lockLabel(option) : undefined}
        className={`btn h-auto min-h-16 flex-col gap-1 py-2 normal-case ${
          selected ? 'btn-primary' : 'btn-outline'
        }`}
      >
        {preview}
        <span className="flex items-center gap-1 text-xs font-medium">
          {locked && <Lock className="h-3 w-3" />}
          {label}
        </span>
        {locked && (
          <span className="text-[0.65rem] font-normal opacity-70">
            {lockLabel(option)}
          </span>
        )}
      </button>
    );
  }

  if (isLoading || !options) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {prefersReducedMotion && (
        <div className="alert alert-info">
          <Info className="h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-semibold">
              {t('customization.reducedMotionTitle')}
            </h3>
            <p className="text-sm">{t('customization.reducedMotionBody')}</p>
          </div>
        </div>
      )}

      {/* Live preview */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.previewTitle')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.previewSubtitle')}
          </p>

          <div
            className="relative mt-3 h-40 w-full overflow-hidden rounded-lg bg-linear-to-br from-primary/40 to-secondary/40 bg-cover bg-center"
            style={
              user?.banner
                ? { backgroundImage: `url(${user.banner})` }
                : undefined
            }
          >
            <BannerEffectOverlay
              effect={draft.bannerEffect}
              seed={user?.username ?? 'preview'}
            />
            <div className="relative z-[1] flex h-full flex-col justify-end bg-linear-to-t from-black/60 to-40% p-4">
              <div className="flex items-end gap-3">
                <div
                  className={
                    hasAvatarFrame(draft.avatarFrame)
                      ? getAvatarFrameClass(draft.avatarFrame)
                      : undefined
                  }
                >
                  <div className="avatar">
                    <div className="w-16 rounded-full">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-base-300 font-semibold">
                          {getAvatarInitials(user?.username)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] ${previewEffect.className}`}
                      style={previewEffect.style}
                    >
                      {user?.username}
                    </span>
                    {equippedTitleName && (
                      <span className="badge badge-outline badge-sm border-white/40 bg-black/30 text-white backdrop-blur-sm">
                        {equippedTitleName}
                      </span>
                    )}
                  </div>
                  {previewSignature && (
                    <p className="text-sm text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                      {tProfile(previewSignature.labelKey, {
                        value: previewSignature.decimal
                          ? previewSignature.value.toFixed(1)
                          : previewSignature.value.toLocaleString(),
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Name effect */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.nameEffect')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.nameEffectHint')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.nameEffects.map((option) =>
              optionButton<NameEffect>(
                option,
                t(`customization.nameEffects.${option.value}`),
                (draft.nameEffect ?? 'none') === option.value,
                () =>
                  setDraft((prev) => ({ ...prev, nameEffect: option.value }))
              )
            )}
          </div>

          {(draft.nameEffect ?? 'none') !== 'none' && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label>
                <span className="mb-1 block text-xs">
                  {t('customization.color1')}
                </span>
                <input
                  type="color"
                  className="h-10 w-20 cursor-pointer surface disabled:cursor-not-allowed"
                  disabled={!options.customNameColors.unlocked}
                  value={draft.nameColor1 || DEFAULT_COLOR_1}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      nameColor1: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span className="mb-1 block text-xs">
                  {t('customization.color2')}
                </span>
                <input
                  type="color"
                  className="h-10 w-20 cursor-pointer surface disabled:cursor-not-allowed"
                  disabled={!options.customNameColors.unlocked}
                  value={draft.nameColor2 || DEFAULT_COLOR_2}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      nameColor2: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    nameColor1: '',
                    nameColor2: '',
                  }))
                }
              >
                {t('customization.resetColors')}
              </button>
              {!options.customNameColors.unlocked && (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <Lock className="h-3 w-3" />
                  {lockLabel(options.customNameColors)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Avatar frame */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.avatarFrame')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.avatarFrameHint')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.avatarFrames.map((option) =>
              optionButton<AvatarFrame>(
                option,
                t(`customization.avatarFrames.${option.value}`),
                (draft.avatarFrame ?? 'none') === option.value,
                () =>
                  setDraft((prev) => ({ ...prev, avatarFrame: option.value })),
                <span
                  className={
                    hasAvatarFrame(option.value)
                      ? getAvatarFrameClass(option.value)
                      : 'inline-flex p-[3px]'
                  }
                >
                  <span className="block h-8 w-8 rounded-full bg-base-300" />
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Equipped title */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">{t('customization.title')}</h2>
          <p className="text-sm text-base-content/60">
            {t('customization.titleHint')}
          </p>
          {titleOptions.length === 0 ? (
            <p className="mt-3 text-sm text-base-content/60">
              {t('customization.noTitles')}
            </p>
          ) : (
            <select
              className="select mt-3 w-full max-w-md"
              value={draft.equippedTitle ?? ''}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  equippedTitle: event.target.value,
                }))
              }
            >
              <option value="">{t('customization.noTitleOption')}</option>
              {titleOptions.map((title) => (
                <option key={title.key} value={title.key}>
                  {title.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Signature stat */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.signatureStat')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.signatureStatHint')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.signatureStats.map((option) =>
              optionButton<SignatureStat>(
                option,
                t(`customization.signatureStats.${option.value}`),
                (draft.signatureStat ?? 'none') === option.value,
                () =>
                  setDraft((prev) => ({ ...prev, signatureStat: option.value }))
              )
            )}
          </div>
        </div>
      </div>

      {/* Profile accent */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.profileAccent')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.profileAccentHint')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.profileAccents.map((option) =>
              optionButton<ProfileAccent>(
                option,
                t(`customization.profileAccents.${option.value}`),
                (draft.profileAccent ?? 'default') === option.value,
                () =>
                  setDraft((prev) => ({
                    ...prev,
                    profileAccent: option.value,
                    // Picking "custom" with no color yet would be rejected by
                    // the API, so seed one the moment it is selected.
                    accentColor:
                      option.value === 'custom'
                        ? prev.accentColor || DEFAULT_ACCENT_COLOR
                        : prev.accentColor,
                  })),
                <span className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <span
                      key={level}
                      className="h-3 w-3 rounded-sm"
                      style={{
                        backgroundColor: getHeatmapCellColor(
                          {
                            profileAccent: option.value,
                            accentColor:
                              option.value === 'custom'
                                ? draft.accentColor || DEFAULT_ACCENT_COLOR
                                : '',
                          },
                          level
                        ),
                      }}
                    />
                  ))}
                </span>
              )
            )}
          </div>

          {draft.profileAccent === 'custom' && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label>
                <span className="mb-1 block text-xs">
                  {t('customization.accentColor')}
                </span>
                <input
                  type="color"
                  className="h-10 w-20 cursor-pointer surface"
                  value={draft.accentColor || DEFAULT_ACCENT_COLOR}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      accentColor: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(ACCENT_PRESET_COLORS)
                  .filter(([key]) => key !== 'default')
                  .map(([key, color]) => (
                    <button
                      key={key}
                      type="button"
                      className="h-8 w-8 rounded-full border border-base-300"
                      style={{ backgroundColor: color }}
                      title={t(`customization.profileAccents.${key}` as never)}
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, accentColor: color }))
                      }
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Everything below borrows the accent so the effect is obvious
              before saving. */}
          <div
            className="mt-4 rounded-lg border border-base-300 p-4"
            style={getProfileAccentStyle(draft)}
          >
            <p className="mb-2 text-xs uppercase tracking-wide text-base-content/50">
              {t('customization.accentPreviewLabel')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary btn-sm">
                {t('customization.accentPreviewButton')}
              </button>
              <span className="badge badge-primary">
                {t('customization.accentPreviewBadge')}
              </span>
              <progress
                className="progress progress-primary w-32"
                value={62}
                max={100}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: resolveAccentColor(draft) }}
              >
                {t('customization.accentPreviewText')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner effect */}
      <div className="card surface">
        <div className="card-body p-4 sm:p-6">
          <h2 className="card-title text-lg">
            {t('customization.bannerEffect')}
          </h2>
          <p className="text-sm text-base-content/60">
            {t('customization.bannerEffectHint')}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {options.bannerEffects.map((option) =>
              optionButton<BannerEffect>(
                option,
                t(`customization.bannerEffects.${option.value}`),
                (draft.bannerEffect ?? 'none') === option.value,
                () =>
                  setDraft((prev) => ({ ...prev, bannerEffect: option.value }))
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => save(draft)}
        >
          {isPending ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              {t('customization.saving')}
            </>
          ) : (
            t('customization.save')
          )}
        </button>
      </div>
    </div>
  );
}
