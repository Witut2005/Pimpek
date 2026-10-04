import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KEYS, LEGACY_KEYS } from '../../shared/storage';
import { JournalStore } from './journal.store';

describe('JournalStore', () => {
  const create = () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(JournalStore);
  };

  beforeEach(() => {
    [...Object.values(KEYS), ...Object.values(LEGACY_KEYS)].forEach((k) => localStorage.removeItem(k));
  });

  it('keeps one entry per day, newest day first', () => {
    const store = create();
    store.save({ date: '2026-10-03', mood: 2 });
    store.save({ date: '2026-10-04', mood: 3 });
    store.save({ date: '2026-10-04', mood: 5, note: 'spacer' });
    expect(store.entries()).toEqual([
      { date: '2026-10-04', mood: 5, note: 'spacer' },
      { date: '2026-10-03', mood: 2 },
    ]);
    expect(store.byDate().get('2026-10-04')?.mood).toBe(5);
  });

  it('edits, moves and deletes an entry', () => {
    const store = create();
    store.save({ date: '2026-09-20', mood: 3, note: 'notatka' });
    store.save({ date: '2026-09-20', mood: 4 });
    expect(store.entries()).toEqual([{ date: '2026-09-20', mood: 4 }]);
    store.save({ date: '2026-10-03', mood: 5 }, '2026-09-20');
    expect(store.entries()).toEqual([{ date: '2026-10-03', mood: 5 }]);
    store.remove('2026-10-03');
    expect(store.entries()).toEqual([]);
  });

  it('merges older timed entries into one per day, keeping the last one written', () => {
    localStorage.setItem(
      KEYS.journal,
      JSON.stringify([
        { id: 'x', date: '2026-10-04', createdAt: '2026-10-04T08:00:00.000Z', mood: 2 },
        { id: 'y', date: '2026-10-04', createdAt: '2026-10-04T20:00:00.000Z', mood: 4, note: 'wieczór' },
      ]),
    );
    expect(create().entries()).toEqual([{ date: '2026-10-04', mood: 4, note: 'wieczór' }]);
  });

  it('turns old daily check-ins into mood entries and drops the integration caches', () => {
    localStorage.setItem(
      LEGACY_KEYS.checkIns,
      JSON.stringify([
        { id: 'a', date: '2026-10-01', createdAt: '2026-10-01T19:00:00.000Z', mood: { score: 9 }, note: 'super' },
        { id: 'b', date: '2026-10-02', createdAt: '2026-10-02T19:00:00.000Z', mood: { score: 3 } },
      ]),
    );
    localStorage.setItem(LEGACY_KEYS.strava, '{}');
    const store = create();
    expect(store.entries()).toEqual([
      { date: '2026-10-02', mood: 2 },
      { date: '2026-10-01', mood: 5, note: 'super' },
    ]);
    expect(localStorage.getItem(LEGACY_KEYS.checkIns)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.strava)).toBeNull();
  });
});
