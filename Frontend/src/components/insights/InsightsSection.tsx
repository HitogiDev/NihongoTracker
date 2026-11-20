import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ChartData, Point } from "chart.js";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Gauge,
  Info,
  Lock,
  Mountain,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  compareInsightPeriodsFn,
  getInsightsFn,
  updateInsightsDigestFn,
} from "../../api/insightsApi";
import type {
  IInsightsComfortTimeline,
  IInsightsComparisonResponse,
  IInsightsResponse,
  IInsightsSpeedComparison,
  IInsightsSpeedPoint,
} from "../../types";
import { useUserDataStore } from "../../store/userData";
import { useTimezone } from "../../hooks/useTimezone";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getMediaTypeColor } from "../../constants/mediaColors";
import { getLogTypeLabelKey } from "../../utils/logTypes";
import {
  getDayKeyInTimezone,
  getLocale,
  shiftByDayStart,
} from "../../utils/timezone";
import { hasEnthusiastAccess } from "../../utils/premiumAccess";
import { numberWithCommas } from "../../utils/utils";
import LineChart from "../LineChart";
import DropdownSelect from "../ui/DropdownSelect";
import DatePickerInput from "../ui/DatePickerInput";
import { Skeleton } from "../ui/Skeleton";

const COMPARE_MONTHS = [3, 6, 12] as const;
const BAND_COLORS = ["success", "info", "primary", "warning", "error"] as const;

type PresetId =
  | "monthVsLastYear"
  | "monthVsLastMonth"
  | "quarterVsLastQuarter"
  | "quarterVsLastYear"
  | "yearVsLastYear"
  | "custom";

const PRESETS: PresetId[] = [
  "monthVsLastYear",
  "monthVsLastMonth",
  "quarterVsLastQuarter",
  "quarterVsLastYear",
  "yearVsLastYear",
  "custom",
];

// ─── Date helpers on YYYY-MM-DD keys ─────────────────────────────────────────

