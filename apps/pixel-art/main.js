// 픽셀 아트 에디터 진입점: 화면 그리기, 입력, 도구·팔레트, 자동 저장, 다운로드를 맡는다.
import { SIZE, createEditor, isValidCell, lineCells } from './editor.js';
import { createPngBlob, formatFileName } from './export.js';

const DRAFT_KEY = 'pixel-art:draft';
const DRAFT_VERSION = 1;
const SAVE_DELAY_MS = 300;
const URL_REVOKE_MS = 1000;
const DEFAULT_COLOR = '#000000';
const CUSTOM_NAME = '사용자 지정';

// 팔레트 (PICO-8 기반, 테마와 무관한 고정 값)
const PALETTE = [
  { name: '검정', value: '#000000' },
  { name: '남색', value: '#1d2b53' },
  { name: '자주', value: '#7e2553' },
  { name: '초록', value: '#008751' },
  { name: '갈색', value: '#ab5236' },
  { name: '짙은 회색', value: '#5f574f' },
  { name: '회색', value: '#c2c3c7' },
  { name: '흰색', value: '#ffffff' },
  { name: '빨강', value: '#ff004d' },
  { name: '주황', value: '#ffa300' },
  { name: '노랑', value: '#ffec27' },
  { name: '연두', value: '#00e436' },
  { name: '하늘', value: '#29adff' },
  { name: '보라', value: '#83769c' },
  { name: '분홍', value: '#ff77a8' },
  { name: '살구', value: '#ffccaa' }
];

// 캔버스 바탕(체크무늬)과 격자선: 테마와 무관한 고정 상수
const CHECK_COLORS = ['#cfd3d8', '#e4e7eb'];
const GRID_COLOR = 'rgba(128, 128, 128, 0.45)';

// ?preview 모드의 고정된 예시 그림 (하트, 별, 반짝임)
const PREVIEW_LEGEND = {
  r: '#ff004d',
  p: '#ff77a8',
  y: '#ffec27',
  b: '#29adff'
};
const PREVIEW_ROWS = [
  '................',
  '.rr...rr........',
  'rrrr.rrrr...b...',
  'rpprrrrrr..bbb..',
  'rpprrrrrr...b...',
  'rrrrrrrrr.......',
  '.rrrrrrr....y...',
  '..rrrrr.....y...',
  '...rrr...yyyyyyy',
  '....r.....yyyyy.',
  '...........yyy..',
  '..........yy.yy.',
  '..........y...y.',
  '................',
  '................',
  '................'
];

const isPreview = new URLSearchParams(window.location.search).has('preview');

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const toolButtons = {
  pencil: document.getElementById('pencil-button'),
  eraser: document.getElementById('eraser-button'),
  eyedropper: document.getElementById('eyedropper-button')
};
const gridButton = document.getElementById('grid-button');
const paletteEl = document.getElementById('palette');
const customColorInput = document.getElementById('custom-color');
const selectedColorEl = document.getElementById('selected-color');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const clearButton = document.getElementById('clear-button');
const saveButton = document.getElementById('save-button');
const statusEl = document.getElementById('status');
const saveImage = document.getElementById('save-image');

const editor = createEditor();
const swatchButtons = [];

let tool = 'pencil';
let selectedColor = DEFAULT_COLOR;
let showGrid = true;
let activePointerId = null;
let lastCell = null;
let renderQueued = false;
let saveTimer = null;
let previewImageUrl = null;
let previewCells = null;

// ---------- 화면 그리기 ----------

function drawBoard(cells) {
  const size = canvas.width;
  const cellSize = size / SIZE;
  context.clearRect(0, 0, size, size);

  // 체크무늬 바탕 → 칸 색 → 격자선 순서
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const color = cells[y * SIZE + x];
      context.fillStyle = color === null ? CHECK_COLORS[(x + y) % 2] : color;
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  if (showGrid) {
    context.fillStyle = GRID_COLOR;
    for (let i = 1; i < SIZE; i += 1) {
      context.fillRect(i * cellSize, 0, 1, size);
      context.fillRect(0, i * cellSize, size, 1);
    }
  }
}

