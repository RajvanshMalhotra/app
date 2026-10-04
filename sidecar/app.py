import math
import multiprocessing as mp
import os
import re
import threading

import sympy
from fastapi import FastAPI
from pydantic import BaseModel
from sympy import N, Pow, simplify
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

app = FastAPI()
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
SAFE = re.compile(r"^[0-9a-zA-Z\s\.\+\-\*/\^\(\),=]*$")
MAX_LEN = 500
MAX_EXPONENT = 100
MAX_DIGITS = 1000
CHECK_TIMEOUT_S = 3.0
CHECK_MEMORY_BYTES = 512 * 1024 * 1024
# Each check runs in a forked child that is killed at the deadline, because SymPy can
# take unbounded time on some inputs. Cap how many run at once so a burst of slow
# answers can't fork-bomb the host.
_slots = threading.BoundedSemaphore(max(2, os.cpu_count() or 2))
# A forkserver forks from a clean single-threaded process with SymPy preloaded, which
# avoids forking this multi-threaded server directly.
_ctx = mp.get_context("forkserver")
_ctx.set_forkserver_preload(["sympy", "app"])

# parse_expr evaluates generated code. Give it only these names and no Python builtins,
# so input like `input()` or `open(0)` can never reach a real function.
ALLOWED = [
    "Integer", "Float", "Rational", "Symbol", "Function", "Add", "Mul", "Pow",
    "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "exp", "log", "sqrt", "Abs", "pi", "E", "I", "oo",
]
NAMESPACE = {name: getattr(sympy, name) for name in ALLOWED}
NAMESPACE["ln"] = sympy.log
NAMESPACE["e"] = sympy.E  # students write e^x for exp(x)
NAMESPACE["__builtins__"] = {}


class CheckIn(BaseModel):
    expected: str
    given: str


def _bounded(expr) -> bool:
    """Reject numbers too large to evaluate cheaply (e.g. 10^10^10 or (((9^99)^99)^99)^99).

    Walks bottom-up, so every inner power is already known to be small when an outer
    one is measured: each exponent must be at most MAX_EXPONENT, and each numeric
    power must stay below 10^MAX_DIGITS.
    """
    for node in sympy.postorder_traversal(expr):
        if isinstance(node, Pow) and not node.exp.free_symbols:
            e = abs(complex(N(node.exp)))
            if e > MAX_EXPONENT:
                return False
            if not node.base.free_symbols:
                b = abs(complex(N(node.base)))
                if b > 1 and e * math.log10(b) > MAX_DIGITS:
                    return False
        elif isinstance(node, sympy.Function) and not node.free_symbols:
            # exp(exp(exp(100))) and friends: keep numeric function arguments modest.
            if any(abs(complex(N(a))) > MAX_DIGITS for a in node.args):
                return False
    return True


def parse(s: str):
    s = s.strip()
    if not s or len(s) > MAX_LEN or not SAFE.match(s) or "__" in s:
        raise ValueError("unsafe or empty")
    raw = parse_expr(s, local_dict={}, global_dict=dict(NAMESPACE), transformations=TRANSFORMS, evaluate=False)
    if not isinstance(raw, sympy.Basic) or not _bounded(raw):
        raise ValueError("unsupported or too large")
    return raw.doit()


@app.get("/health")
def health():
    return {"ok": True}


def _compare(expected: str, given: str) -> dict:
    try:
        e, g = parse(expected), parse(given)
    except Exception:
        return {"correct": False, "reason": "parse_error"}
    try:
        if simplify(e - g) == 0:
            return {"correct": True, "reason": "equivalent"}
        if not e.free_symbols and not g.free_symbols:
            ev, gv = complex(N(e)), complex(N(g))
            if abs(ev - gv) <= 1e-6 * max(1.0, abs(ev)):
                return {"correct": True, "reason": "numeric"}
    except Exception:
        return {"correct": False, "reason": "parse_error"}
    return {"correct": False, "reason": "different"}


def _child(conn, expected: str, given: str) -> None:
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (CHECK_MEMORY_BYTES, CHECK_MEMORY_BYTES))
    except Exception:
        pass  # RLIMIT_AS is not supported on macOS; the time limit still applies.
    try:
        conn.send(_compare(expected, given))
    except BaseException:
        conn.send({"correct": False, "reason": "parse_error"})
    finally:
        conn.close()


def _compare_with_deadline(expected: str, given: str) -> dict:
    with _slots:
        parent, child = _ctx.Pipe(duplex=False)
        proc = _ctx.Process(target=_child, args=(child, expected, given), daemon=True)
        proc.start()
        child.close()
        try:
            if parent.poll(CHECK_TIMEOUT_S):
                return parent.recv()
            return {"correct": False, "reason": "timeout"}
        except EOFError:  # child died, e.g. hit the memory limit
            return {"correct": False, "reason": "timeout"}
        finally:
            if proc.is_alive():
                proc.kill()
            proc.join()
            parent.close()


@app.post("/check")
def check(body: CheckIn):
    return _compare_with_deadline(body.expected, body.given)
