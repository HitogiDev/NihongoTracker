import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearUserDataFn,
  importLogFileFn,
  importLogsFn,
  updateUserFn,
  getPatreonStatusFn,
  unlinkPatreonAccountFn,
  updateCustomBadgeTextFn,
  updateBadgeColorsFn,
  initiatePatreonOAuthFn,
  resendVerificationEmailFn,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { ILoginResponse } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import ThemeSwitcher from '../components/ThemeSwitcher';
import TimezonePicker from '../components/TimezonePicker';
import TagManager from '../components/TagManager';
import { Crop } from 'react-image-crop';
import { canvasPreview } from '../utils/canvasPreview';
import ImageCropDialog, {
  ImageCropResult,
} from '../components/ImageCropDialog';
import Wheel from '@uiw/react-color-wheel';

const PRESET_BADGE_BACKGROUND_COLORS = ['rainbow', 'primary', 'secondary'];
const PRESET_BADGE_TEXT_COLORS = ['primary-content', 'secondary-content'];

function isPresetBackground(color: string | null): boolean {
  return color ? PRESET_BADGE_BACKGROUND_COLORS.includes(color) : false;
}

function isPresetTextColor(color: string | null): boolean {
  return color ? PRESET_BADGE_TEXT_COLORS.includes(color) : false;
}

