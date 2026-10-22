import './style.css';
import { InputError, parsePositiveDecimal } from './core/rational.js';
import { DEFAULTS, LIMITS } from './core/tuner.js';

const $ = (id) => document.getElementById(id);

const form = $('search-form');
const initialInput = $('initial');
const ratioInput = $('ratio');
const maxStepsInput = $('max-steps');
const resultLimitInput = $('result-limit');
const targetDecimalsInput = $('target-decimals');
const startButton = $('start');
const cancelButton = $('cancel');
const loadExampleButton = $('load-example');
const resetButton = $('reset');
const advanced = $('advanced');

const statusCard = $('status-card');
const statusIcon = $('status-icon');
const statusTitle = $('status-title');
const statusText = $('status-text');
const progressPanel = $('progress-panel');
const progressChecked = $('progress-checked');
const progressDetail = $('progress-detail');
const staleNotice = $('stale-notice');
const errorPanel = $('error-panel');
const errorText = $('error-text');
const emptyState = $('empty-state');
const emptyTitle = $('empty-title');
const emptyText = $('empty-text');
const results = $('results');

const summaryInitial = $('summary-initial');
const summaryRatio = $('summary-ratio');
const summaryOperation = $('summary-operation');
const summaryD = $('summary-d');
const summaryStep = $('summary-step');
const summaryP = $('summary-p');
const summaryTarget = $('summary-target');
const summaryThreshold = $('summary-threshold');
const summaryMaxSteps = $('summary-max-steps');
const summaryLimit = $('summary-limit');

const initialBadge = $('initial-badge');
const initialY = $('initial-y');
const initialTarget = $('initial-target');
const initialDiscrepancy = $('initial-discrepancy');
const initialRounded = $('initial-rounded');
const initialNote = $('initial-note');

const downTitle = $('down-title');
const downMeta = $('down-meta');
const downBody = $('down-body');
const upTitle = $('up-title');
const upMeta = $('up-meta');
const upBody = $('up-body');

const DEFAULT_EMPTY_TITLE = '還沒有搜尋結果';
const DEFAULT_EMPTY_TEXT =
  '輸入 initial 與 ratio，選擇乘法或除法後開始搜尋。預設會在 initial 的固定格點上，向上與向下各找最近 3 個合格候選。';

let worker = null;
let jobId = 0;
let running = false;
let hasResults = false;
let lastRunFingerprint = null;
let pendingFingerprint = null;
let pendingProgress = null;
let progressFrame = 0;
let lastProgress = { down: 0, up: 0 };

class FieldError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

function setStatus(state, title, text, icon) {
  statusCard.dataset.state = state;
  statusTitle.textContent = title;
  statusText.textContent = text;
  statusIcon.textContent = icon ?? '';
}

function showEmpty(title = DEFAULT_EMPTY_TITLE, text = DEFAULT_EMPTY_TEXT) {
  emptyTitle.textContent = title;
  emptyText.textContent = text;
  emptyState.hidden = false;
}

function hideEmpty() {
  emptyState.hidden = true;
}

function clearFieldError(fieldId) {
  const input = $(fieldId);
  const error = $(`${fieldId}-error`);
  if (input) input.removeAttribute('aria-invalid');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
}

function clearErrors() {
  ['initial', 'ratio', 'max-steps', 'result-limit', 'target-decimals'].forEach(
    clearFieldError,
  );
}

