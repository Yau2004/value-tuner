import {
  ZERO,
  abs,
  add,
  cmp,
  div,
  make,
  mul,
  pow10,
  roundHalfUp,
  sub,
} from './rational.js';

export const DEFAULTS = Object.freeze({
  initialText: '0.165',
  ratioText: '3.1818',
  operation: 1,
  maxSteps: 1_000_000,
  resultLimit: 3,
  targetDecimals: null,
});

export const LIMITS = Object.freeze({
  maxSteps: 2_000_000,
  resultLimit: 20,
  targetDecimals: 100,
});

export const PROGRESS_EVERY = 5_000;

export function discrepancyPlaces(d) {
  return Math.max(d - 1, 0);
}

export function qualificationThreshold(p) {
  return make(1n, 2n * pow10(p));
}

export function isQualified(discrepancy, p) {
  return cmp(discrepancy, qualificationThreshold(p)) < 0;
}

export function discrepancyPercent(y, target) {
  if (target.n === 0n) throw new RangeError('target is zero');
  return mul(div(abs(sub(y, target)), abs(target)), make(100n));
}

export function evaluate(x, ratio, operation, d, targetDecimals) {
  let y;
  if (operation === 1) {
    y = mul(x, ratio);
  } else if (operation === 2) {
    y = div(x, ratio);
  } else {
    throw new RangeError('operation must be 1 (multiply) or 2 (divide)');
  }

  const target = roundHalfUp(y, targetDecimals);
  if (target.n === 0n) {
    return {
      x,
      y,
      target,
      discrepancy: null,
      roundedDiscrepancy: null,
      qualified: false,
    };
  }

  const p = discrepancyPlaces(d);
  const discrepancy = discrepancyPercent(y, target);
  return {
    x,
    y,
    target,
    discrepancy,
    roundedDiscrepancy: roundHalfUp(discrepancy, p),
    qualified: isQualified(discrepancy, p),
  };
}

function emptyDirection() {
  return { candidates: [], hitLimit: false, checked: 0, stop: 'limit' };
}

function searchDirection({
  initial,
  ratio,
  operation,
  d,
  targetDecimals,
  maxSteps,
  limit,
  sign,
  onProgress,
  downChecked,
}) {
  if (limit <= 0) return emptyDirection();

  const step = make(1n, pow10(d));
  const found = [];
  let checked = 0;

  for (let n = 1; n <= maxSteps; n += 1) {
    const x = add(initial, mul(step, make(BigInt(sign) * BigInt(n))));
    if (cmp(x, ZERO) <= 0) {
      return { candidates: found, hitLimit: false, checked, stop: 'nonpositive' };
    }

    checked += 1;
    const result = evaluate(x, ratio, operation, d, targetDecimals);
    if (result.qualified) {
      found.push(result);
      if (found.length === limit) {
        return { candidates: found, hitLimit: false, checked, stop: 'limit' };
      }
    }

    if (onProgress && checked % PROGRESS_EVERY === 0) {
      onProgress({
        downChecked: sign === -1 ? checked : downChecked,
        upChecked: sign === 1 ? checked : 0,
        phase: sign === -1 ? 'down' : 'up',
      });
    }
  }

  return { candidates: found, hitLimit: true, checked, stop: 'safety' };
}

export function runSearch({
  initial,
  ratio,
  operation,
  d,
  targetDecimals,
  maxSteps = DEFAULTS.maxSteps,
  limit = DEFAULTS.resultLimit,
  onProgress = null,
}) {
  const down = searchDirection({
    initial,
    ratio,
    operation,
    d,
    targetDecimals,
    maxSteps,
    limit,
    sign: -1,
    onProgress,
    downChecked: 0,
  });
  const up = searchDirection({
    initial,
    ratio,
    operation,
    d,
    targetDecimals,
    maxSteps,
    limit,
    sign: 1,
    onProgress,
    downChecked: down.checked,
  });

  if (onProgress) {
    onProgress({
      downChecked: down.checked,
      upChecked: up.checked,
      phase: 'done',
    });
  }

  return {
    d,
    p: discrepancyPlaces(d),
    step: make(1n, pow10(d)),
    down,
    up,
  };
}
