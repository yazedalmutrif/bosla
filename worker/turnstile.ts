// Server-side Turnstile check. Tokens are single-use and valid for 300 s
// (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/, read 2026-09-27).
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  codes: string[];
}

/** Cloudflare's published test secrets (always pass / always fail / already spent). Never real keys. */
export function isTestSecret(secret: string): boolean {
  return /^[123]x0{31}AA$/.test(secret);
}

export async function verifyTurnstile(
  secret: string | undefined,
  token: string,
  ip: string | null,
  expectedHostname: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!secret) return { ok: false, codes: ["missing-secret"] };
  if (!token || token.length > 2048) return { ok: false, codes: ["missing-input-response"] };
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetchImpl(SITEVERIFY, { method: "POST", body: form });
    if (!res.ok) return { ok: false, codes: [`http-${res.status}`] };
    const data = (await res.json()) as { success?: boolean; hostname?: string; "error-codes"?: string[] };
    if (data.success !== true) return { ok: false, codes: data["error-codes"] ?? [] };
    // The token must have been issued on this site (test keys report a placeholder hostname).
    if (expectedHostname && !isTestSecret(secret) && data.hostname !== expectedHostname) return { ok: false, codes: ["hostname-mismatch"] };
    return { ok: true, codes: [] };
  } catch {
    return { ok: false, codes: ["network"] };
  }
}
