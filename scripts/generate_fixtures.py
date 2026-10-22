#!/usr/bin/env python
"""Generate deterministic JSON fixtures from the Python reference core."""

from __future__ import annotations

import json
import random
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import main  # noqa: E402
from tuner import (  # noqa: E402
    decimal_places,
    discrepancy_places,
    evaluate,
    is_qualified,
    parse_positive_decimal,
    qualification_threshold,
    search_directions,
    search_step,
    to_fraction,
)

OUT = ROOT / "web" / "tests" / "fixtures" / "parity.json"
SEED = 20261022


def fjson(value: Fraction) -> dict[str, str]:
    return {"n": str(value.numerator), "d": str(value.denominator)}


def eval_json(result, initial, d: int, p: int, target_decimals: int) -> dict:
    high = main._display_places(d)
    delta = None
    if initial is not None:
        difference = result.x - initial
        delta = main._format_fixed(difference, d)
        if difference > 0:
            delta = "+" + delta
    return {
        "x": fjson(result.x),
        "y": fjson(result.y),
        "target": fjson(result.target),
        "discrepancy": None if result.discrepancy is None else fjson(result.discrepancy),
        "roundedDiscrepancy": (
            None if result.rounded_discrepancy is None else fjson(result.rounded_discrepancy)
        ),
        "qualified": result.qualified,
        "display": {
            "x": main._format_fixed(result.x, d),
            "delta": delta,
            "y": main._format_high_precision(result.y, high),
            "target": main._format_fixed(result.target, target_decimals, trim=True),
            "discrepancy": (
                None
                if result.discrepancy is None
                else main._format_percent(result.discrepancy, high)
            ),
            "roundedDiscrepancy": (
                None
                if result.rounded_discrepancy is None
                else main._format_fixed(result.rounded_discrepancy, p) + "%"
            ),
            "exactZero": (
                None
                if result.discrepancy is None
                else result.discrepancy == 0
            ),
        },
    }


def direction_json(
    candidates,
    checked: int,
    hit_limit: bool,
    stop: str,
    initial,
    d: int,
    p: int,
    target_decimals: int,
) -> dict:
    return {
        "checked": checked,
        "hitLimit": hit_limit,
        "stop": stop,
        "candidates": [
            eval_json(candidate, initial, d, p, target_decimals)
            for candidate in candidates
        ],
    }


def case(
    name: str,
    initial_text: str,
    ratio_text: str,
    operation: int,
    *,
    max_steps: int,
    result_limit: int = 3,
    target_decimals: int | None = None,
) -> dict:
    _, initial_text = parse_positive_decimal(initial_text, "initial")
    _, ratio_text = parse_positive_decimal(ratio_text, "ratio")
    d = decimal_places(initial_text)
    p = discrepancy_places(d)
    resolved_target = d if target_decimals is None else target_decimals
    initial = to_fraction(initial_text)
    ratio = to_fraction(ratio_text)
    initial_eval = evaluate(initial, ratio, operation, d, resolved_target)
    search = search_directions(
        initial,
        ratio,
        operation,
        d,
        resolved_target,
        max_steps=max_steps,
        limit=result_limit,
    )
    high = main._display_places(d)
    return {
        "name": name,
        "input": {
            "initialText": initial_text,
            "ratioText": ratio_text,
            "operation": operation,
            "maxSteps": max_steps,
            "resultLimit": result_limit,
            "targetDecimals": target_decimals,
        },
        "settings": {
            "initialText": initial_text,
            "ratioText": ratio_text,
            "operation": operation,
            "d": d,
            "p": p,
            "step": main._format_fixed(search_step(d), d),
            "targetDecimals": resolved_target,
            "targetMode": "auto" if target_decimals is None else "custom",
            "maxSteps": max_steps,
            "resultLimit": result_limit,
            "threshold": main._format_percent(qualification_threshold(p), high),
            "displayPlaces": high,
        },
        "initial": eval_json(initial_eval, None, d, p, resolved_target),
        "down": direction_json(
            search.down,
            search.down_checked,
            search.down_hit_limit,
            search.down_stop,
            initial,
            d,
            p,
            resolved_target,
        ),
        "up": direction_json(
            search.up,
            search.up_checked,
            search.up_hit_limit,
            search.up_stop,
            initial,
            d,
            p,
            resolved_target,
        ),
    }


