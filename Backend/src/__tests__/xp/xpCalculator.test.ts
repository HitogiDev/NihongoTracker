import { describe, expect, it } from 'vitest';
import { computeXp } from '../../services/xp.js';
import { calculateXpScenario } from '../../services/xpCalculator.js';

describe('XP calculator', () => {
  it('matches the XP engine for a simulated direct calculation', async () => {
    const response = await calculateXpScenario({
      mode: 'direct',
      contextMode: 'simulation',
      type: 'reading',
      difficultyJiten: 3.5,
      input: { time: 60, chars: 9000 },
      simulation: {
        categoryLevel: 37.5,
        personalSpeedCph: 9450,
      },
    });
    const engine = computeXp(
      { type: 'reading', time: 60, chars: 9000 },
      { difficulty: 70, categoryLevel: 37.5, personalSpeedCph: 9450 }
    );

    expect(response.xp).toBe(engine.xp);
    expect(response.breakdown).toEqual(engine.breakdown);
    expect(response.context.bonusPercent).toBe(30);
  });

  it('returns the smallest integer quantity that reaches an XP target', async () => {
    const response = await calculateXpScenario({
      mode: 'inverse',
      contextMode: 'simulation',
      type: 'anime',
      targetXp: 135,
      unit: 'time',
      simulation: { categoryLevel: 0 },
    });

    expect(response.inverse?.quantity).toBe(60);
    expect(response.xp).toBeGreaterThanOrEqual(135);
    expect(computeXp({ type: 'anime', time: 59 }).xp).toBeLessThan(135);
  });

  it('applies game dilution during inverse calculations', async () => {
    const response = await calculateXpScenario({
      mode: 'inverse',
      contextMode: 'simulation',
      type: 'game',
      targetXp: 101,
      unit: 'time',
    });

    expect(response.inverse?.quantity).toBe(60);
  });

  it('requires authentication for personal context', async () => {
    await expect(
      calculateXpScenario({
        mode: 'direct',
        contextMode: 'personal',
        type: 'anime',
        input: { time: 60 },
      })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects incompatible inverse units', async () => {
    await expect(
      calculateXpScenario({
        mode: 'inverse',
        contextMode: 'simulation',
        type: 'audio',
        targetXp: 100,
        unit: 'pages',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
