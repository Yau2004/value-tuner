import {
  ZERO,
  cmp,
  formatFixed,
  formatHighPrecision,
  formatPercent,
  fractionToJSON,
  isZero,
  sub,
} from './rational.js';

export const HIGH_PRECISION_BASE = 10;

export function displayPlaces(d) {
  return Math.max(HIGH_PRECISION_BASE, d + 6);
}

export function formatSigned(value, places) {
  const text = formatFixed(value, places);
  return cmp(value, ZERO) > 0 ? `+${text}` : text;
}

export function evaluationDisplay(evaluation, initial, d, p, targetDecimals) {
  return {
    x: formatFixed(evaluation.x, d),
    delta:
      initial === null
        ? null
        : formatSigned(sub(evaluation.x, initial), d),
    y: formatHighPrecision(evaluation.y, displayPlaces(d)),
    target: formatFixed(evaluation.target, targetDecimals, true),
    discrepancy:
      evaluation.discrepancy === null
        ? null
        : formatPercent(evaluation.discrepancy, displayPlaces(d)),
    roundedDiscrepancy:
      evaluation.roundedDiscrepancy === null
        ? null
        : `${formatFixed(evaluation.roundedDiscrepancy, p)}%`,
    exactZero:
      evaluation.discrepancy === null ? null : isZero(evaluation.discrepancy),
  };
}

export function serializeEvaluation(evaluation, initial, d, p, targetDecimals) {
  return {
    x: fractionToJSON(evaluation.x),
    y: fractionToJSON(evaluation.y),
    target: fractionToJSON(evaluation.target),
    discrepancy:
      evaluation.discrepancy === null ? null : fractionToJSON(evaluation.discrepancy),
    roundedDiscrepancy:
      evaluation.roundedDiscrepancy === null
        ? null
        : fractionToJSON(evaluation.roundedDiscrepancy),
    qualified: evaluation.qualified,
    display: evaluationDisplay(evaluation, initial, d, p, targetDecimals),
  };
}

export function serializeDirection(direction, initial, d, p, targetDecimals) {
  return {
    checked: direction.checked,
    hitLimit: direction.hitLimit,
    stop: direction.stop,
    candidates: direction.candidates.map((candidate) =>
      serializeEvaluation(candidate, initial, d, p, targetDecimals),
    ),
  };
}
