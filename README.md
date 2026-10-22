# 數值微調搜尋器（Value Tuner）

一個直接在瀏覽器使用的數值微調工具：輸入初始值、倍率與乘法或除法，便能在初始值附近搜尋符合捨入與誤差規則的候選值，不必手動反覆嘗試。

[立即使用線上版](https://yau2004.github.io/value-tuner/)

不需要安裝、登入或 API key，計算在瀏覽器本機進行。專案也保留 Python 命令列版本。

## 畫面預覽

![數值微調搜尋器桌面版：完成 0.165、3.1818、乘法搜尋後，顯示設定摘要、initial 檢查結果與下調候選表](docs/images/value-tuner-desktop.png)

## 快速使用

1. 開啟[線上版](https://yau2004.github.io/value-tuner/)。
2. 輸入初始值（initial）與倍率（ratio），選擇乘法或除法。
3. 按下「開始搜尋」，查看初始值的檢查結果，以及下調、上調兩個方向的合格候選。

可以先試試 initial = `0.165`、ratio = `3.1818`、乘法。需要時可展開進階設定，調整搜尋步數、結果筆數或目標值的小數位數。

輸入尾端的零有意義：`0.1`、`0.10` 與 `0.100` 會使用不同的搜尋步長與精度。顯示為 `0.00%` 只代表捨入後的誤差，不代表精確誤差一定為零。

## 主要功能

- 支援乘法與除法，向下、向上各自搜尋最近的合格候選，預設每方向最多 3 筆。
- 保留輸入尾端零與對應精度，以精確有理數判斷是否合格。
- 搜尋由 Web Worker 執行，提供進度與取消功能。
- 可調整每方向的搜尋步數、結果筆數與目標值小數位數。
- 計算在瀏覽器本機進行，不需要後端服務。

搜尋受每方向步數上限限制；找不到候選不代表所有可能數值都無解。

## 使用技術

- 前端：HTML、CSS、JavaScript ES modules、Vite
- 計算：BigInt 有理數、Web Worker；Python `Decimal`／`Fraction`
- 測試：pytest、Node 核心測試、Playwright、Python 對照 fixtures
- 部署：GitHub Actions、GitHub Pages

## 本機使用

### 網站版本

Vite 8 需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
git clone [https://github.com/Yau2004/value-tuner.git](https://github.com/Yau2004/value-tuner.git)
cd value-tuner
npm install
npm run dev
```

開啟 `http://localhost:5173/`。

建置與預覽 production 版本：

```bash
npm run build
npm run preview
```

預覽網址為 `http://127.0.0.1:4173/value-tuner/`，用來模擬 GitHub Pages 子路徑。

### Python CLI

以 Python 3.12 驗證；沒有額外執行期依賴。在專案根目錄執行：

```bash
python main.py
```

依序輸入 initial、ratio 與 operation，即可查看結果。

### 測試

Python 測試：

```bash
python -m pip install pytest
python -m pytest -q
```

JavaScript 核心與 Python fixtures 對照：

```bash
npm run test:core
```

瀏覽器測試需要 production build 與本機 Chrome：

```bash
npm run build
npm run test:browser
```

也可以執行 `npm test`，一次執行前端核心測試、建置與瀏覽器測試。其他前置條件及替代瀏覽器設定請見下方開發文件。

## 為什麼做這個

手動微調數值時，很容易只憑顯示結果看起來接近就做判斷。這個工具明確定義捨入精度、誤差門檻與搜尋順序，讓使用者能比較符合相同規則的候選值。

## 進一步說明

- [數值規則與搜尋行為](docs/numerical-rules.md)：輸入精度、搜尋步長、合格門檻、近似顯示與停止條件。
- [開發、測試與部署](docs/development-and-deployment.md)：架構、測試前置條件、GitHub Pages 設定與已知限制。