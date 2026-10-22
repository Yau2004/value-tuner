from fractions import Fraction

import pytest

from tuner import (
    InputError,
    apply_operation,
    decimal_places,
    discrepancy_percent,
    discrepancy_places,
    evaluate,
    is_qualified,
    parse_positive_decimal,
    qualification_threshold,
    round_half_up,
    search_directions,
    search_step,
    to_fraction,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("0.1", 1),
        ("0.10", 2),
        ("0.100", 3),
        ("0.01", 2),
        ("0.165", 3),
        ("0.1650", 4),
        ("1", 0),
        ("10.010", 3),
    ],
)
def test_decimal_places(text, expected):
    assert decimal_places(text) == expected


@pytest.mark.parametrize(
    ("d", "expected_step"),
    [
        (0, Fraction(1)),
        (1, Fraction(1, 10)),
        (2, Fraction(1, 100)),
        (3, Fraction(1, 1000)),
        (4, Fraction(1, 10000)),
    ],
)
def test_search_step_is_ten_to_minus_d(d, expected_step):
    assert search_step(d) == expected_step


def test_trailing_zeros_share_value_but_not_precision():
    assert to_fraction("0.1") == to_fraction("0.10") == to_fraction("0.100")
    assert search_step(decimal_places("0.1")) == Fraction(1, 10)
    assert search_step(decimal_places("0.10")) == Fraction(1, 100)
    assert search_step(decimal_places("0.100")) == Fraction(1, 1000)


@pytest.mark.parametrize(
    ("text", "d", "p"),
    [
        ("0.1", 1, 0),
        ("0.10", 2, 1),
        ("0.100", 3, 2),
        ("0.165", 3, 2),
        ("1", 0, 0),
    ],
)
def test_discrepancy_places_are_max_d_minus_one(text, d, p):
    assert decimal_places(text) == d
    assert discrepancy_places(d) == p


def test_multiply_and_divide_are_exact():
    x = Fraction(3, 2)
    ratio = Fraction(5, 4)
    assert apply_operation(x, ratio, 1) == Fraction(15, 8)
    assert apply_operation(x, ratio, 2) == Fraction(6, 5)


def test_invalid_operation_rejected():
    with pytest.raises(ValueError):
        apply_operation(Fraction(1), Fraction(2), 3)


def test_discrepancy_is_already_a_percentage():
    assert discrepancy_percent(Fraction(99, 100), Fraction(1)) == Fraction(1)
    assert discrepancy_percent(Fraction(524997, 1000000), Fraction(525, 1000)) == Fraction(1, 1750)


def test_half_up_boundary_at_p_two():
    below = Fraction(49, 10000)  # 0.0049%
    boundary = Fraction(50, 10000)  # 0.0050%

    assert round_half_up(below, 2) == 0
    assert round_half_up(boundary, 2) == Fraction(1, 100)
    assert is_qualified(below, 2) is True
    assert is_qualified(boundary, 2) is False


def test_exact_zero_discrepancy_qualifies():
    result = evaluate(Fraction(1), Fraction(1), 1, d=3, target_decimals=3)
    assert result.discrepancy == 0
    assert result.rounded_discrepancy == 0
    assert result.qualified is True


def test_original_example_0165_is_now_qualified():
    result = evaluate(
        Fraction(165, 1000),
        Fraction(31818, 10000),
        1,
        d=3,
        target_decimals=3,
    )
    assert result.y == Fraction(524997, 1000000)
    assert result.target == Fraction(525, 1000)
    assert result.discrepancy == Fraction(1, 1750)
    assert round_half_up(result.discrepancy, 2) == 0
    assert result.rounded_discrepancy == 0
    assert result.qualified is True


def test_original_example_0176_is_now_qualified():
    result = evaluate(
        Fraction(176, 1000),
        Fraction(31818, 10000),
        1,
        d=3,
        target_decimals=3,
    )
    assert result.y == Fraction(5599968, 10000000)
    assert result.target == Fraction(560, 1000)
    assert result.discrepancy == Fraction(1, 1750)
    assert round_half_up(result.discrepancy, 2) == 0
    assert result.rounded_discrepancy == 0
    assert result.qualified is True


def test_nonzero_discrepancy_can_still_qualify():
    result = evaluate(
        Fraction(525001, 1000000),
        Fraction(1),
        1,
        d=3,
        target_decimals=3,
    )
    assert result.target == Fraction(525, 1000)
    assert result.discrepancy == Fraction(1, 5250)
    assert result.discrepancy != 0
    assert result.rounded_discrepancy == 0
    assert result.qualified is True


def test_search_returns_three_nearest_per_direction():
    initial = Fraction(1, 2)
    result = search_directions(
        initial=initial,
        ratio=Fraction(1),
        operation=1,
        d=3,
        target_decimals=3,
        max_steps=3,
        limit=3,
    )

    assert [item.x for item in result.down] == [
        Fraction(499, 1000),
        Fraction(498, 1000),
        Fraction(497, 1000),
    ]
    assert [item.x for item in result.up] == [
        Fraction(501, 1000),
        Fraction(502, 1000),
        Fraction(503, 1000),
    ]
    assert result.down_hit_limit is False
    assert result.up_hit_limit is False
    assert result.down_checked == 3
    assert result.up_checked == 3
    assert result.down_stop == "limit"
    assert result.up_stop == "limit"
    assert all(item.x < initial for item in result.down)
    assert all(item.x > initial for item in result.up)
    assert all(item.x != initial for item in result.down + result.up)
    assert [initial - item.x for item in result.down] == [
        Fraction(1, 1000),
        Fraction(2, 1000),
        Fraction(3, 1000),
    ]
    assert [item.x - initial for item in result.up] == [
        Fraction(1, 1000),
        Fraction(2, 1000),
        Fraction(3, 1000),
    ]

    step = search_step(3)
    for item in result.down + result.up:
        assert ((item.x - initial) / step).denominator == 1
        assert item.x > 0