function toUtc(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function keyFrom(year: number, monthIndex: number, day: number): string {
  return toKey(new Date(Date.UTC(year, monthIndex, day)));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(key: string, days: number): string {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

function dayOffset(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86400000);
}

/** Clamp a day to the length of a month, so a 31st maps to the 30th. */
function sameDayInMonth(year: number, monthIndex: number, day: number): string {
  const normalized = new Date(Date.UTC(year, monthIndex, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  return keyFrom(y, m, Math.min(day, daysInMonth(y, m)));
}

interface PeriodPair {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
}

/**
 * Presets compare periods to date: both periods cover the same number of days.
 * A partial current period is then compared fairly with a finished period.
 */
function presetPeriods(
  preset: Exclude<PresetId, "custom">,
  today: string,
): PeriodPair {
  const date = toUtc(today);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const monthStart = keyFrom(year, month, 1);
  const quarterStart = keyFrom(year, Math.floor(month / 3) * 3, 1);

  const sameLength = (start: string, baseStart: string) =>
    addDays(baseStart, dayOffset(start, today));

  switch (preset) {
    case "monthVsLastYear":
      return {
        aStart: monthStart,
        aEnd: today,
        bStart: keyFrom(year - 1, month, 1),
        bEnd: sameDayInMonth(year - 1, month, day),
      };
    case "monthVsLastMonth":
      return {
        aStart: monthStart,
        aEnd: today,
        bStart: keyFrom(year, month - 1, 1),
        bEnd: sameDayInMonth(year, month - 1, day),
      };
    case "quarterVsLastQuarter": {
      const quarterMonth = Math.floor(month / 3) * 3;
      const base = keyFrom(year, quarterMonth - 3, 1);
      const end = sameLength(quarterStart, base);
      const lastDay = addDays(quarterStart, -1);
      return {
        aStart: quarterStart,
        aEnd: today,
        bStart: base,
        bEnd: end > lastDay ? lastDay : end,
      };
    }
    case "quarterVsLastYear": {
      const quarterMonth = Math.floor(month / 3) * 3;
      const base = keyFrom(year - 1, quarterMonth, 1);
      const end = sameLength(quarterStart, base);
      return { aStart: quarterStart, aEnd: today, bStart: base, bEnd: end };
    }
    case "yearVsLastYear":
      return {
        aStart: keyFrom(year, 0, 1),
        aEnd: today,
        bStart: keyFrom(year - 1, 0, 1),
        bEnd: sameDayInMonth(year - 1, month, day),
      };
  }
}

// ─── Small display pieces ────────────────────────────────────────────────────

function ChangeBadge({
  value,
  unit = "%",
}: {
  value: number | null;
  unit?: string;
}) {
  if (value === null) {
    return <span className="badge badge-ghost badge-sm">-</span>;
  }
  const rounded = Math.round(value * 10) / 10;
  const className =
    rounded > 0
      ? "badge badge-success badge-soft badge-sm"
      : rounded < 0
        ? "badge badge-error badge-soft badge-sm"
        : "badge badge-ghost badge-sm";
  const Icon =
    rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className={`${className} gap-1 tabular-nums`}>
      <Icon className="h-3 w-3" />
      {rounded > 0 ? "+" : ""}
      {rounded}
      {unit}
    </span>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <div className="surface-muted rounded-box p-3">
      <div className="text-xs text-base-content/70">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-base-content/70">{hint}</div>
      ) : null}
    </div>
  );
}

function useMonthLabels(months: string[]) {
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(getLocale(), {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return months.map((key) => {
      const [year, month] = key.split("-").map(Number);
      return formatter.format(new Date(Date.UTC(year, month - 1, 1)));
    });
  }, [months]);
}

function speedSeries(points: IInsightsSpeedPoint[]) {
  return points.map((point) => point.charsPerHour);
}

// ─── Locked state ────────────────────────────────────────────────────────────

function LockedInsights() {
  const { t } = useTranslation("stats");
  const features = [
    { Icon: Gauge, key: "insights.locked.speed" },
    { Icon: Mountain, key: "insights.locked.comfort" },
    { Icon: Scale, key: "insights.locked.compare" },
    { Icon: BellRing, key: "insights.locked.digest" },
  ] as const;
  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-secondary" />
          <h2 className="card-title">{t("insights.title")}</h2>
          <span className="badge badge-secondary badge-sm">
            {t("insights.locked.badge")}
          </span>
        </div>
        <p className="text-base-content/70">
          {t("insights.locked.description")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map(({ Icon, key }) => (
            <li
              key={key}
              className="surface-muted flex items-start gap-3 rounded-box p-3"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{t(key)}</span>
            </li>
          ))}
        </ul>
        <div>
          <Link to="/support" className="btn btn-primary">
            <Sparkles className="h-4 w-4" />
            {t("insights.locked.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Reading speed ───────────────────────────────────────────────────────────

function speedHeadline(
  comparison: IInsightsSpeedComparison,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (comparison.changePct === null) {
    return t("insights.speed.notEnoughData", { months: comparison.monthsAgo });
  }
  const change = Math.abs(Math.round(comparison.changePct));
  if (change < 3) {
    return t("insights.speed.same", { months: comparison.monthsAgo });
  }
  return t(
    comparison.changePct > 0
      ? "insights.speed.faster"
      : "insights.speed.slower",
    { change, months: comparison.monthsAgo },
  );
}

function ReadingSpeedCard({
  data,
  compareMonths,
  onCompareMonthsChange,
}: {
  data: IInsightsResponse;
  compareMonths: number;
  onCompareMonthsChange: (months: number) => void;
}) {
  const { t } = useTranslation("stats");
  const { t: tCommon } = useTranslation("common");
  const tKey = t as unknown as (
    key: string,
    options?: Record<string, unknown>,
  ) => string;
  const colors = useThemeColors(1);
  const labels = useMonthLabels(data.months);
  const { readingSpeed } = data;
  const typeLabel = (type: string) => {
    const key = getLogTypeLabelKey(type);
    return key ? tCommon(key) : type;
  };
  const cph = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "-"
      : t("insights.speed.value", { value: numberWithCommas(value) });

  const typeChart: ChartData<"line", (number | Point | null)[]> = {
    labels,
    datasets: [
      {
        label: t("insights.speed.allReading"),
        data: speedSeries(readingSpeed.overall),
        borderColor: colors.baseContent,
        backgroundColor: colors.baseContent,
        borderDash: [6, 4],
        spanGaps: true,
      },
      ...readingSpeed.byType
        .filter((entry) =>
          entry.points.some((point) => point.charsPerHour !== null),
        )
        .slice(0, 5)
        .map((entry) => ({
          label: typeLabel(entry.type),
          data: speedSeries(entry.points),
          borderColor: getMediaTypeColor(entry.type),
          backgroundColor: getMediaTypeColor(entry.type),
          spanGaps: true,
        })),
    ],
  };

  const difficultyChart: ChartData<"line", (number | Point | null)[]> = {
    labels,
    datasets: readingSpeed.byDifficulty
      .filter((entry) =>
        entry.points.some((point) => point.charsPerHour !== null),
      )
      .map((entry) => ({
        label: t("insights.speed.band", {
          from: entry.band,
          to: entry.band + 1,
        }),
        data: speedSeries(entry.points),
        borderColor: colors[BAND_COLORS[entry.band] ?? "primary"],
        backgroundColor: colors[BAND_COLORS[entry.band] ?? "primary"],
        spanGaps: true,
      })),
  };

  const hasSpeedData = readingSpeed.overall.some(
    (point) => point.charsPerHour !== null,
  );

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="card-title">
            <Gauge className="h-5 w-5" />
            {t("insights.speed.title")}
          </h2>
          <div className="join">
            {COMPARE_MONTHS.map((months) => (
              <button
                key={months}
                type="button"
                className={
                  months === compareMonths
                    ? "join-item btn btn-primary btn-sm"
                    : "join-item btn btn-outline btn-sm"
                }
                onClick={() => onCompareMonthsChange(months)}
              >
                {t("insights.speed.monthsAgo", { count: months })}
              </button>
            ))}
          </div>
        </div>

        {readingSpeed.comparison.changePct === null ? (
          <div
            role="note"
            className="flex items-start gap-2 text-sm text-base-content/70"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div>
              <p>{speedHeadline(readingSpeed.comparison, tKey)}</p>
              <p className="text-xs text-base-content/70">
                {t("insights.speed.windows", {
                  current: readingSpeed.comparison.current
                    ? cph(readingSpeed.comparison.current.charsPerHour)
                    : t("insights.speed.noData"),
                  previous: readingSpeed.comparison.previous
                    ? cph(readingSpeed.comparison.previous.charsPerHour)
                    : t("insights.speed.noData"),
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="surface-muted rounded-box p-4">
            <p className="text-lg font-semibold">
              {speedHeadline(readingSpeed.comparison, tKey)}
            </p>
            <p className="mt-1 text-sm text-base-content/70">
              {t("insights.speed.windows", {
                current: readingSpeed.comparison.current
                  ? cph(readingSpeed.comparison.current.charsPerHour)
                  : t("insights.speed.noData"),
                previous: readingSpeed.comparison.previous
                  ? cph(readingSpeed.comparison.previous.charsPerHour)
                  : t("insights.speed.noData"),
              })}
            </p>
          </div>
        )}

        {readingSpeed.byType.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readingSpeed.byType.map((entry) => (
              <StatTile
                key={entry.type}
                label={typeLabel(entry.type)}
                value={cph(
                  entry.comparison.current?.charsPerHour ?? entry.charsPerHour,
                )}
                hint={
                  entry.comparison.changePct !== null ? (
                    <span className="flex items-center gap-2">
                      <ChangeBadge value={entry.comparison.changePct} />
                      {t("insights.speed.vsMonthsAgo", {
                        count: compareMonths,
                      })}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}

        {hasSpeedData ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-base-content/70">
                {t("insights.speed.byType")}
              </h3>
              <LineChart data={typeChart} compact />
            </div>
            <div className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-base-content/70">
                {t("insights.speed.byDifficulty")}
              </h3>
              {difficultyChart.datasets.length ? (
                <LineChart data={difficultyChart} compact />
              ) : (
                <p className="text-sm text-base-content/70">
                  {t("insights.speed.noDifficulty")}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-base-content/70">
            {t("insights.speed.empty")}
          </p>
        )}
        <p className="text-xs text-base-content/70">
          {t("insights.speed.note")}
        </p>
      </div>
    </section>
  );
}

// ─── Comfort difficulty ──────────────────────────────────────────────────────

function ComfortCard({ data }: { data: IInsightsResponse }) {
  const { t } = useTranslation("stats");
  const colors = useThemeColors(1);
  const labels = useMonthLabels(data.months);

  const chartFor = (
    timeline: IInsightsComfortTimeline,
  ): ChartData<"line", (number | Point | null)[]> => ({
    labels,
    datasets: [
      {
        label: t("insights.comfort.comfort"),
        data: timeline.points.map((point) => point.comfort),
        borderColor: colors.primary,
        backgroundColor: colors.primary,
      },
      {
        label: t("insights.comfort.consumed"),
        data: timeline.points.map((point) => point.monthDifficulty),
        borderColor: colors.secondary,
        backgroundColor: colors.secondary,
        borderDash: [6, 4],
        spanGaps: true,
      },
    ],
  });

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <h2 className="card-title">
          <Mountain className="h-5 w-5" />
          {t("insights.comfort.title")}
        </h2>
        <p className="text-sm text-base-content/70">
          {t("insights.comfort.description")}
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {data.comfort.map((timeline) => (
            <div key={timeline.category} className="min-w-0 space-y-3">
              <StatTile
                label={t(
                  timeline.category === "reading"
                    ? "insights.comfort.reading"
                    : "insights.comfort.listening",
                )}
                value={
                  timeline.current
                    ? t("insights.comfort.jiten", {
                        value: timeline.current.comfort.toFixed(2),
                      })
                    : "-"
                }
                hint={
                  <span className="flex items-center gap-2">
                    <ChangeBadge value={timeline.change} unit="" />
                    {t("insights.comfort.since", { month: labels[0] })}
                  </span>
                }
              />
              <LineChart data={chartFor(timeline)} compact />
            </div>
          ))}
        </div>
        <p className="text-xs text-base-content/70">
          {t("insights.comfort.note")}
        </p>
      </div>
    </section>
  );
}

// ─── Period comparison ───────────────────────────────────────────────────────

function PeriodComparisonCard() {
  const { t } = useTranslation("stats");
  const { t: tCommon } = useTranslation("common");
  const tKey = t as unknown as (key: string) => string;
  const { timezone, dayStartHour } = useTimezone();
  const today = useMemo(
    () =>
      getDayKeyInTimezone(shiftByDayStart(new Date(), dayStartHour), timezone),
    [timezone, dayStartHour],
  );
  const [preset, setPreset] = useState<PresetId>("monthVsLastYear");
  const [custom, setCustom] = useState<PeriodPair>(() =>
    presetPeriods("monthVsLastMonth", today),
  );
  const periods = preset === "custom" ? custom : presetPeriods(preset, today);
  const valid =
    Boolean(periods.aStart && periods.aEnd && periods.bStart && periods.bEnd) &&
    periods.aStart <= periods.aEnd &&
    periods.bStart <= periods.bEnd;

  const query = useQuery({
    queryKey: ["insights", "compare", periods],
    queryFn: () => compareInsightPeriodsFn(periods),
    enabled: valid,
    staleTime: 60_000,
  });

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(getLocale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    [],
  );
  const range = (start: string, end: string) =>
    `${dateFormatter.format(toUtc(start))} - ${dateFormatter.format(toUtc(end))}`;
  const hours = (minutes: number) =>
    `${numberWithCommas(Math.round((minutes / 60) * 10) / 10)} h`;

  const rows = (data: IInsightsComparisonResponse) => [
    {
      key: "xp",
      label: t("insights.compare.xp"),
      a: numberWithCommas(data.a.xp),
      b: numberWithCommas(data.b.xp),
      change: data.change.xp,
    },
    {
      key: "time",
      label: t("insights.compare.time"),
      a: hours(data.a.time),
      b: hours(data.b.time),
      change: data.change.time,
    },
    {
      key: "reading",
      label: t("insights.compare.readingTime"),
      a: hours(data.a.readingTime),
      b: hours(data.b.readingTime),
      change: undefined,
    },
    {
      key: "listening",
      label: t("insights.compare.listeningTime"),
      a: hours(data.a.listeningTime),
      b: hours(data.b.listeningTime),
      change: undefined,
    },
    {
      key: "chars",
      label: t("insights.compare.chars"),
      a: numberWithCommas(data.a.chars),
      b: numberWithCommas(data.b.chars),
      change: data.change.chars,
    },
    {
      key: "days",
      label: t("insights.compare.activeDays"),
      a: `${data.a.activeDays} / ${data.a.days}`,
      b: `${data.b.activeDays} / ${data.b.days}`,
      change: data.change.activeDays,
    },
    {
      key: "speed",
      label: t("insights.compare.speed"),
      a: data.a.charsPerHour ? numberWithCommas(data.a.charsPerHour) : "-",
      b: data.b.charsPerHour ? numberWithCommas(data.b.charsPerHour) : "-",
      change: data.change.charsPerHour,
    },
    {
      key: "logs",
      label: t("insights.compare.logs"),
      a: numberWithCommas(data.a.logs),
      b: numberWithCommas(data.b.logs),
      change: undefined,
    },
    {
      key: "achievements",
      label: t("insights.compare.achievements"),
      a: String(data.a.achievements),
      b: String(data.b.achievements),
      change: undefined,
    },
  ];

  const typeRows = (data: IInsightsComparisonResponse) => {
    const types = Array.from(
      new Set([...data.a.byType, ...data.b.byType].map((entry) => entry.type)),
    );
    return types
      .map((type) => {
        const a = data.a.byType.find((entry) => entry.type === type)?.time ?? 0;
        const b = data.b.byType.find((entry) => entry.type === type)?.time ?? 0;
        const key = getLogTypeLabelKey(type);
        return { type, label: key ? tCommon(key) : type, a, b };
      })
      .sort((first, second) => second.a + second.b - (first.a + first.b));
  };

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="card-title">
            <Scale className="h-5 w-5" />
            {t("insights.compare.title")}
          </h2>
          <DropdownSelect
            className="btn btn-outline btn-sm w-full sm:w-80"
            value={preset}
            onChange={(event) => setPreset(event.target.value as PresetId)}
            aria-label={t("insights.compare.preset")}
          >
            {PRESETS.map((id) => (
              <option key={id} value={id}>
                {tKey(`insights.compare.presets.${id}`)}
              </option>
            ))}
          </DropdownSelect>
        </div>

        {preset === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <div
                key={side}
                className="surface-muted space-y-2 rounded-box p-3"
              >
                <div className="text-sm font-semibold">
                  {t(
                    side === "a"
                      ? "insights.compare.periodA"
                      : "insights.compare.periodB",
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DatePickerInput
                    size="sm"
                    ariaLabel={t("insights.compare.start")}
                    value={custom[`${side}Start`]}
                    max={today}
                    onChange={(value) =>
                      setCustom((previous) => ({
                        ...previous,
                        [`${side}Start`]: value,
                      }))
                    }
                  />
                  <DatePickerInput
                    size="sm"
                    ariaLabel={t("insights.compare.end")}
                    value={custom[`${side}End`]}
                    max={today}
                    onChange={(value) =>
                      setCustom((previous) => ({
                        ...previous,
                        [`${side}End`]: value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {!valid ? (
          <p className="text-sm text-error">{t("insights.compare.invalid")}</p>
        ) : query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : query.isError || !query.data ? (
          <p className="text-sm text-error">{t("insights.compare.error")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th />
                    <th>
                      <div>{t("insights.compare.periodA")}</div>
                      <div className="font-normal text-base-content/70">
                        {range(query.data.a.startKey, query.data.a.endKey)}
                      </div>
                    </th>
                    <th>
                      <div>{t("insights.compare.periodB")}</div>
                      <div className="font-normal text-base-content/70">
                        {range(query.data.b.startKey, query.data.b.endKey)}
                      </div>
                    </th>
                    <th>{t("insights.compare.change")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows(query.data).map((row) => (
                    <tr key={row.key}>
                      <td className="text-base-content/70">{row.label}</td>
                      <td className="font-semibold tabular-nums">{row.a}</td>
                      <td className="tabular-nums">{row.b}</td>
                      <td>
                        {row.change !== undefined ? (
                          <ChangeBadge value={row.change} />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {typeRows(query.data).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-base-content/70">
                  {t("insights.compare.byType")}
                </h3>
                {typeRows(query.data).map((row) => {
                  const max = Math.max(row.a, row.b, 1);
                  return (
                    <div
                      key={row.type}
                      className="grid grid-cols-[6rem_1fr] items-center gap-3 text-sm"
                    >
                      <span className="truncate">{row.label}</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <progress
                            className="progress progress-primary h-2 flex-1"
                            value={row.a}
                            max={max}
                          />
                          <span className="w-16 text-right tabular-nums">
                            {hours(row.a)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <progress
                            className="progress h-2 flex-1 opacity-60"
                            value={row.b}
                            max={max}
                          />
                          <span className="w-16 text-right tabular-nums text-base-content/70">
                            {hours(row.b)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Digest settings ─────────────────────────────────────────────────────────

function DigestCard({ data }: { data: IInsightsResponse }) {
  const { t } = useTranslation("stats");
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: updateInsightsDigestFn,
    onSuccess: (digest) => {
      queryClient.setQueriesData<IInsightsResponse>(
        { queryKey: ["insights", "overview"] },
        (previous) => (previous ? { ...previous, digest } : previous),
      );
    },
  });
  const options = [
    {
      key: "weekly",
      label: "insights.digest.weekly",
      description: "insights.digest.weeklyDescription",
    },
    {
      key: "monthly",
      label: "insights.digest.monthly",
      description: "insights.digest.monthlyDescription",
    },
  ] as const;

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <h2 className="card-title">
          <BellRing className="h-5 w-5" />
          {t("insights.digest.title")}
        </h2>
        <p className="text-sm text-base-content/70">
          {t("insights.digest.description")}
        </p>
        <ul className="flex flex-col gap-3">
          {options.map((option) => (
            <li key={option.key}>
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block font-medium">{t(option.label)}</span>
                  <span className="block text-sm text-base-content/70">
                    {t(option.description)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={data.digest[option.key]}
                  disabled={update.isPending}
                  onChange={(event) =>
                    update.mutate({ [option.key]: event.target.checked })
                  }
                />
              </label>
            </li>
          ))}
        </ul>
        {update.isError && (
          <p className="text-sm text-error">{t("insights.digest.error")}</p>
        )}
      </div>
    </section>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function InsightsSection() {
  const { t } = useTranslation("stats");
  const { user } = useUserDataStore();
  const canUse = hasEnthusiastAccess(user);
  const [compareMonths, setCompareMonths] = useState<number>(6);
  const query = useQuery({
    queryKey: ["insights", "overview", compareMonths],
    queryFn: () => getInsightsFn(compareMonths),
    enabled: canUse,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
    retry: false,
  });

  if (!canUse) return <LockedInsights />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <Lock className="h-4 w-4" />
        {t("insights.private")}
      </div>
      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : query.isError || !query.data ? (
        <div className="alert alert-error">{t("insights.error")}</div>
      ) : (
        <>
          <ReadingSpeedCard
            data={query.data}
            compareMonths={compareMonths}
            onCompareMonthsChange={setCompareMonths}
          />
          <ComfortCard data={query.data} />
          <PeriodComparisonCard />
          <DigestCard data={query.data} />
        </>
      )}
    </div>
  );
}
