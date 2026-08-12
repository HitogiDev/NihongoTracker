import { useState } from 'react';
import Field from '../ui/Field';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { X, Search, Plus, Image } from 'lucide-react';
import { addVotingCandidateFn } from '../../api/clubApi';
import useSearch from '../../hooks/useSearch';
import { IClub, IClubMediaVoting, IMediaDocument } from '../../types.d';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';

interface SuggestMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: IClub;
  voting: IClubMediaVoting;
}

export default function SuggestMediaModal({
  isOpen,
  onClose,
  club,
  voting,
}: SuggestMediaModalProps) {
  const { t } = useTranslation('clubs');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [customForm, setCustomForm] = useState({
    title: '',
    description: '',
    image: '',
  });

  // Use the search hook for media search
  const searchType = voting.mediaType === 'custom' ? 'anime' : voting.mediaType;
  const { data: searchResults, isLoading: isSearching } = useSearch(
    searchType,
    searchQuery,
    undefined,
    1,
    10
  );

  const queryClient = useQueryClient();
  const invalidateVotingQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ['club-votings', club._id, 'active'],
    });
    queryClient.invalidateQueries({
      queryKey: ['club-votings', club._id, 'inactive'],
    });
  };

  const suggestMediaMutation = useMutation({
    mutationFn: (candidateData: {
      mediaId: string;
      title: string;
      description?: string;
      image?: string;
    }) => addVotingCandidateFn(club._id, voting._id!, candidateData),
    onSuccess: () => {
      toast.success(t('toast.suggestionSent'));
      invalidateVotingQueries();
      handleClose();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      const message =
        error.response?.data?.message || 'Failed to submit suggestion';
      toast.error(message);
    },
  });

  const handleClose = () => {
    setSearchQuery('');
    setShowResults(false);
    setCustomForm({ title: '', description: '', image: '' });
    onClose();
  };

  const handleMediaSelect = (media: IMediaDocument) => {
    const candidateData = {
      mediaId: media.contentId,
      title:
        media.title.contentTitleNative ||
        media.title.contentTitleEnglish ||
        media.title.contentTitleRomaji ||
        '',
      description: media.description?.[0]?.description || '',
      image: media.contentImage || '',
      isAdult: media.isAdult || false,
    };

    suggestMediaMutation.mutate(candidateData);
  };

  function handleCustomSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customForm.title.trim()) {
      toast.error(t('toast.titleRequired'));
      return;
    }

    const candidateData = {
      mediaId: `custom_${Date.now()}`, // Generate a unique ID for custom media
      title: customForm.title,
      description: customForm.description || undefined,
      image: customForm.image || undefined,
    };

    suggestMediaMutation.mutate(candidateData);
  }

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'Unknown';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    return dateObj.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-bottom sm:modal-middle modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-xl">{t('suggest.title')}</h3>
            <p className="text-base-content/70 text-sm">
              Suggest media for "{voting.title}"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={suggestMediaMutation.isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voting Info */}
        <div className="card surface-muted p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">{t('suggest.mediaType')}</span>{' '}
              {voting.mediaType === 'custom'
                ? voting.customMediaType
                : voting.mediaType}
            </div>
            <div>
              <span className="font-medium">{t('suggest.closes')}</span>{' '}
              {formatDate(voting.suggestionEndDate)}
            </div>
            <div>
              <span className="font-medium">{t('suggest.current')}</span>{' '}
              {voting.candidates.length}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {voting.mediaType === 'custom' ? (
            /* Custom Media Form */
            <div className="space-y-6">
              <div className="alert alert-info">
                <div>
                  <h4 className="font-medium">{t('suggest.customTitle')}</h4>
                  <p className="text-sm mt-1">{t('suggest.customHint')}</p>
                </div>
              </div>

              <form onSubmit={handleCustomSubmit} className="space-y-4">
                <Field label={t('common.titleRequired')}>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder={t('suggest.titlePlaceholder')}
                    value={customForm.title}
                    onChange={(e) =>
                      setCustomForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field label={t('common.description')}>
                  <textarea
                    className="textarea w-full h-24"
                    placeholder={t('suggest.descriptionPlaceholder')}
                    value={customForm.description}
                    onChange={(e) =>
                      setCustomForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label={t('suggest.imageUrl')}>
                  <input
                    type="url"
                    className="input w-full"
                    placeholder={t('suggest.imageUrlPlaceholder')}
                    value={customForm.image}
                    onChange={(e) =>
                      setCustomForm((prev) => ({
                        ...prev,
                        image: e.target.value,
                      }))
                    }
                  />
                  {customForm.image && (
                    <div className="mt-2">
                      <img
                        src={customForm.image}
                        alt={t('common.previewAlt')}
                        className="w-24 h-32 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </Field>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn btn-ghost"
                    disabled={suggestMediaMutation.isPending}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      suggestMediaMutation.isPending || !customForm.title.trim()
                    }
                  >
                    {suggestMediaMutation.isPending ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        {t('suggest.submitting')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {t('suggest.submit')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Media Search */
            <div className="space-y-6">
              <div className="alert alert-info">
                <div>
                  <h4 className="font-medium">{t('suggest.searchTitle')}</h4>
                  <p className="text-sm mt-1">
                    Search for {voting.mediaType} and click to suggest it for
                    voting.
                  </p>
                </div>
              </div>

              {/* Search Input */}
              <Field label={t('suggest.searchLabel')} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type="text"
                    className="input w-full pl-10"
                    placeholder={`Search ${voting.mediaType}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                  />
                </div>
              </Field>

              {/* Search Results */}
              {showResults && searchQuery.trim() && (
                <div className="space-y-4">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="loading loading-spinner loading-lg"></span>
                      <span className="ml-2">{t('suggest.searching')}</span>
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {searchResults.map((media, index) => (
                        <div
                          key={media.contentId || index}
                          className="card surface cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleMediaSelect(media)}
                        >
                          <div className="card-body p-4">
                            <div className="flex gap-3">
                              {media.contentImage ? (
                                <img
                                  src={media.contentImage}
                                  alt={
                                    media.title.contentTitleNative ||
                                    media.title.contentTitleEnglish ||
                                    ''
                                  }
                                  className="w-16 h-20 object-cover rounded"
                                />
                              ) : (
                                <div className="w-16 h-20 bg-base-300 rounded flex items-center justify-center">
                                  <Image className="w-6 h-6 text-base-content/40" />
                                </div>
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {media.title.contentTitleNative ||
                                    media.title.contentTitleEnglish ||
                                    media.title.contentTitleRomaji}
                                </h4>
                                {media.description && media.description[0] && (
                                  <p className="text-xs text-base-content/70 mt-1 line-clamp-3">
                                    {media.description[0].description}
                                  </p>
                                )}
                                <div className="mt-2">
                                  <button
                                    className="btn btn-primary btn-xs"
                                    disabled={suggestMediaMutation.isPending}
                                  >
                                    <Plus className="w-3 h-3" />
                                    {t('suggest.suggestButton')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto text-base-content/20 mb-2" />
                      <p className="text-base-content/60">
                        {t('suggest.noResults')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose}></div>
    </div>
  );
}
