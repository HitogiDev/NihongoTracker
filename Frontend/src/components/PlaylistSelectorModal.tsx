import { useState, useCallback, useEffect, useRef } from 'react';
import { IPlaylistVideo, IPlaylistResult } from '../api/trackerApi';
import {
  Pencil,
  Check,
  X,
  Calendar,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

// ─── Per-video overrides ──────────────────────────────────────────────────────

export interface VideoOverride {
  description: string;
  /** duration in minutes */
  durationMinutes: number;
  date: Date;
  unknownDate: boolean;
}

export interface PlaylistVideoWithOverride {
  playlistVideo: IPlaylistVideo;
  selected: boolean;
  override: VideoOverride;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Custom Chevron component using Lucide icons
function DayPickerChevron({
  orientation,
}: {
  orientation?: 'left' | 'right' | 'up' | 'down';
  className?: string;
  size?: number;
  disabled?: boolean;
}) {
  const iconClass = 'w-4 h-4 text-base-content/60';
  if (orientation === 'left') return <ChevronLeft className={iconClass} />;
  if (orientation === 'right') return <ChevronRight className={iconClass} />;
  return <ChevronRight className={iconClass} />;
}

// ─── Inline per-video editor ──────────────────────────────────────────────────

interface VideoEditorProps {
  override: VideoOverride;
  onChange: (updated: VideoOverride) => void;
  onClose: () => void;
}

function VideoEditor({ override, onChange, onClose }: VideoEditorProps) {
  const [local, setLocal] = useState<VideoOverride>({ ...override });
  const [showCal, setShowCal] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showCal) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        calendarRef.current &&
        calendarButtonRef.current &&
        !calendarRef.current.contains(target) &&
        !calendarButtonRef.current.contains(target)
      ) {
        setShowCal(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showCal]);

  function save() {
    onChange(local);
    onClose();
  }

  return (
    <div className="bg-base-300 rounded-lg p-3 mt-2 space-y-3 border border-base-content/10">
      {/* Description */}
      <div className="form-control">
        <label className="label py-0">
          <span className="label-text text-xs font-medium">Description</span>
        </label>
        <input
          type="text"
          className="input input-sm input-bordered w-full"
          value={local.description}
          onChange={(e) =>
            setLocal((p) => ({ ...p, description: e.target.value }))
          }
        />
      </div>

      {/* Duration */}
      <div className="form-control">
        <label className="label py-0">
          <span className="label-text text-xs font-medium">
            Duration (minutes)
          </span>
        </label>
        <input
          type="number"
          min="0"
          className="input input-sm input-bordered w-28"
          value={local.durationMinutes || ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, durationMinutes: Number(e.target.value) }))
          }
        />
      </div>

      {/* Date */}
      <div className="form-control">
        <label className="label py-0">
          <span className="label-text text-xs font-medium">Date</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={local.unknownDate}
              onChange={(e) =>
                setLocal((p) => ({ ...p, unknownDate: e.target.checked }))
              }
            />
            <span className="text-xs">Unknown date</span>
          </label>
          {!local.unknownDate && (
            <button
              ref={calendarButtonRef}
              type="button"
              className="btn btn-xs btn-outline gap-1"
              onClick={() => setShowCal((v) => !v)}
            >
              <Calendar className="w-3 h-3" />
              {local.date.toLocaleDateString()}
            </button>
          )}
        </div>
        {showCal && !local.unknownDate && (
          <div
            ref={calendarRef}
            className="mt-1 rounded-xl border border-base-content/10 bg-base-100 p-2 shadow-xl z-50 inline-block"
          >
            <DayPicker
              className="rdp-themed"
              components={{ Chevron: DayPickerChevron }}
              mode="single"
              selected={local.date}
              onSelect={(d) => {
                if (d) {
                  setLocal((p) => ({ ...p, date: d }));
                  setShowCal(false);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Save / cancel */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={onClose}
        >
          Cancel
        </button>
        <button type="button" className="btn btn-xs btn-primary" onClick={save}>
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface PlaylistSelectorModalProps {
  isOpen: boolean;
  isFetching?: boolean;
  playlistResult: IPlaylistResult | null;
  onClose: () => void;
  /** Called with the list of selected videos plus their per-video overrides */
  onConfirm: (selected: PlaylistVideoWithOverride[]) => void;
  isSubmitting?: boolean;
}

export default function PlaylistSelectorModal({
  isOpen,
  isFetching,
  playlistResult,
  onClose,
  onConfirm,
  isSubmitting = false,
}: PlaylistSelectorModalProps) {
  const [rows, setRows] = useState<PlaylistVideoWithOverride[]>([]);
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const [showGlobalCal, setShowGlobalCal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const globalCalendarRef = useRef<HTMLDivElement>(null);
  const globalCalendarButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showGlobalCal) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        globalCalendarRef.current &&
        globalCalendarButtonRef.current &&
        !globalCalendarRef.current.contains(target) &&
        !globalCalendarButtonRef.current.contains(target)
      ) {
        setShowGlobalCal(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showGlobalCal]);

  // Build initial rows when playlist data arrives
  useEffect(() => {
    if (!playlistResult) {
      setRows([]);
      return;
    }
    const today = new Date();
    setGlobalDate(today);
    setRows(
      playlistResult.videos.map((pv) => ({
        playlistVideo: pv,
        selected: true,
        override: {
          description: pv.video.title.contentTitleNative,
          durationMinutes: pv.video.episodeDuration ?? 0,
          date: new Date(),
          unknownDate: false,
        },
      }))
    );
    setEditingIndex(null);
  }, [playlistResult]);

  // When global date changes, propagate to rows that haven't been individually edited
  // We track this simply: if a row's date equals the previous globalDate, update it
  const handleGlobalDateChange = useCallback(
    (newDate: Date) => {
      setGlobalDate(newDate);
      setShowGlobalCal(false);
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          override: {
            ...row.override,
            // Only push global date if the row still matches the old global date
            date:
              row.override.date.toDateString() === globalDate.toDateString()
                ? newDate
                : row.override.date,
          },
        }))
      );
    },
    [globalDate]
  );

  const toggleAll = useCallback(() => {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }, [rows]);

  const toggleRow = useCallback((idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  }, []);

  const handleOverrideChange = useCallback(
    (idx: number, updated: VideoOverride) => {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, override: updated } : r))
      );
    },
    []
  );

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  if (!isOpen) return null;

  return (
    <dialog
      className="modal modal-open"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box w-11/12 max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-base-content/10 gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">
              {isFetching
                ? 'Fetching playlist…'
                : playlistResult
                  ? playlistResult.playlistTitle
                  : 'YouTube Playlist'}
            </h2>
            {!isFetching && playlistResult && (
              <p className="text-sm text-base-content/60 mt-0.5">
                {playlistResult.videos.length} video
                {playlistResult.videos.length !== 1 ? 's' : ''} •{' '}
                {selectedCount} selected
              </p>
            )}
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {isFetching && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 gap-4">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/60 text-sm">
              Loading playlist videos…
            </p>
          </div>
        )}

        {/* Content */}
        {!isFetching && playlistResult && (
          <>
            {/* Truncation warning */}
            {playlistResult.truncated && (
              <div className="alert alert-warning rounded-none border-x-0 border-t-0 py-2 px-5">
                <span className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Playlist has more than 200 videos. Only the first 200 are
                  shown.
                </span>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-base-content/10 flex-shrink-0 flex-wrap">
              {/* Select all toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-md checkbox-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-base font-medium">
                  {allSelected ? 'Deselect all' : 'Select all'}
                </span>
              </label>

              <div className="flex-1" />

              {/* Global date */}
              <div className="flex items-center gap-2 relative">
                <span className="text-sm text-base-content/60">
                  Date for all:
                </span>
                <button
                  ref={globalCalendarButtonRef}
                  type="button"
                  className="btn btn-sm btn-outline gap-1"
                  onClick={() => setShowGlobalCal((v) => !v)}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {globalDate.toLocaleDateString()}
                </button>
                {showGlobalCal && (
                  <div
                    ref={globalCalendarRef}
                    className="absolute top-full right-0 mt-1 rounded-xl border border-base-content/10 bg-base-100 p-2 shadow-xl z-50"
                  >
                    <DayPicker
                      className="rdp-themed"
                      components={{ Chevron: DayPickerChevron }}
                      mode="single"
                      selected={globalDate}
                      onSelect={(d) => d && handleGlobalDateChange(d)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Video list */}
            <div className="overflow-y-auto flex-1 divide-y divide-base-content/8">
              {rows.map((row, idx) => {
                const { playlistVideo, selected, override } = row;
                const isEditing = editingIndex === idx;
                const durationLabel = formatMinutes(override.durationMinutes);
                const dateLabel = override.unknownDate
                  ? 'Unknown date'
                  : override.date.toLocaleDateString();

                return (
                  <div
                    key={playlistVideo.video.contentId}
                    className={`px-5 py-4 transition-colors ${
                      selected ? 'bg-base-100' : 'bg-base-200/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-md"
                          checked={selected}
                          onChange={() => toggleRow(idx)}
                        />
                      </div>

                      {/* Thumbnail */}
                      {playlistVideo.video.contentImage ? (
                        <img
                          src={playlistVideo.video.contentImage}
                          alt=""
                          className="w-28 h-16 object-cover rounded flex-shrink-0 bg-base-300"
                        />
                      ) : (
                        <div className="w-28 h-16 rounded flex-shrink-0 bg-base-300 flex items-center justify-center">
                          <span className="text-base-content/30 text-xs">
                            No img
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium leading-snug line-clamp-2">
                          {override.description}
                        </p>
                        <p className="text-sm text-base-content/50 mt-0.5">
                          {playlistVideo.channel.title.contentTitleNative}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-base-content/60 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {durationLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {dateLabel}
                          </span>
                        </div>
                      </div>

                      {/* Edit button */}
                      <button
                        type="button"
                        className={`btn btn-sm btn-ghost btn-circle flex-shrink-0 mt-0.5 ${
                          isEditing ? 'btn-active' : ''
                        }`}
                        title="Edit duration, description, date"
                        onClick={() => setEditingIndex(isEditing ? null : idx)}
                      >
                        {isEditing ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <Pencil className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Inline editor */}
                    {isEditing && (
                      <VideoEditor
                        override={override}
                        onChange={(updated) =>
                          handleOverrideChange(idx, updated)
                        }
                        onClose={() => setEditingIndex(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t border-base-content/10 flex-shrink-0">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                disabled={selectedCount === 0 || isSubmitting}
                onClick={() => onConfirm(rows.filter((r) => r.selected))}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Logging…
                  </>
                ) : (
                  `Log ${selectedCount} video${selectedCount !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </>
        )}

        {/* Empty / error state */}
        {!isFetching && !playlistResult && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3 text-base-content/50">
            <p className="text-sm">No playlist data available.</p>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
