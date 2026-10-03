import { useEffect, useState } from "react";
import type { ConfigResponse } from "../../shared/api";
import { getConfig } from "./api";

let cached: Promise<ConfigResponse | null> | null = null;

export function loadConfig(): Promise<ConfigResponse | null> {
  cached ??= getConfig().catch(() => {
    cached = null;
    return null;
  });
  return cached;
}

export function useConfig(): ConfigResponse | null {
  const [cfg, setCfg] = useState<ConfigResponse | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}
