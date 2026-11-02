// 2048 진입점: 렌더링, 입력, 점수 저장, 오버레이를 맡는다.
import { SIZE, createGame } from './game.js';

const BEST_KEY = '2048:best';
const SLIDE_MS = 110;
const POP_MS = 130;
const GAIN_VISIBLE_MS = 450;

// ?preview 모드에서 보여 줄 고정된 예시 배치
const PREVIEW_BOARD = [
  [2, 4, 8, 16],
  [32, 64, 128, 256],
  [0, 4, 512, 1024],
  [2, 0, 0, 2048]
];

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right'
};

const isPreview = new URLSearchParams(window.location.search).has('preview');

const boardEl = document.getElementById('board');
const cellLayer = document.getElementById('cell-layer');
const tileLayer = document.getElementById('tile-layer');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const gainEl = document.getElementById('score-gain');
const newGameButton = document.getElementById('new-game-button');
const undoButton = document.getElementById('undo-button');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const continueButton = document.getElementById('continue-button');
const overlayNewButton = document.getElementById('overlay-new-button');

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const cellEls = [];

let best = 0;
let overlayMode = null;
let gainTimer = null;

// 최고 점수는 접근 실패 시 메모리 값만 쓴다.
function loadBest() {
  try {
    const value = Math.floor(Number(localStorage.getItem(BEST_KEY)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    // 저장소를 쓸 수 없어도 게임은 계속된다.
  }
}

function buildCells() {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.setProperty('--row', String(row));
      cell.style.setProperty('--col', String(col));
      cellLayer.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

function createTile(value, row, col) {
  const tile = document.createElement('div');
  const digits = String(value).length;
  let className = `tile tile-${value > 2048 ? 'super' : value}`;
  if (digits >= 3) {
    className += ` tile-digits-${Math.min(digits, 5)}`;
  }
  tile.className = className;
  tile.style.setProperty('--row', String(row));
  tile.style.setProperty('--col', String(col));
  tile.textContent = String(value);
  return tile;
}

// 스크린 리더용 보드 상태 설명
function describeBoard(board, score) {
  const rows = board.map((line, index) => {
    const cells = line.map((value) => (value === 0 ? '빈 칸' : String(value)));
    return `${index + 1}행 ${cells.join(', ')}`;
  });
  return `2048 보드, 점수 ${score}. ${rows.join('. ')}`;
}

// 칸 사이 거리(px). 화면 크기에 따라 달라지므로 실제 위치에서 구한다.
function cellStep() {
  const first = cellEls[0].getBoundingClientRect();
  const second = cellEls[1].getBoundingClientRect();
  return second.left - first.left;
}

function renderBoard(board, score, result) {
  tileLayer.replaceChildren();
  tileLayer.setAttribute('aria-label', describeBoard(board, score));

  const animate = Boolean(result) && !motionQuery.matches && typeof Element.prototype.animate === 'function';
  const step = animate ? cellStep() : 0;
  const tracks = new Map();
  if (result) {
    result.tiles.forEach((track) => tracks.set(`${track.row},${track.col}`, track));
  }

  board.forEach((line, row) => {
    line.forEach((value, col) => {
      if (value === 0) return;
      const tile = createTile(value, row, col);
      tileLayer.appendChild(tile);
      if (!animate) return;

      const isSpawned = result.spawned && result.spawned.row === row && result.spawned.col === col;
      if (isSpawned) {
        // 새 타일은 이동이 끝난 뒤 커지며 나타난다.
        tile.animate(
          [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: POP_MS, delay: SLIDE_MS, fill: 'backwards' }
        );
        return;
      }

      const track = tracks.get(`${row},${col}`);
      if (!track || track.from.length === 0) return;

      const [fromRow, fromCol] = track.from[0];
      const dx = (fromCol - col) * step;
      const dy = (fromRow - row) * step;
      if (dx !== 0 || dy !== 0) {
        tile.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: SLIDE_MS, easing: 'ease-out' }
        );
      }
      if (track.merged) {
        tile.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
          { duration: POP_MS, delay: SLIDE_MS }
        );
      }
    });
  });
}

function showGain(gained) {
  window.clearTimeout(gainTimer);
  gainEl.classList.remove('show');
  if (gained <= 0) {
    gainEl.textContent = '';
    return;
  }
  gainEl.textContent = `+${gained}`;
  // 같은 요소에서 효과를 다시 시작하려면 스타일을 강제로 계산시킨다.
  void gainEl.offsetWidth;
  gainEl.classList.add('show');
  gainTimer = window.setTimeout(() => gainEl.classList.remove('show'), GAIN_VISIBLE_MS);
}

function showOverlay(mode) {
  overlayMode = mode;
  const isWin = mode === 'win';
  overlayTitle.textContent = isWin ? '2048 달성!' : '게임 오버';
  continueButton.hidden = !isWin;
  overlayNewButton.textContent = isWin ? '새 게임' : '다시 하기';
  overlayEl.hidden = false;
  (isWin ? continueButton : overlayNewButton).focus();
}

function hideOverlay() {
  overlayMode = null;
  overlayEl.hidden = true;
}

function startApp() {
  const game = createGame();
  best = loadBest();

  function updateScores() {
    scoreEl.textContent = String(game.getState().score);
    bestEl.textContent = String(best);
    undoButton.disabled = !game.canUndo();
  }

  function render(result) {
    const { board, score } = game.getState();
    renderBoard(board, score, result);
    updateScores();
  }

  function handleMove(direction) {
    if (overlayMode) return;
    const result = game.move(direction);
    if (!result.moved) return;

    const { score } = game.getState();
    if (score > best) {
      best = score;
      saveBest(best);
    }
    render(result);
    showGain(result.gained);

    if (result.over) {
      showOverlay('over');
    } else if (result.reachedWin) {
      showOverlay('win');
    }
  }

  function startNewGame() {
    game.newGame();
    hideOverlay();
    showGain(0);
    render();
  }

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const direction = KEY_MAP[event.code];
    if (!direction) return;
    event.preventDefault();
    handleMove(direction);
  });

  // 스와이프: 이동 거리가 임계값보다 작으면 탭으로 보고 무시한다.
  let start = null;
  boardEl.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  boardEl.addEventListener('pointerup', (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    const threshold = Math.max(30, boardEl.clientWidth * 0.1);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? 'right' : 'left');
    } else {
      handleMove(dy > 0 ? 'down' : 'up');
    }
  });
  boardEl.addEventListener('pointercancel', () => {
    start = null;
  });
  boardEl.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

  newGameButton.addEventListener('click', startNewGame);
  overlayNewButton.addEventListener('click', startNewGame);
  continueButton.addEventListener('click', () => {
    game.continuePlaying();
    hideOverlay();
  });
  undoButton.addEventListener('click', () => {
    if (!game.undo()) return;
    hideOverlay();
    showGain(0);
    render();
  });

  render();
}

function startPreview() {
  // 미리보기는 입력도 저장소도 쓰지 않고 예시 배치만 그린다.
  renderBoard(PREVIEW_BOARD, 0, null);
}

buildCells();
if (isPreview) {
  startPreview();
} else {
  startApp();
}
