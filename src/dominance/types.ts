export type DominanceOverloadPolicy =
  | 'BLOCK_NEW_SUMMON_ONLY'
  | 'SACRIFICE_AT_END'
  | 'ALLOW_TEMPORARY';

export interface ResourceState {
  current: number;
  max: number;
  cap: number;
  temporary: number;
}

export interface DominanceState {
  /** 현재 전장에 유지할 수 있는 지배력 한계 */
  limit: number;
  /** 카드 효과나 시나리오로 임시 증가한 지배력 한계 */
  temporaryLimit: number;
  /** 전장 카드들이 점유 중인 지배력 비용 합계 */
  used: number;
  /** 전장 카드들이 제공하는 장악 점수 합계 */
  boardValue: number;
  /** used가 limit + temporaryLimit를 초과했는지 여부 */
  overloaded: boolean;
}

export interface DominanceConfig {
  startLimit: number;
  limitGainPerTurn: number;
  cap: number;
  overloadPolicy: DominanceOverloadPolicy;
}

export const DEFAULT_RESOURCE_STATE: ResourceState = {
  current: 0,
  max: 0,
  cap: 10,
  temporary: 0,
};

export const DEFAULT_DOMINANCE_CONFIG = {
  startLimit: 3,
  limitGainPerTurn: 1,
  cap: 10,
  overloadPolicy: 'BLOCK_NEW_SUMMON_ONLY',
} as const satisfies DominanceConfig;

export function createInitialDominanceState(
  config: DominanceConfig = DEFAULT_DOMINANCE_CONFIG,
): DominanceState {
  return {
    limit: config.startLimit,
    temporaryLimit: 0,
    used: 0,
    boardValue: 0,
    overloaded: false,
  };
}
