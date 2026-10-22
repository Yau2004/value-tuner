# 開發、測試與部署

## 專案結構

```text
web/
  index.html
  src/
    main.js             UI 狀態、DOM、Worker 生命週期
    worker.js           Web Worker 訊息協定
    style.css           本地 CSS
    core/
      rational.js       BigInt 分數、解析、精確比較、ROUND_HALF_UP、格式化
      tuner.js          evaluate / search / 門檻 / 停止原因
      display.js        精確值序列化與顯示字串
  tests/
    core.test.js        Node 核心與 Python fixtures 對照
    browser.spec.js     Playwright production-build 測試
    fixtures/parity.json
scripts/
  generate_fixtures.py  從 Python 核心產生可重現 fixtures
  serve-dist.mjs        模擬 GitHub Pages 子路徑的靜態伺服器
```

Python 入口是 `main.py`，數學核心在 `tuner.py`。

## 計算架構

- 瀏覽器版本的業務十進位只用 BigInt 有理數；不使用 `parseFloat`、`Number`、`Math.round`、`toFixed` 或 epsilon 判斷。
- `Number` 只用於已驗證的步數、位數、進度等非業務數值。
- 搜尋在 Web Worker 執行；主執行緒只處理 UI 與訊息。
- Worker 訊息包含 job ID、精確分子／分母字串與顯示所需欄位。
- 取消會終止 Worker 並遞增 job ID；舊 Worker 的遲到訊息會被忽略。
- 進度每 5,000 步回報一次，UI 以 `requestAnimationFrame` 節流，不捏造百分比或完成時間。
- 輸入變動時，既有結果會標示為「上一次搜尋」。
- 取消後不顯示未完成的部分結果。

Python 使用 `Decimal` 做顯示、`Fraction` 做精確運算；瀏覽器 fixtures 由 Python 核心產生，避免 JavaScript 實作自行定義預期值。

## 本機開發

Vite 8 要求 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
npm run dev
```

Vite dev server 預設在 `http://localhost:5173/`。

production build 與子路徑預覽：

```bash
npm run build
npm run preview
```

`npm run preview` 會在 `http://127.0.0.1:4173/value-tuner/` 提供 `dist/`。

## 測試

Python 需要先安裝 pytest：

```bash
python -m pip install pytest
python -m pytest -q
```

JavaScript 核心與 Python fixtures 對照：

```bash
npm run test:core
```

重新產生 fixtures：

```bash
python scripts/generate_fixtures.py
```

瀏覽器測試需要 production build 與本機 Chrome：

```bash
npm run build
npm run test:browser
```

Playwright 設定使用 `channel: "chrome"`。若環境沒有 Chrome，可改用 Playwright 的 Chromium：

```bash
npx playwright install chromium
# PowerShell
$env:PLAYWRIGHT_CHANNEL='chromium'; npm run test:browser
# bash
PLAYWRIGHT_CHANNEL=chromium npm run test:browser
```

一次跑完前端核心、建置與瀏覽器測試：

```bash
npm test
```

## GitHub Pages 部署

1. 將專案 push 到 GitHub 的 `main` 分支。
2. 到 repository 的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
4. push 到 `main`，或手動執行 **Actions → Test and deploy GitHub Pages → Run workflow**。

`.github/workflows/pages.yml` 會依序：

1. 安裝 Python 3.12 與 pytest，執行 Python 測試。
2. 用 Python 重新產生 fixtures，確認已提交的 fixtures 沒有差異。
3. 安裝前端依賴，執行 JavaScript 核心測試。
4. 建置 `dist/`。
5. 執行 Playwright 瀏覽器測試。
6. 以 `actions/upload-pages-artifact` 與 `actions/deploy-pages` 部署。

Workflow 使用 `contents: read`、`pages: write`、`id-token: write`，並以 `pages` concurrency group 避免同時部署。專案使用相對資產路徑，沒有寫死 owner、repository 或本機絕對路徑。

目前沒有已確認的公開 Demo URL；是否已實際部署，以 repository 的 Actions 與 Pages 狀態為準。

## 已知限制

- 有限安全步數內沒有結果，不代表所有可能數值都無解。
- 2,000,000 步的長搜尋可能需要數秒；Worker 保持頁面可操作，取消會直接終止。
- 瀏覽器測試在 Windows 以系統 Chrome 驗證；CI 假設 `ubuntu-latest` 的 Chrome 可用。沒有真實手機裝置或跨瀏覽器矩陣測試。
- 沒有 analytics、遠端 API、登入或後端。
- 專案沒有自動 commit 或 push；部署只會在 GitHub Actions workflow 被執行時發生。

## 設計參考與授權

視覺方向實際參考：

<https://github.com/joshhu/uitest/blob/main/styles/16-micro-interactions.html>

採用其淺灰背景、白色圓角卡片、藍色主操作、柔和陰影、輸入 focus feedback、按鈕按壓回饋與狀態色；沒有複製登入、Like、行銷 Hero 或展示用控制項。

該 repository 的 GitHub API 授權欄位為 `null`，且 `/license` 回傳 404，沒有可確認的 LICENSE。因此本專案沒有重用其程式碼，只以一般視覺特徵重新實作本地 CSS。若日後要重用該專案程式碼，必須先確認授權並保留所需 attribution。
