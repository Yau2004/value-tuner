import { expect, test } from '@playwright/test';

async function openApp(page) {
  await page.goto('/value-tuner/');
  await expect(page.getByRole('heading', { name: '數值微調搜尋器' })).toBeVisible();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'idle');
}

async function runDefault(page) {
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'success', {
    timeout: 20_000,
  });
  await expect(page.locator('#results')).toBeVisible();
}

async function openAdvanced(page) {
  const summary = page.getByText('進階設定', { exact: true });
  if (!(await page.locator('#advanced').evaluate((element) => element.open))) {
    await summary.click();
  }
}

const LONG_RATIO = `0.${'0'.repeat(150)}1`;

async function setLongSearch(page) {
  await page.getByLabel('initial', { exact: true }).fill('0.100');
  await page.getByLabel('ratio', { exact: true }).fill(LONG_RATIO);
  await openAdvanced(page);
  await page.getByLabel('每方向最大步數').fill('2000000');
  await page.getByLabel('target 小數位數').fill('100');
}

test('loads production worker, asks for inputs, and renders the required example', async ({
  page,
}) => {
  const failed = [];
  const bad = [];
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) bad.push(`${response.status()} ${response.url()}`);
  });

  await openApp(page);
  await expect(page.getByLabel('initial', { exact: true })).toHaveValue('0.165');
  await expect(page.getByLabel('ratio', { exact: true })).toHaveValue('3.1818');
  await expect(page.getByRole('radio', { name: /乘法/ })).toBeChecked();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#empty-state')).toBeVisible();

  await runDefault(page);

  await expect(page.locator('#status-title')).toHaveText('搜尋完成');
  await expect(page.locator('#summary-initial')).toHaveText('0.165');
  await expect(page.locator('#summary-d')).toHaveText('3');
  await expect(page.locator('#summary-p')).toHaveText('2');
  await expect(page.locator('#summary-step')).toHaveText('0.001');
  await expect(page.locator('#summary-target')).toContainText('3（自動 = d）');
  await expect(page.locator('#summary-threshold')).toHaveText('< 0.005%');
  await expect(page.locator('#initial-badge')).toHaveText('合格');
  await expect(page.locator('#initial-y')).toHaveText('0.524997');
  await expect(page.locator('#initial-target')).toHaveText('0.525');
  await expect(page.locator('#initial-discrepancy')).toContainText('≈');
  await expect(page.locator('#initial-rounded')).toHaveText('0.00%');
  await expect(page.locator('#down-body tbody tr')).toHaveCount(3);
  await expect(page.locator('#up-body tbody tr')).toHaveCount(3);
  await expect(page.locator('#down-body tbody tr').first()).toContainText('0.154');
  await expect(
    page.locator('#up-body tbody tr').filter({ hasText: '0.176' }),
  ).toHaveCount(1);
  await expect(page.locator('#up-body')).toContainText('0.56');
  await expect(page.locator('#stale-notice')).toBeHidden();
  expect(failed).toEqual([]);
  expect(bad).toEqual([]);
  expect(
    requested.every((url) => url.startsWith('http://127.0.0.1:4173/value-tuner/')),
  ).toBe(true);
});

test('preserves initial trailing zeros in summary and step', async ({ page }) => {
  await openApp(page);
  await page.getByLabel('initial', { exact: true }).fill('0.100');
  await page.getByLabel('ratio', { exact: true }).fill('1');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'success', {
    timeout: 20_000,
  });

  await expect(page.locator('#summary-initial')).toHaveText('0.100');
  await expect(page.locator('#summary-d')).toHaveText('3');
  await expect(page.locator('#summary-p')).toHaveText('2');
  await expect(page.locator('#summary-step')).toHaveText('0.001');
});

test('validates fields, clears errors on input, and never auto-searches', async ({
  page,
}) => {
  await openApp(page);

  await page.getByLabel('initial', { exact: true }).fill('0');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'invalid');
  await expect(page.locator('#initial-error')).toContainText('initial 必須大於 0');
  await expect(page.locator('#results')).toBeHidden();

  await page.getByLabel('initial', { exact: true }).fill('1e-3');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#initial-error')).toContainText('不可使用正負號、科學記號');

  await page.getByLabel('initial', { exact: true }).fill('0.165');
  await expect(page.locator('#initial-error')).toBeHidden();
  await page.getByLabel('ratio', { exact: true }).fill('0');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#ratio-error')).toContainText('ratio 必須大於 0');

  await page.getByLabel('ratio', { exact: true }).fill('3.1818');
  await page.getByRole('radio', { name: /除法/ }).check();
  await expect(page.getByRole('radio', { name: /除法/ })).toBeChecked();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'invalid');

  await page.waitForTimeout(300);
  await expect(page.locator('#results')).toBeHidden();
});

