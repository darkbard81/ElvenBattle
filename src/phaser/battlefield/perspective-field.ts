import type { BattleSlotId } from '../../game/battle/types';
import {
  createFieldHomography,
  fieldLocalToScreen,
  fieldLocalToSlotId,
  PERSPECTIVE_FIELD_QUAD,
  PERSPECTIVE_SLOT_ROWS,
  screenToFieldLocal,
  UNIT_FIELD_RECT,
  type FieldPoint,
  type FieldQuad,
} from './fieldHomography';

export {
  createFieldHomography,
  fieldLocalToScreen,
  fieldLocalToSlotId,
  fieldQuadBounds,
  PERSPECTIVE_FIELD_QUAD,
  PERSPECTIVE_SLOT_ROWS,
  screenToFieldLocal,
  UNIT_FIELD_RECT,
  type FieldHomography,
  type FieldPoint,
  type FieldQuad,
  type FieldRect,
  type HomographyMatrix,
} from './fieldHomography';

export type FieldPointerIntent = {
  type: 'select-slot';
  slotId: BattleSlotId;
};

/**
 * 정규화된 필드 좌표를 사다리꼴 전장 위의 화면 좌표로 투영한다.
 * 전투 규칙의 슬롯 개념과 분리된 렌더링 전용 계산이므로 Phaser 객체를 만들지 않는다.
 */
export function projectToField(
  u: number,
  v: number,
  fieldQuad: FieldQuad = PERSPECTIVE_FIELD_QUAD,
): FieldPoint {
  return fieldLocalToScreen({ x: u, y: v }, createFieldHomography(UNIT_FIELD_RECT, fieldQuad));
}

/**
 * 지정한 전장 슬롯의 화면 중심점을 계산한다.
 * 반환 좌표는 카드 배치, 슬롯 라벨, 클릭 검증 테스트에서 같은 기준으로 사용한다.
 */
export function slotCenter(
  slotId: BattleSlotId,
  fieldQuad: FieldQuad = PERSPECTIVE_FIELD_QUAD,
): FieldPoint {
  const position = findSlotPosition(slotId);
  return projectToField(
    (position.col + 0.5) / PERSPECTIVE_SLOT_ROWS[0]!.length,
    (position.row + 0.5) / PERSPECTIVE_SLOT_ROWS.length,
    fieldQuad,
  );
}

/**
 * 지정한 전장 슬롯의 화면 사각형을 원근 투영된 4점 폴리곤으로 반환한다.
 * 실제 입력 판정은 이 폴리곤을 기준으로 하며, 도메인 슬롯 순서는 `PERSPECTIVE_SLOT_ROWS`가 소유한다.
 */
export function slotQuad(
  slotId: BattleSlotId,
  fieldQuad: FieldQuad = PERSPECTIVE_FIELD_QUAD,
): FieldPoint[] {
  const position = findSlotPosition(slotId);
  const u0 = position.col / PERSPECTIVE_SLOT_ROWS[0]!.length;
  const u1 = (position.col + 1) / PERSPECTIVE_SLOT_ROWS[0]!.length;
  const v0 = position.row / PERSPECTIVE_SLOT_ROWS.length;
  const v1 = (position.row + 1) / PERSPECTIVE_SLOT_ROWS.length;

  return [
    projectToField(u0, v0, fieldQuad),
    projectToField(u1, v0, fieldQuad),
    projectToField(u1, v1, fieldQuad),
    projectToField(u0, v1, fieldQuad),
  ];
}

/**
 * 점이 폴리곤 내부 또는 경계 위에 있는지 검사한다.
 * Phaser hit area 없이도 투영 슬롯 판정을 테스트할 수 있도록 순수 함수로 유지한다.
 */
export function pointInPoly(point: FieldPoint, polygon: FieldPoint[]): boolean {
  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;

    if (isPointOnSegment(point, previous, current)) {
      return true;
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 화면 좌표를 전장 클릭 intent로 변환한다.
 * v1에서는 슬롯 선택만 만들고, 이동/소환/공격 판단은 후속 전투 규칙 계층에 위임한다.
 */
export function createFieldPointerIntent(
  point: FieldPoint,
  fieldQuad: FieldQuad = PERSPECTIVE_FIELD_QUAD,
): FieldPointerIntent | null {
  const local = screenToFieldLocal(point, createFieldHomography(UNIT_FIELD_RECT, fieldQuad));
  const slotId = local ? fieldLocalToSlotId(local, UNIT_FIELD_RECT) : null;

  if (!slotId) {
    return null;
  }

  return {
    type: 'select-slot',
    slotId,
  };
}

function findSlotPosition(slotId: BattleSlotId): { row: number; col: number } {
  for (let row = 0; row < PERSPECTIVE_SLOT_ROWS.length; row += 1) {
    const rowSlots = PERSPECTIVE_SLOT_ROWS[row] as readonly BattleSlotId[];
    const col = rowSlots.indexOf(slotId);
    if (col >= 0) {
      return { row, col };
    }
  }

  throw new Error(`Unknown battle slot id: ${slotId}`);
}

function isPointOnSegment(point: FieldPoint, start: FieldPoint, end: FieldPoint): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.001) {
    return false;
  }

  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < 0) {
    return false;
  }

  const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= squaredLength;
}