function render() {
  renderQueued = false;
  drawBoard(isPreview ? previewCells : editor.getCells());
}

// 그리기는 한 프레임에 한 번만 한다.
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(render);
}

// 내부 해상도를 16의 배수로 맞춰 칸 경계가 장치 픽셀에 정확히 놓이게 한다.
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const size = Math.max(SIZE, Math.floor((rect.width * ratio) / SIZE) * SIZE);
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  requestRender();
}

// ---------- 상태 문구 ----------

function setStatus(text) {
  statusEl.textContent = text;
}

// ---------- 도구와 색 ----------

function setTool(next) {
  tool = next;
  Object.keys(toolButtons).forEach((name) => {
    toolButtons[name].setAttribute('aria-pressed', String(name === next));
  });
}

function refreshColorUi() {
  const known = PALETTE.find((item) => item.value === selectedColor);
  swatchButtons.forEach((button, index) => {
    button.setAttribute('aria-pressed', String(PALETTE[index].value === selectedColor));
  });
  customColorInput.classList.toggle('is-selected', !known);
  if (!known) customColorInput.value = selectedColor;
  selectedColorEl.textContent = `선택: ${known ? known.name : CUSTOM_NAME} ${selectedColor}`;
}

// 색을 고르면 연필로 돌아간다.
function selectColor(color) {
  selectedColor = color;
  setTool('pencil');
  refreshColorUi();
  scheduleSave();
}

