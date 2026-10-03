// Small request helpers kept separate so they can be unit-tested.

/**
 * The key used for the per-IP limit. IPv4 as-is; IPv6 by its /64 network, because one home or
 * mobile connection usually gets a whole /64 and could otherwise rotate addresses to dodge the limit.
 */
export function ipBucket(ip: string | null): string {
  if (!ip) return "local";
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full
    .slice(0, 4)
    .map((x) => x.replace(/^0+(?=.)/, ""))
    .join(":") + "::/64";
}

/** Read a request body as text, stopping as soon as it passes `maxBytes` (null = too large). */
export async function readCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
