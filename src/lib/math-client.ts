export async function checkMath(expected: string, given: string): Promise<{ correct: boolean; reason: string }> {
  const r = await fetch(`${process.env.MATH_URL}/check`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ expected, given }), signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`math sidecar ${r.status}`);
  return r.json();
}
