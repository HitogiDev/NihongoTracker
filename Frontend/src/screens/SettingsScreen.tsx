import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearUserDataFn,
  importLogFileFn,
  importLogsFn,
  exportLogsCSVFn,
  updateUserFn,
  getPatreonStatusFn,
  unlinkPatreonAccountFn,
  updateCustomBadgeTextFn,
  updateBadgeColorsFn,
  initiatePatreonOAuthFn,
  resendVerificationEmailFn,
  listApiKeysFn,
  generateApiKeyFn,
  deleteApiKeyFn,
  updateProfileLayoutFn,
  type IApiKey,
  type ICreatedApiKey,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { ILoginResponse, ProfileWidgetLayout } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PROFILE_WIDGETS,
  PROFILE_WIDGET_META,
  resolveProfileLayout,
} from '../utils/profileWidgets';
import { useTranslation } from 'react-i18next';
import LanguagePicker from '../components/LanguagePicker';
import ThemeSwitcher from '../components/ThemeSwitcher';
import TimezonePicker from '../components/TimezonePicker';
import TagManager from '../components/TagManager';
import { PercentCrop } from 'react-image-crop';
import { canvasPreview } from '../utils/canvasPreview';
import ImageCropDialog, {
  ImageCropResult,
} from '../components/ImageCropDialog';
import Wheel from '@uiw/react-color-wheel';
import { getUserTimezone } from '../utils/timezone';
import { renderMarkdownWithSpoilers } from '../utils/markdown';
import {
  Bold,
  CloudDownload,
  CloudUpload,
  Clock3,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heart,
  HeartHandshake,
  Info,
  Image as ImageIcon,
  Italic,
  KeyRound,
  Link as LinkIcon,
  Link2,
  Lock,
  List,
  ListOrdered,
  Mail,
  Quote,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Tag,
  TriangleAlert,
  Type,
  Unlink2,
  UserRound,
  XCircle,
  EyeOff,
  HelpCircle,
  Download,
  Key,
  Copy,
  Check,
  Trash2,
  Plus,
  Eye,
  SplitSquareHorizontal,
  GripVertical,
  LayoutList,
  RotateCcw,
} from 'lucide-react';

const ABOUT_MAX_LENGTH = 2000;
const DEFAULT_BADGE_COLOR = '#ff69b4';
const DEFAULT_BADGE_TEXT_COLOR = '#ffffff';
const PRESET_BADGE_BACKGROUNDS = ['primary', 'secondary', 'rainbow'] as const;
const PRESET_BADGE_TEXT_COLORS = [
  'primary-content',
  'secondary-content',
] as const;
const IMPORT_TYPE_LABELS: Record<
  'tmw' | 'manabe' | 'vncr' | 'kechimochi' | 'other',
  string
> = {
  tmw: 'TheMoeWay (.csv)',
  manabe: 'Manabe (.tsv)',
  vncr: 'VN-CSV (.csv)',
  kechimochi: 'Kechimochi (.csv)',
  other: 'NihongoTracker | Other (.csv)',
};

type PatreonStatus = {
  patreonEmail?: string;
  patreonId?: string;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  customBadgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  isActive: boolean;
};

type GifCropMetadata = {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

const MAX_AVATAR_SIZE_MB_DEFAULT = 3;
const MAX_BANNER_SIZE_MB_DEFAULT = 6;
const MAX_MEDIA_SIZE_MB_PATREON = 8;

// Kept out of the t() call: inline string options confuse the i18next
// extractor, which reads them as namespace names.
const AVATAR_DIMENSIONS = '230x230';
const BANNER_DIMENSIONS = '1700x330';

const toBytesFromMb = (mb: number): number => mb * 1024 * 1024;

const isGifMimeType = (mimeType?: string | null): boolean =>
  (mimeType ?? '').toLowerCase() === 'image/gif';

const isGifUploadFile = (file: File): boolean =>
  isGifMimeType(file.type) || file.name.toLowerCase().endsWith('.gif');

const sanitizeHex = (value: string): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#')
    ? trimmed.toLowerCase()
    : `#${trimmed.toLowerCase()}`;
  const hexRegex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
  return hexRegex.test(normalized) ? normalized : null;
};

const expandHex = (hex: string): string => {
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
};

const getContrastColor = (value: string | null): string => {
  if (!value) {
    return '#1f2937';
  }
  const sanitized = sanitizeHex(value);
  if (!sanitized) {
    return '#1f2937';
  }
  const hex = expandHex(sanitized);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
};

const isPresetBackground = (value: string | null | undefined): boolean => {
  return value
    ? PRESET_BADGE_BACKGROUNDS.includes(
        value as (typeof PRESET_BADGE_BACKGROUNDS)[number]
      )
    : false;
};

const isPresetTextColor = (value: string | null | undefined): boolean => {
  return value
    ? PRESET_BADGE_TEXT_COLORS.includes(
        value as (typeof PRESET_BADGE_TEXT_COLORS)[number]
      )
    : false;
};

type AboutEditorProps = {
  aboutRef: React.MutableRefObject<string>;
  maxLength: number;
  onSelectionChange?: (
    selection: { start: number; end: number } | null
  ) => void;
  initialValue?: string; // Used to trigger re-sync when user data changes
  onSave?: () => void;
  isSaving?: boolean;
  onPreviewChange?: (text: string) => void;
};

export type AboutEditorHandle = {
  insertSnippet: (prefix: string, suffix: string, placeholder: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
  needsLineBreak: () => boolean;
};

const AboutEditor = forwardRef<AboutEditorHandle, AboutEditorProps>(
  function AboutEditor(
    {
      aboutRef,
      maxLength,
      onSelectionChange,
      initialValue,
      onSave,
      isSaving,
      onPreviewChange,
    },
    ref
  ) {
    const { t } = useTranslation('settings');
    const [length, setLength] = useState(aboutRef.current.length);
    const [value, setValue] = useState(aboutRef.current);
    const [isDirty, setIsDirty] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lengthTimeoutRef = useRef<number | null>(null);

    // Sync when initialValue changes (e.g., on user data load)
    useEffect(() => {
      if (initialValue !== undefined && initialValue !== value) {
        setValue(initialValue);
        setLength(initialValue.length);
        aboutRef.current = initialValue;
        setIsDirty(false);
        onPreviewChange?.(initialValue);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialValue, aboutRef]);

    // Reset dirty state after save completes
    useEffect(() => {
      if (!isSaving && isDirty && initialValue === value) {
        setIsDirty(false);
      }
    }, [isSaving, isDirty, initialValue, value]);

    const needsLineBreak = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return false;
      const selectionStart = textarea.selectionStart ?? value.length;
      if (selectionStart === 0) return false;
      return value[selectionStart - 1] !== '\n';
    }, [value]);

    const insertSnippet = useCallback(
      (prefix: string, suffix: string, placeholder: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const selectionStart = textarea.selectionStart ?? value.length;
        const selectionEnd = textarea.selectionEnd ?? value.length;
        const selectedText =
          selectionStart !== selectionEnd
            ? value.slice(selectionStart, selectionEnd)
            : placeholder;

        const newValue =
          value.slice(0, selectionStart) +
          prefix +
          selectedText +
          suffix +
          value.slice(selectionEnd);

        if (newValue.length > maxLength) {
          toast.error(t('toast.aboutMaxLength'));
          return;
        }

        setValue(newValue);
        aboutRef.current = newValue;
        setLength(newValue.length);
        onPreviewChange?.(newValue);

        // Set cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.focus();
          const startPos = selectionStart + prefix.length;
          const endPos = startPos + selectedText.length;
          textarea.setSelectionRange(startPos, endPos);
        });
      },
      [value, maxLength, aboutRef, onPreviewChange, t]
    );

    useImperativeHandle(
      ref,
      () => ({
        insertSnippet,
        getTextarea: () => textareaRef.current,
        needsLineBreak,
      }),
      [insertSnippet, needsLineBreak]
    );

    return (
      <>
        <textarea
          className="textarea textarea-bordered focus:textarea-primary transition-colors w-full min-h-48 font-mono text-sm"
          placeholder={t('profile.aboutPlaceholder')}
          value={value}
          maxLength={maxLength}
          ref={textareaRef}
          onChange={(e) => {
            const newValue = e.target.value;
            setValue(newValue);
            aboutRef.current = newValue;
            setIsDirty(newValue !== (initialValue || ''));
            onPreviewChange?.(newValue);
            if (lengthTimeoutRef.current === null) {
              lengthTimeoutRef.current = window.setTimeout(() => {
                setLength(newValue.length);
                lengthTimeoutRef.current = null;
              }, 120);
            }
          }}
          onFocus={(e) => {
            const selection = {
              start: e.currentTarget.selectionStart,
              end: e.currentTarget.selectionEnd,
            };
            onSelectionChange?.(selection);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            const selection = {
              start: target.selectionStart,
              end: target.selectionEnd,
            };
            onSelectionChange?.(selection);
          }}
        ></textarea>
        <div className="flex justify-between items-center">
          <label className="label py-1"></label>
          <span className="label-text-alt text-base-content/60">
            {length}/{maxLength}
          </span>
        </div>
        {onSave && isDirty && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                t('profile.saveAbout')
              )}
            </button>
          </div>
        )}
      </>
    );
  }
);

type SettingsTab =
  | 'profile'
  | 'account'
  | 'preferences'
  | 'patreon'
  | 'advanced';