def evaluation_case(
    name: str,
    x_text: str,
    ratio_text: str,
    operation: int,
    d: int,
    target_decimals: int,
) -> dict:
    x = to_fraction(x_text)
    ratio = to_fraction(ratio_text)
    result = evaluate(x, ratio, operation, d, target_decimals)
    p = discrepancy_places(d)
    return {
        "name": name,
        "xText": x_text,
        "ratioText": ratio_text,
        "operation": operation,
        "d": d,
        "targetDecimals": target_decimals,
        "evaluation": eval_json(result, None, d, p, target_decimals),
    }


def random_initial(rng: random.Random, max_d: int) -> str:
    d = rng.randint(0, max_d)
    whole = str(rng.randint(1, 20))
    if d == 0:
        return whole
    fraction = "".join(str(rng.randint(0, 9)) for _ in range(d))
    return f"{whole}.{fraction}"


def random_ratio(rng: random.Random) -> str:
    d = rng.randint(0, 4)
    whole = str(rng.randint(1, 9))
    if d == 0:
        return whole
    fraction = "".join(str(rng.randint(0, 9)) for _ in range(d))
    return f"{whole}.{fraction}"


def build() -> dict:
    cases = [
        case("required-0165", "0.165", "3.1818", 1, max_steps=100),
        case("required-0176-initial", "0.176", "3.1818", 1, max_steps=100),
        case("d1-0.1", "0.1", "1", 1, max_steps=10),
        case("d2-0.10", "0.10", "1", 1, max_steps=10),
        case("d3-0.100", "0.100", "1", 1, max_steps=10),
        case("d0-integer", "1", "1", 1, max_steps=5),
        case("target-zero", "0.0001", "1", 1, max_steps=5, target_decimals=3),
        case("target-override", "0.1650", "3.1818", 1, max_steps=50, target_decimals=2),
        case("safety-limit", "0.500", "1", 1, max_steps=2),
        case("down-nonpositive", "0.001", "1", 1, max_steps=10),
        case("large-safe-integer", "9007199254740993", "3", 1, max_steps=5),
        case(
            "large-decimal",
            "12345678901234567890.12345",
            "3.1818",
            1,
            max_steps=10,
        ),
        case("divide-circular", "1.0", "3", 2, max_steps=10),
        case("limit-one", "0.500", "1", 1, max_steps=2, result_limit=1),
    ]

    rng = random.Random(SEED)
    for index in range(20):
        cases.append(
            case(
                f"random-{index:02d}",
                random_initial(rng, 4),
                random_ratio(rng),
                rng.choice([1, 2]),
                max_steps=rng.randint(5, 80),
                result_limit=rng.randint(1, 4),
                target_decimals=rng.choice([None, 0, 1, 2, 3, 4, 5]),
            )
        )

    evaluations = [
        evaluation_case("p2-below", "0.5000245", "1", 1, 3, 3),
        evaluation_case("p2-boundary", "0.500025", "1", 1, 3, 3),
        evaluation_case("p2-above", "0.5000251", "1", 1, 3, 3),
        evaluation_case("target-zero", "0.0001", "1", 1, 4, 3),
        evaluation_case("half-up-target", "0.1235", "1", 1, 4, 3),
    ]

    invalid = [
        "",
        "   ",
        "abc",
        "-1",
        "+1",
        "0",
        "0.000",
        "1e-3",
        "NaN",
        "Infinity",
        ".5",
        "1.",
        "1,5",
    ]

    thresholds = [
        {"p": p, "discrepancy": fjson(value), "qualified": is_qualified(value, p)}
        for p, value in [
            (0, Fraction(4, 10)),
            (0, Fraction(5, 10)),
            (2, Fraction(49, 10000)),
            (2, Fraction(50, 10000)),
            (2, Fraction(51, 10000)),
        ]
    ]

    return {
        "meta": {
            "generator": "scripts/generate_fixtures.py",
            "seed": SEED,
            "defaults": {
                "maxSteps": 1_000_000,
                "resultLimit": 3,
                "targetDecimals": None,
            },
        },
        "cases": cases,
        "evaluations": evaluations,
        "thresholds": thresholds,
        "invalid": invalid,
    }


def write_fixtures() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(build(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    write_fixtures()
