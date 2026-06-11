import type { CardRenderSize, SkillTextOverlaySlot } from './types';

export const CARD_RENDERER_VERSION = 'card-renderer-v0.1.0';

export const CARD_WORK_SIZE: CardRenderSize = {
  width: 1024,
  height: 1536,
};

export const CARD_OUTPUT_SIZE: CardRenderSize = {
  width: 512,
  height: 768,
};

export const CARD_SAFE_AREA = {
  x: 24,
  y: 24,
  width: CARD_WORK_SIZE.width - 48,
  height: CARD_WORK_SIZE.height - 48,
} as const;

export const CARD_ART_WINDOW = {
  x: 92,
  y: 128,
  width: 840,
  height: 1250,
  cornerRadius: 62,
} as const;

export const CARD_NAME_OVERLAY = {
  x: 164,
  y: 78,
  width: 696,
  height: 54,
} as const;

export const DEFAULT_SKILL_TEXT_OVERLAY: SkillTextOverlaySlot = {
  x: 132,
  y: 1010,
  width: 760,
  height: 250,
  padding: 28,
  backgroundColor: '#050608',
  backgroundAlpha: 0.62,
  fontKey: 'card-rules',
  maxLines: 5,
};

export function scaleCardCoordinate(
  value: number,
  from = CARD_WORK_SIZE.width,
  to = CARD_OUTPUT_SIZE.width,
): number {
  return (value * to) / from;
}
