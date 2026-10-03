import { DailyCheckIn } from '../models/check-in.model';
import { FoodEntry } from '../models/meals.model';
import { DEFAULT_GOALS } from '../models/settings.model';
import { findPatterns, fingerprint, patternSpan, profileRequest, recentCheckIns } from './profile-rules';
import { addDays } from '../../shared/date';

const TODAY = '2026-10-03';

/** A good day by default: enough sleep, food and steps, little screen. */
function day(daysAgo: number, change: (d: DailyCheckIn) => void = () => undefined): DailyCheckIn {
  const date = addDays(TODAY, -daysAgo);
  const entry: DailyCheckIn = {
    id: `entry-${date}`,
    date,
    createdAt: `${date}T21:00:00.000Z`,
    mood: { score: 7, label: 'całkiem spoko' },
    sleep: { durationHours: 8, feelingRested: true },
    food: { qualityScore: 75 },
    metrics: { runningDistanceKm: 0, screenTimeHours: 2, steps: 9000 },
    social: { metWithFriends: false },
    companionReaction: { message: 'Dzięki za wpis!', avatarState: 'happy' },
  };
  change(entry);
  return entry;
}

const meal = (name: string, kcal?: number): FoodEntry => ({
  id: name,
  meal: 'dinner',
  mealName: 'Obiad',
  name,
  kcal,
});

const ate = (...meals: FoodEntry[]) => (d: DailyCheckIn) => (d.food.meals = meals);

describe('findPatterns', () => {
  it('finds nothing in good days', () => {
    expect(findPatterns([day(0), day(1), day(2)], DEFAULT_GOALS)).toEqual([]);
  });

  it('puts eating too little several days in a row first', () => {
    const recent = [
      day(0, ate(meal('kawa', 5), meal('drożdżówka', 400))),
      day(1, ate(meal('zupa', 300))),
      day(2, ate(meal('kanapka', 350))),
      day(3, (d) => (d.sleep.durationHours = 6)),
      day(4, (d) => (d.sleep.durationHours = 6)),
      day(5, (d) => (d.sleep.durationHours = 6)),
    ];
    const [first, second] = findPatterns(recent, DEFAULT_GOALS);
    expect(first).toEqual({ signal: 'intake', need: 'nutrition', label: 'Za mało jedzenia', streak: 3, badDays: 3, days: 3 });
    // Also three short nights, but days ago: weaker than three hungry days up to now.
    expect(second).toEqual({ signal: 'sleep', need: 'energy', label: 'Za krótki sen', streak: 0, badDays: 3, days: 6 });
  });

  it('only counts kcal when every item has a number', () => {
    const recent = [0, 1, 2].map((n) => day(n, ate(meal('zupa', 300), meal('pierogi z mamą'))));
    expect(findPatterns(recent, DEFAULT_GOALS).map((p) => p.signal)).not.toContain('intake');
  });

  it('never treats a day without food logged as bad food', () => {
    const recent = [0, 1, 2].map((n) => day(n, (d) => (d.food.qualityScore = 50)));
    expect(findPatterns(recent, DEFAULT_GOALS)).toEqual([]);
  });

  it('notices bad days scattered over two weeks, but not one or two', () => {
    const low = (d: DailyCheckIn) => (d.mood.score = 3);
    const scattered = [day(0), day(2, low), day(4), day(6, low), day(8, low)];
    expect(findPatterns(scattered, DEFAULT_GOALS)).toEqual([
      { signal: 'mood', need: 'mood', label: 'Gorszy nastrój', streak: 0, badDays: 3, days: 5 },
    ]);
    const rare = [day(0), day(2, low), day(4), day(6), day(8, low), day(10)];
    expect(findPatterns(rare, DEFAULT_GOALS)).toEqual([]);
  });

  it('follows the goals: 4 h of screen is fine with a 5 h limit', () => {
    const recent = [0, 1, 2].map((n) => day(n, (d) => (d.metrics.screenTimeHours = 4)));
    expect(findPatterns(recent, DEFAULT_GOALS).map((p) => p.signal)).toEqual(['screen']);
    expect(findPatterns(recent, { ...DEFAULT_GOALS, screenMaxHours: 5 })).toEqual([]);
  });
});

describe('recentCheckIns', () => {
  it('keeps the last 14 days, newest first, and nothing from the future', () => {
    const recent = recentCheckIns([day(14), day(2), day(13), day(-1), day(0)], TODAY);
    expect(recent.map((c) => c.date)).toEqual([TODAY, addDays(TODAY, -2), addDays(TODAY, -13)]);
  });
});

describe('patternSpan', () => {
  const base = { signal: 'sleep', need: 'energy', label: 'Za krótki sen' } as const;

  it('says how long the run is, and the whole window when it is longer', () => {
    expect(patternSpan({ ...base, streak: 3, badDays: 3, days: 6 })).toBe('3 dni z rzędu');
    expect(patternSpan({ ...base, streak: 2, badDays: 5, days: 9 })).toBe('2 dni z rzędu · 5 z 9 dni');
    expect(patternSpan({ ...base, streak: 0, badDays: 4, days: 9 })).toBe('4 z 9 dni');
  });
});

describe('fingerprint', () => {
  it('changes with an edit, not with a new companion message', () => {
    const before = fingerprint([day(0), day(1)]);
    expect(fingerprint([day(0), day(1)])).toBe(before);
    expect(fingerprint([day(0, (d) => (d.note = 'zmęczony')), day(1)])).not.toBe(before);
    expect(fingerprint([day(0, (d) => (d.companionReaction.message = 'Hej')), day(1)])).toBe(before);
  });
});

describe('profileRequest', () => {
  it('sends the days oldest first, with notes trimmed to the backend limits', () => {
    const recent = [
      day(0, (d) => {
        d.note = ' ' + 'x'.repeat(1200);
        d.food.meals = [{ ...meal('makaron', 600), amount: '250 g' }];
      }),
      day(1, (d) => (d.sleep.qualityNote = 'późno do łóżka')),
    ];
    const request = profileRequest(recent, findPatterns(recent, DEFAULT_GOALS), DEFAULT_GOALS, TODAY);
    expect(request.days.map((d) => d.date)).toEqual([addDays(TODAY, -1), TODAY]);
    expect(request.days[0].sleepNote).toBe('późno do łóżka');
    expect(request.days[1].note?.length).toBe(1000);
    expect(request.days[1].meals).toEqual(['Obiad: makaron (250 g)']);
    expect(request.days[1].kcal).toBe(600);
    expect(request.days[0].meals).toBeUndefined();
  });
});
