import {
  InputError,
  formatFixed,
  formatPercent,
  parsePositiveDecimal,
} from './core/rational.js';
import {
  DEFAULTS,
  LIMITS,
  evaluate,
  qualificationThreshold,
  runSearch,
} from './core/tuner.js';
import {
  displayPlaces,
  serializeDirection,
  serializeEvaluation,
} from './core/display.js';

function checkInteger(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} 必須是 ${min}–${max.toLocaleString('en-US')} 的整數。`);
  }
  return value;
}

function friendlyError(error) {
  if (error instanceof InputError) {
    const label = error.label === 'initial' ? 'initial' : 'ratio';
    if (error.code === 'zero') return `${label} 必須大於 0。`;
    return `${label} 必須是一般十進位正數（例如 0.165），不可使用正負號、科學記號、NaN 或 Infinity。`;
  }
  return error instanceof Error ? error.message : '搜尋時發生未知錯誤。';
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.type !== 'search') return;

  const jobId = message.jobId;
  try {
    const initialParsed = parsePositiveDecimal(message.initialText, 'initial');
    const ratioParsed = parsePositiveDecimal(message.ratioText, 'ratio');
    const operation = message.operation;
    if (operation !== 1 && operation !== 2) {
      throw new RangeError('運算方式必須是乘法或除法。');
    }

    const d = initialParsed.places;
    const targetDecimals =
      message.targetDecimals === null || message.targetDecimals === undefined
        ? d
        : checkInteger(message.targetDecimals, 'target 小數位數', 0, LIMITS.targetDecimals);
    const maxSteps = checkInteger(
      message.maxSteps ?? DEFAULTS.maxSteps,
      '每方向最大步數',
      1,
      LIMITS.maxSteps,
    );
    const resultLimit = checkInteger(
      message.resultLimit ?? DEFAULTS.resultLimit,
      '每方向結果筆數',
      1,
      LIMITS.resultLimit,
    );

    const search = runSearch({
      initial: initialParsed.value,
      ratio: ratioParsed.value,
      operation,
      d,
      targetDecimals,
      maxSteps,
      limit: resultLimit,
      onProgress: (progress) => {
        self.postMessage({
          type: 'progress',
          jobId,
          downChecked: progress.downChecked,
          upChecked: progress.upChecked,
          phase: progress.phase,
        });
      },
    });

    const p = search.p;
    const highPlaces = displayPlaces(d);
    const threshold = qualificationThreshold(p);
    const payload = {
      settings: {
        initialText: initialParsed.text,
        ratioText: ratioParsed.text,
        operation,
        d,
        p,
        step: formatFixed(search.step, d),
        targetDecimals,
        targetMode: message.targetDecimals === null || message.targetDecimals === undefined ? 'auto' : 'custom',
        maxSteps,
        resultLimit,
        threshold: formatPercent(threshold, highPlaces),
        displayPlaces: highPlaces,
      },
      initial: serializeEvaluation(
        evaluate(initialParsed.value, ratioParsed.value, operation, d, targetDecimals),
        null,
        d,
        p,
        targetDecimals,
      ),
      down: serializeDirection(search.down, initialParsed.value, d, p, targetDecimals),
      up: serializeDirection(search.up, initialParsed.value, d, p, targetDecimals),
    };

    self.postMessage({ type: 'result', jobId, payload });
  } catch (error) {
    self.postMessage({ type: 'error', jobId, message: friendlyError(error) });
  }
});