function setFieldError(fieldId, message) {
  const input = $(fieldId);
  const error = $(`${fieldId}-error`);
  if (input) input.setAttribute('aria-invalid', 'true');
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function inputErrorMessage(error) {
  const label = error.label === 'ratio' ? 'ratio' : 'initial';
  if (error.code === 'zero') return `${label} 必須大於 0。`;
  return `${label} 必須是一般十進位正數（例如 0.165），不可使用正負號、科學記號、NaN 或 Infinity。`;
}

function readIntegerField(fieldId, label, min, max) {
  const raw = $(fieldId).value.trim();
  if (!/^[0-9]+$/.test(raw)) {
    throw new FieldError(fieldId, `${label} 必須是 ${min}–${max.toLocaleString('zh-TW')} 的整數。`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new FieldError(fieldId, `${label} 必須是 ${min}–${max.toLocaleString('zh-TW')} 的整數。`);
  }
  return value;
}

function readTargetDecimals() {
  const raw = targetDecimalsInput.value.trim();
  if (raw === '') return null;
  if (!/^[0-9]+$/.test(raw)) {
    throw new FieldError(
      'target-decimals',
      `target 小數位數必須留空或 0–${LIMITS.targetDecimals} 的整數。`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > LIMITS.targetDecimals) {
    throw new FieldError(
      'target-decimals',
      `target 小數位數必須留空或 0–${LIMITS.targetDecimals} 的整數。`,
    );
  }
  return value;
}

function readOperation() {
  const checked = form.querySelector('input[name="operation"]:checked');
  return checked ? Number(checked.value) : 1;
}

function validateForm() {
  clearErrors();
  try {
    const initial = parsePositiveDecimal(initialInput.value, 'initial');
    const ratio = parsePositiveDecimal(ratioInput.value, 'ratio');
    const operation = readOperation();
    const maxSteps = readIntegerField(
      'max-steps',
      '每方向最大步數',
      1,
      LIMITS.maxSteps,
    );
    const resultLimit = readIntegerField(
      'result-limit',
      '每方向結果筆數',
      1,
      LIMITS.resultLimit,
    );
    const targetDecimals = readTargetDecimals();

    return {
      initialText: initial.text,
      ratioText: ratio.text,
      operation,
      maxSteps,
      resultLimit,
      targetDecimals,
    };
  } catch (error) {
    if (error instanceof InputError) {
      const field = error.label === 'ratio' ? 'ratio' : 'initial';
      setFieldError(field, inputErrorMessage(error));
      $(field).focus();
      setStatus('invalid', '輸入有誤', '請修正標示的欄位後再開始搜尋。', '!');
      return null;
    }
    if (error instanceof FieldError) {
      setFieldError(error.field, error.message);
      $(error.field).focus();
      setStatus('invalid', '輸入有誤', error.message, '!');
      return null;
    }
    throw error;
  }
}

function rawFingerprint() {
  return JSON.stringify({
    initial: initialInput.value,
    ratio: ratioInput.value,
    operation: readOperation(),
    maxSteps: maxStepsInput.value,
    resultLimit: resultLimitInput.value,
    targetDecimals: targetDecimalsInput.value,
  });
}

function updateStaleNotice() {
  if (!hasResults || running) {
    staleNotice.hidden = true;
    results.dataset.stale = 'false';
    return;
  }
  const stale = rawFingerprint() !== lastRunFingerprint;
  staleNotice.hidden = !stale;
  results.dataset.stale = stale ? 'true' : 'false';
}

function setFormDisabled(disabled) {
  form.querySelectorAll('input, button').forEach((control) => {
    if (control === cancelButton) return;
    control.disabled = disabled;
  });
  cancelButton.disabled = !disabled;
  form.setAttribute('aria-busy', disabled ? 'true' : 'false');
}

function hideAlerts() {
  errorPanel.hidden = true;
  errorText.textContent = '';
  staleNotice.hidden = true;
}

function resetProgress() {
  lastProgress = { down: 0, up: 0 };
  progressChecked.textContent = '0';
  progressDetail.textContent = '等待 Worker 回報進度…';
}

function scheduleProgress(message) {
  lastProgress = {
    down: message.downChecked ?? 0,
    up: message.upChecked ?? 0,
  };
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0;
    const total = lastProgress.down + lastProgress.up;
    progressChecked.textContent = total.toLocaleString('zh-TW');
    progressDetail.textContent = `下調 ${lastProgress.down.toLocaleString(
      'zh-TW',
    )} 步 · 上調 ${lastProgress.up.toLocaleString('zh-TW')} 步`;
  });
}

function stopWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function startSearch(config) {
  if (running) return;

  jobId += 1;
  const currentJob = jobId;
  running = true;
  pendingFingerprint = rawFingerprint();
  hasResults = false;
  lastRunFingerprint = null;
  setFormDisabled(true);
  setStatus('running', '搜尋中', 'Worker 正在逐格檢查候選；你可以隨時取消。');
  hideAlerts();
  hideEmpty();
  results.hidden = true;
  progressPanel.hidden = false;
  resetProgress();

  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    if (
      currentJob !== jobId ||
      worker !== event.currentTarget ||
      event.data?.jobId !== currentJob
    ) {
      return;
    }
    handleWorkerMessage(event.data);
  };
  worker.onerror = () => {
    if (currentJob !== jobId) return;
    failSearch('Worker 載入或執行失敗，請重新整理頁面後再試。');
  };
  worker.postMessage({
    type: 'search',
    jobId: currentJob,
    initialText: config.initialText,
    ratioText: config.ratioText,
    operation: config.operation,
    maxSteps: config.maxSteps,
    resultLimit: config.resultLimit,
    targetDecimals: config.targetDecimals,
  });
}

function handleWorkerMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'progress') {
    scheduleProgress(message);
    return;
  }
  if (message.type === 'result') {
    completeSearch(message.payload);
    return;
  }
  if (message.type === 'error') {
    failSearch(message.message || '搜尋時發生未知錯誤。');
  }
}

