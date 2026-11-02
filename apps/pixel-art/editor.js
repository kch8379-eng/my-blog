// 픽셀 아트 편집기 순수 로직: DOM에 접근하지 않고 아무것도 가져오지 않는다.

export const SIZE = 16;
export const CELL_COUNT = SIZE * SIZE;

const HISTORY_LIMIT = 100;
const DRAFT_VERSION = 1;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;

// 칸 값이 올바른지 검사한다: null(투명) 또는 소문자 '#rrggbb'
export function isValidCell(value) {
  return value === null || (typeof value === 'string' && COLOR_PATTERN.test(value));
}

// 두 점 사이의 Bresenham 직선 칸 목록(시작·끝 포함). 좌표는 정수이며 범위 제한이 없다.
export function lineCells(x0, y0, x1, y1) {
  if (![x0, y0, x1, y1].every(Number.isInteger)) return [];

  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;

  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
  return cells;
}

// 편집기 상태를 만든다. 칸은 길이 256의 일차원 배열이고 인덱스는 y * SIZE + x 이다.
export function createEditor() {
  let cells = new Array(CELL_COUNT).fill(null);
  let undoStack = [];
  let redoStack = [];
  let stroke = null; // 진행 중인 획: 칸 인덱스 -> { index, before, after }

  function getCells() {
    return cells.slice();
  }

  // 칸 하나를 칠한다. 실제로 바뀌었을 때만 true를 돌려준다.
  function setCell(index, color) {
    if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return false;
    if (!isValidCell(color)) return false;
    const before = cells[index];
    if (before === color) return false;

    cells[index] = color;
    if (stroke) {
      const entry = stroke.get(index);
      if (entry) {
        entry.after = color;
      } else {
        stroke.set(index, { index, before, after: color });
      }
    }
    return true;
  }

  function beginStroke() {
    if (stroke) endStroke();
    stroke = new Map();
  }

  // 획을 끝낸다. 실제로 바뀐 칸이 있어 기록을 남겼을 때만 true.
  function endStroke() {
    if (!stroke) return false;
    const changes = Array.from(stroke.values()).filter((entry) => entry.before !== entry.after);
    stroke = null;
    if (changes.length === 0) return false;

    undoStack.push(changes);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    return true;
  }

  function undo() {
    if (stroke || undoStack.length === 0) return false;
    const changes = undoStack.pop();
    changes.forEach((entry) => {
      cells[entry.index] = entry.before;
    });
    redoStack.push(changes);
    return true;
  }

  function redo() {
    if (stroke || redoStack.length === 0) return false;
    const changes = redoStack.pop();
    changes.forEach((entry) => {
      cells[entry.index] = entry.after;
    });
    undoStack.push(changes);
    return true;
  }

  // 모두 지우기도 하나의 획으로 기록한다. 바뀐 칸 수를 돌려준다.
  function clear() {
    const ownsStroke = !stroke;
    if (ownsStroke) beginStroke();
    let count = 0;
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (cells[index] !== null && setCell(index, null)) count += 1;
    }
    if (ownsStroke) endStroke();
    return count;
  }

  function canUndo() {
    return !stroke && undoStack.length > 0;
  }

  function canRedo() {
    return !stroke && redoStack.length > 0;
  }

  function isEmpty() {
    return cells.every((value) => value === null);
  }

  function serialize() {
    return { v: DRAFT_VERSION, cells: cells.slice() };
  }

  // 저장된 값을 불러온다. 형식이 잘못되면 아무것도 바꾸지 않고 false.
  function load(data) {
    if (!data || typeof data !== 'object' || data.v !== DRAFT_VERSION) return false;
    if (!Array.isArray(data.cells) || data.cells.length !== CELL_COUNT) return false;
    if (!data.cells.every(isValidCell)) return false;

    cells = data.cells.slice();
    undoStack = [];
    redoStack = [];
    stroke = null;
    return true;
  }

  return {
    getCells,
    setCell,
    beginStroke,
    endStroke,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    isEmpty,
    serialize,
    load
  };
}
