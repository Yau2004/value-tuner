"""Interactive value tuner. Run with: python main.py"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, localcontext
from fractions import Fraction

from tuner import (
    MAX_SEARCH_STEPS,
    RESULT_LIMIT,
    TARGET_DECIMALS,
    InputError,
    decimal_places,
    discrepancy_places,
    evaluate,
    parse_positive_decimal,
    qualification_threshold,
    search_directions,
    search_step,
    to_fraction,
)

HIGH_PRECISION_PLACES = 10
INITIAL_PROMPT = "initial value: "
RATIO_PROMPT = "ratio: "
OPERATION_PROMPT = "operation (1: multiply, 2: divide): "


def _decimal_at(value: Fraction, places: int) -> Decimal:
    """Quantize a rational with ROUND_HALF_UP; precision is display-only."""
    with localcontext() as context:
        context.prec = max(50, len(str(abs(value.numerator))) + places + 10)
        number = Decimal(value.numerator) / Decimal(value.denominator)
        unit = Decimal(1).scaleb(-places)
        return number.quantize(unit, rounding=ROUND_HALF_UP)


def _format_fixed(value: Fraction, places: int, trim: bool = False) -> str:
    text = f"{_decimal_at(value, places):.{places}f}"
    if trim and "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def _format_high_precision(value: Fraction, places: int) -> str:
    rounded = _decimal_at(value, places)
    text = f"{rounded:.{places}f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text if Fraction(rounded) == value else f"≈ {text}"


def _format_percent(value: Fraction, places: int) -> str:
    return _format_high_precision(value, places) + "%"


def _display_places(d: int) -> int:
    return max(HIGH_PRECISION_PLACES, d + 6)


def _read_decimal(prompt: str, label: str) -> str | None:
    while True:
        try:
            raw = input(prompt)
        except EOFError:
            print("\nInput closed; exiting.")
            return None
        except KeyboardInterrupt:
            print("\nCancelled.")
            return None
        try:
            _, text = parse_positive_decimal(raw, label)
            return text
        except InputError as exc:
            print(f"Error: {exc}")


def _read_operation() -> int | None:
    while True:
        try:
            raw = input(OPERATION_PROMPT)
        except EOFError:
            print("\nInput closed; exiting.")
            return None
        except KeyboardInterrupt:
            print("\nCancelled.")
            return None
        value = raw.strip()
        if value in ("1", "2"):
            return int(value)
        print("Error: operation must be 1 (multiply) or 2 (divide).")


def _print_candidate_section(
    title: str,
    candidates,
    result_limit: int,
    hit_limit: bool,
    initial: Fraction,
    d: int,
    p: int,
    target_decimals: int,
    high_places: int,
) -> None:
    print(f"\n=== {title} ===")
    if len(candidates) == result_limit:
        print(f"found: {len(candidates)} / {result_limit}")
    elif hit_limit:
        print(f"found: {len(candidates)} / {result_limit}（已達搜尋安全上限）")
    else:
        print(
            f"found: {len(candidates)} / {result_limit}"
            f"（目前搜尋範圍內不足 {result_limit} 個）"
        )

    for index, item in enumerate(candidates, start=1):
        delta = item.x - initial
        delta_text = _format_fixed(delta, d)
        if delta > 0:
            delta_text = "+" + delta_text
        print(
            f"[{index}] x={_format_fixed(item.x, d)}"
            f" | x-initial={delta_text}"
            f" | actual result={_format_high_precision(item.y, high_places)}"
            f" | target={_format_fixed(item.target, target_decimals, trim=True)}"
            f" | discrepancy={_format_percent(item.discrepancy, high_places)}"
            f" | rounded={_format_fixed(item.rounded_discrepancy, p)}%"
        )


def _print_report(
    initial_text: str,
    ratio_text: str,
    operation: int,
    d: int,
    target_decimals: int,
    initial_eval,
    result,
    max_steps: int,
    result_limit: int,
) -> None:
    high_places = _display_places(d)
    p = discrepancy_places(d)
    operation_text = "multiply (y = x * ratio)" if operation == 1 else "divide (y = x / ratio)"

    print("\n=== settings ===")
    print(f"initial: {initial_text}")
    print(f"ratio: {ratio_text}")
    print(f"operation: {operation_text}")
    print(f"initial decimals (d): {d}")
    print(f"step: {_format_fixed(search_step(d), d)}")
    print(f"target decimals: {target_decimals}")
    print(f"discrepancy decimals (p): {p}")
    print(
        "discrepancy threshold: < "
        f"{_format_percent(qualification_threshold(p), high_places)}"
    )
    print(
        f"search safety limit: {max_steps:,} steps per direction; "
        "下調 only searches x > 0"
    )

    print("\n=== initial ===")
    print(f"actual result: {_format_high_precision(initial_eval.y, high_places)}")
    print(f"target: {_format_fixed(initial_eval.target, target_decimals, trim=True)}")
    if initial_eval.discrepancy is None:
        print("discrepancy (high precision): n/a (target = 0)")
        print("discrepancy (rounded): n/a")
        print("qualified: no")
    else:
        print(
            "discrepancy (high precision): "
            f"{_format_percent(initial_eval.discrepancy, high_places)}"
        )
        print(
            f"discrepancy (rounded to {p} decimals): "
            f"{_format_fixed(initial_eval.rounded_discrepancy, p)}%"
        )
        print(f"qualified: {'yes' if initial_eval.qualified else 'no'}")

    _print_candidate_section(
        f"下調：最近的 {result_limit} 個合格候選",
        result.down,
        result_limit,
        result.down_hit_limit,
        initial_eval.x,
        d,
        p,
        target_decimals,
        high_places,
    )
    _print_candidate_section(
        f"上調：最近的 {result_limit} 個合格候選",
        result.up,
        result_limit,
        result.up_hit_limit,
        initial_eval.x,
        d,
        p,
        target_decimals,
        high_places,
    )


def main() -> int:
    try:
        initial_text = _read_decimal(INITIAL_PROMPT, "initial value")
        if initial_text is None:
            return 0
        ratio_text = _read_decimal(RATIO_PROMPT, "ratio")
        if ratio_text is None:
            return 0
        operation = _read_operation()
        if operation is None:
            return 0

        d = decimal_places(initial_text)
        target_decimals = d if TARGET_DECIMALS is None else TARGET_DECIMALS
        initial = to_fraction(initial_text)
        ratio = to_fraction(ratio_text)

        initial_eval = evaluate(initial, ratio, operation, d, target_decimals)
        result = search_directions(
            initial,
            ratio,
            operation,
            d,
            target_decimals,
            max_steps=MAX_SEARCH_STEPS,
            limit=RESULT_LIMIT,
        )
        _print_report(
            initial_text,
            ratio_text,
            operation,
            d,
            target_decimals,
            initial_eval,
            result,
            MAX_SEARCH_STEPS,
            RESULT_LIMIT,
        )
        return 0
    except KeyboardInterrupt:
        print("\nCancelled.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
