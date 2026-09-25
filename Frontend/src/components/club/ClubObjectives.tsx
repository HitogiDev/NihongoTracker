import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Pin,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  completeClubChallengeFn,
  createClubObjectiveFn,
  getClubObjectiveFn,
  getClubObjectivesFn,
  joinClubChallengeFn,
  leaveClubChallengeFn,
  pinClubObjectiveFn,
} from '../../api/clubApi';
import {
  ClubChallengeMetric,
  IClubChallengeProgress,
  ClubObjectiveMode,
  IClubObjective,
} from '../../types';
import { useUserDataStore } from '../../store/userData';
import { getApiErrorMessage } from '../../utils/apiError';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import DatePickerInput from '../ui/DatePickerInput';
import UserAvatar from '../UserAvatar';

interface ClubObjectivesProps {
  clubId: string;
  canManage?: boolean;
  canPin?: boolean;
  onManageCollective?: () => void;
}

const METRICS: ClubChallengeMetric[] = [
  'time',
  'chars',
  'pages',
  'episodes',
  'active_days',
];

type ParticipantStatus = 'all' | 'completed' | 'in-progress';
type ParticipantSort =
  | 'progress-desc'
  | 'progress-asc'
  | 'name-asc'
  | 'name-desc';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

function DaisyDropdown<T extends string>({
  id,
  name,
  value,
  options,
  onChange,
}: {
  id?: string;
  name?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <details ref={detailsRef} className="dropdown dropdown-bottom w-full">
      <summary
        id={id}
        className="btn btn-outline w-full justify-between font-normal"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </summary>
      <ul className="dropdown-content menu z-30 mt-1 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        {options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              className={option.value === value ? 'menu-active' : undefined}
              onClick={() => {
                onChange(option.value);
                detailsRef.current?.removeAttribute('open');
              }}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
      {name && <input type="hidden" name={name} value={value} />}
    </details>
  );
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ObjectiveMeta({ objective }: { objective: IClubObjective }) {
  const { t } = useTranslation('clubs');
  return (
    <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
      <span className="flex items-center gap-1">
        <Flag className="h-3 w-3" />
        {objective.goal.toLocaleString()} {t(`challenges.metrics.${objective.metric}`)}
      </span>
      <span className="flex items-center gap-1">
        <CalendarDays className="h-3 w-3" />
        {new Date(objective.endDate).toLocaleDateString()}
      </span>
    </div>
  );
}

function ObjectiveProgress({ objective, label }: { objective: IClubObjective; label: string }) {
  const { t } = useTranslation('clubs');
  const metricLabel = t(`challenges.metrics.${objective.metric}`);

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">
          {objective.progress.toLocaleString()} / {objective.goal.toLocaleString()} {metricLabel}
        </span>
        <span className="text-base-content/60">{objective.percentage}%</span>
      </div>
      <progress className="progress progress-primary w-full" value={objective.percentage} max="100" />
    </div>
  );
}

