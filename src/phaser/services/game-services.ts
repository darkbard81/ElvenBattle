import type Phaser from 'phaser';
import type { AuthSessionController } from '../../game/auth/client';
import type { SaveSlotsClient } from '../../game/save/client-api';

export const GAME_SERVICES_REGISTRY_KEY = 'elven-battle.game-services';

/** Phaser registry를 통해 Scene에 명시적으로 주입되는 브라우저 서비스다. */
export type GameServices = {
  auth: AuthSessionController;
  saveSlots: SaveSlotsClient;
};

/** Scene registry에 주입된 브라우저 API 서비스를 안전하게 읽는다. */
export function getGameServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(GAME_SERVICES_REGISTRY_KEY) as unknown;
  if (!isGameServices(services)) {
    throw new Error('Game services are not registered');
  }
  return services;
}

function isGameServices(value: unknown): value is GameServices {
  return typeof value === 'object' && value !== null && 'auth' in value && 'saveSlots' in value;
}
