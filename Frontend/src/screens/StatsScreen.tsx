import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
	Filter,
	Flame,
	Gauge,
	Headphones,
	Layers,
	LineChart,
	PieChart as PieChartIcon,
	Scale,
	Star,
	Timer,
	TrendingUp,
	Zap,
} from 'lucide-react';
import { getUserStatsFn } from '../api/trackerApi';
import PieChart from '../components/PieChart';
import ProgressChart from '../components/ProgressChart';
import SpeedChart from '../components/SpeedChart';
import StackedBarChart from '../components/StackedBarChart';
import TagFilter from '../components/TagFilter';
import { useTimezone } from '../hooks/useTimezone';
import { OutletProfileContextType } from '../types';
import { numberWithCommas } from '../utils/utils';

const CATEGORY_OPTIONS = [
	{ id: 'overview', label: 'Overview', Icon: Gauge },
	{ id: 'charts', label: 'Charts', Icon: LineChart },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]['id'];

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'total' | 'custom';

type ReadingType = 'reading' | 'manga' | 'vn';
type EpisodeType = 'anime' | 'video' | 'movie';

const READING_TYPES: ReadonlyArray<ReadingType> = ['reading', 'manga', 'vn'];
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

const PIE_COLORS = [
	'hsl(221, 76%, 56%)',
	'hsl(199, 89%, 55%)',
	'hsl(166, 64%, 48%)',
	'hsl(41, 94%, 55%)',
	'hsl(348, 83%, 60%)',
	'hsl(280, 75%, 60%)',
	'hsl(24, 93%, 53%)',
	'hsl(28, 85%, 65%)',
	'hsl(162, 84%, 39%)',
];

