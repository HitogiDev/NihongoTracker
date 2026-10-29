import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarRange, NotebookPen, Plus, Search, X } from "lucide-react";
import { getUserLogsFn } from "../api/trackerApi";
import { useUserDataStore } from "../store/userData";
import type { ILog } from "../types";
import LogCard from "../components/LogCard";
import { BulkLogToolbar, SelectableLogRow } from "../components/BulkLogEdit";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Modal from "../components/ui/Modal";
import DatePickerInput from "../components/ui/DatePickerInput";
import InfiniteScrollSentinel from "../components/ui/InfiniteScrollSentinel";
import { SkeletonCard } from "../components/ui/Skeleton";
import { useTimezone } from "../hooks/useTimezone";
import { useNativePageState } from "./useNativePageState";
import { getLogTypeLabelKey } from "../utils/logTypes";

const types: ILog["type"][] = [
  "anime",
  "manga",
  "light-novel",
  "reading",
  "book",
  "vn",
  "game",
  "video",
  "movie",
  "tv show",
  "audio",
  "other",
];
interface Filters {
  search: string;
  type: string;
  start: string;
  end: string;
}
const emptyFilters: Filters = { search: "", type: "", start: "", end: "" };
const PERIODS = [
  { key: "today", days: 1, label: "native.today" },
  { key: "week", days: 7, label: "native.last7Days" },
  { key: "month", days: 30, label: "native.last30Days" },
] as const;

/** Format a day as YYYY-MM-DD in the given time zone. */
function dayInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}
function periodRange(days: number, timeZone: string) {
  const now = Date.now();
  return {
    start: dayInZone(new Date(now - (days - 1) * 86_400_000), timeZone),
    end: dayInZone(new Date(now), timeZone),
  };
}