test('validates advanced settings and never silently clamps them', async ({ page }) => {
  await openApp(page);
  await openAdvanced(page);

  await page.getByLabel('每方向最大步數').fill('2000001');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#max-steps-error')).toContainText('2,000,000');
  await expect(page.getByLabel('每方向最大步數')).toHaveValue('2000001');
  await expect(page.locator('#results')).toBeHidden();

  await page.getByLabel('每方向最大步數').fill('1000000');
  await page.getByLabel('每方向結果筆數').fill('0');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#result-limit-error')).toContainText('1');
  await expect(page.getByLabel('每方向結果筆數')).toHaveValue('0');

  await page.getByLabel('每方向結果筆數').fill('3');
  await page.getByLabel('target 小數位數').fill('101');
  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#target-decimals-error')).toContainText('100');
  await expect(page.getByLabel('target 小數位數')).toHaveValue('101');
  await expect(page.locator('#results')).toBeHidden();
});

test('explains target = 0 for initial and skips it safely', async ({ page }) => {
  await openApp(page);
  await page.getByLabel('initial', { exact: true }).fill('0.0001');
  await page.getByLabel('ratio', { exact: true }).fill('1');
  await openAdvanced(page);
  await page.getByLabel('每方向最大步數').fill('1');
  await page.getByLabel('target 小數位數').fill('3');
  await page.getByRole('button', { name: '開始搜尋' }).click();

  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#initial-badge')).toHaveText('未判定');
  await expect(page.locator('#initial-target')).toHaveText('0');
  await expect(page.locator('#initial-rounded')).toHaveText('n/a');
  await expect(page.locator('#initial-note')).toContainText('target = 0');
  await expect(page.locator('#initial-note')).toContainText('除以零');
});

test('marks old results stale, loads the example, and resets', async ({ page }) => {
  await openApp(page);
  await runDefault(page);

  await page.getByLabel('initial', { exact: true }).fill('0.200');
  await expect(page.locator('#stale-notice')).toBeVisible();
  await expect(page.locator('#stale-notice')).toContainText('上一次搜尋');
  await expect(page.locator('#results')).toBeVisible();

  await page.getByRole('button', { name: '載入範例' }).click();
  await expect(page.getByLabel('initial', { exact: true })).toHaveValue('0.165');
  await expect(page.getByLabel('ratio', { exact: true })).toHaveValue('3.1818');
  await expect(page.locator('#status-title')).toHaveText('已載入範例');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#stale-notice')).toBeHidden();

  await page.getByLabel('initial', { exact: true }).fill('0.300');
  await page.getByRole('button', { name: '重設' }).click();
  await expect(page.getByLabel('initial', { exact: true })).toHaveValue('0.165');
  await expect(page.getByLabel('ratio', { exact: true })).toHaveValue('3.1818');
  await expect(page.locator('#status-title')).toHaveText('準備搜尋');
  await expect(page.locator('#results')).toBeHidden();
});

test('cancels a long worker search without exposing partial results', async ({ page }) => {
  await openApp(page);
  await setLongSearch(page);

  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'running');
  await expect(page.getByRole('button', { name: '取消搜尋' })).toBeEnabled();
  await expect(page.locator('#progress-panel')).toBeVisible();
  await expect(page.locator('#progress-checked')).not.toHaveText('0', {
    timeout: 5_000,
  });
  await page.getByRole('button', { name: '取消搜尋' }).click();

  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'cancelled');
  await expect(page.locator('#status-title')).toHaveText('已取消');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#progress-panel')).toBeHidden();
  await expect(page.locator('#empty-title')).toHaveText('搜尋已取消');

  await page.waitForTimeout(600);
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'cancelled');
  await expect(page.locator('#results')).toBeHidden();
});

test('a new job cannot be overwritten by a cancelled old worker', async ({ page }) => {
  await openApp(page);
  await setLongSearch(page);

  await page.getByRole('button', { name: '開始搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'running');
  await page.getByRole('button', { name: '取消搜尋' }).click();
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'cancelled');

  await page.getByRole('button', { name: '重設' }).click();
  await runDefault(page);

  await expect(page.locator('#summary-initial')).toHaveText('0.165');
  await expect(
    page.locator('#up-body tbody tr').filter({ hasText: '0.176' }),
  ).toHaveCount(1);
  await page.waitForTimeout(600);
  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#summary-initial')).toHaveText('0.165');
});

test('mobile layout has no page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await expect(page.getByRole('button', { name: '開始搜尋' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);

  await runDefault(page);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await expect(page.locator('#down-body .table-wrap')).toBeVisible();
  await expect(page.locator('#down-body tbody tr')).toHaveCount(3);
});

test('keyboard focus, Enter submit, and reduced motion work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);

  const transitionDuration = await page
    .locator('#start')
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transitionDuration).toMatch(/0\.01ms|0\.00001s|1e-05s/);

  await page.locator('#initial').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#ratio')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#status-card')).toHaveAttribute('data-state', 'success', {
    timeout: 20_000,
  });
  await expect(page.locator('#results')).toBeVisible();
});

test('works under a repository subpath with only local assets', async ({ page }) => {
  await openApp(page);
  expect(new URL(page.url()).pathname.startsWith('/value-tuner/')).toBe(true);
  await runDefault(page);
  await expect(page.locator('#summary-initial')).toHaveText('0.165');
});
