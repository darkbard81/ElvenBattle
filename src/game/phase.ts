import type { GameState, Phase, PlayerId } from '../core';
import { createPhaseChangedEvent } from '../events';
import type { ValidationResult } from '../rules';
import { mergeValidationResults, validateGameRunning, validatePriorityPlayer } from '../rules';
import { drawCard } from '../zones';
import { finalizeIfWinConditionMet } from './end';
import { handleDrawFromEmptyDeck } from './win';

export const TURN_PHASES = [
  'TURN_START',
  'DRAW',
  'RESOURCE',
  'MAIN',
  'COMBAT',
  'END',
] as const satisfies readonly Phase[];

export function isTurnPhase(phase: Phase): boolean {
  return TURN_PHASES.some((turnPhase) => turnPhase === phase);
}

export function isAutomaticPhase(phase: Phase): boolean {
  return phase === 'TURN_START' || phase === 'DRAW' || phase === 'RESOURCE';
}

export function getNextPhase(phase: Phase): Phase | null {
  const phaseIndex = TURN_PHASES.findIndex((turnPhase) => turnPhase === phase);

  if (phaseIndex < 0) {
    return null;
  }

  return TURN_PHASES[phaseIndex + 1] ?? null;
}

export function canEndPhase(state: GameState, playerId: PlayerId): ValidationResult {
  return mergeValidationResults(
    validateGameRunning(state),
    validatePriorityPlayer(state, playerId),
  );
}

export function advanceAutomaticPhase(state: GameState): GameState {
  if (!isAutomaticPhase(state.phase)) {
    return state;
  }

  const stateAfterAutomaticEffect = applyAutomaticPhaseEffect(state);
  const stateAfterWinCheck = finalizeIfWinConditionMet(stateAfterAutomaticEffect);

  if (stateAfterWinCheck.phase === 'GAME_OVER') {
    return stateAfterWinCheck;
  }

  const nextPhase = getNextPhase(state.phase);

  if (!nextPhase) {
    return stateAfterWinCheck;
  }

  const event = createPhaseChangedEvent(stateAfterWinCheck, state.phase, nextPhase);

  return {
    ...stateAfterWinCheck,
    phase: nextPhase,
    priorityPlayerId: stateAfterWinCheck.activePlayerId,
    eventLog: [...stateAfterWinCheck.eventLog, event],
  };
}

export function advanceToFirstPlayablePhase(state: GameState): GameState {
  let nextState = state;

  while (isAutomaticPhase(nextState.phase)) {
    nextState = advanceAutomaticPhase(nextState);
  }

  return nextState;
}

function applyAutomaticPhaseEffect(state: GameState): GameState {
  if (state.phase !== 'DRAW') {
    return state;
  }

  const result = drawCard(state, state.activePlayerId);

  if (result.ok) {
    return result.state;
  }

  if (result.validation.errors.some((error) => error.code === 'ERR_EMPTY_DECK')) {
    return handleDrawFromEmptyDeck(state, state.activePlayerId);
  }

  return state;
}