function sanitizeHex(color: string | null): string | null {
  if (!color) return null;
  const normalized = color.trim().toLowerCase();
  const hexMatch = /^#?[0-9a-f]{6}$/.test(normalized);
  if (!hexMatch) return null;
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

function getContrastColor(hexColor: string | null): string | undefined {
  const sanitized = sanitizeHex(hexColor);
  if (!sanitized) return undefined;
  const hex = sanitized.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return undefined;
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

const importTypeString = {
  tmw: 'TheMoeWay',
  manabe: 'Manabe',
  vncr: 'VN Club Resurrection',
};

function SettingsScreen() {
  const { setUser, user } = useUserDataStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordConfirmRef = useRef<HTMLInputElement>(null);
  const [discordId, setDiscordId] = useState(user?.discordId || '');
  const [customBadgeText, setCustomBadgeText] = useState('');
  const [badgeColor, setBadgeColor] = useState('#ff69b4');
  const [badgeTextColor, setBadgeTextColor] = useState('#ffffff');
  const [pendingBadgeColor, setPendingBadgeColor] = useState<string | null>(
    null
  );
  const [pendingBadgeTextColor, setPendingBadgeTextColor] = useState<
    string | null
  >(null);
  const [isInitiatingOAuth, setIsInitiatingOAuth] = useState(false);
  const [patreonStatus, setPatreonStatus] = useState<{
    patreonEmail?: string;
    patreonId?: string;
    tier?: 'donator' | 'enthusiast' | 'consumer' | null;
    customBadgeText?: string;
    badgeColor?: string;
    badgeTextColor?: string;
    isActive: boolean;
  }>({ isActive: false });
  const [blurAdult, setBlurAdult] = useState(
    user?.settings?.blurAdultContent || false
  );
  const [hideUnmatchedAlert, setHideUnmatchedAlert] = useState(
    user?.settings?.hideUnmatchedLogsAlert || false
  );
  const [timezone, setTimezone] = useState(user?.settings?.timezone || 'UTC');
  const [isInitialized, setIsInitialized] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState<string>('');
  const [bannerSrc, setBannerSrc] = useState<string>('');
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);

  const [croppedAvatarFile, setCroppedAvatarFile] = useState<File | null>(null);
  const [croppedBannerFile, setCroppedBannerFile] = useState<File | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const [avatarOriginalFileName, setAvatarOriginalFileName] = useState<
    string | null
  >(null);
  const [bannerOriginalFileName, setBannerOriginalFileName] = useState<
    string | null
  >(null);

  const [importType, setImportType] = useState<
    'tmw' | 'manabe' | 'vncr' | null
  >(null);

  const confirmUsernameRef = useRef<HTMLInputElement>(null);
  const [isUsernameMatch, setIsUsernameMatch] = useState(false);
  const [isEmailChanged, setIsEmailChanged] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasNewPassword, setHasNewPassword] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [showEmailSentModal, setShowEmailSentModal] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const avatarPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const bannerPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data: ILoginResponse) => {
      // Check if email was changed
      const currentEmail = emailRef.current?.value || '';
      const emailWasChanged = currentEmail !== (user?.email || '');

      if (emailWasChanged) {
        setEmailSentTo(currentEmail);
        setShowEmailSentModal(true);
        setResendCooldown(60); // Start cooldown immediately after sending verification email
      } else {
        // Only show toast if email wasn't changed (no modal will be shown)
        toast.success('User updated');
      }

      setUser(data);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      setCroppedAvatarFile(null);
      setAvatarFileName(null);
      setAvatarOriginalFileName(null);
      if (avatarPreviewCanvasRef.current) {
        const canvas = avatarPreviewCanvasRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.classList.add('hidden');
      }
      void queryClient.invalidateQueries({
        predicate: (query) => {
          return ['user', 'ranking'].includes(query.queryKey[0] as string);
        },
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  // Separate mutation for auto-saving preferences
  const { mutate: updatePreferences, isPending: isPreferencesPending } =
    useMutation({
      mutationFn: updateUserFn,
      onSuccess: (data: ILoginResponse) => {
        setUser(data);
        void queryClient.invalidateQueries({
          predicate: (query) => {
            return ['user', 'ranking'].includes(query.queryKey[0] as string);
          },
        });
      },
      onError: (error) => {
        if (error instanceof AxiosError) {
          toast.error(
            `Failed to save preference: ${error.response?.data.message}`
          );
        } else {
          toast.error('Failed to save preference');
        }
      },
    });

  // Mutation for resending verification email
  const { mutate: resendVerificationEmail, isPending: isResendingEmail } =
    useMutation({
      mutationFn: resendVerificationEmailFn,
      onSuccess: () => {
        toast.success('Verification email sent!');
        setResendCooldown(60); // Start 60-second cooldown
      },
      onError: (error) => {
        if (error instanceof AxiosError) {
          const errorMessage =
            error.response?.data.message || 'An error occurred';
          toast.error(errorMessage);
          // If error mentions remaining time, extract it and set cooldown
          const match = errorMessage.match(/wait (\d+) seconds/);
          if (match && match[1]) {
            setResendCooldown(parseInt(match[1], 10));
          }
        } else {
          toast.error('Failed to send verification email');
        }
      },
    });

  // Cooldown timer for resend verification email
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Debounced function to update preferences automatically
  const debouncedUpdatePreferences = useCallback(
    (prefType: string, value: string | boolean) => {
      const formData = new FormData();

      if (prefType === 'timezone') {
        formData.append('timezone', value as string);
      } else if (prefType === 'blurAdultContent') {
        formData.append('blurAdultContent', value.toString());
      } else if (prefType === 'hideUnmatchedLogsAlert') {
        formData.append('hideUnmatchedLogsAlert', value.toString());
      }

      updatePreferences(formData);
    },
    [updatePreferences]
  );

  // Use refs to track timeouts for debouncing
  const timezoneTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const blurAdultTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hideUnmatchedTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize state from user data once
  useEffect(() => {
    if (user && !isInitialized) {
      setDiscordId(user.discordId || '');
      setBlurAdult(user.settings?.blurAdultContent || false);
      setHideUnmatchedAlert(user.settings?.hideUnmatchedLogsAlert || false);
      setTimezone(user.settings?.timezone || 'UTC');
      setIsInitialized(true);
    }
  }, [user, isInitialized]);

  // Auto-save preferences when they change (only after initialization)
  useEffect(() => {
    if (
      isInitialized &&
      user?.settings?.timezone !== timezone &&
      timezone !== (user?.settings?.timezone || 'UTC')
    ) {
      if (timezoneTimeoutRef.current) {
        clearTimeout(timezoneTimeoutRef.current);
      }
      timezoneTimeoutRef.current = setTimeout(() => {
        debouncedUpdatePreferences('timezone', timezone);
      }, 500);
    }

    return () => {
      if (timezoneTimeoutRef.current) {
        clearTimeout(timezoneTimeoutRef.current);
      }
    };
  }, [
    timezone,
    user?.settings?.timezone,
    debouncedUpdatePreferences,
    isInitialized,
  ]);

  useEffect(() => {
    if (isInitialized && user?.settings?.blurAdultContent !== blurAdult) {
      if (blurAdultTimeoutRef.current) {
        clearTimeout(blurAdultTimeoutRef.current);
      }
      blurAdultTimeoutRef.current = setTimeout(() => {
        debouncedUpdatePreferences('blurAdultContent', blurAdult);
      }, 500);
    }

    return () => {
      if (blurAdultTimeoutRef.current) {
        clearTimeout(blurAdultTimeoutRef.current);
      }
    };
  }, [
    blurAdult,
    user?.settings?.blurAdultContent,
    debouncedUpdatePreferences,
    isInitialized,
  ]);

  useEffect(() => {
    if (
      isInitialized &&
      user?.settings?.hideUnmatchedLogsAlert !== hideUnmatchedAlert
    ) {
      if (hideUnmatchedTimeoutRef.current) {
        clearTimeout(hideUnmatchedTimeoutRef.current);
      }
      hideUnmatchedTimeoutRef.current = setTimeout(() => {
        debouncedUpdatePreferences(
          'hideUnmatchedLogsAlert',
          hideUnmatchedAlert
        );
      }, 500);
    }

    return () => {
      if (hideUnmatchedTimeoutRef.current) {
        clearTimeout(hideUnmatchedTimeoutRef.current);
      }
    };
  }, [
    hideUnmatchedAlert,
    user?.settings?.hideUnmatchedLogsAlert,
    debouncedUpdatePreferences,
    isInitialized,
  ]);

  const { mutate: syncLogs, isPending: isSyncPending } = useMutation({
    mutationFn: importLogsFn,
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({
        predicate: (query) => {
          return [
            'logs',
            'user',
            'ranking',
            'ImmersionList',
            'userStats',
          ].includes(query.queryKey[0] as string);
        },
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  const { mutate: importFileLogs, isPending: isImportPending } = useMutation({
    mutationFn: importLogFileFn,
    onSuccess: (data) => {
      const logImportInput = document.getElementById(
        'logFileImport'
      ) as HTMLInputElement;
      if (logImportInput) {
        logImportInput.value = '';
      }
      toast.success(data.message);
      void queryClient.invalidateQueries({
        predicate: (query) => {
          return [
            'logs',
            'user',
            'ranking',
            'ImmersionList',
            'userStats',
          ].includes(query.queryKey[0] as string);
        },
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  const { mutate: clearData, isPending: isClearDataPending } = useMutation({
    mutationFn: clearUserDataFn,
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.user) {
        setUser(data.user);
      }
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  const { mutate: unlinkPatreon, isPending: isUnlinkingPatreon } = useMutation({
    mutationFn: unlinkPatreonAccountFn,
    onSuccess: (data) => {
      toast.success(data.message);
      // Reset Patreon state
      setCustomBadgeText('');
      setBadgeColor('#ff69b4');
      setBadgeTextColor('#ffffff');
      setPatreonStatus({ isActive: false });
      // Invalidate user query to update profile display
      void queryClient.invalidateQueries({
        queryKey: ['user'],
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error('Failed to unlink Patreon account');
      }
    },
  });

  const { mutate: updateBadgeText, isPending: isUpdatingBadge } = useMutation({
    mutationFn: updateCustomBadgeTextFn,
    onSuccess: (data) => {
      toast.success('Custom badge text updated!');
      setUser(data.user);
      fetchPatreonStatus();
      // Invalidate user query to update profile display
      void queryClient.invalidateQueries({
        queryKey: ['user'],
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error('Failed to update badge text');
      }
    },
  });

  const { mutate: updateBadgeColors, isPending: isUpdatingColors } =
    useMutation({
      mutationFn: () => updateBadgeColorsFn(badgeColor, badgeTextColor),
      onSuccess: (data) => {
        toast.success('Badge colors updated!');
        setUser(data.user);
        fetchPatreonStatus();
        // Invalidate user queries to update ProfileHeader
        void queryClient.invalidateQueries({
          queryKey: ['user'],
        });
      },
      onError: (error) => {
        if (error instanceof AxiosError) {
          toast.error(error.response?.data.message);
        } else {
          toast.error('Failed to update badge colors');
        }
      },
    });

  // Fetch Patreon status on mount
  useEffect(() => {
    fetchPatreonStatus();

    // Handle OAuth callback from Patreon
    const params = new URLSearchParams(window.location.search);
    const patreonStatus = params.get('patreon');
    const message = params.get('message');

    if (patreonStatus === 'success') {
      toast.success('✅ Patreon account linked successfully!');
      // Limpiar URL sin recargar la página
      window.history.replaceState({}, '', '/settings');
      // Recargar el estado de Patreon
      fetchPatreonStatus();
    } else if (patreonStatus === 'error') {
      const errorMessages: Record<string, string> = {
        missing_params: 'Missing authorization parameters',
        invalid_state: 'Invalid or expired authorization state',
        oauth_not_configured: 'Patreon OAuth is not configured on the server',
        account_already_linked:
          'This Patreon account is already linked to another user',
        user_not_found: 'User not found',
        oauth_failed: 'OAuth authentication failed',
      };
      const errorMessage =
        message && errorMessages[message]
          ? errorMessages[message]
          : 'Failed to link Patreon account';
      toast.error(`❌ ${errorMessage}`);
      // Limpiar URL
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  async function fetchPatreonStatus() {
    try {
      const status = await getPatreonStatusFn();
      setPatreonStatus(status);
      // patreonEmail no longer needed - OAuth2 manages email
      if (status.customBadgeText) {
        setCustomBadgeText(status.customBadgeText);
      }
      if (status.badgeColor) {
        setBadgeColor(status.badgeColor);
      }
      if (status.badgeTextColor) {
        setBadgeTextColor(status.badgeTextColor);
      }
    } catch (error) {
      console.error('Failed to fetch Patreon status:', error);
    }
  }

  async function handleSyncLogs(e: React.FormEvent) {
    e.preventDefault();
    syncLogs();
  }

  async function handleFileImport(e: React.FormEvent) {
    e.preventDefault();
    const logImportInput = document.getElementById(
      'logFileImport'
    ) as HTMLInputElement;
    if (!logImportInput.files || logImportInput.files.length === 0) {
      toast.error('Please select a file');
      return;
    }
    const file = logImportInput.files[0];
    const formData = new FormData();
    formData.append('logFileImport', file);
    formData.append('logImportType', importType ?? '');
    importFileLogs(formData);
  }

  async function handleClearData() {
    if (!user) return;
    const inputValue = confirmUsernameRef.current?.value || '';
    if (inputValue !== user.username) {
      toast.error('Username does not match. Data was not deleted.');
      return;
    }
    (document.getElementById('clear_data_modal') as HTMLDialogElement).close();
    if (confirmUsernameRef.current) {
      confirmUsernameRef.current.value = '';
    }
    setIsUsernameMatch(false);
    clearData(inputValue);
  }

  async function handleUnlinkPatreon() {
    unlinkPatreon();
  }

  async function handlePatreonOAuth() {
    setIsInitiatingOAuth(true);
    try {
      const { authUrl } = await initiatePatreonOAuthFn();
      // Redirigir al usuario a Patreon para autorizar
      window.location.href = authUrl;
    } catch (error) {
      setIsInitiatingOAuth(false);
      toast.error('Failed to initiate Patreon OAuth');
      console.error('OAuth initiation error:', error);
    }
  }

  const openBadgeColorModal = useCallback(() => {
    setPendingBadgeColor(badgeColor);
    const modal = document.getElementById(
      'bg_color_modal'
    ) as HTMLDialogElement | null;
    modal?.showModal();
  }, [badgeColor]);

  const openBadgeTextColorModal = useCallback(() => {
    setPendingBadgeTextColor(badgeTextColor);
    const modal = document.getElementById(
      'text_color_modal'
    ) as HTMLDialogElement | null;
    modal?.showModal();
  }, [badgeTextColor]);

  const handleBadgeColorModalClose = useCallback(() => {
    setPendingBadgeColor(null);
  }, []);

  const handleBadgeTextModalClose = useCallback(() => {
    setPendingBadgeTextColor(null);
  }, []);

  const handleBadgeColorDone = useCallback(() => {
    const modal = document.getElementById(
      'bg_color_modal'
    ) as HTMLDialogElement | null;
    const rawValue =
      pendingBadgeColor === null || pendingBadgeColor === ''
        ? badgeColor
        : pendingBadgeColor;
    const finalColor = isPresetBackground(rawValue)
      ? rawValue
      : (sanitizeHex(rawValue) ?? badgeColor);
    if (finalColor && finalColor !== badgeColor) {
      setBadgeColor(finalColor);
    }
    modal?.close();
    setPendingBadgeColor(null);
  }, [pendingBadgeColor, badgeColor]);

  const handleBadgeTextDone = useCallback(() => {
    const modal = document.getElementById(
      'text_color_modal'
    ) as HTMLDialogElement | null;
    const rawValue =
      pendingBadgeTextColor === null || pendingBadgeTextColor === ''
        ? badgeTextColor
        : pendingBadgeTextColor;
    const finalColor = isPresetTextColor(rawValue)
      ? rawValue
      : (sanitizeHex(rawValue) ?? badgeTextColor);
    if (finalColor && finalColor !== badgeTextColor) {
      setBadgeTextColor(finalColor);
    }
    modal?.close();
    setPendingBadgeTextColor(null);
  }, [pendingBadgeTextColor, badgeTextColor]);

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    const currentEmail = emailRef.current?.value || '';
    const currentPassword = passwordRef.current?.value || '';
    const currentNewPassword = newPasswordRef.current?.value || '';
    const currentNewPasswordConfirm =
      newPasswordConfirmRef.current?.value || '';

    if (username.trim()) formData.append('username', username);
    if (currentEmail !== (user?.email || ''))
      formData.append('email', currentEmail);
    if (currentPassword.trim()) formData.append('password', currentPassword);
    if (currentNewPassword.trim())
      formData.append('newPassword', currentNewPassword);
    if (currentNewPasswordConfirm.trim())
      formData.append('newPasswordConfirm', currentNewPasswordConfirm);

    formData.append('discordId', discordId);

    if (croppedAvatarFile) {
      formData.append('avatar', croppedAvatarFile);
    } else if (
      avatarInputRef.current?.files &&
      avatarInputRef.current.files.length > 0
    ) {
      formData.append('avatar', avatarInputRef.current.files[0]);
    }

    if (croppedBannerFile) {
      formData.append('banner', croppedBannerFile);
    } else if (
      bannerInputRef.current?.files &&
      bannerInputRef.current.files.length > 0
    ) {
      formData.append('banner', bannerInputRef.current.files[0]);
    }

    updateUser(formData);
  }

  const getDefaultAvatarCrop = useCallback((image: HTMLImageElement): Crop => {
    const sizePx = Math.min(image.naturalWidth, image.naturalHeight) * 0.9;
    const widthPercent = (sizePx / image.naturalWidth) * 100;
    const heightPercent = (sizePx / image.naturalHeight) * 100;

    return {
      unit: '%',
      width: widthPercent,
      height: heightPercent,
      x: (100 - widthPercent) / 2,
      y: (100 - heightPercent) / 2,
    };
  }, []);

  const getInitialBannerCrop = useCallback((image: HTMLImageElement): Crop => {
    const { naturalWidth, naturalHeight } = image;
    const targetAspectRatio = 21 / 9;
    const imageAspectRatio = naturalWidth / naturalHeight;

    let cropWidthPercent: number;
    let cropHeightPercent: number;

    if (imageAspectRatio > targetAspectRatio) {
      cropHeightPercent = 80;
      cropWidthPercent =
        (cropHeightPercent * targetAspectRatio * naturalHeight) / naturalWidth;

      if (cropWidthPercent > 95) {
        cropWidthPercent = 80;
        cropHeightPercent =
          (cropWidthPercent * naturalWidth) /
          (targetAspectRatio * naturalHeight);
      }
    } else {
      cropWidthPercent = 80;
      cropHeightPercent =
        (cropWidthPercent * naturalWidth) / (targetAspectRatio * naturalHeight);

      if (cropHeightPercent > 95) {
        cropHeightPercent = 80;
        cropWidthPercent =
          (cropHeightPercent * targetAspectRatio * naturalHeight) /
          naturalWidth;
      }
    }

    const cropX = (100 - cropWidthPercent) / 2;
    const cropY = (100 - cropHeightPercent) / 2;

    return {
      unit: '%',
      width: cropWidthPercent,
      height: cropHeightPercent,
      x: cropX,
      y: cropY,
    };
  }, []);

  const handleAvatarCropApply = useCallback(
    async ({ crop, image }: ImageCropResult) => {
      if (!avatarPreviewCanvasRef.current) {
        return;
      }

      await canvasPreview(image, avatarPreviewCanvasRef.current, crop);
      avatarPreviewCanvasRef.current.classList.remove('hidden');

      avatarPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const sourceName = avatarOriginalFileName || avatarFileName;
            const baseName = sourceName
              ? sourceName.replace(/\.[^/.]+$/, '')
              : 'avatar';
            const croppedFile = new File([blob], `${baseName}-cropped.jpg`, {
              type: 'image/jpeg',
            });
            setCroppedAvatarFile(croppedFile);
            setAvatarFileName(croppedFile.name);
            if (avatarInputRef.current) {
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(croppedFile);
              avatarInputRef.current.files = dataTransfer.files;
            }
          }
        },
        'image/jpeg',
        0.9
      );
    },
    [avatarFileName, avatarOriginalFileName]
  );

  const handleBannerCropApply = useCallback(
    async ({ crop, image }: ImageCropResult) => {
      if (!bannerPreviewCanvasRef.current) {
        return;
      }

      await canvasPreview(image, bannerPreviewCanvasRef.current, crop);
      bannerPreviewCanvasRef.current.classList.remove('hidden');

      bannerPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const sourceName = bannerOriginalFileName || bannerFileName;
            const baseName = sourceName
              ? sourceName.replace(/\.[^/.]+$/, '')
              : 'banner';
            const croppedFile = new File([blob], `${baseName}-cropped.jpg`, {
              type: 'image/jpeg',
            });
            setCroppedBannerFile(croppedFile);
            setBannerFileName(croppedFile.name);
            if (bannerInputRef.current) {
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(croppedFile);
              bannerInputRef.current.files = dataTransfer.files;
            }
          }
        },
        'image/jpeg',
        0.9
      );
    },
    [bannerFileName, bannerOriginalFileName]
  );

  const handleAvatarCropClose = useCallback(() => {
    setShowAvatarCrop(false);
    setAvatarSrc('');
  }, []);

  const handleAvatarCropCancel = useCallback(() => {
    setShowAvatarCrop(false);
    setAvatarSrc('');
    setAvatarFileName(null);
    setAvatarOriginalFileName(null);
    setCroppedAvatarFile(null);
    if (avatarPreviewCanvasRef.current) {
      const canvas = avatarPreviewCanvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.classList.add('hidden');
    }
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  }, []);

  const handleBannerCropClose = useCallback(() => {
    setShowBannerCrop(false);
    setBannerSrc('');
  }, []);

  const handleBannerCropCancel = useCallback(() => {
    setShowBannerCrop(false);
    setBannerSrc('');
    setBannerFileName(null);
    setBannerOriginalFileName(null);
    setCroppedBannerFile(null);
    if (bannerPreviewCanvasRef.current) {
      const canvas = bannerPreviewCanvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.classList.add('hidden');
    }
    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  }, []);

  async function onSelectAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFileName(file.name);
      setAvatarOriginalFileName(file.name);
      setCroppedAvatarFile(null);
      if (avatarPreviewCanvasRef.current) {
        avatarPreviewCanvasRef.current.classList.add('hidden');
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setAvatarSrc(reader.result?.toString() || '');
        setShowAvatarCrop(true);
      });
      reader.readAsDataURL(file);
    }
  }

  async function onSelectBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setBannerFileName(file.name);
      setBannerOriginalFileName(file.name);
      setCroppedBannerFile(null);
      if (bannerPreviewCanvasRef.current) {
        bannerPreviewCanvasRef.current.classList.add('hidden');
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setBannerSrc(reader.result?.toString() || '');
        setShowBannerCrop(true);
      });
      reader.readAsDataURL(file);
    }
  }

  const badgeHexInputValue = useMemo(() => {
    if (pendingBadgeColor !== null) {
      return isPresetBackground(pendingBadgeColor) ? '' : pendingBadgeColor;
    }
    return isPresetBackground(badgeColor) ? '' : badgeColor;
  }, [pendingBadgeColor, badgeColor]);

  const badgeInputBackgroundColor = useMemo(() => {
    const candidate =
      pendingBadgeColor !== null ? pendingBadgeColor : badgeColor;
    if (!candidate || isPresetBackground(candidate)) {
      return undefined;
    }
    return sanitizeHex(candidate) ?? undefined;
  }, [pendingBadgeColor, badgeColor]);

  const badgeInputTextColor = useMemo(() => {
    return getContrastColor(badgeInputBackgroundColor ?? null);
  }, [badgeInputBackgroundColor]);

  const badgeWheelColor = useMemo(() => {
    const candidate =
      pendingBadgeColor !== null ? pendingBadgeColor : badgeColor;
    if (!candidate || isPresetBackground(candidate)) {
      return '#ff69b4';
    }
    return sanitizeHex(candidate) ?? '#ff69b4';
  }, [pendingBadgeColor, badgeColor]);

  const badgeTextHexInputValue = useMemo(() => {
    if (pendingBadgeTextColor !== null) {
      return isPresetTextColor(pendingBadgeTextColor)
        ? ''
        : pendingBadgeTextColor;
    }
    return isPresetTextColor(badgeTextColor) ? '' : badgeTextColor;
  }, [pendingBadgeTextColor, badgeTextColor]);

  const badgeTextInputBackgroundColor = useMemo(() => {
    const candidate =
      pendingBadgeTextColor !== null ? pendingBadgeTextColor : badgeTextColor;
    if (!candidate || isPresetTextColor(candidate)) {
      return undefined;
    }
    return sanitizeHex(candidate) ?? undefined;
  }, [pendingBadgeTextColor, badgeTextColor]);

  const badgeTextInputTextColor = useMemo(() => {
    return getContrastColor(badgeTextInputBackgroundColor ?? null);
  }, [badgeTextInputBackgroundColor]);

  const badgeTextWheelColor = useMemo(() => {
    const candidate =
      pendingBadgeTextColor !== null ? pendingBadgeTextColor : badgeTextColor;
    if (!candidate || isPresetTextColor(candidate)) {
      return '#ffffff';
    }
    return sanitizeHex(candidate) ?? '#ffffff';
  }, [pendingBadgeTextColor, badgeTextColor]);
  return (
    <div className="min-h-screen bg-base-200 mt-16">
      <dialog
        id="clear_data_modal"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box">
          <h3 className="font-bold text-lg text-error">
            Confirm Data Deletion
          </h3>
          <div className="divider"></div>
          <p className="py-4">
            This will permanently delete all your logs, statistics, and goals.
            This action cannot be undone.
          </p>

          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="label">Type your username to confirm:</span>
            <input
              ref={confirmUsernameRef}
              type="text"
              placeholder={user?.username || ''}
              onChange={(e) =>
                setIsUsernameMatch(e.target.value === user?.username)
              }
              className="grow"
            />
          </label>

          <div className="modal-action">
            <button
              className="btn btn-error"
              onClick={handleClearData}
              disabled={isClearDataPending || !isUsernameMatch}
            >
              {isClearDataPending ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Clearing...
                </>
              ) : (
                'Delete All Data'
              )}
            </button>
            <form method="dialog">
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (confirmUsernameRef.current) {
                    confirmUsernameRef.current.value = '';
                  }
                  setIsUsernameMatch(false);
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              if (confirmUsernameRef.current) {
                confirmUsernameRef.current.value = '';
              }
              setIsUsernameMatch(false);
            }}
          >
            close
          </button>
        </form>
      </dialog>

      <ImageCropDialog
        title="Crop Avatar"
        imageSrc={avatarSrc}
        isOpen={showAvatarCrop}
        aspect={1}
        circular
        onClose={handleAvatarCropClose}
        onCancel={handleAvatarCropCancel}
        onApply={handleAvatarCropApply}
        getInitialCrop={getDefaultAvatarCrop}
      />

      <ImageCropDialog
        title="Crop Banner"
        imageSrc={bannerSrc}
        isOpen={showBannerCrop}
        aspect={21 / 9}
        minWidth={105}
        minHeight={45}
        keepSelection
        ruleOfThirds
        onClose={handleBannerCropClose}
        onCancel={handleBannerCropCancel}
        onApply={handleBannerCropApply}
        getInitialCrop={getInitialBannerCrop}
      />

      <div className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-base-content mb-2">
              Settings
            </h1>
            <p className="text-base-content/70 text-lg">
              Manage your account and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-6">
            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Profile Information</h2>
                    <p className="text-base-content/70">
                      Update your basic profile details
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text font-medium">Username</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered focus:input-primary transition-colors w-full"
                        placeholder={user?.username || 'Enter username'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/60">
                          Current: {user?.username || 'Not set'}
                        </span>
                      </label>
                    </div>

                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text font-medium">
                          Discord ID
                        </span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered focus:input-primary transition-colors w-full"
                        placeholder="Enter Discord ID (e.g., 123456789012345678)"
                        value={discordId}
                        onChange={(e) => setDiscordId(e.target.value)}
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/60">
                          {user?.discordId
                            ? `Current: ${user.discordId}`
                            : 'Required for syncing external logs (Anilist, etc.)'}
                        </span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Patreon Account
                        </span>
                      </label>
                      {patreonStatus.patreonId ? (
                        <div className="space-y-4">
                          {/* Connected Status */}
                          <div className="flex items-center justify-between p-4 bg-success/10 border border-success/20 rounded-lg">
                            <div className="flex items-center gap-3">
                              <svg
                                className="w-5 h-5 text-success"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
                              </svg>
                              <div>
                                <div className="font-semibold text-success">
                                  Connected
                                </div>
                                {patreonStatus.patreonEmail && (
                                  <div className="text-xs text-base-content/70">
                                    {patreonStatus.patreonEmail}
                                  </div>
                                )}
                                <div className="text-xs text-base-content/60 mt-1">
                                  ID: {patreonStatus.patreonId}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {patreonStatus.tier ? (
                                <span className="badge badge-primary badge-sm">
                                  {patreonStatus.tier === 'donator' &&
                                    'Donator'}
                                  {patreonStatus.tier === 'enthusiast' &&
                                    'Enthusiast'}
                                  {patreonStatus.tier === 'consumer' &&
                                    'Consumer'}
                                </span>
                              ) : (
                                <span className="badge badge-ghost badge-sm">
                                  Free Tier
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-outline btn-error btn-sm w-full"
                            onClick={handleUnlinkPatreon}
                            disabled={isUnlinkingPatreon}
                          >
                            {isUnlinkingPatreon ? (
                              <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                  />
                                </svg>
                                Unlink Patreon
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="btn btn-primary flex-1 gap-2"
                              onClick={handlePatreonOAuth}
                              disabled={isInitiatingOAuth}
                            >
                              {isInitiatingOAuth ? (
                                <span className="loading loading-spinner loading-sm"></span>
                              ) : (
                                <>
                                  <svg
                                    className="w-5 h-5"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
                                  </svg>
                                  Connect with Patreon
                                </>
                              )}
                            </button>
                            <a
                              href={`${import.meta.env.VITE_DOMAIN_URL}/support`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm gap-1"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Benefits
                            </a>
                          </div>
                          <div className="text-xs text-center text-base-content/60">
                            🔒 Secure OAuth - credentials never shared
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Custom Badge Text - Enthusiast+ Only */}
                  {patreonStatus.patreonId &&
                    (patreonStatus.tier === 'enthusiast' ||
                      patreonStatus.tier === 'consumer') && (
                      <div className="space-y-4 mt-6">
                        <div className="divider">
                          <span className="text-base-content/70 font-medium">
                            Badge Customization
                          </span>
                        </div>

                        <div className="card bg-base-200/50 border border-base-300">
                          <div className="card-body">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <label className="label">
                                  <span className="label-text font-medium">
                                    Custom Badge Text
                                  </span>
                                  <span className="label-text-alt badge badge-ghost badge-sm">
                                    {customBadgeText.length}/20
                                  </span>
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    className="input input-bordered focus:input-primary transition-colors flex-1"
                                    placeholder="Enter custom text"
                                    value={customBadgeText}
                                    onChange={(e) =>
                                      setCustomBadgeText(
                                        e.target.value.slice(0, 20)
                                      )
                                    }
                                    maxLength={20}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() =>
                                      updateBadgeText(customBadgeText)
                                    }
                                    disabled={isUpdatingBadge}
                                  >
                                    {isUpdatingBadge ? (
                                      <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                      <>
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                        Save
                                      </>
                                    )}
                                  </button>
                                </div>
                                <label className="label">
                                  <span className="label-text-alt text-base-content/60">
                                    Leave empty to use default tier name
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="space-y-6">
                    <div className="divider">
                      <span className="text-base-content/70 font-medium">
                        Media & Appearance
                      </span>
                    </div>

                    <div className="space-y-6">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Avatar</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div className="flex-1 w-full">
                            <input
                              type="file"
                              id="avatar"
                              ref={avatarInputRef}
                              className="file-input file-input-bordered file-input-primary w-full"
                              accept={
                                user?.patreon?.isActive &&
                                (user?.patreon?.tier === 'enthusiast' ||
                                  user?.patreon?.tier === 'consumer')
                                  ? 'image/*'
                                  : 'image/jpeg,image/jpg,image/png,image/webp'
                              }
                              onChange={onSelectAvatarFile}
                            />
                            <label className="label pt-1 flex flex-col items-start gap-1">
                              <span className="label-text-alt text-base-content/60 leading-relaxed">
                                Allowed Formats: JPEG, PNG, WebP
                                {user?.patreon?.isActive &&
                                (user?.patreon?.tier === 'enthusiast' ||
                                  user?.patreon?.tier === 'consumer')
                                  ? ', GIF'
                                  : ''}
                                . Max size: 3mb. Optimal dimensions: 230x230
                              </span>
                              {croppedAvatarFile && (
                                <span className="label-text-alt text-success">
                                  Cropped avatar ready to upload
                                </span>
                              )}
                            </label>
                          </div>
                          {user?.avatar || croppedAvatarFile ? (
                            <div className="flex flex-col items-center gap-2">
                              {user?.avatar && !croppedAvatarFile && (
                                <img
                                  src={user.avatar}
                                  alt="Current avatar"
                                  className="rounded-lg border-2 border-base-300 shadow-sm object-cover"
                                  style={{
                                    width: 120,
                                    height: 120,
                                  }}
                                />
                              )}
                              <canvas
                                ref={avatarPreviewCanvasRef}
                                className="rounded-lg border-2 border-base-300 hidden shadow-sm flex-shrink-0"
                                style={{
                                  objectFit: 'contain',
                                  width: 120,
                                  height: 120,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Banner</span>
                        </label>
                        <div className="flex flex-col gap-4">
                          <div className="w-full">
                            <input
                              type="file"
                              id="banner"
                              ref={bannerInputRef}
                              className="file-input file-input-bordered file-input-primary w-full"
                              accept="image/*"
                              onChange={onSelectBannerFile}
                            />
                            <label className="label pt-1 flex flex-col items-start gap-1">
                              <span className="label-text-alt text-base-content/60 leading-relaxed">
                                Allowed Formats: JPEG, PNG. Max size: 6mb.
                                Optimal dimensions: 1700x330
                              </span>
                              {croppedBannerFile && (
                                <span className="label-text-alt text-success">
                                  Cropped banner ready to upload
                                </span>
                              )}
                            </label>
                          </div>
                          {user?.banner || croppedBannerFile ? (
                            <>
                              {user?.banner && !croppedBannerFile && (
                                <img
                                  src={user.banner}
                                  alt="Current banner"
                                  className="rounded-lg border-2 border-base-300 shadow-sm object-cover w-full"
                                  style={{
                                    maxHeight: 150,
                                  }}
                                />
                              )}
                              <canvas
                                ref={bannerPreviewCanvasRef}
                                className="rounded-lg border-2 border-base-300 hidden shadow-sm w-full"
                                style={{
                                  objectFit: 'contain',
                                  maxHeight: 150,
                                }}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions justify-end pt-4">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Update Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Tag Management Section */}
            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Tags</h2>
                    <p className="text-base-content/70">
                      Create and manage tags to organize your logs
                    </p>
                  </div>
                </div>
                <TagManager />
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Security</h2>
                    <p className="text-base-content/70">
                      Update your password and security settings
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-6">
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-medium">
                        Email Address (optional)
                      </span>
                      {user?.email && (
                        <span
                          className={`badge badge-sm ${
                            user.verified ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {user.verified ? 'Verified' : 'Not Verified'}
                        </span>
                      )}
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Enter your email address"
                      defaultValue={user?.email || ''}
                      onChange={(e) => {
                        const emailValue = e.target.value;
                        setIsEmailChanged(emailValue !== (user?.email || ''));
                      }}
                    />

                    {user?.email && !user.verified && (
                      <div className="mt-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                        <p className="text-sm text-warning mb-2">
                          📧 Verification email sent to your inbox. Check your
                          spam folder if needed.
                        </p>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning"
                          onClick={() => resendVerificationEmail()}
                          disabled={resendCooldown > 0 || isResendingEmail}
                        >
                          {isResendingEmail ? (
                            <>
                              <span className="loading loading-spinner loading-sm"></span>
                              Sending...
                            </>
                          ) : resendCooldown > 0 ? (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                className="w-4 h-4 stroke-current"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Resend in {resendCooldown}s
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                className="w-4 h-4 stroke-current"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              Resend Verification Email
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {!user?.email && (
                      <label className="label">
                        <span className="label-text-alt text-base-content/60">
                          Recommended for account recovery
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-medium">
                        Current Password
                      </span>
                    </label>
                    <input
                      ref={passwordRef}
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Enter current password"
                      onChange={(e) =>
                        setHasPassword(e.target.value.trim().length > 0)
                      }
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Required to verify your identity
                      </span>
                    </label>
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-medium">
                        New Password (optional)
                      </span>
                    </label>
                    <input
                      ref={newPasswordRef}
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Enter new password"
                      onChange={(e) => {
                        const newPwd = e.target.value;
                        setHasNewPassword(newPwd.trim().length > 0);
                        const confirmPwd =
                          newPasswordConfirmRef.current?.value || '';
                        setPasswordsMatch(!newPwd || newPwd === confirmPwd);
                      }}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Leave blank to keep current password
                      </span>
                    </label>
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-medium">
                        Confirm New Password
                      </span>
                    </label>
                    <input
                      ref={newPasswordConfirmRef}
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Confirm new password"
                      onChange={(e) => {
                        const confirmPwd = e.target.value;
                        const newPwd = newPasswordRef.current?.value || '';
                        setPasswordsMatch(!newPwd || newPwd === confirmPwd);
                      }}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Required only if changing password
                      </span>
                    </label>
                  </div>

                  <div className="card-actions justify-end pt-4">
                    <button
                      type="submit"
                      className="btn btn-secondary btn-lg"
                      disabled={
                        isPending ||
                        !hasPassword ||
                        (!isEmailChanged && !hasNewPassword) ||
                        (hasNewPassword && !passwordsMatch)
                      }
                    >
                      {isPending ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                          Update Security Settings
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Badge Customization Card - Always visible, locked for non-Consumer */}
            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body relative">
                {/* Lock Overlay for non-Consumer tiers */}
                {!(
                  patreonStatus.isActive && patreonStatus.tier === 'consumer'
                ) && (
                  <div className="absolute inset-0 bg-base-300/70 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="p-4 bg-base-100/80 rounded-lg inline-block">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12 text-primary mx-auto mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <h3 className="text-xl font-bold mb-2">
                          Consumer Tier Only
                        </h3>
                        {patreonStatus.patreonId ? (
                          <>
                            <p className="text-sm text-base-content/70 mb-4">
                              Become a Consumer patron to unlock custom badge
                              colors
                            </p>
                            <a
                              href="https://www.patreon.com/nihongotracker"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary btn-sm gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
                              </svg>
                              Pledge on Patreon
                            </a>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-base-content/70 mb-4">
                              Unlock custom badge colors by becoming a Consumer
                              patron
                            </p>
                            <button
                              className="btn btn-primary btn-sm gap-2"
                              onClick={handlePatreonOAuth}
                              disabled={isInitiatingOAuth}
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
                              </svg>
                              Support on Patreon
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-primary"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      Badge Color Customization
                    </h2>
                    <p className="text-base-content/70">
                      Personalize your Consumer tier badge colors
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Badge Preview */}
                  <div className="flex items-center justify-center p-6 bg-base-200 rounded-lg">
                    <div
                      className={`badge badge-lg gap-2 px-4 py-3 font-bold ${badgeColor === 'rainbow' ? 'badge-rainbow' : badgeColor === 'primary' ? 'badge-primary' : badgeColor === 'secondary' ? 'badge-secondary' : ''}`}
                      style={
                        badgeColor !== 'rainbow' &&
                        badgeColor !== 'primary' &&
                        badgeColor !== 'secondary'
                          ? {
                              backgroundColor: badgeColor,
                              color:
                                badgeTextColor === 'primary-content'
                                  ? undefined
                                  : badgeTextColor === 'secondary-content'
                                    ? undefined
                                    : badgeTextColor,
                              border: 'none',
                            }
                          : {
                              color:
                                badgeTextColor === 'primary-content' ||
                                badgeTextColor === 'secondary-content'
                                  ? undefined
                                  : badgeTextColor,
                            }
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        className="inline-block w-4 h-4"
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      <span className="font-bold">
                        {user?.patreon?.customBadgeText || 'Consumer'}
                      </span>
                    </div>
                  </div>

                  {/* Color Selectors */}
                  <div className="flex items-center justify-center gap-4">
                    {/* Background Color */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
                      onClick={openBadgeColorModal}
                    >
                      <div
                        className={`w-16 h-16 rounded-lg border-2 border-base-300 cursor-pointer hover:border-primary transition-colors ${badgeColor === 'rainbow' ? 'badge-rainbow' : badgeColor === 'primary' ? 'bg-primary' : badgeColor === 'secondary' ? 'bg-secondary' : ''}`}
                        style={
                          badgeColor !== 'rainbow' &&
                          badgeColor !== 'primary' &&
                          badgeColor !== 'secondary'
                            ? { backgroundColor: badgeColor }
                            : undefined
                        }
                      />
                      <span className="text-xs text-base-content/70">
                        Background
                      </span>
                    </button>

                    {/* Text Color */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
                      onClick={openBadgeTextColorModal}
                    >
                      <div
                        className={`w-16 h-16 rounded-lg border-2 border-base-300 cursor-pointer hover:border-primary transition-colors ${badgeTextColor === 'primary-content' ? 'bg-primary-content' : badgeTextColor === 'secondary-content' ? 'bg-secondary-content' : ''}`}
                        style={
                          badgeTextColor !== 'primary-content' &&
                          badgeTextColor !== 'secondary-content'
                            ? { backgroundColor: badgeTextColor }
                            : undefined
                        }
                      />
                      <span className="text-xs text-base-content/70">Text</span>
                    </button>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => updateBadgeColors()}
                    disabled={isUpdatingColors}
                  >
                    {isUpdatingColors ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Save Badge Colors
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Preferences</h2>
                    <p className="text-base-content/70 text-sm">
                      Customize your experience
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Theme</span>
                    </label>
                    <ThemeSwitcher />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Timezone</span>
                      {isPreferencesPending && (
                        <span className="loading loading-spinner loading-sm"></span>
                      )}
                    </label>
                    <TimezonePicker
                      value={timezone}
                      onChange={setTimezone}
                      disabled={isPending || isPreferencesPending}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60 text-wrap">
                        All dates and times will be displayed in your selected
                        timezone
                      </span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <div>
                        <span className="label-text font-medium">
                          Blur Adult Content
                        </span>
                        <p className="text-sm text-base-content/60">
                          Hide explicit content by default
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPreferencesPending && (
                          <span className="loading loading-spinner loading-sm"></span>
                        )}
                        <input
                          type="checkbox"
                          className="toggle toggle-accent"
                          checked={blurAdult}
                          onChange={(e) => setBlurAdult(e.target.checked)}
                          disabled={isPreferencesPending}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <div>
                        <span className="label-text font-medium">
                          Hide Unmatched Logs Alert
                        </span>
                        <p className="text-sm text-base-content/60">
                          Don't show alerts about unmatched logs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPreferencesPending && (
                          <span className="loading loading-spinner loading-sm"></span>
                        )}
                        <input
                          type="checkbox"
                          className="toggle toggle-accent"
                          checked={hideUnmatchedAlert}
                          onChange={(e) =>
                            setHideUnmatchedAlert(e.target.checked)
                          }
                          disabled={isPreferencesPending}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-info/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-info"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Data Management</h2>
                    <p className="text-base-content/70 text-sm">
                      Import, sync, and manage your data
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3 text-base-content">
                      Import from File
                    </h3>
                    <form onSubmit={handleFileImport} className="space-y-3">
                      <input
                        type="file"
                        id="logFileImport"
                        className="file-input file-input-bordered file-input-info w-full"
                        accept=".csv,.tsv,.jsonl"
                      />
                      <div className="dropdown dropdown-center w-full">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline w-full gap-2"
                        >
                          {importType
                            ? importTypeString[importType]
                            : 'Choose the file format'}
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-300 rounded-box z-1 w-full p-2 shadow-sm"
                        >
                          <li>
                            <button
                              type="button"
                              className={`hover:bg-base-200 ${importType === 'tmw' ? 'active' : ''}`}
                              onClick={() => {
                                setImportType('tmw');
                              }}
                            >
                              TheMoeWay
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`hover:bg-base-200 ${importType === 'manabe' ? 'active' : ''}`}
                              onClick={() => {
                                setImportType('manabe');
                              }}
                            >
                              Manabe
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`hover:bg-base-200 ${importType === 'vncr' ? 'active' : ''}`}
                              onClick={() => {
                                setImportType('vncr');
                              }}
                            >
                              VN Club Resurrection
                            </button>
                          </li>
                        </ul>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-info w-full"
                        disabled={isImportPending}
                      >
                        {isImportPending ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Importing...
                          </>
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            Import File
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="divider"></div>

                  <div>
                    <h3 className="font-semibold mb-3 text-base-content">
                      Sync External Data
                    </h3>
                    <form onSubmit={handleSyncLogs} className="space-y-3">
                      <p className="text-sm text-base-content/70">
                        Sync logs from IniestaBot in the Manabe Discord server.
                        Ensure your Discord ID is set for proper linking.
                      </p>
                      <button
                        type="submit"
                        className="btn btn-warning w-full"
                        disabled={isSyncPending}
                      >
                        {isSyncPending ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Syncing...
                          </>
                        ) : (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Sync Logs
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-warning"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Log Management</h2>
                    <p className="text-base-content/70 text-sm">
                      Match untracked logs with media
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="alert alert-info">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h3 className="font-bold">Match Media</h3>
                      <div className="text-xs">
                        Link your untracked logs to the correct anime, manga,
                        books, visual novels, videos, movies, or TV shows.
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-warning w-full"
                    onClick={() => navigate('/matchmedia')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    Go to Match Media
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-error/5 border border-error/20 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-error/10 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-error"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-error">
                      Danger Zone
                    </h2>
                    <p className="text-error/70 text-sm">
                      Irreversible actions
                    </p>
                  </div>
                </div>

                <div className="alert alert-error mb-4">
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
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-bold">Warning!</h3>
                    <div className="text-xs">
                      This action cannot be undone and will permanently delete
                      all your data.
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-error w-full"
                  onClick={() =>
                    (
                      document.getElementById(
                        'clear_data_modal'
                      ) as HTMLDialogElement
                    )?.showModal()
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Color Picker Modal */}
      <dialog
        id="bg_color_modal"
        className="modal"
        onClose={handleBadgeColorModalClose}
      >
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">Badge Background Color</h3>

          {/* Theme Presets */}
          <div className="space-y-3 mb-4">
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeColor('primary')}
            >
              <div className="w-6 h-6 rounded bg-primary"></div>
              <span>Primary</span>
            </button>
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeColor('secondary')}
            >
              <div className="w-6 h-6 rounded bg-secondary"></div>
              <span>Secondary</span>
            </button>
            <button
              type="button"
              className="btn btn-outline w-full justify-start badge-rainbow"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => setPendingBadgeColor('rainbow')}
            >
              <div className="w-6 h-6 rounded badge-rainbow"></div>
              <span style={{ color: 'inherit' }}>🌈 Rainbow</span>
            </button>
          </div>

          <div className="divider">OR</div>

          {/* Custom Color Picker */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ width: '200px', height: '200px' }}>
              <Wheel
                color={badgeWheelColor}
                onChange={(color: { hex: string }) =>
                  setPendingBadgeColor(color.hex)
                }
              />
            </div>
            <input
              type="text"
              className="input input-bordered input-sm w-full text-center"
              value={badgeHexInputValue}
              onChange={(e) => setPendingBadgeColor(e.target.value)}
              placeholder="#ff69b4"
              style={{
                backgroundColor: badgeInputBackgroundColor,
                color: badgeInputBackgroundColor
                  ? badgeInputTextColor
                  : undefined,
              }}
            />
          </div>

          <div className="modal-action">
            <button
              className="btn btn-sm"
              type="button"
              onClick={handleBadgeColorDone}
            >
              Done
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Text Color Picker Modal */}
      <dialog
        id="text_color_modal"
        className="modal"
        onClose={handleBadgeTextModalClose}
      >
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">Badge Text Color</h3>

          {/* Theme Presets */}
          <div className="space-y-3 mb-4">
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeTextColor('primary-content')}
            >
              <div className="w-6 h-6 rounded bg-primary-content border border-base-300"></div>
              <span>Primary Text</span>
            </button>
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeTextColor('secondary-content')}
            >
              <div className="w-6 h-6 rounded bg-secondary-content border border-base-300"></div>
              <span>Secondary Text</span>
            </button>
          </div>

          <div className="divider">OR</div>

          {/* Custom Color Picker */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ width: '200px', height: '200px' }}>
              <Wheel
                color={badgeTextWheelColor}
                onChange={(color: { hex: string }) =>
                  setPendingBadgeTextColor(color.hex)
                }
              />
            </div>
            <input
              type="text"
              className="input input-bordered input-sm w-full text-center"
              value={badgeTextHexInputValue}
              onChange={(e) => setPendingBadgeTextColor(e.target.value)}
              placeholder="#ffffff"
              style={{
                backgroundColor: badgeTextInputBackgroundColor,
                color: badgeTextInputBackgroundColor
                  ? badgeTextInputTextColor
                  : undefined,
              }}
            />
          </div>

          <div className="modal-action">
            <button
              className="btn btn-sm"
              type="button"
              onClick={handleBadgeTextDone}
            >
              Done
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Email Sent Modal */}
      <dialog
        className="modal"
        open={showEmailSentModal}
        onClose={() => setShowEmailSentModal(false)}
      >
        <div className="modal-box">
          <h3 className="text-lg font-bold">Verification Email Sent!</h3>
          <div className="py-4">
            <p className="mb-3">
              We've sent a verification email to{' '}
              <span className="font-semibold">{emailSentTo}</span>
            </p>
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="h-6 w-6 shrink-0 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>
                Please check your spam or junk folder if you don't see the email
                in your inbox.
              </span>
            </div>
          </div>
          <div className="modal-action">
            <button
              className="btn btn-primary"
              onClick={() => setShowEmailSentModal(false)}
            >
              Got it!
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setShowEmailSentModal(false)}>close</button>
        </form>
      </dialog>
    </div>
  );
}

export default SettingsScreen;
