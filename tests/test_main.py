import pytest

import main as app


def run_app(monkeypatch, capsys, lines, max_steps=0):
    prompts = []
    answers = iter(lines)

    def fake_input(prompt):
        prompts.append(prompt)
        try:
            return next(answers)
        except StopIteration:
            raise EOFError

    monkeypatch.setattr("builtins.input", fake_input)
    monkeypatch.setattr(app, "MAX_SEARCH_STEPS", max_steps)
    code = app.main()
    return code, capsys.readouterr().out, prompts


def test_input_order_and_original_example(monkeypatch, capsys):
    code, out, prompts = run_app(
        monkeypatch,
        capsys,
        ["0.165", "3.1818", "1"],
        max_steps=100,
    )

    assert code == 0
    assert prompts == [
        "initial value: ",
        "ratio: ",
        "operation (1: multiply, 2: divide): ",
    ]
    assert "initial: 0.165" in out
    assert "operation: multiply (y = x * ratio)" in out
    assert "initial decimals (d): 3" in out
    assert "step: 0.001" in out
    assert "target decimals: 3" in out
    assert "discrepancy decimals (p): 2" in out
    assert "discrepancy threshold: < 0.005%" in out
    assert "actual result: 0.524997" in out
    assert "target: 0.525" in out
    assert "discrepancy (high precision): ≈ 0.0005714286%" in out
    assert "discrepancy (rounded to 2 decimals): 0.00%" in out
    assert "qualified: yes" in out
    assert "=== 下調：最近的 3 個合格候選 ===" in out
    assert "=== 上調：最近的 3 個合格候選 ===" in out
    assert out.count("found: 3 / 3") == 2
    assert "x=0.154 | x-initial=-0.011" in out
    assert "x=0.176 | x-initial=+0.011" in out


def test_initial_text_and_trailing_zeros_are_preserved(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.1650", "1.00", "1"],
        max_steps=0,
    )

    assert code == 0
    assert "initial: 0.1650" in out
    assert "ratio: 1.00" in out
    assert "initial decimals (d): 4" in out
    assert "step: 0.0001" in out


@pytest.mark.parametrize(
    ("text", "d", "p", "step", "threshold", "row"),
    [
        ("0.1", 1, 0, "0.1", "0.5%", "x=0.2 | x-initial=+0.1"),
        ("0.10", 2, 1, "0.01", "0.05%", "x=0.09 | x-initial=-0.01"),
        ("0.100", 3, 2, "0.001", "0.005%", "x=0.099 | x-initial=-0.001"),
        ("0.01", 2, 1, "0.01", "0.05%", "x=0.02 | x-initial=+0.01"),
        ("0.165", 3, 2, "0.001", "0.005%", "x=0.164 | x-initial=-0.001"),
        ("0.1650", 4, 3, "0.0001", "0.0005%", "x=0.1649 | x-initial=-0.0001"),
        ("1", 0, 0, "1", "0.5%", "x=2 | x-initial=+1"),
    ],
)
def test_input_precision_controls_step_display_and_limit(
    monkeypatch, capsys, text, d, p, step, threshold, row
):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        [text, "1", "1"],
        max_steps=10,
    )

    assert code == 0
    assert f"initial decimals (d): {d}" in out
    assert f"discrepancy decimals (p): {p}" in out
    assert f"step: {step}" in out
    assert f"target decimals: {d}" in out
    assert "search safety limit: 10 steps per direction" in out
    assert f"discrepancy threshold: < {threshold}" in out
    assert row in out


def test_candidate_x_keeps_d_decimal_places_but_target_stays_trimmed(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["2.691", "1", "1"],
        max_steps=3,
    )

    assert code == 0
    assert "x=2.690 | x-initial=-0.001" in out
    assert "target=2.69" in out
    assert "target=2.690" not in out


def test_target_trailing_zeros_are_trimmed_without_changing_value(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.176", "3.1818", "1"],
        max_steps=0,
    )

    assert code == 0
    assert "\ntarget: 0.56\n" in out
    assert "\ntarget: 0.560\n" not in out
    assert "discrepancy (rounded to 2 decimals): 0.00%" in out
    assert "qualified: yes" in out


