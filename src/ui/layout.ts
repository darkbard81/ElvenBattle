import type { SlotId } from '../board';
import type { PlayerId } from '../core';

export interface RectLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameLayout {
  width: number;
  height: number;
  boardSlots: Record<SlotId, RectLayout>;
  hand: RectLayout;
  statusPanels: Record<PlayerId, RectLayout>;
  logPanel: RectLayout;
  controls: RectLayout;
}

export const BASE_GAME_WIDTH = 1280;
export const BASE_GAME_HEIGHT = 720;

export function createGameLayout(
  playerIds: readonly PlayerId[],
  width = BASE_GAME_WIDTH,
  height = BASE_GAME_HEIGHT,
): GameLayout {
  const scaleX = width / BASE_GAME_WIDTH;
  const scaleY = height / BASE_GAME_HEIGHT;
  const scaleRect = (rect: RectLayout): RectLayout => ({
    x: Math.round(rect.x * scaleX),
    y: Math.round(rect.y * scaleY),
    width: Math.round(rect.width * scaleX),
    height: Math.round(rect.height * scaleY),
  });
  const boardSlots = {} as Record<SlotId, RectLayout>;
  const slotWidth = 132;
  const slotHeight = 164;
  const startX = 410;
  const rows = [
    { playerId: playerIds[1] ?? 'P2', row: 'BACK' as const, y: 80 },
    { playerId: playerIds[1] ?? 'P2', row: 'FRONT' as const, y: 252 },
    { playerId: playerIds[0] ?? 'P1', row: 'FRONT' as const, y: 424 },
    { playerId: playerIds[0] ?? 'P1', row: 'BACK' as const, y: 596 },
  ];

  for (const row of rows) {
    for (const column of [0, 1, 2] as const) {
      boardSlots[`${row.playerId}:${row.row}:${column}`] = scaleRect({
        x: startX + column * 150,
        y: row.y,
        width: slotWidth,
        height: slotHeight,
      });
    }
  }

  return {
    width,
    height,
    boardSlots,
    hand: scaleRect({ x: 24, y: 500, width: 340, height: 190 }),
    statusPanels: Object.fromEntries(
      playerIds.map((playerId, index) => [
        playerId,
        scaleRect({ x: 24, y: index === 0 ? 380 : 24, width: 320, height: 104 }),
      ]),
    ),
    logPanel: scaleRect({ x: 920, y: 340, width: 330, height: 330 }),
    controls: scaleRect({ x: 920, y: 48, width: 330, height: 240 }),
  };
}
