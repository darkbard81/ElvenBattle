import type { CardDefinition } from '../cards';
import type { GameState, PlayerId } from '../core';
import { validationError, validationOk } from '../rules';
import type { ValidationResult } from '../rules';

export function canPayDominanceForSummon(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): ValidationResult {
  const player = state.players[playerId];

  if (!player) {
    return validationError('ERR_INVALID_TARGET', 'error.invalid_target', {
      playerId,
    });
  }

  const nextUsed = player.dominance.used + (definition.dominanceCost ?? 0);
  const limit = player.dominance.limit + player.dominance.temporaryLimit;

  if (nextUsed > limit) {
    return validationError('ERR_INSUFFICIENT_DOMINANCE', 'error.insufficient_dominance', {
      playerId,
      cardId: definition.cardId,
      used: player.dominance.used,
      dominanceCost: definition.dominanceCost ?? 0,
      limit,
    });
  }

  return validationOk();
}