def test_output_lists_three_nearest_candidates_per_direction(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.500", "1", "1"],
        max_steps=3,
    )

    assert code == 0
    assert out.count("found: 3 / 3") == 2
    down_header = out.index("=== 下調：最近的 3 個合格候選 ===")
    up_header = out.index("=== 上調：最近的 3 個合格候選 ===")
    assert down_header < up_header
    assert "x=0.499 | x-initial=-0.001" in out
    assert "x=0.498 | x-initial=-0.002" in out
    assert "x=0.497 | x-initial=-0.003" in out
    assert "x=0.501 | x-initial=+0.001" in out
    assert "x=0.502 | x-initial=+0.002" in out
    assert "x=0.503 | x-initial=+0.003" in out
    assert "x=0.500" not in out


def test_safety_limit_is_shown_for_both_directions(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.500", "1", "1"],
        max_steps=2,
    )

    assert code == 0
    assert out.count("found: 2 / 3（已達搜尋安全上限）") == 2
    assert "x=0.499 | x-initial=-0.001" in out
    assert "x=0.498 | x-initial=-0.002" in out
    assert "x=0.501 | x-initial=+0.001" in out
    assert "x=0.502 | x-initial=+0.002" in out
    assert "x=0.497" not in out
    assert "x=0.503" not in out


def test_down_stops_at_zero_without_padding(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.001", "1", "1"],
        max_steps=10,
    )

    assert code == 0
    assert out.count("found: 0 / 3（目前搜尋範圍內不足 3 個）") == 1
    assert out.count("found: 3 / 3") == 1
    assert "x=0.002 | x-initial=+0.001" in out
    assert "x=0.000" not in out


def test_no_candidates_does_not_change_step_or_threshold(monkeypatch, capsys):
    code, out, _ = run_app(
        monkeypatch,
        capsys,
        ["0.100", "1000", "2"],
        max_steps=3,
    )

    assert code == 0
    assert "step: 0.001" in out
    assert "discrepancy decimals (p): 2" in out
    assert "discrepancy threshold: < 0.005%" in out
    assert out.count("found: 0 / 3（已達搜尋安全上限）") == 2
    assert "[1]" not in out


def test_invalid_input_reasks_only_the_current_item(monkeypatch, capsys):
    code, out, prompts = run_app(
        monkeypatch,
        capsys,
        ["abc", "0.165", "oops", "3.1818", "0", "3", "1.0", "2"],
        max_steps=0,
    )

    assert code == 0
    assert prompts == [
        "initial value: ",
        "initial value: ",
        "ratio: ",
        "ratio: ",
        "operation (1: multiply, 2: divide): ",
        "operation (1: multiply, 2: divide): ",
        "operation (1: multiply, 2: divide): ",
        "operation (1: multiply, 2: divide): ",
    ]
    assert "Error: initial value must be a positive decimal number" in out
    assert "Error: ratio must be a positive decimal number" in out
    assert "Error: operation must be 1 (multiply) or 2 (divide)." in out
    assert "operation: divide (y = x / ratio)" in out


def test_eof_exits_without_traceback(monkeypatch, capsys):
    prompts = []

    def eof_input(prompt):
        prompts.append(prompt)
        raise EOFError

    monkeypatch.setattr("builtins.input", eof_input)
    code = app.main()
    out = capsys.readouterr().out

    assert code == 0
    assert prompts == ["initial value: "]
    assert "Input closed; exiting." in out
    assert "Traceback" not in out


def test_keyboard_interrupt_exits_without_traceback(monkeypatch, capsys):
    prompts = []

    def interrupted_input(prompt):
        prompts.append(prompt)
        raise KeyboardInterrupt

    monkeypatch.setattr("builtins.input", interrupted_input)
    code = app.main()
    out = capsys.readouterr().out

    assert code == 0
    assert prompts == ["initial value: "]
    assert "Cancelled." in out
    assert "Traceback" not in out
