import { describe, expect, it } from 'vitest';
import { joinAssetUrl, normalizeAssetBaseUrl } from './manifest';

describe('asset manifest helpers', () => {
  it('normalizes asset base urls', () => {
    expect(normalizeAssetBaseUrl('/tcg')).toBe('/tcg');
    expect(normalizeAssetBaseUrl('/tcg/')).toBe('/tcg');
    expect(normalizeAssetBaseUrl('tcg/')).toBe('/tcg');
    expect(normalizeAssetBaseUrl('/')).toBe('/');
  });

  it('joins asset urls without duplicating slashes', () => {
    expect(joinAssetUrl('/tcg', 'assets.json')).toBe('/tcg/assets.json');
    expect(joinAssetUrl('/tcg/', '/images/card.webp')).toBe('/tcg/images/card.webp');
    expect(joinAssetUrl('tcg', 'fonts/CookieRun.ttf')).toBe('/tcg/fonts/CookieRun.ttf');
  });
});
