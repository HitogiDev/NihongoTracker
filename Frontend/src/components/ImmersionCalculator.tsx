import React, { useState, useEffect } from 'react';

// XP calculation constants (matching backend)
const XP_FACTOR_TIME = 5;
const XP_FACTOR_PAGES = 1.23;
const XP_FACTOR_CHARS = 5;
const XP_FACTOR_EPISODES = XP_FACTOR_TIME * 24;

interface CalculationResult {
  xp: number;
  time?: number;
  pages?: number;
  chars?: number;
  episodes?: number;
}

type MediaType =
  | 'anime'
  | 'reading'
  | 'manga'
  | 'vn'
  | 'video'
  | 'movie'
  | 'audio';
type InputType = 'time' | 'pages' | 'chars' | 'episodes';
type CalculationMode = 'immersion-to-xp' | 'xp-to-immersion';

const ImmersionCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalculationMode>('immersion-to-xp');
  const [mediaType, setMediaType] = useState<MediaType>('anime');
  const [inputValue, setInputValue] = useState<string>('');
  const [inputType, setInputType] = useState<InputType>('time');
  const [result, setResult] = useState<CalculationResult | null>(null);

  // Calculate XP from immersion input
  const calculateXpFromInput = React.useCallback(
    (value: number, type: InputType, mediaType: MediaType): number => {
      let timeXp = 0;
      let charsXp = 0;
      let pagesXp = 0;
      let episodesXp = 0;

      switch (type) {
        case 'time':
          timeXp = Math.floor(((value * 45) / 100) * XP_FACTOR_TIME);
          break;
        case 'chars':
          charsXp = Math.floor((value / 350) * XP_FACTOR_CHARS);
          break;
        case 'pages':
          pagesXp = Math.floor(value * XP_FACTOR_PAGES);
          break;
        case 'episodes':
          episodesXp = Math.floor(((value * 45) / 100) * XP_FACTOR_EPISODES);
          break;
      }

      // Apply media type logic
      switch (mediaType) {
        case 'anime':
          if (timeXp) return timeXp;
          if (episodesXp) return episodesXp;
          return 0;
        case 'vn':
        case 'video':
        case 'movie':
        case 'audio':
          return Math.max(timeXp, pagesXp, charsXp, episodesXp, 0);
        case 'reading':
        case 'manga':
          if (charsXp) return Math.max(charsXp, timeXp);
          if (pagesXp) return Math.max(pagesXp, timeXp);
          return timeXp;
        default:
          return 0;
      }
    },
    []
  );

  // Calculate immersion needed for target XP
  const calculateImmersionFromXp = React.useCallback(
    (targetXp: number, type: InputType): number => {
      switch (type) {
        case 'time':
          return Math.ceil((targetXp * 100) / (45 * XP_FACTOR_TIME));
        case 'chars':
          return Math.ceil((targetXp * 350) / XP_FACTOR_CHARS);
        case 'pages':
          return Math.ceil(targetXp / XP_FACTOR_PAGES);
        case 'episodes':
          return Math.ceil((targetXp * 100) / (45 * XP_FACTOR_EPISODES));
        default:
          return 0;
      }
    },
    []
  );

  const getAvailableInputTypes = (
    mediaType: MediaType
  ): Array<{ value: InputType; label: string }> => {
    switch (mediaType) {
      case 'anime':
        return [
          { value: 'time', label: 'Minutes' },
          { value: 'episodes', label: 'Episodes' },
        ];
      case 'reading':
      case 'manga':
        return [
          { value: 'time', label: 'Minutes' },
          { value: 'chars', label: 'Characters' },
          { value: 'pages', label: 'Pages' },
        ];
      case 'vn':
        return [
          { value: 'time', label: 'Minutes' },
          { value: 'chars', label: 'Characters' },
          { value: 'pages', label: 'Pages' },
          { value: 'episodes', label: 'Episodes' },
        ];
      case 'video':
      case 'movie':
      case 'audio':
        return [
          { value: 'time', label: 'Minutes' },
          { value: 'chars', label: 'Characters' },
          { value: 'pages', label: 'Pages' },
          { value: 'episodes', label: 'Episodes' },
        ];
      default:
        return [{ value: 'time', label: 'Minutes' }];
    }
  };

  const handleCalculate = React.useCallback(() => {
    const value = parseFloat(inputValue);
    if (isNaN(value) || value <= 0) {
      setResult(null);
      return;
    }

    if (mode === 'immersion-to-xp') {
      const xp = calculateXpFromInput(value, inputType, mediaType);
      setResult({ xp, [inputType]: value });
    } else {
      const immersion = calculateImmersionFromXp(value, inputType);
      setResult({ xp: value, [inputType]: immersion });
    }
  }, [
    inputValue,
    inputType,
    mediaType,
    mode,
    calculateXpFromInput,
    calculateImmersionFromXp,
  ]);

  useEffect(() => {
    const availableTypes = getAvailableInputTypes(mediaType);
    if (!availableTypes.find((type) => type.value === inputType)) {
      setInputType(availableTypes[0].value);
    }
  }, [mediaType, inputType]);

  useEffect(() => {
    if (inputValue) {
      handleCalculate();
    } else {
      setResult(null);
    }
  }, [inputValue, handleCalculate]);

  const availableInputTypes = getAvailableInputTypes(mediaType);

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">Calculator</h2>
            <p className="text-sm text-base-content/60">
              Configure your calculation
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-medium">Calculation Mode</span>
          </label>
          <div className="join w-full">
            <button
              className={`btn join-item flex-1 ${mode === 'immersion-to-xp' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('immersion-to-xp')}
            >
              Immersion → XP
            </button>
            <button
              className={`btn join-item flex-1 ${mode === 'xp-to-immersion' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('xp-to-immersion')}
            >
              XP → Immersion
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Media Type Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Media Type</span>
            </label>
            <select
              className="select select-bordered select-primary"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
            >
              <option value="anime">Anime</option>
              <option value="reading">Reading</option>
              <option value="manga">Manga</option>
              <option value="vn">Visual Novel</option>
              <option value="video">Video</option>
              <option value="movie">Movie</option>
              <option value="audio">Audio</option>
            </select>
          </div>

          {/* Input Type Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Metric Type</span>
            </label>
            <select
              className="select select-bordered select-secondary"
              value={inputType}
              onChange={(e) => setInputType(e.target.value as InputType)}
            >
              {availableInputTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Value */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-medium">
              {mode === 'immersion-to-xp'
                ? `Enter ${availableInputTypes.find((t) => t.value === inputType)?.label.toLowerCase()}`
                : 'Enter target XP'}
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              className="input input-bordered input-accent w-full pr-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0"
              min="0"
              step={
                inputType === 'time' || inputType === 'episodes'
                  ? '1'
                  : inputType === 'pages'
                    ? '1'
                    : '1'
              }
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-sm text-base-content/60">
                {mode === 'immersion-to-xp'
                  ? availableInputTypes
                      .find((t) => t.value === inputType)
                      ?.label.toLowerCase()
                  : 'XP'}
              </span>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-gradient-to-r from-success/10 to-primary/10 border border-success/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="font-semibold text-lg">Result</span>
            </div>

            {mode === 'immersion-to-xp' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                  <span className="text-base-content/70">Input:</span>
                  <span className="font-mono text-lg">
                    {result[inputType as keyof CalculationResult]}{' '}
                    {availableInputTypes
                      .find((t) => t.value === inputType)
                      ?.label.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-primary font-medium">XP Gained:</span>
                  <span className="font-mono text-xl font-bold text-primary">
                    {result.xp} XP
                  </span>
                </div>
                <p className="text-sm text-base-content/60 mt-3">
                  Based on {mediaType} calculation rules
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                  <span className="text-primary font-medium">Target XP:</span>
                  <span className="font-mono text-xl font-bold text-primary">
                    {result.xp} XP
                  </span>
                </div>
                <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                  <span className="text-base-content/70">Required:</span>
                  <span className="font-mono text-lg">
                    {result[inputType as keyof CalculationResult]}{' '}
                    {availableInputTypes
                      .find((t) => t.value === inputType)
                      ?.label.toLowerCase()}
                  </span>
                </div>
                <p className="text-sm text-base-content/60 mt-3">
                  You need {result[inputType as keyof CalculationResult]}{' '}
                  {availableInputTypes
                    .find((t) => t.value === inputType)
                    ?.label.toLowerCase()}{' '}
                  to get {result.xp} XP
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImmersionCalculator;
