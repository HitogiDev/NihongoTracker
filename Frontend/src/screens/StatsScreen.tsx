import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DayPicker } from 'react-day-picker';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Book,
  BookOpen,
  Calendar,
  ChevronDown,
  Clapperboard,
  Clock3,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Gauge,
  GripVertical,
  Headphones,
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
import { getUserStatsFn, getUserFn, updateStatsLayoutFn } from '../api/trackerApi';
import PieChart from '../components/PieChart';
import ProgressChart from '../components/ProgressChart';
import SpeedChart from '../components/SpeedChart';
import StackedBarChart from '../components/StackedBarChart';
import TagFilter from '../components/TagFilter';
import { getMediaTypeColor } from '../constants/mediaColors';
import { useTimezone } from '../hooks/useTimezone';
import { OutletProfileContextType, StatsGroupId, StatsGroupLayout } from '../types';
import { numberWithCommas } from '../utils/utils';
import { useUserDataStore } from '../store/userData';

const CATEGORY_OPTIONS = [
  { id: 'overview', label: 'Overview', Icon: Gauge },
  { id: 'charts', label: 'Charts', Icon: LineChart },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]['id'];

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'total' | 'custom';

type ReadingType = 'reading' | 'manga' | 'vn' | 'game';
type EpisodeType = 'anime' | 'video' | 'movie';

const READING_TYPES: ReadonlyArray<ReadingType> = [
  'reading',
  'manga',
  'vn',
  'game',
];
const EPISODE_TYPES: ReadonlyArray<EpisodeType> = ['anime', 'video', 'movie'];

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
];

const GROUP_LABELS: Record<StatsGroupId, string> = {
  totals: 'Totals',
  streaks: 'Streaks',
  timeBreakdown: 'Time Breakdown',
  readingMetrics: 'Reading Metrics',
};

function isGroupLayoutFormat(data: unknown[]): boolean {
  // New format: each item is { id, visible, cards: [...] }
  // Old format: each item is { id, visible } (flat StatsLayoutItem[])
  return data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'cards' in (data[0] as object);
}

