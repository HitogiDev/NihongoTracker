import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
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
  type IApiKey,
  type ICreatedApiKey,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { ILoginResponse } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
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
} from 'lucide-react';

const ABOUT_MAX_LENGTH = 2000;
const DEFAULT_BADGE_COLOR = '#ff69b4';
const DEFAULT_BADGE_TEXT_COLOR = '#ffffff';
const PRESET_BADGE_BACKGROUNDS = ['primary', 'secondary', 'rainbow'] as const;
const PRESET_BADGE_TEXT_COLORS = [
  'primary-content',
  'secondary-content',
] as const;
const IMPORT_TYPE_LABELS: Record<'tmw' | 'manabe' | 'vncr' | 'other', string> =
  {
    tmw: 'TheMoeWay (.csv)',
    manabe: 'Manabe (.tsv)',
    vncr: 'VN-CSV (.csv)',
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
};

export type AboutEditorHandle = {
  insertSnippet: (prefix: string, suffix: string, placeholder: string) => void;
  getTextarea: () => HTMLTextAreaElement | null;
  needsLineBreak: () => boolean;
};

const AboutEditor = forwardRef<AboutEditorHandle, AboutEditorProps>(
  function AboutEditor(
    { aboutRef, maxLength, onSelectionChange, initialValue, onSave, isSaving },
    ref
  ) {
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
          toast.error('About Me text is at the maximum length.');
          return;
        }

        setValue(newValue);
        aboutRef.current = newValue;
        setLength(newValue.length);

        // Set cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.focus();
          const startPos = selectionStart + prefix.length;
          const endPos = startPos + selectedText.length;
          textarea.setSelectionRange(startPos, endPos);
        });
      },
      [value, maxLength, aboutRef]
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
          className="textarea textarea-bordered focus:textarea-primary transition-colors w-full min-h-32"
          placeholder="Share a bit about your immersion journey (Markdown supported)"
          value={value}
          maxLength={maxLength}
          ref={textareaRef}
          onChange={(e) => {
            const newValue = e.target.value;
            setValue(newValue);
            aboutRef.current = newValue;
            setIsDirty(newValue !== (initialValue || ''));
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
                'Save About'
              )}
            </button>
          </div>
        )}
      </>
    );
  }
);

function SettingsScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useUserDataStore();
  const detectedTimezone = getUserTimezone();
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
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const [avatarOriginalFileName, setAvatarOriginalFileName] = useState<
    string | null
  >(null);
  const [bannerOriginalFileName, setBannerOriginalFileName] = useState<
    string | null
  >(null);
  const [importType, setImportType] = useState<
    'tmw' | 'manabe' | 'vncr' | 'other' | null
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

  useEffect(() => {
    if (isImageModalOpen) {
      requestAnimationFrame(() => {
        imageUrlInputRef.current?.focus();
      });
    }
  }, [isImageModalOpen]);

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
      aboutRef.current = data.about || '';
      // AboutEditor will sync automatically via useEffect
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

  // Mutation for saving just the about section
  const { mutate: saveAbout, isPending: isSavingAbout } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data: ILoginResponse) => {
      toast.success('About updated');
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
        toast.error(error.message ? error.message : 'An error occurred');
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
    aboutRef.current = user?.about || '';
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
      toast.success('Data exported successfully!');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message || 'Export failed');
      } else {
        toast.error('Failed to export data');
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
        toast.error(error.response?.data.message || 'Failed to create API key');
      } else {
        toast.error('Failed to create API key');
      }
    },
  });

  const { mutate: deleteApiKey, isPending: isDeletingKey } = useMutation({
    mutationFn: deleteApiKeyFn,
    onSuccess: () => {
      toast.success('API key revoked');
      fetchApiKeys();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message || 'Failed to revoke API key');
      } else {
        toast.error('Failed to revoke API key');
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

  // Fetch Patreon status and API keys on mount
  useEffect(() => {
    fetchPatreonStatus();
    fetchApiKeys();

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
  }, [fetchApiKeys]);

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
      toast.error('Please select a file');
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

  const insertHeading = useCallback((level: 1 | 2 | 3) => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const hashes = '#'.repeat(level);
    const prefix = `${editor.needsLineBreak() ? '\n' : ''}${hashes} `;
    editor.insertSnippet(prefix, '', `Heading ${level}`);
  }, []);

  const insertListItem = useCallback((ordered: boolean) => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const bullet = ordered ? '1. ' : '- ';
    const prefix = `${editor.needsLineBreak() ? '\n' : ''}${bullet}`;
    editor.insertSnippet(prefix, '', 'List item');
  }, []);

  const insertQuote = useCallback(() => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const prefix = `${editor.needsLineBreak() ? '\n' : ''}> `;
    editor.insertSnippet(prefix, '', 'Quote text');
  }, []);

  const insertCodeBlock = useCallback(() => {
    const editor = aboutEditorRef.current;
    if (!editor) return;
    const lineBreak = editor.needsLineBreak() ? '\n' : '';
    const prefix = `${lineBreak}\`\`\`\n`;
    editor.insertSnippet(prefix, '\n```\n', 'code sample');
  }, []);

  const insertBold = useCallback(() => {
    aboutEditorRef.current?.insertSnippet('**', '**', 'bold text');
  }, []);

  const insertItalic = useCallback(() => {
    aboutEditorRef.current?.insertSnippet('*', '*', 'italic text');
  }, []);

  const insertInlineCode = useCallback(() => {
    aboutEditorRef.current?.insertSnippet('`', '`', 'code');
  }, []);

  const insertLink = useCallback(() => {
    aboutEditorRef.current?.insertSnippet(
      '[',
      '](https://example.com)',
      'link text'
    );
  }, []);

  const insertSpoiler = useCallback(() => {
    aboutEditorRef.current?.insertSnippet('||', '||', 'spoiler text');
  }, []);

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

    formData.append('discordId', discordId);

    const storedAbout = user?.about ?? '';
    if (aboutRef.current !== storedAbout) {
      formData.append('about', aboutRef.current);
    }

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

  const badgeHexInputValue = (() => {
    if (pendingBadgeColor !== null) {
      return isPresetBackground(pendingBadgeColor) ? '' : pendingBadgeColor;
    }
    return isPresetBackground(badgeColor) ? '' : badgeColor;
  })();

  const badgeInputBackgroundColor = (() => {
    const candidate =
      pendingBadgeColor !== null ? pendingBadgeColor : badgeColor;
    if (!candidate || isPresetBackground(candidate)) {
      return undefined;
    }
    return sanitizeHex(candidate) ?? undefined;
  })();

  const badgeInputTextColor = (() => {
    return getContrastColor(badgeInputBackgroundColor ?? null);
  })();

  const badgeWheelColor = (() => {
    const candidate =
      pendingBadgeColor !== null ? pendingBadgeColor : badgeColor;
    if (!candidate || isPresetBackground(candidate)) {
      return '#ff69b4';
    }
    return sanitizeHex(candidate) ?? '#ff69b4';
  })();

  const badgeTextHexInputValue = (() => {
    if (pendingBadgeTextColor !== null) {
      return isPresetTextColor(pendingBadgeTextColor)
        ? ''
        : pendingBadgeTextColor;
    }
    return isPresetTextColor(badgeTextColor) ? '' : badgeTextColor;
  })();

  const badgeTextInputBackgroundColor = (() => {
    const candidate =
      pendingBadgeTextColor !== null ? pendingBadgeTextColor : badgeTextColor;
    if (!candidate || isPresetTextColor(candidate)) {
      return undefined;
    }
    return sanitizeHex(candidate) ?? undefined;
  })();

  const badgeTextInputTextColor = (() => {
    return getContrastColor(badgeTextInputBackgroundColor ?? null);
  })();

  const badgeTextWheelColor = (() => {
    const candidate =
      pendingBadgeTextColor !== null ? pendingBadgeTextColor : badgeTextColor;
    if (!candidate || isPresetTextColor(candidate)) {
      return '#ffffff';
    }
    return sanitizeHex(candidate) ?? '#ffffff';
  })();

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
            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <UserRound className="h-6 w-6 text-primary" />
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

                    <div className="form-control md:col-span-2">
                      <label className="label">
                        <span className="label-text font-medium">About Me</span>
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => insertHeading(1)}
                          title="Heading 1"
                          aria-label="Insert heading level 1"
                        >
                          <Heading1 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => insertHeading(2)}
                          title="Heading 2"
                          aria-label="Insert heading level 2"
                        >
                          <Heading2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => insertHeading(3)}
                          title="Heading 3"
                          aria-label="Insert heading level 3"
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
                          title="Bold"
                          aria-label="Insert bold text"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={insertItalic}
                          title="Italic"
                          aria-label="Insert italic text"
                        >
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={insertInlineCode}
                          title="Inline code"
                          aria-label="Insert inline code"
                        >
                          <Type className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={insertCodeBlock}
                          title="Code block"
                          aria-label="Insert code block"
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
                          title="Bulleted list"
                          aria-label="Insert bulleted list"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => insertListItem(true)}
                          title="Numbered list"
                          aria-label="Insert numbered list"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={insertQuote}
                          title="Quote"
                          aria-label="Insert quote"
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
                          title="Link"
                          aria-label="Insert link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={insertSpoiler}
                          title="Spoiler"
                          aria-label="Insert spoiler"
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
                          title="Image"
                          aria-label="Insert image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <AboutEditor
                        ref={aboutEditorRef}
                        aboutRef={aboutRef}
                        maxLength={ABOUT_MAX_LENGTH}
                        initialValue={user?.about || ''}
                        onSave={handleSaveAbout}
                        isSaving={isSavingAbout}
                      />
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
                              <HeartHandshake className="w-5 h-5 text-success" />
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
                                <Unlink2 className="h-4 w-4" />
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
                                  <HeartHandshake className="size-5" />
                                  Connect with Patreon
                                </>
                              )}
                            </button>
                            <a
                              href={`${import.meta.env.VITE_DOMAIN_URL}/pricing`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm gap-1"
                            >
                              <Info className="h-4 w-4" />
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
                                        <Check className="h-4 w-4" />
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
                          <Check className="h-5 w-5" />
                          Update Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Tag Management Section */}
            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Tag className="h-6 w-6 text-accent" />
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

            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-secondary" />
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
                      name="settings_email"
                      type="email"
                      autoComplete="off"
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
                              <Clock3 className="w-4 h-4" />
                              Resend in {resendCooldown}s
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4" />
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
                      name="settings_current_password"
                      type="password"
                      autoComplete="new-password"
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
                          <KeyRound className="h-5 w-5" />
                          Update Security Settings
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Badge Customization Card - Always visible, locked for non-Consumer */}
            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body relative">
                {/* Lock Overlay for non-Consumer tiers */}
                {!(
                  patreonStatus.isActive && patreonStatus.tier === 'consumer'
                ) && (
                  <div className="absolute inset-0 bg-base-300/70 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="p-4 bg-base-100/80 rounded-lg inline-block">
                        <Lock className="h-12 w-12 text-primary mx-auto mb-3" />
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
                              <HeartHandshake className="w-4 h-4" />
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
                              <HeartHandshake className="size-5" />
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
                    <Heart className="h-6 w-6 text-primary" />
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
                        <Check className="h-5 w-5" />
                        Save Badge Colors
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Settings2 className="h-6 w-6 text-accent" />
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

            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-info/10 rounded-lg">
                    <CloudDownload className="h-6 w-6 text-info" />
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
                            ? IMPORT_TYPE_LABELS[importType]
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
                                (document.activeElement as HTMLElement)?.blur();
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
                                (document.activeElement as HTMLElement)?.blur();
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
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                            >
                              VN Club Resurrection
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={`hover:bg-base-200 ${importType === 'other' ? 'active' : ''}`}
                              onClick={() => {
                                setImportType('other');
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                            >
                              NihongoTracker | Other
                            </button>
                          </li>
                        </ul>
                      </div>
                      {importType === 'other' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm gap-1 text-info self-start"
                          onClick={() =>
                            (
                              document.getElementById(
                                'other_csv_help_modal'
                              ) as HTMLDialogElement
                            ).showModal()
                          }
                        >
                          <HelpCircle className="w-4 h-4" />
                          CSV Format Help
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
                            Importing...
                          </>
                        ) : (
                          <>
                            <CloudUpload className="h-5 w-5" />
                            Import File
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-base-content">
                      Export Data
                    </h3>
                    <p className="text-base-content/70 text-sm mb-3">
                      Download all your logs as a CSV file that can be
                      re-imported later.
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
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-5 w-5" />
                          Export as CSV
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-1 text-base-content flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API Keys
                    </h3>
                    <p className="text-base-content/70 text-sm mb-3">
                      Generate API keys to interact with the NihongoTracker API
                      programmatically. Use the{' '}
                      <a
                        href="/api/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary"
                      >
                        API documentation
                      </a>{' '}
                      to explore available endpoints.
                    </p>

                    {/* New key creation */}
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        className="input input-bordered focus:input-primary transition-colors flex-1"
                        placeholder="Key name (e.g. My Script)"
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
                        Generate
                      </button>
                    </div>

                    {/* Newly created key banner */}
                    {newlyCreatedKey && (
                      <div className="alert alert-success mb-4 max-w-full overflow-hidden">
                        <div className="w-full min-w-0 space-y-2">
                          <p className="font-semibold text-sm leading-snug">
                            Key created — copy it now, it won&apos;t be shown
                            again!
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
                                setTimeout(() => setCopiedKeyId(null), 2000);
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
                              Dismiss
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
                        No API keys yet.
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
                                {new Date(key.createdAt).toLocaleDateString()}
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
                              title="Revoke key"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="divider"></div>

                  <details
                    ref={advancedOptionsRef}
                    className="collapse collapse-arrow bg-base-200 border border-base-300"
                    onToggle={handleAdvancedOptionsToggle}
                  >
                    <summary className="collapse-title font-semibold text-base-content">
                      Advanced Options
                    </summary>
                    <div className="collapse-content space-y-4">
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text font-medium">
                            Discord ID
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered focus:input-primary transition-colors w-full"
                          placeholder="Discord ID (e.g., 123456789012345678)"
                          value={discordId}
                          onChange={(e) => setDiscordId(e.target.value)}
                        />
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            {user?.discordId
                              ? `Current: ${user.discordId}`
                              : null}
                          </span>
                        </label>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3 text-base-content">
                          Sync External Data
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
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-5 w-5" />
                                Sync Logs
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

            <div className="card bg-base-100 shadow-sm border border-base-300/50">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <Link2 className="h-6 w-6 text-warning" />
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
                    <Info className="stroke-current shrink-0 h-6 w-6" />
                    <div>
                      <h3 className="font-bold">Match Media</h3>
                      <div className="text-xs">
                        Link your untracked logs to the correct media type.
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-warning w-full"
                    onClick={() => navigate('/matchmedia')}
                  >
                    <Link2 className="h-5 w-5" />
                    Go to Match Media
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-error/5 border border-error/20 shadow-sm">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-error/10 rounded-lg">
                    <TriangleAlert className="h-6 w-6 text-error" />
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

                <div className="alert alert-error alert-soft mb-4">
                  <XCircle className="stroke-current shrink-0 h-6 w-6" />
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
                  <Trash2 className="h-5 w-5" />
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insert Image Modal */}
      <dialog
        id="insert-image-modal"
        className={`modal ${isImageModalOpen ? 'modal-open' : ''}`}
        onClose={() => setIsImageModalOpen(false)}
      >
        <div className="modal-box space-y-4">
          <h3 className="font-bold text-lg">Insert Image</h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Image URL</legend>
            <input
              type="url"
              className="input input-bordered"
              placeholder="https://example.com/image.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              ref={imageUrlInputRef}
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Alt text</legend>
            <input
              type="text"
              className="input input-bordered"
              placeholder="Describe the image"
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
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!imageUrl.trim()) {
                  toast.error('Please provide an image URL');
                  return;
                }
                const url = imageUrl.trim();
                const alt = imageAlt.trim() || 'Image';
                aboutEditorRef.current?.insertSnippet('![', `](${url})`, alt);
                setIsImageModalOpen(false);
              }}
            >
              Insert
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

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
              <Info className="h-6 w-6 shrink-0 stroke-current" />
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

      {/* Advanced Options Info Modal */}
      <dialog id="advanced_options_info_modal" className="modal">
        <div className="modal-box max-w-lg">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-info" />
              <h3 className="text-lg font-bold">About Advanced Options</h3>
            </div>
            <form method="dialog">
              <button
                className="btn btn-ghost btn-sm btn-circle"
                type="submit"
                aria-label="Close"
              >
                ✕
              </button>
            </form>
          </div>

          <div className="space-y-3 text-base-content/80">
            <p>
              This menu is only useful for members of the Manabe Discord server
              and users of Iniesta bot.
            </p>
            <p>
              If you do not know what that is, you can safely ignore this
              section.
            </p>
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button
                className="btn btn-ghost"
                type="submit"
                onClick={closeAdvancedOptions}
              >
                Okay, forget it
              </button>
            </form>
            <form method="dialog">
              <button className="btn btn-primary" type="submit">
                I know what I'm doing
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
          <h3 className="text-lg font-bold mb-4">Custom CSV Format</h3>
          <p className="text-base-content/70 mb-4">
            Your CSV file should have the following columns as headers in the
            first row:
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">date</code>
                  </td>
                  <td>
                    <span className="text-error font-semibold">Yes</span>
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
                    <span className="text-error font-semibold">Yes</span>
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
                  <td>AniList, VNDB or content ID for the media</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">time</code>
                  </td>
                  <td>No</td>
                  <td>Time spent in minutes</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      characters
                    </code>
                  </td>
                  <td>No</td>
                  <td>Number of characters read</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      episodes
                    </code>
                  </td>
                  <td>No</td>
                  <td>Number of episodes watched</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">pages</code>
                  </td>
                  <td>No</td>
                  <td>Number of pages read</td>
                </tr>
                <tr>
                  <td>
                    <code className="badge badge-neutral badge-sm">
                      description
                    </code>
                  </td>
                  <td>No</td>
                  <td>Description or title of the media</td>
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
            <p className="text-sm font-semibold mb-1">Example:</p>
            <code className="text-xs block whitespace-pre-wrap text-base-content/80">
              {`date,type,mediaId,time,characters,episodes,pages,description,tags\n2025-01-15,reading,,60,5000,,,My Novel,novels;fiction\n2025-01-16,anime,21,24,,2,,Anime Title,`}
            </code>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-primary">Got it!</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

export default SettingsScreen;