function completeSearch(payload) {
  stopWorker();
  running = false;
  setFormDisabled(false);
  progressPanel.hidden = true;
  if (progressFrame) {
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  }
  renderResult(payload);
  hasResults = true;
  lastRunFingerprint = pendingFingerprint;
  pendingFingerprint = null;
  hideAlerts();
  const downCount = payload.down.candidates.length;
  const upCount = payload.up.candidates.length;
  setStatus(
    'success',
    '搜尋完成',
    `下調找到 ${downCount} 筆、上調找到 ${upCount} 筆合格候選；結果只在本次有限搜尋內有效。`,
    '✓',
  );
}

function failSearch(message) {
  stopWorker();
  running = false;
  hasResults = false;
  lastRunFingerprint = null;
  pendingFingerprint = null;
  setFormDisabled(false);
  progressPanel.hidden = true;
  if (progressFrame) {
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  }
  results.hidden = true;
  hideEmpty();
  errorPanel.hidden = false;
  errorText.textContent = message;
  setStatus('error', '發生錯誤', message, '!');
}

function cancelSearch() {
  if (!running) return;
  jobId += 1;
  stopWorker();
  running = false;
  pendingFingerprint = null;
  setFormDisabled(false);
  progressPanel.hidden = true;
  if (progressFrame) {
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  }
  results.hidden = true;
  hideAlerts();
  const total = lastProgress.down + lastProgress.up;
  showEmpty(
    '搜尋已取消',
    `取消前已檢查 ${total.toLocaleString('zh-TW')} 步，未顯示未完成的部分結果。可調整參數後重新開始。`,
  );
  setStatus(
    'cancelled',
    '已取消',
    `搜尋已取消；取消前已檢查 ${total.toLocaleString('zh-TW')} 步，未顯示部分結果。`,
    '×',
  );
}

function formatCount(value) {
  return value.toLocaleString('zh-TW');
}

function targetPrecisionLabel(settings) {
  return settings.targetMode === 'auto'
    ? `${settings.targetDecimals}（自動 = d）`
    : `${settings.targetDecimals}（自訂）`;
}

function renderSummary(settings) {
  summaryInitial.textContent = settings.initialText;
  summaryRatio.textContent = settings.ratioText;
  summaryOperation.textContent = settings.operation === 1 ? '乘法' : '除法';
  summaryD.textContent = String(settings.d);
  summaryStep.textContent = settings.step;
  summaryP.textContent = String(settings.p);
  summaryTarget.textContent = targetPrecisionLabel(settings);
  summaryThreshold.textContent = `< ${settings.threshold}`;
  summaryMaxSteps.textContent = formatCount(settings.maxSteps);
  summaryLimit.textContent = formatCount(settings.resultLimit);
}

function renderBadge(element, tone, text) {
  element.className = `badge badge-${tone}`;
  element.textContent = text;
}

function renderInitial(initial, settings) {
  initialY.textContent = initial.display.y;
  initialTarget.textContent = initial.display.target;

  if (initial.display.discrepancy === null) {
    renderBadge(initialBadge, 'warn', '未判定');
    initialDiscrepancy.textContent = 'n/a（target = 0）';
    initialRounded.textContent = 'n/a';
    initialNote.textContent =
      'target = 0：依規則跳過 discrepancy，避免除以零；因此 initial 不判定合格。';
    return;
  }

  initialDiscrepancy.textContent = initial.display.discrepancy;
  initialRounded.textContent = initial.display.roundedDiscrepancy;

  if (initial.qualified) {
    renderBadge(initialBadge, 'success', '合格');
    initialNote.textContent = initial.display.exactZero
      ? '合格；精確 discrepancy 為零。'
      : '合格；合格判定使用精確有理數。畫面中的 0.00% 是顯示捨入，不代表精確誤差等於零。';
  } else {
    renderBadge(initialBadge, 'danger', '不合格');
    initialNote.textContent =
      '不合格；精確 discrepancy 未低於嚴格門檻。顯示格式不會改變判定。';
  }
}

function stopLabel(stop) {
  if (stop === 'safety') return '已達搜尋安全上限';
  if (stop === 'nonpositive') return '下調已到非正數，停止';
  return '已找到指定數量，停止該方向';
}

function emptyDirectionMessage(stop, directionName) {
  if (stop === 'safety') {
    return `已達搜尋安全上限，${directionName}方向沒有找到合格候選。這不代表其他範圍沒有解。`;
  }
  if (stop === 'nonpositive') {
    return '下調已到非正數，停止搜尋；這個方向沒有合格候選。';
  }
  return `${directionName}方向沒有合格候選。`;
}