function buildPalette() {
  PALETTE.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.style.backgroundColor = item.value;
    button.title = item.name;
    button.setAttribute('aria-label', `${item.name} ${item.value}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectColor(item.value));
    paletteEl.insertBefore(button, customColorInput);
    swatchButtons.push(button);
  });
}

function updateButtons() {
  undoButton.disabled = !editor.canUndo();
  redoButton.disabled = !editor.canRedo();
}

// ---------- 자동 저장 ----------

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!editor.load(data)) return;
    if (typeof data.color === 'string' && data.color !== '' && isValidCell(data.color)) {
      selectedColor = data.color;
    }
  } catch (error) {
    // 잘못된 값이거나 저장소를 쓸 수 없으면 빈 그림으로 시작한다.
  }
}

function writeDraft() {
  saveTimer = null;
  try {
    const data = editor.serialize();
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: DRAFT_VERSION, cells: data.cells, color: selectedColor })
    );
  } catch (error) {
    // 저장소를 쓸 수 없어도 그리기는 계속된다.
  }
}

function scheduleSave() {
  if (isPreview) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(writeDraft, SAVE_DELAY_MS);
}

// 탭을 닫거나 숨길 때 대기 중인 저장을 바로 실행한다.
function flushSave() {
  if (saveTimer === null) return;
  window.clearTimeout(saveTimer);
  writeDraft();
}

// ---------- 그리기 입력 ----------

// 가상 좌표(격자 밖 포함)로 계산한다. CSS 표시 크기를 기준으로 하므로 DPR·확대와 무관하다.
function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.floor(((event.clientX - rect.left) / rect.width) * SIZE),
    Math.floor(((event.clientY - rect.top) / rect.height) * SIZE)
  ];
}

function isInside(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function paintCell(x, y) {
  if (!isInside(x, y)) return false;
  return editor.setCell(y * SIZE + x, tool === 'eraser' ? null : selectedColor);
}

// 직전 칸에서 현재 칸까지 직선으로 칠하고 격자 안의 칸만 반영한다.
function paintTo(x, y) {
  const from = lastCell || [x, y];
  let changed = false;
  lineCells(from[0], from[1], x, y).forEach(([cx, cy]) => {
    if (paintCell(cx, cy)) changed = true;
  });
  lastCell = [x, y];
  if (changed) requestRender();
}

function pickColor(x, y) {
  if (!isInside(x, y)) return;
  const value = editor.getCells()[y * SIZE + x];
  if (value === null) {
    setTool('eraser');
    setStatus('빈 칸이라 지우개로 바꿨습니다');
  } else {
    selectColor(value);
    setStatus(`색을 집었습니다: ${value}`);
  }
}

function finishStroke(event) {
  if (activePointerId === null || event.pointerId !== activePointerId) return;
  activePointerId = null;
  lastCell = null;
  if (editor.endStroke()) scheduleSave();
  updateButtons();
}

function handlePointerDown(event) {
  if (activePointerId !== null) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const [x, y] = cellFromEvent(event);
  if (tool === 'eyedropper') {
    pickColor(x, y);
    return;
  }

  activePointerId = event.pointerId;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // 캡처에 실패해도 캔버스 위에서는 계속 그려진다.
  }
  editor.beginStroke();
  lastCell = [x, y];
  if (paintCell(x, y)) requestRender();
}

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  (samples.length > 0 ? samples : [event]).forEach((sample) => {
    const [x, y] = cellFromEvent(sample);
    paintTo(x, y);
  });
}

// ---------- 되돌리기 / 다시 실행 / 지우기 ----------

function afterHistoryChange(message) {
  requestRender();
  updateButtons();
  scheduleSave();
  setStatus(message);
}

function handleUndo() {
  if (activePointerId !== null) return;
  if (editor.undo()) afterHistoryChange('되돌렸습니다');
}

function handleRedo() {
  if (activePointerId !== null) return;
  if (editor.redo()) afterHistoryChange('다시 실행했습니다');
}

function handleClear() {
  if (activePointerId !== null) return;
  if (editor.clear() === 0) {
    setStatus('이미 비어 있습니다');
    return;
  }
  afterHistoryChange('모두 지웠습니다. 되돌리기로 복구할 수 있습니다');
}

// ---------- PNG 저장 ----------

async function savePng() {
  if (editor.isEmpty()) {
    setStatus('그린 내용이 없습니다');
    return;
  }

  const blob = await createPngBlob(editor.getCells(), SIZE);
  if (!blob) {
    setStatus('PNG를 만들지 못했습니다. 다시 시도해 주세요');
    return;
  }

  // 다운로드용 주소는 잠시 뒤 해제한다.
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = formatFileName(new Date());
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), URL_REVOKE_MS);

  // 대체 안내용 이미지 주소는 다음 저장 때까지 유지한다.
  if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
  previewImageUrl = URL.createObjectURL(blob);
  saveImage.src = previewImageUrl;
  saveImage.hidden = false;

  setStatus('저장했습니다 (512×512 PNG)');
}

// ---------- 시작 ----------

function startEditor() {
  buildPalette();
  loadDraft();
  refreshColorUi();
  updateButtons();

  toolButtons.pencil.addEventListener('click', () => setTool('pencil'));
  toolButtons.eraser.addEventListener('click', () => setTool('eraser'));
  toolButtons.eyedropper.addEventListener('click', () => setTool('eyedropper'));
  gridButton.addEventListener('click', () => {
    showGrid = !showGrid;
    gridButton.setAttribute('aria-pressed', String(showGrid));
    requestRender();
  });

  customColorInput.addEventListener('input', () => {
    const color = customColorInput.value.toLowerCase();
    if (isValidCell(color) && color !== '') selectColor(color);
  });

  undoButton.addEventListener('click', handleUndo);
  redoButton.addEventListener('click', handleRedo);
  clearButton.addEventListener('click', handleClear);
  saveButton.addEventListener('click', savePng);

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
  canvas.addEventListener('lostpointercapture', finishStroke);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      handleRedo();
    }
  });

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

// 미리보기는 입력도 저장소도 쓰지 않고 예시 그림만 그린다.
function startPreview() {
  previewCells = PREVIEW_ROWS.flatMap((row) =>
    Array.from(row, (char) => PREVIEW_LEGEND[char] || null)
  );
}

if (isPreview) {
  startPreview();
} else {
  startEditor();
}

new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();
