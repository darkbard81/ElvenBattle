import { describe, expect, it } from 'vitest';
import basicUnit from '../card-data/examples/basic-unit.example.json';
import { parseCardDefinition } from '../src/cards';
import { createCardDisplayModel, renderCardSvg, wrapDisplayText } from '../src/assets/cards';

describe('Phase 9 card renderer', () => {
  it('renders deterministic full-art SVG without baked runtime numbers', () => {
    const model = createCardDisplayModel(parseCardDefinition(basicUnit));
    const firstSvg = renderCardSvg(model);
    const secondSvg = renderCardSvg(model);

    expect(firstSvg).toBe(secondSvg);
    expect(firstSvg).toContain('#ff00ff');
    expect(firstSvg).not.toContain('<text');
    expect(firstSvg).not.toContain('>2<');
    expect(firstSvg).not.toContain('>3<');
  });

  it('renders deterministic placeholder art when requested', () => {
    const model = createCardDisplayModel(parseCardDefinition(basicUnit));
    const firstSvg = renderCardSvg(model, { usePlaceholderArt: true });
    const secondSvg = renderCardSvg(model, { usePlaceholderArt: true });

    expect(firstSvg).toBe(secondSvg);
    expect(firstSvg).toContain(`pattern-${model.cardId}`);
    expect(firstSvg).not.toContain('#ff00ff');
  });

  it('wraps long display text into bounded overlay lines', () => {
    const lines = wrapDisplayText(
      'This is a deliberately long skill description for overlay testing.',
      16,
      3,
    );

    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.every((line) => line.length <= 16)).toBe(true);
  });
});
