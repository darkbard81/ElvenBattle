import { CARD_ART_WINDOW, CARD_WORK_SIZE } from './layout';
import { createPlaceholderPattern } from './placeholder';
import { getCardFrameTheme } from './theme';
import type { CardDisplayModel } from './types';

export interface RenderCardSvgOptions {
  usePlaceholderArt?: boolean;
}

export function renderCardSvg(model: CardDisplayModel, options: RenderCardSvgOptions = {}): string {
  const theme = getCardFrameTheme(model.type, model.rarity);
  const artContent =
    options.usePlaceholderArt === true
      ? createPlaceholderPattern(model)
      : `<rect x="${CARD_ART_WINDOW.x}" y="${CARD_ART_WINDOW.y}" width="${CARD_ART_WINDOW.width}" height="${CARD_ART_WINDOW.height}" rx="${CARD_ART_WINDOW.cornerRadius}" fill="#ff00ff" />`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WORK_SIZE.width}" height="${CARD_WORK_SIZE.height}" viewBox="0 0 ${CARD_WORK_SIZE.width} ${CARD_WORK_SIZE.height}">`,
    `<rect width="1024" height="1536" rx="42" fill="#070707" />`,
    artContent,
    renderFrame(theme.frameFill, theme.frameStroke, theme.accent, theme.gem),
    renderRuntimeBadges(theme.badgeFill, theme.frameStroke, theme.gem),
    `</svg>`,
  ].join('');
}

function renderFrame(frameFill: string, frameStroke: string, accent: string, gem: string): string {
  return [
    `<rect x="20" y="20" width="984" height="1496" rx="46" fill="none" stroke="${frameStroke}" stroke-width="10" />`,
    `<rect x="42" y="42" width="940" height="1452" rx="36" fill="none" stroke="${frameFill}" stroke-width="30" />`,
    `<rect x="72" y="82" width="880" height="1348" rx="70" fill="none" stroke="${frameStroke}" stroke-width="12" />`,
    `<path d="M110 118 C230 58 372 82 512 116 C652 82 794 58 914 118" fill="none" stroke="${accent}" stroke-width="28" stroke-linecap="round" />`,
    `<path d="M110 1418 C230 1478 372 1454 512 1420 C652 1454 794 1478 914 1418" fill="none" stroke="${accent}" stroke-width="28" stroke-linecap="round" />`,
    `<path d="M512 38 L568 96 L512 174 L456 96 Z" fill="${frameStroke}" stroke="#070707" stroke-width="8" />`,
    `<path d="M512 70 L542 102 L512 146 L482 102 Z" fill="${gem}" stroke="#e8d48a" stroke-width="5" />`,
    `<path d="M512 1362 L568 1438 L512 1512 L456 1438 Z" fill="${frameStroke}" stroke="#070707" stroke-width="8" />`,
    `<path d="M512 1396 L542 1438 L512 1482 L482 1438 Z" fill="${gem}" stroke="#e8d48a" stroke-width="5" />`,
    `<ellipse cx="58" cy="560" rx="34" ry="54" fill="${gem}" stroke="${frameStroke}" stroke-width="8" />`,
    `<ellipse cx="966" cy="560" rx="34" ry="54" fill="${gem}" stroke="${frameStroke}" stroke-width="8" />`,
  ].join('');
}

function renderRuntimeBadges(badgeFill: string, stroke: string, gem: string): string {
  return [
    renderBadge(146, 142, 104, badgeFill, stroke, gem),
    renderBadge(158, 1320, 112, badgeFill, stroke, gem),
    renderBadge(866, 1320, 112, badgeFill, stroke, gem),
  ].join('');
}

function renderBadge(
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke: string,
  gem: string,
): string {
  return [
    `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="14" />`,
    `<circle cx="${x}" cy="${y}" r="${radius - 18}" fill="none" stroke="#050505" stroke-opacity="0.8" stroke-width="8" />`,
    `<path d="M${x} ${y - radius - 28} L${x + 22} ${y - radius + 2} L${x} ${y - radius + 32} L${x - 22} ${y - radius + 2} Z" fill="${gem}" stroke="${stroke}" stroke-width="5" />`,
  ].join('');
}
