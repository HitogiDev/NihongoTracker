import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearUserDataFn,
  importFromCSV,
  importLogsFn,
  updateUserFn,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { ILoginResponse } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import ThemeSwitcher from '../components/ThemeSwitcher';
import TimezonePicker from '../components/TimezonePicker';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import { canvasPreview } from '../utils/canvasPreview';

function SettingsScreen() {
  const { setUser, user } = useUserDataStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [discordId, setDiscordId] = useState(user?.discordId || '');
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
  const [avatarCrop, setAvatarCrop] = useState<Crop>();
  const [bannerCrop, setBannerCrop] = useState<Crop>();
  const [completedAvatarCrop, setCompletedAvatarCrop] = useState<PixelCrop>();
  const [completedBannerCrop, setCompletedBannerCrop] = useState<PixelCrop>();
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);

  // Add these new state variables for cropped files
  const [croppedAvatarFile, setCroppedAvatarFile] = useState<File | null>(null);
  const [croppedBannerFile, setCroppedBannerFile] = useState<File | null>(null);

  const avatarImgRef = useRef<HTMLImageElement>(null);
  const bannerImgRef = useRef<HTMLImageElement>(null);
  const avatarPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const bannerPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  const queryClient = useQueryClient();

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data: ILoginResponse) => {
      toast.success('User updated');
      setUser(data);
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
  const timezoneTimeoutRef = useRef<NodeJS.Timeout>();
  const blurAdultTimeoutRef = useRef<NodeJS.Timeout>();
  const hideUnmatchedTimeoutRef = useRef<NodeJS.Timeout>();

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
      // Also invalidate daily goals as stats changes affect goal progress
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

  const { mutate: importCSVLogs, isPending: isImportPending } = useMutation({
    mutationFn: importFromCSV,
    onSuccess: (data) => {
      toast.success(data.message);
      void queryClient.invalidateQueries({
        predicate: (query) => {
          return ['logs', 'user', 'ImmersionList', 'userStats'].includes(
            query.queryKey[0] as string
          );
        },
      });
      // Also invalidate daily goals as stats changes affect goal progress
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
      void queryClient.invalidateQueries({
        predicate: (query) => {
          return ['logs', 'user', 'ImmersionList', 'userStats'].includes(
            query.queryKey[0] as string
          );
        },
      });
      // Also invalidate daily goals as stats changes affect goal progress
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

  async function handleSyncLogs(e: React.FormEvent) {
    e.preventDefault();
    syncLogs();
  }

  async function handleImportCSV(e: React.FormEvent) {
    e.preventDefault();
    const csvFileInput = document.getElementById('csv') as HTMLInputElement;
    if (!csvFileInput.files || csvFileInput.files.length === 0) {
      toast.error('Please select a CSV file');
      return;
    }
    const csvFile = csvFileInput.files[0];
    const formData = new FormData();
    formData.append('csv', csvFile);
    importCSVLogs(formData);
  }

  async function handleClearData() {
    (document.getElementById('clear_data_modal') as HTMLDialogElement).close();
    clearData();
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();

    // Only append fields that have values to avoid sending empty strings
    if (username.trim()) formData.append('username', username);
    if (password.trim()) formData.append('password', password);
    if (newPassword.trim()) formData.append('newPassword', newPassword);
    if (newPasswordConfirm.trim())
      formData.append('newPasswordConfirm', newPasswordConfirm);

    // Always append discordId (even if empty to allow clearing)
    formData.append('discordId', discordId);

    // Note: Preferences (blurAdultContent, hideUnmatchedLogsAlert, timezone)
    // are now auto-saved and don't need to be included in manual updates

    // Use cropped files if available, otherwise fall back to original files
    if (croppedAvatarFile) {
      formData.append('avatar', croppedAvatarFile);
    } else {
      const avatarInput = document.getElementById('avatar') as HTMLInputElement;
      if (avatarInput.files && avatarInput.files.length > 0) {
        formData.append('avatar', avatarInput.files[0]);
      }
    }

    if (croppedBannerFile) {
      formData.append('banner', croppedBannerFile);
    } else {
      const bannerInput = document.getElementById('banner') as HTMLInputElement;
      if (bannerInput.files && bannerInput.files.length > 0) {
        formData.append('banner', bannerInput.files[0]);
      }
    }

    updateUser(formData);
  }

  async function handleAvatarCropComplete() {
    if (
      completedAvatarCrop?.width &&
      completedAvatarCrop?.height &&
      avatarImgRef.current &&
      avatarPreviewCanvasRef.current
    ) {
      await canvasPreview(
        avatarImgRef.current,
        avatarPreviewCanvasRef.current,
        completedAvatarCrop
      );
      avatarPreviewCanvasRef.current.classList.remove('hidden');

      // Convert canvas to blob and create a File
      avatarPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], 'avatar.jpg', {
              type: 'image/jpeg',
            });
            setCroppedAvatarFile(croppedFile);
          }
        },
        'image/jpeg',
        0.9
      );

      setShowAvatarCrop(false);
    }
  }

  async function handleBannerCropComplete() {
    if (
      completedBannerCrop?.width &&
      completedBannerCrop?.height &&
      bannerImgRef.current &&
      bannerPreviewCanvasRef.current
    ) {
      await canvasPreview(
        bannerImgRef.current,
        bannerPreviewCanvasRef.current,
        completedBannerCrop
      );
      bannerPreviewCanvasRef.current.classList.remove('hidden');

      // Convert canvas to blob and create a File
      bannerPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], 'banner.jpg', {
              type: 'image/jpeg',
            });
            setCroppedBannerFile(croppedFile);
          }
        },
        'image/jpeg',
        0.9
      );

      setShowBannerCrop(false);
    }
  }

  async function onSelectAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      // Clear any previous cropped file
      setCroppedAvatarFile(null);

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setAvatarSrc(reader.result?.toString() || '');
        setShowAvatarCrop(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  async function onSelectBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      // Clear any previous cropped file
      setCroppedBannerFile(null);

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setBannerSrc(reader.result?.toString() || '');
        setShowBannerCrop(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function onAvatarImageLoad() {
    setAvatarCrop({
      unit: '%',
      width: 90,
      height: 90,
      x: 5,
      y: 5,
    });
  }

  function onBannerImageLoad() {
    if (bannerImgRef.current) {
      const { naturalWidth, naturalHeight } = bannerImgRef.current;

      // Calculate the maximum crop size that fits in the image with 21:9 aspect ratio
      const targetAspectRatio = 21 / 9; // ~2.33
      const imageAspectRatio = naturalWidth / naturalHeight;

      let cropWidthPercent, cropHeightPercent;

      if (imageAspectRatio > targetAspectRatio) {
        // Image is wider than 21:9, constrain by height
        // Use 80% of height, then calculate width to maintain aspect ratio
        cropHeightPercent = 80;
        cropWidthPercent =
          (cropHeightPercent * targetAspectRatio * naturalHeight) /
          naturalWidth;

        // If the calculated width exceeds 100%, constrain by width instead
        if (cropWidthPercent > 95) {
          cropWidthPercent = 80;
          cropHeightPercent =
            (cropWidthPercent * naturalWidth) /
            (targetAspectRatio * naturalHeight);
        }
      } else {
        // Image is narrower than 21:9, constrain by width
        // Use 80% of width, then calculate height to maintain aspect ratio
        cropWidthPercent = 80;
        cropHeightPercent =
          (cropWidthPercent * naturalWidth) /
          (targetAspectRatio * naturalHeight);

        // If the calculated height exceeds 100%, constrain by height instead
        if (cropHeightPercent > 95) {
          cropHeightPercent = 80;
          cropWidthPercent =
            (cropHeightPercent * targetAspectRatio * naturalHeight) /
            naturalWidth;
        }
      }

      // Center the crop
      const cropX = (100 - cropWidthPercent) / 2;
      const cropY = (100 - cropHeightPercent) / 2;

      setBannerCrop({
        unit: '%',
        width: cropWidthPercent,
        height: cropHeightPercent,
        x: cropX,
        y: cropY,
      });
    }
  }

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
            This will permanently delete all your logs and statistics. This
            action cannot be undone.
          </p>

          <div className="modal-action">
            <button
              className="btn btn-error"
              onClick={handleClearData}
              disabled={isClearDataPending}
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
              <button className="btn btn-outline">Cancel</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {showAvatarCrop && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Crop Avatar</h3>
            <div className="flex justify-center">
              <ReactCrop
                crop={avatarCrop}
                onChange={(_, percentCrop) => setAvatarCrop(percentCrop)}
                onComplete={(c) => setCompletedAvatarCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={avatarImgRef}
                  alt="Crop avatar"
                  src={avatarSrc}
                  onLoad={onAvatarImageLoad}
                  className="max-h-96"
                />
              </ReactCrop>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={handleAvatarCropComplete}
                disabled={
                  !completedAvatarCrop?.width || !completedAvatarCrop?.height
                }
              >
                Apply Crop
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowAvatarCrop(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </dialog>
      )}

      {showBannerCrop && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">Crop Banner</h3>
            <div className="flex justify-center">
              <ReactCrop
                crop={bannerCrop}
                onChange={(_, percentCrop) => setBannerCrop(percentCrop)}
                onComplete={(c) => setCompletedBannerCrop(c)}
                aspect={21 / 9}
                minWidth={105}
                minHeight={45} // 105 * (9/21) = 45
                keepSelection
                ruleOfThirds
              >
                <img
                  ref={bannerImgRef}
                  alt="Crop banner"
                  src={bannerSrc}
                  onLoad={onBannerImageLoad}
                  className="max-h-96"
                />
              </ReactCrop>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={handleBannerCropComplete}
                disabled={
                  !completedBannerCrop?.width || !completedBannerCrop?.height
                }
              >
                Apply Crop
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowBannerCrop(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </dialog>
      )}

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
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">Username</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered focus:input-primary transition-colors"
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

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Discord ID
                        </span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered focus:input-primary transition-colors"
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
                  </div>

                  <div className="space-y-6">
                    <div className="divider">
                      <span className="text-base-content/70 font-medium">
                        Media & Appearance
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Avatar</span>
                        </label>
                        <input
                          type="file"
                          id="avatar"
                          className="file-input file-input-bordered file-input-primary"
                          accept="image/*"
                          onChange={onSelectAvatarFile}
                        />
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            Recommended: Square image, max 2MB
                          </span>
                        </label>
                        <canvas
                          ref={avatarPreviewCanvasRef}
                          className="rounded-lg border-2 border-base-300 mt-4 hidden shadow-sm"
                          style={{
                            objectFit: 'contain',
                            width: 120,
                            height: 120,
                          }}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">Banner</span>
                        </label>
                        <input
                          type="file"
                          id="banner"
                          className="file-input file-input-bordered file-input-primary"
                          accept="image/*"
                          onChange={onSelectBannerFile}
                        />
                        <label className="label">
                          <span className="label-text-alt text-base-content/60">
                            Recommended: 21:9 aspect ratio, max 3MB
                          </span>
                        </label>
                        <canvas
                          ref={bannerPreviewCanvasRef}
                          className="rounded-lg border-2 border-base-300 mt-4 hidden shadow-sm"
                          style={{
                            objectFit: 'contain',
                            width: '100%',
                            maxHeight: 150,
                          }}
                        />
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
                        Current Password
                      </span>
                    </label>
                    <input
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Enter current password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                        New Password
                      </span>
                    </label>
                    <input
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Choose a strong password
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
                      type="password"
                      className="input input-bordered focus:input-secondary transition-colors w-full"
                      placeholder="Confirm new password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Must match the new password above
                      </span>
                    </label>
                  </div>

                  <div className="card-actions justify-end pt-4">
                    <button
                      type="submit"
                      className="btn btn-secondary btn-lg"
                      disabled={
                        isPending ||
                        !password ||
                        !newPassword ||
                        !newPasswordConfirm
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
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
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
                      Import from CSV
                    </h3>
                    <form onSubmit={handleImportCSV} className="space-y-3">
                      <input
                        type="file"
                        id="csv"
                        className="file-input file-input-bordered file-input-info w-full"
                        accept=".csv"
                      />
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
                            Import CSV
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
    </div>
  );
}

export default SettingsScreen;
