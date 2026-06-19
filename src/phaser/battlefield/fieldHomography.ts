import type { BattleSlotId } from '../../game/battle/types';

export type FieldPoint = {
  x: number;
  y: number;
};

export type FieldQuad = {
  tl: FieldPoint;
  tr: FieldPoint;
  bl: FieldPoint;
  br: FieldPoint;
};

export type FieldRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HomographyMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type FieldHomography = {
  sourceRect: FieldRect;
  destQuad: FieldQuad;
  sourceToScreen: HomographyMatrix;
  screenToSource: HomographyMatrix;
};

export const FIELD_COLUMN_COUNT = 3;
export const FIELD_ROW_COUNT = 4;

export const UNIT_FIELD_RECT = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
} as const satisfies FieldRect;

export const PERSPECTIVE_FIELD_QUAD = {
  tl: { x: 360, y: 145 },
  tr: { x: 920, y: 145 },
  bl: { x: 230, y: 610 },
  br: { x: 1050, y: 610 },
} as const satisfies FieldQuad;

export const PERSPECTIVE_SLOT_ROWS = [
  ['enemy:BR', 'enemy:BC', 'enemy:BL'],
  ['enemy:FR', 'enemy:FC', 'enemy:FL'],
  ['player:FR', 'player:FC', 'player:FL'],
  ['player:BR', 'player:BC', 'player:BL'],
] as const satisfies readonly (readonly BattleSlotId[])[];

/**
 * 직사각형 source 좌표계와 화면 사다리꼴 좌표계 사이의 homography 행렬을 만든다.
 * 렌더링 warp와 입력 역변환이 같은 수학 모델을 공유하도록 순수 함수로 유지한다.
 */
export function createFieldHomography(sourceRect: FieldRect, destQuad: FieldQuad): FieldHomography {
  const sourceCorners = getRectCorners(sourceRect);
  const destCorners = [destQuad.tl, destQuad.tr, destQuad.br, destQuad.bl];
  const sourceToScreen = createHomographyMatrix(sourceCorners, destCorners);
  const screenToSource = invertHomographyMatrix(sourceToScreen);

  return {
    sourceRect,
    destQuad,
    sourceToScreen,
    screenToSource,
  };
}

/**
 * source field local 좌표를 화면 좌표로 변환한다.
 * 변환 행렬이 퇴화한 경우는 field 설정 오류로 간주해 예외를 던진다.
 */
export function fieldLocalToScreen(point: FieldPoint, homography: FieldHomography): FieldPoint {
  const transformed = transformPoint(point, homography.sourceToScreen);
  if (!transformed) {
    throw new Error('Invalid field homography: source point cannot be projected');
  }

  return transformed;
}

/**
 * 화면 좌표를 source field local 좌표로 되돌린다.
 * 변환 결과가 source rect 밖이면 전장 입력이 아니므로 null을 반환한다.
 */
export function screenToFieldLocal(
  point: FieldPoint,
  homography: FieldHomography,
): FieldPoint | null {
  const transformed = transformPoint(point, homography.screenToSource);
  if (!transformed || !pointInRect(transformed, homography.sourceRect)) {
    return null;
  }

  return clampPointToRect(transformed, homography.sourceRect);
}

/**
 * source field local 좌표를 전장 슬롯 id로 변환한다.
 * 슬롯 순서는 `PERSPECTIVE_SLOT_ROWS`를 기준으로 하며, rect 밖 좌표는 null이다.
 */
export function fieldLocalToSlotId(
  point: FieldPoint,
  sourceRect: FieldRect = UNIT_FIELD_RECT,
): BattleSlotId | null {
  if (!pointInRect(point, sourceRect)) {
    return null;
  }

  const localX = clamp(point.x - sourceRect.x, 0, sourceRect.width);
  const localY = clamp(point.y - sourceRect.y, 0, sourceRect.height);
  const col = Math.min(
    FIELD_COLUMN_COUNT - 1,
    Math.floor((localX / sourceRect.width) * FIELD_COLUMN_COUNT),
  );
  const row = Math.min(
    FIELD_ROW_COUNT - 1,
    Math.floor((localY / sourceRect.height) * FIELD_ROW_COUNT),
  );

  return PERSPECTIVE_SLOT_ROWS[row]?.[col] ?? null;
}

/**
 * quad의 axis-aligned bounding box를 반환한다.
 * Shader GameObject와 입력 zone의 화면상 사각형 크기를 같은 값으로 맞출 때 사용한다.
 */
