import type { LogItemViewModel } from './types';

export function formatLogItems(items: readonly LogItemViewModel[]): string[] {
  return items.map((item) => `${item.index} ${item.summary}`);
}
