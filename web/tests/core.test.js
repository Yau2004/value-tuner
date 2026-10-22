import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  InputError,
  cmp,
  decimalPlaces,
  div,
  eq,
  formatFixed,
  formatHighPrecision,
  formatPercent,
  formatTrimmed,
  fractionFromJSON,
  isZero,
  make,
  parsePositiveDecimal,
  roundHalfUp,
  sub,
} from '../src/core/rational.js';
import {
  DEFAULTS,
  discrepancyPercent,
  discrepancyPlaces,
  evaluate,
  isQualified,
  qualificationThreshold,
  runSearch,
} from '../src/core/tuner.js';
import {
  displayPlaces,
  serializeDirection,
  serializeEvaluation,
} from '../src/core/display.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(path.join(HERE, 'fixtures', 'parity.json'), 'utf8'),
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function fraction(value) {
  return make(BigInt(value.n), BigInt(value.d));
}

function parse(text) {
  return parsePositiveDecimal(text, 'initial').value;
}

function parseSearchCase(testCase) {
  const initialParsed = parsePositiveDecimal(testCase.input.initialText, 'initial');
  const ratioParsed = parsePositiveDecimal(testCase.input.ratioText, 'ratio');
  return {
    initial: initialParsed.value,
    ratio: ratioParsed.value,
    initialText: initialParsed.text,
    ratioText: ratioParsed.text,
    d: initialParsed.places,
    targetDecimals: testCase.settings.targetDecimals,
  };
}

test('trailing zeros, decimal places, and step are preserved', () => {
  assert.equal(decimalPlaces('0.1'), 1);
  assert.equal(decimalPlaces('0.10'), 2);
  assert.equal(decimalPlaces('0.100'), 3);
  assert.equal(decimalPlaces('0.165'), 3);
  assert.equal(decimalPlaces('1'), 0);
  assert.ok(eq(parse('0.1'), parse('0.10')));
  assert.ok(eq(parse('0.10'), parse('0.100')));
  assert.equal(formatTrimmed(make(1n, 10n), 1), '0.1');
  assert.equal(formatTrimmed(make(1n, 100n), 2), '0.01');
  assert.equal(formatTrimmed(make(1n, 1000n), 3), '0.001');
});

test('d = 0 and d = 1 use p = 0', () => {
  assert.equal(discrepancyPlaces(0), 0);
  assert.equal(discrepancyPlaces(1), 0);
  assert.equal(discrepancyPlaces(2), 1);
  assert.equal(discrepancyPlaces(3), 2);
  assert.ok(eq(qualificationThreshold(0), make(1n, 2n)));
});

test('multiply, divide, and repeating decimals stay exact', () => {
  assert.ok(eq(evaluate(make(3n, 2n), make(5n, 4n), 1, 4, 4).y, make(15n, 8n)));
  assert.ok(eq(evaluate(make(3n, 2n), make(5n, 4n), 2, 4, 4).y, make(6n, 5n)));
  const third = evaluate(make(1n), make(3n), 2, 6, 6);
  assert.ok(eq(third.y, make(1n, 3n)));
  assert.match(formatHighPrecision(third.y, 10), /^≈ 0\.3333333333$/);
});

test('ROUND_HALF_UP midpoints', () => {
  assert.ok(eq(roundHalfUp(make(5n, 1000n), 2), make(1n, 100n)));
  assert.ok(eq(roundHalfUp(make(49n, 10000n), 2), make(0n)));
  assert.ok(eq(roundHalfUp(make(-5n, 1000n), 2), make(-1n, 100n)));
});

test('strict p=2 threshold: 0.0049 qualifies, 0.0050 does not', () => {
  assert.equal(isQualified(make(49n, 10000n), 2), true);
  assert.equal(isQualified(make(50n, 10000n), 2), false);
  assert.equal(isQualified(make(51n, 10000n), 2), false);
  assert.equal(formatFixed(make(49n, 10000n), 2), '0.00');
  assert.equal(formatFixed(make(50n, 10000n), 2), '0.01');
});

test('display rounding never drives qualification', () => {
  const boundary = make(50n, 10000n);
  assert.equal(isQualified(boundary, 2), false);
  assert.equal(formatFixed(boundary, 3), '0.005');
  assert.equal(formatFixed(boundary, 2), '0.01');
  assert.equal(
    isQualified(fractionFromJSON({ n: '1', d: '200' }), 2),
    false,
  );
});

