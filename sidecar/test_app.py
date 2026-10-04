import pytest
from fastapi.testclient import TestClient
from app import app

c = TestClient(app)


def check(e, g):
    return c.post("/check", json={"expected": e, "given": g}).json()


@pytest.mark.parametrize("e,g", [
    ("2*x", "2x"), ("2*x", "x*2"), ("1/2", "0.5"), ("x^2 + 1", " x**2+1 "),
    ("sin(x)^2 + cos(x)^2", "1"), ("pi", "3.14159265358979"),
])
def test_equivalent(e, g):
    assert check(e, g)["correct"] is True


def test_different():
    assert check("2*x", "3x") == {"correct": False, "reason": "different"}


@pytest.mark.parametrize("g", ["2x+", "", "import os", "__import__('os')", "x" * 2000])
def test_malformed_is_incorrect_not_error(g):
    r = c.post("/check", json={"expected": "2*x", "given": g})
    assert r.status_code == 200
    assert r.json()["correct"] is False


def test_health():
    assert c.get("/health").json() == {"ok": True}


def _post_with_deadline(given, seconds=3.0):
    import threading
    out = {}
    t = threading.Thread(target=lambda: out.setdefault("r", c.post("/check", json={"expected": "2", "given": given})), daemon=True)
    t.start()
    t.join(seconds)
    assert not t.is_alive(), f"check({given!r}) did not finish within {seconds}s"
    return out["r"]


@pytest.mark.parametrize("g", ["10^10^10", "2^(2^1000)", "(x+1)^100000", "(((9^99)^99)^99)^99", "exp(exp(exp(100)))"])
def test_huge_powers_are_rejected_quickly(g):
    r = _post_with_deadline(g)
    assert r.status_code == 200
    assert r.json()["correct"] is False


@pytest.mark.parametrize("g", ["input()", "open(0)", "print(1)", "exec(x)", "eval(x)"])
def test_python_builtins_are_not_callable(g, monkeypatch):
    import builtins
    called = []
    for name in ("input", "open", "print"):  # not eval/exec: sympy itself uses them
        monkeypatch.setattr(builtins, name, lambda *a, _n=name, **k: called.append(_n))
    # Checks run in a child process; call the comparison in-process so the patched builtins are visible.
    from app import _compare
    assert _compare("2*x", g)["correct"] is False
    assert called == []


@pytest.mark.parametrize("e,g", [("2*exp(2*x)", "2e^(2x)"), ("exp(1)", "e"), ("log(x)", "ln(x)")])
def test_common_notation(e, g):
    assert check(e, g)["correct"] is True


@pytest.mark.parametrize("g", ["(x+y+z+1)^100 - (x+y+z+1)^99", "(x+1)^100*(y+1)^100*(z+1)^100"])
def test_slow_symbolic_input_times_out(g):
    r = _post_with_deadline(g, seconds=6.0)
    assert r.json() == {"correct": False, "reason": "timeout"}


def test_correct_answers_still_fast_after_timeout_machinery():
    import time
    t = time.time()
    assert check("3*x^2 + 2", "2 + 3x^2")["correct"] is True
    assert time.time() - t < 2.0
