import { DEFAULT_LINES, DEFAULT_SPEECH, linesFor, moodSituation } from './speech.model';

describe('speech', () => {
  it('says the built-in lines until the user adds their own', () => {
    expect(linesFor(DEFAULT_SPEECH, 'petted')).toEqual(DEFAULT_LINES.petted);
    expect(linesFor(DEFAULT_SPEECH, 'hugged', ['Przytulas'])).toEqual(['Przytulas']);
  });

  it('says only the user lines, or mixes them in when asked to', () => {
    const lines = { petted: ['Mrau!'] };
    expect(linesFor({ lines, mixDefaults: false }, 'petted')).toEqual(['Mrau!']);
    expect(linesFor({ lines, mixDefaults: true }, 'petted')).toEqual([...DEFAULT_LINES.petted, 'Mrau!']);
    expect(linesFor({ lines, mixDefaults: false }, 'tickled')).toEqual(DEFAULT_LINES.tickled);
  });

  it('has a moment for every mood', () => {
    expect(moodSituation(4)).toBe('mood4');
    expect(DEFAULT_LINES[moodSituation(1)].length).toBeGreaterThan(0);
  });
});
