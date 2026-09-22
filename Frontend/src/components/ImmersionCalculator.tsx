import DropdownSelect from './ui/DropdownSelect';
import { useEffect, useMemo, useState } from 'react';
import { Calculator, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { calculateXpScenarioFn, multiSearchMediaFn } from '../api/trackerApi';
import { useDebounce } from '../hooks/useDebounce';
import { useUserDataStore } from '../store/userData';
import type {
  ILog,
  IXpCalculatorRequest,
  SearchResultType,
  XpCalculatorContextMode,
  XpCalculatorMode,
  XpCalculatorUnit,
} from '../types';
import Button from './ui/Button';
import Field from './ui/Field';
import Spinner from './ui/Spinner';

const TYPES = [
  { value: 'reading', key: 'calculator.types.reading' },
  { value: 'light-novel', key: 'calculator.types.lightNovel' },
  { value: 'manga', key: 'calculator.types.manga' },
  { value: 'vn', key: 'calculator.types.vn' },
  { value: 'game', key: 'calculator.types.game' },
  { value: 'book', key: 'calculator.types.book' },
  { value: 'anime', key: 'calculator.types.anime' },
  { value: 'video', key: 'calculator.types.video' },
  { value: 'movie', key: 'calculator.types.movie' },
  { value: 'tv show', key: 'calculator.types.tvShow' },
  { value: 'audio', key: 'calculator.types.audio' },
  { value: 'other', key: 'calculator.types.other' },
] as const;
const READING: ILog['type'][] = ['reading', 'light-novel', 'manga', 'vn', 'game', 'book'];
const PAGES: ILog['type'][] = ['reading', 'light-novel', 'manga', 'book'];
const EPISODES: ILog['type'][] = ['anime', 'tv show'];
const numberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const titleOf = (media: SearchResultType) =>
  media.title.contentTitleRomaji || media.title.contentTitleEnglish || media.title.contentTitleNative;

function ImmersionCalculator() {
  const { t } = useTranslation('home');
  const loggedIn = Boolean(useUserDataStore((state) => state.user));
  const [mode, setMode] = useState<XpCalculatorMode>('inverse');
  const [contextMode, setContextMode] = useState<XpCalculatorContextMode>(loggedIn ? 'personal' : 'simulation');
  const [type, setType] = useState<ILog['type']>('reading');
  const [unit, setUnit] = useState<XpCalculatorUnit>('time');
  const [targetXp, setTargetXp] = useState('');
  const [values, setValues] = useState<Record<XpCalculatorUnit, string>>({ time: '', chars: '', pages: '', episodes: '' });
  const [difficulty, setDifficulty] = useState('');
  const [level, setLevel] = useState('0');
  const [history, setHistory] = useState('');
  const [speed, setSpeed] = useState('9450');
  const [mediaQuery, setMediaQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SearchResultType | null>(null);

  useEffect(() => {
    if (!loggedIn && contextMode === 'personal') setContextMode('simulation');
  }, [contextMode, loggedIn]);

  const isReading = READING.includes(type);
  const supportsPages = PAGES.includes(type);
  const supportsEpisodes = EPISODES.includes(type);
  const units = useMemo(() => {
    const available: XpCalculatorUnit[] = type === 'other' ? [] : ['time'];
    if (isReading) available.push('chars');
    if (supportsPages) available.push('pages');
    if (supportsEpisodes) available.push('episodes');
    return available;
  }, [isReading, supportsEpisodes, supportsPages, type]);
  useEffect(() => {
    if (!units.includes(unit)) setUnit(units[0] ?? 'time');
  }, [unit, units]);

  const debouncedMediaQuery = useDebounce(mediaQuery, 300);
  const mediaSearch = useQuery({
    queryKey: ['xp-calculator-media', debouncedMediaQuery],
    queryFn: () => multiSearchMediaFn({ search: debouncedMediaQuery, perPage: 6 }),
    enabled: debouncedMediaQuery.trim().length >= 2 && !selectedMedia,
    staleTime: 30_000,
  });

  const request = useMemo<IXpCalculatorRequest>(() => ({
    mode, contextMode, type,
    mediaId: selectedMedia?.contentId,
    difficultyJiten: numberOrUndefined(difficulty),
    input: mode === 'direct' ? {
      time: numberOrUndefined(values.time),
      chars: isReading ? numberOrUndefined(values.chars) : undefined,
      pages: supportsPages ? numberOrUndefined(values.pages) : undefined,
      episodes: supportsEpisodes ? numberOrUndefined(values.episodes) : undefined,
    } : undefined,
    targetXp: mode === 'inverse' ? numberOrUndefined(targetXp) : undefined,
    unit: mode === 'inverse' ? unit : undefined,
    simulation: contextMode === 'simulation' ? {
      categoryLevel: numberOrUndefined(level) ?? 0,
      consumedDifficultyJiten: numberOrUndefined(history),
      personalSpeedCph: numberOrUndefined(speed) ?? 9450,
    } : undefined,
  }), [contextMode, difficulty, history, isReading, level, mode, selectedMedia, speed, supportsEpisodes, supportsPages, targetXp, type, unit, values]);
  const debouncedRequest = useDebounce(request, 350);
  const hasDirectInput = units.some((item) => (numberOrUndefined(values[item]) ?? 0) > 0);
  const enabled = type !== 'other' && (mode === 'direct' ? hasDirectInput : (numberOrUndefined(targetXp) ?? 0) > 0);
  const calculation = useQuery({
    queryKey: ['xp-calculator', debouncedRequest],
    queryFn: () => calculateXpScenarioFn(debouncedRequest),
    enabled,
    retry: false,
  });
  const result = enabled ? calculation.data : undefined;

  const chooseMedia = (media: SearchResultType) => {
    setSelectedMedia(media);
    setMediaQuery(titleOf(media));
    setType(media.type);
    setDifficulty('');
  };
  const updateValue = (key: XpCalculatorUnit, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="card surface">
      <div className="card-body gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-box bg-primary/10 text-primary"><Calculator className="h-5 w-5" /></div>
          <div><h2 className="card-title">{t('calculator.heading')}</h2><p className="text-sm text-base-content/60">{t('calculator.configure')}</p></div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Field label={t('calculator.mode')}><div className="join w-full">
            <Button size="sm" appearance={mode === 'inverse' ? 'solid' : 'outline'} variant={mode === 'inverse' ? 'primary' : 'default'} className="join-item flex-1" onClick={() => setMode('inverse')}>{t('calculator.xpToImmersion')}</Button>
            <Button size="sm" appearance={mode === 'direct' ? 'solid' : 'outline'} variant={mode === 'direct' ? 'primary' : 'default'} className="join-item flex-1" onClick={() => setMode('direct')}>{t('calculator.immersionToXp')}</Button>
          </div></Field>
          <Field label={t('calculator.context')}><div className="join w-full">
            {loggedIn && <Button size="sm" appearance={contextMode === 'personal' ? 'solid' : 'outline'} variant={contextMode === 'personal' ? 'primary' : 'default'} className="join-item flex-1" onClick={() => setContextMode('personal')}>{t('calculator.personal')}</Button>}
            <Button size="sm" appearance={contextMode === 'simulation' ? 'solid' : 'outline'} variant={contextMode === 'simulation' ? 'primary' : 'default'} className="join-item flex-1" onClick={() => setContextMode('simulation')}>{t('calculator.simulation')}</Button>
          </div></Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('calculator.contentType')}>{(id) => <DropdownSelect id={id} className="select focus:select-primary w-full" value={type} onChange={(event) => { setType(event.target.value as ILog['type']); setSelectedMedia(null); setMediaQuery(''); }}>
            {TYPES.map((option) => <option key={option.value} value={option.value}>{t(option.key)}</option>)}
          </DropdownSelect>}</Field>
          <Field label={t('calculator.difficulty')} hint={t('calculator.difficultyHint')}>{(id) => <input id={id} type="number" min="0" max="5" step="0.1" className="input focus:input-primary w-full" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} placeholder="0 - 5" />}</Field>
        </div>

        <Field label={t('calculator.media')} hint={t('calculator.mediaHint')}>{(id) => <div className="relative">
          <label className="input focus-within:input-primary w-full" htmlFor={id}><Search className="h-4 w-4 opacity-60" /><input id={id} value={mediaQuery} onChange={(event) => { setMediaQuery(event.target.value); setSelectedMedia(null); }} placeholder={t('calculator.searchMedia')} />
            {selectedMedia && <button type="button" className="btn btn-ghost btn-xs btn-circle" aria-label={t('calculator.clearMedia')} onClick={() => { setSelectedMedia(null); setMediaQuery(''); }}><X className="h-3 w-3" /></button>}
          </label>
          {!selectedMedia && debouncedMediaQuery.trim().length >= 2 && <div className="surface-raised absolute z-20 mt-2 max-h-64 w-full overflow-y-auto p-2">
            {mediaSearch.isLoading ? <div className="flex justify-center p-4"><Spinner size="sm" /></div> : mediaSearch.data?.length ? <ul className="menu w-full">{mediaSearch.data.map((media) => <li key={`${media.type}:${media.contentId}`}><button type="button" onClick={() => chooseMedia(media)}><span className="truncate">{titleOf(media)}</span><span className="text-xs opacity-60">{media.type}</span></button></li>)}</ul> : <p className="p-3 text-sm text-base-content/60">{t('calculator.noMedia')}</p>}
          </div>}
        </div>}</Field>

        {contextMode === 'simulation' && <div className="surface-muted grid gap-4 p-4 md:grid-cols-3">
          <Field label={t('calculator.categoryLevel')}>{(id) => <input id={id} type="number" min="0" className="input focus:input-primary w-full" value={level} onChange={(event) => setLevel(event.target.value)} />}</Field>
          <Field label={t('calculator.historyDifficulty')} hint={t('calculator.optional')}>{(id) => <input id={id} type="number" min="0" max="5" step="0.1" className="input focus:input-primary w-full" value={history} onChange={(event) => setHistory(event.target.value)} placeholder="0 - 5" />}</Field>
          <Field label={t('calculator.readingSpeed')}>{(id) => <input id={id} type="number" min="0" className="input focus:input-primary w-full" value={speed} onChange={(event) => setSpeed(event.target.value)} disabled={!isReading} />}</Field>
        </div>}

        {mode === 'inverse' ? <div className="grid gap-5 md:grid-cols-2">
          <Field label={t('calculator.targetXp')}>{(id) => <input id={id} type="number" min="1" className="input focus:input-primary w-full" value={targetXp} onChange={(event) => setTargetXp(event.target.value)} placeholder="0" />}</Field>
          <Field label={t('calculator.unit')}>{(id) => <DropdownSelect id={id} className="select focus:select-primary w-full" value={unit} onChange={(event) => setUnit(event.target.value as XpCalculatorUnit)} disabled={!units.length}>{units.map((item) => <option key={item} value={item}>{t(`calculator.units.${item}`)}</option>)}</DropdownSelect>}</Field>
        </div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {units.map((item) => <Field key={item} label={t(`calculator.units.${item}`)} hint={item === 'time' ? t('calculator.timeHint') : item === 'chars' ? t('calculator.charsHint') : undefined}>{(id) => <input id={id} type="number" min="0" className="input focus:input-primary w-full" value={values[item]} onChange={(event) => updateValue(item, event.target.value)} />}</Field>)}
        </div>}

        {type === 'other' && <div role="alert" className="alert alert-info">{t('calculator.otherNoXp')}</div>}
        {mode === 'inverse' && type !== 'other' && <p className="text-sm text-base-content/60">{t('calculator.fixedContext')}</p>}
        {calculation.isFetching && enabled && <div className="flex justify-center py-5"><Spinner label={t('calculator.calculating')} /></div>}
        {calculation.isError && enabled && <div role="alert" className="alert alert-error">{t('calculator.calculationError')}</div>}
        {result && !calculation.isFetching && <div className="surface-raised p-5">
          {result.inverse && <div className="mb-5 text-center"><p className="text-sm text-base-content/60">{t('calculator.requiredAmount')}</p><p className="text-3xl font-bold text-primary">{result.inverse.quantity.toLocaleString()} {t(`calculator.units.${result.inverse.unit}`)}</p></div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.creditedTime')}</div><div className="stat-value text-2xl">{result.breakdown.timeCreditedMin}</div><div className="stat-desc">{t('calculator.units.time')}</div></div>
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.baseXp')}</div><div className="stat-value text-2xl">{result.breakdown.baseXp}</div></div>
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.contentDifficulty')}</div><div className="stat-value text-2xl">{result.context.difficultyJiten?.toFixed(2) ?? t('calculator.noDifficulty')}</div><div className="stat-desc">Jiten</div></div>
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.comfort')}</div><div className="stat-value text-2xl">{result.context.comfortJiten.toFixed(2)}</div><div className="stat-desc">{t('calculator.fullBonusAt', { target: result.context.targetDifficultyJiten.toFixed(2) })}</div></div>
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.bonus')}</div><div className="stat-value text-2xl">+{result.context.bonusPercent}%</div></div>
            <div className="stat surface-muted"><div className="stat-title">{t('calculator.xpGained')}</div><div className="stat-value text-2xl text-primary">{result.xp}</div><div className="stat-desc">XP v{result.breakdown.version}</div></div>
          </div>
        </div>}
      </div>
    </div>
  );
}

export default ImmersionCalculator;
