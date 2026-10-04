import { avatarStateFor, daysTogether } from './pet-rules';

describe('pet rules', () => {
  it('mirrors the mood just written down', () => {
    expect(avatarStateFor(4)).toBe('happy');
    expect(avatarStateFor(3)).toBe('happy');
    expect(avatarStateFor(2)).toBe('neutral');
    expect(avatarStateFor(1)).toBe('sad');
  });

  it('counts days together without resetting after a break', () => {
    const dates = new Set(['2026-09-01', '2026-10-01', '2026-10-03']);
    expect(daysTogether(dates, '2026-10-04')).toBe(3);
    expect(daysTogether(dates, '2026-12-31')).toBe(3);
    expect(daysTogether(dates, '2026-10-02')).toBe(2);
  });
});
