export type GoalPaceInput = {
  totalTarget: number;
  totalProgress: number;
  remainingTarget: number;
  remainingDays: number;
  requiredPerTimeframe: number;
  timeframeProgress: number;
};

export type GoalPace = {
  completed: boolean;
  requirement: number;
  remaining: number;
  percentage: number;
};

// The backend sends requiredPerTimeframe = 0 once the goal is reached, so 0 must
// mean "nothing left", never "fall back to the full target".
export function goalTimeframePace(input: GoalPaceInput): GoalPace {
  const completed =
    input.totalProgress >= input.totalTarget || input.remainingTarget <= 0;
  if (completed) {
    return { completed, requirement: 0, remaining: 0, percentage: 100 };
  }

  const requirement =
    input.requiredPerTimeframe > 0
      ? input.requiredPerTimeframe
      : input.remainingDays > 0
        ? input.remainingTarget / input.remainingDays
        : 0;
  const percentage =
    requirement > 0
      ? Math.min((input.timeframeProgress / requirement) * 100, 100)
      : 0;

  return {
    completed,
    requirement,
    remaining: Math.max(0, requirement - input.timeframeProgress),
    percentage
  };
}