function ParticipantsModal({
  objective,
  open,
  onClose,
}: {
  objective: IClubObjective;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('clubs');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ParticipantStatus>('all');
  const [sort, setSort] = useState<ParticipantSort>('progress-desc');
  const details = useQuery({
    queryKey: ['clubObjective', objective._id],
    queryFn: () => getClubObjectiveFn(objective._id),
    enabled: open && objective.mode === 'individual',
  });
  const metricLabel = t(`challenges.metrics.${objective.metric}`);
  const sourceRows: IClubChallengeProgress[] =
    objective.mode === 'collective'
      ? (objective.contributors ?? []).map(({ user, value }) => ({
          user,
          progress: value,
          percentage: Math.min(
            100,
            Math.round((value / Math.max(objective.goal, 1)) * 1000) / 10
          ),
          completed: value > 0,
        }))
      : (details.data?.participants ?? objective.participantProgress ?? []);
  const participantRows = [...sourceRows]
    .filter((participant) =>
      participant.user.username
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    )
    .filter((participant) => {
      if (status === 'completed') return participant.completed;
      if (status === 'in-progress') return !participant.completed;
      return true;
    })
    .sort((left, right) => {
      if (sort === 'progress-desc') return right.progress - left.progress;
      if (sort === 'progress-asc') return left.progress - right.progress;
      const comparison = left.user.username.localeCompare(right.user.username);
      return sort === 'name-asc' ? comparison : -comparison;
    });
  const statusOptions: DropdownOption<ParticipantStatus>[] = [
    { value: 'all', label: t('objectives.statusAll') },
    {
      value: 'completed',
      label:
        objective.mode === 'collective'
          ? t('objectives.statusContributed')
          : t('objectives.statusCompleted'),
    },
    {
      value: 'in-progress',
      label:
        objective.mode === 'collective'
          ? t('objectives.statusNoContribution')
          : t('objectives.statusInProgress'),
    },
  ];
  const sortOptions: DropdownOption<ParticipantSort>[] = [
    { value: 'progress-desc', label: t('objectives.sortProgressDesc') },
    { value: 'progress-asc', label: t('objectives.sortProgressAsc') },
    { value: 'name-asc', label: t('objectives.sortNameAsc') },
    { value: 'name-desc', label: t('objectives.sortNameDesc') },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('objectives.participantModalTitle', {
        title: objective.title,
      })}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('objectives.searchParticipants')}>
            {(id) => (
              <input
                id={id}
                className="input focus:input-primary w-full"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('objectives.searchParticipantsPlaceholder')}
              />
            )}
          </Field>
          <Field label={t('objectives.statusFilter')}>
            {(id) => (
              <DaisyDropdown
                id={id}
                value={status}
                options={statusOptions}
                onChange={setStatus}
              />
            )}
          </Field>
          <Field label={t('objectives.sortParticipants')}>
            {(id) => (
              <DaisyDropdown
                id={id}
                value={sort}
                options={sortOptions}
                onChange={setSort}
              />
            )}
          </Field>
        </div>

        <p className="text-sm text-base-content/60">
          {t('objectives.participantCount', {
            count: participantRows.length,
          })}
        </p>

        {details.isLoading && objective.mode === 'individual' ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : participantRows.length ? (
          <div className="max-h-[55vh] overflow-x-auto overflow-y-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('objectives.participant')}</th>
                  <th>{t('objectives.progress')}</th>
                  <th>{t('objectives.statusFilter')}</th>
                </tr>
              </thead>
              <tbody>
                {participantRows.map((participant) => (
                  <tr key={participant.user._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          username={participant.user.username}
                          avatar={participant.user.avatar}
                          containerClassName="h-8 w-8 shrink-0 overflow-hidden rounded-full"
                          imageClassName="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                          textClassName="text-xs font-semibold"
                        />
                        <span className="font-medium">
                          {participant.user.username}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="min-w-36 space-y-1">
                        <div className="flex justify-between gap-3 text-xs">
                          <span>
                            {participant.progress.toLocaleString()} {metricLabel}
                          </span>
                          <span>{participant.percentage}%</span>
                        </div>
                        <progress
                          className="progress progress-primary w-full"
                          value={participant.percentage}
                          max="100"
                        />
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          participant.completed
                            ? 'badge badge-success badge-sm'
                            : 'badge badge-ghost badge-sm'
                        }
                      >
                        {participant.completed
                          ? objective.mode === 'collective'
                            ? t('objectives.statusContributed')
                            : t('objectives.statusCompleted')
                          : objective.mode === 'collective'
                            ? t('objectives.statusNoContribution')
                            : t('objectives.statusInProgress')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-base-content/60">
            {sourceRows.length
              ? t('objectives.noParticipantMatches')
              : t('objectives.noParticipants')}
          </p>
        )}
      </div>
    </Modal>
  );
}

function CollectiveObjectiveCard({
  objective,
  clubId,
  canPin,
  onRefresh,
}: {
  objective: IClubObjective;
  clubId: string;
  canPin: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation('clubs');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const pinMutation = useMutation({
    mutationFn: () => pinClubObjectiveFn(clubId, objective._id, !objective.isPinned),
    onSuccess: onRefresh,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <article className="card surface-raised h-full min-h-[26rem]">
      <div className="card-body gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="badge badge-primary badge-sm">{t('objectives.collective')}</span>
              <span className="badge badge-ghost badge-sm">{t(`challenges.status.${objective.status}`)}</span>
              {objective.isPinned && (
                <span className="badge badge-warning badge-sm gap-1">
                  <Pin className="h-3 w-3" /> {t('objectives.pinned')}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-semibold leading-tight">{objective.title}</h3>
          </div>
          <Trophy className="h-7 w-7 shrink-0 text-primary" />
        </div>

        {objective.description && <p className="text-sm text-base-content/70">{objective.description}</p>}
        <ObjectiveMeta objective={objective} />
        <ObjectiveProgress objective={objective} label={t('objectives.collectiveProgress')} />

        <div className="card-actions mt-auto">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setParticipantsOpen(true)}
          >
            <Users className="h-4 w-4" />
            {t('objectives.participants')}
          </button>
          {canPin && (
            <button className="btn btn-ghost btn-sm gap-2" disabled={pinMutation.isPending} onClick={() => pinMutation.mutate()}>
              <Pin className="h-4 w-4" /> {objective.isPinned ? t('objectives.unpin') : t('objectives.pin')}
            </button>
          )}
        </div>
      </div>

      <ParticipantsModal
        objective={objective}
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
      />
    </article>
  );
}

function IndividualObjectiveCard({
  objective,
  currentUserId,
  onRefresh,
}: {
  objective: IClubObjective;
  currentUserId?: string;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation('clubs');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const joined = Boolean(currentUserId && objective.participants.some((id) => id === currentUserId));
  const membershipMutation = useMutation({
    mutationFn: async () => joined ? leaveClubChallengeFn(objective._id) : joinClubChallengeFn(objective._id),
    onSuccess: onRefresh,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const completeMutation = useMutation({
    mutationFn: completeClubChallengeFn,
    onSuccess: onRefresh,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <article className="card card-sm surface-muted">
      <div className="card-body gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mb-1 flex flex-wrap gap-2">
              <span className="badge badge-sm">{t('objectives.individual')}</span>
              <span className="badge badge-ghost badge-sm">{t(`challenges.status.${objective.status}`)}</span>
            </div>
            <h3 className="card-title text-base">{objective.title}</h3>
          </div>
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        {objective.description && <p className="text-sm text-base-content/70">{objective.description}</p>}
        <ObjectiveMeta objective={objective} />
        <ObjectiveProgress objective={objective} label={t('objectives.myProgress')} />

        <div className="card-actions mt-auto">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setParticipantsOpen(true)}
          >
            <Users className="h-4 w-4" />
            {t('objectives.participants')}
          </button>
          <button className="btn btn-sm" disabled={membershipMutation.isPending} onClick={() => membershipMutation.mutate()}>
            {joined ? t('objectives.leave') : t('objectives.join')}
          </button>
          {joined && !objective.completed && (
            <button className="btn btn-primary btn-sm" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(objective._id)}>{t('objectives.complete')}</button>
          )}
        </div>
      </div>

      <ParticipantsModal
        objective={objective}
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
      />
    </article>
  );
}

export function ClubIndividualObjectives({ clubId }: { clubId: string }) {
  const { t } = useTranslation('clubs');
  const queryClient = useQueryClient();
  const currentUser = useUserDataStore((state) => state.user);
  const objectives = useQuery({
    queryKey: ['clubObjectives', clubId],
    queryFn: () => getClubObjectivesFn(clubId),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['clubObjectives', clubId] });
  };
  const individualObjectives = (objectives.data?.objectives ?? []).filter(
    (objective) => objective.mode === 'individual'
  );

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <h2 className="card-title text-lg">
          <Trophy className="h-5 w-5" />
          {t('objectives.individual')}
        </h2>
        {objectives.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : individualObjectives.length ? (
          <div className="space-y-3">
            {individualObjectives.map((objective) => (
              <IndividualObjectiveCard
                key={objective._id}
                objective={objective}
                currentUserId={currentUser?._id}
                onRefresh={refresh}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            {t('objectives.noIndividual')}
          </p>
        )}
      </div>
    </section>
  );
}

export default function ClubObjectives({
  clubId,
  canManage = false,
  canPin = false,
  onManageCollective,
}: ClubObjectivesProps) {
  const { t } = useTranslation('clubs');
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [collectiveIndex, setCollectiveIndex] = useState(0);
  const [objectiveMode, setObjectiveMode] =
    useState<ClubObjectiveMode>('collective');
  const [objectiveMetric, setObjectiveMetric] =
    useState<ClubChallengeMetric>('time');
  const objectives = useQuery({ queryKey: ['clubObjectives', clubId], queryFn: () => getClubObjectivesFn(clubId) });
  const createMutation = useMutation({
    mutationFn: createClubObjectiveFn,
    onSuccess: async () => {
      setCreating(false);
      toast.success(t('objectives.created'));
      await queryClient.invalidateQueries({ queryKey: ['clubObjectives', clubId] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error) || t('objectives.createError')),
  });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['clubObjectives', clubId] }); };

  const allObjectives = objectives.data?.objectives ?? [];
  const collectiveObjectives = allObjectives.filter((objective) => objective.mode === 'collective');
  const currentCollective = collectiveObjectives[collectiveIndex];
  useEffect(() => { setCollectiveIndex((index) => Math.min(index, Math.max(collectiveObjectives.length - 1, 0))); }, [collectiveObjectives.length]);

  const createObjective = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      clubId,
      mode: String(form.get('mode')) as ClubObjectiveMode,
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      metric: String(form.get('metric')) as ClubChallengeMetric,
      goal: Number(form.get('goal')),
      startDate: new Date(String(form.get('startDate'))).toISOString(),
      endDate: new Date(String(form.get('endDate'))).toISOString(),
      period: 'custom',
    });
  };
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="card-title text-lg"><Trophy className="h-5 w-5" />{t('objectives.title')}</h2><p className="text-sm text-base-content/60">{t('objectives.subtitle')}</p></div>
          {canManage && <div className="flex flex-wrap gap-2">
            {onManageCollective && <button className="btn btn-ghost btn-sm" onClick={onManageCollective}>{t('goals.manage')}</button>}
            <button className="btn btn-sm" onClick={() => setCreating((value) => !value)}><Plus className="h-4 w-4" />{t('objectives.create')}</button>
          </div>}
        </div>

        {creating && <form className="surface-muted grid gap-3 p-4 sm:grid-cols-2" onSubmit={createObjective}>
          <Field label={t('challenges.fields.title')} required><input name="title" className="input focus:input-primary w-full" required /></Field>
          <Field label={t('objectives.mode')} required>
            {(id) => (
              <DaisyDropdown
                id={id}
                name="mode"
                value={objectiveMode}
                options={[
                  { value: 'collective', label: t('objectives.collective') },
                  { value: 'individual', label: t('objectives.individual') },
                ]}
                onChange={setObjectiveMode}
              />
            )}
          </Field>
          <Field label={t('objectives.metric')} required>
            {(id) => (
              <DaisyDropdown
                id={id}
                name="metric"
                value={objectiveMetric}
                options={METRICS.map((metric) => ({
                  value: metric,
                  label: t(`challenges.metrics.${metric}`),
                }))}
                onChange={setObjectiveMetric}
              />
            )}
          </Field>
          <Field label={t('objectives.goal')} required><input name="goal" type="number" min="1" className="input focus:input-primary w-full" required /></Field>
          <Field label={t('objectives.startDate')} required><DatePickerInput name="startDate" defaultValue={dateInputValue(startDate)} className="focus:input-primary" required /></Field>
          <Field label={t('objectives.endDate')} required><DatePickerInput name="endDate" defaultValue={dateInputValue(endDate)} className="focus:input-primary" required /></Field>
          <Field label={t('objectives.description')}><textarea name="description" className="textarea focus:textarea-primary w-full" rows={2} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>{t('common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={createMutation.isPending}>{createMutation.isPending ? <Spinner size="sm" /> : t('objectives.create')}</button></div>
        </form>}

        {objectives.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t('objectives.collective')}</h3>{collectiveObjectives.length > 1 && <div className="join"><button className="join-item btn btn-ghost btn-sm btn-square" aria-label={t('objectives.previous')} disabled={collectiveIndex === 0} onClick={() => setCollectiveIndex((index) => Math.max(index - 1, 0))}><ChevronLeft className="h-4 w-4" /></button><span className="join-item btn btn-ghost btn-sm pointer-events-none">{collectiveIndex + 1} / {collectiveObjectives.length}</span><button className="join-item btn btn-ghost btn-sm btn-square" aria-label={t('objectives.next')} disabled={collectiveIndex === collectiveObjectives.length - 1} onClick={() => setCollectiveIndex((index) => Math.min(index + 1, collectiveObjectives.length - 1))}><ChevronRight className="h-4 w-4" /></button></div>}</div>
            {currentCollective ? <CollectiveObjectiveCard objective={currentCollective} clubId={clubId} canPin={canPin} onRefresh={refresh} /> : <div className="surface-muted flex min-h-[26rem] items-center justify-center rounded-box p-6 text-center text-sm text-base-content/60">{t('objectives.noCollective')}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
