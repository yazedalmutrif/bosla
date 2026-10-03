// Smoke test against a running Worker (default http://127.0.0.1:8787), e.g. `npm run serve:mock`.
// Uses Cloudflare's Turnstile test dummy token. Prints the event stream summary for both tools.
const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const cid = crypto.randomUUID();
const { SAMPLE_CV_EN, SAMPLE_POSTING_EN } = await import("../shared/samples.ts").catch(() => ({}));

async function run(path, body) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { status: res.status, body: await res.text() };
  const text = await res.text();
  const events = text.trim().split("\n").map((l) => JSON.parse(l));
  const result = events.find((e) => e.type === "result");
  return {
    status: res.status,
    ms: Date.now() - t0,
    remaining: res.headers.get("x-runs-remaining"),
    steps: events.filter((e) => e.type === "progress").map((e) => `${e.step}:${e.status}`).join(" "),
    error: events.find((e) => e.type === "error")?.code ?? null,
    report: result ? { ...result.data.report, items: result.data.report.items.length } : null,
    needs: result?.data.draft.needsInput?.length,
    companies: result?.data.companies?.length,
  };
}

const cv = SAMPLE_CV_EN ?? "x".repeat(400);
const posting = SAMPLE_POSTING_EN ?? "y".repeat(400);
console.log("tailor", await run("/api/tailor", { cvText: cv, postingText: posting, outputLang: "auto", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", clientId: cid }));
console.log("map", await run("/api/map", { cvText: cv, city: "both", outputLang: "ar", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", clientId: cid }));
console.log("bad input", await run("/api/map", { cvText: "short", city: "both", outputLang: "ar", turnstileToken: "x", clientId: cid }));
console.log("extra field", await run("/api/map", { cvText: cv, city: "both", outputLang: "ar", turnstileToken: "x", clientId: cid, admin: true }));
const q = await fetch(`${BASE}/api/quota?cid=${cid}`).then((r) => r.json());
console.log("quota", q);
