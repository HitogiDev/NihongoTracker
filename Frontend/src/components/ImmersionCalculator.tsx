import React, { useState, useEffect } from 'react';

// XP calculation constants (matching backend)
const XP_FACTOR_TIME = 5;
const XP_FACTOR_PAGES = 1.23;
const XP_FACTOR_CHARS = 5;
const XP_FACTOR_EPISODES = XP_FACTOR_TIME * 24;

interface XpToImmersionResult {
  targetXp: number;
  episodes: number;
  timeHours: number;
  timeMinutes: number;
  characters: number;
  pages: number;
}

interface ImmersionToXpResult {
  inputValue: number;
  inputType: string;
  inputLabel: string;
  xpGained: number;
}

type CalculationMode = 'xp-to-immersion' | 'immersion-to-xp';

const ImmersionCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalculationMode>('xp-to-immersion');
  const [targetXp, setTargetXp] = useState<string>('');
  const [immersionValue, setImmersionValue] = useState<string>('');
  const [immersionType, setImmersionType] = useState<string>('time');
  const [xpToImmersionResult, setXpToImmersionResult] =
    useState<XpToImmersionResult | null>(null);
  const [immersionToXpResult, setImmersionToXpResult] =
    useState<ImmersionToXpResult | null>(null);

  // Calculate immersion needed for target XP
  const calculateImmersionFromXp = React.useCallback(
    (targetXp: number): XpToImmersionResult => {
      const episodes = Math.ceil((targetXp * 100) / (45 * XP_FACTOR_EPISODES));
      const timeMinutesTotal = Math.ceil(
        (targetXp * 100) / (45 * XP_FACTOR_TIME)
      );
      const timeHours = Math.floor(timeMinutesTotal / 60);
      const timeMinutes = timeMinutesTotal % 60;
      const characters = Math.ceil((targetXp * 350) / XP_FACTOR_CHARS);
      const pages = Math.ceil(targetXp / XP_FACTOR_PAGES);

      return {
        targetXp,
        episodes,
        timeHours,
        timeMinutes,
        characters,
        pages,
      };
    },
    []
  );

  // Calculate XP from immersion input
  const calculateXpFromImmersion = React.useCallback(
    (value: number, type: string): ImmersionToXpResult => {
      let xpGained = 0;
      let inputLabel = '';

      switch (type) {
        case 'time':
          xpGained = Math.floor(((value * 45) / 100) * XP_FACTOR_TIME);
          inputLabel = 'minutes';
          break;
        case 'characters':
          xpGained = Math.floor((value / 350) * XP_FACTOR_CHARS);
          inputLabel = 'characters';
          break;
        case 'pages':
          xpGained = Math.floor(value * XP_FACTOR_PAGES);
          inputLabel = 'pages';
          break;
        case 'episodes':
          xpGained = Math.floor(((value * 45) / 100) * XP_FACTOR_EPISODES);
          inputLabel = 'episodes';
          break;
      }

      return {
        inputValue: value,
        inputType: type,
        inputLabel,
        xpGained,
      };
    },
    []
  );

  const getAvailableInputTypes = (): Array<{
    value: string;
    label: string;
  }> => {
    return [
      { value: 'time', label: 'Minutes' },
      { value: 'characters', label: 'Characters' },
      { value: 'pages', label: 'Pages' },
      { value: 'episodes', label: 'Episodes' },
    ];
  };

  // Handle XP to immersion calculation
  const handleXpToImmersionCalculate = React.useCallback(() => {
    const xpValue = parseFloat(targetXp);
    if (isNaN(xpValue) || xpValue <= 0) {
      setXpToImmersionResult(null);
      return;
    }
    const result = calculateImmersionFromXp(xpValue);
    setXpToImmersionResult(result);
  }, [targetXp, calculateImmersionFromXp]);

  // Handle immersion to XP calculation
  const handleImmersionToXpCalculate = React.useCallback(() => {
    const value = parseFloat(immersionValue);
    if (isNaN(value) || value <= 0) {
      setImmersionToXpResult(null);
      return;
    }
    const result = calculateXpFromImmersion(value, immersionType);
    setImmersionToXpResult(result);
  }, [immersionValue, immersionType, calculateXpFromImmersion]);

  useEffect(() => {
    if (mode === 'xp-to-immersion' && targetXp) {
      handleXpToImmersionCalculate();
    } else if (mode === 'xp-to-immersion') {
      setXpToImmersionResult(null);
    }
  }, [mode, targetXp, handleXpToImmersionCalculate]);

  useEffect(() => {
    if (mode === 'immersion-to-xp' && immersionValue) {
      handleImmersionToXpCalculate();
    } else if (mode === 'immersion-to-xp') {
      setImmersionToXpResult(null);
    }
  }, [mode, immersionValue, immersionType, handleImmersionToXpCalculate]);

  const availableInputTypes = getAvailableInputTypes();

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
              className={`btn join-item flex-1 ${mode === 'xp-to-immersion' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('xp-to-immersion')}
            >
              XP → Immersion
            </button>
            <button
              className={`btn join-item flex-1 ${mode === 'immersion-to-xp' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('immersion-to-xp')}
            >
              Immersion → XP
            </button>
          </div>
        </div>

        {mode === 'xp-to-immersion' ? (
          <>
            {/* XP to Immersion Mode */}
            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text font-medium">Target XP</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  className="input input-bordered input-primary w-full pr-12 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={targetXp}
                  onChange={(e) => setTargetXp(e.target.value)}
                  placeholder="0"
                  min="0"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-base-content/60">XP</span>
                </div>
              </div>
            </div>

            {/* XP to Immersion Results */}
            {xpToImmersionResult && (
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
                  <span className="font-semibold text-lg">
                    Ways to get {xpToImmersionResult.targetXp} XP
                  </span>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                    <span className="text-base-content/70">Episodes:</span>
                    <span className="font-mono text-lg font-semibold">
                      {xpToImmersionResult.episodes} episodes
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                    <span className="text-base-content/70">Time:</span>
                    <span className="font-mono text-lg font-semibold">
                      {xpToImmersionResult.timeHours > 0 &&
                        `${xpToImmersionResult.timeHours}h `}
                      {xpToImmersionResult.timeMinutes}m
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                    <span className="text-base-content/70">Characters:</span>
                    <span className="font-mono text-lg font-semibold">
                      {xpToImmersionResult.characters.toLocaleString()}{' '}
                      characters
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                    <span className="text-base-content/70">Pages:</span>
                    <span className="font-mono text-lg font-semibold">
                      {Math.round(xpToImmersionResult.pages)} pages
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Immersion to XP Mode */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Immersion Type</span>
                </label>
                <select
                  className="select select-bordered select-secondary"
                  value={immersionType}
                  onChange={(e) => setImmersionType(e.target.value)}
                >
                  {availableInputTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Quantity</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="input input-bordered input-accent w-full pr-20 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={immersionValue}
                    onChange={(e) => setImmersionValue(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-sm text-base-content/60">
                      {availableInputTypes
                        .find((t) => t.value === immersionType)
                        ?.label.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Immersion to XP Results */}
            {immersionToXpResult && (
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
                  <span className="font-semibold text-lg">XP Calculation</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-base-100/50 rounded-lg p-3">
                    <span className="text-base-content/70">Input:</span>
                    <span className="font-mono text-lg">
                      {immersionToXpResult.inputValue}{' '}
                      {immersionToXpResult.inputLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
                    <span className="text-primary font-medium">XP Gained:</span>
                    <span className="font-mono text-xl font-bold text-primary">
                      {immersionToXpResult.xpGained} XP
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImmersionCalculator;