export default function NativeRecordsScreen() {
  const { t } = useTranslation("nav");
  const { t: lt } = useTranslation("common");
  const user = useUserDataStore((store) => store.user);
  const [filters, setFilters] = useNativePageState<Filters>(
    "records:filters",
    emptyFilters,
  );
  const { timezone } = useTimezone();
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState(filters.search);
  useEffect(() => {
    if (searchText === filters.search) return undefined;
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: searchText.trim() })),
      350,
    );
    return () => clearTimeout(timer);
  }, [searchText, filters.search, setFilters]);
  const activePeriod = useMemo(
    () =>
      PERIODS.find((period) => {
        const range = periodRange(period.days, timezone);
        return range.start === filters.start && range.end === filters.end;
      })?.key,
    [filters.start, filters.end, timezone],
  );
  const customDates = Boolean(
    (filters.start || filters.end) && !activePeriod,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const query = useInfiniteQuery({
    queryKey: ["logs", user?.username, "native-records", filters],
    queryFn: ({ pageParam }) =>
      getUserLogsFn(user!.username, {
        page: pageParam,
        limit: 20,
        sortBy: "date",
        sortDirection: "desc",
        search: filters.search || undefined,
        type: (filters.type || undefined) as ILog["type"] | undefined,
        start: filters.start || undefined,
        end: filters.end || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (page, pages) =>
      page.filter((log) => !log.offlineStatus).length >= 20
        ? pages.length + 1
        : undefined,
    enabled: Boolean(user),
  });
  const unique = new Map(
    (query.data?.pages.flat() ?? []).map((log) => [log._id, log]),
  );
  const logs = Array.from(unique.values()).sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  const resetFilters = () => {
    setSearchText("");
    setFilters(emptyFilters);
  };
  const filtered = Boolean(
    filters.search || filters.type || filters.start || filters.end,
  );
  return (
    <section className="native-page space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="input min-w-0 flex-1 focus-within:input-primary">
            <Search className="h-4 w-4 shrink-0 text-base-content/60" />
            <input
              type="search"
              className="grow"
              placeholder={t("native.searchLogs")}
              aria-label={t("native.searchLogs")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                aria-label={t("native.reset")}
                onClick={() => {
                  setSearchText("");
                  setFilters((current) => ({ ...current, search: "" }));
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <Button
            appearance={customDates ? "solid" : "outline"}
            variant={customDates ? "primary" : "default"}
            shape="square"
            aria-label={t("native.customDates")}
            aria-pressed={customDates}
            onClick={() => {
              setDraft(filters);
              setOpen(true);
            }}
          >
            <CalendarRange className="h-5 w-5" />
          </Button>
        </div>
        <div
          className="native-chip-row flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t("native.filters")}
        >
          {PERIODS.map((period) => (
            <Button
              key={period.key}
              size="sm"
              className="native-chip shrink-0 rounded-full"
              variant={activePeriod === period.key ? "primary" : "default"}
              appearance={activePeriod === period.key ? "solid" : "outline"}
              aria-pressed={activePeriod === period.key}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  ...(activePeriod === period.key
                    ? { start: "", end: "" }
                    : periodRange(period.days, timezone)),
                }))
              }
            >
              {t(period.label)}
            </Button>
          ))}
          {customDates && (
            <Button
              size="sm"
              variant="primary"
              className="native-chip shrink-0 rounded-full"
              aria-label={t("native.reset")}
              onClick={() =>
                setFilters((current) => ({ ...current, start: "", end: "" }))
              }
            >
              {[filters.start, filters.end].filter(Boolean).join(" - ")}
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div
          className="native-chip-row flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t("native.allTypes")}
        >
          {["", ...types].map((type) => (
            <Button
              key={type || "all"}
              size="sm"
              className="native-chip shrink-0 rounded-full"
              variant={filters.type === type ? "primary" : "default"}
              appearance={filters.type === type ? "solid" : "outline"}
              aria-pressed={filters.type === type}
              onClick={() => setFilters((current) => ({ ...current, type }))}
            >
              {type
                ? lt(getLogTypeLabelKey(type as ILog["type"]) ?? "mediaTypes.other")
                : t("native.allTypes")}
            </Button>
          ))}
        </div>
      </div>
      {query.isPending && (
        <div className="space-y-3" role="status" aria-busy="true">
          {[0, 1, 2, 3].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      )}
      {query.isError && (
        <div className="alert alert-error flex flex-col items-start">
          <p>
            {navigator.onLine ? t("native.unavailable") : t("native.offline")}
          </p>
          <Button onClick={() => void query.refetch()}>
            {t("native.retry")}
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && !logs.length && (
        <div className="surface p-6 text-center space-y-3">
          <NotebookPen className="mx-auto h-8 w-8 text-base-content/50" />
          <h2 className="font-semibold">
            {filtered ? t("native.noResults") : t("native.emptyLogs")}
          </h2>
          <p className="text-sm text-base-content/65">
            {t("native.emptyLogsHint")}
          </p>
          {filtered ? (
            <Button onClick={resetFilters}>{t("native.reset")}</Button>
          ) : (
            <Link
              to="/log"
              state={{ nativeFrom: "/records" }}
              className="btn btn-primary"
            >
              <Plus className="h-5 w-5" />
              {t("native.logFirst")}
            </Link>
          )}
        </div>
      )}
      <div className="space-y-3">
        {logs.length > 0 && <BulkLogToolbar
          shownIds={logs.filter((log) => !log.offlineStatus).map((log) => log._id)}
          loadAllIds={async () => {
            const all = await getUserLogsFn(user!.username, {
              page: 1,
              limit: 0,
              search: filters.search || undefined,
              type: (filters.type || undefined) as ILog["type"] | undefined,
              start: filters.start || undefined,
              end: filters.end || undefined,
            });
            return all.filter((log) => !log.offlineStatus).map((log) => log._id);
          }}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          ownerUsername={user?.username}
          scopeKey={JSON.stringify([user?.username, filters])}
        />}
        {logs.map((log) => (
          log.offlineStatus ? <LogCard key={log._id} log={log} user={user?.username} /> :
          <SelectableLogRow key={log._id} ids={[log._id]} selectedIds={selectedIds} setSelectedIds={setSelectedIds}>
            <LogCard log={log} user={user?.username} selectionMode={selectedIds.size > 0} />
          </SelectableLogRow>
        ))}
      </div>
      <InfiniteScrollSentinel
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("native.customDates")}
        actions={
          <>
            <Button
              appearance="ghost"
              onClick={() => setDraft({ ...draft, start: "", end: "" })}
            >
              {t("native.reset")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setFilters((current) => ({
                  ...current,
                  start: draft.start,
                  end: draft.end,
                }));
                setOpen(false);
              }}
            >
              {t("native.apply")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("native.startDate")}>
            <DatePickerInput
              value={draft.start}
              onChange={(start) => setDraft({ ...draft, start })}
              ariaLabel={t("native.startDate")}
              max={draft.end || undefined}
            />
          </Field>
          <Field label={t("native.endDate")}>
            <DatePickerInput
              value={draft.end}
              onChange={(end) => setDraft({ ...draft, end })}
              ariaLabel={t("native.endDate")}
              min={draft.start || undefined}
            />
          </Field>
        </div>
      </Modal>
    </section>
  );
}