function mergeGroupsWithDefault(saved: StatsGroupLayout[]): StatsGroupLayout[] {
  const savedIds = new Set(saved.map((g) => g.id));
  const missing = DEFAULT_GROUPS_LAYOUT.filter((g) => !savedIds.has(g.id));
  return [
    ...saved.map((savedGroup) => {
      const defaultGroup = DEFAULT_GROUPS_LAYOUT.find((d) => d.id === savedGroup.id);
      if (!defaultGroup) return savedGroup;
      // Guard against groups missing cards (should not happen but protects against partial saves)
      const existingCards = Array.isArray(savedGroup.cards) ? savedGroup.cards : [];
      const savedCardIds = new Set(existingCards.map((c) => c.id));
      const missingCards = defaultGroup.cards.filter((c) => !savedCardIds.has(c.id));
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
  children: React.ReactNode;
};
function SortableStatCard({ id, editMode, visible, onToggleVisibility, children }: SortableStatCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  if (!editMode) return visible ? <>{children}</> : null;
  return (
    <div ref={setNodeRef} style={style} className={`relative ${!visible ? 'opacity-40 grayscale' : ''}`}>
      <div className="absolute left-0 top-0 bottom-0 flex items-center pl-1 cursor-grab active:cursor-grabbing z-10 touch-none" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-base-content/40 hover:text-base-content/70" />
      </div>
      <button type="button" className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-base-200/80 hover:bg-base-300 transition-colors" onClick={onToggleVisibility} title={visible ? 'Hide card' : 'Show card'}>
        {visible ? <Eye className="w-4 h-4 text-base-content/60" /> : <EyeOff className="w-4 h-4 text-base-content/40" />}
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
function SortableGroup({ id, label, editMode, visible, onToggleGroupVisibility, children }: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 30 : undefined,
  };

  if (!editMode && !visible) return null;

  return (
    <div ref={setNodeRef} style={style} className={`space-y-4 ${!visible && editMode ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editMode && (
            <div className="cursor-grab active:cursor-grabbing touch-none p-1" {...attributes} {...listeners}>
              <GripVertical className="w-4 h-4 text-base-content/40 hover:text-base-content/70" />
            </div>
          )}
          <h3 className="text-xs uppercase tracking-[0.2em] text-base-content/60 font-semibold">{label}</h3>
        </div>
        {editMode && (
          <button type="button" className="p-1 rounded-lg hover:bg-base-200 transition-colors" onClick={onToggleGroupVisibility} title={visible ? 'Hide group' : 'Show group'}>
            {visible ? <Eye className="w-4 h-4 text-base-content/50" /> : <EyeOff className="w-4 h-4 text-base-content/30" />}
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
  const [currentType, setCurrentType] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('overview');
  const [progressChartView, setProgressChartView] = useState<'line' | 'bar'>('line');
  const [progressMetric, setProgressMetric] = useState<'xp' | 'hours'>('xp');
  const [onlyImmersedDays, setOnlyImmersedDays] = useState(false);
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const startBtnRef = useRef<HTMLDivElement | null>(null);
  const endBtnRef = useRef<HTMLDivElement | null>(null);
  const { timezone } = useTimezone();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [localGroups, setLocalGroups] = useState<StatsGroupLayout[] | null>(null);

  const { data: profileData } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username!),
    enabled: Boolean(username),
    staleTime: 1000 * 60 * 5,
  });

  const rawLayout = profileData?.statsLayout;
  const savedGroups: StatsGroupLayout[] = Array.isArray(rawLayout) && rawLayout.length > 0 && isGroupLayoutFormat(rawLayout)
    ? mergeGroupsWithDefault(rawLayout as StatsGroupLayout[])
    : DEFAULT_GROUPS_LAYOUT;
  const activeGroups = localGroups ?? savedGroups;

  const layoutMutation = useMutation({
    mutationFn: (groups: StatsGroupLayout[]) => updateStatsLayoutFn(groups),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user', username] }); },
  });

  // Separate sensors for groups vs cards to avoid confusion
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag end for GROUP reordering (outer DndContext)
  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalGroups((prev) => {
      const groups = prev ?? savedGroups;
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return groups;
      return arrayMove(groups, oldIndex, newIndex);
    });
  }, [savedGroups]);

  // Drag end for CARD reordering within a group (inner DndContext)
  const handleCardDragEnd = useCallback((groupId: StatsGroupId, event: DragEndEvent) => {
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
  }, [savedGroups]);

  const handleToggleGroup = useCallback((groupId: StatsGroupId) => {
    setLocalGroups((prev) => {
      const groups = prev ?? savedGroups;
      return groups.map((g) => g.id === groupId ? { ...g, visible: !g.visible } : g);
    });
  }, [savedGroups]);

  const handleToggleCard = useCallback((groupId: StatsGroupId, cardId: string) => {
    setLocalGroups((prev) => {
      const groups = prev ?? savedGroups;
      return groups.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, cards: g.cards.map((c) => c.id === cardId ? { ...c, visible: !c.visible } : c) };
      });
    });
  }, [savedGroups]);

  const handleEnterEditMode = () => { setLocalGroups(savedGroups); setEditMode(true); };
  const handleSaveLayout = () => {
    if (localGroups) layoutMutation.mutate(localGroups);
    setEditMode(false);
    setLocalGroups(null);
  };
  const handleCancelEdit = () => { setEditMode(false); setLocalGroups(null); };

  const readingTypeSet = new Set<ReadingType>(READING_TYPES);
  const episodeTypeSet = new Set<EpisodeType>(EPISODE_TYPES);

  const includedTagsParam = includedTags.join(',');
  const excludedTagsParam = excludedTags.join(',');

  const { data: userStats, isLoading } = useQuery({
    queryKey: [
      'user-stats',
      username,
      timeRange,
      currentType,
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
        type: currentType === 'all' ? undefined : currentType,
        start: startDate || undefined,
        end: endDate || undefined,
        timezone,
        includedTags: includedTagsParam || undefined,
        excludedTags: excludedTagsParam || undefined,
      }),
  });

  const statsByType = userStats?.statsByType ?? [];
  const currentTypeStats =
    currentType === 'all'
      ? undefined
      : statsByType.find((stat) => stat.type === currentType);

  const showReadingMetrics =
    currentType === 'all' || readingTypeSet.has(currentType as ReadingType);
  const showPageMetric = currentType === 'all' || currentType === 'manga';
  const showEpisodeMetrics =
    currentType !== 'all' && episodeTypeSet.has(currentType as EpisodeType);

  const immersedDaysCount = (() => {
    if (!userStats) return 0;

    const relevantStats =
      currentType === 'all'
        ? statsByType
        : statsByType.filter((stat) => stat.type === currentType);

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

    const relevantStats =
      currentType === 'all'
        ? statsByType.filter((stat) =>
            readingTypeSet.has(stat.type as ReadingType)
          )
        : statsByType.filter((stat) => stat.type === currentType);

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
    if (!userStats) return 0;

    if (!onlyImmersedDays) {
      return userStats.totals.dailyAverageHours;
    }

    const totalHours =
      currentType === 'all'
        ? userStats.totals.totalTimeHours
        : (currentTypeStats?.totalTimeHours ?? 0);

    if (!immersedDaysCount) return 0;
    return totalHours / immersedDaysCount;
  })();

  const dailyAverageCharsDisplay = (() => {
    if (!userStats || !showReadingMetrics) return 0;

    if (!onlyImmersedDays) {
      return userStats.totals.dailyAverageChars;
    }

    const totalChars =
      currentType === 'all'
        ? userStats.totals.totalChars
        : (currentTypeStats?.totalChars ?? 0);

    if (!readingImmersedDaysCount) return 0;
    return totalChars / readingImmersedDaysCount;
  })();

  const avgReadingSpeed = (() => {
    if (!userStats || !userStats.totals.readingHours) return 0;

    const readingChars = statsByType
      .filter((stat) => readingTypeSet.has(stat.type as ReadingType))
      .reduce((sum, stat) => sum + (stat.totalChars || 0), 0);

    const hours = userStats.totals.readingHours || 0;
    if (!hours) return 0;

    return readingChars / hours;
  })();

  const pieStatsByType = statsByType.filter((stat) => stat.type !== 'other');

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

  const totalLogsValue = (() => {
    if (!userStats) return 0;
    if (currentType === 'all') return userStats.totals.totalLogs;
    return currentTypeStats?.count ?? 0;
  })();

  const totalTimeHours = (() => {
    if (!userStats) return 0;
    if (currentType === 'all') return userStats.totals.totalTimeHours;
    return currentTypeStats?.totalTimeHours ?? 0;
  })();

  const totalXp = (() => {
    if (!userStats) return 0;
    if (currentType === 'all') return userStats.totals.totalXp;
    return currentTypeStats?.totalXp ?? 0;
  })();

  const totalChars = (() => {
    if (!userStats) return 0;
    if (currentType === 'all') return userStats.totals.totalChars;
    return currentTypeStats?.totalChars ?? 0;
  })();

  const totalPages = (() => {
    if (!userStats) return 0;
    if (currentType === 'all') {
      return statsByType.reduce((sum, stat) => sum + (stat.totalPages ?? 0), 0);
    }
    return currentTypeStats?.totalPages ?? 0;
  })();

  const currentTypeDisplay = capitalizeType(currentType);

  const logTypes = [
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

  if (isLoading) {
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
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 shadow-sm bg-base-100 rounded-box w-52 border border-base-300"
                  >
                    <li>
                      <button
                        className={currentType === 'all' ? 'active' : ''}
                        onClick={() => setCurrentType('all')}
                      >
                        All Types
                      </button>
                    </li>
                    {logTypes.map((type) => (
                      <li key={type}>
                        <button
                          className={currentType === type ? 'active' : ''}
                          onClick={() => setCurrentType(type)}
                        >
                          {capitalizeType(type)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
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

        {activeCategory === 'overview' && (() => {
          // Build the card content map (condition-gated cards return null when not applicable)
          const cardMap: Partial<Record<string, React.ReactNode>> = {
            totalXp: (
              <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Total XP</h3><p className="text-3xl font-bold text-primary mt-1">{numberWithCommas(totalXp)}</p></div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"><Zap className="w-6 h-6 text-primary" /></div>
                </div>
                <p className="text-xs text-base-content/60 mt-2">{currentType === 'all' ? `${PERIOD_LABELS[timeRange]} experience gained` : `${capitalizeType(currentType)} category experience`}</p>
              </div></div>
            ),
            timeSpent: (
              <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Time Spent</h3><p className="text-3xl font-bold text-secondary mt-1">{numberWithCommas(parseFloat(totalTimeHours.toFixed(1)))} <span className="text-lg text-base-content/70">hours</span></p></div>
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center"><Clock3 className="w-6 h-6 text-secondary" /></div>
                </div>
                <p className="text-xs text-base-content/60 mt-2">{currentType === 'all' ? `${PERIOD_LABELS[timeRange]} immersion time` : `${capitalizeType(currentType)} immersion time`}</p>
              </div></div>
            ),
            logCount: (
              <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Log Count</h3><p className="text-3xl font-bold text-accent mt-1">{numberWithCommas(totalLogsValue)}</p></div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center"><Layers className="w-6 h-6 text-accent" /></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-base-content/60">{currentType === 'all' ? 'Total log entries' : `${capitalizeType(currentType)} entries`}</p>
                  {currentType === 'all' && (userStats!.totals.untrackedCount ?? 0) > 0 && <span className="badge badge-warning badge-xs">{userStats!.totals.untrackedCount} untracked</span>}
                </div>
              </div></div>
            ),
            dailyAverage: (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Daily Average</h3><p className="text-3xl font-bold text-secondary mt-1">{numberWithCommas(parseFloat((dailyAverageHoursDisplay || 0).toFixed(2)))} <span className="text-lg text-base-content/70">hours</span></p></div>
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center"><Timer className="w-6 h-6 text-secondary" /></div>
                </div>
                <p className="text-xs text-base-content/60 mt-2">{`${PERIOD_LABELS[timeRange]} daily ${currentType === 'all' ? 'immersion' : currentType.toLowerCase() + ' immersion'} average`}</p>
              </div></div>
            ),
            currentStreak: (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Current Streak</h3><p className="text-3xl font-bold text-warning mt-1">{numberWithCommas(userStats!.streaks.currentStreak ?? 0)} <span className="text-lg text-base-content/70">days</span></p></div>
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center"><Flame className="w-6 h-6 text-warning" /></div>
                </div>
                <p className="text-xs text-base-content/60 mt-2">Consecutive days of immersion activity</p>
              </div></div>
            ),
            longestStreak: (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">Longest Streak</h3><p className="text-3xl font-bold text-info mt-1">{numberWithCommas(userStats!.streaks.longestStreak ?? 0)} <span className="text-lg text-base-content/70">days</span></p></div>
                  <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center"><Star className="w-6 h-6 text-info" /></div>
                </div>
                <p className="text-xs text-base-content/60 mt-2">Longest streak you have maintained</p>
              </div></div>
            ),
            readingHours: currentType === 'all' ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center"><BookOpen className="w-4 h-4 text-info" /></div><h3 className="font-semibold text-info">Reading</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(parseFloat(userStats!.totals.readingHours.toFixed(1)))} <span className="text-sm font-normal text-base-content/70">hours</span></p>
                <p className="text-xs text-base-content/60 mt-1">Reading, manga, visual novels, and video games</p>
              </div></div>
            ) : null,
            listeningHours: currentType === 'all' ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center"><Headphones className="w-4 h-4 text-success" /></div><h3 className="font-semibold text-success">Listening</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(parseFloat(userStats!.totals.listeningHours.toFixed(1)))} <span className="text-sm font-normal text-base-content/70">hours</span></p>
                <p className="text-xs text-base-content/60 mt-1">Anime, video, audio, movies, and TV</p>
              </div></div>
            ) : null,
            readingListeningBalance: currentType === 'all' ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center"><Scale className="w-4 h-4 text-warning" /></div><h3 className="font-semibold text-warning">Balance</h3></div>
                <p className="text-2xl font-bold">{(() => { const r = userStats!.totals.readingHours; const l = userStats!.totals.listeningHours; const c = r + l; if (c <= 0) return '0:0'; const rr = Math.round((r / c) * 10); return `${rr}:${10 - rr}`; })()}</p>
                <p className="text-xs text-base-content/60 mt-1">Reading vs. listening ratio</p>
              </div></div>
            ) : null,
            episodeTotals: showEpisodeMetrics ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center"><Clapperboard className="w-5 h-5 text-accent" /></div><h3 className="font-semibold text-accent">{currentType === 'anime' ? 'Episodes' : currentType === 'movie' ? 'Movies' : 'Videos'}</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(statsByType.find((s) => s.type === currentType)?.totalEpisodes || 0)}</p>
                <p className="text-xs text-base-content/60 mt-1">Total {currentType} {currentType === 'anime' ? 'episodes' : currentType === 'movie' ? 'movies' : 'videos'} watched</p>
              </div></div>
            ) : null,
            avgReadingSpeed: showReadingMetrics ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><Gauge className="w-5 h-5 text-primary" /></div><h3 className="font-semibold text-primary">Average Reading Speed</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(Math.round(avgReadingSpeed || 0))} <span className="text-sm font-normal text-base-content/70">chars/hr</span></p>
                <p className="text-xs text-base-content/60 mt-1">Based on reading, manga, and visual novels</p>
              </div></div>
            ) : null,
            dailyAvgChars: showReadingMetrics ? (
              <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="translate(12,12)"><text x="0" y="0" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="20" fontWeight="700">字</text></g></svg></div><h3 className="font-semibold text-primary">Daily Avg Characters</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(Math.round(dailyAverageCharsDisplay || 0))} <span className="text-sm font-normal text-base-content/70">chars</span></p>
                <p className="text-xs text-base-content/60 mt-1">{`${PERIOD_LABELS[timeRange]} daily ${currentType === 'all' ? 'reading' : currentType.toLowerCase() + ' reading'} average`}</p>
              </div></div>
            ) : null,
            charsRead: showReadingMetrics ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="translate(12,12)"><text x="0" y="0" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="20" fontWeight="700">字</text></g></svg></div><h3 className="font-semibold text-primary">Characters Read</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(totalChars)}</p>
                <p className="text-xs text-base-content/60 mt-1">{currentType === 'all' ? 'Characters across all reading types' : `Characters in ${currentType.toLowerCase()} logs`}</p>
              </div></div>
            ) : null,
            pagesRead: showPageMetric ? (
              <div className="card bg-base-100 shadow-sm h-full"><div className="card-body">
                <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center"><Book className="w-5 h-5 text-info" /></div><h3 className="font-semibold text-info">Pages</h3></div>
                <p className="text-2xl font-bold">{numberWithCommas(totalPages)}</p>
                <p className="text-xs text-base-content/60 mt-1">{currentType === 'all' ? 'Total pages recorded across reading logs' : `Total pages read in ${currentTypeDisplay.toLowerCase()} logs`}</p>
              </div></div>
            ) : null,
          };

          return (
            <div className="space-y-8">
              {/* Edit Layout toolbar */}
              {isOwner && (
                <div className="flex items-center justify-between">
                  {!editMode ? (
                    <button type="button" className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content" onClick={handleEnterEditMode}>
                      <Pencil className="w-4 h-4" /> Edit Layout
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap w-full">
                      <span className="text-sm text-base-content/60">Drag groups or cards · click 👁 to hide/show</span>
                      <div className="flex gap-2 ml-auto">
                        <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancelEdit}>Cancel</button>
                        <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveLayout} disabled={layoutMutation.isPending}>
                          {layoutMutation.isPending ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Outer DndContext — reorders GROUPS */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={activeGroups.map((g) => g.id)} strategy={rectSortingStrategy}>
                  <div className="space-y-8">
                    {activeGroups.map((group) => {
                      // Check if any card in this group has renderable content
                      const visibleCards = group.cards.filter((c) => cardMap[c.id] !== null && cardMap[c.id] !== undefined);
                      if (!editMode && (!group.visible || visibleCards.length === 0)) return null;
                      if (editMode && visibleCards.length === 0) return null;

                      return (
                        <SortableGroup
                          key={group.id}
                          id={group.id}
                          label={GROUP_LABELS[group.id]}
                          editMode={editMode}
                          visible={group.visible}
                          onToggleGroupVisibility={() => handleToggleGroup(group.id as StatsGroupId)}
                        >
                          {/* Inner DndContext — reorders CARDS within this group */}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) => handleCardDragEnd(group.id as StatsGroupId, e)}
                          >
                            <SortableContext items={group.cards.map((c) => c.id)} strategy={rectSortingStrategy}>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {group.cards.map((card) => {
                                  const content = cardMap[card.id];
                                  if (content === null || content === undefined) return null;
                                  return (
                                    <SortableStatCard
                                      key={card.id}
                                      id={card.id}
                                      editMode={editMode}
                                      visible={card.visible}
                                      onToggleVisibility={() => handleToggleCard(group.id as StatsGroupId, card.id)}
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
        })()}





        {activeCategory === 'charts' && (
          <div className="space-y-6">
            {currentType === 'all' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card bg-base-100 shadow-sm">
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

                <div className="card bg-base-100 shadow-sm">
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

                <div className="card bg-base-100 shadow-sm">
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
              </div>
            )}

            {showReadingMetrics &&
              userStats.readingSpeedData &&
              userStats.readingSpeedData.length > 0 && (
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body">
                    <h3 className="card-title text-xl mb-4">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      Reading Speed Over Time
                    </h3>
                    <div className="w-full" style={{ height: '400px' }}>
                      <SpeedChart
                        timeframe={timeRange === 'custom' ? 'total' : timeRange}
                        readingSpeedData={userStats.readingSpeedData}
                      />
                    </div>
                  </div>
                </div>
              )}

            <div className="card bg-base-100 shadow-sm">
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
                      timeframe={timeRange === 'custom' ? 'total' : timeRange}
                      statsData={statsByType}
                      selectedType={currentType}
                      metric={progressMetric}
                    />
                  ) : (
                    <StackedBarChart
                      statsData={statsByType}
                      selectedType={currentType}
                      metric={progressMetric}
                      timeframe={timeRange === 'custom' ? 'total' : timeRange}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsScreen;
