import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DayPicker } from 'react-day-picker';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Book,
  BookOpen,
  Calendar,
  ChevronDown,
  Check,
  Clapperboard,
  Clock3,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Gauge,
  GripVertical,
  Headphones,
  Hash,
  Layers,
  LineChart,
  Pencil,
  PieChart as PieChartIcon,
  Scale,
  Star,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getUserStatsFn,
  getUserFn,
  updateStatsLayoutFn,
  getGanttDataFn,
} from '../api/trackerApi';
import PieChart from '../components/PieChart';
import ProgressChart from '../components/ProgressChart';
import SpeedChart from '../components/SpeedChart';
import StackedBarChart from '../components/StackedBarChart';
import GanttChart from '../components/GanttChart';
import TagFilter from '../components/TagFilter';
import { getMediaTypeColor } from '../constants/mediaColors';
import { useTimezone } from '../hooks/useTimezone';
import {
  OutletProfileContextType,
  StatsGroupId,
  StatsGroupLayout,
} from '../types';
import { numberWithCommas } from '../utils/utils';
import { useUserDataStore } from '../store/userData';

const CATEGORY_OPTIONS = [
  { id: 'overview', label: 'Overview', Icon: Gauge },
  { id: 'charts', label: 'Charts', Icon: LineChart },
  { id: 'timeline', label: 'Timeline', Icon: BarChart3 },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]['id'];

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'total' | 'custom';

type GanttSortOption =
  | 'title-asc'
  | 'title-desc'
  | 'first-asc'
  | 'last-desc'
  | 'logs-desc'
  | 'time-desc'
  | 'xp-desc';

type ReadingType = 'reading' | 'manga' | 'vn' | 'game';
type EpisodeType = 'anime' | 'video' | 'movie';

const READING_TYPES: ReadonlyArray<ReadingType> = [
  'reading',
  'manga',
  'vn',
  'game',
];
const EPISODE_TYPES: ReadonlyArray<EpisodeType> = ['anime', 'video', 'movie'];
const LOG_TYPES = [
  'reading',
  'anime',
  'vn',
  'game',
  'video',
  'manga',
  'audio',
  'movie',
  'tv show',
  'other',
];

const CATEGORY_LABELS: Record<TimeRange, string> = {
  total: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  custom: 'Custom Range',
};

const PERIOD_LABELS: Record<TimeRange, string> = {
  total: 'All time',
  today: "Today's",
  week: "This week's",
  month: "This month's",
  year: "This year's",
  custom: 'Custom',
};

function capitalizeType(value: string) {
  if (value === 'vn') return 'Visual Novel';
  if (value === 'game') return 'Video Game';
  if (value === 'tv show') return 'TV Show';
  if (value === 'all') return 'All Types';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateForQuery(date?: Date) {
  if (!date) return '';
  const isoString = date.toISOString();
  return isoString.slice(0, 10);
}

function formatDisplayDate(date?: Date) {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function buildPieDataset(
  entries: Array<{ type: string; label: string; value: number }>
) {
  const sortedEntries = [...entries].sort((a, b) => b.value - a.value);
  const values = sortedEntries.map((entry) => entry.value);
  const labels = sortedEntries.map((entry) => entry.label);
  const colors = sortedEntries.map((entry) => getMediaTypeColor(entry.type));

  return {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
      },
    ],
  };
}

// ─── Default grouped layout ───────────────────────────────────────────────────
const DEFAULT_GROUPS_LAYOUT: StatsGroupLayout[] = [
  {
    id: 'totals',
    visible: true,
    cards: [
      { id: 'totalXp', visible: true },
      { id: 'timeSpent', visible: true },
      { id: 'logCount', visible: true },
      { id: 'dailyAverage', visible: true },
    ],
  },
  {
    id: 'streaks',
    visible: true,
    cards: [
      { id: 'currentStreak', visible: true },
      { id: 'longestStreak', visible: true },
    ],
  },
  {
    id: 'timeBreakdown',
    visible: true,
    cards: [
      { id: 'readingHours', visible: true },
      { id: 'listeningHours', visible: true },
      { id: 'readingListeningBalance', visible: true },
      { id: 'episodeTotals', visible: true },
    ],
  },
  {
    id: 'readingMetrics',
    visible: true,
    cards: [
      { id: 'avgReadingSpeed', visible: true },
      { id: 'dailyAvgChars', visible: true },
      { id: 'charsRead', visible: true },
      { id: 'pagesRead', visible: true },
    ],
  },
  {
    id: 'chartDistribution',
    visible: true,
    cards: [
      { id: 'logCountChart', visible: true },
      { id: 'timeDistributionChart', visible: true },
      { id: 'xpDistributionChart', visible: true },
    ],
  },
  {
    id: 'chartReading',
    visible: true,
    cards: [{ id: 'readingSpeedChart', visible: true }],
  },
  {
    id: 'chartProgress',
    visible: true,
    cards: [{ id: 'progressTimelineChart', visible: true }],
  },
];

const GROUP_LABELS: Record<StatsGroupId, string> = {
  totals: 'Totals',
  streaks: 'Streaks',
  timeBreakdown: 'Time Breakdown',
  readingMetrics: 'Reading Metrics',
  chartDistribution: 'Distributions',
  chartProgress: 'Progress',
  chartReading: 'Reading',
};

const GROUP_CATEGORIES: Record<StatsGroupId, CategoryId> = {
  totals: 'overview',
  streaks: 'overview',
  timeBreakdown: 'overview',
  readingMetrics: 'overview',
  chartDistribution: 'charts',
  chartProgress: 'charts',
  chartReading: 'charts',
};

function isGroupLayoutFormat(data: unknown[]): boolean {
  // New format: each item is { id, visible, cards: [...] }
  // Old format: each item is { id, visible } (flat StatsLayoutItem[])
  return (
    data.length > 0 &&
    typeof data[0] === 'object' &&
    data[0] !== null &&
    'cards' in (data[0] as object)
  );
}

