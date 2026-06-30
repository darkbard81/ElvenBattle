import type { CardAbility } from '../save/card-catalog';
import type { ActiveSkillBattleEffect, BattleCardRuntimeState, BattleRuntimeState } from './types';

export type BattleRuntimeEffectStat = 'attack' | 'hp' | 'dominance';

export type PassiveStatModifier = {
  stat: BattleRuntimeEffectStat;
  value: number;
};

export type PassiveAbilityContext = {
  runtime: BattleRuntimeState;
  source: BattleCardRuntimeState;
  target: BattleCardRuntimeState;
  ability: CardAbility;
  isFrontRowCard: (card: BattleCardRuntimeState) => boolean;
  hasTrait: (card: BattleCardRuntimeState, key: string, text: string) => boolean;
};

export type AttackDamageAbilityContext = {
  runtime: BattleRuntimeState;
  attacker: BattleCardRuntimeState;
  target: BattleCardRuntimeState;
  ability: CardAbility;
  isBackRowCard: (card: BattleCardRuntimeState) => boolean;
  getEffectiveHp: (runtime: BattleRuntimeState, card: BattleCardRuntimeState) => number;
};

export type ActiveSkillDefinition = {
  effect: ActiveSkillBattleEffect;
  value: number;
  targetSide: 'ally' | 'enemy';
};

export type PassiveAbilityHandler = (context: PassiveAbilityContext) => PassiveStatModifier | null;

export type AttackDamageAbilityHandler = (context: AttackDamageAbilityContext) => number;

export const FRONT_PASSIVE_ABILITY_HANDLERS: Partial<Record<string, PassiveAbilityHandler>> = {
  guardian_stance: ({ source, target, isFrontRowCard }) =>
    source === target && isFrontRowCard(source) ? { stat: 'hp', value: 1 } : null,
  stonehide_stance: ({ source, target, isFrontRowCard }) =>
    source === target && isFrontRowCard(source) ? { stat: 'hp', value: 1 } : null,
};

export const GLOBAL_PASSIVE_ABILITY_HANDLERS: Partial<Record<string, PassiveAbilityHandler>> = {
  guardian_block: () => null,
  stonewall_guard: () => null,
  silver_chord: ({ source, target, hasTrait }) =>
    source !== target && source.side === target.side && hasTrait(target, 'race', '엘프')
      ? { stat: 'attack', value: 1 }
      : null,
  hollow_chorus: ({ source, target, hasTrait }) =>
    source !== target && source.side === target.side && hasTrait(target, 'race', '몬스터')
      ? { stat: 'attack', value: 1 }
      : null,
};

export const SUMMON_ATTACK_BONUS_ABILITY_IDS = new Set(['greenwood_charge', 'iron_spike_charge']);

export const MOVE_ATTACK_BONUS_ABILITY_IDS = new Set(['forest_path', 'mist_stride']);

export const AFTER_ATTACK_BUFF_ABILITY_IDS = new Set(['leafwind_flurry', 'shadow_blade_flurry']);

export const BLOCK_ABILITY_IDS = new Set(['guardian_block']);

export const ATTACK_DAMAGE_BONUS_ABILITY_HANDLERS: Partial<
  Record<string, AttackDamageAbilityHandler>
> = {
  moonlit_shot: ({ target, isBackRowCard }) => (isBackRowCard(target) ? 1 : 0),
  eclipse_shot: ({ target, isBackRowCard }) => (isBackRowCard(target) ? 1 : 0),
  shadow_leaf_strike: ({ runtime, target, getEffectiveHp }) =>
    getEffectiveHp(runtime, target) <= 3 ? 1 : 0,
  night_prey: ({ runtime, target, getEffectiveHp }) =>
    getEffectiveHp(runtime, target) <= 3 ? 1 : 0,
  rapier_thrust: () => 2,
};

export const ACTIVE_SKILL_DEFINITIONS: Partial<Record<string, ActiveSkillDefinition>> = {
  starlight_mend: { effect: 'HEAL', value: 2, targetSide: 'ally' },
  curse_reversal: { effect: 'HEAL', value: 2, targetSide: 'ally' },
  emerald_bolt: { effect: 'DAMAGE', value: 2, targetSide: 'enemy' },
  blackflame_bolt: { effect: 'DAMAGE', value: 2, targetSide: 'enemy' },
  rune_tempering: { effect: 'BUFF_ATTACK', value: 1, targetSide: 'ally' },
  rune_forge: { effect: 'BUFF_ATTACK', value: 1, targetSide: 'ally' },
};
