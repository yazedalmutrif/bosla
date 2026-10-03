import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { nextRiyadhMidnight, riyadhDay } from "./hash";
import { previousDay, quota, reserve, settle, type Keys, type LimitConfig, type LimitStore, type ReserveResult } from "./limiter-core";

/**
 * One global Durable Object holds the daily counters (salted hashes only) and the spend ledger.
 * SQLite storage (the only kind on the Workers Free plan). Rows older than yesterday are purged.
 */
export class Limiter extends DurableObject<Env> implements LimitStore {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS spend (day TEXT PRIMARY KEY, spent INTEGER NOT NULL, reserved INTEGER NOT NULL)`);
  }

  // ---- LimitStore ----
  getCount(day: string, key: string): number {
    const row = this.sql.exec<{ n: number }>(`SELECT n FROM counts WHERE day = ? AND key = ?`, day, key).toArray()[0];
    return row?.n ?? 0;
  }
  setCount(day: string, key: string, n: number): void {
    this.sql.exec(`INSERT INTO counts (day, key, n) VALUES (?, ?, ?) ON CONFLICT(day, key) DO UPDATE SET n = excluded.n`, day, key, n);
  }
  getSpend(day: string): { spent: number; reserved: number } {
    const row = this.sql.exec<{ spent: number; reserved: number }>(`SELECT spent, reserved FROM spend WHERE day = ?`, day).toArray()[0];
    return row ?? { spent: 0, reserved: 0 };
  }
  setSpend(day: string, spent: number, reserved: number): void {
    this.sql.exec(
      `INSERT INTO spend (day, spent, reserved) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET spent = excluded.spent, reserved = excluded.reserved`,
      day,
      spent,
      reserved,
    );
  }
  purgeBefore(day: string): void {
    this.sql.exec(`DELETE FROM counts WHERE day < ?`, day);
    this.sql.exec(`DELETE FROM spend WHERE day < ?`, day);
  }

  // ---- RPC ----
  async reserveRun(keys: Keys, cfg: LimitConfig, estimateMicroUsd: number): Promise<ReserveResult> {
    const result = reserve(this, keys, cfg, estimateMicroUsd);
    // Make sure old rows are purged even if traffic stops: an alarm ~1 hour after the next Riyadh midnight.
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.parse(nextRiyadhMidnight()) + 3600_000);
    }
    return result;
  }

  /** Daily cleanup: keep only today and yesterday (Riyadh days). Re-arms itself while rows remain. */
  async alarm(): Promise<void> {
    this.purgeBefore(previousDay(riyadhDay()));
    const left = this.sql.exec<{ c: number }>(`SELECT COUNT(*) AS c FROM counts`).toArray()[0]?.c ?? 0;
    if (left > 0) await this.ctx.storage.setAlarm(Date.parse(nextRiyadhMidnight()) + 3600_000);
  }
  async settleRun(keys: Keys, estimateMicroUsd: number, actualMicroUsd: number, refundRun: boolean): Promise<void> {
    settle(this, keys, estimateMicroUsd, actualMicroUsd, refundRun);
  }
  async getQuota(keys: Keys, cfg: LimitConfig): Promise<{ used: number; remaining: number }> {
    return quota(this, keys, cfg);
  }
  async getSpendToday(day: string): Promise<{ spent: number; reserved: number }> {
    return this.getSpend(day);
  }
}
