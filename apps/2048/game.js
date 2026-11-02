// 2048 순수 게임 로직. DOM에 접근하지 않는다.

export const SIZE = 4;
export const WIN_VALUE = 2048;

const DIRECTIONS = ['left', 'right', 'up', 'down'];

// 빈 4×4 보드를 만든다. 빈 칸은 0이다.
export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// 한 줄(앞쪽이 이동 방향)을 밀고 합친다.
// sources[i]는 결과 i번 칸을 만든 원래 칸 번호들이다(애니메이션용).
export function slideLine(line) {
  const tiles = [];
  line.forEach((value, index) => {
    if (value !== 0) {
      tiles.push({ value, from: index });
    }
  });

  const result = [];
  const merged = [];
  const sources = [];
  let gained = 0;

  for (let i = 0; i < tiles.length; i += 1) {
    const current = tiles[i];
    const next = tiles[i + 1];
    if (next && next.value === current.value) {
      // 합쳐진 타일은 같은 이동에서 다시 합쳐지지 않는다.
      const value = current.value * 2;
      result.push(value);
      merged.push(true);
      sources.push([current.from, next.from]);
      gained += value;
      i += 1;
    } else {
      result.push(current.value);
      merged.push(false);
      sources.push([current.from]);
    }
  }

  while (result.length < SIZE) {
    result.push(0);
    merged.push(false);
    sources.push([]);
  }

  const moved = result.some((value, index) => value !== line[index]);
  return { line: result, gained, moved, merged, sources };
}

// 방향별로 i번째 줄의 칸 좌표를 앞쪽부터 순서대로 돌려준다.
function lineCoords(direction, i) {
  const coords = [];
  for (let k = 0; k < SIZE; k += 1) {
    if (direction === 'left') coords.push([i, k]);
    else if (direction === 'right') coords.push([i, SIZE - 1 - k]);
    else if (direction === 'up') coords.push([k, i]);
    else coords.push([SIZE - 1 - k, i]);
  }
  return coords;
}

// 보드 전체를 한 방향으로 민다. 원본 보드는 바꾸지 않는다.
// tiles: 이동 후 각 타일의 위치, 출발 위치들, 합쳐짐 여부
export function moveBoard(board, direction) {
  if (!DIRECTIONS.includes(direction)) {
    throw new Error(`알 수 없는 방향: ${direction}`);
  }

  const next = createEmptyBoard();
  const tiles = [];
  let gained = 0;
  let moved = false;

  for (let i = 0; i < SIZE; i += 1) {
    const coords = lineCoords(direction, i);
    const line = coords.map(([r, c]) => board[r][c]);
    const result = slideLine(line);
    gained += result.gained;
    if (result.moved) moved = true;

    result.line.forEach((value, k) => {
      const [row, col] = coords[k];
      next[row][col] = value;
      if (value !== 0) {
        tiles.push({
          row,
          col,
          value,
          merged: result.merged[k],
          from: result.sources[k].map((index) => coords[index])
        });
      }
    });
  }

  return { board: next, gained, moved, tiles };
}

// 보드가 가득 차 있고 인접한 같은 값 쌍이 없으면 게임 오버다.
export function isGameOver(board) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] === 0) return false;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return false;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return false;
    }
  }
  return true;
}

export function hasValue(board, value) {
  return board.some((row) => row.includes(value));
}

// 빈 칸 하나에 새 타일(2는 90%, 4는 10%)을 넣는다. 전달한 보드를 직접 바꾼다.
export function addRandomTile(board, rng = Math.random) {
  const empties = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return null;

  const [row, col] = empties[Math.floor(rng() * empties.length)];
  const value = rng() < 0.9 ? 2 : 4;
  board[row][col] = value;
  return { row, col, value };
}

function cloneState(state) {
  return { ...state, board: cloneBoard(state.board) };
}

// 게임 한 판을 관리하는 객체. rng를 주입하면 결과를 재현할 수 있다.
export function createGame(rng = Math.random) {
  let state = null;
  let snapshot = null;

  function newGame() {
    const board = createEmptyBoard();
    addRandomTile(board, rng);
    addRandomTile(board, rng);
    state = { board, score: 0, won: false, keepPlaying: false, over: false };
    snapshot = null;
  }

  function move(direction) {
    if (state.over) {
      return { moved: false, gained: 0, tiles: [], spawned: null, reachedWin: false, over: true };
    }

    const result = moveBoard(state.board, direction);
    if (!result.moved) {
      // 변화가 없으면 점수, 새 타일, 되돌리기 기록 모두 그대로 둔다.
      return { moved: false, gained: 0, tiles: [], spawned: null, reachedWin: false, over: false };
    }

    // 이동이 성립한 직후에만 되돌리기용 상태를 저장한다.
    snapshot = cloneState(state);

    const board = result.board;
    const spawned = addRandomTile(board, rng);
    state = { ...state, board, score: state.score + result.gained };

    let reachedWin = false;
    if (!state.won && hasValue(board, WIN_VALUE)) {
      state.won = true;
      reachedWin = true;
    }
    state.over = isGameOver(board);

    return {
      moved: true,
      gained: result.gained,
      tiles: result.tiles,
      spawned,
      reachedWin,
      over: state.over
    };
  }

  // 1단계만 되돌린다. 되돌린 뒤에는 새 이동 전까지 다시 되돌릴 수 없다.
  function undo() {
    if (!snapshot) return false;
    state = snapshot;
    snapshot = null;
    return true;
  }

  function continuePlaying() {
    state.keepPlaying = true;
  }

  function getState() {
    return cloneState(state);
  }

  function canUndo() {
    return snapshot !== null;
  }

  newGame();

  return { newGame, move, undo, continuePlaying, getState, canUndo };
}
