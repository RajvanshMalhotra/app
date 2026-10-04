import re

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

# parse_expr evaluates generated code. Give it only these names and no Python builtins,
# so input like `input()` or `open(0)` can never reach a real function.
ALLOWED = [
    "Integer", "Float", "Rational", "Symbol", "Function", "Add", "Mul", "Pow",
    "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "exp", "log", "sqrt", "Abs", "pi", "E", "I", "oo",
]
NAMESPACE = {name: getattr(sympy, name) for name in ALLOWED}
NAMESPACE["ln"] = sympy.log
NAMESPACE["__builtins__"] = {}


class CheckIn(BaseModel):
    expected: str
    given: str


def _bounded(expr) -> bool:
    """Reject numeric powers whose exponent is too large to evaluate cheaply (e.g. 10^10^10)."""
    for node in sympy.postorder_traversal(expr):
        if isinstance(node, Pow) and not node.exp.free_symbols:
            # Inner powers were already checked, so evaluating this exponent is cheap.
            if abs(complex(N(node.exp))) > MAX_EXPONENT:
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


@app.post("/check")
def check(body: CheckIn):
    try:
        e, g = parse(body.expected), parse(body.given)
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
