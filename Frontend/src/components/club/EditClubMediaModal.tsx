import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { MdClose, MdCalendarToday, MdSave } from 'react-icons/md';
import { DayPicker } from 'react-day-picker';
import { editClubMediaFn } from '../../api/clubApi';
import { IClub, IClubMedia } from '../../types.d';

interface EditClubMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: IClub;
  media: IClubMedia | null;
}

interface EditMediaData {
  title: string;
  description: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

export default function EditClubMediaModal({
  isOpen,
  onClose,
  club,
  media,
}: EditClubMediaModalProps) {
  const [mediaData, setMediaData] = useState<EditMediaData>({
    title: '',
    description: '',
    startDate: undefined,
    endDate: undefined,
  });

  const queryClient = useQueryClient();

  // Initialize form data when media changes
  useEffect(() => {
    if (media) {
      setMediaData({
        title: media.title,
        description: media.description || '',
        startDate: new Date(media.startDate),
        endDate: new Date(media.endDate),
      });
    }
  }, [media]);

  const editMediaMutation = useMutation({
    mutationFn: (data: EditMediaData) => {
      if (!media?._id) throw new Error('Media ID is required');

      return editClubMediaFn(club._id, media._id, {
        title: data.title,
        description: data.description,
        startDate: data.startDate!.toISOString(),
        endDate: data.endDate!.toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Media updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['clubMedia', club._id] });
      onClose();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to update media';
      toast.error(message);
    },
  });

  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const validateForm = () => {
    const { title, startDate, endDate } = mediaData;

    if (!title.trim()) {
      toast.error('Title is required');
      return false;
    }

    if (!startDate || !endDate) {
      toast.error('Both start and end dates are required');
      return false;
    }

    if (startDate >= endDate) {
      toast.error('End date must be after start date');
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    editMediaMutation.mutate(mediaData);
  };

  if (!isOpen || !media) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl">Edit Club Media</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            disabled={editMediaMutation.isPending}
          >
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text">Title *</span>
              </label>
              <input
                type="text"
                placeholder="Media title"
                value={mediaData.title}
                onChange={(e) =>
                  setMediaData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                placeholder="Optional description..."
                value={mediaData.description}
                onChange={(e) =>
                  setMediaData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="textarea textarea-bordered w-full"
                rows={3}
              />
            </div>

            {/* Consumption Period */}
            <div>
              <label className="label">
                <span className="label-text">Consumption Start *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      mediaData.startDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(mediaData.startDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={mediaData.startDate}
                    onSelect={(date) => {
                      setMediaData((prev) => ({
                        ...prev,
                        startDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                      // Reset end date if it's before the new start date
                      if (
                        mediaData.endDate &&
                        date &&
                        mediaData.endDate < date
                      ) {
                        setMediaData((prev) => ({
                          ...prev,
                          endDate: undefined,
                        }));
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Set to start of today
                      return date < today;
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Consumption End *</span>
              </label>
              <div className="dropdown dropdown-top dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="input input-bordered w-full flex items-center justify-between cursor-pointer"
                >
                  <span
                    className={
                      mediaData.endDate
                        ? 'text-base-content'
                        : 'text-base-content/50'
                    }
                  >
                    {formatDateForDisplay(mediaData.endDate)}
                  </span>
                  <MdCalendarToday className="text-lg" />
                </div>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                >
                  <DayPicker
                    className="react-day-picker mx-auto"
                    mode="single"
                    selected={mediaData.endDate}
                    onSelect={(date) => {
                      setMediaData((prev) => ({
                        ...prev,
                        endDate: date,
                      }));
                      // Close dropdown by removing focus
                      (document.activeElement as HTMLElement)?.blur?.();
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Set to start of today

                      if (!mediaData.startDate) {
                        return date < today;
                      }

                      // End date must be after start date AND not before today
                      return date < mediaData.startDate || date < today;
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action">
            <button
              onClick={onClose}
              className="btn btn-ghost"
              disabled={editMediaMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={editMediaMutation.isPending}
            >
              <MdSave className="w-4 h-4" />
              {editMediaMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
}
