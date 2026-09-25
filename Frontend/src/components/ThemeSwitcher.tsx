import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../api/axiosConfig';
import type { ICustomTheme, ISavedCustomTheme } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  applyAppTheme,
  DEFAULT_CUSTOM_THEME,
  getSavedCustomThemes,
} from '../utils/appTheme';
import Field from './ui/Field';

const freeThemes = ['system', 'light', 'dark'];
const patreonThemes = [
  'winter',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'valentine',
  'garden',
  'cmyk',
  'retro',
  'forest',
  'synthwave',
  'halloween',
  'dracula',
  'night',
  'dim',
  'sunset',
  'abyss',
];
const colorKeys = [
  'background',
  'foreground',
  'primary',
  'secondary',
  'accent',
] as const;

export default function ThemeSwitcher() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const { user, setUser } = useUserDataStore();
  const hasPatreonAccess =
    !!(user?.patreon?.isActive && user.patreon.tier) ||
    user?.roles?.includes('admin');
  const hasCustomAccess = !!(
    user?.roles?.includes('admin') ||
    (user?.patreon?.isActive && user.patreon.tier === 'consumer')
  );
  const savedThemes = useMemo(
    () => getSavedCustomThemes(user?.settings),
    [user?.settings],
  );
  const profileThemeId = user?.settings?.profileThemeId ?? null;

  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'system',
  );
  const [selectedId, setSelectedId] = useState(
    () => localStorage.getItem('customThemeId') || '',
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [palette, setPalette] = useState<ICustomTheme>(DEFAULT_CUSTOM_THEME);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const selected =
      savedThemes.find((item) => item.id === selectedId) ?? savedThemes[0];
    applyAppTheme(theme, hasCustomAccess ? selected : undefined);
    localStorage.setItem('theme', theme);
  }, [theme, selectedId, savedThemes, hasCustomAccess]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'theme') setTheme(event.newValue || 'system');
      if (event.key === 'customThemeId') setSelectedId(event.newValue || '');
    };
    const onThemeChange = (event: CustomEvent<string>) =>
      setTheme(event.detail);
    window.addEventListener('storage', onStorage);
    window.addEventListener('themeChange', onThemeChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('themeChange', onThemeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyAppTheme('system');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);

  function chooseTheme(next: string, id?: string) {
    if (id) {
      localStorage.setItem('customThemeId', id);
      setSelectedId(id);
      applyAppTheme(
        'custom',
        savedThemes.find((item) => item.id === id),
      );
    } else {
      applyAppTheme(next);
    }
    setTheme(next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themeChange', { detail: next }));
  }

  async function persistThemes(
    nextThemes: ISavedCustomTheme[],
    nextProfileId: string | null,
  ) {
    setSaving(true);
    try {
      const { data } = await api.put<{
        themes: ISavedCustomTheme[];
        profileThemeId: string | null;
      }>('users/me/custom-themes', {
        themes: nextThemes,
        profileThemeId: nextProfileId,
      });
      if (user) {
        setUser({
          ...user,
          settings: {
            ...user.settings,
            blurAdultContent: user.settings?.blurAdultContent ?? true,
            customTheme: undefined,
            customThemes: data.themes,
            profileThemeId: data.profileThemeId,
          },
        });
        void queryClient.invalidateQueries({
          queryKey: ['user', user.username],
        });
      }
      toast.success(t('preferences.customTheme.saved'));
      return true;
    } catch {
      toast.error(t('preferences.customTheme.failed'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveTheme() {
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed.length > 40 ||
      savedThemes.some(
        (item) =>
          item.id !== editingId &&
          item.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      toast.error(t('preferences.customTheme.invalidName'));
      return;
    }
    if (!editingId && savedThemes.length >= 10) return;
    const id = editingId ?? crypto.randomUUID();
    const entry = { id, name: trimmed, ...palette };
    const nextThemes = editingId
      ? savedThemes.map((item) => (item.id === editingId ? entry : item))
      : [...savedThemes, entry];
    if (await persistThemes(nextThemes, profileThemeId)) {
      setEditingId(null);
      setName('');
      setPalette(DEFAULT_CUSTOM_THEME);
      chooseTheme('custom', id);
    }
  }

  async function deleteTheme(id: string) {
    const nextThemes = savedThemes.filter((item) => item.id !== id);
    if (
      await persistThemes(
        nextThemes,
        profileThemeId === id ? null : profileThemeId,
      )
    ) {
      if (editingId === id) setEditingId(null);
      if (theme === 'custom' && selectedId === id) {
        if (nextThemes[0]) chooseTheme('custom', nextThemes[0].id);
        else chooseTheme('system');
      }
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="dropdown w-full">
        <div tabIndex={0} role="button" className="btn w-full">
          {t('preferences.theme')}:{' '}
          {theme === 'custom'
            ? ((
                savedThemes.find((item) => item.id === selectedId) ??
                savedThemes[0]
              )?.name ?? 'Custom')
            : theme.charAt(0).toUpperCase() + theme.slice(1)}
        </div>
        <ul
          tabIndex={0}
          className="dropdown-content surface-raised z-50 w-56 max-h-72 overflow-y-auto p-2"
        >
          {[...freeThemes, ...patreonThemes].map((item) => {
            const locked = !hasPatreonAccess && patreonThemes.includes(item);
            return (
              <li key={item}>
                <button
                  type="button"
                  className="w-full rounded-field p-2 text-left hover:bg-base-200 disabled:opacity-50"
                  disabled={locked}
                  onClick={() => chooseTheme(item)}
                >
                  {item}
                </button>
              </li>
            );
          })}
          {hasCustomAccess &&
            savedThemes.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-field p-2 text-left hover:bg-base-200"
                  onClick={() => chooseTheme('custom', item.id)}
                >
                  {item.name}
                </button>
              </li>
            ))}
        </ul>
      </div>

      {hasCustomAccess && (
        <div className="surface-muted space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              {t('preferences.customTheme.title')}
            </h3>
            <span className="text-sm text-base-content/60">
              {savedThemes.length}/10
            </span>
          </div>
          {savedThemes.length > 0 && (
            <ul className="space-y-2">
              {savedThemes.map((item) => (
                <li
                  key={item.id}
                  className="surface flex flex-wrap items-center gap-2 p-2"
                >
                  <span className="min-w-24 flex-1 font-medium">
                    {item.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => chooseTheme('custom', item.id)}
                  >
                    {t('preferences.customTheme.use')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(item.id);
                      setName(item.name);
                      setPalette(item);
                    }}
                  >
                    {t('preferences.customTheme.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={saving}
                    onClick={() =>
                      void persistThemes(
                        savedThemes,
                        profileThemeId === item.id ? null : item.id,
                      )
                    }
                  >
                    {profileThemeId === item.id
                      ? t('preferences.customTheme.removeProfile')
                      : t('preferences.customTheme.showProfile')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-error btn-outline btn-sm"
                    disabled={saving}
                    onClick={() => void deleteTheme(item.id)}
                  >
                    {t('preferences.customTheme.delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(editingId || savedThemes.length < 10) && (
            <div className="space-y-3">
              <Field label={t('preferences.customTheme.name')} required>
                {(id) => (
                  <input
                    id={id}
                    className="input w-full"
                    maxLength={40}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {colorKeys.map((key) => (
                  <Field key={key} label={t(`preferences.customTheme.${key}`)}>
                    {(id) => (
                      <div className="flex items-center gap-2">
                        <input
                          id={id}
                          type="color"
                          className="h-10 w-12 cursor-pointer"
                          value={palette[key]}
                          onChange={(event) =>
                            setPalette((previous) => ({
                              ...previous,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <span className="font-mono text-sm">
                          {palette[key]}
                        </span>
                      </div>
                    )}
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !name.trim()}
                  onClick={() => void saveTheme()}
                >
                  {saving
                    ? t('preferences.customTheme.saving')
                    : t('preferences.customTheme.save')}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setName('');
                      setPalette(DEFAULT_CUSTOM_THEME);
                    }}
                  >
                    {t('preferences.customTheme.cancel')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
