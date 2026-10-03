// Visitors are identified only by salted hashes (never raw IPs or IDs) for the daily counters.
const enc = new TextEncoder();

export async function hmacHex(salt: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return [...new Uint8Array(sig)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The "day" for limits is the calendar day in Riyadh (UTC+3, no DST). */
export function riyadhDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Next midnight in Riyadh, as an ISO timestamp. */
export function nextRiyadhMidnight(now: Date = new Date()): string {
  const day = riyadhDay(now);
  const midnightUtc = Date.parse(`${day}T00:00:00+03:00`) + 24 * 3600_000;
  return new Date(midnightUtc).toISOString();
}
