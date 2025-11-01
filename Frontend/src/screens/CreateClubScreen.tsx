import React, { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { Crop } from 'react-image-crop';
import { canvasPreview } from '../utils/canvasPreview';
import ImageCropDialog, {
  ImageCropResult,
} from '../components/ImageCropDialog';
import {
  MdAdd,
  MdArrowBack,
  MdGroup,
  MdInfo,
  MdLock,
  MdPublic,
  MdRemove,
  MdImage,
  MdWarning,
  MdUpload,
  MdDelete,
} from 'react-icons/md';
import { createClubFn } from '../api/clubApi';
import { ICreateClubRequest } from '../types';

function CreateClubScreen() {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState<ICreateClubRequest>({
    name: '',
    description: '',
    isPublic: true,
    tags: [],
    rules: '',
    memberLimit: 50,
  });

  // Media state (will be handled separately during form submission)
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');

  // Cropping state
  const [avatarSrc, setAvatarSrc] = useState<string>('');
  const [bannerSrc, setBannerSrc] = useState<string>('');
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);

  // Refs for cropping
  const avatarPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const bannerPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentTag, setCurrentTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Available predefined tags
  const predefinedTags = [
    'beginner',
    'intermediate',
    'advanced',
    'anime',
    'manga',
    'reading',
    'light-novel',
    'visual-novel',
    'competitive',
    'casual',
    'daily-challenge',
  ];

  // Create club mutation
  const createClubMutation = useMutation({
    mutationFn: createClubFn,
    onSuccess: (data) => {
      toast.success('Club created successfully!');
      navigate(`/clubs/${data._id}`);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || 'Failed to create club');
    },
  });

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Club name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Club name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (formData.rules && formData.rules.length > 1000) {
      newErrors.rules = 'Rules must be 1000 characters or less';
    }

    if (
      formData.memberLimit &&
      (formData.memberLimit < 2 || formData.memberLimit > 500)
    ) {
      newErrors.memberLimit = 'Member limit must be between 2 and 500';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submissionData = {
      ...formData,
      avatarFile: avatarFile || undefined,
      bannerFile: bannerFile || undefined,
    };

    createClubMutation.mutate(submissionData);
  };

  // Handle input changes
  const handleInputChange = (
    field: keyof ICreateClubRequest,
    value: string | number | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Add tag
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    const currentTags = formData.tags || [];
    if (
      trimmedTag &&
      !currentTags.includes(trimmedTag) &&
      currentTags.length < 10
    ) {
      handleInputChange('tags', [...currentTags, trimmedTag]);
      setCurrentTag('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    const currentTags = formData.tags || [];
    handleInputChange(
      'tags',
      currentTags.filter((tag) => tag !== tagToRemove)
    );
  };

  // Handle file changes for avatar and banner (now with cropping)
  const handleFileChange = (
    type: 'avatar' | 'banner',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Basic validation - only accept images under 3MB
      if (!file.type.startsWith('image/')) {
        toast.error(
          `${type === 'avatar' ? 'Club icon' : 'Banner'} must be an image file`
        );
        return;
      }

      if (file.size > 3 * 1024 * 1024) {
        toast.error(
          `${type === 'avatar' ? 'Club icon' : 'Banner'} must be under 3MB`
        );
        return;
      }

      // Read file and show cropping interface
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (type === 'avatar') {
          setAvatarSrc(reader.result?.toString() || '');
          setShowAvatarCrop(true);
        } else {
          setBannerSrc(reader.result?.toString() || '');
          setShowBannerCrop(true);
        }
      });
      reader.readAsDataURL(file);
    }
  };

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
      cropHeightPercent = 85;
      cropWidthPercent =
        (cropHeightPercent * targetAspectRatio * naturalHeight) / naturalWidth;

      if (cropWidthPercent > 95) {
        cropWidthPercent = 85;
        cropHeightPercent =
          (cropWidthPercent * naturalWidth) /
          (targetAspectRatio * naturalHeight);
      }
    } else {
      cropWidthPercent = 85;
      cropHeightPercent =
        (cropWidthPercent * naturalWidth) / (targetAspectRatio * naturalHeight);

      if (cropHeightPercent > 95) {
        cropHeightPercent = 85;
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

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }

      await canvasPreview(image, avatarPreviewCanvasRef.current, crop);

      avatarPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], 'avatar.jpg', {
              type: 'image/jpeg',
            });
            setAvatarFile(croppedFile);
            setAvatarPreview(URL.createObjectURL(croppedFile));
          }
        },
        'image/jpeg',
        0.9
      );
    },
    [avatarPreview]
  );

  const handleBannerCropApply = useCallback(
    async ({ crop, image }: ImageCropResult) => {
      if (!bannerPreviewCanvasRef.current) {
        return;
      }

      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }

      await canvasPreview(image, bannerPreviewCanvasRef.current, crop);

      bannerPreviewCanvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], 'banner.jpg', {
              type: 'image/jpeg',
            });
            setBannerFile(croppedFile);
            setBannerPreview(URL.createObjectURL(croppedFile));
          }
        },
        'image/jpeg',
        0.9
      );
    },
    [bannerPreview]
  );

  // Cancel cropping
  const cancelCropping = (type: 'avatar' | 'banner') => {
    if (type === 'avatar') {
      setShowAvatarCrop(false);
      setAvatarSrc('');
    } else {
      setShowBannerCrop(false);
      setBannerSrc('');
    }
  };

  // Clear file selection
  const clearFile = (type: 'avatar' | 'banner') => {
    if (type === 'avatar') {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarFile(null);
      setAvatarPreview('');
    } else {
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }
      setBannerFile(null);
      setBannerPreview('');
    }
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [avatarPreview, bannerPreview]);

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 pt-24 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <button
              className="btn btn-ghost btn-circle"
              onClick={() => navigate('/clubs')}
            >
              <MdArrowBack className="text-xl" />
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-base-content">
                Create New Club
              </h1>
              <p className="text-base-content/70 mt-2">
                Start your own immersion community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information Card */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4 flex items-center gap-2">
                  <MdInfo className="text-primary" />
                  Basic Information
                </h2>

                {/* Club Name */}
                <div className="form-control">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend font-medium">
                      Club Name<span className="text-error">*</span>
                    </legend>
                    <input
                      type="text"
                      className={`input input-bordered ${errors.name ? 'input-error' : ''}`}
                      placeholder="Enter your club name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange('name', e.target.value)
                      }
                      maxLength={100}
                    />
                    <span className="label text-base-content/60">
                      {formData.name.length}/100 characters
                    </span>
                  </fieldset>
                  {errors.name && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.name}
                      </span>
                    </label>
                  )}
                </div>

                {/* Description */}
                <div className="form-control">
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend font-medium">
                      Description
                    </legend>
                    <textarea
                      className={`textarea textarea-bordered h-24 ${errors.description ? 'textarea-error' : ''}`}
                      placeholder="Tell others what your club is about..."
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange('description', e.target.value)
                      }
                      maxLength={500}
                    />
                    <span className="label text-base-content/60">
                      {formData.description?.length || 0}/500 characters
                    </span>
                  </fieldset>
                  {errors.description && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.description}
                      </span>
                    </label>
                  )}
                </div>

                {/* Privacy Settings */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Privacy</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="label cursor-pointer flex-1 bg-base-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <MdPublic className="text-xl text-success" />
                        <div>
                          <span className="label-text font-medium">Public</span>
                          <div className="text-xs text-base-content/60">
                            Anyone can join immediately
                          </div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="privacy"
                        className="radio radio-success"
                        checked={formData.isPublic === true}
                        onChange={() => handleInputChange('isPublic', true)}
                      />
                    </label>

                    <label className="label cursor-pointer flex-1 bg-base-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <MdLock className="text-xl text-warning" />
                        <div>
                          <span className="label-text font-medium">
                            Private
                          </span>
                          <div className="text-xs text-base-content/60">
                            Requires approval to join
                          </div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="privacy"
                        className="radio radio-warning"
                        checked={formData.isPublic === false}
                        onChange={() => handleInputChange('isPublic', false)}
                      />
                    </label>
                  </div>
                </div>

                {/* Member Limit */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Member Limit</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <MdGroup className="text-xl text-base-content/60" />
                    <input
                      type="number"
                      className={`input input-bordered flex-1 ${errors.memberLimit ? 'input-error' : ''}`}
                      placeholder="50"
                      min={2}
                      max={500}
                      value={formData.memberLimit}
                      onChange={(e) =>
                        handleInputChange(
                          'memberLimit',
                          parseInt(e.target.value) || 50
                        )
                      }
                    />
                    <span className="text-sm text-base-content/60">
                      members max
                    </span>
                  </div>
                  {errors.memberLimit && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.memberLimit}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Tags Card */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4">Tags</h2>
                <p className="text-sm text-base-content/60 mb-4">
                  Add tags to help others find your club. You can add up to 10
                  tags.
                </p>

                {/* Add Tag Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    placeholder="Add a tag..."
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(currentTag);
                      }
                    }}
                    maxLength={30}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => addTag(currentTag)}
                    disabled={
                      !currentTag.trim() || (formData.tags?.length || 0) >= 10
                    }
                  >
                    <MdAdd className="text-lg" />
                  </button>
                </div>

                {/* Current Tags */}
                {(formData.tags?.length || 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Your tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags?.map((tag) => (
                        <div key={tag} className="badge badge-primary gap-2">
                          {tag}
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-circle"
                            onClick={() => removeTag(tag)}
                          >
                            <MdRemove className="text-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Predefined Tags */}
                <div>
                  <p className="text-sm font-medium mb-2">Suggested tags:</p>
                  <div className="flex flex-wrap gap-2">
                    {predefinedTags
                      .filter((tag) => !(formData.tags?.includes(tag) || false))
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="badge badge-outline cursor-pointer hover:bg-primary hover:text-primary-content"
                          onClick={() => addTag(tag)}
                          disabled={(formData.tags?.length || 0) >= 10}
                        >
                          {tag}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Club Media Card */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4 flex items-center gap-2">
                  <MdImage className="text-primary" />
                  Club Media
                </h2>
                <p className="text-sm text-base-content/60 mb-4">
                  Upload a profile picture and banner for your club (optional).
                  Images must be appropriate and non-offensive.
                </p>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* Club Profile Picture */}
                  <div className="flex-1">
                    <label className="label font-medium">
                      <span className="label-text">Club Icon</span>
                    </label>
                    <div className="flex flex-col items-center gap-3 p-4 border border-dashed rounded-lg bg-base-200">
                      <div className="avatar">
                        <div className="w-24 h-24 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
                          {avatarPreview ? (
                            <img
                              src={avatarPreview}
                              alt="Club icon preview"
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <MdGroup className="text-4xl text-base-content/40" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <label className="btn btn-sm btn-primary">
                          <MdUpload />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange('avatar', e)}
                          />
                        </label>
                        {avatarPreview && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => clearFile('avatar')}
                          >
                            <MdDelete />
                            Remove
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-base-content/60">
                        Max size: 3MB
                      </span>
                    </div>
                  </div>

                  {/* Club Banner */}
                  <div className="flex-1">
                    <label className="label font-medium">
                      <span className="label-text">Club Banner</span>
                    </label>
                    <div className="flex flex-col items-center gap-3 p-4 border border-dashed rounded-lg bg-base-200">
                      <div className="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center overflow-hidden">
                        {bannerPreview ? (
                          <img
                            src={bannerPreview}
                            alt="Banner preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <MdImage className="text-4xl text-base-content/40" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <label className="btn btn-sm btn-primary">
                          <MdUpload />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange('banner', e)}
                          />
                        </label>
                        {bannerPreview && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => clearFile('banner')}
                          >
                            <MdDelete />
                            Remove
                          </button>
                        )}
                      </div>
                      <span className="text-xs text-base-content/60">
                        Recommended size: 1200x400px, Max size: 3MB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rules Card */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4 flex items-center gap-2">
                  <MdInfo className="text-primary" />
                  Club Rules
                </h2>
                <p className="text-sm text-base-content/60 mb-4">
                  Set clear guidelines for your club members (optional).
                </p>

                <div className="alert alert-warning mb-4 text-sm">
                  <MdWarning className="text-lg" />
                  <span>
                    <strong>Important:</strong> Club names, profile pictures,
                    and banners must not contain offensive content. Violation of
                    this rule may result in account suspension or club removal.
                  </span>
                </div>

                <div className="form-control">
                  <fieldset className="fieldset">
                    <textarea
                      className={`textarea textarea-bordered h-32 ${errors.rules ? 'textarea-error' : ''}`}
                      placeholder={`1. Be respectful to all members
2. Share your progress regularly
3. Help others when possible
4. Keep content appropriate
5. No offensive, discriminatory, or explicit content allowed`}
                      value={formData.rules}
                      onChange={(e) =>
                        handleInputChange('rules', e.target.value)
                      }
                      maxLength={1000}
                      style={{ whiteSpace: 'pre-line' }}
                    />
                    <span className="label text-base-content/60">
                      {formData.rules?.length || 0}/1000 characters
                    </span>
                  </fieldset>
                  {errors.rules && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {errors.rules}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/clubs')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={createClubMutation.isPending}
              >
                {createClubMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <MdGroup className="text-lg" />
                )}
                Create Club
              </button>
            </div>
          </form>
        </div>
      </div>

      <ImageCropDialog
        title="Crop Club Icon"
        imageSrc={avatarSrc}
        isOpen={showAvatarCrop}
        aspect={1}
        circular
        onClose={() => cancelCropping('avatar')}
        onApply={handleAvatarCropApply}
        getInitialCrop={getDefaultAvatarCrop}
      />

      <ImageCropDialog
        title="Crop Club Banner"
        imageSrc={bannerSrc}
        isOpen={showBannerCrop}
        aspect={21 / 9}
        minWidth={200}
        minHeight={86}
        keepSelection
        ruleOfThirds
        onClose={() => cancelCropping('banner')}
        onApply={handleBannerCropApply}
        getInitialCrop={getInitialBannerCrop}
      />

      {/* Hidden canvases for preview */}
      <canvas ref={avatarPreviewCanvasRef} className="hidden" />
      <canvas ref={bannerPreviewCanvasRef} className="hidden" />
    </div>
  );
}

export default CreateClubScreen;