test('target zero is skipped safely', () => {
  const result = evaluate(make(1n, 10000n), make(1n), 1, 4, 3);
  assert.ok(isZero(result.target));
  assert.equal(result.discrepancy, null);
  assert.equal(result.roundedDiscrepancy, null);
  assert.equal(result.qualified, false);
});

test('target precision can be overridden independently of d and p', () => {
  const x = make(1234n, 10000n);
  assert.ok(eq(evaluate(x, make(1n), 1, 3, 1).target, make(1n, 10n)));
  assert.ok(eq(evaluate(x, make(1n), 1, 3, 2).target, make(12n, 100n)));
  assert.ok(eq(evaluate(x, make(1n), 1, 3, 3).target, make(123n, 1000n)));
});

test('candidate x keeps d decimal places and target is trimmed', () => {
  const initial = make(2691n, 1000n);
  const search = runSearch({
    initial,
    ratio: make(1n),
    operation: 1,
    d: 3,
    targetDecimals: 3,
    maxSteps: 3,
    limit: 1,
  });
  const display = serializeEvaluation(
    search.down.candidates[0],
    initial,
    3,
    2,
    3,
  ).display;
  assert.equal(display.x, '2.690');
  assert.equal(display.delta, '-0.001');
  assert.equal(display.target, '2.69');
});

test('search stops independently, orders by distance, and reports metadata', () => {
  const initial = make(1n, 2n);
  const search = runSearch({
    initial,
    ratio: make(1n),
    operation: 1,
    d: 3,
    targetDecimals: 3,
    maxSteps: 3,
    limit: 3,
  });
  assert.deepEqual(
    search.down.candidates.map((item) => formatFixed(item.x, 3)),
    ['0.499', '0.498', '0.497'],
  );
  assert.deepEqual(
    search.up.candidates.map((item) => formatFixed(item.x, 3)),
    ['0.501', '0.502', '0.503'],
  );
  assert.equal(search.down.checked, 3);
  assert.equal(search.up.checked, 3);
  assert.equal(search.down.stop, 'limit');
  assert.equal(search.up.stop, 'limit');

  const capped = runSearch({
    initial,
    ratio: make(1n),
    operation: 1,
    d: 3,
    targetDecimals: 3,
    maxSteps: 2,
    limit: 3,
  });
  assert.equal(capped.down.candidates.length, 2);
  assert.equal(capped.up.candidates.length, 2);
  assert.equal(capped.down.stop, 'safety');
  assert.equal(capped.up.stop, 'safety');
  assert.equal(capped.down.hitLimit, true);
  assert.equal(capped.up.hitLimit, true);

  const nearZero = runSearch({
    initial: make(1n, 1000n),
    ratio: make(1n),
    operation: 1,
    d: 3,
    targetDecimals: 3,
    maxSteps: 10,
    limit: 3,
  });
  assert.deepEqual(nearZero.down.candidates, []);
  assert.equal(nearZero.down.stop, 'nonpositive');
  assert.equal(nearZero.down.checked, 0);
  assert.equal(nearZero.up.candidates.length, 3);
});

test('candidate x is always on the d-grid', () => {
  const initial = make(165n, 1000n);
  const search = runSearch({
    initial,
    ratio: make(31818n, 10000n),
    operation: 1,
    d: 3,
    targetDecimals: 3,
    maxSteps: 100,
    limit: 3,
  });
  const step = make(1n, 1000n);
  for (const candidate of [...search.down.candidates, ...search.up.candidates]) {
    const grid = div(sub(candidate.x, initial), step);
    assert.equal(grid.d, 1n);
    assert.ok(cmp(candidate.x, make(0n)) > 0);
  }
});

test('invalid inputs are rejected with the Python format contract', () => {
  for (const text of fixtures.invalid) {
    assert.throws(
      () => parsePositiveDecimal(text, 'initial'),
      (error) => error instanceof InputError,
      `expected ${JSON.stringify(text)} to be rejected`,
    );
  }
  const accepted = parsePositiveDecimal('  0.1650  ', 'initial');
  assert.equal(accepted.text, '0.1650');
  assert.equal(accepted.places, 4);
});