function mergeGroupsWithDefault(saved: StatsGroupLayout[]): StatsGroupLayout[] {
  const savedIds = new Set(saved.map((g) => g.id));
  const missing = DEFAULT_GROUPS_LAYOUT.filter((g) => !savedIds.has(g.id));
  return [
    ...saved.map((savedGroup) => {
      const defaultGroup = DEFAULT_GROUPS_LAYOUT.find(
        (d) => d.id === savedGroup.id
      );
      if (!defaultGroup) return savedGroup;
      // Guard against groups missing cards (should not happen but protects against partial saves)
      const existingCards = Array.isArray(savedGroup.cards)
        ? savedGroup.cards
        : [];
      const savedCardIds = new Set(existingCards.map((c) => c.id));
      const missingCards = defaultGroup.cards.filter(
        (c) => !savedCardIds.has(c.id)
      );
      return { ...savedGroup, cards: [...existingCards, ...missingCards] };
    }),
    ...missing,
  ];
}

// ─── SortableStatCard ─────────────────────────────────────────────────────────
type SortableStatCardProps = {
  id: string;
  editMode: boolean;
  visible: boolean;
  onToggleVisibility: () => void;
  wrapperClassName?: string;
  children: React.ReactNode;
};
function SortableStatCard({
  id,
  editMode,
  visible,
  onToggleVisibility,
  wrapperClassName,
  children,
}: SortableStatCardProps) {
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
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  if (!editMode) {
    if (!visible) return null;
    if (wrapperClassName) {
      return <div className={wrapperClassName}>{children}</div>;
    }
    return <>{children}</>;
  }

  const wrapperClasses = [
    'relative',
    wrapperClassName,
    !visible ? 'opacity-40 grayscale' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={setNodeRef} style={style} className={wrapperClasses}>
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center pl-1 cursor-grab active:cursor-grabbing z-10 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-base-content/40 hover:text-base-content/70" />
      </div>
      <button
        type="button"
        className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-base-200/80 hover:bg-base-300 transition-colors"
        onClick={onToggleVisibility}
        title={visible ? 'Hide card' : 'Show card'}
      >
        {visible ? (
          <Eye className="w-4 h-4 text-base-content/60" />
        ) : (
          <EyeOff className="w-4 h-4 text-base-content/40" />
        )}
      </button>
      <div className="pl-7 pr-8">{children}</div>
    </div>
  );
}

