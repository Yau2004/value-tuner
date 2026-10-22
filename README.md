# 數值微調搜尋器（Value Tuner）

給定 `initial`、`ratio` 與乘法或除法，這個工具會在 `initial` 附近建立固定格點，找出符合指定捨入與誤差規則的候選值，省去手動逐一嘗試附近數字的時間。

瀏覽器版本可直接在頁面上操作，不需要登入、API key 或後端；專案也保留原本的 Python CLI。

## 畫面預覽

![數值微調搜尋器桌面版：完成 0.165、3.1818、乘法搜尋後，顯示設定摘要、initial 檢查結果與下調候選表](docs/images/value-tuner-desktop.png)

目前線上版尚未發布；可在本機啟動完整網站。

## 主要功能

- 支援乘法與除法兩種運算，分別向上、向下搜尋。
- 兩個方向各自找出距離 `initial` 最近的合格候選，互不補足。
- 保留 `initial` 的尾端零與對應精度，使用精確有理數判斷是否合格。
- 計算全部在瀏覽器本機進行，並提供搜尋進度與取消功能。
- 可在進階設定調整每方向步數、結果筆數與 target 小數位數。

## 使用技術

- HTML、CSS、JavaScript ES modules、Vite
- BigInt 有理數、Web Worker
- Python `Decimal`／`Fraction`
- pytest、Node 核心測試、Playwright、GitHub Actions／Pages

## 本機使用

Vite 8 需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
npm run dev
```

開啟 `http://localhost:5173/`。

### Production build 與預覽

```bash
npm run build
npm run preview
```

預覽網址為 `http://127.0.0.1:4173/value-tuner/`，用來模擬 GitHub Pages 子路徑。

### Python CLI

以 Python 3.12 驗證；沒有額外執行期依賴。

```bash
python main.py
```

程式會依序詢問 `initial`、`ratio` 與 operation。

### 測試

Python 測試需先安裝 pytest：

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

也可以執行 `npm test`，一次跑完前端核心、建置與瀏覽器測試。

## 為什麼做這個

手動微調附近數值時，很容易只憑看起來接近的結果做判斷。這個工具把捨入精度、誤差門檻與搜尋順序固定下來，讓同一組輸入可以得到一致、可比較的候選清單。

## 進一步說明

- [數值規則與搜尋行為](docs/numerical-rules.md)：`d`／`step`／`p`、精確合格邊界、target=0、顯示近似值與停止條件。
- [開發、測試與部署](docs/development-and-deployment.md)：架構、測試前置條件、GitHub Pages 設定與已知限制。

搜尋受每方向步數上限限制；找不到候選不代表所有可能數值都無解。
