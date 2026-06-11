import type { BoardSlotViewModel } from './types';

export interface BoardSlotRenderCommand {
  slotId: string;
  label: string;
  occupied: boolean;
  legal: boolean;
  selected: boolean;
}

export function createBoardRenderCommands(
  slots: readonly BoardSlotViewModel[],
): BoardSlotRenderCommand[] {
  return slots.map((slot) => ({
    slotId: slot.slotId,
    label: `${slot.ownerSide} ${slot.row} ${slot.column + 1}`,
    occupied: slot.unit !== null,
    legal: slot.isLegalTarget,
    selected: slot.isSelected,
  }));
}
