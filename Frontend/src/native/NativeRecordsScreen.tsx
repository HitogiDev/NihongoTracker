import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { NotebookPen, Plus, Search, SlidersHorizontal } from "lucide-react";
import { getUserLogsFn } from "../api/trackerApi";
import { useUserDataStore } from "../store/userData";
import type { ILog } from "../types";
import LogCard from "../components/LogCard";
import { BulkLogToolbar, SelectableLogRow } from "../components/BulkLogEdit";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import Modal from "../components/ui/Modal";
import DropdownSelect from "../components/ui/DropdownSelect";
import DatePickerInput from "../components/ui/DatePickerInput";
import Spinner from "../components/ui/Spinner";
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

export default function NativeRecordsScreen() {
  const { t } = useTranslation("nav");
  const { t: lt } = useTranslation("common");
  const user = useUserDataStore((store) => store.user);
  const [filters, setFilters] = useNativePageState<Filters>(
    "records:filters",
    emptyFilters,
  );
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState(false);
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
  const filtered = Boolean(
    filters.search || filters.type || filters.start || filters.end,
  );
  return (
    <section className="native-page space-y-4">
      <div className="native-toolbar flex items-center gap-2">
        <Link
          to="/log"
          state={{ nativeFrom: "/records" }}
          className="btn btn-primary flex-1"
        >
          <Plus className="h-5 w-5" />
          {t("native.createLog")}
        </Link>
        <Button
          appearance="outline"
          shape="square"
          aria-label={t("native.filters")}
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>
      {filtered && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">
            {[filters.search, filters.type, filters.start, filters.end]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <Button appearance="ghost" onClick={() => setFilters(emptyFilters)}>
            {t("native.reset")}
          </Button>
        </div>
      )}
      {query.isPending && (
        <div className="flex justify-center p-8" role="status">
          <Spinner />
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
      {query.hasNextPage && (
        <Button
          block
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("native.loadMore")}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("native.filters")}
        actions={
          <>
            <Button appearance="ghost" onClick={() => setDraft(emptyFilters)}>
              {t("native.reset")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setFilters(draft);
                setOpen(false);
              }}
            >
              {t("native.apply")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label={
              <>
                <Search className="h-4 w-4" />
                {t("native.searchLogs")}
              </>
            }
          >
            {(id) => (
              <input
                id={id}
                type="search"
                className="input focus:input-primary w-full"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("native.allTypes")}>
            <DropdownSelect
              className="select w-full"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              <option value="">{t("native.allTypes")}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {lt(getLogTypeLabelKey(type) ?? "mediaTypes.other")}
                </option>
              ))}
            </DropdownSelect>
          </Field>
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
