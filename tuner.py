"""Core math for the value tuner. No interactive I/O lives here."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction

# First-version defaults. Change them here, not through CLI arguments.
# Safety cap only, not a business search range.
MAX_SEARCH_STEPS = 1_000_000
RESULT_LIMIT = 3
TARGET_DECIMALS: int | None = None

_DECIMAL_RE = re.compile(r"[0-9]+(?:\.[0-9]+)?")


class InputError(ValueError):
    """An interactive input value is not acceptable."""


def parse_positive_decimal(text: str, label: str) -> tuple[Decimal, str]:
    """Validate a plain positive decimal and return it with its stripped text."""
    stripped = text.strip()
    if not _DECIMAL_RE.fullmatch(stripped):
        raise InputError(
            f"{label} must be a positive decimal number "
            "(no signs, scientific notation, NaN, or Infinity)."
        )
    value = Decimal(stripped)
    if value <= 0:
        raise InputError(f"{label} must be greater than 0.")
    return value, stripped


def decimal_places(text: str) -> int:
    """Number of digits after the point, including significant trailing zeros."""
    return len(text.split(".", 1)[1]) if "." in text else 0


def search_step(d: int) -> Fraction:
    return Fraction(1, 10**d)


def to_fraction(text: str) -> Fraction:
    """Exact rational value of an already validated decimal string."""
    return Fraction(Decimal(text))


def apply_operation(x: Fraction, ratio: Fraction, operation: int) -> Fraction:
    if operation == 1:
        return x * ratio
    if operation == 2:
        return x / ratio
    raise ValueError("operation must be 1 (multiply) or 2 (divide)")


def round_half_up(value: Fraction, places: int) -> Fraction:
    """Round an exact rational to `places` decimals with ROUND_HALF_UP."""
    scale = 10**places
    scaled = value * scale
    sign = -1 if scaled < 0 else 1
    numerator = abs(scaled.numerator)
    whole, remainder = divmod(numerator, scaled.denominator)
    if 2 * remainder >= scaled.denominator:
        whole += 1
    return Fraction(sign * whole, scale)


def discrepancy_percent(y: Fraction, target: Fraction) -> Fraction:
    """abs(y - target) / abs(target) * 100, already a percentage."""
    if target == 0:
        raise ZeroDivisionError("target is zero")
    return abs(y - target) / abs(target) * 100


def discrepancy_places(d: int) -> int:
    return max(d - 1, 0)


def qualification_threshold(p: int) -> Fraction:
    """Strict boundary: discrepancy must be below this percentage."""
    return Fraction(1, 2) * Fraction(1, 10**p)


def is_qualified(discrepancy: Fraction, p: int) -> bool:
    return discrepancy < qualification_threshold(p)


@dataclass(frozen=True)
class Evaluation:
    x: Fraction
    y: Fraction
    target: Fraction
    discrepancy: Fraction | None
    rounded_discrepancy: Fraction | None
    qualified: bool


def evaluate(
    x: Fraction,
    ratio: Fraction,
    operation: int,
    d: int,
    target_decimals: int,
) -> Evaluation:
    y = apply_operation(x, ratio, operation)
    target = round_half_up(y, target_decimals)
    if target == 0:
        return Evaluation(x, y, target, None, None, False)
    discrepancy = discrepancy_percent(y, target)
    p = discrepancy_places(d)
    return Evaluation(
        x=x,
        y=y,
        target=target,
        discrepancy=discrepancy,
        rounded_discrepancy=round_half_up(discrepancy, p),
        qualified=is_qualified(discrepancy, p),
    )


@dataclass(frozen=True)
class SearchResult:
    down: list[Evaluation]
    up: list[Evaluation]
    down_hit_limit: bool
    up_hit_limit: bool
    down_checked: int
    up_checked: int
    down_stop: str
    up_stop: str


def _search_direction(
    initial: Fraction,
    ratio: Fraction,
    operation: int,
    d: int,
    target_decimals: int,
    max_steps: int,
    limit: int,
    sign: int,
) -> tuple[list[Evaluation], bool, int, str]:
    if limit <= 0:
        return [], False, 0, "limit"

    step = search_step(d)
    found: list[Evaluation] = []
    checked = 0
    for n in range(1, max_steps + 1):
        x = initial + sign * n * step
        if x <= 0:
            return found, False, checked, "nonpositive"
        checked += 1
        result = evaluate(x, ratio, operation, d, target_decimals)
        if result.qualified:
            found.append(result)
            if len(found) == limit:
                return found, False, checked, "limit"
    # Scanned outward from initial, so this list is already nearest-first.
    return found, len(found) < limit, checked, "safety"


def search_directions(
    initial: Fraction,
    ratio: Fraction,
    operation: int,
    d: int,
    target_decimals: int,
    max_steps: int = MAX_SEARCH_STEPS,
    limit: int = RESULT_LIMIT,
) -> SearchResult:
    down, down_hit_limit, down_checked, down_stop = _search_direction(
        initial,
        ratio,
        operation,
        d,
        target_decimals,
        max_steps,
        limit,
        -1,
    )
    up, up_hit_limit, up_checked, up_stop = _search_direction(
        initial,
        ratio,
        operation,
        d,
        target_decimals,
        max_steps,
        limit,
        1,
    )
    return SearchResult(
        down,
        up,
        down_hit_limit,
        up_hit_limit,
        down_checked,
        up_checked,
        down_stop,
        up_stop,
    )
