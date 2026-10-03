import { describe, expect, it } from "vitest";
import { ipBucket, readCapped } from "../../worker/net";
import { isTestSecret, verifyTurnstile } from "../../worker/turnstile";
import { MapRequestSchema, TailorRequestSchema, sanitize } from "../../worker/validate";
import { SAMPLE_CV_EN, SAMPLE_POSTING_EN } from "../../shared/samples";

describe("ipBucket (per-IP limit key)", () => {
  it("keeps IPv4 as is", () => expect(ipBucket("203.0.113.7")).toBe("203.0.113.7"));
  it("groups IPv6 addresses by /64, so rotating within a home network doesn't help", () => {
    expect(ipBucket("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:0db8:abcd:0012:ffff::1")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
  it("falls back when there's no IP", () => expect(ipBucket(null)).toBe("local"));
});

describe("readCapped (request body cap)", () => {
  const req = (body: string) => new Request("https://x.test/api/map", { method: "POST", body });
  it("returns the body when it is small enough", async () => expect(await readCapped(req("hello"), 10)).toBe("hello"));
  it("stops at the cap instead of buffering everything", async () => expect(await readCapped(req("x".repeat(200_000)), 120_000)).toBeNull());
});

describe("request validation", () => {
  const base = { cvText: SAMPLE_CV_EN, turnstileToken: "t", clientId: "3f1c2b9e-5a7d-4c1e-8f2a-9b3c4d5e6f70" };
  it("accepts a valid tailor request", () => {
    expect(TailorRequestSchema.safeParse({ ...base, postingText: SAMPLE_POSTING_EN, outputLang: "auto" }).success).toBe(true);
  });
  it("rejects unknown fields, bad enums, bad client ids and oversized text", () => {
    expect(MapRequestSchema.safeParse({ ...base, city: "both", outputLang: "ar", model: "x" }).success).toBe(false);
    expect(MapRequestSchema.safeParse({ ...base, city: "dammam", outputLang: "ar" }).success).toBe(false);
    expect(MapRequestSchema.safeParse({ ...base, clientId: "not-a-uuid", city: "both", outputLang: "ar" }).success).toBe(false);
    expect(MapRequestSchema.safeParse({ ...base, cvText: "x".repeat(20_001), city: "both", outputLang: "ar" }).success).toBe(false);
  });
  it("rejects a CV that is only whitespace or control characters", () => {
    expect(MapRequestSchema.safeParse({ ...base, cvText: "\u0000\u0001 ".repeat(300), city: "both", outputLang: "ar" }).success).toBe(false);
  });
  it("sanitize strips control characters but keeps Arabic and newlines", () => {
    expect(sanitize("سطر\u0000 أول\r\nline\u0007 two")).toBe("سطر أول\nline two");
  });
});

describe("Turnstile verification", () => {
  const ok = (body: object) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  it("recognises Cloudflare's public test secrets only", () => {
    expect(isTestSecret("1x0000000000000000000000000000000AA")).toBe(true);
    expect(isTestSecret("0x4AAAAAAAreal-looking-secret")).toBe(false);
  });
  it("fails closed without a secret or token", async () => {
    expect((await verifyTurnstile(undefined, "t", null, null)).ok).toBe(false);
    expect((await verifyTurnstile("s", "", null, null)).ok).toBe(false);
  });
  it("rejects a token issued for another hostname", async () => {
    expect((await verifyTurnstile("0x4real", "t", null, "bosla.example", ok({ success: true, hostname: "evil.example" }))).ok).toBe(false);
    expect((await verifyTurnstile("0x4real", "t", null, "bosla.example", ok({ success: true, hostname: "bosla.example" }))).ok).toBe(true);
  });
  it("rejects spent or invalid tokens and network failures", async () => {
    expect((await verifyTurnstile("0x4real", "t", null, null, ok({ success: false, "error-codes": ["timeout-or-duplicate"] }))).ok).toBe(false);
    const down = (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect((await verifyTurnstile("0x4real", "t", null, null, down)).ok).toBe(false);
  });
});