// ─── SortableGroup ────────────────────────────────────────────────────────────
type SortableGroupProps = {
  id: string;
  label: string;
  editMode: boolean;
  visible: boolean;
  onToggleGroupVisibility: () => void;
  children: React.ReactNode;
};
function SortableGroup({
  id,
  label,
  editMode,
  visible,
  onToggleGroupVisibility,
  children,
}: SortableGroupProps) {
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
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 30 : undefined,
  };

  if (!editMode && !visible) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-4 ${!visible && editMode ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editMode && (
            <div
              className="cursor-grab active:cursor-grabbing touch-none p-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4 text-base-content/40 hover:text-base-content/70" />
            </div>
          )}
          <h3 className="text-xs uppercase tracking-[0.2em] text-base-content/60 font-semibold">
            {label}
          </h3>
        </div>
        {editMode && (
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-base-200 transition-colors"
            onClick={onToggleGroupVisibility}
            title={visible ? 'Hide group' : 'Show group'}
          >
            {visible ? (
              <Eye className="w-4 h-4 text-base-content/50" />
            ) : (
              <EyeOff className="w-4 h-4 text-base-content/30" />
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function StatsScreen() {
  const { username } = useOutletContext<OutletProfileContextType>();
  const { user: loggedInUser } = useUserDataStore();
  const isOwner = username === loggedInUser?.username;
  const [timeRange, setTimeRange] = useState<TimeRange>('total');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(LOG_TYPES);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('overview');
  const [progressChartView, setProgressChartView] = useState<'line' | 'bar'>(
    'line'
  );
  const [progressMetric, setProgressMetric] = useState<'xp' | 'hours'>('xp');
  const [onlyImmersedDays, setOnlyImmersedDays] = useState(false);
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [ganttSort, setGanttSort] = useState<GanttSortOption>('title-asc');
  const [ganttMinLogs, setGanttMinLogs] = useState('');
  const [ganttMaxLogs, setGanttMaxLogs] = useState('');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const startBtnRef = useRef<HTMLDivElement | null>(null);
  const endBtnRef = useRef<HTMLDivElement | null>(null);
  const { timezone } = useTimezone();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [localGroups, setLocalGroups] = useState<StatsGroupLayout[] | null>(
    null
  );

  const { data: profileData } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username!),
    enabled: Boolean(username),
    staleTime: 1000 * 60 * 5,
  });

  const rawLayout = profileData?.statsLayout;
  const savedGroups: StatsGroupLayout[] =
    Array.isArray(rawLayout) &&
    rawLayout.length > 0 &&
    isGroupLayoutFormat(rawLayout)
      ? mergeGroupsWithDefault(rawLayout as StatsGroupLayout[])
      : DEFAULT_GROUPS_LAYOUT;
  const activeGroups = localGroups ?? savedGroups;

  const layoutMutation = useMutation({
    mutationFn: (groups: StatsGroupLayout[]) => updateStatsLayoutFn(groups),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', username] });
    },
  });

  // Separate sensors for groups vs cards to avoid confusion
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag end for GROUP reordering (outer DndContext)
  const handleGroupDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setLocalGroups((prev) => {
        const groups = prev ?? savedGroups;
        const oldIndex = groups.findIndex((g) => g.id === active.id);
        const newIndex = groups.findIndex((g) => g.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return groups;
        return arrayMove(groups, oldIndex, newIndex);
      });
    },
    [savedGroups]
  );

  // Drag end for CARD reordering within a group (inner DndContext)
  const handleCardDragEnd = useCallback(
    (groupId: StatsGroupId, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setLocalGroups((prev) => {
        const groups = prev ?? savedGroups;
        return groups.map((g) => {
          if (g.id !== groupId) return g;
          const oldIndex = g.cards.findIndex((c) => c.id === active.id);
          const newIndex = g.cards.findIndex((c) => c.id === over.id);
          if (oldIndex === -1 || newIndex === -1) return g;
          return { ...g, cards: arrayMove(g.cards, oldIndex, newIndex) };
        });
      });
    },
    [savedGroups]
  );

  const handleToggleGroup = useCallback(
    (groupId: StatsGroupId) => {
      setLocalGroups((prev) => {
        const groups = prev ?? savedGroups;
        return groups.map((g) =>
          g.id === groupId ? { ...g, visible: !g.visible } : g
        );
      });
    },
    [savedGroups]
  );

  const handleToggleCard = useCallback(
    (groupId: StatsGroupId, cardId: string) => {
      setLocalGroups((prev) => {
        const groups = prev ?? savedGroups;
        return groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            cards: g.cards.map((c) =>
              c.id === cardId ? { ...c, visible: !c.visible } : c
            ),
          };
        });
      });
    },
    [savedGroups]
  );

  const handleEnterEditMode = () => {
    setLocalGroups(savedGroups);
    setEditMode(true);
  };
  const handleSaveLayout = () => {
    if (localGroups) layoutMutation.mutate(localGroups);
    setEditMode(false);
    setLocalGroups(null);
  };
  const handleCancelEdit = () => {
    setEditMode(false);
    setLocalGroups(null);
  };

  const cardWrapperClasses: Partial<Record<string, string>> = {
    progressTimelineChart: 'md:col-span-2 lg:col-span-3',
    readingSpeedChart: 'md:col-span-2 lg:col-span-3',
  };

  const renderLayoutSection = (
    cardMap: Partial<Record<string, React.ReactNode>>,
    category: CategoryId
  ) => {
    const categoryGroups = activeGroups.filter(
      (group) => GROUP_CATEGORIES[group.id] === category
    );

    return (
      <div className="space-y-8">
        {/* Edit Layout toolbar */}
        {isOwner && (
          <div className="flex items-center justify-between">
            {!editMode ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content"
                onClick={handleEnterEditMode}
              >
                <Pencil className="w-4 h-4" /> Edit Layout
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap w-full">
                <span className="text-sm text-base-content/60">
                  Drag groups or cards · click 👁 to hide/show
                </span>
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleSaveLayout}
                    disabled={layoutMutation.isPending}
                  >
                    {layoutMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Outer DndContext — reorders GROUPS */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={categoryGroups.map((g) => g.id)}
            strategy={rectSortingStrategy}
          >
            <div className="space-y-8">
              {categoryGroups.map((group) => {
                // Check if any card in this group has renderable content
                const visibleCards = group.cards.filter(
                  (c) => cardMap[c.id] !== null && cardMap[c.id] !== undefined
                );
                if (!editMode && (!group.visible || visibleCards.length === 0))
                  return null;
                if (editMode && visibleCards.length === 0) return null;

                return (
                  <SortableGroup
                    key={group.id}
                    id={group.id}
                    label={GROUP_LABELS[group.id]}
                    editMode={editMode}
                    visible={group.visible}
                    onToggleGroupVisibility={() =>
                      handleToggleGroup(group.id as StatsGroupId)
                    }
                  >
                    {/* Inner DndContext — reorders CARDS within this group */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) =>
                        handleCardDragEnd(group.id as StatsGroupId, e)
                      }
                    >
                      <SortableContext
                        items={group.cards.map((c) => c.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {group.cards.map((card) => {
                            const content = cardMap[card.id];
                            if (content === null || content === undefined)
                              return null;
                            return (
                              <SortableStatCard
                                key={card.id}
                                id={card.id}
                                editMode={editMode}
                                visible={card.visible}
                                wrapperClassName={cardWrapperClasses[card.id]}
                                onToggleVisibility={() =>
                                  handleToggleCard(
                                    group.id as StatsGroupId,
                                    card.id
                                  )
                                }
                              >
                                {content}
                              </SortableStatCard>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </SortableGroup>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  };

  const readingTypeSet = new Set<ReadingType>(READING_TYPES);
  const episodeTypeSet = new Set<EpisodeType>(EPISODE_TYPES);

  const includedTagsParam = includedTags.join(',');
  const excludedTagsParam = excludedTags.join(',');

  const { data: userStats, isLoading } = useQuery({
    queryKey: [
      'user-stats',
      username,
      timeRange,
      selectedTypes.join(','),
      startDate,
      endDate,
      includedTagsParam,
      excludedTagsParam,
      timezone,
    ],
    enabled: Boolean(username),
    queryFn: () =>
      getUserStatsFn(username, {
        timeRange: timeRange === 'custom' ? undefined : timeRange,
        type:
          selectedTypes.length === LOG_TYPES.length ? undefined : selectedTypes,
        start: startDate || undefined,
        end: endDate || undefined,
        timezone,
        includedTags: includedTagsParam || undefined,
        excludedTags: excludedTagsParam || undefined,
      }),
    placeholderData: (previousData) => previousData,
  });

  const statsByType = userStats?.statsByType ?? [];
  const isNoTypesSelected = selectedTypes.length === 0;
  const isAllTypesSelected = selectedTypes.length === LOG_TYPES.length;
  const selectedStats = isAllTypesSelected
    ? statsByType
    : statsByType.filter((stat) => selectedTypes.includes(stat.type));
  const selectedReadingStats = statsByType.filter(
    (stat) =>
      readingTypeSet.has(stat.type as ReadingType) &&
      (isAllTypesSelected || selectedTypes.includes(stat.type))
  );
  const selectedEpisodeStats = statsByType.filter(
    (stat) =>
      episodeTypeSet.has(stat.type as EpisodeType) &&
      (isAllTypesSelected || selectedTypes.includes(stat.type))
  );

  const selectedTypesDisplay = isNoTypesSelected
    ? 'No Types'
    : isAllTypesSelected
      ? 'All Types'
      : selectedTypes.length === 1
        ? capitalizeType(selectedTypes[0])
        : `${selectedTypes.length} Types`;
  const selectedTypesDescriptor = isNoTypesSelected
    ? 'no types'
    : isAllTypesSelected
      ? 'all types'
      : selectedTypes.length === 1
        ? selectedTypesDisplay.toLowerCase()
        : 'selected types';
  const progressSelectedType =
    selectedTypes.length === 1 ? selectedTypes[0] : 'all';

  const isTypeSelected = (type: string) => selectedTypes.includes(type);

  const toggleTypeSelection = (type: string) => {
    setSelectedTypes((prev) => {
      return prev.includes(type)
        ? prev.filter((item) => item !== type)
        : [...prev, type];
    });
  };

  const handleSelectAllTypes = () => {
    setSelectedTypes(LOG_TYPES);
  };

  const handleSelectNoneTypes = () => {
    setSelectedTypes([]);
  };

  const showReadingMetrics =
    isAllTypesSelected ||
    selectedTypes.some((type) => readingTypeSet.has(type as ReadingType));
  const showPageMetric = isAllTypesSelected || selectedTypes.includes('manga');
  const showEpisodeMetrics =
    isAllTypesSelected ||
    selectedTypes.some((type) => episodeTypeSet.has(type as EpisodeType));
  const episodeTotals = selectedEpisodeStats.reduce(
    (sum, stat) => sum + (stat.totalEpisodes || 0),
    0
  );
  const episodeLabel =
    selectedEpisodeStats.length === 1
      ? selectedEpisodeStats[0].type === 'movie'
        ? 'Movies'
        : selectedEpisodeStats[0].type === 'video'
          ? 'Videos'
          : 'Episodes'
      : 'Episodes';
  const episodeDescriptor =
    selectedEpisodeStats.length === 1
      ? selectedEpisodeStats[0].type === 'movie'
        ? 'movies'
        : selectedEpisodeStats[0].type === 'video'
          ? 'videos'
          : 'episodes'
      : 'episodes';

  const immersedDaysCount = (() => {
    if (!userStats) return 0;

    const relevantStats = selectedStats;

    const minutesByDay = new Map<string, number>();

    for (const stat of relevantStats) {
      for (const entry of stat.dates) {
        const dayKey = entry.localDate?.dayKey;
        if (!dayKey) continue;

        const minutes =
          typeof entry.time === 'number' && entry.time > 0 ? entry.time : 0;

        if (minutes > 0) {
          minutesByDay.set(dayKey, (minutesByDay.get(dayKey) || 0) + minutes);
        } else if (!minutesByDay.has(dayKey)) {
          minutesByDay.set(dayKey, 0);
        }
      }
    }

    let count = 0;
    minutesByDay.forEach((value) => {
      if (value > 0) count += 1;
    });
    return count;
  })();

  const readingImmersedDaysCount = (() => {
    if (!userStats || !showReadingMetrics) return 0;

    const relevantStats = selectedReadingStats;

    const minutesByDay = new Map<string, number>();

    for (const stat of relevantStats) {
      for (const entry of stat.dates) {
        const dayKey = entry.localDate?.dayKey;
        if (!dayKey) continue;

        const minutes =
          typeof entry.time === 'number' && entry.time > 0 ? entry.time : 0;

        if (minutes > 0) {
          minutesByDay.set(dayKey, (minutesByDay.get(dayKey) || 0) + minutes);
        } else if (!minutesByDay.has(dayKey)) {
          minutesByDay.set(dayKey, 0);
        }
      }
    }

    let count = 0;
    minutesByDay.forEach((value) => {
      if (value > 0) count += 1;
    });
    return count;
  })();

  const dailyAverageHoursDisplay = (() => {
    if (!userStats || isNoTypesSelected) return 0;

    if (!onlyImmersedDays) {
      return userStats.totals.dailyAverageHours;
    }

    const totalHours = userStats.totals.totalTimeHours;

    if (!immersedDaysCount) return 0;
    return totalHours / immersedDaysCount;
  })();

  const dailyAverageCharsDisplay = (() => {
    if (!userStats || !showReadingMetrics || isNoTypesSelected) return 0;

    if (!onlyImmersedDays) {
      return userStats.totals.dailyAverageChars;
    }

    const totalChars = userStats.totals.totalChars;

    if (!readingImmersedDaysCount) return 0;
    return totalChars / readingImmersedDaysCount;
  })();

  const avgReadingSpeed = (() => {
    if (!userStats) return 0;

    const readingChars = selectedReadingStats.reduce(
      (sum, stat) => sum + (stat.totalChars || 0),
      0
    );
    const hours = selectedReadingStats.reduce(
      (sum, stat) => sum + (stat.totalTimeHours || 0),
      0
    );
    if (!hours) return 0;

    return readingChars / hours;
  })();

  const pieStatsByType = selectedStats.filter((stat) => stat.type !== 'other');

  const currentStreakValue =
    !userStats || isNoTypesSelected
      ? 0
      : (userStats.streaks.currentStreak ?? 0);
  const longestStreakValue =
    !userStats || isNoTypesSelected
      ? 0
      : (userStats.streaks.longestStreak ?? 0);

  const logCountData = (() => {
    return buildPieDataset(
      pieStatsByType.map((stat) => ({
        type: stat.type,
        label: capitalizeType(stat.type),
        value: stat.count || 0,
      }))
    );
  })();

  const logTimeData = (() => {
    return buildPieDataset(
      pieStatsByType.map((stat) => ({
        type: stat.type,
        label: capitalizeType(stat.type),
        value: stat.totalTimeHours || 0,
      }))
    );
  })();

  const logXpData = (() => {
    return buildPieDataset(
      pieStatsByType.map((stat) => ({
        type: stat.type,
        label: capitalizeType(stat.type),
        value: stat.totalXp || 0,
      }))
    );
  })();

  const showDistributionCharts =
    selectedStats.filter((stat) => stat.count > 0).length > 1;

  const totalLogsValue = (() => {
    if (!userStats || isNoTypesSelected) return 0;
    return userStats.totals.totalLogs;
  })();

  const totalTimeHours = (() => {
    if (!userStats || isNoTypesSelected) return 0;
    return userStats.totals.totalTimeHours;
  })();

  const totalXp = (() => {
    if (!userStats || isNoTypesSelected) return 0;
    return userStats.totals.totalXp;
  })();

  const totalChars = (() => {
    if (!userStats || isNoTypesSelected) return 0;
    return userStats.totals.totalChars;
  })();

  const totalPages = (() => {
    if (!userStats) return 0;
    return selectedStats.reduce((sum, stat) => sum + (stat.totalPages ?? 0), 0);
  })();

  const currentTypeDisplay = selectedTypesDisplay;
  const todayKey = formatDateForQuery(new Date());
  const ganttTimeFilter =
    timeRange === 'total'
      ? 'all'
      : timeRange === 'today'
        ? 'custom'
        : timeRange;
  const ganttCustomStart =
    timeRange === 'custom' ? startDate : timeRange === 'today' ? todayKey : '';
  const ganttCustomEnd =
    timeRange === 'custom' ? endDate : timeRange === 'today' ? todayKey : '';
  const ganttSortLabel = {
    'title-asc': 'Alphabetical (A-Z)',
    'title-desc': 'Alphabetical (Z-A)',
    'first-asc': 'First log (oldest)',
    'last-desc': 'Last log (newest)',
    'logs-desc': 'Most logs',
    'time-desc': 'Most time',
    'xp-desc': 'Most XP',
  }[ganttSort];

  if (isLoading && !userStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading your stats...</p>
        </div>
      </div>
    );
  }

  if (!userStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-base-content/70">
            We could not retrieve your statistics right now.
          </p>
          <p className="text-base-content/50 text-sm mt-2">
            Try adjusting your filters or refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content">
              {username}'s Statistics
            </h1>
            {username === loggedInUser?.username ? (
              <p className="text-base-content/70">
                Track your immersion progress with detailed breakdowns and
                charts.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-outline text-sm">
              {CATEGORY_LABELS[timeRange]}
            </span>
            <span className="badge badge-outline text-sm">
              {currentTypeDisplay}
            </span>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4 w-full">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                <div className="join w-full sm:w-auto">
                  {CATEGORY_OPTIONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className={`join-item btn flex-1 sm:flex-none ${activeCategory === id ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setActiveCategory(id)}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="dropdown dropdown-bottom">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    {CATEGORY_LABELS[timeRange]}
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 shadow-sm bg-base-100 rounded-box w-60 border border-base-300"
                  >
                    {[
                      { label: 'All Time', value: 'total' },
                      { label: 'Today', value: 'today' },
                      { label: 'This Week', value: 'week' },
                      { label: 'This Month', value: 'month' },
                      { label: 'This Year', value: 'year' },
                    ].map((option) => (
                      <li key={option.value}>
                        <button
                          className={timeRange === option.value ? 'active' : ''}
                          onClick={() => {
                            setTimeRange(option.value as TimeRange);
                            setStartDate('');
                            setEndDate('');
                            setCustomStartDate(undefined);
                            setCustomEndDate(undefined);
                          }}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))}
                    <li className="menu-title px-2 mt-2">Custom range</li>
                    <li className="px-2 py-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 w-full">
                          <div className="dropdown dropdown-bottom">
                            <div
                              tabIndex={0}
                              role="button"
                              className="btn btn-outline btn-sm w-full"
                              ref={startBtnRef}
                            >
                              {customStartDate
                                ? formatDisplayDate(customStartDate)
                                : 'Start Date'}
                              <Calendar className="w-4 h-4 ml-1" />
                            </div>
                            <div
                              tabIndex={0}
                              className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                            >
                              <DayPicker
                                className="react-day-picker mx-auto"
                                mode="single"
                                selected={customStartDate}
                                onSelect={(date) => {
                                  setCustomStartDate(date ?? undefined);
                                  if (
                                    customEndDate &&
                                    date &&
                                    customEndDate < date
                                  ) {
                                    setCustomEndDate(undefined);
                                  }
                                  startBtnRef.current?.focus();
                                }}
                                disabled={(date) => date > new Date()}
                              />
                            </div>
                          </div>
                          <span className="text-center text-base-content/50">
                            to
                          </span>
                          <div className="dropdown dropdown-bottom">
                            <div
                              tabIndex={0}
                              role="button"
                              className={`btn btn-outline btn-sm w-full ${!customStartDate ? 'btn-disabled' : ''}`}
                              ref={endBtnRef}
                            >
                              {customEndDate
                                ? formatDisplayDate(customEndDate)
                                : 'End Date'}
                              <Calendar className="w-4 h-4 ml-1" />
                            </div>
                            {customStartDate && (
                              <div
                                tabIndex={0}
                                className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                              >
                                <DayPicker
                                  className="react-day-picker mx-auto"
                                  mode="single"
                                  selected={customEndDate}
                                  onSelect={(date) => {
                                    setCustomEndDate(date ?? undefined);
                                    endBtnRef.current?.focus();
                                  }}
                                  disabled={(date) => {
                                    const today = new Date();
                                    return (
                                      date > today ||
                                      (customStartDate &&
                                        date < customStartDate)
                                    );
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setStartDate(formatDateForQuery(customStartDate));
                              setEndDate(formatDateForQuery(customEndDate));
                              setTimeRange('custom');
                            }}
                            disabled={!customStartDate || !customEndDate}
                          >
                            Apply
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setStartDate('');
                              setEndDate('');
                              setCustomStartDate(undefined);
                              setCustomEndDate(undefined);
                              setTimeRange('total');
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="dropdown dropdown-bottom">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    <Filter className="w-4 h-4" />
                    {currentTypeDisplay}
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <div
                    tabIndex={0}
                    className="dropdown-content p-3 shadow-lg bg-base-100 rounded-box w-64 border border-base-300"
                  >
                    <div className="flex gap-2 pb-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline flex-1 h-9 min-h-9"
                        onClick={handleSelectAllTypes}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline flex-1 h-9 min-h-9"
                        onClick={handleSelectNoneTypes}
                      >
                        Select None
                      </button>
                    </div>
                    <div className="divider my-1"></div>
                    <div className="flex flex-col gap-1">
                      {LOG_TYPES.map((type) => {
                        const selected = isTypeSelected(type);
                        const color = getMediaTypeColor(type);
                        return (
                          <button
                            type="button"
                            key={type}
                            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                              selected
                                ? 'bg-base-200 font-medium'
                                : 'hover:bg-base-200/50'
                            }`}
                            onClick={() => toggleTypeSelection(type)}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm">
                                {capitalizeType(type)}
                              </span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                selected
                                  ? 'border-transparent'
                                  : 'border-base-content/20'
                              }`}
                              style={
                                selected
                                  ? { backgroundColor: color }
                                  : undefined
                              }
                            >
                              {selected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {activeCategory === 'timeline' && (
                  <>
                    <div className="dropdown dropdown-bottom">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline w-full sm:w-auto"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        {ganttSortLabel}
                        <ChevronDown className="w-4 h-4" />
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu p-2 shadow-sm bg-base-100 rounded-box w-56 border border-base-300"
                      >
                        <li>
                          <button
                            className={
                              ganttSort === 'title-asc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('title-asc')}
                          >
                            Alphabetical (A-Z)
                          </button>
                        </li>
                        <li>
                          <button
                            className={
                              ganttSort === 'title-desc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('title-desc')}
                          >
                            Alphabetical (Z-A)
                          </button>
                        </li>
                        <li>
                          <button
                            className={
                              ganttSort === 'first-asc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('first-asc')}
                          >
                            First log (oldest)
                          </button>
                        </li>
                        <li>
                          <button
                            className={
                              ganttSort === 'last-desc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('last-desc')}
                          >
                            Last log (newest)
                          </button>
                        </li>
                        <li>
                          <button
                            className={
                              ganttSort === 'logs-desc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('logs-desc')}
                          >
                            Most logs
                          </button>
                        </li>
                        <li>
                          <button
                            className={
                              ganttSort === 'time-desc' ? 'active' : ''
                            }
                            onClick={() => setGanttSort('time-desc')}
                          >
                            Most time
                          </button>
                        </li>
                        <li>
                          <button
                            className={ganttSort === 'xp-desc' ? 'active' : ''}
                            onClick={() => setGanttSort('xp-desc')}
                          >
                            Most XP
                          </button>
                        </li>
                      </ul>
                    </div>
                    <div className="dropdown dropdown-bottom">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline w-full sm:w-auto"
                      >
                        <Hash className="w-4 h-4" />
                        {ganttMinLogs ? `Min ${ganttMinLogs}` : 'Min logs'}
                        <ChevronDown className="w-4 h-4" />
                      </div>
                      <div
                        tabIndex={0}
                        className="dropdown-content z-[1000] card card-compact w-40 p-2 shadow bg-base-100 border border-base-300"
                      >
                        <input
                          type="number"
                          min={0}
                          className="input input-sm"
                          placeholder="Min logs"
                          value={ganttMinLogs}
                          onChange={(event) =>
                            setGanttMinLogs(event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="dropdown dropdown-bottom">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline w-full sm:w-auto"
                      >
                        <Hash className="w-4 h-4" />
                        {ganttMaxLogs ? `Max ${ganttMaxLogs}` : 'Max logs'}
                        <ChevronDown className="w-4 h-4" />
                      </div>
                      <div
                        tabIndex={0}
                        className="dropdown-content z-[1000] card card-compact w-40 p-2 shadow bg-base-100 border border-base-300"
                      >
                        <input
                          type="number"
                          min={0}
                          className="input input-sm"
                          placeholder="Max logs"
                          value={ganttMaxLogs}
                          onChange={(event) =>
                            setGanttMaxLogs(event.target.value)
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <TagFilter
                includedTags={includedTags}
                excludedTags={excludedTags}
                onIncludeChange={setIncludedTags}
                onExcludeChange={setExcludedTags}
                username={username ?? ''}
              />
            </div>
            <label className="label cursor-pointer gap-3 w-full lg:w-auto justify-between lg:justify-end">
              <span className="label-text text-sm text-base-content whitespace-nowrap">
                Immersed days only
              </span>
              <input
                type="checkbox"
                className="checkbox checkbox-md checkbox-secondary"
                checked={onlyImmersedDays}
                onChange={(event) => setOnlyImmersedDays(event.target.checked)}
              />
            </label>
          </div>
        </div>

        {activeCategory === 'overview' &&
          (() => {
            // Build the card content map (condition-gated cards return null when not applicable)
            const cardMap: Partial<Record<string, React.ReactNode>> = {
              totalXp: (
                <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Total XP
                        </h3>
                        <p className="text-3xl font-bold text-primary mt-1">
                          {numberWithCommas(totalXp)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">
                      {isAllTypesSelected
                        ? `${PERIOD_LABELS[timeRange]} experience gained`
                        : `${PERIOD_LABELS[timeRange]} ${selectedTypesDescriptor} experience`}
                    </p>
                  </div>
                </div>
              ),
              timeSpent: (
                <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Time Spent
                        </h3>
                        <p className="text-3xl font-bold text-secondary mt-1">
                          {numberWithCommas(
                            parseFloat(totalTimeHours.toFixed(1))
                          )}{' '}
                          <span className="text-lg text-base-content/70">
                            hours
                          </span>
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                        <Clock3 className="w-6 h-6 text-secondary" />
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">
                      {isAllTypesSelected
                        ? `${PERIOD_LABELS[timeRange]} immersion time`
                        : `${PERIOD_LABELS[timeRange]} ${selectedTypesDescriptor} immersion time`}
                    </p>
                  </div>
                </div>
              ),
              logCount: (
                <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Log Count
                        </h3>
                        <p className="text-3xl font-bold text-accent mt-1">
                          {numberWithCommas(totalLogsValue)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Layers className="w-6 h-6 text-accent" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-base-content/60">
                        {isAllTypesSelected
                          ? 'Total log entries'
                          : `${selectedTypesDisplay} entries`}
                      </p>
                      {isAllTypesSelected &&
                        (userStats!.totals.untrackedCount ?? 0) > 0 && (
                          <span className="badge badge-warning badge-xs">
                            {userStats!.totals.untrackedCount} untracked
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ),
              dailyAverage: (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Daily Average
                        </h3>
                        <p className="text-3xl font-bold text-secondary mt-1">
                          {numberWithCommas(
                            parseFloat(
                              (dailyAverageHoursDisplay || 0).toFixed(2)
                            )
                          )}{' '}
                          <span className="text-lg text-base-content/70">
                            hours
                          </span>
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                        <Timer className="w-6 h-6 text-secondary" />
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">{`${PERIOD_LABELS[timeRange]} daily ${isAllTypesSelected ? 'immersion' : selectedTypesDescriptor + ' immersion'} average`}</p>
                  </div>
                </div>
              ),
              currentStreak: (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Current Streak
                        </h3>
                        <p className="text-3xl font-bold text-warning mt-1">
                          {numberWithCommas(currentStreakValue)}{' '}
                          <span className="text-lg text-base-content/70">
                            days
                          </span>
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                        <Flame className="w-6 h-6 text-warning" />
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">
                      Consecutive days of immersion activity
                    </p>
                  </div>
                </div>
              ),
              longestStreak: (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                          Longest Streak
                        </h3>
                        <p className="text-3xl font-bold text-info mt-1">
                          {numberWithCommas(longestStreakValue)}{' '}
                          <span className="text-lg text-base-content/70">
                            days
                          </span>
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                        <Star className="w-6 h-6 text-info" />
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">
                      Longest streak you have maintained
                    </p>
                  </div>
                </div>
              ),
              readingHours: isAllTypesSelected ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-info" />
                      </div>
                      <h3 className="font-semibold text-info">Reading</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(
                        parseFloat(userStats!.totals.readingHours.toFixed(1))
                      )}{' '}
                      <span className="text-sm font-normal text-base-content/70">
                        hours
                      </span>
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      Reading, manga, visual novels, and video games
                    </p>
                  </div>
                </div>
              ) : null,
              listeningHours: isAllTypesSelected ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                        <Headphones className="w-4 h-4 text-success" />
                      </div>
                      <h3 className="font-semibold text-success">Listening</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(
                        parseFloat(userStats!.totals.listeningHours.toFixed(1))
                      )}{' '}
                      <span className="text-sm font-normal text-base-content/70">
                        hours
                      </span>
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      Anime, video, audio, movies, and TV
                    </p>
                  </div>
                </div>
              ) : null,
              readingListeningBalance: isAllTypesSelected ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                        <Scale className="w-4 h-4 text-warning" />
                      </div>
                      <h3 className="font-semibold text-warning">Balance</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {(() => {
                        const r = userStats!.totals.readingHours;
                        const l = userStats!.totals.listeningHours;
                        const c = r + l;
                        if (c <= 0) return '0:0';
                        const rr = Math.round((r / c) * 10);
                        const ll = 10 - rr;
                        const gcd = (a: number, b: number): number =>
                          b === 0 ? a : gcd(b, a % b);
                        const d = gcd(rr, ll) || 1;
                        return `${rr / d}:${ll / d}`;
                      })()}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      Reading vs. listening ratio
                    </p>
                  </div>
                </div>
              ) : null,
              episodeTotals: showEpisodeMetrics ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Clapperboard className="w-5 h-5 text-accent" />
                      </div>
                      <h3 className="font-semibold text-accent">
                        {episodeLabel}
                      </h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(episodeTotals)}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      Total {episodeDescriptor} watched
                    </p>
                  </div>
                </div>
              ) : null,
              avgReadingSpeed: showReadingMetrics ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Gauge className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-primary">
                        Average Reading Speed
                      </h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(Math.round(avgReadingSpeed || 0))}{' '}
                      <span className="text-sm font-normal text-base-content/70">
                        chars/hr
                      </span>
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      Based on reading, manga, and visual novels
                    </p>
                  </div>
                </div>
              ) : null,
              dailyAvgChars: showReadingMetrics ? (
                <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-primary"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <g transform="translate(12,12)">
                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="currentColor"
                              fontSize="20"
                              fontWeight="700"
                            >
                              字
                            </text>
                          </g>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-primary">
                        Daily Avg Characters
                      </h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(
                        Math.round(dailyAverageCharsDisplay || 0)
                      )}{' '}
                      <span className="text-sm font-normal text-base-content/70">
                        chars
                      </span>
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">{`${PERIOD_LABELS[timeRange]} daily ${isAllTypesSelected ? 'reading' : selectedTypesDescriptor + ' reading'} average`}</p>
                  </div>
                </div>
              ) : null,
              charsRead: showReadingMetrics ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-primary"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <g transform="translate(12,12)">
                            <text
                              x="0"
                              y="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="currentColor"
                              fontSize="20"
                              fontWeight="700"
                            >
                              字
                            </text>
                          </g>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-primary">
                        Characters Read
                      </h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(totalChars)}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      {isAllTypesSelected
                        ? 'Characters across all reading types'
                        : `Characters in ${selectedTypesDescriptor} logs`}
                    </p>
                  </div>
                </div>
              ) : null,
              pagesRead: showPageMetric ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
                        <Book className="w-5 h-5 text-info" />
                      </div>
                      <h3 className="font-semibold text-info">Pages</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {numberWithCommas(totalPages)}
                    </p>
                    <p className="text-xs text-base-content/60 mt-1">
                      {isAllTypesSelected
                        ? 'Total pages recorded across reading logs'
                        : `Total pages read in ${selectedTypesDescriptor} logs`}
                    </p>
                  </div>
                </div>
              ) : null,
            };

            return renderLayoutSection(cardMap, 'overview');
          })()}

        {activeCategory === 'charts' &&
          (() => {
            const chartCardMap: Partial<Record<string, React.ReactNode>> = {
              logCountChart: showDistributionCharts ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <h3 className="card-title text-lg mb-4">
                      <PieChartIcon className="w-5 h-5 text-primary" />
                      Log Count
                    </h3>
                    <div className="h-64">
                      <PieChart data={logCountData} valueFormat="logs" />
                    </div>
                  </div>
                </div>
              ) : null,
              timeDistributionChart: showDistributionCharts ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <h3 className="card-title text-lg mb-4">
                      <Clock3 className="w-5 h-5 text-primary" />
                      Time Distribution
                    </h3>
                    <div className="h-64">
                      <PieChart data={logTimeData} valueFormat="hours" />
                    </div>
                  </div>
                </div>
              ) : null,
              xpDistributionChart: showDistributionCharts ? (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <h3 className="card-title text-lg mb-4">
                      <Zap className="w-5 h-5 text-primary" />
                      XP Distribution
                    </h3>
                    <div className="h-64">
                      <PieChart data={logXpData} valueFormat="xp" />
                    </div>
                  </div>
                </div>
              ) : null,
              readingSpeedChart:
                showReadingMetrics &&
                userStats.readingSpeedData &&
                userStats.readingSpeedData.length > 0 ? (
                  <div className="card bg-base-100 shadow-sm h-full">
                    <div className="card-body">
                      <h3 className="card-title text-xl mb-4">
                        <TrendingUp className="w-6 h-6 text-primary" />
                        Reading Speed Over Time
                      </h3>
                      <div className="w-full" style={{ height: '400px' }}>
                        <SpeedChart
                          timeframe={
                            timeRange === 'custom' ? 'total' : timeRange
                          }
                          readingSpeedData={userStats.readingSpeedData}
                        />
                      </div>
                    </div>
                  </div>
                ) : null,
              progressTimelineChart: (
                <div className="card bg-base-100 shadow-sm h-full">
                  <div className="card-body">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="card-title text-xl flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary" />
                        Progress Timeline
                      </h3>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-base-content/70">
                            Metric:
                          </span>
                          <div className="join">
                            <button
                              className={`join-item btn btn-sm ${
                                progressMetric === 'xp'
                                  ? 'btn-primary'
                                  : 'btn-outline'
                              }`}
                              onClick={() => setProgressMetric('xp')}
                            >
                              <Zap className="w-4 h-4" />
                              XP
                            </button>
                            <button
                              className={`join-item btn btn-sm ${
                                progressMetric === 'hours'
                                  ? 'btn-primary'
                                  : 'btn-outline'
                              }`}
                              onClick={() => setProgressMetric('hours')}
                            >
                              <Clock3 className="w-4 h-4" />
                              Hours
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-base-content/70">
                            View:
                          </span>
                          <div className="join">
                            <button
                              className={`join-item btn btn-sm ${
                                progressChartView === 'line'
                                  ? 'btn-primary'
                                  : 'btn-outline'
                              }`}
                              onClick={() => setProgressChartView('line')}
                            >
                              <LineChart className="w-4 h-4" />
                              Line
                            </button>
                            <button
                              className={`join-item btn btn-sm ${
                                progressChartView === 'bar'
                                  ? 'btn-primary'
                                  : 'btn-outline'
                              }`}
                              onClick={() => setProgressChartView('bar')}
                            >
                              <BarChart3 className="w-4 h-4" />
                              Bar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full" style={{ height: '450px' }}>
                      {progressChartView === 'line' ? (
                        <ProgressChart
                          timeframe={
                            timeRange === 'custom' ? 'total' : timeRange
                          }
                          statsData={selectedStats}
                          selectedType={progressSelectedType}
                          metric={progressMetric}
                        />
                      ) : (
                        <StackedBarChart
                          statsData={selectedStats}
                          selectedType={progressSelectedType}
                          metric={progressMetric}
                          timeframe={
                            timeRange === 'custom' ? 'total' : timeRange
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              ),
            };

            return renderLayoutSection(chartCardMap, 'charts');
          })()}
        {activeCategory === 'timeline' && (
          <div className="space-y-4">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title text-xl flex items-center gap-2 mb-1">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  Immersion Timeline
                </h3>
                <p className="text-sm text-base-content/60 mb-4">
                  Each bar spans from your first to your last log session for
                  that title. Shading intensity shows how frequently you
                  immersed in each month.
                </p>
                <GanttChartSection
                  username={username}
                  timezone={timezone}
                  timeFilter={ganttTimeFilter}
                  typeFilter={selectedTypes}
                  sortBy={ganttSort}
                  minLogs={ganttMinLogs}
                  maxLogs={ganttMaxLogs}
                  customStart={ganttCustomStart}
                  customEnd={ganttCustomEnd}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lazy Gantt wrapper with its own query ────────────────────────────────────

function computeGanttDateRange(
  timeFilter: 'week' | 'month' | 'year' | 'all' | 'custom',
  customStart: string,
  customEnd: string
): { start?: string; end?: string } {
  if (timeFilter === 'all') return {};

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (timeFilter === 'week') {
    const day = now.getDay();
    const diff = (day + 6) % 7; // Monday start
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: fmt(start), end: fmt(end) };
  }

  if (timeFilter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: fmt(start), end: fmt(end) };
  }

  if (timeFilter === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: fmt(start), end: fmt(end) };
  }

  // custom
  return {
    start: customStart || undefined,
    end: customEnd || undefined,
  };
}

function GanttChartSection({
  username,
  timezone,
  timeFilter,
  typeFilter,
  sortBy,
  minLogs,
  maxLogs,
  customStart,
  customEnd,
}: {
  username: string | undefined;
  timezone: string;
  timeFilter: 'week' | 'month' | 'year' | 'all' | 'custom';
  typeFilter: string[];
  sortBy: GanttSortOption;
  minLogs: string;
  maxLogs: string;
  customStart: string;
  customEnd: string;
}) {
  const dateRange = computeGanttDateRange(timeFilter, customStart, customEnd);

  const { data, isLoading, error } = useQuery({
    queryKey: ['gantt', username, timezone, dateRange.start, dateRange.end],
    queryFn: () =>
      getGanttDataFn(username!, {
        timezone,
        start: dateRange.start,
        end: dateRange.end,
      }),
    enabled: Boolean(username),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-base-content/50">
        <p>Could not load timeline data.</p>
      </div>
    );
  }

  const isAllTypesSelected = typeFilter.length === LOG_TYPES.length;
  const filteredItems = isAllTypesSelected
    ? data
    : data.filter((item) => typeFilter.includes(item.type));
  const selectedTypeForGantt = typeFilter.length === 1 ? typeFilter[0] : 'all';

  return (
    <div data-gantt-root className="relative">
      <GanttChart
        items={filteredItems}
        timeFilter={timeFilter}
        selectedType={selectedTypeForGantt}
        sortBy={sortBy}
        minLogs={minLogs}
        maxLogs={maxLogs}
        customStart={customStart}
        customEnd={customEnd}
      />
    </div>
  );
}

export default StatsScreen;
