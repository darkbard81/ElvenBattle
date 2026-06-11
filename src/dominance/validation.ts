import type { CardDefinition } from '../cards';
import type { GameState, PlayerId } from '../core';
import type { SlotId } from '../board';
import { validationError, validationOk } from '../rules';
import type { ValidationResult } from '../rules';
import { calculateSlotDominance } from './calculate';

export function canPayDominanceForSummon(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
  slotId: SlotId,
): ValidationResult {
  const player = state.players[playerId];

  if (!player) {
    return validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
      playerId,
    });
  }

  const slotDominance = calculateSlotDominance(
    state,
    state.cardDefinitions ?? {},
    playerId,
    slotId,
  );

  if (definition.cost > slotDominance) {
    return validationError('ERR_INSUFFICIENT_DOMINANCE', 'error.insufficient_dominance', {
      playerId,
      cardId: definition.cardId,
      slotId,
      cost: definition.cost,
      slotDominance,
    });
  }

  return validationOk();
}
