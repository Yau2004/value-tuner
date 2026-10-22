const DECIMAL_RE = /^[0-9]+(?:\.[0-9]+)?$/;

export class InputError extends Error {
  constructor(code, label) {
    super(`${label}: ${code}`);
    this.name = 'InputError';
    this.code = code;
    this.label = label;
  }
}

function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x === 0n ? 1n : x;
}

export function make(n, d = 1n) {
  if (d === 0n) throw new RangeError('zero denominator');
  let numerator = n;
  let denominator = d;
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = gcd(numerator, denominator);
  return { n: numerator / divisor, d: denominator / divisor };
}

export const ZERO = make(0n);

export function pow10(places) {
  if (!Number.isInteger(places) || places < 0) {
    throw new RangeError('places must be a non-negative integer');
  }
  return 10n ** BigInt(places);
}

export function decimalPlaces(text) {
  const stripped = String(text).trim();
  const dot = stripped.indexOf('.');
  return dot === -1 ? 0 : stripped.length - dot - 1;
}

export function parsePositiveDecimal(text, label) {
  const stripped = String(text).trim();
  if (!DECIMAL_RE.test(stripped)) {
    throw new InputError('format', label);
  }
  const dot = stripped.indexOf('.');
  const whole = dot === -1 ? stripped : stripped.slice(0, dot);
  const fraction = dot === -1 ? '' : stripped.slice(dot + 1);
  const numerator = BigInt(whole + fraction);
  if (numerator === 0n) {
    throw new InputError('zero', label);
  }
  const places = fraction.length;
  return {
    value: make(numerator, pow10(places)),
    text: stripped,
    places,
  };
}

export function add(a, b) {
  return make(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a, b) {
  return make(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a, b) {
  return make(a.n * b.n, a.d * b.d);
}

export function div(a, b) {
  if (b.n === 0n) throw new RangeError('division by zero');
  return make(a.n * b.d, a.d * b.n);
}

export function neg(a) {
  return make(-a.n, a.d);
}

export function abs(a) {
  return make(a.n < 0n ? -a.n : a.n, a.d);
}

export function cmp(a, b) {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function eq(a, b) {
  return cmp(a, b) === 0;
}

export function isZero(value) {
  return value.n === 0n;
}

export function isPositive(value) {
  return value.n > 0n;
}

export function roundHalfUp(value, places) {
  const scale = pow10(places);
  const scaled = value.n * scale;
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  let whole = absolute / value.d;
  const remainder = absolute % value.d;
  if (2n * remainder >= value.d) whole += 1n;
  return make(negative ? -whole : whole, scale);
}

function formatRounded(value, places) {
  const scale = pow10(places);
  const units = value.n * (scale / value.d);
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / scale;
  let text = whole.toString();
  if (places > 0) {
    text += '.' + (absolute % scale).toString().padStart(places, '0');
  }
  return (negative ? '-' : '') + text;
}

function trimZeros(text) {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

export function formatFixed(value, places, trim = false) {
  const text = formatRounded(roundHalfUp(value, places), places);
  return trim ? trimZeros(text) : text;
}

export function formatTrimmed(value, places) {
  return formatFixed(value, places, true);
}

export function formatHighPrecision(value, places) {
  const rounded = roundHalfUp(value, places);
  const text = trimZeros(formatRounded(rounded, places));
  return eq(rounded, value) ? text : `≈ ${text}`;
}

export function formatPercent(value, places) {
  return `${formatHighPrecision(value, places)}%`;
}

export function fractionToJSON(value) {
  return { n: value.n.toString(), d: value.d.toString() };
}

export function fractionFromJSON(value) {
  return make(BigInt(value.n), BigInt(value.d));
}
