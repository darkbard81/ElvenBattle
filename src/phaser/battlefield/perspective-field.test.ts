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
  it('keeps the issue #20 2D projection skeleton slot mapping order', () => {
    expect(PERSPECTIVE_SLOT_ROWS).toEqual([
      ['enemy:BR', 'enemy:BC', 'enemy:BL'],
      ['enemy:FR', 'enemy:FC', 'enemy:FL'],
      ['player:FR', 'player:FC', 'player:FL'],
      ['player:BR', 'player:BC', 'player:BL'],
    ]);
  });

  it('projects normalized coordinates for the issue #20 quadrilateral skeleton', () => {
    expect(projectToField(0, 0)).toMatchObject(PERSPECTIVE_FIELD_QUAD.tl);
    expect(projectToField(1, 0)).toMatchObject(PERSPECTIVE_FIELD_QUAD.tr);
    expect(projectToField(0, 1).x).toBeCloseTo(PERSPECTIVE_FIELD_QUAD.bl.x, 4);
    expect(projectToField(0, 1).y).toBeCloseTo(PERSPECTIVE_FIELD_QUAD.bl.y, 4);
    expect(projectToField(1, 1).x).toBeCloseTo(PERSPECTIVE_FIELD_QUAD.br.x, 4);
    expect(projectToField(1, 1).y).toBeCloseTo(PERSPECTIVE_FIELD_QUAD.br.y, 4);
  });

  it('classifies all slot centers through slotQuad polygon hit testing', () => {
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