test('large integers and decimals are exact', () => {
  const huge = parse('9007199254740993');
  assert.equal(huge.n.toString(), '9007199254740993');
  const decimal = parse('12345678901234567890.12345');
  assert.equal(decimal.n.toString(), '246913578024691357802469');
  assert.equal(decimal.d.toString(), '20000');
  assert.equal(formatFixed(decimal, 5), '12345678901234567890.12345');
});

test('Python fixtures: search parity', () => {
  for (const testCase of fixtures.cases) {
    const parsed = parseSearchCase(testCase);
    assert.equal(parsed.initialText, testCase.settings.initialText);
    assert.equal(parsed.d, testCase.settings.d);
    assert.equal(discrepancyPlaces(parsed.d), testCase.settings.p);

    const initialResult = evaluate(
      parsed.initial,
      parsed.ratio,
      testCase.input.operation,
      parsed.d,
      parsed.targetDecimals,
    );
    assert.deepEqual(
      serializeEvaluation(
        initialResult,
        null,
        parsed.d,
        testCase.settings.p,
        parsed.targetDecimals,
      ),
      testCase.initial,
      `${testCase.name}: initial mismatch`,
    );

    const search = runSearch({
      initial: parsed.initial,
      ratio: parsed.ratio,
      operation: testCase.input.operation,
      d: parsed.d,
      targetDecimals: parsed.targetDecimals,
      maxSteps: testCase.input.maxSteps,
      limit: testCase.input.resultLimit,
    });

    assert.equal(search.p, testCase.settings.p, `${testCase.name}: p`);
    assert.equal(
      formatFixed(search.step, parsed.d),
      testCase.settings.step,
      `${testCase.name}: step`,
    );
    assert.equal(
      formatPercent(qualificationThreshold(search.p), displayPlaces(parsed.d)),
      testCase.settings.threshold,
      `${testCase.name}: threshold`,
    );
    assert.deepEqual(
      serializeDirection(
        search.down,
        parsed.initial,
        parsed.d,
        search.p,
        parsed.targetDecimals,
      ),
      testCase.down,
      `${testCase.name}: down mismatch`,
    );
    assert.deepEqual(
      serializeDirection(
        search.up,
        parsed.initial,
        parsed.d,
        search.p,
        parsed.targetDecimals,
      ),
      testCase.up,
      `${testCase.name}: up mismatch`,
    );
  }
});

test('Python fixtures: evaluation parity', () => {
  for (const testCase of fixtures.evaluations) {
    const x = parse(testCase.xText);
    const ratio = parse(testCase.ratioText);
    const p = discrepancyPlaces(testCase.d);
    const result = evaluate(
      x,
      ratio,
      testCase.operation,
      testCase.d,
      testCase.targetDecimals,
    );
    assert.deepEqual(
      serializeEvaluation(result, null, testCase.d, p, testCase.targetDecimals),
      testCase.evaluation,
      `${testCase.name}: evaluation mismatch`,
    );
  }
});

test('Python fixtures: threshold parity', () => {
  for (const item of fixtures.thresholds) {
    assert.equal(
      isQualified(fraction(item.discrepancy), item.p),
      item.qualified,
      `p=${item.p} discrepancy=${item.discrepancy.n}/${item.discrepancy.d}`,
    );
  }
});

test('parity fixtures contain the required 0.165 and 0.176 cases', () => {
  const required = fixtures.cases.find((item) => item.name === 'required-0165');
  assert.ok(required);
  assert.equal(required.initial.qualified, true);
  assert.ok(required.initial.display.target === '0.525');
  assert.ok(required.settings.targetDecimals === 3);
  assert.ok(required.settings.p === 2);
  assert.ok(
    required.up.candidates.some((candidate) => candidate.display.x === '0.176'),
  );
  const candidate176 = required.up.candidates.find(
    (candidate) => candidate.display.x === '0.176',
  );
  assert.equal(candidate176.qualified, true);
  assert.equal(candidate176.display.target, '0.56');
  assert.equal(candidate176.display.roundedDiscrepancy, '0.00%');
  assert.notEqual(candidate176.display.discrepancy, '0%');
});

test('defaults match the Python reference', () => {
  assert.equal(DEFAULTS.maxSteps, 1_000_000);
  assert.equal(DEFAULTS.resultLimit, 3);
  assert.equal(DEFAULTS.targetDecimals, null);
  assert.equal(discrepancyPercent(make(99n, 100n), make(1n)).n, 1n);
  assert.equal(discrepancyPlaces(3), 2);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