def test_safety_limit_reports_when_fewer_than_three():
    result = search_directions(
        initial=Fraction(1, 2),
        ratio=Fraction(1),
        operation=1,
        d=3,
        target_decimals=3,
        max_steps=2,
        limit=3,
    )

    assert [item.x for item in result.down] == [Fraction(499, 1000), Fraction(498, 1000)]
    assert [item.x for item in result.up] == [Fraction(501, 1000), Fraction(502, 1000)]
    assert result.down_hit_limit is True
    assert result.up_hit_limit is True
    assert result.down_checked == 2
    assert result.up_checked == 2
    assert result.down_stop == "safety"
    assert result.up_stop == "safety"


def test_down_stops_at_nonpositive_without_hit_limit():
    result = search_directions(
        initial=Fraction(1, 1000),
        ratio=Fraction(1),
        operation=1,
        d=3,
        target_decimals=3,
        max_steps=10,
        limit=3,
    )

    assert result.down == []
    assert result.down_hit_limit is False
    assert result.down_checked == 0
    assert result.down_stop == "nonpositive"
    assert [item.x for item in result.up] == [
        Fraction(2, 1000),
        Fraction(3, 1000),
        Fraction(4, 1000),
    ]
    assert result.up_hit_limit is False
    assert result.up_checked == 3
    assert result.up_stop == "limit"


def test_discrepancy_precision_depends_on_p():
    assert discrepancy_places(0) == 0
    assert discrepancy_places(1) == 0
    assert discrepancy_places(2) == 1
    assert discrepancy_places(3) == 2
    assert qualification_threshold(0) == Fraction(1, 2)
    assert qualification_threshold(1) == Fraction(1, 20)
    assert qualification_threshold(2) == Fraction(1, 200)
    assert is_qualified(Fraction(4, 10), 0) is True
    assert is_qualified(Fraction(5, 10), 0) is False
    assert is_qualified(Fraction(49, 10000), 2) is True
    assert is_qualified(Fraction(50, 10000), 2) is False


def test_target_precision_is_independent_of_search_step():
    y = Fraction(1234, 10000)
    assert evaluate(y, Fraction(1), 1, d=3, target_decimals=1).target == Fraction(1, 10)
    assert evaluate(y, Fraction(1), 1, d=3, target_decimals=2).target == Fraction(12, 100)
    assert evaluate(y, Fraction(1), 1, d=3, target_decimals=3).target == Fraction(123, 1000)


def test_d0_uses_integer_step_and_stops_at_nonpositive():
    result = search_directions(
        initial=Fraction(2),
        ratio=Fraction(1),
        operation=1,
        d=0,
        target_decimals=0,
        max_steps=3,
        limit=3,
    )

    assert [item.x for item in result.down] == [Fraction(1)]
    assert [item.x for item in result.up] == [Fraction(3), Fraction(4), Fraction(5)]
    assert all(item.x.denominator == 1 for item in result.down + result.up)
    assert result.down_hit_limit is False
    assert result.up_hit_limit is False


def test_search_does_not_pad_missing_direction():
    result = search_directions(
        initial=Fraction(1, 1000),
        ratio=Fraction(1),
        operation=1,
        d=3,
        target_decimals=3,
        max_steps=1,
        limit=3,
    )

    assert result.down == []
    assert result.down_hit_limit is False
    assert len(result.up) == 1
    assert result.up[0].x == Fraction(2, 1000)
    assert result.up[0].qualified is True
    assert result.up_hit_limit is True
    assert all(item.qualified for item in result.up)


def test_target_zero_is_skipped():
    result = evaluate(
        Fraction(1, 10000),
        Fraction(1),
        1,
        d=4,
        target_decimals=3,
    )
    assert result.target == 0
    assert result.discrepancy is None
    assert result.rounded_discrepancy is None
    assert result.qualified is False

    search = search_directions(
        initial=Fraction(1, 10000),
        ratio=Fraction(1),
        operation=1,
        d=4,
        target_decimals=3,
        max_steps=1,
    )
    assert search.down == []
    assert search.up == []
    assert search.down_hit_limit is False
    assert search.up_hit_limit is True


def test_input_validation_accepts_plain_positive_decimal():
    value, text = parse_positive_decimal("  0.1650  ", "initial value")
    assert value == Fraction(1650, 10000)
    assert text == "0.1650"
    assert decimal_places(text) == 4


@pytest.mark.parametrize(
    "text",
    [
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
    ],
)
def test_input_validation_rejects_invalid_values(text):
    with pytest.raises(InputError):
        parse_positive_decimal(text, "initial value")
