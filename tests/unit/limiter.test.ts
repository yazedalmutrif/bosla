import { describe, expect, it } from "vitest";
import { MemoryStore, previousDay, quota, reserve, settle, type Keys, type LimitConfig } from "../../worker/limiter-core";
import { nextRiyadhMidnight, riyadhDay } from "../../worker/hash";

const cfg: LimitConfig = { perVisitor: 3, perIp: 5, budgetMicroUsd: 1_000_000 }; // $1/day
const k = (visitor: string, ip = "ip1", day = "2026-09-27"): Keys => ({ day, visitor, ip });
const EST = 100_000; // $0.10 reserved per run

describe("per-visitor daily limit", () => {
  it("allows exactly N runs, then refuses", () => {
    const s = new MemoryStore();
    const results = Array.from({ length: 4 }, () => reserve(s, k("v1"), cfg, 1));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]).toMatchObject({ ok: false, reason: "visitor", remaining: 0 });
    expect(quota(s, k("v1"), cfg)).toEqual({ used: 3, remaining: 0 });
  });

  it("resets on a new day", () => {
    const s = new MemoryStore();
    for (let i = 0; i < 3; i++) reserve(s, k("v1"), cfg, 1);
    expect(reserve(s, k("v1", "ip1", "2026-09-28"), cfg, 1).ok).toBe(true);
  });

  it("purges counters older than yesterday", () => {
    const s = new MemoryStore();
    reserve(s, k("v1", "ip1", "2026-09-20"), cfg, 1);
    reserve(s, k("v1", "ip1", "2026-09-27"), cfg, 1);
    expect([...s.counts.keys()].some((x) => x.startsWith("2026-09-20"))).toBe(false);
  });
});

describe("per-IP limit (stops rotating browser IDs)", () => {
  it("refuses a new browser ID once the IP has used its runs", () => {
    const s = new MemoryStore();
    const ids = ["a", "b", "c", "d", "e", "f"];
    const oks = ids.map((id) => reserve(s, k(id), { ...cfg, perVisitor: 3 }, 1));
    expect(oks.map((r) => r.ok)).toEqual([true, true, true, true, true, false]);
    expect(oks[5]).toMatchObject({ reason: "ip" });
  });
});

describe("daily spend cap (kill switch)", () => {
  it("counts in-flight reservations, so parallel runs can't overshoot", () => {
    const s = new MemoryStore();
    const many = { ...cfg, perVisitor: 100, perIp: 100 };
    const r = Array.from({ length: 12 }, (_, i) => reserve(s, k(`v${i}`), many, EST));
    expect(r.filter((x) => x.ok)).toHaveLength(10); // 10 x $0.10 = $1
    expect(r[10]).toMatchObject({ ok: false, reason: "budget" });
  });

  it("settle replaces the reservation with the real cost", () => {
    const s = new MemoryStore();
    const many = { ...cfg, perVisitor: 100, perIp: 100 };
    reserve(s, k("v"), many, EST);
    settle(s, k("v"), EST, 30_000, false);
    expect(s.getSpend("2026-09-27")).toEqual({ spent: 30_000, reserved: 0 });
  });

  it("stays shut once real spend reaches the cap", () => {
    const s = new MemoryStore();
    s.setSpend("2026-09-27", 950_000, 0);
    expect(reserve(s, k("v"), cfg, EST)).toMatchObject({ ok: false, reason: "budget" });
    expect(reserve(s, k("v"), cfg, 50_000).ok).toBe(true);
  });

  it("a budget of 0 turns the service off", () => {
    const s = new MemoryStore();
    expect(reserve(s, k("v"), { ...cfg, budgetMicroUsd: 0 }, 1)).toMatchObject({ ok: false, reason: "budget" });
  });
});

describe("refunds", () => {
  it("gives the run back when our side failed before any cost", () => {
    const s = new MemoryStore();
    reserve(s, k("v1"), cfg, EST);
    settle(s, k("v1"), EST, 0, true);
    expect(quota(s, k("v1"), cfg)).toEqual({ used: 0, remaining: 3 });
  });
  it("never goes negative", () => {
    const s = new MemoryStore();
    settle(s, k("v1"), EST, 0, true);
    expect(quota(s, k("v1"), cfg).used).toBe(0);
    expect(s.getSpend("2026-09-27").reserved).toBe(0);
  });
});

describe("Riyadh day boundaries", () => {
  it("uses UTC+3 for the day", () => {
    expect(riyadhDay(new Date("2026-09-27T20:59:59Z"))).toBe("2026-09-27");
    expect(riyadhDay(new Date("2026-09-27T21:00:00Z"))).toBe("2026-09-28");
  });
  it("next reset is midnight Riyadh", () => {
    expect(nextRiyadhMidnight(new Date("2026-09-27T10:00:00Z"))).toBe("2026-09-27T21:00:00.000Z");
  });
  it("previousDay", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });
});
