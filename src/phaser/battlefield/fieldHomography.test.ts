import { describe, expect, it } from 'vitest';
import {
  createFieldHomography,
  fieldLocalToScreen,
  fieldLocalToSlotId,
  PERSPECTIVE_FIELD_QUAD,
  PERSPECTIVE_SLOT_ROWS,
  screenToFieldLocal,
  type FieldPoint,
  type FieldRect,
} from './fieldHomography';

const SOURCE_RECT = {
  x: 0,
  y: 0,
  width: 760,
  height: 520,
} as const satisfies FieldRect;

describe('fieldHomography', () => {
  it('maps source rect corners to the perspective field quad', () => {
    const homography = createFieldHomography(SOURCE_RECT, PERSPECTIVE_FIELD_QUAD);
    const pairs: Array<[FieldPoint, FieldPoint]> = [
      [{ x: 0, y: 0 }, PERSPECTIVE_FIELD_QUAD.tl],
      [{ x: SOURCE_RECT.width, y: 0 }, PERSPECTIVE_FIELD_QUAD.tr],
      [{ x: SOURCE_RECT.width, y: SOURCE_RECT.height }, PERSPECTIVE_FIELD_QUAD.br],
      [{ x: 0, y: SOURCE_RECT.height }, PERSPECTIVE_FIELD_QUAD.bl],
    ];

    pairs.forEach(([source, expected]) => {
      expectPointClose(fieldLocalToScreen(source, homography), expected);
    });
  });

  it('maps perspective field quad corners back to the source rect', () => {
    const homography = createFieldHomography(SOURCE_RECT, PERSPECTIVE_FIELD_QUAD);
    const pairs: Array<[FieldPoint, FieldPoint]> = [
      [PERSPECTIVE_FIELD_QUAD.tl, { x: 0, y: 0 }],
      [PERSPECTIVE_FIELD_QUAD.tr, { x: SOURCE_RECT.width, y: 0 }],
      [PERSPECTIVE_FIELD_QUAD.br, { x: SOURCE_RECT.width, y: SOURCE_RECT.height }],
      [PERSPECTIVE_FIELD_QUAD.bl, { x: 0, y: SOURCE_RECT.height }],
    ];

    pairs.forEach(([screen, expected]) => {
      const local = screenToFieldLocal(screen, homography);

      expect(local).not.toBeNull();
      expectPointClose(local!, expected);
    });
  });

  it('classifies all source slot centers by the established battlefield row order', () => {
    for (let row = 0; row < PERSPECTIVE_SLOT_ROWS.length; row += 1) {
      const slots = PERSPECTIVE_SLOT_ROWS[row]!;

      for (let col = 0; col < slots.length; col += 1) {
        const slotId = slots[col]!;
        const local = {
          x: ((col + 0.5) / slots.length) * SOURCE_RECT.width,
          y: ((row + 0.5) / PERSPECTIVE_SLOT_ROWS.length) * SOURCE_RECT.height,
        };

        expect(fieldLocalToSlotId(local, SOURCE_RECT)).toBe(slotId);
      }
    }
  });

  it('round-trips screen slot centers through inverse homography', () => {
    const homography = createFieldHomography(SOURCE_RECT, PERSPECTIVE_FIELD_QUAD);

    for (let row = 0; row < PERSPECTIVE_SLOT_ROWS.length; row += 1) {
      const slots = PERSPECTIVE_SLOT_ROWS[row]!;

      for (let col = 0; col < slots.length; col += 1) {
        const slotId = slots[col]!;
        const local = {
          x: ((col + 0.5) / slots.length) * SOURCE_RECT.width,
          y: ((row + 0.5) / PERSPECTIVE_SLOT_ROWS.length) * SOURCE_RECT.height,
        };
        const screen = fieldLocalToScreen(local, homography);
        const roundTripped = screenToFieldLocal(screen, homography);

        expect(roundTripped).not.toBeNull();
        expect(fieldLocalToSlotId(roundTripped!, SOURCE_RECT)).toBe(slotId);
      }
    }
  });

  it('returns null for screen points outside the field quad', () => {
    const homography = createFieldHomography(SOURCE_RECT, PERSPECTIVE_FIELD_QUAD);

    expect(screenToFieldLocal({ x: 0, y: 0 }, homography)).toBeNull();
    expect(screenToFieldLocal({ x: 1200, y: 760 }, homography)).toBeNull();
  });
});

function expectPointClose(actual: FieldPoint, expected: FieldPoint): void {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}
