/*
 * Daily limits and the spend kill-switch, as pure logic over a small store interface.
 * The Durable Object (limiter.ts) supplies a SQLite-backed store; tests supply a Map.
 * All calls run inside one Durable Object, which processes them one at a time,
 * so check-and-increment can't be raced by parallel requests.
 */

export interface LimitStore {
  getCount(day: string, key: string): number;
  setCount(day: string, key: string, n: number): void;
  getSpend(day: string): { spent: number; reserved: number };
  setSpend(day: string, spent: number, reserved: number): void;
  purgeBefore(day: string): void;
}

export interface LimitConfig {
  perVisitor: number;
  perIp: number;
  budgetMicroUsd: number;
}

export interface Keys {
  day: string;
  visitor: string;
  ip: string;
}

export type ReserveResult =
  | { ok: true; used: number; remaining: number }
  | { ok: false; reason: "visitor" | "ip" | "budget"; used: number; remaining: number };

const vk = (k: string) => `v:${k}`;
const ik = (k: string) => `i:${k}`;

export function quota(store: LimitStore, keys: Keys, cfg: LimitConfig): { used: number; remaining: number } {
  const used = store.getCount(keys.day, vk(keys.visitor));
  const ipUsed = store.getCount(keys.day, ik(keys.ip));
  const remaining = Math.max(0, Math.min(cfg.perVisitor - used, cfg.perIp - ipUsed));
  return { used, remaining };
}

/**
 * Reserve one run: checks visitor limit, IP limit and the day's budget (spent + in-flight reservations
 * + this run's worst-case cost). On success increments both counters and holds the reservation.
 */
export function reserve(store: LimitStore, keys: Keys, cfg: LimitConfig, estimateMicroUsd: number): ReserveResult {
  const v = store.getCount(keys.day, vk(keys.visitor));
  const i = store.getCount(keys.day, ik(keys.ip));
  const q = { used: v, remaining: Math.max(0, Math.min(cfg.perVisitor - v, cfg.perIp - i)) };
  if (v >= cfg.perVisitor) return { ok: false, reason: "visitor", ...q };
  if (i >= cfg.perIp) return { ok: false, reason: "ip", ...q };
  const s = store.getSpend(keys.day);
  if (s.spent + s.reserved + estimateMicroUsd > cfg.budgetMicroUsd) return { ok: false, reason: "budget", ...q };

  store.setCount(keys.day, vk(keys.visitor), v + 1);
  store.setCount(keys.day, ik(keys.ip), i + 1);
  store.setSpend(keys.day, s.spent, s.reserved + estimateMicroUsd);
  // Old days are not needed; keep yesterday for the day boundary.
  store.purgeBefore(previousDay(keys.day));
  return { ok: true, used: v + 1, remaining: Math.max(0, Math.min(cfg.perVisitor - v - 1, cfg.perIp - i - 1)) };
}

/**
 * Settle a run: release the reservation, record the real cost. If `refundRun` (the run failed on our
 * side before producing anything useful), give the visitor their run back.
 */
export function settle(store: LimitStore, keys: Keys, estimateMicroUsd: number, actualMicroUsd: number, refundRun: boolean): void {
  const s = store.getSpend(keys.day);
  store.setSpend(keys.day, s.spent + Math.max(0, actualMicroUsd), Math.max(0, s.reserved - estimateMicroUsd));
  if (refundRun) {
    store.setCount(keys.day, vk(keys.visitor), Math.max(0, store.getCount(keys.day, vk(keys.visitor)) - 1));
    store.setCount(keys.day, ik(keys.ip), Math.max(0, store.getCount(keys.day, ik(keys.ip)) - 1));
  }
}

export function previousDay(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`) - 24 * 3600_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** In-memory store for tests and local reasoning. */
export class MemoryStore implements LimitStore {
  counts = new Map<string, number>();
  spend = new Map<string, { spent: number; reserved: number }>();
  getCount(day: string, key: string) {
    return this.counts.get(`${day}|${key}`) ?? 0;
  }
  setCount(day: string, key: string, n: number) {
    this.counts.set(`${day}|${key}`, n);
  }
  getSpend(day: string) {
    return this.spend.get(day) ?? { spent: 0, reserved: 0 };
  }
  setSpend(day: string, spent: number, reserved: number) {
    this.spend.set(day, { spent, reserved });
  }
  purgeBefore(day: string) {
    for (const k of this.counts.keys()) if (k.slice(0, 10) < day) this.counts.delete(k);
    for (const k of this.spend.keys()) if (k < day) this.spend.delete(k);
  }
}
