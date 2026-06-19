import { describe, expect, it } from 'vitest';
import {
  createFieldPointerIntent,
  PERSPECTIVE_FIELD_QUAD,
  PERSPECTIVE_SLOT_ROWS,
  pointInPoly,
  projectToField,
  slotCenter,
  slotQuad,
} from './perspective-field';

describe('perspective-field', () => {
  it('keeps the issue #20 slot mapping order', () => {
    expect(PERSPECTIVE_SLOT_ROWS).toEqual([
      ['enemy:BR', 'enemy:BC', 'enemy:BL'],
      ['enemy:FR', 'enemy:FC', 'enemy:FL'],
      ['player:FR', 'player:FC', 'player:FL'],
      ['player:BR', 'player:BC', 'player:BL'],
    ]);
  });

  it('projects normalized field coordinates to the configured quadrilateral', () => {
    expect(projectToField(0, 0)).toEqual(PERSPECTIVE_FIELD_QUAD.tl);
    expect(projectToField(1, 0)).toEqual(PERSPECTIVE_FIELD_QUAD.tr);
    expect(projectToField(0, 1)).toEqual(PERSPECTIVE_FIELD_QUAD.bl);
    expect(projectToField(1, 1)).toEqual(PERSPECTIVE_FIELD_QUAD.br);
  });

  it('classifies all slot centers as their own slot', () => {
    for (const row of PERSPECTIVE_SLOT_ROWS) {
      for (const slotId of row) {
        const center = slotCenter(slotId);

        expect(pointInPoly(center, slotQuad(slotId))).toBe(true);
        expect(createFieldPointerIntent(center)).toEqual({
          type: 'select-slot',
          slotId,
        });
      }
    }
  });
});
