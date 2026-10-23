# Value Tuner

Find nearby numeric values that satisfy precise rounding and relative-error rules—without manually tweaking numbers over and over.

[Try the live app](https://yau2004.github.io/value-tuner/)

Value Tuner searches around an initial value, applies multiplication or division by a specified ratio, and returns nearby candidates that meet the qualification criteria.

The web app runs entirely in your browser. No installation, sign-in, API key, or backend service is required. A Python command-line version is also included.

## Preview

![Value Tuner desktop interface showing search settings, the initial-value evaluation, and nearby qualifying candidates](docs/images/value-tuner-desktop.png)

## Quick Start

1. Open the [live app](https://yau2004.github.io/value-tuner/).
2. Enter an initial value and a ratio.
3. Choose multiplication or division.
4. Start the search.
5. Review the initial-value evaluation and qualifying candidates below and above it.

Try these inputs:

| Setting | Value |
| --- | --- |
| Initial value | `0.165` |
| Ratio | `3.1818` |
| Operation | Multiplication |

Expand the advanced settings to adjust the search-step limit, the number of results per direction, or the number of decimal places used for the rounded target.

## Features

- Multiplication and division: evaluate an initial value against a specified ratio.
- Bidirectional search: find the nearest qualifying candidates below and above the initial value, with up to three results per direction by default.
- Precision-aware input: preserve trailing zeros and use the initial value's decimal precision to determine the search step.
- Exact qualification checks: use rational arithmetic rather than approximate floating-point comparisons.
- Responsive searching: run browser calculations in a Web Worker, with progress updates and cancellation.
- Configurable search: adjust the step limit, result count, and target decimal places.
- Local browser computation: run calculations without a backend service.
- Python CLI: use the command-line version for an interactive terminal workflow.

## How It Works

For each candidate value, Value Tuner:

1. Multiplies or divides the candidate by the ratio.
2. Rounds the result to the configured number of target decimal places using round-half-up.
3. Calculates the relative discrepancy between the exact result and the rounded target.
4. Checks whether that discrepancy is strictly below the qualification threshold.

The relative discrepancy is calculated as:

```text
relative discrepancy (%) = |exact result - rounded target| / |rounded target| × 100
```

The qualification threshold depends on the decimal precision of the initial input:

```text
d = number of decimal places in the initial input
p = max(d - 1, 0)

qualification threshold (%) = 0.5 × 10^(-p)
```

A candidate qualifies only when its relative discrepancy is strictly below this threshold. Candidates whose rounded target is zero do not qualify.

The initial value is evaluated separately. Searches then move outward in both directions, returning qualifying candidates in nearest-first order within each direction.

### Trailing zeros matter

`0.1`, `0.10`, and `0.100` represent the same numeric value, but they specify different input precision:

| Initial input | Search step |
| --- | --- |
| `0.1` | `0.1` |
| `0.10` | `0.01` |
| `0.100` | `0.001` |

This precision also affects the qualification threshold.

### Displayed zero is not necessarily exact zero

A displayed discrepancy of `0.00%` is a rounded representation. It does not necessarily mean that the exact discrepancy is zero.

### Search limits

Each direction has a maximum number of search steps. Finding no candidates within that limit does not prove that no qualifying values exist outside the searched range.

The downward search stops before reaching a nonpositive candidate.

See [Numerical Rules and Search Behavior](docs/numerical-rules.md) for the full details.

## Run Locally

### Web App

The project uses Vite 8, which requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
git clone [https://github.com/Yau2004/value-tuner.git](https://github.com/Yau2004/value-tuner.git)
cd value-tuner
npm install
npm run dev
```

Open `http://localhost:5173/`.

To build and preview the production version:

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/value-tuner/`.

The preview uses the `/value-tuner/` base path to match the GitHub Pages deployment.

### Python CLI

The CLI has been verified with Python 3.12 and has no third-party runtime dependencies.

From the project root, run:

```bash
python main.py
```

Follow the prompts to enter the initial value, ratio, and operation.

## Testing

### Python Tests

Install pytest and run the test suite:

```bash
python -m pip install pytest
python -m pytest -q
```

### JavaScript Core Tests

Run the JavaScript calculation tests, including comparisons against Python-generated fixtures:

```bash
npm run test:core
```

### Browser Tests

Browser tests require a production build and a local Chrome installation:

```bash
npm run build
npm run test:browser
```

To run the JavaScript core tests, production build, and browser tests together:

```bash
npm test
```

The Python test suite is run separately.

See [Development, Testing, and Deployment](docs/development-and-deployment.md) for additional prerequisites and alternative browser configurations.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | HTML, CSS, JavaScript ES modules, Vite |
| Browser computation | BigInt-based rational arithmetic, Web Worker |
| Python computation | `Decimal`, `Fraction` |
| Testing | pytest, Node.js core tests, Playwright, Python-generated fixtures |
| Deployment | GitHub Actions, GitHub Pages |

## Why Value Tuner?

Manually adjusting numbers can make it tempting to accept a result simply because it looks close enough on screen.

Value Tuner makes the rounding precision, error threshold, and search order explicit, so candidates can be compared under the same rules. Exact arithmetic separates the underlying qualification check from the rounded values shown in the interface.

## Documentation

- [Numerical Rules and Search Behavior](docs/numerical-rules.md): input precision, search steps, qualification thresholds, display rounding, and stopping conditions.
- [Development, Testing, and Deployment](docs/development-and-deployment.md): architecture, test prerequisites, GitHub Pages configuration, and known limitations.