function createCell(text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function renderCandidateTable(candidates, directionName) {
  const container = document.createElement('div');
  container.className = 'table-block';
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', `${directionName}方向候選表格，可橫向捲動`);
  const table = document.createElement('table');

  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = `${directionName}方向合格候選`;
  table.append(caption);

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    ['x', 'num'],
    ['x − initial', 'num'],
    ['actual result y', 'num'],
    ['target', 'num'],
    ['discrepancy（高精度）', 'num'],
    ['discrepancy（p 位顯示）', 'num'],
  ].forEach(([label, className]) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    if (className) th.className = className;
    headRow.append(th);
  });
  head.append(headRow);
  table.append(head);

  const body = document.createElement('tbody');
  candidates.forEach((candidate) => {
    const row = document.createElement('tr');
    row.append(
      createCell(candidate.display.x, 'num'),
      createCell(candidate.display.delta, 'num'),
      createCell(candidate.display.y, 'num'),
      createCell(candidate.display.target, 'num'),
      createCell(candidate.display.discrepancy, 'num'),
      createCell(candidate.display.roundedDiscrepancy, 'num qualified-cell'),
    );
    body.append(row);
  });
  table.append(body);
  wrap.append(table);
  const hint = document.createElement('p');
  hint.className = 'table-hint';
  hint.textContent = '表格可左右滑動查看完整欄位。';
  container.append(wrap, hint);
  return container;
}

function renderDirection(
  panelBody,
  panelTitle,
  panelMeta,
  direction,
  directionName,
  settings,
) {
  panelTitle.textContent = `${directionName}：最近的 ${settings.resultLimit} 個合格候選`;
  panelMeta.textContent = `找到 ${formatCount(
    direction.candidates.length,
  )} / ${formatCount(settings.resultLimit)} 筆 · 已檢查 ${formatCount(
    direction.checked,
  )} 步 · ${stopLabel(direction.stop)}`;
  panelBody.replaceChildren();

  if (direction.candidates.length === 0) {
    const message = document.createElement('p');
    message.className = 'direction-empty';
    message.textContent = emptyDirectionMessage(direction.stop, directionName);
    panelBody.append(message);
    return;
  }

  panelBody.append(renderCandidateTable(direction.candidates, directionName));
}

function renderResult(payload) {
  const { settings } = payload;
  renderSummary(settings);
  renderInitial(payload.initial, settings);
  renderDirection(downBody, downTitle, downMeta, payload.down, '下調', settings);
  renderDirection(upBody, upTitle, upMeta, payload.up, '上調', settings);
  results.hidden = false;
  hideEmpty();
  errorPanel.hidden = true;
}

function clearResultArea() {
  results.hidden = true;
  hasResults = false;
  lastRunFingerprint = null;
  pendingFingerprint = null;
  staleNotice.hidden = true;
  errorPanel.hidden = true;
  errorText.textContent = '';
  results.dataset.stale = 'false';
}

function resetForm({ closeAdvanced = true } = {}) {
  if (running) return;
  jobId += 1;
  stopWorker();
  initialInput.value = DEFAULTS.initialText;
  ratioInput.value = DEFAULTS.ratioText;
  form.querySelector('input[name="operation"][value="1"]').checked = true;
  maxStepsInput.value = String(DEFAULTS.maxSteps);
  resultLimitInput.value = String(DEFAULTS.resultLimit);
  targetDecimalsInput.value = '';
  clearErrors();
  clearResultArea();
  progressPanel.hidden = true;
  if (closeAdvanced) advanced.open = false;
  showEmpty();
  setStatus(
    'idle',
    '準備搜尋',
    '設定參數後按「開始搜尋」。所有計算都在你的瀏覽器內完成。',
    '•',
  );
  initialInput.focus();
}

function loadExample() {
  if (running) return;
  initialInput.value = DEFAULTS.initialText;
  ratioInput.value = DEFAULTS.ratioText;
  form.querySelector('input[name="operation"][value="1"]').checked = true;
  clearErrors();
  clearResultArea();
  progressPanel.hidden = true;
  showEmpty();
  setStatus('idle', '已載入範例', '按「開始搜尋」執行；不會自動啟動搜尋。', '•');
  updateStaleNotice();
  initialInput.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (running) return;
  const config = validateForm();
  if (!config) {
    updateStaleNotice();
    return;
  }
  startSearch(config);
});

form.addEventListener('input', (event) => {
  if (event.target.id) clearFieldError(event.target.id);
  updateStaleNotice();
});

form.addEventListener('change', (event) => {
  if (event.target.id) clearFieldError(event.target.id);
  updateStaleNotice();
});

cancelButton.addEventListener('click', cancelSearch);
loadExampleButton.addEventListener('click', loadExample);
resetButton.addEventListener('click', () => resetForm());

window.addEventListener('beforeunload', stopWorker);

// Keep the initial status icon consistent with the idle state.
statusIcon.textContent = '•';