const TAB_CONFIG = [
  { id: 'profile', labelKey: 'tabs.profile', icon: UserRound },
  { id: 'account', labelKey: 'tabs.account', icon: ShieldCheck },
  { id: 'preferences', labelKey: 'tabs.preferences', icon: Settings2 },
  { id: 'patreon', labelKey: 'tabs.patreon', icon: Heart },
  { id: 'advanced', labelKey: 'tabs.advanced', icon: CloudDownload },
] as const satisfies readonly {
  id: SettingsTab;
  labelKey: string;
  icon: React.ElementType;
}[];

function SettingsScreen() {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useUserDataStore();
  const detectedTimezone = getUserTimezone();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [patreonStatus, setPatreonStatus] = useState<PatreonStatus>({
    isActive: false,
  });
  const [apiKeys, setApiKeys] = useState<IApiKey[]>([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ICreatedApiKey | null>(
    null
  );
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [username, setUsername] = useState(user?.username || '');
  const [discordId, setDiscordId] = useState(user?.discordId || '');
  const aboutRef = useRef(user?.about || '');
  const [aboutPreviewText, setAboutPreviewText] = useState(user?.about || '');
  const [aboutViewMode, setAboutViewMode] = useState<
    'edit' | 'preview' | 'split'
  >('split');
  const [customBadgeText, setCustomBadgeText] = useState(
    user?.patreon?.customBadgeText || ''
  );
  const [badgeColor, setBadgeColor] = useState<string>(
    user?.patreon?.badgeColor || DEFAULT_BADGE_COLOR
  );
  const [badgeTextColor, setBadgeTextColor] = useState<string>(
    user?.patreon?.badgeTextColor || DEFAULT_BADGE_TEXT_COLOR
  );
  const [pendingBadgeColor, setPendingBadgeColor] = useState<string | null>(
    null
  );
  const [pendingBadgeTextColor, setPendingBadgeTextColor] = useState<
    string | null
  >(null);
  const [isInitiatingOAuth, setIsInitiatingOAuth] = useState(false);
  const [blurAdult, setBlurAdult] = useState(
    user?.settings?.blurAdultContent || false
  );
  const [hideUnmatchedAlert, setHideUnmatchedAlert] = useState(
    user?.settings?.hideUnmatchedLogsAlert || false
  );
  const [timezone, setTimezone] = useState(
    user?.settings?.timezone || detectedTimezone
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>('');
  const [bannerSrc, setBannerSrc] = useState<string>('');
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [croppedAvatarFile, setCroppedAvatarFile] = useState<File | null>(null);
  const [croppedBannerFile, setCroppedBannerFile] = useState<File | null>(null);
  const [avatarCropMetadata, setAvatarCropMetadata] =
    useState<GifCropMetadata | null>(null);
  const [bannerCropMetadata, setBannerCropMetadata] =
    useState<GifCropMetadata | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const [avatarMimeType, setAvatarMimeType] = useState<string | null>(null);
  const [bannerMimeType, setBannerMimeType] = useState<string | null>(null);
  const [avatarOriginalFileName, setAvatarOriginalFileName] = useState<
    string | null
  >(null);
  const [bannerOriginalFileName, setBannerOriginalFileName] = useState<
    string | null
  >(null);
  const [importType, setImportType] = useState<
    'tmw' | 'manabe' | 'vncr' | 'kechimochi' | 'other' | null
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
  const advancedOptionsRef = useRef<HTMLDetailsElement>(null);
  const aboutEditorRef = useRef<AboutEditorHandle>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const imageUrlInputRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordConfirmRef = useRef<HTMLInputElement>(null);
  const discordPasswordRef = useRef<HTMLInputElement>(null);

  const hasPatreonMediaAccess =
    user?.patreon?.isActive &&
    (user?.patreon?.tier === 'enthusiast' ||
      user?.patreon?.tier === 'consumer');
  const avatarMaxSizeMb = hasPatreonMediaAccess
    ? MAX_MEDIA_SIZE_MB_PATREON
    : MAX_AVATAR_SIZE_MB_DEFAULT;
  const bannerMaxSizeMb = hasPatreonMediaAccess
    ? MAX_MEDIA_SIZE_MB_PATREON
    : MAX_BANNER_SIZE_MB_DEFAULT;
  const avatarMaxSizeBytes = toBytesFromMb(avatarMaxSizeMb);
  const bannerMaxSizeBytes = toBytesFromMb(bannerMaxSizeMb);

  useEffect(() => {
    if (isImageModalOpen) {
      requestAnimationFrame(() => {
        imageUrlInputRef.current?.focus();
      });
    }
  }, [isImageModalOpen]);

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data: ILoginResponse, variables: FormData) => {
      const submittedEmail = variables.get('email');
      const normalizedSubmittedEmail =
        typeof submittedEmail === 'string' ? submittedEmail.trim() : null;
      const normalizedCurrentEmail = user?.email?.trim() || '';
      const emailWasChanged =
        normalizedSubmittedEmail !== null &&
        normalizedSubmittedEmail !== normalizedCurrentEmail;

      if (emailWasChanged) {
        setEmailSentTo(normalizedSubmittedEmail);
        setShowEmailSentModal(true);
        setResendCooldown(60); // Start cooldown immediately after sending verification email
      } else {
        // Only show toast if email wasn't changed (no modal will be shown)
        toast.success(t('toast.userUpdated'));
      }

      setUser(data);
      aboutRef.current = data.about || '';
      // AboutEditor will sync automatically via useEffect
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      setCroppedAvatarFile(null);
      setAvatarCropMetadata(null);
      setAvatarFileName(null);
      setAvatarOriginalFileName(null);
      setAvatarMimeType(null);
      if (avatarPreviewCanvasRef.current) {
        const canvas = avatarPreviewCanvasRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.classList.add('hidden');
      }
      if (bannerInputRef.current) {
        bannerInputRef.current.value = '';
      }
      setCroppedBannerFile(null);
      setBannerCropMetadata(null);
      setBannerFileName(null);
      setBannerOriginalFileName(null);
      setBannerMimeType(null);
      if (bannerPreviewCanvasRef.current) {
        const canvas = bannerPreviewCanvasRef.current;
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
        toast.error(error.message ? error.message : tCommon('errors.generic'));
      }
    },
  });

  // Mutation for saving just the about section
  const { mutate: saveAbout, isPending: isSavingAbout } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data: ILoginResponse) => {
      toast.success(t('toast.aboutUpdated'));
      setUser(data);
      aboutRef.current = data.about || '';
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
        toast.error(error.message ? error.message : tCommon('errors.generic'));
      }
    },
  });

  const handleSaveAbout = useCallback(() => {
    const formData = new FormData();
    formData.append('about', aboutRef.current);
    saveAbout(formData);
  }, [saveAbout]);

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
          toast.error(t('toast.preferenceSaveFailed'));
        }
      },
    });

  // Mutation for resending verification email
  const { mutate: resendVerificationEmail, isPending: isResendingEmail } =
    useMutation({
      mutationFn: resendVerificationEmailFn,
      onSuccess: () => {
        toast.success(t('toast.verificationSent'));
        setResendCooldown(60); // Start 60-second cooldown
      },
      onError: (error) => {
        if (error instanceof AxiosError) {
          const errorMessage =
            error.response?.data.message || tCommon('errors.generic');
          toast.error(errorMessage);
          // If error mentions remaining time, extract it and set cooldown
          const match = errorMessage.match(/wait (\d+) seconds/);
          if (match && match[1]) {
            setResendCooldown(parseInt(match[1], 10));
          }
        } else {
          toast.error(t('toast.verificationFailed'));
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
  const timezoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurAdultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hideUnmatchedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Initialize state from user data once
  useEffect(() => {
    if (user && !isInitialized) {
      setDiscordId(user.discordId || '');
      setUsername(user.username || '');
      setBlurAdult(user.settings?.blurAdultContent || false);
      setHideUnmatchedAlert(user.settings?.hideUnmatchedLogsAlert || false);
      setTimezone(user.settings?.timezone || detectedTimezone);
      setIsInitialized(true);
    }
  }, [user, isInitialized, detectedTimezone]);

  useEffect(() => {
    // Avoid wiping editor state when user is temporarily null (e.g. auth state transitions)
    if (user?.about !== undefined) {
      aboutRef.current = user.about;
    }
    // AboutEditor will sync automatically via useEffect watching aboutRef.current
  }, [user?.about]);

  // Auto-save preferences when they change (only after initialization)
  useEffect(() => {
    if (
      isInitialized &&
      user?.settings?.timezone !== timezone &&
      timezone !== (user?.settings?.timezone || detectedTimezone)
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
    detectedTimezone,
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
        toast.error(error.message ? error.message : tCommon('errors.generic'));
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
        toast.error(error.message ? error.message : tCommon('errors.generic'));
      }
    },
  });

  const { mutate: exportLogs, isPending: isExportPending } = useMutation({
    mutationFn: exportLogsCSVFn,
    onSuccess: (data) => {
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nihongotracker-export-${user?.username || 'data'}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('toast.exportSuccess'));
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message || t('toast.exportFailed'));
      } else {
        toast.error(t('toast.exportFailed'));
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
        toast.error(error.message ? error.message : tCommon('errors.generic'));
      }
    },
  });

  const { mutate: fetchApiKeys, isPending: isLoadingApiKeys } = useMutation({
    mutationFn: listApiKeysFn,
    onSuccess: (data) => {
      setApiKeys(data);
    },
  });

  const { mutate: generateApiKey, isPending: isGeneratingKey } = useMutation({
    mutationFn: generateApiKeyFn,
    onSuccess: (data) => {
      setNewlyCreatedKey(data);
      setApiKeyName('');
      fetchApiKeys();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(
          error.response?.data.message || t('toast.apiKeyCreateFailed')
        );
      } else {
        toast.error(t('toast.apiKeyCreateFailed'));
      }
    },
  });

  const { mutate: deleteApiKey, isPending: isDeletingKey } = useMutation({
    mutationFn: deleteApiKeyFn,
    onSuccess: () => {
      toast.success(t('toast.apiKeyRevoked'));
      fetchApiKeys();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(
          error.response?.data.message || t('toast.apiKeyRevokeFailed')
        );
      } else {
        toast.error(t('toast.apiKeyRevokeFailed'));
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
        toast.error(t('toast.patreonUnlinkFailed'));
      }
    },
  });

  const { mutate: updateBadgeText, isPending: isUpdatingBadge } = useMutation({
    mutationFn: updateCustomBadgeTextFn,
    onSuccess: (data) => {
      toast.success(t('toast.badgeTextUpdated'));
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
        toast.error(t('toast.badgeTextFailed'));
      }
    },
  });

  const { mutate: updateBadgeColors, isPending: isUpdatingColors } =
    useMutation({
      mutationFn: () => updateBadgeColorsFn(badgeColor, badgeTextColor),
      onSuccess: (data) => {
        toast.success(t('toast.badgeColorsUpdated'));
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
          toast.error(t('toast.badgeColorsFailed'));
        }
      },
    });

  // Fetch Patreon status and API keys on mount
  useEffect(() => {
    fetchPatreonStatus();
    fetchApiKeys();

    // Handle OAuth callback from Patreon
    const params = new URLSearchParams(window.location.search);
    const patreonStatus = params.get('patreon');
    const message = params.get('message');

    if (patreonStatus === 'success') {
      toast.success(`✅ ${t('toast.patreonLinked')}`);
      // Limpiar URL sin recargar la página
      window.history.replaceState({}, '', '/settings');
      // Recargar el estado de Patreon
      fetchPatreonStatus();
    } else if (patreonStatus === 'error') {
      const errorKeys = {
        missing_params: 'patreon.errors.missingParams',
        invalid_state: 'patreon.errors.invalidState',
        oauth_not_configured: 'patreon.errors.oauthNotConfigured',
        account_already_linked: 'patreon.errors.accountAlreadyLinked',
        user_not_found: 'patreon.errors.userNotFound',
        oauth_failed: 'patreon.errors.oauthFailed',
      } as const;
      const errorMessage = t(
        (message && errorKeys[message as keyof typeof errorKeys]) ||
          'patreon.errors.linkFailed'
      );
      toast.error(`❌ ${errorMessage}`);
      // Limpiar URL
      window.history.replaceState({}, '', '/settings');
    }
  }, [fetchApiKeys, t]);

  async function fetchPatreonStatus() {
    try {
      const status = await getPatreonStatusFn();
      setPatreonStatus(status);

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

  async function handleSyncLogs(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    syncLogs();
  }

  async function handleFileImport(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const logImportInput = document.getElementById(
      'logFileImport'
    ) as HTMLInputElement;
    if (!logImportInput.files || logImportInput.files.length === 0) {
      toast.error(t('toast.selectFile'));
      return;
    }
    const file = logImportInput.files[0];
    const formData = new FormData();
    formData.append('logFileImport', file);
    formData.append('logImportType', importType ?? '');
    importFileLogs(formData);
  }

  const handleAdvancedOptionsToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      const advancedOptions = event.currentTarget;
      if (!advancedOptions.open) {
        return;
      }
      (
        document.getElementById(
          'advanced_options_info_modal'
        ) as HTMLDialogElement | null
      )?.showModal();
    },
    []
  );

  const closeAdvancedOptions = useCallback(() => {
    if (advancedOptionsRef.current) {
      advancedOptionsRef.current.open = false;
    }
  }, []);

  async function handleClearData() {
    if (!user) return;
    const inputValue = confirmUsernameRef.current?.value || '';
    if (inputValue !== user.username) {
      toast.error(t('toast.usernameMismatch'));
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
      toast.error(t('toast.patreonOauthFailed'));
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

  const insertHeading = useCallback(
    (level: 1 | 2 | 3) => {
      const editor = aboutEditorRef.current;
      if (!editor) return;
      const hashes = '#'.repeat(level);
      const prefix = `${editor.needsLineBreak() ? '\n' : ''}${hashes} `;
      editor.insertSnippet(
        prefix,
        '',
        t('markdown.snippets.heading', { level })
      );
    },
    [t]
  );

  const insertListItem = useCallback(
    (ordered: boolean) => {
      const editor = aboutEditorRef.current;
      if (!editor) return;
      const bullet = ordered ? '1. ' : '- ';
      const prefix = `${editor.needsLineBreak() ? '\n' : ''}${bullet}`;
      editor.insertSnippet(prefix, '', t('markdown.snippets.listItem'));
    },
    [t]
  );

  const insertQuote = useCallback(() => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const prefix = `${editor.needsLineBreak() ? '\n' : ''}> `;
    editor.insertSnippet(prefix, '', t('markdown.snippets.quote'));
  }, [t]);

  const insertCodeBlock = useCallback(() => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const lineBreak = editor.needsLineBreak() ? '\n' : '';
    const prefix = `${lineBreak}\`\`\`\n`;
    editor.insertSnippet(prefix, '\n```\n', t('markdown.snippets.code'));
  }, [t]);

  const insertBold = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '**',
      '**',
      t('markdown.snippets.bold')
    );
  }, [t]);

  const insertItalic = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '*',
      '*',
      t('markdown.snippets.italic')
    );
  }, [t]);

  const insertInlineCode = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '`',
      '`',
      t('markdown.snippets.inlineCode')
    );
  }, [t]);

  const insertLink = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '[',
      '](https://example.com)',
      t('markdown.snippets.link')
    );
  }, [t]);

  const insertSpoiler = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '||',
      '||',
      t('markdown.snippets.spoiler')
    );
  }, [t]);

  async function handleUpdateUser(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    const currentEmail = emailRef.current?.value || '';
    const currentPassword = passwordRef.current?.value || '';
    const currentNewPassword = newPasswordRef.current?.value || '';
    const currentNewPasswordConfirm =
      newPasswordConfirmRef.current?.value || '';

    const trimmedUsername = username.trim();
    if (trimmedUsername && trimmedUsername !== (user?.username || '')) {
      formData.append('username', trimmedUsername);
    }
    if (currentEmail !== (user?.email || ''))
      formData.append('email', currentEmail);
    if (currentPassword.trim()) formData.append('password', currentPassword);
    if (currentNewPassword.trim())
      formData.append('newPassword', currentNewPassword);
    if (currentNewPasswordConfirm.trim())
      formData.append('newPasswordConfirm', currentNewPasswordConfirm);

    updateUser(formData);
  }

  async function handleUpdateDiscord(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    const pwd = discordPasswordRef.current?.value || '';
    if (pwd.trim()) formData.append('password', pwd);
    formData.append('discordId', discordId);
    updateUser(formData);
  }

  async function handleUpdateProfile(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();

    const storedAbout = user?.about ?? '';
    if (aboutRef.current !== storedAbout) {
      formData.append('about', aboutRef.current);
    }

    const selectedAvatarFile = avatarInputRef.current?.files?.[0];
    const selectedBannerFile = bannerInputRef.current?.files?.[0];

    if (croppedAvatarFile) {
      formData.append('avatar', croppedAvatarFile);
    } else if (selectedAvatarFile) {
      formData.append('avatar', selectedAvatarFile);
    }

    if (
      selectedAvatarFile &&
      isGifMimeType(avatarMimeType) &&
      avatarCropMetadata
    ) {
      formData.append('avatarCrop', JSON.stringify(avatarCropMetadata));
    }

    if (croppedBannerFile) {
      formData.append('banner', croppedBannerFile);
    } else if (selectedBannerFile) {
      formData.append('banner', selectedBannerFile);
    }

    if (
      selectedBannerFile &&
      isGifMimeType(bannerMimeType) &&
      bannerCropMetadata
    ) {
      formData.append('bannerCrop', JSON.stringify(bannerCropMetadata));
    }

    updateUser(formData);
  }

  const getDefaultAvatarCrop = useCallback(
    (image: HTMLImageElement): PercentCrop => {
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
    },
    []
  );

  const getInitialBannerCrop = useCallback(
    (image: HTMLImageElement): PercentCrop => {
      const { naturalWidth, naturalHeight } = image;
      const targetAspectRatio = 21 / 9;
      const imageAspectRatio = naturalWidth / naturalHeight;

      let cropWidthPercent: number;
      let cropHeightPercent: number;

      if (imageAspectRatio > targetAspectRatio) {
        cropHeightPercent = 80;
        cropWidthPercent =
          (cropHeightPercent * targetAspectRatio * naturalHeight) /
          naturalWidth;

        if (cropWidthPercent > 95) {
          cropWidthPercent = 80;
          cropHeightPercent =
            (cropWidthPercent * naturalWidth) /
            (targetAspectRatio * naturalHeight);
        }
      } else {
        cropWidthPercent = 80;
        cropHeightPercent =
          (cropWidthPercent * naturalWidth) /
          (targetAspectRatio * naturalHeight);

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
    },
    []
  );

  const handleAvatarCropApply = useCallback(
    async ({ crop, image }: ImageCropResult) => {
      const selectedFile = avatarInputRef.current?.files?.[0];
      const isGifSelection =
        (selectedFile ? isGifUploadFile(selectedFile) : false) ||
        isGifMimeType(avatarMimeType);

      if (isGifSelection) {
        setAvatarCropMetadata({
          x: Math.round(crop.x),
          y: Math.round(crop.y),
          width: Math.round(crop.width),
          height: Math.round(crop.height),
          sourceWidth: image.naturalWidth,
          sourceHeight: image.naturalHeight,
        });
        setCroppedAvatarFile(null);
        if (avatarPreviewCanvasRef.current) {
          const canvas = avatarPreviewCanvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.classList.add('hidden');
        }
        return;
      }

      if (!avatarPreviewCanvasRef.current) {
        return;
      }

      setAvatarCropMetadata(null);
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
            setAvatarMimeType(croppedFile.type);
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
    [avatarFileName, avatarMimeType, avatarOriginalFileName]
  );

  const handleBannerCropApply = useCallback(
    async ({ crop, image }: ImageCropResult) => {
      const selectedFile = bannerInputRef.current?.files?.[0];
      const isGifSelection =
        (selectedFile ? isGifUploadFile(selectedFile) : false) ||
        isGifMimeType(bannerMimeType);

      if (isGifSelection) {
        setBannerCropMetadata({
          x: Math.round(crop.x),
          y: Math.round(crop.y),
          width: Math.round(crop.width),
          height: Math.round(crop.height),
          sourceWidth: image.naturalWidth,
          sourceHeight: image.naturalHeight,
        });
        setCroppedBannerFile(null);
        if (bannerPreviewCanvasRef.current) {
          const canvas = bannerPreviewCanvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.classList.add('hidden');
        }
        return;
      }

      if (!bannerPreviewCanvasRef.current) {
        return;
      }

      setBannerCropMetadata(null);
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
            setBannerMimeType(croppedFile.type);
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
    [bannerFileName, bannerMimeType, bannerOriginalFileName]
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
    setAvatarCropMetadata(null);
    setAvatarMimeType(null);
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
    setBannerCropMetadata(null);
    setBannerMimeType(null);
    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  }, []);

  function onSelectAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > avatarMaxSizeBytes) {
      toast.error(`Avatar must be smaller than ${avatarMaxSizeMb}MB`);
      e.target.value = '';
      return;
    }

    setAvatarFileName(file.name);
    setAvatarOriginalFileName(file.name);
    setAvatarMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarSrc(reader.result as string);
      setShowAvatarCrop(true);
    };
    reader.readAsDataURL(file);
  }

  function onSelectBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > bannerMaxSizeBytes) {
      toast.error(`Banner must be smaller than ${bannerMaxSizeMb}MB`);
      e.target.value = '';
      return;
    }

    setBannerFileName(file.name);
    setBannerOriginalFileName(file.name);
    setBannerMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setBannerSrc(reader.result as string);
      setShowBannerCrop(true);
    };
    reader.readAsDataURL(file);
  }

  const badgeHexInputValue = (() => {
    if (isPresetBackground(pendingBadgeColor ?? badgeColor)) return '';
    return pendingBadgeColor ?? badgeColor;
  })();

  const badgeInputBackgroundColor = (() => {
    const value = pendingBadgeColor ?? badgeColor;
    if (isPresetBackground(value)) return undefined;
    return sanitizeHex(value) ?? undefined;
  })();

  const badgeInputTextColor = (() => {
    return getContrastColor(badgeInputBackgroundColor ?? null);
  })();

  const badgeWheelColor = (() => {
    const value = pendingBadgeColor ?? badgeColor;
    if (isPresetBackground(value)) return DEFAULT_BADGE_COLOR;
    return sanitizeHex(value) ?? DEFAULT_BADGE_COLOR;
  })();

  const badgeTextHexInputValue = (() => {
    if (isPresetTextColor(pendingBadgeTextColor ?? badgeTextColor)) return '';
    return pendingBadgeTextColor ?? badgeTextColor;
  })();

  const badgeTextInputBackgroundColor = (() => {
    const value = pendingBadgeTextColor ?? badgeTextColor;
    if (isPresetTextColor(value)) return undefined;
    return sanitizeHex(value) ?? undefined;
  })();

  const badgeTextInputTextColor = (() => {
    return getContrastColor(badgeTextInputBackgroundColor ?? null);
  })();

  const badgeTextWheelColor = (() => {
    const value = pendingBadgeTextColor ?? badgeTextColor;
    if (isPresetTextColor(value)) return DEFAULT_BADGE_TEXT_COLOR;
    return sanitizeHex(value) ?? DEFAULT_BADGE_TEXT_COLOR;
  })();

  const renderedAboutPreview = useMemo(() => {
    if (!aboutPreviewText.trim()) return '';
    return renderMarkdownWithSpoilers(aboutPreviewText);
  }, [aboutPreviewText]);

  // ——— Markdown toolbar ———
  const MarkdownToolbar = (
    <div className="flex flex-wrap gap-1 mb-2 p-2 bg-base-200 rounded-t-lg border border-base-300 border-b-0">
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => insertHeading(1)}
        title={t('markdown.heading1')}
        aria-label={t('markdown.a11y.heading1')}
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => insertHeading(2)}
        title={t('markdown.heading2')}
        aria-label={t('markdown.a11y.heading2')}
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => insertHeading(3)}
        title={t('markdown.heading3')}
        aria-label={t('markdown.a11y.heading3')}
      >
        <Heading3 className="w-4 h-4" />
      </button>
      <div
        className="w-px bg-base-300/60 self-stretch"
        aria-hidden="true"
      ></div>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertBold}
        title={t('markdown.bold')}
        aria-label={t('markdown.a11y.bold')}
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertItalic}
        title={t('markdown.italic')}
        aria-label={t('markdown.a11y.italic')}
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertInlineCode}
        title={t('markdown.inlineCode')}
        aria-label={t('markdown.a11y.inlineCode')}
      >
        <Type className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertCodeBlock}
        title={t('markdown.codeBlock')}
        aria-label={t('markdown.a11y.codeBlock')}
      >
        <Code className="w-4 h-4" />
      </button>
      <div
        className="w-px bg-base-300/60 self-stretch"
        aria-hidden="true"
      ></div>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => insertListItem(false)}
        title={t('markdown.bulletedList')}
        aria-label={t('markdown.a11y.bulletedList')}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => insertListItem(true)}
        title={t('markdown.numberedList')}
        aria-label={t('markdown.a11y.numberedList')}
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertQuote}
        title={t('markdown.quote')}
        aria-label={t('markdown.a11y.quote')}
      >
        <Quote className="w-4 h-4" />
      </button>
      <div
        className="w-px bg-base-300/60 self-stretch"
        aria-hidden="true"
      ></div>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertLink}
        title={t('markdown.link')}
        aria-label={t('markdown.a11y.link')}
      >
        <LinkIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={insertSpoiler}
        title={t('markdown.spoiler')}
        aria-label={t('markdown.a11y.spoiler')}
      >
        <EyeOff className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={() => {
          setImageUrl('');
          setImageAlt('');
          setIsImageModalOpen(true);
        }}
        title={t('markdown.image')}
        aria-label={t('markdown.a11y.image')}
      >
        <ImageIcon className="w-4 h-4" />
      </button>

      {/* View mode switcher */}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className={`btn btn-xs ${aboutViewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAboutViewMode('edit')}
          title={t('markdown.editOnly')}
        >
          <Code className="w-3 h-3" />
        </button>
        <button
          type="button"
          className={`btn btn-xs ${aboutViewMode === 'split' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAboutViewMode('split')}
          title={t('markdown.splitView')}
        >
          <SplitSquareHorizontal className="w-3 h-3" />
        </button>
        <button
          type="button"
          className={`btn btn-xs ${aboutViewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setAboutViewMode('preview')}
          title={t('markdown.previewOnly')}
        >
          <Eye className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base-200/40 pt-16">
      {/* Clear Data Modal */}
      <dialog id="clear_data_modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg text-error mb-2">
            {t('danger.clearAll')}
          </h3>
          <p className="text-base-content/70 mb-4">
            {t('danger.deleteWarning')}{' '}
            <span className="font-bold text-error">
              {t('danger.cannotBeUndone')}
            </span>
            .
          </p>
          <p className="text-base-content/70 mb-4">
            {t('danger.confirmUsername')}{' '}
            <span className="font-bold">{user?.username}</span>
          </p>
          <input
            type="text"
            className="input input-bordered w-full mb-4"
            placeholder={t('account.usernamePlaceholder')}
            ref={confirmUsernameRef}
            onChange={(e) => {
              setIsUsernameMatch(e.target.value === user?.username);
            }}
          />
          <div className="modal-action">
            <form method="dialog">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (confirmUsernameRef.current) {
                    confirmUsernameRef.current.value = '';
                  }
                  setIsUsernameMatch(false);
                }}
              >
                {t('common.cancel')}
              </button>
            </form>
            <button
              className="btn btn-error"
              onClick={handleClearData}
              disabled={!isUsernameMatch || isClearDataPending}
            >
              {isClearDataPending ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {t('danger.clearAll')}
                </>
              )}
            </button>
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
        title={t('crop.avatarTitle')}
        imageSrc={avatarSrc}
        isOpen={showAvatarCrop}
        aspect={1}
        modalBoxClassName="max-w-2xl"
        circular
        onClose={handleAvatarCropClose}
        onCancel={handleAvatarCropCancel}
        onApply={handleAvatarCropApply}
        getInitialCrop={getDefaultAvatarCrop}
      />

      <ImageCropDialog
        title={t('crop.bannerTitle')}
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

      {/* Page Header */}
      <div className="bg-base-100 border-b border-base-300">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-base-content">
            {t('header.title')}
          </h1>
          <p className="text-base-content/60 mt-1">{t('header.subtitle')}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="card bg-base-100 shadow-sm border border-base-300/50 sticky top-6">
              <div className="card-body p-2">
                <nav className="flex flex-row lg:flex-col gap-1">
                  {TAB_CONFIG.map(({ id, labelKey, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      id={`settings-tab-${id}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 text-left w-full cursor-pointer
                        ${
                          activeTab === id
                            ? 'bg-primary text-primary-content shadow-sm'
                            : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                        }`}
                      onClick={() => setActiveTab(id)}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:block">{t(labelKey)}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* ── PROFILE TAB ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <UserRound className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('profile.tab')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('profile.subtitle')}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                      {/* About Me with real-time preview */}
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium text-base">
                            {t('profile.about')}
                          </span>
                          <span className="label-text-alt text-base-content/50 text-xs">
                            {t('profile.markdownSupported')}
                          </span>
                        </label>

                        {MarkdownToolbar}

                        {/* Editor + Preview area */}
                        <div
                          className={`border border-base-300 rounded-b-lg overflow-hidden ${aboutViewMode === 'split' ? 'grid grid-cols-2 divide-x divide-base-300' : ''}`}
                        >
                          {/* Editor pane */}
                          {(aboutViewMode === 'edit' ||
                            aboutViewMode === 'split') && (
                            <div
                              className={aboutViewMode === 'split' ? '' : ''}
                            >
                              <AboutEditor
                                ref={aboutEditorRef}
                                aboutRef={aboutRef}
                                maxLength={ABOUT_MAX_LENGTH}
                                initialValue={user?.about}
                                onSave={handleSaveAbout}
                                isSaving={isSavingAbout}
                                onPreviewChange={setAboutPreviewText}
                              />
                            </div>
                          )}

                          {/* Preview pane */}
                          {(aboutViewMode === 'preview' ||
                            aboutViewMode === 'split') && (
                            <div className="p-4 min-h-48 bg-base-50">
                              {aboutViewMode === 'split' && (
                                <div className="text-xs text-base-content/40 font-medium uppercase tracking-wide mb-3 flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {t('profile.preview')}
                                </div>
                              )}
                              {renderedAboutPreview ? (
                                <div
                                  className="prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: renderedAboutPreview,
                                  }}
                                />
                              ) : (
                                <p className="text-base-content/30 text-sm italic">
                                  {aboutViewMode === 'preview'
                                    ? t('profile.previewEmpty')
                                    : t('profile.previewPlaceholder')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Avatar */}
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('profile.avatar')}
                          </span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div className="flex-1 w-full">
                            <input
                              type="file"
                              id="avatar"
                              ref={avatarInputRef}
                              className="file-input file-input-bordered file-input-primary w-full"
                              accept={
                                hasPatreonMediaAccess
                                  ? 'image/*'
                                  : 'image/jpeg,image/jpg,image/png,image/webp'
                              }
                              onChange={onSelectAvatarFile}
                            />
                            <label className="label pt-1 flex flex-col items-start gap-1">
                              <span className="label-text-alt text-base-content/60 leading-relaxed">
                                {t('profile.allowedFormats', {
                                  gif: hasPatreonMediaAccess ? ', GIF' : '',
                                  maxSize: avatarMaxSizeMb,
                                  dimensions: AVATAR_DIMENSIONS,
                                })}
                              </span>
                              {(croppedAvatarFile || avatarCropMetadata) && (
                                <span className="label-text-alt text-success">
                                  {t('profile.avatarCropped')}
                                </span>
                              )}
                            </label>
                          </div>
                          {user?.avatar ||
                          croppedAvatarFile ||
                          avatarCropMetadata ? (
                            <div className="flex flex-col items-center gap-2">
                              {user?.avatar && !croppedAvatarFile && (
                                <img
                                  src={user.avatar}
                                  alt={t('profile.currentAvatarAlt')}
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
                              {avatarCropMetadata && !croppedAvatarFile && (
                                <span className="text-xs text-success text-center max-w-[120px]">
                                  {t('profile.gifCropOnSave')}
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Banner */}
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('profile.banner')}
                          </span>
                        </label>
                        <div className="flex flex-col gap-4">
                          <div className="w-full">
                            <input
                              type="file"
                              id="banner"
                              ref={bannerInputRef}
                              className="file-input file-input-bordered file-input-primary w-full"
                              accept={
                                hasPatreonMediaAccess
                                  ? 'image/*'
                                  : 'image/jpeg,image/jpg,image/png,image/webp'
                              }
                              onChange={onSelectBannerFile}
                            />
                            <label className="label pt-1 flex flex-col items-start gap-1">
                              <span className="label-text-alt text-base-content/60 leading-relaxed">
                                {t('profile.allowedFormats', {
                                  gif: hasPatreonMediaAccess ? ', GIF' : '',
                                  maxSize: bannerMaxSizeMb,
                                  dimensions: BANNER_DIMENSIONS,
                                })}
                              </span>
                              {(croppedBannerFile || bannerCropMetadata) && (
                                <span className="label-text-alt text-success">
                                  {t('profile.bannerCropped')}
                                </span>
                              )}
                            </label>
                          </div>
                          {user?.banner ||
                          croppedBannerFile ||
                          bannerCropMetadata ? (
                            <>
                              {user?.banner && !croppedBannerFile && (
                                <img
                                  src={user.banner}
                                  alt={t('profile.currentBannerAlt')}
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
                              {bannerCropMetadata && !croppedBannerFile && (
                                <span className="text-xs text-success">
                                  {t('profile.gifCropOnSave')}
                                </span>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="card-actions justify-end pt-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isPending}
                        >
                          {isPending ? (
                            <>
                              <span className="loading loading-spinner loading-sm"></span>
                              {t('profile.saving')}
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              {t('profile.save')}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <ProfileLayoutEditor />
              </div>
            )}

            {/* ── ACCOUNT & SECURITY TAB ── */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-secondary/10 rounded-lg">
                        <ShieldCheck className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('account.tab')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('account.subtitle')}
                        </p>
                      </div>
                    </div>

                    {/* Current password context banner */}
                    <div className="alert alert-info alert-soft mb-6">
                      <ShieldCheck className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">
                          {t('account.passwordRequired')}
                        </p>
                        <p className="text-xs">{t('account.identityNote')}</p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdateUser} className="space-y-6">
                      {/* Current Password — shown prominently at top */}
                      <div className="form-control w-full p-4 bg-base-200/60 rounded-xl border border-base-300">
                        <label className="label pt-0">
                          <span className="label-text font-semibold flex items-center gap-2">
                            <Lock className="h-4 w-4 text-secondary" />
                            {t('account.currentPassword')}
                          </span>
                          <span className="label-text-alt text-base-content/50">
                            {t('account.requiredForChanges')}
                          </span>
                        </label>
                        <input
                          ref={passwordRef}
                          name="settings_current_password"
                          type="password"
                          autoComplete="new-password"
                          className="input input-bordered focus:input-secondary transition-colors w-full"
                          placeholder={t('account.currentPasswordPlaceholder')}
                          onChange={(e) =>
                            setHasPassword(e.target.value.trim().length > 0)
                          }
                        />
                      </div>

                      <div className="divider text-xs text-base-content/40">
                        {t('account.detailsHeading')}
                      </div>

                      {/* Username */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('account.username')}
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered focus:input-secondary transition-colors w-full"
                          placeholder={
                            user?.username || t('account.usernamePlaceholder')
                          }
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            {t('account.currentUsername', {
                              username: user?.username || t('account.notSet'),
                            })}
                          </span>
                        </label>
                      </div>

                      {/* Email */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('account.email')}
                          </span>
                          {user?.email && (
                            <span
                              className={`badge badge-sm ${
                                user.verified
                                  ? 'badge-success'
                                  : 'badge-warning'
                              }`}
                            >
                              {user.verified
                                ? t('account.verified')
                                : t('account.notVerified')}
                            </span>
                          )}
                        </label>
                        <input
                          ref={emailRef}
                          name="settings_email"
                          type="email"
                          autoComplete="off"
                          className="input input-bordered focus:input-secondary transition-colors w-full"
                          placeholder={t('account.emailPlaceholder')}
                          defaultValue={user?.email || ''}
                          onChange={(e) => {
                            const emailValue = e.target.value;
                            setIsEmailChanged(
                              emailValue !== (user?.email || '')
                            );
                          }}
                        />

                        {user?.email && !user.verified && (
                          <div className="mt-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                            <p className="text-sm text-warning mb-2">
                              📧 Verification email sent to your inbox. Check
                              your spam folder if needed.
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
                                  {t('account.sending')}
                                </>
                              ) : resendCooldown > 0 ? (
                                <>
                                  <Clock3 className="w-4 h-4" />
                                  Resend in {resendCooldown}s
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4" />
                                  {t('account.resendVerification')}
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {!user?.email && (
                          <label className="label">
                            <span className="label-text-alt text-base-content/60">
                              {t('account.recoveryHint')}
                            </span>
                          </label>
                        )}
                      </div>

                      <div className="divider text-xs text-base-content/40">
                        {t('account.changePasswordHeading')}
                      </div>

                      {/* New Password */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('account.newPassword')}
                          </span>
                        </label>
                        <input
                          ref={newPasswordRef}
                          type="password"
                          className="input input-bordered focus:input-secondary transition-colors w-full"
                          placeholder={t('account.newPasswordPlaceholder')}
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
                            {t('account.keepPasswordHint')}
                          </span>
                        </label>
                      </div>

                      {/* Confirm New Password */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('account.confirmPassword')}
                          </span>
                        </label>
                        <input
                          ref={newPasswordConfirmRef}
                          type="password"
                          className={`input input-bordered focus:input-secondary transition-colors w-full ${!passwordsMatch ? 'input-error' : ''}`}
                          placeholder={t('account.confirmPasswordPlaceholder')}
                          onChange={(e) => {
                            const confirmPwd = e.target.value;
                            const newPwd = newPasswordRef.current?.value || '';
                            setPasswordsMatch(!newPwd || newPwd === confirmPwd);
                          }}
                        />
                        {!passwordsMatch && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {t('account.passwordMismatch')}
                            </span>
                          </label>
                        )}
                      </div>

                      <div className="card-actions justify-end pt-4">
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          disabled={
                            isPending ||
                            !hasPassword ||
                            (!isEmailChanged &&
                              !hasNewPassword &&
                              username.trim() === (user?.username || '')) ||
                            (hasNewPassword && !passwordsMatch)
                          }
                        >
                          {isPending ? (
                            <>
                              <span className="loading loading-spinner loading-sm"></span>
                              {t('account.updating')}
                            </>
                          ) : (
                            <>
                              <KeyRound className="h-4 w-4" />
                              {t('account.update')}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="card bg-error/5 border border-error/20 shadow-sm">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-error/10 rounded-lg">
                        <TriangleAlert className="h-6 w-6 text-error" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-error">
                          {t('danger.title')}
                        </h2>
                        <p className="text-error/70 text-sm">
                          {t('danger.subtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="alert alert-error alert-soft mb-4">
                      <XCircle className="stroke-current shrink-0 h-6 w-6" />
                      <div>
                        <h3 className="font-bold">{t('danger.warning')}</h3>
                        <div className="text-xs">
                          {t('danger.irreversibleNote')}
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
                      <Trash2 className="h-5 w-5" />
                      {t('danger.clearAll')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PREFERENCES TAB ── */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-accent/10 rounded-lg">
                        <Settings2 className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('preferences.title')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('preferences.subtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <LanguagePicker />

                      <fieldset className="fieldset w-full p-0">
                        <legend className="fieldset-legend font-medium">
                          {t('preferences.theme')}
                        </legend>
                        <ThemeSwitcher />
                      </fieldset>

                      <fieldset className="fieldset w-full p-0">
                        <legend className="fieldset-legend font-medium gap-2">
                          {t('preferences.timezone')}
                          {isPreferencesPending && (
                            <span className="loading loading-spinner loading-sm"></span>
                          )}
                        </legend>
                        <TimezonePicker
                          value={timezone}
                          onChange={setTimezone}
                          disabled={isPending || isPreferencesPending}
                        />
                        <p className="label text-base-content/60 text-wrap">
                          {t('preferences.timezoneHint')}
                        </p>
                      </fieldset>

                      <div>
                        <label className="flex w-full cursor-pointer items-center justify-between gap-4">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-medium">
                              {t('preferences.blurAdult')}
                            </span>
                            <span className="text-sm text-base-content/60">
                              {t('preferences.blurAdultHint')}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
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

                      <div>
                        <label className="flex w-full cursor-pointer items-center justify-between gap-4">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-medium">
                              {t('preferences.hideUnmatched')}
                            </span>
                            <span className="text-sm text-base-content/60">
                              {t('preferences.hideUnmatchedHint')}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
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

                {/* Tags */}
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-accent/10 rounded-lg">
                        <Tag className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('tags.title')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('tags.subtitle')}
                        </p>
                      </div>
                    </div>
                    <TagManager />
                  </div>
                </div>
              </div>
            )}

            {/* ── PATREON TAB ── */}
            {activeTab === 'patreon' && (
              <div className="space-y-6">
                {/* Patreon connection */}
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Heart className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('patreon.title')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('patreon.subtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {patreonStatus.patreonId ? (
                        <div className="space-y-4">
                          {/* Connected Status */}
                          <div className="flex items-center justify-between p-4 bg-success/10 border border-success/20 rounded-lg">
                            <div className="flex items-center gap-3">
                              <HeartHandshake className="w-5 h-5 text-success" />
                              <div>
                                <div className="font-semibold text-success">
                                  {t('patreon.connected')}
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
                                  {t('patreon.freeTier')}
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
                                <Unlink2 className="h-4 w-4" />
                                {t('patreon.unlink')}
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
                                  <HeartHandshake className="size-5" />
                                  {t('patreon.connect')}
                                </>
                              )}
                            </button>
                            <a
                              href={`${import.meta.env.VITE_DOMAIN_URL}/support`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm gap-1"
                            >
                              <Info className="h-4 w-4" />
                              {t('patreon.benefits')}
                            </a>
                          </div>
                          <div className="text-xs text-center text-base-content/60">
                            <Lock className="h-4 w-4" />
                            {t('patreon.oauthNote')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Badge Text - Enthusiast+ Only */}
                {patreonStatus.patreonId &&
                  (patreonStatus.tier === 'enthusiast' ||
                    patreonStatus.tier === 'consumer') && (
                    <div className="card bg-base-100 shadow-sm border border-base-300/50">
                      <div className="card-body">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <Tag className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">
                              {t('patreon.customBadgeText')}
                            </h3>
                            <p className="text-base-content/70 text-sm">
                              {t('patreon.enthusiastOnly')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="input input-bordered focus:input-primary transition-colors flex-1"
                            placeholder={t('patreon.customTextPlaceholder')}
                            value={customBadgeText}
                            onChange={(e) =>
                              setCustomBadgeText(e.target.value.slice(0, 20))
                            }
                            maxLength={20}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => updateBadgeText(customBadgeText)}
                            disabled={isUpdatingBadge}
                          >
                            {isUpdatingBadge ? (
                              <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                {t('common.save')}
                              </>
                            )}
                          </button>
                        </div>
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            {customBadgeText.length}/20 · Leave empty to use
                            default tier name
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                {/* Badge Color Customization - Consumer Only */}
                <div className="card bg-base-100 shadow-sm border border-base-300/50 relative overflow-hidden">
                  {/* Lock Overlay for non-Consumer tiers */}
                  {!(
                    patreonStatus.isActive && patreonStatus.tier === 'consumer'
                  ) && (
                    <div className="absolute inset-0 bg-base-300/70 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                      <div className="text-center p-6">
                        <div className="p-4 bg-base-100/80 rounded-lg inline-block">
                          <Lock className="h-12 w-12 text-primary mx-auto mb-3" />
                          <h3 className="text-xl font-bold mb-2">
                            {t('patreon.consumerOnly')}
                          </h3>
                          {patreonStatus.patreonId ? (
                            <>
                              <p className="text-sm text-base-content/70 mb-4">
                                {t('patreon.becomeConsumer')}
                              </p>
                              <a
                                href="https://www.patreon.com/nihongotracker"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm gap-2"
                              >
                                <HeartHandshake className="w-4 h-4" />
                                {t('patreon.pledge')}
                              </a>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-base-content/70 mb-4">
                                {t('patreon.unlockBadgeColors')}
                              </p>
                              <button
                                className="btn btn-primary btn-sm gap-2"
                                onClick={handlePatreonOAuth}
                                disabled={isInitiatingOAuth}
                              >
                                <HeartHandshake className="size-5" />
                                {t('patreon.support')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Heart className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('patreon.badgeColors')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('patreon.badgeColorsSubtitle')}
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
                          <Heart className="inline-block w-4 h-4" />
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
                            {t('patreon.background')}
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
                          <span className="text-xs text-base-content/70">
                            {t('patreon.text')}
                          </span>
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
                            {t('profile.saving')}
                          </>
                        ) : (
                          <>
                            <Check className="h-5 w-5" />
                            {t('patreon.saveBadgeColors')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ADVANCED TAB ── */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                {/* Data Management */}
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-info/10 rounded-lg">
                        <CloudDownload className="h-6 w-6 text-info" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t('data.title')}
                        </h2>
                        <p className="text-base-content/70">
                          {t('data.subtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Import */}
                      <div>
                        <h3 className="font-semibold mb-3 text-base-content flex items-center gap-2">
                          <CloudUpload className="h-4 w-4 text-info" />
                          {t('data.importFrom')}
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
                                ? IMPORT_TYPE_LABELS[importType]
                                : t('data.chooseFormat')}
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
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
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
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
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
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
                                  }}
                                >
                                  VN Club Resurrection
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  className={`hover:bg-base-200 ${importType === 'kechimochi' ? 'active' : ''}`}
                                  onClick={() => {
                                    setImportType('kechimochi');
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
                                  }}
                                >
                                  Kechimochi
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  className={`hover:bg-base-200 ${importType === 'other' ? 'active' : ''}`}
                                  onClick={() => {
                                    setImportType('other');
                                    (
                                      document.activeElement as HTMLElement
                                    )?.blur();
                                  }}
                                >
                                  NihongoTracker | Other
                                </button>
                              </li>
                            </ul>
                          </div>
                          {(importType === 'other' ||
                            importType === 'kechimochi') && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm gap-1 text-info self-start"
                              onClick={() =>
                                (
                                  document.getElementById(
                                    importType === 'other'
                                      ? 'other_csv_help_modal'
                                      : 'kechimochi_csv_help_modal'
                                  ) as HTMLDialogElement
                                ).showModal()
                              }
                            >
                              <HelpCircle className="w-4 h-4" />
                              {importType === 'other'
                                ? t('data.csvFormatHelp')
                                : t('data.kechimochiHelp')}
                            </button>
                          )}
                          <button
                            type="submit"
                            className="btn btn-info w-full"
                            disabled={isImportPending}
                          >
                            {isImportPending ? (
                              <>
                                <span className="loading loading-spinner loading-sm"></span>
                                {t('data.importing')}
                              </>
                            ) : (
                              <>
                                <CloudUpload className="h-5 w-5" />
                                {t('data.import')}
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      <div className="divider"></div>

                      {/* Export */}
                      <div>
                        <h3 className="font-semibold mb-1 text-base-content flex items-center gap-2">
                          <Download className="h-4 w-4 text-success" />
                          {t('data.export')}
                        </h3>
                        <p className="text-base-content/70 text-sm mb-3">
                          {t('data.exportHint')}
                        </p>
                        <button
                          type="button"
                          className="btn btn-outline btn-success w-full"
                          disabled={isExportPending}
                          onClick={() => exportLogs()}
                        >
                          {isExportPending ? (
                            <>
                              <span className="loading loading-spinner loading-sm"></span>
                              {t('data.exporting')}
                            </>
                          ) : (
                            <>
                              <Download className="h-5 w-5" />
                              {t('data.exportCsv')}
                            </>
                          )}
                        </button>
                      </div>

                      <div className="divider"></div>

                      {/* API Keys */}
                      <div>
                        <h3 className="font-semibold mb-1 text-base-content flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          {t('apiKeys.title')}
                        </h3>
                        <p className="text-base-content/70 text-sm mb-3">
                          {t('apiKeys.intro')}{' '}
                          <a
                            href="/api/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-primary"
                          >
                            {t('apiKeys.docs')}
                          </a>{' '}
                          {t('apiKeys.introEnd')}
                        </p>

                        {/* New key creation */}
                        <div className="flex gap-2 mb-4">
                          <input
                            type="text"
                            className="input input-bordered focus:input-primary transition-colors flex-1"
                            placeholder={t('apiKeys.namePlaceholder')}
                            value={apiKeyName}
                            maxLength={100}
                            onChange={(e) => setApiKeyName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && apiKeyName.trim()) {
                                generateApiKey({ name: apiKeyName.trim() });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!apiKeyName.trim() || isGeneratingKey}
                            onClick={() =>
                              generateApiKey({ name: apiKeyName.trim() })
                            }
                          >
                            {isGeneratingKey ? (
                              <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            {t('apiKeys.generate')}
                          </button>
                        </div>

                        {/* Newly created key banner */}
                        {newlyCreatedKey && (
                          <div className="alert alert-success mb-4 max-w-full overflow-hidden">
                            <div className="w-full min-w-0 space-y-2">
                              <p className="font-semibold text-sm leading-snug">
                                Key created — copy it now, it won&apos;t be
                                shown again!
                              </p>

                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0">
                                <div className="min-w-0">
                                  <code className="block w-full text-xs bg-success-content/10 rounded px-2 py-2 overflow-x-auto whitespace-nowrap select-all">
                                    {newlyCreatedKey.key}
                                  </code>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost shrink-0"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(
                                      newlyCreatedKey.key
                                    );
                                    setCopiedKeyId('new');
                                    setTimeout(
                                      () => setCopiedKeyId(null),
                                      2000
                                    );
                                  }}
                                >
                                  {copiedKeyId === 'new' ? (
                                    <Check className="h-4 w-4 text-success" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => setNewlyCreatedKey(null)}
                                >
                                  {t('common.dismiss')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Existing keys list */}
                        {isLoadingApiKeys ? (
                          <div className="flex justify-center py-4">
                            <span className="loading loading-spinner loading-md"></span>
                          </div>
                        ) : apiKeys.length === 0 ? (
                          <p className="text-base-content/50 text-sm text-center py-4">
                            {t('apiKeys.empty')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {apiKeys.map((key) => (
                              <div
                                key={key._id}
                                className="flex items-center gap-3 p-3 rounded-lg bg-base-200 border border-base-300"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {key.name}
                                  </p>
                                  <p className="text-xs text-base-content/50 font-mono">
                                    {key.keyPrefix}••••••••
                                  </p>
                                  <p className="text-xs text-base-content/40 mt-0.5">
                                    Created{' '}
                                    {new Date(
                                      key.createdAt
                                    ).toLocaleDateString()}
                                    {key.lastUsedAt && (
                                      <>
                                        {' '}
                                        · Last used{' '}
                                        {new Date(
                                          key.lastUsedAt
                                        ).toLocaleDateString()}
                                      </>
                                    )}
                                    {key.expiresAt && (
                                      <>
                                        {' '}
                                        · Expires{' '}
                                        {new Date(
                                          key.expiresAt
                                        ).toLocaleDateString()}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost text-error hover:bg-error/10"
                                  disabled={isDeletingKey}
                                  onClick={() => deleteApiKey(key._id)}
                                  title={t('apiKeys.revoke')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="divider"></div>

                      {/* Sync External Data */}
                      <details
                        ref={advancedOptionsRef}
                        className="collapse collapse-arrow bg-base-200 border border-base-300"
                        onToggle={handleAdvancedOptionsToggle}
                      >
                        <summary className="collapse-title font-semibold text-base-content">
                          {t('advanced.title')}
                        </summary>
                        <div className="collapse-content space-y-6 pt-2">
                          {/* Discord ID */}
                          <form
                            onSubmit={handleUpdateDiscord}
                            className="space-y-4"
                          >
                            <h3 className="font-semibold text-base-content flex items-center gap-2">
                              {t('advanced.discordId')}
                            </h3>
                            <div className="form-control w-full">
                              <label className="label pt-0">
                                <span className="label-text">
                                  {t('advanced.discordId')}
                                </span>
                              </label>
                              <div className="relative w-full">
                                <input
                                  type="text"
                                  className="input input-bordered focus:input-primary transition-colors w-full pr-10"
                                  placeholder={t(
                                    'advanced.discordIdPlaceholder'
                                  )}
                                  value={discordId}
                                  onChange={(e) => setDiscordId(e.target.value)}
                                />
                                {discordId && (
                                  <button
                                    type="button"
                                    aria-label={t('advanced.clearDiscordId')}
                                    className="btn btn-ghost btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2 text-base-content/60 hover:text-error"
                                    onClick={() => setDiscordId('')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <label className="label flex-col items-start gap-1">
                                <span className="label-text-alt text-base-content/60 break-all">
                                  {user?.discordId
                                    ? `Current: ${user.discordId}`
                                    : null}
                                </span>
                                <span className="label-text-alt text-base-content/60">
                                  {t('advanced.unlinkHint')}
                                </span>
                              </label>
                            </div>
                            <div className="form-control w-full">
                              <label className="label">
                                <span className="label-text flex items-center gap-2">
                                  <Lock className="h-4 w-4 text-base-content/60" />
                                  {t('account.currentPassword')}
                                </span>
                                <span className="label-text-alt text-base-content/50">
                                  {t('advanced.requiredToSave')}
                                </span>
                              </label>
                              <input
                                ref={discordPasswordRef}
                                type="password"
                                autoComplete="new-password"
                                className="input input-bordered focus:input-primary transition-colors w-full"
                                placeholder={t('danger.passwordPlaceholder')}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={
                                  isPending ||
                                  discordId === (user?.discordId || '')
                                }
                              >
                                {isPending ? (
                                  <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    {t('advanced.saveDiscordId')}
                                  </>
                                )}
                              </button>
                            </div>
                          </form>

                          <div className="divider my-1"></div>

                          {/* Sync External Data */}
                          <div>
                            <h3 className="font-semibold mb-3 text-base-content">
                              {t('data.syncExternal')}
                            </h3>
                            <form onSubmit={handleSyncLogs}>
                              <button
                                type="submit"
                                className="btn btn-warning w-full"
                                disabled={isSyncPending}
                              >
                                {isSyncPending ? (
                                  <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    {t('data.syncing')}
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-5 w-5" />
                                    {t('data.syncLogs')}
                                  </>
                                )}
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>

                {/* Log Management */}
                <div className="card bg-base-100 shadow-sm border border-base-300/50">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-warning/10 rounded-lg">
                        <Link2 className="h-6 w-6 text-warning" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{t('logs.title')}</h2>
                        <p className="text-base-content/70 text-sm">
                          {t('logs.matchSubtitle')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="alert alert-info">
                        <Info className="stroke-current shrink-0 h-6 w-6" />
                        <div>
                          <h3 className="font-bold">{t('logs.matchMedia')}</h3>
                          <div className="text-xs">{t('logs.matchHint')}</div>
                        </div>
                      </div>

                      <button
                        className="btn btn-warning w-full"
                        onClick={() => navigate('/matchmedia')}
                      >
                        <Link2 className="h-5 w-5" />
                        {t('logs.goToMatch')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Insert Image Modal */}
      <dialog
        id="insert-image-modal"
        className={`modal ${isImageModalOpen ? 'modal-open' : ''}`}
        onClose={() => setIsImageModalOpen(false)}
      >
        <div className="modal-box space-y-4">
          <h3 className="font-bold text-lg">
            {t('markdown.insertImageTitle')}
          </h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">
              {t('markdown.imageUrl')}
            </legend>
            <input
              type="url"
              className="input input-bordered"
              placeholder={t('markdown.imageUrlPlaceholder')}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              ref={imageUrlInputRef}
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">{t('markdown.altText')}</legend>
            <input
              type="text"
              className="input input-bordered"
              placeholder={t('markdown.imageAltPlaceholder')}
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
            />
          </fieldset>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsImageModalOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!imageUrl.trim()) {
                  toast.error(t('toast.imageUrlRequired'));
                  return;
                }
                const url = imageUrl.trim();
                const alt = imageAlt.trim() || t('markdown.snippets.imageAlt');
                aboutEditorRef.current?.insertSnippet('![', `](${url})`, alt);
                setIsImageModalOpen(false);
              }}
            >
              {t('markdown.insert')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop cursor-default">
          <button className="cursor-default">close</button>
        </form>
      </dialog>

      {/* Background Color Picker Modal */}
      <dialog
        id="bg_color_modal"
        className="modal"
        onClose={handleBadgeColorModalClose}
      >
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">
            {t('patreon.badgeBackgroundColor')}
          </h3>

          {/* Theme Presets */}
          <div className="space-y-3 mb-4">
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeColor('primary')}
            >
              <div className="w-6 h-6 rounded bg-primary"></div>
              <span>{t('patreon.primary')}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeColor('secondary')}
            >
              <div className="w-6 h-6 rounded bg-secondary"></div>
              <span>{t('patreon.secondary')}</span>
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
              {t('common.done')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop cursor-default">
          <button className="cursor-default">close</button>
        </form>
      </dialog>

      {/* Text Color Picker Modal */}
      <dialog
        id="text_color_modal"
        className="modal"
        onClose={handleBadgeTextModalClose}
      >
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">
            {t('patreon.badgeTextColor')}
          </h3>

          {/* Theme Presets */}
          <div className="space-y-3 mb-4">
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeTextColor('primary-content')}
            >
              <div className="w-6 h-6 rounded bg-primary-content border border-base-300"></div>
              <span>{t('patreon.primaryText')}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline w-full justify-start"
              onClick={() => setPendingBadgeTextColor('secondary-content')}
            >
              <div className="w-6 h-6 rounded bg-secondary-content border border-base-300"></div>
              <span>{t('patreon.secondaryText')}</span>
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
              {t('common.done')}
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
          <h3 className="text-lg font-bold">
            {t('account.verificationSentTitle')}
          </h3>
          <div className="py-4">
            <p className="mb-3">
              {t('account.verificationSentBody')}{' '}
              <span className="font-semibold">{emailSentTo}</span>
            </p>
            <div className="alert alert-info">
              <Info className="h-6 w-6 shrink-0 stroke-current" />
              <span>{t('account.checkSpam')}</span>
            </div>
          </div>
          <div className="modal-action">
            <button
              className="btn btn-primary"
              onClick={() => setShowEmailSentModal(false)}
            >
              {t('account.gotIt')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setShowEmailSentModal(false)}>close</button>
        </form>
      </dialog>

      {/* Advanced Options Info Modal */}
      <dialog id="advanced_options_info_modal" className="modal">
        <div className="modal-box max-w-lg">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-info" />
              <h3 className="text-lg font-bold">{t('advanced.aboutTitle')}</h3>
            </div>
            <form method="dialog">
              <button
                className="btn btn-ghost btn-sm btn-circle"
                type="submit"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </form>
          </div>

          <div className="space-y-3 text-base-content/80">
            <p>{t('advanced.manabeNote')}</p>
            <p>{t('advanced.ignoreNote')}</p>
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button
                className="btn btn-ghost"
                type="submit"
                onClick={closeAdvancedOptions}
              >
                {t('advanced.decline')}
              </button>
            </form>
            <form method="dialog">
              <button className="btn btn-primary" type="submit">
                {t('advanced.confirm')}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop cursor-default">
          <button className="cursor-default">close</button>
        </form>
      </dialog>

      {/* Other CSV Help Modal */}
      <dialog id="other_csv_help_modal" className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold mb-4">{t('csvHelp.title')}</h3>
          <p className="text-base-content/70 mb-4">{t('csvHelp.headerNote')}</p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('csvHelp.field')}</th>
                  <th>{t('csvHelp.required')}</th>
                  <th>{t('csvHelp.description')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">date</code>
                  </td>
                  <td>
                    <span className="text-error font-semibold">
                      {t('csvHelp.yes')}
                    </span>
                  </td>
                  <td>
                    Date of the log (e.g.{' '}
                    <code className="text-xs">2025-01-15</code>)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">type</code>
                  </td>
                  <td>
                    <span className="text-error font-semibold">
                      {t('csvHelp.yes')}
                    </span>
                  </td>
                  <td>
                    Log type:{' '}
                    <code className="text-xs">
                      reading, anime, vn, video, manga, audio, movie, other, tv
                      show
                    </code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      mediaId
                    </code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.mediaId')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">time</code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.time')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      characters
                    </code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.chars')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      episodes
                    </code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.episodes')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">pages</code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.pages')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      description
                    </code>
                  </td>
                  <td>No</td>
                  <td>{t('csvHelp.descriptionField')}</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">tags</code>
                  </td>
                  <td>No</td>
                  <td>
                    Tag names separated by semicolons (e.g.{' '}
                    <code className="text-xs">tag1;tag2</code>)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-base-200 rounded-lg">
            <p className="text-sm font-semibold mb-1">{t('csvHelp.example')}</p>
            <code className="text-xs block whitespace-pre-wrap text-base-content/80">
              {`date,type,mediaId,time,characters,episodes,pages,description,tags\n2025-01-15,reading,,60,5000,,,My Novel,novels;fiction\n2025-01-16,anime,21,24,,2,,Anime Title,`}
            </code>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-primary">{t('account.gotIt')}</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Kechimochi CSV Help Modal */}
      <dialog id="kechimochi_csv_help_modal" className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold mb-4">
            {t('csvHelp.kechimochiTitle')}
          </h3>
          <div role="alert" className="alert alert-info alert-soft mb-4">
            <span>{t('csvHelp.kechimochiHint')}</span>
          </div>
          <div role="alert" className="alert alert-warning alert-soft mb-4">
            <span>{t('csvHelp.kechimochiOnlyActivity')}</span>
          </div>
          <div className="mt-3 p-3 bg-base-200 rounded-lg">
            <p className="text-sm font-semibold mb-2">
              {t('csvHelp.importedAsOther')}
            </p>
            <ul className="list-disc pl-5 text-sm text-base-content/80 space-y-1">
              <li>{t('csvHelp.noneOrUnknown')}</li>
              <li>{t('csvHelp.unrecognized')}</li>
            </ul>
          </div>
          <div className="mt-3 p-3 bg-base-200 rounded-lg">
            <p className="text-sm font-semibold mb-2">{t('csvHelp.notes')}</p>
            <ul className="list-disc pl-5 text-sm text-base-content/80 space-y-1">
              <li>{t('csvHelp.kechimochiWatching')}</li>
              <li>{t('csvHelp.readingListening')}</li>
            </ul>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-primary">{t('account.gotIt')}</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop cursor-default">
          <button className="cursor-default">close</button>
        </form>
      </dialog>
    </div>
  );
}

// ─── Profile Layout Editor ───────────────────────────────────────────────────
// Reorder + show/hide the widgets in the left column of your profile page.

type SortableWidgetRowProps = {
  id: string;
  label: string;
  description: string;
  visible: boolean;
  ownerOnly?: boolean;
  onToggle: () => void;
};

function SortableWidgetRow({
  id,
  label,
  description,
  visible,
  ownerOnly,
  onToggle,
}: SortableWidgetRowProps) {
  const { t } = useTranslation('settings');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-3 ${
        !visible ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-base-content/40 hover:text-base-content/70 active:cursor-grabbing"
        aria-label={t('layout.dragToReorder')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{label}</span>
          {ownerOnly && (
            <span className="badge badge-ghost badge-xs shrink-0">
              {t('layout.onlyYou')}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-base-content/60">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="btn btn-ghost btn-sm btn-square"
        title={visible ? t('profileWidgets.hide') : t('profileWidgets.show')}
        aria-label={
          visible ? t('profileWidgets.hide') : t('profileWidgets.show')
        }
      >
        {visible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-base-content/40" />
        )}
      </button>
    </div>
  );
}

function ProfileLayoutEditor() {
  const { t } = useTranslation('settings');
  const tSettings = t;
  const { user, setUser } = useUserDataStore();
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<ProfileWidgetLayout[]>(() =>
    resolveProfileLayout(user?.settings?.profileLayout)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { mutate: save, isPending } = useMutation({
    mutationFn: updateProfileLayoutFn,
    onSuccess: (data) => {
      if (user) {
        setUser({
          ...user,
          settings: {
            ...user.settings,
            profileLayout: data.profileLayout,
          },
        } as ILoginResponse);
      }
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'user',
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(
          t('toast.layoutSaveFailedDetail', {
            message: error.response?.data?.message ?? '',
          })
        );
      } else {
        toast.error(t('toast.layoutSaveFailed'));
      }
    },
  });

  const persist = (next: ProfileWidgetLayout[]) => {
    setLayout(next);
    save(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.findIndex((w) => w.id === active.id);
    const newIndex = layout.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persist(arrayMove(layout, oldIndex, newIndex));
  };

  const toggleVisibility = (id: string) => {
    persist(
      layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const resetDefault = () => {
    persist(PROFILE_WIDGETS.map((w) => ({ id: w.id, visible: true })));
  };

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300/50">
      <div className="card-body">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <LayoutList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t('layout.title')}</h2>
              <p className="text-base-content/70">{t('layout.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetDefault}
            className="btn btn-ghost btn-sm gap-1"
            disabled={isPending}
            title={t('layout.resetTitle')}
          >
            <RotateCcw className="h-4 w-4" />
            {t('common.reset')}
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={layout.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {layout.map((w) => {
                const meta = PROFILE_WIDGET_META[w.id];
                if (!meta) return null;
                return (
                  <SortableWidgetRow
                    key={w.id}
                    id={w.id}
                    label={tSettings(meta.labelKey)}
                    description={tSettings(meta.descriptionKey)}
                    visible={w.visible}
                    ownerOnly={meta.ownerOnly}
                    onToggle={() => toggleVisibility(w.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <p className="mt-3 text-xs text-base-content/50">
          {t('layout.autosaveNote')}
        </p>
      </div>
    </div>
  );
}

export default SettingsScreen;
