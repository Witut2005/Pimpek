import { AiError } from '../models/ai.model';
import { readSkinPack } from './skin-pack';
import { cleanSvg, SkinGenerator } from './skin-generator';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 850"><circle cx="390" cy="500" r="200"/></svg>';

describe('cleanSvg', () => {
  it('pulls the SVG out of a fenced answer', () => {
    const svg = cleanSvg('Here you go:\n```svg\n' + SVG + '\n```');
    expect(svg.startsWith('<svg')).toBeTrue();
    expect(svg).toContain('<circle');
  });

  it('adds the namespace and viewBox when the model forgets them', () => {
    const svg = cleanSvg('<svg width="780" height="850"><rect width="10" height="10"/></svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 780 850"');
    expect(svg).not.toContain('width="780"');
  });

  it('strips scripts, event handlers and external links', () => {
    const svg = cleanSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 780 850">' +
        '<script>alert(1)</script><circle onclick="alert(1)" r="5"/>' +
        '<image href="https://example.com/x.png"/><use xlink:href="https://example.com/a.svg#b"/><use href="#ok"/></svg>',
    );
    expect(svg).not.toContain('script');
    expect(svg).not.toContain('onclick');
    expect(svg).not.toContain('example.com');
    expect(svg).toContain('href="#ok"');
  });

  it('explains an answer without a drawing', () => {
    expect(() => cleanSvg('Sorry, I cannot draw that.')).toThrowError(AiError, /nie odesłał rysunku/);
  });

  it('explains an answer cut off half way', () => {
    expect(() => cleanSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/>')).toThrowError(AiError, /urwał/);
  });
});

describe('SkinGenerator.pack', () => {
  it('builds a pack the regular skin reader plays, with the app motion on', () => {
    const zip = new SkinGenerator().pack('Chmurek', { neutral: SVG, happy: SVG, celebrate: SVG });
    const skin = readSkinPack('id', 'Chmurek.zip', zip);
    expect(skin.name).toBe('Chmurek');
    expect(skin.motion).toBeTrue();
    expect(skin.provided).toEqual(['happy', 'neutral', 'celebrate']);
    skin.urls.forEach((url) => URL.revokeObjectURL(url));
  });

  it('keeps the touch clips it drew and leaves the others to borrow happy', () => {
    const zip = new SkinGenerator().pack('Chmurek', { neutral: SVG, petted: SVG, tickled: SVG });
    const skin = readSkinPack('id', 'Chmurek.zip', zip);
    expect(skin.clips.petted).toBeDefined();
    expect(skin.clips.tickled).toBeDefined();
    expect(skin.clips.hugged).toBeUndefined();
    expect(skin.provided).toEqual(['neutral', 'petted', 'tickled']);
    skin.urls.forEach((url) => URL.revokeObjectURL(url));
  });
});