export function fieldQuadBounds(fieldQuad: FieldQuad): FieldRect {
  const xs = [fieldQuad.tl.x, fieldQuad.tr.x, fieldQuad.bl.x, fieldQuad.br.x];
  const ys = [fieldQuad.tl.y, fieldQuad.tr.y, fieldQuad.bl.y, fieldQuad.br.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getRectCorners(rect: FieldRect): FieldPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function createHomographyMatrix(
  sourcePoints: readonly FieldPoint[],
  destPoints: readonly FieldPoint[],
): HomographyMatrix {
  if (sourcePoints.length !== 4 || destPoints.length !== 4) {
    throw new Error('Homography requires exactly four source and destination points');
  }

  const matrix: number[][] = [];
  const values: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const source = sourcePoints[index];
    const dest = destPoints[index];
    if (!source || !dest) {
      throw new Error('Homography point pair is missing');
    }

    matrix.push([source.x, source.y, 1, 0, 0, 0, -source.x * dest.x, -source.y * dest.x]);
    values.push(dest.x);
    matrix.push([0, 0, 0, source.x, source.y, 1, -source.x * dest.y, -source.y * dest.y]);
    values.push(dest.y);
  }

  const solution = solveLinearSystem(matrix, values);

  return [
    readNumber(solution, 0),
    readNumber(solution, 1),
    readNumber(solution, 2),
    readNumber(solution, 3),
    readNumber(solution, 4),
    readNumber(solution, 5),
    readNumber(solution, 6),
    readNumber(solution, 7),
    1,
  ];
}

function invertHomographyMatrix(matrix: HomographyMatrix): HomographyMatrix {
  const determinant =
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);

  if (Math.abs(determinant) < 0.0000001) {
    throw new Error('Field homography matrix is not invertible');
  }

  const inverseDeterminant = 1 / determinant;

  return [
    (matrix[4] * matrix[8] - matrix[5] * matrix[7]) * inverseDeterminant,
    (matrix[2] * matrix[7] - matrix[1] * matrix[8]) * inverseDeterminant,
    (matrix[1] * matrix[5] - matrix[2] * matrix[4]) * inverseDeterminant,
    (matrix[5] * matrix[6] - matrix[3] * matrix[8]) * inverseDeterminant,
    (matrix[0] * matrix[8] - matrix[2] * matrix[6]) * inverseDeterminant,
    (matrix[2] * matrix[3] - matrix[0] * matrix[5]) * inverseDeterminant,
    (matrix[3] * matrix[7] - matrix[4] * matrix[6]) * inverseDeterminant,
    (matrix[1] * matrix[6] - matrix[0] * matrix[7]) * inverseDeterminant,
    (matrix[0] * matrix[4] - matrix[1] * matrix[3]) * inverseDeterminant,
  ];
}

function transformPoint(point: FieldPoint, matrix: HomographyMatrix): FieldPoint | null {
  const w = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  if (Math.abs(w) < 0.0000001) {
    return null;
  }

  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / w,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / w,
  };
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, readNumber(values, index)]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let bestRowIndex = pivotIndex;
    let bestValue = Math.abs(readNumber(readRow(augmented, pivotIndex), pivotIndex));

    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      const candidateValue = Math.abs(readNumber(readRow(augmented, rowIndex), pivotIndex));
      if (candidateValue > bestValue) {
        bestRowIndex = rowIndex;
        bestValue = candidateValue;
      }
    }

    if (bestValue < 0.0000001) {
      throw new Error('Homography linear system is singular');
    }

    if (bestRowIndex !== pivotIndex) {
      const currentRow = readRow(augmented, pivotIndex);
      augmented[pivotIndex] = readRow(augmented, bestRowIndex);
      augmented[bestRowIndex] = currentRow;
    }

    const pivotRow = readRow(augmented, pivotIndex);
    const pivotValue = readNumber(pivotRow, pivotIndex);

    for (let colIndex = pivotIndex; colIndex <= size; colIndex += 1) {
      pivotRow[colIndex] = readNumber(pivotRow, colIndex) / pivotValue;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue;
      }

      const row = readRow(augmented, rowIndex);
      const factor = readNumber(row, pivotIndex);

      for (let colIndex = pivotIndex; colIndex <= size; colIndex += 1) {
        row[colIndex] = readNumber(row, colIndex) - factor * readNumber(pivotRow, colIndex);
      }
    }
  }

  return augmented.map((row) => readNumber(row, size));
}

function pointInRect(point: FieldPoint, rect: FieldRect): boolean {
  const tolerance = 0.0001;

  return (
    point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.width + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.height + tolerance
  );
}

function clampPointToRect(point: FieldPoint, rect: FieldRect): FieldPoint {
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readRow(rows: number[][], index: number): number[] {
  const row = rows[index];
  if (!row) {
    throw new Error(`Missing matrix row ${index}`);
  }

  return row;
}

function readNumber(values: readonly number[], index: number): number {
  const value = values[index];
  if (typeof value !== 'number') {
    throw new Error(`Missing numeric value at ${index}`);
  }

  return value;
}