function capitalizeType(value: string) {
	if (value === 'vn') return 'Visual Novel';
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

function buildPieDataset(entries: Array<{ label: string; value: number }>) {
	const sortedEntries = [...entries].sort((a, b) => b.value - a.value);
	const values = sortedEntries.map((entry) => entry.value);
	const labels = sortedEntries.map((entry) => entry.label);
	const colors = values.map(
		(_, index) => PIE_COLORS[index % PIE_COLORS.length],
	);

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

function StatsScreen() {
	const { username } = useOutletContext<OutletProfileContextType>();
	const [timeRange, setTimeRange] = useState<TimeRange>('total');
	const [currentType, setCurrentType] = useState<string>('all');
	const [activeCategory, setActiveCategory] = useState<CategoryId>('overview');
	const [progressChartView, setProgressChartView] = useState<'line' | 'bar'>(
		'line',
	);
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

	const readingTypeSet = useMemo(() => new Set<ReadingType>(READING_TYPES), []);
	const episodeTypeSet = useMemo(() => new Set<EpisodeType>(EPISODE_TYPES), []);

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

	const statsByType = useMemo(() => userStats?.statsByType ?? [], [userStats]);
	const currentTypeStats =
		currentType === 'all'
			? undefined
			: statsByType.find((stat) => stat.type === currentType);

	const showReadingMetrics =
		currentType === 'all' || readingTypeSet.has(currentType as ReadingType);
	const showPageMetric = currentType === 'all' || currentType === 'manga';
	const showEpisodeMetrics =
		currentType !== 'all' && episodeTypeSet.has(currentType as EpisodeType);

	const immersedDaysCount = useMemo(() => {
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
	}, [currentType, statsByType, userStats]);

	const readingImmersedDaysCount = useMemo(() => {
		if (!userStats || !showReadingMetrics) return 0;

		const relevantStats =
			currentType === 'all'
				? statsByType.filter((stat) =>
						readingTypeSet.has(stat.type as ReadingType),
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
	}, [currentType, readingTypeSet, showReadingMetrics, statsByType, userStats]);

	const dailyAverageHoursDisplay = useMemo(() => {
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
	}, [
		currentType,
		currentTypeStats,
		immersedDaysCount,
		onlyImmersedDays,
		userStats,
	]);

	const dailyAverageCharsDisplay = useMemo(() => {
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
	}, [
		currentType,
		currentTypeStats,
		onlyImmersedDays,
		readingImmersedDaysCount,
		showReadingMetrics,
		userStats,
	]);

	const avgReadingSpeed = useMemo(() => {
		if (!userStats || !userStats.totals.readingHours) return 0;

		const readingChars = statsByType
			.filter((stat) => readingTypeSet.has(stat.type as ReadingType))
			.reduce((sum, stat) => sum + (stat.totalChars || 0), 0);

		const hours = userStats.totals.readingHours || 0;
		if (!hours) return 0;

		return readingChars / hours;
	}, [readingTypeSet, statsByType, userStats]);

	const logCountData = useMemo(() => {
		return buildPieDataset(
			statsByType.map((stat) => ({
				label: capitalizeType(stat.type),
				value: stat.count || 0,
			})),
		);
	}, [statsByType]);

	const logTimeData = useMemo(() => {
		return buildPieDataset(
			statsByType.map((stat) => ({
				label: capitalizeType(stat.type),
				value: stat.totalTimeHours || 0,
			})),
		);
	}, [statsByType]);

	const logXpData = useMemo(() => {
		return buildPieDataset(
			statsByType.map((stat) => ({
				label: capitalizeType(stat.type),
				value: stat.totalXp || 0,
			})),
		);
	}, [statsByType]);

	const totalLogsValue = useMemo(() => {
		if (!userStats) return 0;
		if (currentType === 'all') return userStats.totals.totalLogs;
		return currentTypeStats?.count ?? 0;
	}, [currentType, currentTypeStats, userStats]);

	const totalTimeHours = useMemo(() => {
		if (!userStats) return 0;
		if (currentType === 'all') return userStats.totals.totalTimeHours;
		return currentTypeStats?.totalTimeHours ?? 0;
	}, [currentType, currentTypeStats, userStats]);

	const totalXp = useMemo(() => {
		if (!userStats) return 0;
		if (currentType === 'all') return userStats.totals.totalXp;
		return currentTypeStats?.totalXp ?? 0;
	}, [currentType, currentTypeStats, userStats]);

	const totalChars = useMemo(() => {
		if (!userStats) return 0;
		if (currentType === 'all') return userStats.totals.totalChars;
		return currentTypeStats?.totalChars ?? 0;
	}, [currentType, currentTypeStats, userStats]);

	const totalPages = useMemo(() => {
		if (!userStats) return 0;
		if (currentType === 'all') {
			return statsByType.reduce((sum, stat) => sum + (stat.totalPages ?? 0), 0);
		}
		return currentTypeStats?.totalPages ?? 0;
	}, [currentType, currentTypeStats, statsByType, userStats]);

	const currentTypeDisplay = capitalizeType(currentType);

	const logTypes = [
		'reading',
		'anime',
		'vn',
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
						<h1 className="text-3xl font-bold text-base-content">Statistics</h1>
						<p className="text-base-content/70">
							Track your immersion progress with detailed breakdowns and charts.
						</p>
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

				<div className="card bg-base-100 shadow-xl">
					<div className="card-body flex justify-between flex-row items-start">
						<div className="space-y-6">
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
								<div className="flex flex-wrap items-center gap-3">
									<div className="dropdown dropdown-bottom">
										<div tabIndex={0} role="button" className="btn btn-outline">
											<Calendar className="w-4 h-4" />
											{CATEGORY_LABELS[timeRange]}
											<ChevronDown className="w-4 h-4" />
										</div>
										<ul
											tabIndex={0}
											className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-60 border border-base-300"
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
														className={
															timeRange === option.value ? 'active' : ''
														}
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
																setStartDate(
																	formatDateForQuery(customStartDate),
																);
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
										<div tabIndex={0} role="button" className="btn btn-outline">
											<Filter className="w-4 h-4" />
											{currentTypeDisplay}
											<ChevronDown className="w-4 h-4" />
										</div>
										<ul
											tabIndex={0}
											className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-52 border border-base-300"
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

							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm text-base-content/60">View:</span>
								<div className="join">
									{CATEGORY_OPTIONS.map(({ id, label, Icon }) => (
										<button
											key={id}
											className={`join-item btn btn-sm ${activeCategory === id ? 'btn-primary' : 'btn-outline'}`}
											onClick={() => setActiveCategory(id)}
										>
											<Icon className="w-4 h-4" />
											{label}
										</button>
									))}
								</div>
							</div>
						</div>
						<label className="label cursor-pointer gap-2">
							<span className="label-text text-sm text-base-content">
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

				{activeCategory === 'overview' && (
					<div className="space-y-8">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
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
										{currentType === 'all'
											? `${PERIOD_LABELS[timeRange]} experience gained`
											: `${capitalizeType(currentType)} category experience`}
									</p>
								</div>
							</div>

							<div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
								<div className="card-body">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
												Time Spent
											</h3>
											<p className="text-3xl font-bold text-secondary mt-1">
												{numberWithCommas(
													parseFloat(totalTimeHours.toFixed(1)),
												)}
												<span className="text-lg text-base-content/70 ml-1">
													hours
												</span>
											</p>
										</div>
										<div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
											<Clock3 className="w-6 h-6 text-secondary" />
										</div>
									</div>
									<p className="text-xs text-base-content/60 mt-2">
										{currentType === 'all'
											? `${PERIOD_LABELS[timeRange]} immersion time`
											: `${capitalizeType(currentType)} immersion time`}
									</p>
								</div>
							</div>

							<div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
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
											{currentType === 'all'
												? 'Total log entries'
												: `${capitalizeType(currentType)} entries`}
										</p>
										{currentType === 'all' &&
											(userStats.totals.untrackedCount ?? 0) > 0 && (
												<span className="badge badge-warning badge-xs">
													{userStats.totals.untrackedCount} untracked
												</span>
											)}
									</div>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="card bg-base-100 shadow-lg">
								<div className="card-body">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
												Daily Average
											</h3>
											<p className="text-3xl font-bold text-secondary mt-1">
												{numberWithCommas(
													parseFloat(
														(dailyAverageHoursDisplay || 0).toFixed(2),
													),
												)}
												<span className="text-lg text-base-content/70 ml-1">
													days
												</span>
											</p>
										</div>
										<div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
											<Timer className="w-6 h-6 text-secondary" />
										</div>
									</div>
									<p className="text-xs text-base-content/60 mt-2">
										{(() => {
											const period = PERIOD_LABELS[timeRange];
											const typeLabel =
												currentType === 'all'
													? 'immersion'
													: `${currentType.toLowerCase()} immersion`;
											return `${period} daily ${typeLabel} average`;
										})()}
									</p>
								</div>
							</div>
							<div className="card bg-base-100 shadow-lg">
								<div className="card-body">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
												Current Streak
											</h3>
											<p className="text-3xl font-bold text-warning mt-1">
												{numberWithCommas(userStats.streaks.currentStreak ?? 0)}
												<span className="text-lg text-base-content/70 ml-1">
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

							<div className="card bg-base-100 shadow-lg">
								<div className="card-body">
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
												Longest Streak
											</h3>
											<p className="text-3xl font-bold text-info mt-1">
												{numberWithCommas(userStats.streaks.longestStreak ?? 0)}
												<span className="text-lg text-base-content/70 ml-1">
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
						</div>

						{currentType === 'all' && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
												<BookOpen className="w-4 h-4 text-info" />
											</div>
											<h3 className="font-semibold text-info">Reading</h3>
										</div>
										<p className="text-2xl font-bold">
											{numberWithCommas(
												parseFloat(userStats.totals.readingHours.toFixed(1)),
											)}
											<span className="text-sm font-normal text-base-content/70 ml-1">
												hours
											</span>
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											Reading, manga, and visual novels
										</p>
									</div>
								</div>

								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
												<Headphones className="w-4 h-4 text-success" />
											</div>
											<h3 className="font-semibold text-success">Listening</h3>
										</div>
										<p className="text-2xl font-bold">
											{numberWithCommas(
												parseFloat(userStats.totals.listeningHours.toFixed(1)),
											)}
											<span className="text-sm font-normal text-base-content/70 ml-1">
												hours
											</span>
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											Anime, video, audio, movies, and TV
										</p>
									</div>
								</div>

								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
												<Scale className="w-4 h-4 text-warning" />
											</div>
											<h3 className="font-semibold text-warning">Balance</h3>
										</div>
										<p className="text-2xl font-bold">
											{(() => {
												const readingHours = userStats.totals.readingHours;
												const listeningHours = userStats.totals.listeningHours;
												const combined = readingHours + listeningHours;
												if (combined <= 0) return '0:0';
												const readingRatio = Math.round(
													(readingHours / combined) * 10,
												);
												const listeningRatio = 10 - readingRatio;
												return `${readingRatio}:${listeningRatio}`;
											})()}
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											Reading vs. listening ratio
										</p>
									</div>
								</div>
							</div>
						)}

						{showEpisodeMetrics && (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
												<Clapperboard className="w-5 h-5 text-accent" />
											</div>
											<h3 className="font-semibold text-accent">
												{currentType === 'anime'
													? 'Episodes'
													: currentType === 'movie'
														? 'Movies'
														: 'Videos'}
											</h3>
										</div>
										<p className="text-2xl font-bold">
											{(() => {
												const typeStats = statsByType.find(
													(stat) => stat.type === currentType,
												);
												return numberWithCommas(typeStats?.totalEpisodes || 0);
											})()}
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											Total {currentType}{' '}
											{currentType === 'anime'
												? 'episodes'
												: currentType === 'movie'
													? 'movies'
													: 'videos'}{' '}
											watched
										</p>
									</div>
								</div>
							</div>
						)}

						{showReadingMetrics && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
								<div className="card bg-base-100 shadow-lg">
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
											{numberWithCommas(Math.round(avgReadingSpeed || 0))}
											<span className="text-sm font-normal text-base-content/70 ml-1">
												chars/hr
											</span>
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											Based on reading, manga, and visual novels
										</p>
									</div>
								</div>
								<div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
									<div className="card-body">
										<div className="mb-2">
											<div className="flex items-center gap-3">
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
													Daily Average Characters
												</h3>
											</div>
										</div>
										<p className="text-2xl font-bold">
											{numberWithCommas(
												Math.round(dailyAverageCharsDisplay || 0),
											)}
											<span className="text-sm font-normal text-base-content/70 ml-1">
												chars
											</span>
										</p>
										<p className="text-xs text-base-content/60 mt-1">
											{(() => {
												const period = PERIOD_LABELS[timeRange];
												const typeLabel =
													currentType === 'all'
														? 'reading'
														: `${currentType.toLowerCase()} reading`;
												return `${period} daily ${typeLabel} average`;
											})()}
										</p>
									</div>
								</div>

								<div className="card bg-base-100 shadow-lg">
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
											{currentType === 'all'
												? 'Characters across all reading types'
												: `Characters in ${currentType.toLowerCase()} logs`}
										</p>
									</div>
								</div>

								{showPageMetric && (
									<div className="card bg-base-100 shadow-lg">
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
												{currentType === 'all'
													? 'Total pages recorded across reading logs'
													: `Total pages read in ${currentTypeDisplay.toLowerCase()} logs`}
											</p>
										</div>
									</div>
								)}

								{currentType !== 'all' && (
									<div className="card bg-base-100 shadow-lg">
										<div className="card-body">
											<div className="flex items-center gap-3 mb-2">
												<div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
													<Gauge className="w-5 h-5 text-primary" />
												</div>
												<h3 className="font-semibold text-primary">
													Avg Reading Speed
												</h3>
											</div>
											<p className="text-2xl font-bold">
												{numberWithCommas(Math.round(avgReadingSpeed || 0))}
												<span className="text-sm font-normal text-base-content/70 ml-1">
													chars/hr
												</span>
											</p>
											<p className="text-xs text-base-content/60 mt-1">
												Based on reading, manga, and visual novels
											</p>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{activeCategory === 'charts' && (
					<div className="space-y-6">
						{currentType === 'all' && (
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<h3 className="card-title text-lg mb-4">
											<PieChartIcon className="w-5 h-5 text-primary" />
											Log Count
										</h3>
										<div className="h-64">
											<PieChart data={logCountData} />
										</div>
									</div>
								</div>

								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<h3 className="card-title text-lg mb-4">
											<Clock3 className="w-5 h-5 text-primary" />
											Time Distribution
										</h3>
										<div className="h-64">
											<PieChart data={logTimeData} />
										</div>
									</div>
								</div>

								<div className="card bg-base-100 shadow-lg">
									<div className="card-body">
										<h3 className="card-title text-lg mb-4">
											<Zap className="w-5 h-5 text-primary" />
											XP Distribution
										</h3>
										<div className="h-64">
											<PieChart data={logXpData} />
										</div>
									</div>
								</div>
							</div>
						)}

						{showReadingMetrics &&
							userStats.readingSpeedData &&
							userStats.readingSpeedData.length > 0 && (
								<div className="card bg-base-100 shadow-lg">
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

						<div className="card bg-base-100 shadow-lg">
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
